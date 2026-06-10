import type { Meta, StoryObj } from '@storybook/react-vite'
import type { TurnEntry } from '../../../shared'
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
    docs: { description: { component: 'The right rail: the scrollable adventure log (turn history with You/GM badges). Progress saves automatically; there is no manual save.' } },
  },
  decorators: [(Story) => <div className="w-[360px] max-w-full"><Story /></div>],
  argTypes: {
    turns: { control: false },
  },
  args: { turns: log },
} satisfies Meta<typeof InteractionRightPanel>

export default meta
type Story = StoryObj<typeof meta>

export const WithLog: Story = {}
export const EmptyLog: Story = { args: { turns: [] } }
