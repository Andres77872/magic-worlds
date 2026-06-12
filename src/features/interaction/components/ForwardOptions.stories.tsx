import type { Meta, StoryObj } from '@storybook/react-vite'
import { ForwardOptions } from './ForwardOptions'

const meta = {
  title: 'Interaction/ForwardOptions',
  component: ForwardOptions,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: { description: { component: 'AI-suggested next actions offered after a Game Master turn. Each option shows a short label; picking one submits its full message. Renders nothing unless there are options.' } },
  },
  decorators: [(Story) => <div className="w-[560px] max-w-full"><Story /></div>],
  argTypes: {
    options: { control: false },
    onOptionClick: { control: false },
  },
  args: {
    onOptionClick: () => {},
    options: [
      { label: 'Ask who sent it', message: 'Ask the courier who sent the message.' },
      { label: 'Stay wary', message: 'Keep your hand near your blade and stay alert.' },
      { label: 'Sit down', message: 'Take the seat across from her.' },
    ],
  },
} satisfies Meta<typeof ForwardOptions>

export default meta
type Story = StoryObj<typeof meta>

export const Options: Story = {}

/** With no options, the component renders nothing. */
export const Empty: Story = { args: { options: [] } }
