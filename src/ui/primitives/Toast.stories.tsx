import type { Meta, StoryObj } from '@storybook/react-vite'
import type { ComponentProps } from 'react'
import { useState } from 'react'
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
  return (
    <>
      <Button onClick={() => setOpen(true)}>Show notice</Button>
      <Toast tone="success" title="Changes saved" {...props} open={open} onClose={() => setOpen(false)} />
    </>
  )
}

export const Success: Story = {
  render: (args) => <ToastDemo {...args} />,
}

export const Error: Story = {
  args: {
    tone: 'error',
    title: 'Could not save',
    message: 'The service is unavailable — try again shortly.',
  },
  render: (args) => <ToastDemo {...args} />,
}
