import { redirect } from 'next/navigation';

/**
 * `/` has no content of its own: it hands off to `/dashboard`, whose `requireUser()` guard sends
 * a visitor without a session on to `/login?next=/dashboard`.
 */
export default function RootPage(): never {
  redirect('/dashboard');
}
