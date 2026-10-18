import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AdminMembershipPage } from './AdminMembershipPage'
import { MEMBERSHIP_OPERATIONS, freePlan, members, overview, plans, plusPlan, proPlan, providerUsage, sponsorPlan, uniformLimits } from '../membership.fixtures'
import { ACTIVE_FEATURE_FLAGS, ACTIVE_FEATURE_KEYS } from '@/shared/featureFlagCatalog'

const mockUseAuth = vi.fn()
const getMembershipOverview = vi.fn()
const listMembershipPlans = vi.fn()
const listMembershipMembers = vi.fn()
const createMembershipPlan = vi.fn()
const updateMembershipPlan = vi.fn()
const assignMembershipPlan = vi.fn()
const resetMembershipQuotas = vi.fn()
const getLlmProviderUsage = vi.fn()

vi.mock('@/app/hooks', () => ({
    useAuth: () => mockUseAuth(),
    useLanguage: () => ({ intlLocale: 'en' }),
    useNavigation: () => ({ setPage: vi.fn(), currentPage: 'admin-membership' }),
}))

vi.mock('@/infrastructure/api', () => ({
    apiService: {
        getMembershipOverview: (...args: unknown[]) => getMembershipOverview(...args),
        listMembershipPlans: (...args: unknown[]) => listMembershipPlans(...args),
        listMembershipMembers: (...args: unknown[]) => listMembershipMembers(...args),
        createMembershipPlan: (...args: unknown[]) => createMembershipPlan(...args),
        updateMembershipPlan: (...args: unknown[]) => updateMembershipPlan(...args),
        assignMembershipPlan: (...args: unknown[]) => assignMembershipPlan(...args),
        resetMembershipQuotas: (...args: unknown[]) => resetMembershipQuotas(...args),
        getLlmProviderUsage: (...args: unknown[]) => getLlmProviderUsage(...args),
    },
}))

const rootUser = { user_hash: 'usr-root', username: 'root', user_type: 'root', created_at: null, updated_at: null }
const consumerUser = { ...rootUser, user_hash: 'usr-consumer', username: 'lyra', user_type: 'consumer' }

const activePlans = [freePlan, plusPlan, proPlan, sponsorPlan]

async function openTab(name: string) {
    fireEvent.click(screen.getByRole('tab', { name }))
}

describe('AdminMembershipPage', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockUseAuth.mockReturnValue({ isAuthenticated: true, user: rootUser, accountKey: 'acct-root', openLoginModal: vi.fn() })
        getMembershipOverview.mockResolvedValue(overview)
        getLlmProviderUsage.mockResolvedValue(providerUsage)
        listMembershipPlans.mockResolvedValue({ items: plans, operations: [...MEMBERSHIP_OPERATIONS] })
        listMembershipMembers.mockResolvedValue({
            items: members,
            limit: 25,
            offset: 0,
            next_offset: null,
            total: members.length,
            usage_date: '2026-06-19',
            month: '2026-06',
        })
        createMembershipPlan.mockImplementation(async (body: { plan_code: string; display_name: string; daily_credit_limit: number; limits: Record<string, unknown> }) => ({
            ...sponsorPlan,
            plan_code: body.plan_code,
            display_name: body.display_name,
            daily_credit_limit: body.daily_credit_limit,
            member_count: 0,
        }))
        updateMembershipPlan.mockImplementation(async (code: string, body: Record<string, unknown>) => ({
            ...(plans.find((plan) => plan.plan_code === code) ?? sponsorPlan),
            ...body,
        }))
        assignMembershipPlan.mockResolvedValue({
            outcome: 'accepted',
            user_id: 913,
            user_hash: 'usr-newcomer-2b',
            username: 'newcomer',
            plan_code: 'sponsor',
            previous_plan_code: 'free',
            changed: true,
            membership: {
                plan_code: 'sponsor',
                display_name: 'Sponsor',
                credits: { period: 'daily', max: 1000, used: 0, remaining: 1000, usage_date: '2026-06-19' },
                payg: { balance: 25, free_balance: 25, billed_balance: 0 },
                total_available_credits: 1025,
                limits: {},
                monthly_usage: null,
                profile_cards: { current_plan_code: 'sponsor', tiers: [], payg: {} },
            },
        })
        resetMembershipQuotas.mockResolvedValue({
            outcome: 'accepted',
            target: 'all',
            periods: ['daily'],
            reset_at: '2026-06-19T12:00:00Z',
            daily: { membership_usage_days: 2, membership_operation_usage_days: 3 },
            monthly: null,
            membership: null,
        })
    })

    it('shows every stored Free permission in the root editor from the server catalog', async () => {
        listMembershipPlans.mockResolvedValue({
            items: [{ ...freePlan, version: '2', feature_revision: '2',
                feature_flags: Object.fromEntries(ACTIVE_FEATURE_KEYS.map(key => [key, true])) }],
            operations: [...MEMBERSHIP_OPERATIONS], catalog_revision: '1',
            flags: ACTIVE_FEATURE_KEYS.map(key => ({ key, requires: [...ACTIVE_FEATURE_FLAGS[key].requires] })),
        })
        render(<AdminMembershipPage />)
        const card = await screen.findByTestId('plan-card-free')
        expect(within(card).getByText('Feature permissions · 9/9 enabled')).toBeInTheDocument()
        fireEvent.click(within(card).getByRole('button', { name: 'Edit' }))
        const dialog = await screen.findByRole('dialog', { name: 'Edit plan' })
        expect(within(dialog).getByRole('switch', { name: 'Story Studio' })).toBeChecked()
        expect(within(dialog).getAllByRole('switch').filter(input => input.getAttribute('aria-checked') === 'true')).toHaveLength(10)
        expect(within(dialog).queryByRole('switch', { name: /Workspaces/i })).toBeNull()
    })

    it('asks signed-out users to log in', () => {
        const openLoginModal = vi.fn()
        mockUseAuth.mockReturnValue({ isAuthenticated: false, user: null, openLoginModal })

        render(<AdminMembershipPage />)

        expect(screen.getByText('Root access required')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Log in' }))
        expect(openLoginModal).toHaveBeenCalledTimes(1)
        expect(listMembershipPlans).not.toHaveBeenCalled()
    })

    it('denies authenticated non-root users', () => {
        mockUseAuth.mockReturnValue({ isAuthenticated: true, user: consumerUser, openLoginModal: vi.fn() })

        render(<AdminMembershipPage />)

        expect(screen.getByText('Root access required')).toBeInTheDocument()
        expect(screen.getByText(/limited to root users/i)).toBeInTheDocument()
        expect(getMembershipOverview).not.toHaveBeenCalled()
    })

    it('loads the overview, plan catalog, and members for root', async () => {
        render(<AdminMembershipPage />)

        expect(screen.getByRole('heading', { name: 'Membership & plans' })).toBeInTheDocument()
        expect(await screen.findByTestId('plan-card-sponsor')).toBeInTheDocument()
        expect(screen.getByTestId('plan-card-free')).toHaveTextContent('Fallback')
        expect(screen.getByTestId('plan-card-pro')).toHaveTextContent('Billing-synced')
        expect(screen.getByTestId('plan-card-beta-2025')).toHaveTextContent('Inactive')
        await waitFor(() => expect(screen.getByText('151')).toBeInTheDocument())
        expect(getMembershipOverview).toHaveBeenCalledTimes(1)
        expect(listMembershipPlans).toHaveBeenCalledTimes(1)
        expect(listMembershipMembers).toHaveBeenCalledWith(expect.objectContaining({ sort: 'recent', offset: 0, limit: 25 }))
    })

    it('creates a custom plan seeded from an existing plan', async () => {
        render(<AdminMembershipPage />)
        await screen.findByTestId('plan-card-free')

        fireEvent.click(screen.getByRole('button', { name: 'New plan' }))
        const dialog = await screen.findByRole('dialog', { name: 'New custom plan' })
        fireEvent.change(within(dialog).getByLabelText('Plan code'), { target: { value: 'Patron' } })
        fireEvent.change(within(dialog).getByLabelText('Display name'), { target: { value: 'Patron' } })
        fireEvent.change(within(dialog).getByLabelText('Included daily credits'), { target: { value: '750' } })
        // Every operation row must be filled; use the first three inputs of each row.
        for (const operation of MEMBERSHIP_OPERATIONS) {
            const inputs = within(dialog).getAllByRole('spinbutton', { name: new RegExp(`${operation}|Daily limit|In flight|Credit cost`) })
            expect(inputs.length).toBeGreaterThan(0)
        }
        const dailyInputs = within(dialog).getAllByRole('spinbutton', { name: /Daily limit$/ })
        expect(dailyInputs).toHaveLength(MEMBERSHIP_OPERATIONS.length)
        for (const input of dailyInputs) fireEvent.change(input, { target: { value: '300' } })
        fireEvent.change(within(dialog).getByRole('spinbutton', { name: 'TTS · Daily quantity (chars)' }), { target: { value: '2500' } })
        fireEvent.change(within(dialog).getByRole('spinbutton', { name: 'Call mode · Daily quantity (sec)' }), { target: { value: '180' } })

        fireEvent.click(within(dialog).getByRole('button', { name: 'Create plan' }))

        await waitFor(() => expect(createMembershipPlan).toHaveBeenCalledTimes(1))
        expect(createMembershipPlan).toHaveBeenCalledWith(expect.objectContaining({
            plan_code: 'patron',
            display_name: 'Patron',
            daily_credit_limit: 750,
            is_active: true,
            limits: uniformLimits(300, 1, 1),
            mutation_id: expect.any(String),
        }))
        expect(await screen.findByText('Plan created')).toBeInTheDocument()
        expect(listMembershipPlans).toHaveBeenCalledTimes(2)
    })

    it('edits a billing-synced plan without touching its synced facts', async () => {
        render(<AdminMembershipPage />)
        const card = await screen.findByTestId('plan-card-pro')

        fireEvent.click(within(card).getByRole('button', { name: 'Edit' }))
        const dialog = await screen.findByRole('dialog', { name: 'Edit plan' })
        expect(within(dialog).getByLabelText('Display name')).toBeDisabled()
        expect(within(dialog).getByLabelText('Included daily credits')).toBeDisabled()
        const chatDaily = within(dialog).getByRole('spinbutton', { name: 'Chat · Daily limit' })
        fireEvent.change(chatDaily, { target: { value: '900' } })
        fireEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }))

        await waitFor(() => expect(updateMembershipPlan).toHaveBeenCalledTimes(1))
        const [code, body] = updateMembershipPlan.mock.calls[0] as [string, { limits: Record<string, { daily_request_limit: number }> }]
        expect(code).toBe('pro')
        expect(Object.keys(body).sort()).toEqual(['limits', 'mutation_id'])
        expect(body.limits.chat_interaction.daily_request_limit).toBe(900)
        expect(body.limits.tts_generation.daily_request_limit).toBe(500)
        expect(await screen.findByText('Plan updated')).toBeInTheDocument()
    })

    it('filters members by plan from a plan card and assigns a new plan', async () => {
        render(<AdminMembershipPage />)
        const card = await screen.findByTestId('plan-card-sponsor')

        fireEvent.click(within(card).getByRole('button', { name: 'Members' }))
        await waitFor(() => {
            expect(listMembershipMembers).toHaveBeenLastCalledWith(expect.objectContaining({ plan_code: 'sponsor' }))
        })
        expect(screen.getByRole('tab', { name: 'Members', selected: true })).toBeInTheDocument()

        // An account already on a plan cannot be re-assigned the same plan.
        const lyraRow = await screen.findByTestId('member-row-42')
        fireEvent.click(within(lyraRow).getByRole('button', { name: 'Change plan' }))
        const lyraDialog = await screen.findByRole('dialog', { name: 'Change plan' })
        expect(within(lyraDialog).getByRole('button', { name: 'Assign plan' })).toBeDisabled()
        fireEvent.click(within(lyraDialog).getByRole('button', { name: 'Cancel' }))
        await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Change plan' })).not.toBeInTheDocument())

        const row = await screen.findByTestId('member-row-913')
        expect(row).toHaveTextContent('No membership row yet')
        fireEvent.click(within(row).getByRole('button', { name: 'Change plan' }))
        const dialog = await screen.findByRole('dialog', { name: 'Change plan' })

        fireEvent.click(within(dialog).getByRole('combobox'))
        fireEvent.click(await screen.findByRole('option', { name: /Sponsor/ }))
        expect(within(dialog).getByText(/Custom plans stick/)).toBeInTheDocument()
        fireEvent.change(within(dialog).getByLabelText('Reason'), { target: { value: 'Sponsor agreement' } })
        fireEvent.click(within(dialog).getByRole('button', { name: 'Assign plan' }))

        await waitFor(() => expect(assignMembershipPlan).toHaveBeenCalledTimes(1))
        expect(assignMembershipPlan).toHaveBeenCalledWith({ user_id: 913, plan_code: 'sponsor', reason: 'Sponsor agreement' })
        expect(await screen.findByText('Plan assigned')).toBeInTheDocument()
        await waitFor(() => expect(screen.getByTestId('member-row-913')).toHaveTextContent('Sponsor'))
    })

    it('warns before assigning a billing-synced default plan', async () => {
        render(<AdminMembershipPage />)
        await screen.findByTestId('plan-card-free')
        await openTab('Members')
        const row = await screen.findByTestId('member-row-913')
        fireEvent.click(within(row).getByRole('button', { name: 'Change plan' }))
        const dialog = await screen.findByRole('dialog', { name: 'Change plan' })

        fireEvent.click(within(dialog).getByRole('combobox'))
        fireEvent.click(await screen.findByRole('option', { name: /^Pro/ }))

        expect(within(dialog).getByText(/owned by billing/i)).toBeInTheDocument()
    })

    it('renders the usage breakdown and resets quotas after confirmation', async () => {
        render(<AdminMembershipPage />)
        await screen.findByTestId('plan-card-free')
        await openTab('Usage')

        expect(await screen.findByRole('heading', { name: 'Usage by plan' })).toBeInTheDocument()
        expect(screen.getByRole('heading', { name: 'Operations this month' })).toBeInTheDocument()
        const capacity = screen.getByRole('region', { name: 'Profile requests by payer' })
        expect(within(capacity).getByText('BYOK · zero app credits')).toBeInTheDocument()
        expect(within(capacity).getByText('17 requests · 2 accounts')).toBeInTheDocument()
        expect(within(capacity).getByText('Historical · payer unknown')).toBeInTheDocument()
        expect(within(capacity).queryByText('17 credits')).not.toBeInTheDocument()

        expect(within(capacity).getByText(/^21.?400 requests/)).toBeInTheDocument()
        const filters = within(capacity).getByRole('group', { name: 'Filter requests by payer' })
        fireEvent.click(within(filters).getByRole('button', { name: 'BYOK' }))
        expect(within(filters).getByRole('button', { name: 'BYOK' })).toHaveAttribute('aria-pressed', 'true')
        expect(within(capacity).getByText('17 requests · 2 accounts')).toBeInTheDocument()
        expect(within(capacity).queryByText('Historical · payer unknown')).not.toBeInTheDocument()
        expect(within(capacity).queryByText(/^21.?400 requests/)).toBeNull()
        fireEvent.click(within(filters).getByRole('button', { name: 'All payers' }))
        expect(within(capacity).getByText('Historical · payer unknown')).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'Reset quotas' }))
        const confirm = screen.getByRole('dialog', { name: 'Reset quotas?' })
        fireEvent.click(within(confirm).getByRole('button', { name: 'Reset quotas' }))

        await waitFor(() => {
            expect(resetMembershipQuotas).toHaveBeenCalledWith({ target: 'all', periods: ['daily'], reason: null })
        })
        expect(await screen.findByText('Quotas reset')).toBeInTheDocument()
        expect(getMembershipOverview).toHaveBeenCalledTimes(2)
    })

    it('loads provider cost by payer only when the usage tab opens', async () => {
        render(<AdminMembershipPage />)
        await screen.findByTestId('plan-card-free')
        expect(getLlmProviderUsage).not.toHaveBeenCalled()

        await openTab('Usage')
        const cost = await screen.findByRole('region', { name: 'Provider cost by payer' })
        expect(await within(cost).findByText('$84.125')).toBeInTheDocument()
        expect(getLlmProviderUsage).toHaveBeenCalledTimes(1)
        expect(within(cost).getByText('2026-06-01 → 2026-06-19')).toBeInTheDocument()
        expect(within(cost).getByText("Billed to each member's provider account")).toBeInTheDocument()
        expect(within(cost).getByText('$0.2675')).toBeInTheDocument()
        expect(within(cost).getByText('2 calls without a price · cost unknown')).toBeInTheDocument()
        expect(within(cost).getByText('No estimate')).toBeInTheDocument()
        expect(within(cost).getByText('3 calls without a price · cost unknown')).toBeInTheDocument()
        expect(within(cost).queryByText(/\d+ credits?$/)).toBeNull()

        await openTab('Plans')
        await openTab('Usage')
        expect(getLlmProviderUsage).toHaveBeenCalledTimes(1)
    })

    it('says provider estimates are unavailable instead of showing zero', async () => {
        getLlmProviderUsage.mockRejectedValueOnce(new Error('upstream down'))
        render(<AdminMembershipPage />)
        await screen.findByTestId('plan-card-free')
        await openTab('Usage')

        const cost = await screen.findByRole('region', { name: 'Provider cost by payer' })
        expect(await within(cost).findByText('Provider estimates are unavailable right now.')).toBeInTheDocument()
        expect(within(cost).queryByText(/\$0/)).toBeNull()
    })

    it('surfaces quota reset API errors', async () => {
        resetMembershipQuotas.mockRejectedValueOnce(new Error('quota reset refused'))
        render(<AdminMembershipPage />)
        await screen.findByTestId('plan-card-free')
        await openTab('Usage')

        fireEvent.click(screen.getByRole('button', { name: 'Reset quotas' }))
        fireEvent.click(within(screen.getByRole('dialog', { name: 'Reset quotas?' })).getByRole('button', { name: 'Reset quotas' }))

        expect(await screen.findByText('Quota reset failed')).toBeInTheDocument()
        expect(screen.getAllByRole('alert')[0]).toHaveTextContent('quota reset refused')
    })

    it('surfaces plan loading failures', async () => {
        listMembershipPlans.mockRejectedValueOnce(new Error('plans unavailable'))
        render(<AdminMembershipPage />)

        expect(await screen.findByRole('alert')).toHaveTextContent('plans unavailable')
        expect(activePlans.length).toBeGreaterThan(0)
    })
})
