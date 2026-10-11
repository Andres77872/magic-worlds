import { describe, expect, it } from 'vitest'
import type { Lorebook } from '@/shared/types/lorebook.types'
import { lorebookAssistantAdapter } from './lorebookAssistantAdapter'
import { DEFAULT_LOREBOOK_SETTINGS } from './lorebookTransforms'

function lorebook(overrides: Partial<Lorebook> = {}): Lorebook {
    return {
        id: '',
        name: 'Saltmarsh lore',
        description: 'Bells and tides.',
        tags: ['coast'],
        enabled: true,
        settings: { ...DEFAULT_LOREBOOK_SETTINGS },
        entries: [],
        attachments: [],
        metadata: { source: 'import' },
        ...overrides,
    }
}

const TARGET_CAS = { revision: '2026-09-19T00:43:33', content_hash: 'a'.repeat(64) }

describe('lorebookAssistantAdapter', () => {
    it('lists the unbound conversations for a draft and the bound ones once saved', () => {
        expect(lorebookAssistantAdapter.lifecycle).toBe('panel')
        expect(lorebookAssistantAdapter.scope({ targetId: null, title: 'Lore', current: lorebook() })).toEqual({ kind: 'lorebook' })
        expect(lorebookAssistantAdapter.scope({ targetId: 'lb-1', title: 'Lore', current: lorebook({ id: 'lb-1' }) }))
            .toEqual({ kind: 'lorebook', lorebook_id: 'lb-1' })
        expect(lorebookAssistantAdapter.title({ targetId: null, title: 'Lore', current: lorebook() }, 'Add a guild')).toBe('Lore')
    })

    it('sends an unsaved draft in its stored shape, without metadata or an id', () => {
        const body = lorebookAssistantAdapter.turnBody({ targetId: null, title: 'Lore', current: lorebook() }, 'Add a guild', null)
        expect(body).toMatchObject({ kind: 'lorebook', message: 'Add a guild', current: { name: 'Saltmarsh lore', tags: ['coast'] } })
        expect(body.current).not.toHaveProperty('metadata')
        expect(body.current).not.toHaveProperty('id')
        expect(body).not.toHaveProperty('expected_revision')
    })

    it('adds the saved id and the CAS snapshot once the book is bound', () => {
        const current = lorebook({ id: 'lb-1' })
        const body = lorebookAssistantAdapter.turnBody({ targetId: 'lb-1', title: 'Lore', current }, 'Add a guild', { target: current, cas: TARGET_CAS })
        expect(body).toMatchObject({
            kind: 'lorebook',
            current: { id: 'lb-1', name: 'Saltmarsh lore' },
            expected_revision: TARGET_CAS.revision,
            expected_content_hash: TARGET_CAS.content_hash,
        })
    })
})
