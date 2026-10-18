import { DEFAULT_COMPLETIONS,isCompletionPreferences } from '../utils/completions'
import { useNovelDevicePreferences } from './useNovelDevicePreferences'
export function useCompletionPreferences(viewKey:string|null){
    return useNovelDevicePreferences(viewKey?viewKey+':completions':null,DEFAULT_COMPLETIONS,isCompletionPreferences)
}
