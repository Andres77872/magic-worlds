import type { Meta, StoryObj } from '@storybook/react-vite'
import { CharacterList } from './CharacterList'
import { characters } from './fixtures'

const meta = {
  title: 'Components/Lists/CharacterList',
  component: CharacterList,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: { description: { component: 'Grid of character cards with edit/delete actions and a built-in delete-confirmation dialog. Shows an EmptyState when there are none.' } },
  },
  decorators: [(Story) => <div style={{ maxWidth: 1040, margin: '0 auto' }}><Story /></div>],
  argTypes: {
    characters: { control: false },
    onDelete: { control: false },
    onEdit: { control: false },
    loading: { control: 'boolean' },
  },
  args: { characters, loading: false, onDelete: async () => {}, onEdit: () => {} },
} satisfies Meta<typeof CharacterList>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Loading: Story = { args: { loading: true } }
export const Empty: Story = { args: { characters: [] } }
