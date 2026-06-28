import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { AlignJustify, Grid3x3, LayoutGrid, List } from 'lucide-react'
import { Icon } from './Icon'
import { SegmentedControl, type SegmentedControlOption } from './SegmentedControl'

type View = 'grid' | 'grid-compact' | 'list'

const viewOptions: SegmentedControlOption<View>[] = [
  { value: 'grid', label: 'Large grid', icon: <Icon icon={LayoutGrid} size={16} /> },
  { value: 'grid-compact', label: 'Compact grid', icon: <Icon icon={Grid3x3} size={16} /> },
  { value: 'list', label: 'List', icon: <Icon icon={List} size={16} /> },
]

const meta = {
  title: 'Primitives/SegmentedControl',
  component: SegmentedControl<View>,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A compact pill of mutually-exclusive icon segments (e.g. a grid/list view switch). The selected segment lights ember; exposed as a `radiogroup` with arrow-key roving. Controlled — pass `value` + `onChange`.',
      },
    },
  },
  argTypes: {
    options: { control: false },
    value: { control: false },
    onChange: { action: 'changed' },
  },
  args: {
    'aria-label': 'Change layout',
    options: viewOptions,
    value: 'grid',
    onChange: () => {},
  },
} satisfies Meta<typeof SegmentedControl<View>>

export default meta
type Story = StoryObj<typeof meta>

function ViewSwitcher() {
  const [value, setValue] = useState<View>('grid')
  return <SegmentedControl aria-label="Change layout" options={viewOptions} value={value} onChange={setValue} />
}

function GridListSwitcher() {
  const [value, setValue] = useState<'grid' | 'list'>('grid')
  return (
    <SegmentedControl
      aria-label="Change layout"
      value={value}
      onChange={setValue}
      options={[
        { value: 'grid', label: 'Grid', icon: <Icon icon={LayoutGrid} size={16} /> },
        { value: 'list', label: 'List', icon: <Icon icon={AlignJustify} size={16} /> },
      ]}
    />
  )
}

export const Default: Story = {
  render: () => <ViewSwitcher />,
}

export const TwoOptions: Story = {
  render: () => <GridListSwitcher />,
  parameters: { docs: { description: { story: 'Any small set of mutually-exclusive modes works — here a simple grid/list pair.' } } },
}
