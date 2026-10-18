import type { TFunction } from 'i18next'
import type { CardSourceStatus } from '@/shared/types/workspace.types'
import type { SourceCheckState } from '../hooks/useCardSourceStatuses'
import type { CodexLibraryCardKind } from './codexUtils'

export interface CodexContextCard {
    kind: CodexLibraryCardKind
    cardId: string
    snapshot: Record<string, unknown>
}

export interface CodexContextCardDetail {
    type: CodexLibraryCardKind
    id: string
    name: string
    imageUrl?: string
    status: string
    sourceUnavailable: boolean
}

export function cardSourceStatusText(kind: CodexLibraryCardKind, snapshot: Record<string, unknown> | null,
    source: CardSourceStatus | undefined, state: SourceCheckState, t: TFunction): string {
    const prefix = 'characterChat.codex.sourceStatus.'
    const pinned = snapshot?.source_card_version_number
    const hasPin = typeof pinned === 'number' && Number.isSafeInteger(pinned) && pinned > 0
    const parts = hasPin ? [t(`${prefix}using`, { number: pinned })] : []
    if (state !== 'ready' || !source) {
        parts.push(t(`${prefix}${state === 'ready' ? 'unchecked' : state}`))
    } else if (!source.available) {
        parts.push(t(`${prefix}unavailable`))
    } else if (kind === 'adventure_template') {
        parts.push(t(`${prefix}untracked`))
    } else if (!snapshot) {
        parts.push(source.latest_version_number ? t(`${prefix}latestNumber`, { number: source.latest_version_number }) : t(`${prefix}unversioned`))
    } else if (pinned === undefined) {
        parts.push(t(`${prefix}unknown`))
    } else if (source.latest_version_number === 0 && pinned === 0) {
        parts.push(t(`${prefix}unversioned`))
    } else if (typeof pinned !== 'number' || !Number.isSafeInteger(pinned) || pinned < 0 || source.latest_version_number === null || pinned > source.latest_version_number
        || (pinned === source.latest_version_number && snapshot.source_card_version_id != null
            && snapshot.source_card_version_id !== source.latest_version_id)) {
        parts.push(t(`${prefix}unknown`))
    } else if (pinned < source.latest_version_number) {
        if (!hasPin) parts.push(t(`${prefix}unversionedCopy`))
        parts.push(t(`${prefix}older`), t(`${prefix}latestNumber`, { number: source.latest_version_number }))
    } else {
        parts.push(t(`${prefix}latest`))
    }
    if (state === 'ready' && source?.has_draft) parts.push(t(`${prefix}draft`))
    return parts.join(' · ')
}
