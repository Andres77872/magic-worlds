import { useEffect,useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ApiError } from '@/infrastructure/api'
import type { StoryAssistantPreferences,StoryAssistantPreferencesState } from '@/shared/types/storyAssistant.types'
import { DEFAULT_PREFERENCES,isAssistantPreferences,PREFERENCE_CHOICES,PREFERENCE_NOTE } from '@/shared/storyAssistantPreferences'
import { canonicalJson } from '@/utils/json'
import { Button,Callout,Field,Select,Textarea } from '@/ui/primitives'

export interface AssistantPreferencesApi {
    get:(signal:AbortSignal)=>Promise<StoryAssistantPreferencesState>
    save:(preferences:StoryAssistantPreferences,expectedVersion:number)=>Promise<StoryAssistantPreferencesState>
    clear:(expectedVersion:number)=>Promise<StoryAssistantPreferencesState>
}
type Load={state:'idle'|'loading'|'failed'}|{state:'ready';saved:StoryAssistantPreferencesState}
type Status='idle'|'saving'|'saved'|'cleared'|'changed'|'failed'

/** The account's reply preferences: how the assistant answers, never how the manuscript reads. Read when opened, saved at the version read. */
export function NovelAssistantPreferences({api,disabled=false}:{api?:AssistantPreferencesApi;disabled?:boolean}){
    const {t}=useTranslation(),text=(key:string,options?:Record<string,unknown>)=>t('novelEditor.assistantPreferences.'+key,options)
    const [open,setOpen]=useState(false),[load,setLoad]=useState<Load>({state:'idle'})
    const [form,setForm]=useState<StoryAssistantPreferences>(DEFAULT_PREFERENCES),[status,setStatus]=useState<Status>('idle')
    useEffect(()=>{
        if(!open||!api||load.state!=='loading')return
        const controller=new AbortController()
        api.get(controller.signal).then((saved)=>{if(controller.signal.aborted)return;setLoad({state:'ready',saved});setForm(saved.preferences??DEFAULT_PREFERENCES)})
            .catch(()=>{if(!controller.signal.aborted)setLoad({state:'failed'})})
        return ()=>controller.abort()
    },[open,api,load.state])
    const saved=load.state==='ready'?load.saved:null
    const changed=saved!==null&&canonicalJson(form)!==canonicalJson(saved.preferences??DEFAULT_PREFERENCES)
    const busy=disabled||status==='saving'||!saved
    async function write(action:()=>Promise<StoryAssistantPreferencesState>,done:Status){
        setStatus('saving')
        try{const next=await action();setLoad({state:'ready',saved:next});setForm(next.preferences??DEFAULT_PREFERENCES);setStatus(done)}
        catch(error){
            // Another tab saved first: show what is saved now and keep nothing from this form.
            if(error instanceof ApiError&&error.code==='STORY_ASSISTANT_PREFERENCES_CHANGED'){setStatus('changed');setLoad({state:'loading'})}
            else setStatus('failed')
        }
    }
    const edit=(patch:Partial<StoryAssistantPreferences>)=>{setForm((current)=>({...current,...patch}));if(status!=='saving')setStatus('idle')}
    const choice=(key:keyof typeof PREFERENCE_CHOICES)=><Field label={text(key)}><Select value={form[key]} disabled={busy} onChange={(value)=>edit({[key]:value})}
        options={PREFERENCE_CHOICES[key].map((value)=>({value,label:text('choices.'+key+'.'+value)}))}/></Field>

    return <details onToggle={(event)=>{const isOpen=event.currentTarget.open;setOpen(isOpen);if(isOpen&&load.state!=='ready')setLoad({state:'loading'})}}>
        <summary className="mb-3 cursor-pointer text-label">{text('title')}{saved?.preferences&&' · '+text('summary',{length:text('choices.length.'+saved.preferences.length),tone:text('choices.tone.'+saved.preferences.tone)})}</summary>
        <div className="space-y-3">
            <p className="text-caption text-parchment-300">{text('help')}</p>
            {!api&&<Callout tone="warning">{text('unavailable')}</Callout>}
            {load.state==='loading'&&<p role="status" className="text-caption text-parchment-300">{text('loading')}</p>}
            {load.state==='failed'&&<Callout tone="warning" role="alert"><p>{text('loadFailed')}</p>
                <Button size="sm" variant="secondary" className="mt-2" onClick={()=>setLoad({state:'loading'})}>{text('retry')}</Button></Callout>}
            {saved&&<>
                <div className="grid gap-3 sm:grid-cols-2">{choice('length')}{choice('format')}{choice('tone')}{choice('replyLanguage')}</div>
                <Field label={text('note')} helper={text('noteHelp',{count:Array.from(form.note).length,max:PREFERENCE_NOTE})}
                    error={Array.from(form.note).length>PREFERENCE_NOTE?text('noteTooLong'):undefined}>
                    <Textarea rows={2} value={form.note} disabled={busy} onChange={(event)=>edit({note:event.target.value})}/></Field>
                <div className="flex flex-wrap gap-2">
                    <Button size="sm" disabled={busy||!changed||!isAssistantPreferences(form)} onClick={()=>void write(()=>api!.save(form,saved.version),'saved')}>{text(status==='saving'?'saving':'save')}</Button>
                    {saved.preferences&&<Button size="sm" variant="ghost" disabled={busy} onClick={()=>void write(()=>api!.clear(saved.version),'cleared')}>{text('useDefaults')}</Button>}
                </div>
                <p className="text-caption text-parchment-400">{text(saved.preferences?'savedState':'defaultState')}</p>
            </>}
            {status==='saved'&&<p role="status" className="text-caption text-parchment-300">{text('saved')}</p>}
            {status==='cleared'&&<p role="status" className="text-caption text-parchment-300">{text('cleared')}</p>}
            {status==='changed'&&<Callout tone="warning" role="alert">{text('changed')}</Callout>}
            {status==='failed'&&<Callout tone="warning" role="alert">{text('failed')}</Callout>}
        </div>
    </details>
}
