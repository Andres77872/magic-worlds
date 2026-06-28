import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Field } from './Field'
import { Modal } from './Modal'
import { Button } from './Button'
import { Select, type SelectOption } from './Select'

const meta = {
  title: 'Primitives/Select',
  component: Select,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Themed replacement for the native `<select>`. The trigger shares the form-control look; the option list opens as a dark candlelit popup (body portal, so it survives overflow containers, sticky panes, and Drawer/Modal overlays). Keyboard: arrows, Home/End, Enter/Space, Esc, and type-ahead.',
      },
    },
  },
  decorators: [(Story) => <div className="w-80"><Story /></div>],
} satisfies Meta<typeof Select>

export default meta
type Story = StoryObj<typeof meta>

const ALIGNMENTS: SelectOption[] = [
  { value: 'lg', label: 'Lawful good' },
  { value: 'cg', label: 'Chaotic good' },
  { value: 'tn', label: 'True neutral' },
  { value: 'ce', label: 'Chaotic evil' },
]

const LOGIC_OPTIONS: SelectOption[] = [
  { value: 'any', label: 'Any secondary key', description: 'Any matching secondary key is enough.' },
  { value: 'all', label: 'All secondary keys', description: 'Every secondary key must also match.' },
  { value: 'and_any', label: 'Primary + any secondary', description: 'Requires a primary key plus at least one secondary key.' },
  { value: 'not_any', label: 'Block if any secondary', description: 'Primary match is suppressed when any secondary key appears.' },
]

function ControlledSelect(props: Omit<Parameters<typeof Select>[0], 'value' | 'onChange'> & { initial?: string }) {
  const { initial, ...rest } = props
  const [value, setValue] = useState<string | undefined>(initial)
  return <Select {...rest} value={value} onChange={setValue} />
}

export const Basic: Story = {
  args: { options: ALIGNMENTS, value: 'cg', onChange: () => {} },
  render: (args) => <ControlledSelect options={args.options} initial="cg" />,
}

export const Placeholder: Story = {
  args: { options: ALIGNMENTS, value: undefined, onChange: () => {} },
  render: (args) => <ControlledSelect options={args.options} placeholder="Choose an alignment…" />,
}

export const WithDescriptions: Story = {
  args: { options: LOGIC_OPTIONS, value: 'any', onChange: () => {} },
  render: (args) => <ControlledSelect options={args.options} initial="any" />,
}

export const DisabledOptions: Story = {
  args: {
    options: [
      ALIGNMENTS[0],
      { ...ALIGNMENTS[1], disabled: true },
      ALIGNMENTS[2],
      { ...ALIGNMENTS[3], disabled: true },
    ],
    value: 'lg',
    onChange: () => {},
  },
  render: (args) => <ControlledSelect options={args.options} initial="lg" />,
}

export const LongList: Story = {
  args: {
    options: Array.from({ length: 24 }, (_, i) => ({
      value: `realm-${i + 1}`,
      label: `Realm of the ${['Ember', 'Arcane', 'Verdant', 'Gilded', 'Silent', 'Shattered'][i % 6]} ${['Crown', 'Vale', 'Spire', 'Tide'][i % 4]} ${i + 1}`,
    })),
    value: 'realm-1',
    onChange: () => {},
  },
  render: (args) => <ControlledSelect options={args.options} initial="realm-1" />,
}

export const Sizes: Story = {
  args: { options: ALIGNMENTS, value: 'lg', onChange: () => {} },
  render: (args) => (
    <div className="flex flex-col gap-4">
      <ControlledSelect options={args.options} initial="lg" size="md" />
      <ControlledSelect options={args.options} initial="lg" size="sm" />
    </div>
  ),
}

export const Disabled: Story = {
  args: { options: ALIGNMENTS, value: 'tn', onChange: () => {}, disabled: true },
}

export const InsideField: Story = {
  args: { options: ALIGNMENTS, value: 'cg', onChange: () => {} },
  render: (args) => (
    <Field label="Alignment" helper="Clicking the label focuses the trigger.">
      <ControlledSelect options={args.options} initial="cg" />
    </Field>
  ),
}

export const InsideModal: Story = {
  args: { options: LOGIC_OPTIONS, value: 'any', onChange: () => {} },
  render: (args) => {
    const Demo = () => {
      const [open, setOpen] = useState(false)
      return (
        <>
          <Button variant="secondary" onClick={() => setOpen(true)}>Open modal</Button>
          <Modal open={open} onClose={() => setOpen(false)} title="Layering demo">
            <Field label="Secondary logic" helper="The popup stacks above the modal scrim.">
              <ControlledSelect options={args.options} initial="any" />
            </Field>
          </Modal>
        </>
      )
    }
    return <Demo />
  },
}
