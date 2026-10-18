import { useLayoutEffect,useRef,useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button,Field,Textarea } from '@/ui/primitives'

interface Row { key:number;text:string }
interface Props { value:unknown;disabled?:boolean;onChange:(beats:string[])=>void }
/** Row keys belong only to the form. Saved plans are ordered author text. */
export function NovelPlannedBeats({value,disabled=false,onChange}:Props){
    const {t}=useTranslation(),copy=(key:string,options?:Record<string,unknown>)=>t('novelEditor.planning.'+key,options)
    const container=useRef<HTMLFieldSetElement>(null),focusRow=useRef<number|null>(null)
    const values=Array.isArray(value)?value.filter((item):item is string=>typeof item==='string'):[]
    const serialized=JSON.stringify(values)
    const [state,setState]=useState(()=>({serialized,rows:values.map((text,key)=>({text,key})),nextKey:values.length,removed:null as Row[]|null}))
    if(state.serialized!==serialized)setState({serialized,rows:values.map((text,index)=>({text,key:state.nextKey+index})),nextKey:state.nextKey+values.length,removed:null})
    useLayoutEffect(()=>{
        const key=focusRow.current;focusRow.current=null
        if(key!==null&&!disabled)container.current?.querySelector<HTMLTextAreaElement>('[data-planned-beat="'+key+'"] textarea')?.focus()
    },[state.rows,disabled])
    function change(rows:Row[],nextKey=state.nextKey,removed:Row[]|null=null){
        if(disabled)return
        const beats=rows.map((row)=>row.text)
        setState({serialized:JSON.stringify(beats),rows,nextKey,removed});onChange(beats)
    }
    function move(index:number,direction:-1|1){
        if(disabled||index+direction<0||index+direction>=state.rows.length)return
        focusRow.current=state.rows[index].key
        const rows=[...state.rows];[rows[index],rows[index+direction]]=[rows[index+direction],rows[index]];change(rows)
    }
    return <fieldset ref={container} disabled={disabled} className="space-y-3 rounded-lg border border-line p-3">
        <legend className="px-1 text-label font-semibold">{copy('plannedBeats')}</legend>
        <p className="text-caption text-parchment-300">{copy('help')}</p>
        <div className="space-y-3">{state.rows.map((row,index)=><div key={row.key} data-planned-beat={row.key} className="space-y-2">
            <Field label={copy('beat',{number:index+1})} error={!row.text.trim()||Array.from(row.text).length>2000?copy('invalidBeat'):undefined}>
                <Textarea rows={3} disabled={disabled} value={row.text} onChange={(event)=>change(state.rows.map((item)=>item.key===row.key?{...item,text:event.target.value}:item))}/>
            </Field>
            <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" disabled={disabled||index===0} aria-label={copy('moveUp',{number:index+1})} onClick={()=>move(index,-1)}>{copy('up')}</Button>
                <Button size="sm" variant="secondary" disabled={disabled||index===state.rows.length-1} aria-label={copy('moveDown',{number:index+1})} onClick={()=>move(index,1)}>{copy('down')}</Button>
                <Button size="sm" variant="ghost" disabled={disabled} aria-label={copy('removeBeat',{number:index+1})} onClick={()=>change(state.rows.filter((item)=>item.key!==row.key),state.nextKey,state.rows)}>{copy('remove')}</Button>
            </div>
        </div>)}</div>
        <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" disabled={disabled||state.rows.length>=100} onClick={()=>{if(disabled)return;focusRow.current=state.nextKey;change([...state.rows,{key:state.nextKey,text:''}],state.nextKey+1)}}>{copy('add')}</Button>
            {state.removed&&<Button size="sm" variant="secondary" disabled={disabled} onClick={()=>change(state.removed!)}>{copy('undoRemove')}</Button>}
        </div>
    </fieldset>
}
