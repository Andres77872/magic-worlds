import type { Meta, StoryObj } from '@storybook/react-vite'
import { CreateBand } from './CreateBand'

const meta = {
  title: 'Landing/CreateBand',
  component: CreateBand,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: { description: { component: "The dashboard's terminal workbench panel — an ember hairline shimmer atop a raised surface, with IconTile tiles for each create action." } },
  },
  decorators: [(Story) => <div className="w-[1100px] max-w-full"><Story /></div>],
  argTypes: { onAction: { control: false } },
  args: { onAction: () => {} },
} satisfies Meta<typeof CreateBand>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
