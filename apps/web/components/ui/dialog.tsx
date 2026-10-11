'use client';

import type { ReactElement } from 'react';

import { OverlayPanel } from './overlay-panel';
import type { OverlayPanelProps } from './overlay-panel';

export type DialogProps = OverlayPanelProps;

/** A centered modal for creation forms and destructive confirmations. */
export function Dialog(props: DialogProps): ReactElement {
  return <OverlayPanel variant="dialog" {...props} />;
}
