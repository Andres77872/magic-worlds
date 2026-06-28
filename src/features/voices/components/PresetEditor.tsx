import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AudioLines, Loader2, Play, WandSparkles } from 'lucide-react'
import { apiService } from '@/infrastructure/api'
import type { AdminVoiceEmotion, AdminVoiceEntry, VoicePreset } from '@/shared'
import { Button, Drawer, Field, Icon, Input, Textarea } from '@/ui/primitives'
import { VoiceClipPlayer } from '@/ui/components/audio'
import { usePreviewVoice } from '../usePreviewVoice'
import { DEFAULT_RECIPE, type PresetRecipe } from '../recipe'
import { PresetRecipeControls } from './PresetRecipeControls'
import { SystemVoicePicker } from './SystemVoicePicker'

export type PresetEditorMode = 'create' | 'edit'

interface PresetEditorProps {
    open: boolean
    mode: PresetEditorMode
    /** Edit target, or the preset being duplicated (create mode), or null for a blank create. */
    source: VoicePreset | null
    systemVoices: AdminVoiceEntry[]
    loadingVoices: boolean
    onClose: () => void
    onSaved: () => void
    notify: (toast: { tone: 'success' | 'error'; title: string; message?: string }) => void
}

interface BaseVoice {
    voice_id: string
    voice_name: string | null
}

export function PresetEditor({ open, mode, source, systemVoices, loadingVoices, onClose, onSaved, notify }: PresetEditorProps) {
    const { t } = useTranslation()
    const [name, setName] = useState('')
    const [description, setDescription] = useState('')
    const [baseVoice, setBaseVoice] = useState<BaseVoice | null>(null)
    const [recipe, setRecipe] = useState<PresetRecipe>(DEFAULT_RECIPE)
    const [previewText, setPreviewText] = useState('')
    const [pickerOpen, setPickerOpen] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const { src, previewing, error: previewError, runPreview, DEFAULT_PREVIEW_TEXT } = usePreviewVoice()

    // Re-seed the form state each time the drawer opens (syncing to the opened
    // source preset) — a legitimate prop->state sync, not a render-derivable value.
    useEffect(() => {
        if (!open) return
        /* eslint-disable react-hooks/set-state-in-effect */
        if (source) {
            setName(mode === 'create' ? t('voices.editor.copyName', { name: source.name }) : source.name)
            setDescription(source.description ?? '')
            setBaseVoice({ voice_id: source.base_voice_id, voice_name: source.base_voice_name ?? null })
            setRecipe({
                speed: source.speed ?? 1,
                volume: source.volume ?? 1,
                pitch: source.pitch ?? 0,
                emotion: source.emotion ?? '',
                language_boost: source.language_boost ?? 'auto',
            })
            setPickerOpen(false)
        } else {
            setName('')
            setDescription('')
            setBaseVoice(null)
            setRecipe(DEFAULT_RECIPE)
            setPickerOpen(true)
        }
        setError(null)
        setPreviewText('')
        /* eslint-enable react-hooks/set-state-in-effect */
    }, [open, mode, source, t])

    const canSave = name.trim().length > 0 && !!baseVoice?.voice_id && !saving

    const handlePreview = () => {
        if (!baseVoice?.voice_id) return
        void runPreview({
            voice_id: baseVoice.voice_id,
            text: previewText,
            speed: recipe.speed,
            vol: recipe.volume,
            pitch: recipe.pitch,
            emotion: (recipe.emotion || undefined) as AdminVoiceEmotion | undefined,
            language_boost: recipe.language_boost,
        })
    }

    const handleSave = async () => {
        if (!canSave || !baseVoice) return
        setSaving(true)
        setError(null)
        const payload = {
            name: name.trim(),
            description: description.trim() || null,
            base_voice_id: baseVoice.voice_id,
            base_voice_name: baseVoice.voice_name,
            speed: recipe.speed,
            volume: recipe.volume,
            pitch: recipe.pitch,
            emotion: (recipe.emotion || null) as AdminVoiceEmotion | null,
            language_boost: recipe.language_boost,
        }
        try {
            if (mode === 'edit' && source) {
                await apiService.updateVoicePreset(source.preset_id, payload)
                notify({ tone: 'success', title: t('voices.editor.toastUpdated'), message: payload.name })
            } else {
                await apiService.createVoicePreset(payload)
                notify({ tone: 'success', title: t('voices.editor.toastCreated'), message: payload.name })
            }
            onSaved()
            onClose()
        } catch (err) {
            const message = err instanceof Error ? err.message : t('voices.editor.saveError')
            setError(message)
            notify({ tone: 'error', title: t('voices.editor.toastSaveFailed'), message })
        } finally {
            setSaving(false)
        }
    }

    return (
        <Drawer
            open={open}
            onClose={onClose}
            size="lg"
            eyebrow={t('voices.editor.eyebrow')}
            icon={<Icon icon={AudioLines} size={18} className="text-ember-400" />}
            title={mode === 'edit' ? t('voices.editor.editTitle') : t('voices.editor.newTitle')}
            footer={
                <>
                    <Button variant="ghost" onClick={onClose}>
                        {t('common.cancel')}
                    </Button>
                    <Button
                        variant="primary"
                        onClick={() => void handleSave()}
                        disabled={!canSave}
                        iconLeft={<Icon icon={saving ? Loader2 : WandSparkles} size={15} className={saving ? 'animate-spin' : undefined} />}
                    >
                        {mode === 'edit' ? t('voices.editor.saveChanges') : t('voices.editor.createPreset')}
                    </Button>
                </>
            }
        >
            <div className="flex flex-col gap-5">
                {error && <p className="rounded-md border border-blood-500/30 bg-blood-500/10 px-3 py-2 font-ui text-sm text-parchment-200">{error}</p>}

                <Field label={t('voices.editor.nameLabel')}>
                    <Input value={name} onChange={(event) => setName(event.target.value)} placeholder={t('voices.editor.namePlaceholder')} />
                </Field>
                <Field label={t('voices.editor.descriptionLabel')} helper={t('voices.editor.descriptionHelper')}>
                    <Textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder={t('voices.editor.descriptionPlaceholder')} />
                </Field>

                <Field label={t('voices.editor.baseVoiceLabel')} helper={t('voices.editor.baseVoiceHelper')}>
                    {baseVoice && !pickerOpen ? (
                        <div className="flex items-center justify-between gap-3 rounded-lg border border-parchment-50/[.08] bg-ink-800/70 px-4 py-3">
                            <div className="min-w-0">
                                <p className="font-ui text-sm font-semibold text-parchment-50">{baseVoice.voice_name || baseVoice.voice_id}</p>
                                <code className="font-mono text-xs text-parchment-400">{baseVoice.voice_id}</code>
                            </div>
                            <Button variant="secondary" size="sm" onClick={() => setPickerOpen(true)}>
                                {t('voices.editor.change')}
                            </Button>
                        </div>
                    ) : (
                        <SystemVoicePicker
                            voices={systemVoices}
                            loading={loadingVoices}
                            selectedVoiceId={baseVoice?.voice_id}
                            onSelect={(voice) => {
                                setBaseVoice({ voice_id: voice.voice_id, voice_name: voice.voice_name ?? null })
                                setPickerOpen(false)
                            }}
                        />
                    )}
                </Field>

                <PresetRecipeControls recipe={recipe} onChange={(patch) => setRecipe((current) => ({ ...current, ...patch }))} />

                <div className="flex flex-col gap-3 rounded-lg border border-parchment-50/[.08] bg-ink-800/40 p-4">
                    <Field label={t('voices.editor.previewLineLabel')}>
                        <Textarea value={previewText} onChange={(event) => setPreviewText(event.target.value)} placeholder={DEFAULT_PREVIEW_TEXT} />
                    </Field>
                    <div className="flex items-center justify-between gap-3">
                        <Button
                            variant="secondary"
                            size="sm"
                            disabled={!baseVoice?.voice_id || previewing}
                            iconLeft={<Icon icon={previewing ? Loader2 : Play} size={14} className={previewing ? 'animate-spin' : undefined} />}
                            onClick={handlePreview}
                        >
                            {t('voices.editor.previewVoice')}
                        </Button>
                        {previewError && <span className="font-ui text-xs text-blood-500">{previewError}</span>}
                    </div>
                    {src && <VoiceClipPlayer src={src} title={t('voices.editor.previewTitle')} />}
                </div>
            </div>
        </Drawer>
    )
}
