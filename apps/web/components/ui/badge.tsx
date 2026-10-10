import type { ReactElement, ReactNode } from 'react';

export const BADGE_TONES = [
  'accent',
  'neutral',
  'status-open',
  'status-planned',
  'status-in-progress',
  'status-done',
  'status-closed',
  'priority-low',
  'priority-medium',
  'priority-high',
] as const;

export type BadgeTone = (typeof BADGE_TONES)[number];

export interface BadgeProps {
  children: ReactNode;
  /**
   * `accent` for the plan pill (the one pill worth calling out), `neutral` for low-stakes
   * metadata (AI category, visibility off), the rest for post status and AI priority.
   */
  tone?: BadgeTone;
}

// Full class names, never built from `tone`: Tailwind only emits classes it can see in source.
const TONE_CLASSNAME: Record<BadgeTone, string> = {
  accent: 'bg-accent-soft text-accent-soft-text',
  neutral: 'bg-surface-sunken text-text-muted',
  'status-open': 'bg-status-open-soft text-status-open',
  'status-planned': 'bg-status-planned-soft text-status-planned',
  'status-in-progress': 'bg-status-in-progress-soft text-status-in-progress',
  'status-done': 'bg-status-done-soft text-status-done',
  'status-closed': 'bg-status-closed-soft text-status-closed',
  'priority-low': 'bg-priority-low-soft text-priority-low',
  'priority-medium': 'bg-priority-medium-soft text-priority-medium',
  'priority-high': 'bg-priority-high-soft text-priority-high',
};

/** The small rounded pill used for plan badges, post status, AI category and priority tags. */
export function Badge({ children, tone = 'accent' }: BadgeProps): ReactElement {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-caption font-medium ${TONE_CLASSNAME[tone]}`}
    >
      {children}
    </span>
  );
}
