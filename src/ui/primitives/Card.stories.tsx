import type { Meta, StoryObj } from '@storybook/react-vite'
import { Card } from './Card'

const meta = {
  title: 'Primitives/Card',
  component: Card,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'The base raised surface (`ink-700`, hairline border, soft elevation). Set `interactive` for clickable cards — adds the candlelight hover-lift + ember glow.',
      },
    },
  },
  argTypes: {
    interactive: {
      control: 'boolean',
      description: 'Adds the hover-lift + ember glow for clickable cards.',
    },
  },
  args: { interactive: false },
} satisfies Meta<typeof Card>

export default meta
type Story = StoryObj<typeof meta>

function SampleContent() {
  return (
    <div className="w-72 p-5">
      <h4 className="font-display text-[20px] font-semibold text-parchment-50">The Sunken Library</h4>
      <p className="mt-1.5 font-narrative text-[15px] leading-relaxed text-parchment-200">
        A drowned archive where every book remembers being read.
      </p>
    </div>
  )
}

export const Default: Story = {
  render: (args) => (
    <Card {...args}>
      <SampleContent />
    </Card>
  ),
}

export const Interactive: Story = {
  args: { interactive: true },
  render: (args) => (
    <Card {...args}>
      <SampleContent />
    </Card>
  ),
}
