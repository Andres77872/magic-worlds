import type { Meta, StoryObj } from '@storybook/react-vite'
import { templates } from '@/ui/components/lists/fixtures'
import { SceneCard } from './SceneCard'
import type { Scene } from './sceneModel'

const scene: Scene = {
  template: templates[0],
  title: 'Lyra Dawnwhisper',
  location: 'The Sunken Library',
  description: 'A drowned archive where every book remembers being read — and someone has left you a letter in the stacks.',
  tags: ['Fantasy', 'Mystery', 'Bard'],
  monogram: 'L',
}

const meta = {
  title: 'Landing/SceneCard',
  component: SceneCard,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: { description: { component: 'A discovery-gallery card: seeded monogram portrait, name + world, a two-line hook, and genre tags. The whole card begins the scene; a hover menu exposes edit / delete.' } },
  },
  decorators: [(Story) => <div className="w-72 max-w-full"><Story /></div>],
  argTypes: {
    scene: { control: false },
    onBegin: { control: false },
    onEdit: { control: false },
    onDelete: { control: false },
  },
  args: { scene, onBegin: () => {}, onEdit: () => {}, onDelete: () => {} },
} satisfies Meta<typeof SceneCard>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
