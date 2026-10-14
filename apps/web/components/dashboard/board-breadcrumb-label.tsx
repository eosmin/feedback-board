'use client';

import type { ReactElement, ReactNode } from 'react';
import { createContext, useContext, useEffect, useState } from 'react';

interface BoardLabel {
  slug: string;
  name: string;
}

const LabelContext = createContext<BoardLabel | null>(null);
const SetLabelContext = createContext<(label: BoardLabel | null) => void>(() => undefined);

/**
 * Carries the open board's name from the board page to the breadcrumb in the org header. The
 * layout persists across navigations and the page already fetches the board, so publishing the
 * name from there keeps it current after a create or rename, where a list fetched by the layout
 * would go stale until a reload.
 */
export function BoardLabelProvider({ children }: { children: ReactNode }): ReactElement {
  const [label, setLabel] = useState<BoardLabel | null>(null);

  return (
    <SetLabelContext.Provider value={setLabel}>
      <LabelContext.Provider value={label}>{children}</LabelContext.Provider>
    </SetLabelContext.Provider>
  );
}

/** The published label, or `null` while the board page has not loaded it. */
export function useBoardLabel(): BoardLabel | null {
  return useContext(LabelContext);
}

/** Called by the board page once it has the board; clears the label when the page unmounts. */
export function usePublishBoardLabel(slug: string, name: string | null): void {
  const setLabel = useContext(SetLabelContext);

  useEffect(() => {
    if (name === null) return;
    setLabel({ slug, name });
    return () => setLabel(null);
  }, [setLabel, slug, name]);
}
