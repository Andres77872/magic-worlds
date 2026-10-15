import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { ApiError } from '@/infrastructure/api'
import { auditLimits } from '../../fixtures'
import { consoleApiMock, renderInConsole, type ConsoleApiMock } from '../../testUtils'
import { LimitsWidget } from './LimitsWidget'

const api = vi.hoisted(() => ({}) as Record<string, unknown>)
vi.mock('@/infrastructure/api', async (importOriginal) => ({ ...(await importOriginal<object>()), apiService: api }))
const mock = () => api as unknown as ConsoleApiMock

async function openLimits() {
    renderInConsole(<LimitsWidget />)
    fireEvent.click(await screen.findByRole('button', { name: 'Provider limits: Slots 48/660 · ops left 928' }))
    return screen.findByRole('dialog', { name: 'Provider limits' })
}

describe('LimitsWidget (AC-R12)', () => {
    beforeEach(() => {
        for (const key of Object.keys(api)) delete api[key]
        Object.assign(api, consoleApiMock())
    })

    it('shows slots, voice operations and character meters from the live snapshot', async () => {
        const drawer = await openLimits()
        expect(within(drawer).getByRole('meter', { name: 'Custom voice slots' })).toHaveAttribute('aria-valuenow', '48')
        expect(within(drawer).getByRole('meter', { name: 'Voice operations this month' })).toHaveAttribute('aria-valuemax', '1040')
        expect(within(drawer).getByText('928 left')).toBeInTheDocument()
        expect(within(drawer).getByRole('meter', { name: 'Characters this period' })).toHaveAttribute('aria-valuenow', '1250000')
    })

    it('shows spend by surface against the daily budget', async () => {
        const drawer = await openLimits()
        const spend = within(drawer).getByRole('table', { name: 'Characters spent today per surface' })
        expect(within(spend).getByRole('row', { name: 'Narration 41,000' })).toBeInTheDocument()
        expect(within(spend).getByRole('row', { name: 'Calls 12,500' })).toBeInTheDocument()
        expect(within(drawer).getByRole('meter', { name: 'Daily budget' })).toHaveAttribute('aria-valuenow', '57500')
        expect(within(drawer).getByText('50% of the daily budget used')).toBeInTheDocument()
    })

    it('shows per-key usage with an unknown unit and the sync runs with a mass-miss abort', async () => {
        const drawer = await openLimits()
        const perKey = within(drawer).getByRole('table', { name: 'Usage per provider key' })
        expect(within(perKey).getAllByText('unit not confirmed yet (S-28)')).toHaveLength(2)
        const runs = within(drawer).getByRole('table', { name: 'Last catalog sync runs' })
        expect(within(runs).getByText('Mass-miss abort')).toBeInTheDocument()
        expect(within(runs).getByText('Aborted')).toBeInTheDocument()
    })

    it('alerts on the trigger when a sync run aborted', async () => {
        renderInConsole(<LimitsWidget />)
        const trigger = await screen.findByRole('button', { name: /Provider limits: Slots 48\/660/ })
        expect(trigger.querySelector('.text-blood-300')).not.toBeNull()
    })

    it('can only raise the daily budget', async () => {
        mock().putRuntimeSetting.mockResolvedValue({ setting_key: 'daily_budget_chars', value_json: 150000, updated_at: null, updated_by_user_id: 1 })
        const drawer = await openLimits()
        const input = within(drawer).getByLabelText('New daily budget (characters)')
        fireEvent.change(input, { target: { value: '90000' } })
        fireEvent.click(within(drawer).getByRole('button', { name: 'Raise budget' }))
        expect(await within(drawer).findByText('Enter a value above the current budget.')).toBeInTheDocument()
        expect(mock().putRuntimeSetting).not.toHaveBeenCalled()

        fireEvent.change(input, { target: { value: '150000' } })
        fireEvent.click(within(drawer).getByRole('button', { name: 'Raise budget' }))
        await waitFor(() => expect(mock().putRuntimeSetting).toHaveBeenCalledWith('daily_budget_chars', 150000))
        expect(await screen.findByText('Daily budget updated')).toBeInTheDocument()
        await waitFor(() => expect(mock().getVoiceLimits).toHaveBeenCalledTimes(2))
    })

    it('explains that a runtime switch is env AND db: a row can only turn a surface off (I-12)', async () => {
        mock().getRuntimeSettings.mockResolvedValue({
            items: [
                { setting_key: 'auto_narration_paused', value_json: false, updated_by_user_id: 0, updated_at: null },
                { setting_key: 'tts_engine_enabled', value_json: true, updated_by_user_id: 0, updated_at: null },
                { setting_key: 'voice_mode_enabled', value_json: false, updated_by_user_id: 0, updated_at: null },
            ],
        })
        const drawer = await openLimits()
        const panel = await within(drawer).findByRole('region', { name: 'Runtime settings (read only)' })
        expect(within(panel).getByText(/only when both the server environment and this value allow it/)).toBeInTheDocument()
        expect(within(panel).getByText(/can only turn a surface off/)).toBeInTheDocument()
        expect(within(panel).getByText('On only if TTS_ENGINE_ENABLED is also on')).toBeInTheDocument()
        expect(within(panel).getByText('Off: the surface is disabled')).toBeInTheDocument()
        expect(within(panel).getAllByText(/^(On only if|Off:)/)).toHaveLength(2)
        expect(mock().putRuntimeSetting).not.toHaveBeenCalled()
    })

    it('hides the runtime panel when the route is missing', async () => {
        let rejectLoad: (error: unknown) => void = () => {}
        mock().getRuntimeSettings.mockReturnValue(new Promise((_, reject) => (rejectLoad = reject)))
        const drawer = await openLimits()
        await waitFor(() => expect(mock().getRuntimeSettings).toHaveBeenCalled())
        // Settle the 404 explicitly, so the assertions below see the error path, not the pending load.
        await act(async () => rejectLoad(new ApiError(404, 'Not Found')))
        expect(within(drawer).queryByRole('region', { name: 'Runtime settings (read only)' })).not.toBeInTheDocument()
        expect(within(drawer).queryByRole('alert')).not.toBeInTheDocument()
        expect(within(drawer).getByRole('meter', { name: 'Custom voice slots' })).toBeInTheDocument()
    })

    it('shows "Unknown" instead of a meter value for counts the provider did not report', async () => {
        mock().getVoiceLimits.mockResolvedValue({
            ...auditLimits,
            subscription: { ...auditLimits.subscription!, voice_limit: null, max_voice_add_edits: null, character_count: null },
            breakers: { admin_lab: 'closed' },
            spend_circuit: null,
        })
        renderInConsole(<LimitsWidget />)
        // A partial snapshot never claims slot or op numbers on the trigger.
        fireEvent.click(await screen.findByRole('button', { name: 'Provider limits: Limits unavailable' }))
        const drawer = await screen.findByRole('dialog', { name: 'Provider limits' })
        expect(within(drawer).queryByRole('meter', { name: 'Custom voice slots' })).not.toBeInTheDocument()
        expect(within(drawer).queryByRole('meter', { name: 'Voice operations this month' })).not.toBeInTheDocument()
        expect(within(drawer).queryByRole('meter', { name: 'Characters this period' })).not.toBeInTheDocument()
        expect(within(drawer).getAllByText('Unknown')).toHaveLength(3)
        expect(within(drawer).getAllByTestId('usage-meter-unknown')).toHaveLength(3)
        expect(within(drawer).queryByText(/left$/)).not.toBeInTheDocument()
        expect(within(drawer).queryByText(/NaN/)).not.toBeInTheDocument()
        // The budget meter still reads its own live numbers.
        expect(within(drawer).getByRole('meter', { name: 'Daily budget' })).toHaveAttribute('aria-valuenow', '57500')
    })

    it('shows the unavailable state when limits cannot be read', async () => {
        mock().getVoiceLimits.mockResolvedValue({ ...auditLimits, subscription: null })
        renderInConsole(<LimitsWidget />)
        fireEvent.click(await screen.findByRole('button', { name: 'Provider limits: Limits unavailable' }))
        const drawer = await screen.findByRole('dialog', { name: 'Provider limits' })
        expect(within(drawer).getByText('Limits unavailable')).toBeInTheDocument()
    })
})
