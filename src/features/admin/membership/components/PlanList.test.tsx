import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PlanList } from './PlanList'
import { proPlan, uniformLimits } from '../membership.fixtures'
import { ACTIVE_FEATURE_FLAGS, ACTIVE_FEATURE_KEYS } from '@/shared/featureFlagCatalog'

vi.mock('@/app/hooks', () => ({
    useLanguage: () => ({ intlLocale: 'en' }),
}))

describe('PlanList image pricing', () => {
    it('shows image operations as priced per profile instead of a plan credit cost', () => {
        const plan = { ...proPlan, limits: uniformLimits(500, 4, 2) }
        render(<PlanList plans={[plan]} loading={false} onCreate={vi.fn()} onEdit={vi.fn()} onViewMembers={vi.fn()} />)

        const card = screen.getByTestId('plan-card-pro')
        fireEvent.click(within(card).getByText('Daily limits'))

        const rowFor = (label: string) => within(card).getByText(label).closest('li') as HTMLElement
        expect(rowFor('Chat')).toHaveTextContent('500/day · 4 in flight · 2 cr')
        expect(rowFor('Chat/adventure images')).toHaveTextContent('500/day · 4 in flight · per profile')
        expect(rowFor('Card images')).toHaveTextContent('500/day · 4 in flight · per profile')
        expect(rowFor('Card images')).not.toHaveTextContent('cr')
        expect(within(card).getByText(/Images are priced per image profile/)).toHaveTextContent('Image profiles console')
    })
})

it('shows permissions from stored grants regardless of the plan name or billing status', () => {
    const flags = ACTIVE_FEATURE_KEYS.map(key => ({ key, requires: [...ACTIVE_FEATURE_FLAGS[key].requires] }))
    const plan = { ...proPlan, feature_flags: { novels: true } }
    render(<PlanList plans={[plan]} flags={flags} loading={false} onCreate={vi.fn()} onEdit={vi.fn()} onViewMembers={vi.fn()} />)
    const card = screen.getByTestId('plan-card-pro')
    fireEvent.click(within(card).getByText('Feature permissions · 1/9 enabled'))
    expect(within(card).getByText('Story Studio').closest('li')).toHaveTextContent('Enabled')
    expect(within(card).getByText('Voice calls').closest('li')).toHaveTextContent('Off')
})
