/** Deterministic current-contract novel fixtures for tests and Storybook. */
import type { Story, StoryCardRef, StoryChapter, StoryContextTrace, StoryGeneration, StoryManuscriptDocument, StoryScene } from '@/shared'
import { documentMarkdown, documentText } from '@/shared/storyDocument'

export function manuscript(text='',nodeId='paragraph-1'):StoryManuscriptDocument {
    return {schemaVersion:1,content:{type:'doc',content:[{type:'paragraph',attrs:{nodeId},...(text?{content:[{type:'text',text}]}:{})}]}}
}
export function storyTrace(patch:Partial<StoryContextTrace>={}):StoryContextTrace {
    return {cards:[],loreEntries:[],scenes:[],structureRevision:1,novelMetadataRevision:1,contextRevision:1,totalEstimatedTokens:0,...patch}
}
export function storyScene(patch:Partial<StoryScene>={}):StoryScene {
    const id=patch.id??'scene-1'
    const document=patch.document??manuscript(patch.plainText??patch.body??'',id+'-p')
    return {id,storyId:'story-1',chapterId:'chapter-1',title:'Scene 1',
        revision:1,metadataRevision:1,contentHash:'a'.repeat(64),plainText:documentText(document),body:documentMarkdown(document),
        order:0,status:null,wordGoal:null,povCardId:null,locationCardId:null,details:{},trashedAt:null,copiedFrom:null,
        activeCardRefs:[],generationHistory:[],...patch,document}
}
export function storyChapter(patch:Partial<StoryChapter>={}):StoryChapter {
    const id=patch.id??'chapter-1'
    const scenes=patch.scenes??[storyScene({id:id+'-scene',chapterId:id,storyId:patch.storyId??'story-1'})]
    return {id,storyId:'story-1',title:'Chapter 1',partId:null,metadataRevision:1,order:0,status:null,
        wordGoal:null,povCardId:null,locationCardId:null,details:{},trashedAt:null,copiedFrom:null,
        activeCardRefs:[],generationHistory:[],body:scenes.map((scene)=>scene.body).join('\n\n'),...patch,scenes}
}
export function novel(patch:Partial<Story>={}):Story {
    return {id:'story-1',title:'The Glass War',description:null,source:{kind:'blank',id:null,title:null},
        metadataRevision:1,structureRevision:1,contextRevision:1,status:'draft',wordGoal:null,details:{},trashedAt:null,copiedFrom:null,
        parts:[],chapters:[storyChapter()],activeCardRefs:[],activeContext:{includeSelectedCards:true,includeLorebooks:true,
            includeRecentChapters:2,tokenBudget:6000,styleSource:'current_scene',customStyleInstruction:null},...patch}
}
export function storyReference(patch:Partial<StoryCardRef>={}):StoryCardRef {
    return {id:'reference-1',storyId:'story-1',chapterId:null,sceneId:null,removedAt:null,kind:'character',cardId:'mira',
        source:'manual',enabled:true,precedence:0,snapshot:{id:'mira',name:'Mira',description:'A curious traveler.',story_card_kind:'character'},...patch}
}
export function storyGeneration(patch:Partial<StoryGeneration>={}):StoryGeneration {
    return {id:'generation-1',storyId:'story-1',chapterId:'chapter-1',sceneId:'scene-1',command:'continue',baseRevision:1,
        status:'candidate',inputRange:null,promptSummary:null,contextTrace:storyTrace(),output:'The gate opened.',...patch}
}
