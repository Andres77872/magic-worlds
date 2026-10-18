import {useTranslation} from 'react-i18next'
import {Button,Callout} from '@/ui/primitives'
import type {GenerationApplicationRejection} from '../persistence/generationApplication'

export function NovelGenerationApplicationNotice({value,onCompare,disabled=false}:{value:GenerationApplicationRejection;onCompare?:()=>void;disabled?:boolean}) {
    const {t}=useTranslation(),text=(key:string)=>t('novelEditor.assistant.'+key)
    return <Callout tone="warning" role="alert">
        <p className="text-label">{text('applicationRejected')}</p>
        <p className="mt-2 text-body">{text('applicationReasons.'+value.reason)}</p>
        <p className="mt-2 text-body">{text('applicationRetained')}</p>
        {onCompare&&<Button variant="secondary" size="sm" className="mt-3" disabled={disabled} onClick={onCompare}>{text('applicationCompare')}</Button>}
    </Callout>
}
