import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Button, Tag } from '@/ui/primitives'
import { FloatingWindow } from './FloatingWindow'

const SampleBody = (
    <div className="flex flex-col gap-3">
        <Tag>Court mage</Tag>
        <p className="font-narrative text-sm leading-relaxed text-parchment-400">
            Sworn to the glass throne, Aria reads the futures written in mirror-light and keeps the old pacts that
            bind the courts together.
        </p>
        <div className="flex flex-wrap gap-1.5">
            <Tag>mirror</Tag>
            <Tag>oath</Tag>
            <Tag>court</Tag>
        </div>
    </div>
)

const meta = {
    title: 'Components/Windows/FloatingWindow',
    component: FloatingWindow,
    tags: ['autodocs'],
    parameters: {
        layout: 'fullscreen',
        docs: {
            description: {
                component:
                    'A non-modal, draggable panel that floats above the app like a desktop window — no scrim, no focus trap, the page stays interactive. Drag by the titlebar, resize from the corner grip, minimize to the titlebar, close, and click to bring to front. On small screens it falls back to a full-width bottom sheet with drag/resize disabled.',
            },
        },
    },
    argTypes: {
        title: { control: 'text' },
        zIndex: { control: false },
        isTop: { control: 'boolean' },
        onEdit: { control: false },
        onClose: { action: 'close' },
        onFocus: { action: 'focus' },
        children: { control: false },
    },
    args: {
        title: 'Aria Vex',
        isTop: true,
        zIndex: 46,
        initialPosition: { x: 64, y: 64 },
        onClose: () => {},
        onFocus: () => {},
        children: SampleBody,
    },
} satisfies Meta<typeof FloatingWindow>

export default meta
type Story = StoryObj<typeof meta>

/** A single preview window with an Edit action in the titlebar. */
export const Default: Story = {
    args: { onEdit: () => {}, editLabel: 'Edit' },
}

/** Preview-only — no Edit affordance. */
export const PreviewOnly: Story = {}

function StackedWindowsDemo() {
    const [open, setOpen] = useState(['a', 'b'])
    return (
        <div className="min-h-screen p-6">
            <Button onClick={() => setOpen(['a', 'b'])}>Reset</Button>
            {open.includes('a') && (
                <FloatingWindow
                    title="Glass Courts"
                    zIndex={46}
                    isTop={false}
                    initialPosition={{ x: 64, y: 80 }}
                    onClose={() => setOpen((w) => w.filter((x) => x !== 'a'))}
                    onFocus={() => {}}
                >
                    {SampleBody}
                </FloatingWindow>
            )}
            {open.includes('b') && (
                <FloatingWindow
                    title="Ironhold"
                    zIndex={47}
                    isTop
                    initialPosition={{ x: 140, y: 132 }}
                    onClose={() => setOpen((w) => w.filter((x) => x !== 'b'))}
                    onFocus={() => {}}
                >
                    {SampleBody}
                </FloatingWindow>
            )}
        </div>
    )
}

/** Two stacked windows: the topmost carries the active border. */
export const Stacked: Story = {
    parameters: { controls: { disable: true } },
    render: () => <StackedWindowsDemo />,
}
