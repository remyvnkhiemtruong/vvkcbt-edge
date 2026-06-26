import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StudentSession } from '../../database/entities/student-session.entity';
import {
  getClientIpFromRequest,
  isIpBindingDisabled,
  normalizeClientIp,
} from '../utils/client-ip';

@Injectable()
export class StudentAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    @InjectRepository(StudentSession)
    private readonly sessionRepo: Repository<StudentSession>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing token');
    }

    const token = authHeader.slice(7);
    let payload: { sub: string; sessionId: string; ip: string; sessionVersion?: number };
    try {
      payload = this.jwtService.verify(token);
    } catch {
      throw new UnauthorizedException('Phiên đăng nhập không hợp lệ');
    }

    if (!isIpBindingDisabled()) {
      const clientIp = getClientIpFromRequest(request);
      const tokenIp = normalizeClientIp(payload.ip);
      if (tokenIp && clientIp && tokenIp !== clientIp) {
        throw new UnauthorizedException('IP binding mismatch');
      }
    }

    const session = await this.sessionRepo.findOne({
      where: { id: payload.sessionId },
      relations: ['examSession', 'examPaper', 'student', 'examPaper'],
    });

    if (!session) throw new UnauthorizedException('Session not found');
    if (
      payload.sessionVersion != null &&
      session.sessionVersion != null &&
      payload.sessionVersion !== session.sessionVersion
    ) {
      throw new UnauthorizedException('Session superseded by newer login');
    }
    if (session.locked) throw new UnauthorizedException('Exam locked');

    request.studentSession = session;
    request.studentPayload = payload;
    return true;
  }
}
