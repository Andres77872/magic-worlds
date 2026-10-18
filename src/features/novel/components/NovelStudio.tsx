import { useAssistantContextSource } from '../hooks/useAssistantContextSource'
import { NovelAssistantDrawer,type NovelAssistantHandle } from './NovelAssistantDrawer'
import type { SceneSummaryOutcome, SceneSummaryWriter } from './NovelAssistantSummaries'
import type { NovelCopyWriter } from './NovelAssistantCopy'
import { useNovelAssistantSource } from '../hooks/useNovelAssistantSource'
import { useStudioAssistantReview } from '../hooks/useStudioAssistantReview'
import { useSuggestionsTogether } from '../hooks/useSuggestionsTogether'
import { authorVariantTargetReadOnly,useAuthorVariantSource } from '../hooks/useAuthorVariantSource'
import { useStudioVariantReview } from '../hooks/useStudioVariantReview'
import { NovelAuthorVariants,type NovelAuthorVariantsHandle } from './NovelAuthorVariants'
import { NovelPrivateAuthorVersions, type PrivateAuthorVersionsHandle } from './NovelPrivateAuthorVersions'
import type { AuthorVariantDraft } from '../persistence/authorVariantJournal'
import type { NovelJournalRecord } from '@/shared/novelMutationJournal'
import { deviceCacheScope } from '../persistence/studioReadStorage'
import type { StoryAnnotationSelection } from '@/shared/types/storyAnnotation.types'
import { useInvisibleCharacters } from '../hooks/useInvisibleCharacters'
import { isStudioSource, studioInheritance, studioReviewVersion } from '@/shared/storyStudioState'
import { partBases, sameBasis, summaryBases } from '@/shared/storySummaryBasis'
import { partWritable } from '../utils/replySummaryState'
import { useGenerationHistorySource } from '../hooks/useGenerationHistorySource'
import { ApiError } from '@/infrastructure/api'
import { useManuscriptReadingSource } from '../hooks/useManuscriptReadingSource'
import { NovelManuscriptReader } from './NovelManuscriptReader'
import { NovelExportDialog } from './NovelExportDialog'
import { NovelPackageExportDialog } from './NovelPackageExportDialog'
import { NovelProgressDialog } from './NovelProgressDialog'
import { useWritingProgressSource } from '../hooks/useWritingProgressSource'
import { useManuscriptExportSource } from '../hooks/useManuscriptExportSource'
import { useNovelPackageSource } from '../hooks/useNovelPackageSource'
import type { StoryReadingPage,StoryReadingItem } from '@/shared/types/storyReading.types'
import { matchesReadingScene } from '@/shared/storyReading'
import { documentText,documentSignature } from '@/shared/storyDocument'
import type { StorySearchMatch,StorySearchPage,StorySearchResult } from '@/shared/types/storySearch.types'
import type { TextGenerationOptions } from '@/shared/types/textGeneration.types'
/**
 * NovelStudio — the writing room. A thin layout shell: chapter rail (left),
 * manuscript (centre, with the status strip under it), codex panel (right,
 * collapsible). State lives in the hooks (useNovelStudio / useSceneDraft /
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

import { useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Archive, MessageSquareQuote } from 'lucide-react'
import { useData, useNavigation } from '@/app/hooks'
import { WorkspaceContext } from '@/app/providers/workspaceContext'
import { CodexCardPickerDrawer } from '@/features/codex'
import type { StoryGeneration,StoryStructureOperation,StoryAnnotation,StoryAnnotationPoint,StoryVariantRecord,StoryOutline } from '@/shared'
import { isContentTypeFeatureEnabled, isLorebooksFeatureEnabled } from '@/shared/featureFlags'
import { normalizeLorebookList } from '@/features/lorebook/lorebookTransforms'
import { resolveAnnotationRange,resolveDocumentAnnotationRange } from '@/shared/storyAnnotationAnchors'
import type { ManuscriptSearchTarget } from '../editor/extensions/manuscriptSearchTarget'
import type { AnnotationSource } from '../hooks/useAnnotationSource'
import type { PersonalNoteDraft } from '../hooks/useAnnotationDrafts'
import { ARCHIVED_WORKSPACE_MESSAGE_KEY } from '@/shared/hooks/useWorkspaceReadOnly'
import { ConfirmDialog } from '@/ui/components/ConfirmDialog'
import { Markdown } from '@/ui/components/Markdown'
import { Button, Callout, Drawer, Icon, Toast, Field, Select, Textarea, cx } from '@/ui/primitives'
import { NovelEditor } from '../editor/NovelEditor'
import type { InlineAIRequest, NovelEditorHandle } from '../editor/types'
import { useSceneDraft } from '../hooks/useSceneDraft'
import { useCodex } from '../hooks/useCodex'
import { useGenerationHistory } from '../hooks/useGenerationHistory'
import { useNovelStudio } from '../hooks/useNovelStudio'
import { useOpenCodexEntry } from '../hooks/useOpenCodexEntry'
import { useStudioLayout } from '../hooks/useStudioLayout'
import { useReadingPreferences } from '../hooks/useReadingPreferences'
import { readingAttributes } from '../utils/readingPreferences'
import { NovelReadingPreferences } from './NovelReadingPreferences'
import { NovelTypingPreferences } from './NovelTypingPreferences'
import { useTypingPreferences } from '../hooks/useTypingPreferences'
import { useCompletionPreferences } from '../hooks/useCompletionPreferences'
import { completionInstruction } from '../utils/completions'
import { NovelManuscriptSearch } from './NovelManuscriptSearch'
import { useManuscriptSearchSource } from '../hooks/useManuscriptSearchSource'
import { useManuscriptReplacementSource } from '../hooks/useManuscriptReplacementSource'
import { useManuscriptReplacements } from '../hooks/useManuscriptReplacements'
import { NovelPendingReplacements } from './NovelPendingReplacements'
import { useStudioGuards } from '../hooks/useStudioGuards'
import { useScenePosition } from '../hooks/useScenePosition'
import { documentMarkdown } from '@/shared/storyDocument'
import { useWordGoal } from '../hooks/useWordGoal'
import { plainTextWordCount,chaptersFor } from '../utils/novelUtils'
import { CodexPanel } from './codex/CodexPanel'
import { NovelChapterRail,type OutlineTarget } from './NovelChapterRail'
import { NovelStructureDrawer } from './NovelStructureDrawer'
import { NovelPlanningViews } from './NovelPlanningViews'
import type { FactCodex } from './NovelFactCodexReview'
import { NovelReviewDrawer } from './NovelReviewDrawer'
import type { NovelSurface } from './NovelSurfaceSwitch'
import { usePlanItems, usePlanItemsSource } from '../hooks/usePlanItems'
import { NovelGenerationHistoryDrawer } from './NovelGenerationHistoryDrawer'
import { NovelRevisionDrawer } from './NovelRevisionDrawer'
import { NovelSnapshotDrawer } from './NovelSnapshotDrawer'
import { useSnapshotSource } from '../hooks/useSnapshotSource'
import { useSceneRevisionSource } from '../hooks/useSceneRevisionSource'
import { useSceneRestores } from '../hooks/useSceneRestores'
import { NovelPendingSceneRestores } from './NovelPendingSceneRestores'
import { usePersonalAnnotations } from '../hooks/usePersonalAnnotations'
import { NovelAnnotationDrawer } from './NovelAnnotationDrawer'
import { NovelPendingAnnotations } from './NovelPendingAnnotations'
import { captureAnnotationSelection,captureBookmarkSelection } from '../utils/annotationSelection'
import { NovelPendingLifecycle } from './NovelPendingLifecycle'
import { NovelPendingCreations } from './NovelPendingCreations'
import { NovelPendingCopies } from './NovelPendingCopies'
import { NovelCopyModal } from './NovelCopyModal'
import { NovelOutlineImportDialog } from './NovelOutlineImportDialog'
import { useNovelCopies } from '../hooks/useNovelCopies'
import { NovelStudioHeader } from './NovelStudioHeader'
import { StudioStatusStrip } from './StudioStatusStrip'
import { NovelSceneConflictModal } from './NovelSceneConflictModal'
import {NovelGenerationApplicationNotice} from './NovelGenerationApplicationNotice'
import { NovelRetainedSceneDrafts } from './NovelRetainedSceneDrafts'
import { LlmFeatureControl } from '@/features/llmProfiles/LlmFeatureControl'
import { isLlmRequestSpent } from '@/infrastructure/api/llmIntent'
import { makeRequestId } from '@/utils/uuid'

/** Library card kinds with saved versions: a Codex copy of one can stage discoveries into its draft. */
const LIBRARY_KINDS = new Set(['character', 'world', 'item'])

export function NovelStudio() {
    const { t } = useTranslation()
    const { setPage } = useNavigation()
    const { generateStoryCandidate, discardStoryGeneration,refreshStory,updateStoryScene,updateStoryChapter,updateStoryPart,updateStory,novelLifecycleStorageFailed } = useData()

    const studio = useNovelStudio()
    const reading = useReadingPreferences(studio.viewKey ?? null)
    const typing=useTypingPreferences(studio.viewKey??null)
    const invisibles=useInvisibleCharacters(studio.viewKey??null)
    const completions=useCompletionPreferences(studio.viewKey??null)
    const {containerRef,outlineDocked,inspectorDocked}=useStudioLayout(reading.preferences.width)
    const narrowPanel=studio.narrowPanel==='outline'&&!outlineDocked?'outline':studio.narrowPanel==='codex'&&!inspectorDocked?'codex':null
    const setNarrowPanel=studio.setNarrowPanel
    const [readingScope, setReadingScope] = useState<string | null>(null)
    const [typingScope,setTypingScope]=useState<string|null>(null)
    const story = studio.story
    const storyWorkspace = studio.workspace
    const readOnly = Boolean(studio.readOnly)
    // The app shell's archived banner covers the committed workspace; a story
    // from another (archived) workspace says so here instead.
    const workspaceContext = useContext(WorkspaceContext)
    const selectedWorkspaceId = workspaceContext?.selectedWorkspaceId ?? null
    const showArchivedNotice = readOnly && storyWorkspace.workspaceId !== selectedWorkspaceId
    const sceneRestores=useSceneRestores(story?.id??null,storyWorkspace,readOnly)
    const replacementSource=useManuscriptReplacementSource(story?.id??null,storyWorkspace)
    const replacements=useManuscriptReplacements(replacementSource,storyWorkspace.workspaceId,readOnly)
    const annotations=usePersonalAnnotations(story?.id??null,storyWorkspace,readOnly)
    const pendingSceneRestore=sceneRestores.hasPending(studio.activeScene?.id)
    const pendingReplacement=replacements.hasPending(studio.activeScene?.id)
    // Several scenes' suggestions being accepted or undone together hold the open scene as it is (R14).
    const [suggestionsBusy,setSuggestionsBusy]=useState(false)
    const draft = useSceneDraft({ storyId: story?.id ?? null, scene: studio.activeScene, workspace: storyWorkspace,blocked:pendingSceneRestore||pendingReplacement||suggestionsBusy })
    const revisionSource=useSceneRevisionSource(story?.id??null,studio.activeScene?.id??null,storyWorkspace)
    const position=useScenePosition(story?.id??null,studio.activeScene?.id??null,storyWorkspace.workspaceId)
    const requestedCodexScope=studio.codexScope??'novel'
    const codexScope=requestedCodexScope==='scene'&&!studio.activeScene?(studio.activeChapter?'chapter':'novel'):requestedCodexScope==='chapter'&&!studio.activeChapter?'novel':requestedCodexScope
    const setCodexScope=studio.setCodexScope
    const codex = useCodex({ story, workspace: storyWorkspace, scene:studio.activeScene, chapterId:studio.activeChapter?.id, chapterReadOnly:studio.activeChapter?.inheritance?.readOnly,scope:codexScope })
    const generationSource=useGenerationHistorySource(story&&isStudioSource(story)?story.id:null,storyWorkspace)
    const history = useGenerationHistory({story,scene:studio.activeScene,source:generationSource,open:studio.historyOpen})
    const wordGoal = useWordGoal(story?.id ?? null, studio.activeScene, storyWorkspace)

    const editorHandleRef = useRef<NovelEditorHandle | null>(null)
    const authorVariantsHandle=useRef<NovelAuthorVariantsHandle|null>(null)
    const privateAuthorHandle=useRef<PrivateAuthorVersionsHandle|null>(null)
    const assistantHandle=useRef<NovelAssistantHandle|null>(null)
    const guards = useStudioGuards({ editorHandleRef, flush: async()=>privateAuthorHandle.current?.preserve()===false||authorVariantsHandle.current?.preserve()===false||assistantHandle.current?.preserve()===false?false:draft.flush(), active: story !== null })
    const { requireAuth } = guards

    const [managing,setManaging]=useState<OutlineTarget|null>(null)
    // The text the outline import opens with (S18); null while it is closed.
    const [outlineImport,setOutlineImport]=useState<string|null>(null)
    const sceneReadOnly=readOnly||Boolean(studio.activeScene?.inheritance?.readOnly)||pendingSceneRestore||pendingReplacement||suggestionsBusy
    const [operationError, setOperationError] = useState(false)
    const [recoveryCopyKey, setRecoveryCopyKey] = useState<string | null>(null)
    const recoveryKey = draft.recovery ? JSON.stringify([studio.viewKey, draft.sceneId, draft.recovery.storageKey, draft.recovery.sequence]) : null
    const [revisionsOpen, setRevisionsOpen] = useState(false)
    const [snapshotsOpen,setSnapshotsOpen]=useState(false)
    const [exportOpen,setExportOpen]=useState(false)
    const [packageOpen,setPackageOpen]=useState(false)
    const [progressOpen,setProgressOpen]=useState(false)
    // Write, Plan or Review in the centre column (U01), for this novel only: another novel, or focus mode, is Write.
    const [surfaceState,setSurfaceState]=useState<{storyId:string|null;surface:NovelSurface}>({storyId:null,surface:'write'})
    const surface:NovelSurface=surfaceState.storyId===(story?.id??null)&&!studio.focusMode?surfaceState.surface:'write'
    const planningOpen=surface==='plan',reviewOpen=surface==='review'
    const centreRef=useRef<HTMLDivElement|null>(null)
    // The page keeps the manuscript's scroll position while Plan or Review is shown; they open at their top. A scene
    // opened from them starts at its top, where the editor restores that scene's own position.
    const writeScroll=useRef<{top:number;sceneId:string|null}>({top:0,sceneId:null}),shownSurface=useRef<NovelSurface>('write')
    const shownSceneId=studio.activeScene?.id??null
    const setSurface=(next:NovelSurface)=>{
        const main=centreRef.current?.closest<HTMLElement>('[data-app-main]')
        if(surface==='write'&&next!=='write'&&main)writeScroll.current={top:main.scrollTop,sceneId:shownSceneId}
        setSurfaceState({storyId:story?.id??null,surface:next})
    }
    // Leaving Plan or Review from their own controls (which then disappear) hands focus back to the switch.
    const switchFocus=useRef(false)
    const backToWrite=()=>{switchFocus.current=true;setSurface('write')}
    useLayoutEffect(()=>{
        const previous=shownSurface.current
        shownSurface.current=surface
        const main=centreRef.current?.closest<HTMLElement>('[data-app-main]')
        if(!main||previous===surface)return
        main.scrollTop=surface==='write'&&writeScroll.current.sceneId===shownSceneId?writeScroll.current.top:0
        if(surface==='write'&&switchFocus.current)centreRef.current?.closest('.novel-reading-room')?.querySelector<HTMLElement>('[data-testid="novel-surface-switch"] [aria-checked="true"]')?.focus({preventScroll:true})
        switchFocus.current=false
    },[surface,shownSceneId])
    const [annotationsOpen,setAnnotationsOpen]=useState(false)
    const [annotationsKind,setAnnotationsKind]=useState<'note'|'bookmark'>('note')
    const [annotationSeed,setAnnotationSeed]=useState<{owner:AnnotationSource;draft:PersonalNoteDraft}|null>(null)
    const [pendingBookmark,setPendingBookmark]=useState<{owner:AnnotationSource;sceneId:string;revision:number;contentHash:string;target:ManuscriptSearchTarget}|null>(null)
    const [bookmarkNotice,setBookmarkNotice]=useState<{owner:AnnotationSource;key:'opened'|'changed'|'blocked'}|null>(null)
    const openAnnotations=(kind:'note'|'bookmark'='note')=>{setAnnotationsKind(kind);setAnnotationSeed(null);setAnnotationsOpen(true)}
    const snapshotSource=useSnapshotSource(story?.id??null,storyWorkspace)
    const exportSource=useManuscriptExportSource(story?.id??null,storyWorkspace)
    const packageSource=useNovelPackageSource(story?.id??null,storyWorkspace)
    const progressSource=useWritingProgressSource(story?.id??null,storyWorkspace)
    const searchSource=useManuscriptSearchSource(story?.id??null,storyWorkspace)
    const planSource=usePlanItemsSource(story?.id??null,storyWorkspace)
    const planStash=usePlanItems(planSource,'stash',reviewOpen)
    const readerSource=useManuscriptReadingSource(story?.id??null,storyWorkspace)
    const assistantSource=useAssistantContextSource(story?.id??null,storyWorkspace)
    const novelAssistantSource=useNovelAssistantSource(assistantSource,storyWorkspace)
    const authorVariantSource=useAuthorVariantSource(story?.id??null,storyWorkspace)
    const [authorSession,setAuthorSession]=useState<{key:string;generationId:string;sceneId:string;startEditing:boolean;canCreate:boolean;recovery?:NovelJournalRecord<AuthorVariantDraft>}|null>(null)
    const [privateAuthorScope,setPrivateAuthorScope]=useState<string|null>(null)
    const authorReadOnly=authorVariantTargetReadOnly(story,authorSession?.sceneId??null,readOnly)
    const [assistantSession,setAssistantSession]=useState<{key:string;sceneId:string;selection:StoryAnnotationSelection|null;open:boolean}|null>(null)
    // Open tasks are counted on the Review switch, so they load with the novel.
    const planTasks=usePlanItems(planSource,'task',true)
    const planFacts=usePlanItems(planSource,'fact',planningOpen||Boolean(assistantSession?.open))
    const [readerSession,setReaderSession]=useState<{key:string;token:string}|null>(null)
    const readerLive=useRef<typeof readerSession>(null)
    const closeReader=()=>{readerLive.current=null;setReaderSession(null)}
    const [searchScope,setSearchScope]=useState<string|null>(null)
    const [pendingSearch,setPendingSearch]=useState<{scope:string;result:StorySearchResult;token:string}|null>(null)
    const [searchNotice,setSearchNotice]=useState<{scope:string;key:'blocked'|'changed'|'opened'}|null>(null)
    const searchLive=useRef({draft,scene:studio.activeScene,unit:studio.selectedUnit})
    useLayoutEffect(()=>{searchLive.current={draft,scene:studio.activeScene,unit:studio.selectedUnit}},[draft,studio.activeScene,studio.selectedUnit])
    const searchReady=Boolean(pendingSearch&&pendingSearch.scope===searchSource?.key&&studio.activeScene?.id===pendingSearch.result.match.sceneId&&draft.sceneId===studio.activeScene.id)
    const bookmarkReady=Boolean(pendingBookmark&&pendingBookmark.owner===annotations.source&&annotations.source?.isCurrent()&&studio.activeScene?.id===pendingBookmark.sceneId&&draft.sceneId===pendingBookmark.sceneId)
    const bookmarkChanged=Boolean(pendingBookmark&&bookmarkReady&&(studio.activeScene?.revision!==pendingBookmark.revision||studio.activeScene.contentHash!==pendingBookmark.contentHash))
    const searchSourceChanged=Boolean(pendingSearch&&searchReady&&(
        story?.structureRevision!==pendingSearch.result.sourceStructureRevision||story.metadataRevision!==pendingSearch.result.sourceMetadataRevision||story.contextRevision!==pendingSearch.result.sourceContextRevision
        ||studio.activeScene?.revision!==pendingSearch.result.match.revision||studio.activeScene.contentHash!==pendingSearch.result.match.contentHash
        ||studio.activeChapter?.metadataRevision!==pendingSearch.result.match.chapterMetadataRevision
        ||pendingSearch.result.match.partId!==null&&story.parts.find((part)=>part.id===pendingSearch.result.match.partId)?.metadataRevision!==pendingSearch.result.match.partMetadataRevision))
    const setSelectionGuard=studio.setSelectionGuard
    useLayoutEffect(()=>{
        setSelectionGuard?.(()=>{
            const live=searchLive.current
            return !editorHandleRef.current?.hasActiveSuggestion()&&!pendingSceneRestore&&!pendingReplacement&&!suggestionsBusy
                &&!live.draft.recovery&&!live.draft.conflictServer&&!live.draft.suspended&&['idle','saved'].includes(live.draft.saveState)
        })
        return()=>setSelectionGuard?.(null)
    },[setSelectionGuard,pendingSceneRestore,pendingReplacement,suggestionsBusy])
    const [critique, setCritique] = useState<StoryGeneration | null>(null)
    const [critiquePreview, setCritiquePreview] = useState<{ text: string; state: 'generating' | 'saving' | 'interrupted' | 'failed' } | null>(null)
    const [suggestionActive, setSuggestionActive] = useState(false)
    // Re-run a deferred same-scene refresh once the writer settles.
    const recheckSelection=studio.recheckSelection
    useEffect(()=>{recheckSelection?.()},[recheckSelection,draft.saveState,draft.recovery,draft.conflictServer,draft.suspended,suggestionActive,pendingSceneRestore,pendingReplacement,suggestionsBusy])
    const searchBlocked=Boolean(draft.recovery||draft.conflictServer||draft.suspended||pendingSceneRestore||pendingReplacement||suggestionActive||!['idle','saved'].includes(draft.saveState))
    const [cardPickerOpen, setCardPickerOpen] = useState(false)
    const [cardPickerQuery, setCardPickerQuery] = useState('')
    const [wordGoalSaveFailed, setWordGoalSaveFailed] = useState(false)
    const [saveBlocked, setSaveBlocked] = useState(false)
    const [copySourceId,setCopySourceId]=useState<string|null>(null)
    const [archivedBlocked, setArchivedBlocked] = useState(false)
    // An unfinished generation keeps its request ID, so asking again for the same
    // command recovers that request instead of generating (and charging) twice.
    const attemptRef = useRef<{ key: string; requestId: string } | null>(null)

    // Every write passes here: read-only it says why instead, and sends nothing.
    const requireWritable = useCallback(() => {
        if(pendingSceneRestore||pendingReplacement)return false
        if (sceneReadOnly) {
            setArchivedBlocked(true)
            return false
        }
        return requireAuth()
    }, [sceneReadOnly, requireAuth,pendingSceneRestore,pendingReplacement])

    const openCodexEntry = useOpenCodexEntry()
    const openCardPicker = useCallback(
        (query = '') => {
            if (codex.readOnly||!requireAuth()) return
            setCardPickerQuery(query)
            setCardPickerOpen(true)
        },
        [codex.readOnly,requireAuth],
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

    const beforeCopyOpen=async()=>{
        if(!requireAuth())return false
        if(privateAuthorHandle.current?.preserve()===false||authorVariantsHandle.current?.preserve()===false||assistantHandle.current?.preserve()===false){setSaveBlocked(true);return false}
        if(replacements.hasPending()){setSaveBlocked(true);return false}
        if(editorHandleRef.current?.hasActiveSuggestion()||!await draft.flush()){
            setSaveBlocked(true);return false
        }
        if(editorHandleRef.current?.hasActiveSuggestion()||replacements.hasPending()){setSaveBlocked(true);return false}
        return storyWorkspace.isCurrent()
    }
    const suggestionsTogether=useSuggestionsTogether({source:novelAssistantSource,readOnly:readOnly||Boolean(studio.workspaceReadOnly),beforeWrite:beforeCopyOpen,
        refresh:refreshStory,onBusy:setSuggestionsBusy,onAccepted:(ids)=>{if(storyWorkspace.isCurrent())for(const id of ids)history.patchStatus(id,'accepted')}})
    const reviewAssistantSuggestion = useStudioAssistantReview({ source: novelAssistantSource, story, scene: studio.activeScene,
        selectedUnit: studio.selectedUnit, draft, editorRef: editorHandleRef, readOnly,
        blocked: pendingSceneRestore || pendingReplacement, loadError: Boolean(studio.sceneLoadError), beforeReview: beforeCopyOpen,
        selectScene: studio.selectScene, onStaged: (generation, title) => {
            history.record(generation, title, generation.instruction ?? undefined)
            setAssistantSession(old => old ? { ...old, open: false } : old)
            setNarrowPanel(null)
        } })
    const reviewAuthoredVariant=useStudioVariantReview({source:authorVariantSource,story,scene:studio.activeScene,selectedUnit:studio.selectedUnit,
        draft,editorRef:editorHandleRef,readOnly,blocked:Boolean(pendingSceneRestore||pendingReplacement||studio.structure.busy||studio.structure.pending),
        loadError:Boolean(studio.sceneLoadError),beforeReview:beforeCopyOpen,selectScene:studio.selectScene,onStaged:(generation,title)=>{
            history.record(generation,title,generation.instruction??undefined);setAuthorSession(null)
            setAssistantSession(old=>old?{...old,open:false}:old);setNarrowPanel(null)
        }})
    const openAuthorVersions=(generation:StoryGeneration,startEditing:boolean)=>{
        if(!authorVariantSource?.isCurrent()||!requireAuth())return
        const targetReadOnly=authorVariantTargetReadOnly(story,generation.sceneId,readOnly)
        setAuthorSession({key:authorVariantSource.key,generationId:generation.id,sceneId:generation.sceneId,startEditing:startEditing&&!targetReadOnly,
            canCreate:!targetReadOnly&&['candidate','stashed'].includes(generation.status)})
        setAssistantSession(old=>old?{...old,open:false}:old)
    }
    const refineHistoryGeneration=async(generation:StoryGeneration,signal:AbortSignal)=>{
        const owner=novelAssistantSource,notes=annotations.source
        const current=()=>!signal.aborted&&Boolean(owner?.isCurrent()&&storyWorkspace.isCurrent())
        if(!current()||!owner||readOnly||pendingSceneRestore||pendingReplacement||studio.structure.busy||studio.structure.pending
            ||draft.recovery||draft.conflictServer||draft.suspended||!assistantHandle.current)return false
        let selection:StoryAnnotationSelection|null=null
        const selected=generation.command!=='continue'&&generation.inputRange&&generation.sceneId===studio.activeScene?.id
            ?editorHandleRef.current?.getSelection():null
        if(selected?.text){
            if(!notes)return false
            selection=await captureAnnotationSelection({editor:()=>editorHandleRef.current,sceneId:()=>studio.activeScene?.id??null,
                isCurrent:()=>current()&&notes.isCurrent(),readOnly:()=>sceneReadOnly||suggestionActive,
                beforeWrite:beforeCopyOpen,savedScene:notes.currentScene})
            if(!selection)return false
        }else if(!await beforeCopyOpen())return false
        if(!current()||!assistantHandle.current)return false
        const ready=await assistantHandle.current.refineGeneration(generation,signal,selection)
        if(!ready||!current())return false
        setAssistantSession({key:owner.key,sceneId:generation.sceneId,selection,open:true})
        studio.setHistoryOpen(false)
        return true
    }
    const refineAuthoredVersion=async(record:StoryVariantRecord,signal:AbortSignal)=>{
        const owner=novelAssistantSource
        const current=()=>!signal.aborted&&Boolean(owner?.isCurrent()&&storyWorkspace.isCurrent())
        const sceneId=record.variant.parent.parent.sceneId
        if(!current()||!owner||record.storyId!==owner.storyId||authorVariantTargetReadOnly(story,sceneId,readOnly)
            ||pendingSceneRestore||pendingReplacement||studio.structure.busy||studio.structure.pending||draft.recovery
            ||draft.conflictServer||draft.suspended||!assistantHandle.current||!await beforeCopyOpen()||!current())return false
        const ready=await assistantHandle.current.refineVariant(structuredClone(record),signal)
        if(!ready||!current())return false
        setAssistantSession({key:owner.key,sceneId,selection:null,open:true})
        return true
    }
    const openReaderScene=async(page:StoryReadingPage,item:StoryReadingItem)=>{
        const owner=readerLive.current
        const current=()=>Boolean(owner&&readerLive.current===owner&&readerSource?.key===owner.key&&readerSource.isCurrent())
        if(!current()||!readerSource||!await beforeCopyOpen()||!current())return false
        const document=editorHandleRef.current?.getDocument(),signature=document?documentSignature(document):null
        const checked=await readerSource.read({scope:'scene',unitId:item.header.sceneId,includeArchived:true,sourceSnapshot:page.sourceSnapshot,limit:1})
        if(!current()||checked.items.length!==1)return false
        const fresh=await refreshStory(page.storyId)
        if(!current()||editorHandleRef.current?.hasActiveSuggestion()||!matchesReadingScene(fresh,checked,checked.items[0]))return false
        const target=fresh.chapters.flatMap((chapter)=>chapter.scenes).find((scene)=>scene.id===item.header.sceneId)
        if(checked.items[0].header.readOnly&&!studio.workspaceReadOnly&&fresh.status!=='archived'&&!fresh.trashedAt&&!target?.inheritance?.readOnly){
            throw new ApiError(409,'The workspace reader state changed.',{code:'STORY_READING_WORKSPACE_READONLY'})
        }
        const latest=editorHandleRef.current?.getDocument()
        if((latest?documentSignature(latest):null)!==signature)return false
        if(!await studio.selectScene(item.header.sceneId))return false
        setNarrowPanel(null);setPendingSearch(null);setPendingBookmark(null)
        return true
    }
    const openBookmark=async(note:StoryAnnotation)=>{
        const owner=annotations.source
        if(!owner?.isCurrent()||note.kind!=='bookmark'||!note.anchor||note.head.readOnly||!await beforeCopyOpen()||!owner.isCurrent())return false
        const document=editorHandleRef.current?.getDocument(),signature=document?documentSignature(document):null,editorToken=editorHandleRef.current?.getInstanceToken(),unit=searchLive.current.unit
        const fresh=await owner.detail(note.id)
        if(!owner.isCurrent()||fresh.kind!=='bookmark'||!fresh.anchor||fresh.head.readOnly||fresh.anchorVersion!==note.anchorVersion||fresh.revision!==note.revision)return false
        const saved=await refreshStory(owner.storyId)
        if(!saved||!owner.isCurrent()||editorHandleRef.current?.hasActiveSuggestion())return false
        const head=saved.chapters.flatMap((chapter)=>chapter.scenes).find((scene)=>scene.id===fresh.sceneId)
        if(!head||head.trashedAt||head.inheritance?.readOnly)return false
        const scene=await owner.currentScene(fresh.sceneId)
        if(!owner.isCurrent()||scene.revision!==head.revision||scene.contentHash!==head.contentHash||scene.metadataRevision!==head.metadataRevision)return false
        const range=resolveAnnotationRange(scene,fresh.anchor),latest=editorHandleRef.current?.getDocument()
        if(!range||editorHandleRef.current?.getInstanceToken()!==editorToken||searchLive.current.unit!==unit||(latest?documentSignature(latest):null)!==signature)return false
        setBookmarkNotice(null);setPendingSearch(null);setPendingBookmark({owner,sceneId:scene.id,revision:scene.revision,contentHash:scene.contentHash,
            target:{document:scene.document,startOffset:range.startOffset,endOffset:range.endOffset,quote:range.text,token:makeRequestId('bookmark-location'),...(range.startOffset===range.endOffset?{point:fresh.anchor.start}:{})}})
        if(!await studio.selectScene(scene.id)){setPendingBookmark(null);return false}
        closeReader();setNarrowPanel(null);return true
    }
    const bookmarkReading=async(page:StoryReadingPage,item:StoryReadingItem,point:StoryAnnotationPoint)=>{
        const session=readerLive.current,owner=annotations.source,source=readerSource
        const current=()=>Boolean(session&&readerLive.current===session&&source?.key===session.key&&source.isCurrent()&&owner?.isCurrent())
        if(!current()||!owner||!source||readOnly||item.header.readOnly||!await beforeCopyOpen()||!current())return false
        const document=editorHandleRef.current?.getDocument(),signature=document?documentSignature(document):null,editorToken=editorHandleRef.current?.getInstanceToken(),unit=searchLive.current.unit
        const checked=await source.read({scope:'scene',unitId:item.header.sceneId,includeArchived:true,sourceSnapshot:page.sourceSnapshot,limit:1}),fresh=checked.items[0]
        if(!current()||checked.items.length!==1||!fresh||fresh.header.readOnly||fresh.header.revision!==item.header.revision||fresh.header.contentHash!==item.header.contentHash)return false
        const range=resolveDocumentAnnotationRange(fresh.scene.document,{start:point,end:point,quote:''}),latest=editorHandleRef.current?.getDocument()
        if(!range||editorHandleRef.current?.getInstanceToken()!==editorToken||searchLive.current.unit!==unit||(latest?documentSignature(latest):null)!==signature)return false
        const record=annotations.drafts.save({storyId:owner.storyId,kind:'bookmark',annotationId:makeRequestId('mw-bookmark'),body:'',sequence:0,mode:'create',baseRevision:null,originalBody:null,
            selection:{sceneId:fresh.header.sceneId,expectedRevision:fresh.header.revision,expectedContentHash:fresh.header.contentHash,startOffset:range.startOffset,endOffset:range.endOffset,quote:''}})
        if(!record||!current())return false
        setAnnotationsKind('bookmark');setAnnotationSeed({owner,draft:record});setAnnotationsOpen(true);return true
    }
    const beforeStructureWrite=async()=>!studio.workspaceReadOnly&&await beforeCopyOpen()
    const copies=useNovelCopies(studio.workspaceReadOnly,(sourceId)=>sourceId===story?.id?beforeStructureWrite():Promise.resolve(true),beforeCopyOpen)
    const navigateSearch=async(result:StorySearchResult)=>{
        if(!searchSource?.isCurrent()||editorHandleRef.current?.hasActiveSuggestion())return false
        const live=searchLive.current
        if(live.draft.recovery||live.draft.conflictServer||live.draft.suspended||!['idle','saved'].includes(live.draft.saveState))return false
        const document=editorHandleRef.current?.getDocument()
        if(live.scene&&(!document||documentSignature(document)!==documentSignature(live.scene.document)))return false
        setSearchNotice(null);setPendingBookmark(null);setPendingSearch({scope:searchSource.key,result,token:makeRequestId('manuscript-result')})
        if(!await studio.selectScene(result.match.sceneId)){setPendingSearch(null);return false}
        setNarrowPanel(null)
        return true
    }

    // Literal, case-insensitive appearances of a name; resolving re-reads the same saved snapshot before navigating.
    const appearanceSearch=searchSource?{
        find:(q:string)=>searchSource.search({q,caseSensitive:false,includeArchived:false,limit:50}),
        open:async(q:string,page:StorySearchPage,match:StorySearchMatch)=>{
            if(!searchSource.isCurrent())return false
            return navigateSearch(await searchSource.resolve({q,caseSensitive:false,includeArchived:false,sourceSnapshot:page.sourceSnapshot,target:{sceneId:match.sceneId,position:match.position}}))
        },
    }:undefined

    // The story workspace's own client, so a library read or stage never follows a workspace switch.
    const libraryTarget=(id:string)=>{
        const entry=codex.resolveEntry(id),api=storyWorkspace.isCurrent()?storyWorkspace.detachedApi():null
        if(!entry||!api)throw new ApiError(409,'The novel workspace changed.',{code:'STORY_SCOPE_CHANGED'})
        return {api,ref:entry.ref}
    }
    // Approved facts go to this novel's own Codex snapshots; the write checks the context revision it was reviewed at.
    const codexFailure=(error:unknown)=>error instanceof ApiError&&error.code==='STORY_LIBRARY_LOREBOOK_MISSING'?'lorebookMissing' as const:error instanceof ApiError&&error.status===409?'conflict' as const:'failed' as const
    const codexWritable=()=>!codex.readOnly&&!codex.busy&&!codex.pending&&storyWorkspace.isCurrent()
    // The labels the editor reads as @references, so a proposal's review can say which ones it keeps (A10).
    const referenceLabels=codex.referenceEntries.map((entry)=>entry.label)
    const factCodex:FactCodex={
        entries:codex.referenceEntries.filter((entry)=>!entry.removed).map((entry)=>{
            const snapshot=codex.resolveEntry(entry.id)?.ref.snapshot
            return {id:entry.id,label:entry.label,kind:entry.kind,description:entry.description??'',scopeLabel:entry.scopeLabel,sourceId:entry.sourceId??'',
                values:{name:snapshot?.name??entry.label,alias:snapshot?.alias??'',race:snapshot?.race??'',type:snapshot?.type??''}}
        }),
        readOnly:codex.readOnly,busy:codex.busy||Boolean(codex.pending),
        apply:async(id,fields)=>{
            const entry=codex.resolveEntry(id)
            if(!entry||entry.ref.removedAt||entry.contextRevision===undefined||!codexWritable())return {ok:false,reason:'unavailable'}
            try{const ack=await codex.saveSnapshotFields(entry,fields);return ack?{ok:true,revision:ack.contextRevision}:{ok:false,reason:'unavailable'}}
            catch(error){return {ok:false,reason:codexFailure(error)==='conflict'?'conflict':'failed'}}
        },
        // A new reference lives only in this novel; a new library card or lorebook entry is created with its copy as one change.
        create:async(destination,fields,lorebookId)=>{
            if(!codexWritable())return {ok:false,reason:'unavailable'}
            try{
                if(destination==='reference'){const made=await codex.addReference(fields);return made?{ok:true,entryId:made.refId,revision:made.ack.contextRevision}:{ok:false,reason:'unavailable'}}
                const before=new Set((story?.activeCardRefs??[]).map((ref)=>ref.id))
                const ack=await codex.discover(destination,fields,lorebookId)
                const made=ack?.refs.filter((ref)=>!before.has(ref.id)&&ref.kind===destination&&!ref.removedAt).sort((a,b)=>b.precedence-a.precedence)[0]
                return ack&&made?{ok:true,entryId:made.id,revision:ack.contextRevision}:{ok:false,reason:'failed'}
            }catch(error){return {ok:false,reason:codexFailure(error)}}
        },
        cardKinds:(['character','world','item'] as const).filter((kind)=>isContentTypeFeatureEnabled(kind)),
        lorebooks:isLorebooksFeatureEnabled()?async()=>{
            const api=storyWorkspace.isCurrent()?storyWorkspace.detachedApi():null
            if(!api)throw new ApiError(409,'The novel workspace changed.',{code:'STORY_SCOPE_CHANGED'})
            return normalizeLorebookList(await api.getLorebooks(0,100)).map((lorebook)=>({id:lorebook.id,title:lorebook.name}))
        }:undefined,
        // A fact applied to an entry copied from a library card can be staged in that card's private draft.
        library:!readOnly?{
            linked:(id)=>{const entry=codex.resolveEntry(id);return Boolean(entry&&!entry.ref.removedAt&&LIBRARY_KINDS.has(entry.kind)&&entry.ref.snapshot.source_card_id===entry.ref.cardId)},
            read:async(id)=>libraryTarget(id).api.getStoryCodexLibraryDraft(libraryTarget(id).ref),
            stage:async(id,fields,stamp)=>{const target=libraryTarget(id);return target.api.stageStoryCodexLibraryDraft(target.ref,fields,stamp)},
            // A lorebook entry has no draft: its write changes the library entry at once, after its own review.
            lorebook:isLorebooksFeatureEnabled()?{
                linked:(id)=>{const entry=codex.resolveEntry(id);return Boolean(entry&&!entry.ref.removedAt&&entry.kind==='lorebook_entry'&&entry.ref.snapshot.id===entry.ref.cardId&&entry.ref.snapshot.source_lorebook_id)},
                read:async(id)=>libraryTarget(id).api.getStoryCodexLibraryEntry(libraryTarget(id).ref),
                write:async(id,fields,stamp)=>{const target=libraryTarget(id);return target.api.writeStoryCodexLibraryEntry(target.ref,fields,stamp)},
            }:undefined,
        }:undefined,
    }

    if (!story) return null
    const activeChapter = studio.activeChapter
    const activeScene=studio.activeScene

    const handleSelectChapter = (id: string) => {
        if (id === activeScene?.id) return
        setPendingSearch(null);setPendingBookmark(null)
        guards.guardedLeave(() => { void studio.selectChapter(id).then((opened)=>{if(opened)setNarrowPanel(null)}) })
    }
    const performStructure=async(operation:StoryStructureOperation)=>{
        if(!await beforeStructureWrite())return null
        return studio.structure.perform(operation)
    }
    // A reviewed assistant summary becomes the scene's summary, written for the prose revision the reply read (K09).
    const saveSceneSummary=async(sceneId:string,text:string,revision:number):Promise<SceneSummaryOutcome>=>{
        if(!await beforeStructureWrite())return 'failed'
        try{
            const fresh=await refreshStory(story.id)
            const scene=chaptersFor(fresh).flatMap(chapter=>chapter.trashedAt?[]:chapter.scenes).find(scene=>scene.id===sceneId&&!scene.trashedAt)
            if(!scene||scene.inheritance?.readOnly||!storyWorkspace.isCurrent())return 'unavailable'
            if(scene.revision!==revision)return 'changed'
            if(scene.details.summary===text&&scene.details.summaryRevision===revision)return 'saved'
            await updateStoryScene(fresh.id,sceneId,{requestId:makeRequestId('novel-summary'),expectedMetadataRevision:scene.metadataRevision,details:{...scene.details,summary:text,summaryRevision:revision}})
            return 'saved'
        }catch(error){
            if(!(error instanceof ApiError&&error.status===409))return 'failed'
            // Another tab changed the scene's details: try again; changed prose makes this summary stale instead.
            try{
                const fresh=await refreshStory(story.id)
                return chaptersFor(fresh).flatMap(chapter=>chapter.scenes).find(scene=>scene.id===sceneId)?.revision===revision?'failed':'changed'
            }catch{return 'failed'}
        }
    }
    // A reviewed chapter, part or book summary is saved with the scene revisions it covered, and only while they are still today's (rest of K09/A14).
    const saveWideSummary=async(target:{kind:'chapter'|'part'|'book';id:string|null},text:string,basis:string[]):Promise<SceneSummaryOutcome>=>{
        const current=(fresh:StoryOutline)=>target.kind==='book'?summaryBases(fresh).book:target.kind==='part'?partBases(fresh).get(target.id!)??[]:summaryBases(fresh).chapters.get(target.id!)??[]
        if(!await beforeStructureWrite())return 'failed'
        try{
            const fresh=await refreshStory(story.id)
            const chapter=target.kind==='chapter'?fresh.chapters.find(chapter=>chapter.id===target.id&&!chapter.trashedAt&&!chapter.mergedInto):null
            const part=target.kind==='part'&&partWritable(fresh,target.id!)?fresh.parts.find(part=>part.id===target.id)??null:null
            if(target.kind==='chapter'&&(!chapter||studioInheritance(fresh,chapter).readOnly)||target.kind==='part'&&!part
                ||target.kind==='book'&&(fresh.status==='archived'||fresh.trashedAt)||!storyWorkspace.isCurrent())return 'unavailable'
            if(!sameBasis(basis,current(fresh)))return 'changed'
            const unit=chapter??part,details=unit?unit.details:fresh.details
            if(details.summary===text&&sameBasis(details.summaryBasis,basis))return 'saved'
            const write={requestId:makeRequestId('novel-summary'),expectedMetadataRevision:unit?unit.metadataRevision:fresh.metadataRevision}
            if(chapter)await updateStoryChapter(fresh.id,chapter.id,{...write,details:{...chapter.details,summary:text,summaryBasis:basis}})
            else if(part)await updateStoryPart(fresh.id,part.id,{...write,details:{...part.details,summary:text,summaryBasis:basis}})
            else await updateStory(fresh.id,{...write,details:{...fresh.details,summary:text,summaryBasis:basis}})
            return 'saved'
        }catch(error){
            if(!(error instanceof ApiError&&error.status===409))return 'failed'
            // Another tab changed these details: try again; changed scenes make this summary stale instead.
            try{return sameBasis(basis,current(await refreshStory(story.id)))?'failed':'changed'}catch{return 'failed'}
        }
    }
    // A reviewed blurb or synopsis becomes the novel's description or synopsis, only while its details are the ones the author saw (A26).
    const saveNovelCopy:NovelCopyWriter=async(field,text,reviewedRevision)=>{
        if(!await beforeStructureWrite())return 'failed'
        try{
            const fresh=await refreshStory(story.id)
            if(fresh.status==='archived'||fresh.trashedAt||!storyWorkspace.isCurrent())return 'unavailable'
            if(fresh.metadataRevision!==reviewedRevision)return 'changed'
            const write={requestId:makeRequestId('novel-copy'),expectedMetadataRevision:fresh.metadataRevision}
            await updateStory(fresh.id,field==='description'?{...write,description:text}:{...write,details:{...fresh.details,synopsis:text}})
            return 'saved'
        }catch(error){return error instanceof ApiError&&error.status===409?'changed':'failed'}
    }
    const summaryWriter:SceneSummaryWriter|undefined=readOnly||studio.workspaceReadOnly?undefined
        :{save:saveSceneSummary,saveChapter:(id,text,basis)=>saveWideSummary({kind:'chapter',id},text,basis),savePart:(id,text,basis)=>saveWideSummary({kind:'part',id},text,basis),
            saveBook:(text,basis)=>saveWideSummary({kind:'book',id:null},text,basis)}
    // One reviewed Summary request over the chosen stale scenes (rest of K09): the assistant opens primed, the author sends it.
    const summaryRefresh=assistantSource&&novelAssistantSource&&!readOnly?{available:true,open:(sceneIds:string[],book:boolean,fromSummaries?:boolean)=>{
        if(!assistantHandle.current||!sceneIds.length)return
        assistantHandle.current.refreshSummaries(sceneIds,book,fromSummaries)
        setAssistantSession({key:assistantSource.key,sceneId:sceneIds[0],selection:null,open:true})
    }}:undefined
    const handleAddChapter=()=>{void (async()=>{
        if(!readOnly&&await beforeStructureWrite())await studio.addChapter()
    })().catch(()=>setOperationError(true))}

    const openPlannedScene=async(id:string)=>{
        if(id===activeScene?.id)return true
        const visible=chaptersFor(story).some((chapter)=>chapter.scenes.some((scene)=>scene.id===id&&!scene.trashedAt))
        if(!visible||!await beforeCopyOpen()||!storyWorkspace.isCurrent())return false
        setPendingSearch(null);setPendingBookmark(null)
        if(!await studio.selectScene(id))return false
        setNarrowPanel(null);return true
    }
    const passageSelection=()=>{
        const selected=editorHandleRef.current?.getSelection()
        if(!activeScene||!selected?.text?.trim())return null
        return {sceneId:activeScene.id,quote:selected.text,revision:draft.getRevision()??activeScene.revision}
    }
    /** Reveals a quoted passage through the exact search navigation; falls back to opening its scene. */
    const openPassage=async(sceneId:string,quote:string|undefined):Promise<'opened'|'scene'|'blocked'>=>{
        const q=quote?.split('\n').map((line)=>line.trim()).find(Boolean)?.slice(0,255)
        if(q&&searchSource?.isCurrent()){
            try{
                const page=await searchSource.search({q,sceneId,caseSensitive:true,includeArchived:true,limit:1}),match=page.items[0]
                if(match&&searchSource.isCurrent()){
                    if(!await beforeCopyOpen())return 'blocked'
                    const result=await searchSource.resolve({q,sceneId,caseSensitive:true,includeArchived:true,sourceSnapshot:page.sourceSnapshot,target:{sceneId:match.sceneId,position:match.position}})
                    return await navigateSearch(result)?'opened':'blocked'
                }
            }catch{/* The scene still opens below. */}
        }
        return await openPlannedScene(sceneId)?'scene':'blocked'
    }
    const openTasks=new Map<string,number>()
    for(const task of planTasks.items)if(task.state==='open'&&task.data.sceneId)openTasks.set(task.data.sceneId,(openTasks.get(task.data.sceneId)??0)+1)

    const handleGenerate = async (request: InlineAIRequest, options?: TextGenerationOptions): Promise<StoryGeneration> => {
        // Generating writes a candidate to the story: never while read-only.
        if (draft.online === false) throw new Error(t('novelEditor.offline.help'))
        if (sceneReadOnly) throw new Error(t(studio.workspaceReadOnly?ARCHIVED_WORKSPACE_MESSAGE_KEY:'novelEditor.structure.reader'))
        if (!requireAuth()) throw new Error(t('novelEditor.studio.loginRequired'))
        if (!activeScene) throw new Error(t('novelEditor.studio.noChapter'))
        // No contextSettings override: the backend resolves the story's stored
        // activeContext itself, so sending a copy is pure duplication.
        const candidate = {
            sceneId: activeScene.id,
            command: request.command,
            baseRevision: draft.getRevision() ?? activeScene.revision,
            cursorOffset: request.cursorOffset,
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
        if (storyWorkspace.isCurrent()) history.record(generation, (activeChapter?.title??'')+' · '+activeScene.title, request.prompt)
        return generation
    }

    const enabledCodexCount = codex.entries.filter((entry) => entry.enabled).length
    // What actually reached the model last time IN THIS CHAPTER. The history is
    // story-wide, and a trace from another chapter would describe a prompt that
    // was never built for the text on screen.
    const latestTrace =
        history.traceFor(activeScene?.id)

    return (
        <div ref={containerRef} className="novel-reading-room flex min-h-full w-full min-w-0 flex-1 flex-col" {...readingAttributes(reading.preferences)}>
            <NovelStudioHeader
                story={story}
                chapterTitle={[activeChapter?.title,draft.title].filter(Boolean).join(' · ')}
                focusMode={studio.focusMode}
                codexOpen={inspectorDocked ? studio.codexOpen : narrowPanel === 'codex'}
                typewriter={studio.typewriter}
                onToggleFocusMode={()=>{if(!studio.focusMode)setSurface('write');studio.toggleFocusMode()}}
                onToggleCodex={() => inspectorDocked ? studio.setCodexOpen(!studio.codexOpen) : setNarrowPanel(narrowPanel === 'codex' ? null : 'codex')}
                onToggleTypewriter={studio.toggleTypewriter}
                onOpenHistory={() => studio.setHistoryOpen(true)}
                onOpenSnapshots={()=>setSnapshotsOpen(true)}
                onOpenExport={exportSource?()=>setExportOpen(true):undefined}
                onOpenPackage={packageSource?()=>setPackageOpen(true):undefined}
                onOpenProgress={progressSource?()=>setProgressOpen(true):undefined}
                surface={surface} onSurfaceChange={setSurface} review={Boolean(planSource)}
                reviewCount={planTasks.items.filter((task)=>task.state==='open').length}
                onOpenAnnotations={()=>openAnnotations('note')}
                onOpenBookmarks={()=>openAnnotations('bookmark')}
                onOpenAssistantContext={assistantSource&&activeScene?()=>{
                    const selected=editorHandleRef.current?.getSelection()
                    const selection=selected?.text?{sceneId:activeScene.id,expectedRevision:draft.getRevision()??activeScene.revision,expectedContentHash:activeScene.contentHash,startOffset:selected.startOffset,endOffset:selected.endOffset,quote:selected.text}:null
                    assistantHandle.current?.primeTarget(activeScene.id,selection)
                    setAssistantSession({key:assistantSource.key,sceneId:activeScene.id,selection,open:true})
                }:undefined}
                onOpenManuscript={readerSource?()=>{const session={key:readerSource.key,token:makeRequestId('manuscript-reader')};readerLive.current=session;setReaderSession(session)}:undefined}
                onOpenReading={()=>setReadingScope(studio.viewKey ?? story.id)}
                onOpenTyping={()=>setTypingScope(studio.viewKey??story.id)}
                onOpenLink={activeScene?()=>editorHandleRef.current?.openLink():undefined}
                onOpenReferences={activeScene?()=>editorHandleRef.current?.openReferences():undefined}
                onOpenBlockMove={activeScene&&!sceneReadOnly&&!draft.recovery?()=>editorHandleRef.current?.openBlockMove():undefined}
                linkReadOnly={sceneReadOnly||Boolean(draft.recovery)}
                onOpenFind={() => editorHandleRef.current?.openFind()}
                onOpenSearch={()=>setSearchScope(searchSource?.key??null)}
                onBack={() => guards.guardedLeave(() => setPage('gallery-stories'))}
                onEditDetails={()=>setManaging({kind:'novel',id:story.id})}
                readOnly={readOnly}
            />

            {assistantSource&&novelAssistantSource&&(activeScene||story.chapters.some(chapter=>chapter.scenes.length))&&<NovelAssistantDrawer ref={assistantHandle} key={assistantSource.key}
                open={assistantSession?.key===assistantSource.key&&assistantSession.open}
                onClose={()=>setAssistantSession(old=>old?.key===assistantSource.key?{...old,open:false}:old)} source={novelAssistantSource} workspace={storyWorkspace} story={story}
                anchorSceneId={assistantSession?.key===assistantSource.key?assistantSession.sceneId:activeScene?.id??story.chapters.flatMap(chapter=>chapter.scenes)[0].id}
                selection={assistantSession?.key===assistantSource.key?assistantSession.selection:null} readOnly={readOnly} onAuthRequired={()=>{requireAuth()}} onReviewSuggestion={reviewAssistantSuggestion} onAuthorVersions={openAuthorVersions}
                facts={planSource?planFacts:undefined} tasks={planSource?planTasks:undefined} structure={readOnly||studio.workspaceReadOnly?undefined:{operate:performStructure,busy:studio.structure.busy,error:studio.structure.error}}
                summaries={summaryWriter} outline={readOnly?undefined:(text)=>setOutlineImport(text)} copy={readOnly||studio.workspaceReadOnly?undefined:saveNovelCopy} referenceLabels={referenceLabels} together={readOnly||studio.workspaceReadOnly?undefined:suggestionsTogether}/>}
            {authorVariantSource&&<Drawer open={privateAuthorScope===authorVariantSource.key} size="2xl" title={t('novelEditor.variants.device.title')}
                onClose={()=>{if(privateAuthorHandle.current?.preserve()!==false)setPrivateAuthorScope(null)}}>
                <NovelPrivateAuthorVersions ref={privateAuthorHandle} key={authorVariantSource.key} scope={deviceCacheScope(authorVariantSource.scope.userHash)} current={authorVariantSource.isCurrent}
                    storyId={story!.id} workspaceId={storyWorkspace.workspaceId??undefined} lifecycleRetentionFailed={novelLifecycleStorageFailed}
                    onResumeInStudio={item=>{
                        const source=authorVariantSource,p=item.record.write.context.parent.parent
                        if(!source.isCurrent()||!requireAuth()||item.scope.userHash!==source.scope.userHash||item.scope.workspaceId!==source.scope.workspaceId||item.record.write.storyId!==source.storyId
                            ||item.scope.apiOrigin!==deviceCacheScope(source.scope.userHash).apiOrigin||privateAuthorHandle.current?.preserve()===false)return false
                        const targetReadOnly=authorVariantTargetReadOnly(story,p.sceneId,readOnly)
                        setAuthorSession({key:source.key,generationId:p.id,sceneId:p.sceneId,startEditing:true,canCreate:!targetReadOnly,recovery:structuredClone(item.record)})
                        setPrivateAuthorScope(null);return true
                    }} />
            </Drawer>}
            {authorVariantSource&&authorSession?.key===authorVariantSource.key&&<NovelAuthorVariants ref={authorVariantsHandle} key={authorSession.key+authorSession.generationId+(authorSession.recovery?.storageKey??'')+String(authorSession.recovery?.writtenAt??'')}
                source={authorVariantSource} generationId={authorSession.generationId} startEditing={authorSession.startEditing} canCreate={authorSession.canCreate&&!authorReadOnly} readOnly={authorReadOnly}
                isDefaultWorkspace={workspaceContext?.workspaces.find(row=>row.id===storyWorkspace.workspaceId)?.is_default}
                recoveryRecord={authorSession.recovery}
                onClose={()=>setAuthorSession(null)} onReview={reviewAuthoredVariant} onRefine={refineAuthoredVersion}/>}
            <NovelManuscriptReader key={readerSession?.token??'closed'} open={Boolean(readerSession&&readerSession.key===readerSource?.key)} source={readerSource} story={story} preferences={reading.preferences} preferenceKey={studio.viewKey??null} activeChapterId={activeChapter?.id} activeSceneId={activeScene?.id} onClose={closeReader} onOpenScene={openReaderScene} onBookmark={readOnly?undefined:bookmarkReading}/>
            <NovelReadingPreferences open={readingScope !== null && readingScope === (studio.viewKey ?? story.id)} onClose={() => setReadingScope(null)} value={reading.preferences} onChange={reading.setPreferences} storageUnavailable={reading.storageUnavailable} />
            <NovelTypingPreferences open={typingScope!==null&&typingScope===(studio.viewKey??story.id)} onClose={()=>setTypingScope(null)} value={typing.preferences} onChange={typing.setPreferences} storageUnavailable={typing.storageUnavailable} showInvisibles={invisibles.preferences.visible} onShowInvisibles={visible=>invisibles.setPreferences({visible})} invisiblesUnavailable={invisibles.storageUnavailable}
                completions={completions.preferences} onCompletions={completions.setPreferences} completionsUnavailable={completions.storageUnavailable}/>
            <NovelManuscriptSearch open={searchScope!==null&&searchScope===searchSource?.key} onClose={()=>setSearchScope(null)} story={story} source={searchSource} beforeNavigate={beforeCopyOpen} onNavigate={navigateSearch} replacements={replacements}/>
            {searchNotice&&searchNotice.scope===searchSource?.key&&<Callout role="status" tone={searchNotice.key==='opened'?'info':'warning'}>{t('novelEditor.search.'+searchNotice.key)}</Callout>}
            {bookmarkNotice&&bookmarkNotice.owner===annotations.source&&<Callout role="status" tone={bookmarkNotice.key==='opened'?'info':'warning'}>{t('novelEditor.bookmarks.'+bookmarkNotice.key)}</Callout>}
            {(studio.viewStorageUnavailable||position.storageUnavailable)&&<Callout tone="warning" role="status" className="m-3">{t('novelEditor.reading.resumeUnavailable')}</Callout>}

            <div className="mx-3 empty:hidden"><NovelPendingLifecycle readOnly={studio.workspaceReadOnly} beforeWrite={(id)=>id===story?.id?beforeStructureWrite():Promise.resolve(true)}/></div>
            {authorVariantSource&&<div className="mx-3"><Button size="sm" variant="ghost" onClick={()=>{if(authorVariantSource.isCurrent())setPrivateAuthorScope(authorVariantSource.key)}}>{t('novelEditor.variants.device.entry')}</Button></div>}
            <div className="mx-3 empty:hidden"><NovelPendingCreations beforeOpen={beforeCopyOpen}/></div>
            <div className="mx-3 empty:hidden"><NovelPendingCopies copies={copies}/></div>
            <div className="mx-3 empty:hidden"><NovelPendingSceneRestores restores={sceneRestores}/></div>
            <div className="mx-3 empty:hidden"><NovelPendingReplacements replacements={replacements}/></div>
            <div className="mx-3 empty:hidden"><NovelPendingAnnotations annotations={annotations} onOpen={(kind)=>openAnnotations(kind)}/></div>
            {showArchivedNotice && (
                <div className="border-b border-line p-3">
                    <Callout tone="warning" role="status" icon={<Icon icon={Archive} size={16} />} data-testid="novel-archived-notice">
                        {t(ARCHIVED_WORKSPACE_MESSAGE_KEY)}
                    </Callout>
                </div>
            )}
            {sceneReadOnly&&!studio.workspaceReadOnly&&!pendingSceneRestore&&!pendingReplacement&&<Callout tone="warning" role="status" className="m-3">{t('novelEditor.structure.reader')}</Callout>}
            {(studio.sceneLoading||studio.sceneLoadError)&&<Callout role={studio.sceneLoadError?'alert':'status'} tone={studio.sceneLoadError?'warning':'info'} className="m-3">
                <p>{t('novelEditor.loading.'+(studio.sceneLoadError??'scene'))}</p>
                {activeScene&&studio.sceneLoading&&<p>{t('novelEditor.loading.keepWriting')}</p>}
                {studio.sceneLoadError&&<Button size="sm" variant="secondary" onClick={()=>void studio.retryScene()}>{t('novelEditor.loading.retry')}</Button>}
            </Callout>}
            {operationError && <Callout tone="warning" role="alert" className="m-3">{t('novelEditor.revisions.failed')}</Callout>}
            {draft.applicationRejection&&<div className="m-3"><NovelGenerationApplicationNotice value={draft.applicationRejection}
                disabled={draft.online===false||Boolean(draft.recovery?.pendingInvalid)} onCompare={()=>void draft.compareConflict().catch(()=>setSaveBlocked(true))} /></div>}
            {draft.recovery && (
                <Callout tone="warning" role="status" className="m-3">
                    <p>{t('novelEditor.recovery.found')}</p>
                    {draft.recovery.pendingInvalid && <p role="alert">{t('novelEditor.offline.unsupportedRequest')}</p>}
                    {recoveryCopyKey === recoveryKey && <Field label={t('novelEditor.offline.copyable')}><Textarea readOnly rows={6} value={documentMarkdown(draft.recovery.document)} /></Field>}
                    <div className="mt-3 flex flex-wrap gap-2">
                        <Button size="sm" disabled={draft.recovery.pendingInvalid} onClick={draft.resumeRecovery}>{t('novelEditor.recovery.resume')}</Button>
                        <Button size="sm" variant="secondary" onClick={() => void (async () => { try { await navigator.clipboard.writeText(draft.recovery ? documentMarkdown(draft.recovery.document) : '') } catch { setRecoveryCopyKey(recoveryKey) } })()}>{t('novelEditor.recovery.copy')}</Button>
                        <Button size="sm" variant="ghost" onClick={() => setRecoveryCopyKey((old) => old === recoveryKey ? null : recoveryKey)}>{t('novelEditor.offline.show')}</Button>
                        <Button size="sm" variant="ghost" disabled={Boolean(draft.applicationRejection)} onClick={draft.useServerVersion}>{t('novelEditor.recovery.server')}</Button>
                    </div>
                </Callout>
            )}
            {draft.online === false && <Callout tone="warning" role="status" className="m-3">
                <strong>{t('novelEditor.offline.title')}</strong><p>{t('novelEditor.offline.help')}</p>
            </Callout>}
            {(studio.deviceCacheStatus === 'limit' || studio.deviceCacheStatus === 'unavailable' || studio.deviceCacheStatus === 'invalid') && <Callout tone="warning" role="status" className="m-3">{t('novelEditor.deviceCache.cacheFailed')}</Callout>}
            {draft.storageFailed && <Callout tone="warning" role="alert" className="m-3">{t('novelEditor.recovery.storageFailed')}</Callout>}
            {wordGoal.pending&&<Callout tone="warning" role="status" className="m-3">
                <p>{t('novelEditor.structure.goalPending',{goal:wordGoal.pending.wordGoal??t('novelEditor.structure.notSet')})}</p>
                <Button variant="secondary" size="sm" disabled={studio.workspaceReadOnly} onClick={()=>void wordGoal.retry()}>{t('novelEditor.save.retry')}</Button>
                {wordGoal.storageFailed&&<p>{t('novelEditor.recovery.storageFailed')}</p>}
            </Callout>}
            {draft.localSaved && <p role="status" className="px-4 py-2 text-caption text-parchment-200">{t('novelEditor.recovery.device')}</p>}
            {draft.saveState === 'conflict' && !draft.applicationRejection&&<Callout tone="warning" role="alert" className="m-3">
                <p>{t('novelEditor.save.conflict')}</p>
                <Button size="sm" onClick={() => void draft.compareConflict().catch(() => setSaveBlocked(true))}>{t('novelEditor.recovery.compare')}</Button>
            </Callout>}
            <NovelSceneConflictModal open={Boolean(draft.conflictServer)} review={draft.conflictReview ?? null}
                readOnly={sceneReadOnly} stale={draft.reviewStale} retentionFailed={draft.retentionFailed}
                onClose={draft.closeConflict} onRefresh={draft.compareConflict} onResolve={draft.resolveConflict} />
            <NovelRetainedSceneDrafts items={draft.retainedDrafts ?? []} unavailable={draft.retainedDraftsUnavailable} />
            <div className="flex flex-wrap items-center gap-3 border-b border-line p-3"><LlmFeatureControl feature="novel" disabled={suggestionActive || readOnly || draft.online === false} />
                {!outlineDocked && <Button variant="secondary" size="sm" onClick={() => setNarrowPanel('outline')}>{t('novelEditor.chapters.title')}</Button>}
                <Button variant="secondary" size="sm" onClick={()=>setManaging({kind:'novel',id:story.id})}>{t('novelEditor.structure.manage')}</Button>
                <Button variant="ghost" size="sm" onClick={() => setRevisionsOpen(true)}>{t('novelEditor.revisions.title')}</Button></div>
            {studio.structure.pending&&<Callout tone="warning" role="status" className="m-3">
                {t(studio.structure.pending.write.operation.op==='create_snapshot'?'novelEditor.snapshots.pending':'novelEditor.structure.pending')} <Button size="sm" disabled={studio.structure.busy} onClick={()=>void(async()=>{if(await beforeCopyOpen())await studio.structure.retry()})()}>{t('novelEditor.save.retry')}</Button>
            </Callout>}
            {studio.structure.error&&<Callout tone="warning" role="alert" className="m-3">{t(`novelEditor.structure.errors.${studio.structure.error}`,{defaultValue:t('novelEditor.structure.failed')})}</Callout>}
            {studio.structure.storageFailed&&<Callout tone="warning" role="alert" className="m-3">{t('novelEditor.structure.storageFailed')}</Callout>}
            <div className="flex flex-wrap items-end gap-2 border-b border-line px-3 py-2">
                <Button size="sm" variant="secondary" disabled={readOnly||studio.structure.busy} onClick={()=>{
                    if(!readOnly)void (async()=>{if(await beforeStructureWrite())await studio.addScene()})().catch(()=>setOperationError(true))
                }}>{t('novelEditor.structure.addScene')}</Button>
                <Field label={t('novelEditor.structure.codexScope')} className="min-w-0">
                    <Select size="sm" value={codexScope} onChange={(value)=>setCodexScope(value as typeof codexScope)} options={[
                        {value:'novel',label:t('novelEditor.structure.scopes.novel')},
                        {value:'chapter',label:t('novelEditor.structure.scopes.chapter'),disabled:!activeChapter},
                        {value:'scene',label:t('novelEditor.structure.scopes.scene'),disabled:!activeScene},
                    ]}/>
                </Field>
            </div>
            <div
                className={cx(
                    'grid min-h-0 flex-1 grid-cols-1',
                    !studio.focusMode && outlineDocked &&
                        (studio.codexOpen && inspectorDocked && surface === 'write'
                            ? 'grid-cols-[224px_minmax(0,1fr)_300px]'
                            : 'grid-cols-[224px_minmax(0,1fr)]'),
                )}
            >
                {!studio.focusMode && outlineDocked && (
                    <NovelChapterRail
                        chapters={studio.chapters}
                        activeChapterId={activeChapter?.id ?? null}
                        onSelect={handleSelectChapter}
                        onAdd={handleAddChapter} onImportOutline={readOnly?undefined:()=>setOutlineImport('')}
                        parts={story.parts} activeSceneId={activeScene?.id??null} onManage={setManaging} onMove={(operation)=>void performStructure(operation)}
                        references={story.activeCardRefs} view={studio.outlineView} onViewChange={studio.setOutlineView}
                        readOnly={readOnly}
                    />
                )}

                <div ref={centreRef} className="relative flex min-h-[640px] min-w-0 flex-col">
                {/* Plan and Review take this column; the manuscript stays loaded behind them (out of the flow,
                    invisible and inert), so its draft, cursor, selection and scroll wait unchanged. */}
                <section className={cx('novel-reading-surface flex min-h-[640px] min-w-0 flex-1 flex-col', surface !== 'write' && 'invisible absolute inset-0 overflow-hidden')}
                    inert={surface !== 'write'} aria-hidden={surface !== 'write' || undefined} data-testid="novel-write-surface">
                    {/* Aligned to the prose measure so the title sits over the column
                        rather than over the page. */}
                    <div className="mx-auto w-full max-w-[var(--width-manuscript)] px-7 pt-6">
                        <input
                            value={draft.title}
                            onChange={(event) => draft.setTitle(event.target.value)}
                            readOnly={sceneReadOnly||!activeScene}
                            className="min-w-0 w-full border-0 bg-transparent font-display text-h3 font-semibold leading-tight text-parchment-50 placeholder:text-parchment-500"
                            aria-label={t('novelEditor.studio.sceneTitleLabel')}
                            placeholder={t('novelEditor.studio.sceneTitlePlaceholder')}
                            data-testid="novel-scene-title"
                        />
                    </div>
                    {draft.titleError && <p role="alert" className="px-7 text-caption text-blood-300">{t(`novelEditor.recovery.title_${draft.titleError}`)}</p>}
                    {activeScene && (
                        <NovelEditor
                            key={`${activeScene.id}:${draft.contentKey}`}
                            ref={editorHandleRef}
                            initialDocument={draft.sceneId === activeScene.id ? draft.document : activeScene.document}
                            initialPosition={position.initialPosition}
                            getInitialPosition={position.getInitialPosition}
                            showInvisibles={invisibles.preferences.visible}
                            typingPreferences={typing.preferences}
                            completionInstruction={completions.preferences.enabled?completionInstruction(completions.preferences.length):null}
                            manuscriptLanguage={story.details.language}
                            aiDisabled={draft.online === false}
                            searchTarget={bookmarkReady&&pendingBookmark&&draft.getRevision()===activeScene.revision?pendingBookmark.target:searchReady&&pendingSearch&&draft.getRevision()===activeScene.revision?{
                                document:pendingSearch.result.scene.document,startOffset:pendingSearch.result.match.startOffset,endOffset:pendingSearch.result.match.endOffset,quote:pendingSearch.result.match.quote,token:pendingSearch.token,
                            }:null}
                            searchTargetBlocked={searchBlocked||searchSourceChanged||bookmarkChanged||Boolean(pendingBookmark&&documentSignature(draft.document)!==documentSignature(pendingBookmark.target.document))||Boolean(pendingSearch&&documentSignature(draft.document)!==documentSignature(pendingSearch.result.scene.document))}
                            onSearchReveal={(token,applied)=>{
                                if(pendingBookmark?.target.token===token&&pendingBookmark.owner===annotations.source){setBookmarkNotice({owner:pendingBookmark.owner,key:applied?'opened':bookmarkChanged?'changed':'blocked'});setPendingBookmark(null);return}
                                if(pendingSearch?.token!==token||pendingSearch.scope!==searchSource?.key)return
                                setSearchNotice({scope:pendingSearch.scope,key:applied?'opened':searchSourceChanged?'changed':'blocked'});setPendingSearch(null)
                            }}
                            onActivate={()=>{if(studio.selectedUnit!==activeScene.id)studio.selectScene(activeScene.id)}}
                            onPositionChange={position.onPositionChange}
                            codexEntries={codex.mentionEntries}
                            referenceEntries={codex.referenceEntries}
                            onSetReferenceContext={async (target, enabled) => {
                                const current = codex.resolveEntry(target.id)
                                const effective = codex.referenceEntries.find((entry) => entry.id === target.id)
                                if (sceneReadOnly || replacements.hasPending() || draft.recovery || suggestionActive || codex.readOnly || codex.busy || !storyWorkspace.isCurrent()) throw new Error(t('novelEditor.references.review'))
                                if (!current || current.contextRevision !== target.contextRevision || !effective || (effective.contextState !== 'enabled' && effective.contextState !== 'disabled')) throw new Error(t('novelEditor.references.stale'))
                                if (current.enabled !== enabled) await codex.toggleEntry(current)
                            }}
                            detectionNames={codex.detectionNames}
                            loreEntries={codex.loreEntries}
                            focusMode={studio.focusMode}
                            typewriter={studio.typewriter}
                            readOnly={sceneReadOnly || Boolean(draft.recovery)}
                            enabledContextCount={enabledCodexCount}
                            onOpenCodexEntry={(id) => {
                                const entry = codex.resolveEntry(id)
                                if (entry) openCodexEntry(entry)
                            }}
                            onAddToCodex={readOnly ? undefined : (text) => openCardPicker(text)}
                            onDocumentChange={draft.onDocumentChange}
                            onRequestSaveFlush={draft.flush}
                            onGenerate={handleGenerate}
                            onAcceptGeneration={async (generationId, variant) => {
                                // Read-only, a candidate simply stays a candidate.
                                if (sceneReadOnly) return
                                if (!await draft.acceptGeneration(generationId, variant)) {
                                    const rejection=draft.getApplicationRejection()
                                    throw new Error(rejection?t('novelEditor.assistant.applicationReasons.'+rejection.reason):t('novelEditor.editor.flushFailed'))
                                }
                                if (storyWorkspace.isCurrent()) history.patchStatus(generationId, 'accepted')
                            }}
                            onDiscardGeneration={async (generationId) => {
                                if (sceneReadOnly) return
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
                </section>
                <NovelPlanningViews open={planningOpen} onClose={backToWrite} story={story} activeSceneId={activeScene?.id??null}
                    onEditScene={(id)=>setManaging({kind:'scene',id})} onOpenScene={openPlannedScene}
                    facts={planSource?planFacts:undefined} openTasks={openTasks} readOnly={readOnly} getSelection={passageSelection} appearances={appearanceSearch} codex={factCodex}
                    bulk={studio.workspaceReadOnly?undefined:{operate:performStructure,busy:studio.structure.busy,error:studio.structure.error}}
                    summaries={{writer:summaryWriter,refresh:summaryRefresh}}/>
                {planSource&&<NovelReviewDrawer open={reviewOpen} onClose={backToWrite} tasks={planTasks} stash={planStash} readOnly={readOnly}
                    sceneTitle={(id)=>chaptersFor(story).flatMap((chapter)=>chapter.scenes).find((scene)=>scene.id===id&&!scene.trashedAt)?.title??null}
                    getSelection={passageSelection}
                    cutSelection={(expected)=>!sceneReadOnly&&!draft.recovery&&Boolean(editorHandleRef.current?.cutSelection?.(expected))}
                    insertText={(text)=>{
                        // The text lands at the manuscript's cursor, so Write is shown to see it.
                        const inserted=!sceneReadOnly&&!draft.recovery&&Boolean(editorHandleRef.current?.insertText?.(text))
                        if(inserted)backToWrite()
                        return inserted
                    }}
                    onOpenPassage={async(sceneId,quote)=>{
                        const opened=await openPassage(sceneId,quote)
                        if(opened!=='blocked')backToWrite()
                        return opened
                    }}/>}
                {/* The save state stays in view on every surface: the manuscript keeps saving behind Plan and Review. */}
                {activeScene&&<StudioStatusStrip
                    words={plainTextWordCount(documentText(draft.document))}
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
                    readOnly={sceneReadOnly||Boolean(wordGoal.pending)||draft.online === false}
                />}
                </div>

                {!studio.focusMode && studio.codexOpen && inspectorDocked && surface === 'write' && (
                    <CodexPanel
                        codex={codex}
                        workspaceId={storyWorkspace.workspaceId}
                        requireAuth={requireAuth}
                        onOpenCardPicker={() => openCardPicker()}
                        contextTrace={latestTrace}
                    />
                )}
            </div>

            <Drawer open={narrowPanel === 'outline'} onClose={() => setNarrowPanel(null)} title={t('novelEditor.chapters.title')} size="sm">
                <NovelChapterRail chapters={studio.chapters} activeChapterId={activeChapter?.id ?? null}
                    onSelect={handleSelectChapter} onAdd={handleAddChapter} onImportOutline={readOnly?undefined:()=>{setNarrowPanel(null);setOutlineImport('')}}
                    references={story.activeCardRefs} view={studio.outlineView} onViewChange={studio.setOutlineView}
                    parts={story.parts} activeSceneId={activeScene?.id??null} onManage={setManaging} onMove={(operation)=>void performStructure(operation)} readOnly={readOnly} />
            </Drawer>
            <Drawer open={narrowPanel === 'codex'} onClose={() => setNarrowPanel(null)} title={t('novelEditor.codex.title')} size="md">
                <CodexPanel codex={codex} workspaceId={storyWorkspace.workspaceId} requireAuth={requireAuth}
                    onOpenCardPicker={() => { setNarrowPanel(null); openCardPicker() }} contextTrace={latestTrace} />
            </Drawer>

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

            {managing&&<NovelStructureDrawer story={story} workspace={storyWorkspace} target={managing} onSelect={setManaging} onClose={()=>setManaging(null)}
                readOnly={studio.workspaceReadOnly} busy={studio.structure.busy} beforeWrite={beforeStructureWrite} operate={performStructure}
                onCopyNovel={()=>setCopySourceId(story.id)}
                isCurrent={storyWorkspace.isCurrent} pendingOperation={studio.structure.pending?.write.operation} operationError={studio.structure.error} clearOperationError={studio.structure.clearError}
                splitCursor={()=>editorHandleRef.current?.getSplitCursor()??null} activeSceneId={activeScene?.id??null}/>}
            {outlineImport!==null&&!readOnly&&<NovelOutlineImportDialog open onClose={()=>setOutlineImport(null)} story={story} initialText={outlineImport}
                structure={{operate:performStructure,busy:studio.structure.busy,error:studio.structure.error}}/>}
            {copySourceId===story.id&&!studio.workspaceReadOnly&&<NovelCopyModal key={story.id} source={story} copies={copies} onClose={()=>setCopySourceId(null)}/>}
            <NovelRevisionDrawer open={revisionsOpen} onClose={() => setRevisionsOpen(false)} source={revisionSource}
                readOnly={sceneReadOnly || suggestionActive} beforeWrite={beforeCopyOpen} restores={sceneRestores}/>
            <NovelAnnotationDrawer open={annotationsOpen} onClose={()=>setAnnotationsOpen(false)} kind={annotationsKind} onKindChange={(kind)=>{setAnnotationSeed(null);setAnnotationsKind(kind)}} initialDraft={annotationSeed?.owner===annotations.source?annotationSeed?.draft:null} annotations={annotations} readOnly={readOnly} activeSceneId={activeScene?.id??null} beforeWrite={beforeCopyOpen} onOpenAnchor={openBookmark}
                captureSelection={async()=>annotations.source?(annotationsKind==='bookmark'?captureBookmarkSelection:captureAnnotationSelection)({editor:()=>editorHandleRef.current,sceneId:()=>activeScene?.id??null,
                    isCurrent:annotations.source.isCurrent,readOnly:()=>sceneReadOnly||suggestionActive,beforeWrite:beforeCopyOpen,savedScene:annotations.source.currentScene}):null}
                onOpenScene={async(id)=>{
                    const visible=chaptersFor(story).some((chapter)=>chapter.scenes.some((scene)=>scene.id===id&&!scene.trashedAt))
                    if(!visible||!await beforeCopyOpen()||!storyWorkspace.isCurrent())return false
                    setPendingSearch(null);setPendingBookmark(null);return studio.selectScene(id)
                }}/>
            {progressSource&&progressOpen&&<NovelProgressDialog key={progressSource.key} open onClose={()=>setProgressOpen(false)} load={progressSource.load} streakKey={progressSource.streakKey}/>}
            {exportSource&&exportOpen&&<NovelExportDialog key={exportSource.key} open onClose={()=>setExportOpen(false)} source={exportSource} savedVersion={studioReviewVersion(story)}/>}
            {packageSource&&packageOpen&&<NovelPackageExportDialog key={packageSource.key} open onClose={()=>setPackageOpen(false)} source={packageSource}/>}
            {snapshotSource&&<NovelSnapshotDrawer key={snapshotSource.key} open={snapshotsOpen} onClose={()=>setSnapshotsOpen(false)} source={snapshotSource} structureRevision={story.structureRevision}
                readOnly={readOnly} busy={studio.structure.busy} pendingOperation={studio.structure.pending?.write.operation} operationError={studio.structure.error} clearOperationError={studio.structure.clearError}
                beforeWrite={beforeStructureWrite} operate={performStructure} recover={async()=>await beforeCopyOpen()?studio.structure.retry():null}/>}
            <NovelGenerationHistoryDrawer
                open={studio.historyOpen}
                generations={history.generations}
                scopeKey={history.sourceKey} onRead={history.readGeneration} loading={history.loading} error={history.error}
                hasNext={history.hasNext} hasPrevious={history.hasPrevious} onNext={history.next} onPrevious={history.previous} onRefresh={history.refresh}
                onRefine={novelAssistantSource?refineHistoryGeneration:undefined} readOnly={readOnly}
                onReadRefinementSource={novelAssistantSource?.readRefinementSource}
                onAuthorVersions={authorVariantSource?openAuthorVersions:undefined}
                refineDisabled={Boolean(pendingSceneRestore||pendingReplacement||suggestionActive||draft.recovery||draft.conflictServer||draft.suspended||studio.structure.busy||studio.structure.pending)}
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
                title={t(studio.workspaceReadOnly?ARCHIVED_WORKSPACE_MESSAGE_KEY:'novelEditor.structure.reader')}
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
