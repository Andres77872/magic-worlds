import type { StoryStructureHistoryItem,StoryStructureHistoryPage,StoryStructureOutlineUnit,StoryStructureRevision,StoryStructureSnapshot } from '@/shared'

const unit=(id:string,title:string):StoryStructureOutlineUnit=>({id,title,order:0,status:null,trashedAt:null,metadataRevision:1,povCardId:null,locationCardId:null,inheritedDetails:{narrator:null,tense:null,includeInAI:null,includeInExport:null}})
export function historySnapshots():{before:StoryStructureSnapshot;after:StoryStructureSnapshot} {
    const scene={...unit('scene-1','At the gate'),chapterId:'chapter-1',revision:3,logicalRevision:3}
    const first={...unit('chapter-1','Opening'),partId:null,scenes:[scene]}
    const second={...unit('chapter-2','Beyond the gate'),partId:null,order:1,scenes:[]}
    return {before:{structureRevision:2,parts:[],chapters:[first,second]},after:{structureRevision:3,parts:[],chapters:[{...first,scenes:[]},{...second,scenes:[{...scene,chapterId:second.id}]}]}}
}
export const historyRow=(patch:Partial<StoryStructureHistoryItem>={}):StoryStructureHistoryItem=>({revision:3,parentRevision:2,createdAt:'2026-10-16T12:00:00',action:'move',targetAction:'move',operationRevision:3,kind:'scene',title:null,actor:'author',reversible:true,...patch})
export const historyPage=(patch:Partial<StoryStructureHistoryPage>={}):StoryStructureHistoryPage=>({storyId:'story-1',structureRevision:3,undo:{revision:3,operationRevision:3,action:'move'},redo:null,items:[historyRow()],nextBefore:null,...patch})
export const historyDetail=(patch:Partial<StoryStructureRevision>={}):StoryStructureRevision=>({storyId:'story-1',...historyRow(),operation:{op:'move',kind:'scene',id:'scene-1',parentId:'chapter-2'},...historySnapshots(),...patch})
