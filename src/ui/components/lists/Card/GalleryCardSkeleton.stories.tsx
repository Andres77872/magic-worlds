import type { Meta, StoryObj } from '@storybook/react-vite'
import { GalleryCardSkeleton } from './GalleryCardSkeleton'

const meta = {
  title: 'Components/Lists/GalleryCardSkeleton',
  component: GalleryCardSkeleton,
  tags: ['autodocs'],
  decorators: [(Story) => <div className="w-56"><Story /></div>],
  parameters: {
    docs: { description: { component: 'Loading placeholder for GalleryCard: the same 3:4 box with an arcane `.image-shimmer` sweep and a name/badge bar on the bottom vignette, so the skeleton → card swap reserves layout and never shifts. Reduced motion freezes the sweep to a static tint.' } },
  },
  argTypes: {
    size: { control: 'inline-radio', options: ['default', 'compact'] },
  },
  args: { size: 'default' },
} satisfies Meta<typeof GalleryCardSkeleton>

export default meta
type Story = StoryObj<typeof meta>

export const Single: Story = {}

export const Compact: Story = {
  args: { size: 'compact' },
  decorators: [(Story) => <div className="w-[200px]"><Story /></div>],
  parameters: { docs: { description: { story: 'Tighter vignette padding to match the compact dashboard-rail GalleryCard.' } } },
}

export const Grid: Story = {
  decorators: [(Story) => <div style={{ maxWidth: 1040, margin: '0 auto' }}><Story /></div>],
  parameters: {
    layout: 'fullscreen',
    controls: { disable: true },
    docs: { description: { story: 'How a gallery looks while its first page loads: eight matched skeletons in the compact grid track.' } },
  },
  render: () => (
    <div className="grid w-full grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4 md:grid-cols-[repeat(auto-fill,minmax(220px,1fr))] md:gap-5">
      {Array.from({ length: 8 }).map((_, i) => (
        <GalleryCardSkeleton key={i} />
      ))}
    </div>
  ),
}
