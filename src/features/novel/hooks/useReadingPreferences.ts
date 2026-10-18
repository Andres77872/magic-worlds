import { DEFAULT_READING,isReadingPreferences } from '../utils/readingPreferences'
import { useNovelDevicePreferences } from './useNovelDevicePreferences'

/** The caller supplies the existing API/account/workspace/novel view scope. */
export function useReadingPreferences(viewKey:string|null){
    return useNovelDevicePreferences(viewKey?viewKey+':reading':null,DEFAULT_READING,isReadingPreferences)
}
