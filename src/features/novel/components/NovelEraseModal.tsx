import { useEffect,useLayoutEffect,useRef,useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { StoryErasePreview } from '@/shared'
import { Button,Callout,Field,Input,Modal } from '@/ui/primitives'
import { makeRequestId } from '@/utils/uuid'
import { erasureError,type EraseError,type NovelErases } from '../hooks/useNovelErases'

export function NovelEraseModal({source,erases,onClose,onErased}:{source:{id:string;title:string};erases:NovelErases;onClose:()=>void;onErased:()=>void}){
    const {t}=useTranslation()
    const text=(key:string,values?:Record<string,unknown>)=>t('novelEditor.erasure.'+key,values)
    const key=JSON.stringify([source.id,erases.scopeKey])
    const live=useRef(key),controller=useRef(erases),mounted=useRef(true)
    useLayoutEffect(()=>{live.current=key;controller.current=erases})
    useEffect(()=>{mounted.current=true;return()=>{mounted.current=false}},[])
    const [snapshot,setSnapshot]=useState<{key:string;value:StoryErasePreview|null;loading:boolean;error:EraseError|null}>({key,value:null,loading:true,error:null})
    const [confirmation,setConfirmation]=useState(''),[job,setJob]=useState<string|null>(null),[reload,setReload]=useState(0)
    const busy=job===key
    useEffect(()=>{
        let current=true
        controller.current.preview(source.id).then((value)=>{if(current){setConfirmation('');setSnapshot({key,value,loading:false,error:value?null:'failed'})}})
            .catch((error)=>{if(current)setSnapshot({key,value:null,loading:false,error:erasureError(error)})})
        return()=>{current=false}
    },[key,source.id,reload])
    const {value:preview,loading,error}=snapshot.key===key?snapshot:{value:null,loading:true,error:null}
    const pending=erases.items.find((record)=>record.write.storyId===source.id)
    const blocked=erases.hasPending(source.id)
    async function erase(){
        if(!preview||loading||busy||blocked||erases.readOnly||preview.activeExecutions||confirmation!==preview.title)return
        const owner=key
        setJob(owner)
        try{
            const result=await erases.start(preview,{requestId:makeRequestId('novel-erase'),expectedSourceVersion:preview.sourceVersion,confirmedTitle:confirmation})
            if(result&&mounted.current&&live.current===owner){onErased();if(mounted.current&&live.current===owner)onClose()}
        }catch(failure){
            if(mounted.current&&live.current===owner){
                const reason=erasureError(failure)
                setSnapshot((old)=>({...old,error:reason,value:['changed','confirmation','active'].includes(reason)?null:old.value}))
            }
        }finally{if(mounted.current&&live.current===owner)setJob(null)}
    }
    return <Modal open title={text('title')} onClose={onClose} size="lg" footer={<>
        <Button variant="ghost" onClick={onClose}>{text('close')}</Button>
        <Button variant="danger" disabled={!preview||loading||busy||blocked||erases.readOnly||Boolean(preview?.activeExecutions)||confirmation!==preview?.title} aria-busy={busy} onClick={()=>void erase()}>{text(busy?'busy':'action')}</Button>
    </>}>
        <div className="space-y-4">
            <p className="text-h3 font-display break-words">{preview?.title??source.title}</p>
            <Callout tone="warning">{text('help')}</Callout>
            <p className="text-body text-parchment-300">{text('retained')}</p>
            <p className="text-body text-parchment-300">{text('device')}</p>
            {loading&&<p role="status">{text('loading')}</p>}
            {preview&&<div className="space-y-2" role="status">{(['units','review','history','variants','records','assistantRecords'] as const).map((name)=><p key={name}>{text(name,{...preview.counts})}</p>)}</div>}
            {Boolean(preview?.activeExecutions)&&<Callout tone="warning">{text('active')}</Callout>}
            {erases.readOnly&&<Callout tone="warning">{text('readonly')}</Callout>}
            <Field label={text('name')} helper={text('nameHelp')}><Input autoComplete="off" spellCheck={false} maxLength={510} value={snapshot.key===key?confirmation:''} disabled={loading||busy||blocked||erases.readOnly||!preview} onChange={(event)=>setConfirmation(event.target.value)}/></Field>
            {blocked&&<Callout tone="warning">{text(pending?.write.ack?'confirmed':'pendingHelp')}</Callout>}
            {pending?.storageFailed&&<Callout tone="warning">{text('storageFailed')}</Callout>}
            {error&&<Callout tone="warning" role="alert">{text(error==='pending'?'pendingOperation':error)}</Callout>}
            <Button variant="secondary" size="sm" disabled={busy||blocked} onClick={()=>{setSnapshot({key,value:null,loading:true,error:null});setConfirmation('');setReload((n)=>n+1)}}>{text('refresh')}</Button>
            <p className="text-caption text-parchment-300">{text('closing')}</p>
        </div>
    </Modal>
}
