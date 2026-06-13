import type { Meta, StoryObj } from '@storybook/react-vite'
import type { Character } from '@/shared'
import { CastRail } from './CastRail'

const CAST = [
  { id: 'c1', name: 'Lyra', race: 'Human', stats: {}, triggers: ['innkeeper', 'mystery'] },
  { id: 'c2', name: 'Kael', race: 'Knight', stats: {}, triggers: ['exile'] },
  { id: 'c3', name: 'Dr. Soren', race: 'Scientist', stats: {}, triggers: ['station'] },
  { id: 'c4', name: 'Wren', race: 'Fey', stats: {}, triggers: ['forest'] },
] as unknown as Character[]

const meta = {
  title: 'Landing/CastRail',
  component: CastRail,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: { description: { component: "The user's AI characters as a compact image-forward rail — each card carries the arcane Chat affordance, the 1:1 conversation entry point." } },
  },
  decorators: [(Story) => <div className="w-[1100px] max-w-full"><Story /></div>],
  argTypes: {
    onChat: { control: false }, onEdit: { control: false },
    onDelete: { control: false }, onViewAll: { control: false },
  },
  args: {
    cast: CAST,
    onChat: () => {},
    onEdit: () => {},
    onDelete: () => {},
    onViewAll: () => {},
  },
} satisfies Meta<typeof CastRail>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
