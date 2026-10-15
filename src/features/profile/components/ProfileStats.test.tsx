import { render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { baseProfile } from './ProfileView.stories'
import { ProfileStats } from './ProfileStats'

afterEach(() => vi.unstubAllEnvs())

it('hides adventure metrics while preserving stored counts and core account metrics', () => {
    vi.stubEnv('VITE_FEATURE_ADVENTURES_ENABLED', 'false')
    const profile = structuredClone(baseProfile)
    const original = structuredClone(profile)
    const view = render(<ProfileStats profile={profile} />)
    expect(screen.queryByText('Adventures')).not.toBeInTheDocument()
    expect(screen.getByText('Characters')).toBeInTheDocument()
    expect(profile).toEqual(original)
    view.unmount()
    vi.stubEnv('VITE_FEATURE_ADVENTURES_ENABLED', 'true')
    render(<ProfileStats profile={profile} />)
    expect(screen.getByText('Adventures')).toBeInTheDocument()
    expect(profile).toEqual(original)
})
