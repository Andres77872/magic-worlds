/**
 * The Voice studio (R1-FE-02, 05 §5, 09 §4): ElevenLabs voices, mounted by
 * `VoiceStudioPage` for every signed-in account.
 *
 * - Header with the narration-tier setting (R1-FE-04), refresh and "New preset".
 * - The first-exposure notice, the account's review flags and the language note.
 * - "My presets" and "Global presets". Rows come from `GET /voice-presets`
 *   unfiltered (R-15): V2 rows are edited, previewed and deleted; a V1 row
 *   converts through its `conversion_draft` (same `preset_id`, D12); global
 *   rows are read-only and duplicate.
 * - `#/voices?preset=<id>` (a review flag's "Adjust") opens that preset.
 * - Owner prompts on user V2 cards (05 §7.8): "Switch to {replacement}" writes
 *   the replacement voice with the preset's own settings and emotion; "Choose a
 *   voice" / "Pick another" open the editor on the picker.
 * - `not_tested_language` is checked against each preset's language, else the
 *   account's preferred language (05 §5.5), on V1 cards against the voice
 *   their projection plays.
 * - Card previews default to the same language as the editor (05 §5.5, D17).
 * - The usage strip (AC-S3): previews, narration characters and call minutes
 *   left today, from the usage DTO the preview allowance already reads.
 * - Past the free renders a card whose preview is a render (not the voice's
 *   free sample, `isFreeSamplePreview`) reads "Preview · 1 credit", and the
 *   account's first paid render of the session asks once (AC-P5, 05 §6.3).
 *   A card whose preview is that free sample says "Free: voice sample" (AC-P2).
 * - Preview errors carry their 05 §6.4 action: "Not enough credits" links to
 *   the membership page; a 409 `voice_unavailable` offers "Pick another
 *   voice", which opens the editor on the picker. Saving or switching that
 *   preset drops the card's clip and notice (they were for the old recipe).
 * - At the daily hard limit card previews are disabled, except a card whose
 *   preview is the free sample, which the BFF serves at the limit (the editor's rule).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AudioLines, Loader2, Plus, RefreshCw } from 'lucide-react'
import { useAuth } from '@/app/hooks'
import { apiService } from '@/infrastructure/api'
import type { PreviewTextId, VoiceCapabilities, VoicePresetRow, VoicePresetV2, VoiceReviewFlag } from '@/shared'
import { isPresetV2 } from '@/shared'
import { pageHash } from '@/features/gallery/galleryLinks'
import { ConfirmDialog } from '@/ui/components/ConfirmDialog'
import { EmptyState } from '@/ui/components/common/EmptyState'
import { Button, Callout, Icon, IconTile, PageHeader, Toast } from '@/ui/primitives'
import { useCatalogLookup } from '../hooks/useCatalogLookup'
import { usePreferredLanguage } from '../hooks/usePreferredLanguage'
import { useVoiceReviewFlags } from '../hooks/useVoiceReviewFlags'
import { parsePresetEditHash } from '../presetLinks'
import {
    editorModeFor,
    isFreeSamplePreview,
    presetCatalogKey,
    presetCatalogKeys,
    presetLanguage,
    studioPreviewLanguage,
    v2FieldsOf,
    type PresetEditorV2Mode,
} from '../presetRowsV2'
import { normalizeSettingsForWrite } from '../recipeV2'
import { voiceWriteErrorMessage } from '../voiceWriteError'
import { usePreviewLanguage, usePreviewTextSets } from '../usePreviewTexts'
import { clipTranscript, useRecipePreview } from '../useRecipePreview'
import { usePreviewCreditConfirm } from '../usePreviewCreditConfirm'
import { NarrationTierSetting } from './NarrationTierSetting'
import { PresetCardV2 } from './PresetCardV2'
import { PresetEditorV2, type PresetEditorV2Toast } from './PresetEditorV2'
import { PreviewAllowanceHint, PreviewProblemNotice } from './PreviewAllowanceHint'
import { PreviewCreditDialog } from './PreviewCreditDialog'
import { RecipePreviewPlayer } from './RecipePreviewPlayer'
import { ReviewFlagList } from './ReviewFlagList'
import { defaultPreviewTier } from './TierToggle'
import { VoiceNoticeStack } from './VoiceNoticeStack'
import type { VoiceReplacement } from './VoiceOwnerPrompts'
import { VoiceUsageStrip } from './VoiceUsageStrip'

/** Preset cards audition the narration line; the editor offers all three texts (D18). */
const CARD_PREVIEW_TEXT: PreviewTextId = 'narration'

interface EditorState {
    open: boolean
    mode: PresetEditorV2Mode
    source: VoicePresetRow | null
    /** Open on the voice picker (an owner prompt). */
    pickVoice?: boolean
}

const CLOSED: EditorState = { open: false, mode: 'create', source: null }

interface VoiceStudioV2Props {
    capabilities: VoiceCapabilities | null
    /** Re-read the capabilities (the recipe controls' retry). */
    onRetryCapabilities?: () => void
}

export function VoiceStudioV2({ capabilities, onRetryCapabilities }: VoiceStudioV2Props) {
    const { t } = useTranslation()
    const { isAuthenticated, openLoginModal, userHash } = useAuth()
    const [rows, setRows] = useState<VoicePresetRow[]>([])
    const [loading, setLoading] = useState(false)
    const [loaded, setLoaded] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [toast, setToast] = useState<PresetEditorV2Toast | null>(null)
    const [editor, setEditor] = useState<EditorState>(CLOSED)
    const [pendingDelete, setPendingDelete] = useState<VoicePresetRow | null>(null)
    const [deletingId, setDeletingId] = useState<string | null>(null)
    const [previewId, setPreviewId] = useState<string | null>(null)
    // The card the hook's preview belongs to, read after an await (a save or a switch).
    const previewIdRef = useRef<string | null>(null)
    const [switchingId, setSwitchingId] = useState<string | null>(null)
    const [deepLink, setDeepLink] = useState<string | null>(() => parsePresetEditHash())
    const preferred = usePreferredLanguage(isAuthenticated)

    const flags = useVoiceReviewFlags(isAuthenticated)
    const voiceKeys = useMemo(() => presetCatalogKeys(rows), [rows])
    const lookup = useCatalogLookup(voiceKeys, isAuthenticated)
    const recipePreview = useRecipePreview({ enabled: isAuthenticated })
    const credit = usePreviewCreditConfirm(userHash)
    const appLanguage = usePreviewLanguage()
    // The editor's default (05 §5.5, D17): language_code, then primary language, then the preferred one.
    const languageOf = useCallback((row: VoicePresetRow) => {
        const key = isPresetV2(row) ? row.voice_key : null
        return studioPreviewLanguage(key ? lookup.get(key) : null, {
            languageCode: isPresetV2(row) ? row.language_code : null,
            preferredLanguage: preferred.language,
            fallback: appLanguage,
        })
    }, [appLanguage, lookup, preferred.language])
    const previewTexts = usePreviewTextSets(rows.filter(isPresetV2).map(languageOf), isAuthenticated)
    const cardTier = defaultPreviewTier(capabilities)
    /** The BFF answers this card's preview with the voice's own sample: an untuned recipe whose voice has one (EP-6, AC-P2). */
    const cardIsFreeSample = (row: VoicePresetV2) =>
        isFreeSamplePreview(row.settings, row.emotion, lookup.get(row.voice_key), previewTexts(languageOf(row)).language, cardTier)
    /**
     * A card preview past the free renders costs 1 credit unless the BFF serves the
     * voice's own sample (AC-P5). Until the catalog item is in, it counts as paid.
     */
    const cardCostsCredit = (row: VoicePresetV2) => recipePreview.nextCostsCredit && !cardIsFreeSample(row)

    const mine = rows.filter((row) => !row.is_global)
    const globals = rows.filter((row) => row.is_global)
    const hasConvertedVoice = rows.some((row) => !isPresetV2(row) && !row.is_global)

    const refresh = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            // R-15: every row the server sends; V1 rows show their conversion state.
            setRows(await apiService.listVoicePresets())
        } catch (failure) {
            setError(failure instanceof Error && failure.message ? failure.message : t('voices.studio.loadError'))
        } finally {
            setLoading(false)
            setLoaded(true)
        }
    }, [t])

    useEffect(() => {
        if (!isAuthenticated) return
        /* eslint-disable-next-line react-hooks/set-state-in-effect -- the preset list is a backend read */
        void refresh()
    }, [isAuthenticated, refresh])

    // A review flag's "Adjust" may land here while the studio is already open.
    useEffect(() => {
        const onHash = () => setDeepLink(parsePresetEditHash())
        window.addEventListener('hashchange', onHash)
        return () => window.removeEventListener('hashchange', onHash)
    }, [])

    const openEditorFor = useCallback((row: VoicePresetRow, pickVoice = false) => {
        const mode = editorModeFor(row)
        if (mode) setEditor({ open: true, mode, source: row, pickVoice })
    }, [])

    // Open the linked preset once the rows are in, then drop the query so a reload does not reopen it.
    useEffect(() => {
        if (!deepLink || !loaded) return
        const row = rows.find((candidate) => candidate.preset_id === deepLink)
        /* eslint-disable-next-line react-hooks/set-state-in-effect -- consumes the one-shot deep link */
        setDeepLink(null)
        if (row) openEditorFor(row)
        if (parsePresetEditHash() === deepLink && typeof window.history?.replaceState === 'function') {
            window.history.replaceState(window.history.state, '', pageHash('voice-studio'))
        }
    }, [deepLink, loaded, rows, openEditorFor])

    const adjustPreset = (presetId: string) => {
        const row = rows.find((candidate) => candidate.preset_id === presetId)
        if (row) openEditorFor(row)
    }

    /** "Listen" on a preset flag plays that preset's voice (its own or its conversion draft's). */
    const flagVoiceKey = (flag: VoiceReviewFlag): string | null => {
        if (flag.ref_type !== 'preset') return null
        const row = rows.find((candidate) => candidate.preset_id === flag.ref_id)
        return row ? v2FieldsOf(row)?.voice_key ?? null : null
    }

    /** A preset flag's notice is named after its preset (05 §10); cards fall back to the library name. */
    const flagName = (flag: VoiceReviewFlag): string | null =>
        flag.ref_type === 'preset' ? rows.find((candidate) => candidate.preset_id === flag.ref_id)?.name ?? null : null

    /** A rewritten preset's card clip and 05 §6.4 notice were for its old recipe: drop them. */
    const forgetCardPreview = (presetId: string) => {
        if (previewIdRef.current !== presetId) return
        previewIdRef.current = null
        setPreviewId(null)
        recipePreview.reset()
    }

    // 05 §7.8 "Switch to {replacement}": the same preset, the replacement voice, its own settings and emotion.
    const switchVoice = async (row: VoicePresetV2, replacement: VoiceReplacement) => {
        if (switchingId) return
        setSwitchingId(row.preset_id)
        try {
            await apiService.updateVoicePreset(row.preset_id, {
                name: row.name,
                description: row.description ?? null,
                voice_key: replacement.voice_key,
                settings: normalizeSettingsForWrite(row.settings),
                emotion: row.emotion ?? null,
            })
            setToast({ tone: 'success', title: t('voices.studio.v2.saved'), message: row.name })
            forgetCardPreview(row.preset_id)
            void refresh()
        } catch (failure) {
            setToast({ tone: 'error', title: t('voices.studio.v2.saveFailed'), message: voiceWriteErrorMessage(failure, t) ?? undefined })
        } finally {
            setSwitchingId(null)
        }
    }

    const preview = (row: VoicePresetRow) => {
        if (!isPresetV2(row)) return
        if (previewId === row.preset_id && recipePreview.loading) {
            recipePreview.stop()
            return
        }
        const input = {
            voiceKey: row.voice_key,
            settings: row.settings ?? null,
            emotion: row.emotion ?? null,
            textId: CARD_PREVIEW_TEXT,
            language: previewTexts(languageOf(row)).language,
            tier: cardTier,
            key: row.preset_id,
        }
        // The first paid render of the session is confirmed once (05 §6.3).
        credit.guard(cardCostsCredit(row), () => {
            previewIdRef.current = row.preset_id
            setPreviewId(row.preset_id)
            void recipePreview.run(input)
        })
    }

    const closeEditor = () => {
        setEditor((current) => ({ ...current, open: false }))
        // Editor previews spent the same daily allowance.
        recipePreview.refreshAllowance()
    }

    const confirmDelete = async () => {
        const target = pendingDelete
        setPendingDelete(null)
        if (!target) return
        setDeletingId(target.preset_id)
        try {
            await apiService.deleteVoicePreset(target.preset_id)
            setRows((current) => current.filter((row) => row.preset_id !== target.preset_id))
            setToast({ tone: 'success', title: t('voices.studio.toastDeleted'), message: target.name })
        } catch (failure) {
            const message = failure instanceof Error && failure.message ? failure.message : t('voices.studio.deleteError')
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

    const renderRow = (row: VoicePresetRow) => {
        const v2 = isPresetV2(row)
        const previewing = previewId === row.preset_id && recipePreview.loading
        const clip = recipePreview.clip?.key === row.preset_id ? recipePreview.clip : null
        const previewProblem = previewId === row.preset_id ? recipePreview.problem : null
        const mode = editorModeFor(row)
        const catalogKey = presetCatalogKey(row)
        return (
            <PresetCardV2
                key={row.preset_id}
                row={row}
                catalogItem={catalogKey ? lookup.get(catalogKey) ?? null : null}
                reviewFlag={flags.flagFor('preset', row.preset_id, 'voice')}
                language={presetLanguage(row, preferred.language)}
                switching={switchingId === row.preset_id}
                onSwitchVoice={v2 && !row.is_global ? (replacement) => void switchVoice(row, replacement) : undefined}
                onChooseVoice={mode === 'edit' ? () => openEditorFor(row, true) : undefined}
                previewing={previewing}
                // The hard limit stops renders; the free sample still plays (the editor's rule, AC-P2).
                previewDisabled={recipePreview.limitReached && !(v2 && cardIsFreeSample(row))}
                previewCostsCredit={v2 && cardCostsCredit(row)}
                // Before it plays: once played, the sample's player says it.
                previewFree={v2 && !clip && cardIsFreeSample(row)}
                deleting={deletingId === row.preset_id}
                onPreview={v2 ? () => preview(row) : undefined}
                onEdit={mode === 'edit' ? () => openEditorFor(row) : undefined}
                onUpdate={mode === 'convert' ? () => openEditorFor(row) : undefined}
                onDuplicate={mode === 'duplicate' ? () => openEditorFor(row) : undefined}
                onDelete={row.is_global ? undefined : () => setPendingDelete(row)}
            >
                {clip && (
                    <RecipePreviewPlayer
                        className="mt-3"
                        src={clip.src}
                        volume={clip.volume}
                        title={t('voices.studio.previewTitle', { name: row.name })}
                        transcript={clipTranscript(clip, previewTexts(clip.language).texts[clip.textId])}
                        lang={clip.language}
                    />
                )}
                {clip?.fallback === 'standard_fallback' && (
                    <p className="mt-1 font-ui text-caption text-fg-muted">{t('voices.badge.standard_fallback_tooltip')}</p>
                )}
                <PreviewProblemNotice
                    className="mt-2"
                    messageClassName="text-body text-blood-300"
                    problem={previewProblem}
                    // 05 §6.4 "Pick another voice": the editor, on its picker (a global row duplicates).
                    onPickVoice={mode === 'edit' || mode === 'duplicate' ? () => openEditorFor(row, true) : undefined}
                />
            </PresetCardV2>
        )
    }

    const newPreset = () => setEditor({ open: true, mode: 'create', source: null })

    return (
        <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-6 px-5 py-8 sm:px-8 sm:py-10" data-testid="voice-studio-v2">
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
                            variant="secondary"
                            size="sm"
                            iconLeft={<Icon icon={RefreshCw} size={15} className={loading ? 'animate-spin' : undefined} />}
                            onClick={() => void refresh()}
                            disabled={loading}
                        >
                            {t('voices.studio.refresh')}
                        </Button>
                        <Button variant="primary" size="sm" iconLeft={<Icon icon={Plus} size={15} />} onClick={newPreset}>
                            {t('voices.studio.newPreset')}
                        </Button>
                    </div>
                }
                divider
            />

            <NarrationTierSetting />
            <VoiceUsageStrip usage={recipePreview.usage} previewsLeft={recipePreview.previewsLeft} />

            <VoiceNoticeStack userHash={userHash} hasConvertedVoice={hasConvertedVoice} />
            <ReviewFlagList
                flags={flags.flags}
                onDismiss={(flagId) => void flags.dismiss(flagId)}
                onAdjustPreset={adjustPreset}
                voiceKeyFor={flagVoiceKey}
                nameFor={flagName}
            />
            {flags.dismissError && <p role="alert" className="font-ui text-caption text-blood-300">{t(flags.dismissError)}</p>}
            <p className="font-ui text-caption text-fg-muted">{t('voices.notice.language_scope')}</p>

            {error && (
                <Callout
                    tone="danger"
                    role="alert"
                    action={<Button variant="secondary" size="sm" onClick={() => setError(null)}>{t('voices.studio.dismiss')}</Button>}
                >
                    {error}
                </Callout>
            )}

            {loading && rows.length === 0 ? (
                <div role="status" className="flex items-center gap-2 py-8 text-body text-parchment-300">
                    <Icon icon={Loader2} size={18} className="animate-spin" />
                    {t('common.loading')}
                </div>
            ) : rows.length === 0 && !error ? (
                <EmptyState
                    icon={<Icon icon={AudioLines} size={40} />}
                    message={t('voices.studio.emptyMessage')}
                    secondaryText={t('voices.studio.emptyHelper')}
                    button={{ label: t('voices.studio.newPreset'), onClick: newPreset }}
                />
            ) : (
                <div className="flex flex-col gap-6">
                    <PreviewAllowanceHint previewsLeft={recipePreview.previewsLeft} loading={recipePreview.loading} />
                    <section aria-labelledby="voice-studio-mine" className="flex flex-col gap-1">
                        <h2 id="voice-studio-mine" className="font-display text-h3 text-parchment-50">{t('voices.studio.v2.myPresets')}</h2>
                        {mine.length === 0 ? (
                            <p className="py-3 font-ui text-sm text-parchment-300">{t('voices.studio.emptyHelper')}</p>
                        ) : (
                            <div className="flex flex-col divide-y divide-line-faint">{mine.map(renderRow)}</div>
                        )}
                    </section>
                    {globals.length > 0 && (
                        <section aria-labelledby="voice-studio-global" className="flex flex-col gap-1">
                            <h2 id="voice-studio-global" className="font-display text-h3 text-parchment-50">{t('voices.studio.v2.globalPresets')}</h2>
                            <div className="flex flex-col divide-y divide-line-faint">{globals.map(renderRow)}</div>
                        </section>
                    )}
                </div>
            )}

            <PresetEditorV2
                open={editor.open}
                mode={editor.mode}
                source={editor.source}
                capabilities={capabilities}
                onRetryCapabilities={onRetryCapabilities}
                pickVoiceOnOpen={editor.pickVoice}
                userHash={userHash}
                onClose={closeEditor}
                onSaved={(row) => {
                    // An edit or a conversion rewrote the source row in place (D12).
                    const rewritten = editor.mode === 'edit' || editor.mode === 'convert' ? editor.source?.preset_id ?? row?.preset_id : null
                    if (rewritten) forgetCardPreview(rewritten)
                    void refresh()
                }}
                notify={setToast}
            />

            <PreviewCreditDialog confirm={credit} />

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
