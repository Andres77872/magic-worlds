import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { ApiError } from '@/infrastructure/api'
import { consoleApiMock, type ConsoleApiMock } from '../testUtils'
import { AdminVoicesPage } from './AdminVoicesPage'

const api = vi.hoisted(() => ({}) as Record<string, unknown>)
const auth = vi.hoisted(() => ({ value: { isAuthenticated: true, user: { user_type: 'root' }, openLoginModal: () => {} } as Record<string, unknown> }))

vi.mock('@/infrastructure/api', async (importOriginal) => ({ ...(await importOriginal<object>()), apiService: api }))
vi.mock('@/app/hooks', () => ({ useAuth: () => auth.value }))

const mock = () => api as unknown as ConsoleApiMock

describe('AdminVoicesPage', () => {
    beforeEach(() => {
        for (const key of Object.keys(api)) delete api[key]
        Object.assign(api, consoleApiMock())
        auth.value = { isAuthenticated: true, user: { user_type: 'root' }, openLoginModal: vi.fn() }
    })

    it('shows the access state to non-root users and makes no console request (AC-R1)', () => {
        auth.value = { isAuthenticated: true, user: { user_type: 'user' }, openLoginModal: vi.fn() }
        render(<AdminVoicesPage />)
        expect(screen.getByText('Root access required')).toBeInTheDocument()
        expect(screen.getByText('The voice console is limited to root users.')).toBeInTheDocument()
        for (const fn of Object.values(mock())) expect(fn).not.toHaveBeenCalled()
        expect(mock().getAdminVoiceMetrics).not.toHaveBeenCalled()
    })

    it('asks signed-out visitors to log in, with no console request', async () => {
        const openLoginModal = vi.fn()
        auth.value = { isAuthenticated: false, user: null, openLoginModal }
        render(<AdminVoicesPage />)
        fireEvent.click(screen.getByRole('button', { name: 'Log in' }))
        expect(openLoginModal).toHaveBeenCalled()
        expect(mock().listAdminCatalog).not.toHaveBeenCalled()
        expect(mock().getVoiceLimits).not.toHaveBeenCalled()
    })

    it('renders the console modules for root, starting on the catalog', async () => {
        render(<AdminVoicesPage />)
        expect(screen.getByRole('heading', { name: 'Voice console' })).toBeInTheDocument()
        const tabs = within(screen.getByRole('tablist', { name: 'Voice console modules' })).getAllByRole('tab')
        expect(tabs.map((tab) => tab.textContent)).toEqual(['Catalog', 'Acceptance', 'Defaults', 'Global presets', 'Legacy mapping', 'Library', 'Create', 'Synth lab', 'Metrics', 'Reports'])
        expect(await screen.findByRole('table', { name: 'Catalog voices' })).toBeInTheDocument()
        expect(await screen.findByRole('button', { name: /Provider limits: Slots 48\/660/ })).toBeInTheDocument()
        // Modules mount on first visit only.
        expect(mock().getVoiceDefaults).not.toHaveBeenCalled()
        fireEvent.click(screen.getByRole('tab', { name: 'Defaults' }))
        await waitFor(() => expect(mock().getVoiceDefaults).toHaveBeenCalledTimes(1))
    })

    it('loads the global presets module (after Defaults) on first visit only (R1-FE-06)', async () => {
        render(<AdminVoicesPage />)
        await screen.findByRole('table', { name: 'Catalog voices' })
        expect(mock().listAdminGlobalPresets).not.toHaveBeenCalled()
        fireEvent.click(screen.getByRole('tab', { name: 'Global presets' }))
        await waitFor(() => expect(mock().listAdminGlobalPresets).toHaveBeenCalledTimes(1))
        expect(await screen.findByRole('table', { name: 'Global presets' })).toBeInTheDocument()
    })

    it('loads the metrics module on first visit only, starting on narration (R0-OPS-07)', async () => {
        render(<AdminVoicesPage />)
        await screen.findByRole('table', { name: 'Catalog voices' })
        expect(mock().getAdminVoiceMetrics).not.toHaveBeenCalled()
        fireEvent.click(screen.getByRole('tab', { name: 'Metrics' }))
        await waitFor(() => expect(mock().getAdminVoiceMetrics).toHaveBeenCalledWith('narration', { hours: 24 }, expect.any(AbortSignal)))
        expect(await screen.findByRole('table', { name: 'Alert rules: Narration' })).toBeInTheDocument()
    })

    it('raises the configuration banner for a provider key error, not a voice error', async () => {
        mock().getVoiceLimits.mockRejectedValue(new ApiError(403, 'Key rejected', { code: 'invalid_api_key' }))
        render(<AdminVoicesPage />)
        fireEvent.click(await screen.findByRole('button', { name: /Provider limits/ }))
        const banner = await screen.findByText('Voice provider configuration problem')
        expect(banner.closest('[role="alert"]')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
        expect(screen.queryByText('Voice provider configuration problem')).not.toBeInTheDocument()
    })

    it('opens the reference drawer with provider-neutral operating notes', async () => {
        render(<AdminVoicesPage />)
        fireEvent.click(screen.getByRole('button', { name: 'Reference' }))
        expect(await screen.findByRole('heading', { name: 'Tiers and models' })).toBeInTheDocument()
    })
})
