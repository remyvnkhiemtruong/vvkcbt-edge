import { config } from 'dotenv';
import { resolve } from 'path';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { parseEdgeCorsOrigins } from './shared/cors-origins';
import { validateProductionSecrets } from './shared/config/validate-production-secrets';

config({ path: resolve(__dirname, '../../../.env') });

function parseCorsOrigins(): string[] | boolean {
  return parseEdgeCorsOrigins();
}

async function bootstrap() {
  validateProductionSecrets();
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.set('trust proxy', 1);
  const uploadDir = resolve(process.env.UPLOAD_DIR || resolve(__dirname, '../../../uploads'));
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
