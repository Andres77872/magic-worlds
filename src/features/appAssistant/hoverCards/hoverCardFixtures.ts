/**
 * A small library for hover card stories and tests: two "Kai" cards that only
 * the preview can tell apart, a world other descriptions mention by name (so
 * cards nest), an adventure with a world and cast, a default persona, and a
 * lorebook.
 */
import type { Adventure, Character, Item, Lorebook, LorebookEntry, World } from '@/shared'
import { DEFAULT_LOREBOOK_SETTINGS } from '@/features/lorebook/lorebookTransforms'
import type { KnowledgeLibrary } from '../appKnowledge'

function character(card: Partial<Character> & Pick<Character, 'id' | 'name'>): Character {
    return { race: 'Human', stats: {}, ...card }
}

function entry(id: string, title: string, keys: string[]): LorebookEntry {
    return {
        id, lorebookId: 'l-resonance', title, entryType: 'rule', content: `${title} shapes every spell.`, keys,
        secondaryKeys: [], selectiveLogic: 'and_any', enabled: true, caseSensitive: false,
        matchWholeWords: true, regex: false, insertionOrder: 0, priority: 0, insertionPosition: 'before_context',
    }
}

export const aerindor: World = {
    id: 'w-aerindor', name: 'Aerindor', type: 'Floating forest',
    description: 'Islands of old forest adrift on leyline currents. Theron Mistwood keeps its only harbor.',
    details: {}, triggers: ['Aerindor', 'leyline'], latest_version_number: 2, updatedAt: '2026-10-06T09:00:00Z',
}

export const lyra = character({
    id: 'c-lyra', name: 'Lyra Brisaveloz', race: 'Elf', class: 'Scout', latest_version_number: 3, updatedAt: '2026-10-09T10:00:00Z',
    description: 'A scout from the floating forests of Aerindor. Rides with Theron Mistwood when the leylines drift, and never sleeps under a roof.',
    triggers: ['Lyra', 'scout', 'Aerindor', 'wind'],
})

export const kaiEs = character({
    id: 'c-kai-es', name: 'Kai', class: 'Mercenario', latest_version_number: 4, updatedAt: '2026-10-08T12:00:00Z',
    description: 'Versión en español. Mercenario de lengua afilada con una deuda pendiente con la Torre de Ceniza.',
    triggers: ['Kai', 'mercenario'],
})

export const kaiEn = character({
    id: 'c-kai-en', name: 'Kai', class: 'Mercenary', latest_version_number: 2, updatedAt: '2026-10-11T03:58:00Z',
    description: 'English edition. A sharp-tongued mercenary who owes a debt to the Ash Tower.',
    triggers: ['Kai', 'mercenary'],
})

export const theron = character({
    id: 'c-theron', name: 'Theron Mistwood', class: 'Water and air wizard', latest_version_number: 1, updatedAt: '2026-10-03T08:00:00Z',
    description: 'Tidecaller of the conclave. Bends mist into messengers. Old rival of Elara Frostveil.',
    triggers: ['Theron', 'tidecaller'],
})

export const elara = character({
    id: 'c-elara', name: 'Elara Frostveil', race: 'Elf', class: 'Ice and illusion mage', latest_version_number: 2, updatedAt: '2026-10-03T08:30:00Z',
    description: 'Weaves winter mirages that outlast the snow. Wants the leyline accord broken before Theron Mistwood can sign it.',
    triggers: ['Elara', 'illusion'],
})

export const dan = character({
    id: 'p-dan', name: 'Dan', role: 'persona', is_default_persona: true, updatedAt: '2026-09-11T08:00:00Z',
    description: 'Your default persona: a curious traveler who asks too many questions.',
    triggers: ['Dan'],
})

export const tideLantern: Item = {
    id: 'i-lantern', name: 'Tide lantern', type: 'Relic', rarity: 'Rare', description: 'Burns under water and shows leyline currents.',
    effects: ['Light'], requirements: [], limitations: [], triggers: ['lantern'],
}

export const conclave: Adventure = {
    id: 'a-conclave',
    scenario: 'A grand gathering of wizards from across the realms. Every hundred years the conclave convenes, and two rivals arrive with proposals for the leyline accord.',
    characters: [theron, elara], world: aerindor, triggers: ['conclave', 'accord'], updatedAt: '2026-10-10T20:00:00Z',
}

export const resonance: Lorebook = {
    id: 'l-resonance', name: 'Aetheric Resonance — Hard Magic System', description: 'Rules for a cost-based magic system. Fits your magic-focused cards.',
    tags: ['magic'], enabled: true, settings: { ...DEFAULT_LOREBOOK_SETTINGS }, attachments: [], updatedAt: '2026-10-07T09:00:00Z',
    entries: [
        entry('e1', 'Resonance cost', ['cost']), entry('e2', 'Leyline anchors', ['anchor']), entry('e3', 'Overcasting', ['overcast']),
        entry('e4', 'Attunement', ['attune']), entry('e5', 'Echo wards', ['ward']), entry('e6', 'Silence fields', ['silence']),
        entry('e7', 'Resonant pairs', ['pair']), entry('e8', 'The quiet tithe', ['tithe']),
    ],
}

export const hoverCardLibrary: KnowledgeLibrary = {
    characters: [lyra, kaiEs, kaiEn, theron, elara, dan],
    worlds: [aerindor],
    items: [tideLantern],
    adventures: [conclave],
    lorebooks: [resonance],
    resources: [],
    stories: [],
}

/** An assistant reply that links every kind of record (and one that is gone). */
export const HOVER_CARD_REPLY = [
    '## Your library at a glance',
    '',
    '- [Lyra Brisaveloz](#/gallery/characters?card=c-lyra), a scout from the floating forests of [Aerindor](#/gallery/worlds?card=w-aerindor)',
    '- [Kai](#/gallery/characters?card=c-kai-es) and [Kai](#/gallery/characters?card=c-kai-en), likely one character in two languages',
    '- [Theron Mistwood](#/gallery/characters?card=c-theron) and [Elara Frostveil](#/gallery/characters?card=c-elara), your wizards',
    '- [Dan](#/gallery/personas?card=p-dan), your default persona, carries the [Tide lantern](#/gallery/items?card=i-lantern)',
    '- [A grand gathering of wizards…](#/gallery/adventures?card=a-conclave) uses [Aetheric Resonance — Hard Magic System](#/lorebook?lorebook=l-resonance)',
    '- An older link: [Kai (old draft)](#/gallery/characters?card=c-kai-old)',
].join('\n')
