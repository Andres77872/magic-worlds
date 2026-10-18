import { useLayoutEffect,useRef } from 'react'
import { useTranslation } from 'react-i18next'
import type { StoryCardRef,StoryStyleConventionKind,StoryStyleSheet } from '@/shared'
import { STYLE_CONVENTION_KINDS,STYLE_LIMITS,STYLE_TEXT } from '@/shared/storyStyleSheet'
import { Button,Field,Input,Select,Textarea } from '@/ui/primitives'
import { snapshotLabel } from '../utils/codexUtils'
import { characterName,readStyleSheet } from '../utils/styleSheetText'

interface Props { value:unknown;refs:StoryCardRef[];disabled?:boolean;onChange:(sheet:StoryStyleSheet|null)=>void }
/** Close to Python's casefold, which the BFF uses to refuse a repeated convention. */
const fold=(term:string)=>term.trim().toLocaleLowerCase('und').replace(/ß/g,'ss')

/** The novel's style sheet: conventions, preferred examples and character voices. Each change goes to the details draft; an empty sheet clears the field. */
export function NovelStyleSheet({value,refs,disabled=false,onChange}:Props){
    const {t}=useTranslation(),copy=(key:string,options?:Record<string,unknown>)=>t('novelEditor.styleSheet.'+key,options)
    const container=useRef<HTMLFieldSetElement>(null),focus=useRef<string|null>(null)
    const sheet=readStyleSheet(value),byId=new Map(refs.map((ref)=>[ref.id,ref]))
    const characters=refs.filter((ref)=>ref.kind==='character'&&!ref.removedAt&&!sheet.voices.some((voice)=>voice.refId===ref.id))
    useLayoutEffect(()=>{
        const target=focus.current;focus.current=null
        if(target&&!disabled)container.current?.querySelector<HTMLElement>('[data-style-focus="'+target+'"]')?.focus()
    })
    function change(next:Partial<StoryStyleSheet>,target?:string){
        if(disabled)return
        focus.current=target??null
        const sheetNext={...sheet,...next}
        onChange(sheetNext.conventions.length||sheetNext.examples.length||sheetNext.voices.length?sheetNext:null)
    }
    const conventions=(index:number,patch:Partial<StoryStyleSheet['conventions'][number]>)=>change({conventions:sheet.conventions.map((entry,n)=>n===index?{...entry,...patch}:entry)})
    const examples=(index:number,patch:Partial<StoryStyleSheet['examples'][number]>)=>change({examples:sheet.examples.map((entry,n)=>n===index?{...entry,...patch}:entry)})
    const voices=(index:number,patch:Partial<StoryStyleSheet['voices'][number]>,target?:string)=>change({voices:sheet.voices.map((entry,n)=>n===index?{...entry,...patch}:entry)},target)
    const heading=(key:string,count:number,max:number)=><div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="font-ui text-label text-parchment-100">{copy(key)}</h4><span className="text-caption text-parchment-400">{copy('count',{count,max})}</span></div>

    return <fieldset ref={container} disabled={disabled} className="space-y-5 rounded-lg border border-line p-3">
        <legend className="px-1 text-label font-semibold">{copy('title')}</legend>
        <p className="text-caption text-parchment-300">{copy('help')}</p>
        <section aria-label={copy('conventions')} className="space-y-3">
            {heading('conventions',sheet.conventions.length,STYLE_LIMITS.conventions)}
            <p className="text-caption text-parchment-300">{copy('conventionsHelp')}</p>
            {sheet.conventions.map((entry,index)=>{
                const repeated=sheet.conventions.findIndex((other)=>other.kind===entry.kind&&fold(other.term)===fold(entry.term))<index
                return <div key={index} className="grid gap-2 rounded-md border border-parchment-50/10 p-2 sm:grid-cols-[minmax(0,1fr)_11rem]">
                    <Field label={copy('term',{number:index+1})} error={!entry.term.trim()?copy('termRequired'):repeated?copy('repeated'):undefined}>
                        <Input data-style-focus={'convention-'+index} value={entry.term} maxLength={STYLE_TEXT.term} disabled={disabled}
                            onChange={(event)=>conventions(index,{term:event.target.value})} onBlur={()=>{if(entry.term!==entry.term.trim())conventions(index,{term:entry.term.trim()})}}/></Field>
                    <Field label={copy('kind')}><Select value={entry.kind} disabled={disabled} onChange={(kind)=>conventions(index,{kind:kind as StoryStyleConventionKind})}
                        options={STYLE_CONVENTION_KINDS.map((kind)=>({value:kind,label:copy('kinds.'+kind)}))}/></Field>
                    <Field className="sm:col-span-2" label={copy('rule')} helper={copy('ruleHelp')}><Input value={entry.rule} maxLength={STYLE_TEXT.rule} disabled={disabled}
                        onChange={(event)=>conventions(index,{rule:event.target.value})}/></Field>
                    <div className="sm:col-span-2"><Button size="sm" variant="ghost" disabled={disabled} aria-label={copy('removeConvention',{number:index+1})}
                        onClick={()=>change({conventions:sheet.conventions.filter((_,n)=>n!==index)})}>{copy('remove')}</Button></div>
                </div>
            })}
            <Button size="sm" variant="secondary" disabled={disabled||sheet.conventions.length>=STYLE_LIMITS.conventions}
                onClick={()=>change({conventions:[...sheet.conventions,{term:'',rule:'',kind:'spelling'}]},'convention-'+sheet.conventions.length)}>{copy('addConvention')}</Button>
        </section>
        <section aria-label={copy('examples')} className="space-y-3">
            {heading('examples',sheet.examples.length,STYLE_LIMITS.examples)}
            <p className="text-caption text-parchment-300">{copy('examplesHelp')}</p>
            {sheet.examples.map((entry,index)=><div key={index} className="space-y-2 rounded-md border border-parchment-50/10 p-2">
                <Field label={copy('exampleLabel',{number:index+1})} helper={copy('exampleLabelHelp')}><Input data-style-focus={'example-'+index} value={entry.label} maxLength={STYLE_TEXT.label}
                    disabled={disabled} onChange={(event)=>examples(index,{label:event.target.value})}/></Field>
                <Field label={copy('exampleText',{number:index+1})} error={!entry.text.trim()?copy('exampleRequired'):undefined}><Textarea rows={4} value={entry.text} maxLength={STYLE_TEXT.example}
                    disabled={disabled} onChange={(event)=>examples(index,{text:event.target.value})}/></Field>
                <Button size="sm" variant="ghost" disabled={disabled} aria-label={copy('removeExample',{number:index+1})}
                    onClick={()=>change({examples:sheet.examples.filter((_,n)=>n!==index)})}>{copy('remove')}</Button>
            </div>)}
            <Button size="sm" variant="secondary" disabled={disabled||sheet.examples.length>=STYLE_LIMITS.examples}
                onClick={()=>change({examples:[...sheet.examples,{label:'',text:''}]},'example-'+sheet.examples.length)}>{copy('addExample')}</Button>
        </section>
        <section aria-label={copy('voices')} className="space-y-3">
            {heading('voices',sheet.voices.length,STYLE_LIMITS.voices)}
            <p className="text-caption text-parchment-300">{copy('voicesHelp')}</p>
            {sheet.voices.map((voice,index)=>{
                const ref=byId.get(voice.refId),name=characterName(ref,copy('unknownCharacter'))
                const unused=!ref||ref.removedAt||ref.kind!=='character'?'voiceRemoved':!ref.enabled?'voiceOff':null
                return <div key={voice.refId} className="space-y-2 rounded-md border border-parchment-50/10 p-2">
                    <h5 className="font-ui text-label text-parchment-100">{name}</h5>
                    {unused&&<p className="text-caption text-ember-300">{copy(unused)}</p>}
                    <Field label={copy('traits',{name})} helper={copy('traitsHelp')} error={!voice.traits.trim()&&!voice.lines.length?copy('voiceEmpty'):undefined}>
                        <Textarea data-style-focus={'voice-'+voice.refId} rows={3} value={voice.traits} maxLength={STYLE_TEXT.traits} disabled={disabled}
                            onChange={(event)=>voices(index,{traits:event.target.value})}/></Field>
                    {voice.lines.map((line,lineIndex)=><div key={lineIndex} className="flex items-end gap-2">
                        <Field className="min-w-0 flex-1" label={copy('line',{number:lineIndex+1})} error={!line.trim()?copy('lineRequired'):undefined}>
                            <Input data-style-focus={'line-'+voice.refId+'-'+lineIndex} value={line} maxLength={STYLE_TEXT.line} disabled={disabled}
                                onChange={(event)=>voices(index,{lines:voice.lines.map((value,n)=>n===lineIndex?event.target.value:value)})}/></Field>
                        <Button size="sm" variant="ghost" disabled={disabled} aria-label={copy('removeLine',{number:lineIndex+1,name})}
                            onClick={()=>voices(index,{lines:voice.lines.filter((_,n)=>n!==lineIndex)})}>{copy('remove')}</Button>
                    </div>)}
                    <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="secondary" disabled={disabled||voice.lines.length>=STYLE_LIMITS.lines}
                            onClick={()=>voices(index,{lines:[...voice.lines,'']},'line-'+voice.refId+'-'+voice.lines.length)}>{copy('addLine')}</Button>
                        <Button size="sm" variant="ghost" disabled={disabled} aria-label={copy('removeVoice',{name})}
                            onClick={()=>change({voices:sheet.voices.filter((_,n)=>n!==index)})}>{copy('removeVoiceShort')}</Button>
                    </div>
                </div>
            })}
            {characters.length?<Field label={copy('addVoice')}><Select value="" placeholder={copy('chooseCharacter')} disabled={disabled||sheet.voices.length>=STYLE_LIMITS.voices}
                onChange={(refId)=>change({voices:[...sheet.voices,{refId,traits:'',lines:[]}]},'voice-'+refId)}
                options={characters.map((ref)=>({value:ref.id,label:snapshotLabel(ref)+(ref.sceneId||ref.chapterId?' · '+copy('scoped'):'')+(ref.enabled?'':' · '+copy('off'))}))}/></Field>
                :<p className="text-caption text-parchment-400">{copy(refs.some((ref)=>ref.kind==='character'&&!ref.removedAt)?'allVoiced':'noCharacters')}</p>}
        </section>
    </fieldset>
}
