import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import type { VoiceSettingsV2 } from '@/shared'
import { surfaceCapabilitiesFor } from '@/shared/voice'
import { CAPABILITIES_EL_PRO } from '../fixtures'
import { RecipeControlsV2 } from './RecipeControlsV2'

const STANDARD = surfaceCapabilitiesFor(CAPABILITIES_EL_PRO, 'preview', 'standard')
const EXPRESSIVE = surfaceCapabilitiesFor(CAPABILITIES_EL_PRO, 'preview', 'expressive')
const TUNED: VoiceSettingsV2 = { stability: 0.4, similarity_boost: 0.8, speed: 1.1 }

const meta = {
    title: 'Voices/RecipeControls',
    component: RecipeControlsV2,
    tags: ['autodocs'],
    parameters: {
        layout: 'padded',
        docs: {
            description: {
                component:
                    'The tunable part of a preset for the new voices (R1): stability, similarity and speed sliders whose ranges, steps and defaults come from the server’s capabilities, never from the page. Stability and similarity name their ends ("More expressive" ↔ "More consistent", "Looser" ↔ "Closer to the voice") and speed reads as a multiple ("1.05×"). Expressive narration has no speed control (the stored speed is kept), and without capabilities the recipe is shown read-only with a retry. A stored value outside the range is shown clamped with a warning flag that says what saving will store.',
            },
        },
    },
    decorators: [(Story) => <div className="max-w-md rounded-xl border border-line-faint bg-ink-800 p-5"><Story /></div>],
    argTypes: {
        surface: { control: false },
        settings: { control: 'object' },
        disabled: { control: 'boolean' },
        onChange: { control: false },
        onRetry: { control: false },
        writeControls: { control: false },
        className: { control: false },
    },
    args: {
        surface: STANDARD,
        settings: TUNED,
        onChange: fn(),
    },
} satisfies Meta<typeof RecipeControlsV2>

export default meta
type Story = StoryObj<typeof meta>

/** Holds the recipe so the sliders move; "Use voice defaults" clears it. */
function Interactive({ surface, initial }: { surface: typeof STANDARD; initial: VoiceSettingsV2 | null }) {
    const [settings, setSettings] = useState<VoiceSettingsV2 | null>(initial)
    return (
        <div className="flex flex-col gap-3">
            <RecipeControlsV2 surface={surface} settings={settings} onChange={setSettings} />
            <code className="font-mono text-caption text-fg-subtle">{JSON.stringify(settings)}</code>
        </div>
    )
}

export const Standard: Story = {
    render: (args) => <Interactive surface={args.surface} initial={args.settings} />,
}

/** No speed control: the note explains why, and the stored speed survives every change. */
export const Expressive: Story = {
    args: { surface: EXPRESSIVE },
    render: (args) => <Interactive surface={args.surface} initial={args.settings} />,
}

/** Capabilities could not be read: the recipe as chips, and a retry. */
export const Unavailable: Story = {
    args: { surface: null, onRetry: fn() },
}

export const Disabled: Story = {
    args: { disabled: true },
}

/** A stored speed outside 0.70–1.20: the slider shows 1.20× and the flag says saving stores it. */
export const OutOfRange: Story = {
    args: { settings: { stability: 0.4, similarity_boost: 0.8, speed: 1.45 } },
    render: (args) => <Interactive surface={args.surface} initial={args.settings} />,
}

/** On Expressive the speed has no slider, but the save still clamps it, so the flag sits under the speed note. */
export const OutOfRangeHidden: Story = {
    args: { surface: EXPRESSIVE, settings: { stability: 0.4, speed: 1.45 }, writeControls: [...(STANDARD?.controls ?? []), ...(EXPRESSIVE?.controls ?? [])] },
}
