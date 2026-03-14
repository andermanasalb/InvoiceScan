import { ArgumentsHost, BadRequestException, HttpStatus } from '@nestjs/common';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DomainErrorFilter } from '../domain-error.filter';
import { DomainError } from '../../../../domain/errors/domain.error';
import {
  InvoiceNotFoundError,
  InvalidStateTransitionError,
  ValidationFailedError,
  InvalidFieldError,
} from '../../../../domain/errors/invoice.errors';
import {
  UnauthorizedError,
  InvalidCredentialsError,
  UserNotFoundError,
  UserAlreadyExistsError,
} from '../../../../domain/errors/user.errors';

// ---------------------------------------------------------------------------
// Helpers — minimal ArgumentsHost mock
// ---------------------------------------------------------------------------

function makeHost() {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  const getResponse = vi.fn().mockReturnValue({ status });
  const switchToHttp = vi.fn().mockReturnValue({ getResponse });
  const host = { switchToHttp } as unknown as ArgumentsHost;
  return { host, status, json };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DomainErrorFilter', () => {
  let filter: DomainErrorFilter;

  beforeEach(() => {
    filter = new DomainErrorFilter();
  });

  // ── NestJS HttpExceptions pass through unchanged ──────────────────────────

  describe('when the exception is a NestJS HttpException', () => {
    it('should forward the original status and body', () => {
      const { host, status, json } = makeHost();
      const exc = new BadRequestException({ message: 'bad input' });

      filter.catch(exc, host);

      expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      expect(json).toHaveBeenCalledWith(exc.getResponse());
    });
  });

  // ── 404 errors ────────────────────────────────────────────────────────────

  describe('when the exception is a 404 DomainError', () => {
    it('should return 404 for InvoiceNotFoundError', () => {
      const { host, status } = makeHost();
      filter.catch(new InvoiceNotFoundError('inv-1'), host);
      expect(status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    });

    it('should return 404 for UserNotFoundError', () => {
      const { host, status } = makeHost();
      filter.catch(new UserNotFoundError('usr-1'), host);
      expect(status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    });
  });

  // ── 401 errors ────────────────────────────────────────────────────────────

  describe('when the exception is a 401 DomainError', () => {
    it('should return 401 for InvalidCredentialsError', () => {
      const { host, status } = makeHost();
      filter.catch(new InvalidCredentialsError(), host);
      expect(status).toHaveBeenCalledWith(HttpStatus.UNAUTHORIZED);
    });
  });

  // ── 403 errors ────────────────────────────────────────────────────────────

  describe('when the exception is a 403 DomainError', () => {
    it('should return 403 for UnauthorizedError', () => {
      const { host, status } = makeHost();
      filter.catch(new UnauthorizedError('approve invoice'), host);
      expect(status).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);
    });
  });

  // ── 409 errors ────────────────────────────────────────────────────────────

  describe('when the exception is a 409 DomainError', () => {
    it('should return 409 for InvalidStateTransitionError', () => {
      const { host, status } = makeHost();
      filter.catch(
        new InvalidStateTransitionError('PENDING', 'APPROVED'),
        host,
      );
      expect(status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    });

    it('should return 409 for UserAlreadyExistsError', () => {
      const { host, status } = makeHost();
      filter.catch(new UserAlreadyExistsError('a@b.com'), host);
      expect(status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    });
  });

  // ── 422 errors ────────────────────────────────────────────────────────────

  describe('when the exception is a 422 DomainError', () => {
    it('should return 422 for ValidationFailedError', () => {
      const { host, status } = makeHost();
      filter.catch(new ValidationFailedError(['field required']), host);
      expect(status).toHaveBeenCalledWith(HttpStatus.UNPROCESSABLE_ENTITY);
    });

    it('should return 422 for InvalidFieldError', () => {
      const { host, status } = makeHost();
      filter.catch(new InvalidFieldError('amount', 'must be positive'), host);
      expect(status).toHaveBeenCalledWith(HttpStatus.UNPROCESSABLE_ENTITY);
    });
  });

  // ── Unknown DomainError code → 500 ───────────────────────────────────────

  describe('when the DomainError code is not in the map', () => {
    it('should return 500 for unrecognised DomainError codes', () => {
      class WeirdError extends DomainError {
        readonly code = 'SOME_UNKNOWN_ERROR';
        constructor() {
          super('something went wrong');
        }
      }
      const { host, status } = makeHost();
      filter.catch(new WeirdError(), host);
      expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  // ── Response body shape ───────────────────────────────────────────────────

  describe('error response body', () => {
    it('should include code and message for DomainErrors', () => {
      const { host, json } = makeHost();
      filter.catch(new InvoiceNotFoundError('inv-99'), host);
      expect(json).toHaveBeenCalledWith({
        error: {
          code: 'INVOICE_NOT_FOUND',
          message: 'Invoice inv-99 not found',
        },
      });
    });
  });

  // ── Non-Error exceptions → 500 ────────────────────────────────────────────

  describe('when the exception is not a DomainError or HttpException', () => {
    it('should return 500 for a plain Error', () => {
      const { host, status } = makeHost();
      filter.catch(new Error('boom'), host);
      expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    });

    it('should return 500 for a thrown string', () => {
      const { host, status } = makeHost();
      filter.catch('something bad', host);
      expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    });

    it('should return a generic message (not expose internals)', () => {
      const { host, json } = makeHost();
      filter.catch(new Error('secret db password'), host);
      expect(json).toHaveBeenCalledWith({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred',
        },
      });
    });
  });
});
