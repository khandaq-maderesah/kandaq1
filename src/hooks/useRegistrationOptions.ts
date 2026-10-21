'use client'

import { useAuth } from '@/context/AuthContext'
import { rtdb } from '@/lib/database'
import { useLiveData } from '@/lib/dataStore'
import { DEFAULT_REGISTRATION_OPTIONS, type RegistrationOptions } from '@/lib/registration'

/**
 * The dropdown lists of the registration form (madrasa levels, Qur'an levels,
 * parents' education levels, results), live from the madrasa's settings and
 * cached on the device like every other channel. Defaults apply until the
 * madrasa admin edits them in Settings.
 */
export function useRegistrationOptions(): RegistrationOptions {
  const { user } = useAuth()
  const live = useLiveData<RegistrationOptions>(user ? 'settings:registrationOptions' : null, (emit) =>
    rtdb.subscribeToRegistrationOptions(emit)
  ).data
  return live ?? DEFAULT_REGISTRATION_OPTIONS
}
