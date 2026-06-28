import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AudioLines, Check, Loader2, Play } from 'lucide-react'
import { apiService } from '@/infrastructure/api'
import type { AdminVoiceEmotion, AdminVoiceEntry, CharacterVoice, VoicePreset } from '@/shared'
import { Badge, Button, Chip, Drawer, Icon, cx } from '@/ui/primitives'
import { VoiceClipPlayer } from '@/ui/components/audio'
import { usePreviewVoice } from '../usePreviewVoice'
import { SystemVoicePicker } from './SystemVoicePicker'

interface VoicePickerDialogProps {
    open: boolean
    currentVoice?: CharacterVoice | null
    onSelect: (voice: CharacterVoice | null) => void
    onClose: () => void
}

type Tab = 'presets' | 'system'

function voiceFromPreset(preset: VoicePreset): CharacterVoice {
    return {
        voice_id: preset.base_voice_id,
        speed: preset.speed,
        vol: preset.volume,
        pitch: preset.pitch,
        emotion: preset.emotion ?? undefined,
        language_boost: preset.language_boost ?? undefined,
        preset_id: preset.preset_id,
        preset_name: preset.name,
    }
}

/** A preset is the current voice if its preset linkage matches, or — when the
 * voice was stored without preset linkage — its base voice id matches. */
function presetMatchesVoice(preset: VoicePreset, voice?: CharacterVoice | null): boolean {
    if (!voice) return false
    return (!!voice.preset_id && voice.preset_id === preset.preset_id)
        || (!voice.preset_id && voice.voice_id === preset.base_voice_id)
}

export function VoicePickerDialog({ open, currentVoice, onSelect, onClose }: VoicePickerDialogProps) {
    const { t } = useTranslation()
    const [tab, setTab] = useState<Tab>('presets')
    const [presets, setPresets] = useState<VoicePreset[]>([])
    const [systemVoices, setSystemVoices] = useState<AdminVoiceEntry[]>([])
    const [loading, setLoading] = useState(false)
    const [previewId, setPreviewId] = useState<string | null>(null)
    const { src: previewSrc, previewing, runPreview } = usePreviewVoice()

    // Loading presets + system voices when the picker opens is a backend sync.
    useEffect(() => {
        if (!open) return
        /* eslint-disable react-hooks/set-state-in-effect */
        setLoading(true)
        Promise.all([
            apiService.listVoicePresets().catch(() => [] as VoicePreset[]),
            apiService.listSystemVoices().then((response) => response.groups.system ?? []).catch(() => [] as AdminVoiceEntry[]),
        ])
            .then(([presetList, voiceList]) => {
                setPresets(presetList)
                setSystemVoices(voiceList)
                // Land on the tab that actually holds the current voice so the
                // selection is visible on open (system voices have no preset).
                const onPreset = presetList.some((preset) => presetMatchesVoice(preset, currentVoice))
                setTab(onPreset || !currentVoice?.voice_id ? 'presets' : 'system')
            })
            .finally(() => setLoading(false))
        /* eslint-enable react-hooks/set-state-in-effect */
        // Depend on the voice's identity fields, not the object, so the picker
        // doesn't refetch on every parent re-render that recreates currentVoice.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, currentVoice?.voice_id, currentVoice?.preset_id])

    const choosePreset = (preset: VoicePreset) => {
        onSelect(voiceFromPreset(preset))
        onClose()
    }

    const chooseSystem = (voice: AdminVoiceEntry) => {
        onSelect({ voice_id: voice.voice_id })
        onClose()
    }

    const previewPreset = (preset: VoicePreset) => {
        setPreviewId(preset.preset_id)
        void runPreview({
            voice_id: preset.base_voice_id,
            text: '',
            speed: preset.speed,
            vol: preset.volume,
            pitch: preset.pitch,
            emotion: (preset.emotion || undefined) as AdminVoiceEmotion | undefined,
            language_boost: preset.language_boost ?? undefined,
        })
    }

    return (
        <Drawer
            open={open}
            onClose={onClose}
            size="lg"
            eyebrow={t('voices.picker.eyebrow')}
            icon={<Icon icon={AudioLines} size={18} className="text-ember-400" />}
            title={t('voices.picker.title')}
            footer={
                <Button variant="ghost" onClick={() => { onSelect(null); onClose() }}>
                    {t('voices.picker.clearVoice')}
                </Button>
            }
        >
            <div className="flex flex-col gap-4">
                {currentVoice?.voice_id && (
                    <div className="flex items-center gap-2 rounded-lg border border-ember-500/45 bg-ember-500/[.08] px-4 py-2.5">
                        <Icon icon={Check} size={16} className="shrink-0 text-ember-400" />
                        <div className="min-w-0">
                            <p className="font-ui text-[0.7rem] uppercase tracking-wide text-ember-300/80">{t('voices.picker.currentlyUsing')}</p>
                            <p className="truncate font-ui text-sm font-semibold text-parchment-50">{currentVoice.preset_name || currentVoice.voice_id}</p>
                        </div>
                    </div>
                )}

                <div className="flex gap-2" role="group" aria-label={t('voices.picker.sourceLabel')}>
                    <Chip active={tab === 'presets'} onClick={() => setTab('presets')}>
                        {t('voices.picker.myPresets')}
                    </Chip>
                    <Chip active={tab === 'system'} onClick={() => setTab('system')}>
                        {t('voices.picker.systemVoices')}
                    </Chip>
                </div>

                {tab === 'presets' ? (
                    presets.length > 0 ? (
                        <div className="flex flex-col gap-2">
                            {presets.map((preset) => {
                                const selected = presetMatchesVoice(preset, currentVoice)
                                return (
                                    <div
                                        key={preset.preset_id}
                                        className={cx(
                                            'flex flex-col gap-2 rounded-lg border px-4 py-3',
                                            selected ? 'border-ember-500/60 bg-parchment-50/[.05]' : 'border-parchment-50/[.08] bg-ink-800/70',
                                        )}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <p className="font-ui text-sm font-semibold text-parchment-50">{preset.name}</p>
                                                    {preset.is_global && <Badge tone="arcane">{t('voices.picker.defaultBadge')}</Badge>}
                                                </div>
                                                <p className="mt-1 font-mono text-xs text-parchment-400">{preset.base_voice_name || preset.base_voice_id}</p>
                                            </div>
                                            <div className="flex shrink-0 gap-2">
                                                <Button
                                                    variant="secondary"
                                                    size="sm"
                                                    iconLeft={<Icon icon={previewId === preset.preset_id && previewing ? Loader2 : Play} size={14} className={previewId === preset.preset_id && previewing ? 'animate-spin' : undefined} />}
                                                    onClick={() => previewPreset(preset)}
                                                >
                                                    {t('voices.picker.preview')}
                                                </Button>
                                                <Button
                                                    variant="primary"
                                                    size="sm"
                                                    iconLeft={selected ? <Icon icon={Check} size={14} /> : undefined}
                                                    onClick={() => choosePreset(preset)}
                                                >
                                                    {selected ? t('voices.systemPicker.selected') : t('voices.picker.use')}
                                                </Button>
                                            </div>
                                        </div>
                                        {previewId === preset.preset_id && previewSrc && <VoiceClipPlayer src={previewSrc} title={t('voices.picker.previewTitle', { name: preset.name })} />}
                                    </div>
                                )
                            })}
                        </div>
                    ) : (
                        <p className="rounded-lg border border-parchment-50/[.08] bg-ink-800/70 px-4 py-3 font-ui text-sm text-parchment-300">
                            {loading ? t('voices.picker.loadingPresets') : t('voices.picker.noPresets')}
                        </p>
                    )
                ) : (
                    <SystemVoicePicker voices={systemVoices} loading={loading} selectedVoiceId={currentVoice?.voice_id} onSelect={chooseSystem} />
                )}
            </div>
        </Drawer>
    )
}
