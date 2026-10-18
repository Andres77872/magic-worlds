import { useContext, type ContextType, type ReactNode } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiService } from '@/infrastructure/api'
import type { Character } from '@/shared/types'
import { setAllTestFeatureFlags } from '@/shared/hooks/testing/featureFlagTestUtils'
import { OTHER_WORKSPACE_ID as WS_B, TEST_WORKSPACE_ID as WS_A } from '@/shared/hooks/testing/workspaceTestUtils'

const session = vi.hoisted(() => ({
    accountKey: 'chat-owner', authEpoch: 1, workspaceId: '0f1e2d3c-4b5a-4978-8a6b-5c4d3e2f1a0b', workspaceEpoch: 1,
}))
const clients = vi.hoisted(() => {
    const client = () => ({
        getCharacters: vi.fn(), getWorlds: vi.fn(), getItems: vi.fn(), getAdventureTemplates: vi.fn(),
        getAdventureSessions: vi.fn(), getCharacterChats: vi.fn(), getLorebooks: vi.fn(), getStories: vi.fn(),
        getCharacterChat: vi.fn(), createCharacterChat: vi.fn(), createCharacterGroupChat: vi.fn(),
        addCharacterChatCodexCards: vi.fn(), updateCharacterChatCodexCard: vi.fn(),
        deleteCharacterChatCodexCard: vi.fn(), refreshChatVoice: vi.fn(),
    })
    return { a: client(), b: client() }
})
vi.mock('../hooks/useAuth', () => ({
    useAuth: () => ({ ...session, isAuthenticated: true, sessionPhase: 'authenticated', openLoginModal: vi.fn() }),
}))
vi.mock('../hooks/useWorkspace', () => ({
    useWorkspace: () => ({
        status: 'ready', selectedWorkspaceId: session.workspaceId, workspaceEpoch: session.workspaceEpoch,
        api: session.workspaceId === '0f1e2d3c-4b5a-4978-8a6b-5c4d3e2f1a0b' ? clients.a : clients.b,
    }),
}))
vi.mock('../hooks/usePageFocus', () => ({ usePageFocus: () => true, isPageFocused: () => true }))
vi.mock('@/infrastructure', async (importOriginal) => ({
    ...await importOriginal<typeof import('@/infrastructure')>(), apiService: clients.a,
}))

import { DataContext, DataProvider } from './DataProvider'
import { NavigationContext } from './NavigationProvider'

type Data = NonNullable<ContextType<typeof DataContext>>
const setPage = vi.fn()
const navigation: NonNullable<ContextType<typeof NavigationContext>> = {
    currentPage: 'chatroom', currentHash: '#/chatroom', setPage, goBack: vi.fn(),
    cardEdit: null, resourceEdit: null, replaceHash: vi.fn(), registerNavigationInterceptor: () => () => {},
}
const character: Character = { id: 'c1', name: 'Lyra', role: 'character', race: 'Elf', stats: {} }
const persona: Character = { id: 'p1', name: 'Aria', role: 'persona', race: 'Human', stats: {} }
function chatRow(id: number, workspaceId: string, title = 'Saved chat') {
    return {
        chat_id: id, kind: 'character' as const, character_ids: [character.id], characters: [character],
        persona_id: persona.id, persona, title, organization: { workspace_id: workspaceId },
        codex_cards: [{ id: 'codex-1', kind: 'world', card_id: 'w1', enabled: true, precedence: 0, snapshot: { name: 'Harbor' } }],
        created_at: '2026-10-18T00:00:00Z', updated_at: '2026-10-18T00:00:00Z',
    }
}
function deferred<T>() {
    let resolve!: (value: T) => void
    const promise = new Promise<T>((done) => { resolve = done })
    return { promise, resolve }
}
function Wrapper({ children }: { children: ReactNode }) {
    return <NavigationContext.Provider value={navigation}><DataProvider>{children}</DataProvider></NavigationContext.Provider>
}
const mount = () => renderHook(() => useContext(DataContext)!, { wrapper: Wrapper })
async function ready(view: ReturnType<typeof mount>, id: string) {
    await waitFor(() => {
        expect(view.result.current.isLoading).toBe(false)
        expect(view.result.current.characterChats.map((chat) => chat.id)).toEqual([id])
    })
}
async function switchTo(view: ReturnType<typeof mount>, workspaceId: string, id: string) {
    session.workspaceId = workspaceId
    session.workspaceEpoch++
    view.rerender()
    await ready(view, id)
}
const mutations = [
    { name: 'add Codex cards', method: 'addCharacterChatCodexCards', start: (data: Data) => data.addCharacterChatCodexCards('9', [{ kind: 'world', cardId: 'w2' }]) },
    { name: 'toggle a Codex card', method: 'updateCharacterChatCodexCard', start: (data: Data) => data.toggleCharacterChatCodexCard('9', 'codex-1', false) },
    { name: 'remove a Codex card', method: 'deleteCharacterChatCodexCard', start: (data: Data) => data.removeCharacterChatCodexCard('9', 'codex-1') },
    { name: 'refresh the voice', method: 'refreshChatVoice', start: (data: Data) => data.refreshCharacterChatVoice('9', clients.a as unknown as ApiService) },
] as const

beforeEach(() => {
    vi.resetAllMocks()
    localStorage.clear()
    setAllTestFeatureFlags(true)
    Object.assign(session, { accountKey: 'chat-owner', authEpoch: 1, workspaceId: WS_A, workspaceEpoch: 1 })
    window.history.replaceState(null, '', '#/chatroom')
    for (const api of Object.values(clients)) {
        for (const method of ['getCharacters', 'getWorlds', 'getItems', 'getAdventureTemplates', 'getAdventureSessions', 'getLorebooks', 'getStories'] as const) {
            api[method].mockResolvedValue([])
        }
    }
    clients.a.getCharacterChats.mockResolvedValue([chatRow(9, WS_A)])
    clients.b.getCharacterChats.mockResolvedValue([chatRow(22, WS_B)])
})

it('preserves the server organization on loaded rooms', async () => {
    const view = mount()
    await ready(view, '9')
    expect(view.result.current.characterChats[0].organization).toEqual({ workspace_id: WS_A })
})

it.each(['character', 'character_group'] as const)('preserves organization when a %s draft is persisted', async (kind) => {
    const cast = kind === 'character' ? [character] : [character, { ...character, id: 'c2' }]
    const saved = { ...chatRow(77, WS_A), kind, character_ids: cast.map((card) => card.id), characters: cast }
    clients.a.createCharacterChat.mockResolvedValue(saved)
    clients.a.createCharacterGroupChat.mockResolvedValue(saved)
    const view = mount()
    await ready(view, '9')
    await act(async () => {
        const draft = kind === 'character'
            ? await view.result.current.startCharacterChat(character, persona)
            : await view.result.current.startCharacterGroupChat([character, { ...character, id: 'c2' }], persona)
        await view.result.current.ensureCharacterChatSession(draft)
    })
    expect(view.result.current.activeCharacterChat).toMatchObject({ id: '77', organization: { workspace_id: WS_A } })
    expect(view.result.current.characterChats[0].organization).toEqual({ workspace_id: WS_A })
})

describe.each(mutations)('$name workspace ownership', ({ method, start }) => {
    it('updates the active room and list while its owner is current', async () => {
        clients.a[method].mockResolvedValue(chatRow(9, WS_A, 'Confirmed change'))
        const view = mount()
        await ready(view, '9')
        act(() => view.result.current.resumeCharacterChat(view.result.current.characterChats[0]))
        await act(async () => { await start(view.result.current) })
        expect(view.result.current.characterChats[0]).toMatchObject({ title: 'Confirmed change', organization: { workspace_id: WS_A } })
        expect(view.result.current.activeCharacterChat).toEqual(view.result.current.characterChats[0])
        expect(clients.a[method]).toHaveBeenCalledOnce()
        expect(clients.b[method]).not.toHaveBeenCalled()
    })

    it.each([false, true])('ignores an old response after switching (return to A: %s)', async (returnToA) => {
        const pending = deferred<ReturnType<typeof chatRow>>()
        clients.a[method].mockReturnValueOnce(pending.promise)
        const view = mount()
        await ready(view, '9')
        let request!: ReturnType<typeof start>
        act(() => { request = start(view.result.current) })
        await switchTo(view, WS_B, '22')
        if (returnToA) {
            clients.a.getCharacterChats.mockResolvedValue([chatRow(9, WS_A, 'Fresh A after returning')])
            await switchTo(view, WS_A, '9')
        }
        act(() => view.result.current.resumeCharacterChat(view.result.current.characterChats[0], { mode: 'voice' }))
        const chats = view.result.current.characterChats
        const active = view.result.current.activeCharacterChat
        await act(async () => {
            pending.resolve(chatRow(9, WS_A, 'Old response'))
            expect(await request).toMatchObject({ title: 'Old response', organization: { workspace_id: WS_A } })
        })
        expect(view.result.current.characterChats).toEqual(chats)
        expect(view.result.current.activeCharacterChat).toEqual(active)
        expect(view.result.current.activeCharacterChatMode).toBe('voice')
        expect(setPage).not.toHaveBeenCalled()
        expect(clients.a[method]).toHaveBeenCalledOnce()
        expect(clients.b[method]).not.toHaveBeenCalled()
    })

    it.each(['account', 'auth epoch'] as const)('ignores a response after the %s changes in the same workspace', async (change) => {
        const pending = deferred<ReturnType<typeof chatRow>>()
        clients.a[method].mockReturnValueOnce(pending.promise)
        const view = mount()
        await ready(view, '9')
        let request!: ReturnType<typeof start>
        act(() => { request = start(view.result.current) })
        if (change === 'account') session.accountKey = 'another-chat-owner'
        else session.authEpoch++
        clients.a.getCharacterChats.mockResolvedValue([chatRow(9, WS_A, 'Fresh owner')])
        view.rerender()
        await waitFor(() => expect(view.result.current.characterChats[0]?.title).toBe('Fresh owner'))
        await act(async () => { pending.resolve(chatRow(9, WS_A, 'Old owner')); await request })
        expect(view.result.current.characterChats[0].title).toBe('Fresh owner')
    })
})

it('does not publish a voice refresh from an explicit client for another workspace', async () => {
    const view = mount()
    await ready(view, '9')
    await switchTo(view, WS_B, '22')
    clients.a.refreshChatVoice.mockResolvedValue(chatRow(9, WS_A))
    await act(async () => { await view.result.current.refreshCharacterChatVoice('9', clients.a as unknown as ApiService) })
    expect(clients.a.refreshChatVoice).toHaveBeenCalledWith(9)
    expect(view.result.current.characterChats.map((chat) => chat.id)).toEqual(['22'])
})

describe('openCharacterChatById workspace ownership', () => {
    it('opens a cached room without fetching it again', async () => {
        const view = mount()
        await ready(view, '9')
        await act(async () => { expect(await view.result.current.openCharacterChatById('9')).toBe(true) })
        expect(view.result.current.activeCharacterChat).toEqual(view.result.current.characterChats[0])
        expect(clients.a.getCharacterChat).not.toHaveBeenCalled()
        expect(setPage).toHaveBeenCalledWith('character-chat')
    })

    it('preserves organization and selects the fetched room while its owner is current', async () => {
        clients.a.getCharacterChat.mockResolvedValue(chatRow(77, WS_A))
        const view = mount()
        await ready(view, '9')
        await act(async () => { expect(await view.result.current.openCharacterChatById('77', { mode: 'voice' })).toBe(true) })
        expect(view.result.current.activeCharacterChat).toMatchObject({ id: '77', organization: { workspace_id: WS_A } })
        expect(view.result.current.activeCharacterChatMode).toBe('voice')
        expect(setPage).toHaveBeenCalledWith('character-chat')
    })

    it.each([false, true])('does not select or navigate after switching (return to A: %s)', async (returnToA) => {
        const pending = deferred<ReturnType<typeof chatRow>>()
        clients.a.getCharacterChat.mockReturnValueOnce(pending.promise)
        const view = mount()
        await ready(view, '9')
        let request!: Promise<boolean>
        act(() => { request = view.result.current.openCharacterChatById('77', { mode: 'voice' }) })
        await switchTo(view, WS_B, '22')
        if (returnToA) await switchTo(view, WS_A, '9')
        act(() => view.result.current.resumeCharacterChat(view.result.current.characterChats[0]))
        const chats = view.result.current.characterChats
        const active = view.result.current.activeCharacterChat
        await act(async () => { pending.resolve(chatRow(77, WS_A)); expect(await request).toBe(false) })
        expect(view.result.current.characterChats).toEqual(chats)
        expect(view.result.current.activeCharacterChat).toEqual(active)
        expect(view.result.current.activeCharacterChatMode).toBe('text')
        expect(setPage).not.toHaveBeenCalled()
        expect(clients.a.getCharacterChat).toHaveBeenCalledWith(77)
        expect(clients.b.getCharacterChat).not.toHaveBeenCalled()
    })

    it('does not open a cached room through a callback retained from the previous workspace', async () => {
        const view = mount()
        await ready(view, '9')
        const open = view.result.current.openCharacterChatById
        await switchTo(view, WS_B, '22')
        await act(async () => { expect(await open('9')).toBe(false) })
        expect(view.result.current.activeCharacterChat).toBeNull()
        expect(setPage).not.toHaveBeenCalled()
    })

    it.each(['account', 'auth epoch'] as const)('does not select or navigate after the %s changes', async (change) => {
        const pending = deferred<ReturnType<typeof chatRow>>()
        clients.a.getCharacterChat.mockReturnValueOnce(pending.promise)
        const view = mount()
        await ready(view, '9')
        let request!: Promise<boolean>
        act(() => { request = view.result.current.openCharacterChatById('77') })
        if (change === 'account') session.accountKey = 'another-chat-owner'
        else session.authEpoch++
        view.rerender()
        await ready(view, '9')
        await act(async () => { pending.resolve(chatRow(77, WS_A)); expect(await request).toBe(false) })
        expect(view.result.current.characterChats.map((chat) => chat.id)).toEqual(['9'])
        expect(view.result.current.activeCharacterChat).toBeNull()
        expect(setPage).not.toHaveBeenCalled()
    })
})
