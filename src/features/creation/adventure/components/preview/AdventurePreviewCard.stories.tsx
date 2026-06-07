import type { Meta, StoryObj } from '@storybook/react-vite'
import { AdventurePreviewCard } from './AdventurePreviewCard'

const meta = {
  title: 'Creation/AdventurePreviewCard',
  component: AdventurePreviewCard,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: { description: { component: 'The "playbill" live preview of an adventure being built — scene header, premise excerpt, cast row (persona ringed + "You"), world badge, objectives count, and trigger chips.' } },
  },
  decorators: [(Story) => <div className="w-[340px] max-w-full"><Story /></div>],
  argTypes: {
    title: { control: 'text' },
    scenario: { control: 'text' },
    objectivesCount: { control: { type: 'number' } },
    cast: { control: false },
    persona: { control: false },
    world: { control: false },
    triggers: { control: false },
  },
  args: {
    title: 'The Tavern at the Edge of Sleep',
    scenario: 'Rain taps the leaded glass as a hooded figure slides a damp envelope across your table. Inside: a name you buried years ago.',
    persona: { id: 'p1', name: 'Lyra Dawnwhisper' },
    cast: [{ id: 'c2', name: 'Thane Ironvow' }, { id: 'c3', name: 'Sable' }],
    world: { name: 'The Sunken Library', type: 'fantasy' },
    objectivesCount: 2,
    triggers: ['envelope', 'old debt'],
  },
} satisfies Meta<typeof AdventurePreviewCard>

export default meta
type Story = StoryObj<typeof meta>

export const Filled: Story = {}
export const Empty: Story = {
  args: { title: '', scenario: '', persona: undefined, cast: [], world: undefined, objectivesCount: 0, triggers: [] },
}
