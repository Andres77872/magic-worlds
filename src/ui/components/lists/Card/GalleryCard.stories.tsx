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
    eyebrow: { control: 'text' },
    description: { control: 'text' },
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

export const WithFastChatFooter: Story = {
  args: {
    id: 'story-card-fast-chat',
    imageUrl: 'https://picsum.photos/seed/fast-chat-reverie/400/533',
    tags: ['bard', 'moonlight', 'tavern'],
    shareOptions,
    options,
    footer: (
      <Button variant="arcane" size="sm" full iconLeft={<Icon icon={MessageCircle} size={15} />} onClick={() => {}}>
        Chat
      </Button>
    ),
  },
  parameters: { docs: { description: { story: 'Character gallery cards pin an arcane Chat affordance into the default-size vignette for fast conversation start.' } } },
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
      <Button variant="arcane" size="sm" full iconLeft={<Icon icon={MessageCircle} size={15} />} onClick={() => {}}>
        Chat
      </Button>
    ),
  },
  decorators: [(Story) => <div className="w-[200px]"><Story /></div>],
  parameters: { docs: { description: { story: 'The cast rail pins the arcane Chat affordance into the vignette via the footer slot.' } } },
}

export const WithDescription: Story = {
  args: {
    id: 'story-card-description',
    imageUrl: 'https://picsum.photos/seed/desc-reverie/400/533',
    eyebrow: 'The Ember Coast',
    description: 'A card-sharp innkeeper who knows more than she lets on.',
    tags: ['innkeeper', 'mystery'],
    options,
  },
  parameters: { docs: { description: { story: 'Cards lead with a mono "where" eyebrow and a one-line narrative hook above the trigger pills.' } } },
}

export const ShowcaseStatic: Story = {
  args: {
    title: 'Lyra',
    badge: 'Mystery',
    eyebrow: 'The Ember Coast',
    description: 'A card-sharp innkeeper who knows more than she lets on.',
    gradient: 'radial-gradient(120% 90% at 30% 20%,#4a3a6b,#241b38 60%,#160f24)',
    staticCard: true,
    onClick: () => {},
  },
  parameters: { docs: { description: { story: 'The landing showcase renders this same component: a static, curated-gradient card with the genre as a top-left badge and no action bubble.' } } },
}

export const Row: Story = {
  args: {
    id: 'story-card-row',
    view: 'row',
    imageUrl: 'https://picsum.photos/seed/row-reverie/400/533',
    eyebrow: 'Silverwood',
    description: 'A wandering bard who trades secrets for a warm hearth and a willing audience.',
    tags: ['bard', 'companion', 'moonlight'],
    versionNumber: 3,
    hasDraft: true,
    shareOptions,
    options,
    onClick: () => {},
  },
  decorators: [(Story) => <div className="w-[680px] max-w-full"><Story /></div>],
  parameters: { docs: { description: { story: "CardGrid's `list` layout: the same card as a full-width row — thumbnail, title with inline badge/version/draft chips, eyebrow + description, tag pills + usage, and the hover/touch action cluster on the trailing edge." } } },
}

export const RowWithFooter: Story = {
  args: {
    id: 'story-card-row-footer',
    view: 'row',
    imageUrl: 'https://picsum.photos/seed/row-footer-reverie/400/533',
    eyebrow: 'The Ember Coast',
    description: 'A card-sharp innkeeper who knows more than she lets on.',
    tags: ['innkeeper', 'mystery'],
    shareOptions,
    options,
    onClick: () => {},
    footer: (
      <Button variant="arcane" size="sm" iconLeft={<Icon icon={MessageCircle} size={15} />} onClick={() => {}}>
        Chat
      </Button>
    ),
  },
  decorators: [(Story) => <div className="w-[680px] max-w-full"><Story /></div>],
  parameters: { docs: { description: { story: 'Rows pin the primary CTA (e.g. Chat) just left of the overflow menu on the trailing edge.' } } },
}

export const RowGradient: Story = {
  args: {
    view: 'row',
    badge: 'Lich',
    eyebrow: 'Umbral Convocation',
    description: 'Keeper of forbidden lore and the undead court that guards it.',
    tags: ['necromancy', 'undead court', 'forbidden lore'],
    options,
    onClick: () => {},
  },
  decorators: [(Story) => <div className="w-[680px] max-w-full"><Story /></div>],
  parameters: { docs: { description: { story: 'No cover image: the row thumbnail falls back to the seeded gradient + initial, exactly like the tile.' } } },
}
