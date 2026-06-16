import { useTranslation } from 'react-i18next'
import { Loader2, Play, Trash2 } from 'lucide-react'
import type { AdminVoiceEntry } from '@/shared'
import { Badge, Button, Icon } from '@/ui/primitives'
import { CopyableVoiceId } from './CopyableVoiceId'

interface VoiceRowProps {
    voice: AdminVoiceEntry
    deleting: boolean
    onTest: (voice: AdminVoiceEntry) => void
    onDelete: (voice: AdminVoiceEntry) => void
}

const TYPE_LABEL_KEY: Record<AdminVoiceEntry['voice_type'], string> = {
    system: 'admin.voices.row.type.system',
    voice_cloning: 'admin.voices.row.type.cloned',
    voice_generation: 'admin.voices.row.type.designed',
}

export function VoiceRow({ voice, deleting, onTest, onDelete }: VoiceRowProps) {
    const { t } = useTranslation()
    const description = voice.description.filter(Boolean).join(' ')
    return (
        <div className="flex flex-col gap-3 rounded-lg border border-parchment-50/[.08] bg-ink-800/70 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                    <p className="font-ui text-sm font-semibold text-parchment-50">{voice.voice_name || voice.voice_id}</p>
                    <Badge tone={voice.deletable ? 'arcane' : 'neutral'}>{t(TYPE_LABEL_KEY[voice.voice_type])}</Badge>
                </div>
                <CopyableVoiceId value={voice.voice_id} compact />
                {description && <p className="mt-2 line-clamp-2 font-ui text-sm text-parchment-300">{description}</p>}
                {voice.created_time && (
                    <p className="mt-1 font-mono text-xs text-parchment-400">{t('admin.voices.row.created', { time: voice.created_time })}</p>
                )}
            </div>
            <div className="flex shrink-0 flex-wrap justify-end gap-2">
                <Button variant="secondary" size="sm" iconLeft={<Icon icon={Play} size={14} />} onClick={() => onTest(voice)}>
                    {t('admin.voices.row.test')}
                </Button>
                {voice.deletable ? (
                    <Button
                        variant="danger"
                        size="sm"
                        iconLeft={<Icon icon={deleting ? Loader2 : Trash2} size={14} className={deleting ? 'animate-spin' : undefined} />}
                        disabled={deleting}
                        onClick={() => onDelete(voice)}
                    >
                        {t('admin.common.delete')}
                    </Button>
                ) : (
                    <Badge tone="neutral">{t('admin.voices.row.protected')}</Badge>
                )}
            </div>
        </div>
    )
}
