import { ERROR_CODES } from '@feedback-board/shared';
import type { ValidationError } from 'class-validator';

import {
  validationExceptionFactory,
  type ValidationFailedBody,
} from '../../../src/common/validation-exception.factory';

function error(property: string, constraints: Record<string, string>): ValidationError {
  return { property, constraints, children: [] } as unknown as ValidationError;
}

describe('validationExceptionFactory', () => {
  it('reports validator names, never sentences', () => {
    const exception = validationExceptionFactory([
      error('email', { isEmail: 'email must be an email' }),
      error('name', { minLength: 'name is too short', isString: 'name must be a string' }),
    ]);
    const body = exception.getResponse() as ValidationFailedBody;

    expect(exception.getStatus()).toBe(400);
    expect(body.error).toBe(ERROR_CODES.VALIDATION_FAILED);
    expect(body.fields).toEqual([
      { field: 'email', rule: 'isEmail' },
      { field: 'name', rule: 'minLength' },
      { field: 'name', rule: 'isString' },
    ]);
  });

  it('flattens nested properties into dotted paths', () => {
    const nested = error('address', {});
    nested.children = [error('city', { isNotEmpty: 'city should not be empty' })];

    const body = validationExceptionFactory([nested]).getResponse() as ValidationFailedBody;

    expect(body.fields).toEqual([{ field: 'address.city', rule: 'isNotEmpty' }]);
  });
});
