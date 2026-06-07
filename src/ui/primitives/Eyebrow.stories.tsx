import type { Meta, StoryObj } from '@storybook/react-vite'
import { Eyebrow } from './Eyebrow'

const meta = {
  title: 'Primitives/Eyebrow',
  component: Eyebrow,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: 'Uppercase, letter-spaced section label. Use sparingly above headings. Tones: ember, arcane, muted.',
      },
    },
  },
  argTypes: {
    tone: { control: 'inline-radio', options: ['ember', 'arcane', 'muted'] },
    children: { control: 'text' },
  },
  args: { tone: 'ember', children: 'Featured worlds' },
} satisfies Meta<typeof Eyebrow>

export default meta
type Story = StoryObj<typeof meta>

export const Ember: Story = {}
export const Arcane: Story = { args: { tone: 'arcane', children: 'Powered by AI' } }
export const Muted: Story = { args: { tone: 'muted', children: 'Recently played' } }
