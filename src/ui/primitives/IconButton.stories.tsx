import type { Meta, StoryObj } from '@storybook/react-vite'
import { Heart, Pencil, RefreshCw, Trash2, X } from 'lucide-react'
import { IconButton } from './IconButton'

const meta = {
  title: 'Primitives/IconButton',
  component: IconButton,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Square, icon-only button. `label` is required — it sets both `aria-label` and `title`. Pass a lucide glyph as the child.',
      },
    },
  },
  argTypes: {
    label: { control: 'text', description: 'Accessible name (aria-label + title).' },
    size: { control: 'inline-radio', options: ['sm', 'md', 'lg'] },
    tone: { control: 'inline-radio', options: ['default', 'active', 'danger'] },
    children: { control: false },
    onClick: { action: 'clicked' },
  },
  args: {
    label: 'Edit',
    size: 'md',
    tone: 'default',
    children: <Pencil size={18} strokeWidth={1.75} />,
  },
} satisfies Meta<typeof IconButton>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Active: Story = {
  args: { tone: 'active', label: 'Favorite', children: <Heart size={18} strokeWidth={1.75} /> },
}

export const Danger: Story = {
  args: { tone: 'danger', label: 'Delete', children: <Trash2 size={18} strokeWidth={1.75} /> },
}

export const Sizes: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div className="flex items-center gap-3">
      <IconButton label="Refresh" size="sm"><RefreshCw size={16} strokeWidth={1.75} /></IconButton>
      <IconButton label="Refresh" size="md"><RefreshCw size={18} strokeWidth={1.75} /></IconButton>
      <IconButton label="Refresh" size="lg"><RefreshCw size={20} strokeWidth={1.75} /></IconButton>
    </div>
  ),
}

export const Tones: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div className="flex items-center gap-3">
      <IconButton label="Close" tone="default"><X size={18} strokeWidth={1.75} /></IconButton>
      <IconButton label="Favorite" tone="active"><Heart size={18} strokeWidth={1.75} /></IconButton>
      <IconButton label="Delete" tone="danger"><Trash2 size={18} strokeWidth={1.75} /></IconButton>
    </div>
  ),
}
