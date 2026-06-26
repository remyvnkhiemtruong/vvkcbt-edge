import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { StaffUserService } from './staff-user.service';
import { StaffAuthGuard, StaffRoles } from '../guards/staff-auth.guard';

@Controller('admin/staff-users')
@UseGuards(StaffAuthGuard)
@StaffRoles('admin')
export class StaffUserController {
  constructor(private readonly staffUserService: StaffUserService) {}

  @Get()
  list() {
    return this.staffUserService.list();
  }

  @Post()
  create(@Body() body: { username: string; password: string; role: 'admin' | 'proctor' | 'composer'; schoolId?: string }) {
    return this.staffUserService.create(body);
  }

  @Put(':id/password')
  updatePassword(@Param('id') id: string, @Body() body: { password: string }) {
    return this.staffUserService.updatePassword(id, body.password);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.staffUserService.delete(id);
  }
}
