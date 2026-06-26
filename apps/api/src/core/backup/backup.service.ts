import { Injectable } from '@nestjs/common';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import archiver from 'archiver';
import { createWriteStream } from 'fs';
import extract from 'extract-zip';
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

@Injectable()
export class BackupService {
  private backupDir = process.env.BACKUP_DIR || './backups';
  private uploadDir = process.env.UPLOAD_DIR || './uploads';

  constructor() {
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
  }

  async createBackup(): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = `vnu-backup-${timestamp}`;
    const workDir = path.join(this.backupDir, backupName);
    fs.mkdirSync(workDir, { recursive: true });

    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) throw new Error('DATABASE_URL not set');

    const dumpPath = path.join(workDir, 'database.sql');
    try {
      execSync(`pg_dump "${dbUrl}" -f "${dumpPath}"`, { stdio: 'pipe' });
    } catch (err) {
      fs.rmSync(workDir, { recursive: true, force: true });
      throw new Error(`pg_dump failed: ${err instanceof Error ? err.message : 'unknown'}`);
    }

    const zipPath = path.join(this.backupDir, `${backupName}.zip`);
    await this.zipDirectory(workDir, zipPath);

    const passphrase = process.env.BACKUP_PASSPHRASE?.trim();
    if (passphrase) {
      const encPath = `${zipPath}.enc`;
      await this.encryptFile(zipPath, encPath, passphrase);
      fs.unlinkSync(zipPath);
      fs.rmSync(workDir, { recursive: true, force: true });
      return encPath;
    }

    fs.rmSync(workDir, { recursive: true, force: true });
    return zipPath;
  }

  private deriveKey(passphrase: string): Buffer {
    return scryptSync(passphrase, 'vvkcbt-backup', 32);
  }

  private async encryptFile(inputPath: string, outputPath: string, passphrase: string): Promise<void> {
    const key = this.deriveKey(passphrase);
    const iv = randomBytes(16);
    const cipher = createCipheriv('aes-256-cbc', key, iv);
    const input = fs.readFileSync(inputPath);
    const encrypted = Buffer.concat([iv, cipher.update(input), cipher.final()]);
    fs.writeFileSync(outputPath, encrypted);
  }

  private decryptFile(inputPath: string, outputPath: string, passphrase: string): void {
    const key = this.deriveKey(passphrase);
    const data = fs.readFileSync(inputPath);
    const iv = data.subarray(0, 16);
    const decipher = createDecipheriv('aes-256-cbc', key, iv);
    const decrypted = Buffer.concat([decipher.update(data.subarray(16)), decipher.final()]);
    fs.writeFileSync(outputPath, decrypted);
  }

  async restoreBackup(zipFilename: string): Promise<{ message: string }> {
    let zipPath = path.join(this.backupDir, zipFilename);
    if (!fs.existsSync(zipPath)) throw new Error('Backup file not found');

    const passphrase = process.env.BACKUP_PASSPHRASE?.trim();
    if (zipPath.endsWith('.enc')) {
      if (!passphrase) throw new Error('BACKUP_PASSPHRASE required to restore encrypted backup');
      const plainPath = zipPath.replace(/\.enc$/, '.zip');
      this.decryptFile(zipPath, plainPath, passphrase);
      zipPath = plainPath;
    }

    const workDir = path.join(this.backupDir, `restore-${Date.now()}`);
    fs.mkdirSync(workDir, { recursive: true });
    await extract(zipPath, { dir: workDir });

    const dumpPath = path.join(workDir, 'database.sql');
    const dbUrl = process.env.DATABASE_URL;
    if (dbUrl && fs.existsSync(dumpPath)) {
      try {
        execSync(`psql "${dbUrl}" -f "${dumpPath}"`, { stdio: 'pipe' });
      } catch (err) {
        fs.rmSync(workDir, { recursive: true, force: true });
        throw new Error('Database restore failed — kiểm tra pg_dump/psql');
      }
    }

    const uploadsSrc = path.join(workDir, 'uploads');
    if (fs.existsSync(uploadsSrc)) {
      if (!fs.existsSync(this.uploadDir)) fs.mkdirSync(this.uploadDir, { recursive: true });
      for (const f of fs.readdirSync(uploadsSrc)) {
        fs.copyFileSync(path.join(uploadsSrc, f), path.join(this.uploadDir, f));
      }
    }

    fs.rmSync(workDir, { recursive: true, force: true });
    return { message: `Đã phục hồi từ ${zipFilename}` };
  }

  private zipDirectory(sourceDir: string, outPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const output = createWriteStream(outPath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      output.on('close', () => resolve());
      archive.on('error', reject);

      archive.pipe(output);
      archive.directory(sourceDir, false);
      if (fs.existsSync(this.uploadDir)) {
        archive.directory(this.uploadDir, 'uploads');
      }
      archive.finalize();
    });
  }

  listBackups(): string[] {
    if (!fs.existsSync(this.backupDir)) return [];
    return fs.readdirSync(this.backupDir).filter((f) => f.endsWith('.zip') || f.endsWith('.zip.enc'));
  }
}
