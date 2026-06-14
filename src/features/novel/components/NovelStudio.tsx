/**
 * NovelStudio — the writing room. A thin layout shell: chapter rail (left),
 * manuscript editor (center), codex panel (right, collapsible). State lives
 * in the hooks (useNovelStudio / useChapterDraft / useCodex /
 * useGenerationHistory); the inline AI lifecycle lives inside NovelEditor.
 */

import { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MessageSquareQuote } from 'lucide-react'
import { useAuth, useData } from '@/app/hooks'
import type { StoryContextSettings, StoryGeneration } from '@/shared'
import { Drawer, Icon, cx } from '@/ui/primitives'
import { NovelEditor } from '../editor/NovelEditor'
import type { InlineAIRequest, NovelEditorHandle } from '../editor/types'
import { useChapterDraft } from '../hooks/useChapterDraft'
import { useCodex } from '../hooks/useCodex'
import { useGenerationHistory } from '../hooks/useGenerationHistory'
import { useNovelStudio } from '../hooks/useNovelStudio'
import { wordCount } from '../utils/novelUtils'
import { CodexPanel } from './codex/CodexPanel'
import { NovelChapterRail } from './NovelChapterRail'
import { NovelGenerationHistoryDrawer } from './NovelGenerationHistoryDrawer'
import { NovelStudioHeader } from './NovelStudioHeader'

const DEFAULT_CONTEXT_SETTINGS: StoryContextSettings = {
    includeSelectedCards: true,
    includeMentionedCards: true,
    includeLorebooks: true,
    includeRecentScenes: 2,
    tokenBudget: 6000,
    styleSource: 'whole_story',
}

export function NovelStudio() {
    const { t } = useTranslation()
    const { isAuthenticated, openLoginModal } = useAuth()
    const { generateStoryCandidate, acceptStoryGeneration, discardStoryGeneration } = useData()

    const studio = useNovelStudio()
    const story = studio.story
    const draft = useChapterDraft({ storyId: story?.id ?? null, chapter: studio.activeChapter })
    const codex = useCodex({ story })
    const history = useGenerationHistory({ story })

    const editorHandleRef = useRef<NovelEditorHandle | null>(null)
    const [critique, setCritique] = useState<StoryGeneration | null>(null)
    const [suggestionActive, setSuggestionActive] = useState(false)

    const requireAuth = useCallback(() => {
        if (isAuthenticated) return true
        openLoginModal()
        return false
    }, [isAuthenticated, openLoginModal])

    if (!story) return null
    const activeChapter = studio.activeChapter

    const resolveSuggestionAndFlush = async () => {
        await editorHandleRef.current?.resolveSuggestion('reject')
        await draft.flush()
    }

    const handleSelectChapter = (id: string) => {
        if (id === activeChapter?.id) return
        void resolveSuggestionAndFlush().then(() => studio.selectChapter(id))
    }

    const handleAddChapter = () => {
        if (!requireAuth()) return
        void resolveSuggestionAndFlush().then(() => studio.addChapter())
    }

    const handleDeleteChapter = (id: string) => {
        if (!requireAuth()) return
        void studio.deleteChapter(id)
    }

    const handleGenerate = async (request: InlineAIRequest): Promise<StoryGeneration> => {
        if (!requireAuth()) throw new Error(t('novelEditor.studio.loginRequired'))
        if (!activeChapter) throw new Error(t('novelEditor.studio.noChapter'))
        return generateStoryCandidate(story.id, {
            sceneId: activeChapter.id,
            command: request.command,
            instruction: request.instruction,
            selection: request.selection,
            contextSettings: { ...DEFAULT_CONTEXT_SETTINGS, ...(story.activeContext ?? {}) },
        })
    }

    return (
        <div className="flex min-h-full w-full flex-col">
            <NovelStudioHeader
                story={story}
                saveState={draft.saveState}
                lastSavedAt={draft.lastSavedAt}
                words={wordCount(draft.body)}
                focusMode={studio.focusMode}
                codexOpen={studio.codexOpen}
                saveDisabled={suggestionActive}
                onSave={() => {
                    if (requireAuth()) void draft.saveNow()
                }}
                onToggleFocusMode={studio.toggleFocusMode}
                onToggleCodex={() => studio.setCodexOpen(!studio.codexOpen)}
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
                                draft.setSuspended(active)
                            }}
                        />
                    )}
                </section>

                {!studio.focusMode && studio.codexOpen && <CodexPanel codex={codex} requireAuth={requireAuth} />}
            </div>

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
                <p className="m-0 whitespace-pre-wrap font-narrative text-[15px] leading-7 text-parchment-100">
                    {critique?.output}
                </p>
            </Drawer>
        </div>
    )
}
