import type { Meta, StoryObj } from '@storybook/react-vite'
import type { ComponentProps } from 'react'
import { useState } from 'react'
import { CreatorField, CreatorInput } from './CreatorField'

const meta = {
  title: 'Creation/CreatorField',
  component: CreatorField,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: { description: { component: 'Labelled form field for creators (wraps the Field primitive). Optional required marker, inline helper (tooltip), and an error that takes priority over the helper.' } },
  },
  decorators: [(Story) => <div className="w-[420px] max-w-full"><Story /></div>],
  argTypes: {
    label: { control: 'text' },
    required: { control: 'boolean' },
    tooltip: { control: 'text' },
    error: { control: 'text' },
    htmlFor: { control: false },
    children: { control: false },
  },
  args: {
    label: 'Character name',
    required: true,
    tooltip: 'The name your companions will call you.',
    children: <CreatorInput value="" onChange={() => {}} />,
  },
} satisfies Meta<typeof CreatorField>

export default meta
type Story = StoryObj<typeof meta>

function FieldDemo(args: ComponentProps<typeof CreatorField>) {
  const [value, setValue] = useState('')
  return (
    <CreatorField {...args}>
      <CreatorInput value={value} onChange={setValue} placeholder="e.g. Lyra Dawnwhisper" />
    </CreatorField>
  )
}

export const Default: Story = { render: (args) => <FieldDemo {...args} /> }
export const WithError: Story = {
  args: { error: 'A name is required to begin.' },
  render: (args) => <FieldDemo {...args} />,
}
