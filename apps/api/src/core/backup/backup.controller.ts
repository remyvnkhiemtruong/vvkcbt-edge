import { Controller, Get, Post, Body, Param, Res, UseGuards, UploadedFile, UseInterceptors, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { multerMemoryZip, readUploadedFileBuffer } from '../../shared/utils/multer-memory';
import { Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { BackupService } from './backup.service';
import { StaffAuthGuard, StaffRoles } from '../../shared/guards/staff-auth.guard';

@Controller('core/backup')
export class BackupController {
  constructor(private readonly backupService: BackupService) {}

  @Post()
  @UseGuards(StaffAuthGuard)
  @StaffRoles('admin', 'proctor')
  async create() {
    const backupPath = await this.backupService.createBackup();
    return { path: backupPath, message: 'Đã tạo bản sao lưu' };
  }

  @Post('restore')
  @UseGuards(StaffAuthGuard)
  @StaffRoles('admin', 'proctor')
  async restore(@Body() body: { filename: string }) {
    return this.backupService.restoreBackup(body.filename);
  }

  @Post('import')
  @UseGuards(StaffAuthGuard)
  @StaffRoles('admin', 'proctor')
  @UseInterceptors(FileInterceptor('file', multerMemoryZip))
  async importBackup(@UploadedFile() file: Express.Multer.File) {
    const buffer = readUploadedFileBuffer(file, 'Chưa chọn file sao lưu');
    const name = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    if (!name.endsWith('.zip') && !name.endsWith('.enc')) {
      throw new BadRequestException('File phải có đuôi .zip hoặc .enc');
    }
    return this.backupService.importAndRestore(buffer, name);
  }

  @Get('download/:filename')
  @UseGuards(StaffAuthGuard)
  @StaffRoles('admin', 'proctor')
  async download(@Param('filename') filename: string, @Res() res: Response) {
    const safe = path.basename(filename);
    const filePath = path.resolve(this.backupService.resolveBackupPath(safe));
    if (!fs.existsSync(filePath)) throw new BadRequestException('Không tìm thấy file sao lưu');
    res.download(filePath, safe);
  }

  @Get()
  @UseGuards(StaffAuthGuard)
  @StaffRoles('admin', 'proctor')
  list() {
    return this.backupService.listBackups();
  }
}
