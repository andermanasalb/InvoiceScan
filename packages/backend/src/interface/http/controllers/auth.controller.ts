import {
  Controller,
  Post,
  Body,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  UseGuards,
  Inject,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { LoginUseCase } from '../../../application/use-cases/login.use-case';
import { RefreshTokenUseCase } from '../../../application/use-cases/refresh-token.use-case';
import { LogoutUseCase } from '../../../application/use-cases/logout.use-case';
import { LoginInputSchema, type LoginInput } from '../../../application/dtos';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CurrentUser } from '../guards/current-user.decorator';
import type { AuthenticatedUser } from '../guards/jwt.strategy';
import { ZodValidationPipe } from '../pipes/zod-validation.pipe';

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

    const { accessToken, refreshToken, userId, role } = result.value;
    res.cookie(REFRESH_COOKIE, refreshToken, COOKIE_OPTIONS);
    return { data: { accessToken, userId, role } };
  }

  /**
   * POST /api/v1/auth/refresh
   * Reads refreshToken from HttpOnly cookie, issues new access token.
   * Requires a valid access token (JwtAuthGuard) so we know who is refreshing.
   */
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async refresh(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const cookies = req.cookies as Record<string, string> | undefined;
    const refreshToken = cookies?.[REFRESH_COOKIE];

    if (!refreshToken) {
      throw new UnauthorizedException('No refresh token');
    }

    const result = await this.refreshTokenUseCase.execute({
      userId: user.userId,
      refreshToken,
    });

    if (result.isErr()) {
      throw new UnauthorizedException(result.error.message);
    }

    return { data: { accessToken: result.value.accessToken } };
  }

  /**
   * POST /api/v1/auth/logout
   * Revokes the refresh token from Redis and clears the cookie.
   * @Res passthrough: true — only used to clear the cookie.
   */
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  async logout(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.logoutUseCase.execute({ userId: user.userId });
    res.clearCookie(REFRESH_COOKIE, { path: '/' });
  }
}
