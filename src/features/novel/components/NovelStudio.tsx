/**
 * NovelStudio — the writing room. A thin layout shell: chapter rail (left),
 * manuscript editor (center), codex panel (right, collapsible). State lives
 * in the hooks (useNovelStudio / useChapterDraft / useCodex /
 * useGenerationHistory); the inline AI lifecycle lives inside NovelEditor.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MessageSquareQuote } from 'lucide-react'
import { useAuth, useData } from '@/app/hooks'
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
import { useWordGoal } from '../hooks/useWordGoal'
import { wordCount } from '../utils/novelUtils'
import { CodexPanel } from './codex/CodexPanel'
import { NovelChapterRail } from './NovelChapterRail'
import { NovelGenerationHistoryDrawer } from './NovelGenerationHistoryDrawer'
import { NovelStudioHeader } from './NovelStudioHeader'

export function NovelStudio() {
    const { t } = useTranslation()
    const { isAuthenticated, openLoginModal } = useAuth()
    const { generateStoryCandidate, acceptStoryGeneration, discardStoryGeneration } = useData()

    const studio = useNovelStudio()
    const story = studio.story
    const draft = useChapterDraft({ storyId: story?.id ?? null, chapter: studio.activeChapter })
    const codex = useCodex({ story })
    const history = useGenerationHistory({ story })
    const wordGoal = useWordGoal(story?.id ?? null, studio.activeChapter)

    const editorHandleRef = useRef<NovelEditorHandle | null>(null)
    const [critique, setCritique] = useState<StoryGeneration | null>(null)
    const [suggestionActive, setSuggestionActive] = useState(false)
    const [cardPickerOpen, setCardPickerOpen] = useState(false)
    const [cardPickerQuery, setCardPickerQuery] = useState('')
    const [wordGoalSaveFailed, setWordGoalSaveFailed] = useState(false)
    // Set when a chapter switch/add could not persist the current draft —
    // the user must explicitly choose to discard before we move away.
    const [pendingDiscard, setPendingDiscard] = useState<(() => void) | null>(null)

    const requireAuth = useCallback(() => {
        if (isAuthenticated) return true
        openLoginModal()
        return false
    }, [isAuthenticated, openLoginModal])

    const openCodexEntry = useOpenCodexEntry()
    const openCardPicker = useCallback(
        (query = '') => {
            if (!requireAuth()) return
            setCardPickerQuery(query)
            setCardPickerOpen(true)
        },
        [requireAuth],
    )

    // Ctrl/Cmd+S saves the draft instead of opening the browser dialog.
    const saveNow = draft.saveNow
    useEffect(() => {
        const handler = (event: KeyboardEvent) => {
            if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return
            if (event.key.toLowerCase() !== 's') return
            event.preventDefault()
            if (suggestionActive) return
            if (requireAuth()) void saveNow()
        }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [requireAuth, saveNow, suggestionActive])

    if (!story) return null
    const activeChapter = studio.activeChapter

    /** Resolve any live suggestion, then persist. Resolves false when the draft could not be saved. */
    const resolveSuggestionAndFlush = async (): Promise<boolean> => {
        await editorHandleRef.current?.resolveSuggestion('reject')
        return draft.flush()
    }

    const guardedLeave = (action: () => void) => {
        void resolveSuggestionAndFlush().then((clean) => {
            if (clean) action()
            // Leaving now would silently drop the unsaved draft — ask first.
            else setPendingDiscard(() => action)
        })
    }

    const handleSelectChapter = (id: string) => {
        if (id === activeChapter?.id) return
        guardedLeave(() => studio.selectChapter(id))
    }

    const handleAddChapter = () => {
        if (!requireAuth()) return
        guardedLeave(() => void studio.addChapter())
    }

    const handleDeleteChapter = (id: string) => {
        if (!requireAuth()) return
        void studio.deleteChapter(id)
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
        // history drawer shows this generation even if it gets rejected.
        history.record(generation, activeChapter.title)
        return generation
    }

    return (
        <div className="flex min-h-full w-full flex-1 flex-col">
            <NovelStudioHeader
                story={story}
                saveState={draft.saveState}
                lastSavedAt={draft.lastSavedAt}
                words={wordCount(draft.body)}
                goal={wordGoal.goal}
                onSetGoal={(goal) => {
                    if (!requireAuth()) return
                    setWordGoalSaveFailed(false)
                    void wordGoal.setGoal(goal).then((saved) => {
                        if (!saved) setWordGoalSaveFailed(true)
                    })
                }}
                focusMode={studio.focusMode}
                codexOpen={studio.codexOpen}
                typewriter={studio.typewriter}
                saveDisabled={suggestionActive}
                onSave={() => {
                    if (requireAuth()) void draft.saveNow()
                }}
                onToggleFocusMode={studio.toggleFocusMode}
                onToggleCodex={() => studio.setCodexOpen(!studio.codexOpen)}
                onToggleTypewriter={studio.toggleTypewriter}
                onOpenHistory={() => studio.setHistoryOpen(true)}
                onSaveMeta={(patch) => {
                    if (requireAuth()) void studio.saveNovelMeta(patch)
                }}
            />

            <div
                className={cx(
                    'grid min-h-0 flex-1 grid-cols-1',
                    !studio.focusMode &&
                        (studio.codexOpen
                            ? 'lg:grid-cols-[250px_minmax(0,1fr)_360px]'
                            : 'lg:grid-cols-[250px_minmax(0,1fr)]'),
                )}
            >
                {!studio.focusMode && (
                    <NovelChapterRail
                        chapters={studio.chapters}
                        activeChapterId={activeChapter?.id ?? null}
                        onSelect={handleSelectChapter}
                        onAdd={handleAddChapter}
                        onDelete={handleDeleteChapter}
                    />
                )}

                <section className="flex min-h-[640px] min-w-0 flex-col gap-3 bg-ink-800 px-4 py-5 sm:px-8">
                    <input
                        value={draft.title}
                        onChange={(event) => draft.setTitle(event.target.value)}
                        className="min-w-0 border-0 bg-transparent font-display text-2xl font-semibold leading-tight text-parchment-50 outline-none placeholder:text-parchment-500"
                        aria-label={t('novelEditor.studio.chapterTitleLabel')}
                        placeholder={t('novelEditor.studio.chapterTitlePlaceholder')}
                        data-testid="novel-chapter-title"
                    />
                    {activeChapter && (
                        <NovelEditor
                            key={activeChapter.id}
                            ref={editorHandleRef}
                            chapterId={activeChapter.id}
                            initialBody={activeChapter.body}
                            codexEntries={codex.mentionEntries}
                            detectionNames={codex.detectionNames}
                            loreEntries={codex.loreEntries}
                            focusMode={studio.focusMode}
                            typewriter={studio.typewriter}
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
                                const active = phase === 'pending' || phase === 'revealing' || phase === 'reviewing'
                                setSuggestionActive(active)
                                // Suspend autosave for 'prompting' too: a half-typed
                                // "/instruction" must never be persisted as body text.
                                draft.setSuspended(phase !== 'idle')
                            }}
                        />
                    )}
                </section>

                {!studio.focusMode && studio.codexOpen && (
                    <CodexPanel codex={codex} requireAuth={requireAuth} onOpenCardPicker={() => openCardPicker()} />
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
            <ConfirmDialog
                visible={pendingDiscard !== null}
                title={t('novelEditor.studio.discardTitle')}
                message={t('novelEditor.studio.discardMessage')}
                confirmLabel={t('novelEditor.studio.discardConfirm')}
                variant="danger"
                onConfirm={() => {
                    pendingDiscard?.()
                    setPendingDiscard(null)
                }}
                onCancel={() => setPendingDiscard(null)}
            />
        </div>
    )
}
