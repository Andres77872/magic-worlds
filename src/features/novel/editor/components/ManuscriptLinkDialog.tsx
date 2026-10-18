import { useEffect,useRef,useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Editor } from '@tiptap/core'
import { Link } from 'lucide-react'
import { Button,ButtonLink,Callout,Field,Icon,Input,Modal } from '@/ui/primitives'
import { applyManuscriptLink,isManuscriptLinkHref,isManuscriptLinkTitle,linkTargetCurrent,type ManuscriptLinkTarget } from '../manuscriptLinks'

interface Props {target:ManuscriptLinkTarget;editor:Editor|null;readOnly:boolean;blocked:boolean;canWrite:()=>boolean;onClose:()=>void}
export function ManuscriptLinkDialog({target,editor,readOnly,blocked,canWrite,onClose}:Props){
    const {t}=useTranslation(),copy=(key:string)=>t('novelEditor.links.'+key)
    const [href,setHref]=useState(target.href),[title,setTitle]=useState(target.title),[changed,setChanged]=useState(false),[copied,setCopied]=useState(false),[copyFailed,setCopyFailed]=useState(false)
    const alive=useRef(false),copyAttempt=useRef(0)
    const [applyFailed,setApplyFailed]=useState(false)
    useEffect(()=>{alive.current=true;return()=>{alive.current=false}},[])
    useEffect(()=>{
        const invalidate=()=>{if(!linkTargetCurrent(editor,target))setChanged(true)}
        const destroyed=()=>{if(alive.current)setChanged(true)}
        editor?.on('transaction',invalidate);editor?.on('destroy',destroyed)
        return()=>{editor?.off('transaction',invalidate);editor?.off('destroy',destroyed)}
    },[editor,target])
    const stale=changed||!linkTargetCurrent(editor,target),locked=readOnly||blocked||stale
    const apply=(remove=false)=>{
        if(locked||!editor||!canWrite())return
        if(!applyManuscriptLink(editor,target,href,title,remove)){if(!linkTargetCurrent(editor,target))setChanged(true);else setApplyFailed(true);return}
        onClose();editor.commands.focus()
    }
    const copyUrl=async()=>{
        const attempt=++copyAttempt.current;setCopied(false);setCopyFailed(false)
        const current=()=>alive.current&&attempt===copyAttempt.current
        try{if(!navigator.clipboard?.writeText)throw new Error('Clipboard unavailable');await navigator.clipboard.writeText(href);if(current())setCopied(true)}catch{if(current())setCopyFailed(true)}
    }
    return <Modal open title={copy('title')} icon={<Icon icon={Link}/>} onClose={onClose} footer={<>
        <Button variant="ghost" onClick={onClose}>{copy('cancel')}</Button>
        {target.hasLink&&!readOnly&&<Button variant="danger-ghost" disabled={locked} onClick={()=>apply(true)}>{copy('remove')}</Button>}
        {!readOnly&&<Button disabled={locked||!isManuscriptLinkHref(href)||!isManuscriptLinkTitle(title)} onClick={()=>apply()}>{copy('save')}</Button>}
    </>}>
        <div className="space-y-4">
            <p className="text-body text-parchment-200">{copy(readOnly?'readerHelp':target.from===target.to?'insertHelp':'selectionHelp')}</p>
            {target.label&&<p className="break-words whitespace-pre-wrap font-narrative text-body text-parchment-100">{target.label}</p>}
            {target.mixed&&<Callout role="status">{copy('mixed')}</Callout>}
            {stale&&<Callout role="alert" tone="warning">{copy('changed')}</Callout>}
            {blocked&&!stale&&<Callout role="status" tone="warning">{copy('review')}</Callout>}
            {applyFailed&&!stale&&<Callout role="alert" tone="warning">{copy('applyFailed')}</Callout>}
            <Field label={copy('destination')} error={href&&!isManuscriptLinkHref(href)?copy('invalid'):undefined}><Input value={href} onChange={(event)=>{copyAttempt.current++;setHref(event.target.value);setCopied(false);setCopyFailed(false);setApplyFailed(false)}} readOnly={readOnly} maxLength={4096} placeholder="https://"/></Field>
            <Field label={copy('label')}><Input value={title} onChange={(event)=>{setTitle(event.target.value);setApplyFailed(false)}} readOnly={readOnly} maxLength={4096}/></Field>
            <div className="flex flex-wrap gap-2">
                {isManuscriptLinkHref(href)&&<ButtonLink href={href} target="_blank" rel="noopener noreferrer" variant="secondary">{copy('open')}</ButtonLink>}
                <Button variant="secondary" disabled={!href} onClick={()=>void copyUrl()}>{copy('copy')}</Button>
            </div>
            {(copied||copyFailed)&&<p role="status" className="text-caption text-parchment-300">{copy(copied?'copied':'copyFailed')}</p>}
        </div>
    </Modal>
}
