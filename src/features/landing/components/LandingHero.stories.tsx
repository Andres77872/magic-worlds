import type { Meta, StoryObj } from '@storybook/react-vite'
import { Compass, Feather } from 'lucide-react'
import { LandingHero } from './LandingHero'

const meta = {
  title: 'Landing/LandingHero',
  component: LandingHero,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: { description: { component: 'The marketing front-door: eyebrow + display headline + narrative subtitle + dual CTAs, with the tilted HeroPreviewCard and candlelight glows. Renders the page\'s single h1 in guest mode.' } },
  },
  argTypes: {
    eyebrow: { control: 'text' },
    title: { control: 'text' },
    subtitle: { control: 'text' },
    stat: { control: 'text' },
    primary: { control: false },
    secondary: { control: false },
  },
  args: {
    eyebrow: 'Worlds that talk back',
    title: 'Step into a story that answers.',
    subtitle: 'Pick a character, set the scene, and play it out — the world remembers what you do.',
    primary: { label: 'Begin an adventure', icon: Feather, onClick: () => {} },
    secondary: { label: 'See how it works', icon: Compass, onClick: () => {} },
    stat: 'A few worlds to start — bring your own next.',
  },
} satisfies Meta<typeof LandingHero>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const PrimaryOnly: Story = { args: { secondary: undefined, stat: undefined } }
