import { BadRequestException } from '@nestjs/common';
import { BackupService } from './backup.service';

describe('BackupService.restoreBackup', () => {
  const service = new BackupService();

  it('rejects path traversal in filename', async () => {
    await expect(service.restoreBackup('../../../../etc/passwd')).rejects.toThrow(
      BadRequestException,
    );
    await expect(service.restoreBackup('../../../../etc/passwd')).rejects.toThrow(
      'Tên file không hợp lệ',
    );
  });

  it('rejects missing backup file with safe basename only', async () => {
    await expect(service.restoreBackup('nonexistent-backup.zip')).rejects.toThrow(
      'Backup file not found',
    );
  });
});
