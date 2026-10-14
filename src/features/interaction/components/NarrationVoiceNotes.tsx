/**
 * Voice notes of one narrated turn (R1-FE-04, 06 §9.7), shown next to the
 * always-present "AI voice" label:
 * - "Standard voice" when a clip played Standard because Expressive was not
 *   available (`tier_fallback`);
 * - "Voice replaced" once per replaced speaker (R-7 reasons), with the
 *   original and the voice heard as a tooltip (or the generic line). When an
 *   action applies it opens a small menu: "Use the card’s current voice"
 *   (`onRefreshVoice` with the clip's kind and `speaker_id`, R-30) for a cast
 *   speaker, or "Change narrator voice" (`onEditNarratorVoice`) for the
 *   narrator.
 *
 * Turns stored without the substitution fields (before WN-1) render nothing
 * here (G-1).
 */
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown } from 'lucide-react'
import type { ChatResponseSegmentKind, ChatTtsSegmentClip } from '@/shared/types'
import { turnVoiceNotes, type ReplacedVoiceNote } from '@/shared/voice/substitution'
import { BADGE_TONES, voiceBadgeCopy } from '@/features/voices/components/VoiceBadges'
import { Badge, Icon, Tooltip, cx } from '@/ui/primitives'
import { useVoiceRefresh } from '../hooks/useVoiceRefresh'

/** What a targeted refresh refreshes: the speaker's kind and its cast card id (null for every card / the chat). */
export interface VoiceRefreshTarget {
    speakerKind: ChatResponseSegmentKind | null
    cardId: string | null
}

export interface NarrationVoiceNotesProps {
    clips: readonly ChatTtsSegmentClip[]
    /** Re-resolves the speaker's voice from its card; resolves when the session DTO is stored. */
    onRefreshVoice?: (target: VoiceRefreshTarget) => Promise<unknown>
    /** Opens the narrator voice picker (adventures). */
    onEditNarratorVoice?: () => void
    /** Read-only, streaming, or before the capabilities read settles: actions are shown disabled. */
    refreshDisabled?: boolean
}

export function NarrationVoiceNotes({ clips, onRefreshVoice, onEditNarratorVoice, refreshDisabled = false }: NarrationVoiceNotesProps) {
    const { t, i18n } = useTranslation()
    const notes = useMemo(() => turnVoiceNotes(clips), [clips])
    const refresh = useVoiceRefresh()
    if (!notes.standardFallback && notes.replaced.length === 0) return null

    const fallback = voiceBadgeCopy('standard_fallback', {}, t, i18n.language)
    const showSpeaker = notes.replaced.length > 1

    return (
        <span className="inline-flex flex-wrap items-center gap-1.5" data-testid="narration-voice-notes">
            {notes.standardFallback && (
                <Tooltip label={fallback.hint ?? ''} wrapperClassName="inline-flex">
                    <Badge tone={BADGE_TONES.standard_fallback} title={fallback.hint ?? undefined} tabIndex={0} data-badge="standard_fallback">
                        {fallback.text}
                    </Badge>
                </Tooltip>
            )}
            {notes.replaced.map((note) => (
                <ReplacedNote
                    key={note.speaker ?? 'unnamed'}
                    note={note}
                    showSpeaker={showSpeaker}
                    onRefresh={onRefreshVoice && note.kind !== 'narrator'
                        ? () => void refresh.run(() => onRefreshVoice({ speakerKind: note.kind, cardId: note.cardId }))
                        : undefined}
                    onEditNarrator={note.kind === 'narrator' ? onEditNarratorVoice : undefined}
                    disabled={refreshDisabled || refresh.status === 'busy'}
                />
            ))}
            <span aria-live="polite" className={cx('font-ui text-caption', refresh.status === 'error' ? 'text-blood-300' : 'text-parchment-300')}>
                {refresh.message}
            </span>
        </span>
    )
}

function ReplacedNote({
    note,
    showSpeaker,
    onRefresh,
    onEditNarrator,
    disabled,
}: {
    note: ReplacedVoiceNote
    showSpeaker: boolean
    onRefresh?: () => void
    onEditNarrator?: () => void
    disabled: boolean
}) {
    const { t, i18n } = useTranslation()
    const [open, setOpen] = useState(false)
    const containerRef = useRef<HTMLSpanElement | null>(null)
    const menuId = useId()
    const copy = voiceBadgeCopy('replaced', { name: note.voiceName, original: note.originalVoiceName }, t, i18n.language)
    const speaker = note.kind === 'narrator' ? t('interaction.narration.clipNarrator') : note.speakerName
    const text = showSpeaker && speaker ? `${speaker} · ${copy.text}` : copy.text
    const action = onRefresh
        ? { label: t('voices.refresh.action'), run: onRefresh }
        : onEditNarrator
            ? { label: t('voices.refresh.narratorAction'), run: onEditNarrator }
            : null

    useEffect(() => {
        if (!open) return
        const onPointerDown = (event: MouseEvent) => {
            if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
        }
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setOpen(false)
        }
        document.addEventListener('mousedown', onPointerDown)
        document.addEventListener('keydown', onKeyDown)
        return () => {
            document.removeEventListener('mousedown', onPointerDown)
            document.removeEventListener('keydown', onKeyDown)
        }
    }, [open])

    if (!action) {
        return (
            <Tooltip label={copy.hint ?? ''} wrapperClassName="inline-flex">
                <Badge tone={BADGE_TONES.replaced} title={copy.hint ?? undefined} tabIndex={0} data-badge="replaced">
                    {text}
                </Badge>
            </Tooltip>
        )
    }

    return (
        <span ref={containerRef} className="relative inline-flex">
            <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={open}
                aria-controls={open ? menuId : undefined}
                title={copy.hint ?? undefined}
                data-badge="replaced"
                onClick={() => setOpen((value) => !value)}
                className="inline-flex items-center gap-1 rounded-full bg-ink-600 px-2.5 py-1 font-ui text-meta font-semibold tracking-[0.02em] whitespace-nowrap text-parchment-200 transition-colors hover:text-parchment-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400"
            >
                {text}
                <Icon icon={ChevronDown} size={12} />
            </button>
            {open && (
                <span
                    id={menuId}
                    role="menu"
                    aria-label={text}
                    className="absolute left-0 top-full z-[100] mt-1.5 flex w-64 flex-col gap-1 rounded-lg border border-parchment-50/10 bg-ink-700 p-1.5 shadow-lg"
                >
                    {copy.hint && <span className="px-2.5 pt-1.5 pb-1 font-ui text-caption leading-snug text-parchment-300">{copy.hint}</span>}
                    <button
                        type="button"
                        role="menuitem"
                        disabled={disabled}
                        onClick={() => {
                            setOpen(false)
                            action.run()
                        }}
                        className="w-full rounded-sm px-2.5 py-2 text-left font-ui text-[13px] font-semibold text-ember-300 hover:bg-parchment-50/[.06] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {action.label}
                    </button>
                </span>
            )}
        </span>
    )
}
