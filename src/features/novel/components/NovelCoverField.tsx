import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AuthenticatedImage,Button,Callout,Field,Textarea } from '@/ui/primitives'
import { storyCoverUrl } from '@/shared/storyNovelDetails'
import { OwnedImagePickerDrawer,type OwnedImagePickerApi } from '@/features/gallery/media/components/OwnedImagePickerDrawer'

export function NovelCoverPreview({assetId,alt,title}:{assetId:unknown;alt?:unknown;title:string}){
    const {t}=useTranslation(),src=storyCoverUrl(assetId)
    return src?<CoverPreview key={src} src={src} alt={typeof alt==='string'&&alt.trim()?alt:t('novelEditor.covers.coverFor',{title})}/>:<p className="text-caption text-parchment-300">{t('novelEditor.covers.noCover')}</p>
}
function CoverPreview({src,alt}:{src:string;alt:string}){
    const {t}=useTranslation(),[failed,setFailed]=useState(false),[attempt,setAttempt]=useState(0)
    return failed?<Callout tone="warning"><p>{t('novelEditor.covers.unavailable')}</p><Button variant="secondary" size="sm" onClick={()=>{setAttempt((value)=>value+1);setFailed(false)}}>{t('novelEditor.covers.retryPreview')}</Button></Callout>:<AuthenticatedImage key={attempt} src={src} alt={alt} className="max-h-48 w-full rounded-lg object-contain" onError={()=>setFailed(true)}/>
}
interface Props {assetId:unknown;alt:unknown;title:string;disabled:boolean;workspaceId:string|null;sessionKey:string|null;api?:OwnedImagePickerApi;onAsset:(id:string|null)=>void;onAlt:(value:string|null)=>void}
export function NovelCoverField({assetId,alt,title,disabled,workspaceId,sessionKey,api,onAsset,onAlt}:Props){
    const {t}=useTranslation(),copy=(key:string,options?:Record<string,unknown>)=>t('novelEditor.covers.'+key,options)
    const [picking,setPicking]=useState(false),description=typeof alt==='string'?alt:''
    return <section className="space-y-3" aria-label={copy('label')}>
        <p className="text-label font-semibold">{copy('label')}</p>
        <NovelCoverPreview assetId={assetId} alt={alt} title={title}/>
        <div className="flex flex-wrap gap-2"><Button variant="secondary" size="sm" disabled={disabled||!api||!workspaceId||!sessionKey} onClick={()=>setPicking(true)}>{copy('choose')}</Button>
            <Button variant="ghost" size="sm" disabled={disabled||!assetId} onClick={()=>onAsset(null)}>{copy('remove')}</Button></div>
        <Field label={copy('altLabel')} helper={copy('altHelp',{count:Array.from(description).length})}><Textarea rows={2} disabled={disabled} value={description} onChange={(event)=>onAlt(event.target.value||null)}/></Field>
        {api&&workspaceId&&sessionKey&&<OwnedImagePickerDrawer open={picking} api={api} workspaceId={workspaceId} sessionKey={sessionKey} initialAssetId={typeof assetId==='string'?assetId:null} readOnly={disabled} onClose={()=>setPicking(false)} onChoose={onAsset}/>}
    </section>
}
