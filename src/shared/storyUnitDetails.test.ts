import { expect,it } from 'vitest'
import { isStoryUnitDetails } from './storyUnitDetails'
import { isStoryWritingTemplate } from './storyWritingTemplate'
import { metadataPatch,metadataSeed,rebaseMetadata,readMetadataJournal } from '@/features/novel/persistence/metadataJournal'
import { novelMutationKey,writeNovelMutation } from './novelMutationJournal'
import { storyScene } from '@/test/fixtures/story'
import { verifyStoryScene,matchesStoryWrite } from '@/infrastructure/api/storyContract'

const plans={tags:['Café','伏線 🙂'],plannedBeats:['  The gate opens.\nMira waits.  ','Equal wording','Equal wording'],summary:'Already written.',summaryRevision:3,notes:'Personal note'}
it('preserves Unicode, multiline ordered duplicates, optional nulls and old omissions without normalization',()=>{
    const value=structuredClone(plans),before=JSON.stringify(value)
    expect(isStoryUnitDetails(value)).toBe(true);expect(JSON.stringify(value)).toBe(before)
    expect(isStoryUnitDetails({})).toBe(true);expect(isStoryUnitDetails({tags:null,plannedBeats:null})).toBe(true)
    expect(isStoryUnitDetails({tags:['🙂'.repeat(255)],plannedBeats:['🙂'.repeat(2000)]})).toBe(true)
    expect(verifyStoryScene(storyScene({details:value}))).toBe(true)
})
it.each([
    {tags:['']},{tags:[' \n']},{tags:['a'.repeat(256)]},{tags:Array(101).fill('a')},
    {plannedBeats:['']},{plannedBeats:[' \n']},{plannedBeats:['🙂'.repeat(2001)]},{plannedBeats:Array(101).fill('a')},
    {plannedBeats:[null]},{plannedBeats:'text'},{plannedBeats:['\ud800']},{tags:['\udfff']},
    {plannedBeats:Array(20).fill('🙂'.repeat(2000))},{plotThreads:Array(101).fill('a')},{unknown:null},
])('rejects invalid saved plans %j',(value)=>expect(isStoryUnitDetails(value)).toBe(false))
it('keeps unfinished invalid beats recoverable and rebases each changed metadata field independently',()=>{
    localStorage.clear()
    const scene=storyScene({details:plans}),draft=metadataSeed(scene,'scene')
    draft.form.details.plannedBeats=['Unfinished','']
    expect(metadataPatch(draft,'invalid-plan')).toBeNull()
    const key=novelMutationKey('details',{userHash:'planning-author',workspaceId:'planning-space',storyId:scene.storyId},'scene:'+scene.id)!
    expect(writeNovelMutation(key,draft)).toBe(true)
    expect(readMetadataJournal(key,'scene',scene.id)?.write.form.details.plannedBeats).toEqual(['Unfinished',''])
    draft.form.details.plannedBeats=['A revised plan']
    const account=metadataSeed({...scene,metadataRevision:4,details:{...plans,tags:['Remote tag'],notes:'Later personal note'}},'scene')
    const merged=rebaseMetadata(draft,account),write=metadataPatch(merged,'changed-plan')!
    expect(write).toMatchObject({expectedMetadataRevision:4,details:{...plans,tags:['Remote tag'],notes:'Later personal note',plannedBeats:['A revised plan']}})
    expect(write).not.toHaveProperty('document');expect(write).not.toHaveProperty('expectedRevision')
    const ack={...scene,metadataRevision:5,details:write.details!}
    expect(matchesStoryWrite(ack,write)).toBe(true)
    expect(matchesStoryWrite({...ack,details:{...ack.details,plannedBeats:['Wrong plan']}},write)).toBe(false)
    localStorage.clear()
})
it('allows plans in identity-free templates and keeps summaries and manuscript blocks out',()=>{
    const template={schemaVersion:1,key:'plan',version:1,name:'Plan',chapters:[{title:'Arrival',details:{tags:['arc'],plannedBeats:plans.plannedBeats},scenes:[{title:'Gate'}]}]}
    expect(isStoryWritingTemplate(template)).toBe(true)
    for(const details of [{plannedBeats:['']},{summary:'Written summary'},{plannedBeats:[{id:'p1',text:'An identity'}]}]){
        expect(isStoryWritingTemplate({...template,chapters:[{...template.chapters[0],details}]})).toBe(false)
    }
})
