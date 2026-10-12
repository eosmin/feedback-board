import type { ReactElement } from 'react';

import { NotFoundState, StandaloneScreen } from '../components/ui';

export default function NotFound(): ReactElement {
  return (
    <StandaloneScreen>
      <NotFoundState />
    </StandaloneScreen>
  );
}
