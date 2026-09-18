import { BadRequestException } from '@nestjs/common';
import { ERROR_CODES } from '@feedback-board/shared';
import type { ValidationError } from 'class-validator';

export interface ValidationFieldError {
  readonly field: string;
  /** The validator name (`isEmail`, `minLength`), never a sentence (TDD §7.8). */
  readonly rule: string;
}

export interface ValidationFailedBody {
  readonly error: typeof ERROR_CODES.VALIDATION_FAILED;
  readonly fields: readonly ValidationFieldError[];
}

function flatten(errors: readonly ValidationError[], parent = ''): ValidationFieldError[] {
  return errors.flatMap((error) => {
    const field = parent === '' ? error.property : `${parent}.${error.property}`;
    const rules = Object.keys(error.constraints ?? {}).map((rule) => ({ field, rule }));
    const children = flatten(error.children ?? [], field);

    return [...rules, ...children];
  });
}

/**
 * Replaces `ValidationPipe`'s default factory, whose payload is English prose built by
 * class-validator. The API emits codes and the web owns the copy (TDD §2.6.13).
 */
export function validationExceptionFactory(errors: ValidationError[]): BadRequestException {
  const body: ValidationFailedBody = {
    error: ERROR_CODES.VALIDATION_FAILED,
    fields: flatten(errors),
  };

  return new BadRequestException(body);
}
