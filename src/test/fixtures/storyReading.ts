import type { StoryReadingItem,StoryReadingPage } from '@/shared/types/storyReading.types'
import { storyScene } from './story'

export function readingItem(id='scene-1',text='The gate held. 雨 🙂'):StoryReadingItem {
    const s=storyScene({id,plainText:text})
    return {header:{sceneId:id,chapterId:s.chapterId,partId:null,title:s.title,chapterTitle:'Opening',partTitle:null,
        chapterMetadataRevision:1,partMetadataRevision:null,revision:s.revision,metadataRevision:s.metadataRevision,contentHash:s.contentHash,status:'draft',archived:false,readOnly:false},
        scene:{id:s.id,chapterId:s.chapterId,revision:s.revision,metadataRevision:s.metadataRevision,contentHash:s.contentHash,document:s.document,plainText:s.plainText,body:s.body}}
}
export function readingPage(patch:Partial<StoryReadingPage>={}):StoryReadingPage {
    return {schemaVersion:1,storyId:'story-1',sourceSnapshot:'b'.repeat(64),sourceStructureRevision:1,sourceMetadataRevision:1,sourceContextRevision:1,
        scope:'novel',unitId:null,includeArchived:false,afterSceneId:null,offset:0,totalScenes:1,nextAfterSceneId:null,items:[readingItem()],...patch}
}
export function readingWindow(patch:Partial<StoryReadingPage>={}):StoryReadingPage {
    const value=readingPage(patch)
    return {...value,navigation:{startSceneId:null,beforeSceneId:null,previousBeforeSceneId:value.offset>0?value.items[0]?.header.sceneId??null:null,
        previousChapterId:value.offset>0?'chapter-1':null,previousPartId:null,...patch.navigation}}
}
