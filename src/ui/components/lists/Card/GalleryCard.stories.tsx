import type { Meta, StoryObj } from '@storybook/react-vite'
import { Download, Link2, MessageCircle, Pencil, Trash2 } from 'lucide-react'
import { Button, Icon } from '@/ui/primitives'
import { GalleryCard } from './GalleryCard'
import type { CardOption } from './CardOptions'

const options: CardOption[] = [
  { type: 'custom', icon: <Icon icon={MessageCircle} size={15} />, label: 'Chat', onClick: () => {} },
  { type: 'custom', icon: <Icon icon={Pencil} size={15} />, label: 'Edit', onClick: () => {} },
  { type: 'custom', icon: <Icon icon={Trash2} size={15} />, label: 'Delete', onClick: () => {}, danger: true },
]

const shareOptions: CardOption[] = [
  { type: 'custom', icon: <Icon icon={Link2} size={15} />, label: 'Share', onClick: () => {} },
  { type: 'custom', icon: <Icon icon={Download} size={15} />, label: 'Download PNG', onClick: () => {} },
]

const meta = {
  title: 'Components/Lists/GalleryCard',
  component: GalleryCard,
  tags: ['autodocs'],
  decorators: [(Story) => <div className="w-56"><Story /></div>],
  parameters: {
    docs: { description: { component: 'Image-forward card for dense, paginated galleries: a 3:4 Portrait (cover image or seeded gradient) carries the whole card, with the name + identity badge on the bottom vignette, capped trigger pills, hover/touch share actions, and a custom context menu on right-click or keyboard context-menu.' } },
  },
  argTypes: {
    title: { control: 'text' },
    badge: { control: 'text' },
    deleting: { control: 'boolean' },
    tags: { control: false },
    shareOptions: { control: false },
    options: { control: false },
    onClick: { action: 'clicked' },
    onTagClick: { action: 'tag-clicked' },
  },
  args: { title: 'Lyra Dawnwhisper', badge: 'Half-elf', deleting: false },
} satisfies Meta<typeof GalleryCard>

export default meta
type Story = StoryObj<typeof meta>

export const GradientFallback: Story = {
  args: { tags: ['bard', 'moonlight'], options },
}

export const WithImage: Story = {
  args: {
    id: 'story-card-with-image',
    imageUrl: 'https://picsum.photos/seed/reverie/400/533',
    tags: ['bard', 'moonlight', 'tavern'],
    shareOptions,
    options,
  },
}

export const LongTitleManyTags: Story = {
  args: {
    id: 'story-card-long-title',
    title: 'Archmagister Valdrassyl of the Umbral Convocation',
    badge: 'Lich',
    tags: ['necromancy', 'undead court', 'forbidden lore', 'extra-tag-clipped'],
    shareOptions,
    options,
  },
}

export const WithShareMenu: Story = {
  args: {
    id: 'story-card-share',
    imageUrl: 'https://picsum.photos/seed/share-reverie/400/533',
    tags: ['bard', 'moonlight'],
    shareOptions,
  },
}

export const HighlightedSharedLink: Story = {
  args: {
    id: 'story-card-highlighted',
    imageUrl: 'https://picsum.photos/seed/highlight-reverie/400/533',
    tags: ['portal', 'shared link', 'featured', 'extra'],
    shareOptions,
    options,
    highlighted: true,
  },
}

export const ClickableTags: Story = {
  args: { tags: ['bard', 'moonlight'], options, onTagClick: () => {} },
}

export const NoActions: Story = {
  args: { tags: ['bard'] },
}

export const Deleting: Story = {
  args: { tags: ['bard'], options, deleting: true },
}

export const Compact: Story = {
  args: {
    size: 'compact',
    imageUrl: 'https://picsum.photos/seed/compact-reverie/400/533',
    tags: ['bard', 'moonlight', 'clipped-at-two'],
    options,
  },
  decorators: [(Story) => <div className="w-[200px]"><Story /></div>],
  parameters: { docs: { description: { story: 'Dashboard rails: smaller title, tighter vignette, tags capped at 2.' } } },
}

export const CompactWithFooter: Story = {
  args: {
    size: 'compact',
    tags: ['innkeeper'],
    options,
    footer: (
      <Button kind="arcane" size="sm" full iconLeft={<Icon icon={MessageCircle} size={15} />} onClick={() => {}}>
        Chat
      </Button>
    ),
  },
  decorators: [(Story) => <div className="w-[200px]"><Story /></div>],
  parameters: { docs: { description: { story: 'The cast rail pins the arcane Chat affordance into the vignette via the footer slot.' } } },
}
