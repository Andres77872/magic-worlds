import { useState } from 'react'
import { Textarea } from '@/ui/primitives'

const lines=(value:string)=>value.split('\n').map((item)=>item.trim()).filter(Boolean)
/** Keep editable newlines while the journal receives the semantic list. */
export function MetadataLineList({value,disabled,onChange}:{value:unknown;disabled:boolean;onChange:(value:string[])=>void}){
    const values=Array.isArray(value)?value.filter((item):item is string=>typeof item==='string'):[]
    const serialized=JSON.stringify(values),[typed,setTyped]=useState({serialized,text:values.join('\n')})
    if(typed.serialized!==serialized)setTyped({serialized,text:JSON.stringify(lines(typed.text))===serialized?typed.text:values.join('\n')})
    return <Textarea rows={3} disabled={disabled} value={typed.text} onChange={(event)=>{if(disabled)return;const text=event.target.value,next=lines(text);setTyped({text,serialized:JSON.stringify(next)});onChange(next)}}/>
}
