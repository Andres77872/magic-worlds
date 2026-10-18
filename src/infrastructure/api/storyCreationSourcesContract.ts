import type { StoryCreationSources,StoryCreationSourcesPreview,StoryCreationSourcesSelection } from '@/shared'
import { isRecord } from '@/shared/novelMutationJournal'
import { verifyStoryReference } from './storyContract'
const fields=(value:Record<string,unknown>,keys:string[])=>Object.keys(value).every((key)=>keys.includes(key))
const text=(value:unknown,max:number):value is string=>typeof value==='string'&&Array.from(value).length<=max
const title=(value:unknown,max=255):value is string=>text(value,max)&&Boolean(value)&&value===value.trim()
const key=(value:unknown):value is string=>typeof value==='string'&&/^[A-Za-z0-9._:-]{1,64}$/.test(value)
const bytes=(value:unknown,max=1_000_000)=>{try{return new TextEncoder().encode(JSON.stringify(value)).length<=max}catch{return false}}
function snapshot(value:unknown):boolean {
    if(!isRecord(value)||!fields(value,['id','name','alias','description','race','type','category','source_card_id','source_lorebook_id','source_card_version_id','source_card_version_number','story_card_kind']))return false
    if(['name','alias','race','type'].some((key)=>value[key]!==undefined&&value[key]!==null&&typeof value[key]!=='string'))return false
    if(['source_card_id','source_lorebook_id'].some((key)=>value[key]!==undefined&&value[key]!==null&&!title(value[key],64)))return false
    if(value.category!==undefined&&value.category!==null&&(!Array.isArray(value.category)||!value.category.every((item)=>isRecord(item)&&fields(item,['name','description','attributes'])
        &&typeof item.name==='string'&&typeof item.description==='string'&&(item.attributes===undefined||item.attributes===null||Array.isArray(item.attributes)&&item.attributes.every((attributes)=>isRecord(attributes)&&Object.values(attributes).every((entry)=>typeof entry==='string'))))))return false
    return true
}
export function isCreationSourcesSelection(value:unknown):value is StoryCreationSourcesSelection {
    if(!isRecord(value)||!fields(value,['source','cardRefs','approvedMaterials']))return false
    if(value.source!==undefined){
        const source=value.source
        if(!isRecord(source)||!fields(source,['kind','id','title'])||!['blank','character','world','item','adventure_template','adventure_session'].includes(String(source.kind)))return false
        if(source.kind==='blank'?(source.id!=null||source.title!=null):(!title(source.id,64)||!title(source.title)))return false
    }
    if(value.cardRefs!==undefined&&(!Array.isArray(value.cardRefs)||value.cardRefs.length>100||!value.cardRefs.every((ref)=>isRecord(ref)
        &&fields(ref,['kind','cardId','source','enabled','precedence','chapterId','sceneId','snapshot'])
        &&['character','world','item','adventure_template','lorebook','lorebook_entry','snapshot_card'].includes(String(ref.kind))&&title(ref.cardId,64)
        &&(ref.source===undefined||['manual','mention','suggested','source','lore_activation'].includes(String(ref.source)))
        &&(ref.enabled===undefined||typeof ref.enabled==='boolean')&&(ref.precedence===undefined||Number.isSafeInteger(ref.precedence)&&Number(ref.precedence)>=0)
        &&ref.chapterId==null&&ref.sceneId==null&&(ref.snapshot==null||isRecord(ref.snapshot)))))return false
    if(value.approvedMaterials!==undefined){
        if(!Array.isArray(value.approvedMaterials)||value.approvedMaterials.length>20||!value.approvedMaterials.every((material)=>isRecord(material)&&fields(material,['key','kind','title','text','enabled'])
            &&key(material.key)&&material.kind==='approved_adventure_material'&&title(material.title)&&text(material.text,20_000)&&Boolean(material.text.trim())
            &&(material.enabled===undefined||typeof material.enabled==='boolean'))||new Set(value.approvedMaterials.map((material)=>material.key)).size!==value.approvedMaterials.length)return false
    }
    return bytes(value)
}
export function verifyCreationSourcesPreview(value:unknown,selection?:StoryCreationSourcesSelection,provenance=false):value is StoryCreationSourcesPreview {
    const keys=['schemaVersion','sourceVersion','source','references',...(provenance?['storyId','createdAt']:[])]
    if(!isRecord(value)||!fields(value,keys)||value.schemaVersion!==1||typeof value.sourceVersion!=='string'||!/^[0-9a-f]{64}$/.test(value.sourceVersion)
        ||!isRecord(value.source)||Object.keys(value.source).length!==3||!isCreationSourcesSelection({source:value.source})
        ||!Array.isArray(value.references)||value.references.length>100||!bytes({schemaVersion:1,sourceVersion:value.sourceVersion,source:value.source,references:value.references}))return false
    const identities=new Set<string>(),materials=new Map((selection?.approvedMaterials??[]).map((material)=>[material.key,material]))
    const foundMaterials=new Set<string>(),selected=new Map((selection?.cardRefs??[]).map((ref)=>[ref.kind+':'+ref.cardId,ref])),expected=new Set(selected.keys())
    const primary=selection?.source
    if(selection&&((primary?.kind??'blank')!==value.source.kind||(primary?.id??null)!==value.source.id))return false
    if(primary&&primary.kind!=='blank'&&primary.kind!=='adventure_session')expected.add(primary.kind+':'+primary.id)
    for(const [index,item] of value.references.entries()){
        if(!isRecord(item)||!fields(item,['kind','cardId','source','enabled','precedence','snapshot','materialKey','origin'])
            ||item.origin!==undefined&&!['library','saved_adventure','provided','approved_material'].includes(String(item.origin))
            ||!['kind','cardId','source','enabled','precedence','snapshot'].every((field)=>field in item)
            ||!snapshot(item.snapshot)
            ||!verifyStoryReference({...item,id:'creation-preview-'+index,storyId:'creation-preview',chapterId:null,sceneId:null,removedAt:null}))return false
        const identity=item.kind+':'+item.cardId
        if(identities.has(identity))return false
        identities.add(identity)
        const requested=selected.get(identity)
        if(requested&&(item.enabled!==(requested.enabled??true)||item.precedence!==(requested.precedence??0)||item.source!==(requested.source??'manual')))return false
        if(item.materialKey!==undefined){
            const approved=item.snapshot
            if(!key(item.materialKey)||item.kind!=='snapshot_card'||foundMaterials.has(item.materialKey)||!isRecord(approved)
                ||item.origin!==undefined&&item.origin!=='approved_material'||item.source!=='source'||item.precedence!==0
                ||!title(approved.name)||!text(approved.description,20_000)||!approved.description.trim()
                ||['source_card_id','source_lorebook_id','source_card_version_id','source_card_version_number'].some((field)=>approved[field]!=null))return false
            foundMaterials.add(item.materialKey)
            if(selection){
                const material=materials.get(item.materialKey)
                if(!material||approved.name!==material.title||approved.description!==material.text||item.enabled!==(material.enabled??true))return false
            }
        }else if(selection&&primary?.kind!=='adventure_session'&&!expected.has(identity))return false
    }
    if(selection&&([...expected].some((identity)=>!identities.has(identity))||foundMaterials.size!==materials.size))return false
    return true
}
export function verifyCreationSources(value:unknown,storyId:string):value is StoryCreationSources {
    return verifyCreationSourcesPreview(value,undefined,true)&&isRecord(value)&&value.storyId===storyId&&typeof value.createdAt==='string'&&Number.isFinite(Date.parse(value.createdAt))
}
