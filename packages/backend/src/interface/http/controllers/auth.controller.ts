import {
  Controller,
  Post,
  Body,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  Inject,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { LoginUseCase } from '../../../application/use-cases/login.use-case';
import { RefreshTokenUseCase } from '../../../application/use-cases/refresh-token.use-case';
import { LogoutUseCase } from '../../../application/use-cases/logout.use-case';
import { LoginInputSchema, type LoginInput } from '../../../application/dtos';
import { ZodValidationPipe } from '../pipes/zod-validation.pipe';
import { Public } from '../guards/public.decorator';
import { CurrentUser } from '../guards/current-user.decorator';
import type { AuthenticatedUser } from '../guards/jwt.strategy';

// CurrentUser / AuthenticatedUser still used by logout handler below

export const LOGIN_USE_CASE_TOKEN = 'LOGIN_USE_CASE';
export const REFRESH_TOKEN_USE_CASE_TOKEN = 'REFRESH_TOKEN_USE_CASE';
export const LOGOUT_USE_CASE_TOKEN = 'LOGOUT_USE_CASE';

const REFRESH_COOKIE = 'refreshToken';
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
  path: '/',
};

@Controller('api/v1/auth')
export class AuthController {
  constructor(
    @Inject(LOGIN_USE_CASE_TOKEN)
    private readonly loginUseCase: LoginUseCase,
    @Inject(REFRESH_TOKEN_USE_CASE_TOKEN)
    private readonly refreshTokenUseCase: RefreshTokenUseCase,
    @Inject(LOGOUT_USE_CASE_TOKEN)
    private readonly logoutUseCase: LogoutUseCase,
  ) {}

  /**
   * POST /api/v1/auth/login
   * Rate-limited to 5 requests per minute per IP.
   * Returns: { data: { accessToken, userId, role } }
   * Side effect: sets HttpOnly refreshToken cookie.
   *
   * On failure throws UnauthorizedException — caught by DomainErrorFilter.
   * @Res passthrough: true lets NestJS handle serialisation; we only use res
   * to set the cookie.
   */
  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async login(
    @Body(new ZodValidationPipe(LoginInputSchema)) body: LoginInput,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.loginUseCase.execute(body);

    if (result.isErr()) {
      throw new UnauthorizedException(result.error.message);
    }

    const { accessToken, refreshToken, userId, role, email } = result.value;
    res.cookie(REFRESH_COOKIE, refreshToken, COOKIE_OPTIONS);
    return { data: { accessToken, userId, role, email } };
  }

  /**
   * POST /api/v1/auth/refresh
   * Reads refreshToken from HttpOnly cookie, issues new access + refresh tokens.
   * The refresh token is rotated on every use (old token is invalidated in Redis).
   * @Public() — must bypass the global JwtAuthGuard: this endpoint is called
   * precisely when the access token is missing or expired. The refresh token
   * in the HttpOnly cookie is the credential; RefreshTokenUseCase validates it.
   */
  @Post('refresh')
  @Public()
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const cookies = req.cookies as Record<string, string> | undefined;
    const refreshToken = cookies?.[REFRESH_COOKIE];

    if (!refreshToken) {
      throw new UnauthorizedException('No refresh token');
    }

    // Decode the refresh token to extract userId (sub claim).
    // RefreshTokenUseCase will re-verify the signature and validate against Redis,
    // so decoding without verification here is safe — it's just reading the claim.
    let userId: string;
    try {
      const payload = JSON.parse(
        Buffer.from(refreshToken.split('.')[1], 'base64url').toString('utf8'),
      ) as { sub?: string };
      if (!payload.sub) throw new Error('missing sub');
      userId = payload.sub;
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const result = await this.refreshTokenUseCase.execute({
      userId,
      refreshToken,
    });

    if (result.isErr()) {
      // Clear the invalid cookie on failure to avoid retry loops
      res.clearCookie(REFRESH_COOKIE, { path: '/' });
      throw new UnauthorizedException(result.error.message);
    }

    // Set the rotated refresh token in the HttpOnly cookie
    res.cookie(REFRESH_COOKIE, result.value.refreshToken, COOKIE_OPTIONS);

    return { data: { accessToken: result.value.accessToken } };
  }

  /**
   * POST /api/v1/auth/logout
   * Revokes the refresh token from Redis and clears the cookie.
   * @Res passthrough: true — only used to clear the cookie.
   */
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.logoutUseCase.execute({ userId: user.userId });
    res.clearCookie(REFRESH_COOKIE, { path: '/' });
  }
}
