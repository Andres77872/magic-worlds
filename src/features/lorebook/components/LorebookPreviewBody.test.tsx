import { render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { normalizeLorebook } from '../lorebookTransforms'
import { LorebookPreviewBody } from './LorebookPreviewBody'

afterEach(() => vi.unstubAllEnvs())

it('uses entries-only copy when resources are disabled', () => {
    vi.stubEnv('VITE_FEATURE_LOREBOOKS_ENABLED', 'true')
    vi.stubEnv('VITE_FEATURE_LOREBOOK_RESOURCES_ENABLED', 'false')
    render(<LorebookPreviewBody lorebook={normalizeLorebook({ id: 'book', name: 'Moon lore', entries: [] })} />)
    expect(screen.getByText('0 entries')).toBeInTheDocument()
    expect(screen.queryByText(/resources/i)).not.toBeInTheDocument()
})
