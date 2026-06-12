import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { World } from '@/shared'
import { WorldList } from './WorldList'

vi.mock('@/infrastructure/api', () => ({
    resolveMediaUrl: (url?: string | null) => url ?? undefined,
}))

describe('WorldList', () => {
    it('uses empty-state copy for one-character scratch world values', () => {
        render(
            <WorldList
                worlds={[
                    {
                        id: 'w1',
                        name: 'c',
                        place_type: 'w',
                        type: 'a',
                        description: 'x',
                        details: {},
                    } as World,
                ]}
                onDelete={vi.fn()}
                onEdit={vi.fn()}
            />,
        )

        expect(screen.getByText('Untitled world')).toBeInTheDocument()
        expect(screen.getByText('No description')).toBeInTheDocument()
    })
})
