import { describe, expect, it } from 'vitest'
import wire from '@/test/fixtures/storyVariantsAssistantNative.json'
import { isStoryVariantCreate, isStoryVariantDecision,
    verifyStoryVariantCreation, verifyStoryVariantDecision, verifyStoryVariantPage,
    verifyStoryVariantRecord, verifyStoryVariantSnapshot } from './storyVariantContract'

describe.each(wire.cases)('native assistant-authored versions: $case', fixture => {
    const { versions, creationRequests, retainedVersions, stashRequest, stashReceipt, pages } = fixture
    const storyId = versions[0].storyId

    it('reads actual native creation replies with the full retained assistant parent and exact reviewed operation', () => {
        expect(fixture.executionFeature).toBe('novel_assistant')
        expect(fixture.executionPlanCompleted).toBe(true)
        creationRequests.forEach((write, index) => {
            if (!isStoryVariantCreate(write)) throw new Error('Native creation request violates the wire contract')
            const record = versions[index]
            expect(verifyStoryVariantCreation(record, storyId, write)).toBe(true)
            expect(verifyStoryVariantSnapshot(record.variant, storyId, write.intent)).toBe(true)
            expect(record.variant.parent.parent.id).toBe(fixture.originalGenerationId)
            expect(record.variant.parent.parent.output).toBe(fixture.originalOutput)
            expect(verifyStoryVariantCreation(record, storyId, { ...write,
                intent: { ...write.intent, title: 'Later private input was not the reviewed request' } })).toBe(false)
        })
    })

    it('keeps immutable creation acknowledgements separate from current accepted, stashed or rejected records', () => {
        if (!isStoryVariantDecision(stashRequest)) throw new Error('Native decision request violates the wire contract')
        expect(verifyStoryVariantDecision(stashReceipt, storyId, stashRequest)).toBe(true)
        retainedVersions.forEach((record, index) => {
            expect(verifyStoryVariantRecord(record, storyId, { id: versions[index].variant.id,
                variantHash: versions[index].variant.variantHash })).toBe(true)
            expect(record.variant).toEqual(versions[index].variant)
            expect(verifyStoryVariantRecord(record, 'foreign-novel')).toBe(false)
        })
        const firstCreate = creationRequests[0]
        if (!isStoryVariantCreate(firstCreate)) throw new Error('Invalid original creation request')
        expect(versions[0].status).toBe('candidate')
        expect(retainedVersions[0].status).toBe(fixture.case === 'accept' ? 'accepted' : 'stashed')
        expect(verifyStoryVariantCreation(retainedVersions[0], storyId, firstCreate)).toBe(false)
        expect(retainedVersions[1].status).toBe('candidate')
        expect(retainedVersions[2].status).toBe('rejected')
    })

    it('reads every real bounded page with its original generation filter and cursor', () => {
        expect(pages).toHaveLength(3)
        pages.forEach(page => {
            const query = { generationId: fixture.originalGenerationId, limit: 1,
                ...(page.before === null ? {} : { before: page.before }) }
            expect(verifyStoryVariantPage(page, storyId, query)).toBe(true)
            expect(verifyStoryVariantPage(page, storyId, { ...query, generationId: 'another-generation' })).toBe(false)
            expect(verifyStoryVariantPage({ ...page,
                items: [{ ...page.items[0], document: versions[0].variant.operation.document }] }, storyId, query)).toBe(false)
        })
        expect(new Set(pages.flatMap(page => page.items.map(item => item.id))).size).toBe(3)
    })
})

it('retains the native assistant version lineage and unchanged accounting proof without claiming upstream/provider qualification', () => {
    expect(wire.projectDatabaseWrites).toBe(0)
    expect(wire.providerRequests).toBe(0)
    expect(wire.upstreamExecutorCalls).toBe(0)
    const accepted = wire.cases.find(fixture => fixture.case === 'accept')!
    expect(accepted.exactRevisionLineage).toEqual({ generation_id: accepted.originalGenerationId,
        variant_id: accepted.versions[0].variant.id })
    expect(accepted.sameAcceptConcurrency).toBe(4)
    expect(accepted.lateAcceptanceRollback).toBe(true)
    const refused = wire.cases.find(fixture => fixture.case === 'changed_sources')!
    expect(refused.changedSourceRefusals).toBe(3)
    for (const fixture of wire.cases) {
        expect(fixture.accountingTablesUnchanged).toBeGreaterThan(0)
        expect(fixture.archivedExactReceiptRecovery).toBe(true)
    }
})
