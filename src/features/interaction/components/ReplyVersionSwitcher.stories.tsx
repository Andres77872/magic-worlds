import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { ReplyVersionSwitcher } from './ReplyVersionSwitcher'

const meta = {
  title: 'Interaction/ReplyVersionSwitcher',
  component: ReplyVersionSwitcher,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Steps through the stored versions of the latest reply. Regenerate adds a version instead of replacing the reply; only the version shown is part of the conversation the model sees.',
      },
    },
  },
  argTypes: {
    index: { control: { type: 'number', min: 0 } },
    count: { control: { type: 'number', min: 2 } },
    disabled: { control: 'boolean' },
    onSelect: { action: 'select' },
  },
  args: { index: 1, count: 3, disabled: false, onSelect: () => {} },
} satisfies Meta<typeof ReplyVersionSwitcher>

export default meta
type Story = StoryObj<typeof meta>

export const Middle: Story = {}
export const First: Story = { args: { index: 0 } }
export const Latest: Story = { args: { index: 2 } }
/** While a reply is being written the versions can't change. */
export const Disabled: Story = { args: { disabled: true } }

function InteractiveSwitcher() {
  const [index, setIndex] = useState(2)
  return <ReplyVersionSwitcher index={index} count={3} onSelect={setIndex} />
}

export const Interactive: Story = {
  parameters: { controls: { disable: true } },
  render: () => <InteractiveSwitcher />,
}
