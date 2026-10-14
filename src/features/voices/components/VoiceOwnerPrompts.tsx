/**
 * The one-click owner prompts next to a voice's badges (05 §7.8, AC-K6):
 *
 * - `leaving` → "Switch to {replacement}" (the catalog `replacement`; the host
 *   writes it and keeps the current settings and emotion);
 * - `needs_reselect` → "Choose a voice" (opens the picker) and "Keep for now"
 *   (closes the prompt; the badge and its flag remain);
 * - `retired` → "Pick another" (opens the picker).
 *
 * A prompt shows only when the host passes its handler, so read-only rows
 * (global presets) get none. Copy lives under `VOICE_PROMPT_KEYS`.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowRightLeft, Loader2 } from 'lucide-react'
import type { CatalogVoice, VoiceBadgeKey } from '@/shared'
import { Button, Icon, cx } from '@/ui/primitives'

/** Key prefix of the prompt copy: the 05 §9.3 path `voices.prompt.*` (`voicePromptEn/Es` in `voiceBadges.ts`). */
export const VOICE_PROMPT_KEYS = 'voices.prompt'

export type VoiceReplacement = NonNullable<CatalogVoice['replacement']>

interface VoiceOwnerPromptsProps {
    badges: readonly VoiceBadgeKey[]
    /** The catalog's replacement for a leaving voice. */
    replacement?: VoiceReplacement | null
    onSwitch?: (replacement: VoiceReplacement) => void
    /** Opens the voice picker ("Choose a voice", "Pick another"). */
    onChoose?: () => void
    /** The switch is being written. */
    busy?: boolean
    disabled?: boolean
    className?: string
}

export function VoiceOwnerPrompts({ badges, replacement = null, onSwitch, onChoose, busy = false, disabled = false, className }: VoiceOwnerPromptsProps) {
    const { t } = useTranslation()
    const [kept, setKept] = useState(false)
    const switchTo = badges.includes('leaving') && replacement && onSwitch ? replacement : null
    const reselect = badges.includes('needs_reselect') && Boolean(onChoose) && !kept
    const pickAnother = badges.includes('retired') && Boolean(onChoose) && !reselect
    if (!switchTo && !reselect && !pickAnother) return null
    return (
        <div className={cx('flex flex-wrap items-center gap-2', className)} data-testid="voice-owner-prompts">
            {switchTo && (
                <Button
                    variant="secondary"
                    size="sm"
                    disabled={disabled || busy}
                    iconLeft={<Icon icon={busy ? Loader2 : ArrowRightLeft} size={14} className={busy ? 'animate-spin' : undefined} />}
                    onClick={() => onSwitch?.(switchTo)}
                >
                    {t(`${VOICE_PROMPT_KEYS}.switchTo`, { name: switchTo.display_name })}
                </Button>
            )}
            {reselect && (
                <>
                    <Button variant="secondary" size="sm" disabled={disabled} onClick={onChoose}>
                        {t(`${VOICE_PROMPT_KEYS}.chooseVoice`)}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setKept(true)}>
                        {t(`${VOICE_PROMPT_KEYS}.keepForNow`)}
                    </Button>
                </>
            )}
            {pickAnother && (
                <Button variant="secondary" size="sm" disabled={disabled} onClick={onChoose}>
                    {t(`${VOICE_PROMPT_KEYS}.pickAnother`)}
                </Button>
            )}
        </div>
    )
}
