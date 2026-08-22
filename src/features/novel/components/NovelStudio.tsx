/**
 * NovelStudio — the writing room. A thin layout shell: chapter rail (left),
 * manuscript (centre, with the status strip under it), codex panel (right,
 * collapsible). State lives in the hooks (useNovelStudio / useChapterDraft /
 * useCodex / useGenerationHistory / useStudioGuards); the AI lifecycle lives
 * inside NovelEditor, attached to the text it generated.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MessageSquareQuote } from 'lucide-react'
import { useData, useNavigation } from '@/app/hooks'
import { CodexCardPickerDrawer } from '@/features/codex'
import type { StoryGeneration } from '@/shared'
import { ConfirmDialog } from '@/ui/components/ConfirmDialog'
import { Markdown } from '@/ui/components/Markdown'
import { Drawer, Icon, Toast, cx } from '@/ui/primitives'
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

export function NovelStudio() {
    const { t } = useTranslation()
    const { setPage } = useNavigation()
    const { generateStoryCandidate, acceptStoryGeneration, discardStoryGeneration } = useData()

    const studio = useNovelStudio()
    const story = studio.story
    const draft = useChapterDraft({ storyId: story?.id ?? null, chapter: studio.activeChapter })
    const codex = useCodex({ story })
    const history = useGenerationHistory({ story })
    const wordGoal = useWordGoal(story?.id ?? null, studio.activeChapter)

    const editorHandleRef = useRef<NovelEditorHandle | null>(null)
    const guards = useStudioGuards({ editorHandleRef, flush: draft.flush })
    const { requireAuth } = guards

    const [critique, setCritique] = useState<StoryGeneration | null>(null)
    const [suggestionActive, setSuggestionActive] = useState(false)
    const [cardPickerOpen, setCardPickerOpen] = useState(false)
    const [cardPickerQuery, setCardPickerQuery] = useState('')
    const [wordGoalSaveFailed, setWordGoalSaveFailed] = useState(false)
    const [saveBlocked, setSaveBlocked] = useState(false)

    const openCodexEntry = useOpenCodexEntry()
    const openCardPicker = useCallback(
        (query = '') => {
            if (!requireAuth()) return
            setCardPickerQuery(query)
            setCardPickerOpen(true)
        },
        [requireAuth],
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
            if (requireAuth()) void saveNow()
        }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [requireAuth, saveNow, suggestionActive])

    if (!story) return null
    const activeChapter = studio.activeChapter

    const handleSelectChapter = (id: string) => {
        if (id === activeChapter?.id) return
        guards.guardedLeave(() => studio.selectChapter(id))
    }

    const handleAddChapter = () => {
        if (!requireAuth()) return
        guards.guardedLeave(() => void studio.addChapter())
    }

    const handleGenerate = async (request: InlineAIRequest): Promise<StoryGeneration> => {
        if (!requireAuth()) throw new Error(t('novelEditor.studio.loginRequired'))
        if (!activeChapter) throw new Error(t('novelEditor.studio.noChapter'))
        // No contextSettings override: the backend resolves the story's stored
        // activeContext itself, so sending a copy is pure duplication.
        const generation = await generateStoryCandidate(story.id, {
            chapterId: activeChapter.id,
            command: request.command,
            instruction: request.instruction,
            selection: request.selection,
        })
        // The story payload only refreshes on accept — record locally so the
        // history drawer shows this generation even if it gets declined, and so
        // the prompt outlives the request that carried it.
        history.record(generation, activeChapter.title, request.prompt)
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
                    if (requireAuth()) void studio.saveNovelMeta(patch)
                }}
            />

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
                            if (requireAuth()) void studio.deleteChapter(id)
                        }}
                    />
                )}

                <section className="flex min-h-[640px] min-w-0 flex-col bg-ink-800">
                    {/* Aligned to the prose measure so the title sits over the column
                        rather than over the page. */}
                    <div className="mx-auto w-full max-w-[var(--width-manuscript)] px-7 pt-6">
                        <input
                            value={draft.title}
                            onChange={(event) => draft.setTitle(event.target.value)}
                            className="min-w-0 w-full border-0 bg-transparent font-display text-h3 font-semibold leading-tight text-parchment-50 outline-none placeholder:text-parchment-500"
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
                            enabledContextCount={enabledCodexCount}
                            onOpenCodexEntry={(id) => {
                                const entry = codex.entries.find((candidate) => candidate.id === id)
                                if (entry) openCodexEntry(entry)
                            }}
                            onAddToCodex={(text) => openCardPicker(text)}
                            onBodyChange={draft.onBodyChange}
                            onRequestSaveFlush={draft.flush}
                            onGenerate={handleGenerate}
                            onAcceptGeneration={async (generationId) => {
                                await acceptStoryGeneration(story.id, generationId)
                                history.patchStatus(generationId, 'accepted')
                            }}
                            onDiscardGeneration={async (generationId) => {
                                await discardStoryGeneration(story.id, generationId)
                                history.patchStatus(generationId, 'rejected')
                            }}
                            onCritiqueResult={setCritique}
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
                            if (!requireAuth()) return
                            setWordGoalSaveFailed(false)
                            void wordGoal.setGoal(goal).then((saved) => {
                                if (!saved) setWordGoalSaveFailed(true)
                            })
                        }}
                        saveState={draft.saveState}
                        lastSavedAt={draft.lastSavedAt}
                        onRetrySave={() => {
                            if (requireAuth()) void draft.saveNow()
                        }}
                    />
                </section>

                {!studio.focusMode && studio.codexOpen && (
                    <CodexPanel
                        codex={codex}
                        requireAuth={requireAuth}
                        onOpenCardPicker={() => openCardPicker()}
                        contextTrace={latestTrace}
                    />
                )}
            </div>

            <CodexCardPickerDrawer
                open={cardPickerOpen}
                busy={codex.busy}
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
                open={critique !== null}
                onClose={() => setCritique(null)}
                eyebrow={t('novelEditor.critique.eyebrow')}
                title={t('novelEditor.critique.title')}
                icon={<Icon icon={MessageSquareQuote} size={18} />}
                size="lg"
            >
                {critique && <Markdown content={critique.output} />}
            </Drawer>
            <Toast
                open={wordGoalSaveFailed}
                tone="error"
                title={t('novelEditor.header.goalSaveFailed')}
                message={t('novelEditor.header.goalSaveFailedBody')}
                onClose={() => setWordGoalSaveFailed(false)}
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
