import { z } from 'zod';

/** `PATCH /me` — the display name is the only field a person edits about themselves. */
export const updateProfileSchema = z.object({
  name: z.string().trim().min(1).max(80),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

/** `GET /me` and the `PATCH /me` response. `name` is `null` until the person sets one. */
export const profileSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  name: z.string().nullable(),
});

export type Profile = z.infer<typeof profileSchema>;
