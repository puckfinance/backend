/**
 * Whale Routes
 * 
 * API routes for whale tracking
 * 
 * @author AI Assistant
 * @createdDate 2026-04-05
 */

import { Router } from 'express';
import WhaleController from '../controllers/WhaleController';

const router: Router = WhaleController();

export default router;
