import { Injectable } from '@nestjs/common';
import { Redis } from 'ioredis';
import { TokenStorePort } from '../../application/ports/token-store.port';

@Injectable()
export class RedisTokenStoreAdapter implements TokenStorePort {
  constructor(private readonly redis: Redis) {}

  async set(
    userId: string,
    refreshToken: string,
    ttlSeconds: number,
  ): Promise<void> {
    await this.redis.set(
      this.key(userId),
      refreshToken,
      'EX',
      ttlSeconds,
    );
  }

  async get(userId: string): Promise<string | null> {
    return this.redis.get(this.key(userId));
  }

  async delete(userId: string): Promise<void> {
    await this.redis.del(this.key(userId));
  }

  private key(userId: string): string {
    return `refresh_token:${userId}`;
  }
}
