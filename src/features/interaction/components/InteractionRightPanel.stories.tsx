import type { Meta, StoryObj } from '@storybook/react-vite'
import type { TurnEntry } from '../../../shared'
import { adventures } from '@/ui/components/lists/fixtures'
import { InteractionRightPanel } from './InteractionRightPanel'

const log: TurnEntry[] = [
  { id: 'l1', type: 'user', content: 'I take the seat across from her and keep my hood up.', timestamp: '2026-06-06T21:46:00Z' },
  { id: 'l2', type: 'ai', content: 'She slides a damp envelope across the table. "Read it here," she says.', timestamp: '2026-06-06T21:47:00Z' },
]

const meta = {
  title: 'Interaction/InteractionRightPanel',
  component: InteractionRightPanel,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: { description: { component: 'The right rail: quick actions (dice, save), a scrollable adventure log, and session settings.' } },
  },
  decorators: [(Story) => <div className="w-[360px] max-w-full"><Story /></div>],
  argTypes: {
    adventure: { control: false },
    turns: { control: false },
  },
  args: { adventure: adventures[0], turns: log },
} satisfies Meta<typeof InteractionRightPanel>

export default meta
type Story = StoryObj<typeof meta>

export const WithLog: Story = {}
export const EmptyLog: Story = { args: { turns: [] } }
