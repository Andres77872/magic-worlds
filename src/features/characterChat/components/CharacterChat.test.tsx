import { beforeEach as beforeEachGrantedFeatures } from 'vitest'
import { setAllTestFeatureFlags as grantFixtureFeatures } from '@/shared/hooks/testing/featureFlagTestUtils'
beforeEachGrantedFeatures(() => grantFixtureFeatures(true))
import { setTestFeatureFlags } from '@/shared/hooks/testing/featureFlagTestUtils'
import type { ReactElement, ReactNode } from 'react'
import { render as baseRender, screen, type RenderOptions } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CharacterChatSession } from '@/shared'
import {
    createWorkspaceTestState,
    OTHER_WORKSPACE_ID,
    TEST_WORKSPACE_ID,
    WorkspaceTestProvider,
} from '@/shared/hooks/testing/workspaceTestUtils'
import { CharacterChat } from './CharacterChat'

const render = (ui: ReactElement, options?: RenderOptions) =>
    baseRender(<WorkspaceTestProvider state={createWorkspaceTestState()}>{ui}</WorkspaceTestProvider>, options)

const setPage = vi.fn()
const goBack = vi.fn()
const editCharacter = vi.fn()
const resumeCharacterChat = vi.fn()
let activeCharacterChatMode: 'text' | 'voice' = 'text'
let activeCharacterChat: CharacterChatSession | null = null

const CHAT: CharacterChatSession = {
    id: '7',
    character_id: 'c1',
    character: { id: 'c1', name: 'Lyra', race: 'Elf', role: 'character', stats: {} },
    persona: { id: 'p1', name: 'Aria', race: 'Human', role: 'persona', stats: {} },
    turns: [],
}

vi.mock('@/app/hooks', () => ({
    useNavigation: () => ({ setPage, goBack }),
    useAuth: () => ({ isAuthenticated: true, openLoginModal: vi.fn(), token: 'token' }),
    useData: () => ({ activeCharacterChat, activeCharacterChatMode, editCharacter, resumeCharacterChat }),
}))

vi.mock('../../../app/hooks', () => ({
    useNavigation: () => ({ setPage, goBack }),
    useAuth: () => ({ isAuthenticated: true, openLoginModal: vi.fn(), token: 'token' }),
    useData: () => ({ activeCharacterChat, activeCharacterChatMode, editCharacter, resumeCharacterChat }),
}))

vi.mock('../../interaction/components', () => ({
    InteractionCenterPanel: ({ config, speakerRoster }: {
        config: { kind: string; showForwardOptions: boolean; showImages: boolean; workspaceId: string }
        speakerRoster?: { speaker_id: string }[]
    }) => (
        <div>
            <div data-testid="center-kind">{config.kind}</div>
            <div data-testid="center-workspace">{config.workspaceId}</div>
            <div data-testid="center-forward-options">{String(config.showForwardOptions)}</div>
            <div data-testid="center-images">{String(config.showImages)}</div>
            <div data-testid="center-roster">{(speakerRoster ?? []).map((entry) => entry.speaker_id).join(',')}</div>
        </div>
    ),
    InteractionTopBar: () => <header data-testid="top-bar" />,
    SidePanelDrawer: ({ children }: { children: ReactNode }) => <div data-testid="side-panel">{children}</div>,
}))

// Voice mode renders the immersive CallScreen (its own surface), not the text engine.
vi.mock('../../call', () => ({
    CallScreen: ({ sessionId, workspaceId, onSwitchToText }: { sessionId: number; workspaceId?: string | null; onSwitchToText: () => void }) => (
        <div data-testid="call-screen">
            <div data-testid="call-session">{String(sessionId)}</div>
            <div data-testid="call-workspace">{String(workspaceId)}</div>
            <button type="button" onClick={onSwitchToText}>Switch to text</button>
        </div>
    ),
}))

vi.mock('./CharacterChatSidebar', () => ({
    CharacterChatSidebar: ({ sessionId, isGroup }: { sessionId?: string; isGroup?: boolean }) => (
        <aside data-testid="chat-sidebar" data-session-id={sessionId} data-is-group={String(Boolean(isGroup))} />
    ),
}))

describe('CharacterChat voice mode wiring', () => {
    beforeEach(() => {
        activeCharacterChat = CHAT
        activeCharacterChatMode = 'text'
    })

    afterEach(() => {
        vi.clearAllMocks()
        vi.unstubAllEnvs()
    })

    it('uses the existing character text config by default', () => {
        render(<CharacterChat />)

        expect(screen.getByTestId('center-kind')).toHaveTextContent('character')
        expect(screen.getByTestId('center-forward-options')).toHaveTextContent('true')
        expect(screen.getByTestId('center-images')).toHaveTextContent('true')
        expect(screen.getByTestId('chat-sidebar')).toHaveAttribute('data-session-id', '7')
    })

    it.each([null, { ...CHAT, character: undefined, characters: [] }])('returns to chatroom when the refreshed chat has no usable cast (%j)', (chat) => {
        activeCharacterChat = chat
        render(<CharacterChat />, { reactStrictMode: true })
        expect(setPage).toHaveBeenCalledWith('chatroom')
        expect(screen.queryByTestId('center-kind')).not.toBeInTheDocument()
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument()
    })

    it('passes the group chat id to the sidebar for session lorebook attachments', () => {
        activeCharacterChat = {
            ...CHAT,
            id: '12',
            kind: 'character_group',
            character: undefined,
            characters: [
                { id: 'c1', name: 'Lyra', race: 'Elf', role: 'character', stats: {} },
                { id: 'c2', name: 'Dorn', race: 'Dwarf', role: 'character', stats: {} },
            ],
            title: 'Lyra, Dorn',
        }

        render(<CharacterChat />)

        expect(screen.getByTestId('chat-sidebar')).toHaveAttribute('data-session-id', '12')
        expect(screen.getByTestId('chat-sidebar')).toHaveAttribute('data-is-group', 'true')
        // The whole cast reaches the chat engine as the speaker roster so
        // per-speaker attribution survives hydration/reload.
        expect(screen.getByTestId('center-roster')).toHaveTextContent('c1,c2')
    })

    it('renders the immersive CallScreen (not the text engine) when voice mode and the flag are both on', () => {
        activeCharacterChatMode = 'voice'
        setTestFeatureFlags({ calls: true })

        render(<CharacterChat />)

        expect(screen.getByTestId('call-screen')).toBeInTheDocument()
        expect(screen.getByTestId('call-session')).toHaveTextContent('7')
        expect(screen.queryByTestId('center-kind')).not.toBeInTheDocument()
    })

    it('opens a group chat as text even in voice mode (calls are 1:1)', () => {
        activeCharacterChat = {
            ...CHAT,
            id: '12',
            kind: 'character_group',
            character: undefined,
            characters: [
                { id: 'c1', name: 'Lyra', race: 'Elf', role: 'character', stats: {} },
                { id: 'c2', name: 'Dorn', race: 'Dwarf', role: 'character', stats: {} },
            ],
        }
        activeCharacterChatMode = 'voice'
        setTestFeatureFlags({ calls: true })

        render(<CharacterChat />)

        expect(screen.queryByTestId('call-screen')).not.toBeInTheDocument()
        expect(screen.getByTestId('center-kind')).toHaveTextContent('character')
    })

    it('falls back to the text engine when a stale voice launch intent survives with the flag off', () => {
        activeCharacterChatMode = 'voice'
        setTestFeatureFlags({ calls: false })

        render(<CharacterChat />)

        expect(screen.getByTestId('center-kind')).toHaveTextContent('character')
        expect(screen.queryByTestId('call-screen')).not.toBeInTheDocument()
    })

    it('runs the chat in the committed workspace when the server sent no origin', () => {
        render(<CharacterChat />)
        expect(screen.getByTestId('center-workspace')).toHaveTextContent(TEST_WORKSPACE_ID)
    })

    it('runs the chat and its call in the chat workspace (organization.workspace_id)', () => {
        activeCharacterChat = { ...CHAT, organization: { workspace_id: OTHER_WORKSPACE_ID } }
        const view = render(<CharacterChat />)
        expect(screen.getByTestId('center-workspace')).toHaveTextContent(OTHER_WORKSPACE_ID)

        activeCharacterChatMode = 'voice'
        setTestFeatureFlags({ calls: true })
        view.rerender(<CharacterChat />)
        expect(screen.getByTestId('call-workspace')).toHaveTextContent(OTHER_WORKSPACE_ID)
    })
})
