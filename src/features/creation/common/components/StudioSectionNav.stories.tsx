import type { Meta, StoryObj } from '@storybook/react-vite'
import { ScrollText, Sparkles, Swords, Tags, User } from 'lucide-react'
import { StudioSectionNav } from './StudioSectionNav'

const meta = {
  title: 'Creation/StudioSectionNav',
  component: StudioSectionNav,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: { description: { component: 'Sticky in-page nav for the studio editor column — one chip per section. Click scrolls to the anchor; an IntersectionObserver highlights the section in view (standalone here, so the first chip stays active).' } },
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
