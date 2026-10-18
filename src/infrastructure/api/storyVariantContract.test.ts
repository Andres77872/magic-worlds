import { describe, expect, it } from 'vitest'
import wire from '@/test/fixtures/storyVariantsNative.json'
import type { StoryVariantCreate, StoryVariantIntent, StoryVariantSnapshot } from '@/shared'
import { verifySceneRevision } from './storyRevisionContract'
import { isStoryVariantCreate, isStoryVariantDecision, isStoryVariantIntent, isStoryVariantReference,
    storyVariantReference, verifyStoryVariantCreation, verifyStoryVariantDecision, verifyStoryVariantPage,
    verifyStoryVariantRecord, verifyStoryVariantSnapshot } from './storyVariantContract'

const snapshot = wire.preview as StoryVariantSnapshot, storyId = snapshot.storyId
const intent: StoryVariantIntent = { id: snapshot.id, title: snapshot.title,
    parent: { generationId: snapshot.parent.parent.id, parentHash: snapshot.parent.parentHash }, operation: snapshot.operation }
const create: StoryVariantCreate = { requestId: 'create-native-version', reviewedHash: snapshot.variantHash, intent }

describe('native authored-version contract', () => {
    it('reads the actual SQL preview, lifecycle records, immutable creation receipt and applied revision', () => {
        expect(wire.projectDatabaseWrites).toBe(false)
        expect(verifyStoryVariantSnapshot(wire.preview, storyId, intent)).toBe(true)
        for (const record of wire.records) expect(verifyStoryVariantRecord(record, storyId)).toBe(true)
        expect(verifyStoryVariantCreation(wire.creationReceipt, storyId, create)).toBe(true)
        expect(verifyStoryVariantPage(wire.page, storyId)).toBe(true)
        const revision = wire.sceneRevision
        expect(verifySceneRevision(revision, storyId, revision.sceneId, revision.revision)).toBe(true)
        expect(revision.variantId).toBe(snapshot.id)
        expect(revision.generationId).toBe(snapshot.parent.parent.id)
    })
    it('binds the full visible operation, immutable model parent and original base without normalizing prose', () => {
        const changed = structuredClone(snapshot)
        changed.operation.anchorEdits![0].text = 'Different mapping'
        for (const value of [changed, { ...snapshot, storyId: 'foreign' }, { ...snapshot, id: snapshot.parent.parent.id },
            { ...snapshot, operation: { ...snapshot.operation, sceneId: 'foreign' } },
            { ...snapshot, operation: { ...snapshot.operation, expectedRevision: 3 } },
            { ...snapshot, baseDocument: { ...snapshot.baseDocument, schemaVersion: 2 } },
            { ...snapshot, credentials: { api_key: 'never' } }]) expect(verifyStoryVariantSnapshot(value, storyId)).toBe(false)
        expect(verifyStoryVariantSnapshot(snapshot, storyId, { ...intent, title: 'Another title' })).toBe(false)
        expect(verifyStoryVariantSnapshot(snapshot, storyId, { ...intent, parent: { ...intent.parent, parentHash: 'a'.repeat(64) } })).toBe(false)
        const changedDocument = structuredClone(intent)
        changedDocument.operation.document.content.content![0].content![0].text = 'Unreviewed author writing'
        expect(verifyStoryVariantSnapshot(snapshot, storyId, changedDocument)).toBe(false)
    })
    it('requires separate bounded identities, a literal Unicode title and strict request shapes', () => {
        expect(isStoryVariantIntent(intent)).toBe(true)
        expect(isStoryVariantCreate(create)).toBe(true)
        expect(isStoryVariantIntent({ ...intent, title: '🌙'.repeat(255) })).toBe(true)
        for (const title of [' leading', 'trailing ', 'line\nbreak', '🌙'.repeat(256), '\ud800'])
            expect(isStoryVariantIntent({ ...intent, title })).toBe(false)
        for (const value of [{ ...intent, id: intent.operation.id }, { ...intent, apply: true },
            { ...intent, operation: { ...intent.operation, expectedRevision: true } },
            { ...intent, operation: { ...intent.operation, anchorEdits: undefined } }]) expect(isStoryVariantIntent(value)).toBe(false)
        for (const requestId of [intent.id, intent.parent.generationId, intent.operation.id, 'bad/request'])
            expect(isStoryVariantCreate({ ...create, requestId })).toBe(false)
        expect(isStoryVariantReference({ ...storyVariantReference(snapshot), apply: true })).toBe(false)
    })
    it('distinguishes an old creation receipt from current lifecycle state and exact decisions', () => {
        const accepted = wire.records.find(record => record.status === 'accepted')!
        expect(verifyStoryVariantCreation(accepted, storyId, create)).toBe(false)
        for (const value of [{ ...accepted, appliedRevision: null }, { ...accepted, appliedRevision: 4 },
            { ...wire.creationReceipt, appliedRevision: 3 }, { ...accepted, status: 'unknown' },
            { ...accepted, createdAt: 'not a timestamp' }]) expect(verifyStoryVariantRecord(value, storyId)).toBe(false)
        const record = wire.records.find(row => row.status === 'stashed')!, reference = { id: record.variant.id, variantHash: record.variant.variantHash }
        const decision = { requestId: 'stash-native-version', reference, expectedStatus: 'candidate' as const, decision: 'stash' as const }
        expect(isStoryVariantDecision(decision)).toBe(true)
        expect(verifyStoryVariantDecision(record, storyId, decision)).toBe(true)
        expect(verifyStoryVariantDecision(record, storyId, { ...decision, decision: 'reject' })).toBe(false)
        expect(verifyStoryVariantDecision(record, storyId, { ...decision, reference: { ...reference, variantHash: 'b'.repeat(64) } })).toBe(false)
    })
    it('rejects foreign filters, duplicate/body-bearing rows and invented pagination cursors', () => {
        const page = wire.page
        for (const value of [{ ...page, generationId: intent.parent.generationId }, { ...page, before: 'unrequested' },
            { ...page, items: [page.items[0], page.items[0]] }, { ...page, items: [{ ...page.items[0], document: snapshot.operation.document }] },
            { ...page, nextBefore: page.items[0].id }, { ...page, items: [{ ...page.items[0], appliedRevision: 3 }] }])
            expect(verifyStoryVariantPage(value, storyId)).toBe(false)
        const filtered = { ...page, generationId: intent.parent.generationId }
        expect(verifyStoryVariantPage(filtered, storyId, { generationId: intent.parent.generationId })).toBe(true)
        expect(verifyStoryVariantPage(filtered, storyId, { generationId: 'foreign' })).toBe(false)
    })
    it('accepts variant provenance only on an AI revision with an independent model identity', () => {
        const revision = wire.sceneRevision
        for (const patch of [{ variantId: null }, { variantId: revision.generationId }, { generationId: null }, { source: 'manual' }])
            expect(verifySceneRevision({ ...revision, ...patch }, storyId, revision.sceneId, revision.revision)).toBe(false)
        const historical = { ...revision }; Reflect.deleteProperty(historical, 'variantId')
        expect(verifySceneRevision(historical, storyId, revision.sceneId, revision.revision)).toBe(true)
    })
})
