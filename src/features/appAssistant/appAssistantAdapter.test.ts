import { describe, expect, it } from 'vitest'
import { appAssistantAdapter, titleFromQuestion } from './appAssistantAdapter'

const binding = { context: '## Library cards\n- Mira', locale: 'es' as const, page: '#/gallery/lorebooks' }

describe('titleFromQuestion', () => {
    it('uses the first non-empty line, clipped', () => {
        expect(titleFromQuestion('\n  Where are lorebooks?\nsecond line')).toBe('Where are lorebooks?')
        expect(titleFromQuestion('x'.repeat(200))).toHaveLength(80)
        expect(titleFromQuestion('x'.repeat(200)).endsWith('…')).toBe(true)
    })
})

describe('appAssistantAdapter', () => {
    it('lives on its own page and lists every app conversation', () => {
        expect(appAssistantAdapter.lifecycle).toBe('page')
        expect(appAssistantAdapter.scope(binding)).toEqual({ kind: 'app' })
    })

    it('titles a conversation from the opening question', () => {
        expect(appAssistantAdapter.title(binding, 'How do resources work?\nAnd lorebooks?')).toBe('How do resources work?')
    })

    it('sends the question with the knowledge, the reply language, and the origin page', () => {
        expect(appAssistantAdapter.turnBody(binding, 'Hola', null)).toEqual({
            kind: 'app',
            message: 'Hola',
            context: '## Library cards\n- Mira',
            locale: 'es',
            page: '#/gallery/lorebooks',
        })
    })
})
