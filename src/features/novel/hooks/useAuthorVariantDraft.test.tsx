import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { manuscript } from '@/test/fixtures/story'
import { controlledAuthorVariants } from '@/test/fixtures/controlledAuthorVariants'
import { useAuthorVariantDraft } from './useAuthorVariantDraft'
import type { AuthorVariantPending } from '../persistence/authorVariantJournal'
import { ApiError } from '@/infrastructure/api'
import { AUTHOR_VARIANT_DOMAIN, editAuthorVariantDraft, newAuthorVariantDraft, readAuthorVariantDraft, writeAuthorVariantDraft } from '../persistence/authorVariantJournal'
import { novelMutationKey } from '@/shared/novelMutationJournal'

beforeEach(() => { localStorage.clear(); vi.restoreAllMocks() })
function mount(f = controlledAuthorVariants({ empty: true })) {
    const props = { source: f.source, generationId: f.generation.id, readOnly: false }
    return { ...f, props, ...renderHook(value => useAuthorVariantDraft(value), { initialProps: props }) }
}
async function prepare(test: ReturnType<typeof mount>) {
    await waitFor(() => expect(test.result.current.draft).not.toBeNull())
    act(() => { test.result.current.seed(test.snapshot.operation.document); test.result.current.edit({ title: 'My quieter version' }) })
    await act(async () => { await test.result.current.prepare() })
    expect(test.result.current.preview).not.toBeNull()
}
it('saves a reviewed private document once, independently of the original model and manuscript', async () => {
    const test = mount(), create = vi.spyOn(test.source, 'create'), lookup = vi.spyOn(test.source, 'result')
    await prepare(test)
    await act(async () => { await test.result.current.save() })
    expect(lookup).toHaveBeenCalledOnce(); expect(create).toHaveBeenCalledOnce()
    expect(test.result.current.draft?.pending).toBeNull(); expect(test.result.current.isCurrentSaved).toBe(true)
    expect(test.result.current.record?.variant.operation.document).toEqual(test.snapshot.operation.document)
    expect(test.result.current.draft?.context.parent.parent.output).toBe(test.generation.output)
    expect(test.scene.document).toEqual(test.snapshot.baseDocument)
    await act(async () => { await test.result.current.save() })
    expect(create).toHaveBeenCalledOnce()
})
it('keeps later typing across a lost creation reply, remount and receipt-only recovery without a second create', async () => {
    const f = controlledAuthorVariants({ empty: true }), original = f.source.create.bind(f.source)
    const create = vi.spyOn(f.source, 'create').mockImplementationOnce(async (write, signal) => { await original(write, signal); throw new Error('Reply lost') })
    const first = mount(f); await prepare(first)
    await act(async () => { await first.result.current.save() })
    const pending = structuredClone(first.result.current.draft!.pending)
    expect(pending?.kind).toBe('create'); expect(first.result.current.error).toBe('pending')
    act(() => { first.result.current.edit({ title: 'Later unsent title', document: manuscript('Later private prose.'), anchorEdits: null }) })
    first.unmount()
    const reopened = mount(f)
    await waitFor(() => expect(reopened.result.current.recovery).not.toBeNull())
    act(() => { expect(reopened.result.current.resume()).toBe(true) })
    await act(async () => { await reopened.result.current.recover() })
    expect(create).toHaveBeenCalledOnce()
    expect(reopened.result.current.draft?.title).toBe('Later unsent title')
    expect(reopened.result.current.draft?.document).toEqual(manuscript('Later private prose.'))
    expect(reopened.result.current.draft?.pending).toBeNull(); expect(reopened.result.current.isCurrentSaved).toBe(false)
    expect(reopened.result.current.record?.variant.operation.document).toEqual(testDocument(pending))
})
function testDocument(pending: AuthorVariantPending | null) {
    return pending?.kind === 'create' ? pending.write.intent.operation.document : null
}
it('resumes the explicitly selected device writer rather than a newer neighbour without fetching or applying prose', async () => {
    const f = controlledAuthorVariants({ empty: true }), context = vi.spyOn(f.source, 'context'), create = vi.spyOn(f.source, 'create')
    const first = { ...newAuthorVariantDraft(f.context, true), title: 'Explicitly selected writing', seeded: true }
    const selectedKey = novelMutationKey(AUTHOR_VARIANT_DOMAIN, f.source.scope, f.generation.id, 'selected-device-writer')!
    const otherKey = novelMutationKey(AUTHOR_VARIANT_DOMAIN, f.source.scope, f.generation.id, 'newer-device-writer')!
    expect(writeAuthorVariantDraft(selectedKey, first)).toBe(true)
    const selected = readAuthorVariantDraft(selectedKey)!
    const other = editAuthorVariantDraft(first, { title: 'Newer independent writing' })!
    expect(writeAuthorVariantDraft(otherKey, other)).toBe(true)
    const otherBefore = localStorage.getItem(otherKey)
    const hook = renderHook(() => useAuthorVariantDraft({ source: f.source, generationId: f.generation.id, readOnly: false, recoveryRecord: selected }))
    expect(hook.result.current.recovery?.write.title).toBe('Explicitly selected writing')
    act(() => { expect(hook.result.current.resume()).toBe(true) })
    expect(hook.result.current.draft?.title).toBe('Explicitly selected writing')
    expect(hook.result.current.draft?.isDefaultWorkspace).toBe(true)
    expect(localStorage.getItem(otherKey)).toBe(otherBefore)
    expect(context).not.toHaveBeenCalled(); expect(create).not.toHaveBeenCalled()
})
it('invalidates an in-flight preview after later typing and never saves it', async () => {
    const test = mount(); await waitFor(() => expect(test.result.current.draft).not.toBeNull())
    act(() => { test.result.current.seed(test.snapshot.operation.document); test.result.current.edit({ title: 'First version' }) })
    const original = test.source.preview.bind(test.source); let resolve!: (v: Awaited<ReturnType<typeof original>>) => void
    vi.spyOn(test.source, 'preview').mockImplementationOnce(async (intent, signal) => { const v = await original(intent, signal); return new Promise(done => { resolve = () => done(v) }) })
    const create = vi.spyOn(test.source, 'create'); let pending!: Promise<boolean>
    act(() => { pending = test.result.current.prepare() })
    await waitFor(() => expect(resolve).toBeDefined())
    act(() => test.result.current.edit({ title: 'Later version' }))
    await act(async () => { resolve(test.snapshot); await pending })
    expect(test.result.current.preview).toBeNull()
    await act(async () => { await test.result.current.save() }); expect(create).not.toHaveBeenCalled()
})
it('does not send a request until its immutable identity is saved, then recovers that same identity after storage returns', async () => {
    const test = mount(); await prepare(test)
    const create = vi.spyOn(test.source, 'create'), lookup = vi.spyOn(test.source, 'result')
    const blocked = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Quota') })
    await act(async () => { expect(await test.result.current.save()).toBe(false) })
    const pending = structuredClone(test.result.current.draft!.pending)
    expect(lookup).not.toHaveBeenCalled(); expect(create).not.toHaveBeenCalled(); expect(test.result.current.storageFailed).toBe(true)
    blocked.mockRestore()
    await act(async () => { await test.result.current.recover() })
    expect(create.mock.calls[0][0]).toEqual(pending!.write)
    expect(test.result.current.draft?.pending).toBeNull()
})
it('recovers an original decision under read-only state without applying it again', async () => {
    const f = controlledAuthorVariants(), original = f.source.decide.bind(f.source)
    const decide = vi.spyOn(f.source, 'decide').mockImplementationOnce(async (write, signal) => { await original(write, signal); throw new Error('Reply lost') })
    const test = mount(f); await waitFor(() => expect(test.result.current.draft).not.toBeNull())
    act(() => test.result.current.seed(test.snapshot.operation.document))
    await act(async () => { await test.result.current.read(f.record.variant.id) })
    await act(async () => { await test.result.current.decide('stash') })
    expect(test.result.current.draft?.pending?.kind).toBe('decision')
    test.rerender({ ...test.props, readOnly: true })
    await act(async () => { await test.result.current.recover() })
    expect(decide).toHaveBeenCalledOnce(); expect(test.result.current.draft?.pending).toBeNull()
    expect(test.result.current.record?.status).toBe('stashed')
})
it('keeps an unresolved creation when no receipt exists and read-only state forbids replay', async () => {
    const test = mount(), create = vi.spyOn(test.source, 'create').mockRejectedValueOnce(new Error('Never received'))
    await prepare(test); await act(async () => { await test.result.current.save() })
    const pending = structuredClone(test.result.current.draft?.pending)
    test.rerender({ ...test.props, readOnly: true })
    await act(async () => { await test.result.current.recover() })
    expect(create).toHaveBeenCalledOnce(); expect(test.result.current.draft?.pending).toEqual(pending)
    expect(test.result.current.error).toBe('readOnly')
})
it('fences a late original read after the scope retires or the dialog unmounts', async () => {
    const f = controlledAuthorVariants(); let resolve!: (v: typeof f.context) => void
    vi.spyOn(f.source, 'context').mockImplementationOnce(() => new Promise(done => { resolve = done }))
    const test = mount(f); await waitFor(() => expect(resolve).toBeDefined())
    f.retire(); test.unmount(); await act(async () => resolve(f.context))
    expect(localStorage.length).toBe(0)
})
it('retains a definite refusal separately from later input, rotates only new intent IDs and requires another review',async()=>{
    const test=mount(),create=vi.spyOn(test.source,'create').mockRejectedValueOnce(new ApiError(409,'Changed',{code:'STORY_VARIANT_REVIEW_CHANGED'}))
    await prepare(test)
    const reviewed=structuredClone(test.result.current.preview!)
    await act(async()=>{await test.result.current.save()})
    expect(test.result.current.draft?.pending).toBeNull()
    expect(test.result.current.draft?.refusal?.pending.kind).toBe('create')
    expect(test.result.current.preview).toBeNull();expect(test.result.current.error).toBe('changed')
    expect(test.result.current.draft?.variantId).not.toBe(reviewed.id)
    act(()=>test.result.current.edit({title:'Later private name',document:manuscript('Later private writing.'),anchorEdits:null}))
    const refused=test.result.current.draft?.refusal?.pending
    expect(refused?.kind==='create'?refused.write.intent.operation.document:null).toEqual(reviewed.operation.document)
    test.unmount();const reopened=mount(test)
    await waitFor(()=>expect(reopened.result.current.recovery).not.toBeNull())
    act(()=>{expect(reopened.result.current.resume()).toBe(true)})
    expect(reopened.result.current.draft?.refusal?.pending).toEqual(refused)
    expect(reopened.result.current.draft?.document).toEqual(manuscript('Later private writing.'))
    await act(async()=>{await reopened.result.current.save()});expect(create).toHaveBeenCalledOnce()
})
