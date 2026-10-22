'use client';

import type { ReactElement } from 'react';

import { OverlayPanel } from './overlay-panel';
import type { OverlayPanelProps } from './overlay-panel';

export type NavDrawerProps = OverlayPanelProps;

/** The sidebar below the tablet breakpoint: a left-anchored panel with the same focus handling. */
export function NavDrawer(props: NavDrawerProps): ReactElement {
  return <OverlayPanel variant="nav" {...props} />;
}
