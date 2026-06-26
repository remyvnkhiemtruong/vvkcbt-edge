import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StudentSession } from '../../database/entities/student-session.entity';
import { StudentAuthService } from '../auth/student-auth.service';

@Processor('submit-retry')
@Injectable()
export class SubmitRetryProcessor extends WorkerHost {
  constructor(
    @InjectRepository(StudentSession)
    private readonly sessionRepo: Repository<StudentSession>,
    private readonly authService: StudentAuthService,
  ) {
    super();
  }

  async process(job: Job<{ sessionId: string }>) {
    const session = await this.sessionRepo.findOne({
      where: { id: job.data.sessionId },
      relations: ['examSession', 'examPaper'],
    });
    if (!session || session.submittedAt) return;
    await this.authService.submit(session, session.boundIp || 'retry-worker');
  }
}
