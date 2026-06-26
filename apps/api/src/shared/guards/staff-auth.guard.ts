import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';

export type StaffRole = 'admin' | 'proctor' | 'composer';

export const STAFF_ROLES_KEY = 'staff_roles';

export const StaffRoles = (...roles: StaffRole[]) => SetMetadata(STAFF_ROLES_KEY, roles);

export interface StaffJwtPayload {
  sub: string;
  role: StaffRole;
}

@Injectable()
export class StaffAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const allowedRoles = this.reflector.getAllAndOverride<StaffRole[]>(STAFF_ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!allowedRoles?.length) {
      throw new UnauthorizedException('Staff roles not configured');
    }

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing token');
    }

    const token = authHeader.slice(7);
    let payload: StaffJwtPayload;
    try {
      payload = this.jwtService.verify<StaffJwtPayload>(token);
    } catch {
      throw new UnauthorizedException('Phiên đăng nhập không hợp lệ');
    }

    if (!payload.role || !allowedRoles.includes(payload.role)) {
      throw new UnauthorizedException('Insufficient role');
    }

    request.staffPayload = payload;
    return true;
  }
}
