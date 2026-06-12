import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import type { AttributeCategory } from '@/ui/components/common/AttributeList'
import { AttributeManager } from './AttributeManager'

type Rows = Record<string, { key: string; value: string }[]>

const meta = {
  title: 'Creation/AttributeManager',
  component: AttributeManager,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: { description: { component: 'Manages attribute categories + their key/value rows for a creator. Add/remove categories and rows; custom categories are deletable. Fully controlled — the story wires up local state.' } },
  },
  decorators: [(Story) => <div className="w-[680px] max-w-full"><Story /></div>],
  argTypes: {
    title: { control: false },
    subtitle: { control: false },
    icon: { control: false },
    categories: { control: false },
    attributes: { control: false },
    onAddCategory: { control: false },
    onDeleteCategory: { control: false },
    onAddAttribute: { control: false },
    onUpdateAttribute: { control: false },
    onRemoveAttribute: { control: false },
  },
  args: {
    title: 'Attributes',
    categories: [],
    attributes: {},
    onAddCategory: () => {},
    onDeleteCategory: () => {},
    onAddAttribute: () => {},
    onUpdateAttribute: () => {},
    onRemoveAttribute: () => {},
  },
} satisfies Meta<typeof AttributeManager>

export default meta
type Story = StoryObj<typeof meta>

function Demo() {
  const [categories, setCategories] = useState<AttributeCategory[]>([
    { id: 'stats', name: 'Stats', type: 'stat', description: 'Core abilities that shape how scenes resolve.' },
  ])
  const [rows, setRows] = useState<Rows>({ stats: [{ key: 'Strength', value: '18' }] })

  return (
    <AttributeManager
      title="Attributes"
      subtitle="Group the details that define this character."
      categories={categories}
      attributes={rows}
      onAddCategory={(name, description) => {
        const id = `cat-${name.toLowerCase().replace(/\s+/g, '-')}`
        setCategories((c) => [...c, { id, name, type: 'custom', description }])
        setRows((r) => ({ ...r, [id]: [] }))
      }}
      onDeleteCategory={(id) => {
        setCategories((c) => c.filter((cat) => cat.id !== id))
        setRows((r) => {
          const next = { ...r }
          delete next[id]
          return next
        })
      }}
      onAddAttribute={(catId) => setRows((r) => ({ ...r, [catId]: [...(r[catId] || []), { key: '', value: '' }] }))}
      onUpdateAttribute={(catId, index, field, value) =>
        setRows((r) => ({
          ...r,
          [catId]: (r[catId] || []).map((row, i) => (i === index ? { ...row, [field]: value } : row)),
        }))
      }
      onRemoveAttribute={(catId, index) =>
        setRows((r) => ({ ...r, [catId]: (r[catId] || []).filter((_, i) => i !== index) }))
      }
    />
  )
}

export const Default: Story = { render: () => <Demo /> }
