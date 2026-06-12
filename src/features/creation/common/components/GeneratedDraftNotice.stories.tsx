import type { Meta, StoryObj } from '@storybook/react-vite'
import { GeneratedDraftNotice } from './GeneratedDraftNotice'

const meta = {
  title: 'Creation/GeneratedDraftNotice',
  component: GeneratedDraftNotice,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Success badge shown above the live preview after AI generation. The AI endpoint already persisted the card and the creator switched to edit mode — this reassures the user the draft landed and invites a review-and-save pass.',
      },
    },
  },
  decorators: [(Story) => <div className="w-[360px]"><Story /></div>],
  argTypes: { noun: { control: 'text' } },
  args: { noun: 'character' },
} satisfies Meta<typeof GeneratedDraftNotice>

export default meta
type Story = StoryObj<typeof meta>

export const Character: Story = {}
export const World: Story = { args: { noun: 'world' } }
export const Adventure: Story = { args: { noun: 'adventure' } }
