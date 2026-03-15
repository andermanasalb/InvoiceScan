import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';
import type { ZodTypeAny, output } from 'zod';

/**
 * Pipe that validates request body against a Zod schema.
 * Throws 400 BadRequest with Zod field errors on failure.
 */
@Injectable()
export class ZodValidationPipe<T extends ZodTypeAny> implements PipeTransform<
  unknown,
  output<T>
> {
  constructor(private readonly schema: T) {}

  transform(value: unknown): output<T> {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request body validation failed',
          details: result.error.flatten().fieldErrors,
        },
      });
    }
    // Zod v3 types result.data as `any` for generic schemas; the cast is safe
    // because safeParse only succeeds when the value matches schema T.
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return result.data;
  }
}
