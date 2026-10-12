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
