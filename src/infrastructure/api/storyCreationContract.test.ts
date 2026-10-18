import { existsSync,readFileSync } from 'node:fs'
import { expect,it } from 'vitest'
import { creationAck,creationWrite } from '@/test/fixtures/storyCreation'
import { isStoryCreateWrite,verifyStoryCreationAcknowledgement } from './storyCreationContract'

it('requires bounded creation metadata and rejects accidental prose or unit scope',()=>{
    const write=creationWrite()
    expect(isStoryCreateWrite(write)).toBe(true)
    for(const patch of [{requestId:''},{requestId:'bad id'},{title:' padded '},{chapters:[]},{body:'prose'},{chapters:[{title:'Opening',body:'prose'}]},{cardRefs:[{kind:'character',cardId:'card',sceneId:'scene'}]},{source:{kind:'character',id:'card'}},{description:'x'.repeat(1_000_001)}])expect(isStoryCreateWrite({...write,...patch})).toBe(false)
})
it('binds every original request field before acknowledging a creation',()=>{
    const write=creationWrite(),ack=creationAck(write)
    expect(verifyStoryCreationAcknowledgement(ack,write)).toBe(true)
    expect(verifyStoryCreationAcknowledgement({...ack,requestId:'other'},write)).toBe(false)
    expect(verifyStoryCreationAcknowledgement({...ack,storyId:' '},write)).toBe(false)
    expect(verifyStoryCreationAcknowledgement({...ack,write:{...write,title:'Another draft'}},write)).toBe(false)
    expect(verifyStoryCreationAcknowledgement({...ack,write:{...write,source:{kind:'world',id:'other',title:'Other'}}},write)).toBe(false)
    expect(verifyStoryCreationAcknowledgement({...ack,write:{...write,chapters:[{title:'Another opening'}]}},write)).toBe(false)
    expect(verifyStoryCreationAcknowledgement({...ack,document:{}},write)).toBe(false)
})
const fixture='/tmp/novel-creation-smoke-receipt.json'
it.skipIf(!existsSync(fixture))('accepts the actual isolated MySQL creation receipt',()=>{
    const value=JSON.parse(readFileSync(fixture,'utf-8'))
    expect(verifyStoryCreationAcknowledgement(value,value.write)).toBe(true)
})
