import type { Meta, StoryObj } from '@storybook/react-vite'
import { HeroPreviewCard } from './HeroPreviewCard'

const meta = {
  title: 'Landing/HeroPreviewCard',
  component: HeroPreviewCard,
  tags: ['autodocs'],
  parameters: {
    docs: { description: { component: 'A tilted, frosted card showing one narrative exchange — italic narration + bright dialogue, then your ember reply. A small taste of a scene, built from primitives.' } },
  },
} satisfies Meta<typeof HeroPreviewCard>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
