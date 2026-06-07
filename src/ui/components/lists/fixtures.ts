/**
 * Sample domain data for list/card stories. Plain fixtures — no network, no
 * providers — so the list components can be shown in isolation.
 */
import type { Adventure, Character, World } from '@/shared/types'

export const characters: Character[] = [
  { id: 'c1', name: 'Lyra Dawnwhisper', race: 'Half-elf', class: 'Bard', stats: { Charisma: 17, Dexterity: 14, Wisdom: 12 } },
  { id: 'c2', name: 'Thane Ironvow', race: 'Dwarf', class: 'Paladin', stats: { Strength: 18, Constitution: 16 } },
  { id: 'c3', name: 'Sable', race: 'Tiefling', class: 'Rogue', stats: { Dexterity: 18, Intelligence: 13 } },
  { id: 'c4', name: 'Mirren Vale', race: 'Human', class: 'Wizard', stats: { Intelligence: 18, Wisdom: 14 } },
]

export const worlds: World[] = [
  {
    id: 'w1',
    name: 'The Sunken Library',
    type: 'fantasy',
    details: {},
    description: 'A drowned archive where every book remembers being read, and the ink still whispers to those who listen.',
  },
  {
    id: 'w2',
    name: 'Neon Bastion',
    type: 'sci-fi',
    details: {},
    description: 'A vertical city lit by ten thousand signs, where the rain never stops and neither do the deals.',
  },
  {
    id: 'w3',
    name: 'Hollowmoor',
    type: 'mystery',
    details: {},
    description: 'A fog-locked village where the dead leave letters and nobody asks who delivers them.',
  },
]

export const adventures: Adventure[] = [
  {
    id: 'a1',
    scenario: 'The Tavern at the Edge of Sleep',
    status: 'in-progress',
    characters: [characters[0]],
    world: worlds[0],
    turns: [
      { id: 't1', type: 'ai', content: 'Rain taps the leaded glass as a hooded figure slides a damp envelope across your table.', timestamp: '' },
    ],
  },
  {
    id: 'a2',
    scenario: 'A Letter from Hollowmoor',
    status: 'in-progress',
    characters: [characters[2]],
    world: worlds[2],
    turns: [],
  },
]

export const templates: Adventure[] = [
  {
    id: 'tpl1',
    scenario: 'First Light',
    status: 'draft',
    characters: [characters[1]],
    world: worlds[0],
    turns: [
      { id: 't', type: 'system', content: 'A quiet inn. A stranger. A story only you can finish.', timestamp: '' },
    ],
  },
  {
    id: 'tpl2',
    scenario: 'The Long Con',
    status: 'draft',
    characters: [characters[2], characters[3]],
    world: worlds[1],
    turns: [],
  },
]
