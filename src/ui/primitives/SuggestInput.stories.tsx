import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Field } from './Field'
import { SuggestInput } from './SuggestInput'
import type { SelectOption } from './Select'

const meta = {
  title: 'Primitives/SuggestInput',
  component: SuggestInput,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'A creatable combobox: a normal text input whose value is always free text, with a portal listbox of described suggestions. Used where examples should teach a field (race, genre, item type) without constraining it. Keyboard: arrows highlight, Enter commits, Esc dismisses; typing filters.',
      },
    },
  },
  decorators: [(Story) => <div className="w-80"><Story /></div>],
} satisfies Meta<typeof SuggestInput>

export default meta
type Story = StoryObj<typeof meta>

const RACES: SelectOption[] = [
  { value: 'Human', label: 'Human', description: 'Adaptable and ambitious; found at every table and every war.' },
  { value: 'Elf', label: 'Elf', description: 'Long-lived and graceful, with memories older than kingdoms.' },
  { value: 'Dwarf', label: 'Dwarf', description: 'Stone-steady artisans who forget nothing — especially debts.' },
  { value: 'Tiefling', label: 'Tiefling', description: "Mortals marked by an old infernal bargain they didn't sign." },
  { value: 'Android / Construct', label: 'Android / Construct', description: 'A built mind discovering what it wants.' },
]

function ControlledSuggest(props: Omit<Parameters<typeof SuggestInput>[0], 'value' | 'onChange'> & { initial?: string }) {
  const { initial, ...rest } = props
  const [value, setValue] = useState(initial ?? '')
  return <SuggestInput {...rest} value={value} onChange={setValue} />
}

export const Basic: Story = {
  args: { options: RACES, value: '', onChange: () => {}, placeholder: 'e.g. Elf, Human, Construct' },
  render: (args) => <ControlledSuggest options={args.options} placeholder={args.placeholder} />,
}

export const Prefilled: Story = {
  args: { options: RACES, value: 'Elf', onChange: () => {} },
  render: (args) => <ControlledSuggest options={args.options} initial="Elf" />,
}

export const InsideField: Story = {
  args: { options: RACES, value: '', onChange: () => {} },
  render: (args) => (
    <Field label="Race / Species" helper="Pick a suggestion or invent your own — free text is always valid.">
      <ControlledSuggest options={args.options} placeholder="e.g. Elf, Human, Construct" />
    </Field>
  ),
}

export const Disabled: Story = {
  args: { options: RACES, value: 'Dwarf', onChange: () => {}, disabled: true },
}
