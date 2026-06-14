import type { ReactNode } from 'react'
import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CharacterChatSession } from '@/shared'
import { CharacterChat } from './CharacterChat'

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
    InteractionCenterPanel: ({ config }: { config: { kind: string; showForwardOptions: boolean; showImages: boolean } }) => (
        <div>
            <div data-testid="center-kind">{config.kind}</div>
            <div data-testid="center-forward-options">{String(config.showForwardOptions)}</div>
            <div data-testid="center-images">{String(config.showImages)}</div>
        </div>
    ),
    InteractionTopBar: () => <header data-testid="top-bar" />,
    SidePanelDrawer: ({ children }: { children: ReactNode }) => <div data-testid="side-panel">{children}</div>,
}))

// Voice mode renders the immersive CallScreen (its own surface), not the text engine.
vi.mock('../../call', () => ({
    CallScreen: ({ sessionId, onSwitchToText }: { sessionId: number; onSwitchToText: () => void }) => (
        <div data-testid="call-screen">
            <div data-testid="call-session">{String(sessionId)}</div>
            <button type="button" onClick={onSwitchToText}>Switch to text</button>
        </div>
    ),
}))

vi.mock('./CharacterChatSidebar', () => ({
    CharacterChatSidebar: () => <aside data-testid="chat-sidebar" />,
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
    })

    it('renders the immersive CallScreen (not the text engine) when voice mode and the flag are both on', () => {
        activeCharacterChatMode = 'voice'
        vi.stubEnv('VITE_VOICE_MODE_ENABLED', 'true')

        render(<CharacterChat />)

        expect(screen.getByTestId('call-screen')).toBeInTheDocument()
        expect(screen.getByTestId('call-session')).toHaveTextContent('7')
        expect(screen.queryByTestId('center-kind')).not.toBeInTheDocument()
    })

    it('falls back to the text engine when a stale voice launch intent survives with the flag off', () => {
        activeCharacterChatMode = 'voice'
        vi.stubEnv('VITE_VOICE_MODE_ENABLED', 'false')

        render(<CharacterChat />)

        expect(screen.getByTestId('center-kind')).toHaveTextContent('character')
        expect(screen.queryByTestId('call-screen')).not.toBeInTheDocument()
    })
})
