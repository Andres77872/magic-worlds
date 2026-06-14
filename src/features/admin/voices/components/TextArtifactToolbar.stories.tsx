import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { TextArtifactToolbar } from './TextArtifactToolbar'

const meta = {
    title: 'Admin/Voices/TextArtifactToolbar',
    component: TextArtifactToolbar,
    tags: ['autodocs'],
    parameters: {
        layout: 'centered',
        docs: {
            description: {
                component:
                    'Chips that splice MiniMax T2A text artifacts (pause markers, interjection tags, pronunciation templates) into the synthesis text at the caret.',
            },
        },
    },
    decorators: [
        (Story) => (
            <div className="w-[420px] rounded-xl border border-parchment-50/10 bg-ink-800 p-4">
                <Story />
            </div>
        ),
    ],
    args: {
        onInsert: () => undefined,
    },
} satisfies Meta<typeof TextArtifactToolbar>

export default meta
type Story = StoryObj<typeof meta>

function Interactive() {
    const [text, setText] = useState('The lock turns once.')
    return (
        <div className="flex flex-col gap-3">
            <TextArtifactToolbar onInsert={(snippet) => setText((current) => `${current}${snippet}`)} />
            <p className="rounded-md border border-parchment-50/[.08] bg-ink-900 px-3 py-2 font-mono text-xs text-parchment-300">
                {text}
            </p>
        </div>
    )
}

export const Default: Story = {
    render: () => <Interactive />,
}
