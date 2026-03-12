import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { DomainError } from '../../../domain/errors/domain.error';

/**
 * Maps DomainError.code values to HTTP status codes.
 *
 * 404 — resource not found
 * 401 — not authenticated
 * 403 — authenticated but not authorised
 * 409 — state/uniqueness conflict
 * 422 — semantically invalid input (business rule or value-object validation)
 * 500 — unexpected / infrastructure error (default)
 */
const DOMAIN_ERROR_STATUS_MAP: Record<string, number> = {
  // 404
  INVOICE_NOT_FOUND: HttpStatus.NOT_FOUND,
  PROVIDER_NOT_FOUND: HttpStatus.NOT_FOUND,
  USER_NOT_FOUND: HttpStatus.NOT_FOUND,

  // 401
  INVALID_CREDENTIALS: HttpStatus.UNAUTHORIZED,

  // 403
  UNAUTHORIZED: HttpStatus.FORBIDDEN,

  // 409
  INVALID_STATE_TRANSITION: HttpStatus.CONFLICT,
  INVOICE_ALREADY_PROCESSING: HttpStatus.CONFLICT,
  PROVIDER_ALREADY_EXISTS: HttpStatus.CONFLICT,
  USER_ALREADY_EXISTS: HttpStatus.CONFLICT,

  // 422
  INVALID_FIELD: HttpStatus.UNPROCESSABLE_ENTITY,
  VALIDATION_FAILED: HttpStatus.UNPROCESSABLE_ENTITY,
  INVALID_INVOICE_AMOUNT: HttpStatus.UNPROCESSABLE_ENTITY,
  INVALID_INVOICE_STATUS: HttpStatus.UNPROCESSABLE_ENTITY,
  INVALID_INVOICE_DATE: HttpStatus.UNPROCESSABLE_ENTITY,
  INVALID_TAX_ID: HttpStatus.UNPROCESSABLE_ENTITY,
  INVALID_PROVIDER_NAME: HttpStatus.UNPROCESSABLE_ENTITY,
};

/**
 * DomainErrorFilter — global exception filter.
 *
 * Catches every unhandled exception that reaches the HTTP layer and:
 *
 * 1. If it is a NestJS HttpException (e.g. BadRequestException thrown by a
 *    pipe or guard), it is forwarded unchanged so Nest's default error shape
 *    is preserved for those cases.
 *
 * 2. If it is a DomainError, it is mapped to the correct HTTP status via
 *    DOMAIN_ERROR_STATUS_MAP and formatted as:
 *      { error: { code, message } }
 *
 * 3. Anything else (unexpected infrastructure errors) becomes a 500 with a
 *    generic message — the real error is logged server-side only.
 *
 * Register in main.ts with:
 *   app.useGlobalFilters(new DomainErrorFilter());
 */
@Catch()
export class DomainErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(DomainErrorFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();

    // ── 1. NestJS HttpException — pass through unchanged ──────────────────
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      res.status(status).json(body);
      return;
    }

    // ── 2. DomainError — map to correct HTTP status ───────────────────────
    if (exception instanceof DomainError) {
      const status =
        DOMAIN_ERROR_STATUS_MAP[exception.code] ?? HttpStatus.INTERNAL_SERVER_ERROR;

      if (status >= 500) {
        this.logger.error(
          `Unhandled DomainError [${exception.code}]: ${exception.message}`,
        );
      }

      res.status(status).json({
        error: {
          code: exception.code,
          message: exception.message,
        },
      });
      return;
    }

    // ── 3. Unknown error — 500 ────────────────────────────────────────────
    const errMessage =
      exception instanceof Error ? exception.message : String(exception);

    this.logger.error(`Unhandled exception: ${errMessage}`, exception instanceof Error ? exception.stack : undefined);

    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred',
      },
    });
  }
}
