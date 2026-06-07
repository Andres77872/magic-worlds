import type { Meta, StoryObj } from '@storybook/react-vite'
import { Sparkles, Swords } from 'lucide-react'
import { Input } from '@/ui/primitives'
import { StudioSection } from './StudioSection'

const meta = {
  title: 'Creation/StudioSection',
  component: StudioSection,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: { description: { component: 'A titled, anchored editor block in the Creator Studio — an outlined surface with a serif header, optional icon/tone/description, and a right-aligned slot.' } },
  },
  decorators: [(Story) => <div className="w-[640px] max-w-full"><Story /></div>],
  argTypes: {
    id: { control: false },
    title: { control: 'text' },
    description: { control: 'text' },
    tone: { control: 'inline-radio', options: ['ember', 'arcane'] },
    icon: { control: false },
    right: { control: false },
    children: { control: false },
  },
  args: {
    id: 'identity',
    title: 'Identity',
    tone: 'ember',
    icon: Swords,
    description: 'The essentials your companions will know you by.',
    children: <Input placeholder="e.g. Lyra Dawnwhisper" />,
  },
} satisfies Meta<typeof StudioSection>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Arcane: Story = {
  args: { id: 'ai', title: 'AI assist', tone: 'arcane', icon: Sparkles, description: 'Let the AI draft a starting point.' },
}
