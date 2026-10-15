import { useTranslation } from 'react-i18next'
import { VoiceClipPlayer } from '@/ui/components/audio'
import { cx } from '@/ui/primitives'

interface PreviewTranscriptProps {
    text: string
    /**
     * The text's language (e.g. `es`), so screen readers pronounce it right (05 §10
     * Language). Left out, the text inherits the page language.
     */
    lang?: string
    className?: string
}

/** The exact fixed text a recipe preview reads (05 §6.2): what is being judged, and the clip's transcript. */
export function PreviewTranscript({ text, lang, className }: PreviewTranscriptProps) {
    const { t } = useTranslation()
    return (
        <figure className={cx('flex flex-col gap-1', className)}>
            <figcaption className="font-ui text-caption text-fg-muted">{t('voices.preview.transcript')}</figcaption>
            <blockquote lang={lang} className="border-l-2 border-parchment-50/10 pl-3 font-narrative text-body text-parchment-200">{text}</blockquote>
        </figure>
    )
}

interface RecipePreviewPlayerProps {
    src: string
    /** Element volume 0..1: thought previews play at ×0.708, times `gain_db` (D16). */
    volume: number
    title: string
    /**
     * The text the clip reads, shown under the player. Null for a V2 catalog sample:
     * the voice's own recording, captioned as a free sample instead of a fixed line.
     */
    transcript: string | null
    /** The transcript's language (`PreviewTranscript`'s `lang`). */
    lang?: string
    /** Play the clip as soon as it loads (it answers a Preview press); default on. */
    autoPlay?: boolean
    className?: string
}

/**
 * An ephemeral preview clip with its transcript underneath. The clip's level
 * rides the player's `volume`, so a replay keeps the thought attenuation (D16).
 */
export function RecipePreviewPlayer({ src, volume, title, transcript, lang, autoPlay = true, className }: RecipePreviewPlayerProps) {
    const { t } = useTranslation()
    return (
        <div className={cx('flex flex-col gap-3', className)}>
            <VoiceClipPlayer src={src} title={title} volume={volume} autoPlay={autoPlay} />
            {transcript === null
                ? <p className="font-ui text-caption text-fg-muted">{t('voices.preview.freeSample')}</p>
                : <PreviewTranscript text={transcript} lang={lang} />}
        </div>
    )
}
