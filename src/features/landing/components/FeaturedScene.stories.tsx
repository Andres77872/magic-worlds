import type { Meta, StoryObj } from '@storybook/react-vite'
import { FeaturedScene } from './FeaturedScene'

const meta = {
  title: 'Landing/FeaturedScene',
  component: FeaturedScene,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: { description: { component: 'The spotlight scene atop the gallery — a warm seeded gradient, a giant faded monogram, and a single primary action.' } },
  },
  decorators: [(Story) => <div className="w-[920px] max-w-full"><Story /></div>],
  argTypes: {
    eyebrow: { control: 'text' },
    title: { control: 'text' },
    description: { control: 'text' },
    monogram: { control: 'text' },
    seed: { control: 'text' },
    actionLabel: { control: 'text' },
    onAction: { control: false },
    actionIcon: { control: false },
  },
  args: {
    eyebrow: 'Featured tonight',
    title: 'The Tavern at the Edge of Sleep',
    description: 'Rain taps the leaded glass as a hooded figure slides a damp envelope across your table. Inside: a name you buried years ago.',
    monogram: 'T',
    seed: 'The Tavern at the Edge of Sleep',
    actionLabel: 'Begin adventure',
    onAction: () => {},
  },
} satisfies Meta<typeof FeaturedScene>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
