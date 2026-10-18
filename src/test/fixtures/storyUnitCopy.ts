import { novel,storyChapter,storyScene } from './story'
export const unitCopyStory=()=>novel({contextRevision:4,structureRevision:8,chapters:[storyChapter({id:'chapter-1',title:'The gate',metadataRevision:3,details:{notes:'Chapter note'},scenes:[
    storyScene({id:'scene-active',chapterId:'chapter-1',title:'At the gate',body:'The gate held.',revision:7,metadataRevision:2,details:{notes:'A note'}}),
    storyScene({id:'scene-archived',chapterId:'chapter-1',title:'An earlier gate',body:'An older opening.',order:1,status:'archived'}),
    storyScene({id:'scene-trashed',chapterId:'chapter-1',title:'A discarded gate',body:'A discarded opening.',order:2,trashedAt:'2026-10-16T00:00:00Z'}),
]})]})
