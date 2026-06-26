import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MediaAsset } from '../database/entities/media-asset.entity';
import { StudentSession } from '../database/entities/student-session.entity';
import { InfraController } from './infra.controller';

@Module({
  imports: [TypeOrmModule.forFeature([MediaAsset, StudentSession])],
  controllers: [InfraController],
})
export class InfraModule {}
