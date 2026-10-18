import { existsSync,readFileSync } from 'node:fs'
import { expect,it } from 'vitest'
import { creationSourcesPreview } from '@/test/fixtures/storyCreationSources'
import { creationWrite } from '@/test/fixtures/storyCreation'
import { isStoryCreateWrite,verifyStoryCreationAcknowledgement } from './storyCreationContract'
import { verifyStory } from './storyContract'
import { isCreationSourcesSelection,verifyCreationSources,verifyCreationSourcesPreview } from './storyCreationSourcesContract'

const selection={source:{kind:'character' as const,id:'mira',title:'Mira'},
    cardRefs:[{kind:'world' as const,cardId:'gate',source:'source' as const,enabled:false,precedence:4}],
    approvedMaterials:[{key:'arrival',kind:'approved_adventure_material' as const,title:'Arrival',text:'  Mira llegó 🙂.\nThe gate stayed shut.  '}]}
it('binds reviewed source identities, settings and exact approved text before allowing creation',()=>{
    const preview=creationSourcesPreview(selection),write={...creationWrite(),...selection,expectedSourceVersion:preview.sourceVersion}
    expect(isCreationSourcesSelection(selection)).toBe(true)
    expect(verifyCreationSourcesPreview(preview,selection)).toBe(true)
    expect(isStoryCreateWrite(write)).toBe(true)
    const unreviewed={...write};delete (unreviewed as Partial<typeof write>).expectedSourceVersion
    expect(isStoryCreateWrite(unreviewed)).toBe(false)
    for(const change of [(value:typeof preview)=>{value.references.pop()},(value:typeof preview)=>{value.references[1].enabled=true},
        (value:typeof preview)=>{value.references[1].precedence=0},(value:typeof preview)=>{value.references[1].source='manual'},
        (value:typeof preview)=>{value.references[2].snapshot.description=selection.approvedMaterials[0].text.trim()},
        (value:typeof preview)=>{value.references.push({...value.references[0]})}]){
        const corrupt=structuredClone(preview);change(corrupt)
        expect(verifyCreationSourcesPreview(corrupt,selection)).toBe(false)
    }
})
it('validates frozen provenance independently of current choices and rejects borrowed material pins',()=>{
    const record={...creationSourcesPreview(selection),storyId:'novel',createdAt:'2026-10-16T10:30:00Z'}
    expect(verifyCreationSources(record,'novel')).toBe(true)
    expect(verifyCreationSources(record,'other')).toBe(false)
    for(const field of ['source_card_id','source_lorebook_id','source_card_version_id','source_card_version_number'] as const){
        const corrupt=structuredClone(record)
        Object.assign(corrupt.references[2].snapshot,{[field]:field==='source_card_version_number'?4:'borrowed'})
        expect(verifyCreationSources(corrupt,'novel')).toBe(false)
    }
    const corrupt=structuredClone(record);corrupt.references[2].origin='library'
    expect(verifyCreationSources(corrupt,'novel')).toBe(false)
    const old=structuredClone(record);old.references.forEach((ref)=>delete ref.origin)
    expect(verifyCreationSources(old,'novel')).toBe(true)
    expect(verifyCreationSources({...record,createdAt:'invalid'},'novel')).toBe(false)
})
it('rejects oversized, unbounded and malformed snapshot content without truncating the input',()=>{
    for(const patch of [{approvedMaterials:[{...selection.approvedMaterials[0],text:'🙂'.repeat(20_001)}]},
        {approvedMaterials:[...selection.approvedMaterials,...selection.approvedMaterials]},
        {source:{kind:'blank',id:'borrowed'}},{cardRefs:[{kind:'character',cardId:'mira',sceneId:'scene'}]}]){
        expect(isCreationSourcesSelection({...selection,...patch})).toBe(false)
    }
    const preview=creationSourcesPreview(selection)
    Object.assign(preview.references[0].snapshot,{category:[{name:'Details',description:'A category',attributes:[{height:42}]}]})
    expect(verifyCreationSourcesPreview(preview,selection)).toBe(false)
})
const wire='/tmp/novel-creation-sources-wire.json'
it.skipIf(!existsSync(wire))('accepts the actual isolated MySQL source preview, frozen origin, creation receipt and independent manuscript',()=>{
    const value=JSON.parse(readFileSync(wire,'utf-8'))
    expect(verifyCreationSourcesPreview(value.preview,value.selection)).toBe(true)
    expect(verifyCreationSources(value.provenance,value.story.id)).toBe(true)
    expect(verifyStoryCreationAcknowledgement(value.ack,value.write)).toBe(true)
    expect(verifyStory(value.story)).toBe(true)
})
