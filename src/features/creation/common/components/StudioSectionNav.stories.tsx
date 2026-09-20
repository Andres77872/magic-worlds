import type { Meta, StoryObj } from '@storybook/react-vite'
import { ScrollText, Sparkles, Swords, Tags, User } from 'lucide-react'
import { StudioSectionNav } from './StudioSectionNav'

const meta = {
  title: 'Creation/StudioSectionNav',
  component: StudioSectionNav,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: { description: { component: 'Sticky navigation for creator sections, with horizontal scrolling on small screens. The current section is announced with aria-current. Clicks update selection immediately and scrolling respects reduced-motion preferences.' } },
  },
  decorators: [(Story) => <div className="w-[640px] max-w-full"><Story /></div>],
  argTypes: { items: { control: false } },
  args: {
    items: [
      { id: 'identity', label: 'Identity', icon: User },
      { id: 'attributes', label: 'Attributes', icon: Tags },
      { id: 'abilities', label: 'Abilities', icon: Swords },
      { id: 'backstory', label: 'Backstory', icon: ScrollText },
      { id: 'ai', label: 'AI assist', icon: Sparkles },
    ],
  },
} satisfies Meta<typeof StudioSectionNav>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
