/**
 * Derives a slug candidate from a display name for live auto-fill in create-org/create-board
 * forms. Matches the shape `packages/shared`'s `slugSchema` accepts (lowercase, digits, single
 * inner hyphens) — this is a UX convenience only, the server-side schema is the real validation.
 */
export function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}
