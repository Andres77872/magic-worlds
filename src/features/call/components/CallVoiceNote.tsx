/**
 * The call header's voice note (R1-FE-05), next to the always-rendered "AI
 * voice" badge: "Call voice: {name}" when the card's voice is not call-ready,
 * or "Voice replaced: {name}" when it was replaced ("Voice replaced" when the
 * substitute is unnamed). Text carries the meaning;
 * the hint is a tooltip and `title` on a focusable badge. Renders nothing
 * without a note (the call speaks with the card's own voice).
 */
import { useTranslation } from 'react-i18next'
import { Badge, Tooltip } from '@/ui/primitives'
import type { CallVoiceNote as CallVoiceNoteValue } from '../callVoiceNote'

export function CallVoiceNote({ note }: { note: CallVoiceNoteValue | null | undefined }) {
    const { t } = useTranslation()
    if (!note) return null
    const text = note.kind === 'call_voice'
        ? t('voices.badge.call_voice', { name: note.name ?? t('voices.display.fallbackName') })
        : note.name
            ? t('voices.call.voiceReplaced', { name: note.name })
            // No name (a mid-call swap names no substitute): "Voice replaced", never a guessed name.
            : t('voices.badge.replaced')
    const hint = note.kind === 'call_voice'
        ? t('voices.call.callVoiceTooltip')
        : note.original && note.name
            ? t('voices.badge.replaced_tooltip', { original: note.original, name: note.name })
            : t('voices.badge.replaced_tooltip_generic')
    return (
        <Tooltip label={hint} wrapperClassName="inline-flex">
            <Badge tone="neutral" title={hint} tabIndex={0} data-testid="call-voice-note" data-note={note.kind}>
                {text}
            </Badge>
        </Tooltip>
    )
}
