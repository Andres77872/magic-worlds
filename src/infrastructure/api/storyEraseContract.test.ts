import { describe,it,expect } from 'vitest'
import { isStoryEraseWrite,storyEraseCountKeys,verifyStoryEraseAcknowledgement,verifyStoryErasePreview } from './storyEraseContract'

const write={requestId:'erase-one',expectedSourceVersion:'a'.repeat(64),confirmedTitle:'La casa · 🙂'}
const preview={schema:1,kind:'novel_erase_preview',storyId:'novel-one',title:write.confirmedTitle,sourceVersion:write.expectedSourceVersion,
    trashedAt:'2026-10-17T00:00:00',policy:'explicit-novel-erase-v1',activeExecutions:0,counts:Object.fromEntries(storyEraseCountKeys.map((key)=>[key,2]))}
const ack={schema:1,kind:'novel_erase',storyId:'novel-one',requestId:write.requestId,sourceVersion:write.expectedSourceVersion,intentHash:'b'.repeat(64),erasedAt:'2026-10-17T00:00:00'}

describe('novel erasure contracts',()=>{
    it('requires one immutable, bounded confirmation and handles Unicode title length',()=>{
        expect(isStoryEraseWrite(write)).toBe(true)
        expect(isStoryEraseWrite({...write,confirmedTitle:'🙂'.repeat(255)})).toBe(true)
        for(const value of [{...write,confirmedTitle:'🙂'.repeat(256)},{...write,requestId:'bad/id'},{...write,eraseAll:true},{...write,expectedSourceVersion:'A'.repeat(64)}])expect(isStoryEraseWrite(value)).toBe(false)
    })
    it('binds a content-free preview to the exact novel and known complete counts',()=>{
        expect(verifyStoryErasePreview(preview,'novel-one')).toBe(true)
        expect(verifyStoryErasePreview(preview,'other-novel')).toBe(false)
        const incomplete={...preview.counts};Reflect.deleteProperty(incomplete,'variants')
        expect(verifyStoryErasePreview({...preview,counts:incomplete},'novel-one')).toBe(false)
        for(const change of [{schema:2},{policy:'automatic-purge'},{activeExecutions:5},{counts:{...preview.counts,scenes:-1}},{counts:{...preview.counts,scenes:true}},{document:{}}])expect(verifyStoryErasePreview({...preview,...change},'novel-one')).toBe(false)
    })
    it('recovers only the exact reviewed request without retaining its title or prose',()=>{
        expect(verifyStoryEraseAcknowledgement(ack,'novel-one',write)).toBe(true)
        for(const change of [{schema:2},{storyId:'other-novel'},{requestId:'other-request'},{sourceVersion:'c'.repeat(64)},{erasedAt:'yesterday'},{write}])expect(verifyStoryEraseAcknowledgement({...ack,...change},'novel-one',write)).toBe(false)
        expect(ack).not.toHaveProperty('title')
    })
})
