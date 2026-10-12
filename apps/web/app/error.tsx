'use client';

import type { ReactElement } from 'react';

import { RouteError, StandaloneScreen } from '../components/ui';

export default function Error({ retry }: { retry: () => void }): ReactElement {
  return (
    <StandaloneScreen>
      <RouteError retry={retry} />
    </StandaloneScreen>
  );
}
