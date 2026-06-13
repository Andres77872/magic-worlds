import type { Meta, StoryObj } from '@storybook/react-vite'
import type { Story as NovelStory } from '@/shared'
import { StoryCard } from './StoryCard'

const NOVEL = {
  id: 's1',
  title: 'The Long Night',
  description: 'A vigil that should have lasted one evening, told by the people who kept it.',
  chapters: [
    { id: 'ch1', body: 'The first candle went out at dusk, which everyone agreed was a bad sign.' },
    { id: 'ch2', body: 'By midnight there were three of them awake, and one of them was lying about it.' },
  ],
  scenes: [],
  activeCardRefs: [
    { id: 'r1', snapshot: { name: 'Wren' } },
    { id: 'r2', snapshot: { name: 'The Hollow Wood' } },
  ],
  activeContext: {},
} as unknown as NovelStory

const meta = {
  title: 'Landing/StoryCard',
  component: StoryCard,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: { description: { component: 'Text-forward tile for a novel draft — stories carry no artwork, so chapters, word count, and context tags do the talking.' } },
  },
  decorators: [(Story) => <div className="w-[280px]"><Story /></div>],
  argTypes: { onOpen: { control: false } },
  args: { story: NOVEL, onOpen: () => {} },
} satisfies Meta<typeof StoryCard>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
