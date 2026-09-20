import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Button } from '@/ui/primitives'
import { PlanEditorDialog } from './PlanEditorDialog'
import { MEMBERSHIP_OPERATIONS, plans, proPlan, sponsorPlan } from '../membership.fixtures'

const meta = {
    title: 'Admin/Membership/PlanEditorDialog',
    component: PlanEditorDialog,
    tags: ['autodocs'],
    parameters: {
        layout: 'centered',
        docs: {
            description: {
                component:
                    'Create / edit dialog for a membership plan. Custom plans are fully editable; billing-synced paid defaults keep name and daily credits read-only and default plans cannot be deactivated. "Start from" copies another plan\'s per-operation limits.',
            },
        },
    },
    argTypes: {
        plan: { control: false },
        plans: { control: false },
        operations: { control: false },
        onCreate: { action: 'create' },
        onUpdate: { action: 'update' },
        onClose: { action: 'close' },
    },
    args: {
        open: true,
        mode: 'create',
        plan: null,
        plans,
        operations: [...MEMBERSHIP_OPERATIONS],
        saving: false,
        onCreate: () => undefined,
        onUpdate: () => undefined,
        onClose: () => undefined,
    },
} satisfies Meta<typeof PlanEditorDialog>

export default meta
type Story = StoryObj<typeof meta>

function DialogDemo(args: Story['args']) {
    const [open, setOpen] = useState(false)
    return (
        <>
            <Button variant="primary" onClick={() => setOpen(true)}>
                Open plan editor
            </Button>
            <PlanEditorDialog {...(args as Parameters<typeof PlanEditorDialog>[0])} open={open} onClose={() => setOpen(false)} />
        </>
    )
}

/** Creating a brand-new custom plan. */
export const Create: Story = { render: (args) => <DialogDemo {...args} /> }

/** Editing a custom plan: every field is editable. */
export const EditCustom: Story = {
    args: { mode: 'edit', plan: sponsorPlan },
    render: (args) => <DialogDemo {...args} />,
}

/** Editing a billing-synced default: name and daily credits are locked. */
export const EditBillingSynced: Story = {
    args: { mode: 'edit', plan: proPlan },
    render: (args) => <DialogDemo {...args} />,
}
