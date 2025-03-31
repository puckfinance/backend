import { Router, Request, Response } from 'express';
import * as passport from 'passport';
import { User, Provider } from '@prisma/client';
import prisma from '../infrastructure/prisma';
import { CryptoService } from '../services/crypto';
import { z } from 'zod';
import logger from '../utils/Logger';

const createTradeAccountSchema = z.object({
  apiKey: z.string(),
  secretKey: z.string(),
  name: z.string(),
  provider: z.nativeEnum(Provider),
});

const updateTradeAccountSchema = z.object({
  name: z.string(),
});

class TradeAccountController {
  /**
   * Get all trade accounts for the authenticated user
   */
  public async getAll(req: Request, res: Response) {
    try {
      const userId = (req.user as User).id;
      
      logger.info(`Getting all trade accounts for user ${userId}`);
      const accounts = await prisma.tradeAccount.findMany({
        where: { userId },
      });
      
      // Return accounts with encrypted keys
      res.json(accounts);
    } catch (error: any) {
      logger.error('Failed to get trade accounts', error);
      res.status(500).json({ message: error?.message || 'Failed to get trade accounts' });
    }
  }
  
  /**
   * Get a trade account by ID
   */
  public async getById(req: Request, res: Response) {
    try {
      const userId = (req.user as User).id;
      const accountId = req.params.id;
      
      logger.info(`Getting trade account ${accountId} for user ${userId}`);
      const account = await prisma.tradeAccount.findFirst({
        where: { 
          id: accountId,
          userId, // Ensure account belongs to the user
        },
      });
      
      if (!account) {
        logger.warn(`Trade account ${accountId} not found for user ${userId}`);
        return res.status(404).json({ message: 'Trade account not found' });
      }
      
      // Return account with encrypted keys
      res.json(account);
    } catch (error: any) {
      logger.error(`Failed to get trade account ${req.params.id}`, error);
      res.status(500).json({ message: error?.message || 'Failed to get trade account' });
    }
  }
  
  /**
   * Create a new trade account
   */
  public async create(req: Request, res: Response) {
    try {
      const userId = (req.user as User).id;
      
      // Validate request body
      const { apiKey, secretKey, name, provider } = createTradeAccountSchema.parse(req.body);
      
      logger.info(`Creating new ${provider} trade account for user ${userId}`);
      
      // Encrypt sensitive data
      const encryptedApiKey = CryptoService.encrypt(apiKey);
      const encryptedSecretKey = CryptoService.encrypt(secretKey);
      
      const account = await prisma.tradeAccount.create({
        data: {
          apiKey: encryptedApiKey,
          secretKey: encryptedSecretKey,
          userId,
          name,
          provider,
        },
      });
      
      // Return the account with decrypted keys in the response
      const responseAccount = {
        ...account,
        apiKey,
        secretKey,
      };
      
      res.status(201).json(responseAccount);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        logger.warn('Invalid trade account data', { errors: error.errors });
        return res.status(400).json({ message: 'Invalid request data', errors: error.errors });
      }
      logger.error('Failed to create trade account', error);
      res.status(500).json({ message: error?.message || 'Failed to create trade account' });
    }
  }
  
  /**
   * Update a trade account
   */
  public async update(req: Request, res: Response) {
    try {
      const userId = (req.user as User).id;
      const accountId = req.params.id;
      
      // Validate request body
      const { name } = updateTradeAccountSchema.parse(req.body);
      
      logger.info(`Updating trade account ${accountId} for user ${userId}`);
      
      // Check if account exists and belongs to user
      const existingAccount = await prisma.tradeAccount.findFirst({
        where: { 
          id: accountId,
          userId,
        },
      });
      
      if (!existingAccount) {
        logger.warn(`Trade account ${accountId} not found for user ${userId}`);
        return res.status(404).json({ message: 'Trade account not found' });
      }
      
      // Update account
      const updatedAccount = await prisma.tradeAccount.update({
        where: { id: accountId },
        data: {
          name,
        },
      });
      
      // Return the account with decrypted keys in the response
      const responseAccount = {
        ...updatedAccount,
      };
      
      res.json(responseAccount);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        logger.warn('Invalid trade account update data', { errors: error.errors });
        return res.status(400).json({ message: 'Invalid request data', errors: error.errors });
      }
      logger.error(`Failed to update trade account ${req.params.id}`, error);
      res.status(500).json({ message: error?.message || 'Failed to update trade account' });
    }
  }
  
  /**
   * Delete a trade account
   */
  public async delete(req: Request, res: Response) {
    try {
      const userId = (req.user as User).id;
      const accountId = req.params.id;
      
      logger.info(`Deleting trade account ${accountId} for user ${userId}`);
      
      // Check if account exists and belongs to user
      const existingAccount = await prisma.tradeAccount.findFirst({
        where: { 
          id: accountId,
          userId,
        },
      });
      
      if (!existingAccount) {
        logger.warn(`Trade account ${accountId} not found for user ${userId}`);
        return res.status(404).json({ message: 'Trade account not found' });
      }
      
      // Delete account
      await prisma.tradeAccount.delete({
        where: { id: accountId },
      });
      
      res.status(204).send();
    } catch (error: any) {
      logger.error(`Failed to delete trade account ${req.params.id}`, error);
      res.status(500).json({ message: error?.message || 'Failed to delete trade account' });
    }
  }
}

export default () => {
  const controller = new TradeAccountController();
  const router = Router();
  
  // Apply JWT authentication to all routes
  router.use(passport.authenticate('jwt', { session: false }));
  
  // Define routes
  router.get('/', controller.getAll);
  router.get('/:id', controller.getById);
  router.post('/', controller.create);
  router.put('/:id', controller.update);
  router.delete('/:id', controller.delete);
  
  return router;
}; 