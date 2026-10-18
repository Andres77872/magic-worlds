import { useCallback,useLayoutEffect,useMemo,useRef,useState } from 'react'
import { DEFAULT_OUTLINE_VIEW,type OutlineView } from '../utils/novelOutline'

const read=(key:string|null):{value:OutlineView;unavailable:boolean}=>{
    try{const raw=key?localStorage.getItem(key):null,value=raw&&raw.length<=2048?JSON.parse(raw):null
        if(value?.schemaVersion===1&&Object.keys(value).length===3&&typeof value.numbers==='boolean'&&typeof value.details==='boolean')return {value:{numbers:value.numbers,details:value.details},unavailable:false}
    }catch{return {value:DEFAULT_OUTLINE_VIEW,unavailable:true}}
    return {value:DEFAULT_OUTLINE_VIEW,unavailable:false}
}
export function useOutlineView(scopeKey:string|null){
    const key=scopeKey?scopeKey+':outline':null,seed=useMemo(()=>read(key),[key])
    const [state,setState]=useState({key,...seed}),current=useRef<string|null|undefined>(key)
    useLayoutEffect(()=>{current.current=key;return()=>{current.current=undefined}},[key])
    const stateValue=state.key===key?state:seed
    const update=useCallback((value:OutlineView)=>{
        if(current.current!==key||typeof value?.numbers!=='boolean'||typeof value?.details!=='boolean'||Object.keys(value).length!==2)return
        let unavailable=!key
        if(key)try{localStorage.setItem(key,JSON.stringify({schemaVersion:1,...value}))}catch{unavailable=true}
        setState({key,value,unavailable})
    },[key])
    return {outlineView:stateValue.value,setOutlineView:update,outlineStorageUnavailable:stateValue.unavailable}
}
