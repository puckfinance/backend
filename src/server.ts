import * as express from 'express';
import { createServer, Server } from 'http';
import { SystemDefaults } from './constants';

import * as dotenv from 'dotenv';
import redisClient from './services/redis';
import { run } from './app';

dotenv.config();

/**
 * Үндсэн серверийн класс
 *
 * @author Uurtsaikh
 * @createdDate 01/04/2020
 */
class MainServer {
  /** Express application */
  private _app: express.Application;

  /** Http server */
  private server: Server;

  /** Сервер чагнах port */
  private port: string | number;

  /**
   * Байгуулагч үйлдэл анхны тохиргоонууд, утгууд оноогдоно
   *
   * @author Uurtsaikh
   * @createdDate 01/04/2020
   * @lastModifyDate 01/04/2020
   */
  constructor() {
    // if(process.env.NODE_ENV !== 'production'){
    //   registerEnv();
    // }
    this.port = process.env.PORT || SystemDefaults.PORT;
    run().then((app) => {
      this._app = app;
      this.server = createServer(this._app);
      this.listen();
    });

    // console.log(process.env)
  }

  /**
   * Сервер сонсох port болон socket холболтуул хийх
   *
   * @author Uurtsaikh
   * @createdDate 01/04/2020
   * @lastModifyDate 01/04/2020
   */
  private listen(): void {
    redisClient.init();
    this.server.listen(this.port, () => {
      console.log('*** Listening on port: %s ***', this.port);
    });
  }

  public unlisten(): void {
    this.server.close();
  }

  /**
   * Серверыг буцаах үйлдэл
   *
   * @author Munkhjin
   * @createdDate 01/04/2020
   * @lastModifyDate 01/04/2020
   */
  get app(): express.Application {
    return this._app;
  }
}

/** Обьектийг үүсгэж серверыг дуудах */
const server = new MainServer();
export default server;
