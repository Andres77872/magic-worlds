import { MetadataLineList } from './MetadataLineList'
import { NovelPlannedBeats } from './NovelPlannedBeats'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { StoryTemplateUnit,StoryWritingTemplate } from '@/shared'
import { Button,Field,Input,Select,Textarea,cx } from '@/ui/primitives'
import { editTemplateUnit,moveTemplateUnit,removeTemplateUnit,selectedTemplateUnit,templateCounts,templateRows,type TemplateSelection } from '../utils/writingTemplates'

interface Props {value:StoryWritingTemplate;onChange:(value:StoryWritingTemplate)=>void;disabled?:boolean}
const same=(left:TemplateSelection,right:TemplateSelection)=>left.kind===right.kind&&left.index===right.index&&('chapterIndex' in left?left.chapterIndex:null)===('chapterIndex' in right?right.chapterIndex:null)
export function NovelTemplateEditor({value,onChange,disabled=false}:Props){
    const {t}=useTranslation(),copy=(key:string,options?:Record<string,unknown>)=>t('novelEditor.templates.'+key,options)
    const [selection,setSelection]=useState<TemplateSelection>({kind:'chapter',index:0})
    const [removed,setRemoved]=useState<{value:StoryWritingTemplate;selection:TemplateSelection}|null>(null)
    const selected=selectedTemplateUnit(value,selection),counts=templateCounts(value)
    const change=(next:StoryWritingTemplate)=>{setRemoved(null);onChange(next)}
    const patch=(patch:Partial<StoryTemplateUnit>)=>change(editTemplateUnit(value,selection,patch))
    const detail=(key:string,next:unknown)=>patch({details:{...selected?.details,[key]:next}})
    function add(kind:'part'|'chapter'|'scene'){
        if(kind==='part'){
            setSelection({kind,index:value.parts?.length??0});change({...value,parts:[...(value.parts??[]),{title:copy('newPart')}]});return
        }
        const chapterIndex=selection.kind==='scene'?selection.chapterIndex:selection.kind==='chapter'?selection.index:null
        if(kind==='chapter'){
            const partIndex=selection.kind==='part'?selection.index:chapterIndex===null?null:value.chapters[chapterIndex]?.partIndex??null
            setSelection({kind,index:value.chapters.length});change({...value,chapters:[...value.chapters,{title:copy('newChapter'),partIndex,scenes:[{title:copy('newScene')}]}]});return
        }
        if(chapterIndex===null)return
        setSelection({kind,chapterIndex,index:value.chapters[chapterIndex].scenes.length})
        change({...value,chapters:value.chapters.map((chapter,index)=>index===chapterIndex?{...chapter,scenes:[...chapter.scenes,{title:copy('newScene')}]}:chapter)})
    }
    function move(direction:-1|1){const next=moveTemplateUnit(value,selection,direction);change(next.value);setSelection(next.selection)}
    function remove(){const next=removeTemplateUnit(value,selection);if(next.value===value)return;setRemoved({value,selection});onChange(next.value);setSelection(next.selection)}
    const removeDisabled=selection.kind==='chapter'?value.chapters.length<=1:selection.kind==='scene'?value.chapters[selection.chapterIndex].scenes.length<=1:false
    return <div className="space-y-4">
        <Field label={copy('name')}><Input value={value.name} maxLength={255} disabled={disabled} onChange={(event)=>change({...value,name:event.target.value})}/></Field>
        <p className="text-caption text-parchment-300" role="status">{copy('counts',{parts:copy('partCount',{count:counts.parts}),chapters:copy('chapterCount',{count:counts.chapters}),scenes:copy('sceneCount',{count:counts.scenes})})}</p>
        <fieldset disabled={disabled} className="space-y-3 rounded-lg border border-line p-3">
            <legend className="px-1 text-label font-semibold">{copy('defaults')}</legend>
            <p className="text-caption text-parchment-300">{copy('defaultsHelp')}</p>
            <div className="grid gap-3 sm:grid-cols-2">{(['language','genre','audience','narrator','tense'] as const).map((key)=><Field key={key} label={copy(key)}><Input value={value.defaults?.[key]??''} maxLength={20_000} disabled={disabled} onChange={(event)=>change({...value,defaults:{...value.defaults,[key]:event.target.value||null}})}/></Field>)}</div>
            <Field label={copy('styleGuide')}><Textarea rows={3} value={value.defaults?.styleGuide??''} maxLength={20_000} disabled={disabled} onChange={(event)=>change({...value,defaults:{...value.defaults,styleGuide:event.target.value||null}})}/></Field>
        </fieldset>
        <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" disabled={disabled||counts.parts>=2000} onClick={()=>add('part')}>{copy('addPart')}</Button>
            <Button size="sm" variant="secondary" disabled={disabled||counts.chapters>=2000||counts.scenes>=20_000} onClick={()=>add('chapter')}>{copy('addChapter')}</Button>
            <Button size="sm" variant="secondary" disabled={disabled||selection.kind==='part'||counts.scenes>=20_000} onClick={()=>add('scene')}>{copy('addScene')}</Button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
            <nav aria-label={copy('outline')} className="max-h-80 space-y-1 overflow-auto rounded-lg border border-line p-2">
                {templateRows(value).map((row)=><Button key={JSON.stringify(row.selection)} size="sm" variant={same(row.selection,selection)?'secondary':'ghost'}
                    aria-current={same(row.selection,selection)?'true':undefined} aria-label={copy('editItem',{kind:copy(row.selection.kind),title:row.title||copy('untitled')})}
                    className={cx('block w-full truncate text-start',row.depth===1&&'pl-6',row.depth===2&&'pl-10')} disabled={disabled} onClick={()=>setSelection(row.selection)}>
                    {copy(row.selection.kind)} · {row.title||copy('untitled')}
                </Button>)}
            </nav>
            {selected&&<div className="space-y-3">
                <Field label={copy('itemTitle')}><Input value={selected.title} maxLength={255} disabled={disabled} onChange={(event)=>patch({title:event.target.value})}/></Field>
                {selection.kind==='chapter'&&<Field label={copy('part')}><Select value={String(value.chapters[selection.index].partIndex??'none')} disabled={disabled} onChange={(next)=>change({...value,chapters:value.chapters.map((chapter,index)=>index===selection.index?{...chapter,partIndex:next==='none'?null:Number(next)}:chapter)})}
                    options={[{value:'none',label:copy('ungrouped')},...(value.parts??[]).map((part,index)=>({value:String(index),label:part.title||copy('untitled')}))]}/></Field>}
                <Field label={copy('status')}><Select value={selected.status??''} disabled={disabled} onChange={(next)=>patch({status:next?next as StoryTemplateUnit['status']:null})} options={['','draft','revising','complete'].map((status)=>({value:status,label:t('novelEditor.structure.'+(status?'statuses.'+status:'inherit'))}))}/></Field>
                <Field label={copy('goal')} helper={copy('goalHelp')}><Input type="number" min={1} max={2_147_483_647} value={selected.wordGoal??''} disabled={disabled} onChange={(event)=>patch({wordGoal:event.target.value===''?null:Number(event.target.value)})}/></Field>
                {(['synopsis','narrator','tense','narrativeTime','notes'] as const).map((key)=><Field key={key} label={copy(key)}><Textarea rows={key==='synopsis'||key==='notes'?3:1} value={selected.details?.[key]??''} maxLength={20_000} disabled={disabled} onChange={(event)=>detail(key,event.target.value||null)}/></Field>)}
                <Field label={t('novelEditor.planning.tags')} helper={t('novelEditor.planning.tagsHelp')}><MetadataLineList key={JSON.stringify(selection)+'tags'} value={selected.details?.tags} disabled={disabled} onChange={(value)=>detail('tags',value)}/></Field>
                <NovelPlannedBeats key={JSON.stringify(selection)+'beats'} value={selected.details?.plannedBeats} disabled={disabled} onChange={(value)=>detail('plannedBeats',value)}/>
                <Field label={copy('plotThreads')}><Textarea rows={2} value={selected.details?.plotThreads?.join('\n')??''} disabled={disabled} onChange={(event)=>detail('plotThreads',event.target.value===''?null:event.target.value.split('\n'))} onBlur={(event)=>detail('plotThreads',event.target.value.split('\n').filter(Boolean))}/></Field>
                {(['includeInAI','includeInExport'] as const).map((key)=><Field key={key} label={copy(key)}><Select value={selected.details?.[key]===true?'yes':selected.details?.[key]===false?'no':''} disabled={disabled}
                    onChange={(next)=>detail(key,next==='yes'?true:next==='no'?false:null)} options={['','yes','no'].map((value)=>({value,label:t('novelEditor.structure.'+(value||'inherit'))}))}/></Field>)}
                <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="secondary" disabled={disabled||moveTemplateUnit(value,selection,-1).value===value} onClick={()=>move(-1)}>{copy('up')}</Button>
                    <Button size="sm" variant="secondary" disabled={disabled||moveTemplateUnit(value,selection,1).value===value} onClick={()=>move(1)}>{copy('down')}</Button>
                    <Button size="sm" variant="ghost" disabled={disabled||removeDisabled} onClick={remove}>{copy('remove')}</Button>
                </div>
                {selection.kind==='part'&&<p className="text-caption text-parchment-300">{copy('removePartHelp')}</p>}
            </div>}
        </div>
        {removed&&<Button size="sm" variant="secondary" disabled={disabled} onClick={()=>{onChange(removed.value);setSelection(removed.selection);setRemoved(null)}}>{copy('undoRemove')}</Button>}
    </div>
}
