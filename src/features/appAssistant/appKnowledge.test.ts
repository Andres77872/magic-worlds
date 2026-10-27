import { setTestFeatureFlags } from '@/shared/hooks/testing/featureFlagTestUtils'
import { novel, storyChapter, storyScene } from '@/test/fixtures/story'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { i18n } from '@/app/i18n'
import type { Adventure, Character, Item, Lorebook, LorebookResource, Story, World } from '@/shared'
import { isPageFeatureEnabled } from '@/shared/featureFlags'
import { getDocsContent, withNote } from '@/features/docs/components/docsContent'
import {
    KNOWLEDGE_LIMITS,
    buildGuideSection,
    buildLibrarySection,
    clip,
    composeKnowledge,
    focusLink,
    parseFocusLink,
    type KnowledgeLibrary,
    type KnowledgeSourceKey,
} from './appKnowledge'

const t = i18n.getFixedT('en')

const character = (overrides: Partial<Character> = {}): Character => ({
    id: 'c1', name: 'Mira Vell', race: 'Elf', class: 'Archivist', stats: {}, description: 'Keeper of the drowned library.',
    triggers: ['Mira', 'archivist'], ...overrides,
})
const world: World = { id: 'w1', name: 'Saltmarsh', type: 'Coastal city', description: 'A port of fog and bells.', details: {} }
const item: Item = { id: 'i1', name: 'Tide lantern', description: 'Burns under water.', effects: ['Light'], requirements: [], limitations: [], rarity: 'Rare' }
const adventure: Adventure = { id: 'a1', scenario: 'The bells stop ringing. Something rises.', characters: [character()], world }
const lorebook: Lorebook = {
    id: 'l1', name: 'Saltmarsh lore', description: 'Factions and tides.', tags: ['coast'], enabled: true,
    settings: {} as Lorebook['settings'], attachments: [],
    entries: [
        { id: 'e1', lorebookId: 'l1', title: 'Bell guild', entryType: 'faction', content: 'The guild keeps the harbor bells.', keys: ['bell', 'guild'],
            secondaryKeys: [], selectiveLogic: 'and_any', enabled: true, caseSensitive: false, matchWholeWords: true,
            regex: false, insertionOrder: 0, priority: 0, insertionPosition: 'before_context' } as Lorebook['entries'][number],
    ],
}
const resource: LorebookResource = {
    id: 'r1', title: 'Harbor charter', triggers: ['charter'], fileName: 'charter.md', fileType: 'md', content: '# Charter\nThe harbor belongs to all.',
}
const story: Story = {
    ...novel({chapters:[]}),
    id: 's1', title: 'Fog Bells', description: 'A mystery.', source: { kind: 'blank' } as Story['source'],
    chapters: [storyChapter({id:'ch1',storyId:'s1',title:'Low tide',order:1,scenes:[storyScene({storyId:'s1',chapterId:'ch1',body:'The water left.'})]})],
    activeCardRefs: [], activeContext: {} as Story['activeContext'],
}

const library = (overrides: Partial<KnowledgeLibrary> = {}): KnowledgeLibrary => ({
    characters: [character(), character({ id: 'p1', name: 'Wren', role: 'persona', is_default_persona: true })],
    worlds: [world], items: [item], adventures: [adventure], lorebooks: [lorebook], resources: [resource], stories: [story],
    ...overrides,
})

const ALL: ReadonlySet<KnowledgeSourceKey> = new Set(['guide', 'library', 'lorebooks', 'resources', 'novels'])

afterEach(() => {
    vi.unstubAllEnvs()
})

describe('appKnowledge text helpers', () => {
    it('clips on a word boundary and collapses whitespace', () => {
        expect(clip('  one   two\nthree  ', 50)).toBe('one two three')
        expect(clip('alpha beta gamma delta', 12)).toBe('alpha beta…')
        expect(clip(null, 10)).toBe('')
    })

    it('round-trips the assistant-only lorebook and novel links', () => {
        expect(parseFocusLink(focusLink({ kind: 'lorebook', id: 'l 1' }))).toEqual({ kind: 'lorebook', id: 'l 1' })
        expect(parseFocusLink(focusLink({ kind: 'novel', id: 's1' }))).toEqual({ kind: 'novel', id: 's1' })
        expect(parseFocusLink('#/gallery/characters?card=c1')).toBeNull()
        expect(parseFocusLink('https://example.com')).toBeNull()
        expect(focusLink({ kind: 'character', id: 'c1' })).toBe('#/gallery/characters?card=c1')
        expect(focusLink({ kind: 'resource', id: 'r1' })).toBe('#/gallery/resources?resource=r1')
    })
})

describe('buildGuideSection', () => {
    it('renders the localized docs with clickable workspace routes', () => {
        const guide = buildGuideSection(t)
        expect(guide.key).toBe('guide')
        expect(guide.markdown).toContain(`# ${t('docs.page.title')}`)
        expect(guide.markdown).toContain(`## ${t('docs.sections.resources.title')}`)
        expect(guide.markdown).toContain('(#/gallery/lorebooks)')
        expect(guide.count).toBeGreaterThan(5)
        expect(guide.tokens).toBeGreaterThan(0)
    })

    it('drops routes for pages the build hides', () => {
        const guide = buildGuideSection(t, (page) => page !== 'gallery-lorebooks')
        expect(guide.markdown).not.toContain('(#/gallery/lorebooks)')
        expect(guide.markdown).toContain('(#/gallery/characters)')
    })

    it('follows the active language', () => {
        const guide = buildGuideSection(i18n.getFixedT('es'))
        expect(guide.markdown).toContain(i18n.getFixedT('es')('docs.page.title'))
    })

    it.each(['en', 'es'])('shares localized WIP explanations with Docs while dropping disabled novel routes in %s', (language) => {
        setTestFeatureFlags({ novels: false })
        const translate = i18n.getFixedT(language)
        const docs = getDocsContent(translate)
        const novelBody = withNote(docs.writingGuide.find((item) => item.title === translate('docs.guides.writing.novels.title'))!)
        const guide = buildGuideSection(translate, isPageFeatureEnabled)

        expect(novelBody).toContain('WIP')
        expect(guide.markdown).toContain(novelBody)
        expect(guide.markdown).not.toContain('(#/gallery/stories)')
        expect(guide.markdown).not.toMatch(/copy Markdown|copia Markdown|stash|guardar aparte/)
    })

    it.each(['en', 'es'])('keeps disabled and planned roadmap work in assistant knowledge in %s', (language) => {
        setTestFeatureFlags({ novels: false })
        const translate = i18n.getFixedT(language)
        const { roadmap } = getDocsContent(translate)
        const novels = roadmap.items.find((item) => item.id === 'novels')!
        const charaStudio = roadmap.items.find((item) => item.id === 'charaStudio')!
        const guide = buildGuideSection(translate, isPageFeatureEnabled)

        expect(guide.markdown).toContain(`## ${translate('docs.sections.roadmap.title')}`)
        expect(guide.markdown).toContain(roadmap.reviewed)
        expect(guide.markdown).toContain(roadmap.note)
        expect(novels.status).toContain('WIP')
        expect(novels.availability).toContain('WIP')
        expect(charaStudio.status).toContain('WIP')
        for (const item of [novels, charaStudio]) {
            expect(guide.markdown).toContain(`### ${item.title} — ${item.status}`)
            expect(guide.markdown).toContain(item.availability)
            expect(guide.markdown).toContain(`**${roadmap.labels.current}** — ${item.current}`)
            expect(guide.markdown).toContain(`**${roadmap.labels.next}** — ${item.next}`)
            expect(guide.markdown).toContain(`**${roadmap.labels.decision}** — ${item.decision}`)
        }
        expect(guide.markdown).not.toContain('(#/gallery/stories)')
        expect(guide.markdown).not.toContain('(#/story)')
        expect(guide.markdown).not.toContain('docs.roadmap.')
    })

    it('uses available novel instructions and routes when the owning flag is on', () => {
        setTestFeatureFlags({ novels: true })
        const guide = buildGuideSection(t, isPageFeatureEnabled)
        const note = t('docs.availability.disabled', { features: t('docs.availability.features.novels') })

        expect(guide.markdown).toContain('(#/gallery/stories)')
        expect(guide.markdown).toContain(t('docs.guides.writing.novels.body'))
        expect(guide.markdown).not.toContain(note)
    })
})

describe('buildLibrarySection', () => {
    it('lists each card with a deep link, facts, and triggers, splitting personas out', () => {
        const section = buildLibrarySection(library(), t)
        expect(section.count).toBe(5)
        expect(section.markdown).toContain('[Mira Vell](#/gallery/characters?card=c1) (Elf · Archivist) — Keeper of the drowned library. · triggers: Mira, archivist')
        expect(section.markdown).toContain('[Wren](#/gallery/personas?card=p1)')
        expect(section.markdown).toContain('default persona')
        expect(section.markdown).toContain('[Saltmarsh](#/gallery/worlds?card=w1) (Coastal city)')
        expect(section.markdown).toContain('[The bells stop ringing](#/gallery/adventures?card=a1)')
    })

    it('says so when the library is empty', () => {
        const section = buildLibrarySection({ characters: [], worlds: [], items: [], adventures: [] }, t)
        expect(section.count).toBe(0)
        expect(section.markdown).toContain(t('appAssistant.knowledge.empty'))
    })

    it('stops at the section budget and reports the omission', () => {
        const many = Array.from({ length: 400 }, (_, index) => character({ id: `c${index}`, name: `Card ${index}`, description: 'x '.repeat(200) }))
        const section = buildLibrarySection({ characters: many, worlds: [], items: [], adventures: [] }, t)
        expect(section.truncated).toBe(true)
        expect(section.markdown.length).toBeLessThanOrEqual(KNOWLEDGE_LIMITS.section + 200)
        expect(section.markdown).toMatch(/more records omitted/)
    })
})

describe('composeKnowledge', () => {
    it('includes only enabled sources, but reports counts for all', () => {
        const knowledge = composeKnowledge({ t, library: library(), enabled: new Set<KnowledgeSourceKey>(['library']) })
        expect(knowledge.markdown).toContain('Mira Vell')
        expect(knowledge.markdown).not.toContain(t('docs.page.title'))
        expect(knowledge.markdown).not.toContain('Saltmarsh lore')
        expect(knowledge.sections.find((section) => section.key === 'lorebooks')?.count).toBe(1)
        expect(knowledge.sections.find((section) => section.key === 'resources')?.count).toBe(1)
    })

    it('puts focused records first, in full detail', () => {
        const knowledge = composeKnowledge({
            t, library: library(), enabled: ALL,
            focus: [{ kind: 'lorebook', id: 'l1' }, { kind: 'resource', id: 'r1' }, { kind: 'world', id: 'missing' }],
        })
        expect(knowledge.markdown.startsWith(`## ${t('appAssistant.knowledge.focusHeading')}`)).toBe(true)
        expect(knowledge.markdown).toContain('**Bell guild** [bell, guild]: The guild keeps the harbor bells.')
        expect(knowledge.markdown).toContain('The harbor belongs to all.')
        expect(knowledge.sections.find((section) => section.key === 'focus')?.count).toBe(2)
    })

    it('names the page the user came from', () => {
        const knowledge = composeKnowledge({ t, library: library(), enabled: new Set(), originPage: 'gallery-lorebooks' })
        expect(knowledge.markdown).toBe(`${t('appAssistant.knowledge.origin')}: #/gallery/lorebooks`)
    })

    it('never exceeds the total budget', () => {
        const big = Array.from({ length: 300 }, (_, index) => character({ id: `c${index}`, name: `Card ${index}`, description: 'y '.repeat(200) }))
        const knowledge = composeKnowledge({ t, library: library({ characters: big }), enabled: ALL })
        expect(knowledge.markdown.length).toBeLessThanOrEqual(KNOWLEDGE_LIMITS.total)
        expect(knowledge.truncated).toBe(true)
    })
})
