import type { Meta, StoryObj } from '@storybook/react-vite'
import { MessageCircle, Pencil, Trash2 } from 'lucide-react'
import { Icon } from '@/ui/primitives'
import { GalleryCard } from './GalleryCard'
import type { CardOption } from './CardOptions'

const options: CardOption[] = [
  { type: 'custom', icon: <Icon icon={MessageCircle} size={15} />, label: 'Chat', onClick: () => {} },
  { type: 'custom', icon: <Icon icon={Pencil} size={15} />, label: 'Edit', onClick: () => {} },
  { type: 'custom', icon: <Icon icon={Trash2} size={15} />, label: 'Delete', onClick: () => {}, danger: true },
]

const meta = {
  title: 'Components/Lists/GalleryCard',
  component: GalleryCard,
  tags: ['autodocs'],
  decorators: [(Story) => <div className="w-56"><Story /></div>],
  parameters: {
    docs: { description: { component: 'Image-forward card for dense, paginated galleries: a 3:4 Portrait (cover image or seeded gradient) carries the whole card, with the name + identity badge on the bottom vignette, up to three trigger pills (clickable when onTagClick is set), and hover-revealed actions.' } },
  },
  argTypes: {
    title: { control: 'text' },
    badge: { control: 'text' },
    deleting: { control: 'boolean' },
    tags: { control: false },
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
    imageUrl: 'https://picsum.photos/seed/reverie/400/533',
    tags: ['bard', 'moonlight', 'tavern'],
    options,
  },
}

export const LongTitleManyTags: Story = {
  args: {
    title: 'Archmagister Valdrassyl of the Umbral Convocation',
    badge: 'Lich',
    tags: ['necromancy', 'undead court', 'forbidden lore', 'extra-tag-clipped'],
    options,
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
