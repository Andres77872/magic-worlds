import { DEFAULT_TYPING,isTypingPreferences } from '../utils/typingPreferences'
import { useNovelDevicePreferences } from './useNovelDevicePreferences'
export function useTypingPreferences(viewKey:string|null){
    return useNovelDevicePreferences(viewKey?viewKey+':typing':null,DEFAULT_TYPING,isTypingPreferences)
}
