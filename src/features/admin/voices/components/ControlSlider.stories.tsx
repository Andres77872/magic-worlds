import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { ControlSlider } from './ControlSlider'

const meta = {
    title: 'Admin/Voices/ControlSlider',
    component: ControlSlider,
    tags: ['autodocs'],
    parameters: {
        layout: 'centered',
        docs: {
            description: {
                component:
                    'Labelled on-brand range row with a mono readout and a reset-to-default affordance. Used by the synthesis lab for speed / volume / pitch.',
            },
        },
    },
    decorators: [
        (Story) => (
            <div className="w-[320px] rounded-xl border border-parchment-50/10 bg-ink-800 p-4">
                <Story />
            </div>
        ),
    ],
    args: {
        label: 'Speed',
        value: 1,
        min: 0.5,
        max: 2,
        step: 0.1,
        defaultValue: 1,
        onChange: () => undefined,
    },
} satisfies Meta<typeof ControlSlider>

export default meta
type Story = StoryObj<typeof meta>

function Interactive() {
    const [speed, setSpeed] = useState(1)
    const [pitch, setPitch] = useState(0)
    return (
        <div className="flex flex-col gap-4">
            <ControlSlider
                label="Speed"
                value={speed}
                min={0.5}
                max={2}
                step={0.1}
                defaultValue={1}
                onChange={setSpeed}
                format={(value) => value.toFixed(1)}
            />
            <ControlSlider label="Pitch" value={pitch} min={-12} max={12} step={1} defaultValue={0} onChange={setPitch} />
        </div>
    )
}

export const Default: Story = {
    render: () => <Interactive />,
}
