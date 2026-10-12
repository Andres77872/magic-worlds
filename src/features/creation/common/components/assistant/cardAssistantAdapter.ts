import type { AssistantCardDocument, AssistantCardType } from '@/shared/types/assistant.types'
import type { AssistantAdapter } from './assistantModel'
import { stripCardBodyOrganization } from '@/infrastructure/api/workspaceContract'

/** Current-card input is optional, but when present the backend requires a saved id. */
function normalizedCurrentCard(
    card: Record<string, unknown>,
    cardId: string | null,
    cardType: AssistantCardType,
    savedCard: AssistantCardDocument | null,
): Record<string, unknown> | null {
    if (!cardId) return null
    const clean = (value: unknown): unknown => {
        if (Array.isArray(value)) return value.map(clean)
        if (!value || typeof value !== 'object') return value
        return Object.fromEntries(
            Object.entries(value as Record<string, unknown>)
                .filter(([key]) => key !== 'place_type' && key !== 'placeType')
                .map(([key, child]) => [key, clean(child)]),
        )
    }
    // Organization is server-owned read metadata; model input stays content-only.
    const result: Record<string, unknown> = { ...stripCardBodyOrganization(clean(card) as Record<string, unknown>), id: cardId }
    if (cardType !== 'adventure_template') {
        // Form payloads contain authored fields only. Revision markers must come from
        // the server's editable snapshot, never invented defaults or old form data.
        const revisionKeys = [
            'latest_version_id', 'latest_version_number', 'has_draft',
            'draft_updated_at', 'draft_based_on_version_number',
        ]
        if (!savedCard || savedCard.id !== cardId || revisionKeys.some((key) => savedCard[key] === undefined)) {
            throw new Error('Missing card assistant revision metadata')
        }
        for (const key of revisionKeys) result[key] = savedCard[key]
        // The strict DTO forbids even is_draft:false on the published fallback.
        delete result.is_draft
        delete result.based_on_version_number
        if (savedCard.has_draft === true) {
            result.is_draft = savedCard.is_draft
            result.based_on_version_number = savedCard.based_on_version_number
        }
    }
    return result
}

/**
 * The card creators' copilot. A draft form talks to an unbound conversation
 * (`current: null`); once the card is saved, each turn sends the live form plus
 * the saved revision so the server can refuse edits made elsewhere meanwhile.
 */
export const cardAssistantAdapter: AssistantAdapter<'card'> = {
    kind: 'card',
    lifecycle: 'panel',
    scope: (binding) => ({ kind: 'card', card_type: binding.cardType, ...(binding.targetId ? { card_id: binding.targetId } : {}) }),
    title: (binding) => binding.title,
    turnBody: (binding, message, bound) => bound
        ? {
            kind: 'card',
            message,
            card_type: binding.cardType,
            current: normalizedCurrentCard(binding.current, binding.targetId, binding.cardType, bound.target),
            expected_revision: bound.cas.revision,
            expected_content_hash: bound.cas.content_hash,
        }
        : { kind: 'card', message, card_type: binding.cardType, current: null },
}
