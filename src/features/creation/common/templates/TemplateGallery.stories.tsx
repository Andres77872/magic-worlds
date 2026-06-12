import type { Meta, StoryObj } from '@storybook/react-vite'
import { HeartHandshake, Lamp, Skull, BookOpen } from 'lucide-react'
import { TemplateGallery } from './TemplateGallery'
import type { CardFieldDefinition, CardTemplate } from '../engine'

const FIELDS: CardFieldDefinition[] = [
  { id: 'personality.archetype', label: 'Archetype', input: 'suggest', binding: { group: 'Personality', key: 'Archetype' } },
  { id: 'personality.motivation', label: 'Motivation', input: 'text', binding: { group: 'Personality', key: 'Motivation' } },
  { id: 'personality.fear', label: 'Fear', input: 'text', binding: { group: 'Personality', key: 'Fear' } },
  { id: 'personality.secret', label: 'Secret', input: 'text', binding: { group: 'Personality', key: 'Secret' } },
  { id: 'voice.speech', label: 'Speech style', input: 'suggest', binding: { group: 'Voice', key: 'Speech Style' } },
  { id: 'voice.example', label: 'Example dialogue', input: 'textarea', binding: { group: 'Voice', key: 'Example Dialogue' } },
]

const TEMPLATES: CardTemplate[] = [
  {
    id: 'companion',
    name: 'Loyal Companion',
    tagline: 'An ally who walks beside you — and would walk into fire.',
    icon: HeartHandshake,
    fieldIds: ['personality.archetype', 'personality.motivation', 'personality.fear', 'voice.speech', 'voice.example'],
  },
  {
    id: 'adversary',
    name: 'The Adversary',
    tagline: "A villain who believes they're the hero.",
    icon: Skull,
    fieldIds: ['personality.archetype', 'personality.motivation', 'personality.secret', 'voice.speech'],
  },
  {
    id: 'mentor',
    name: 'The Mentor',
    tagline: 'They know the way — and the price of it.',
    icon: Lamp,
    fieldIds: ['personality.motivation', 'personality.fear', 'personality.secret', 'voice.example'],
  },
  {
    id: 'storykeeper',
    name: 'The Storykeeper',
    tagline: "A voice at the fire's edge who frames every scene.",
    icon: BookOpen,
    fieldIds: ['voice.speech', 'personality.motivation'],
  },
]

const meta = {
  title: 'Creation/TemplateGallery',
  component: TemplateGallery,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The create-mode intro step: pickable starting shapes (which activate guided fields and install ghost examples), the dashed "Empty card" tile, and a quiet skip link for the standard field set.',
      },
    },
  },
} satisfies Meta<typeof TemplateGallery>

export default meta
type Story = StoryObj<typeof meta>

export const Character: Story = {
  args: {
    templates: TEMPLATES,
    fields: FIELDS,
    noun: 'character',
    heading: 'Who steps into the candlelight?',
    subheading: 'Choose a shape to begin from — every field stays yours to change, remove, or rewrite.',
    onPick: () => {},
    onSkip: () => {},
  },
}
