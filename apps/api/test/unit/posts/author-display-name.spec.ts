import { authorDisplayName } from '../../../src/posts/author-display-name';

describe('authorDisplayName', () => {
  it('uses the name when one is set', () => {
    expect(authorDisplayName({ name: 'Ada Lovelace', email: 'ada@example.com' })).toBe(
      'Ada Lovelace',
    );
  });

  it('falls back to the local part of the email, never the full address', () => {
    expect(authorDisplayName({ name: null, email: 'ada@example.com' })).toBe('ada');
  });

  it('falls back to the whole address when the local part is empty', () => {
    expect(authorDisplayName({ name: null, email: '@example.com' })).toBe('@example.com');
  });
});
