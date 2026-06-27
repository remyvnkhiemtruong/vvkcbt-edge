import { Injectable, NotFoundException, ConflictException, OnModuleInit, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { StaffUser } from '../../database/entities/staff-user.entity';
import { StaffRole } from '../guards/staff-auth.guard';
import { DEFAULT_PROCTOR_PASSWORD, DEFAULT_PROCTOR_USERNAME } from './staff-defaults';

@Injectable()
export class StaffUserService implements OnModuleInit {
  private readonly logger = new Logger(StaffUserService.name);

  constructor(
    @InjectRepository(StaffUser)
    private readonly repo: Repository<StaffUser>,
  ) {}

  async onModuleInit() {
    try {
      await this.ensureDefaultProctorUser();
    } catch (err) {
      this.logger.warn(
        `Không đồng bộ tài khoản giám thị mặc định: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  /** Luôn có user proctor/proctor123 trong DB (đồng bộ mỗi lần khởi động API). */
  async ensureDefaultProctorUser() {
    const hash = await bcrypt.hash(DEFAULT_PROCTOR_PASSWORD, 10);
    const existing = await this.repo.findOne({ where: { username: DEFAULT_PROCTOR_USERNAME } });
    if (existing) {
      existing.passwordHash = hash;
      existing.role = 'proctor';
      await this.repo.save(existing);
      return;
    }
    await this.repo.save(
      this.repo.create({
        username: DEFAULT_PROCTOR_USERNAME,
        role: 'proctor',
        passwordHash: hash,
        schoolId: null,
      }),
    );
  }

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
    try {
      const user = await this.repo.findOne({ where: { username, role } });
      if (!user?.passwordHash?.startsWith('$2')) return false;
      return bcrypt.compare(password, user.passwordHash);
    } catch {
      return false;
    }
  }
}
