import type { StoryCardKind,StoryCreationSourcesPreview,StoryCreationSourcesSelection,StoryCreationSourceReference } from '@/shared'
export function creationSourcesPreview(selection:StoryCreationSourcesSelection={},version='a'):StoryCreationSourcesPreview {
    const source=selection.source??{kind:'blank'},refs=new Map<string,StoryCreationSourceReference>()
    const add=(kind:StoryCardKind,cardId:string,title:string)=>refs.set(kind+':'+cardId,{kind,cardId,source:'source',enabled:true,precedence:0,origin:'library',
        snapshot:{id:cardId,name:title,description:'Pinned source content.',story_card_kind:kind,source_card_id:cardId,source_card_version_id:'version-three',source_card_version_number:3}})
    if(source.kind!=='blank'&&source.kind!=='adventure_session'&&source.id)add(source.kind,source.id,source.title??'The gate')
    for(const ref of selection.cardRefs??[]){
        add(ref.kind,ref.cardId,ref.kind==='character'?'Mira':'The old gate')
        const item=refs.get(ref.kind+':'+ref.cardId)!;item.enabled=ref.enabled??true;item.precedence=ref.precedence??0;item.source=ref.source??'manual'
        if(!['character','world','item','adventure_template'].includes(ref.kind)&&ref.snapshot){item.snapshot=structuredClone(ref.snapshot);item.origin='provided'}
    }
    for(const material of selection.approvedMaterials??[]){
        const cardId='material-'+material.key
        refs.set('snapshot_card:'+cardId,{kind:'snapshot_card',cardId,source:'source',enabled:material.enabled??true,precedence:0,materialKey:material.key,origin:'approved_material',
            snapshot:{id:cardId,name:material.title,description:material.text,story_card_kind:'snapshot_card'}})
    }
    return {schemaVersion:1,sourceVersion:version.repeat(64),source:{kind:source.kind,id:source.id??null,title:source.title??null},references:[...refs.values()]}
}
