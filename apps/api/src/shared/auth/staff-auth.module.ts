import { Module } from '@nestjs/common';
import { StaffAuthController } from './staff-auth.controller';
import { StaffUserController } from './staff-user.controller';

@Module({
  controllers: [StaffAuthController, StaffUserController],
})
export class StaffAuthModule {}
