import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'
import { Field, Input, Textarea } from './Field'
import { Select } from './Select'

const meta = {
  title: 'Primitives/Field',
  component: Field,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Form field wrapper: a label above a control, with optional `helper` text or an `error` (error replaces helper and turns blood-red). Wrap `Input`, `Textarea`, or `Select` — all share the ember focus ring.',
      },
    },
  },
  decorators: [(Story) => <div className="w-80"><Story /></div>],
  argTypes: {
    label: { control: 'text' },
    helper: { control: 'text' },
    error: { control: 'text' },
  },
  // `children` is required on Field and is supplied per-story via `render`;
  // this default just satisfies the args type.
  args: { label: 'Character name', children: <Input placeholder="Type here…" /> },
} satisfies Meta<typeof Field>

export default meta
type Story = StoryObj<typeof meta>

export const WithInput: Story = {
  args: { label: 'Character name', helper: 'The name your companions will call you.' },
  render: (args) => (
    <Field {...args}>
      <Input placeholder="e.g. Lyra Dawnwhisper" />
    </Field>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const input = await canvas.findByRole('textbox', { name: 'Character name' })
    await userEvent.type(input, 'Lyra Dawnwhisper')
    await expect(input).toHaveValue('Lyra Dawnwhisper')
  },
}

export const WithError: Story = {
  args: { label: 'Character name', error: 'A name is required to begin.' },
  render: (args) => (
    <Field {...args}>
      <Input placeholder="e.g. Lyra Dawnwhisper" />
    </Field>
  ),
}

export const WithTextarea: Story = {
  args: { label: 'Backstory', helper: 'A few sentences set the scene.' },
  render: (args) => (
    <Field {...args}>
      <Textarea placeholder="Born under a falling star…" />
    </Field>
  ),
}

export const WithSelect: Story = {
  args: { label: 'Alignment' },
  render: function Render(args) {
    const [value, setValue] = useState('cg')
    return (
      <Field {...args}>
        <Select
          value={value}
          onChange={setValue}
          options={[
            { value: 'lg', label: 'Lawful good' },
            { value: 'cg', label: 'Chaotic good' },
            { value: 'tn', label: 'True neutral' },
          ]}
        />
      </Field>
    )
  },
}
