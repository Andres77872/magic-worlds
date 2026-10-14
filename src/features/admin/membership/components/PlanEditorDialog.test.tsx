import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { MembershipPlan, MembershipPlanUpdateRequest } from '@/shared'
import { PlanEditorDialog } from './PlanEditorDialog'
import { MEMBERSHIP_OPERATIONS, freePlan, uniformLimits } from '../membership.fixtures'

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
        expect(body.limits?.card_image_generation).toEqual({ daily_request_limit: 40, max_in_flight: 2, credit_cost: 3 })
        expect(body.limits?.image_generation.credit_cost).toBe(3)
    })

    it('keeps the stored image credit cost when copying limits from another plan', () => {
        const { dialog, onUpdate } = renderEditor()

        fireEvent.click(within(dialog).getByRole('combobox'))
        fireEvent.click(screen.getByRole('option', { name: /Free/ }))
        fireEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }))

        expect(onUpdate).toHaveBeenCalledTimes(1)
        const [, body] = onUpdate.mock.calls[0]
        expect(body.limits?.chat_interaction).toEqual({ daily_request_limit: 20, max_in_flight: 1, credit_cost: 1 })
        expect(body.limits?.image_generation).toEqual({ daily_request_limit: 20, max_in_flight: 1, credit_cost: 3 })
        expect(body.limits?.card_image_generation).toEqual({ daily_request_limit: 20, max_in_flight: 1, credit_cost: 3 })
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

        expect(onUpdate.mock.calls[0][1]).toEqual({ limits: expect.objectContaining({ voice_call: expect.objectContaining({ daily_quantity_limit: 900 }) }) })
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
        const { dialog, onUpdate } = renderEditor()

        expect(within(dialog).queryByRole('columnheader', { name: 'Daily quantity' })).toBeNull()
        fireEvent.change(within(dialog).getByRole('spinbutton', { name: 'TTS · Daily limit' }), { target: { value: '12' } })
        fireEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }))

        const [, body] = onUpdate.mock.calls[0]
        expect(body.limits?.tts_generation).toEqual({ daily_request_limit: 12, max_in_flight: 2, credit_cost: 2 })
        expect(Object.values(body.limits ?? {}).some((limit) => 'daily_quantity_limit' in limit)).toBe(false)
    })
})
