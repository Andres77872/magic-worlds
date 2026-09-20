import type { Meta, StoryObj } from '@storybook/react-vite'
import { ForwardOptions } from './ForwardOptions'

const meta = {
  title: 'Interaction/ForwardOptions',
  component: ForwardOptions,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: { description: { component: 'AI-suggested next actions form a quiet list below a reply. Picking an option inserts its full message into the composer for editing before sending. Renders nothing unless there are options.' } },
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

/** Long suggestions wrap within a narrow transcript and retain a full row target. */
export const NarrowWithLongReplies: Story = {
  decorators: [(Story) => <div className="w-64 max-w-full"><Story /></div>],
  args: {
    options: [
      { label: 'Ask the courier why the old library has been locked since the winter festival', message: 'Why has the old library stayed locked since the winter festival?' },
      { label: 'Open the envelope', message: 'Open the envelope carefully.' },
    ],
  },
}

/** With no options, the component renders nothing. */
export const Empty: Story = { args: { options: [] } }
