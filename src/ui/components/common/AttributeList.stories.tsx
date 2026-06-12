import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { AttributeList } from './AttributeList'
import type { Attribute, AttributeCategory } from './AttributeList'

const meta = {
  title: 'Components/AttributeList',
  component: AttributeList,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: { description: { component: 'Editable group of key/value attributes for a character/world/adventure. Add, edit, and remove rows; deleting a non-empty category asks for confirmation. Fully controlled — the story below wires up local state.' } },
  },
  decorators: [(Story) => <div className="w-[640px]"><Story /></div>],
  argTypes: {
    isDeletable: { control: 'boolean' },
    valueIsTextarea: { control: 'boolean' },
    category: { control: false },
    attributes: { control: false },
    onAddAttribute: { control: false },
    onUpdateAttribute: { control: false },
    onRemoveAttribute: { control: false },
    onDeleteCategory: { control: false },
  },
  args: {
    category: { id: 'stats', name: 'Stats', type: 'stat', description: 'Core abilities that shape how scenes resolve.' },
    attributes: [],
    isDeletable: false,
    valueIsTextarea: false,
    onAddAttribute: () => {},
    onUpdateAttribute: () => {},
    onRemoveAttribute: () => {},
  },
} satisfies Meta<typeof AttributeList>

export default meta
type Story = StoryObj<typeof meta>

function AttributeListDemo({ isDeletable = false, valueIsTextarea = false }: { isDeletable?: boolean; valueIsTextarea?: boolean }) {
  const category: AttributeCategory = {
    id: 'stats',
    name: 'Stats',
    type: 'stat',
    description: 'Core abilities that shape how scenes resolve.',
  }
  const [attributes, setAttributes] = useState<Attribute[]>([
    { key: 'Strength', value: '18' },
    { key: 'Dexterity', value: '14' },
  ])
  return (
    <AttributeList
      category={category}
      attributes={attributes}
      isDeletable={isDeletable}
      valueIsTextarea={valueIsTextarea}
      onDeleteCategory={() => {}}
      onAddAttribute={() => setAttributes((a) => [...a, { key: '', value: '' }])}
      onUpdateAttribute={(i, field, value) =>
        setAttributes((a) => a.map((attr, idx) => (idx === i ? { ...attr, [field]: value } : attr)))
      }
      onRemoveAttribute={(i) => setAttributes((a) => a.filter((_, idx) => idx !== i))}
    />
  )
}

export const Editable: Story = {
  render: (args) => <AttributeListDemo isDeletable={args.isDeletable} valueIsTextarea={args.valueIsTextarea} />,
}

export const Deletable: Story = {
  args: { isDeletable: true },
  render: (args) => <AttributeListDemo isDeletable={args.isDeletable} valueIsTextarea={args.valueIsTextarea} />,
}
