import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RateLimitService implements OnModuleDestroy {
  private redis: Redis | null = null;
  private memory = new Map<string, { count: number; resetAt: number }>();

  constructor(private readonly configService: ConfigService) {
    try {
      this.redis = new Redis({
        host: this.configService.get<string>('REDIS_HOST') || 'localhost',
        port: parseInt(this.configService.get<string>('REDIS_PORT') || '6379', 10),
        maxRetriesPerRequest: 1,
        lazyConnect: true,
      });
      this.redis.connect().catch(() => {
        this.redis?.disconnect();
        this.redis = null;
      });
    } catch {
      this.redis = null;
    }
  }

  async onModuleDestroy() {
    await this.redis?.quit();
  }

  async check(key: string, maxAttempts: number, windowSec: number): Promise<void> {
    if (this.redis) {
      try {
        const redisKey = `ratelimit:${key}`;
        const count = await this.redis.incr(redisKey);
        if (count === 1) await this.redis.expire(redisKey, windowSec);
        if (count > maxAttempts) {
          throw new Error('RATE_LIMIT');
        }
        return;
      } catch (err) {
        if (err instanceof Error && err.message === 'RATE_LIMIT') throw err;
        this.redis = null;
      }
    }

    const now = Date.now();
    const entry = this.memory.get(key);
    if (!entry || entry.resetAt < now) {
      this.memory.set(key, { count: 1, resetAt: now + windowSec * 1000 });
      return;
    }
    entry.count += 1;
    if (entry.count > maxAttempts) throw new Error('RATE_LIMIT');
  }
}
