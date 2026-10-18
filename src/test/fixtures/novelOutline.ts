import type { StoryPart } from '@/shared'
import { novel,storyChapter,storyScene,storyReference } from './story'

const part=(id:string,title:string,order:number):StoryPart=>({id,title,order,storyId:'story-1',metadataRevision:1,status:null,wordGoal:2000,povCardId:null,locationCardId:null,details:{synopsis:'A turning point in the journey.'},trashedAt:null,copiedFrom:null})
export function outlineStory(){
    const mira=storyReference({id:'mira-reference',cardId:'mira',snapshot:{id:'mira',name:'Mira',description:'The viewpoint character.',story_card_kind:'character'}})
    const gate=storyReference({id:'gate-reference',kind:'world',cardId:'gate',snapshot:{id:'gate',name:'The old gate',description:'A crossing between worlds.',story_card_kind:'world'}})
    const first=storyScene({id:'arrival',title:'The arrival',chapterId:'chapter-one',plainText:'Mira reaches the old gate.',revision:4,wordGoal:300,povCardId:'mira',locationCardId:'gate',details:{synopsis:'Mira must decide whether to cross.',summary:'Mira reaches the gate and finds it sealed.',summaryRevision:4,castIds:['mira']}})
    const second=storyScene({id:'answer',title:'An unexpected answer',chapterId:'chapter-one',order:2,plainText:'A voice answers from the other side.',revision:3,wordGoal:250,details:{summary:'An earlier account of the answer.',summaryRevision:2,castIds:['mira'],includeInAI:false}})
    const archived=storyScene({id:'alternate',title:'An earlier entrance',chapterId:'chapter-one',order:1,status:'archived',plainText:'An alternate entrance remains readable.',details:{summary:'A retained alternative without a source pin.',summaryRevision:null}})
    return novel({parts:[part('act-one','The crossing',0)],activeCardRefs:[mira,gate],chapters:[storyChapter({id:'chapter-one',title:'At the boundary',partId:'act-one',wordGoal:800,details:{synopsis:'The first attempt to cross the boundary.'},scenes:[second,archived,first]})]})
}
