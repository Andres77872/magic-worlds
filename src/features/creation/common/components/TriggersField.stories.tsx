import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { TriggersField } from './TriggersField'

const meta = {
  title: 'Creation/TriggersField',
  component: TriggersField,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: { description: { component: 'Chip editor for trigger keywords — the words that pull a card into the scene when mentioned in chat. Press Enter or comma to add; Backspace on an empty input removes the last; duplicates are folded case-insensitively.' } },
  },
  decorators: [(Story) => <div className="w-[520px] max-w-full"><Story /></div>],
  argTypes: {
    values: { control: false },
    onChange: { control: false },
    label: { control: 'text' },
    helper: { control: 'text' },
    placeholder: { control: 'text' },
  },
  args: { values: [], onChange: () => {} },
} satisfies Meta<typeof TriggersField>

export default meta
type Story = StoryObj<typeof meta>

function Demo() {
  const [values, setValues] = useState<string[]>(['wizard', 'ancient ruins'])
  return <TriggersField values={values} onChange={setValues} />
}

export const Default: Story = { render: () => <Demo /> }
