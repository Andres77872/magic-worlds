import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { i18n } from '@/app/i18n'
import { REVIEW_FLAG_CARD, REVIEW_FLAG_PRESET } from '../fixtures'
import { FirstExposureNotice } from './FirstExposureNotice'
import { MAX_VISIBLE_VOICE_NOTICES, VoiceNoticeStack } from './VoiceNoticeStack'

vi.mock('@/features/workspaces/originNavigation', () => ({
    useOriginNavigation: () => ({ navigateToOrigin: vi.fn(), registerOriginNavigator: () => () => undefined }),
}))

describe('FirstExposureNotice (R1-FE-03)', () => {
    afterEach(() => localStorage.clear())

    it('shows once for a converted voice, then stays dismissed', () => {
        const { unmount } = render(<FirstExposureNotice userHash="user-a" hasConvertedVoice />)
        expect(screen.getByTestId('voice-first-exposure')).toHaveTextContent('Voices have a new engine.')
        fireEvent.click(screen.getByRole('button', { name: 'Got it, dismiss the new voice engine notice' }))
        expect(screen.queryByTestId('voice-first-exposure')).not.toBeInTheDocument()
        unmount()
        render(<FirstExposureNotice userHash="user-a" hasConvertedVoice />)
        expect(screen.queryByTestId('voice-first-exposure')).not.toBeInTheDocument()
    })

    it('is a region named by its heading; “Got it” names what it dismisses (05 §10 Notices)', async () => {
        render(
            <main>
                <h1>Voice studio</h1>
                <FirstExposureNotice userHash="user-e" hasConvertedVoice />
            </main>,
        )
        const region = screen.getByRole('region', { name: 'New voice engine' })
        expect(within(region).getByRole('heading', { level: 2, name: 'New voice engine' })).toBeInTheDocument()
        const dismiss = within(region).getByRole('button', { name: 'Got it, dismiss the new voice engine notice' })
        expect(dismiss).toHaveTextContent('Got it')
        // No other notice follows: the focus goes to the page heading, not to the page body.
        dismiss.focus()
        fireEvent.click(dismiss)
        await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: 'Voice studio' })).toHaveFocus())
        const es = i18n.getFixedT('es')
        expect(es('voices.notice.first_exposure_title')).toBe('Nuevo motor de voz')
        expect(es('voices.notice.first_exposure_dismissLabel')).toBe('Entendido, descartar el aviso del nuevo motor de voz')
    })

    it('stays hidden without a converted voice, or signed out', () => {
        render(<FirstExposureNotice userHash="user-b" hasConvertedVoice={false} />)
        render(<FirstExposureNotice userHash={null} hasConvertedVoice />)
        expect(screen.queryByTestId('voice-first-exposure')).not.toBeInTheDocument()
    })
})

describe('VoiceNoticeStack', () => {
    afterEach(() => localStorage.clear())

    it('shows at most two notices, first exposure first, and a dismissal makes room', async () => {
        const { rerender } = render(
            <VoiceNoticeStack userHash="user-c" hasConvertedVoice flags={[REVIEW_FLAG_CARD, REVIEW_FLAG_PRESET]} substitutedName="Maren" />,
        )
        expect(MAX_VISIBLE_VOICE_NOTICES).toBe(2)
        expect(screen.getByTestId('voice-first-exposure')).toBeInTheDocument()
        expect(screen.getAllByTestId('voice-review-notice')).toHaveLength(1)
        expect(screen.queryByText('Plays as Maren')).not.toBeInTheDocument()

        const gotIt = screen.getByRole('button', { name: 'Got it, dismiss the new voice engine notice' })
        gotIt.focus()
        fireEvent.click(gotIt)
        expect(screen.getAllByTestId('voice-review-notice')).toHaveLength(2)
        // 05 §10: the focus moves on to the next notice, which keeps its place in the stack.
        await waitFor(() => expect(screen.getAllByRole('region')[0]).toHaveFocus())
        // Each review notice is named after its record (here the kind: no name is known).
        expect(screen.getAllByRole('region')[0]).toHaveAccessibleName('Review this voice: Character')

        rerender(<VoiceNoticeStack userHash="user-c" hasConvertedVoice flags={[]} substitutedName="Maren" />)
        expect(screen.getByText('Plays as Maren')).toBeInTheDocument()
    })

    it('names each review notice after its record, numbered when names repeat (05 §10)', () => {
        const cardB = { ...REVIEW_FLAG_CARD, flag_id: 31, ref_id: 'card-2' }
        const { unmount } = render(<VoiceNoticeStack userHash="user-f" flags={[REVIEW_FLAG_CARD, cardB]} />)
        expect(screen.getAllByRole('button', { name: /^Dismiss review notice for/ }).map((button) => button.getAttribute('aria-label'))).toEqual([
            'Dismiss review notice for Character (1)',
            'Dismiss review notice for Character (2)',
        ])
        unmount()

        render(<VoiceNoticeStack userHash="user-f" flags={[REVIEW_FLAG_CARD, cardB]} nameFor={(flag) => (flag.ref_id === 'card-1' ? 'Lyra' : 'Orrin')} />)
        expect(screen.getByRole('region', { name: 'Review this voice: Lyra' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Dismiss review notice for Orrin' })).toBeInTheDocument()
    })

    it('renders nothing when no notice applies', () => {
        const { container } = render(<VoiceNoticeStack userHash="user-d" hasConvertedVoice={false} flags={[]} substitutedName={null} />)
        expect(container).toBeEmptyDOMElement()
    })
})
