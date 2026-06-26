import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { resolve } from 'path';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bullmq';
import { DatabaseModule } from './database/database.module';
import { SharedModule } from './shared/shared.module';
import { CoreModule } from './core/core.module';
import { EdgeModule } from './edge/edge.module';
import { PostExamModule } from './post-exam/post-exam.module';
import { InfraModule } from './infra/infra.module';
import { StaffAuthModule } from './shared/auth/staff-auth.module';
import { isEdgeLightweight } from './shared/config/edge-env';

const lightweight = isEdgeLightweight();
const bullRoot = lightweight
  ? []
  : [
      BullModule.forRoot({
        connection: {
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379', 10),
        },
      }),
    ];

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [resolve(__dirname, '../../../.env'), '.env'],
    }),
    ScheduleModule.forRoot(),
    ...bullRoot,    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        url: config.getOrThrow<string>('DATABASE_URL'),
        autoLoadEntities: true,
        synchronize: false,
        migrationsRun: config.get('TYPEORM_MIGRATIONS_RUN') === 'true',
        logging: config.get('NODE_ENV') === 'development',
      }),
    }),
    DatabaseModule,
    SharedModule,
    StaffAuthModule,
    CoreModule,
    EdgeModule,
    PostExamModule,
    InfraModule,
  ],
})
export class AppModule {}
