import { act, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Adventure, AdventureSnapshot, EffectiveVoice } from '@/shared'
import { InteractionLeftPanel } from './InteractionLeftPanel'
import sidebarStory from './InteractionLeftPanel.stories'

vi.mock('../../../app/hooks', () => ({
    useData: () => ({ characters: [], worlds: [] }),
    useFloatingWindows: () => ({ openWindow: vi.fn(), closeWindow: vi.fn(), closeAll: vi.fn(), focusWindow: vi.fn(), windows: [] }),
}))

const picker = vi.hoisted(() => ({ props: null as Record<string, unknown> | null }))

// The narrator picker is a stub here: its own tests cover it; these check what the panel passes and receives.
vi.mock('../../voices/components/VoicePickerDialog', () => ({
    VoicePickerDialog: (props: Record<string, unknown>) => {
        picker.props = props
        return null
    },
}))

vi.mock('@/features/lorebook', () => ({
    SessionLorebookPanel: ({ targetKind, targetId }: { targetKind: string; targetId: string }) => (
        <div data-testid="session-lorebook-panel" data-target-kind={targetKind} data-target-id={targetId} />
    ),
}))

const ADVENTURE: Adventure = {
    id: '77',
    scenario: 'Open the gate.',
    characters: [],
    turns: [],
    status: 'in-progress',
    snapshot: {
        schema_version: 2,
        source: 'resolved_library_clone',
        template_card_id: 'tpl-1',
        template: {
            id: 'tpl-1',
            description: 'Open the gate.',
            characters: [],
            world: [],
        },
    },
}

describe('InteractionLeftPanel lorebooks', () => {
    beforeEach(() => {
        vi.stubEnv('VITE_FEATURE_LOREBOOKS_ENABLED', 'true')
    })

    afterEach(() => {
        vi.unstubAllEnvs()
    })

    it('wires the session lorebook panel to the active adventure session id', () => {
        render(<InteractionLeftPanel adventure={ADVENTURE} onBack={vi.fn()} onSnapshotChange={vi.fn()} />)

        const panel = screen.getByTestId('session-lorebook-panel')
        expect(panel).toHaveAttribute('data-target-kind', 'adventure_session')
        expect(panel).toHaveAttribute('data-target-id', '77')
    })

    it('renders the sidebar story fixture with a serialized stored snapshot', () => {
        const adventure = JSON.parse(JSON.stringify(sidebarStory.args.adventure)) as Adventure
        render(<InteractionLeftPanel adventure={adventure} onBack={vi.fn()} />)

        expect(screen.getByText('Rain taps the leaded glass as a hooded figure slides a damp envelope across your table.')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /Mirren Vale/ })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /Lyra Dawnwhisper/ })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /The Sunken Library/ })).toBeInTheDocument()
    })
})

describe('InteractionLeftPanel narration (Workspace R1)', () => {
    beforeEach(() => {
        vi.stubEnv('VITE_FEATURE_VOICES_ENABLED', 'true')
    })

    afterEach(() => {
        vi.unstubAllEnvs()
    })

    it('keeps the narrator voice and thoughts toggle editable in an active workspace', () => {
        render(<InteractionLeftPanel adventure={ADVENTURE} onBack={vi.fn()} onSnapshotChange={vi.fn()} />)

        expect(screen.getByRole('button', { name: 'Choose voice' })).toBeEnabled()
        expect(screen.getByRole('switch', { name: /Narrate inner thoughts/ })).toBeEnabled()
    })

    it('disables the narrator voice and thoughts toggle when the session workspace is read-only', () => {
        render(<InteractionLeftPanel adventure={ADVENTURE} onBack={vi.fn()} onSnapshotChange={vi.fn()} readOnly />)

        expect(screen.getByRole('button', { name: 'Choose voice' })).toBeDisabled()
        expect(screen.getByRole('switch', { name: /Narrate inner thoughts/ })).toBeDisabled()
    })
})

describe('InteractionLeftPanel effective voices (R1-FE-03)', () => {
    const V2 = {
        schema_version: 2 as const,
        provider: 'elevenlabs' as const,
        voice_key: 'vk_3f0c2a9e5b7d4c1a8e6f0b2d4a6c8e1f',
        voice_name: 'Eldrin',
        settings: null,
        emotion: null,
        language_code: null,
    }
    const EFFECTIVE: EffectiveVoice = {
        voice_key: 'vk_0a1b2c3d4e5f60718293a4b5c6d7e8f9',
        display_name: 'Maren',
        provider_route: 'elevenlabs',
        substitution_reason: 'voice_removed',
        badges: ['replaced'],
    }

    function adventureWith(snapshot: Partial<AdventureSnapshot>, template: Partial<AdventureSnapshot['template']> = {}): Adventure {
        return {
            ...ADVENTURE,
            snapshot: { ...ADVENTURE.snapshot!, ...snapshot, template: { ...ADVENTURE.snapshot!.template, ...template } },
        }
    }

    beforeEach(() => {
        vi.stubEnv('VITE_FEATURE_VOICES_ENABLED', 'true')
        picker.props = null
    })

    afterEach(() => {
        vi.unstubAllEnvs()
    })

    it('labels the narrator with what it plays as', () => {
        render(<InteractionLeftPanel adventure={adventureWith({ narrator_voice: V2, effective_narrator_voice: EFFECTIVE })} onBack={vi.fn()} onSnapshotChange={vi.fn()} language="es" />)
        expect(screen.getByText('Eldrin')).toBeInTheDocument()
        expect(screen.getByText('Plays as Maren')).toBeInTheDocument()
        expect(screen.getByText('Voice replaced')).toBeInTheDocument()
        expect(picker.props).toMatchObject({ currentEffectiveVoice: EFFECTIVE, language: 'es' })
    })

    it('keeps the plain narrator line without a projection', () => {
        render(
            <InteractionLeftPanel
                adventure={adventureWith({ narrator_voice: V2 })}
                onBack={vi.fn()}
                onSnapshotChange={vi.fn()}
            />,
        )
        expect(screen.getByText('Eldrin')).toBeInTheDocument()
        expect(screen.queryByText(/Plays as/)).not.toBeInTheDocument()
        expect(screen.queryByTestId('voice-badges')).not.toBeInTheDocument()
    })

    it('a narrator re-pick saves the new voice without the old projection', async () => {
        const onSnapshotChange = vi.fn().mockResolvedValue(undefined)
        render(<InteractionLeftPanel adventure={adventureWith({ narrator_voice: V2, effective_narrator_voice: EFFECTIVE })} onBack={vi.fn()} onSnapshotChange={onSnapshotChange} />)
        const next = { ...V2, voice_key: 'vk_9f8e7d6c5b4a39281706f5e4d3c2b1a0', voice_name: 'Sela' }
        await act(async () => (picker.props?.onSelect as (voice: unknown) => void)(next))
        const saved = onSnapshotChange.mock.calls[0][0] as AdventureSnapshot
        expect(saved.narrator_voice).toEqual(next)
        expect(saved).not.toHaveProperty('effective_narrator_voice')
    })

    it('badges cast voices only when they carry a projection, never the persona', () => {
        render(
            <InteractionLeftPanel
                adventure={adventureWith({}, {
                    persona: { id: 'p1', name: 'Me', voice: V2, effective_voice: { ...EFFECTIVE, badges: ['retired'] } },
                    characters: [
                        { id: 'c1', name: 'Dorn', voice: V2, effective_voice: { ...EFFECTIVE, badges: ['leaving'] } },
                        { id: 'c2', name: 'Mira', voice: V2 },
                    ],
                })}
                onBack={vi.fn()}
            />,
        )
        const badges = screen.getAllByTestId('voice-badges')
        expect(badges).toHaveLength(1)
        expect(within(badges[0]).getByText('Leaving soon')).toBeInTheDocument()
        expect(screen.queryByText('Retired: pick another anytime')).not.toBeInTheDocument()
    })
})
