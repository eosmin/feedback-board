'use client';

import type { ReactElement } from 'react';

import { RouteError } from '../components/ui';

export default function Error({ retry }: { retry: () => void }): ReactElement {
  return <RouteError retry={retry} />;
}
