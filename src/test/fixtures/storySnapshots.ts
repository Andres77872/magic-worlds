import type { Story,StorySnapshotManifest,StorySnapshotComparison,StorySnapshotSummary,StorySnapshotPage,StorySnapshotPreview,StorySnapshotSceneView,StorySnapshotCreateOperation,StorySnapshotRestorePreview,StorySnapshotRestoreOptions } from '@/shared'
import { novel,storyScene,storyChapter,storyReference } from './story'

const unitKeys=['id','storyId','title','metadataRevision','order','status','wordGoal','povCardId','locationCardId','details','trashedAt','copiedFrom','previousStatus','mergedInto'] as const
const rootKeys=['id','title','description','source','metadataRevision','structureRevision','contextRevision','status','wordGoal','details','trashedAt','copiedFrom','activeContext'] as const
function pick<T extends object,K extends keyof T>(value:T,keys:readonly K[]):Pick<T,K> {
    return Object.fromEntries(keys.map((key)=>[key,value[key]??null])) as Pick<T,K>
}
export function snapshotStory(current=false):Story {
    const reference=storyReference({sceneId:'scene-1',snapshot:{id:'mira',name:'Mira',description:current?'Later local notes.':'Original frozen notes.',story_card_kind:'character',source_card_version_id:'mira-v3',source_card_version_number:3}})
    const scene=storyScene({title:'At the gate',chapterId:'chapter-1',revision:current?3:2,metadataRevision:current?2:1,contentHash:(current?'c':'b').repeat(64),body:current?'The current gate opens.':'The original gate held.',wordGoal:300,details:{notes:current?'Later scene notes.':'Original scene notes.'},activeCardRefs:[reference]})
    return novel({title:current?'The revised gate':'The gate',structureRevision:current?5:2,contextRevision:current?3:2,activeCardRefs:[reference],chapters:[storyChapter({scenes:[scene],wordGoal:900})]})
}
export function snapshotManifest(current=false):StorySnapshotManifest {
    const story=snapshotStory(current)
    return {schemaVersion:1,storyId:story.id,sourceVersion:(current?'c':'a').repeat(64),novel:pick(story,rootKeys),parts:[],
        chapters:story.chapters.map((chapter)=>({...pick(chapter,unitKeys),partId:chapter.partId,scenes:chapter.scenes.map((scene)=>({...pick(scene,unitKeys),chapterId:chapter.id,revision:scene.revision,contentHash:scene.contentHash,copiedFromRevision:null}))})),
        references:story.activeCardRefs}
}
export const snapshotSummary=(patch:Partial<StorySnapshotSummary>={}):StorySnapshotSummary=>({id:3,storyId:'story-1',name:'First complete draft',note:'Before the gates opened.',sourceVersion:'a'.repeat(64),manifestHash:'d'.repeat(64),counts:{parts:0,chapters:1,scenes:1,references:1},createdAt:'2026-10-16T12:00:00',...patch})
export const snapshotPage=(patch:Partial<StorySnapshotPage>={}):StorySnapshotPage=>({storyId:'story-1',items:[snapshotSummary()],nextBefore:null,...patch})
export const snapshotComparison=():StorySnapshotComparison=>({...snapshotSummary(),manifest:snapshotManifest(),current:snapshotManifest(true)})
export const snapshotPreview=():StorySnapshotPreview=>({storyId:'story-1',title:'The revised gate',sourceVersion:'c'.repeat(64),structureRevision:5,counts:{parts:0,chapters:1,scenes:1,references:1},annotations:{revision:6,count:0}})
export const snapshotView=():StorySnapshotSceneView=>({storyId:'story-1',snapshotId:3,manifestHash:'d'.repeat(64),scene:{...snapshotStory().chapters[0].scenes[0],...snapshotManifest().chapters[0].scenes[0]}})
export const snapshotOperation=():StorySnapshotCreateOperation=>({op:'create_snapshot',title:'A named milestone',note:null,sourceStructureRevision:5,expectedSourceVersion:'c'.repeat(64)})
export const snapshotRestoreOptions=():StorySnapshotRestoreOptions=>({text:true,details:true,organization:true,context:true,laterUnits:'keep'})
export function snapshotRestorePreview(options=snapshotRestoreOptions()):StorySnapshotRestorePreview {
    const current=snapshotManifest(true),target=snapshotManifest(true),saved=snapshotManifest()
    const changes:StorySnapshotRestorePreview['changes']=[]
    const fields:string[]=[]
    if(options.details){target.novel.title=saved.novel.title;target.novel.metadataRevision++;changes.push({kind:'novel',id:target.storyId,title:target.novel.title,fields:['title']});target.chapters[0].scenes[0].details=saved.chapters[0].scenes[0].details;target.chapters[0].scenes[0].metadataRevision++;fields.push('details')}
    if(options.text){target.chapters[0].scenes[0].contentHash=saved.chapters[0].scenes[0].contentHash;target.chapters[0].scenes[0].revision++;fields.push('contentHash')}
    if(fields.length)changes.push({kind:'scene',id:'scene-1',title:'At the gate',fields})
    if(options.context){target.references=saved.references;target.novel.contextRevision++;changes.push({kind:'reference',id:target.references[0].id,title:'Mira',fields:['snapshot']})}
    target.novel.structureRevision++;target.sourceVersion='f'.repeat(64)
    return {storyId:'story-1',snapshotId:3,name:'First complete draft',manifestHash:'d'.repeat(64),sourceVersion:current.sourceVersion,structureRevision:5,options,current,target,changes,counts:{parts:0,chapters:0,scenes:fields.length?1:0,references:options.context?1:0},laterUnits:[],blockers:[],canRestore:changes.length>0}
}
