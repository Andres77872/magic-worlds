import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ListFilter } from 'lucide-react'
import type { StoryLibraryFilters } from '@/shared'
import { isStoryLibraryFilters,storyLibrarySearchScopes,storyLibrarySorts } from '@/shared/storyLibrary'
import { Button,Callout,Drawer,Field,Icon,Input,Select,SwitchRow } from '@/ui/primitives'

const textFields=['genre','language','audience','tag','updatedFrom','updatedThrough'] as const
const sizeFields=['minWords','maxWords'] as const
export function NovelLibraryFilters({value,onChange,disabled=false}:{value:StoryLibraryFilters;onChange:(value:StoryLibraryFilters)=>void;disabled?:boolean}){
    const {t}=useTranslation(),copy=(key:string)=>t('novelEditor.library.'+key)
    const [open,setOpen]=useState(false),[draft,setDraft]=useState(value),[invalid,setInvalid]=useState(false)
    const [sizes,setSizes]=useState({minWords:'',maxWords:''})
    function normalized(){
        const next={...draft}
        for(const key of sizeFields){
            const text=sizes[key].trim()
            if(!text)delete next[key]
            else if(!/^\d+$/.test(text)||!Number.isSafeInteger(Number(text)))return null
            else next[key]=Number(text)
        }
        for(const key of textFields){const text=next[key]?.trim();if(text)next[key]=text;else delete next[key]}
        if(next.searchIn==='all')delete next.searchIn
        if(next.sort==='updated_desc')delete next.sort
        if(!next.includeArchivedSections)delete next.includeArchivedSections
        return next
    }
    function apply(){const next=normalized();if(!isStoryLibraryFilters(next)){setInvalid(true);return}onChange(next);setOpen(false)}
    const count=Object.keys(value).length
    return <>
        <Button variant="secondary" disabled={disabled} iconLeft={<Icon icon={ListFilter} size={16}/>} aria-expanded={open} onClick={()=>{setDraft(value);setSizes({minWords:value.minWords?.toString()??'',maxWords:value.maxWords?.toString()??''});setInvalid(false);setOpen(true)}}>{copy('filters')}{count?` · ${count}`:''}</Button>
        <Drawer open={open} onClose={()=>setOpen(false)} title={copy('filters')} size="lg" footer={<>
            <Button variant="ghost" onClick={()=>{setDraft({});onChange({});setOpen(false)}}>{copy('reset')}</Button>
            <Button variant="secondary" onClick={()=>setOpen(false)}>{t('common.cancel')}</Button>
            <Button disabled={disabled} onClick={apply}>{copy('apply')}</Button>
        </>}>
            <div className="space-y-4">
                <p className="text-body text-parchment-200">{copy('help')}</p>
                <p className="text-caption text-parchment-300">{copy('lifecycleHelp')}</p>
                {invalid&&<Callout tone="warning" role="alert">{copy('invalid')}</Callout>}
                <Field label={copy('searchIn')}><Select value={draft.searchIn??'all'} onChange={(searchIn)=>setDraft((current)=>({...current,searchIn:searchIn as StoryLibraryFilters['searchIn']}))} options={storyLibrarySearchScopes.map((scope)=>({value:scope,label:copy('scopes.'+scope)}))}/></Field>
                <Field label={copy('sort')}><Select value={draft.sort??'updated_desc'} onChange={(sort)=>setDraft((current)=>({...current,sort:sort as StoryLibraryFilters['sort']}))} options={storyLibrarySorts.map((sort)=>({value:sort,label:copy('sorts.'+sort)}))}/></Field>
                <div className="grid gap-4 sm:grid-cols-2">{sizeFields.map((key)=><Field key={key} label={copy(key)}><Input inputMode="numeric" value={sizes[key]} onChange={(event)=>setSizes((current)=>({...current,[key]:event.target.value}))}/></Field>)}</div>
                <p className="text-caption text-parchment-300">{copy('sizeHelp')}</p>
                <Field label={copy('status')}><Select value={draft.status??''} onChange={(status)=>setDraft((current)=>{const next={...current};if(status)next.status=status as StoryLibraryFilters['status'];else delete next.status;return next})} options={[{value:'',label:copy('allStatuses')},...['draft','revising','complete','archived'].map((status)=>({value:status,label:t('novelEditor.structure.statuses.'+status)}))]}/></Field>
                <div className="grid gap-4 sm:grid-cols-2">{textFields.map((key)=><Field key={key} label={copy(key)} helper={key==='tag'?copy('tagHelp'):undefined}><Input type={key==='updatedFrom'||key==='updatedThrough'?'date':'text'} value={draft[key]??''} onChange={(event)=>setDraft((current)=>({...current,[key]:event.target.value}))}/></Field>)}</div>
                <SwitchRow label={copy('includeArchived')} description={copy('archivedHelp')} checked={draft.includeArchivedSections??false} onChange={(includeArchivedSections)=>setDraft((current)=>({...current,includeArchivedSections}))}/>
            </div>
        </Drawer>
    </>
}
