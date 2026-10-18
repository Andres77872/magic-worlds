import { beforeEach, expect, it, vi } from 'vitest'
import { authorVariantFixture } from '@/test/fixtures/authorVariants'
import { manuscript } from '@/test/fixtures/story'
import { novelMutationKey } from '@/shared/novelMutationJournal'
import { AUTHOR_VARIANT_DOMAIN, authorVariantIntent, confirmedAuthorVariantRefusal, isAuthorVariantDraft, listAuthorVariantDrafts, newAuthorVariantDraft, readAuthorVariantDraft, writeAuthorVariantDraft } from './authorVariantJournal'

beforeEach(() => { localStorage.clear(); vi.restoreAllMocks() })
const fixture = authorVariantFixture(), scope = { userHash: 'author', workspaceId: 'desk', storyId: fixture.snapshot.storyId }
const key = (writer = 'one') => novelMutationKey(AUTHOR_VARIANT_DOMAIN, scope, fixture.generation.id, writer)!
function draft() { return { ...newAuthorVariantDraft(fixture.context), seeded: true, title: 'My quieter version' } }
it('retains the original model/base, private rich JSON and exact pending creation independently from later typing', () => {
    const value = draft(), intent = authorVariantIntent(value)
    const pending = { kind: 'create' as const, sequence: value.sequence, write: { requestId: 'create-once', reviewedHash: 'a'.repeat(64), intent } }
    const later = { ...value, pending, title: 'Later title', sequence: 1, variantId: 'later-version', operationId: 'later-operation', document: manuscript('Later writing.'), anchorEdits: null }
    expect(isAuthorVariantDraft(later)).toBe(true)
    expect(writeAuthorVariantDraft(key(), later)).toBe(true)
    const recovered = readAuthorVariantDraft(key('reopen'))!.write
    expect(recovered.pending).toEqual(pending); expect(recovered.document).toEqual(later.document)
    expect(recovered.context.parent.parent.output).toBe(fixture.generation.output)
    expect(recovered.context.baseDocument).toEqual(fixture.scene.document)
})
it('keeps a partial Unicode title recoverable while the strict reviewed intent still controls admission', () => {
    const value = { ...draft(), title: '🌙'.repeat(300) }
    expect(writeAuthorVariantDraft(key(), value)).toBe(true)
    expect(readAuthorVariantDraft(key())?.write.title).toBe(value.title)
    expect(authorVariantIntent(value).title).toBe(value.title)
})
it.each(['credentials', 'parent', 'pending_parent', 'pending_same_sequence', 'mapping', 'identity', 'decision_parent'])('rejects %s corruption without removing the private source record', change => {
    const value = draft(), intent = authorVariantIntent(value)
    const proposed: Record<string, unknown> = structuredClone(value)
    if (change === 'credentials') proposed.credentials = { api_key: 'never' }
    if (change === 'parent') proposed.context = { ...value.context, parent: { ...value.context.parent, credentials: 'never' } }
    if (change === 'pending_parent') proposed.pending = { kind: 'create', sequence: 0, write: { requestId: 'create', reviewedHash: 'a'.repeat(64), intent: { ...intent, parent: { ...intent.parent, generationId: 'foreign' } } } }
    if (change === 'pending_same_sequence') proposed.pending = { kind: 'create', sequence: 0, write: { requestId: 'create', reviewedHash: 'a'.repeat(64), intent: { ...intent, title: 'Not inspected' } } }
    if (change === 'mapping') proposed.anchorEdits = [{ from: 0, to: 0, text: 'Unproven mapping' }]
    if (change === 'identity') proposed.variantId = value.context.parent.parent.id
    if (change === 'decision_parent') proposed.pending = { kind: 'decision', generationId: 'foreign', write: { requestId: 'decide', reference: { id: 'version', variantHash: 'a'.repeat(64) }, expectedStatus: 'candidate', decision: 'reject' } }
    expect(isAuthorVariantDraft(proposed)).toBe(false)
    const raw = JSON.stringify({ schema: 1, write: proposed, writtenAt: 1 }); localStorage.setItem(key(), raw)
    expect(readAuthorVariantDraft(key())).toBeNull(); expect(localStorage.getItem(key())).toBe(raw)
})
it('keeps writers/account/workspace scopes apart and reports quota or a silently rejected write honestly', () => {
    expect(writeAuthorVariantDraft(key(), draft())).toBe(true)
    const original = localStorage.getItem(key())
    const foreign = novelMutationKey(AUTHOR_VARIANT_DOMAIN, { ...scope, userHash: 'another' }, fixture.generation.id)!
    expect(readAuthorVariantDraft(foreign)).toBeNull()
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {})
    expect(writeAuthorVariantDraft(key(), { ...draft(), title: 'New version' })).toBe(false)
    expect(localStorage.getItem(key())).toBe(original)
})
it('lists every retained private writer for the same original while preserving other owners',()=>{
    writeAuthorVariantDraft(key('first'),{...draft(),title:'First private version'})
    writeAuthorVariantDraft(key('second'),{...draft(),title:'Second private version'})
    expect(listAuthorVariantDrafts(scope,fixture.generation.id).map(record=>record.write.title).sort()).toEqual(['First private version','Second private version'])
    expect(listAuthorVariantDrafts({...scope,userHash:'another'},fixture.generation.id)).toEqual([])
    expect(listAuthorVariantDrafts(scope,'another-original')).toEqual([])
})
it('requires exact post-receipt domain statuses before separating a refused request from uncertainty',()=>{
    expect(confirmedAuthorVariantRefusal('create',{status:409,code:'STORY_VARIANT_BASE_CHANGED'})).toBe('sources_changed')
    expect(confirmedAuthorVariantRefusal('decision',{status:409,code:'STORY_VARIANT_DECISION_CHANGED'})).toBe('candidate_changed')
    expect(confirmedAuthorVariantRefusal('decision',{status:404,code:'STORY_VARIANT_NOT_FOUND'})).toBe('unavailable')
    for(const status of [401,403,404,422,500])expect(confirmedAuthorVariantRefusal('create',{status,code:'STORY_VARIANT_BASE_CHANGED'})).toBeNull()
    for(const code of ['WORKSPACE_ARCHIVED','WORKSPACE_FORBIDDEN','STORY_VARIANT_RECORD_INVALID','story_variant_contract'])
        expect(confirmedAuthorVariantRefusal('create',{status:409,code})).toBeNull()
})
