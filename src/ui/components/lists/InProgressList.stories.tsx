import type { Meta, StoryObj } from '@storybook/react-vite'
import { InProgressList } from './InProgressList'
import { adventures } from './fixtures'

const meta = {
  title: 'Components/Lists/InProgressList',
  component: InProgressList,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: { description: { component: 'In-progress adventures: continue/edit/delete actions, a live status badge, the cast, and the last action excerpt.' } },
  },
  decorators: [(Story) => <div style={{ maxWidth: 1040, margin: '0 auto' }}><Story /></div>],
  argTypes: {
    adventures: { control: false },
    onDelete: { control: false },
    onEdit: { control: false },
    onPlay: { control: false },
    loading: { control: 'boolean' },
  },
  args: { adventures, loading: false, onDelete: async () => {}, onEdit: () => {}, onPlay: () => {} },
} satisfies Meta<typeof InProgressList>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Loading: Story = { args: { loading: true } }
export const Empty: Story = { args: { adventures: [] } }
