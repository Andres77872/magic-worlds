import type { Meta, StoryObj } from '@storybook/react-vite'
import { adventures } from '@/ui/components/lists/fixtures'
import { InteractionLeftPanel } from './InteractionLeftPanel'

const meta = {
  title: 'Interaction/InteractionLeftPanel',
  component: InteractionLeftPanel,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: { description: { component: 'The left rail in an adventure: a back action plus scenario, world setting, and cast summary cards.' } },
  },
  decorators: [(Story) => <div className="w-[360px] max-w-full"><Story /></div>],
  argTypes: {
    adventure: { control: false },
    onBack: { control: false },
  },
  args: { adventure: adventures[0], onBack: () => {} },
} satisfies Meta<typeof InteractionLeftPanel>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
