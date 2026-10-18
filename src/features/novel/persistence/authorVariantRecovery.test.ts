import { beforeEach, expect, it, vi } from 'vitest'
import { scopedNovelMutationKey } from '@/shared/novelMutationJournal'
import { manuscript } from '@/test/fixtures/story'
import { authorVariantFixture } from '@/test/fixtures/authorVariants'
import { AUTHOR_VARIANT_DOMAIN, authorVariantIntent, editAuthorVariantDraft, isAuthorVariantDraft, listRetainedAuthorVariants,
    newAuthorVariantDraft, readRetainedAuthorVariant, readRetainedAuthorVariantRaw, subscribeAuthorVariantDrafts, writeAuthorVariantDraft } from './authorVariantJournal'

const account = { apiOrigin: 'https://author-api.example:8443', userHash: 'author:one' }, scope = { ...account, workspaceId: 'desk:one' }
function draft() {
    const value = { ...newAuthorVariantDraft(authorVariantFixture().context, true), title: 'Retained candlelight', seeded: true }
    return { ...value, pending: { kind: 'create' as const, sequence: value.sequence,
        write: { requestId: 'uncertain-author-create', reviewedHash: 'a'.repeat(64), intent: authorVariantIntent(value) } } }
}
function key(value = draft(), writer = 'first', workspace = scope) {
    return scopedNovelMutationKey(AUTHOR_VARIANT_DOMAIN, { ...workspace, storyId: value.storyId }, value.context.parent.parent.id, writer)!
}
beforeEach(() => { localStorage.clear(); vi.restoreAllMocks() })

it('discovers every exact writer across this account’s workspaces without a cached novel', () => {
    const value = draft(), first = key(value), second = key(value, 'refused:old-request'), otherDesk = key(value, 'third', { ...scope, workspaceId: 'desk:two' })
    for (const target of [first, second, otherDesk]) expect(writeAuthorVariantDraft(target, value)).toBe(true)
    writeAuthorVariantDraft(key(value, 'foreign', { ...scope, userHash: 'other-author' }), value)
    writeAuthorVariantDraft(key(value, 'foreign', { ...scope, apiOrigin: 'https://another-api.example' }), value)
    const result = listRetainedAuthorVariants(account)
    expect(result.unavailable).toBe(false)
    expect(result.unreadableKeys).toEqual([])
    expect(new Set(result.items.map(item => item.record.storageKey))).toEqual(new Set([first, second, otherDesk]))
    expect(result.items.find(item => item.record.storageKey === otherDesk)?.scope.workspaceId).toBe('desk:two')
})

it('does not substitute a neighbouring writer after the selected record disappears', () => {
    const value = draft(), first = key(value), second = key(value, 'second')
    writeAuthorVariantDraft(first, value); writeAuthorVariantDraft(second, editAuthorVariantDraft(value, { title: 'Another writer' })!)
    localStorage.removeItem(first)
    expect(readRetainedAuthorVariant(first, account)).toBeNull()
    expect(readRetainedAuthorVariant(second, account)?.record.write.title).toBe('Another writer')
})

it('refuses a record whose body belongs to a different novel while preserving its raw recovery bytes', () => {
    const value = draft(), target = key(value), body = JSON.stringify({ schema: 1, writtenAt: 1, write: { ...value, storyId: 'different-novel' } })
    localStorage.setItem(target, body)
    expect(readRetainedAuthorVariant(target, account)).toBeNull()
    expect(listRetainedAuthorVariants(account).unreadableKeys).toEqual([target])
    expect(readRetainedAuthorVariantRaw(target, account)).toBe(body)
    expect(readRetainedAuthorVariantRaw(target, { ...account, userHash: 'different-author' })).toBeNull()
    expect(localStorage.getItem(target)).toBe(body)
})

it('preserves invalid JSON and unknown envelopes without treating them as request authority', () => {
    const value = draft(), broken = key(value), extra = key(value, 'unknown-envelope')
    localStorage.setItem(broken, '{truncated private writing')
    localStorage.setItem(extra, JSON.stringify({ schema: 1, write: value, writtenAt: 4, credential: 'untrusted-extra' }))
    const result = listRetainedAuthorVariants(account)
    expect(result.items).toEqual([])
    expect(new Set(result.unreadableKeys)).toEqual(new Set([broken, extra]))
    expect(readRetainedAuthorVariantRaw(broken, account)).toBe('{truncated private writing')
    expect(localStorage.length).toBe(2)
})

it('reports blocked enumeration without clearing an existing private record', () => {
    const value = draft(), target = key(value)
    writeAuthorVariantDraft(target, value)
    const before = localStorage.getItem(target)
    const blocked = vi.spyOn(Storage.prototype, 'key').mockImplementation(() => { throw new DOMException('Blocked', 'SecurityError') })
    expect(listRetainedAuthorVariants(account).unavailable).toBe(true)
    blocked.mockRestore()
    expect(localStorage.getItem(target)).toBe(before)
})

it('rotates only the later author intent while retaining an uncertain create and earlier refusal exactly', () => {
    const original = draft(), value = { ...original, refusal: { reason: 'sources_changed' as const, pending: structuredClone(original.pending) } }
    const changed = editAuthorVariantDraft(value, { title: 'Later writing', document: manuscript('The newer private letter stays sealed.') })!
    expect(isAuthorVariantDraft(changed)).toBe(true)
    expect(changed.pending).toEqual(value.pending)
    expect(changed.refusal).toEqual(value.refusal)
    expect(changed.context).toEqual(value.context)
    expect(changed.variantId).not.toBe(value.variantId)
    expect(changed.operationId).not.toBe(value.operationId)
    expect(changed.sequence).toBe(value.sequence + 1)
    expect(value.title).toBe('Retained candlelight')
})

it('reads old drafts without workspace hints and validates optional hints without adding them to remote intent', () => {
    const value = draft(), old = structuredClone(value)
    Reflect.deleteProperty(old, 'isDefaultWorkspace')
    expect(isAuthorVariantDraft(old)).toBe(true)
    expect(isAuthorVariantDraft({ ...value, isDefaultWorkspace: 'yes' })).toBe(false)
    expect(authorVariantIntent(value)).not.toHaveProperty('isDefaultWorkspace')
})

it('publishes scoped draft writes and cross-tab author events, then unsubscribes cleanly', () => {
    const refresh = vi.fn(), unsubscribe = subscribeAuthorVariantDrafts(refresh), value = draft()
    writeAuthorVariantDraft(key(value), value)
    expect(refresh).toHaveBeenCalledTimes(1)
    window.dispatchEvent(new StorageEvent('storage', { key: 'unrelated-setting' }))
    expect(refresh).toHaveBeenCalledTimes(1)
    window.dispatchEvent(new StorageEvent('storage', { key: key(value) }))
    expect(refresh).toHaveBeenCalledTimes(2)
    unsubscribe(); writeAuthorVariantDraft(key(value, 'later'), value)
    expect(refresh).toHaveBeenCalledTimes(2)
})
