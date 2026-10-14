/**
 * One D15 review flag as a dismissible warning notice (R1-FE-03, 03 copy):
 * the fixed sentence, one detail line per known flag, the record's origin
 * workspace when it is not the selected one, and 05 §7.8's
 * "[▶ Listen] [Adjust] [Dismiss]".
 *
 * "Listen" plays the record's voice as its free catalog sample
 * (`useReviewFlagSample`); `voiceKey` skips the effective-voice read when the
 * host knows the voice. "Adjust" opens the flagged record through guarded
 * origin navigation (`useOriginNavigation`): a character card or its draft
 * opens the character editor, a template cast flag opens the adventure
 * template editor (no cast anchor exists, so it opens at the top), a preset
 * opens the Voice studio on that preset. A host already showing the record
 * passes `onAdjust` instead. A record of an archived app workspace keeps only
 * Listen and Dismiss (05 §7.8-§7.9); a host showing the record read-only says
 * so with `readOnly` (it must also render the notice outside its disabled
 * `ReadOnlyFieldset`, so Listen and Dismiss stay usable).
 *
 * Accessibility (05 §10 "Notices"): the notice is a region named by its
 * heading ("Review this voice", or "Review this voice: {name}" in a list);
 * Dismiss names what it dismisses ("Dismiss review notice for {name}"); after
 * a dismissal the focus moves to the next notice, the host's target, or the
 * heading (`focusAfterNoticeDismiss`). Listen names its record until the voice
 * is resolved, then the voice and the sample's language too (05 §10 "Audio
 * controls": "Listen to Lyra: Maren, English"), keeping the visible word.
 */
import { useContext, useId, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Loader2, Play, Square } from 'lucide-react'
import type { PageType, VoiceReviewFlag } from '@/shared'
import { WorkspaceContext } from '@/app/providers/workspaceContext'
import { buildCardEditHash, buildLinkedEditorHash } from '@/features/gallery/galleryLinks'
import { useOriginNavigation } from '@/features/workspaces/originNavigation'
import { VoiceClipPlayer } from '@/ui/components/audio'
import { WorkspaceOriginLabel } from '@/ui/components/WorkspaceOriginLabel'
import { Button, Callout, Icon, cx } from '@/ui/primitives'
import { canListenToFlag, useReviewFlagSample } from '../hooks/useReviewFlagSample'
import { buildPresetEditHash } from '../presetLinks'
import { focusAfterNoticeDismiss } from './noticeFocus'
import { languageLabel } from './VoiceBadges'

const DETAIL_KEYS: ReadonlySet<string> = new Set(['pitch_dropped', 'vol_dropped', 'speed_clamped', 'needs_review'])

export function reviewFlagTarget(flag: VoiceReviewFlag): { page: PageType; hash: string } {
    if (flag.ref_type === 'template_cast') return { page: 'adventure', hash: buildLinkedEditorHash('adventure', flag.ref_id) }
    if (flag.ref_type === 'preset') return { page: 'voice-studio', hash: buildPresetEditHash(flag.ref_id) }
    return {
        page: 'character',
        hash: buildCardEditHash('character', flag.ref_id, flag.ref_type === 'card_draft' ? 'draft' : undefined),
    }
}

/** Whether the flag's record lives in an archived app workspace (read-only there, D39). */
function useArchivedOrigin(workspaceId: string | null | undefined): boolean {
    const workspace = useContext(WorkspaceContext)
    if (!workspace || !workspaceId) return false
    return Boolean(workspace.workspaces.find((candidate) => candidate.id === workspaceId)?.archived_at)
}

interface ReviewNoticeProps {
    flag: VoiceReviewFlag
    onDismiss: (flagId: number) => void
    /** Overrides the navigation, e.g. when the flagged record is already open. */
    onAdjust?: () => void
    /** A short name for the flagged record (account-wide lists): shown in the heading, it also names Listen and Dismiss. */
    title?: string
    /** The record's name for the Listen and Dismiss names when no `title` is shown (e.g. the card being edited). */
    name?: string
    /** The record is shown read-only (an archived workspace): Adjust is hidden; Listen and Dismiss stay. */
    readOnly?: boolean
    /** Heading level of the notice title, after the surrounding outline (default 3). */
    headingLevel?: 2 | 3 | 4
    /** Where focus goes after Dismiss when no other notice follows (else the section or page heading). */
    dismissFocusTarget?: () => HTMLElement | null
    /** The record's catalog voice when the host knows it ("Listen" then skips the effective-voice read). */
    voiceKey?: string | null
    /** The language of the sample "Listen" plays (else the voice's primary one). */
    language?: string | null
    className?: string
}

export function ReviewNotice({
    flag,
    onDismiss,
    onAdjust,
    title,
    name,
    readOnly = false,
    headingLevel = 3,
    dismissFocusTarget,
    voiceKey = null,
    language = null,
    className,
}: ReviewNoticeProps) {
    const { t, i18n } = useTranslation()
    const { navigateToOrigin } = useOriginNavigation()
    const archived = useArchivedOrigin(flag.organization?.workspace_id) || readOnly
    const regionRef = useRef<HTMLElement>(null)
    const headingId = useId()
    const Heading = `h${headingLevel}` as const
    const recordName = title || name || null
    const sample = useReviewFlagSample(flag, { voiceKey, language })
    const canListen = canListenToFlag(flag, voiceKey)
    const heardVoice = sample.heard
        ? sample.heard.language
            ? t('voices.notice.reviewFlagVoiceIn', { voice: sample.heard.name, language: languageLabel(sample.heard.language, i18n.language) })
            : sample.heard.name
        : null
    // 05 §10: Listen names the record (several notices in a list) and, once known, the voice and language it plays.
    const listenLabel = heardVoice
        ? recordName
            ? t('voices.notice.reviewFlagListenVoiceFor', { name: recordName, voice: heardVoice })
            : t('voices.notice.reviewFlagListenVoice', { voice: heardVoice })
        : recordName
          ? t('voices.notice.reviewFlagListenFor', { name: recordName })
          : undefined
    const details = [...new Set(flag.flags)].filter((key) => DETAIL_KEYS.has(key))
    const adjust = () => {
        if (onAdjust) {
            onAdjust()
            return
        }
        void navigateToOrigin({ workspaceId: flag.organization?.workspace_id ?? null, ...reviewFlagTarget(flag) })
    }
    const dismiss = () => {
        focusAfterNoticeDismiss(regionRef.current, dismissFocusTarget)
        onDismiss(flag.flag_id)
    }
    return (
        <section
            ref={regionRef}
            aria-labelledby={headingId}
            tabIndex={-1}
            data-voice-notice="review"
            className={cx('rounded-lg', className)}
        >
            <Callout
                tone="warning"
                role="note"
                icon={<Icon icon={AlertTriangle} size={16} />}
                data-testid="voice-review-notice"
            >
                <div className="flex flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                        <Heading id={headingId} className="font-ui text-sm font-semibold text-parchment-50">
                            {title ? t('voices.notice.reviewFlagHeadingFor', { name: title }) : t('voices.notice.reviewFlagHeading')}
                        </Heading>
                        {flag.organization && <WorkspaceOriginLabel workspaceId={flag.organization.workspace_id} />}
                    </div>
                    <p>{t('voices.notice.reviewFlag')}</p>
                    {details.length > 0 && (
                        <ul className="flex list-disc flex-col gap-0.5 pl-5 text-parchment-300">
                            {details.map((key) => (
                                <li key={key}>{t(`voices.notice.reviewFlagDetail.${key}`)}</li>
                            ))}
                        </ul>
                    )}
                    <div className="flex flex-wrap gap-2">
                        {canListen && (
                            <Button
                                variant="secondary"
                                size="sm"
                                aria-pressed={sample.playing}
                                aria-label={listenLabel}
                                iconLeft={<Icon icon={sample.loading ? Loader2 : sample.playing ? Square : Play} size={14} className={sample.loading ? 'animate-spin' : undefined} />}
                                onClick={() => (sample.playing || sample.loading ? sample.stop() : void sample.listen())}
                            >
                                {t('voices.notice.reviewFlagListen')}
                            </Button>
                        )}
                        {!archived && (
                            <Button variant="secondary" size="sm" onClick={adjust}>
                                {t('voices.notice.reviewFlagAdjust')}
                            </Button>
                        )}
                        <Button
                            variant="ghost"
                            size="sm"
                            aria-label={recordName ? t('voices.notice.reviewFlagDismissFor', { name: recordName }) : t('voices.notice.reviewFlagDismissLabel')}
                            onClick={dismiss}
                        >
                            {t('voices.notice.reviewFlagDismiss')}
                        </Button>
                    </div>
                    {sample.clip && <VoiceClipPlayer src={sample.clip.src} title={heardVoice ?? recordName ?? t('voices.notice.reviewFlagListen')} />}
                    {sample.error && <p role="alert" className="font-ui text-caption text-blood-300">{sample.error}</p>}
                </div>
            </Callout>
        </section>
    )
}
