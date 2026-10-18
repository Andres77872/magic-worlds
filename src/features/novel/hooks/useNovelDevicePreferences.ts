import { useCallback,useLayoutEffect,useMemo,useRef,useState } from 'react'
function read<T>(key:string|null,fallback:T,validate:(value:unknown)=>value is T):{value:T;unavailable:boolean}{
    if(!key)return {value:fallback,unavailable:true}
    try{
        const raw=localStorage.getItem(key),stored=raw&&raw.length<=2048?JSON.parse(raw):null
        if(stored?.schemaVersion===1){const value={...stored};delete value.schemaVersion;if(validate(value))return {value,unavailable:false}}
        return {value:fallback,unavailable:false}
    }catch{return {value:fallback,unavailable:true}}
}
/** Scoped, bounded device settings; malformed/old records stay untouched. */
export function useNovelDevicePreferences<T>(key:string|null,fallback:T,validate:(value:unknown)=>value is T){
    const seed=useMemo(()=>read(key,fallback,validate),[key,fallback,validate])
    const [state,setState]=useState({key,...seed}),current=useRef<string|null|undefined>(key)
    useLayoutEffect(()=>{current.current=key;return()=>{current.current=undefined}},[key])
    const value=state.key===key?state:seed
    const update=useCallback((next:T)=>{
        if(current.current!==key||!validate(next))return
        let unavailable=!key
        if(key)try{localStorage.setItem(key,JSON.stringify({schemaVersion:1,...next}))}catch{unavailable=true}
        setState({key,value:next,unavailable})
    },[key,validate])
    return {preferences:value.value,storageUnavailable:value.unavailable,setPreferences:update}
}
