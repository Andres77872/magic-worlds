import type { StoryCardRef,StoryStyleSheet } from '@/shared'
import { isRecord } from '@/shared/novelMutationJournal'
import { EMPTY_STYLE_SHEET } from '@/shared/storyStyleSheet'
import { snapshotLabel } from './codexUtils'

/** The sheet being edited may be briefly incomplete (an empty new row); its shape is all the editor needs. */
export const readStyleSheet=(value:unknown):StoryStyleSheet=>isRecord(value)&&Array.isArray(value.conventions)&&Array.isArray(value.examples)&&Array.isArray(value.voices)?value as unknown as StoryStyleSheet:EMPTY_STYLE_SHEET
export const characterName=(ref:StoryCardRef|undefined,fallback:string)=>ref?snapshotLabel(ref):fallback

/** Readable text of a style sheet, for comparing a device draft with the account version. */
export function describeStyleSheet(value:unknown,refs:StoryCardRef[],copy:(key:string,options?:Record<string,unknown>)=>string){
    const sheet=readStyleSheet(value),byId=new Map(refs.map((ref)=>[ref.id,ref]))
    return [...sheet.conventions.map((entry)=>entry.term+' ('+copy('kinds.'+entry.kind)+')'+(entry.rule.trim()?': '+entry.rule:'')),
        ...sheet.examples.map((entry,index)=>(entry.label.trim()||copy('example',{number:index+1}))+': '+entry.text),
        ...sheet.voices.map((voice)=>characterName(byId.get(voice.refId),copy('unknownCharacter'))+': '+[voice.traits.trim(),...voice.lines].filter(Boolean).join(' | '))].join('\n')
}
