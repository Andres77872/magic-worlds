import type { TextGenerationOptions } from '@/shared/types/textGeneration.types'
/**
 * NovelStudio — the writing room. A thin layout shell: chapter rail (left),
 * manuscript (centre, with the status strip under it), codex panel (right,
 * collapsible). State lives in the hooks (useNovelStudio / useChapterDraft /
 * useCodex / useGenerationHistory / useStudioGuards); the AI lifecycle lives
 * inside NovelEditor, attached to the text it generated.
 *
 * Workspace R1: the story's workspace is captured when it opens
 * (`studio.workspace`). Pickers browse that workspace, late results are
 * dropped once it is no longer the committed one, and the leave guard runs for
 * every app navigation — including a workspace switch — before it proceeds.
 *
 * While the story's workspace is archived (`studio.readOnly`) the studio is a
 * reader: chapters, Find, the history drawer and the codex stay readable, and
 * every write control is disabled. A write that still gets asked for (Ctrl/Cmd+S)
 * shows the archived message and never sends a request.
 */

import { useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Archive, MessageSquareQuote } from 'lucide-react'
import { useData, useNavigation } from '@/app/hooks'
import { WorkspaceContext } from '@/app/providers/workspaceContext'
import { CodexCardPickerDrawer } from '@/features/codex'
import type { StoryGeneration } from '@/shared'
import { ARCHIVED_WORKSPACE_MESSAGE_KEY } from '@/shared/hooks/useWorkspaceReadOnly'
import { ConfirmDialog } from '@/ui/components/ConfirmDialog'
import { Markdown } from '@/ui/components/Markdown'
import { Button, Callout, Drawer, Icon, Toast, cx } from '@/ui/primitives'
import { NovelEditor } from '../editor/NovelEditor'
import type { InlineAIRequest, NovelEditorHandle } from '../editor/types'
import { useChapterDraft } from '../hooks/useChapterDraft'
import { useCodex } from '../hooks/useCodex'
import { useGenerationHistory } from '../hooks/useGenerationHistory'
import { useNovelStudio } from '../hooks/useNovelStudio'
import { useOpenCodexEntry } from '../hooks/useOpenCodexEntry'
import { useStudioGuards } from '../hooks/useStudioGuards'
import { useWordGoal } from '../hooks/useWordGoal'
import { wordCount } from '../utils/novelUtils'
import { CodexPanel } from './codex/CodexPanel'
import { NovelChapterRail } from './NovelChapterRail'
import { NovelGenerationHistoryDrawer } from './NovelGenerationHistoryDrawer'
import { NovelStudioHeader } from './NovelStudioHeader'
import { StudioStatusStrip } from './StudioStatusStrip'
import { LlmFeatureControl } from '@/features/llmProfiles/LlmFeatureControl'
import { isLlmRequestSpent } from '@/infrastructure/api/llmIntent'
import { makeRequestId } from '@/utils/uuid'

export function NovelStudio() {
    const { t } = useTranslation()
    const { setPage } = useNavigation()
    const { generateStoryCandidate, acceptStoryGeneration, discardStoryGeneration } = useData()

    const studio = useNovelStudio()
    const story = studio.story
    const storyWorkspace = studio.workspace
    const readOnly = Boolean(studio.readOnly)
    // The app shell's archived banner covers the committed workspace; a story
    // from another (archived) workspace says so here instead.
    const selectedWorkspaceId = useContext(WorkspaceContext)?.selectedWorkspaceId ?? null
    const showArchivedNotice = readOnly && storyWorkspace.workspaceId !== selectedWorkspaceId
    const draft = useChapterDraft({ storyId: story?.id ?? null, chapter: studio.activeChapter, workspace: storyWorkspace })
    const codex = useCodex({ story, workspace: storyWorkspace })
    const history = useGenerationHistory({ story })
    const wordGoal = useWordGoal(story?.id ?? null, studio.activeChapter, storyWorkspace)

    const editorHandleRef = useRef<NovelEditorHandle | null>(null)
    const guards = useStudioGuards({ editorHandleRef, flush: draft.flush, active: story !== null })
    const { requireAuth } = guards

    const [critique, setCritique] = useState<StoryGeneration | null>(null)
    const [critiquePreview, setCritiquePreview] = useState<{ text: string; state: 'generating' | 'saving' | 'interrupted' | 'failed' } | null>(null)
    const [suggestionActive, setSuggestionActive] = useState(false)
    const [cardPickerOpen, setCardPickerOpen] = useState(false)
    const [cardPickerQuery, setCardPickerQuery] = useState('')
    const [wordGoalSaveFailed, setWordGoalSaveFailed] = useState(false)
    const [saveBlocked, setSaveBlocked] = useState(false)
    const [archivedBlocked, setArchivedBlocked] = useState(false)
    // An unfinished generation keeps its request ID, so asking again for the same
    // command recovers that request instead of generating (and charging) twice.
    const attemptRef = useRef<{ key: string; requestId: string } | null>(null)

    // Every write passes here: read-only it says why instead, and sends nothing.
    const requireWritable = useCallback(() => {
        if (readOnly) {
            setArchivedBlocked(true)
            return false
        }
        return requireAuth()
    }, [readOnly, requireAuth])

    const openCodexEntry = useOpenCodexEntry()
    const openCardPicker = useCallback(
        (query = '') => {
            if (!requireWritable()) return
            setCardPickerQuery(query)
            setCardPickerOpen(true)
        },
        [requireWritable],
    )

    // Ctrl/Cmd+S saves the draft instead of opening the browser dialog. It must
    // never be a silent no-op: swallowing the most reflexive keystroke in a
    // manuscript app with no feedback is how writers stop trusting autosave.
    const saveNow = draft.saveNow
    useEffect(() => {
        const handler = (event: KeyboardEvent) => {
            if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return
            if (event.key.toLowerCase() !== 's') return
            event.preventDefault()
            if (suggestionActive) {
                setSaveBlocked(true)
                return
            }
            if (requireWritable()) void saveNow()
        }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [requireWritable, saveNow, suggestionActive])

    if (!story) return null
    const activeChapter = studio.activeChapter

    const handleSelectChapter = (id: string) => {
        if (id === activeChapter?.id) return
        guards.guardedLeave(() => studio.selectChapter(id))
    }

    const handleAddChapter = () => {
        if (!requireWritable()) return
        guards.guardedLeave(() => void studio.addChapter())
    }

    const handleGenerate = async (request: InlineAIRequest, options?: TextGenerationOptions): Promise<StoryGeneration> => {
        // Generating writes a candidate to the story: never while read-only.
        if (readOnly) throw new Error(t(ARCHIVED_WORKSPACE_MESSAGE_KEY))
        if (!requireAuth()) throw new Error(t('novelEditor.studio.loginRequired'))
        if (!activeChapter) throw new Error(t('novelEditor.studio.noChapter'))
        // No contextSettings override: the backend resolves the story's stored
        // activeContext itself, so sending a copy is pure duplication.
        const candidate = {
            chapterId: activeChapter.id,
            command: request.command,
            instruction: request.instruction,
            selection: request.selection,
        }
        const key = JSON.stringify([story.id, candidate])
        if (attemptRef.current?.key !== key) attemptRef.current = { key, requestId: makeRequestId('mw-story-generate') }
        const attempt = attemptRef.current
        let generation: StoryGeneration
        try {
            generation = await generateStoryCandidate(story.id, candidate, { ...options, requestId: attempt.requestId })
            if (attemptRef.current === attempt) attemptRef.current = null
        } catch (error) {
            // A deliberate stop or a spent request starts fresh next time.
            if (attemptRef.current === attempt && (options?.signal?.aborted || isLlmRequestSpent(error))) attemptRef.current = null
            throw error
        }
        // The story payload only refreshes on accept — record locally so the
        // history drawer shows this generation even if it gets declined, and so
        // the prompt outlives the request that carried it.
        if (storyWorkspace.isCurrent()) history.record(generation, activeChapter.title, request.prompt)
        return generation
    }

    const enabledCodexCount = codex.entries.filter((entry) => entry.enabled).length
    // What actually reached the model last time IN THIS CHAPTER. The history is
    // story-wide, and a trace from another chapter would describe a prompt that
    // was never built for the text on screen.
    const latestTrace =
        history.generations.find((generation) => generation.chapterId === activeChapter?.id)?.contextTrace ?? null

    return (
        <div className="flex min-h-full w-full flex-1 flex-col">
            <NovelStudioHeader
                story={story}
                chapterTitle={draft.title}
                focusMode={studio.focusMode}
                codexOpen={studio.codexOpen}
                typewriter={studio.typewriter}
                onToggleFocusMode={studio.toggleFocusMode}
                onToggleCodex={() => studio.setCodexOpen(!studio.codexOpen)}
                onToggleTypewriter={studio.toggleTypewriter}
                onOpenHistory={() => studio.setHistoryOpen(true)}
                onOpenFind={() => editorHandleRef.current?.openFind()}
                onBack={() => guards.guardedLeave(() => setPage('gallery-stories'))}
                onSaveMeta={(patch) => {
                    if (requireWritable()) void studio.saveNovelMeta(patch)
                }}
                readOnly={readOnly}
            />

            {showArchivedNotice && (
                <div className="border-b border-line p-3">
                    <Callout tone="warning" role="status" icon={<Icon icon={Archive} size={16} />} data-testid="novel-archived-notice">
                        {t(ARCHIVED_WORKSPACE_MESSAGE_KEY)}
                    </Callout>
                </div>
            )}
            <div className="border-b border-line p-3"><LlmFeatureControl feature="novel" disabled={suggestionActive || readOnly} /></div>
            <div
                className={cx(
                    'grid min-h-0 flex-1 grid-cols-1',
                    !studio.focusMode &&
                        (studio.codexOpen
                            ? 'lg:grid-cols-[224px_minmax(0,1fr)_300px]'
                            : 'lg:grid-cols-[224px_minmax(0,1fr)]'),
                )}
            >
                {!studio.focusMode && (
                    <NovelChapterRail
                        chapters={studio.chapters}
                        activeChapterId={activeChapter?.id ?? null}
                        onSelect={handleSelectChapter}
                        onAdd={handleAddChapter}
                        onDelete={(id) => {
                            if (requireWritable()) void studio.deleteChapter(id)
                        }}
                        readOnly={readOnly}
                    />
                )}

                <section className="flex min-h-[640px] min-w-0 flex-col bg-ink-800">
                    {/* Aligned to the prose measure so the title sits over the column
                        rather than over the page. */}
                    <div className="mx-auto w-full max-w-[var(--width-manuscript)] px-7 pt-6">
                        <input
                            value={draft.title}
                            onChange={(event) => draft.setTitle(event.target.value)}
                            readOnly={readOnly}
                            className="min-w-0 w-full border-0 bg-transparent font-display text-h3 font-semibold leading-tight text-parchment-50 placeholder:text-parchment-500"
                            aria-label={t('novelEditor.studio.chapterTitleLabel')}
                            placeholder={t('novelEditor.studio.chapterTitlePlaceholder')}
                            data-testid="novel-chapter-title"
                        />
                    </div>
                    {activeChapter && (
                        <NovelEditor
                            key={activeChapter.id}
                            ref={editorHandleRef}
                            initialBody={activeChapter.body}
                            codexEntries={codex.mentionEntries}
                            detectionNames={codex.detectionNames}
                            loreEntries={codex.loreEntries}
                            focusMode={studio.focusMode}
                            typewriter={studio.typewriter}
                            readOnly={readOnly}
                            enabledContextCount={enabledCodexCount}
                            onOpenCodexEntry={(id) => {
                                const entry = codex.entries.find((candidate) => candidate.id === id)
                                if (entry) openCodexEntry(entry)
                            }}
                            onAddToCodex={readOnly ? undefined : (text) => openCardPicker(text)}
                            onBodyChange={draft.onBodyChange}
                            onRequestSaveFlush={draft.flush}
                            onGenerate={handleGenerate}
                            onAcceptGeneration={async (generationId) => {
                                // Read-only, a candidate simply stays a candidate.
                                if (readOnly) return
                                await acceptStoryGeneration(story.id, generationId)
                                if (storyWorkspace.isCurrent()) history.patchStatus(generationId, 'accepted')
                            }}
                            onDiscardGeneration={async (generationId) => {
                                if (readOnly) return
                                await discardStoryGeneration(story.id, generationId)
                                if (storyWorkspace.isCurrent()) history.patchStatus(generationId, 'rejected')
                            }}
                            onCritiquePreview={(text, state) => {
                                setCritique(null)
                                setCritiquePreview((current) => ({ text: state === 'interrupted' ? current?.text ?? text : text, state }))
                            }}
                            onCritiqueResult={(generation) => { setCritiquePreview(null); setCritique(generation) }}
                            onSuggestionPhaseChange={(phase) => {
                                setSuggestionActive(phase === 'pending' || phase === 'reviewing')
                                // Suspend autosave for 'prompting' too: a half-typed
                                // "/query" is still document text.
                                draft.setSuspended(phase !== 'idle')
                            }}
                        />
                    )}
                    <StudioStatusStrip
                        words={wordCount(draft.body)}
                        goal={wordGoal.goal}
                        onSetGoal={(goal) => {
                            if (!requireWritable()) return
                            setWordGoalSaveFailed(false)
                            void wordGoal.setGoal(goal).then((saved) => {
                                if (!saved && storyWorkspace.isCurrent()) setWordGoalSaveFailed(true)
                            })
                        }}
                        saveState={draft.saveState}
                        lastSavedAt={draft.lastSavedAt}
                        onRetrySave={() => {
                            if (requireWritable()) void draft.saveNow()
                        }}
                        readOnly={readOnly}
                    />
                </section>

                {!studio.focusMode && studio.codexOpen && (
                    <CodexPanel
                        codex={codex}
                        workspaceId={storyWorkspace.workspaceId}
                        requireAuth={requireWritable}
                        onOpenCardPicker={() => openCardPicker()}
                        contextTrace={latestTrace}
                    />
                )}
            </div>

            <CodexCardPickerDrawer
                open={cardPickerOpen}
                workspaceId={storyWorkspace.workspaceId}
                busy={codex.busy}
                readOnly={readOnly}
                existingCardKeys={codex.existingCardKeys}
                initialQuery={cardPickerQuery}
                onClose={() => setCardPickerOpen(false)}
                onAdd={codex.addCards}
            />

            <NovelGenerationHistoryDrawer
                open={studio.historyOpen}
                generations={history.generations}
                onClose={() => studio.setHistoryOpen(false)}
            />

            <Drawer
                open={critique !== null || critiquePreview !== null}
                onClose={() => {
                    if (critiquePreview?.state === 'generating' || critiquePreview?.state === 'saving') void editorHandleRef.current?.resolveSuggestion('reject')
                    setCritique(null); setCritiquePreview(null)
                }}
                eyebrow={t('novelEditor.critique.eyebrow')}
                title={t('novelEditor.critique.title')}
                icon={<Icon icon={MessageSquareQuote} size={18} />}
                size="lg"
            >
                {critiquePreview && (
                    <div className="space-y-4">
                        <p role="status" className="text-caption text-parchment-400">{t(`streaming.${critiquePreview.state}`)}</p>
                        <div aria-live="off"><Markdown content={critiquePreview.text} /></div>
                        {(critiquePreview.state === 'generating' || critiquePreview.state === 'saving') && (
                            <Button variant="secondary" onClick={() => void editorHandleRef.current?.resolveSuggestion('reject')}>{t('common.cancel')}</Button>
                        )}
                    </div>
                )}
                {critique && <><p role="status" className="sr-only">{t('streaming.completed')}</p><Markdown content={critique.output} /></>}
            </Drawer>
            <Toast
                open={wordGoalSaveFailed}
                tone="error"
                title={t('novelEditor.header.goalSaveFailed')}
                message={t('novelEditor.header.goalSaveFailedBody')}
                onClose={() => setWordGoalSaveFailed(false)}
            />
            <Toast
                open={archivedBlocked}
                tone="error"
                title={t(ARCHIVED_WORKSPACE_MESSAGE_KEY)}
                onClose={() => setArchivedBlocked(false)}
            />
            <Toast
                open={saveBlocked}
                tone="error"
                title={t('novelEditor.save.blockedTitle')}
                message={t('novelEditor.save.blockedBody')}
                autoCloseMs={4000}
                onClose={() => setSaveBlocked(false)}
            />
            <ConfirmDialog
                visible={guards.discardPending}
                title={t('novelEditor.studio.discardTitle')}
                message={t('novelEditor.studio.discardMessage')}
                confirmLabel={t('novelEditor.studio.discardConfirm')}
                variant="danger"
                onConfirm={guards.confirmDiscard}
                onCancel={guards.cancelDiscard}
            />
        </div>
    )
}
