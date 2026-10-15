/**
 * Signed-in voices workspace: explore distinct speakers first, then save a
 * selected voice's delivery settings. Saved settings retain previews, owner
 * prompts, credit accounting and provider-specific controls. Root creation
 * and catalogue management are explicit navigation actions.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AudioLines, Loader2, Plus, RefreshCw, Settings2 } from 'lucide-react'
import { useAuth } from '@/app/hooks'
import { apiService } from '@/infrastructure/api'
import type { CatalogVoice, PreviewTextId, VoiceCapabilities, VoicePreset } from '@/shared'
import { ConfirmDialog } from '@/ui/components/ConfirmDialog'
import { EmptyState } from '@/ui/components/common/EmptyState'
import { Badge, Button, Callout, Icon, IconButton, IconTile, PageHeader, TabPanel, Tabs, Toast } from '@/ui/primitives'
import { useCatalogLookup } from '../hooks/useCatalogLookup'
import { usePreferredLanguage } from '../hooks/usePreferredLanguage'
import {
    editorModeFor,
    isFreeSamplePreview,
    presetLanguage,
    presetVoiceKeys,
    studioPreviewLanguage,
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
import { defaultPreviewTier } from './TierToggle'
import type { VoiceReplacement } from './VoiceOwnerPrompts'
import { VoiceUsageStrip } from './VoiceUsageStrip'
import { CatalogVoicePicker } from './CatalogVoicePicker'

/** Preset cards audition the narration line; the editor offers all three texts (D18). */
const CARD_PREVIEW_TEXT: PreviewTextId = 'narration'

interface EditorState {
    open: boolean
    mode: PresetEditorV2Mode
    source: VoicePreset | null
    /** Open on the voice picker (an owner prompt). */
    pickVoice?: boolean
    initialVoice?: CatalogVoice
}

const CLOSED: EditorState = { open: false, mode: 'create', source: null }

export type VoiceStudioTab = 'catalog' | 'saved'

interface VoiceStudioV2Props {
    capabilities: VoiceCapabilities | null
    /** Re-read the capabilities (the recipe controls' retry). */
    onRetryCapabilities?: () => void
    initialTab?: VoiceStudioTab
    /** The open tab changed (the page keeps it in the URL). */
    onTabChange?: (tab: VoiceStudioTab) => void
    /** Root only: open the console on voice creation. */
    onCreateVoice?: () => void
    /** Root only: open the console's catalog. */
    onManageVoices?: () => void
    /** Root only: open one catalog voice in the console. */
    onManageVoice?: (voice: CatalogVoice) => void
}

export function VoiceStudioV2({ capabilities, onRetryCapabilities, initialTab = 'catalog', onTabChange, onCreateVoice, onManageVoices, onManageVoice }: VoiceStudioV2Props) {
    const { t } = useTranslation()
    const { isAuthenticated, openLoginModal, userHash } = useAuth()
    const [rows, setRows] = useState<VoicePreset[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [toast, setToast] = useState<PresetEditorV2Toast | null>(null)
    const [editor, setEditor] = useState<EditorState>(CLOSED)
    const [tab, setTabState] = useState<VoiceStudioTab>(initialTab)
    const setTab = useCallback((next: VoiceStudioTab) => {
        setTabState(next)
        onTabChange?.(next)
    }, [onTabChange])
    const [pendingDelete, setPendingDelete] = useState<VoicePreset | null>(null)
    const [deletingId, setDeletingId] = useState<string | null>(null)
    const [previewId, setPreviewId] = useState<string | null>(null)
    // The card the hook's preview belongs to, read after an await (a save or a switch).
    const previewIdRef = useRef<string | null>(null)
    const [switchingId, setSwitchingId] = useState<string | null>(null)
    const preferred = usePreferredLanguage(isAuthenticated)

    const voiceKeys = useMemo(() => presetVoiceKeys(rows), [rows])
    const lookup = useCatalogLookup(voiceKeys, isAuthenticated)
    const recipePreview = useRecipePreview({ enabled: isAuthenticated })
    const credit = usePreviewCreditConfirm(userHash)
    const appLanguage = usePreviewLanguage()
    // The editor's default (05 §5.5, D17): language_code, then primary language, then the preferred one.
    const languageOf = useCallback((row: VoicePreset) => studioPreviewLanguage(row.voice_key ? lookup.get(row.voice_key) : null, {
        languageCode: row.language_code,
        preferredLanguage: preferred.language,
        fallback: appLanguage,
    }), [appLanguage, lookup, preferred.language])
    const previewTexts = usePreviewTextSets(rows.map(languageOf), isAuthenticated)
    const cardTier = defaultPreviewTier(capabilities)
    /** The BFF answers this card's preview with the voice's own sample: an untuned recipe whose voice has one (EP-6, AC-P2). */
    const cardIsFreeSample = (row: VoicePreset) =>
        !(row.provider === 'fish_audio' && row.performance) && isFreeSamplePreview(row.settings, row.emotion, lookup.get(row.voice_key), previewTexts(languageOf(row)).language, cardTier)
    /**
     * A card preview past the free renders costs 1 credit unless the BFF serves the
     * voice's own sample (AC-P5). Until the catalog item is in, it counts as paid.
     */
    const cardCostsCredit = (row: VoicePreset) => recipePreview.nextCostsCredit && !cardIsFreeSample(row)

    const mine = rows.filter((row) => !row.is_global)
    const globals = rows.filter((row) => row.is_global)

    const refresh = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            // R-15: every row the server sends.
            setRows(await apiService.listVoicePresets())
        } catch (failure) {
            setError(failure instanceof Error && failure.message ? failure.message : t('voices.studio.loadError'))
        } finally {
            setLoading(false)
        }
    }, [t])

    useEffect(() => {
        if (!isAuthenticated) return
        /* eslint-disable-next-line react-hooks/set-state-in-effect -- the preset list is a backend read */
        void refresh()
    }, [isAuthenticated, refresh])

    const openEditorFor = (row: VoicePreset, pickVoice = false) =>
        setEditor({ open: true, mode: editorModeFor(row), source: row, pickVoice })

    /** A rewritten preset's card clip and 05 §6.4 notice were for its old recipe: drop them. */
    const forgetCardPreview = (presetId: string) => {
        if (previewIdRef.current !== presetId) return
        previewIdRef.current = null
        setPreviewId(null)
        recipePreview.reset()
    }

    // 05 §7.8 "Switch to {replacement}": the same preset, the replacement voice, its own settings and emotion.
    const switchVoice = async (row: VoicePreset, replacement: VoiceReplacement) => {
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

    const preview = (row: VoicePreset) => {
        if (previewId === row.preset_id && recipePreview.loading) {
            recipePreview.stop()
            return
        }
        const input = {
            voiceKey: row.voice_key,
            ...(row.provider === 'fish_audio' && row.performance ? { performance: row.performance } : {}),
            provider: row.provider,
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

    const renderRow = (row: VoicePreset) => {
        const previewing = previewId === row.preset_id && recipePreview.loading
        const clip = recipePreview.clip?.key === row.preset_id ? recipePreview.clip : null
        const previewProblem = previewId === row.preset_id ? recipePreview.problem : null
        const mode = editorModeFor(row)
        return (
            <PresetCardV2
                key={row.preset_id}
                row={row}
                catalogItem={row.voice_key ? lookup.get(row.voice_key) ?? null : null}
                language={presetLanguage(row, preferred.language)}
                switching={switchingId === row.preset_id}
                onSwitchVoice={!row.is_global ? (replacement) => void switchVoice(row, replacement) : undefined}
                onChooseVoice={mode === 'edit' ? () => openEditorFor(row, true) : undefined}
                previewing={previewing}
                // The hard limit stops renders; the free sample still plays (the editor's rule, AC-P2).
                previewDisabled={recipePreview.limitReached && !cardIsFreeSample(row)}
                previewCostsCredit={cardCostsCredit(row)}
                // Before it plays: once played, the sample's player says it.
                previewFree={!clip && cardIsFreeSample(row)}
                deleting={deletingId === row.preset_id}
                onPreview={() => preview(row)}
                onEdit={mode === 'edit' ? () => openEditorFor(row) : undefined}
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
                    onPickVoice={() => openEditorFor(row, true)}
                />
            </PresetCardV2>
        )
    }

    const newPreset = () => setEditor({ open: true, mode: 'create', source: null })
    const exploreVoices = () => setTab('catalog')
    const hasAllowance = recipePreview.previewsLeft !== null || Boolean(recipePreview.usage?.narration || recipePreview.usage?.call)
    const rootActions = onManageVoices || onCreateVoice

    return (
        <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-6 px-5 py-8 sm:px-8 sm:py-10" data-testid="voice-studio-v2">
            <PageHeader
                eyebrow={t('voices.studio.eyebrow')}
                eyebrowTone="ember"
                icon={<IconTile icon={AudioLines} tone="ember" />}
                title={t('voices.studio.title')}
                subtitle={t('voices.studio.subtitle')}
                size="lg"
                // Root tools only; tab-specific actions live in their tab, so the header never shifts.
                actions={rootActions && (
                    <div className="flex flex-wrap gap-2">
                        {onManageVoices && <Button variant="secondary" size="sm" iconLeft={<Icon icon={Settings2} size={15} />} onClick={onManageVoices}>
                            {t('voices.studio.v2.manageVoices')}
                        </Button>}
                        {onCreateVoice && <Button variant="primary" size="sm" iconLeft={<Icon icon={Plus} size={15} />} onClick={onCreateVoice}>
                            {t('voices.studio.v2.createVoice')}
                        </Button>}
                    </div>
                )}
                divider
            />

            <Tabs options={[
                { value: 'catalog', label: t('voices.studio.v2.catalogTab') },
                {
                    value: 'saved',
                    label: t('voices.studio.v2.savedTab'),
                    // A glance at how many there are; the list itself names each one.
                    trailing: rows.length > 0 ? <Badge tone="neutral" aria-hidden="true">{rows.length}</Badge> : undefined,
                },
            ]} value={tab} onChange={setTab} idBase="voice-studio-sections" aria-label={t('voices.studio.v2.tabsLabel')} />

            <TabPanel value="catalog" active={tab} idBase="voice-studio-sections">
                <CatalogVoicePicker enabled={tab === 'catalog' && !editor.open} allLanguagesInitially capabilities={capabilities}
                    pickLabel={t('voices.studio.v2.configureVoice')}
                    onManage={onManageVoice}
                    onPick={(voice) => setEditor({ open: true, mode: 'create', source: null, initialVoice: voice })} />
            </TabPanel>

            <TabPanel value="saved" active={tab} idBase="voice-studio-sections">
                <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_17.5rem] lg:items-start">
                    <div className="flex min-w-0 flex-col gap-5">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <p className="max-w-2xl font-ui text-body text-parchment-300">{t('voices.studio.v2.savedHelp')}</p>
                            <div className="flex items-center gap-2">
                                <IconButton label={t('voices.studio.v2.refreshSaved')} size="sm" disabled={loading} onClick={() => void refresh()}>
                                    <Icon icon={RefreshCw} size={15} className={loading ? 'animate-spin' : undefined} />
                                </IconButton>
                                <Button variant="secondary" size="sm" iconLeft={<Icon icon={Plus} size={15} />} onClick={newPreset}>{t('voices.studio.newPreset')}</Button>
                            </div>
                        </div>

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
                                button={{ label: t('voices.studio.v2.exploreVoices'), onClick: exploreVoices }}
                            />
                        ) : (
                            <div className="flex flex-col gap-6">
                                <PreviewAllowanceHint previewsLeft={recipePreview.previewsLeft} loading={recipePreview.loading} />
                                <section aria-labelledby="voice-studio-mine" className="flex flex-col gap-1">
                                    <h2 id="voice-studio-mine" className="font-display text-h3 text-parchment-50">{t('voices.studio.v2.myPresets')}</h2>
                                    {mine.length === 0 ? (
                                        <div className="flex flex-wrap items-center gap-3 py-3">
                                            <p className="font-ui text-sm text-parchment-300">{t('voices.studio.emptyHelper')}</p>
                                            <Button variant="ghost" size="sm" onClick={exploreVoices}>{t('voices.studio.v2.exploreVoices')}</Button>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col divide-y divide-line-faint">{mine.map(renderRow)}</div>
                                    )}
                                </section>
                                {globals.length > 0 && (
                                    <section aria-labelledby="voice-studio-global" className="flex flex-col gap-1">
                                        <h2 id="voice-studio-global" className="font-display text-h3 text-parchment-50">{t('voices.studio.v2.globalPresets')}</h2>
                                        <p className="font-ui text-caption text-fg-muted">{t('voices.studio.v2.readOnlyGlobal')}</p>
                                        <div className="flex flex-col divide-y divide-line-faint">{globals.map(renderRow)}</div>
                                    </section>
                                )}
                            </div>
                        )}
                    </div>

                    <aside className="flex flex-col gap-4 lg:sticky lg:top-6" aria-label={t('voices.studio.v2.accountSettings')}>
                        <section className="flex flex-col gap-3 rounded-lg border border-line-faint bg-surface-raised p-4" aria-labelledby="voice-studio-quality">
                            <div className="flex flex-col gap-1">
                                <h2 id="voice-studio-quality" className="font-ui text-label font-semibold text-parchment-100">{t('voices.studio.v2.elevenLabsQuality')}</h2>
                                <p className="font-ui text-caption text-fg-muted">{t('voices.studio.v2.fishQuality')}</p>
                            </div>
                            <NarrationTierSetting />
                        </section>
                        {hasAllowance && (
                            <section className="flex flex-col gap-2 rounded-lg border border-line-faint bg-surface-raised p-4" aria-labelledby="voice-studio-allowance">
                                <h2 id="voice-studio-allowance" className="font-ui text-label font-semibold text-parchment-100">{t('voices.studio.v2.allowanceTitle')}</h2>
                                <VoiceUsageStrip usage={recipePreview.usage} previewsLeft={recipePreview.previewsLeft} stacked />
                            </section>
                        )}
                    </aside>
                </div>
            </TabPanel>

            <PresetEditorV2
                open={editor.open}
                mode={editor.mode}
                source={editor.source}
                initialVoice={editor.initialVoice}
                capabilities={capabilities}
                onRetryCapabilities={onRetryCapabilities}
                pickVoiceOnOpen={editor.pickVoice}
                userHash={userHash}
                onClose={closeEditor}
                onSaved={(row) => {
                    setTab('saved')
                    // An edit rewrote the source row in place.
                    const rewritten = editor.mode === 'edit' ? editor.source?.preset_id ?? row?.preset_id : null
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
