import { describe, expect, it } from 'vitest'
import { i18n } from '@/app/i18n'
import type { CardPreview } from '@/features/cards/cardPreview'
import {
    buildHoverNameIndex,
    focusMatchKey,
    hoverCardFromLibrary,
    hoverCardFromPreview,
    linkifyHoverText,
    parseHoverCardHref,
    previewTargetFor,
} from './hoverCardModel'
import { hoverCardLibrary, kaiEn, lyra } from './hoverCardFixtures'

const t = i18n.getFixedT('en')

describe('parseHoverCardHref', () => {
    it('recognizes card and lorebook links', () => {
        expect(parseHoverCardHref('#/gallery/characters?card=c1')).toEqual({ kind: 'character', id: 'c1' })
        expect(parseHoverCardHref('#/gallery/personas?card=p1')).toEqual({ kind: 'persona', id: 'p1' })
        expect(parseHoverCardHref('#/gallery/worlds?card=w1')).toEqual({ kind: 'world', id: 'w1' })
        expect(parseHoverCardHref('#/gallery/items?card=i1')).toEqual({ kind: 'item', id: 'i1' })
        expect(parseHoverCardHref('#/gallery/adventures?card=a1')).toEqual({ kind: 'adventure', id: 'a1' })
        expect(parseHoverCardHref('#/lorebook?lorebook=l1')).toEqual({ kind: 'lorebook', id: 'l1' })
    })

    it('leaves every other link alone', () => {
        expect(parseHoverCardHref('#/gallery/characters')).toBeNull()
        expect(parseHoverCardHref('#/story?story=s1')).toBeNull()
        expect(parseHoverCardHref('#/gallery/resources?resource=r1')).toBeNull()
        expect(parseHoverCardHref('https://example.com/#/gallery/characters?card=c1')).toBeNull()
        expect(parseHoverCardHref(undefined)).toBeNull()
    })

    it('maps records to preview targets (lorebooks have none)', () => {
        expect(previewTargetFor({ kind: 'adventure', id: 'a1' })).toEqual({ type: 'adventure_template', id: 'a1' })
        expect(previewTargetFor({ kind: 'persona', id: 'p1' })).toEqual({ type: 'persona', id: 'p1' })
        expect(previewTargetFor({ kind: 'lorebook', id: 'l1' })).toBeNull()
    })

    it('compares personas and characters as the same record for focus', () => {
        expect(focusMatchKey({ kind: 'persona', id: 'p1' })).toBe(focusMatchKey({ kind: 'character', id: 'p1' }))
        expect(focusMatchKey({ kind: 'world', id: 'p1' })).not.toBe(focusMatchKey({ kind: 'character', id: 'p1' }))
    })
})

describe('hoverCardFromLibrary', () => {
    it('builds a character preview with version, badge, and the first three tags', () => {
        const model = hoverCardFromLibrary(hoverCardLibrary, { kind: 'character', id: lyra.id }, t)
        expect(model).toMatchObject({
            ref: { kind: 'character', id: 'c-lyra' },
            title: 'Lyra Brisaveloz',
            badge: 'Elf · Scout',
            version: 3,
            tags: ['Lyra', 'scout', 'Aerindor'],
            moreTags: 1,
            inLibrary: true,
        })
    })

    it('normalizes a persona reached through a character link', () => {
        const model = hoverCardFromLibrary(hoverCardLibrary, { kind: 'character', id: 'p-dan' }, t)
        expect(model?.ref).toEqual({ kind: 'persona', id: 'p-dan' })
        expect(model?.badge).toBe('Human · Default persona')
    })

    it('titles an adventure by its first sentence and links its world and cast', () => {
        const model = hoverCardFromLibrary(hoverCardLibrary, { kind: 'adventure', id: 'a-conclave' }, t)
        expect(model?.title).toBe('A grand gathering of wizards from across the realms')
        expect(model?.description.startsWith('Every hundred years')).toBe(true)
        expect(model?.relations).toEqual([
            { role: 'world', name: 'Aerindor', ref: { kind: 'world', id: 'w-aerindor' } },
            { role: 'cast', name: 'Theron Mistwood', ref: { kind: 'character', id: 'c-theron' } },
            { role: 'cast', name: 'Elara Frostveil', ref: { kind: 'character', id: 'c-elara' } },
        ])
    })

    it('describes a lorebook by its entry count and first entries', () => {
        const model = hoverCardFromLibrary(hoverCardLibrary, { kind: 'lorebook', id: 'l-resonance' }, t)
        expect(model).toMatchObject({ badge: '8 entries', tags: ['Resonance cost', 'Leyline anchors', 'Overcasting'], moreTags: 5, imageUrl: null })
    })

    it('returns null for a record outside the library', () => {
        expect(hoverCardFromLibrary(hoverCardLibrary, { kind: 'character', id: 'gone' }, t)).toBeNull()
        expect(hoverCardFromLibrary(hoverCardLibrary, { kind: 'lorebook', id: 'gone' }, t)).toBeNull()
    })
})

describe('hoverCardFromPreview', () => {
    it('keeps a fetched card out of focus and shortens an adventure title', () => {
        const preview: CardPreview = {
            id: 'a9', type: 'adventure_template', mediaType: 'adventure_template', title: 'The tide turns. Everyone runs.',
            description: 'The tide turns. Everyone runs.', triggers: [], badge: 'Saltmarsh',
        }
        const model = hoverCardFromPreview(preview, { kind: 'adventure', id: 'a9' })
        expect(model).toMatchObject({ title: 'The tide turns', description: 'Everyone runs.', badge: 'Saltmarsh', inLibrary: false })
    })
})

describe('linkifyHoverText', () => {
    const index = buildHoverNameIndex(hoverCardLibrary)

    it('links other library names once, as whole words', () => {
        const segments = linkifyHoverText(lyra.description ?? '', index, { kind: 'character', id: lyra.id })
        const links = segments.filter((segment) => typeof segment !== 'string')
        expect(links).toEqual([
            { text: 'Aerindor', ref: { kind: 'world', id: 'w-aerindor' } },
            { text: 'Theron Mistwood', ref: { kind: 'character', id: 'c-theron' } },
        ])
        expect(segments.map((segment) => (typeof segment === 'string' ? segment : segment.text)).join('')).toBe(lyra.description)
    })

    it('leaves a name shared by several records plain, and never links the card itself', () => {
        const text = 'Kai owes Kai a favor.'
        expect(linkifyHoverText(text, index, { kind: 'character', id: lyra.id })).toEqual([text])
        // From one Kai, the only other "Kai" is unambiguous.
        expect(linkifyHoverText(text, index, { kind: 'character', id: kaiEn.id })[0]).toEqual({ text: 'Kai', ref: { kind: 'character', id: 'c-kai-es' } })
    })

    it('ignores matches inside longer words and different casing', () => {
        expect(linkifyHoverText('Aerindorian travelers say aerindor', index, { kind: 'character', id: lyra.id })).toEqual(['Aerindorian travelers say aerindor'])
    })

    it('skips names too short to be safe', () => {
        const short = buildHoverNameIndex({ ...hoverCardLibrary, worlds: [{ ...hoverCardLibrary.worlds[0], name: 'w' }], characters: [], items: [], lorebooks: [] })
        expect(short.pattern).toBeNull()
        expect(linkifyHoverText('w is a world', short, { kind: 'character', id: 'x' })).toEqual(['w is a world'])
    })
})
