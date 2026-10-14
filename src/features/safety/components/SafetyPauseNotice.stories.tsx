import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { Button } from '@/ui/primitives'
import { ensureSafetyLocales } from '../test/ensureSafetyLocales'
import { SafetyPauseNotice, type SafetyPauseNoticeProps } from './SafetyPauseNotice'

// Until the `voiceSafety` copy is spread into the app bundles; a no-op afterwards.
ensureSafetyLocales()

function NoticeDemo(props: SafetyPauseNoticeProps) {
    const [open, setOpen] = useState(props.open)
    return (
        <>
            <Button onClick={() => setOpen(true)}>Show the pause notice</Button>
            <SafetyPauseNotice
                {...props}
                open={open}
                onClose={() => {
                    props.onClose()
                    setOpen(false)
                }}
            />
        </>
    )
}

const meta = {
    title: 'Features/Safety/SafetyPauseNotice',
    component: SafetyPauseNotice,
    tags: ['autodocs'],
    parameters: {
        layout: 'centered',
        docs: {
            description: {
                component:
                    'Opened once when the chat socket reports a voice safety pause (`voice_safety_notice`). A small modal around the crisis panel with a single close control; closing it keeps the pause, and text chat keeps working.',
            },
        },
    },
    argTypes: {
        open: { control: 'boolean' },
        retryAfterSeconds: { control: 'number' },
        onClose: { action: 'closed' },
    },
    args: { open: true, retryAfterSeconds: 1800, onClose: () => {} },
    render: (args) => <NoticeDemo {...args} />,
} satisfies Meta<typeof SafetyPauseNotice>

export default meta
type Story = StoryObj<typeof meta>

/** Voice comes back in about 30 minutes. */
export const Timed: Story = {}

/** No end from the server. */
export const OpenEnded: Story = { args: { retryAfterSeconds: null } }
