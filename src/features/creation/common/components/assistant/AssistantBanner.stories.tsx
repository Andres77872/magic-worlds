import type { Meta, StoryObj } from '@storybook/react-vite'
import { AssistantBanner } from './AssistantBanner'

const meta = {
  title: 'Creation/Assistant/Banner',
  component: AssistantBanner,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'The error/info strip above the composer. Errors are blood-tinted, info amber. `canRetry` re-sends the last message; `canReload` ("Check conversation") refetches server truth — used after a stop, a local timeout, or a 409 while the server is still finishing a previous turn.',
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
    notice: { control: false },
    onRetry: { control: false },
    onReload: { control: false },
    onDismiss: { control: false },
  },
  args: {
    notice: { kind: 'error', message: 'The assistant is briefly unavailable. Try again in a moment.', canRetry: true },
    onRetry: () => {},
    onReload: () => {},
    onDismiss: () => {},
  },
} satisfies Meta<typeof AssistantBanner>

export default meta
type Story = StoryObj<typeof meta>

/** A retryable failure. */
export const RetryableError: Story = {}

/** The conversation is busy server-side — offer both checking for the reply and retrying. */
export const BusyConversation: Story = {
  args: {
    notice: {
      kind: 'error',
      message: 'The assistant is still finishing a previous request.',
      canRetry: true,
      canReload: true,
    },
  },
}

/** After Stop: an informational notice — the server may still finish and persist the reply. */
export const StoppedInfo: Story = {
  args: {
    notice: {
      kind: 'info',
      message: 'Stopped. The assistant may still finish and save its reply.',
      canReload: true,
    },
  },
}
