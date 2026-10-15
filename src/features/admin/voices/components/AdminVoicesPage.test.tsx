import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ComponentProps } from 'react'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { NavigationContext } from '@/app/providers/NavigationProvider'
import { ApiError } from '@/infrastructure/api'
import { auditCatalogVoices } from '../fixtures'
import { consoleApiMock, type ConsoleApiMock } from '../testUtils'
import { consoleLocation } from '../consoleLocation'
import { AdminVoicesPage } from './AdminVoicesPage'

type Nav = NonNullable<ComponentProps<typeof NavigationContext.Provider>['value']>
const renderWithNavigation = () => {
    const nav = { setPage: vi.fn(), replaceHash: vi.fn() }
    render(<NavigationContext.Provider value={nav as unknown as Nav}><AdminVoicesPage /></NavigationContext.Provider>)
    return nav
}

const api = vi.hoisted(() => ({}) as Record<string, unknown>)
const auth = vi.hoisted(() => ({ value: { isAuthenticated: true, user: { user_type: 'root' }, openLoginModal: () => {} } as Record<string, unknown> }))

vi.mock('@/infrastructure/api', async (importOriginal) => ({ ...(await importOriginal<object>()), apiService: api }))
vi.mock('@/app/hooks', () => ({ useAuth: () => auth.value }))

const mock = () => api as unknown as ConsoleApiMock

describe('AdminVoicesPage', () => {
    beforeEach(() => {
        window.history.replaceState(null, '', '/')
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
        expect(tabs.map((tab) => tab.textContent)).toEqual(['Voices', 'Create a voice', 'Review voices', 'Tools'])
        expect(await screen.findByRole('table', { name: 'Catalog voices' })).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /Provider limits/ })).not.toBeInTheDocument()
        // Modules mount on first visit only.
        expect(mock().getVoiceDefaults).not.toHaveBeenCalled()
        fireEvent.click(screen.getByRole('tab', { name: 'Tools' }))
        await waitFor(() => expect(mock().getVoiceDefaults).toHaveBeenCalledTimes(1))
    })

    it('loads the global presets module (after Defaults) on first visit only (R1-FE-06)', async () => {
        render(<AdminVoicesPage />)
        await screen.findByRole('table', { name: 'Catalog voices' })
        expect(mock().listAdminGlobalPresets).not.toHaveBeenCalled()
        fireEvent.click(screen.getByRole('tab', { name: 'Tools' }))
        fireEvent.click(screen.getByRole('tab', { name: 'Global presets' }))
        await waitFor(() => expect(mock().listAdminGlobalPresets).toHaveBeenCalledTimes(1))
        expect(await screen.findByRole('table', { name: 'Global presets' })).toBeInTheDocument()
    })

    it('opens the direct creation link with Fish selected and both supported languages', async () => {
        window.history.replaceState(null, '', '/#/admin/voices?module=create&provider=fish_audio')
        mock().getFishDesignCapabilities.mockResolvedValue({ provider: 'fish_audio', available: true, languages: ['en', 'es'], max_candidates: 4, max_text_chars: 150, model_id: 'voice-design-1', request_price_usd_micros: 10000 })
        render(<AdminVoicesPage />)
        expect(screen.getByRole('tab', { name: 'Create a voice' })).toHaveAttribute('aria-selected', 'true')
        const form = screen.getByRole('form', { name: 'Voice Design' })
        expect(within(form).getByRole('button', { name: 'Fish Audio' })).toHaveAttribute('aria-pressed', 'true')
        expect(within(form).getByRole('button', { name: 'ElevenLabs' })).toBeVisible()
        fireEvent.click(await within(form).findByRole('combobox', { name: 'Design language' }))
        expect(screen.getByRole('option', { name: 'Español' })).toBeVisible()
        expect(screen.getByRole('option', { name: 'English' })).toBeVisible()
        expect(mock().designFishVoice).not.toHaveBeenCalled()
        window.history.replaceState(null, '', '/')
    })

    it('loads the metrics module on first visit only, starting on narration (R0-OPS-07)', async () => {
        render(<AdminVoicesPage />)
        await screen.findByRole('table', { name: 'Catalog voices' })
        expect(mock().getAdminVoiceMetrics).not.toHaveBeenCalled()
        fireEvent.click(screen.getByRole('tab', { name: 'Tools' }))
        fireEvent.click(screen.getByRole('tab', { name: 'Metrics' }))
        await waitFor(() => expect(mock().getAdminVoiceMetrics).toHaveBeenCalledWith('narration', { hours: 24 }, expect.any(AbortSignal)))
        expect(await screen.findByRole('table', { name: 'Alert rules: Narration' })).toBeInTheDocument()
    })

    it('raises the configuration banner for a provider key error, not a voice error', async () => {
        mock().getVoiceLimits.mockRejectedValue(new ApiError(403, 'Key rejected', { code: 'invalid_api_key' }))
        render(<AdminVoicesPage />)
        fireEvent.click(screen.getByRole('tab', { name: 'Tools' }))
        fireEvent.click(await screen.findByRole('button', { name: /Provider limits/ }))
        const banner = await screen.findByText('Voice provider configuration problem')
        expect(banner.closest('[role="alert"]')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
        expect(screen.queryByText('Voice provider configuration problem')).not.toBeInTheDocument()
    })

    it('reads every module, and a catalog voice, from the URL', () => {
        expect(consoleLocation('#/admin/voices?module=metrics')).toEqual({ module: 'metrics', voiceKey: null })
        expect(consoleLocation('#/admin/voices?module=nope')).toEqual({ module: 'catalog', voiceKey: null })
        expect(consoleLocation('#/admin/voices?module=catalog&voice=vk_1')).toEqual({ module: 'catalog', voiceKey: 'vk_1' })
        // A voice only means something to the catalog.
        expect(consoleLocation('#/admin/voices?module=lab&voice=vk_1')).toEqual({ module: 'lab', voiceKey: null })
        expect(consoleLocation('#/admin/voices')).toEqual({ module: 'catalog', voiceKey: null })
    })

    it('opens a tool from a deep link, keeps the module in the URL and reopens the last tool', async () => {
        window.history.replaceState(null, '', '/#/admin/voices?module=metrics')
        const nav = renderWithNavigation()
        expect(screen.getByRole('tab', { name: 'Tools' })).toHaveAttribute('aria-selected', 'true')
        expect(screen.getByRole('tab', { name: 'Metrics' })).toHaveAttribute('aria-selected', 'true')
        expect(nav.replaceHash).not.toHaveBeenCalled()
        fireEvent.click(screen.getByRole('tab', { name: 'Voices' }))
        expect(nav.replaceHash).toHaveBeenLastCalledWith('#/admin/voices?module=catalog')
        fireEvent.click(screen.getByRole('tab', { name: 'Tools' }))
        expect(screen.getByRole('tab', { name: 'Metrics' })).toHaveAttribute('aria-selected', 'true')
        expect(nav.replaceHash).toHaveBeenLastCalledWith('#/admin/voices?module=metrics')
        window.history.replaceState(null, '', '/')
    })

    it('links to the Voice studio from the header instead of repeating the create tab', async () => {
        const nav = renderWithNavigation()
        fireEvent.click(screen.getByRole('button', { name: 'Open voice studio' }))
        expect(nav.setPage).toHaveBeenCalledWith('voice-studio')
        expect(screen.queryByRole('button', { name: 'Create a voice' })).not.toBeInTheDocument()
    })

    it('opens a deep-linked catalog voice and closes its drawer when it hands the voice to another module', async () => {
        const voice = auditCatalogVoices[0]
        window.history.replaceState(null, '', `/#/admin/voices?module=catalog&voice=${voice.voice_key}`)
        renderWithNavigation()
        const drawer = await screen.findByRole('dialog')
        expect(within(drawer).getByText(voice.display_name, { selector: 'h2, h2 *' })).toBeInTheDocument()
        fireEvent.click(within(drawer).getByRole('button', { name: 'Send to acceptance' }))
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
        expect(screen.getByRole('tab', { name: 'Review voices' })).toHaveAttribute('aria-selected', 'true')
        window.history.replaceState(null, '', '/')
    })

    it('opens the reference drawer with provider-neutral operating notes', async () => {
        render(<AdminVoicesPage />)
        fireEvent.click(screen.getByRole('tab', { name: 'Tools' }))
        fireEvent.click(screen.getByRole('button', { name: 'Reference' }))
        expect(await screen.findByRole('heading', { name: 'Tiers and models' })).toBeInTheDocument()
    })
})
