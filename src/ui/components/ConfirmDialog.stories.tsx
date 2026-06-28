import type { Meta, StoryObj } from '@storybook/react-vite'
import type { ComponentProps } from 'react'
import { useState } from 'react'
import { ConfirmDialog } from './ConfirmDialog'
import { Button } from '../primitives'

const meta = {
  title: 'Components/ConfirmDialog',
  component: ConfirmDialog,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: { description: { component: 'Confirmation dialog composed from the Modal primitive. `variant="danger"` turns the confirm button blood-red for destructive actions.' } },
  },
  argTypes: {
    variant: { control: 'inline-radio', options: ['primary', 'danger', 'warning'] },
    confirmLabel: { control: 'text' },
    cancelLabel: { control: 'text' },
    isProcessing: { control: 'boolean' },
    title: { control: 'text' },
    message: { control: 'text' },
    visible: { control: false },
    onConfirm: { control: false },
    onCancel: { control: false },
  },
  args: {
    visible: false,
    title: 'Delete character',
    message: 'Are you sure you want to delete Lyra? This action cannot be undone.',
    variant: 'danger',
    confirmLabel: 'Delete',
    cancelLabel: 'Cancel',
    isProcessing: false,
    onConfirm: () => {},
    onCancel: () => {},
  },
} satisfies Meta<typeof ConfirmDialog>

export default meta
type Story = StoryObj<typeof meta>

function ConfirmDemo(args: ComponentProps<typeof ConfirmDialog>) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant={args.variant === 'danger' ? 'danger' : 'primary'} onClick={() => setOpen(true)}>
        {args.title}
      </Button>
      <ConfirmDialog {...args} visible={open} onConfirm={() => setOpen(false)} onCancel={() => setOpen(false)} />
    </>
  )
}

export const Danger: Story = { render: (args) => <ConfirmDemo {...args} /> }

export const Primary: Story = {
  args: {
    variant: 'primary',
    title: 'Publish world',
    message: 'Make "The Sunken Library" visible to other players?',
    confirmLabel: 'Publish',
  },
  render: (args) => <ConfirmDemo {...args} />,
}

export const Processing: Story = {
  args: { isProcessing: true },
  render: (args) => <ConfirmDemo {...args} />,
}
