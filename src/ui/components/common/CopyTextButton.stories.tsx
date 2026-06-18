import type { Meta, StoryObj } from '@storybook/react-vite'
import { CopyTextButton } from './CopyTextButton'

const meta = {
  title: 'Components/Common/CopyTextButton',
  component: CopyTextButton,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Icon-only copy affordance for raw text content. It uses the Reverie IconButton surface and swaps to a verdant checkmark after a successful clipboard write.',
      },
    },
  },
  argTypes: {
    text: { control: 'text' },
    size: { control: 'inline-radio', options: ['sm', 'md', 'lg'] },
    disabled: { control: 'boolean' },
    className: { control: false },
    copyLabel: { control: 'text' },
    copiedLabel: { control: 'text' },
    onError: { control: false },
  },
  args: {
    text: 'The Vitrine Expanse waits beneath a sky of polished copper.',
    size: 'sm',
    disabled: false,
  },
} satisfies Meta<typeof CopyTextButton>

export default meta
type Story = StoryObj<typeof meta>

/** Default compact copy control for dense chat toolbars. */
export const Default: Story = {}

/** Disabled state for empty or unavailable copy targets. */
export const Disabled: Story = {
  args: { disabled: true },
}
