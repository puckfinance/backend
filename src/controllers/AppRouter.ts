import { NextFunction, Request, RequestHandler, Router } from 'express';
import { AppResponse } from '../interfaces';





export class AppRouter {
    router = Router();


    public get(path: string, ...handlers: RequestHandler[]) {
        this.router.get(path, ...handlers.slice(0, handlers.length - 1), this.responseHandler(handlers[handlers.length - 1]));
    }
    public post(path: string, ...handlers: RequestHandler[]) {
        this.router.post(path, ...handlers.slice(0, handlers.length - 1), this.responseHandler(handlers[handlers.length - 1]));
    }
    public put(path: string, ...handlers: RequestHandler[]) {
        this.router.put(path, ...handlers.slice(0, handlers.length - 1), this.responseHandler(handlers[handlers.length - 1]));
    }
    public delete(path: string, ...handlers: RequestHandler[]) {
        this.router.delete(path, ...handlers.slice(0, handlers.length - 1), this.responseHandler(handlers[handlers.length - 1]));
    }

    responseHandler = (fn: Function) => async (req: Request, res: AppResponse, next: NextFunction) => {
        try {
            await fn(req, res, next);
        } catch (e) {
            res.sendError(e);
        }
    };
}
