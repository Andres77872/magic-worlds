import { useMemo,useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/app/hooks'
import type { StoryOutline,StoryUnitMetadata } from '@/shared'
import { Button,Callout,Chip,Field,Input,Select,Textarea,Modal } from '@/ui/primitives'
import { novelMutationKey } from '@/shared/novelMutationJournal'
import { useMetadataDraft } from '../hooks/useMetadataDraft'
import { snapshotLabel } from '../utils/codexUtils'
import { downloadBlob,safeFilename } from '@/utils/download'
import { isStoryNovelDetails } from '@/shared/storyNovelDetails'
import { isCalendarDate } from '@/shared/calendarDate'
import type { StoryWorkspace } from '../hooks/useStoryWorkspace'
import type { OwnedImagePickerApi } from '@/features/gallery/media/components/OwnedImagePickerDrawer'
import { NovelCoverField,NovelCoverPreview } from './NovelCoverField'
import { isStoryUnitDetails,STORY_BACK_MATTER,STORY_FRONT_MATTER } from '@/shared/storyUnitDetails'
import { MetadataLineList } from './MetadataLineList'
import { NovelPlannedBeats } from './NovelPlannedBeats'
import { NovelStyleSheet } from './NovelStyleSheet'
import { describeStyleSheet } from '../utils/styleSheetText'
import { partBases,sameBasis,summaryBases } from '@/shared/storySummaryBasis'

interface Props {
    story:StoryOutline
    unit:StoryOutline|StoryUnitMetadata
    kind:'novel'|'part'|'chapter'|'scene'
    readOnly:boolean
    beforeWrite:()=>Promise<boolean>
    workspace?:StoryWorkspace
}
const inheritedFields=['narrator','tense'] as const
const unitTextFields=['synopsis','summary','narrativeTime','notes'] as const
const novelTextFields=['language','genre','audience','synopsis','summary','styleGuide','notes'] as const
/** A scoped component identity keeps forms separate across account/workspace switches. */
export function NovelUnitDetails(props:Props){
    const {userHash}=useAuth()
    const key=novelMutationKey('details',{userHash,workspaceId:props.story.organization?.workspace_id,storyId:props.story.id},props.kind+':'+props.unit.id)
    return <MetadataForm key={key??props.kind+props.unit.id} {...props}/>
}
function MetadataForm({story,unit,kind,readOnly,beforeWrite,workspace}:Props) {
    const {t}=useTranslation()
    const copy=(key:string,options?:Record<string,unknown>)=>t(key==='coverAlt'?'novelEditor.covers.altLabel':key==='plannedBeats'?'novelEditor.planning.plannedBeats':'novelEditor.structure.'+key,options)
    const mediaApi=useMemo<OwnedImagePickerApi|undefined>(()=>{
        if(!workspace)return undefined
        const client=()=>{const api=workspace.isCurrent()?workspace.detachedApi():null;if(!api)throw new Error('Novel media scope changed');return api}
        return {listWorkspaceMedia:async(...args)=>{const result=await client().listWorkspaceMedia(...args);if(!workspace.isCurrent())throw new Error('Novel media scope changed');return result},
            uploadCardImage:async(...args)=>{const result=await client().uploadCardImage(...args);if(!workspace.isCurrent())throw new Error('Novel media scope changed');return result}}
    },[workspace])
    const draft=useMetadataDraft({story,unit,kind,readOnly,beforeWrite})
    const {form,edit,setDetail}=draft
    const {title,status,goal,details,pov,location}=form
    const detailsValid=kind==='novel'?isStoryNovelDetails(details):isStoryUnitDetails(details)
    const titleValid=Boolean(title.trim())&&Array.from(title.trim()).length<=255
    const descriptionValid=!draft.descriptionDirty||new TextEncoder().encode(form.description).length<=60_000
    const goalValid=goal.trim()===''||Number.isInteger(Number(goal))&&Number(goal)>0&&Number(goal)<=2_147_483_647
    const metadataValid=detailsValid&&titleValid&&descriptionValid&&goalValid
    const progress=(key:string)=>t('novelEditor.writingProgress.fields.'+key)
    const deadlineValid=details.deadline==null||isCalendarDate(details.deadline)&&details.deadline>='2000-01-01'
    const dailyValid=details.dailyWordGoal==null||Number.isSafeInteger(details.dailyWordGoal)&&Number(details.dailyWordGoal)>=1&&Number(details.dailyWordGoal)<=1_000_000
    const [comparing,setComparing]=useState(false)
    // A chapter or book summary is current only while written for today's covered scenes; a hand edit is written for them on save.
    const wideSummaryHint=(kind==='chapter'||kind==='part'||kind==='novel')&&details.summary&&!draft.summaryEdited?(()=>{
        const bases=summaryBases(story),today=kind==='novel'?bases.book:kind==='part'?partBases(story).get(unit.id)??[]:bases.chapters.get(unit.id)??[],saved=details.summaryBasis
        return saved==null?copy('summaryBasisUnpinned'):!sameBasis(saved,today)?copy('summaryBasisStale'):undefined
    })():undefined
    const [copyFailed,setCopyFailed]=useState(false)
    async function copyRecovery(){
        try{await navigator.clipboard.writeText(JSON.stringify(draft.recovery?.write.form,null,2));setCopyFailed(false)}
        catch{setCopyFailed(true)}
    }
    const inherited='inheritance' in unit?unit.inheritance:undefined
    const applicable=story.activeCardRefs.filter((ref)=>!ref.removedAt&&(ref.sceneId===null||ref.sceneId===unit.id)&&(ref.chapterId===null||ref.chapterId===unit.id||('chapterId' in unit&&ref.chapterId===unit.chapterId)))
    const cardOptions=(type:'povCardId'|'locationCardId')=>[
        {value:'',label:kind==='novel'?t('novelEditor.covers.noDefaultPov'):copy('inherit')},
        ...applicable.filter((ref)=>type==='povCardId'?ref.kind==='character':ref.kind==='world').filter((ref,index,all)=>all.findIndex((candidate)=>candidate.cardId===ref.cardId)===index).map((ref)=>({value:ref.cardId,label:snapshotLabel(ref)})),
    ]
    const inheritanceHint=(key:string)=>{
        const origin=inherited?.origins[key]
        const value=inherited?.values[key as keyof typeof inherited.values]
        return origin&&origin!==kind&&value!=null ? copy('inherited',{scope:copy('scopes.'+origin),value:key==='status'?copy('statuses.'+value):typeof value==='boolean'?copy(value?'yes':'no'):(key==='povCardId'||key==='locationCardId')?snapshotLabel(story.activeCardRefs.find((ref)=>ref.cardId===value)??{snapshot:{name:copy('unknownCard')}} as Parameters<typeof snapshotLabel>[0]):String(value)}) : undefined
    }
    const disabled=readOnly||draft.busy||Boolean(draft.recovery)||draft.pending
    const account=draft.conflict?.form
    const cardName=(value:unknown)=>typeof value==='string'&&value?snapshotLabel(story.activeCardRefs.find((ref)=>ref.cardId===value)??{snapshot:{name:copy('unknownCard')}} as Parameters<typeof snapshotLabel>[0]):copy('inherit')
    const styleText=(value:unknown)=>describeStyleSheet(value,story.activeCardRefs,(key,options)=>t('novelEditor.styleSheet.'+key,options))
    const roleLabel=(value:unknown)=>value?t('novelEditor.export.roles.'+String(value)):copy('mainText')
    const detailValue=(key:string,value:unknown)=>key==='exportRole'?roleLabel(value):Array.isArray(value)?(['tags','plannedBeats'].includes(key)?JSON.stringify(value,null,2):(key==='castIds'?value.map(cardName):value).join('\n')):key==='includeInAI'||key==='includeInExport'?copy(value===true?'yes':value===false?'no':'inherit'):String(value??'')
    const rows: [string,string,string|undefined][]=[
        ['titleLabel',title,account?.title],['status',status,account?.status],['goal',goal,account?.goal],
        ...(kind==='novel'?[['description',form.description,account?.description]]:[]),
        ...[...inheritedFields,...(kind==='novel'?novelTextFields:unitTextFields)].map((key)=>[key,String(details[key]??''),String(account?.details[key]??'')]),
        ...(kind==='novel'?[['progress:deadline',String(details.deadline??''),String(account?.details.deadline??'')],['progress:daily',String(details.dailyWordGoal??''),String(account?.details.dailyWordGoal??'')],['tags',detailValue('tags',details.tags),detailValue('tags',account?.details.tags)],['pov',cardName(details.povCardId),cardName(account?.details.povCardId)],['coverAlt',String(details.coverAlt??''),String(account?.details.coverAlt??'')],['styleSheet',styleText(details.styleSheet),styleText(account?.details.styleSheet)]]:[
            ['pov',cardName(pov),cardName(account?.pov)],['location',cardName(location),cardName(account?.location)],
            ...(kind==='scene'?[['storyTimeOrder',String(details.storyTimeOrder??''),String(account?.details.storyTimeOrder??'')] as [string,string,string]]:[]),
            ...[['tags','tags'],['plannedBeats','plannedBeats'],['castIds','cast'],['plotThreads','threads'],['includeInAI','includeInAI'],['includeInExport','includeInExport'],...(kind==='chapter'?[['exportRole','exportRole']]:[])].map(([key,label])=>[label,detailValue(key,details[key]),detailValue(key,account?.details[key])]),
        ]),
    ] as [string,string,string|undefined][]
    return <div className="space-y-4">
        {readOnly&&<Callout tone="warning">{copy('readOnly')}</Callout>}
        {draft.recovery&&<Callout tone="warning" role="status">
            <p>{copy('detailsRecovery')}</p><div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" onClick={draft.resume}>{t('novelEditor.recovery.resume')}</Button>
                <Button size="sm" variant="secondary" onClick={()=>void copyRecovery()}>{t('novelEditor.recovery.copy')}</Button>
                <Button size="sm" variant="secondary" onClick={()=>downloadBlob(new Blob([JSON.stringify(draft.recovery?.write.form,null,2)],{type:'application/json'}),safeFilename(unit.title,'novel')+'-details.json')}>{copy('downloadDraft')}</Button>
                <Button size="sm" variant="ghost" disabled={Boolean(draft.recovery.write.pending)||draft.busy} onClick={()=>void draft.accountVersion(false)}>{copy('useAccountDetails')}</Button>
            </div>
        </Callout>}
        {draft.failure&&<Callout tone="warning" role="alert">{['coverUnavailable','povUnavailable'].includes(draft.failure)?t('novelEditor.covers.'+draft.failure):copy(draft.failure)}</Callout>}
        {!detailsValid&&<Callout tone="warning" role="alert">{t(kind==='novel'?'novelEditor.covers.invalidDetails':'novelEditor.planning.invalidDetails')}</Callout>}
        {copyFailed&&<Callout tone="warning" role="alert">{copy('copyFailed')}</Callout>}
        {draft.storageFailed&&<Callout tone="warning" role="alert">{t('novelEditor.recovery.storageFailed')}</Callout>}
        {draft.remoteChanged&&!draft.pending&&draft.dirty&&<Callout tone="warning">{copy('detailsChanged')}</Callout>}
        {draft.conflict&&<Button variant="secondary" size="sm" onClick={()=>setComparing(true)}>{t('novelEditor.recovery.compare')}</Button>}
        {draft.pending&&<Callout tone="warning" role="status">{copy('detailsPending')}</Callout>}
        {draft.saved&&<p role="status" className="text-caption text-parchment-300">{copy('saved')}</p>}
        <Field label={copy('titleLabel')} error={!titleValid?t('novelEditor.covers.invalidTitle'):undefined}><Input value={title} disabled={disabled} onChange={(event)=>edit('title',event.target.value)}/></Field>
        <div className="grid gap-4 sm:grid-cols-2">
            <Field label={copy('status')} helper={inheritanceHint('status')}><Select value={status} disabled={disabled} onChange={(value)=>edit('status',value)} options={[
                ...(kind==='novel'?[]:[{value:'',label:copy('inherit')}]),...['draft','revising','complete','archived'].map((value)=>({value,label:copy('statuses.'+value),disabled:value==='archived'})),
            ]}/></Field>
            <Field label={copy('goal')} helper={copy('goalHint')} error={kind==='novel'&&!goalValid?t('novelEditor.covers.invalidGoal'):undefined}><Input type="number" min={1} max={2_147_483_647} value={goal} disabled={disabled} onChange={(event)=>edit('goal',event.target.value)}/></Field>
        </div>
        {kind==='novel'&&<div className="grid gap-4 sm:grid-cols-2">
            <Field label={progress('deadline')} helper={progress('deadlineHint')} error={deadlineValid?undefined:progress('invalidDeadline')}><Input type="date" min="2000-01-01" value={String(details.deadline??'')} disabled={disabled} onChange={(event)=>setDetail('deadline',event.target.value||null)}/></Field>
            <Field label={progress('daily')} helper={progress('dailyHint')} error={dailyValid?undefined:progress('invalidDaily')}><Input type="number" min={1} max={1_000_000} step={1} value={details.dailyWordGoal==null?'':String(details.dailyWordGoal)} disabled={disabled}
                onChange={(event)=>{const raw=event.target.value.trim();const value=Number(raw);setDetail('dailyWordGoal',raw===''?null:Number.isSafeInteger(value)?value:raw)}}/></Field>
        </div>}
        {kind==='novel'&&<Field label={copy('description')} error={!descriptionValid?t('novelEditor.covers.invalidDescription'):undefined}><Textarea rows={3} value={form.description} disabled={disabled} onChange={(event)=>edit('description',event.target.value)}/></Field>}
        {kind==='novel'&&<>
            <Field label={t('novelEditor.covers.defaultPov')} helper={t('novelEditor.covers.povHelp')}><Select disabled={disabled} value={String(details.povCardId??'')} onChange={(id)=>setDetail('povCardId',id||null)} options={[
                ...cardOptions('povCardId'),...(details.povCardId&&!applicable.some((ref)=>ref.kind==='character'&&ref.cardId===details.povCardId)?[{value:String(details.povCardId),label:cardName(details.povCardId)+' · '+t('novelEditor.covers.unavailableCharacter')}]:[]),
            ]}/></Field>
            <NovelCoverField assetId={details.coverAssetId} alt={details.coverAlt} title={title} disabled={disabled} workspaceId={story.organization?.workspace_id??workspace?.workspaceId??null} sessionKey={draft.scopeKey} api={mediaApi} onAsset={(id)=>setDetail('coverAssetId',id)} onAlt={(value)=>setDetail('coverAlt',value)}/>
        </>}
        {inheritedFields.map((key)=><Field key={key} label={copy(key)} helper={inheritanceHint(key)}><Input value={String(details[key]??'')} placeholder={kind==='novel'?undefined:copy('inherit')} maxLength={kind==='novel'?undefined:20000} disabled={disabled} onChange={(event)=>setDetail(key,event.target.value||null)}/></Field>)}
        {(kind==='novel'?novelTextFields:unitTextFields).map((key)=><Field key={key} label={copy(key)} helper={key==='summary'&&kind==='scene'&&details.summary&&'revision' in unit?(draft.summaryRevision==null?copy('summaryUnpinned'):draft.summaryRevision!==unit.revision?copy('summaryStale',{revision:draft.summaryRevision,current:unit.revision}):undefined):key==='summary'?wideSummaryHint:undefined}><Textarea rows={3} value={String(details[key]??'')} maxLength={kind==='novel'?undefined:20000} disabled={disabled} onChange={(event)=>setDetail(key,event.target.value||null)}/></Field>)}
        {kind==='scene'&&<Field label={copy('storyTimeOrder')} helper={copy('storyTimeOrderHelp')}><Input type="number" inputMode="decimal" step="any" value={details.storyTimeOrder==null?'':String(details.storyTimeOrder)} disabled={disabled}
            onChange={(event)=>{const raw=event.target.value.trim();const value=Number(raw);setDetail('storyTimeOrder',raw===''?null:Number.isFinite(value)?value:raw)}}/></Field>}
        {kind==='novel'&&<NovelStyleSheet value={details.styleSheet} refs={story.activeCardRefs} disabled={disabled} onChange={(value)=>setDetail('styleSheet',value)}/>}
        <Field label={copy('tags')} helper={t('novelEditor.planning.tagsHelp')}><MetadataLineList value={details.tags} disabled={disabled} onChange={(value)=>setDetail('tags',value)}/></Field>
        {kind!=='novel'&&<>
            <NovelPlannedBeats value={details.plannedBeats} disabled={disabled} onChange={(value)=>setDetail('plannedBeats',value)}/>
            <div className="grid gap-4 sm:grid-cols-2"><Field label={copy('pov')} helper={inheritanceHint('povCardId')}><Select value={pov} onChange={(value)=>edit('pov',value)} disabled={disabled} options={cardOptions('povCardId')}/></Field>
                <Field label={copy('location')} helper={inheritanceHint('locationCardId')}><Select value={location} onChange={(value)=>edit('location',value)} disabled={disabled} options={cardOptions('locationCardId')}/></Field></div>
            <Field label={copy('cast')}><Select value="" disabled={disabled} placeholder={copy('addCast')} onChange={(id)=>setDetail('castIds',[...(Array.isArray(details.castIds)?details.castIds:[]),id])}
                options={applicable.filter((ref)=>ref.kind==='character').filter((ref,index,all)=>all.findIndex((candidate)=>candidate.cardId===ref.cardId)===index).map((ref)=>({value:ref.cardId,label:snapshotLabel(ref),disabled:Array.isArray(details.castIds)&&details.castIds.includes(ref.cardId)}))}/></Field>
            <div className="flex flex-wrap gap-2">{Array.isArray(details.castIds)&&details.castIds.map((id)=>{
                const ref=story.activeCardRefs.find((ref)=>ref.cardId===id)
                const label=ref?snapshotLabel(ref):copy('unknownCard')
                return <Chip key={id} disabled={disabled} aria-label={copy('removeCast',{title:label})} onClick={()=>setDetail('castIds',(details.castIds as string[]).filter((value)=>value!==id))}>{label} ×</Chip>
            })}</div>
            <Field label={copy('threads')}><MetadataLineList value={details.plotThreads} disabled={disabled} onChange={(value)=>setDetail('plotThreads',value)}/></Field>
            {(['includeInAI','includeInExport'] as const).map((key)=><Field key={key} label={copy(key)} helper={inheritanceHint(key)}><Select disabled={disabled} value={details[key]===true?'yes':details[key]===false?'no':''} onChange={(value)=>setDetail(key,value==='yes'?true:value==='no'?false:null)} options={[
                {value:'',label:copy('inherit')},{value:'yes',label:copy('yes')},{value:'no',label:copy('no')},
            ]}/></Field>)}
            {kind==='chapter'&&<Field label={copy('exportRole')} helper={copy('exportRoleHelp')}><Select disabled={disabled} value={String(details.exportRole??'')} onChange={(value)=>setDetail('exportRole',value||null)} options={[
                {value:'',label:copy('mainText')},
                ...STORY_FRONT_MATTER.map((role)=>({value:role,label:copy('frontMatter',{role:roleLabel(role)})})),
                ...STORY_BACK_MATTER.map((role)=>({value:role,label:copy('backMatter',{role:roleLabel(role)})})),
            ]}/></Field>}
        </>}
        <Button onClick={()=>void draft.save()} disabled={readOnly&&!draft.canRetry||draft.busy||Boolean(draft.recovery)||!metadataValid&&!draft.pending||!draft.dirty&&!draft.pending}>{draft.pending?t('novelEditor.save.retry'):copy('save')}</Button>
        <Modal open={comparing&&Boolean(account)} onClose={()=>setComparing(false)} title={t('novelEditor.recovery.compare')} size="lg" footer={<>
            <Button variant="secondary" disabled={draft.busy} onClick={()=>void draft.accountVersion(false).then((ok)=>{if(ok)setComparing(false)})}>{copy('useAccountDetails')}</Button>
            <Button disabled={draft.busy} onClick={()=>void draft.accountVersion(true).then((ok)=>{if(ok)setComparing(false)})}>{copy('keepDetailsChanges')}</Button>
        </>}>
            <p className="mb-4 text-body text-parchment-300">{copy('detailsMergeHelp')}</p>
            {kind==='novel'&&details.coverAssetId!==account?.details.coverAssetId&&<section className="mb-4 space-y-3"><h3 className="text-label font-semibold">{t('novelEditor.covers.label')}</h3><div className="grid gap-3 sm:grid-cols-2">
                <div><p className="text-caption text-parchment-400">{t('novelEditor.recovery.local')}</p><NovelCoverPreview assetId={details.coverAssetId} alt={details.coverAlt} title={title}/></div>
                <div><p className="text-caption text-parchment-400">{t('novelEditor.recovery.account')}</p><NovelCoverPreview assetId={account?.details.coverAssetId} alt={account?.details.coverAlt} title={account?.title??title}/></div>
            </div></section>}
            <div className="space-y-4">{rows.filter(([,local,remote])=>local!==remote).map(([label,local,remote])=><section key={label}>
                <h3 className="font-ui text-label text-parchment-100">{label.startsWith('progress:')?progress(label.slice(9)):copy(label)}</h3><div className="grid gap-3 sm:grid-cols-2">
                    <div><p className="text-caption text-parchment-400">{t('novelEditor.recovery.local')}</p><p className="whitespace-pre-wrap text-body">{local||copy('notSet')}</p></div>
                    <div><p className="text-caption text-parchment-400">{t('novelEditor.recovery.account')}</p><p className="whitespace-pre-wrap text-body">{remote||copy('notSet')}</p></div>
                </div>
            </section>)}</div>
        </Modal>
    </div>
}
