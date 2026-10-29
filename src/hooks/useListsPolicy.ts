'use client'

import { useAuth } from '@/context/AuthContext'
import { rtdb } from '@/lib/database'
import { useLiveData } from '@/lib/dataStore'
import type { ListsMode } from '@/lib/registration'

/**
 * Whether this medreseh edits its own dropdown lists ('own') or uses the ones
 * set by the super admin ('platform'). Until it is known the lists are treated
 * as the platform's (read-only), so nobody edits by mistake.
 */
export function useListsPolicy(): { mode: ListsMode; hasOwn: boolean; known: boolean } {
  const { user } = useAuth()
  const live = useLiveData<{ mode: ListsMode; hasOwn: boolean }>(user ? 'settings:listsPolicy' : null, (emit) =>
    rtdb.subscribeToListsPolicy(emit)
  ).data
  return live ? { ...live, known: true } : { mode: 'platform', hasOwn: false, known: false }
}
