/**
 * AI Routes
 * 
 * API routes for AI-powered market analysis
 * 
 * @author AI Assistant
 * @createdDate 2026-04-06
 */

import { Router } from 'express';
import AIAnalysisController from '../controllers/AIAnalysisController';

const router: Router = AIAnalysisController();

export default router;
