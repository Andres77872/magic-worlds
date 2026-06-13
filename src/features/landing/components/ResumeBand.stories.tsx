import type { Meta, StoryObj } from '@storybook/react-vite'
import type { ResumeSession } from './resumeModel'
import { ResumeBand } from './ResumeBand'

const SESSIONS: ResumeSession[] = [
  {
    kind: 'adventure',
    id: 'a1',
    title: 'The Tavern at the Edge of Sleep',
    context: 'The Hollow Wood',
    playingAs: 'Wren',
    snippet: 'Rain taps the leaded glass as a hooded figure slides an envelope across your table.',
    meta: '14 turns · 2 hr. ago',
    updatedAtMs: 0,
    source: { id: 'a1' } as ResumeSession['source'],
  },
  {
    kind: 'chat',
    id: 'c1',
    title: 'Lyra',
    context: 'human',
    snippet: 'You still owe me a story, you know.',
    meta: '32 messages · yesterday',
    updatedAtMs: 0,
    source: { id: 'c1' } as ResumeSession['source'],
  },
  {
    kind: 'adventure',
    id: 'a2',
    title: 'Halcyon Station',
    context: 'Halcyon Station',
    meta: 'Ready to continue',
    updatedAtMs: 0,
    source: { id: 'a2' } as ResumeSession['source'],
  },
]

const meta = {
  title: 'Landing/ResumeBand',
  component: ResumeBand,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: { description: { component: 'The "pick up the thread" band — landscape resume rows for sessions in motion, ember for adventures and arcane for chats.' } },
  },
  decorators: [(Story) => <div className="w-[1100px] max-w-full"><Story /></div>],
  argTypes: { onOpen: { control: false }, onDelete: { control: false } },
  args: {
    sessions: SESSIONS,
    onOpen: () => {},
    onDelete: () => {},
  },
} satisfies Meta<typeof ResumeBand>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
