import { Loader2 } from 'lucide-react';
import type { ReactElement } from 'react';

/**
 * Decorative: the surrounding control carries the accessible pending state (`aria-busy`). Spins
 * only when motion is allowed; with reduced motion it stays a static glyph.
 */
export function Spinner({ className }: { className?: string }): ReactElement {
  const classes = ['h-4 w-4 motion-safe:animate-spin', className].filter(Boolean).join(' ');
  return <Loader2 className={classes} aria-hidden="true" />;
}
