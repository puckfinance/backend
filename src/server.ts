import express from 'express';
import { createServer, Server } from 'http';
import { SystemDefaults } from './constants';

import dotenv from 'dotenv';
import { run } from './app';
import { connectPrisma, disconnectPrisma } from './infrastructure/prisma';
import logger from './utils/Logger';
import { initializeWebSocket } from './controllers/webSocket.controller';

dotenv.config();

/**
 * Үндсэн серверийн класс
 *
 * @author Uurtsaikh
 * @createdDate 01/04/2020
 */
class MainServer {
  /** Express application */
  private _app: express.Application | undefined;

  /** Http server */
  private server: Server | undefined;

  private port: string | number;

  constructor() {
    this.port = process.env.PORT || SystemDefaults.PORT;
    this.initialize();
  }

  /**
   * Initialize the server
   */
  private async initialize() {
    try {
      // Connect to Prisma before app initialization
      await connectPrisma();
      
      // Initialize Express app
      this._app = await run();
      this.server = createServer(this._app);

      initializeWebSocket(this.server);

      this.listen();
      
      // Handle graceful shutdown
      this.setupGracefulShutdown();
    } catch (error) {
      logger.error('Server initialization failed:', error);
      process.exit(1);
    }
  }

  /**
   * Set up handlers for graceful shutdown
   */
  private setupGracefulShutdown() {
    // Handle application termination
    process.on('SIGINT', async () => {
      logger.info('SIGINT received. Shutting down gracefully...');
      await this.shutdown();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received. Shutting down gracefully...');
      await this.shutdown();
      process.exit(0);
    });

    // Handle uncaught exceptions - but in production, try to keep the server running
    process.on('uncaughtException', async (error) => {
      logger.error('Uncaught Exception:', error);
      
      // In production, log the error but try to keep the server running unless it's a critical error
      if (process.env.NODE_ENV === 'production') {
        // Only exit if it's a critical error we can't recover from
        if (this.isCriticalError(error)) {
          logger.error('Critical error detected, shutting down server...');
          await this.shutdown();
          process.exit(1);
        } else {
          logger.error('Non-critical error, attempting to continue operation');
        }
      } else {
        // In development, exit on any uncaught exception for easier debugging
        await this.shutdown();
        process.exit(1);
      }
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', async (reason, promise) => {
      logger.error('Unhandled Rejection at:', { promise, reason });
      
      // In production, log the error but don't exit the process
      if (process.env.NODE_ENV !== 'production') {
        // In development, exit for easier debugging
        logger.error('Exiting due to unhandled promise rejection in development mode');
        await this.shutdown();
        process.exit(1);
      }
    });
  }

  /**
   * Determine if an error is critical enough to warrant shutting down the server
   */
  private isCriticalError(error: Error): boolean {
    // Define what constitutes a critical error
    const criticalErrorTypes = [
      'SystemError',
      'ReferenceError'
    ];
    
    // Check if error is from a critical subsystem
    const criticalErrorMessages = [
      'database connection',
      'out of memory',
      'prisma',
      'ECONNREFUSED'
    ];
    
    // Check error type
    if (criticalErrorTypes.some(type => error.name === type)) {
      return true;
    }
    
    // Check error message
    if (criticalErrorMessages.some(msg => error.message.toLowerCase().includes(msg))) {
      return true;
    }
    
    return false;
  }

  /**
   * Clean shutdown of server and database connections
   */
  private async shutdown() {
    logger.info('Shutting down server...');
    if (this.server) {
      this.server.close();
    }
    await disconnectPrisma();
  }

  /**
   *
   * @author Uurtsaikh
   * @createdDate 01/04/2020
   * @lastModifyDate 01/04/2020
   */
  private listen(): void {
    if (!this.server) return;

    this.server.listen(this.port, () => {
      logger.info(`*** Listening on port: ${this.port} ***`);
    });
  }

  public async unlisten(): Promise<void> {
    if (!this.server) return;
    
    await this.shutdown();
  }

  /**
   * Серверыг буцаах үйлдэл
   *
   * @author Munkhjin
   * @createdDate 01/04/2020
   * @lastModifyDate 01/04/2020
   */
  get app(): express.Application | undefined {
    return this._app;
  }
}

/** Обьектийг үүсгэж серверыг дуудах */
const server = new MainServer();
export default server;
