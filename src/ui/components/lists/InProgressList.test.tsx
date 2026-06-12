import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Adventure } from '@/shared'
import { InProgressList } from './InProgressList'

vi.mock('@/infrastructure/api', () => ({
    resolveMediaUrl: (url?: string | null) => url ?? undefined,
}))

describe('InProgressList', () => {
    afterEach(() => {
        vi.useRealTimers()
    })

    it('shows useful session metadata instead of an empty character warning', () => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-06-11T12:00:00Z'))

        render(
            <InProgressList
                adventures={[
                    {
                        id: '7',
                        scenario: '',
                        persona: { id: 'p1', name: 'Aria', race: 'Human', stats: {} },
                        characters: [],
                        world: { id: 'w1', name: 'Eldoria', type: 'fantasy', details: {} },
                        turns: [],
                        createdAt: '2026-06-11T10:00:00Z',
                        updatedAt: '2026-06-11T11:30:00Z',
                    } as Adventure,
                ]}
                onDelete={vi.fn()}
                onEdit={vi.fn()}
            />,
        )

        expect(screen.getByText("Aria's adventure")).toBeInTheDocument()
        expect(screen.getByText('Playing as Aria')).toBeInTheDocument()
        expect(screen.getByText(/Updated/)).toBeInTheDocument()
        expect(screen.queryByText(/No characters selected/i)).not.toBeInTheDocument()
    })
})
