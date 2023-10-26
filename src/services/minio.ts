import * as Minio from 'minio';

export class MinioService {
  private client;
  private static instance: MinioService;
  private static bucketName = process.env.MINIO_BUCKETNAME;

  private constructor() {
    this.client = new Minio.Client({
      endPoint: process.env.MINIO_ENDPOINT,
      port: parseInt(process.env.MINIO_PORT),
      useSSL: false,
      accessKey: process.env.MINIO_ACCESSKEY,
      secretKey: process.env.MINIO_SECRETKEY,
    });
  }

  public getUrlForFile(fileName: string) {
    //add http or https scheme based on your environment
    const scheme = process.env.NODE_ENV === 'production' ? 'https' : 'http';
    return `${scheme}://${process.env.MINIO_ENDPOINT}:${process.env.MINIO_PORT}/${MinioService.bucketName}/${fileName}`;
  }

  public async uploadFromBuffer(fileName: string, buffer: Buffer) {
    return await this.client.putObject(MinioService.bucketName, fileName, buffer);
  }

  public async uploadFile(fileName: string, filePath: string) {
    return await this.client.fPutObject(MinioService.bucketName, fileName, filePath);
  }

  public async getPresignedUrl(fileName: string, expiry: number) {
    return await this.client.presignedGetObject(MinioService.bucketName, fileName, expiry);
  }

  //presigned url for put object
  public async getPresignedUrlForPutObject(fileName: string, expiry: number) {
    return await this.client.presignedPutObject(MinioService.bucketName, fileName, expiry);
  }

  public static getInstance(): MinioService {
    if (!MinioService.instance) {
      MinioService.instance = new MinioService();
    }

    return MinioService.instance;
  }
}
