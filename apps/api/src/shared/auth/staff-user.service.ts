import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { StaffUser } from '../../database/entities/staff-user.entity';
import { StaffRole } from '../guards/staff-auth.guard';

@Injectable()
export class StaffUserService {
  constructor(
    @InjectRepository(StaffUser)
    private readonly repo: Repository<StaffUser>,
  ) {}

  list() {
    return this.repo.find({ order: { username: 'ASC' }, select: ['id', 'username', 'role', 'schoolId', 'createdAt'] });
  }

  async create(data: { username: string; password: string; role: StaffRole; schoolId?: string }) {
    const existing = await this.repo.findOne({ where: { username: data.username } });
    if (existing) throw new ConflictException('Username exists');
    const hash = await bcrypt.hash(data.password, 10);
    const user = this.repo.create({
      username: data.username,
      role: data.role,
      passwordHash: hash,
      schoolId: data.schoolId ?? null,
    });
    return this.repo.save(user);
  }

  async updatePassword(id: string, password: string) {
    const user = await this.repo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    user.passwordHash = await bcrypt.hash(password, 10);
    await this.repo.save(user);
    return { updated: true };
  }

  async delete(id: string) {
    await this.repo.delete(id);
    return { deleted: true };
  }

  async validateLogin(username: string, password: string, role: StaffRole): Promise<boolean> {
    const user = await this.repo.findOne({ where: { username, role } });
    if (!user) return false;
    return bcrypt.compare(password, user.passwordHash);
  }
}
