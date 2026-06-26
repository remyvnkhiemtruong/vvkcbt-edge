import { Body, Controller, Post } from '@nestjs/common';
import { StaffAuthService } from './staff-auth.service';
import { StaffLoginDto } from './staff-auth.dto';

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
}
