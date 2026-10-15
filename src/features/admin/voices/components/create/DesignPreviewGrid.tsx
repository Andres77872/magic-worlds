import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Download } from 'lucide-react'
import type { VoiceDesignPreview } from '@/shared'
import { VoiceClipPlayer } from '@/ui/components/audio'
import { Button, Icon, cx } from '@/ui/primitives'
import { downloadBlob, safeFilename } from '@/utils/download'
import { base64ToBlob, extensionFor, useObjectUrl } from '../../audio'

interface DesignPreviewGridProps {
    previews: VoiceDesignPreview[]
    chosenId: string | null
    onChoose: (generatedVoiceId: string) => void
    languageName: (code: string) => string
    filenameBase: string
}

/** Design or remix previews: labelled players, duration, language, download, choose. */
export function DesignPreviewGrid({ previews, chosenId, onChoose, languageName, filenameBase }: DesignPreviewGridProps) {
    const { t } = useTranslation()
    return (
        <ul className="grid gap-3 lg:grid-cols-3" aria-label={t('admin.voices.design.previews')}>
            {previews.map((preview, index) => (
                <PreviewCard
                    key={preview.generated_voice_id}
                    preview={preview}
                    index={index + 1}
                    chosen={chosenId === preview.generated_voice_id}
                    onChoose={() => onChoose(preview.generated_voice_id)}
                    title={
                        preview.language
                            ? t('admin.voices.design.previewTitle', { index: index + 1, language: languageName(preview.language) })
                            : t('admin.voices.design.previewTitleNoLanguage', { index: index + 1 })
                    }
                    filename={`${safeFilename(filenameBase, 'voice')}-${index + 1}`}
                />
            ))}
        </ul>
    )
}

function PreviewCard({
    preview,
    chosen,
    onChoose,
    title,
    filename,
}: {
    preview: VoiceDesignPreview
    index: number
    chosen: boolean
    onChoose: () => void
    title: string
    filename: string
}) {
    const { t } = useTranslation()
    const blob = useMemo(() => base64ToBlob(preview.audio_base_64, preview.media_type || 'audio/mpeg'), [preview.audio_base_64, preview.media_type])
    const url = useObjectUrl(blob)
    return (
        <li
            className={cx(
                'flex flex-col gap-3 rounded-lg border bg-ink-800/70 p-4',
                chosen ? 'border-ember-500 shadow-glow-ember' : 'border-line-faint',
            )}
        >
            <p className="font-ui text-label font-semibold text-parchment-100">{title}</p>
            {url ? <VoiceClipPlayer src={url} title={title} durationMs={preview.duration_secs ? preview.duration_secs * 1000 : null} /> : null}
            {preview.duration_secs !== null && (
                <p className="font-mono text-[11px] text-fg-muted">{t('admin.voices.design.duration', { seconds: preview.duration_secs.toFixed(1) })}</p>
            )}
            <div className="flex flex-wrap gap-2">
                <Button
                    variant={chosen ? 'primary' : 'secondary'}
                    size="sm"
                    aria-pressed={chosen}
                    iconLeft={chosen ? <Icon icon={Check} size={14} /> : undefined}
                    onClick={onChoose}
                >
                    {chosen ? t('admin.voices.design.chosen') : t('admin.voices.design.choose')}
                </Button>
                {blob && (
                    <Button
                        variant="ghost"
                        size="sm"
                        iconLeft={<Icon icon={Download} size={14} />}
                        onClick={() => downloadBlob(blob, `${filename}.${extensionFor(blob.type)}`)}
                    >
                        {t('admin.voices.common.download')}
                    </Button>
                )}
            </div>
        </li>
    )
}
