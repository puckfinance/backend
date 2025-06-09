import { Server, Socket } from 'socket.io';
import { ExtendedError } from 'socket.io/dist/namespace';
import http from 'http';
import jwt from 'jsonwebtoken';
import { EventEmitter } from 'events';
import BinanceWebSocketService from '../services/binanceWebSocket.service';
import prisma from '../infrastructure/prisma';
import { CryptoService } from '../services/crypto';
import logger from '../utils/Logger';

interface JwtPayload {
  id: string;
}

interface SocketWithUser extends Socket {
  user?: JwtPayload;
}

const socketAuthenticator = (socket: SocketWithUser, next: (err?: ExtendedError) => void) => {
  const token = socket.handshake.auth.token || socket.handshake.query.token;

  if (!token) {
    logger.warn(`Socket authentication failed for socket ID: ${socket.id}. Reason: Token not provided.`);
    return next(new Error('Authentication error: Token not provided'));
  }

  if (!process.env.JWT_SECRET) {
    logger.error('JWT_SECRET is not defined in environment variables');
    return next(new Error('Server configuration error'));
  }

  jwt.verify(token, process.env.JWT_SECRET, (err: any, decoded: any) => {
    if (err) {
      logger.warn(`Socket authentication failed for socket ID: ${socket.id}. Reason: Invalid token.`, err);
      return next(new Error('Authentication error: Invalid token'));
    }
    socket.user = decoded as JwtPayload;
    logger.info(`Socket authenticated successfully for socket ID: ${socket.id}, User ID: ${socket.user?.id}`);
    next();
  });
};

export const initializeWebSocket = (server: http.Server) => {
  const io = new Server(server, {
    cors: {
      origin: process.env.CORS_ORIGIN || '*',
      methods: ['GET', 'POST'],
    },
  });

  io.use(socketAuthenticator);

  io.on('connection', async (socket: SocketWithUser) => {
    logger.info(`Client connected: ${socket.id}`);

    const tradeAccountId = socket.handshake.query.tradeAccountId as string;

    if (!tradeAccountId) {
      logger.error('tradeAccountId is not provided in the query string.');
      socket.emit('error', 'tradeAccountId must be provided as a query parameter.');
      socket.disconnect();
      return;
    }

    try {
      const account = await prisma.tradeAccount.findUnique({
        where: { id: tradeAccountId },
      });

      if (!account || (socket.user && account.userId !== socket.user.id)) {
        logger.error(
          `Trade account with id ${tradeAccountId} not found or user does not have permission.`,
        );
        socket.emit('error', 'Trade account not found or permission denied.');
        socket.disconnect();
        return;
      }

      const apiKey = CryptoService.decrypt(account.apiKey);
      const apiSecret = CryptoService.decrypt(account.secretKey);

      const binanceService = new BinanceWebSocketService(apiKey, apiSecret);

      const wsWrapper = new EventEmitter();
      // @ts-ignore
      wsWrapper.send = (data: string) => socket.emit('message', data);
      // @ts-ignore
      wsWrapper.readyState = 1;
      // @ts-ignore
      wsWrapper.OPEN = 1;
      // @ts-ignore
      wsWrapper.close = () => socket.disconnect();

      socket.on('message', (message) => {
        wsWrapper.emit('message', message);
      });

      // @ts-ignore
      await binanceService.connect(wsWrapper);

    } catch (error) {
      logger.error('Failed to process WebSocket connection:', error);
      socket.emit('error', 'Failed to process request.');
      socket.disconnect();
    }

    socket.on('disconnect', () => {
      logger.info(`Client disconnected: ${socket.id}`);
    });

    socket.on('message', (message: string) => {
      logger.info(`Received message from ${socket.id}: ${message}`);
    });
  });

  return io;
}; 