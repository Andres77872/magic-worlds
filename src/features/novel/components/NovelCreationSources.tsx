import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { StoryCreationSourcesPreview } from '@/shared'
import { CodexCardPickerDrawer } from '@/features/codex'
import { Button,Callout,Chip,Field,Input,SwitchRow,Textarea } from '@/ui/primitives'
import { generateUUID } from '@/utils/uuid'
import type { CreationSourceReview } from '../hooks/useCreationSourceReview'

export function CreationSourceSnapshots({value}:{value:StoryCreationSourcesPreview}){
    const {t}=useTranslation(),copy=(key:string,options?:Record<string,unknown>)=>t('novelEditor.sources.'+key,options)
    return <div className="space-y-3">
        {!value.references.length&&<p>{copy('empty')}</p>}
        {value.references.map((ref)=><section key={ref.kind+':'+ref.cardId} className="space-y-2 rounded-lg border border-line p-3">
            <h4 className="font-ui text-label font-semibold">{ref.snapshot.name||ref.snapshot.alias}</h4>
            <p className="text-caption text-parchment-300">{copy('kinds.'+ref.kind)} · {copy(ref.materialKey?'approvedMaterial':ref.origin==='provided'?'providedSnapshot':ref.origin==='saved_adventure'?'savedAdventure':'librarySnapshot')} · {copy(ref.enabled?'included':'excluded')}
                {ref.snapshot.source_card_version_number!=null?' · '+copy(ref.origin==='library'||ref.origin==='saved_adventure'?'version':'reportedVersion',{version:ref.snapshot.source_card_version_number}):''}</p>
            <p className="whitespace-pre-wrap break-words text-body text-parchment-200">{ref.snapshot.description}</p>
            {(['race','type'] as const).map((key)=>ref.snapshot[key]?<p key={key} className="text-caption text-parchment-300">{ref.snapshot[key]}</p>:null)}
            {ref.snapshot.category?.map((category,index)=><div key={index} className="space-y-1">
                <p className="text-label font-semibold">{category.name}</p><p className="whitespace-pre-wrap text-body">{category.description}</p>
                {category.attributes?.map((attributes,index)=><dl key={index} className="text-caption text-parchment-300">{Object.entries(attributes).map(([key,value])=><div key={key}><dt>{key}</dt><dd className="whitespace-pre-wrap">{value}</dd></div>)}</dl>)}
            </div>)}
        </section>)}
    </div>
}
export function NovelCreationSources({review,disabled=false,primaryKey}:{review:CreationSourceReview;disabled?:boolean;primaryKey?:string}){
    const {t}=useTranslation(),copy=(key:string,options?:Record<string,unknown>)=>t('novelEditor.sources.'+key,options)
    const [picking,setPicking]=useState(false)
    const existing=new Set(review.cards.map((card)=>card.kind+':'+card.cardId));if(primaryKey)existing.add(primaryKey)
    return <section className="space-y-3" aria-label={copy('title')}>
        <p className="text-caption text-parchment-300">{copy('help')}</p>
        <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" disabled={disabled||review.cards.length>=99} onClick={()=>setPicking(true)}>{copy('addCards')}</Button>
            <Button variant="secondary" size="sm" disabled={disabled||review.materials.length>=20} onClick={()=>review.setMaterials((items)=>[...items,{key:generateUUID(),kind:'approved_adventure_material',title:copy('approvedMaterial'),text:'',enabled:true}])}>{copy('addMaterial')}</Button>
        </div>
        {review.cards.length>0&&<div className="flex flex-wrap gap-2">{review.cards.map((card)=>{
            const snapshot=review.current?.value.references.find((ref)=>ref.kind===card.kind&&ref.cardId===card.cardId)?.snapshot
            const label=snapshot?.name||snapshot?.alias||card.label||copy('kinds.'+card.kind)
            return <Chip key={card.kind+':'+card.cardId} disabled={disabled} aria-label={copy('remove',{title:label})} onClick={()=>review.setCards((cards)=>cards.filter((item)=>item.kind!==card.kind||item.cardId!==card.cardId))}>{label} ×</Chip>
        })}</div>}
        {review.materials.map((material)=><div key={material.key} className="space-y-3 rounded-lg border border-line p-3">
            <Field label={copy('materialTitle')}><Input value={material.title} disabled={disabled} onChange={(event)=>review.setMaterials((items)=>items.map((item)=>item.key===material.key?{...item,title:event.target.value}:item))}/></Field>
            <Field label={copy('materialText')} helper={copy('materialHelp')+' '+copy('materialLength',{count:Array.from(material.text).length})}><Textarea rows={5} value={material.text} disabled={disabled} onChange={(event)=>review.setMaterials((items)=>items.map((item)=>item.key===material.key?{...item,text:event.target.value}:item))}/></Field>
            <SwitchRow label={copy('includeMaterial')} checked={material.enabled??true} disabled={disabled} onChange={(enabled)=>review.setMaterials((items)=>items.map((item)=>item.key===material.key?{...item,enabled}:item))}/>
            <Button size="sm" variant="ghost" disabled={disabled} onClick={()=>review.setMaterials((items)=>items.filter((item)=>item.key!==material.key))}>{copy('remove',{title:material.title})}</Button>
        </div>)}
        {review.hasSources&&<>
            {!review.available&&<Callout tone="warning">{copy('unavailable')}</Callout>}
            {!review.valid&&<Callout tone="warning" role="alert">{copy('invalid')}</Callout>}
            {review.failure&&<Callout tone="warning" role="alert">{copy(review.failure)}</Callout>}
            <Button variant="secondary" size="sm" disabled={disabled||!review.available||!review.valid||review.busy} onClick={()=>void review.refresh()}>{copy(review.busy?'loading':'review')}</Button>
            {review.current?<>
                <CreationSourceSnapshots value={review.current.value}/>
                <SwitchRow label={copy('approve')} description={copy('approvalHelp')} checked={review.current.approved} disabled={disabled} onChange={review.approve}/>
            </>:<p className="text-caption text-parchment-300">{copy('reviewRequired')}</p>}
        </>}
        {picking&&<CodexCardPickerDrawer open busy={false} readOnly={disabled} onClose={()=>setPicking(false)} existingCardKeys={existing} includeSelectionLabels
            copyKeys={{title:'novelEditor.sources.addCards',hint:'novelEditor.sources.pickerHelp',inCodex:'novelEditor.sources.alreadySelected'}}
            onAdd={async(cards,labels)=>review.setCards((current)=>{
                const next=new Map(current.map((card)=>[card.kind+':'+card.cardId,card]))
                for(const card of cards){const key=card.kind+':'+card.cardId;if(key!==primaryKey)next.set(key,{...card,source:'source',label:labels?.[key]??copy('selectedReference')})}
                return [...next.values()]
            })}/>}
    </section>
}
