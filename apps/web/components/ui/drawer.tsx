'use client';

import type { ReactElement } from 'react';

import { OverlayPanel } from './overlay-panel';
import type { OverlayPanelProps } from './overlay-panel';

export type DrawerProps = OverlayPanelProps;

/** A side panel for detail views: full-screen on mobile, right-anchored from `sm` up. */
export function Drawer(props: DrawerProps): ReactElement {
  return <OverlayPanel variant="drawer" {...props} />;
}
