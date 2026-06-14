import type { Meta, StoryObj } from '@storybook/react-vite'
import { Swords } from 'lucide-react'
import { ContinueRail } from './ContinueRail'
import { ContinueCard } from './ContinueCard'
import type { ResumeSession } from './resumeModel'

const SESSIONS: ResumeSession[] = [
  {
    kind: 'adventure',
    id: 'a1',
    title: 'The Hollow Wood Vigil',
    context: 'The Hollow Wood',
    snippet: 'The lantern gutters as the path bends between black pines.',
    meta: '14 turns · 2h ago',
    updatedAtMs: 0,
    source: { id: 'a1' } as ResumeSession['source'],
  },
  {
    kind: 'adventure',
    id: 'a2',
    title: 'A Letter Never Sent',
    context: 'Saint-Avril',
    snippet: 'She folds the page twice, then once more.',
    meta: '6 turns · 1d ago',
    updatedAtMs: 0,
    source: { id: 'a2' } as ResumeSession['source'],
  },
  {
    kind: 'adventure',
    id: 'a3',
    title: 'Halcyon Station, Last Watch',
    context: 'Halcyon Station',
    snippet: 'The reactor hum drops a half-step.',
    meta: '3 turns · 3d ago',
    updatedAtMs: 0,
    source: { id: 'a3' } as ResumeSession['source'],
  },
]

const meta = {
  title: 'Landing/ContinueRail',
  component: ContinueRail<ResumeSession>,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: { description: { component: 'Shared "pick up where you left off" shelf for the active adventures, chats, and novels sections — a SectionHeader over a horizontal scroll-snap rail. Hides itself when empty.' } },
  },
  decorators: [(Story) => <div className="w-[1100px] max-w-full"><Story /></div>],
} satisfies Meta<typeof ContinueRail<ResumeSession>>

export default meta
type Story = StoryObj<typeof meta>

export const ActiveAdventures: Story = {
  args: {
    title: 'Continue your adventures',
    icon: Swords,
    tone: 'ember',
    items: SESSIONS,
    total: 7,
    viewAllLabel: 'See all',
    getItemKey: (session: ResumeSession) => session.id,
    renderCard: (session: ResumeSession) => <ContinueCard session={session} onContinue={() => {}} />,
    onViewAll: () => {},
  },
}
