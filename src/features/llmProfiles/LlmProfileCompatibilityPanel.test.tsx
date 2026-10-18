import { beforeEach as beforeEachGrantedFeatures } from 'vitest'
import { setAllTestFeatureFlags as grantFixtureFeatures } from '@/shared/hooks/testing/featureFlagTestUtils'
beforeEachGrantedFeatures(() => grantFixtureFeatures(true))
import { render, screen, within } from '@testing-library/react'
import { expect, it } from 'vitest'
import { LlmProfileCompatibilityPanel } from './LlmProfileCompatibilityPanel'
import { invalidConfiguration, mixedCompatibility } from './llmCompatibilityFixtures'

it('lists every contract as working or not, with the roles and the role that blocks it', () => {
    render(<LlmProfileCompatibilityPanel state={{ status: 'ready', report: mixedCompatibility }} />)
    const panel = screen.getByRole('group', { name: 'Compatibility by feature' })
    expect(within(panel).getAllByRole('listitem')).toHaveLength(4)
    const works = within(panel).getByRole('list', { name: 'Works for' })
    expect(within(works).getAllByRole('listitem').map(item => item.textContent)).toEqual(['Novel writing', 'Card generation'])
    const blocked = within(panel).getByRole('list', { name: 'Not available for' })
    const rows = within(blocked).getAllByRole('listitem')
    expect(within(rows[0]).getByText('Adventure chat')).toBeInTheDocument()
    expect(within(rows[0]).getByText('Response model · Metadata model · Preflight model')).toBeInTheDocument()
    expect(within(rows[0]).getByText('Metadata model is not verified for this feature or lacks a required capability.')).toBeInTheDocument()
    expect(within(rows[1]).getByText('Response model has too little context for this feature’s output budget.')).toBeInTheDocument()
})
it('reports an unusable configuration instead of per-feature rows', () => {
    render(<LlmProfileCompatibilityPanel state={{ status: 'ready', report: invalidConfiguration }} />)
    expect(screen.getByRole('alert')).toHaveTextContent('This configuration cannot be used: Response model is not available in the approved catalog for this payer.')
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument()
})
it('shows an unknown reason only as its fixed code', () => {
    render(<LlmProfileCompatibilityPanel state={{ status: 'ready', report: { configuration_issue: null,
        features: [{ feature: 'novel', roles: ['primary'], compatible: false, issue: { code: 'FUTURE_REASON', role: null } }] } }} />)
    expect(screen.getByText('Not available (FUTURE_REASON).')).toBeInTheDocument()
})
it.each([['checking', 'Checking compatibility…'], ['unavailable', 'Compatibility could not be checked. Saving still validates the configuration.']] as const)(
    'announces the %s state', (status, text) => {
        render(<LlmProfileCompatibilityPanel state={{ status, report: null }} />)
        expect(screen.getByRole('status')).toHaveTextContent(text)
    })
