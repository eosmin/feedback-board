import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactElement } from 'react';

import { Button } from '../ui';

interface CreateOrgButtonProps {
  onClick?: () => void;
  disabled?: boolean;
}

/**
 * The "New organization" action of the picker header. Shared by the page and its loading state,
 * so the placeholder is the real button, disabled: it takes the width of the translated label in
 * every locale instead of a hand-sized block that can differ from it.
 */
export function CreateOrgButton({ onClick, disabled }: CreateOrgButtonProps): ReactElement {
  const t = useTranslations('dashboard.createOrg');

  return (
    <Button onClick={onClick} disabled={disabled}>
      <Plus className="h-4 w-4" aria-hidden="true" />
      {t('trigger')}
    </Button>
  );
}
