import { NextFunction } from 'express';
import { MinioService } from '../services/minio';
import { AppResponse, AppRequest } from '../interfaces';
import { fileNameSchema } from '../domain/schemas/fileNameSchema';
import { FileTransferResponse } from '../domain/outputs/fileTransferResponse';
import { AppRouter } from './AppRouter';
import passport = require('passport');
import * as multer from 'multer';

const generateFileName = (file_name: string) => {
  const file_name_array = file_name.split('.');
  const file_extension = file_name_array[file_name_array.length - 1];
  const file_name_without_extension = file_name_array.slice(0, file_name_array.length - 1).join('.');
  const random_string = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  return `${file_name_without_extension}_${random_string}.${file_extension}`;
};

class FileController {
  public async uploadFile(req: AppRequest, res: AppResponse, next: NextFunction) {
    try {
      const { file_name } = req.parseBody(fileNameSchema);
      const unique_file_name = generateFileName(file_name);
      const minio = MinioService.getInstance();

      const presigned_url = await minio.getPresignedUrlForPutObject(unique_file_name, 60 * 60 * 24 * 7);
      const resp: FileTransferResponse = {
        presigned_url,
        file_name: minio.getUrlForFile(unique_file_name),
      };
      res.sendSuccess(resp);
    } catch (error) {
      next(error)
    }


  }

  public async getFile(req: AppRequest, res: AppResponse) {
    const { file_name } = req.parseBody(fileNameSchema);
    const minio = MinioService.getInstance();
    const presigned_url = await minio.getPresignedUrl(file_name, 60 * 60 * 24 * 7);
    const resp: FileTransferResponse = {
      presigned_url,
      file_name,
    };
    res.sendSuccess(resp);
  }

  uploadFormdata = async (req: AppRequest, res: AppResponse) => {
    const fileBuffer = req.file.buffer;
    const minio = MinioService.getInstance();
    const unique_file_name = generateFileName(req.file.originalname);
    await minio.uploadFromBuffer(unique_file_name, fileBuffer);
    const resp = {
      file_name: minio.getUrlForFile(unique_file_name),
    };
    res.sendSuccess(resp);
  }
}

export default () => {
  const controller = new FileController();
  const router = new AppRouter();
  const storage = multer.memoryStorage();
  const upload = multer({ storage: storage });

  router.router.use(passport.authenticate('jwt', { session: false }))
  router.post('/upload', controller.uploadFile);
  router.post('/get', controller.getFile);

  router.post('/upload-form', upload.single('file'), controller.uploadFormdata);

  return router.router;
};
