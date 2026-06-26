import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { BackupService } from './backup.service';
import { StaffAuthGuard, StaffRoles } from '../../shared/guards/staff-auth.guard';

@Controller('core/backup')
export class BackupController {
  constructor(private readonly backupService: BackupService) {}

  @Post()
  @UseGuards(StaffAuthGuard)
  @StaffRoles('admin', 'proctor')
  async create() {
    const path = await this.backupService.createBackup();
    return { path, message: 'Backup created' };
  }

  @Post('restore')
  @UseGuards(StaffAuthGuard)
  @StaffRoles('admin', 'proctor')
  async restore(@Body() body: { filename: string }) {
    return this.backupService.restoreBackup(body.filename);
  }

  @Get()
  @UseGuards(StaffAuthGuard)
  @StaffRoles('admin', 'proctor')
  list() {
    return this.backupService.listBackups();
  }
}
