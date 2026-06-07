import type { Meta, StoryObj } from '@storybook/react-vite'
import { Avatar } from './Avatar'

const meta = {
  title: 'Primitives/Avatar',
  component: Avatar,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Character/user avatar — a display-serif initial on a deterministic warm gradient (seeded by `name`), or an image via `src`. `ring`: ember = you, arcane = AI. `status`: live = online dot, think = arcane pulse while generating.',
      },
    },
  },
  argTypes: {
    name: { control: 'text', description: 'Seeds the initial + deterministic warm gradient.' },
    initial: { control: 'text', description: 'Override the derived single letter (e.g. "GM").' },
    size: { control: { type: 'range', min: 24, max: 96, step: 4 } },
    ring: { control: 'inline-radio', options: ['none', 'ember', 'arcane'] },
    status: { control: 'inline-radio', options: ['none', 'live', 'think'] },
    src: { control: false },
    gradient: { control: false },
  },
  args: { name: 'Lyra', size: 56, ring: 'none', status: 'none' },
} satisfies Meta<typeof Avatar>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

/** The player — ember ring. */
export const You: Story = { args: { name: 'You', ring: 'ember' } }

/** The Game Master — arcane ring, pulsing while it thinks. */
export const Thinking: Story = { args: { name: 'Game Master', initial: 'GM', ring: 'arcane', status: 'think' } }

export const Online: Story = { args: { name: 'Companion', status: 'live' } }

export const Gallery: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div className="flex items-center gap-4">
      <Avatar name="Lyra" size={56} />
      <Avatar name="You" size={56} ring="ember" />
      <Avatar name="Game Master" initial="GM" size={56} ring="arcane" status="think" />
      <Avatar name="Companion" size={56} status="live" />
    </div>
  ),
}
