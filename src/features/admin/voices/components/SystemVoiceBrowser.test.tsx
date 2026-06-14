import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { AdminVoiceEntry } from '@/shared'
import { SystemVoiceBrowser } from './SystemVoiceBrowser'

function sys(voice_id: string, voice_name: string): AdminVoiceEntry {
    return { voice_id, voice_type: 'system', voice_name, description: ['A voice.'], created_time: '2025-01-01', deletable: false }
}

// 25 voices: English 12, Chinese 8, Japanese 3, Other 2.
const voices: AdminVoiceEntry[] = [
    ...Array.from({ length: 12 }, (_, i) => sys(`English_voice_${i + 1}`, `English Voice ${i + 1}`)),
    ...Array.from({ length: 8 }, (_, i) => sys(`Chinese (Mandarin)_voice_${i + 1}`, `Mandarin Voice ${i + 1}`)),
    ...Array.from({ length: 3 }, (_, i) => sys(`Japanese_voice_${i + 1}`, `Japanese Voice ${i + 1}`)),
    sys('male-qn-qingse', 'Legacy QN'),
    sys('presenter_male', 'Presenter Male'),
]

const props = () => ({ loading: false, deletingVoiceId: null, onTest: vi.fn(), onDelete: vi.fn() })

describe('SystemVoiceBrowser', () => {
    it('shows one page at a time and pages through with Next/Prev', () => {
        render(<SystemVoiceBrowser voices={voices} {...props()} />)

        expect(screen.getAllByRole('button', { name: 'Test' })).toHaveLength(10)
        expect(screen.getByText('Showing 1–10 of 25')).toBeInTheDocument()
        expect(screen.getByText('1 / 3')).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'Next page' }))
        expect(screen.getByText('Showing 11–20 of 25')).toBeInTheDocument()
        expect(screen.getByText('2 / 3')).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'Next page' }))
        expect(screen.getByText('Showing 21–25 of 25')).toBeInTheDocument()
        expect(screen.getAllByRole('button', { name: 'Test' })).toHaveLength(5)

        fireEvent.click(screen.getByRole('button', { name: 'Previous page' }))
        expect(screen.getByText('Showing 11–20 of 25')).toBeInTheDocument()
    })

    it('filters by search and resets to the first page', () => {
        render(<SystemVoiceBrowser voices={voices} {...props()} />)

        fireEvent.click(screen.getByRole('button', { name: 'Next page' }))
        expect(screen.getByText('2 / 3')).toBeInTheDocument()

        fireEvent.change(screen.getByLabelText('Search system voices'), { target: { value: 'Mandarin' } })

        // 8 Chinese voices match (id + name); fits one page, so the pager hides.
        expect(screen.getAllByRole('button', { name: 'Test' })).toHaveLength(8)
        expect(screen.queryByText(/Showing/)).not.toBeInTheDocument()
        expect(screen.getByText('8 of 25')).toBeInTheDocument()
    })

    it('shows an empty state when nothing matches', () => {
        render(<SystemVoiceBrowser voices={voices} {...props()} />)

        fireEvent.change(screen.getByLabelText('Search system voices'), { target: { value: 'zzz-nomatch' } })

        expect(screen.getByText('No system voices match your search.')).toBeInTheDocument()
        expect(screen.queryAllByRole('button', { name: 'Test' })).toHaveLength(0)
    })

    it('filters by language through the Select', () => {
        render(<SystemVoiceBrowser voices={voices} {...props()} />)

        fireEvent.click(screen.getByRole('combobox', { name: 'Filter by language' }))
        fireEvent.click(screen.getByRole('option', { name: 'Japanese (3)' }))

        expect(screen.getAllByRole('button', { name: 'Test' })).toHaveLength(3)
    })
})
