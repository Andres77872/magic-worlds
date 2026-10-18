import { setTestFeatureFlags, setAllTestFeatureFlags } from '@/shared/hooks/testing/featureFlagTestUtils'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { MembershipPlan, MembershipPlanUpdateRequest, MembershipPlanCreateRequest } from '@/shared'
import { PlanEditorDialog } from './PlanEditorDialog'
import { MEMBERSHIP_OPERATIONS, freePlan, uniformLimits } from '../membership.fixtures'
import { ACTIVE_FEATURE_FLAGS, ACTIVE_FEATURE_KEYS } from '@/shared/featureFlagCatalog'

afterEach(() => vi.unstubAllEnvs())

describe('PlanEditorDialog independent root administration', () => {
    const cappedDefault: MembershipPlan = {
        ...freePlan,
        limits: Object.fromEntries(Object.entries(freePlan.limits).map(([operation, limit]) => [operation, {
            ...limit, daily_quantity_limit: operation === 'tts_generation' ? 2500 : operation === 'voice_call' ? 180 : null,
        }])),
    }

    it.each([
        { voices: false, calls: true, lorebooks: true, lorebookResources: false },
        { voices: true, calls: false, lorebooks: false, lorebookResources: true },
        { voices: false, calls: false, lorebooks: false, lorebookResources: false },
    ])('creates a complete plan regardless of consumer grants: %j', (flags) => {
        setAllTestFeatureFlags(true)
        setTestFeatureFlags(flags)
        const onCreate = vi.fn<(body: MembershipPlanCreateRequest) => void>()
        render(<PlanEditorDialog open mode="create" plan={null} plans={[cappedDefault]} operations={[...MEMBERSHIP_OPERATIONS]} saving={false}
            onCreate={onCreate} onUpdate={vi.fn()} onClose={vi.fn()} />)
        const dialog = screen.getByRole('dialog')
        fireEvent.change(within(dialog).getByRole('textbox', { name: /Plan code/ }), { target: { value: 'audit' } })
        fireEvent.change(within(dialog).getByRole('textbox', { name: /Display name/ }), { target: { value: 'Audit' } })
        fireEvent.change(within(dialog).getByRole('spinbutton', { name: 'Included daily credits' }), { target: { value: '100' } })
        fireEvent.click(within(dialog).getByRole('combobox'))
        fireEvent.click(screen.getByRole('option', { name: /Free/ }))
        expect(within(dialog).getAllByRole('spinbutton', { name: /Daily limit$/ })).toHaveLength(MEMBERSHIP_OPERATIONS.length)
        fireEvent.click(within(dialog).getByRole('button', { name: 'Create plan' }))
        expect(onCreate).toHaveBeenCalledOnce()
        expect(Object.keys(onCreate.mock.calls[0][0].limits).sort()).toEqual([...MEMBERSHIP_OPERATIONS].sort())
        expect(onCreate.mock.calls[0][0].limits).toEqual(cappedDefault.limits)
    })

    it('requires deliberate limits for every operation when creating without a preset', () => {
        setTestFeatureFlags({ voices: false })
        setTestFeatureFlags({ lorebookResources: false })
        const onCreate = vi.fn<(body: MembershipPlanCreateRequest) => void>()
        render(<PlanEditorDialog open mode="create" plan={null} plans={[cappedDefault]} operations={[...MEMBERSHIP_OPERATIONS]} saving={false}
            onCreate={onCreate} onUpdate={vi.fn()} onClose={vi.fn()} />)
        const dialog = screen.getByRole('dialog')
        fireEvent.change(within(dialog).getByRole('textbox', { name: /Plan code/ }), { target: { value: 'manual' } })
        fireEvent.change(within(dialog).getByRole('textbox', { name: /Display name/ }), { target: { value: 'Manual' } })
        for (const input of within(dialog).getAllByRole('spinbutton')) fireEvent.change(input, { target: { value: '10' } })
        fireEvent.click(within(dialog).getByRole('button', { name: 'Create plan' }))
        expect(onCreate).toHaveBeenCalledOnce()
        expect(onCreate.mock.calls[0][0].limits.tts_generation.daily_quantity_limit).toBe(10)
        expect(onCreate.mock.calls[0][0].limits.voice_call.daily_quantity_limit).toBe(10)
        expect(onCreate.mock.calls[0][0].limits.lorebook_resource_extraction.daily_request_limit).toBe(10)
    })
})

// Image operations carry a stored plan credit cost that billing ignores (images
// are priced per image profile); give them a distinct value to prove it rides
// along untouched.
const customPlan: MembershipPlan = {
    ...freePlan,
    plan_code: 'patron',
    display_name: 'Patron',
    is_default: false,
    limits: {
        ...uniformLimits(300, 2, 2),
        image_generation: { daily_request_limit: 300, max_in_flight: 2, credit_cost: 3 },
        card_image_generation: { daily_request_limit: 300, max_in_flight: 2, credit_cost: 3 },
    },
}

describe('PlanEditorDialog novel plan permission', () => {
    const flags = ACTIVE_FEATURE_KEYS.map(key => ({ key, requires: [...ACTIVE_FEATURE_FLAGS[key].requires] }))
    it('saves an explicitly selected novel grant with the returned plan and catalog versions', () => {
        const onUpdate = vi.fn()
        const plan = { ...customPlan, version: '4', feature_flags: { novels: null } }
        render(<PlanEditorDialog open mode="edit" plan={plan} plans={[freePlan, plan]}
            operations={[...MEMBERSHIP_OPERATIONS]} flags={flags} catalogRevision="1" saving={false}
            onCreate={vi.fn()} onUpdate={onUpdate} onClose={vi.fn()} />)
        const toggle = screen.getByRole('switch', { name: 'Story Studio' })
        expect(toggle).not.toBeChecked()
        expect(screen.queryByRole('switch', { name: /Workspaces/i })).toBeNull()
        fireEvent.click(toggle)
        fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
        expect(onUpdate).toHaveBeenCalledWith('patron', expect.objectContaining({
            feature_flags: expect.objectContaining({ novels: true }), catalog_revision: '1', expected_version: '4',
            mutation_id: expect.any(String),
        }))
    })
    it('removes novel access explicitly without granting any other feature', () => {
        const onUpdate = vi.fn()
        const plan = { ...customPlan, version: '5', feature_flags: { novels: true } }
        render(<PlanEditorDialog open mode="edit" plan={plan} plans={[freePlan, plan]}
            operations={[...MEMBERSHIP_OPERATIONS]} flags={flags} catalogRevision="1" saving={false}
            onCreate={vi.fn()} onUpdate={onUpdate} onClose={vi.fn()} />)
        fireEvent.click(screen.getByRole('switch', { name: 'Story Studio' }))
        fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
        const body = onUpdate.mock.calls[0][1]
        expect(Object.values(body.feature_flags).every(grant => grant === false)).toBe(true)
    })
})

function renderEditor(plans: MembershipPlan[] = [freePlan, customPlan]) {
    const onUpdate = vi.fn<(planCode: string, body: MembershipPlanUpdateRequest) => void>()
    render(
        <PlanEditorDialog
            open
            mode="edit"
            plan={customPlan}
            plans={plans}
            operations={[...MEMBERSHIP_OPERATIONS]}
            saving={false}
            onCreate={vi.fn()}
            onUpdate={onUpdate}
            onClose={vi.fn()}
        />,
    )
    return { onUpdate, dialog: screen.getByRole('dialog', { name: 'Edit plan' }) }
}

describe('PlanEditorDialog image pricing', () => {
    it('shows voice limits and preserves them when another limit changes', () => {
        setTestFeatureFlags({ voices: false })
        setTestFeatureFlags({ calls: true })
        const { dialog, onUpdate } = renderEditor()

        expect(within(dialog).getAllByRole('spinbutton', { name: /TTS|Call mode/ }).length).toBeGreaterThan(0)
        fireEvent.change(within(dialog).getByRole('spinbutton', { name: 'Chat · Daily limit' }), { target: { value: '40' } })
        fireEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }))

        expect(onUpdate).toHaveBeenCalledTimes(1)
        const [, body] = onUpdate.mock.calls[0]
        expect(body.limits?.chat_interaction.daily_request_limit).toBe(40)
        expect(body.limits?.tts_generation).toEqual(customPlan.limits.tts_generation)
        expect(body.limits?.voice_call).toEqual(customPlan.limits.voice_call)
    })

    it('does not offer a plan credit cost for image operations and points to image profiles', () => {
        const { dialog } = renderEditor()

        expect(within(dialog).getByRole('spinbutton', { name: 'Chat · Credit cost' })).toHaveValue(2)
        expect(within(dialog).queryByRole('spinbutton', { name: 'Chat/adventure images · Credit cost' })).toBeNull()
        expect(within(dialog).queryByRole('spinbutton', { name: 'Card images · Credit cost' })).toBeNull()
        expect(within(dialog).getByRole('spinbutton', { name: 'Card images · Daily limit' })).toHaveValue(300)
        expect(within(dialog).getAllByText('Per profile')).toHaveLength(2)
        expect(within(dialog).getByText(/Images are priced per image profile/)).toHaveTextContent('Image profiles console')
    })

    it('saves image limits with their stored credit cost untouched', () => {
        const { dialog, onUpdate } = renderEditor()

        fireEvent.change(within(dialog).getByRole('spinbutton', { name: 'Card images · Daily limit' }), { target: { value: '40' } })
        fireEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }))

        expect(onUpdate).toHaveBeenCalledTimes(1)
        const [, body] = onUpdate.mock.calls[0]
        expect(body.limits?.card_image_generation).toEqual({ daily_request_limit: 40, max_in_flight: 2, credit_cost: 3, daily_quantity_limit: null })
        expect(body.limits?.image_generation.credit_cost).toBe(3)
    })

    it('keeps the stored image credit cost when copying limits from another plan', () => {
        const { dialog, onUpdate } = renderEditor()

        fireEvent.click(within(dialog).getByRole('combobox'))
        fireEvent.click(screen.getByRole('option', { name: /Free/ }))
        fireEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }))

        expect(onUpdate).toHaveBeenCalledTimes(1)
        const [, body] = onUpdate.mock.calls[0]
        expect(body.limits?.chat_interaction).toEqual({ ...freePlan.limits.chat_interaction })
        expect(body.limits?.image_generation).toEqual({ ...freePlan.limits.image_generation, credit_cost: 3 })
        expect(body.limits?.card_image_generation).toEqual({ ...freePlan.limits.card_image_generation, credit_cost: 3 })
    })
})

describe('PlanEditorDialog daily quantity (D24)', () => {
    // A server that carries the key sends it on every row: null where no cap is set.
    function withQuantities(plan: MembershipPlan, quantities: Record<string, number | null>): MembershipPlan {
        return {
            ...plan,
            limits: Object.fromEntries(Object.entries(plan.limits).map(([operation, limit]) =>
                [operation, { ...limit, daily_quantity_limit: quantities[operation] ?? null }])),
        }
    }

    const quantityFree = withQuantities(freePlan, { tts_generation: 2500, voice_call: 180 })
    const quantityCustom = withQuantities(customPlan, { tts_generation: 8000, voice_call: 600, chat_interaction: 7 })

    function renderQuantityEditor(mode: 'create' | 'edit', plans: MembershipPlan[] = [quantityFree, quantityCustom]) {
        const onCreate = vi.fn()
        const onUpdate = vi.fn<(planCode: string, body: MembershipPlanUpdateRequest) => void>()
        render(
            <PlanEditorDialog
                open
                mode={mode}
                plan={mode === 'edit' ? quantityCustom : null}
                plans={plans}
                operations={[...MEMBERSHIP_OPERATIONS]}
                saving={false}
                onCreate={onCreate}
                onUpdate={onUpdate}
                onClose={vi.fn()}
            />,
        )
        return { onCreate, onUpdate, dialog: screen.getByRole('dialog') }
    }

    it('edits the narration characters and call seconds, and sends null for every other operation (I-2)', () => {
        const { dialog, onUpdate } = renderQuantityEditor('edit')

        const narration = within(dialog).getByRole('spinbutton', { name: 'TTS · Daily quantity (chars)' })
        const call = within(dialog).getByRole('spinbutton', { name: 'Call mode · Daily quantity (sec)' })
        expect(narration).toHaveValue(8000)
        expect(call).toHaveValue(600)
        expect(narration).toHaveAttribute('aria-required', 'true')
        expect(within(dialog).queryByRole('spinbutton', { name: /Chat · Daily quantity/ })).toBeNull()
        expect(within(dialog).getAllByText('Not used').length).toBe(MEMBERSHIP_OPERATIONS.length - 2)

        fireEvent.change(narration, { target: { value: '20000' } })
        fireEvent.change(call, { target: { value: '0' } })
        fireEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }))

        expect(onUpdate).toHaveBeenCalledTimes(1)
        const [planCode, body] = onUpdate.mock.calls[0]
        expect(planCode).toBe('patron')
        expect(body.limits?.tts_generation).toEqual({ daily_request_limit: 300, max_in_flight: 2, credit_cost: 2, daily_quantity_limit: 20000 })
        // 0 is a valid cap: it allows none.
        expect(body.limits?.voice_call.daily_quantity_limit).toBe(0)
        // Not a quantity-capped operation: always null, even over a stray stored value.
        expect(body.limits?.chat_interaction.daily_quantity_limit).toBeNull()
        expect(body.limits?.ai_card_generation.daily_quantity_limit).toBeNull()
    })

    it.each(['TTS · Daily quantity (chars)', 'Call mode · Daily quantity (sec)'])('requires a daily quantity for %s (no uncapped plan, I-2)', (name) => {
        const { dialog, onUpdate } = renderQuantityEditor('edit')

        const input = within(dialog).getByRole('spinbutton', { name })
        fireEvent.change(input, { target: { value: '' } })

        expect(input).toHaveAttribute('aria-invalid', 'true')
        expect(within(dialog).getByRole('alert')).toHaveTextContent('TTS and call mode need a daily quantity of 0 or more')
        expect(within(dialog).getByRole('button', { name: 'Save changes' })).toBeDisabled()
        fireEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }))
        expect(onUpdate).not.toHaveBeenCalled()
    })

    it('blocks a new plan copied from a plan with no voice caps until both are set', () => {
        const uncapped = withQuantities({ ...freePlan, plan_code: 'legacy', display_name: 'Legacy', is_default: false }, {})
        const { dialog, onCreate } = renderQuantityEditor('create', [quantityFree, uncapped])

        fireEvent.change(within(dialog).getByRole('textbox', { name: /Plan code/ }), { target: { value: 'bard' } })
        fireEvent.change(within(dialog).getByRole('textbox', { name: /Display name/ }), { target: { value: 'Bard' } })
        fireEvent.change(within(dialog).getByRole('spinbutton', { name: 'Included daily credits' }), { target: { value: '120' } })
        fireEvent.click(within(dialog).getByRole('combobox'))
        fireEvent.click(screen.getByRole('option', { name: /Legacy/ }))

        expect(within(dialog).getByRole('button', { name: 'Create plan' })).toBeDisabled()
        fireEvent.change(within(dialog).getByRole('spinbutton', { name: 'TTS · Daily quantity (chars)' }), { target: { value: '2500' } })
        fireEvent.change(within(dialog).getByRole('spinbutton', { name: 'Call mode · Daily quantity (sec)' }), { target: { value: '180' } })
        fireEvent.click(within(dialog).getByRole('button', { name: 'Create plan' }))

        expect(onCreate).toHaveBeenCalledTimes(1)
        expect(onCreate.mock.calls[0][0].limits.voice_call.daily_quantity_limit).toBe(180)
    })

    it('treats a quantity-only change as a limit change', () => {
        const { dialog, onUpdate } = renderQuantityEditor('edit')

        fireEvent.change(within(dialog).getByRole('spinbutton', { name: 'Call mode · Daily quantity (sec)' }), { target: { value: '900' } })
        fireEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }))

        expect(onUpdate.mock.calls[0][1]).toMatchObject({ limits: expect.objectContaining({ voice_call: expect.objectContaining({ daily_quantity_limit: 900 }) }) })
    })

    it('blocks a negative or fractional quantity', () => {
        const { dialog, onUpdate } = renderQuantityEditor('edit')

        fireEvent.change(within(dialog).getByRole('spinbutton', { name: 'TTS · Daily quantity (chars)' }), { target: { value: '2.5' } })

        expect(within(dialog).getByRole('alert')).toHaveTextContent('TTS and call mode need a daily quantity of 0 or more')
        expect(within(dialog).getByRole('button', { name: 'Save changes' })).toBeDisabled()
        expect(onUpdate).not.toHaveBeenCalled()
    })

    it('sets the quantity on a new custom plan copied from a default', () => {
        const { dialog, onCreate } = renderQuantityEditor('create')

        fireEvent.change(within(dialog).getByRole('textbox', { name: /Plan code/ }), { target: { value: 'bard' } })
        fireEvent.change(within(dialog).getByRole('textbox', { name: /Display name/ }), { target: { value: 'Bard' } })
        fireEvent.change(within(dialog).getByRole('spinbutton', { name: 'Included daily credits' }), { target: { value: '120' } })
        fireEvent.click(within(dialog).getByRole('combobox'))
        fireEvent.click(screen.getByRole('option', { name: /Free/ }))
        expect(within(dialog).getByRole('spinbutton', { name: 'TTS · Daily quantity (chars)' })).toHaveValue(2500)
        fireEvent.change(within(dialog).getByRole('spinbutton', { name: 'Call mode · Daily quantity (sec)' }), { target: { value: '300' } })
        fireEvent.click(within(dialog).getByRole('button', { name: 'Create plan' }))

        expect(onCreate).toHaveBeenCalledTimes(1)
        const body = onCreate.mock.calls[0][0]
        expect(body.plan_code).toBe('bard')
        expect(body.limits.tts_generation.daily_quantity_limit).toBe(2500)
        expect(body.limits.voice_call.daily_quantity_limit).toBe(300)
        expect(body.limits.chat_interaction.daily_quantity_limit).toBeNull()
    })

    it('hides the column and never sends the key to a server without it', () => {
        const legacy = (plan: MembershipPlan): MembershipPlan => ({
            ...plan,
            limits: Object.fromEntries(Object.entries(plan.limits).map(([operation, limit]) => [operation, {
                daily_request_limit: limit.daily_request_limit,
                max_in_flight: limit.max_in_flight,
                credit_cost: limit.credit_cost,
            }])),
        })
        const onUpdate = vi.fn<(planCode: string, body: MembershipPlanUpdateRequest) => void>()
        render(<PlanEditorDialog open mode="edit" plan={legacy(customPlan)} plans={[legacy(freePlan), legacy(customPlan)]}
            operations={[...MEMBERSHIP_OPERATIONS]} saving={false} onCreate={vi.fn()} onUpdate={onUpdate} onClose={vi.fn()} />)
        const dialog = screen.getByRole('dialog')

        expect(within(dialog).queryByRole('columnheader', { name: 'Daily quantity' })).toBeNull()
        fireEvent.change(within(dialog).getByRole('spinbutton', { name: 'TTS · Daily limit' }), { target: { value: '12' } })
        fireEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }))

        const [, body] = onUpdate.mock.calls[0]
        expect(body.limits?.tts_generation).toEqual({ daily_request_limit: 12, max_in_flight: 2, credit_cost: 2 })
        expect(Object.values(body.limits ?? {}).some((limit) => 'daily_quantity_limit' in limit)).toBe(false)
    })
})

describe('PlanEditorDialog root testing plans', () => {
    it('lets root configure disabled operations when creating a custom plan', () => {
        setTestFeatureFlags({ voices: false })
        setTestFeatureFlags({ calls: false })
        const onCreate = vi.fn<(body: MembershipPlanCreateRequest) => void>()
        render(<PlanEditorDialog open mode="create" plan={null} plans={[freePlan]} operations={[...MEMBERSHIP_OPERATIONS]}
            saving={false} onCreate={onCreate} onUpdate={vi.fn()} onClose={vi.fn()} />)
        const dialog = screen.getByRole('dialog')
        fireEvent.change(within(dialog).getByRole('textbox', { name: /Plan code/ }), { target: { value: 'testers' } })
        fireEvent.change(within(dialog).getByRole('textbox', { name: /Display name/ }), { target: { value: 'Internal testers' } })
        fireEvent.change(within(dialog).getByRole('spinbutton', { name: 'Included daily credits' }), { target: { value: '1000' } })
        fireEvent.click(within(dialog).getByRole('combobox'))
        fireEvent.click(screen.getByRole('option', { name: /Free/ }))
        expect(within(dialog).getByRole('spinbutton', { name: 'TTS · Daily quantity (chars)' })).toBeInTheDocument()

        expect(within(dialog).getAllByRole('spinbutton', { name: /Daily limit$/ })).toHaveLength(9)
        fireEvent.change(within(dialog).getByRole('spinbutton', { name: 'TTS · Daily quantity (chars)' }), { target: { value: '12000' } })
        fireEvent.change(within(dialog).getByRole('spinbutton', { name: 'Call mode · Daily quantity (sec)' }), { target: { value: '900' } })
        fireEvent.change(within(dialog).getByRole('spinbutton', { name: 'Voice previews · Daily limit' }), { target: { value: '15' } })
        fireEvent.click(within(dialog).getByRole('button', { name: 'Create plan' }))

        expect(onCreate).toHaveBeenCalledOnce()
        const plan = onCreate.mock.calls[0][0]
        expect(Object.keys(plan.limits)).toHaveLength(9)
        expect(plan.limits.tts_generation.daily_quantity_limit).toBe(12000)
        expect(plan.limits.voice_call.daily_quantity_limit).toBe(900)
        expect(plan.limits.voice_preview.daily_request_limit).toBe(15)
    })

    it('persists edited voice limits without any consumer permission', () => {
        setTestFeatureFlags({ voices: false })
        const { dialog, onUpdate } = renderEditor()
        fireEvent.change(within(dialog).getByRole('spinbutton', { name: 'TTS · Daily quantity (chars)' }), { target: { value: '12000' } })
        fireEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }))

        expect(onUpdate).toHaveBeenCalledOnce()
        expect(onUpdate.mock.calls[0][1].limits?.tts_generation.daily_quantity_limit).toBe(12000)
    })
})
