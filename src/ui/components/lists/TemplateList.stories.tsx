import type { Meta, StoryObj } from '@storybook/react-vite'
import { TemplateList } from './TemplateList'
import { templates } from './fixtures'

const meta = {
  title: 'Components/Lists/TemplateList',
  component: TemplateList,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: { description: { component: 'Adventure templates ready to start: start/edit/delete actions, a status badge, the cast, and an opening-line excerpt.' } },
  },
  decorators: [(Story) => <div style={{ maxWidth: 1040, margin: '0 auto' }}><Story /></div>],
  argTypes: {
    templates: { control: false },
    onStart: { control: false },
    onDelete: { control: false },
    onEdit: { control: false },
    loading: { control: 'boolean' },
  },
  args: { templates, loading: false, onStart: () => {}, onDelete: async () => {}, onEdit: () => {} },
} satisfies Meta<typeof TemplateList>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Loading: Story = { args: { loading: true } }
export const Empty: Story = { args: { templates: [] } }
