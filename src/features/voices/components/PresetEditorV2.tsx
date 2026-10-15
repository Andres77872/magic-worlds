/**
 * The ElevenLabs preset editor (R1-FE-02, D12, D13, D18; 05 §5, 09 §4).
 *
 * - Name (required, at most 255) and description.
 * - Base voice: a catalog voice, chosen in the inline catalog picker. Its
 *   language is shown read-only (no language select, D13; AC-E4): "Primary
 *   language: {language} · {accent}" with labels (an accent without a label is
 *   left out), the language-scope note and the story-language note. Its badges add
 *   `not_tested_language` when the preset's language (its `language_code`, else
 *   the preferred language) has no accepted row (05 §5.5), and the 05 §7.8
 *   owner prompts: "Switch to {replacement}" swaps the draft's voice and keeps
 *   its settings and emotion; "Choose a voice" / "Pick another" open the picker.
 * - Recipe: stability, similarity and speed from the preview surface of the
 *   chosen tier, and an emotion (hidden where the surface has none). On
 *   Expressive the emotion options say what they add (05 §5.3) and the speed
 *   note links back to the Standard controls (05 §5.1). Each tier shows its
 *   thought-delivery note (D16). "Use voice defaults" stores no settings.
 *   A stored value outside the write ranges is shown clamped and flagged
 *   with what the save stores (AC-E2); only the save clamps it.
 * - Preview: with no settings and no emotion the ▶ plays the voice's free
 *   catalog sample (the one the BFF would serve, `previewSampleUrl`); otherwise,
 *   or when the voice has none, it renders a metered V2 preview (EP-6). Language
 *   chips offer the voice's other accepted language; the default is the
 *   preset's `language_code`, then the voice's primary language, then the
 *   preferred language, among the accepted ones (05 §5.5, D17).
 *   Past the free renders (AC-P5, 05 §6.3) the button reads "Preview voice ·
 *   1 credit" and the account's first paid render of the session asks once. The fixed
 *   text carries its language (`lang`, 05 §10).
 * - Save sends the V2 body (EP-3): create and duplicate POST; edit PUTs to
 *   the row's own `preset_id`. A refused write
 *   (`voice_not_eligible`, `voice_plan_locked`, …) shows inline and keeps the draft.
 *   A 422 refusing the voice itself also shows at the base-voice field, wired
 *   to it with `aria-describedby`, until another voice is chosen (AC-E6,
 *   05 §7.4; `voiceFieldErrorKey`, as in the character editor).
 * - Preview errors carry their 05 §6.4 action: "Not enough credits" links to
 *   the membership page (in a new tab, so the draft survives); a 409
 *   `voice_unavailable` offers "Pick another voice", which opens the picker.
 * - The drawer title names the preset, and closing it (Cancel, ×, Escape, the
 *   scrim) with unsaved changes asks before discarding them (05 §10 Modals).
 */
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AudioLines, Headphones, Loader2, PenLine, Play, SlidersHorizontal, Square, WandSparkles } from 'lucide-react'
import { apiService } from '@/infrastructure/api'
import { VoiceClipPlayer } from '@/ui/components/audio'
import type {
    CatalogVoice,
    NarrationTier,
    PreviewTextId,
    VoiceCapabilities,
    VoiceControlSpec,
    VoiceEmotion,
    VoicePreset,
    VoicePresetV2Write,
    VoiceSettingsV2,
    VoicePerformance,
} from '@/shared'
import { surfaceCapabilitiesFor } from '@/shared/voice'
import { ConfirmDialog } from '@/ui/components/ConfirmDialog'
import { Avatar, Button, Callout, Chip, Drawer, Field, Icon, Input, SectionHeader, Select, Textarea, type SelectOption } from '@/ui/primitives'
import { useCatalogLookup } from '../hooks/useCatalogLookup'
import { usePreferredLanguage } from '../hooks/usePreferredLanguage'
import {
    accentKey,
    baseVoiceBadges,
    catalogAccent,
    draftChanged,
    editorTitle,
    emotionEffectLabel,
    emotionLabel,
    editorSeed,
    EMPTY_SEED,
    isDefaultRecipe,
    isVoiceEmotion,
    presetLanguage,
    previewableLanguages,
    previewSampleUrl,
    studioPreviewLanguage,
    VOICE_EMOTIONS,
    type PresetEditorSeed,
    type PresetEditorV2Mode,
} from '../presetRowsV2'
import { normalizeSettingsForWrite } from '../recipeV2'
import { useCatalogSample } from '../useCatalogSample'
import { usePreviewLanguage, usePreviewTexts } from '../usePreviewTexts'
import { clipTranscript, useRecipePreview } from '../useRecipePreview'
import { usePreviewCreditConfirm } from '../usePreviewCreditConfirm'
import { voiceFieldErrorKey } from '../voiceFieldError'
import { voiceWriteErrorMessage } from '../voiceWriteError'
import { CatalogVoicePicker } from './CatalogVoicePicker'
import { PreviewAllowanceHint, PreviewProblemNotice } from './PreviewAllowanceHint'
import { PreviewCreditDialog } from './PreviewCreditDialog'
import { PreviewTextChooser } from './PreviewTextChooser'
import { PreviewTranscript, RecipePreviewPlayer } from './RecipePreviewPlayer'
import { RecipeControlsV2 } from './RecipeControlsV2'
import { TierToggle, defaultPreviewTier } from './TierToggle'
import { VoiceBadges, languageLabel } from './VoiceBadges'
import { VoiceOwnerPrompts, type VoiceReplacement } from './VoiceOwnerPrompts'
import { VoicePerformancePanel } from './VoicePerformancePanel'

export const PRESET_NAME_LIMIT = 255
export const PRESET_DESCRIPTION_LIMIT = 2_000

export interface PresetEditorV2Toast {
    tone: 'success' | 'error'
    title: string
    message?: string
}

interface PresetEditorV2Props {
    open: boolean
    mode: PresetEditorV2Mode
    /** The edited or duplicated row; null for a blank preset. */
    source: VoicePreset | null
    /** A catalogue selection starts a new settings draft on this distinct voice. */
    initialVoice?: CatalogVoice
    capabilities: VoiceCapabilities | null
    /** Re-read the capabilities when they failed (the recipe shows read-only). */
    onRetryCapabilities?: () => void
    /** Open on the voice picker (a "Choose a voice" / "Pick another" prompt on the Studio card). */
    pickVoiceOnOpen?: boolean
    /** The signed-in account: the one-time credit confirmation is remembered per account (05 §6.3). */
    userHash?: string | null
    onClose: () => void
    onSaved: (row: VoicePreset | null) => void
    notify: (toast: PresetEditorV2Toast) => void
}

/** The write controls: the Standard surface's ranges first (it carries speed), then the tier's own. */
function writeControls(capabilities: VoiceCapabilities | null, tier: NarrationTier): VoiceControlSpec[] {
    return [
        ...(surfaceCapabilitiesFor(capabilities, 'preview', 'standard')?.controls ?? []),
        ...(surfaceCapabilitiesFor(capabilities, 'preview', tier)?.controls ?? []),
    ]
}

const EMOTION_NONE = ''

export function PresetEditorV2({ open, mode, source, initialVoice, capabilities, onRetryCapabilities, pickVoiceOnOpen = false, userHash = null, onClose, onSaved, notify }: PresetEditorV2Props) {
    const { t, i18n } = useTranslation()
    const [name, setName] = useState('')
    const [description, setDescription] = useState('')
    const [voiceKey, setVoiceKey] = useState<string | null>(null)
    const [voiceName, setVoiceName] = useState<string | null>(null)
    const [picked, setPicked] = useState<CatalogVoice | null>(null)
    const [settings, setSettings] = useState<VoiceSettingsV2 | null>(null)
    const providerDrafts = useRef<Partial<Record<'elevenlabs' | 'fish_audio', VoiceSettingsV2 | null>>>({})
    const [emotion, setEmotion] = useState<VoiceEmotion | null>(null)
    const [performance, setPerformance] = useState<VoicePerformance | null>(null)
    const [tier, setTier] = useState<NarrationTier>(() => defaultPreviewTier(capabilities))
    const [textId, setTextId] = useState<PreviewTextId>('narration')
    /** A preview language chip the user chose; null follows the default (05 §5.5). */
    const [chosenLanguage, setChosenLanguage] = useState<string | null>(null)
    const [pickerOpen, setPickerOpen] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)
    /** A save refused for the voice itself (05 §7.4): the copy key and the voice it refused. */
    const [voiceFieldError, setVoiceFieldError] = useState<{ key: string; voiceKey: string | null } | null>(null)
    const voiceFieldErrorId = useId()
    const baseVoiceRef = useRef<HTMLElement>(null)
    /** What the drawer opened with: closing with other values asks first (05 §10). */
    const [seed, setSeed] = useState<PresetEditorSeed>(EMPTY_SEED)
    const [confirmDiscard, setConfirmDiscard] = useState(false)

    const preview = useRecipePreview({ enabled: open })
    const credit = usePreviewCreditConfirm(userHash)
    const sample = useCatalogSample()
    const resetPreview = preview.reset
    const stopSample = sample.stop

    // Re-seed the form each time the drawer opens (a prop → state sync on open).
    useEffect(() => {
        /* eslint-disable react-hooks/set-state-in-effect */
        resetPreview()
        stopSample()
        setConfirmDiscard(false)
        if (!open) return
        const selected = mode === 'create' ? initialVoice : undefined
        const next = selected ? { ...editorSeed(mode, source, t), name: selected.display_name,
            voiceKey: selected.voice_key, voiceName: selected.display_name } : editorSeed(mode, source, t)
        setSeed(next)
        setName(next.name)
        setDescription(next.description)
        setVoiceKey(next.voiceKey)
        setVoiceName(next.voiceName)
        providerDrafts.current = {}
        setPicked(selected ?? null)
        setSettings(next.settings)
        setEmotion(next.emotion)
        setPerformance(source?.provider === 'fish_audio' ? source.performance ?? null : null)
        setPickerOpen(!next.voiceKey || pickVoiceOnOpen)
        setTier(defaultPreviewTier(capabilities))
        setTextId('narration')
        setChosenLanguage(null)
        setError(null)
        setVoiceFieldError(null)
        /* eslint-enable react-hooks/set-state-in-effect */
        // Capabilities only seed the tier on open; a later read never resets the draft.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, mode, source, initialVoice, t, resetPreview, stopSample])

    const lookupKeys = useMemo(() => (voiceKey && picked?.voice_key !== voiceKey ? [voiceKey] : []), [voiceKey, picked])
    const lookup = useCatalogLookup(lookupKeys, open)
    const item = voiceKey ? (picked?.voice_key === voiceKey ? picked : lookup.get(voiceKey) ?? null) : null

    const provider = item ? (item.provider ?? 'elevenlabs') : source?.provider ?? 'elevenlabs'
    const surface = surfaceCapabilitiesFor(capabilities, 'preview', tier, provider)
    const controls = provider === 'fish_audio' ? [] : writeControls(capabilities, tier)
    const recipeAvailable = provider === 'elevenlabs' || (surface?.healthy === true && (!settings || Object.keys(settings).length === 0))
    const emotionVisible = provider === 'fish_audio' ? surface?.healthy === true && surface.supports_emotion : surface ? surface.supports_emotion : true

    const preferred = usePreferredLanguage(open)
    const appLanguage = usePreviewLanguage()
    // Chips offer the voice's accepted languages only; the default follows D17 (05 §5.5).
    const previewLanguages = previewableLanguages(item)
    const defaultLanguage = studioPreviewLanguage(item, {
        languageCode: source?.language_code ?? null,
        preferredLanguage: preferred.language,
        fallback: appLanguage,
    })
    const language = chosenLanguage && previewLanguages.includes(chosenLanguage) ? chosenLanguage : defaultLanguage
    const checkedLanguage = source ? presetLanguage(source, preferred.language) : language
    const previewTexts = usePreviewTexts(language, open)
    const fixedText = previewTexts.texts[textId]
    const clipText = preview.clip ? clipTranscript(preview.clip, fixedText) : fixedText
    // D18, EP-6: an untuned voice auditions the sample the BFF's default-settings shortcut
    // would serve (`isFreeSamplePreview`, the rule the Studio card shares); else a metered render.
    const sampleUrl = previewSampleUrl(item, language, tier)
    const useSample = !(provider === 'fish_audio' && performance) && isDefaultRecipe(settings, emotion) && sampleUrl !== null
    const playing = useSample ? sample.loading : preview.loading

    const nameOverLimit = name.trim().length > PRESET_NAME_LIMIT
    const descriptionOverLimit = description.length > PRESET_DESCRIPTION_LIMIT
    const canSave = name.trim().length > 0 && Boolean(voiceKey) && !nameOverLimit && !descriptionOverLimit && !saving && recipeAvailable
    const dirty = draftChanged(seed, { name, description, voiceKey, settings, emotion }) || JSON.stringify(performance) !== JSON.stringify(source?.provider === 'fish_audio' ? source.performance ?? null : null)
    // AC-P5: a metered render past the free ones costs 1 credit (a free sample never does).
    const costsCredit = !useSample && preview.nextCostsCredit

    /** Cancel, ×, Escape and the scrim: ask before dropping unsaved changes (05 §10 Modals). */
    const requestClose = () => {
        if (saving) return
        if (dirty) {
            setConfirmDiscard(true)
            return
        }
        onClose()
    }

    const discardChanges = () => {
        setConfirmDiscard(false)
        onClose()
    }

    const dropClips = () => {
        preview.reset()
        sample.stop()
    }

    const chooseVoice = (next: CatalogVoice) => {
        if ((next.provider ?? 'elevenlabs') !== provider) {
            providerDrafts.current[provider] = settings
            setSettings(providerDrafts.current[next.provider ?? 'elevenlabs'] ?? null)
            setTier('standard')
        }
        setPicked(next)
        setVoiceKey(next.voice_key)
        setVoiceName(next.display_name)
        // A blank draft starts named after its voice, as one opened from the catalog does.
        if (!name.trim()) setName(next.display_name)
        setPickerOpen(false)
        setChosenLanguage(null)
        dropClips()
    }

    // 05 §7.8: the replacement of a leaving voice, keeping the draft's settings and emotion.
    const switchToReplacement = (replacement: VoiceReplacement) => {
        setPicked(null)
        setVoiceKey(replacement.voice_key)
        setVoiceName(replacement.display_name)
        setChosenLanguage(null)
        dropClips()
    }

    const choosePreviewLanguage = (next: string) => {
        setChosenLanguage(next)
        dropClips()
    }

    const changeSettings = (next: VoiceSettingsV2 | null) => {
        setSettings(next)
        dropClips()
    }

    const changeEmotion = (value: string) => {
        setEmotion(isVoiceEmotion(value) ? value : null)
        dropClips()
    }

    const changeTier = (next: NarrationTier) => {
        setTier(next)
        dropClips()
    }

    const chooseText = (next: PreviewTextId) => {
        setTextId(next)
        dropClips()
    }

    const handlePreview = () => {
        if (!voiceKey || !recipeAvailable) return
        if (useSample && sampleUrl) {
            if (sample.loading) {
                sample.stop()
                return
            }
            preview.reset()
            void sample.play(sampleUrl, null)
            return
        }
        if (preview.loading) {
            preview.stop()
            return
        }
        if (preview.limitReached) return
        const input = {
            provider,
            ...(provider === 'fish_audio' && performance ? { performance } : {}),
            voiceKey,
            settings: provider === 'fish_audio' ? null : normalizeSettingsForWrite(settings, controls),
            emotion,
            textId,
            language: previewTexts.language,
            tier,
        }
        // The first paid render of the session is confirmed once (05 §6.3).
        credit.guard(costsCredit, () => {
            sample.stop()
            void preview.run(input)
        })
    }

    const handleSave = async () => {
        if (!canSave || !voiceKey) return
        setSaving(true)
        setError(null)
        setVoiceFieldError(null)
        const write: VoicePresetV2Write = {
            ...(provider === 'fish_audio' ? { schema_version: 3 as const, provider: 'fish_audio' as const } : {}),
            ...(provider === 'fish_audio' && (performance || (source?.provider === 'fish_audio' && source.performance)) ? { performance } : {}),
            name: name.trim(),
            description: description.trim() || null,
            voice_key: voiceKey,
            settings: provider === 'fish_audio' ? null : normalizeSettingsForWrite(settings, controls),
            emotion,
        }
        try {
            // An edit keeps the row's own id; create and duplicate make a new row.
            const row = mode === 'edit' && source
                ? await apiService.updateVoicePreset(source.preset_id, write)
                : await apiService.createVoicePreset(write)
            notify({ tone: 'success', title: t('voices.studio.v2.saved'), message: write.name })
            onSaved(row ?? null)
            onClose()
        } catch (failure) {
            // The draft stays as typed; the refusal explains what to change.
            setError(voiceWriteErrorMessage(failure, t) ?? t('voices.studio.v2.saveFailed'))
            // AC-E6 / 05 §7.4: a refused voice also shows at the base-voice field.
            const fieldKey = voiceFieldErrorKey(failure)
            if (fieldKey) setVoiceFieldError({ key: fieldKey, voiceKey: write.voice_key })
        } finally {
            setSaving(false)
        }
    }

    // On Expressive each option says what it adds (05 §5.3); on Standard the plain names carry the "subtle" hint.
    const emotionOptions: SelectOption[] = [
        { value: EMOTION_NONE, label: t('voices.recipe.emotionNone') },
        ...VOICE_EMOTIONS.map((value) => ({ value, label: tier === 'expressive' ? emotionEffectLabel(value, t) : emotionLabel(value, t) })),
    ]
    const baseBadges = item ? baseVoiceBadges(item, checkedLanguage) : []

    // AC-E4: labels, never raw slugs; an accent without a label is left out (the accent taxonomy is deferred).
    const primaryLanguage = item ? languageLabel(item.primary_language, i18n.language) : ''
    const accent = item ? accentKey(catalogAccent(item)) : null
    const languageLine = accent && i18n.exists(accent)
        ? t('voices.recipe.languageLabel', { language: primaryLanguage, accent: t(accent) })
        : t('voices.recipe.languageLabelNoAccent', { language: primaryLanguage })

    const title = editorTitle(mode, source, t)
    // Shown until another voice is chosen (the character editor's rule).
    const voiceFieldErrorShown = voiceFieldError && voiceFieldError.voiceKey === voiceKey ? voiceFieldError.key : null

    /** 05 §6.4 "Pick another voice": open the picker and bring the base-voice field into view. */
    const pickAnotherVoice = () => {
        setPickerOpen(true)
        baseVoiceRef.current?.scrollIntoView?.({ block: 'nearest' })
        baseVoiceRef.current?.focus({ preventScroll: true })
    }

    return (
        <>
        {/*
          The dialogs come before the drawer: when "Discard changes" closes both at once, the
          drawer's layer cleanup runs last and returns focus to what opened it (05 §10). Each
          Modal portals to <body> only when it opens, so it still paints above the drawer.
        */}
        <PreviewCreditDialog confirm={credit} />
        <ConfirmDialog
            visible={open && confirmDiscard}
            title={t('voices.studio.v2.discardTitle')}
            message={mode === 'create' || !source
                ? t('voices.studio.v2.discardMessageNew')
                : t('voices.studio.v2.discardMessage', { name: seed.name || source.name })}
            confirmLabel={t('voices.studio.v2.discardConfirm')}
            cancelLabel={t('voices.studio.v2.keepEditing')}
            variant="danger"
            onConfirm={discardChanges}
            onCancel={() => setConfirmDiscard(false)}
        />
        <Drawer
            open={open}
            onClose={requestClose}
            size="lg"
            eyebrow={t('voices.editor.eyebrow')}
            icon={<Icon icon={AudioLines} size={18} className="text-ember-400" />}
            title={title}
            footer={
                <>
                    <Button variant="ghost" onClick={requestClose}>
                        {t('common.cancel')}
                    </Button>
                    <Button
                        variant="primary"
                        onClick={() => void handleSave()}
                        disabled={!canSave}
                        iconLeft={<Icon icon={saving ? Loader2 : WandSparkles} size={15} className={saving ? 'animate-spin' : undefined} />}
                    >
                        {t('voices.studio.v2.save')}
                    </Button>
                </>
            }
        >
            <div className="flex flex-col gap-6" data-testid="preset-editor-v2">
                <p className="font-ui text-body text-parchment-300">{t('voices.studio.v2.editorHelp')}</p>
                {error && (
                    <Callout tone="danger" role="alert">
                        {error}
                    </Callout>
                )}

                {/* What → how → hear it → save as: the voice first, its name last (it starts as the voice's). */}
                <section
                    ref={baseVoiceRef}
                    tabIndex={-1}
                    aria-label={t('voices.studio.v2.baseVoice')}
                    aria-describedby={voiceFieldErrorShown ? voiceFieldErrorId : undefined}
                    className="flex flex-col gap-3"
                >
                    <SectionHeader as="h3" icon={AudioLines} title={t('voices.studio.v2.baseVoice')}
                        // Closes the picker on the voice already chosen; named apart from the drawer's own Cancel.
                        right={voiceKey && pickerOpen ? (
                            <Button variant="ghost" size="sm" onClick={() => setPickerOpen(false)}>
                                {t('voices.studio.v2.keepVoice')}
                            </Button>
                        ) : undefined} />
                    {voiceFieldErrorShown && (
                        <p id={voiceFieldErrorId} className="font-ui text-caption text-blood-500" data-testid="voice-field-error">
                            {t(voiceFieldErrorShown)}
                        </p>
                    )}
                    {voiceKey && !pickerOpen ? (
                        <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-line-faint bg-surface-raised p-3" data-testid="preset-base-voice">
                            <div className="flex min-w-0 items-start gap-3">
                                <Avatar name={item?.display_name || voiceName || t('voices.display.fallbackName')} size={40} />
                                <div className="flex min-w-0 flex-col gap-1">
                                    <p className="break-words font-ui text-body font-semibold text-parchment-50">{item?.display_name || voiceName || t('voices.display.fallbackName')}</p>
                                    {item && (
                                        <p className="font-ui text-caption text-parchment-300" data-testid="preset-voice-language">
                                            {languageLine}
                                        </p>
                                    )}
                                    {provider === 'fish_audio' && <><p className="text-caption text-parchment-300">{t('voices.providers.fishInfo')}</p><p className="text-caption text-fg-muted">{t('voices.providers.processing')}</p></>}
                                    {source && provider !== source.provider && <p className="text-caption text-parchment-300">{t('voices.providers.changed')}</p>}
                                    {!recipeAvailable && <Callout tone="warning">{t('voices.providers.unavailable')}</Callout>}
                                    {item && (
                                        <VoiceBadges
                                            badges={baseBadges}
                                            context={{ date: item.disable_at, minPlan: item.min_plan, language: checkedLanguage }}
                                        />
                                    )}
                                    {item && (
                                        <VoiceOwnerPrompts
                                            key={item.voice_key}
                                            badges={baseBadges}
                                            replacement={item.replacement}
                                            onSwitch={switchToReplacement}
                                            onChoose={() => setPickerOpen(true)}
                                        />
                                    )}
                                    {item && <p className="font-ui text-caption text-fg-muted">{t('voices.notice.language_scope')}</p>}
                                    <p className="font-ui text-caption text-fg-muted">{t('voices.recipe.languageNote')}</p>
                                </div>
                            </div>
                            <Button
                                variant="secondary"
                                size="sm"
                                aria-describedby={voiceFieldErrorShown ? voiceFieldErrorId : undefined}
                                onClick={() => setPickerOpen(true)}
                            >
                                {t('voices.studio.v2.changeVoice')}
                            </Button>
                        </div>
                    ) : (
                        <CatalogVoicePicker
                            enabled={open && pickerOpen}
                            capabilities={capabilities}
                            allLanguagesInitially={mode === 'create'}
                            currentVoiceKey={voiceKey}
                            onPick={chooseVoice}
                        />
                    )}
                </section>

                <div className="flex flex-col gap-4 border-t border-line-faint pt-5">
                    <SectionHeader as="h3" icon={SlidersHorizontal} title={t('voices.studio.v2.sections.delivery')} />
                    {provider === 'elevenlabs' && <TierToggle capabilities={capabilities} value={tier} onChange={changeTier} showUpsell />}
                    <RecipeControlsV2
                        surface={provider === 'fish_audio' && !recipeAvailable ? null : surface}
                        settings={settings}
                        onChange={changeSettings}
                        onRetry={onRetryCapabilities}
                        onShowStandard={provider === 'fish_audio' ? undefined : () => changeTier('standard')}
                        // AC-E2: the controls flag every value the save below clamps, hidden ones included.
                        writeControls={controls}
                    />
                    {emotionVisible && (
                        <Field label={t('voices.recipe.emotion')} helper={provider === 'fish_audio' ? t('voices.providers.emotionHint') : tier === 'standard' ? t('voices.recipe.emotionStandardHint') : undefined}>
                            <Select options={emotionOptions} value={emotion ?? EMOTION_NONE} onChange={changeEmotion} />
                        </Field>
                    )}
                    <p className="font-ui text-caption text-fg-muted" data-testid="thought-note">
                        {t(provider === 'fish_audio' ? 'voices.providers.thoughtHint' : tier === 'expressive' ? 'voices.recipe.thoughtNoteExpressive' : 'voices.recipe.thoughtNoteStandard')}
                    </p>
                </div>

                <div className="flex flex-col gap-4 border-t border-line-faint pt-5">
                    <SectionHeader as="h3" icon={Headphones} title={t('voices.studio.v2.sections.listen')} />
                    <div className="flex flex-wrap items-start gap-x-6 gap-y-4">
                        {previewLanguages.length > 1 && (
                            <div className="flex flex-col gap-2">
                                {/* The group carries the same name; the visible label is not read twice. */}
                                <p aria-hidden="true" className="font-ui text-label font-semibold text-fg">{t('voices.recipe.previewLanguage')}</p>
                                <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t('voices.recipe.previewLanguage')}>
                                    {previewLanguages.map((code) => (
                                        <Chip key={code} active={language === code} aria-pressed={language === code} onClick={() => choosePreviewLanguage(code)}>
                                            {languageLabel(code, i18n.language)}
                                        </Chip>
                                    ))}
                                </div>
                            </div>
                        )}
                        <PreviewTextChooser value={textId} onChange={chooseText} />
                    </div>
                    {provider === 'fish_audio' && voiceKey && <VoicePerformancePanel voiceKey={voiceKey} language={language} emotion={emotion} value={performance} onChange={next => { setPerformance(next); dropClips() }} userHash={userHash} />}
                    <div className="flex flex-wrap items-center gap-3">
                        <Button
                            variant="secondary"
                            size="sm"
                            disabled={!voiceKey || !recipeAvailable || (!useSample && preview.limitReached && !preview.loading)}
                            iconLeft={<Icon icon={playing ? Square : Play} size={14} />}
                            onClick={handlePreview}
                        >
                            {playing
                                ? t('voices.preview.stop')
                                : costsCredit
                                  ? `${t('voices.editor.previewVoice')} · ${t('voices.preview.costsCredit')}`
                                  : t('voices.editor.previewVoice')}
                        </Button>
                        {playing && <Icon icon={Loader2} size={14} className="animate-spin text-fg-muted" />}
                        {useSample
                            ? <p className="font-ui text-caption text-fg-muted">{t('voices.preview.freeSample')}</p>
                            : <PreviewAllowanceHint previewsLeft={preview.previewsLeft} loading={preview.loading} />}
                    </div>
                    {useSample && sample.error && <p role="alert" className="font-ui text-caption text-blood-300">{sample.error}</p>}
                    {!useSample && <PreviewProblemNotice problem={preview.problem} onPickVoice={pickAnotherVoice} membershipInNewTab />}
                    {preview.clip?.fallback === 'standard_fallback' && <VoiceBadges badges={['standard_fallback']} />}
                    {useSample && sample.clip ? (
                        // A catalog sample is the voice's own recording: no fixed-text transcript.
                        <VoiceClipPlayer src={sample.clip.src} volume={sample.clip.volume} autoPlay title={t('voices.editor.previewTitle')} />
                    ) : preview.clip ? (
                        <RecipePreviewPlayer src={preview.clip.src} volume={preview.clip.volume} title={t('voices.editor.previewTitle')} transcript={clipText} lang={preview.clip.language} />
                    ) : !useSample ? (
                        <PreviewTranscript text={fixedText} lang={previewTexts.language} />
                    ) : null}
                </div>

                <div className="flex flex-col gap-4 border-t border-line-faint pt-5">
                    <SectionHeader as="h3" icon={PenLine} title={t('voices.studio.v2.sections.details')} />
                    <Field label={t('voices.editor.nameLabel')} error={nameOverLimit ? t('voices.editor.nameTooLong') : undefined}>
                        <Input value={name} onChange={(event) => setName(event.target.value)} maxLength={PRESET_NAME_LIMIT} placeholder={t('voices.editor.namePlaceholder')} />
                    </Field>
                    <Field
                        label={t('voices.editor.descriptionLabel')}
                        error={descriptionOverLimit ? t('voices.editor.descriptionTooLong') : undefined}
                        helper={t('voices.editor.descriptionHelper')}
                    >
                        <Textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={PRESET_DESCRIPTION_LIMIT} placeholder={t('voices.editor.descriptionPlaceholder')} />
                    </Field>
                </div>
            </div>
        </Drawer>
        </>
    )
}
