import type { StorySearchMatch,StorySearchPage,StorySearchResult } from '@/shared/types/storySearch.types'
import { storyScene } from './story'
import type { StoryScene } from '@/shared'

export function searchSceneProjection(value:StoryScene):StorySearchResult['scene'] {
    const projection:Partial<StoryScene>={...value}
    delete projection.activeCardRefs;delete projection.generationHistory
    return projection as StorySearchResult['scene']
}

export function searchMatch(patch:Partial<StorySearchMatch>={}):StorySearchMatch {
    return {sceneId:'scene-1',chapterId:'chapter-1',partId:null,title:'Scene 1',chapterTitle:'Chapter 1',partTitle:null,chapterMetadataRevision:1,partMetadataRevision:null,
        revision:1,metadataRevision:1,contentHash:'a'.repeat(64),status:'draft',archived:false,readOnly:false,position:4,startOffset:4,endOffset:8,quote:'gate',before:'A🙂 ',after:' waits.',beforeCut:false,afterCut:false,...patch}
}
export function searchPage(patch:Partial<StorySearchPage>={}):StorySearchPage {
    return {...searchEnvelope(),scenesSearched:1,matchingScenes:1,items:[searchMatch()],nextCursor:null,...patch}
}
const searchEnvelope=()=>({schemaVersion:1 as const,storyId:'story-1',algorithm:'mysql-icu-literal-v1' as const,sourceSnapshot:'b'.repeat(64),queryHash:'c'.repeat(64),sourceStructureRevision:1,sourceMetadataRevision:1,sourceContextRevision:1})
export function searchResult(patch:Partial<StorySearchResult>={}):StorySearchResult {
    const scene=searchSceneProjection(storyScene({plainText:'A🙂 gate waits.',inheritance:{values:{status:'draft',includeInAI:true,includeInExport:true},origins:{status:'novel'},readOnly:false}}))
    return {...searchEnvelope(),projection:'scene_document',scene,match:searchMatch(),...patch}
}
