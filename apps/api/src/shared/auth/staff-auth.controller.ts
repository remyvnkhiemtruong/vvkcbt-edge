import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { StaffAuthService } from './staff-auth.service';
import { StaffLoginDto } from './staff-auth.dto';
import { StaffAuthGuard, StaffRoles, StaffJwtPayload } from '../guards/staff-auth.guard';

@Controller('auth')
export class StaffAuthController {
  constructor(private readonly staffAuthService: StaffAuthService) {}

  @Post('admin/login')
  async adminLogin(@Body() body: StaffLoginDto) {
    return this.staffAuthService.loginAdmin(body.username, body.password);
  }

  @Post('proctor/login')
  async proctorLogin(@Body() body: StaffLoginDto) {
    return this.staffAuthService.loginProctor(body.username, body.password);
  }

  @Get('proctor/me')
  @UseGuards(StaffAuthGuard)
  @StaffRoles('proctor', 'admin')
  proctorMe(@Req() req: { staffPayload: StaffJwtPayload }) {
    return { sub: req.staffPayload.sub, role: req.staffPayload.role };
  }
}
