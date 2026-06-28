import { Injectable, UnauthorizedException, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { StaffRole } from '../guards/staff-auth.guard';
import { RateLimitService } from '../rate-limit/rate-limit.service';
import { StaffUserService } from './staff-user.service';
import { DEFAULT_PROCTOR_PASSWORD, DEFAULT_PROCTOR_USERNAME } from './staff-defaults';

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
    try {
      await this.rateLimit.check(`staff:${username}`, 10, 60);
    } catch {
      throw new HttpException('Quá nhiều lần đăng nhập', HttpStatus.TOO_MANY_REQUESTS);
    }

    if (
      this.configService.get<string>('ALLOW_DEFAULT_PROCTOR') === 'true' &&
      username === DEFAULT_PROCTOR_USERNAME &&
      password === DEFAULT_PROCTOR_PASSWORD
    ) {
      const token = this.jwtService.sign({ sub: DEFAULT_PROCTOR_USERNAME, role: 'proctor' });
      return { token, role: 'proctor' as const };
    }

    return this.login(
      username,
      password,
      this.configService.get<string>('PROCTOR_USER') || DEFAULT_PROCTOR_USERNAME,
      this.configService.get<string>('PROCTOR_PASSWORD') || DEFAULT_PROCTOR_PASSWORD,
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

    let dbLogin = false;
    try {
      dbLogin = await this.staffUserService.validateLogin(username, password, role);
    } catch {
      dbLogin = false;
    }

    if (dbLogin) {
      const token = this.jwtService.sign({ sub: username, role });
      return { token, role };
    }

    if (username !== expectedUser) {
      throw new UnauthorizedException('Sai tên đăng nhập hoặc mật khẩu');
    }

    let valid = false;
    if (passwordHash?.startsWith('$2')) {
      valid = await bcrypt.compare(password, passwordHash);
    } else {
      valid = password === expectedPassword;
    }

    if (!valid) throw new UnauthorizedException('Sai tên đăng nhập hoặc mật khẩu');

    const token = this.jwtService.sign({ sub: username, role });
    return { token, role };
  }
}
