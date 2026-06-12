import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { AttributeCategory } from '@/ui/components/common/AttributeList'
import { useGuidedCard, readCategoryAttribute } from './useGuidedCard'
import type { EntityWithCategory } from './categorySerialization'
import type { CardFieldDefinition, CardTemplate, GuidedMirror } from './types'

const FIELDS: CardFieldDefinition[] = [
    {
        id: 'personality.motivation',
        label: 'Motivation',
        input: 'text',
        defaultActive: true,
        binding: { group: 'Personality', key: 'Motivation', groupDescription: 'What drives this character in play.' },
    },
    {
        id: 'personality.fear',
        label: 'Fear',
        input: 'text',
        defaultActive: ['character'],
        binding: { group: 'Personality', key: 'Fear' },
    },
    {
        id: 'voice.speech',
        label: 'Speech style',
        input: 'suggest',
        exampleHint: 'Gruff & warm',
        binding: { group: 'Voice', key: 'Speech Style', groupDescription: 'How they sound.' },
    },
    {
        id: 'boundaries.agency',
        label: 'Player agency',
        input: 'textarea',
        roles: ['persona'],
        defaultActive: ['persona'],
        binding: { group: 'Boundaries', key: 'Player Agency' },
    },
]

const DEFAULTS: AttributeCategory[] = [
    { id: 'stats', name: 'Stats', type: 'stat', description: 'Core attributes.' },
]

function setup(options: Partial<Parameters<typeof useGuidedCard>[0]> = {}) {
    return renderHook(
        (props: Partial<Parameters<typeof useGuidedCard>[0]>) =>
            useGuidedCard({ fields: FIELDS, defaults: DEFAULTS, role: 'character', ...options, ...props }),
        { initialProps: {} },
    )
}

describe('useGuidedCard', () => {
    it('starts with the default-active set for the current role', () => {
        const { result } = setup()
        const ids = result.current.activeFields.map((f) => f.id)
        expect(ids).toEqual(['personality.motivation', 'personality.fear'])
        // Persona-only fields are excluded from the palette for character role.
        expect(result.current.paletteFields.map((f) => f.id)).toEqual(['voice.speech'])
    })

    it('serializes non-empty guided values into grouped category payload', () => {
        const { result } = setup()
        act(() => {
            result.current.setValue('personality.motivation', 'Buy back the forge')
            result.current.setValue('voice.speech', 'Terse')
        })
        expect(result.current.toCategoryPayload()).toEqual([
            {
                name: 'Personality',
                description: 'What drives this character in play.',
                attributes: [{ Motivation: 'Buy back the forge' }],
            },
            {
                name: 'Voice',
                description: 'How they sound.',
                attributes: [{ 'Speech Style': 'Terse' }],
            },
        ])
    })

    it('round-trips: a saved payload rebinds guided fields and keeps leftovers as custom rows', () => {
        const entity: EntityWithCategory = {
            category: [
                {
                    name: 'personality', // case-insensitive group match
                    description: 'whatever',
                    attributes: [{ Motivation: 'Revenge' }, { Unknown: 'leftover' }],
                },
                { name: 'Stats', description: '', attributes: [{ Strength: '8' }] },
                { name: 'Lore', description: 'misc', attributes: [{ Origin: 'North' }] },
            ],
        }
        const { result } = setup({ entity })
        expect(result.current.values['personality.motivation']).toBe('Revenge')
        // Stats rows landed in the default category.
        expect(result.current.attributes['stats']).toEqual([{ key: 'Strength', value: '8' }])
        // Unmatched key in a guided group + unknown group become custom categories.
        const customNames = result.current.customCategories.map((c) => c.name)
        expect(customNames).toEqual(['personality', 'Lore'])
        // And serialization merges the guided value with the leftover rows into ONE group.
        const payload = result.current.toCategoryPayload()
        const personality = payload.find((c) => c.name === 'Personality')
        expect(personality?.attributes).toEqual([{ Motivation: 'Revenge' }, { Unknown: 'leftover' }])
        expect(payload.filter((c) => c.name.toLowerCase() === 'personality')).toHaveLength(1)
    })

    it('expands multi-key attribute objects so each key can bind its own field', () => {
        const entity = {
            category: [
                { name: 'Personality', description: '', attributes: [{ Motivation: 'Win', Fear: 'Water' }] },
            ],
        }
        const { result } = setup({ entity })
        expect(result.current.values['personality.motivation']).toBe('Win')
        expect(result.current.values['personality.fear']).toBe('Water')
    })

    it('merges a guided group with a same-named user custom group on serialize', () => {
        const { result } = setup()
        act(() => {
            result.current.setValue('personality.motivation', 'Glory')
        })
        let customId = ''
        act(() => {
            customId = result.current.addCategory('PERSONALITY', 'user made')
        })
        act(() => {
            result.current.addAttributeWith(customId, { key: 'Mood', value: 'Sunny' })
        })
        const payload = result.current.toCategoryPayload()
        expect(payload.filter((c) => c.name.toLowerCase() === 'personality')).toHaveLength(1)
        expect(payload[0].attributes).toEqual([{ Motivation: 'Glory' }, { Mood: 'Sunny' }])
    })

    it('applyTemplate sets the active set + hints but never clears typed values', () => {
        const { result } = setup()
        act(() => {
            result.current.setValue('personality.fear', 'Open water')
        })
        const template: CardTemplate = {
            id: 'mentor',
            name: 'The Mentor',
            tagline: 'They know the way.',
            fieldIds: ['voice.speech'],
            examples: { 'voice.speech': 'Warm but cryptic' },
        }
        act(() => {
            result.current.applyTemplate(template)
        })
        const ids = result.current.activeFields.map((f) => f.id)
        expect(ids).toContain('voice.speech')
        expect(ids).toContain('personality.fear') // typed value survives
        expect(ids).not.toContain('personality.motivation') // empty default deactivated
        expect(result.current.hints['voice.speech']).toBe('Warm but cryptic')
        expect(result.current.values['personality.fear']).toBe('Open water')

        // Empty card: only non-removable + valued fields stay.
        act(() => {
            result.current.applyTemplate(null)
        })
        expect(result.current.activeFields.map((f) => f.id)).toEqual(['personality.fear'])
    })

    it('useExample copies the effective hint into the value', () => {
        const { result } = setup()
        act(() => {
            result.current.activateField('voice.speech')
        })
        act(() => {
            result.current.useExample('voice.speech')
        })
        expect(result.current.values['voice.speech']).toBe('Gruff & warm')
    })

    it('removeField clears the value and returns the field to the palette', () => {
        const { result } = setup()
        act(() => {
            result.current.setValue('personality.fear', 'Heights')
        })
        act(() => {
            result.current.removeField('personality.fear')
        })
        expect(result.current.values['personality.fear']).toBe('')
        expect(result.current.activeFields.map((f) => f.id)).not.toContain('personality.fear')
        expect(result.current.paletteFields.map((f) => f.id)).toContain('personality.fear')
        expect(result.current.toCategoryPayload()).toEqual([])
    })

    it('role visibility: persona fields hide for character but valued fields survive a role switch', () => {
        const { result, rerender } = setup()
        // Switch to persona — the creator's role toggle surfaces persona defaults.
        rerender({ role: 'persona' })
        act(() => {
            result.current.activateDefaultsForRole('persona')
        })
        expect(result.current.activeFields.map((f) => f.id)).toContain('boundaries.agency')
        act(() => {
            result.current.setValue('boundaries.agency', 'Never decide for me')
        })
        // Switch back to character — the valued persona field stays visible, marked off-role…
        rerender({ role: 'character' })
        const agency = result.current.activeFields.find((f) => f.id === 'boundaries.agency')
        expect(agency).toBeDefined()
        expect(result.current.isOffRole(agency!)).toBe(true)
        // …and still serializes (removal is the only way to drop data).
        expect(result.current.toCategoryPayload()).toEqual([
            { name: 'Boundaries', description: '', attributes: [{ 'Player Agency': 'Never decide for me' }] },
        ])
        // But an EMPTY persona field is neither active nor offered in the palette.
        act(() => {
            result.current.removeField('boundaries.agency')
        })
        expect(result.current.activeFields.map((f) => f.id)).not.toContain('boundaries.agency')
        expect(result.current.paletteFields.map((f) => f.id)).not.toContain('boundaries.agency')
        expect(result.current.toCategoryPayload()).toEqual([])
    })

    it('mirrors serialize alongside guided fields and hydrate via onHydrate', () => {
        const onHydrate = vi.fn()
        const mirror: GuidedMirror = {
            group: 'Setting',
            key: 'Place type',
            groupDescription: 'Scale of the place.',
            value: 'city',
            onHydrate,
        }
        const { result } = setup({ mirrors: [mirror] })
        expect(result.current.toCategoryPayload()).toEqual([
            { name: 'Setting', description: 'Scale of the place.', attributes: [{ 'Place type': 'city' }] },
        ])
        act(() => {
            result.current.hydrateFrom({
                category: [{ name: 'Setting', description: '', attributes: [{ 'Place type': 'landmark' }] }],
            })
        })
        expect(onHydrate).toHaveBeenCalledWith('landmark')
        // The mirrored row never leaks into custom categories.
        expect(result.current.customCategories).toEqual([])
    })

    it('hydrateFrom with preserveActive keeps scaffolding but replaces values wholesale', () => {
        const { result } = setup()
        act(() => {
            result.current.activateField('voice.speech')
            result.current.applyTemplate({
                id: 't',
                name: 'T',
                tagline: '',
                fieldIds: ['voice.speech', 'personality.motivation'],
                examples: { 'voice.speech': 'Menacingly polite' },
            })
        })
        act(() => {
            result.current.setValue('personality.motivation', 'Old value')
        })
        act(() => {
            result.current.hydrateFrom(
                { category: [{ name: 'Personality', description: '', attributes: [{ Fear: 'Fire' }] }] },
                { preserveActive: true },
            )
        })
        // Bound value applied, unbound values reset, active set + hints preserved.
        expect(result.current.values['personality.fear']).toBe('Fire')
        expect(result.current.values['personality.motivation']).toBeUndefined()
        const ids = result.current.activeFields.map((f) => f.id)
        expect(ids).toContain('voice.speech')
        expect(ids).toContain('personality.motivation')
        expect(ids).toContain('personality.fear')
        expect(result.current.hints['voice.speech']).toBe('Menacingly polite')
    })

    it('hydrateFrom without preserveActive resets to default-active ∪ bound', () => {
        const { result } = setup()
        act(() => {
            result.current.activateField('voice.speech')
        })
        act(() => {
            result.current.hydrateFrom({
                category: [{ name: 'Voice', description: '', attributes: [{ 'Speech Style': 'Terse' }] }],
            })
        })
        const ids = result.current.activeFields.map((f) => f.id)
        expect(ids).toEqual(['personality.motivation', 'personality.fear', 'voice.speech'])
        expect(result.current.values['voice.speech']).toBe('Terse')
    })

    it('projects guided + custom groups into preview categories/attributes', () => {
        const { result } = setup()
        act(() => {
            result.current.setValue('personality.motivation', 'Win the bet')
            result.current.addAttributeWith('stats', { key: 'Strength', value: '8' })
        })
        const names = result.current.previewCategories.map((c) => c.name)
        expect(names).toEqual(['Personality', 'Stats'])
        const personalityId = result.current.previewCategories[0].id
        expect(result.current.previewAttributes[personalityId]).toEqual([
            { key: 'Motivation', value: 'Win the bet' },
        ])
    })

    it('readCategoryAttribute finds values case-insensitively', () => {
        const entity = {
            category: [{ name: 'setting', description: '', attributes: [{ 'place TYPE': 'plane' }] }],
        }
        expect(readCategoryAttribute(entity, 'Setting', 'Place type')).toBe('plane')
        expect(readCategoryAttribute(entity, 'Setting', 'Missing')).toBeUndefined()
    })
})
