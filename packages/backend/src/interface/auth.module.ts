import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { Redis } from 'ioredis';
import * as jwt from 'jsonwebtoken';

import { DatabaseModule } from '../infrastructure/db/database.module';
import { RedisTokenStoreAdapter } from '../infrastructure/auth/redis-token-store.adapter';
import { JwtStrategy } from './http/guards/jwt.strategy';

import { LoginUseCase, JwtSignPort } from '../application/use-cases/login.use-case';
import { RefreshTokenUseCase, JwtVerifyPort, UserRoleLoader } from '../application/use-cases/refresh-token.use-case';
import { LogoutUseCase } from '../application/use-cases/logout.use-case';
import { CreateUserUseCase } from '../application/use-cases/create-user.use-case';
import { AuthController } from './http/controllers/auth.controller';
import { TOKEN_STORE_PORT, TokenStorePort } from '../application/ports/token-store.port';
import { USER_CREDENTIAL_REPOSITORY } from '../infrastructure/db/repositories';

import type { UserRepository } from '../domain/repositories';
import type { UserCredentialRepository } from '../domain/repositories/user-credential.repository';

const jwtSecret = process.env.JWT_SECRET ?? '';
const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET ?? '';
const rawRedisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
const redisUrl = new URL(rawRedisUrl);

export const REDIS_CLIENT = 'REDIS_CLIENT';
export const CREATE_USER_USE_CASE_TOKEN = 'CREATE_USER_USE_CASE';

// These must match the injection tokens declared in AuthController
const LOGIN_USE_CASE = 'LOGIN_USE_CASE';
const REFRESH_TOKEN_USE_CASE = 'REFRESH_TOKEN_USE_CASE';
const LOGOUT_USE_CASE = 'LOGOUT_USE_CASE';

/**
 * Implements JwtSignPort & JwtVerifyPort using the jsonwebtoken library directly.
 * This avoids a circular dependency with @nestjs/jwt while keeping the ports
 * independent of NestJS infrastructure.
 */
const jwtSignerVerifier: JwtSignPort & JwtVerifyPort = {
  signAccessToken: (payload) =>
    jwt.sign(payload, jwtSecret, { expiresIn: '15m' }),
  signRefreshToken: (payload) =>
    jwt.sign(payload, jwtRefreshSecret, { expiresIn: '7d' }),
  verifyRefreshToken: (token) => {
    try {
      return jwt.verify(token, jwtRefreshSecret) as { sub: string };
    } catch {
      return null;
    }
  },
};

@Module({
  imports: [
    DatabaseModule,

    PassportModule.register({ defaultStrategy: 'jwt' }),

    // Used by JwtStrategy to verify access tokens on protected routes
    JwtModule.register({
      secret: jwtSecret,
      signOptions: { expiresIn: '15m' },
    }),

    // Global throttler: 100 req/min default; login route overrides to 5/min
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
  ],
  controllers: [AuthController],
  providers: [
    // ── Global throttler guard ────────────────────────────────────────────
    { provide: APP_GUARD, useClass: ThrottlerGuard },

    // ── Redis client ──────────────────────────────────────────────────────
    {
      provide: REDIS_CLIENT,
      useFactory: () =>
        new Redis({
          host: redisUrl.hostname,
          port: Number(redisUrl.port) || 6379,
        }),
    },

    // ── Token store (refresh tokens in Redis) ─────────────────────────────
    {
      provide: TOKEN_STORE_PORT,
      useFactory: (redis: Redis) => new RedisTokenStoreAdapter(redis),
      inject: [REDIS_CLIENT],
    },

    // ── Passport JWT strategy ─────────────────────────────────────────────
    JwtStrategy,

    // ── Shared JWT signer/verifier ────────────────────────────────────────
    {
      provide: 'JWT_SIGNER_VERIFIER',
      useValue: jwtSignerVerifier,
    },

    // ── UserRoleLoader — reads role from UserRepository ───────────────────
    {
      provide: 'USER_ROLE_LOADER',
      useFactory: (userRepo: UserRepository): UserRoleLoader => ({
        getRoleByUserId: async (userId) => {
          const user = await userRepo.findById(userId);
          return user ? user.getRole() : null;
        },
      }),
      inject: ['UserRepository'],
    },

    // ── Use cases ─────────────────────────────────────────────────────────
    {
      provide: CREATE_USER_USE_CASE_TOKEN,
      useFactory: (userRepo: UserRepository, credentialRepo: UserCredentialRepository) =>
        new CreateUserUseCase(userRepo, credentialRepo),
      inject: ['UserRepository', USER_CREDENTIAL_REPOSITORY],
    },
    {
      provide: LOGIN_USE_CASE,
      useFactory: (
        userRepo: UserRepository,
        credentialRepo: UserCredentialRepository,
        tokenStore: TokenStorePort,
        signer: JwtSignPort,
      ) => new LoginUseCase(userRepo, credentialRepo, tokenStore, signer),
      inject: ['UserRepository', USER_CREDENTIAL_REPOSITORY, TOKEN_STORE_PORT, 'JWT_SIGNER_VERIFIER'],
    },
    {
      provide: REFRESH_TOKEN_USE_CASE,
      useFactory: (
        tokenStore: TokenStorePort,
        verifier: JwtVerifyPort,
        roleLoader: UserRoleLoader,
      ) => new RefreshTokenUseCase(tokenStore, verifier, roleLoader),
      inject: [TOKEN_STORE_PORT, 'JWT_SIGNER_VERIFIER', 'USER_ROLE_LOADER'],
    },
    {
      provide: LOGOUT_USE_CASE,
      useFactory: (tokenStore: TokenStorePort) => new LogoutUseCase(tokenStore),
      inject: [TOKEN_STORE_PORT],
    },
  ],
  exports: [JwtModule, PassportModule, TOKEN_STORE_PORT, CREATE_USER_USE_CASE_TOKEN],
})
export class AuthModule {}
