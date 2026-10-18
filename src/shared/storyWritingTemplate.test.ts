import { expect,it } from 'vitest'
import { isStoryWritingTemplate } from './storyWritingTemplate'
import { isStoryCreateWrite,verifyStoryCreationAcknowledgement } from '@/infrastructure/api/storyCreationContract'
import { writingTemplate } from '@/features/novel/utils/writingTemplates'
const template=()=>writingTemplate('three_acts',(key)=>key)
it('freezes the complete edited outline in its original receipt and refuses mixed creation modes',()=>{
    const write={requestId:'template-one',title:'The gate',template:template()}
    expect(isStoryCreateWrite(write)).toBe(true)
    expect(isStoryCreateWrite({...write,chapters:[]})).toBe(false)
    expect(isStoryCreateWrite({...write,template:null})).toBe(false)
    const ack={kind:'novel_create',requestId:write.requestId,storyId:'new-novel',write:structuredClone(write)}
    expect(verifyStoryCreationAcknowledgement(ack,write)).toBe(true)
    ack.write.template.chapters[0].scenes[0].title='Changed on retry'
    expect(verifyStoryCreationAcknowledgement(ack,write)).toBe(false)
})
it.each([
    {schemaVersion:true},{key:'invalid key'},{version:true},{name:' '},{parts:[{title:'A',id:'old-id'}]},
    {defaults:{styleGuide:'🙂'.repeat(20_000),narrator:'🙂'.repeat(20_000)}},
    {chapters:[{title:'A',partIndex:3,scenes:[{title:'B'}]}]},
    {chapters:[{title:'A',partIndex:true,scenes:[{title:'B'}]}]},
    {chapters:[{title:'A',scenes:[]}]},
    {chapters:[{title:'A',scenes:[{title:'B',document:{}}]}]},
    {chapters:[{title:'A',scenes:[{title:'B',details:{summary:'An invented written summary'}}]}]},
    {chapters:[{title:'A',scenes:[{title:'B',wordGoal:true}]}]},
    {chapters:[{title:'A',scenes:[{title:'B',details:{includeInAI:0}}]}]},
])('rejects unsafe or invalid template metadata %j',(patch)=>{expect(isStoryWritingTemplate({...template(),...patch})).toBe(false)})
