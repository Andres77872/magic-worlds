import { useTranslation } from 'react-i18next'
import { AudioLines } from 'lucide-react'
import type { AdminVoiceConcreteType, AdminVoiceEntry, AdminVoiceGroups, AdminVoiceQueryType } from '@/shared'
import { Badge, Card, Chip, SectionHeader } from '@/ui/primitives'
import { LIBRARY_FILTERS, VOICE_TYPE_META } from '../constants'
import { SystemVoiceBrowser } from './SystemVoiceBrowser'
import { VoiceRow } from './VoiceRow'

interface VoiceLibraryPanelProps {
    groups: AdminVoiceGroups
    voiceType: AdminVoiceQueryType
    setVoiceType: (value: AdminVoiceQueryType) => void
    loadingVoices: boolean
    deletingVoiceId: string | null
    onTest: (voice: AdminVoiceEntry) => void
    onDelete: (voice: AdminVoiceEntry) => void
}

const GROUP_ORDER: AdminVoiceConcreteType[] = ['voice_generation', 'voice_cloning', 'system']

function countVoices(groups: AdminVoiceGroups): number {
    return GROUP_ORDER.reduce((total, type) => total + groups[type].length, 0)
}

function VoiceGroup({
    type,
    voices,
    loading,
    deletingVoiceId,
    onTest,
    onDelete,
}: {
    type: AdminVoiceConcreteType
    voices: AdminVoiceEntry[]
    loading: boolean
    deletingVoiceId: string | null
    onTest: (voice: AdminVoiceEntry) => void
    onDelete: (voice: AdminVoiceEntry) => void
}) {
    const { t } = useTranslation()
    const meta = VOICE_TYPE_META[type]
    return (
        <section className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <h3 className="font-display text-h3 font-semibold text-parchment-50">{t(meta.labelKey)}</h3>
                    <p className="font-ui text-sm text-parchment-300">{t(meta.descriptionKey)}</p>
                </div>
                <Badge tone={type === 'system' ? 'neutral' : 'arcane'}>{voices.length}</Badge>
            </div>
            {voices.length > 0 ? (
                <div className="flex flex-col gap-2">
                    {voices.map((voice) => (
                        <VoiceRow
                            key={`${voice.voice_type}:${voice.voice_id}`}
                            voice={voice}
                            deleting={deletingVoiceId === voice.voice_id}
                            onTest={onTest}
                            onDelete={onDelete}
                        />
                    ))}
                </div>
            ) : (
                <div className="rounded-lg border border-parchment-50/[.08] bg-ink-800/70 px-4 py-3 font-ui text-sm text-parchment-300">
                    {loading ? t('admin.voices.library.loading') : t('admin.voices.library.emptyGroup')}
                </div>
            )}
        </section>
    )
}

export function VoiceLibraryPanel({
    groups,
    voiceType,
    setVoiceType,
    loadingVoices,
    deletingVoiceId,
    onTest,
    onDelete,
}: VoiceLibraryPanelProps) {
    const { t } = useTranslation()
    const total = countVoices(groups)
    return (
        <Card>
            <div className="flex flex-col gap-5 p-5">
                <SectionHeader
                    icon={AudioLines}
                    title={t('admin.voices.library.title')}
                    tone="arcane"
                    right={
                        <Badge tone={loadingVoices ? 'neutral' : 'glass'}>
                            {loadingVoices ? t('admin.voices.library.loadingShort') : t('admin.voices.library.count', { count: total })}
                        </Badge>
                    }
                />
                <div className="flex flex-wrap gap-2" role="group" aria-label={t('admin.voices.library.filterAria')}>
                    {LIBRARY_FILTERS.map((filter) => (
                        <Chip key={filter.value} active={voiceType === filter.value} onClick={() => setVoiceType(filter.value)}>
                            {t(filter.labelKey)}
                        </Chip>
                    ))}
                </div>
                <div className="flex flex-col gap-5">
                    {GROUP_ORDER.map((type) =>
                        type === 'system' ? (
                            <SystemVoiceBrowser
                                key={type}
                                voices={groups.system}
                                loading={loadingVoices}
                                deletingVoiceId={deletingVoiceId}
                                onTest={onTest}
                                onDelete={onDelete}
                            />
                        ) : (
                            <VoiceGroup
                                key={type}
                                type={type}
                                voices={groups[type]}
                                loading={loadingVoices}
                                deletingVoiceId={deletingVoiceId}
                                onTest={onTest}
                                onDelete={onDelete}
                            />
                        ),
                    )}
                </div>
            </div>
        </Card>
    )
}
