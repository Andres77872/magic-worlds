import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { useState, type ContextType } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { i18n } from '@/app/i18n'
import { DataContext } from '@/app/providers/DataProvider'
import type { VoiceReviewFlag } from '@/shared'
import { OTHER_WORKSPACE_ID, TEST_WORKSPACE_ID, WorkspaceTestProvider, createWorkspaceTestState, testWorkspace } from '@/shared/hooks/testing/workspaceTestUtils'
import { CATALOG_ELDRIN, CATALOG_MAREN_HOUSE, REVIEW_FLAG_CARD, REVIEW_FLAG_PRESET, VOICE_KEY_ELDRIN, VOICE_KEY_MAREN, effectiveVoice } from '../fixtures'
import { ReviewFlagList } from './ReviewFlagList'
import { ReviewNotice, reviewFlagTarget } from './ReviewNotice'

const navigateToOrigin = vi.fn()
const api = {
    getEffectiveVoice: vi.fn(),
    getVoiceCatalogByKeys: vi.fn(),
    fetchProtectedMediaBlob: vi.fn(),
    withWorkspace: vi.fn(),
}

vi.mock('@/features/workspaces/originNavigation', () => ({
    useOriginNavigation: () => ({ navigateToOrigin, registerOriginNavigator: () => () => undefined }),
}))
vi.mock('@/app/hooks/usePlaylist', () => ({ usePlaylist: () => ({}) }))
vi.mock('@/infrastructure/api', () => ({
    apiService: {
        getEffectiveVoice: (...args: unknown[]) => api.getEffectiveVoice(...args),
        getVoiceCatalogByKeys: (...args: unknown[]) => api.getVoiceCatalogByKeys(...args),
        fetchProtectedMediaBlob: (...args: unknown[]) => api.fetchProtectedMediaBlob(...args),
        withWorkspace: (...args: unknown[]) => api.withWorkspace(...args),
    },
    isProtectedMediaUrl: () => false,
}))

const CAST_FLAG: VoiceReviewFlag = { ...REVIEW_FLAG_CARD, flag_id: 13, ref_type: 'template_cast', ref_id: 'tpl-1', json_path: 'characters[card-9].voice', flags: ['needs_review'] }
const DRAFT_FLAG: VoiceReviewFlag = { ...REVIEW_FLAG_CARD, flag_id: 14, ref_type: 'card_draft', created_at: '2026-10-02T10:00:00Z' }

describe('ReviewNotice (R1-FE-03, D15)', () => {
    beforeEach(() => {
        navigateToOrigin.mockReset().mockResolvedValue('navigated')
        vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn(() => 'blob:listen'), revokeObjectURL: vi.fn() })
        api.getEffectiveVoice.mockReset().mockResolvedValue({
            ref_type: 'card',
            ref_id: 'card-1',
            voices: [{ json_path: 'voice', effective_voice: effectiveVoice({ voice_key: VOICE_KEY_MAREN, display_name: 'Maren' }) }],
        })
        api.getVoiceCatalogByKeys.mockReset().mockImplementation(async (keys: string[]) => [CATALOG_ELDRIN, CATALOG_MAREN_HOUSE].filter((item) => keys.includes(item.voice_key)))
        api.fetchProtectedMediaBlob.mockReset().mockResolvedValue(new Blob(['mp3'], { type: 'audio/mpeg' }))
        api.withWorkspace.mockReset().mockImplementation(() => ({ getEffectiveVoice: (...args: unknown[]) => api.getEffectiveVoice(...args) }))
    })

    it('listens to the record’s effective voice through its workspace, as a free catalog sample (05 §7.8)', async () => {
        render(<ReviewNotice flag={REVIEW_FLAG_CARD} onDismiss={vi.fn()} />)
        const listen = screen.getByRole('button', { name: 'Listen' })
        expect(listen).toHaveAttribute('aria-pressed', 'false')
        fireEvent.click(listen)
        await waitFor(() => expect(api.fetchProtectedMediaBlob).toHaveBeenCalledWith(CATALOG_MAREN_HOUSE.languages[0].sample_url, 'audio/mpeg'))
        expect(api.withWorkspace).toHaveBeenCalledWith(REVIEW_FLAG_CARD.organization?.workspace_id)
        expect(api.getEffectiveVoice).toHaveBeenCalledWith('card', 'card-1')
        expect(api.getVoiceCatalogByKeys).toHaveBeenCalledWith([VOICE_KEY_MAREN])
        // 05 §10 Audio controls: once resolved, Listen names the voice and the sample's language (keeping "Listen").
        await waitFor(() => expect(screen.getByRole('button', { name: 'Listen: Maren, English' })).toHaveAttribute('aria-pressed', 'true'))
        expect(screen.getByRole('button', { name: 'Listen: Maren, English' })).toHaveTextContent('Listen')
        // Pressing again stops it.
        fireEvent.click(screen.getByRole('button', { name: 'Listen: Maren, English' }))
        expect(screen.getByRole('button', { name: 'Listen: Maren, English' })).toHaveAttribute('aria-pressed', 'false')
    })

    it('names the record, the voice and the language once Listen resolves them, in en and es (05 §10)', async () => {
        render(<ReviewNotice flag={REVIEW_FLAG_PRESET} title="Gruff mentor" voiceKey={VOICE_KEY_ELDRIN} language="es" onDismiss={vi.fn()} />)
        fireEvent.click(screen.getByRole('button', { name: 'Listen to Gruff mentor' }))
        await waitFor(() => expect(screen.getByRole('button', { name: 'Listen to Gruff mentor: Eldrin, Spanish' })).toHaveAttribute('aria-pressed', 'true'))
        const es = i18n.getFixedT('es')
        expect(es('voices.notice.reviewFlagListenVoiceFor', { name: 'Mentor', voice: es('voices.notice.reviewFlagVoiceIn', { voice: 'Eldrin', language: 'español' }) }))
            .toBe('Escuchar Mentor: Eldrin, español')
        expect(es('voices.notice.reviewFlagListenVoice', { voice: 'Eldrin' })).toBe('Escuchar: Eldrin')
    })

    it('uses the host’s voice when it knows it, in the asked language', async () => {
        render(<ReviewNotice flag={REVIEW_FLAG_PRESET} voiceKey={VOICE_KEY_ELDRIN} language="es" onDismiss={vi.fn()} />)
        fireEvent.click(screen.getByRole('button', { name: 'Listen' }))
        await waitFor(() => expect(api.fetchProtectedMediaBlob).toHaveBeenCalledWith(CATALOG_ELDRIN.languages[1].sample_url, 'audio/mpeg'))
        expect(api.getEffectiveVoice).not.toHaveBeenCalled()
    })

    it('says so when the voice cannot be heard, and offers no Listen for a cast flag without a hint', async () => {
        api.getEffectiveVoice.mockResolvedValue({ ref_type: 'card', ref_id: 'card-1', voices: [{ json_path: 'voice', effective_voice: { ...effectiveVoice(), voice_key: null } }] })
        const { unmount } = render(<ReviewNotice flag={REVIEW_FLAG_CARD} onDismiss={vi.fn()} />)
        fireEvent.click(screen.getByRole('button', { name: 'Listen' }))
        expect(await screen.findByRole('alert')).toHaveTextContent('Preview is temporarily unavailable.')
        expect(api.fetchProtectedMediaBlob).not.toHaveBeenCalled()
        unmount()

        render(<ReviewNotice flag={CAST_FLAG} onDismiss={vi.fn()} />)
        expect(screen.queryByRole('button', { name: 'Listen' })).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Adjust' })).toBeInTheDocument()
    })

    it('keeps only Listen and Dismiss for a record of an archived workspace (05 §7.9)', async () => {
        // The flag's record lives in TEST_WORKSPACE_ID, archived; the reader works in another one.
        expect(REVIEW_FLAG_CARD.organization?.workspace_id).toBe(TEST_WORKSPACE_ID)
        const state = createWorkspaceTestState({
            selectedWorkspaceId: OTHER_WORKSPACE_ID,
            workspaces: [
                testWorkspace(TEST_WORKSPACE_ID, 'Old campaign', { archived_at: '2026-10-05T00:00:00Z' }),
                testWorkspace(OTHER_WORKSPACE_ID, 'Novel A'),
            ],
        })
        const onDismiss = vi.fn()
        render(
            <WorkspaceTestProvider state={state}>
                <ReviewNotice flag={REVIEW_FLAG_CARD} onDismiss={onDismiss} />
            </WorkspaceTestProvider>,
        )
        expect(screen.queryByRole('button', { name: 'Adjust' })).not.toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Listen' }))
        await waitFor(() => expect(api.fetchProtectedMediaBlob).toHaveBeenCalled())
        fireEvent.click(screen.getByRole('button', { name: 'Dismiss review notice' }))
        expect(onDismiss).toHaveBeenCalledWith(REVIEW_FLAG_CARD.flag_id)
    })

    it('a host showing the record read-only keeps Listen and Dismiss, without Adjust (05 §7.8-§7.9, AC-C7)', async () => {
        const onDismiss = vi.fn()
        render(<ReviewNotice flag={REVIEW_FLAG_CARD} readOnly name="Lyra" onDismiss={onDismiss} onAdjust={vi.fn()} />)
        expect(screen.queryByRole('button', { name: 'Adjust' })).not.toBeInTheDocument()
        const listen = screen.getByRole('button', { name: 'Listen to Lyra' })
        expect(listen).toBeEnabled()
        fireEvent.click(listen)
        await waitFor(() => expect(api.fetchProtectedMediaBlob).toHaveBeenCalled())
        fireEvent.click(screen.getByRole('button', { name: 'Dismiss review notice for Lyra' }))
        expect(onDismiss).toHaveBeenCalledWith(REVIEW_FLAG_CARD.flag_id)
    })

    it('is a region named by its heading, and Dismiss names what it dismisses (05 §10 Notices)', () => {
        const { unmount } = render(<ReviewNotice flag={REVIEW_FLAG_CARD} onDismiss={vi.fn()} />)
        const region = screen.getByRole('region', { name: 'Review this voice' })
        expect(within(region).getByRole('heading', { level: 3, name: 'Review this voice' })).toBeInTheDocument()
        expect(within(region).getByRole('button', { name: 'Dismiss review notice' })).toHaveTextContent('Dismiss')
        unmount()

        render(<ReviewNotice flag={REVIEW_FLAG_PRESET} title="Gruff mentor" headingLevel={2} onDismiss={vi.fn()} />)
        const named = screen.getByRole('region', { name: 'Review this voice: Gruff mentor' })
        expect(within(named).getByRole('heading', { level: 2 })).toHaveTextContent('Review this voice: Gruff mentor')
        expect(within(named).getByRole('button', { name: 'Dismiss review notice for Gruff mentor' })).toBeInTheDocument()
        const es = i18n.getFixedT('es')
        expect(es('voices.notice.reviewFlagDismissFor', { name: 'Mentor' })).toBe('Descartar el aviso de revisión de Mentor')
        expect(es('voices.notice.reviewFlagHeading')).toBe('Revisa esta voz')
    })

    it('moves the focus to the host’s target after a dismissal, else to the heading of its section (05 §10)', async () => {
        function Host({ withTarget }: { withTarget: boolean }) {
            const [shown, setShown] = useState(true)
            return (
                <section aria-labelledby="portrayal-heading">
                    <h2 id="portrayal-heading">Portrayal</h2>
                    <button type="button">Change voice</button>
                    {shown && (
                        <ReviewNotice
                            flag={REVIEW_FLAG_CARD}
                            onDismiss={() => setShown(false)}
                            dismissFocusTarget={withTarget ? () => screen.getByRole('button', { name: 'Change voice' }) : undefined}
                        />
                    )}
                </section>
            )
        }
        const { unmount } = render(<Host withTarget />)
        const dismiss = screen.getByRole('button', { name: 'Dismiss review notice' })
        dismiss.focus()
        fireEvent.click(dismiss)
        await waitFor(() => expect(screen.getByRole('button', { name: 'Change voice' })).toHaveFocus())
        unmount()

        render(<Host withTarget={false} />)
        screen.getByRole('button', { name: 'Dismiss review notice' }).focus()
        fireEvent.click(screen.getByRole('button', { name: 'Dismiss review notice' }))
        await waitFor(() => expect(screen.getByRole('heading', { name: 'Portrayal' })).toHaveFocus())
    })

    it('states the review and one line per known flag', () => {
        render(<ReviewNotice flag={{ ...REVIEW_FLAG_CARD, flags: ['pitch_dropped', 'vol_dropped', 'mystery', 'pitch_dropped'] }} onDismiss={vi.fn()} />)
        const notice = screen.getByTestId('voice-review-notice')
        expect(notice).toHaveAttribute('role', 'note')
        expect(within(notice).getByText(/settings the new voice engine doesn’t support/)).toBeInTheDocument()
        expect(within(notice).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
            'Pitch is no longer applied.',
            'Volume is no longer applied.',
        ])
    })

    it('adjusts through guarded origin navigation, in the record’s workspace', () => {
        render(<ReviewNotice flag={REVIEW_FLAG_CARD} onDismiss={vi.fn()} />)
        fireEvent.click(screen.getByRole('button', { name: 'Adjust' }))
        expect(navigateToOrigin).toHaveBeenCalledWith({
            workspaceId: REVIEW_FLAG_CARD.organization?.workspace_id,
            page: 'character',
            hash: expect.stringContaining('card=card-1'),
        })
    })

    it('lets a host that already shows the record adjust in place, and dismisses by id', () => {
        const onAdjust = vi.fn()
        const onDismiss = vi.fn()
        render(<ReviewNotice flag={REVIEW_FLAG_PRESET} onDismiss={onDismiss} onAdjust={onAdjust} />)
        fireEvent.click(screen.getByRole('button', { name: 'Adjust' }))
        fireEvent.click(screen.getByRole('button', { name: 'Dismiss review notice' }))
        expect(onAdjust).toHaveBeenCalledTimes(1)
        expect(navigateToOrigin).not.toHaveBeenCalled()
        expect(onDismiss).toHaveBeenCalledWith(REVIEW_FLAG_PRESET.flag_id)
    })

    it('targets the editor of each record kind', () => {
        expect(reviewFlagTarget(REVIEW_FLAG_PRESET)).toEqual({ page: 'voice-studio', hash: '#/voices?preset=user-1' })
        expect(reviewFlagTarget(CAST_FLAG).page).toBe('adventure')
        expect(reviewFlagTarget(CAST_FLAG).hash).toContain('tpl-1')
        expect(reviewFlagTarget(DRAFT_FLAG)).toMatchObject({ page: 'character', hash: expect.stringContaining('version=draft') })
    })
})

describe('ReviewFlagList', () => {
    it('groups flags by kind, newest first; without a known name, a kind title numbered when it repeats', () => {
        render(<ReviewFlagList flags={[CAST_FLAG, REVIEW_FLAG_CARD, REVIEW_FLAG_PRESET, DRAFT_FLAG]} onDismiss={vi.fn()} />)
        const notices = screen.getAllByTestId('voice-review-notice')
        expect(notices).toHaveLength(4)
        // Under the page heading: each notice is a level-2 region named by its record.
        expect(screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)).toEqual([
            'Review this voice: Voice preset',
            'Review this voice: Character (1)',
            'Review this voice: Character (2)',
            'Review this voice: Adventure',
        ])
        expect(screen.getAllByRole('region')).toHaveLength(4)
        expect(i18n.getFixedT('es')('voices.notice.reviewFlagNumbered', { name: 'Personaje', n: 2 })).toBe('Personaje (2)')
    })

    it('names each notice after its record: the host’s name, else the library card’s, so regions and buttons are distinct (05 §10)', () => {
        const presetB: VoiceReviewFlag = { ...REVIEW_FLAG_PRESET, flag_id: 21, ref_id: 'user-2' }
        const cardB: VoiceReviewFlag = { ...REVIEW_FLAG_CARD, flag_id: 22, ref_id: 'card-2' }
        const presetNames: Record<string, string> = { 'user-1': 'Gruff mentor', 'user-2': 'Harbour master' }
        const data = { characters: [{ id: 'card-1', name: 'Lyra' }, { id: 'card-2', name: 'Orrin' }] } as unknown as ContextType<typeof DataContext>
        render(
            <DataContext.Provider value={data}>
                <ReviewFlagList
                    flags={[REVIEW_FLAG_PRESET, presetB, REVIEW_FLAG_CARD, cardB]}
                    onDismiss={vi.fn()}
                    voiceKeyFor={() => VOICE_KEY_ELDRIN}
                    nameFor={(flag) => (flag.ref_type === 'preset' ? presetNames[flag.ref_id] ?? null : null)}
                />
            </DataContext.Provider>,
        )
        for (const name of ['Gruff mentor', 'Harbour master', 'Lyra', 'Orrin']) {
            const region = screen.getByRole('region', { name: `Review this voice: ${name}` })
            expect(within(region).getByRole('button', { name: `Dismiss review notice for ${name}` })).toBeInTheDocument()
            expect(within(region).getByRole('button', { name: `Listen to ${name}` })).toBeInTheDocument()
        }
    })

    it('numbers two unnamed presets, so their Dismiss names differ', () => {
        const presetB: VoiceReviewFlag = { ...REVIEW_FLAG_PRESET, flag_id: 21, ref_id: 'user-2' }
        render(<ReviewFlagList flags={[REVIEW_FLAG_PRESET, presetB]} onDismiss={vi.fn()} nameFor={() => null} />)
        expect(screen.getAllByRole('button', { name: /^Dismiss review notice for/ }).map((button) => button.getAttribute('aria-label'))).toEqual([
            'Dismiss review notice for Voice preset (1)',
            'Dismiss review notice for Voice preset (2)',
        ])
    })

    it('a dismissal moves the focus to the next notice, and after the last one to the page heading (05 §10)', async () => {
        function Studio() {
            const [flags, setFlags] = useState([REVIEW_FLAG_PRESET, REVIEW_FLAG_CARD])
            return (
                <main>
                    <h1>Voice studio</h1>
                    <ReviewFlagList flags={flags} onDismiss={(id) => setFlags((current) => current.filter((flag) => flag.flag_id !== id))} />
                </main>
            )
        }
        render(<Studio />)
        const first = screen.getByRole('button', { name: 'Dismiss review notice for Voice preset' })
        first.focus()
        fireEvent.click(first)
        await waitFor(() => expect(screen.getByRole('region', { name: 'Review this voice: Character' })).toHaveFocus())

        const last = screen.getByRole('button', { name: 'Dismiss review notice for Character' })
        last.focus()
        fireEvent.click(last)
        await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: 'Voice studio' })).toHaveFocus())
        expect(screen.queryByRole('region')).not.toBeInTheDocument()
    })

    it('opens a preset in place when the host can', () => {
        const onAdjustPreset = vi.fn()
        render(<ReviewFlagList flags={[REVIEW_FLAG_PRESET]} onDismiss={vi.fn()} onAdjustPreset={onAdjustPreset} />)
        fireEvent.click(screen.getByRole('button', { name: 'Adjust' }))
        expect(onAdjustPreset).toHaveBeenCalledWith('user-1')
    })

    it('passes the host’s voice of each flag to Listen', async () => {
        vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn(() => 'blob:listen'), revokeObjectURL: vi.fn() })
        api.getVoiceCatalogByKeys.mockReset().mockResolvedValue([CATALOG_ELDRIN])
        api.fetchProtectedMediaBlob.mockReset().mockResolvedValue(new Blob(['mp3'], { type: 'audio/mpeg' }))
        api.getEffectiveVoice.mockReset()
        render(<ReviewFlagList flags={[REVIEW_FLAG_PRESET]} onDismiss={vi.fn()} voiceKeyFor={() => VOICE_KEY_ELDRIN} />)
        // 05 §10: in a list, each Listen names its record.
        fireEvent.click(screen.getByRole('button', { name: 'Listen to Voice preset' }))
        await waitFor(() => expect(api.getVoiceCatalogByKeys).toHaveBeenCalledWith([VOICE_KEY_ELDRIN]))
        expect(api.getEffectiveVoice).not.toHaveBeenCalled()
    })

    it('names each Listen by its record, in en and es (05 §10)', async () => {
        render(<ReviewFlagList flags={[REVIEW_FLAG_PRESET, REVIEW_FLAG_CARD]} onDismiss={vi.fn()} voiceKeyFor={() => VOICE_KEY_ELDRIN} />)
        expect(screen.getByRole('button', { name: 'Listen to Voice preset' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Listen to Character' })).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Listen' })).not.toBeInTheDocument()
        const es = i18n.getFixedT('es')
        expect(es('voices.notice.reviewFlagListenFor', { name: 'Personaje' })).toBe('Escuchar Personaje')
    })

    it('renders nothing without flags', () => {
        const { container } = render(<ReviewFlagList flags={[]} onDismiss={vi.fn()} />)
        expect(container).toBeEmptyDOMElement()
    })
})
