import { useTranslation } from 'react-i18next'
import { Download } from 'lucide-react'
import { VoiceClipPlayer } from '@/ui/components/audio'
import { Button, Icon } from '@/ui/primitives'
import { downloadBlob, safeFilename } from '@/utils/download'
import { extensionFor, useConsoleAudioUrl } from '../../audio'

interface ConsoleAudioPlayerProps {
    /** BFF media path (or a root-only absolute upstream URL). */
    path: string | null | undefined
    /** Accessible name fragment: "Play {title}". */
    title: string
    durationMs?: number | null
    /**
     * Offer a download of the bytes as served, named after this (R1-FE-06): the
     * extension follows the audio (`.mp3`, `.wav`, or `.pcm` for raw PCM, which
     * plays through a WAV header).
     */
    downloadName?: string
}

/** A sample or render fetched as an authed blob, then played exclusively. */
export function ConsoleAudioPlayer({ path, title, durationMs, downloadName }: ConsoleAudioPlayerProps) {
    const { t } = useTranslation()
    const audio = useConsoleAudioUrl(path)
    if (!path) return null
    if (audio.loading) {
        return <p className="font-ui text-caption text-fg-muted">{t('admin.voices.common.loading')}</p>
    }
    if (!audio.src) {
        return <p className="font-ui text-caption text-blood-300">{t('admin.voices.common.audioUnavailable')}</p>
    }
    const player = <VoiceClipPlayer src={audio.src} title={title} durationMs={durationMs} />
    const blob = audio.blob
    if (!downloadName || !blob) return player
    return (
        <div className="flex flex-col gap-2">
            {player}
            <div>
                <Button
                    variant="ghost"
                    size="sm"
                    iconLeft={<Icon icon={Download} size={14} />}
                    onClick={() => downloadBlob(blob, `${safeFilename(downloadName, 'audio')}.${extensionFor(blob.type)}`)}
                >
                    {t('admin.voices.common.download')}
                </Button>
            </div>
        </div>
    )
}
