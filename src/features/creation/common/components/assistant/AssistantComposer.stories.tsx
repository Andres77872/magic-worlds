import type { Meta, StoryObj } from '@storybook/react-vite'
import { AssistantComposer } from './AssistantComposer'

const meta = {
  title: 'Creation/Assistant/Composer',
  component: AssistantComposer,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'The assistant input band. Enter sends, Shift+Enter breaks the line, and a character counter appears near the 4000-char limit. While a reply streams, the ember Send square swaps for a blood-tinted **Stop**. Deliberately not a `<form>` — swapping Stop back to a `type=submit` button mid-click fires a phantom submit under React 19\'s synchronous discrete-event commits.',
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="w-[400px] overflow-hidden rounded-xl border border-parchment-50/10 bg-ink-800">
        <Story />
      </div>
    ),
  ],
  argTypes: {
    onSend: { control: false },
    onStop: { control: false },
  },
  args: {
    streaming: false,
    disabled: false,
    onSend: () => {},
    onStop: () => {},
  },
} satisfies Meta<typeof AssistantComposer>

export default meta
type Story = StoryObj<typeof meta>

/** Ready to send — type and press Enter, or click the ember square. */
export const Default: Story = {}

/** A reply is streaming: Send becomes Stop, typing stays available for the next ask. */
export const Streaming: Story = {
  args: { streaming: true },
}

/** Disabled while a conversation switch is loading. */
export const Disabled: Story = {
  args: { disabled: true },
}
