import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Adventure, CharacterChatSession, EffectiveVoice } from '@/shared'
import { firstExposureKey } from '@/features/voices/hooks/useFirstExposure'
import { ChatFirstExposureBanner } from './ChatFirstExposureBanner'

const mocks = vi.hoisted(() => ({
    userHash: 'user-hash-1' as string | null,
    activeCharacterChat: null as unknown,
    editingInProgress: null as unknown,
}))

vi.mock('@/app/hooks', () => ({
    useAuth: () => ({ userHash: mocks.userHash }),
    useData: () => ({ activeCharacterChat: mocks.activeCharacterChat, editingInProgress: mocks.editingInProgress }),
}))

const KEY = `vk_${'a'.repeat(32)}`
const EL: EffectiveVoice = { voice_key: KEY, display_name: 'Aria', provider_route: 'elevenlabs', substitution_reason: 'unmapped_legacy', flags: [], badges: [] }
const V1 = { voice_id: 'male-qn-qingse', preset_name: 'Calm' }
const V2 = { schema_version: 2 as const, provider: 'elevenlabs' as const, voice_key: KEY, voice_name: 'Aria' }
const COPY = 'Voices have a new engine. We picked the closest match for your existing voices; you can change them anytime.'

function chatWith(voice: unknown, effective: EffectiveVoice | null): CharacterChatSession {
    return {
        id: '9',
        kind: 'character',
        character_id: 'c1',
        characters: [{ id: 'c1', name: 'Lyra', race: '', stats: {}, voice: voice as never, ...(effective ? { effective_voice: effective } : {}) }],
    }
}

function adventureWith(narratorVoice: unknown, narratorEffective: EffectiveVoice | null): Adventure {
    return {
        id: '77',
        scenario: '',
        characters: [],
        snapshot: {
            template: { characters: [{ id: 'c1', name: 'Mirren', voice: V2, effective_voice: EL }] },
            narrator_voice: narratorVoice as never,
            effective_narrator_voice: narratorEffective,
        },
    }
}

beforeEach(() => {
    mocks.userHash = 'user-hash-1'
    mocks.activeCharacterChat = chatWith(V1, EL)
    mocks.editingInProgress = null
    window.localStorage.clear()
})

afterEach(() => {
    window.localStorage.clear()
})

describe('ChatFirstExposureBanner (03 §5.12, 05 §7.6)', () => {
    it('shows once in a chat whose V1 voice now plays through ElevenLabs, sharing the Studio dismissal', () => {
        const { unmount } = render(<ChatFirstExposureBanner kind="character" sessionId={9} />)
        expect(screen.getByTestId('voice-first-exposure')).toHaveTextContent(COPY)

        // 05 §10: a region with a heading; the dismiss button names the notice it dismisses.
        expect(screen.getByRole('region', { name: 'New voice engine' })).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Got it, dismiss the new voice engine notice' }))

        expect(screen.queryByTestId('voice-first-exposure')).toBeNull()
        expect(window.localStorage.getItem(firstExposureKey('user-hash-1'))).toBe('1')
        unmount()
        // Another session (fresh mount) reads the same dismissal.
        mocks.editingInProgress = adventureWith(V1, EL)
        const { container } = render(<ChatFirstExposureBanner kind="adventure" sessionId={77} />)
        expect(container).toBeEmptyDOMElement()
    })

    it('stays hidden when the Studio already dismissed it', () => {
        window.localStorage.setItem(firstExposureKey('user-hash-1'), '1')
        const { container } = render(<ChatFirstExposureBanner kind="character" sessionId={9} />)
        expect(container).toBeEmptyDOMElement()
    })

    it('renders nothing without a user, or for another session', () => {
        const other = render(<ChatFirstExposureBanner kind="character" sessionId={10} />)
        expect(other.container).toBeEmptyDOMElement()
        other.unmount()
        mocks.userHash = null
        const signedOut = render(<ChatFirstExposureBanner kind="character" sessionId={9} />)
        expect(signedOut.container).toBeEmptyDOMElement()
    })

    it('renders nothing for V2 voices or a V1 voice without a projection', () => {
        mocks.activeCharacterChat = chatWith(V2, EL)
        const v2 = render(<ChatFirstExposureBanner kind="character" sessionId={9} />)
        expect(v2.container).toBeEmptyDOMElement()
        v2.unmount()
        mocks.activeCharacterChat = chatWith(V1, null)
        const bare = render(<ChatFirstExposureBanner kind="character" sessionId={9} />)
        expect(bare.container).toBeEmptyDOMElement()
    })

    it('counts an adventure narrator voice converted from V1', () => {
        mocks.editingInProgress = adventureWith(V1, EL)
        render(<ChatFirstExposureBanner kind="adventure" sessionId={77} />)
        expect(screen.getByTestId('voice-first-exposure')).toBeInTheDocument()
    })

    it('does not count an adventure whose voices are all V2', () => {
        mocks.editingInProgress = adventureWith(V2, EL)
        const { container } = render(<ChatFirstExposureBanner kind="adventure" sessionId={77} />)
        expect(container).toBeEmptyDOMElement()
    })
})
