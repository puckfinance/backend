import { Request, Response, Router } from 'express';
import { User } from '@prisma/client';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import prisma from '../infrastructure/prisma';
import logger from '../utils/Logger';
import passport from 'passport';
import { CSVProcessorService } from '../services/csvProcessor';

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const uploadPath = 'uploads/strategies';
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    
    cb(null, uploadPath);
  },
  filename: (_req, file, cb) => {
    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    cb(null, `strategy-${uniqueSuffix}${extension}`);
  }
});

// File filter to only allow CSV files
const fileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
    cb(null, true);
  } else {
    cb(new Error('Only CSV files are allowed!'));
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  }
});

/**
 * Strategy Controller
 *
 * @author AI Assistant
 * @createdDate Current Date
 */
export class StrategyController {
  
  /**
   * Create a new strategy with CSV file upload
   */
  public static async createStrategy(req: Request, res: Response) {
    try {
      const user = req.user as User;
      if (!user) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      const { name, description } = req.body;
      
      // Validate required fields
      if (!name || !description) {
        return res.status(400).json({ 
          message: 'Name and description are required' 
        });
      }

      // Check if file was uploaded
      if (!req.file) {
        return res.status(400).json({ 
          message: 'CSV file is required' 
        });
      }

      // Validate CSV file
      const validationResult = await CSVProcessorService.validateStrategyCSV(req.file.path);
      if (!validationResult.isValid) {
        // Clean up invalid file
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
        return res.status(400).json({ 
          message: 'Invalid CSV file',
          errors: validationResult.errors
        });
      }

      // Get CSV statistics for storage
      const csvStats = await CSVProcessorService.getCSVStats(req.file.path);

      // Create strategy record
      const strategy = await prisma.strategy.create({
        data: {
          name: name.trim(),
          description: description.trim(),
          fileUrl: req.file.path,
          ownerId: user.id,
        },
        include: {
          owner: {
            select: {
              id: true,
              email: true,
            }
          }
        }
      });

      logger.info('Strategy created successfully', {
        strategyId: strategy.id,
        userId: user.id,
        fileName: req.file.originalname
      });

      return res.status(201).json({
        message: 'Strategy created successfully',
        strategy: {
          ...strategy,
          fileName: req.file.originalname,
          fileSize: req.file.size,
          csvStats: {
            rowCount: csvStats.rowCount,
            columnCount: csvStats.columnCount,
            headers: csvStats.headers,
          }
        }
      });

    } catch (error) {
      logger.error('Strategy creation error:', error);
      
      // Clean up uploaded file if strategy creation failed
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      
      return res.status(500).json({ 
        message: 'Internal server error' 
      });
    }
  }

  /**
   * Get all strategies for the authenticated user
   */
  public static async getStrategies(req: Request, res: Response) {
    try {
      const user = req.user as User;
      if (!user) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      const strategies = await prisma.strategy.findMany({
        where: {
          ownerId: user.id,
        },
        include: {
          owner: {
            select: {
              id: true,
              email: true,
            }
          },
          _count: {
            select: {
              tradeAccount: true,
            }
          }
        },
        orderBy: {
          createdAt: 'desc',
        }
      });

      return res.status(200).json({
        strategies: strategies.map(strategy => ({
          ...strategy,
          fileName: strategy.fileUrl ? path.basename(strategy.fileUrl) : null,
          connectedAccounts: strategy._count.tradeAccount,
        }))
      });

    } catch (error) {
      logger.error('Get strategies error:', error);
      return res.status(500).json({ 
        message: 'Internal server error' 
      });
    }
  }

  /**
   * Get strategy by ID
   */
  public static async getStrategyById(req: Request, res: Response) {
    try {
      const user = req.user as User;
      if (!user) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      const { id } = req.params;

      const strategy = await prisma.strategy.findFirst({
        where: {
          id: id,
          ownerId: user.id, // Ensure user can only access their own strategies
        },
        include: {
          owner: {
            select: {
              id: true,
              email: true,
            }
          },
          tradeAccount: true,
        }
      });

      if (!strategy) {
        return res.status(404).json({ 
          message: 'Strategy not found' 
        });
      }

      return res.status(200).json({
        strategy: {
          ...strategy,
          fileName: strategy.fileUrl ? path.basename(strategy.fileUrl) : null,
        }
      });

    } catch (error) {
      logger.error('Get strategy by ID error:', error);
      return res.status(500).json({ 
        message: 'Internal server error' 
      });
    }
  }

  /**
   * Update strategy
   */
  public static async updateStrategy(req: Request, res: Response) {
    try {
      const user = req.user as User;
      if (!user) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      const { id } = req.params;
      const { name, description } = req.body;

      // Check if strategy exists and belongs to user
      const existingStrategy = await prisma.strategy.findFirst({
        where: {
          id: id,
          ownerId: user.id,
        }
      });

      if (!existingStrategy) {
        return res.status(404).json({ 
          message: 'Strategy not found' 
        });
      }

      const updateData: any = {};
      if (name) updateData.name = name.trim();
      if (description) updateData.description = description.trim();

      // Handle file update if new file is uploaded
      if (req.file) {
        // Delete old file if it exists
        if (existingStrategy.fileUrl && fs.existsSync(existingStrategy.fileUrl)) {
          fs.unlinkSync(existingStrategy.fileUrl);
        }
        updateData.fileUrl = req.file.path;
      }

      const updatedStrategy = await prisma.strategy.update({
        where: { id: id },
        data: updateData,
        include: {
          owner: {
            select: {
              id: true,
              email: true,
            }
          }
        }
      });

      logger.info('Strategy updated successfully', {
        strategyId: id,
        userId: user.id,
      });

      return res.status(200).json({
        message: 'Strategy updated successfully',
        strategy: {
          ...updatedStrategy,
          fileName: req.file ? req.file.originalname : (updatedStrategy.fileUrl ? path.basename(updatedStrategy.fileUrl) : null),
        }
      });

    } catch (error) {
      logger.error('Strategy update error:', error);
      
      // Clean up uploaded file if update failed
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      
      return res.status(500).json({ 
        message: 'Internal server error' 
      });
    }
  }

  /**
   * Get CSV file statistics for a strategy
   */
  public static async getCSVStats(req: Request, res: Response) {
    try {
      const user = req.user as User;
      if (!user) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      const { id } = req.params;

      // Check if strategy exists and belongs to user
      const strategy = await prisma.strategy.findFirst({
        where: {
          id: id,
          ownerId: user.id,
        }
      });

      if (!strategy) {
        return res.status(404).json({ 
          message: 'Strategy not found' 
        });
      }

      if (!strategy.fileUrl || !fs.existsSync(strategy.fileUrl)) {
        return res.status(404).json({ 
          message: 'CSV file not found' 
        });
      }

      const csvStats = await CSVProcessorService.getCSVStats(strategy.fileUrl);

      return res.status(200).json({
        csvStats: csvStats
      });

    } catch (error) {
      logger.error('Get CSV stats error:', error);
      return res.status(500).json({ 
        message: 'Internal server error' 
      });
    }
  }

  /**
   * Delete strategy
   */
  public static async deleteStrategy(req: Request, res: Response) {
    try {
      const user = req.user as User;
      if (!user) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      const { id } = req.params;

      // Check if strategy exists and belongs to user
      const strategy = await prisma.strategy.findFirst({
        where: {
          id: id,
          ownerId: user.id,
        }
      });

      if (!strategy) {
        return res.status(404).json({ 
          message: 'Strategy not found' 
        });
      }

      // Delete the strategy
      await prisma.strategy.delete({
        where: { id: id }
      });

      // Delete associated file
      if (strategy.fileUrl && fs.existsSync(strategy.fileUrl)) {
        fs.unlinkSync(strategy.fileUrl);
      }

      logger.info('Strategy deleted successfully', {
        strategyId: id,
        userId: user.id,
      });

      return res.status(200).json({
        message: 'Strategy deleted successfully'
      });

    } catch (error) {
      logger.error('Strategy deletion error:', error);
      return res.status(500).json({ 
        message: 'Internal server error' 
      });
    }
  }
}

/**
 * Strategy routes
 */
export default () => {
  const routes = Router();

  // Create strategy with file upload
  routes.post('/', 
    passport.authenticate('jwt', { session: false }),
    upload.single('file'),
    StrategyController.createStrategy
  );

  // Get all strategies
  routes.get('/', 
    passport.authenticate('jwt', { session: false }),
    StrategyController.getStrategies
  );

  // Get strategy by ID
  routes.get('/:id', 
    passport.authenticate('jwt', { session: false }),
    StrategyController.getStrategyById
  );

  // Update strategy
  routes.put('/:id', 
    passport.authenticate('jwt', { session: false }),
    upload.single('file'),
    StrategyController.updateStrategy
  );

  // Delete strategy
  routes.delete('/:id', 
    passport.authenticate('jwt', { session: false }),
    StrategyController.deleteStrategy
  );

  // Get CSV statistics
  routes.get('/:id/csv-stats', 
    passport.authenticate('jwt', { session: false }),
    StrategyController.getCSVStats
  );

  return routes;
}; 