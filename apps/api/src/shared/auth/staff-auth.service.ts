import { Injectable, UnauthorizedException, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { StaffRole } from '../guards/staff-auth.guard';
import { RateLimitService } from '../rate-limit/rate-limit.service';
import { StaffUserService } from './staff-user.service';

@Injectable()
export class StaffAuthService {
  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly rateLimit: RateLimitService,
    private readonly staffUserService: StaffUserService,
  ) {}

  async loginAdmin(username: string, password: string) {
    return this.login(
      username,
      password,
      this.configService.get<string>('ADMIN_USER') || 'admin',
      this.configService.get<string>('ADMIN_PASSWORD') || 'admin123',
      this.configService.get<string>('ADMIN_PASSWORD_HASH'),
      'admin',
    );
  }

  async loginProctor(username: string, password: string) {
    return this.login(
      username,
      password,
      this.configService.get<string>('PROCTOR_USER') || 'proctor',
      this.configService.get<string>('PROCTOR_PASSWORD') || 'proctor123',
      this.configService.get<string>('PROCTOR_PASSWORD_HASH'),
      'proctor',
    );
  }

  async loginComposer(username: string, password: string) {
    return this.login(
      username,
      password,
      this.configService.get<string>('COMPOSER_USER') || 'composer',
      this.configService.get<string>('COMPOSER_PASSWORD') || 'composer123',
      this.configService.get<string>('COMPOSER_PASSWORD_HASH'),
      'composer',
    );
  }

  private async login(
    username: string,
    password: string,
    expectedUser: string,
    expectedPassword: string,
    passwordHash: string | undefined,
    role: StaffRole,
  ) {
    try {
      await this.rateLimit.check(`staff:${username}`, 10, 60);
    } catch {
      throw new HttpException('Quá nhiều lần đăng nhập', HttpStatus.TOO_MANY_REQUESTS);
    }

    if (await this.staffUserService.validateLogin(username, password, role)) {
      const token = this.jwtService.sign({ sub: username, role });
      return { token, role };
    }

    if (username !== expectedUser) {
      throw new UnauthorizedException('Invalid credentials');
    }

    let valid = false;
    if (passwordHash?.startsWith('$2')) {
      valid = await bcrypt.compare(password, passwordHash);
    } else {
      valid = password === expectedPassword;
    }

    if (!valid) throw new UnauthorizedException('Invalid credentials');

    const token = this.jwtService.sign({ sub: username, role });
    return { token, role };
  }
}
