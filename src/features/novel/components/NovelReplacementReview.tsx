import { useTranslation } from 'react-i18next'
import type { StoryDocumentNode } from '@/shared'
import type { StoryReplacementPreview } from '@/shared/types/storyReplacement.types'
import { Badge,Button,Callout } from '@/ui/primitives'
import { ManuscriptProse } from './ManuscriptProse'

function Passage({nodes,empty}:{nodes:StoryDocumentNode[];empty:string}){
    return nodes.length?<ManuscriptProse document={{schemaVersion:1,content:{type:'doc',content:[{type:'paragraph',attrs:{nodeId:'replacement-preview'},content:nodes}]}}} onReference={()=>{}}/>:
        <p className="text-caption text-parchment-300">{empty}</p>
}
export function NovelReplacementReview({review,busy,disabled,onApply,onClose}:{review:StoryReplacementPreview;busy:boolean;disabled:boolean;onApply:()=>void;onClose:()=>void}){
    const {t}=useTranslation(),copy=(key:string,values?:Record<string,unknown>)=>t('novelEditor.replacements.'+key,values)
    return <section className="space-y-3" aria-label={copy('reviewTitle')}>
        <h3 className="font-display text-h3 text-parchment-50">{copy('reviewTitle')}</h3>
        <p role="status" className="text-body text-parchment-200">{copy('counts',review.counts)}</p>
        <Callout>{copy('reviewHelp')}</Callout>
        {review.counts.blocked>0&&<Callout tone="warning">{copy('blockedMatches')}</Callout>}
        <ol className="space-y-4">
            {review.changes.map((change,index)=><li className="space-y-3 rounded-lg border border-line p-3" key={change.sceneId+':'+change.position}>
                <p className="text-label text-parchment-100">{copy('occurrence',{index:index+1,title:review.scenes.find((item)=>item.sceneId===change.sceneId)?.title,position:change.position})}</p>
                {change.reason!==null&&<Badge>{copy('reasons.'+change.reason)}</Badge>}
                {change.original.length||change.reason===null?<div className="space-y-3">
                    <div><p className="mb-2 text-caption text-parchment-300">{copy('original')}</p><Passage nodes={change.original} empty={copy('emptyText')}/></div>
                    <div><p className="mb-2 text-caption text-parchment-300">{copy('proposed')}</p><Passage nodes={change.proposed} empty={copy('emptyText')}/></div>
                </div>:<p className="whitespace-pre-wrap break-words font-narrative text-body text-parchment-100">{change.quote}</p>}
            </li>)}
        </ol>
        <div className="sticky bottom-0 flex flex-wrap gap-3 border-t border-line bg-ink-800 py-3">
            <Button variant="primary" disabled={busy||disabled||!review.canApply} onClick={onApply}>{copy(busy?'applying':review.operation.op==='replace'?'apply':review.operation.direction==='undo'?'applyUndo':'applyRedo')}</Button>
            <Button variant="ghost" disabled={busy} onClick={onClose}>{copy('closeReview')}</Button>
        </div>
    </section>
}
