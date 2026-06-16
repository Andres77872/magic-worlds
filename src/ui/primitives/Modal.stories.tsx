import type { Meta, StoryObj } from '@storybook/react-vite'
import type { ComponentProps } from 'react'
import { useState } from 'react'
import { Modal } from './Modal'
import { Button } from './Button'

const meta = {
  title: 'Primitives/Modal',
  component: Modal,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Centered dialog over a dimmed + blurred scrim. Optional display-serif header (with close) and a footer action bar. Click the scrim or the close button to dismiss. Controlled via `open` / `onClose`.',
      },
    },
  },
  argTypes: {
    size: { control: 'inline-radio', options: ['sm', 'md', 'lg'] },
    showClose: { control: 'boolean' },
    title: { control: 'text' },
    open: { control: false },
    onClose: { control: false },
    icon: { control: false },
    footer: { control: false },
    children: { control: false },
  },
  // open/onClose/children are required on Modal but are driven by ModalDemo's
  // local state / render; these defaults just satisfy the args type.
  args: {
    size: 'md',
    showClose: true,
    title: 'Keep the story going',
    open: false,
    onClose: () => {},
    children: undefined,
  },
} satisfies Meta<typeof Modal>

export default meta
type Story = StoryObj<typeof meta>

/** Stories render a trigger button; the modal opens into its own scrim. */
function ModalDemo(props: Partial<ComponentProps<typeof Modal>>) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button onClick={() => setOpen(true)}>Open modal</Button>
      <Modal
        title="Keep the story going"
        {...props}
        open={open}
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Not now</Button>
            <Button variant="primary" onClick={() => setOpen(false)}>Continue</Button>
          </>
        }
      >
        {props.children ?? (
          <p className="font-narrative text-[15px] leading-relaxed text-parchment-200">
            You&rsquo;ve reached the end of this chapter. Step through to keep playing —
            your companions are waiting just beyond the door.
          </p>
        )}
      </Modal>
    </>
  )
}

export const Default: Story = {
  render: (args) => <ModalDemo {...args} />,
}

export const Small: Story = {
  args: { size: 'sm', title: 'Leave this scene?' },
  render: (args) => <ModalDemo {...args} />,
}

export const NoHeader: Story = {
  args: { title: undefined, showClose: false },
  render: (args) => <ModalDemo {...args} />,
}
