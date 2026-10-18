import { useNovelDevicePreferences } from './useNovelDevicePreferences'
export interface InvisiblePreferences {visible:boolean}
export const DEFAULT_INVISIBLES:Readonly<InvisiblePreferences>=Object.freeze({visible:false})
export function isInvisiblePreferences(value:unknown):value is InvisiblePreferences {
    return Boolean(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===1&&'visible' in value&&typeof value.visible==='boolean')
}
export function useInvisibleCharacters(viewKey:string|null){
    return useNovelDevicePreferences(viewKey?viewKey+':invisibles':null,DEFAULT_INVISIBLES,isInvisiblePreferences)
}
