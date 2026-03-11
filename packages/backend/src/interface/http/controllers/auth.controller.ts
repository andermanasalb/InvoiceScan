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
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async login(
    @Body(new ZodValidationPipe(LoginInputSchema)) body: LoginInput,
    @Res({ passthrough: false }) res: Response,
  ) {
    const result = await this.loginUseCase.execute(body);

    if (result.isErr()) {
      return res
        .status(HttpStatus.UNAUTHORIZED)
        .json({ error: { code: result.error.code, message: result.error.message } });
    }

    const { accessToken, refreshToken, userId, role } = result.value;
    res.cookie(REFRESH_COOKIE, refreshToken, COOKIE_OPTIONS);
    return res.status(HttpStatus.OK).json({ data: { accessToken, userId, role } });
  }

  /**
   * POST /api/v1/auth/refresh
   * Reads refreshToken from HttpOnly cookie, issues new access token.
   */
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async refresh(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Res({ passthrough: false }) res: Response,
  ) {
    const cookies = req.cookies as Record<string, string> | undefined;
    const refreshToken = cookies?.[REFRESH_COOKIE];

    if (!refreshToken) {
      return res
        .status(HttpStatus.UNAUTHORIZED)
        .json({ error: { code: 'INVALID_CREDENTIALS', message: 'No refresh token' } });
    }

    const result = await this.refreshTokenUseCase.execute({
      userId: user.userId,
      refreshToken,
    });

    if (result.isErr()) {
      return res
        .status(HttpStatus.UNAUTHORIZED)
        .json({ error: { code: result.error.code, message: result.error.message } });
    }

    return res.status(HttpStatus.OK).json({ data: { accessToken: result.value.accessToken } });
  }

  /**
   * POST /api/v1/auth/logout
   * Revokes the refresh token from Redis and clears the cookie.
   */
  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async logout(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: false }) res: Response,
  ) {
    await this.logoutUseCase.execute({ userId: user.userId });
    res.clearCookie(REFRESH_COOKIE, { path: '/' });
    return res.status(HttpStatus.NO_CONTENT).send();
  }
}
