import type { Meta, StoryObj } from '@storybook/react-vite'
import { Badge } from './Badge'
import { Portrait } from './Portrait'

const meta = {
  title: 'Primitives/Portrait',
  component: Portrait,
  tags: ['autodocs'],
  decorators: [(Story) => <div className="w-64 overflow-hidden rounded-xl"><Story /></div>],
  parameters: {
    docs: {
      description: {
        component:
          'Character portrait frame — a faint display initial on a warm gradient (or an image via `src`), with a built-in bottom vignette so overlaid names/badges stay legible.',
      },
    },
  },
  argTypes: {
    name: { control: 'text', description: 'Seeds the faint initial + warm gradient.' },
    height: { control: { type: 'range', min: 100, max: 320, step: 10 } },
    src: { control: false },
    gradient: { control: false },
    children: { control: false },
  },
  args: { name: 'Lyra Dawnwhisper', height: 200 },
} satisfies Meta<typeof Portrait>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

/** The vignette keeps overlaid text and badges readable. */
export const WithOverlay: Story = {
  render: (args) => (
    <Portrait {...args}>
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-3">
        <span className="font-display text-[18px] font-semibold text-parchment-50">Lyra</span>
        <Badge tone="arcane">AI</Badge>
      </div>
    </Portrait>
  ),
}
