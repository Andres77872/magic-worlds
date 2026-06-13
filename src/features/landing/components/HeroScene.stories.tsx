import type { Meta, StoryObj } from '@storybook/react-vite'
import { Play, Wand2 } from 'lucide-react'
import { HeroScene } from './HeroScene'

const meta = {
  title: 'Landing/HeroScene',
  component: HeroScene,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: { description: { component: "The dashboard's cinematic opener — resume CTA for the freshest session (continue mode) or the featured adventure template (begin mode), with artwork blur-bleed or the seeded-gradient + monogram fallback." } },
  },
  decorators: [(Story) => <div className="w-[1100px] max-w-full"><Story /></div>],
  argTypes: {
    mode: { control: 'radio', options: ['continue', 'begin'] },
    primary: { control: false },
    secondary: { control: false },
  },
  args: {
    mode: 'continue' as const,
    eyebrow: 'Tonight · The Hollow Wood',
    title: 'The Tavern at the Edge of Sleep',
    snippet: 'Rain taps the leaded glass as a hooded figure slides a damp envelope across your table.',
    seed: 'The Tavern at the Edge of Sleep',
    monogram: 'T',
    meta: '14 turns · 2 hr. ago',
    tags: ['Mystery', 'Folk'],
    primary: { label: 'Continue the tale', icon: Play, onClick: () => {} },
    secondary: { label: 'Begin something new', onClick: () => {} },
  },
} satisfies Meta<typeof HeroScene>

export default meta
type Story = StoryObj<typeof meta>

export const Continue: Story = {}

export const Begin: Story = {
  args: {
    mode: 'begin',
    eyebrow: 'Featured adventure · The Ember Coast',
    title: 'A Letter Never Sent',
    description: 'A florist with a stubborn streak presses an unsent letter into your hands — deliver it before the last ferry leaves.',
    snippet: undefined,
    meta: undefined,
    primary: { label: 'Begin adventure', icon: Wand2, onClick: () => {} },
    secondary: { label: 'View all adventures', onClick: () => {} },
  },
}
