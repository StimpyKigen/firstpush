import { useUserPicks } from './userPicksStore';

/**
 * Compatibility facade backed by the authoritative `useUserPicks` store
 * so pick edit limits share one single source of truth without duplicate persistence.
 */
interface PickEditFacadeState {
  canEdit: (pickId: string) => boolean;
  incrementEdit: (pickId: string) => void;
}

export function usePickEdits<T>(selector: (state: PickEditFacadeState) => T): T {
  return useUserPicks((s) =>
    selector({
      canEdit: s.canEditPick,
      incrementEdit: s.incrementPickEdit,
    })
  );
}
