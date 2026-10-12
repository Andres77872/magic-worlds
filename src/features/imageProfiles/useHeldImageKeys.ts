import { useMemo, useSyncExternalStore } from 'react'
import type { ImageProvider } from '@/shared/types/imageProfile.types'
import { heldProvidersSnapshot, imageCredentialSession } from './imageCredentialSession'

/** The providers whose key is entered in this tab; re-renders when that changes. */
export function useHeldImageKeys(): ImageProvider[] {
    const held = useSyncExternalStore(imageCredentialSession.subscribe, heldProvidersSnapshot, () => '')
    return useMemo(() => (held ? held.split(',') as ImageProvider[] : []), [held])
}
