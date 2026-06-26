import { config } from 'dotenv';
import { resolve } from 'path';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';

config({ path: resolve(__dirname, '../../../.env') });

function validateProductionSecrets() {
  if (process.env.NODE_ENV !== 'production') return;
  const required = [
    'JWT_SECRET',
    'ANONYMIZATION_SALT',
    'AUDIO_ENCRYPTION_KEY',
    'ADMIN_PASSWORD_HASH',
  ];
  const missing = required.filter((k) => !process.env[k]?.trim());
  if (missing.length) {
    console.error(`FATAL: Missing required env in production: ${missing.join(', ')}`);
    process.exit(1);
  }
  if (process.env.JWT_SECRET === 'dev-secret' || process.env.JWT_SECRET!.length < 32) {
    console.error('FATAL: JWT_SECRET must be at least 32 chars in production');
    process.exit(1);
  }
}

function parseCorsOrigins(): string[] | boolean {
  const raw = process.env.EDGE_ORIGINS?.trim();
  if (!raw) return process.env.NODE_ENV === 'production' ? false : true;
  return raw.split(',').map((o) => o.trim()).filter(Boolean);
}

async function bootstrap() {
  validateProductionSecrets();
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.set('trust proxy', 1);
  const uploadDir = process.env.UPLOAD_DIR || resolve(__dirname, '../../../uploads');
  app.useStaticAssets(uploadDir, { prefix: '/uploads/' });
  app.setGlobalPrefix('api');
  const origins = parseCorsOrigins();
  app.enableCors({
    origin: origins === true ? true : origins,
    credentials: true,
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const helmet = require('helmet');
    app.use(helmet({ contentSecurityPolicy: false }));
  } catch {
    /* helmet optional in dev */
  }

  const port = Number(process.env.PORT || 3000);
  try {
    await app.listen(port, '0.0.0.0');
    console.log(`VNU API running on port ${port}`);
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code === 'EADDRINUSE') {
      console.error(
        `\nPort ${port} đang được sử dụng. Đóng terminal API cũ hoặc chạy: npx kill-port ${port}\n` +
          '(npm run dev sẽ tự giải phóng port lần sau)\n',
      );
      process.exit(1);
    }
    throw err;
  }
}

bootstrap();
