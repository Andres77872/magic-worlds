import type { Meta, StoryObj } from '@storybook/react-vite'
import { BookOpen } from 'lucide-react'
import { IconButton } from './IconButton'
import { Tooltip } from './Tooltip'

const meta = {
  title: 'Primitives/Tooltip',
  component: Tooltip,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Portaled visual labels for collapsed icon controls. The trigger keeps its own aria-label and title; the tooltip handles hover and focus layering.',
      },
    },
  },
  argTypes: {
    label: { control: 'text', description: 'Visible tooltip text.' },
    disabled: { control: 'boolean' },
    placement: { control: 'inline-radio', options: ['right'] },
    wrapperClassName: { control: false },
    children: { control: false },
  },
  args: {
    label: 'Open lorebook',
    disabled: false,
    placement: 'right',
    children: (
      <IconButton label="Open lorebook">
        <BookOpen size={18} strokeWidth={1.75} />
      </IconButton>
    ),
  },
} satisfies Meta<typeof Tooltip>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Disabled: Story = {
  args: { disabled: true },
}
