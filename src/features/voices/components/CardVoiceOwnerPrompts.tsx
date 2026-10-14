/**
 * The 05 §7.8 owner prompts for a card's voice field (05 §7.7 "Character
 * editor" column), next to the badges `EffectiveVoiceLabel` shows: the
 * effective projection's badges drive them, and the leaving voice's catalog
 * entry supplies the replacement.
 *
 * - "Switch to {replacement}" hands the host the stored voice rewritten by
 *   `voiceWithReplacement` (it keeps its settings and emotion);
 * - "Choose a voice" / "Pick another" call `onChoose` (the host opens its picker);
 * - "Keep for now" only closes the prompt.
 *
 * Nothing renders without a projection (a share-link reader, an older row),
 * and the catalog is read only for a leaving voice. A
 * host that already looked the leaving voice up passes it as `leavingItem`,
 * so the key is not read twice (`useLeavingVoice`).
 *
 * Focus (05 §10): a prompt the user acted on can unmount under the focus
 * ("Keep for now"; "Switch to" when the host drops the projection). Focus then
 * goes to the host's `returnFocus` target instead of falling to the page.
 */
import type { MouseEvent } from 'react'
import type { CatalogVoice, CharacterVoiceV2, EffectiveVoice, StoredCharacterVoice } from '@/shared'
import { isElevenLabsProjection } from '@/shared/voice'
import { leavingVoiceKey, useLeavingVoice } from '../hooks/useLeavingVoice'
import { voiceWithReplacement } from '../voiceFromCatalog'
import { VoiceOwnerPrompts } from './VoiceOwnerPrompts'

interface CardVoiceOwnerPromptsProps {
    stored: StoredCharacterVoice | null | undefined
    effective: EffectiveVoice | null | undefined
    /** Writes the switched voice into the form (the host also drops the stale projection). */
    onSwitch: (next: CharacterVoiceV2) => void
    /** Opens the host's voice picker. */
    onChoose: () => void
    /**
     * The leaving voice's catalog entry when the host looked it up (null: not
     * found or not yet loaded). Left undefined, this component reads it itself.
     */
    leavingItem?: CatalogVoice | null
    /** Moves focus to a stable control of the host once an acted-on prompt unmounts. */
    returnFocus?: () => void
    disabled?: boolean
    className?: string
}

/** Whether nothing holds the focus (it fell to the page when its element unmounted). */
function focusLost(): boolean {
    const active = document.activeElement
    return !active || active === document.body || !active.isConnected
}

export function CardVoiceOwnerPrompts({
    stored,
    effective,
    onSwitch,
    onChoose,
    leavingItem,
    returnFocus,
    disabled = false,
    className,
}: CardVoiceOwnerPromptsProps) {
    const projection = isElevenLabsProjection(effective) ? effective : null
    const key = projection ? leavingVoiceKey(stored, projection) : null
    // The host's lookup wins; only a host that passed none makes this one read.
    const ownItem = useLeavingVoice(stored, effective, leavingItem === undefined)
    const item = leavingItem === undefined ? ownItem : leavingItem
    const replacement = item && item.voice_key === key ? item.replacement : null
    const badges = projection?.badges ?? []
    const prompted = (badges.includes('leaving') && Boolean(replacement)) || badges.includes('needs_reselect') || badges.includes('retired')
    if (!projection || !prompted) return null

    const keepFocus = (event: MouseEvent<HTMLDivElement>) => {
        if (!returnFocus) return
        const button = (event.target as Element | null)?.closest('button')
        if (!button) return
        // After the click's render: only a prompt that unmounted under the focus hands it on.
        window.setTimeout(() => {
            if (!button.isConnected && focusLost()) returnFocus()
        }, 0)
    }

    return (
        // `contents`: the wrapper only listens; the prompts keep the host's layout.
        <div className="contents" onClick={keepFocus}>
            <VoiceOwnerPrompts
                // A new voice gets fresh prompts ("Keep for now" was about the previous one).
                key={key ?? 'none'}
                className={className}
                badges={projection.badges}
                replacement={replacement}
                onSwitch={(target) => onSwitch(voiceWithReplacement(stored, target))}
                onChoose={onChoose}
                disabled={disabled}
            />
        </div>
    )
}
