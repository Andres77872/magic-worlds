/**
 * The voice picker (R1-FE-01, 05 §4, 09 §3): a "Presets" tab and a "Voice
 * catalog" tab. Every pick is a V2 voice (I-27: writes refuse a new V1 voice
 * with `voice_v1_not_allowed`):
 *
 * - a V2 preset → `voiceFromPreset` (V2 with its preset linkage), unless its
 *   voice is locked, removed or blocked;
 * - a V1 preset → its `conversion_draft` as V2 under the same `preset_id`
 *   ("Updated for the new voices"), or disabled with a Studio link when the
 *   server sent no draft;
 * - a catalog voice → `voiceFromCatalog` (no preset linkage).
 *
 * The catalog list loads as soon as the picker opens; a 404 there shows as
 * the catalog being unavailable.
 *
 * The current-voice row (05 §7.2, §7.8) shows the effective voice and its
 * badges ("Leaving on {date}" from the leaving voice's catalog entry), a free
 * sample of the voice it plays as (D18; one sample player with the catalog
 * tab; its button names the voice and language and toggles `aria-pressed`,
 * 05 §10) and the owner prompts: "Switch to {replacement}" writes the
 * replacement and closes; "Choose a voice" / "Pick another" open the catalog
 * tab and move focus to its search; "Keep for now" returns focus to the row.
 * The picker's own catalog lookup serves the prompts (no second read).
 *
 * Preset rows (05 §6.1, §6.3, §10): the source tabs toggle `aria-pressed`. A
 * preview that is the voice's free sample (`isFreeSamplePreview`, the Studio's
 * rule) says "Free: voice sample" and is never gated by the daily limit (the
 * BFF serves it unmetered); past the free renders any other preview reads
 * "Preview · 1 credit" and the account's first paid render of the session asks
 * once (`usePreviewCreditConfirm`, shared with the Studio). The transcript
 * carries its `lang`. A voice locked by the plan alone keeps its "Use"
 * focusable, `aria-disabled`, with "Upgrade to pick this voice" in its
 * `aria-describedby` (AC-K2); a removed, blocked or hidden voice stays natively
 * disabled (no upgrade makes it pickable). Each row's buttons name the preset,
 * and its preview also the voice and the language heard (05 §10 audio controls),
 * starting with its visible text ("Preview · 1 credit: …", WCAG 2.5.3). In flight
 * the preview is a "Stop" action (05 §6.3) with its own name, not a toggle (no
 * `aria-pressed`, as on the Studio card): the clip's player button carries it.
 * A refused preview shows the Studio's `PreviewProblemNotice` (05 §6.1, §6.4):
 * "Not enough credits" links to the membership page in a new tab (the card
 * being edited keeps its draft), `voice_unavailable` offers "Pick another
 * voice" (the catalog tab), and a token-bucket wait shows the rate-limit copy.
 */
import { useContext, useEffect, useId, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AudioLines, Check, ExternalLink, Loader2, Play, Square } from 'lucide-react'
import { AuthContext } from '@/app/providers/AuthProvider'
import { NavigationContext } from '@/app/providers/NavigationProvider'
import { apiService } from '@/infrastructure/api'
import type { CatalogVoice, EffectiveVoice, PreviewTextId, StoredCharacterVoice, VoiceCapabilities, VoicePresetRow, VoicePresetV2 } from '@/shared'
import { isPresetV2, isVoiceV2 } from '@/shared'
import { hasAssignedVoice, isElevenLabsProjection, voiceDisplayName } from '@/shared/voice'
import { VoiceClipPlayer } from '@/ui/components/audio'
import { Badge, Button, Chip, Drawer, Icon, IconButton, cx } from '@/ui/primitives'
import { catalogSampleUrl } from '../catalogBadges'
import type { CatalogRecommendationTarget } from '../hooks/useCatalogBrowser'
import { useCatalogLookup } from '../hooks/useCatalogLookup'
import { leavingVoiceKey } from '../hooks/useLeavingVoice'
import { conversionDraftOf, isFreeSamplePreview, presetRowBadges, presetVoiceKeys, previewSampleUrl, v2PreviewLanguage } from '../presetRowsV2'
import { useCatalogSample } from '../useCatalogSample'
import { usePreviewCreditConfirm } from '../usePreviewCreditConfirm'
import { usePreviewLanguage, usePreviewTextSets } from '../usePreviewTexts'
import { clipTranscript, useRecipePreview } from '../useRecipePreview'
import { voiceFromCatalog } from '../voiceFromCatalog'
import { presetMatchesVoice, voiceFromPreset } from '../voiceFromPreset'
import { CardVoiceOwnerPrompts } from './CardVoiceOwnerPrompts'
import { CatalogVoicePicker, type CatalogSampleController } from './CatalogVoicePicker'
import { EffectiveVoiceLabel } from './EffectiveVoiceLabel'
import { PreviewAllowanceHint, PreviewProblemNotice } from './PreviewAllowanceHint'
import { PreviewCreditDialog } from './PreviewCreditDialog'
import { RecipePreviewPlayer } from './RecipePreviewPlayer'
import { defaultPreviewTier } from './TierToggle'
import { VoiceBadges, languageLabel } from './VoiceBadges'

/** Preset rows audition the narration line (D18). */
const ROW_PREVIEW_TEXT: PreviewTextId = 'narration'

type Tab = 'presets' | 'catalog'

/** Which part of the picker started the shared catalog sample. */
type SampleSource = 'current' | 'catalog'

/** The V2 preset a row is used as, or null when it cannot be used. */
export function usableV2Preset(row: VoicePresetRow): VoicePresetV2 | null {
    if (isPresetV2(row)) return row
    const draft = conversionDraftOf(row)
    if (!draft) return null
    // The conversion keeps the V1 row's identity (D12): same preset_id, V2 fields from the draft.
    return { ...draft, preset_id: row.preset_id, is_global: row.is_global, schema_version: 2, provider: 'elevenlabs' }
}

/** A catalog status that rules a voice out whatever the plan: upgrading would not make it pickable. */
function withdrawn(item: CatalogVoice): boolean {
    return item.status === 'removed' || item.status === 'blocked' || item.status === 'hidden'
}

/** A catalog state that makes a preset's voice unusable for a new pick. */
function unavailable(item: CatalogVoice | null | undefined): boolean {
    return Boolean(item && (item.locked || withdrawn(item)))
}

export interface VoicePickerElevenLabsProps {
    open: boolean
    currentVoice?: StoredCharacterVoice | null
    currentEffectiveVoice?: EffectiveVoice | null
    recommendedFor?: CatalogRecommendationTarget | null
    language?: string | null
    capabilities: VoiceCapabilities | null
    onSelect: (voice: StoredCharacterVoice | null) => void
    onClose: () => void
}

export function VoicePickerElevenLabs({
    open,
    currentVoice,
    currentEffectiveVoice,
    recommendedFor = null,
    language,
    capabilities,
    onSelect,
    onClose,
}: VoicePickerElevenLabsProps) {
    const { t, i18n } = useTranslation()
    const navigation = useContext(NavigationContext)
    // Optional, like the navigation: without an account the paid-preview confirmation asks every time.
    const userHash = useContext(AuthContext)?.userHash ?? null
    const currentKey = currentVoice && isVoiceV2(currentVoice) ? currentVoice.voice_key : null
    // The voice the current row auditions: the one it plays as (a V1 voice's or a substitute's projection), else the stored V2 voice.
    const currentProjection = isElevenLabsProjection(currentEffectiveVoice) ? currentEffectiveVoice : null
    const heardKey = (hasAssignedVoice(currentVoice) ? currentProjection?.voice_key : null) || currentKey
    // Open on the tab that holds the current voice: a bare catalog voice has no preset row.
    const openingTab: Tab = currentKey && !currentVoice?.preset_id ? 'catalog' : 'presets'
    const [tab, setTab] = useState<Tab>(openingTab)
    // Re-seeded while rendering a re-open, never by a late mount effect that could undo a tab the user just chose.
    const [wasOpen, setWasOpen] = useState(open)
    if (wasOpen !== open) {
        setWasOpen(open)
        if (open) setTab(openingTab)
    }
    const [rows, setRows] = useState<VoicePresetRow[]>([])
    const [loading, setLoading] = useState(false)
    const [loadError, setLoadError] = useState(false)
    const [reload, setReload] = useState(0)
    const [previewId, setPreviewId] = useState<string | null>(null)
    // "Choose a voice" / "Pick another" send focus to the catalog search once its tab shows.
    const searchRef = useRef<HTMLInputElement>(null)
    const [searchFocusRequest, setSearchFocusRequest] = useState(0)
    const currentRowRef = useRef<HTMLDivElement>(null)
    const currentLabelId = useId()
    const rowHintId = useId()

    // Two reads: the current row's voices (stable while the presets load, so its badge date and
    // "Switch to" never blink out) and the preset rows' voices.
    const presetKeys = useMemo(() => presetVoiceKeys(rows), [rows])
    const lookup = useCatalogLookup(presetKeys, open)
    const currentKeys = useMemo(() => [currentKey, heardKey], [currentKey, heardKey])
    const currentLookup = useCatalogLookup(currentKeys, open)
    const appLanguage = usePreviewLanguage()
    const languageOf = (preset: VoicePresetV2) => v2PreviewLanguage(lookup.get(preset.voice_key), language || appLanguage, preset.language_code)
    const usable = rows.map((row) => ({ row, preset: usableV2Preset(row) }))
    const previewTexts = usePreviewTextSets(usable.flatMap(({ preset }) => (preset ? [languageOf(preset)] : [])), open)
    const recipePreview = useRecipePreview({ enabled: open })
    const resetPreview = recipePreview.reset
    const previewTier = defaultPreviewTier(capabilities)
    const credit = usePreviewCreditConfirm(userHash)
    const cancelCredit = credit.cancel
    /** The row audition is the voice's own catalog sample (free, unmetered; AC-P2), not a render. */
    const isFreeSample = (preset: VoicePresetV2) =>
        isFreeSamplePreview(preset.settings, preset.emotion, lookup.get(preset.voice_key), previewTexts(languageOf(preset)).language, previewTier)
    /** The language a row's preview is heard in: its catalog sample's (it may fall back to the primary language), else its text's. */
    const heardLanguageOf = (preset: VoicePresetV2, freeSample: boolean) => {
        const textLanguage = previewTexts(languageOf(preset)).language
        if (!freeSample) return textLanguage
        const item = lookup.get(preset.voice_key)
        const sampleUrl = previewSampleUrl(item, textLanguage, previewTier)
        return item?.languages.find((entry) => sampleUrl !== null && entry.sample_url === sampleUrl)?.language ?? textLanguage
    }
    // One catalog sample at a time across the current row and the catalog tab.
    const sample = useCatalogSample()
    const stopSample = sample.stop
    const [sampleSource, setSampleSource] = useState<SampleSource | null>(null)

    useEffect(() => {
        if (!open) {
            resetPreview()
            stopSample()
            cancelCredit()
        }
    }, [open, resetPreview, stopSample, cancelCredit])

    useEffect(() => {
        if (searchFocusRequest) searchRef.current?.focus()
    }, [searchFocusRequest])

    // Loading the presets when the picker opens is a backend sync.
    useEffect(() => {
        if (!open) return
        /* eslint-disable react-hooks/set-state-in-effect */
        setLoading(true)
        setLoadError(false)
        let cancelled = false
        void Promise.resolve()
            .then(() => apiService.listVoicePresets())
            .then((list) => {
                if (!cancelled) setRows(Array.isArray(list) ? list : [])
            })
            .catch(() => {
                if (!cancelled) {
                    setRows([])
                    setLoadError(true)
                }
            })
            .finally(() => {
                if (!cancelled) setLoading(false)
            })
        return () => {
            cancelled = true
        }
        /* eslint-enable react-hooks/set-state-in-effect */
    }, [open, reload])

    const pick = (voice: StoredCharacterVoice) => {
        onSelect(voice)
        onClose()
    }

    const previewPreset = (preset: VoicePresetV2, costsCredit: boolean) => {
        if (previewId === preset.preset_id && recipePreview.loading) {
            recipePreview.stop()
            return
        }
        const input = {
            voiceKey: preset.voice_key,
            settings: preset.settings ?? null,
            emotion: preset.emotion ?? null,
            textId: ROW_PREVIEW_TEXT,
            language: previewTexts(languageOf(preset)).language,
            tier: previewTier,
            key: preset.preset_id,
        }
        // The first paid render of the session is confirmed once (AC-P5, 05 §6.3).
        credit.guard(costsCredit, () => {
            setPreviewId(preset.preset_id)
            void recipePreview.run(input)
        })
    }

    const openStudio = () => {
        onClose()
        navigation?.setPage('voice-studio')
    }

    const chooseVoice = () => {
        setTab('catalog')
        setSearchFocusRequest((value) => value + 1)
    }

    const currentItem = currentKey ? currentLookup.get(currentKey) ?? null : null
    const heardItem = heardKey ? currentLookup.get(heardKey) ?? null : null
    // The leaving voice (the stored V2 voice, else the one a V1 voice plays as) dates the badge and names the replacement.
    const leavingKey = hasAssignedVoice(currentVoice) ? leavingVoiceKey(currentVoice, currentProjection) : null
    const leavingItem = leavingKey ? currentLookup.get(leavingKey) ?? null : null
    const currentSampleUrl = heardItem ? catalogSampleUrl(heardItem, language) : null
    const currentSampleLanguage = heardItem?.languages.find((entry) => currentSampleUrl && entry.sample_url === currentSampleUrl)?.language ?? null
    const fromCurrent = sampleSource === 'current'
    const currentPlaying = fromCurrent && Boolean(currentSampleUrl && sample.clip?.sampleUrl === currentSampleUrl)
    const currentSampleLoading = fromCurrent && Boolean(currentSampleUrl && sample.loadingUrl === currentSampleUrl)
    const playCurrentSample = () => {
        if (!currentSampleUrl) return
        if (currentPlaying) {
            sample.stop()
            return
        }
        // A clip the catalog tab started never shows on this row (and vice versa).
        if (!fromCurrent) sample.stop()
        setSampleSource('current')
        void sample.play(currentSampleUrl, null)
    }
    // The catalog tab sees only the samples it started.
    const fromCatalog = sampleSource === 'catalog'
    const catalogSample: CatalogSampleController = {
        ...sample,
        clip: fromCatalog ? sample.clip : null,
        loadingUrl: fromCatalog ? sample.loadingUrl : null,
        loading: fromCatalog && sample.loading,
        error: fromCatalog ? sample.error : null,
        play: (sampleUrl, gainDb) => {
            if (!fromCatalog) sample.stop()
            setSampleSource('catalog')
            return sample.play(sampleUrl, gainDb)
        },
    }

    return (
        <>
        {/* Before the drawer, as in the preset editor: the Modal portals over it when it opens. */}
        <PreviewCreditDialog confirm={credit} />
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
            <div className="flex flex-col gap-4" data-testid="voice-picker-elevenlabs">
                {hasAssignedVoice(currentVoice) && (
                    <div
                        ref={currentRowRef}
                        tabIndex={-1}
                        role="group"
                        aria-labelledby={currentLabelId}
                        className="flex flex-col gap-2 border-l-2 border-ember-500/45 py-2.5 pl-3"
                        data-testid="voice-picker-current"
                    >
                        <div className="flex items-start gap-2">
                            <Icon icon={Check} size={16} className="mt-0.5 shrink-0 text-ember-400" />
                            <div className="flex min-w-0 flex-1 flex-col gap-2">
                                <div>
                                    <p id={currentLabelId} className="font-ui text-[0.7rem] uppercase tracking-wide text-ember-300/80">{t('voices.picker.currentlyUsing')}</p>
                                    <EffectiveVoiceLabel
                                        stored={currentVoice}
                                        effective={currentEffectiveVoice}
                                        badgeContext={{ date: leavingItem?.disable_at ?? currentItem?.disable_at ?? null, language }}
                                    />
                                </div>
                                <CardVoiceOwnerPrompts
                                    stored={currentVoice}
                                    effective={currentEffectiveVoice}
                                    onSwitch={pick}
                                    onChoose={chooseVoice}
                                    leavingItem={leavingItem}
                                    returnFocus={() => currentRowRef.current?.focus()}
                                />
                            </div>
                            {heardItem && currentSampleUrl && (
                                <IconButton
                                    label={currentSampleLanguage
                                        ? t('voices.catalog.playCurrentSample', { name: heardItem.display_name, language: languageLabel(currentSampleLanguage, i18n.language) })
                                        : t('voices.catalog.playSample', { name: heardItem.display_name })}
                                    aria-pressed={currentPlaying}
                                    size="sm"
                                    className="shrink-0"
                                    onClick={playCurrentSample}
                                >
                                    <Icon
                                        icon={currentSampleLoading ? Loader2 : currentPlaying ? Square : Play}
                                        size={14}
                                        className={currentSampleLoading ? 'animate-spin' : undefined}
                                    />
                                </IconButton>
                            )}
                        </div>
                        {currentPlaying && sample.clip && heardItem && (
                            <VoiceClipPlayer src={sample.clip.src} title={t('voices.catalog.playSample', { name: heardItem.display_name })} />
                        )}
                        {fromCurrent && sample.error && <p role="alert" className="font-ui text-caption text-blood-300">{sample.error}</p>}
                    </div>
                )}

                <div className="flex gap-2" role="group" aria-label={t('voices.picker.sourceLabel')}>
                    <Chip active={tab === 'presets'} aria-pressed={tab === 'presets'} onClick={() => setTab('presets')}>
                        {t('voices.picker.presetsTab')}
                    </Chip>
                    <Chip active={tab === 'catalog'} aria-pressed={tab === 'catalog'} onClick={() => setTab('catalog')}>
                        {t('voices.catalog.tab')}
                    </Chip>
                </div>

                <div hidden={tab !== 'presets'} data-testid="voice-picker-presets">
                    {loadError && (
                        <div role="alert" className="mb-3 flex flex-wrap items-center justify-between gap-3 border-l-2 border-blood-500 pl-3 text-body text-parchment-200">
                            <span>{t('common.loadError')}</span>
                            <Button variant="secondary" size="sm" onClick={() => setReload((value) => value + 1)}>{t('common.tryAgain')}</Button>
                        </div>
                    )}
                    {rows.length > 0 ? (
                        <div className="flex flex-col gap-2">
                            <PreviewAllowanceHint previewsLeft={recipePreview.previewsLeft} loading={recipePreview.loading} />
                            <div className="flex flex-col divide-y divide-line-faint">
                                {usable.map(({ row, preset }, index) => {
                                    const item = preset ? lookup.get(preset.voice_key) : null
                                    const blocked = !preset || unavailable(item)
                                    // AC-K2: a voice locked by the plan alone stays reachable; its "Use" says why it cannot be picked.
                                    // Removed, blocked or hidden, it stays natively disabled: no upgrade would make it pickable.
                                    const locked = Boolean(preset && item?.locked && !withdrawn(item))
                                    const lockedHintId = `${rowHintId}-locked-${index}`
                                    const selected = preset ? presetMatchesVoice(preset, currentVoice) : false
                                    const converted = Boolean(preset) && !isPresetV2(row)
                                    const badges = preset ? presetRowBadges(preset, item) : []
                                    const previewing = previewId === row.preset_id && recipePreview.loading
                                    const clip = recipePreview.clip?.key === row.preset_id ? recipePreview.clip : null
                                    const previewProblem = previewId === row.preset_id ? recipePreview.problem : null
                                    const freeSample = preset ? isFreeSample(preset) : false
                                    // Until the catalog item is in, a preview counts as paid (the label may over-warn, never under-warn).
                                    const costsCredit = !freeSample && recipePreview.nextCostsCredit
                                    // The sample's own caption shows under its player while it plays.
                                    const showFreeHint = freeSample && clip?.source !== 'sample'
                                    const freeHintId = `${rowHintId}-free-${index}`
                                    const voiceName = (preset ? voiceDisplayName(voiceFromPreset(preset)) : null) ?? t('voices.display.fallbackName')
                                    // 05 §10: the row's buttons name the preset; the preview also the voice and the language heard.
                                    const paidLabel = `${t('voices.picker.preview')} · ${t('voices.preview.costsCredit')}`
                                    const previewName = !preset ? '' : previewing
                                        ? t('voices.picker.stopNamed', { name: row.name })
                                        // WCAG 2.5.3: the paid name starts with the visible "Preview · 1 credit".
                                        : t(costsCredit ? 'voices.picker.previewNamedCredit' : 'voices.picker.previewNamed', {
                                            name: row.name,
                                            voice: voiceName,
                                            language: languageLabel(heardLanguageOf(preset, freeSample), i18n.language),
                                            label: paidLabel,
                                        })
                                    return (
                                        <div
                                            key={row.preset_id}
                                            data-testid="voice-picker-preset-row"
                                            data-preset-id={row.preset_id}
                                            className={cx(
                                                'flex flex-col gap-2 border-l-2 py-4 pl-3',
                                                selected ? 'border-l-ember-500 bg-ember-500/[.05]' : 'border-l-transparent',
                                            )}
                                        >
                                            <div className="flex flex-col items-start justify-between gap-3 sm:flex-row">
                                                <div className="flex min-w-0 flex-col gap-1">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <p className="font-ui text-sm font-semibold text-parchment-50">{row.name}</p>
                                                        {row.is_global && <Badge tone="arcane">{t('voices.picker.defaultBadge')}</Badge>}
                                                        {converted && <Badge tone="glass">{t('voices.picker.convertedFromV1')}</Badge>}
                                                    </div>
                                                    <p className="font-ui text-xs text-parchment-400">{voiceName}</p>
                                                    {badges.length > 0 && (
                                                        <VoiceBadges badges={badges} context={{ date: item?.disable_at ?? null, minPlan: item?.min_plan ?? null }} />
                                                    )}
                                                    {locked && (
                                                        <p id={lockedHintId} className="font-ui text-xs text-parchment-400">
                                                            {t('voices.badge.locked_hint')}
                                                        </p>
                                                    )}
                                                    {!preset && (
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <p className="font-ui text-caption text-fg-muted">{t('voices.picker.v1PresetNeedsUpdate')}</p>
                                                            {navigation && (
                                                                <Button variant="ghost" size="sm" iconLeft={<Icon icon={ExternalLink} size={13} />} onClick={openStudio}>
                                                                    {t('voices.picker.openStudio')}
                                                                </Button>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex shrink-0 flex-col items-start gap-1 sm:items-end">
                                                    <div className="flex gap-2">
                                                        {preset && (
                                                            <Button
                                                                variant="secondary"
                                                                size="sm"
                                                                // The free sample is unmetered: the daily limit never gates it (05 §6.3).
                                                                disabled={recipePreview.limitReached && !previewing && !freeSample}
                                                                aria-label={previewName}
                                                                aria-describedby={showFreeHint ? freeHintId : undefined}
                                                                iconLeft={<Icon icon={previewing ? Square : Play} size={14} />}
                                                                onClick={() => previewPreset(preset, costsCredit)}
                                                            >
                                                                {previewing
                                                                    ? t('voices.preview.stop')
                                                                    : costsCredit
                                                                      ? paidLabel
                                                                      : t('voices.picker.preview')}
                                                            </Button>
                                                        )}
                                                        <Button
                                                            variant="primary"
                                                            size="sm"
                                                            disabled={blocked && !locked}
                                                            aria-label={selected ? t('voices.picker.selectedNamed', { name: row.name }) : t('voices.picker.useNamed', { name: row.name })}
                                                            aria-disabled={locked || undefined}
                                                            aria-describedby={locked ? lockedHintId : undefined}
                                                            className={locked ? 'cursor-not-allowed opacity-50' : undefined}
                                                            iconLeft={selected ? <Icon icon={Check} size={14} /> : undefined}
                                                            onClick={() => {
                                                                if (preset && !blocked) pick(voiceFromPreset(preset))
                                                            }}
                                                        >
                                                            {selected ? t('voices.picker.selected') : t('voices.picker.use')}
                                                        </Button>
                                                    </div>
                                                    {showFreeHint && (
                                                        <p id={freeHintId} className="font-ui text-caption text-fg-muted">{t('voices.preview.freeSample')}</p>
                                                    )}
                                                </div>
                                            </div>
                                            {clip && (
                                                <RecipePreviewPlayer
                                                    src={clip.src}
                                                    volume={clip.volume}
                                                    title={t('voices.picker.previewTitle', { name: row.name })}
                                                    transcript={clipTranscript(clip, previewTexts(clip.language).texts[clip.textId])}
                                                    lang={clip.language}
                                                />
                                            )}
                                            {clip?.fallback === 'standard_fallback' && <VoiceBadges badges={['standard_fallback']} />}
                                            {/* 05 §6.4, as in the Studio and the editor: the membership link (a new tab keeps the
                                                card's unsaved draft) and "Pick another voice" (the catalog tab, focus on its search). */}
                                            <PreviewProblemNotice
                                                problem={previewProblem}
                                                onPickVoice={chooseVoice}
                                                membershipInNewTab
                                                messageClassName="text-body text-blood-300"
                                            />
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    ) : !loadError && (
                        <p role="status" className="py-6 font-ui text-sm text-parchment-300">
                            {loading ? t('voices.picker.loadingPresets') : t('voices.picker.noPresets')}
                        </p>
                    )}
                </div>

                <div hidden={tab !== 'catalog'} data-testid="voice-picker-catalog">
                    <CatalogVoicePicker
                        enabled={open}
                        language={language}
                        recommendedFor={recommendedFor}
                        currentVoiceKey={currentKey}
                        searchRef={searchRef}
                        onPick={(item) => pick(voiceFromCatalog(item))}
                        sample={catalogSample}
                    />
                </div>
            </div>
        </Drawer>
        </>
    )
}
