import { useTranslation } from 'react-i18next'
import { Keyboard } from 'lucide-react'
import { Button,Callout,Drawer,Field,Icon,Select,SwitchRow } from '@/ui/primitives'
import { DEFAULT_TYPING,PLAIN_TYPING,type TypingPreferences } from '../utils/typingPreferences'
import { DEFAULT_COMPLETIONS,type CompletionLength,type CompletionPreferences } from '../utils/completions'
interface Props {open:boolean;onClose:()=>void;value:TypingPreferences;onChange:(value:TypingPreferences)=>void;storageUnavailable:boolean;showInvisibles?:boolean;onShowInvisibles?:(visible:boolean)=>void;invisiblesUnavailable?:boolean
    completions?:CompletionPreferences;onCompletions?:(value:CompletionPreferences)=>void;completionsUnavailable?:boolean}
export function NovelTypingPreferences({open,onClose,value,onChange,storageUnavailable,showInvisibles=false,onShowInvisibles,invisiblesUnavailable=false,completions=DEFAULT_COMPLETIONS,onCompletions,completionsUnavailable=false}:Props){
    const {t}=useTranslation(),copy=(key:string)=>t('novelEditor.typing.'+key)
    if(!open)return null
    return <Drawer open={open} onClose={onClose} title={copy('title')} icon={<Icon icon={Keyboard}/>} size="lg" footer={<>
        <Button variant="ghost" onClick={()=>{onChange(DEFAULT_TYPING);onShowInvisibles?.(false);onCompletions?.(DEFAULT_COMPLETIONS)}}>{copy('reset')}</Button><Button onClick={onClose}>{copy('done')}</Button>
    </>}><div className="space-y-4">
        <p className="text-body text-parchment-200">{copy('help')}</p>
        {storageUnavailable&&<Callout role="status" tone="warning">{copy('unavailable')}</Callout>}
        <Field label={copy('quotes')}><Select value={value.quotes} onChange={(quotes)=>onChange({...value,quotes:quotes as TypingPreferences['quotes']})} options={(['manuscript','curly','angle','straight'] as const).map((name)=>({value:name,label:copy('styles.'+name)}))}/></Field>
        <p className="text-caption text-parchment-300">{copy('languageHelp')}</p>
        <SwitchRow label={copy('punctuation')} description={copy('punctuationHelp')} checked={value.punctuation} onChange={(punctuation)=>onChange({...value,punctuation})}/>
        <SwitchRow label={copy('symbols')} description={copy('symbolsHelp')} checked={value.symbols} onChange={(symbols)=>onChange({...value,symbols})}/>
        <Button variant="secondary" onClick={()=>onChange(PLAIN_TYPING)}>{copy('plain')}</Button>
        {onShowInvisibles&&<h3 className="font-ui text-label text-parchment-100">{t('novelEditor.writingMarks.display')}</h3>}
        {onShowInvisibles&&<SwitchRow label={t('novelEditor.writingMarks.invisibles')} description={t('novelEditor.writingMarks.invisiblesHelp')} checked={showInvisibles} onChange={onShowInvisibles}/>}
        {invisiblesUnavailable&&<Callout role="status" tone="warning">{t('novelEditor.writingMarks.invisiblesUnavailable')}</Callout>}
        {onCompletions&&<h3 className="font-ui text-label text-parchment-100">{copy('completions.heading')}</h3>}
        {onCompletions&&<SwitchRow label={copy('completions.label')} description={copy('completions.help')} checked={completions.enabled} onChange={(enabled)=>onCompletions({...completions,enabled})}/>}
        {onCompletions&&completions.enabled&&<Field label={copy('completions.length')}><Select value={completions.length} onChange={(length)=>onCompletions({...completions,length:length as CompletionLength})}
            options={(['sentence','paragraph'] as const).map((length)=>({value:length,label:copy('completions.lengths.'+length)}))}/></Field>}
        {onCompletions&&completionsUnavailable&&<Callout role="status" tone="warning">{copy('unavailable')}</Callout>}
    </div></Drawer>
}
