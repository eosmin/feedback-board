/** The columns `authorDisplayName` reads; every query that shows an author selects exactly these. */
export const AUTHOR_SELECT = { name: true, email: true } as const;

/**
 * A person's name, or the local part of their email when they have not set one, so a teammate's
 * full address is never shown. A local part that is empty falls back to the whole address rather
 * than a blank author.
 */
export function authorDisplayName(author: { name: string | null; email: string }): string {
  if (author.name !== null) {
    return author.name;
  }
  const localPart = author.email.split('@')[0];
  return localPart === undefined || localPart === '' ? author.email : localPart;
}
