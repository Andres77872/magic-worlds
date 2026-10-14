import { useTranslation } from 'react-i18next'
import { Download, Pin, PinOff } from 'lucide-react'
import { VoiceClipPlayer } from '@/ui/components/audio'
import { Button, Icon } from '@/ui/primitives'
import { downloadBlob, safeFilename } from '@/utils/download'
import { extensionFor, useObjectUrl, usePlayableBlob } from '../../audio'

export interface LabResult {
    id: number
    title: string
    blob: Blob
    contentType: string
    outputFormat: string
    requestId: string | null
    characterCost: number | null
}

interface LabResultCardProps {
    result: LabResult
    pinned: boolean
    canPin: boolean
    onTogglePin: () => void
}

/**
 * One lab render: player, download, request id, character cost and format (05 §8.11, AC-R10).
 * MP3 and WAV play as served; raw PCM plays through a WAV header and downloads as `.pcm` (R1-FE-06).
 */
export function LabResultCard({ result, pinned, canPin, onTogglePin }: LabResultCardProps) {
    const { t } = useTranslation()
    const url = useObjectUrl(usePlayableBlob(result.blob, result.contentType, result.outputFormat))
    return (
        <article aria-label={result.title} className="flex flex-col gap-3 rounded-lg border border-line-faint bg-ink-800/70 p-4">
            <p className="font-ui text-label font-semibold text-parchment-100">{result.title}</p>
            {url && <VoiceClipPlayer src={url} title={result.title} />}
            <ul className="flex flex-col gap-0.5 font-mono text-[11px] text-parchment-300">
                {result.requestId && <li>{t('admin.voices.lab.meta.requestId', { id: result.requestId })}</li>}
                {result.characterCost !== null && <li>{t('admin.voices.lab.meta.characterCost', { count: result.characterCost })}</li>}
                <li>{t('admin.voices.lab.meta.format', { format: result.outputFormat })}</li>
            </ul>
            <div className="flex flex-wrap gap-2">
                <Button
                    variant="ghost"
                    size="sm"
                    iconLeft={<Icon icon={Download} size={14} />}
                    onClick={() => downloadBlob(result.blob, `${safeFilename(result.title, 'lab')}.${extensionFor(result.contentType, result.outputFormat)}`)}
                >
                    {t('admin.voices.common.download')}
                </Button>
                <Button
                    variant={pinned ? 'secondary' : 'ghost'}
                    size="sm"
                    aria-pressed={pinned}
                    iconLeft={<Icon icon={pinned ? PinOff : Pin} size={14} />}
                    onClick={onTogglePin}
                    disabled={!pinned && !canPin}
                >
                    {pinned ? t('admin.voices.lab.unpin') : t('admin.voices.lab.compare')}
                </Button>
            </div>
        </article>
    )
}
