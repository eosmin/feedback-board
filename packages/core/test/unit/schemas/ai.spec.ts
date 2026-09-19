import { postClassificationSchema } from '../../../src/schemas/ai';

describe('postClassificationSchema', () => {
  it('accepts a valid classification', () => {
    const result = postClassificationSchema.safeParse({ category: 'BUG', priority: 'HIGH' });

    expect(result.success).toBe(true);
  });

  it('rejects an unknown category', () => {
    const result = postClassificationSchema.safeParse({
      category: 'NOT_A_CATEGORY',
      priority: 'HIGH',
    });

    expect(result.success).toBe(false);
  });

  it('rejects an unknown priority', () => {
    const result = postClassificationSchema.safeParse({
      category: 'BUG',
      priority: 'URGENT',
    });

    expect(result.success).toBe(false);
  });

  it('rejects a payload missing both fields', () => {
    const result = postClassificationSchema.safeParse({});

    expect(result.success).toBe(false);
  });
});
