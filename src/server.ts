import * as express from 'express';
import { createServer, Server } from 'http';
import { SystemDefaults } from './constants';

import * as dotenv from 'dotenv';
import { run } from './app';
import { connectPrisma, disconnectPrisma } from './infrastructure/prisma';

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
      this.listen();
      
      // Handle graceful shutdown
      this.setupGracefulShutdown();
    } catch (error) {
      console.error('Server initialization failed:', error);
      process.exit(1);
    }
  }

  /**
   * Set up handlers for graceful shutdown
   */
  private setupGracefulShutdown() {
    // Handle application termination
    process.on('SIGINT', async () => {
      console.log('SIGINT received. Shutting down gracefully...');
      await this.shutdown();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('SIGTERM received. Shutting down gracefully...');
      await this.shutdown();
      process.exit(0);
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', async (error) => {
      console.error('Uncaught Exception:', error);
      await this.shutdown();
      process.exit(1);
    });

    process.on('unhandledRejection', async (reason, promise) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    });
  }

  /**
   * Clean shutdown of server and database connections
   */
  private async shutdown() {
    console.log('Shutting down server...');
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
      console.log('*** Listening on port: %s ***', this.port);
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
