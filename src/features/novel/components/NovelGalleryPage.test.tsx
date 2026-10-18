import { eraseAck,erasePreview } from '@/test/fixtures/storyErase'
import { novel, storyChapter, storyScene } from '@/test/fixtures/story'
import { copyPreview } from '@/test/fixtures/storyCopy'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ReactElement } from 'react'
import { I18nextProvider } from 'react-i18next'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { i18n } from '@/app/i18n'

const setPage = vi.fn()
const createStory = vi.fn()
const openLoginModal = vi.fn()
const openStory = vi.fn().mockResolvedValue(undefined)
const deleteStory = vi.fn().mockResolvedValue(undefined)
const storyLifecycle=vi.fn().mockResolvedValue(undefined)
const forgetErasedStory=vi.fn()
let authed = true

// GalleryCard deep-imports the playlist hook (not the barrel) to keep the
// primitives module graph light, so it gets its own mock.
vi.mock('@/app/hooks/usePlaylist', () => ({
    usePlaylist: () => ({
        currentTrack: null,
        isPlaying: false,
        playNow: vi.fn(),
        enqueue: vi.fn(),
        isQueued: () => false,
    }),
}))

vi.mock('@/app/hooks', () => ({
    useAuth: () => ({ isAuthenticated: authed, userHash: authed ? 'gallery-author' : null, openLoginModal }),
    useNavigation: () => ({ setPage }),
    useData: () => ({ createStory, openStory, deleteStory,storyLifecycle,forgetErasedStory,pendingStoryLifecycle:[] }),
}))

vi.mock('@/infrastructure/api', async (importOriginal) => {
    const actual=await importOriginal<typeof import('@/infrastructure/api')>()
    const apiService: Record<string, unknown> = {
        getStories: vi.fn(),
        previewStoryErase:vi.fn(),permanentlyEraseStory:vi.fn(),getStoryEraseResult:vi.fn(),
        previewStoryCopy: vi.fn(),
        copyStory: vi.fn(),
        getStory: vi.fn(),
        getCharacters: vi.fn().mockResolvedValue([]),
        getWorlds: vi.fn().mockResolvedValue([]),
        getItems: vi.fn().mockResolvedValue([]),
        getAdventureTemplates: vi.fn().mockResolvedValue([]),
    }
    apiService.withWorkspace = vi.fn(() => apiService)
    return { ...actual,apiService, resolveMediaUrl: (url?: string | null) => url ?? undefined }
})

import type { Story, StoryChapter } from '@/shared'
import { apiService } from '@/infrastructure/api'
import {
    OTHER_WORKSPACE_ID,
    TEST_WORKSPACE_ID,
    WorkspaceTestProvider,
    createWorkspaceTestState,
    testWorkspace,
    type WorkspaceTestState,
} from '@/shared/hooks/testing/workspaceTestUtils'
import { NovelGalleryPage } from './NovelGalleryPage'

let workspace: WorkspaceTestState

function inWorkspace(ui: ReactElement) {
    return <WorkspaceTestProvider state={workspace}>{ui}</WorkspaceTestProvider>
}

const ACTIVE_CONTEXT = {
    includeSelectedCards: true,
    includeLorebooks: true,
    includeRecentChapters: 2,
    tokenBudget: 6000,
    styleSource: 'current_scene' as const,
    customStyleInstruction: null,
}

function chapter(id: string, storyId: string, body: string): StoryChapter {
    return storyChapter({id,storyId,title:id,scenes:[storyScene({id:id+'-scene',chapterId:id,storyId,body})]})
}

const STORIES: Story[] = [
    {
        ...novel({chapters:[]}),
        id: 's1',
        title: 'Glass War',
        description: null,
        source: { kind: 'character', id: 'c1', title: 'Aria' },
        chapters: [chapter('ch1', 's1', 'The moon cracks over the wall.')],
        activeCardRefs: [
            {
                id: 'r1',
                storyId: 's1',
                chapterId: null, sceneId: null, removedAt: null,
                kind: 'character',
                cardId: 'c1',
                source: 'source',
                enabled: true,
                precedence: 0,
                snapshot: {
                    id: 'c1',
                    name: 'Aria',
                    description: 'A ranger.',
                    story_card_kind: 'character',
                },
            },
        ],
        activeContext: ACTIVE_CONTEXT,
    },
    {
        ...novel({chapters:[]}),
        id: 's2',
        title: 'Moon Court',
        description: null,
        source: { kind: 'blank', id: null, title: null },
        chapters: [chapter('ch2', 's2', '')],
        activeCardRefs: [],
        activeContext: ACTIVE_CONTEXT,
    },
]

function renderSpanish(ui: ReactElement) {
    const localI18n = i18n.cloneInstance({ lng: 'es' })
    return render(<I18nextProvider i18n={localI18n}>{inWorkspace(ui)}</I18nextProvider>)
}

describe('NovelGalleryPage', () => {
    beforeEach(async () => {
        await i18n.changeLanguage('en')
        authed = true
        vi.clearAllMocks()
        localStorage.clear()
        workspace = createWorkspaceTestState({ api: apiService })
        if (!globalThis.IntersectionObserver) {
            vi.stubGlobal('IntersectionObserver', class IntersectionObserver {
                observe() {}
                unobserve() {}
                disconnect() {}
            })
        }
        vi.mocked(apiService.getStories).mockResolvedValue(STORIES)
        createStory.mockResolvedValue(STORIES[1])
        openStory.mockResolvedValue(undefined)
        deleteStory.mockResolvedValue(undefined)
    })

    it('renders novels fetched from the API with source badge and counts', async () => {
        render(inWorkspace(<NovelGalleryPage />))

        expect(await screen.findByText('Glass War')).toBeInTheDocument()
        expect(screen.getByText('Moon Court')).toBeInTheDocument()
        expect(apiService.getStories).toHaveBeenCalledWith(0, 24, undefined)
        expect(screen.getByText('Aria')).toBeInTheDocument()
        expect(screen.getAllByText('1 chapter').length).toBe(2)
    })

    it('applies server metadata filters and sorting while retaining search and carries them into Trash',async()=>{
        vi.mocked(apiService.getStories).mockImplementation(async(_skip,_limit,_query,_trashed,filters)=>filters?[novel({id:'filtered',title:'Filtered manuscript'})]:STORIES)
        render(inWorkspace(<NovelGalleryPage/>));await screen.findByText('Glass War')
        fireEvent.change(screen.getByTestId('gallery-search-input'),{target:{value:'moon'}})
        await waitFor(()=>expect(apiService.getStories).toHaveBeenLastCalledWith(0,24,'moon'))
        fireEvent.click(screen.getByRole('button',{name:'Filters and sort'}))
        fireEvent.change(screen.getByRole('textbox',{name:'Genre contains'}),{target:{value:'Fantasy'}})
        fireEvent.click(screen.getByRole('combobox',{name:'Sort novels'}));fireEvent.click(screen.getByRole('option',{name:'Title A–Z'}))
        fireEvent.click(screen.getByRole('button',{name:'Apply filters'}))
        await screen.findByText('Filtered manuscript')
        expect(apiService.getStories).toHaveBeenLastCalledWith(0,24,'moon',false,{genre:'Fantasy',sort:'title_asc'})
        expect(screen.getByTestId('gallery-search-input')).toHaveValue('moon')
        fireEvent.click(screen.getByRole('combobox',{name:'Novel library view'}));fireEvent.click(screen.getByRole('option',{name:'Novel Trash'}))
        await waitFor(()=>expect(apiService.getStories).toHaveBeenLastCalledWith(0,24,undefined,true,{genre:'Fantasy',sort:'title_asc'}))
    })

    it('ignores an older library response after applying another filter selection',async()=>{
        let finish!:(stories:Story[])=>void
        vi.mocked(apiService.getStories).mockImplementationOnce(()=>new Promise((resolve)=>{finish=resolve})).mockResolvedValue([novel({id:'filtered-latest',title:'Latest filtered draft'})])
        render(inWorkspace(<NovelGalleryPage/>))
        await waitFor(()=>expect(apiService.getStories).toHaveBeenCalledOnce())
        fireEvent.click(screen.getByRole('button',{name:'Filters and sort'}))
        fireEvent.change(screen.getByRole('textbox',{name:'Genre contains'}),{target:{value:'Fantasy'}})
        fireEvent.click(screen.getByRole('button',{name:'Apply filters'}))
        await screen.findByText('Latest filtered draft')
        await act(async()=>{finish(STORIES)})
        expect(screen.queryByText('Glass War')).not.toBeInTheDocument()
        expect(screen.getByText('Latest filtered draft')).toBeInTheDocument()
    })

    it('uses metadata summary counts without inventing an empty manuscript',async()=>{
        vi.mocked(apiService.getStories).mockResolvedValue([novel({summary:true,chapters:[],chapterCount:3,sceneCount:7})])
        render(inWorkspace(<NovelGalleryPage/>))
        expect(await screen.findByText('3 chapters')).toBeInTheDocument()
        expect(screen.getByText('7 scenes')).toBeInTheDocument()
        expect(screen.queryByText('0 words')).not.toBeInTheDocument()
    })
    it('offers erasure only in Trash and recovers a lost response outside the closed dialog',async()=>{
        const target=novel({id:'erase-target',title:'Erasure target',trashedAt:'2026-10-16T00:00:00'})
        const other=novel({id:'keep-other',title:'Keep this other novel',trashedAt:'2026-10-16T00:00:00'})
        let records=[target,other]
        vi.mocked(apiService.getStories).mockImplementation(async(_skip,_limit,_query,trashed)=>trashed?records:STORIES)
        vi.mocked(apiService.previewStoryErase).mockResolvedValue(erasePreview({storyId:target.id,title:target.title}))
        vi.mocked(apiService.permanentlyEraseStory).mockImplementationOnce(async()=>{records=[other];throw new Error('Response lost')})
        vi.mocked(apiService.getStoryEraseResult).mockImplementation(async(_id,write)=>({...eraseAck(write),storyId:target.id}))
        render(inWorkspace(<NovelGalleryPage/>));await screen.findByText('Glass War')
        fireEvent.click(screen.getAllByTestId('card-options-button')[0]);expect(screen.queryByRole('menuitem',{name:'Erase permanently'})).not.toBeInTheDocument()
        fireEvent.keyDown(document,{key:'Escape'})
        fireEvent.click(screen.getByRole('combobox',{name:'Novel library view'}));fireEvent.click(screen.getByRole('option',{name:'Novel Trash'}))
        await screen.findByText('Erasure target');fireEvent.click(screen.getAllByTestId('card-options-button')[0])
        fireEvent.click(screen.getByRole('menuitem',{name:'Erase permanently'}))
        await screen.findByText('Parts: 0 · chapters: 1 · scenes: 2')
        fireEvent.change(screen.getByRole('textbox',{name:'Type the novel’s exact title'}),{target:{value:target.title}})
        fireEvent.click(screen.getByRole('button',{name:'Erase permanently'}))
        await waitFor(()=>expect(apiService.permanentlyEraseStory).toHaveBeenCalledTimes(1))
        await screen.findAllByText('The result could not be confirmed. Keep the recovery information and check again.')
        fireEvent.click(screen.getAllByRole('button',{name:'Close'}).slice(-1)[0])
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
        fireEvent.click(screen.getByRole('button',{name:'Check result'}))
        await waitFor(()=>expect(forgetErasedStory).toHaveBeenCalledWith(target.id))
        expect(await screen.findByText('Keep this other novel')).toBeInTheDocument()
        await waitFor(()=>expect(screen.queryByText('Erasure target')).not.toBeInTheDocument())
        expect(apiService.permanentlyEraseStory).toHaveBeenCalledTimes(1)
        await waitFor(()=>expect(screen.getByTestId('gallery-search-input')).toHaveFocus())
    })

    it('browses the workspace Trash and restores the original novel',async()=>{
        vi.mocked(apiService.getStories).mockImplementation(async(_skip,_limit,_query,trashed)=>trashed?[novel({id:'trashed',title:'Recovered novel',trashedAt:'2026-10-16T00:00:00'})]:STORIES)
        render(inWorkspace(<NovelGalleryPage/>))
        await screen.findByText('Glass War')
        fireEvent.click(screen.getByRole('combobox',{name:'Novel library view'}))
        fireEvent.click(screen.getByRole('option',{name:'Novel Trash'}))
        expect(await screen.findByText('Recovered novel')).toBeInTheDocument()
        expect(apiService.getStories).toHaveBeenLastCalledWith(0,24,undefined,true)
        fireEvent.click(screen.getByTestId('card-options-button'))
        fireEvent.click(screen.getByRole('menuitem',{name:'Restore'}))
        await waitFor(()=>expect(storyLifecycle).toHaveBeenCalledWith('trashed','restore'))
        expect(await screen.findByText('Trash is empty')).toBeInTheDocument()
    })

    it('renders signed-out without fetching and opens login from create', async () => {
        authed = false

        render(inWorkspace(<NovelGalleryPage />))

        expect(await screen.findByText('No novels yet')).toBeInTheDocument()
        expect(apiService.getStories).not.toHaveBeenCalled()
        expect(openLoginModal).not.toHaveBeenCalled()

        fireEvent.click(screen.getAllByRole('button', { name: /New novel/ })[0])

        expect(openLoginModal).toHaveBeenCalledTimes(1)
        expect(screen.queryByRole('dialog', { name: 'New novel' })).not.toBeInTheDocument()
    })

    it('fires a debounced server search with the typed query', async () => {
        render(inWorkspace(<NovelGalleryPage />))
        await screen.findByText('Glass War')

        fireEvent.change(screen.getByTestId('gallery-search-input'), { target: { value: 'moon' } })

        await waitFor(() => expect(apiService.getStories).toHaveBeenCalledWith(0, 24, 'moon'))
    })

    it('opens a novel and navigates to the studio when its card is activated', async () => {
        render(inWorkspace(<NovelGalleryPage />))
        const card = (await screen.findAllByTestId('gallery-card'))[0]

        fireEvent.click(card)

        await waitFor(() => expect(openStory).toHaveBeenCalledWith(expect.objectContaining({ id: 's1' })))
        await waitFor(() => expect(setPage).toHaveBeenCalledWith('story'))
    })

    it('reviews an independent copy and opens it only after the author chooses Open copy', async () => {
        vi.mocked(apiService.previewStoryCopy).mockResolvedValue({ ...copyPreview(), sourceId: 's1', sourceTitle: 'Glass War' })
        vi.mocked(apiService.copyStory).mockImplementation(async (sourceId, write) => ({
            kind: 'novel_copy', requestId: write.requestId, sourceId, storyId: 'independent-copy',
            sourceVersion: write.expectedSourceVersion, title: write.title, options: write.options,
        }))
        vi.mocked(apiService.getStory).mockResolvedValue(novel({ id: 'independent-copy', title: 'Another ending' }))
        render(inWorkspace(<NovelGalleryPage />))
        await screen.findByText('Glass War')
        fireEvent.click(screen.getAllByTestId('card-options-button')[0])
        fireEvent.click(screen.getByRole('menuitem', { name: 'Duplicate novel' }))

        const dialog = await screen.findByRole('dialog', { name: 'Duplicate novel' })
        await within(dialog).findByText('Parts: 0 · chapters: 1 · scenes: 1 · Codex snapshots: 1')
        fireEvent.change(within(dialog).getByRole('textbox', { name: 'Title for the new draft' }), { target: { value: 'Another ending' } })
        fireEvent.click(within(dialog).getByRole('button', { name: 'Create independent draft' }))

        const openCopy = await screen.findByRole('button', { name: 'Open copy' })
        expect(apiService.copyStory).toHaveBeenCalledWith('s1', expect.objectContaining({
            title: 'Another ending', expectedSourceVersion: 'a'.repeat(64),
            options: { includeNotes: true, includeContext: true, includeArchived: false, includeTrash: false },
        }))
        expect(openStory).not.toHaveBeenCalled()
        expect(setPage).not.toHaveBeenCalled()
        fireEvent.click(openCopy)
        await waitFor(() => expect(openStory).toHaveBeenCalledWith(expect.objectContaining({ id: 'independent-copy' })))
        await waitFor(() => expect(setPage).toHaveBeenCalledWith('story'))
        expect(screen.queryByRole('button', { name: 'Open copy' })).not.toBeInTheDocument()
    })

    it('deletes via the hover menu through the confirm dialog and removes the card', async () => {
        render(inWorkspace(<NovelGalleryPage />))
        await screen.findByText('Glass War')

        fireEvent.click(screen.getAllByTestId('card-options-button')[0])
        fireEvent.click(screen.getAllByRole('menuitem', { name: 'Move to Trash' })[0])

        const dialog = await screen.findByRole('dialog')
        fireEvent.click(within(dialog).getByRole('button', { name: 'Move to Trash' }))

        await waitFor(() => expect(deleteStory).toHaveBeenCalledWith('s1'))
        await waitFor(() => expect(screen.queryByText('Glass War')).not.toBeInTheDocument())
        expect(screen.getByText('Moon Court')).toBeInTheDocument()
    })

    it('creates a blank novel from the create modal and navigates to the studio', async () => {
        render(inWorkspace(<NovelGalleryPage />))
        await screen.findByText('Glass War')

        fireEvent.click(screen.getByRole('button', { name: /New novel/ }))
        const title = await screen.findByTestId('novel-create-title')
        fireEvent.change(title, { target: { value: 'Ember Tides' } })
        fireEvent.click(screen.getByTestId('novel-create-submit'))

        await waitFor(() =>
            expect(createStory).toHaveBeenCalledWith({
                title: 'Ember Tides',
                description: undefined,
                source: { kind: 'blank' },
                chapters: [{ title: 'Chapter 1',status:null }],
            }),
        )
        await waitFor(() => expect(setPage).toHaveBeenCalledWith('story'))
    })

    it('requires a picked card before creating from a card', async () => {
        render(inWorkspace(<NovelGalleryPage />))
        await screen.findByText('Glass War')

        fireEvent.click(screen.getByRole('button', { name: /New novel/ }))
        fireEvent.click(await screen.findByTestId('novel-create-source-card'))

        expect(screen.getByTestId('novel-create-submit')).toBeDisabled()
    })

    it('renders novel gallery and create modal chrome in Spanish', async () => {
        vi.mocked(apiService.getStories).mockResolvedValue([])

        renderSpanish(<NovelGalleryPage />)

        expect(await screen.findByText('Aún no hay novelas')).toBeInTheDocument()
        expect(screen.getByPlaceholderText('Buscar novelas por título o texto…')).toBeInTheDocument()

        fireEvent.click(screen.getAllByRole('button', { name: 'Nueva novela' })[0])

        expect(await screen.findByRole('dialog', { name: 'Nueva novela' })).toBeInTheDocument()
        expect(screen.getByLabelText('Título')).toBeInTheDocument()
        expect(screen.getByText('Empezar desde')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Crear novela' })).toBeInTheDocument()
    })

    it('lists the committed workspace and restarts from offset 0 after a switch', async () => {
        const otherApi = {
            getStories: vi.fn().mockResolvedValue([STORIES[1]]),
            getCharacters: vi.fn().mockResolvedValue([]),
            getWorlds: vi.fn().mockResolvedValue([]),
            getItems: vi.fn().mockResolvedValue([]),
            getAdventureTemplates: vi.fn().mockResolvedValue([]),
        }
        workspace = createWorkspaceTestState({
            api: apiService,
            overrides: {
                get api() {
                    return (workspace.live.selectedWorkspaceId === OTHER_WORKSPACE_ID ? otherApi : apiService) as never
                },
            },
        })
        const { rerender } = render(inWorkspace(<NovelGalleryPage />))
        expect(await screen.findByText('Glass War')).toBeInTheDocument()
        fireEvent.change(screen.getByTestId('gallery-search-input'), { target: { value: 'glass' } })

        fireEvent.click(screen.getByRole('button',{name:'Filters and sort'}))
        fireEvent.change(screen.getByRole('textbox',{name:'Genre contains'}),{target:{value:'Fantasy'}})
        fireEvent.click(screen.getByRole('button',{name:'Apply filters'}))

        workspace.switchTo(OTHER_WORKSPACE_ID)
        rerender(inWorkspace(<NovelGalleryPage />))

        expect(await screen.findByText('Moon Court')).toBeInTheDocument()
        expect(screen.queryByText('Glass War')).not.toBeInTheDocument()
        expect(otherApi.getStories).toHaveBeenCalledWith(0, 24, undefined)
        // The search of the previous workspace does not carry over.
        expect(screen.getByTestId('gallery-search-input')).toHaveValue('')
        expect(screen.getByRole('button',{name:'Filters and sort'})).toBeInTheDocument()
    })

    it('keeps an archived workspace readable but disables New, Duplicate and Delete', async () => {
        workspace = createWorkspaceTestState({
            api: apiService,
            selectedWorkspaceId: OTHER_WORKSPACE_ID,
            workspaces: [
                testWorkspace(TEST_WORKSPACE_ID, 'Main library'),
                testWorkspace(OTHER_WORKSPACE_ID, 'Novel A', { archived_at: '2026-10-10T00:00:00Z' }),
            ],
        })
        render(inWorkspace(<NovelGalleryPage />))
        expect(await screen.findByText('Glass War')).toBeInTheDocument()

        // No new novel.
        expect(screen.getByRole('button', { name: /New novel/ })).toBeDisabled()
        fireEvent.click(screen.getByRole('button', { name: /New novel/ }))
        expect(screen.queryByRole('dialog', { name: 'New novel' })).not.toBeInTheDocument()

        // No delete.
        fireEvent.click(screen.getAllByTestId('card-options-button')[0])
        expect(screen.getByRole('menuitem', { name: 'Duplicate novel' })).toBeDisabled()
        const deleteItem = screen.getAllByRole('menuitem', { name: 'Move to Trash' })[0]
        expect(deleteItem).toBeDisabled()
        fireEvent.click(deleteItem)
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

        // Search and open keep working.
        fireEvent.change(screen.getByTestId('gallery-search-input'), { target: { value: 'moon' } })
        await waitFor(() => expect(apiService.getStories).toHaveBeenCalledWith(0, 24, 'moon'))
        fireEvent.click(screen.getAllByTestId('gallery-card')[0])
        await waitFor(() => expect(openStory).toHaveBeenCalled())
        await waitFor(() => expect(setPage).toHaveBeenCalledWith('story'))

        expect(createStory).not.toHaveBeenCalled()
        expect(deleteStory).not.toHaveBeenCalled()
    })

    it('disables the empty-state New novel of an archived workspace', async () => {
        vi.mocked(apiService.getStories).mockResolvedValue([])
        workspace = createWorkspaceTestState({
            api: apiService,
            workspaces: [testWorkspace(TEST_WORKSPACE_ID, 'Main library', { archived_at: '2026-10-10T00:00:00Z' })],
        })
        render(inWorkspace(<NovelGalleryPage />))

        expect(await screen.findByText('No novels yet')).toBeInTheDocument()
        const buttons = screen.getAllByRole('button', { name: /New novel/ })
        expect(buttons).toHaveLength(2)
        for (const button of buttons) expect(button).toBeDisabled()
    })

    it('does not open the studio when a story opened after a workspace switch', async () => {
        let finishOpen!: () => void
        openStory.mockImplementationOnce(() => new Promise<void>((resolve) => { finishOpen = resolve }))
        const { rerender } = render(inWorkspace(<NovelGalleryPage />))
        fireEvent.click((await screen.findAllByTestId('gallery-card'))[0])
        await waitFor(() => expect(openStory).toHaveBeenCalled())

        workspace.switchTo(OTHER_WORKSPACE_ID)
        rerender(inWorkspace(<NovelGalleryPage />))
        await act(async () => {
            finishOpen()
            await Promise.resolve()
        })

        expect(setPage).not.toHaveBeenCalled()
    })
})
