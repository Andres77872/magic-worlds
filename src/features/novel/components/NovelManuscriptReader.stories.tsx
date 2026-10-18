import { useMemo,useRef,useState } from 'react'
import type { Meta,StoryObj } from '@storybook/react-vite'
import { ApiError } from '@/infrastructure/api'
import { Button } from '@/ui/primitives'
import { novel,storyChapter,storyScene,storyReference,manuscript } from '@/test/fixtures/story'
import { readingItem,readingWindow as readingPage } from '@/test/fixtures/storyReading'
import type { StoryReadingRequest } from '@/shared/types/storyReading.types'
import type { StoryManuscriptDocument } from '@/shared'
import { DEFAULT_READING } from '../utils/readingPreferences'
import { NovelManuscriptReader } from './NovelManuscriptReader'

const paragraphs=[
    'The old road ended at a wall the maps had forgotten. Mira laid the pale key on the stone and waited. Above her, the keeper opened a narrow window. He looked first at the key, then at the empty road behind her, as if he had expected someone else to arrive with it.',
    'A bell rang beyond the wall. Its last note lingered in the evening air, too low to belong to any tower she could see. Mira kept her hand on the key. The keeper said nothing. Only when the bell fell silent did he ask whether she had found the road herself, or whether the road had found her.',
    'She remembered the letter in her coat and the careful absence of a signature. There had been a pressed leaf inside it, still green after a winter in the post. She had crossed three rivers to learn what that meant. Now the keeper held out his hand, and she could not tell whether he wanted the key or the letter.',
]
function rich(identity:string):StoryManuscriptDocument {
    return {schemaVersion:1,content:{type:'doc',content:paragraphs.map((text,index)=>({type:'paragraph',attrs:{nodeId:identity+'-'+index},content:index===0?[{type:'codexMention',attrs:{id:'reference-1',label:'Mira'}},{type:'text',text:' · '+text,marks:[{type:'italic'}]}]:[{type:'text',text}]}))}}
}
function ReaderDemo({staleContinuation=false,readOnly=false,large=false}:{staleContinuation?:boolean;readOnly?:boolean;large?:boolean}){
    const [open,setOpen]=useState(!large),[opened,setOpened]=useState<string|null>(null)
    const preferenceKey='controlled-manuscript-reader-'+(large?'long':staleContinuation?'stale':readOnly?'archived':'short')
    const story=useMemo(()=>{
        const value=novel({status:readOnly?'archived':'draft',activeCardRefs:[storyReference({snapshot:{id:'mira',name:'Mira',description:'The keeper’s expected traveler. A frozen source description.',story_card_kind:'character',source_card_version_number:3}})],
        parts:[{id:'part-1',storyId:'story-1',title:'Beyond the wall',metadataRevision:1,order:0,status:null,wordGoal:null,povCardId:null,locationCardId:null,details:{},trashedAt:null,copiedFrom:null}],
        chapters:[storyChapter({title:'The remembered road',scenes:[storyScene({id:'scene-1',title:'At the gate',document:rich('gate')}),storyScene({id:'scene-2',title:'The keeper’s question',order:1,document:rich('keeper')})]}),
            storyChapter({id:'chapter-2',title:'Across the threshold',partId:'part-1',scenes:[storyScene({id:'scene-3',chapterId:'chapter-2',title:'Another road',document:manuscript('Beyond the gate, the road divided again. Mira chose the branch without footprints.','other-road')}),storyScene({id:'scene-4',chapterId:'chapter-2',title:'The earlier ending',order:1,status:'archived',document:manuscript('An earlier ending remains available to read.','earlier-ending')})]})]})
        if(large){value.parts=[];value.chapters=Array.from({length:100},(_,chapter)=>storyChapter({id:'long-chapter-'+chapter,title:'Chapter '+(chapter+1),scenes:Array.from({length:10},(_,offset)=>{
            const index=chapter*10+offset,id='long-scene-'+String(index).padStart(4,'0')
            return storyScene({id,chapterId:'long-chapter-'+chapter,title:'Scene '+(index+1),order:offset,document:rich(id)})
        })}))}
        return value
    },[readOnly,large])
    const continuation=useRef({changed:false,version:'b'.repeat(64)})
    const source=useMemo(()=>{
        return {key:'controlled-reader-'+(large?'long':'short'),storyId:story.id,isCurrent:()=>true,read:async(query:StoryReadingRequest)=>{
            const state=continuation.current
            if(staleContinuation&&query.sourceSnapshot&&!state.changed){state.changed=true;state.version='c'.repeat(64);throw new ApiError(409,'Controlled source changed')}
            if(query.sourceSnapshot&&query.sourceSnapshot!==state.version)throw new ApiError(409,'Controlled source changed')
            const items=story.chapters.flatMap((chapter)=>chapter.scenes.map((scene)=>{
                const item=readingItem(scene.id),part=story.parts.find((part)=>part.id===chapter.partId)
                return {header:{...item.header,chapterId:chapter.id,partId:chapter.partId,title:scene.title,chapterTitle:chapter.title,partTitle:part?.title??null,partMetadataRevision:part?.metadataRevision??null,
                    status:scene.status??story.status,archived:scene.status==='archived',readOnly:readOnly||scene.status==='archived'},scene:{...item.scene,chapterId:chapter.id,document:scene.document,plainText:scene.plainText,body:scene.body}}
            })).filter((item)=>(query.includeArchived||!item.header.archived)&&(!query.scope||query.scope==='novel'||(query.scope==='part'?item.header.partId:query.scope==='chapter'?item.header.chapterId:item.header.sceneId)===query.unitId))
            const at=query.afterSceneId??query.beforeSceneId??query.startSceneId,index=at?items.findIndex((item)=>item.header.sceneId===at):0
            if(at&&index<0)throw new ApiError(422,'Reading position unavailable',{code:'STORY_READING_POSITION_INVALID'})
            const offset=query.afterSceneId?index+1:query.beforeSceneId?Math.max(0,index-(query.limit??2)):query.startSceneId?index:0
            const selected=items.slice(offset,Math.min(offset+(query.limit??2),query.beforeSceneId?index:items.length))
            return readingPage({sourceSnapshot:state.version,scope:query.scope??'novel',unitId:query.unitId??null,includeArchived:query.includeArchived??false,afterSceneId:query.afterSceneId??null,
                totalScenes:items.length,offset,items:selected,nextAfterSceneId:offset+selected.length<items.length?selected[selected.length-1].header.sceneId:null,
                navigation:{startSceneId:query.startSceneId??null,beforeSceneId:query.beforeSceneId??null,previousBeforeSceneId:offset>0?selected[0]?.header.sceneId??null:null,previousChapterId:items[offset-1]?.header.chapterId??null,previousPartId:items[offset-1]?.header.partId??null}})
        }}
    },[story,readOnly,staleContinuation,large])
    return <div className="space-y-3"><Button onClick={()=>setOpen(true)}>Read manuscript</Button>{opened&&<p role="status">Opened scene: {opened}</p>}
        {large&&!open&&<Button variant="secondary" onClick={()=>{
            localStorage.setItem(preferenceKey+':reader-scope',JSON.stringify({schemaVersion:1,scope:'novel',unitId:null,includeArchived:false}))
            localStorage.setItem(preferenceKey+':reader-position',JSON.stringify({schemaVersion:1,scope:{scope:'novel',unitId:null,includeArchived:false},sceneId:'long-scene-0990',contentHash:'a'.repeat(64),nodeId:'long-scene-0990-0',blockOffset:0,blockHeight:1,width:1,appearance:''}))
            setOpen(true)
        }}>Resume near scene 991</Button>}
        <NovelManuscriptReader open={open} source={source} story={story} preferences={DEFAULT_READING} preferenceKey={preferenceKey} activeChapterId="chapter-1" activeSceneId="scene-1" onClose={()=>setOpen(false)} onOpenScene={async(_page,item)=>{setOpened(item.header.title);return true}}/>
    </div>
}
const meta={title:'Novel/Manuscript reading',component:ReaderDemo,tags:['autodocs'],parameters:{layout:'fullscreen',docs:{description:{component:'Controlled saved prose in bounded bidirectional windows, with scoped device resume. The long fixture can seed a late-book position, then normal reading captures it. Reference and scene opening are local fixture navigation; no backend, generation or manuscript write runs.'}}},args:{staleContinuation:false,readOnly:false,large:false}} satisfies Meta<typeof ReaderDemo>
export default meta
type Story=StoryObj<typeof meta>
export const Continuous:Story={}
export const ChangedSavedVersion:Story={args:{staleContinuation:true}}
export const ArchivedNovel:Story={args:{readOnly:true}}
export const LongManuscript:Story={args:{large:true}}
