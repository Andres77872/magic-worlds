import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { ControlSlider } from './ControlSlider'

const meta = {
    title: 'Voices/ControlSlider',
    component: ControlSlider,
    tags: ['autodocs'],
    parameters: {
        layout: 'centered',
        docs: {
            description: {
                component:
                    'Labelled on-brand range row with a mono readout and a reset-to-default affordance. Used by the user preset recipe controls (speed, volume, pitch), the voice console settings editor (stability, similarity, style, speed) and the Remix and Design guidance controls. Opt-in slots add end labels under the track and a note (such as an out-of-range flag) that describes the slider.',
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
        min: 0.7,
        max: 1.2,
        step: 0.05,
        defaultValue: 1,
        onChange: () => undefined,
    },
} satisfies Meta<typeof ControlSlider>

export default meta
type Story = StoryObj<typeof meta>

function Interactive() {
    const [stability, setStability] = useState(0.5)
    const [speed, setSpeed] = useState(1)
    return (
        <div className="flex flex-col gap-4">
            <ControlSlider
                label="Stability"
                value={stability}
                min={0}
                max={1}
                step={0.05}
                defaultValue={0.5}
                onChange={setStability}
                format={(value) => value.toFixed(2)}
            />
            <ControlSlider
                label="Speed"
                value={speed}
                min={0.7}
                max={1.2}
                step={0.05}
                defaultValue={1}
                onChange={setSpeed}
                format={(value) => value.toFixed(2)}
                valueText={(value) => `Speed ${value.toFixed(2)} times`}
            />
        </div>
    )
}

export const Default: Story = {
    render: () => <Interactive />,
}

/** At the voice's own value the row says so ("Voice default"); moving the slider drops the tag and offers a reset. */
export const VoiceDefault: Story = {
    args: { label: 'Stability', value: 0.5, min: 0, max: 1, defaultValue: 0.5, defaultTag: 'Voice default', format: (value: number) => value.toFixed(2) },
}

/** Tuned away from the default: no tag, and the reset button. */
export const Tuned: Story = {
    args: { label: 'Stability', value: 0.35, min: 0, max: 1, defaultValue: 0.5, defaultTag: 'Voice default', format: (value: number) => value.toFixed(2) },
}

/** End labels name what each end of the track does (05 §5.1). */
export const WithEnds: Story = {
    args: {
        label: 'Stability',
        value: 0.4,
        min: 0,
        max: 1,
        defaultValue: 0.5,
        defaultTag: 'Voice default',
        lowLabel: 'More expressive',
        highLabel: 'More consistent',
        format: (value: number) => value.toFixed(2),
        valueText: (value: number) => `Stability ${value.toFixed(2)}, more expressive`,
    },
}

/** A note under the row, wired to the slider through aria-describedby. */
export const WithNotice: Story = {
    args: {
        label: 'Speed',
        value: 1.2,
        defaultValue: 1,
        format: (value: number) => `${value.toFixed(2)}×`,
        notice: <p className="font-ui text-caption text-fg-muted">Speed was saved as 1.45×, outside the supported range. Saving this preset stores 1.20×.</p>,
    },
}
