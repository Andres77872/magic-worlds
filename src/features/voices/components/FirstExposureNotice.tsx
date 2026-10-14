/**
 * "Voices have a new engine" (R1-FE-03, 09 §7): shown once per account and
 * browser, only when the surface holds a stored V1 voice that now plays
 * through an ElevenLabs projection. No "Learn
 * more" link: its target page is not written yet (§5 of the R1 build).
 *
 * Accessibility (05 §10 "Notices"): a region named by its heading ("New voice
 * engine"); "Got it" names what it dismisses; after a dismissal the focus
 * moves to the next notice or the page heading (`focusAfterNoticeDismiss`).
 */
import { useId, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Sparkles } from 'lucide-react'
import { Button, Callout, Icon, cx } from '@/ui/primitives'
import { useFirstExposure } from '../hooks/useFirstExposure'
import { focusAfterNoticeDismiss } from './noticeFocus'

interface FirstExposureCalloutProps {
    onDismiss: () => void
    className?: string
    /** Heading level of the notice title, after the surrounding outline (default 2: under the page heading). */
    headingLevel?: 2 | 3 | 4
    /** Where focus goes after "Got it" when no other notice follows (else the page heading). */
    dismissFocusTarget?: () => HTMLElement | null
}

export function FirstExposureCallout({ onDismiss, className, headingLevel = 2, dismissFocusTarget }: FirstExposureCalloutProps) {
    const { t } = useTranslation()
    const regionRef = useRef<HTMLElement>(null)
    const headingId = useId()
    const Heading = `h${headingLevel}` as const
    const dismiss = () => {
        focusAfterNoticeDismiss(regionRef.current, dismissFocusTarget)
        onDismiss()
    }
    return (
        <section
            ref={regionRef}
            aria-labelledby={headingId}
            tabIndex={-1}
            data-voice-notice="first-exposure"
            className={cx('rounded-lg', className)}
        >
            <Callout
                tone="info"
                role="status"
                icon={<Icon icon={Sparkles} size={16} />}
                data-testid="voice-first-exposure"
                action={
                    <Button variant="ghost" size="sm" aria-label={t('voices.notice.first_exposure_dismissLabel')} onClick={dismiss}>
                        {t('voices.notice.first_exposure_dismiss')}
                    </Button>
                }
            >
                <Heading id={headingId} className="font-ui text-sm font-semibold text-parchment-50">
                    {t('voices.notice.first_exposure_title')}
                </Heading>
                <p className="mt-1">{t('voices.notice.first_exposure')}</p>
            </Callout>
        </section>
    )
}

interface FirstExposureNoticeProps {
    userHash: string | null | undefined
    /** The surface shows at least one stored V1 voice whose projection is ElevenLabs. */
    hasConvertedVoice: boolean
    className?: string
}

export function FirstExposureNotice({ userHash, hasConvertedVoice, className }: FirstExposureNoticeProps) {
    const exposure = useFirstExposure(userHash)
    if (!hasConvertedVoice || !exposure.visible) return null
    return <FirstExposureCallout onDismiss={exposure.dismiss} className={className} />
}
