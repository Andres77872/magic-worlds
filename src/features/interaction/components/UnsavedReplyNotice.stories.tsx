import type { Meta, StoryObj } from '@storybook/react-vite'
import { UnsavedReplyNotice } from './UnsavedReplyNotice'

const meta = {
  title: 'Interaction/UnsavedReplyNotice',
  component: UnsavedReplyNotice,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Stands in for a reply that never became part of the conversation. Failed and stopped replies are stored empty and never reach the model, so the transcript shows this notice instead of a message; Try again replaces it with a fresh reply.',
      },
    },
  },
  argTypes: {
    reason: { control: 'inline-radio', options: ['failed', 'stopped'] },
    detail: { control: 'text', description: 'A specific explanation from the failed request.' },
    retrying: { control: 'boolean' },
    onRetry: { action: 'retry' },
  },
  args: { reason: 'failed', aiLabel: 'Kai', retrying: false },
} satisfies Meta<typeof UnsavedReplyNotice>

export default meta
type Story = StoryObj<typeof meta>

export const Failed: Story = {}
export const Stopped: Story = { args: { reason: 'stopped' } }
export const WithDetail: Story = {
  args: { detail: 'The model could not complete this request. Try again to start a new request.' },
}
export const Retrying: Story = { args: { retrying: true } }
