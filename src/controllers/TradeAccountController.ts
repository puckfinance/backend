import { Router, Request, Response } from 'express';
import * as passport from 'passport';
import { User, Provider } from '@prisma/client';
import prisma from '../infrastructure/prisma';
import { CryptoService } from '../services/crypto';
import { z } from 'zod';

const tradeAccountSchema = z.object({
  apiKey: z.string(),
  secretKey: z.string(),
  name: z.string(),
  provider: z.nativeEnum(Provider),
});

class TradeAccountController {
  /**
   * Get all trade accounts for the authenticated user
   */
  public async getAll(req: Request, res: Response) {
    try {
      const userId = (req.user as User).id;
      
      const accounts = await prisma.tradeAccount.findMany({
        where: { userId },
      });
      
      // Return accounts with encrypted keys
      res.json(accounts);
    } catch (error: any) {
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
      
      const account = await prisma.tradeAccount.findFirst({
        where: { 
          id: accountId,
          userId, // Ensure account belongs to the user
        },
      });
      
      if (!account) {
        return res.status(404).json({ message: 'Trade account not found' });
      }
      
      // Return account with encrypted keys
      res.json(account);
    } catch (error: any) {
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
      const { apiKey, secretKey, name, provider } = tradeAccountSchema.parse(req.body);
      
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
        return res.status(400).json({ message: 'Invalid request data', errors: error.errors });
      }
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
      const { apiKey, secretKey, name } = tradeAccountSchema.parse(req.body);
      
      // Check if account exists and belongs to user
      const existingAccount = await prisma.tradeAccount.findFirst({
        where: { 
          id: accountId,
          userId,
        },
      });
      
      if (!existingAccount) {
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
        apiKey,
        secretKey,
      };
      
      res.json(responseAccount);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid request data', errors: error.errors });
      }
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
      
      // Check if account exists and belongs to user
      const existingAccount = await prisma.tradeAccount.findFirst({
        where: { 
          id: accountId,
          userId,
        },
      });
      
      if (!existingAccount) {
        return res.status(404).json({ message: 'Trade account not found' });
      }
      
      // Delete account
      await prisma.tradeAccount.delete({
        where: { id: accountId },
      });
      
      res.status(204).send();
    } catch (error: any) {
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