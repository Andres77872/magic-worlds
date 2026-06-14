import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { AudioLines, Copy, Loader2, Pencil, Play, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { useAuth } from '@/app/hooks'
import { apiService } from '@/infrastructure/api'
import type { AdminVoiceEmotion, AdminVoiceEntry, VoicePreset } from '@/shared'
import { Badge, Button, Card, Icon, IconButton, IconTile, PageHeader, Toast } from '@/ui/primitives'
import { VoiceClipPlayer } from '@/ui/components/audio'
import { ConfirmDialog } from '@/ui/components/ConfirmDialog'
import { EmptyState } from '@/ui/components/common/EmptyState'
import { usePreviewVoice } from '../usePreviewVoice'
import { PresetEditor, type PresetEditorMode } from './PresetEditor'

interface StudioToast {
    tone: 'success' | 'error'
    title: string
    message?: string
}

function recipeChips(preset: VoicePreset, t: TFunction): string[] {
    const chips: string[] = []
    if (preset.speed && preset.speed !== 1) chips.push(t('voices.studio.chipSpeed', { value: preset.speed.toFixed(2).replace(/0$/, '') }))
    if (preset.volume && preset.volume !== 1) chips.push(t('voices.studio.chipVolume', { value: preset.volume.toFixed(2).replace(/0$/, '') }))
    if (preset.pitch) chips.push(t('voices.studio.chipPitch', { value: `${preset.pitch > 0 ? '+' : ''}${preset.pitch}` }))
    if (preset.emotion) chips.push(preset.emotion)
    if (preset.language_boost && preset.language_boost !== 'auto') chips.push(preset.language_boost)
    return chips
}

export function VoiceStudioPage() {
    const { t } = useTranslation()
    const { isAuthenticated, openLoginModal } = useAuth()
    const [presets, setPresets] = useState<VoicePreset[]>([])
    const [systemVoices, setSystemVoices] = useState<AdminVoiceEntry[]>([])
    const [loading, setLoading] = useState(false)
    const [loadingVoices, setLoadingVoices] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [toast, setToast] = useState<StudioToast | null>(null)
    const [editor, setEditor] = useState<{ open: boolean; mode: PresetEditorMode; source: VoicePreset | null }>({
        open: false,
        mode: 'create',
        source: null,
    })
    const [pendingDelete, setPendingDelete] = useState<VoicePreset | null>(null)
    const [deletingId, setDeletingId] = useState<string | null>(null)
    const [previewId, setPreviewId] = useState<string | null>(null)
    const { src: previewSrc, previewing, runPreview } = usePreviewVoice()

    const refresh = async () => {
        if (!isAuthenticated) return
        setLoading(true)
        setError(null)
        try {
            setPresets(await apiService.listVoicePresets())
        } catch (err) {
            setError(err instanceof Error ? err.message : t('voices.studio.loadError'))
        } finally {
            setLoading(false)
        }
    }

    // Load presets + the system voice catalog on mount — a backend sync.
    useEffect(() => {
        if (!isAuthenticated) return
        /* eslint-disable react-hooks/set-state-in-effect */
        void refresh()
        setLoadingVoices(true)
        apiService
            .listSystemVoices()
            .then((response) => setSystemVoices(response.groups.system ?? []))
            .catch(() => setSystemVoices([]))
            .finally(() => setLoadingVoices(false))
        /* eslint-enable react-hooks/set-state-in-effect */
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAuthenticated])

    const preview = (preset: VoicePreset) => {
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

    const confirmDelete = async () => {
        const target = pendingDelete
        setPendingDelete(null)
        if (!target) return
        setDeletingId(target.preset_id)
        try {
            await apiService.deleteVoicePreset(target.preset_id)
            setPresets((current) => current.filter((preset) => preset.preset_id !== target.preset_id))
            setToast({ tone: 'success', title: t('voices.studio.toastDeleted'), message: target.name })
        } catch (err) {
            const message = err instanceof Error ? err.message : t('voices.studio.deleteError')
            setError(message)
            setToast({ tone: 'error', title: t('voices.studio.toastDeleteFailed'), message })
        } finally {
            setDeletingId(null)
        }
    }

    if (!isAuthenticated) {
        return (
            <div className="mx-auto flex w-full max-w-[960px] px-5 py-10 sm:px-8">
                <EmptyState
                    icon={<Icon icon={AudioLines} size={44} />}
                    message={t('voices.studio.signInMessage')}
                    secondaryText={t('voices.studio.signInHelper')}
                    button={{ label: t('voices.studio.login'), onClick: openLoginModal }}
                />
            </div>
        )
    }

    return (
        <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-6 px-5 py-8 sm:px-8 sm:py-10">
            <PageHeader
                eyebrow={t('voices.studio.eyebrow')}
                eyebrowTone="ember"
                icon={<IconTile icon={AudioLines} tone="ember" />}
                title={t('voices.studio.title')}
                subtitle={t('voices.studio.subtitle')}
                size="lg"
                actions={
                    <div className="flex gap-2">
                        <Button
                            kind="secondary"
                            size="sm"
                            iconLeft={<Icon icon={RefreshCw} size={15} className={loading ? 'animate-spin' : undefined} />}
                            onClick={() => void refresh()}
                            disabled={loading}
                        >
                            {t('voices.studio.refresh')}
                        </Button>
                        <Button
                            kind="primary"
                            size="sm"
                            iconLeft={<Icon icon={Plus} size={15} />}
                            onClick={() => setEditor({ open: true, mode: 'create', source: null })}
                        >
                            {t('voices.studio.newPreset')}
                        </Button>
                    </div>
                }
                divider
            />

            {error && (
                <div className="flex items-center justify-between gap-4 rounded-lg border border-blood-500/30 bg-blood-500/10 px-4 py-3 font-ui text-sm text-parchment-200" role="alert">
                    <span>{error}</span>
                    <Button kind="secondary" size="sm" onClick={() => setError(null)}>
                        {t('voices.studio.dismiss')}
                    </Button>
                </div>
            )}

            {presets.length === 0 && !loading ? (
                <EmptyState
                    icon={<Icon icon={AudioLines} size={40} />}
                    message={t('voices.studio.emptyMessage')}
                    secondaryText={t('voices.studio.emptyHelper')}
                    button={{ label: t('voices.studio.newPreset'), onClick: () => setEditor({ open: true, mode: 'create', source: null }) }}
                />
            ) : (
                <div className="flex flex-col gap-3">
                    {presets.map((preset) => {
                        const chips = recipeChips(preset, t)
                        return (
                            <Card key={preset.preset_id}>
                                <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <p className="font-ui text-sm font-semibold text-parchment-50">{preset.name}</p>
                                            {preset.is_global && <Badge tone="arcane">{t('voices.studio.defaultBadge')}</Badge>}
                                        </div>
                                        <p className="mt-1 font-ui text-xs text-parchment-400">
                                            {preset.base_voice_name || preset.base_voice_id}
                                        </p>
                                        {preset.description && <p className="mt-1 font-ui text-sm text-parchment-300">{preset.description}</p>}
                                        {chips.length > 0 && (
                                            <div className="mt-2 flex flex-wrap gap-1.5">
                                                {chips.map((chip) => (
                                                    <Badge key={chip} tone="glass">
                                                        {chip}
                                                    </Badge>
                                                ))}
                                            </div>
                                        )}
                                        {previewId === preset.preset_id && previewSrc && (
                                            <div className="mt-3">
                                                <VoiceClipPlayer src={previewSrc} title={t('voices.studio.previewTitle', { name: preset.name })} />
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex shrink-0 flex-wrap justify-end gap-2">
                                        <Button
                                            kind="secondary"
                                            size="sm"
                                            iconLeft={
                                                <Icon
                                                    icon={previewId === preset.preset_id && previewing ? Loader2 : Play}
                                                    size={14}
                                                    className={previewId === preset.preset_id && previewing ? 'animate-spin' : undefined}
                                                />
                                            }
                                            onClick={() => preview(preset)}
                                        >
                                            {t('voices.studio.preview')}
                                        </Button>
                                        <IconButton
                                            label={t('voices.studio.duplicateLabel', { name: preset.name })}
                                            size="sm"
                                            onClick={() => setEditor({ open: true, mode: 'create', source: preset })}
                                        >
                                            <Icon icon={Copy} size={15} />
                                        </IconButton>
                                        {!preset.is_global && (
                                            <>
                                                <IconButton label={t('voices.studio.editLabel', { name: preset.name })} size="sm" onClick={() => setEditor({ open: true, mode: 'edit', source: preset })}>
                                                    <Icon icon={Pencil} size={15} />
                                                </IconButton>
                                                <IconButton
                                                    label={t('voices.studio.deleteLabel', { name: preset.name })}
                                                    size="sm"
                                                    tone="danger"
                                                    disabled={deletingId === preset.preset_id}
                                                    onClick={() => setPendingDelete(preset)}
                                                >
                                                    <Icon icon={deletingId === preset.preset_id ? Loader2 : Trash2} size={15} className={deletingId === preset.preset_id ? 'animate-spin' : undefined} />
                                                </IconButton>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </Card>
                        )
                    })}
                </div>
            )}

            <PresetEditor
                open={editor.open}
                mode={editor.mode}
                source={editor.source}
                systemVoices={systemVoices}
                loadingVoices={loadingVoices}
                onClose={() => setEditor((current) => ({ ...current, open: false }))}
                onSaved={() => void refresh()}
                notify={setToast}
            />

            <ConfirmDialog
                visible={pendingDelete !== null}
                title={t('voices.studio.deleteTitle')}
                message={pendingDelete ? t('voices.studio.deleteMessage', { name: pendingDelete.name }) : ''}
                confirmLabel={t('voices.studio.delete')}
                variant="danger"
                onConfirm={() => void confirmDelete()}
                onCancel={() => setPendingDelete(null)}
            />

            {toast && <Toast open tone={toast.tone} title={toast.title} message={toast.message} onClose={() => setToast(null)} autoCloseMs={3500} />}
        </div>
    )
}
