import { useTranslation } from 'react-i18next'
import { ArrowUpRight } from 'lucide-react'
import { pageHash } from '@/features/gallery/galleryLinks'
import { Button, ButtonLink, Icon, cx } from '@/ui/primitives'
import { previewProblemMessage, type RecipePreviewProblem } from '../useRecipePreview'

interface PreviewAllowanceHintProps {
    /** Recipe previews left today (D18); null when the server does not report it. */
    previewsLeft: number | null
    loading?: boolean
    className?: string
}

/**
 * The remaining-count helper next to a recipe-preview button (05 §6.3). A
 * polite live region that stays mounted, so a changed count or the daily limit
 * is announced; empty when there is nothing to say.
 */
export function PreviewAllowanceHint({ previewsLeft, loading = false, className }: PreviewAllowanceHintProps) {
    const { t } = useTranslation()
    const message = loading
        ? t('voices.preview.generating')
        : previewsLeft === 0
          ? t('voices.preview.limitReached')
          : previewsLeft !== null
            ? t('voices.preview.previewsLeft', { count: previewsLeft })
            : ''
    return (
        <p role="status" aria-live="polite" className={cx('font-ui text-caption', previewsLeft === 0 && !loading ? 'text-amber-500' : 'text-fg-muted', className)}>
            {message}
        </p>
    )
}

interface PreviewProblemNoticeProps {
    /** Why the last recipe preview did not play (`useRecipePreview().problem`). */
    problem: RecipePreviewProblem | null
    /** 409 `voice_unavailable`: offers "Pick another voice" (05 §6.4). Left out, the copy shows alone. */
    onPickVoice?: () => void
    /** Open the membership page in a new tab, so an editor's unsaved draft survives. */
    membershipInNewTab?: boolean
    /** Classes of the message line. */
    messageClassName?: string
    className?: string
}

/**
 * A recipe preview's error with its 05 §6.4 action, on the ElevenLabs Studio
 * and preset editor: "Not enough credits for another preview." links to the
 * membership page, and "This voice is not available right now." offers "Pick
 * another voice". The message is an alert; the daily limit has none (the
 * allowance helper says it).
 */
export function PreviewProblemNotice({ problem, onPickVoice, membershipInNewTab = false, messageClassName, className }: PreviewProblemNoticeProps) {
    const { t } = useTranslation()
    const message = previewProblemMessage(problem, t)
    if (!message) return null
    const newTab = membershipInNewTab
        ? { target: '_blank', rel: 'noopener noreferrer', iconRight: <Icon icon={ArrowUpRight} size={14} /> }
        : {}
    return (
        <div className={cx('flex flex-wrap items-center gap-x-3 gap-y-2', className)} data-testid="preview-problem">
            <p role="alert" className={messageClassName ?? 'font-ui text-caption text-blood-300'}>{message}</p>
            {problem === 'noCredits' && (
                <ButtonLink variant="secondary" size="sm" href={pageHash('profile')} {...newTab}>
                    {t('voices.studio.v2.viewMembership')}
                    {membershipInNewTab && <span className="sr-only"> {t('voices.studio.v2.opensInNewTab')}</span>}
                </ButtonLink>
            )}
            {problem === 'voiceUnavailable' && onPickVoice && (
                <Button variant="secondary" size="sm" onClick={onPickVoice}>
                    {t('voices.studio.v2.pickAnotherVoice')}
                </Button>
            )}
        </div>
    )
}
