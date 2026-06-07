import type { Meta, StoryObj } from '@storybook/react-vite'
import { AiGeneratePanel } from './AiGeneratePanel'

const meta = {
  title: 'Creation/AiGeneratePanel',
  component: AiGeneratePanel,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: { description: { component: 'The "Generate with AI" affordance shared by every creator. Owns the description input + busy/error state; delegates the call to `onGenerate`, which must throw on failure so the error surfaces inline.' } },
  },
  decorators: [(Story) => <div className="w-[560px] max-w-full"><Story /></div>],
  argTypes: {
    noun: { control: 'text' },
    placeholder: { control: 'text' },
    onGenerate: { control: false },
  },
  args: {
    noun: 'character',
    onGenerate: async () => {
      await new Promise((resolve) => setTimeout(resolve, 1000))
    },
  },
} satisfies Meta<typeof AiGeneratePanel>

export default meta
type Story = StoryObj<typeof meta>

/** Type a description and Generate — the button shows the busy state. */
export const Default: Story = {}

/** When `onGenerate` throws, the message surfaces inline. */
export const ErrorState: Story = {
  args: {
    onGenerate: async () => {
      await new Promise((resolve) => setTimeout(resolve, 600))
      throw new Error('The muse is quiet. Try again in a moment.')
    },
  },
}
