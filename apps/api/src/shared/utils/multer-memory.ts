import { BadRequestException } from '@nestjs/common';
import * as fs from 'fs';
import { memoryStorage } from 'multer';

export const multerMemoryZip = {
  storage: memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
};

export function readUploadedFileBuffer(
  file: Express.Multer.File | undefined,
  missingMessage = 'Thiếu file ZIP',
): Buffer {
  if (!file) throw new BadRequestException(missingMessage);
  if (file.buffer?.length) return file.buffer;
  if (file.path && fs.existsSync(file.path)) {
    try {
      return fs.readFileSync(file.path);
    } finally {
      fs.unlinkSync(file.path);
    }
  }
  throw new BadRequestException(missingMessage);
}
