import { useTranslation } from 'react-i18next'
import type { NovelRefinementSource } from '@/shared/types/storyAssistant.types'
import { documentMarkdown } from '@/shared/storyDocument'
import { Button,Card } from '@/ui/primitives'

export function NovelRefinementSummary({value,onClear,disabled=false}:{value:NovelRefinementSource;onClear?:()=>void;disabled?:boolean}) {
    const {t}=useTranslation(),text=(key:string,values?:Record<string,unknown>)=>t('novelEditor.assistant.'+key,values)
    const variant='variant'in value?value.variant:null
    return <Card className="space-y-3 p-3" aria-label={text('refineParent')}>
        <p className="break-words text-label">{text(variant?'refineVersionTitle':'refineParentRevision',variant?{title:variant.title}:{revision:value.parent.baseRevision})}</p>
        <p className="text-body text-parchment-200">{text('refineHelp')}</p>
        {variant&&<>
            <p className="text-caption text-parchment-300">{text('refineVersionHelp',{revision:value.parent.baseRevision})}</p>
            <details className="space-y-2"><summary className="cursor-pointer text-label">{text('refineVersionText')}</summary>
                <p className="whitespace-pre-wrap break-words font-narrative text-body">{documentMarkdown(variant.operation.document)}</p>
            </details>
        </>}
        <details className="space-y-2"><summary className="cursor-pointer text-label">{text('refineParentText')}</summary>
            <blockquote className="whitespace-pre-wrap break-words font-narrative text-body text-arcane-300">{value.parent.output}</blockquote>
            {value.parent.instruction&&<p className="whitespace-pre-wrap break-words text-caption text-parchment-300">{value.parent.instruction}</p>}
        </details>
        {onClear&&<Button variant="secondary" size="sm" disabled={disabled} onClick={onClear}>{text('clearRefinement')}</Button>}
    </Card>
}
