import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { AuditLog } from '../database/entities/audit-log.entity';
import { GradingFlag } from '../database/entities/grading-flag.entity';
import { DifficultyStat } from '../database/entities/difficulty-stat.entity';
import { QuestionBank } from '../database/entities/question-bank.entity';
import { StudentSession } from '../database/entities/student-session.entity';
import { StaffUser } from '../database/entities/staff-user.entity';
import { AuditService } from './audit/audit.service';
import { ScoringService } from './scoring/scoring.service';
import { StudentAuthGuard } from './guards/student-auth.guard';
import { StaffAuthGuard } from './guards/staff-auth.guard';
import { StaffAuthService } from './auth/staff-auth.service';
import { StaffUserService } from './auth/staff-user.service';
import { RateLimitService } from './rate-limit/rate-limit.service';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([AuditLog, GradingFlag, DifficultyStat, QuestionBank, StudentSession, StaffUser]),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'dev-secret',
      signOptions: { expiresIn: '8h' },
    }),
  ],
  providers: [AuditService, ScoringService, StudentAuthGuard, StaffAuthGuard, StaffAuthService, StaffUserService, RateLimitService],
  exports: [AuditService, ScoringService, StudentAuthGuard, StaffAuthGuard, StaffAuthService, StaffUserService, RateLimitService, JwtModule],
})
export class SharedModule {}
