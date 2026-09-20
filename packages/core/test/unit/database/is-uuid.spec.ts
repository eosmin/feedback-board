import { isUuid } from '../../../src/database/is-uuid';

describe('isUuid', () => {
  it('accepts a valid v4 uuid', () => {
    expect(isUuid('11111111-1111-4111-8111-111111111111')).toBe(true);
  });

  it('rejects a non-uuid string', () => {
    expect(isUuid('not-a-uuid')).toBe(false);
  });

  it('rejects an empty string', () => {
    expect(isUuid('')).toBe(false);
  });
});
