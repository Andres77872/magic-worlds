import { useEffect,useLayoutEffect,useMemo,useRef,useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ImageOff,Upload } from 'lucide-react'
import type { ApiService } from '@/infrastructure/api'
import { verifyWorkspaceMediaPage } from '@/infrastructure/api/workspaceContract'
import type { WorkspaceMediaPage } from '@/shared'
import { IMAGE_UPLOAD_TYPES,IMAGE_UPLOAD_MAX_BYTES,ownedImageUrl } from '@/shared/imageAssets'
import { Button,Callout,Drawer,Icon,AuthenticatedImage } from '@/ui/primitives'
import { CardGrid } from '@/ui/components'
import { SELECTED_CARD_CLASS } from '@/ui/components/lists/Card'
import { useCardGallery } from '@/features/gallery/hooks/useCardGallery'

export type OwnedImagePickerApi=Pick<ApiService,'listWorkspaceMedia'|'uploadCardImage'>
interface Props {open:boolean;api:OwnedImagePickerApi;workspaceId:string;sessionKey:string;initialAssetId?:string|null;readOnly?:boolean;onClose:()=>void;onChoose:(id:string)=>void}
interface Choice {id:string;url:string}
export function OwnedImagePickerDrawer(props:Props){return props.open?<PickerSession key={props.sessionKey+':'+props.workspaceId} {...props}/>:null}
function ImageChoice({item,selected,label,onChoose,disabled}:{item:Choice;selected:boolean;label:string;onChoose:()=>void;disabled:boolean}){
    const {t}=useTranslation(),[failed,setFailed]=useState(false)
    return <Button variant="secondary" disabled={disabled} aria-pressed={selected} aria-label={label} onClick={onChoose} className={`h-auto w-full flex-col gap-2 whitespace-normal p-3 ${selected?SELECTED_CARD_CLASS:''}`}>
        {failed?<div className="flex h-32 w-full items-center justify-center rounded-md bg-ink-700"><Icon icon={ImageOff} size={24}/></div>:<AuthenticatedImage src={item.url} alt="" loading="lazy" className="h-32 w-full rounded-md object-cover" onError={()=>setFailed(true)}/>}
        <span>{label}</span>{failed&&<span className="text-caption text-parchment-300">{t('novelEditor.covers.unavailable')}</span>}
    </Button>
}
function PickerSession({api,workspaceId,sessionKey,initialAssetId,readOnly=false,onClose,onChoose}:Props){
    const {t}=useTranslation(),copy=(key:string,options?:Record<string,unknown>)=>t('novelEditor.covers.'+key,options)
    const [selected,setSelected]=useState(initialAssetId??null),[uploading,setUploading]=useState(false),[uploadError,setUploadError]=useState<string|null>(null),[reload,setReload]=useState(0)
    const input=useRef<HTMLInputElement>(null),mounted=useRef(true),uploadFlight=useRef(false),controller=useRef<AbortController|null>(null)
    const live=useRef({api,sessionKey,readOnly})
    useLayoutEffect(()=>{live.current={api,sessionKey,readOnly}},[api,sessionKey,readOnly])
    useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;controller.current?.abort()}},[])
    const config=useMemo(()=>({fetchPage:(skip:number,limit:number)=>api.listWorkspaceMedia(workspaceId,{media_kind:'image',offset:skip,limit}),toItems:(value:unknown):Choice[]=>{
        if(!verifyWorkspaceMediaPage(value,workspaceId,'image'))throw new Error('Invalid owned image library response')
        return (value as WorkspaceMediaPage).items.map((item)=>({id:item.asset_id,url:ownedImageUrl(item.asset_id)}))
    }}),[api,workspaceId])
    const gallery=useCardGallery<Choice>(config,24,{resetKey:sessionKey})
    async function upload(file:File){
        if(readOnly||uploadFlight.current)return
        if(!IMAGE_UPLOAD_TYPES.has(file.type)){setUploadError('uploadType');return}
        if(file.size>IMAGE_UPLOAD_MAX_BYTES){setUploadError('uploadSize');return}
        const owner={api,sessionKey},abort=new AbortController();controller.current=abort
        const current=()=>mounted.current&&live.current.api===owner.api&&live.current.sessionKey===owner.sessionKey&&!live.current.readOnly
        uploadFlight.current=true;setUploading(true);setUploadError(null)
        try{
            const result=await api.uploadCardImage(file,{signal:abort.signal})
            if(!current())return
            if(typeof result.asset_id!=='string'||!result.asset_id||result.asset_id!==result.asset_id.trim()||Array.from(result.asset_id).length>64)throw new Error('Invalid image upload result')
            gallery.upsertItem({id:result.asset_id,url:ownedImageUrl(result.asset_id)});setSelected(result.asset_id)
        }catch{if(current())setUploadError('uploadFailed')}
        finally{uploadFlight.current=false;if(mounted.current)setUploading(false);controller.current=null}
    }
    const canChoose=selected&&(selected===initialAssetId||gallery.items.some((item)=>item.id===selected))
    return <Drawer open onClose={onClose} title={copy('pickerTitle')} size="lg" footer={<>
        <Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
        <Button disabled={readOnly||uploading||!canChoose} onClick={()=>{if(selected){onChoose(selected);onClose()}}}>{copy('useImage')}</Button>
    </>}>
        <div className="space-y-4">
            <p className="text-body text-parchment-200">{copy('pickerHelp')}</p>
            <div className="flex flex-wrap gap-2"><Button variant="secondary" disabled={readOnly||uploading} iconLeft={<Icon icon={Upload} size={16}/>} onClick={()=>input.current?.click()}>{copy(uploading?'uploading':'upload')}</Button>
                <Button variant="ghost" disabled={uploading} onClick={()=>{setReload((value)=>value+1);gallery.refresh()}}>{copy('refresh')}</Button></div>
            <input ref={input} type="file" accept={[...IMAGE_UPLOAD_TYPES].join(',')} hidden disabled={readOnly||uploading} aria-label={copy('upload')} onChange={(event)=>{const file=event.target.files?.[0];event.target.value='';if(file)void upload(file)}}/>
            {uploadError&&<Callout tone="warning" role="alert">{copy(uploadError)}</Callout>}
            {gallery.error&&<Callout tone="warning" role="alert">{copy('loadFailed')}</Callout>}
            <CardGrid items={gallery.items} getItemKey={(item)=>item.id} loading={gallery.loading} hasMore={gallery.hasMore} loadingMore={gallery.loadingMore} onLoadMore={gallery.loadMore}
                emptyStateTitle={copy('empty')} emptyStateDescription={copy('emptyHelp')}
                renderCard={(item,index)=><ImageChoice key={item.id+':'+reload} item={item} selected={selected===item.id} disabled={readOnly||uploading} label={copy('imageLabel',{number:index+1})} onChoose={()=>setSelected(item.id)}/>}/>
        </div>
    </Drawer>
}
