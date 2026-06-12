import type { Meta, StoryObj } from '@storybook/react-vite'
import { WorldList } from './WorldList'
import { worlds } from './fixtures'

const meta = {
  title: 'Components/Lists/WorldList',
  component: WorldList,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: { description: { component: 'Grid of world cards with edit/delete actions, a description excerpt, and a delete-confirmation dialog.' } },
  },
  decorators: [(Story) => <div style={{ maxWidth: 1040, margin: '0 auto' }}><Story /></div>],
  argTypes: {
    worlds: { control: false },
    onDelete: { control: false },
    onEdit: { control: false },
    loading: { control: 'boolean' },
  },
  args: { worlds, loading: false, onDelete: async () => {}, onEdit: () => {} },
} satisfies Meta<typeof WorldList>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Loading: Story = { args: { loading: true } }
export const Empty: Story = { args: { worlds: [] } }
