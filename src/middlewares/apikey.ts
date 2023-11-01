import { NextFunction, Request, Response } from 'express';

const validApiKeys = [process.env.API_KEY];

const apiKeyMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const apiKey = req.headers.authorization;

  if (validApiKeys.includes(apiKey)) {
    next(); // API key is valid, proceed to the next middleware or route
  } else {
    res.status(403).json({ message: 'Invalid API key' });
  }
};

export default apiKeyMiddleware;
