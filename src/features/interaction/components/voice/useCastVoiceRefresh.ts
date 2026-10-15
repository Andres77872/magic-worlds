/**
 * The adventure side of D36 (R1-FE-04; 05 §7.8, 09 §4.4): which cast members
 * play another voice than their library card plays now, and the targeted
 * `POST /adventure-sessions/{id}/voices/refresh` through DataProvider (the
 * returned snapshot replaces the stored one, so the drift clears itself).
 *
 * Nothing is affected, and nothing renders, unless every gate holds:
 * - the session cast entry has a voice projection (I-16) and the
 *   library card has one with another `voice_key` (`sessionVoiceDrift`);
 * - the panel is editable, the session is saved (not a local draft), and its
 *   workspace is the committed one and not archived (09 §4.11; D39 item 6:
 *   the library list belongs to the committed workspace);
 * - DataProvider offers `refreshAdventureVoices`.
 * The narrator and the persona are never targets (EP-2).
 */
import { isVoicesFeatureEnabled } from '@/shared/featureFlags'
import { useMemo, useRef, type RefObject } from 'react'
import type { Adventure } from '@/shared/types'
import { useData } from '@/app/hooks'
import { organizationWorkspaceId } from '@/shared/hooks/useScopedApi'
import { useVoiceRefresh, type VoiceRefreshState } from '../../hooks/useVoiceRefresh'
import type { SnapshotCardEntry } from '../../utils/adventureSnapshot'
import { castVoiceDrift, refreshBatches, type CastVoiceDrift } from './sessionVoiceDrift'
import { useSessionClient } from './useSessionClient'

export interface CastVoiceRefresh {
    /** The refreshable cast members, in cast order. */
    affected: readonly CastVoiceDrift[]
    byCard: ReadonlyMap<string, CastVoiceDrift>
    refresh: VoiceRefreshState
    /**
     * The status line of the `CastVoiceRefreshPanel` showing this state. `run`
     * moves focus there: the control that started it (the cast menu item, the
     * "Update N voices" button) closes, and the member rows it sat in go once
     * their voices match.
     */
    statusRef: RefObject<HTMLSpanElement | null>
    /** Refreshes these cast cards (1..6 per request, sent in order). */
    run: (cardIds: readonly string[]) => void
}

interface UseCastVoiceRefreshOptions {
    adventure: Adventure
    cast: readonly SnapshotCardEntry[]
    editable: boolean
    readOnly: boolean
}

export function useCastVoiceRefresh({ adventure, cast, editable, readOnly }: UseCastVoiceRefreshOptions): CastVoiceRefresh {
    const data = useData()
    const session = useSessionClient(organizationWorkspaceId(adventure))
    const refresh = useVoiceRefresh()
    const refreshAdventureVoices = typeof data.refreshAdventureVoices === 'function' ? data.refreshAdventureVoices : null
    const library = data.characters
    const sessionId = Number(adventure.id)
    const api = session.api
    const canRefresh = Boolean(
        isVoicesFeatureEnabled() && editable && !readOnly && !session.readOnly && session.active && api && refreshAdventureVoices
        && !adventure.draft && Number.isInteger(sessionId) && sessionId > 0,
    )

    const affected = useMemo(() => {
        if (!canRefresh) return []
        return castVoiceDrift(
            cast.map(({ card }) => ({ cardId: card.id, name: card.name, effective: card.effective_voice })),
            (cardId) => library?.find((character) => character.id === cardId)?.effective_voice,
        )
    }, [canRefresh, cast, library])
    const byCard = useMemo(() => new Map(affected.map((drift) => [drift.cardId, drift] as const)), [affected])

    const statusRef = useRef<HTMLSpanElement>(null)

    const run = (cardIds: readonly string[]) => {
        const batches = refreshBatches(cardIds)
        if (!isVoicesFeatureEnabled() || batches.length === 0 || !api || !refreshAdventureVoices) return
        statusRef.current?.focus()
        void refresh.run(async () => {
            for (const batch of batches) await refreshAdventureVoices(adventure.id, batch, api)
        })
    }

    return { affected, byCard, refresh, statusRef, run }
}
