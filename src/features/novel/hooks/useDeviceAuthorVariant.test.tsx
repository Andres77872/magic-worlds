import { StrictMode, type ReactNode } from 'react'
import { act, renderHook } from '@testing-library/react'
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { scopedNovelMutationKey } from '@/shared/novelMutationJournal'
import { manuscript } from '@/test/fixtures/story'
import { authorVariantFixture } from '@/test/fixtures/authorVariants'
import { AUTHOR_VARIANT_DOMAIN, authorVariantIntent, editAuthorVariantDraft, newAuthorVariantDraft, readRetainedAuthorVariant, writeAuthorVariantDraft } from '../persistence/authorVariantJournal'
import { useDeviceAuthorVariant } from './useDeviceAuthorVariant'

function fixture() {
    const scope = { apiOrigin: 'https://original-author.example', userHash: 'device-writer', workspaceId: 'desk:one' }
    const initial = { ...newAuthorVariantDraft(authorVariantFixture().context, true), title: 'Original private writing', seeded: true }
    const value = { ...initial, pending: { kind: 'create' as const, sequence: initial.sequence,
        write: { requestId: 'original-uncertain-create', reviewedHash: 'a'.repeat(64), intent: authorVariantIntent(initial) } } }
    const key = scopedNovelMutationKey(AUTHOR_VARIANT_DOMAIN, { ...scope, storyId: value.storyId }, value.context.parent.parent.id, 'original-writer')!
    writeAuthorVariantDraft(key, value)
    return { scope, key, item: readRetainedAuthorVariant(key, scope)! }
}
beforeEach(() => { localStorage.clear(); vi.restoreAllMocks() })
afterEach(() => { vi.restoreAllMocks() })

it('retains a separate writer before editing and preserves the exact uncertain request alongside later text', () => {
    const f = fixture(), original = localStorage.getItem(f.key)
    const hook = renderHook(() => useDeviceAuthorVariant(f.item, () => true, false))
    act(() => { expect(hook.result.current.begin()).toBe(true) })
    expect(hook.result.current.key).not.toBe(f.key)
    expect(hook.result.current.key).toContain(encodeURIComponent(f.scope.apiOrigin))
    expect(localStorage.getItem(f.key)).toBe(original)
    act(() => hook.result.current.edit({ title: 'Later device version', document: manuscript('A private ending retained offline.') }))
    act(() => { expect(hook.result.current.preserve()).toBe(true) })
    const retained = readRetainedAuthorVariant(hook.result.current.key!, f.scope)!
    expect(retained.record.write.title).toBe('Later device version')
    expect(retained.record.write.pending).toEqual(f.item.record.write.pending)
    expect(localStorage.getItem(f.key)).toBe(original)
})

it('locks on archive without replacing the latest local writing and resumes only when the parent permits editing', () => {
    const f = fixture(), hook = renderHook(({ readOnly }) => useDeviceAuthorVariant(f.item, () => true, readOnly), { initialProps: { readOnly: false } })
    act(() => { hook.result.current.begin(); hook.result.current.edit({ title: 'Keep through archive' }) })
    hook.rerender({ readOnly: true })
    act(() => hook.result.current.edit({ title: 'Must not overwrite while archived' }))
    expect(hook.result.current.draft.title).toBe('Keep through archive')
    act(() => { expect(hook.result.current.preserve()).toBe(true) })
    hook.rerender({ readOnly: false })
    act(() => hook.result.current.edit({ title: 'Restored private writing' }))
    expect(hook.result.current.draft.title).toBe('Restored private writing')
})

it('blocks a new copy when storage fails and keeps an unsaved later edit recoverable in memory', () => {
    const f = fixture(), original = localStorage.getItem(f.key), hook = renderHook(() => useDeviceAuthorVariant(f.item, () => true, false))
    const blocked = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Full', 'QuotaExceededError') })
    act(() => { expect(hook.result.current.begin()).toBe(false) })
    expect(hook.result.current.isCopy).toBe(false)
    expect(hook.result.current.storageFailed).toBe(true)
    blocked.mockRestore()
    act(() => { expect(hook.result.current.begin()).toBe(true) })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Full', 'QuotaExceededError') })
    act(() => hook.result.current.edit({ title: 'Retain this final keystroke' }))
    act(() => { expect(hook.result.current.preserve()).toBe(false) })
    expect(hook.result.current.draft.title).toBe('Retain this final keystroke')
    expect(localStorage.getItem(f.key)).toBe(original)
})

it('cannot revive an old owner after an observed sign-out/sign-in cycle', () => {
    const f = fixture(); let current = true
    const hook = renderHook(() => useDeviceAuthorVariant(f.item, () => current, false))
    act(() => { hook.result.current.begin(); hook.result.current.edit({ title: 'Before sign out' }) })
    current = false; hook.rerender()
    current = true; hook.rerender()
    act(() => hook.result.current.edit({ title: 'Old callback must stay retired' }))
    expect(hook.result.current.draft.title).toBe('Before sign out')
    expect(hook.result.current.preserve()).toBe(false)
})

it('survives StrictMode effect replay and never overwrites a concurrent update to the original writer', () => {
    const f = fixture(), wrapper = ({ children }: { children: ReactNode }) => <StrictMode>{children}</StrictMode>
    const hook = renderHook(() => useDeviceAuthorVariant(f.item, () => true, false), { wrapper })
    act(() => { expect(hook.result.current.begin()).toBe(true) })
    expect(writeAuthorVariantDraft(f.key, editAuthorVariantDraft(f.item.record.write, { title: 'Another tab’s newer original' })!)).toBe(true)
    const newer = localStorage.getItem(f.key)
    act(() => hook.result.current.edit({ title: 'Independent local continuation' }))
    const key = hook.result.current.key!
    hook.unmount()
    expect(localStorage.getItem(f.key)).toBe(newer)
    expect(readRetainedAuthorVariant(key, f.scope)?.record.write.title).toBe('Independent local continuation')
})
