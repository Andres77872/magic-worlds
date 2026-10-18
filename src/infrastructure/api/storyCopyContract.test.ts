import { expect,it } from 'vitest'
import { existsSync,readFileSync } from 'node:fs'
import { copyAck,copyPreview,copyProvenance,copyWrite } from '@/test/fixtures/storyCopy'
import { isStoryCopyWrite,verifyStoryCopyAcknowledgement,verifyStoryCopyPreview,verifyStoryCopyProvenance } from './storyCopyContract'
import { verifyStory } from './storyContract'

it('requires all eight distinct option previews and refuses prose or foreign sources',()=>{
    const value=copyPreview()
    expect(verifyStoryCopyPreview(value,'story-1')).toBe(true)
    expect(verifyStoryCopyPreview(value,'another-story')).toBe(false)
    expect(verifyStoryCopyPreview({...value,variants:[...value.variants.slice(1),value.variants[1]]},'story-1')).toBe(false)
    expect(verifyStoryCopyPreview({...value,document:{}},'story-1')).toBe(false)
    expect(verifyStoryCopyPreview({...value,variants:value.variants.slice(1)},'story-1')).toBe(false)
})
it('binds an acknowledgement to the complete immutable request',()=>{
    const write=copyWrite(),ack=copyAck(write)
    expect(verifyStoryCopyAcknowledgement(ack,'story-1',write)).toBe(true)
    for(const patch of [{requestId:'other'},{sourceId:'other'},{sourceVersion:'b'.repeat(64)},{title:'Another draft'},{storyId:'story-1'},{options:{...write.options,includeNotes:false}}]){
        expect(verifyStoryCopyAcknowledgement({...ack,...patch},'story-1',write)).toBe(false)
    }
    expect(isStoryCopyWrite({...write,options:{includeNotes:true}})).toBe(false)
})
it('validates frozen provenance and independent complete identity maps',()=>{
    const value=copyProvenance()
    expect(verifyStoryCopyProvenance(value,'story-copy')).toBe(true)
    expect(verifyStoryCopyProvenance(value,'other-copy')).toBe(false)
    expect(verifyStoryCopyProvenance({...value,counts:{...value.counts,scenes:2}},'story-copy')).toBe(false)
    expect(verifyStoryCopyProvenance({...value,identityMap:{...value.identityMap,scenes:{'scene-1':'scene-1'}}},'story-copy')).toBe(false)
    expect(verifyStoryCopyProvenance({...value,identityMap:{...value.identityMap,blocks:{}}},'story-copy')).toBe(false)
    expect(verifyStoryCopyProvenance({...value,sourceRevisions:{...value.sourceRevisions,scenes:[]}},'story-copy')).toBe(false)
})

it('guards explicit note inclusion and its source revision without altering older request receipts',()=>{
    const old=copyWrite(),write=copyWrite({includeComments:true,sourceAnnotationRevision:9}),ack=copyAck(write)
    expect(isStoryCopyWrite(old)).toBe(true);expect(isStoryCopyWrite(write)).toBe(true)
    expect(isStoryCopyWrite({...old,includeComments:false})).toBe(false)
    expect(isStoryCopyWrite({...write,sourceAnnotationRevision:0})).toBe(false)
    expect(verifyStoryCopyAcknowledgement(ack,'story-1',write)).toBe(true)
    expect(verifyStoryCopyAcknowledgement(copyAck(old),'story-1',write)).toBe(false)
    expect(verifyStoryCopyAcknowledgement({...ack,includeComments:false},'story-1',write)).toBe(false)
    expect(verifyStoryCopyAcknowledgement({...ack,sourceAnnotationRevision:10},'story-1',write)).toBe(false)
    const preview=copyPreview(true)
    expect(verifyStoryCopyPreview(preview,'story-1')).toBe(true)
    expect(verifyStoryCopyPreview({...preview,variants:preview.variants.map(({comments,...item})=>{void comments;return item})},'story-1')).toBe(false)
    expect(verifyStoryCopyPreview({...preview,annotationRevision:0},'story-1')).toBe(false)
})
it('checks independent note identity maps in frozen copy provenance',()=>{
    const value={...copyProvenance(),annotations:{sourceRevision:9,included:true,count:1,identityMap:{'source-note':'copy-note'}}}
    expect(verifyStoryCopyProvenance(value,'story-copy')).toBe(true)
    expect(verifyStoryCopyProvenance({...value,annotations:{...value.annotations,included:false}},'story-copy')).toBe(false)
    expect(verifyStoryCopyProvenance({...value,annotations:{...value.annotations,count:2}},'story-copy')).toBe(false)
    expect(verifyStoryCopyProvenance({...value,annotations:{...value.annotations,identityMap:{'source-note':'copy-scene'}}},'story-copy')).toBe(false)
})

const annotatedWire='/tmp/novel-annotations-smoke-novel-copy.json'
it.skipIf(!existsSync(annotatedWire))('accepts actual HTTP/MySQL annotated copy preview, receipt and provenance',()=>{
    const {storyId,write,ack,preview,provenance}=JSON.parse(readFileSync(annotatedWire,'utf-8'))
    expect(verifyStoryCopyPreview(preview,storyId)).toBe(true)
    expect(verifyStoryCopyAcknowledgement(ack,storyId,write)).toBe(true)
    expect(verifyStoryCopyProvenance(provenance,ack.storyId)).toBe(true)
})

const smokeStory='/tmp/novel-copy-smoke-story.json',smokeProvenance='/tmp/novel-copy-smoke-provenance.json'
it.skipIf(!existsSync(smokeStory)||!existsSync(smokeProvenance))('accepts the actual isolated MySQL/API copy and frozen manifest',()=>{
    const story=JSON.parse(readFileSync(smokeStory,'utf-8')),provenance=JSON.parse(readFileSync(smokeProvenance,'utf-8'))
    expect(verifyStory(story)).toBe(true)
    expect(verifyStoryCopyProvenance(provenance,story.id)).toBe(true)
    expect(story.copiedFrom).toBe(provenance.sourceId)
})
