/**
 * The adventure header's D36 entry (R1-FE-04; 05 §7.8 "Where: the chat or
 * adventure header", AC-C6). Below xl the side panel that holds the cast block
 * is a closed drawer, so the top bar carries the same `CastVoiceRefreshPanel`
 * as a strip: "N characters sound different from their cards" and "Use the
 * cards' current voices", which opens the affected cast as checkboxes. At xl the
 * side panel docks and shows its own block, so the strip is hidden there.
 *
 * The adventure is DataProvider's `editingInProgress`, the session the
 * interaction screen plays (it remounts per session). Every gate is
 * `useCastVoiceRefresh`'s: the voice projections (I-16), a saved session, its
 * workspace committed and not archived (09 §4.11, D39 item 6). The play screen
 * always edits its own snapshot, so the panel is editable here. Outside those
 * gates, and outside the providers (stories, isolated tests), nothing renders.
 */
import { useContext, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { DataContext } from '@/app/providers/DataProvider'
import type { Adventure } from '@/shared/types'
import { characterEntries, ensureAdventureSnapshot } from '../../utils/adventureSnapshot'
import { CastVoiceRefreshPanel } from './CastVoiceRefreshPanel'
import { useCastVoiceRefresh } from './useCastVoiceRefresh'

export function AdventureCastVoiceStrip({ className }: { className?: string }) {
    const data = useContext(DataContext)
    const adventure = data?.editingInProgress ?? null
    if (!adventure) return null
    return <CastVoiceStrip adventure={adventure} className={className} />
}

function CastVoiceStrip({ adventure, className }: { adventure: Adventure; className?: string }) {
    const { t } = useTranslation()
    const cast = useMemo(() => characterEntries(ensureAdventureSnapshot(adventure)), [adventure])
    const castVoice = useCastVoiceRefresh({ adventure, cast, editable: true, readOnly: false })
    return <CastVoiceRefreshPanel cast={castVoice} variant="bar" label={t('voices.refresh.castRegionLabel')} className={className} />
}
