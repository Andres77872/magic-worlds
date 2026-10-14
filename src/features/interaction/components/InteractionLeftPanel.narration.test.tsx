/**
 * R1-FE-03 / R1-FE-04 in the adventure side panel:
 * - 03 §5.12 / 05 §9.3: a leaving narrator or cast voice reads "Leaving on {date}"
 *   from its catalog `disable_at` (one catalog read, projections only);
 * - AC-C4 / 05 §5.4 (D16): the narrate-thoughts switch carries the
 *   thought-delivery helper after its description, with no capabilities read.
 * Voice reads run for a signed-in caller only; every "reads nothing" check first
 * lets the hooks' deferred reads run, so a stray read would be seen.
 */
import type { ReactNode } from 'react'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { i18n } from '@/app/i18n'
import { AuthContext } from '@/app/providers/AuthProvider'
import { apiService } from '@/infrastructure/api'
import type { Adventure, AdventureSnapshot, Character, VoiceCapabilities } from '@/shared'
import { createWorkspaceTestState, WorkspaceTestProvider } from '@/shared/hooks/testing/workspaceTestUtils'
import { toVoiceCapabilities } from '@/shared/voice/voiceCapabilities'
import { BFF_EL_PLUS_BODY } from '@/shared/voice/voiceCapabilities.fixtures'
import { CATALOG_SELA_LEAVING, V2_VOICE, VOICE_KEY_MAREN, VOICE_KEY_SELA, catalogVoice, effectiveVoice } from '@/features/voices/fixtures'
import { formatBadgeDate } from '@/features/voices/components/VoiceBadges'
import { InteractionLeftPanel } from './InteractionLeftPanel'

const mocks = vi.hoisted(() => ({ library: [] as unknown[] }))

vi.mock('../../../app/hooks', () => ({
    useData: () => ({ characters: mocks.library, worlds: [], refreshAdventureVoices: vi.fn() }),
    useFloatingWindows: () => ({ openWindow: vi.fn(), closeWindow: vi.fn(), closeAll: vi.fn(), focusWindow: vi.fn(), windows: [] }),
}))
vi.mock('../../voices/components/VoicePickerDialog', () => ({ VoicePickerDialog: () => null }))
vi.mock('@/features/lorebook', () => ({ SessionLorebookPanel: () => null }))

const caps = (body: unknown) => toVoiceCapabilities(body) as VoiceCapabilities
const HELP_EN = 'Thoughts use the character’s voice, a little quieter (whispered on Expressive).'
const DESC_EN = 'Voice characters’ visible inner thoughts during narration.'
/** The description, then the helper (05 §5.4 "gains", §9.2 "kept, plus"). */
const BOTH_EN = `${DESC_EN} ${HELP_EN}`
const CATALOG_MAREN_LEAVING = catalogVoice({ voice_key: VOICE_KEY_MAREN, display_name: 'Maren', status: 'deprecating', disable_at: '2027-01-15T00:00:00Z' })

function adventureWith(snapshot: Partial<AdventureSnapshot>, template: Partial<AdventureSnapshot['template']> = {}): Adventure {
    return {
        id: '77',
        scenario: 'Open the gate.',
        characters: [],
        turns: [],
        status: 'in-progress',
        snapshot: {
            schema_version: 2,
            source: 'resolved_library_clone',
            template_card_id: 'tpl-1',
            template: { id: 'tpl-1', description: 'Open the gate.', characters: [], world: [], ...template },
            ...snapshot,
        },
    }
}

function SignedIn({ children }: { children: ReactNode }) {
    return <AuthContext.Provider value={{ isAuthenticated: true } as never}>{children}</AuthContext.Provider>
}

function renderPanel(adventure: Adventure, signedIn = true, { workspace = false }: { workspace?: boolean } = {}) {
    const panel = <InteractionLeftPanel adventure={adventure} onBack={vi.fn()} onSnapshotChange={vi.fn()} />
    const scoped = workspace ? <WorkspaceTestProvider state={createWorkspaceTestState()}>{panel}</WorkspaceTestProvider> : panel
    return render(signedIn ? <SignedIn>{scoped}</SignedIn> : scoped)
}

/** Lets the catalog hooks start their deferred reads (they begin a microtask after the effect). */
async function flushReads() {
    await act(async () => {
        await Promise.resolve()
        await Promise.resolve()
    })
}

const date = (value: string) => formatBadgeDate(value, 'en') as string

let readCapabilities: ReturnType<typeof vi.spyOn>
let readCatalog: ReturnType<typeof vi.spyOn>

beforeEach(async () => {
    mocks.library = []
    vi.stubEnv('VITE_FEATURE_VOICES_ENABLED', 'true')
    await i18n.changeLanguage('en')
    vi.spyOn(apiService, 'peekVoiceCapabilities').mockReturnValue(null)
    readCapabilities = vi.spyOn(apiService, 'getVoiceCapabilities').mockResolvedValue(caps(BFF_EL_PLUS_BODY))
    readCatalog = vi.spyOn(apiService, 'getVoiceCatalogByKeys').mockResolvedValue([CATALOG_SELA_LEAVING, CATALOG_MAREN_LEAVING])
})

afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
})

describe('narrate-thoughts helper (AC-C4, D16)', () => {
    const thoughtsSwitch = () => screen.getByRole('switch', { name: /Narrate inner thoughts/ })

    it('adds the D16 helper after the description, even with no narrator voice set, without reading capabilities', async () => {
        renderPanel(adventureWith({}))
        expect(thoughtsSwitch()).toHaveAccessibleDescription(BOTH_EN)
        await flushReads()
        expect(readCapabilities).not.toHaveBeenCalled()
    })

    it('shows the helper signed out too', async () => {
        renderPanel(adventureWith({ narrator_voice: V2_VOICE, effective_narrator_voice: effectiveVoice() }), false)
        await flushReads()
        expect(thoughtsSwitch()).toHaveAccessibleDescription(BOTH_EN)
        expect(screen.getByText(HELP_EN, { exact: false })).toBeInTheDocument()
    })

    it('ships the helper in en and es', () => {
        expect(i18n.t('interaction.narration.narrateThoughtsHelp', { lng: 'en' })).toBe(HELP_EN)
        expect(i18n.exists('interaction.narration.narrateThoughtsHelp', { lng: 'es' })).toBe(true)
        expect(i18n.t('interaction.narration.narrateThoughtsHelp', { lng: 'es' })).not.toBe(HELP_EN)
    })
})

describe('"Leaving on {date}" in the narrator panel and the cast list (05 §9.3)', () => {
    it('dates a leaving narrator voice from its catalog entry', async () => {
        const narrator = { ...V2_VOICE, voice_key: VOICE_KEY_SELA, voice_name: 'Sela' }
        renderPanel(adventureWith({ narrator_voice: narrator, effective_narrator_voice: effectiveVoice({ voice_key: VOICE_KEY_SELA, display_name: 'Sela', badges: ['leaving'] }) }))
        expect(await screen.findByText(`Leaving on ${date(CATALOG_SELA_LEAVING.disable_at!)}`)).toBeInTheDocument()
        expect(screen.queryByText('Leaving soon')).not.toBeInTheDocument()
        expect(readCatalog).toHaveBeenCalledWith([VOICE_KEY_SELA])
    })

    it('dates every leaving cast member with one catalog read, and never reads without a projection or for the persona', async () => {
        renderPanel(adventureWith({}, {
            persona: { id: 'p1', name: 'Me', voice: V2_VOICE, effective_voice: effectiveVoice({ badges: ['leaving'] }) },
            characters: [
                { id: 'c1', name: 'Dorn', voice: { ...V2_VOICE, voice_key: VOICE_KEY_SELA }, effective_voice: effectiveVoice({ voice_key: VOICE_KEY_SELA, display_name: 'Sela', badges: ['leaving'] }) },
                { id: 'c2', name: 'Mira', voice: { ...V2_VOICE, voice_key: VOICE_KEY_MAREN }, effective_voice: effectiveVoice({ voice_key: VOICE_KEY_MAREN, display_name: 'Maren', badges: ['leaving'] }) },
                { id: 'c3', name: 'Vos', voice: V2_VOICE },
            ],
        }))
        const sela = `Leaving on ${date(CATALOG_SELA_LEAVING.disable_at!)}`
        const maren = `Leaving on ${date(CATALOG_MAREN_LEAVING.disable_at!)}`
        expect(await screen.findByText(sela)).toBeInTheDocument()
        expect(screen.getByText(maren)).toBeInTheDocument()
        expect(screen.getAllByTestId('voice-badges')).toHaveLength(2)
        expect(readCatalog).toHaveBeenCalledTimes(1)
        expect(readCatalog).toHaveBeenCalledWith([VOICE_KEY_SELA, VOICE_KEY_MAREN].sort())
    })

    it('falls back to "Leaving soon" when the catalog has no date or cannot be read', async () => {
        readCatalog.mockRejectedValue(Object.assign(new Error('Not Found'), { status: 404 }))
        renderPanel(adventureWith({}, {
            characters: [{ id: 'c1', name: 'Dorn', voice: V2_VOICE, effective_voice: effectiveVoice({ voice_key: VOICE_KEY_SELA, badges: ['leaving'] }) }],
        }))
        await waitFor(() => expect(readCatalog).toHaveBeenCalledTimes(1))
        const badges = screen.getByTestId('voice-badges')
        expect(within(badges).getByText('Leaving soon')).toBeInTheDocument()
    })

    it('makes no catalog read when nothing is leaving', async () => {
        renderPanel(adventureWith({ narrator_voice: V2_VOICE, effective_narrator_voice: effectiveVoice({ badges: ['replaced'], substitution_reason: 'voice_removed', display_name: 'Maren', voice_key: VOICE_KEY_MAREN }) }, {
            characters: [{ id: 'c1', name: 'Dorn', voice: V2_VOICE, effective_voice: effectiveVoice({ badges: ['review'] }) }],
        }))
        await flushReads()
        expect(readCatalog).not.toHaveBeenCalled()
    })

    it('reads nothing signed out: a leaving narrator and cast member keep "Leaving soon"', async () => {
        const narrator = { ...V2_VOICE, voice_key: VOICE_KEY_SELA, voice_name: 'Sela' }
        renderPanel(adventureWith(
            { narrator_voice: narrator, effective_narrator_voice: effectiveVoice({ voice_key: VOICE_KEY_SELA, display_name: 'Sela', badges: ['leaving'] }) },
            { characters: [{ id: 'c1', name: 'Dorn', voice: { ...V2_VOICE, voice_key: VOICE_KEY_MAREN }, effective_voice: effectiveVoice({ voice_key: VOICE_KEY_MAREN, display_name: 'Maren', badges: ['leaving'] }) }] },
        ), false)
        await flushReads()
        expect(screen.getAllByText('Leaving soon')).toHaveLength(2)
        expect(readCatalog).not.toHaveBeenCalled()
        expect(readCapabilities).not.toHaveBeenCalled()
    })

    it('dates a leaving cast member whose voice drifted from its card, next to its cast menu (D36)', async () => {
        const card: Character = { id: 'c1', name: 'Dorn', race: '', stats: {}, role: 'character', voice: V2_VOICE, effective_voice: effectiveVoice({ voice_key: VOICE_KEY_MAREN, display_name: 'Maren' }) }
        mocks.library = [card]
        renderPanel(adventureWith({}, {
            characters: [{ id: 'c1', name: 'Dorn', voice: { ...V2_VOICE, voice_key: VOICE_KEY_SELA }, effective_voice: effectiveVoice({ voice_key: VOICE_KEY_SELA, display_name: 'Sela', badges: ['leaving'] }) }],
        }), true, { workspace: true })
        const menu = screen.getByRole('button', { name: 'Voice options for Dorn' })
        const row = menu.parentElement as HTMLElement
        expect(await within(row).findByText(`Leaving on ${date(CATALOG_SELA_LEAVING.disable_at!)}`)).toBeInTheDocument()
        expect(within(row).queryByText('Leaving soon')).not.toBeInTheDocument()
        expect(readCatalog).toHaveBeenCalledWith([VOICE_KEY_SELA])
    })
})
