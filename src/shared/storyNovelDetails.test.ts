import { expect,it } from 'vitest'
import { novel } from '@/test/fixtures/story'
import { isStoryNovelDetails,storyCoverUrl } from './storyNovelDetails'
import { verifyStory } from '@/infrastructure/api/storyContract'
import { metadataPatch,metadataSeed,readMetadataJournal,rebaseMetadata } from '@/features/novel/persistence/metadataJournal'
import { novelMutationKey,writeNovelMutation } from './novelMutationJournal'
it('retains bounded owned cover/POV identities and exact Unicode descriptions without accepting arbitrary cover URLs',()=>{
    const details={coverAssetId:'image-one',povCardId:'mira',coverAlt:'  Road at dusk 🙂.  ',tags:['Café']}
    expect(isStoryNovelDetails(details)).toBe(true);expect(verifyStory(novel({details}))).toBe(true)
    expect(storyCoverUrl('image/one?name')).toBe('/images/assets/image%2Fone%3Fname')
    for(const invalid of [{coverUrl:'https://elsewhere/image.png'},{coverAssetId:' padded '},{coverAssetId:''},{povCardId:false},{coverAlt:'🙂'.repeat(2001)},{tags:Array(101).fill('tag')},{notes:'🙂'.repeat(20_000),styleGuide:'🙂'.repeat(20_000),synopsis:'🙂'.repeat(20_000),genre:'🙂'.repeat(20_000)}])expect(isStoryNovelDetails(invalid)).toBe(false)
})
it('preserves legacy uncertain intent and rejects new invalid metadata without losing its editable form',()=>{
    const checkpoint=metadataSeed(novel(),'novel')
    checkpoint.form.details.tags=Array(101).fill('tag')
    expect(metadataPatch(checkpoint,'new')).toBeNull()
    checkpoint.pending={requestId:'legacy-uncertain',expectedMetadataRevision:1,details:checkpoint.form.details}
    const key=novelMutationKey('metadata',{userHash:'legacy-author',workspaceId:'legacy-workspace',storyId:checkpoint.unitId},'novel','legacy-writer')!
    writeNovelMutation(key,checkpoint)
    expect(readMetadataJournal(key,'novel',checkpoint.unitId)?.write).toEqual(checkpoint)
    localStorage.removeItem(key)
})
it('rebases only authored cover/POV fields and counts title Unicode by code point',()=>{
    const original=novel({details:{genre:'Fantasy',coverAssetId:'original'}}),checkpoint=metadataSeed(original,'novel')
    checkpoint.form.details.povCardId='mira';checkpoint.form.title='🙂'.repeat(200)
    const account=metadataSeed({...original,metadataRevision:2,details:{genre:'Mystery',coverAssetId:'account-cover'}},'novel')
    const rebased=rebaseMetadata(checkpoint,account)
    expect(rebased.form.details).toEqual({genre:'Mystery',coverAssetId:'account-cover',povCardId:'mira'})
    expect(metadataPatch(rebased,'write')).toMatchObject({title:'🙂'.repeat(200),expectedMetadataRevision:2})
    rebased.form.description='🙂'.repeat(15_001)
    expect(metadataPatch(rebased,'too-large')).toBeNull()
})
it('accepts a calendar deadline and a bounded daily target only',()=>{
    expect(isStoryNovelDetails({deadline:'2026-11-30',dailyWordGoal:200})).toBe(true)
    expect(isStoryNovelDetails({deadline:null,dailyWordGoal:null})).toBe(true)
    for(const invalid of [{deadline:'2026-02-30'},{deadline:'1999-12-31'},{deadline:'2026-11-30T00:00:00Z'},{dailyWordGoal:0},{dailyWordGoal:1_000_001},{dailyWordGoal:2.5},{dailyWordGoal:'200'}])expect(isStoryNovelDetails(invalid)).toBe(false)
})
