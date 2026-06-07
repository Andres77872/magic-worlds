import type { Meta, StoryObj } from '@storybook/react-vite'
import { Card } from '@/ui/components/lists/Card'
import { Tag } from '@/ui/primitives'
import { StudioPreviewDock } from './StudioPreviewDock'

const meta = {
  title: 'Creation/StudioPreviewDock',
  component: StudioPreviewDock,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: { description: { component: 'Responsive wrapper for the studio live preview. On wide screens it shows the preview directly; on narrow screens it collapses to an expandable "Live preview" bar (resize the canvas to see the bar).' } },
  },
  decorators: [(Story) => <div className="w-[360px] max-w-full"><Story /></div>],
  argTypes: { label: { control: 'text' }, children: { control: false } },
  args: {
    label: 'Live preview',
    children: (
      <Card title="Lyra Dawnwhisper" subtitle={<Tag>Half-elf</Tag>}>
        <div className="font-narrative text-sm italic text-parchment-400">Charisma: 17 • Dexterity: 14</div>
      </Card>
    ),
  },
} satisfies Meta<typeof StudioPreviewDock>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
