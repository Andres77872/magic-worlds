import type { Meta, StoryObj } from '@storybook/react-vite'
import type { ComponentProps } from 'react'
import { useState } from 'react'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import { Toast } from './Toast'
import { Button } from './Button'

const meta = {
  title: 'Primitives/Toast',
  component: Toast,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Floating, self-dismissing notice for short action feedback. Portals to the bottom-right at the toast z-rung (z-[110]). `success` reads verdant and confirms politely; `error` reads blood and announces assertively. Auto-closes after `autoCloseMs`, or stays until dismissed when set to `false`.',
      },
    },
  },
  argTypes: {
    tone: {
      control: 'inline-radio',
      options: ['success', 'error'],
      description: '`success` = verdant confirmation · `error` = blood warning (assertive live region).',
    },
    title: { control: 'text' },
    message: { control: 'text' },
    autoCloseMs: { control: false, description: 'Milliseconds before auto-dismiss, or `false` to stay until closed.' },
    open: { control: false },
    onClose: { control: false },
  },
  args: {
    tone: 'success',
    title: 'Changes saved',
    message: 'Your character was updated.',
    autoCloseMs: false,
    open: false,
    onClose: () => {},
  },
} satisfies Meta<typeof Toast>

export default meta
type Story = StoryObj<typeof meta>

/** Click to raise the toast; it docks bottom-right and stays until dismissed. */
function ToastDemo(props: Partial<ComponentProps<typeof Toast>>) {
  const [open, setOpen] = useState(false)
  const { onClose, ...rest } = props
  return (
    <>
      <Button onClick={() => setOpen(true)}>Show notice</Button>
      <Toast
        tone="success"
        title="Changes saved"
        {...rest}
        open={open}
        onClose={() => {
          setOpen(false)
          onClose?.()
        }}
      />
    </>
  )
}

export const Success: Story = {
  args: { onClose: fn() },
  render: (args) => <ToastDemo {...args} />,
  // The toast portals to document.body, so query the whole document, not just
  // the story canvas. Raise it, dismiss it, and assert onClose fired + it left.
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(await canvas.findByRole('button', { name: 'Show notice' }))
    const body = within(document.body)
    const dismiss = await body.findByRole('button', { name: /dismiss/i })
    await userEvent.click(dismiss)
    await expect(args.onClose).toHaveBeenCalled()
    await waitFor(() => expect(body.queryByRole('status')).not.toBeInTheDocument())
  },
}

export const Error: Story = {
  args: {
    tone: 'error',
    title: 'Could not save',
    message: 'The service is unavailable — try again shortly.',
  },
  render: (args) => <ToastDemo {...args} />,
}
