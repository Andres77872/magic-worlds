import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { i18n } from '@/app/i18n'
import { ApiError } from '@/infrastructure/api'
import type { ChatTtsSegmentClip } from '@/shared/types'
import { installVoiceNarrationCopy } from '@/test-utils/voiceNarrationCopy'
import { NarrationVoiceNotes } from './NarrationVoiceNotes'

const clip = (segment_index: number, extra: Partial<ChatTtsSegmentClip> = {}): ChatTtsSegmentClip => ({ segment_index, status: 'completed', ...extra })

beforeAll(() => {
    installVoiceNarrationCopy()
})

beforeEach(async () => {
    await i18n.changeLanguage('en')
})

describe('NarrationVoiceNotes', () => {
    it('renders nothing for clips without substitution fields', () => {
        const { container } = render(<NarrationVoiceNotes clips={[clip(0, { kind: 'narrator' }), clip(1, { kind: 'speech', speaker_id: 'c1' })]} onRefreshVoice={vi.fn()} />)
        expect(container).toBeEmptyDOMElement()
    })

    it.each(['default_voice', 'distinct_voice', 'not_call_eligible'] as const)('renders nothing for %s', (reason) => {
        const { container } = render(<NarrationVoiceNotes clips={[clip(0, { substitution_reason: reason })]} />)
        expect(container).toBeEmptyDOMElement()
    })

    it('shows "Standard voice" with its tooltip for a tier fallback', () => {
        render(<NarrationVoiceNotes clips={[clip(0, { substitution_reason: 'tier_fallback' })]} />)
        const badge = screen.getByText('Standard voice')
        expect(badge).toHaveAttribute('title', 'Expressive wasn’t available for this reply')
    })

    it('shows "Voice replaced" with the named tooltip, or the generic one', () => {
        const { rerender } = render(
            <NarrationVoiceNotes clips={[clip(0, { kind: 'speech', speaker_id: 'c1', speaker_name: 'Rook', substitution_reason: 'voice_removed', voice_name: 'Ava', original_voice_name: 'Mia' })]} />,
        )
        expect(screen.getByText('Voice replaced')).toHaveAttribute('title', 'Mia isn’t available; using Ava')
        rerender(<NarrationVoiceNotes clips={[clip(0, { kind: 'speech', speaker_id: 'c1', substitution_reason: 'voice_unavailable' })]} />)
        expect(screen.getByText('Voice replaced')).toHaveAttribute('title', 'The chosen voice isn’t available, so a similar voice is used.')
    })

    it('refreshes the replaced speaker by its card id from the menu (R-30)', async () => {
        const onRefreshVoice = vi.fn().mockResolvedValue({})
        render(
            <NarrationVoiceNotes
                clips={[clip(0, { kind: 'thought', speaker_id: 'card-7', speaker_name: 'Rook', substitution_reason: 'voice_blocked', voice_name: 'Theo' })]}
                onRefreshVoice={onRefreshVoice}
            />,
        )
        const trigger = screen.getByRole('button', { name: /Voice replaced/ })
        expect(trigger).toHaveAttribute('aria-expanded', 'false')
        fireEvent.click(trigger)
        expect(trigger).toHaveAttribute('aria-expanded', 'true')
        fireEvent.click(screen.getByRole('menuitem', { name: 'Use the card’s current voice' }))
        expect(onRefreshVoice).toHaveBeenCalledWith({ speakerKind: 'thought', cardId: 'card-7' })
        expect(await screen.findByText('Voice updated. New replies use it.')).toBeInTheDocument()
        expect(screen.queryByRole('menu')).toBeNull()
    })

    it('shows the refusal copy when the refresh is refused', async () => {
        const onRefreshVoice = vi.fn().mockRejectedValue(new ApiError(409, 'busy', { code: 'voice_refresh_busy' }))
        render(<NarrationVoiceNotes clips={[clip(0, { kind: 'speech', speaker_id: 'c1', substitution_reason: 'voice_removed' })]} onRefreshVoice={onRefreshVoice} />)
        fireEvent.click(screen.getByRole('button', { name: /Voice replaced/ }))
        fireEvent.click(screen.getByRole('menuitem', { name: 'Use the card’s current voice' }))
        expect(await screen.findByText('Finish the current reply or call first.')).toBeInTheDocument()
    })

    it('offers the narrator picker for a replaced narrator voice', () => {
        const onRefreshVoice = vi.fn()
        const onEditNarratorVoice = vi.fn()
        render(
            <NarrationVoiceNotes
                clips={[clip(0, { kind: 'narrator', substitution_reason: 'voice_unavailable', voice_name: 'Ava' })]}
                onRefreshVoice={onRefreshVoice}
                onEditNarratorVoice={onEditNarratorVoice}
            />,
        )
        fireEvent.click(screen.getByRole('button', { name: /Voice replaced/ }))
        fireEvent.click(screen.getByRole('menuitem', { name: 'Change narrator voice' }))
        expect(onEditNarratorVoice).toHaveBeenCalledOnce()
        expect(onRefreshVoice).not.toHaveBeenCalled()
    })

    it('a narrator note without a picker is a plain badge', () => {
        render(<NarrationVoiceNotes clips={[clip(0, { kind: 'narrator', substitution_reason: 'voice_unavailable' })]} onRefreshVoice={vi.fn()} />)
        expect(screen.queryByRole('button', { name: /Voice replaced/ })).toBeNull()
        expect(screen.getByText('Voice replaced')).toBeInTheDocument()
    })

    it('disables the action when refresh is disabled', () => {
        const onRefreshVoice = vi.fn()
        render(<NarrationVoiceNotes clips={[clip(0, { kind: 'speech', speaker_id: 'c1', substitution_reason: 'voice_removed' })]} onRefreshVoice={onRefreshVoice} refreshDisabled />)
        fireEvent.click(screen.getByRole('button', { name: /Voice replaced/ }))
        const item = screen.getByRole('menuitem', { name: 'Use the card’s current voice' })
        expect(item).toBeDisabled()
        fireEvent.click(item)
        expect(onRefreshVoice).not.toHaveBeenCalled()
    })

    it('lists each replaced speaker once, labelled by speaker when several', () => {
        render(
            <NarrationVoiceNotes
                clips={[
                    clip(0, { kind: 'speech', speaker_id: 'c1', speaker_name: 'Rook', substitution_reason: 'voice_removed' }),
                    clip(1, { kind: 'speech', speaker_id: 'c1', speaker_name: 'Rook', substitution_reason: 'voice_removed' }),
                    clip(2, { kind: 'speech', speaker_id: 'c2', speaker_name: 'Wren', substitution_reason: 'voice_blocked' }),
                ]}
            />,
        )
        expect(screen.getByText('Rook · Voice replaced')).toBeInTheDocument()
        expect(screen.getByText('Wren · Voice replaced')).toBeInTheDocument()
    })

    it('closes the menu on Escape', async () => {
        render(<NarrationVoiceNotes clips={[clip(0, { kind: 'speech', speaker_id: 'c1', substitution_reason: 'voice_removed' })]} onRefreshVoice={vi.fn()} />)
        fireEvent.click(screen.getByRole('button', { name: /Voice replaced/ }))
        expect(screen.getByRole('menu')).toBeInTheDocument()
        act(() => {
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
        })
        await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
    })
})
