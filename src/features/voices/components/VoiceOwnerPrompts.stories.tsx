import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { VOICE_KEY_MAREN } from '../fixtures'
import { VoiceBadges } from './VoiceBadges'
import { VoiceOwnerPrompts } from './VoiceOwnerPrompts'

const MAREN = { voice_key: VOICE_KEY_MAREN, display_name: 'Maren' }

const meta = {
    title: 'Voices/VoiceOwnerPrompts',
    component: VoiceOwnerPrompts,
    tags: ['autodocs'],
    parameters: {
        layout: 'padded',
        docs: {
            description: {
                component:
                    'One-click prompts for the owner of a voice, shown next to its badges (R1): a leaving voice offers "Switch to" its replacement (the recipe is kept), a voice that needs re-selection offers "Choose a voice" or "Keep for now", and a retired voice offers "Pick another". A prompt shows only when the host can act on it, so read-only rows show none.',
            },
        },
    },
    argTypes: {
        badges: { control: 'check', options: ['leaving', 'needs_reselect', 'retired', 'review'] },
        replacement: { control: 'object' },
        busy: { control: 'boolean' },
        disabled: { control: 'boolean' },
        onSwitch: { control: false },
        onChoose: { control: false },
        className: { control: false },
    },
    args: {
        badges: ['leaving'],
        replacement: MAREN,
        onSwitch: fn(),
        onChoose: fn(),
    },
} satisfies Meta<typeof VoiceOwnerPrompts>

export default meta
type Story = StoryObj<typeof meta>

/** A leaving voice: "Switch to Maren". */
export const Leaving: Story = {}

/** The switch is being saved. */
export const Switching: Story = {
    args: { busy: true },
}

/** "Choose a voice" opens the picker; "Keep for now" closes the prompt and the badge stays. */
export const NeedsReselect: Story = {
    args: { badges: ['needs_reselect'], replacement: null },
}

export const Retired: Story = {
    args: { badges: ['retired'], replacement: null },
}

/** The prompts under the badges they answer, as the Studio card and the preset editor show them. */
export const WithBadges: Story = {
    parameters: { controls: { disable: true } },
    render: (args) => (
        <ul className="flex flex-col gap-4">
            {([['leaving'], ['needs_reselect'], ['retired']] as const).map((badges) => (
                <li key={badges[0]} className="flex flex-col gap-1.5 border-l-2 border-arcane-500/30 py-2 pl-3">
                    <p className="font-ui text-sm font-semibold text-parchment-50">Sela</p>
                    <VoiceBadges badges={[...badges]} context={{ date: '2026-12-01T00:00:00Z', name: 'Maren', original: 'Sela' }} />
                    <VoiceOwnerPrompts badges={[...badges]} replacement={MAREN} onSwitch={args.onSwitch} onChoose={args.onChoose} />
                </li>
            ))}
        </ul>
    ),
}
