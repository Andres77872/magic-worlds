import { beforeEach, describe, expect, it } from 'vitest'
import {
    accountStorageKey,
    apiStorageOrigin,
    ASSISTANT_FOCUS_STORAGE_BASE,
    migratePreR1WorkspaceStorage,
    workspaceStorageKey,
} from './workspaceStorage'

const ORIGIN = 'https://api.example.test'
const DEFAULT_ID = '0f1e2d3c-4b5a-4978-8a6b-5c4d3e2f1a0b'
const OTHER_ID = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d'
const focusKey = (workspaceId: string, userHash = 'user-a') =>
    workspaceStorageKey(ASSISTANT_FOCUS_STORAGE_BASE, { apiOrigin: ORIGIN, userHash, workspaceId })

describe('workspace storage keys', () => {
    it('keys by API origin + userHash (+ workspace), never by the transient accountKey', () => {
        expect(apiStorageOrigin('http://localhost:8010/api/')).toBe('http://localhost:8010')
        expect(focusKey(DEFAULT_ID)).toBe(`magic-worlds-assistant-focus::https%3A%2F%2Fapi.example.test::user-a::${DEFAULT_ID}`)
        expect(focusKey(DEFAULT_ID)).not.toBe(focusKey(OTHER_ID))
        expect(focusKey(DEFAULT_ID)).not.toBe(focusKey(DEFAULT_ID, 'user-b'))
        expect(workspaceStorageKey('x', { apiOrigin: 'https://other.test', userHash: 'user-a', workspaceId: DEFAULT_ID }))
            .not.toBe(workspaceStorageKey('x', { apiOrigin: ORIGIN, userHash: 'user-a', workspaceId: DEFAULT_ID }))
        expect(accountStorageKey('last', { apiOrigin: ORIGIN, userHash: 'user-a' })).toBe('last::https%3A%2F%2Fapi.example.test::user-a')
    })
})

describe('pre-R1 storage migration', () => {
    const migration = { apiOrigin: ORIGIN, userHash: 'user-a', defaultWorkspaceId: DEFAULT_ID }

    beforeEach(() => localStorage.clear())

    it('moves the current shelf into the protected default once and deletes every legacy key of the user', () => {
        localStorage.setItem('magic-worlds-assistant-focus:user:user-a:0', JSON.stringify([{ kind: 'world', id: 'w0' }]))
        localStorage.setItem('magic-worlds-assistant-focus:user:user-a:3', JSON.stringify([{ kind: 'world', id: 'w3' }]))
        localStorage.setItem('magic-worlds-assistant-focus:user:user-a:4', 'not json')

        expect(migratePreR1WorkspaceStorage({ ...migration, currentAccountKey: 'user:user-a:3' })).toBe(true)
        expect(JSON.parse(localStorage.getItem(focusKey(DEFAULT_ID))!)).toEqual([{ kind: 'world', id: 'w3' }])
        expect(localStorage.getItem('magic-worlds-assistant-focus:user:user-a:0')).toBeNull()
        expect(localStorage.getItem('magic-worlds-assistant-focus:user:user-a:3')).toBeNull()
        expect(localStorage.getItem('magic-worlds-assistant-focus:user:user-a:4')).toBeNull()
        expect(localStorage.getItem(focusKey(OTHER_ID))).toBeNull()

        // Once only: a later legacy write (an old tab) is not moved again.
        localStorage.setItem('magic-worlds-assistant-focus:user:user-a:0', JSON.stringify([{ kind: 'item', id: 'i1' }]))
        expect(migratePreR1WorkspaceStorage(migration)).toBe(false)
        expect(JSON.parse(localStorage.getItem(focusKey(DEFAULT_ID))!)).toEqual([{ kind: 'world', id: 'w3' }])
    })

    it('falls back to the reload-time shelf and never overwrites an existing default entry', () => {
        localStorage.setItem('magic-worlds-assistant-focus:user:user-a:2', JSON.stringify([{ kind: 'world', id: 'w2' }]))
        localStorage.setItem('magic-worlds-assistant-focus:user:user-a:0', JSON.stringify([{ kind: 'world', id: 'w0' }]))
        migratePreR1WorkspaceStorage({ ...migration, currentAccountKey: 'user:user-a:9' })
        expect(JSON.parse(localStorage.getItem(focusKey(DEFAULT_ID))!)).toEqual([{ kind: 'world', id: 'w0' }])

        localStorage.clear()
        localStorage.setItem(focusKey(DEFAULT_ID), JSON.stringify([{ kind: 'item', id: 'kept' }]))
        localStorage.setItem('magic-worlds-assistant-focus:user:user-a:0', JSON.stringify([{ kind: 'world', id: 'w0' }]))
        migratePreR1WorkspaceStorage(migration)
        expect(JSON.parse(localStorage.getItem(focusKey(DEFAULT_ID))!)).toEqual([{ kind: 'item', id: 'kept' }])
        expect(localStorage.getItem('magic-worlds-assistant-focus:user:user-a:0')).toBeNull()
    })

    it('leaves global preferences and other users alone', () => {
        localStorage.setItem('magic-worlds-assistant-sources-off', JSON.stringify(['novels']))
        localStorage.setItem('magic-worlds-assistant-focus:user:user-b:0', JSON.stringify([{ kind: 'world', id: 'b' }]))
        localStorage.setItem('magic-worlds-assistant-focus:user:user-ab:0', JSON.stringify([{ kind: 'world', id: 'ab' }]))
        migratePreR1WorkspaceStorage(migration)
        expect(localStorage.getItem('magic-worlds-assistant-sources-off')).not.toBeNull()
        expect(localStorage.getItem('magic-worlds-assistant-focus:user:user-b:0')).not.toBeNull()
        expect(localStorage.getItem('magic-worlds-assistant-focus:user:user-ab:0')).not.toBeNull()
        expect(localStorage.getItem(focusKey(DEFAULT_ID))).toBeNull()
    })
})
