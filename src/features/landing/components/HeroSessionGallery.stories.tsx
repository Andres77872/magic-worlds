import type { Meta, StoryObj } from '@storybook/react-vite'
import type { ResumeSession } from './resumeModel'
import { HeroSessionGallery } from './HeroSessionGallery'

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
    title: 'Theron Mistwood',
    context: 'wizard',
    playingAs: 'Aria',
    snippet: 'Ah, a seeker of knowledge, are you? Good. I have been waiting.',
    meta: '32 messages · yesterday',
    updatedAtMs: 0,
    source: { id: 'c1' } as ResumeSession['source'],
  },
  {
    kind: 'adventure',
    id: 'a2',
    title: 'A grand gathering of wizards from across the sea',
    context: 'The Ember Hall',
    snippet: 'The grand hall hums with the soft glow of floating crystal.',
    meta: '2 turns · 18h ago',
    updatedAtMs: 0,
    source: { id: 'a2' } as ResumeSession['source'],
  },
]

const meta = {
  title: 'Landing/HeroSessionGallery',
  component: HeroSessionGallery,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The returning-user hero banner: a one-slide-per-view paged carousel of the last 10 chats and adventures — chevrons + pagination dots, hidden scrollbar, mode-specific CTAs.',
      },
    },
  },
  decorators: [(Story) => <div className="w-[1240px] max-w-full"><Story /></div>],
  argTypes: { onOpen: { control: false }, onBeginNew: { control: false } },
  args: {
    sessions: SESSIONS,
    onOpen: () => {},
    onBeginNew: () => {},
  },
} satisfies Meta<typeof HeroSessionGallery>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Single: Story = {
  args: {
    sessions: SESSIONS.slice(0, 1),
  },
}

export const Many: Story = {
  args: {
    sessions: Array.from({ length: 6 }, (_, index) => ({
      ...SESSIONS[index % SESSIONS.length],
      id: `s${index}`,
      title: `${SESSIONS[index % SESSIONS.length].title} ${index + 1}`,
    })),
  },
}
