import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Button } from '../primitives'
import { LogoutConfirmDialog } from './LogoutConfirmDialog'

const meta = {
    title: 'Components/LogoutConfirmDialog',
    component: LogoutConfirmDialog,
    tags: ['autodocs'],
    parameters: {
        docs: {
            description: {
                component:
                    'Logout confirmation dialog composed from the Reverie Modal and Button primitives. The confirm action uses ember because logout is reversible, while destructive data deletion keeps the blood danger treatment.',
            },
        },
    },
    argTypes: {
        open: { control: false },
        onCancel: { control: false },
        onConfirm: { control: false },
    },
} satisfies Meta<typeof LogoutConfirmDialog>

export default meta
type Story = StoryObj<typeof meta>

function LogoutConfirmDialogDemo() {
    const [open, setOpen] = useState(true)

    return (
        <div className="min-h-[420px] bg-ink-800 p-8 text-parchment-50">
            <Button onClick={() => setOpen(true)}>Open dialog</Button>
            <LogoutConfirmDialog
                open={open}
                username="Lyra the Bard"
                onCancel={() => setOpen(false)}
                onConfirm={() => setOpen(false)}
            />
        </div>
    )
}

export const Default: Story = {
    args: {
        open: true,
        username: 'Lyra the Bard',
        onCancel: () => {},
        onConfirm: () => {},
    },
    render: () => <LogoutConfirmDialogDemo />,
}
