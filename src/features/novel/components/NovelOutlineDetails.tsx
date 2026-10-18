import { useTranslation } from 'react-i18next'
import type { StoryUnitMetadata,StoryScene,StoryCardRef } from '@/shared'
import { Badge } from '@/ui/primitives'
import { outlineCard,outlineExcerpt } from '../utils/novelOutline'

interface Props {unit:StoryUnitMetadata;words:number|null;archived:boolean;references:StoryCardRef[];chapterId?:string;sceneId?:string}
export function NovelOutlineDetails({unit,words,archived,references,chapterId,sceneId}:Props){
    const {t}=useTranslation(),copy=(key:string,values?:Record<string,unknown>)=>t('novelEditor.outline.'+key,values)
    const status=archived?'archived':unit.inheritance?.values.status??unit.status??'draft'
    const pov=unit.inheritance?.values.povCardId??unit.povCardId,location=unit.inheritance?.values.locationCardId??unit.locationCardId
    const card=(id:string,kind:'character'|'world')=>{
        const result=outlineCard(references,id,kind,chapterId,sceneId)
        return result?result.label+(result.removed?' · '+copy('removed'):''):copy(kind==='character'?'unknownCharacter':'unknownLocation')
    }
    const summary=unit.details.summary,revision='revision' in unit?(unit as StoryScene).revision:null
    const summaryState=revision!==null&&unit.details.summaryRevision===revision?'current':unit.details.summaryRevision==null||revision===null?'unverified':'stale'
    const included=(key:'includeInAI'|'includeInExport')=>unit.inheritance?.values[key]??unit.details[key]??true
    return <div className="space-y-2 px-2 pb-2 text-label text-parchment-200">
        <div className="flex flex-wrap items-center gap-2"><Badge>{t('novelEditor.structure.statuses.'+status)}</Badge><span>{words===null?t('novelEditor.loading.wordsUnavailable'):unit.wordGoal===null?copy('words',{count:words}):copy('goal',{words:words.toLocaleString(),goal:unit.wordGoal.toLocaleString()})}</span></div>
        {(pov||location)&&<dl className="space-y-1">{pov&&<div><dt className="inline text-parchment-400">{copy('pov')}: </dt><dd className="inline break-words">{card(pov,'character')}</dd></div>}{location&&<div><dt className="inline text-parchment-400">{copy('location')}: </dt><dd className="inline break-words">{card(location,'world')}</dd></div>}</dl>}
        {Boolean(unit.details.castIds?.length)&&<p className="break-words"><span className="text-parchment-400">{copy('cast')}: </span>{[...new Set(unit.details.castIds)].map((id)=>card(id,'character')).join(', ')}</p>}
        {unit.details.synopsis?.trim()&&<div><p className="font-ui text-caption text-parchment-400">{copy('synopsis')}</p><p className="whitespace-pre-wrap break-words text-body">{outlineExcerpt(unit.details.synopsis)}</p></div>}
        {summary?.trim()&&<div className="space-y-1"><div className="flex flex-wrap items-center gap-2"><span className="text-caption text-parchment-400">{copy('summary')}</span><Badge>{copy('summaryStates.'+summaryState)}</Badge></div><p className="whitespace-pre-wrap break-words text-body">{outlineExcerpt(summary)}</p></div>}
        {(!included('includeInAI')||!included('includeInExport')||unit.details.exportRole)&&<div className="flex flex-wrap gap-2">{!included('includeInAI')&&<Badge>{copy('excludedAI')}</Badge>}{!included('includeInExport')&&<Badge>{copy('excludedExport')}</Badge>}
            {unit.details.exportRole&&<Badge>{t('novelEditor.export.roles.'+unit.details.exportRole)}</Badge>}</div>}
    </div>
}
