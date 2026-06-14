import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { PresetRecipeControls } from './PresetRecipeControls'
import { DEFAULT_RECIPE, type PresetRecipe } from '../recipe'

const meta = {
    title: 'Voices/PresetRecipeControls',
    component: PresetRecipeControls,
    tags: ['autodocs'],
    parameters: {
        layout: 'centered',
        docs: {
            description: {
                component: 'The tunable part of a voice preset — speed / volume / pitch sliders plus emotion & language-boost selects.',
            },
        },
    },
    decorators: [
        (Story) => (
            <div className="w-[460px] rounded-xl border border-parchment-50/10 bg-ink-800 p-5">
                <Story />
            </div>
        ),
    ],
    args: {
        recipe: DEFAULT_RECIPE,
        onChange: () => undefined,
    },
} satisfies Meta<typeof PresetRecipeControls>

export default meta
type Story = StoryObj<typeof meta>

function Interactive() {
    const [recipe, setRecipe] = useState<PresetRecipe>({ ...DEFAULT_RECIPE, speed: 1.1, pitch: 4, emotion: 'happy' })
    return <PresetRecipeControls recipe={recipe} onChange={(patch) => setRecipe((current) => ({ ...current, ...patch }))} />
}

export const Default: Story = {
    render: () => <Interactive />,
}
