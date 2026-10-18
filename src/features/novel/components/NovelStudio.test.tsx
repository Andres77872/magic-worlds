import { novel, storyChapter, storyScene,storyGeneration,manuscript } from '@/test/fixtures/story'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Story, StoryChapter,StoryScene,StoryAnnotation } from '@/shared'
import type { ApiService } from '@/infrastructure/api'
import { personalNote } from '@/test/fixtures/storyAnnotations'
import { authorVariantFixture } from '@/test/fixtures/authorVariants'
import { newAuthorVariantDraft, type RetainedAuthorVariant } from '../persistence/authorVariantJournal'
import { deviceCacheScope } from '../persistence/studioReadStorage'

// These tests isolate Studio coordination; durable copy behavior has its own hook suite.
vi.mock('../hooks/useNovelCopies',()=>({useNovelCopies:()=>({items:[],error:null})}))

const mocks = vi.hoisted(() => ({
    useNovelStudio: vi.fn(),
    replacementPending:false,draftOptions:{} as Record<string,unknown>,
    readingSource:vi.fn(),refresh:vi.fn(),refreshScene:vi.fn(),readerProps:{} as Record<string,unknown>,
    annotationApi:null as ApiService|null,
    assistantSource:null as null|{key:string;storyId:string;isCurrent:()=>boolean;prepare:()=>Promise<never>},assistantProps:{} as Record<string,unknown>,historyProps:{} as Record<string,unknown>,
    authorSource:null as null|{key:string;storyId:string;scope:{userHash:string;workspaceId:string;storyId:string};isCurrent:()=>boolean},authorRecoveryProps:{} as Record<string,unknown>,authorProps:{} as Record<string,unknown>,
    useWordGoal: vi.fn(),
    setGoal: vi.fn(),
    setPage: vi.fn(),
    generate: vi.fn(),
    flush: vi.fn(async () => true),
    interceptors: new Set<(proceed: () => void) => boolean>(),
    pickerWorkspaceId: undefined as string | null | undefined,
    editor: {
        onGenerate: undefined as undefined | ((request: unknown, options?: { signal?: AbortSignal }) => Promise<unknown>),
        props: {} as Record<string, unknown>,
    },
    acceptGeneration: vi.fn(),
    discardGeneration: vi.fn(),
    annotationProps: {} as Record<string,unknown>,
    planningProps: {} as Record<string,unknown>,
    headerProps:{} as Record<string,unknown>,
    referenceEntries: [] as Array<{ id: string; contextState: string }>,
    resolveReference: vi.fn(), toggleReference: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/app/hooks', () => ({
    useAuth: () => ({ isAuthenticated: true, openLoginModal: vi.fn() }),
    useNavigation: () => ({
        setPage: mocks.setPage,
        registerNavigationInterceptor: (interceptor: (proceed: () => void) => boolean) => {
            mocks.interceptors.add(interceptor)
            return () => mocks.interceptors.delete(interceptor)
        },
    }),
    useData: () => ({
        refreshStory:mocks.refresh,refreshStoryScene:mocks.refreshScene,
        generateStoryCandidate: mocks.generate,
        acceptStoryGeneration: mocks.acceptGeneration,
        discardStoryGeneration: mocks.discardGeneration,
    }),
}))
vi.mock('@/features/codex', () => ({
    CodexCardPickerDrawer: ({ workspaceId }: { workspaceId?: string | null }) => {
        mocks.pickerWorkspaceId = workspaceId
        return null
    },
}))
vi.mock('@/ui/primitives', () => ({
    Modal: () => null,
    Field: () => null, Select: () => null,
    Button: ({ children, onClick, disabled, 'aria-label': label }: { children: ReactNode; onClick?: () => void; disabled?: boolean; 'aria-label'?: string }) => <button type="button" onClick={onClick} disabled={disabled} aria-label={label}>{children}</button>,
    Callout: ({ children }: { children: ReactNode }) => <div role="status">{children}</div>,
    Drawer: ({ open, children }: { open: boolean; children: ReactNode }) => open ? <div>{children}</div> : null,
    Icon: () => null,
    Toast: ({ open, title }: { open: boolean; title: string }) => open ? <div role="alert">{title}</div> : null,
    cx: (...values: unknown[]) => values.filter(Boolean).join(' '),
}))
vi.mock('../editor/NovelEditor', () => ({
    NovelEditor: (props: { onGenerate: typeof mocks.editor.onGenerate }) => {
        mocks.editor.onGenerate = props.onGenerate
        mocks.editor.props = props
        return null
    },
}))
vi.mock('../hooks/useAssistantContextSource',()=>({useAssistantContextSource:()=>mocks.assistantSource}))
vi.mock('../hooks/useAuthorVariantSource',async original=>({...await original<typeof import('../hooks/useAuthorVariantSource')>(),useAuthorVariantSource:()=>mocks.authorSource}))
vi.mock('./NovelPrivateAuthorVersions',()=>({NovelPrivateAuthorVersions:(props:Record<string,unknown>)=>{mocks.authorRecoveryProps=props;return null}}))
vi.mock('./NovelAuthorVariants',()=>({NovelAuthorVariants:(props:Record<string,unknown>)=>{mocks.authorProps=props;return null}}))
vi.mock('./NovelAssistantDrawer',()=>({NovelAssistantDrawer:(props:Record<string,unknown>)=>{mocks.assistantProps=props;return null}}))
vi.mock('../hooks/useManuscriptReadingSource',()=>({useManuscriptReadingSource:mocks.readingSource}))
vi.mock('../hooks/useManuscriptReplacements',()=>({useManuscriptReplacements:()=>({hasPending:()=>mocks.replacementPending,items:[],error:null,historyStorageFailed:false})}))
vi.mock('./NovelManuscriptReader',()=>({NovelManuscriptReader:(props:Record<string,unknown>)=>{mocks.readerProps=props;return null}}))
vi.mock('../hooks/useNovelStudio', () => ({ useNovelStudio: mocks.useNovelStudio }))
vi.mock('../hooks/useWordGoal', () => ({ useWordGoal: mocks.useWordGoal }))
vi.mock('../hooks/useSceneDraft', () => ({
    useSceneDraft: (options:Record<string,unknown>) => {mocks.draftOptions=options;return ({
        title: 'Chapter 1',
        setTitle: vi.fn(),
        body: '',document:(options.scene as StoryScene|undefined)?.document??manuscript(),sceneId:(options.scene as StoryScene|undefined)?.id??null,revision: 1,metadataRevision:1,contentHash:null,
        onDocumentChange: vi.fn(),
        saveState: 'idle',
        lastSavedAt: null,
        suspended: false,
        setSuspended: vi.fn(),
        saveNow: vi.fn(),
        flush: mocks.flush,
        getRevision: () => 1,
    })},
}))
vi.mock('../hooks/useCodex', () => ({
    useCodex: () => ({
        mentionEntries: [],
        referenceEntries: mocks.referenceEntries,
        resolveEntry: mocks.resolveReference,
        toggleEntry: mocks.toggleReference,
        detectionNames: [],
        loreEntries: [],
        entries: [],
        busy: false,
        existingCardKeys: new Set(),
        addCards: vi.fn(),
    }),
}))
vi.mock('../hooks/useGenerationHistory', () => ({
    useGenerationHistory: () => ({ generations: [], patchStatus: vi.fn(), record: vi.fn(), traceFor:()=>null }),
}))
vi.mock('@/ui/components/ConfirmDialog', () => ({
    ConfirmDialog: ({ visible, title, onConfirm, onCancel }: { visible: boolean; title: string; onConfirm: () => void; onCancel: () => void }) => (
        visible ? (
            <div role="dialog" aria-label={title}>
                <button type="button" onClick={onConfirm}>Discard</button>
                <button type="button" onClick={onCancel}>Cancel</button>
            </div>
        ) : null
    ),
}))
vi.mock('../hooks/useOpenCodexEntry', () => ({ useOpenCodexEntry: () => vi.fn() }))
vi.mock('./codex/CodexPanel', () => ({ CodexPanel: () => null }))
vi.mock('./NovelChapterRail', () => ({ NovelChapterRail: () => null }))
vi.mock('./StudioStatusStrip', () => ({
    StudioStatusStrip: ({ goal, onSetGoal }: { goal: number | null; onSetGoal: (goal: number | null) => void }) => (
        <button type="button" onClick={() => onSetGoal(2200)}>Goal {goal}</button>
    ),
}))
vi.mock('./NovelGenerationHistoryDrawer', () => ({ NovelGenerationHistoryDrawer: (props:Record<string,unknown>) => {mocks.historyProps=props;return null} }))
vi.mock('./NovelStudioHeader', () => ({ NovelStudioHeader: (props:Record<string,unknown>) => {mocks.headerProps=props;return null} }))
vi.mock('./NovelPlanningViews',()=>({NovelPlanningViews:(props:Record<string,unknown>)=>{mocks.planningProps=props;return null}}))
vi.mock('./NovelAnnotationDrawer',()=>({NovelAnnotationDrawer:(props:Record<string,unknown>)=>{mocks.annotationProps=props;return null}}))

import { NovelStudio } from './NovelStudio'

const STORY_WORKSPACE = { workspaceId: '0f1e2d3c-4b5a-4978-8a6b-5c4d3e2f1a0b', isCurrent: () => true, detachedApi: () => mocks.annotationApi }
beforeEach(()=>{mocks.annotationApi=null;mocks.assistantSource=null;mocks.authorSource=null;mocks.authorRecoveryProps={};mocks.authorProps={}})

function chapter(): StoryChapter {
    return storyChapter({scenes:[storyScene({wordGoal:1800})]})
}
function story(activeChapter: StoryChapter): Story {
    return novel({title:'Glass War',chapters:[activeChapter]})
}

describe('NovelStudio word goal persistence', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.replacementPending=false
        mocks.readingSource.mockReturnValue(null)
        const activeChapter = chapter()
        mocks.useNovelStudio.mockReturnValue({
            ...{activeScene:chapter().scenes[0],scenes:chapter().scenes,structure:{pending:null,error:null,busy:false,storageFailed:false,perform:vi.fn(),retry:vi.fn()},addScene:vi.fn()},
            story: story(activeChapter),
        activeScene:activeChapter.scenes[0],scenes:activeChapter.scenes,structure:{pending:null,error:null,busy:false,storageFailed:false,perform:vi.fn(),retry:vi.fn()},addScene:vi.fn(),
            workspace: STORY_WORKSPACE,
            chapters: [activeChapter],
            activeChapter,
            selectChapter: vi.fn(),
            selectScene: vi.fn().mockResolvedValue(true),
            addChapter: vi.fn(),
            deleteChapter: vi.fn(),
            focusMode: false,
            toggleFocusMode: vi.fn(),
            codexOpen: false,
            setCodexOpen: vi.fn(),
            narrowPanel: null,
            setNarrowPanel: vi.fn(),
            codexScope: 'novel',
            setCodexScope: vi.fn(),
            typewriter: false,
            toggleTypewriter: vi.fn(),
            historyOpen: false,
            setHistoryOpen: vi.fn(),
        })
        mocks.useWordGoal.mockReturnValue({ goal: 1800, setGoal: mocks.setGoal })
        mocks.setGoal.mockResolvedValue(true)
    })

    it('hands the exact selected private writer to the original generation dialog and keeps an archived target read-only', () => {
        const f=authorVariantFixture(),base=mocks.useNovelStudio.getMockImplementation()!(),scene={...f.scene,status:'archived' as const}
        const group=storyChapter({id:scene.chapterId,storyId:scene.storyId,scenes:[scene]})
        const book=novel({id:scene.storyId,chapters:[group]})
        mocks.useNovelStudio.mockReturnValue({...base,story:book,activeScene:scene,activeChapter:group,chapters:[group],scenes:[scene],readOnly:false,requireAuth:()=>true})
        mocks.authorSource={key:'private-author-source',storyId:book.id,scope:{userHash:'private-studio-author',workspaceId:STORY_WORKSPACE.workspaceId,storyId:book.id},isCurrent:()=>true}
        const item:RetainedAuthorVariant={scope:{...deviceCacheScope('private-studio-author'),workspaceId:STORY_WORKSPACE.workspaceId},
            record:{schema:1,write:{...newAuthorVariantDraft(f.context),title:'The exact selected writer',seeded:true},storageKey:'selected-writer',writtenAt:4}}
        render(<NovelStudio/>)
        fireEvent.click(screen.getByRole('button',{name:'Recover private versions'}))
        act(()=>{expect((mocks.authorRecoveryProps.onResumeInStudio as (item:RetainedAuthorVariant)=>boolean)(item)).toBe(true)})
        expect(mocks.authorProps.generationId).toBe(f.generation.id)
        expect(mocks.authorProps.recoveryRecord).toEqual(item.record)
        expect(mocks.authorProps.recoveryRecord).not.toBe(item.record)
        expect(mocks.authorProps.readOnly).toBe(true)
        expect(mocks.authorProps.canCreate).toBe(false)
        expect(mocks.generate).not.toHaveBeenCalled();expect(mocks.acceptGeneration).not.toHaveBeenCalled()
    })

    it('refuses a private recovery handoff from another account even when workspace and novel IDs match',()=>{
        const base=mocks.useNovelStudio.getMockImplementation()!(),f=authorVariantFixture()
        mocks.useNovelStudio.mockReturnValue({...base,requireAuth:()=>true})
        mocks.authorSource={key:'private-author-source',storyId:base.story.id,scope:{userHash:'private-studio-author',workspaceId:STORY_WORKSPACE.workspaceId,storyId:base.story.id},isCurrent:()=>true}
        const item:RetainedAuthorVariant={scope:{...deviceCacheScope('different-author'),workspaceId:STORY_WORKSPACE.workspaceId},record:{schema:1,write:{...newAuthorVariantDraft(f.context),storyId:base.story.id}}}
        render(<NovelStudio/>);fireEvent.click(screen.getByRole('button',{name:'Recover private versions'}))
        expect((mocks.authorRecoveryProps.onResumeInStudio as (item:RetainedAuthorVariant)=>boolean)(item)).toBe(false)
        expect(mocks.authorProps).toEqual({})
    })

    it('opens the writing assistant with a frozen selection without flushing or replacing the editor',()=>{
        const value=mocks.useNovelStudio.getMockImplementation()!(),scene=value.activeScene as StoryScene
        mocks.assistantSource={key:'assistant-author/desk/book',storyId:value.story.id,isCurrent:()=>true,prepare:vi.fn()}
        render(<NovelStudio/>);const ref=mocks.editor.props.ref as {current:unknown},selection={startOffset:0,endOffset:4,text:'Text'}
        ref.current={getSelection:()=>selection}
        act(()=>{(mocks.headerProps.onOpenAssistantContext as ()=>void)()})
        expect(mocks.assistantProps.open).toBe(true)
        expect(mocks.assistantProps.onReviewSuggestion).toEqual(expect.any(Function))
        expect(mocks.assistantProps.selection).toEqual({sceneId:scene.id,expectedRevision:1,expectedContentHash:scene.contentHash,startOffset:0,endOffset:4,quote:'Text'})
        selection.text='Later selection'
        expect((mocks.assistantProps.selection as {quote:string}).quote).toBe('Text')
        expect(mocks.flush).not.toHaveBeenCalled();expect(value.selectScene).not.toHaveBeenCalled();expect(mocks.assistantSource.prepare).not.toHaveBeenCalled()
    })

    it('flushes once before opening a history suggestion in the same retained assistant model',async()=>{
        const value=mocks.useNovelStudio.getMockImplementation()!(),scene=value.activeScene as StoryScene
        mocks.assistantSource={key:'assistant-author/desk/book',storyId:value.story.id,isCurrent:()=>true,prepare:vi.fn()}
        mocks.flush.mockResolvedValue(true)
        render(<NovelStudio/>)
        expect(mocks.assistantProps.open).toBe(false)
        const refine=vi.fn(async()=>true)
        ;(mocks.assistantProps.ref as {current:unknown}).current={refineGeneration:refine,refineVariant:vi.fn(),primeTarget:vi.fn(),preserve:()=>true}
        ;(mocks.editor.props.ref as {current:unknown}).current={getSelection:()=>null,hasActiveSuggestion:()=>false}
        const generation=storyGeneration({sceneId:scene.id}),signal=new AbortController().signal
        await act(async()=>expect(await (mocks.historyProps.onRefine as (g:typeof generation,s:AbortSignal)=>Promise<boolean>)(generation,signal)).toBe(true))
        expect(mocks.flush).toHaveBeenCalledOnce();expect(refine).toHaveBeenCalledWith(generation,signal,null)
        expect(mocks.assistantProps.open).toBe(true);expect(value.setHistoryOpen).toHaveBeenCalledWith(false)
        expect(value.selectScene).not.toHaveBeenCalled();expect(mocks.generate).not.toHaveBeenCalled()
    })

    it('freezes a fresh saved passage for a ranged history refinement',async()=>{
        const value=mocks.useNovelStudio.getMockImplementation()!(),scene=value.activeScene as StoryScene
        scene.document=manuscript('Text')
        mocks.assistantSource={key:'assistant-author/desk/book',storyId:value.story.id,isCurrent:()=>true,prepare:vi.fn()}
        mocks.annotationApi={} as ApiService;mocks.flush.mockResolvedValue(true);mocks.refreshScene.mockResolvedValue(scene)
        render(<NovelStudio/>)
        const refine=vi.fn(async()=>true),token={}
        ;(mocks.assistantProps.ref as {current:unknown}).current={refineGeneration:refine,refineVariant:vi.fn(),primeTarget:vi.fn(),preserve:()=>true}
        ;(mocks.editor.props.ref as {current:unknown}).current={getSelection:()=>({startOffset:0,endOffset:4,text:'Text'}),
            hasActiveSuggestion:()=>false,getDocument:()=>scene.document,getInstanceToken:()=>token}
        const generation=storyGeneration({sceneId:scene.id,command:'rewrite',inputRange:{startOffset:0,endOffset:3,text:'Old'}}),signal=new AbortController().signal
        await act(async()=>expect(await (mocks.historyProps.onRefine as (g:typeof generation,s:AbortSignal)=>Promise<boolean>)(generation,signal)).toBe(true))
        expect(refine).toHaveBeenCalledWith(generation,signal,{sceneId:scene.id,expectedRevision:scene.revision,expectedContentHash:scene.contentHash,
            startOffset:0,endOffset:4,quote:'Text'})
        expect(mocks.flush).toHaveBeenCalledOnce();expect(mocks.assistantProps.open).toBe(true)
    })

    it.each(['flush','abort','selected-text'] as const)('keeps history readable when %s blocks its handoff',async guard=>{
        const value=mocks.useNovelStudio.getMockImplementation()!(),scene=value.activeScene as StoryScene
        mocks.assistantSource={key:'assistant-author/desk/book',storyId:value.story.id,isCurrent:()=>true,prepare:vi.fn()}
        mocks.flush.mockResolvedValue(guard!=='flush');mocks.annotationApi={} as ApiService;mocks.refreshScene.mockResolvedValue(scene)
        render(<NovelStudio/>)
        const refine=vi.fn(async()=>true),controller=new AbortController(),token={}
        ;(mocks.assistantProps.ref as {current:unknown}).current={refineGeneration:refine,refineVariant:vi.fn(),primeTarget:vi.fn(),preserve:()=>true}
        ;(mocks.editor.props.ref as {current:unknown}).current={getSelection:()=>guard==='selected-text'?{startOffset:0,endOffset:7,text:'Changed'}:null,
            hasActiveSuggestion:()=>false,getDocument:()=>scene.document,getInstanceToken:()=>token}
        if(guard==='abort')controller.abort()
        const generation=storyGeneration({sceneId:scene.id,command:'rewrite',inputRange:{startOffset:0,endOffset:3,text:'Old'}})
        await act(async()=>expect(await (mocks.historyProps.onRefine as (g:typeof generation,s:AbortSignal)=>Promise<boolean>)(generation,controller.signal)).toBe(false))
        expect(refine).not.toHaveBeenCalled();expect(value.setHistoryOpen).not.toHaveBeenCalled();expect(mocks.assistantProps.open).toBe(false)
    })

    it('blocks the writer and new changes while a replacement result is pending',async()=>{
        mocks.replacementPending=true
        render(<NovelStudio/>)
        expect(mocks.draftOptions.blocked).toBe(true);expect(mocks.editor.props.readOnly).toBe(true)
        await act(async()=>expect(await (mocks.annotationProps.beforeWrite as ()=>Promise<boolean>)()).toBe(false))
        expect(mocks.flush).not.toHaveBeenCalled();expect(mocks.generate).not.toHaveBeenCalled()
    })

    it('keeps the writing form mounted while reading and only opens an exact scene after the save/review barriers',async()=>{
        const value=mocks.useNovelStudio.getMockImplementation()!(),scene=value.activeScene
        const item={header:{sceneId:scene.id,chapterId:scene.chapterId,partId:null,title:scene.title,chapterTitle:value.activeChapter.title,partTitle:null,chapterMetadataRevision:1,partMetadataRevision:null,revision:1,metadataRevision:1,contentHash:scene.contentHash,status:'draft',archived:false,readOnly:false},scene}
        const page={schemaVersion:1,storyId:value.story.id,sourceSnapshot:'b'.repeat(64),sourceStructureRevision:1,sourceMetadataRevision:1,sourceContextRevision:1,scope:'scene',unitId:scene.id,includeArchived:true,afterSceneId:null,offset:0,totalScenes:1,nextAfterSceneId:null,items:[item]}
        const read=vi.fn().mockResolvedValue(page)
        mocks.readingSource.mockReturnValue({key:'reader-owner',storyId:value.story.id,isCurrent:()=>true,read})
        mocks.refresh.mockResolvedValue(value.story);mocks.refreshScene.mockResolvedValue(scene)
        render(<NovelStudio/>);const title=screen.getByTestId('novel-scene-title')
        act(()=>{(mocks.headerProps.onOpenManuscript as ()=>void)()})
        expect(mocks.readerProps.open).toBe(true);expect(screen.getByTestId('novel-scene-title')).toBe(title)
        expect(mocks.flush).not.toHaveBeenCalled();expect(value.selectScene).not.toHaveBeenCalled()
        const ref=mocks.editor.props.ref as {current:unknown};let reviewing=true
        ref.current={hasActiveSuggestion:()=>reviewing,getDocument:()=>scene.document}
        const navigate=mocks.readerProps.onOpenScene as (page:unknown,item:unknown)=>Promise<boolean>
        await act(async()=>expect(await navigate(page,item)).toBe(false));expect(read).not.toHaveBeenCalled()
        reviewing=false;mocks.flush.mockResolvedValueOnce(false)
        await act(async()=>expect(await navigate(page,item)).toBe(false));expect(read).not.toHaveBeenCalled()
        mocks.flush.mockResolvedValue(true)
        read.mockResolvedValueOnce({...page,items:[{...item,header:{...item.header,readOnly:true}}]})
        await act(async()=>{await expect(navigate(page,item)).rejects.toMatchObject({code:'STORY_READING_WORKSPACE_READONLY'})})
        expect(value.selectScene).not.toHaveBeenCalled()
        await act(async()=>expect(await navigate(page,item)).toBe(true))
        expect(value.selectScene).toHaveBeenCalledExactlyOnceWith(scene.id)
        act(()=>{(mocks.readerProps.onClose as ()=>void)()})
        expect(screen.getByTestId('novel-scene-title')).toBe(title)
    })

    it('opens a bookmark through the save gate and reveals its exact stable point without writing prose',async()=>{
        const value=mocks.useNovelStudio.getMockImplementation()!(),scene=value.activeScene as StoryScene
        const point={nodeId:String(scene.document.content.content?.[0].attrs?.nodeId),offset:0},anchor={schemaVersion:1 as const,sceneId:scene.id,revision:scene.revision,contentHash:scene.contentHash,start:point,end:point,quote:''}
        const bookmark=personalNote({kind:'bookmark',body:'Return here',sceneId:scene.id,origin:anchor,anchor,lastAnchor:anchor,head:{...personalNote().head,sceneId:scene.id,revision:scene.revision,contentHash:scene.contentHash}})
        const detail=vi.fn().mockResolvedValue(bookmark);mocks.annotationApi={getStoryAnnotation:detail} as unknown as ApiService;mocks.refresh.mockResolvedValue(value.story);mocks.refreshScene.mockResolvedValue(scene)
        render(<NovelStudio/>);const ref=mocks.editor.props.ref as {current:unknown},token={}
        ref.current={hasActiveSuggestion:()=>false,getDocument:()=>scene.document,getInstanceToken:()=>token}
        act(()=>{(mocks.headerProps.onOpenBookmarks as ()=>void)()});expect(mocks.annotationProps.kind).toBe('bookmark')
        const open=mocks.annotationProps.onOpenAnchor as (note:StoryAnnotation)=>Promise<boolean>
        mocks.flush.mockResolvedValueOnce(false)
        await act(async()=>expect(await open(bookmark)).toBe(false));expect(detail).not.toHaveBeenCalled()
        detail.mockResolvedValueOnce({...bookmark,anchorVersion:bookmark.anchorVersion+1})
        await act(async()=>expect(await open(bookmark)).toBe(false));expect(value.selectScene).not.toHaveBeenCalled()
        await act(async()=>expect(await open(bookmark)).toBe(true))
        expect(value.selectScene).toHaveBeenCalledWith(scene.id)
        expect(mocks.editor.props.searchTarget).toMatchObject({document:scene.document,point,startOffset:0,endOffset:0,quote:''})
        const target=mocks.editor.props.searchTarget as {token:string}
        act(()=>{(mocks.editor.props.onSearchReveal as (token:string,applied:boolean)=>void)(target.token,true)})
        expect(screen.getByText('Bookmark opened at its saved position.')).toBeInTheDocument()
        expect(mocks.generate).not.toHaveBeenCalled();expect(mocks.editor.props.initialDocument).toEqual(scene.document)
    })

    it('starts a reader bookmark draft from the verified paragraph while retaining the reader and writer',async()=>{
        const value=mocks.useNovelStudio.getMockImplementation()!(),scene=value.activeScene as StoryScene
        const item={header:{sceneId:scene.id,chapterId:scene.chapterId,partId:null,title:scene.title,chapterTitle:value.activeChapter.title,partTitle:null,chapterMetadataRevision:1,partMetadataRevision:null,revision:scene.revision,metadataRevision:1,contentHash:scene.contentHash,status:'draft',archived:false,readOnly:false},scene}
        const page={schemaVersion:1,storyId:value.story.id,sourceSnapshot:'b'.repeat(64),sourceStructureRevision:1,sourceMetadataRevision:1,sourceContextRevision:1,scope:'scene',unitId:scene.id,includeArchived:true,afterSceneId:null,offset:0,totalScenes:1,nextAfterSceneId:null,items:[item]}
        const read=vi.fn().mockResolvedValue(page);mocks.readingSource.mockReturnValue({key:'reader-bookmark-owner',storyId:value.story.id,isCurrent:()=>true,read})
        render(<NovelStudio/>);const title=screen.getByTestId('novel-scene-title'),ref=mocks.editor.props.ref as {current:unknown},token={}
        ref.current={hasActiveSuggestion:()=>false,getDocument:()=>scene.document,getInstanceToken:()=>token}
        act(()=>{(mocks.headerProps.onOpenManuscript as ()=>void)()})
        const capture=mocks.readerProps.onBookmark as (page:unknown,item:unknown,point:{nodeId:string;offset:number})=>Promise<boolean>,point={nodeId:String(scene.document.content.content?.[0].attrs?.nodeId),offset:0}
        mocks.flush.mockResolvedValueOnce(false)
        await act(async()=>expect(await capture(page,item,point)).toBe(false));expect(read).not.toHaveBeenCalled()
        await act(async()=>expect(await capture(page,item,point)).toBe(true))
        expect(mocks.annotationProps.kind).toBe('bookmark');expect(mocks.annotationProps.open).toBe(true)
        expect(mocks.annotationProps.initialDraft).toMatchObject({write:{kind:'bookmark',mode:'create',body:'',selection:{sceneId:scene.id,expectedRevision:scene.revision,startOffset:0,endOffset:0,quote:''}}})
        expect(mocks.readerProps.open).toBe(true);expect(screen.getByTestId('novel-scene-title')).toBe(title)
        expect(value.selectScene).not.toHaveBeenCalled();expect(mocks.generate).not.toHaveBeenCalled()
    })

    it('binds the active stored chapter to the persisted word-goal hook', () => {
        render(<NovelStudio />)

        const activeScene = mocks.useNovelStudio.mock.results[0].value.activeScene
        expect(mocks.useWordGoal).toHaveBeenCalledWith('story-1', activeScene, STORY_WORKSPACE)
        expect(screen.getByRole('button', { name: 'Goal 1800' })).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'Goal 1800' }))
        expect(mocks.setGoal).toHaveBeenCalledWith(2200)
    })
    it('changes only the explicitly selected current pin and rejects stale or out-of-scope context choices', async () => {
        const current = { id: 'selected-pin', label: 'Mira', enabled: false, contextRevision: 4, ref: { snapshot: { id: 'card-1', name: 'Mira', description: '', story_card_kind: 'character' } } }
        mocks.resolveReference.mockReturnValue(current)
        mocks.referenceEntries.push({ id: 'selected-pin', contextState: 'disabled' })
        try {
            render(<NovelStudio />)
            const setContext = mocks.editor.props.onSetReferenceContext as (target: typeof current, enabled: boolean) => Promise<void>
            await setContext(current, true)
            expect(mocks.resolveReference).toHaveBeenCalledWith('selected-pin')
            expect(mocks.toggleReference).toHaveBeenCalledExactlyOnceWith(current)
            await expect(setContext({ ...current, contextRevision: 3 }, true)).rejects.toThrow('The reference changed.')
            mocks.referenceEntries[0].contextState = 'outside'
            await expect(setContext(current, true)).rejects.toThrow('The reference changed.')
            expect(mocks.toggleReference).toHaveBeenCalledOnce()
        } finally { mocks.referenceEntries.length = 0 }
    })

    it('remembers the actual fallback scene on editor activation without flushing or writing prose', () => {
        render(<NovelStudio />)
        const studio=mocks.useNovelStudio.mock.results[0].value
        const activate=mocks.editor.props.onActivate as ()=>void
        expect(studio.selectScene).not.toHaveBeenCalled()
        act(()=>activate())
        expect(studio.selectScene).toHaveBeenCalledWith(studio.activeScene.id)
        expect(mocks.flush).not.toHaveBeenCalled()
        expect(mocks.generate).not.toHaveBeenCalled()
    })

    it('opens personal review and refuses hidden scene navigation before the save barrier',async()=>{
        const selected=vi.fn().mockResolvedValue(true);mocks.flush.mockResolvedValue(true)
        const value=mocks.useNovelStudio.getMockImplementation()!()
        value.selectScene=selected;value.story.chapters[0].scenes.push(storyScene({id:'hidden-scene',trashedAt:'2026-10-16T10:00:00'}))
        render(<NovelStudio/>)
        expect(mocks.annotationProps.open).toBe(false)
        act(()=>{(mocks.headerProps.onOpenAnnotations as ()=>void)()})
        expect(mocks.annotationProps.open).toBe(true)
        const open=mocks.annotationProps.onOpenScene as (id:string)=>Promise<boolean>
        await expect(open('hidden-scene')).resolves.toBe(false);await expect(open('missing-scene')).resolves.toBe(false)
        expect(mocks.flush).not.toHaveBeenCalled();expect(selected).not.toHaveBeenCalled()
        await expect(open(value.activeScene.id)).resolves.toBe(true)
        expect(mocks.flush).toHaveBeenCalledOnce();expect(selected).toHaveBeenCalledWith(value.activeScene.id)
    })

    it('opens planning views and moves to a visible scene only after the save barrier',async()=>{
        const selected=vi.fn().mockResolvedValue(true);mocks.flush.mockResolvedValue(false)
        const value=mocks.useNovelStudio.getMockImplementation()!()
        value.selectScene=selected;value.story.chapters[0].scenes.push(storyScene({id:'later-scene',chapterId:value.story.chapters[0].id,order:9}),storyScene({id:'hidden-scene',trashedAt:'2026-10-16T10:00:00'}))
        render(<NovelStudio/>)
        expect(mocks.planningProps.open).toBe(false)
        expect(mocks.headerProps.surface).toBe('write')
        // Plan takes the centre column; the manuscript stays loaded behind it, inert, and comes back unchanged.
        act(()=>{(mocks.headerProps.onSurfaceChange as (surface:string)=>void)('plan')})
        expect(mocks.planningProps.open).toBe(true)
        expect(mocks.headerProps.surface).toBe('plan')
        expect(screen.getByTestId('novel-write-surface')).toHaveAttribute('inert')
        expect(screen.getByTestId('novel-write-surface')).toHaveAttribute('aria-hidden','true')
        const open=mocks.planningProps.onOpenScene as (id:string)=>Promise<boolean>
        await expect(open(value.activeScene.id)).resolves.toBe(true)
        await expect(open('hidden-scene')).resolves.toBe(false);await expect(open('missing-scene')).resolves.toBe(false)
        expect(mocks.flush).not.toHaveBeenCalled()
        await expect(open('later-scene')).resolves.toBe(false)
        expect(mocks.flush).toHaveBeenCalledOnce();expect(selected).not.toHaveBeenCalled()
        mocks.flush.mockResolvedValue(true)
        await expect(open('later-scene')).resolves.toBe(true)
        expect(selected).toHaveBeenCalledWith('later-scene')
    })

    it('returns to Write from Plan, and focus mode is Write only',()=>{
        render(<NovelStudio/>)
        act(()=>{(mocks.headerProps.onSurfaceChange as (surface:string)=>void)('plan')})
        act(()=>{(mocks.planningProps.onClose as ()=>void)()})
        expect(mocks.headerProps.surface).toBe('write')
        expect(screen.getByTestId('novel-write-surface')).not.toHaveAttribute('inert')
        act(()=>{(mocks.headerProps.onSurfaceChange as (surface:string)=>void)('plan')})
        act(()=>{(mocks.headerProps.onToggleFocusMode as ()=>void)()})
        expect(mocks.headerProps.surface).toBe('write')
        expect(mocks.planningProps.open).toBe(false)
    })

    it('surfaces a visible error when the stored word-goal save fails', async () => {
        mocks.setGoal.mockResolvedValue(false)
        render(<NovelStudio />)

        fireEvent.click(screen.getByRole('button', { name: 'Goal 1800' }))

        expect(await screen.findByRole('alert')).toHaveTextContent('Word goal not saved')
    })
})

describe('NovelStudio generation requests', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.readingSource.mockReturnValue(null)
        const activeChapter = chapter()
        mocks.useNovelStudio.mockReturnValue({
            ...{activeScene:chapter().scenes[0],scenes:chapter().scenes,structure:{pending:null,error:null,busy:false,storageFailed:false,perform:vi.fn(),retry:vi.fn()},addScene:vi.fn()}, story: story(activeChapter), workspace: STORY_WORKSPACE, chapters: [activeChapter], activeChapter,
            focusMode: false, codexOpen: false, typewriter: false, historyOpen: false })
        mocks.useWordGoal.mockReturnValue({ goal: 1800, setGoal: mocks.setGoal })
    })

    it('asks again for the same command under its request ID until it finishes or is spent', async () => {
        render(<NovelStudio />)
        const request = { command: 'continue', instruction: 'More rain', prompt: 'More rain' }
        const generation = { id: 'generation-1', chapterId: 'chapter-1', output: 'Rain.' }
        const ids = () => mocks.generate.mock.calls.map((call) => (call[2] as { requestId: string }).requestId)
        mocks.generate.mockRejectedValueOnce(Object.assign(new Error('Dropped'), { code: 'LLM_EXECUTION_RECOVERY_REQUIRED' }))
            .mockResolvedValueOnce(generation)
            .mockRejectedValueOnce(Object.assign(new Error('Ended'), { code: 'LLM_EXECUTION_FINISHED' }))
            .mockResolvedValueOnce(generation)
        await expect(mocks.editor.onGenerate!(request)).rejects.toThrow('Dropped')
        await mocks.editor.onGenerate!(request)
        expect(ids()[1]).toBe(ids()[0])
        await expect(mocks.editor.onGenerate!(request)).rejects.toThrow('Ended')
        expect(ids()[2]).not.toBe(ids()[0])
        await mocks.editor.onGenerate!(request)
        expect(ids()[3]).not.toBe(ids()[2])
        expect(mocks.generate.mock.calls[0][1]).toEqual({ sceneId: 'scene-1', baseRevision: 1, cursorOffset: undefined, command: 'continue', instruction: 'More rain', selection: undefined })
    })

    it('starts a new request for another command or after a deliberate stop', async () => {
        render(<NovelStudio />)
        const ids = () => mocks.generate.mock.calls.map((call) => (call[2] as { requestId: string }).requestId)
        mocks.generate.mockRejectedValue(Object.assign(new Error('Dropped'), { code: 'LLM_EXECUTION_RECOVERY_REQUIRED' }))
        await expect(mocks.editor.onGenerate!({ command: 'continue' })).rejects.toThrow()
        await expect(mocks.editor.onGenerate!({ command: 'rewrite' })).rejects.toThrow()
        const stopped = new AbortController(); stopped.abort()
        await expect(mocks.editor.onGenerate!({ command: 'rewrite' }, { signal: stopped.signal })).rejects.toThrow()
        await expect(mocks.editor.onGenerate!({ command: 'rewrite' })).rejects.toThrow()
        expect(ids()[1]).not.toBe(ids()[0])
        expect(ids()[2]).toBe(ids()[1])
        expect(ids()[3]).not.toBe(ids()[2])
    })
})

describe('NovelStudio workspace and navigation guard', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.readingSource.mockReturnValue(null)
        mocks.interceptors.clear()
        mocks.flush.mockResolvedValue(true)
        const activeChapter = chapter()
        mocks.useNovelStudio.mockReturnValue({
            ...{activeScene:chapter().scenes[0],scenes:chapter().scenes,structure:{pending:null,error:null,busy:false,storageFailed:false,perform:vi.fn(),retry:vi.fn()},addScene:vi.fn()}, story: story(activeChapter), workspace: STORY_WORKSPACE, chapters: [activeChapter], activeChapter,
            focusMode: false, codexOpen: false, typewriter: false, historyOpen: false })
        mocks.useWordGoal.mockReturnValue({ goal: 1800, setGoal: mocks.setGoal })
    })

    it("browses the story's workspace in the card picker", () => {
        render(<NovelStudio />)
        expect(mocks.pickerWorkspaceId).toBe(STORY_WORKSPACE.workspaceId)
    })

    it('holds an app navigation until the draft is flushed, then lets it through once', async () => {
        render(<NovelStudio />)
        expect(mocks.interceptors.size).toBe(1)
        const [interceptor] = mocks.interceptors
        const proceed = vi.fn(() => {
            // The navigation it lets through consults the interceptors again.
            for (const guard of mocks.interceptors) expect(guard(vi.fn())).toBe(false)
        })

        expect(interceptor(proceed)).toBe(true)
        expect(proceed).not.toHaveBeenCalled()
        await act(async () => {})

        expect(mocks.flush).toHaveBeenCalledTimes(1)
        expect(proceed).toHaveBeenCalledTimes(1)
    })

    it('keeps the writer in the studio with the discard dialog when the save fails', async () => {
        mocks.flush.mockResolvedValue(false)
        render(<NovelStudio />)
        const [interceptor] = mocks.interceptors
        const proceed = vi.fn()

        expect(interceptor(proceed)).toBe(true)
        await act(async () => {})

        expect(proceed).not.toHaveBeenCalled()
        const dialog = screen.getByRole('dialog', { name: 'Unsaved changes' })
        fireEvent.click(dialog.querySelector('button')!)
        expect(proceed).toHaveBeenCalledTimes(1)
    })

    it('cancels the held navigation when the writer stays after a failed save', async () => {
        mocks.flush.mockResolvedValue(false)
        render(<NovelStudio />)
        const [interceptor] = mocks.interceptors as Set<(proceed: () => void, cancel?: () => void) => boolean>
        const proceed = vi.fn()
        const cancel = vi.fn()

        expect(interceptor(proceed, cancel)).toBe(true)
        await act(async () => {})
        const dialog = screen.getByRole('dialog', { name: 'Unsaved changes' })
        fireEvent.click(within(dialog).getByRole('button', { name: /cancel/i }))

        expect(proceed).not.toHaveBeenCalled()
        expect(cancel).toHaveBeenCalledTimes(1)
    })

    it('stops guarding once no story is open', () => {
        const { rerender } = render(<NovelStudio />)
        expect(mocks.interceptors.size).toBe(1)

        mocks.useNovelStudio.mockReturnValue({
            ...{activeScene:chapter().scenes[0],scenes:chapter().scenes,structure:{pending:null,error:null,busy:false,storageFailed:false,perform:vi.fn(),retry:vi.fn()},addScene:vi.fn()}, story: null, workspace: STORY_WORKSPACE, chapters: [], activeChapter: null,
            focusMode: false, codexOpen: false, typewriter: false, historyOpen: false })
        rerender(<NovelStudio />)
        expect(mocks.interceptors.size).toBe(0)
    })
})

describe('NovelStudio while the story workspace is archived', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.readingSource.mockReturnValue(null)
        const activeChapter = chapter()
        mocks.useNovelStudio.mockReturnValue({
            ...{activeScene:chapter().scenes[0],scenes:chapter().scenes,structure:{pending:null,error:null,busy:false,storageFailed:false,perform:vi.fn(),retry:vi.fn()},addScene:vi.fn()}, story: story(activeChapter), workspace: STORY_WORKSPACE, readOnly: true,workspaceReadOnly:true, chapters: [activeChapter], activeChapter,
            focusMode: false, codexOpen: false, typewriter: false, historyOpen: false })
        mocks.useWordGoal.mockReturnValue({ goal: 1800, setGoal: mocks.setGoal })
    })

    it('renders the manuscript read-only and refuses generation, accept and discard without a request', async () => {
        render(<NovelStudio />)
        expect(mocks.editor.props.readOnly).toBe(true)
        expect(mocks.editor.props.onAddToCodex).toBeUndefined()

        await expect(mocks.editor.onGenerate!({ command: 'continue' })).rejects.toThrow('This workspace is archived. Restore it to create or edit content.')
        await (mocks.editor.props.onAcceptGeneration as (id: string) => Promise<void>)('generation-1')
        await (mocks.editor.props.onDiscardGeneration as (id: string) => Promise<void>)('generation-1')

        expect(mocks.generate).not.toHaveBeenCalled()
        expect(mocks.acceptGeneration).not.toHaveBeenCalled()
        expect(mocks.discardGeneration).not.toHaveBeenCalled()
    })

    it('answers Ctrl/Cmd+S and a goal change with the archived message instead of a save', async () => {
        render(<NovelStudio />)

        fireEvent.keyDown(window, { key: 's', ctrlKey: true })
        expect(await screen.findByRole('alert')).toHaveTextContent('This workspace is archived. Restore it to create or edit content.')

        fireEvent.click(screen.getByRole('button', { name: 'Goal 1800' }))
        expect(mocks.setGoal).not.toHaveBeenCalled()
    })
})
