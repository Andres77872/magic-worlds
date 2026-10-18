import { useMemo,useRef,useState,type ComponentProps } from 'react'
import type { Meta,StoryObj } from '@storybook/react-vite'
import { AuthContext } from '@/app/providers/AuthProvider'
import { Button,Callout } from '@/ui/primitives'
import { novel,storyChapter,storyScene,manuscript } from '@/test/fixtures/story'
import { searchMatch,searchPage } from '@/test/fixtures/storySearch'
import { replacementAck,replacementPreview } from '@/test/fixtures/storyReplacement'
import type { StoryReplacementAck,StoryReplacementPreview,StoryReplacementRequest } from '@/shared/types/storyReplacement.types'
import type { ManuscriptReplacementSource } from '../hooks/useManuscriptReplacementSource'
import type { ManuscriptSearchSource } from '../hooks/useManuscriptSearchSource'
import { useManuscriptReplacements } from '../hooks/useManuscriptReplacements'
import { NovelManuscriptSearch } from './NovelManuscriptSearch'
import { NovelPendingReplacements } from './NovelPendingReplacements'
import { ManuscriptProse } from './ManuscriptProse'

const auth={userHash:'controlled-replacement-author',isAuthenticated:true,openLoginModal:()=>{}} as NonNullable<ComponentProps<typeof AuthContext.Provider>['value']>
const roomStory=(revision:number,text:string,hash:string)=>novel({chapters:[storyChapter({scenes:['scene-1','scene-2','scene-reference'].map((id,index)=>storyScene({id,title:index===0?'At dawn':index===1?'The keeper':'The remembered name',revision,contentHash:hash,
    document:manuscript((index===2?'@Gate':text)+(index===0?' at dawn.':index===1?' waits beside the road.':' remains a protected reference.'),id+'-p')}))})]})
function ReplacementRoom({loseFirstResponse=false}:{loseFirstResponse?:boolean}){
    const [open,setOpen]=useState(true),[version,setVersion]=useState(1)
    const [story,setStory]=useState(()=>roomStory(1,'Gate','a'.repeat(64)))
    const state=useRef({revision:1,text:'Gate',hash:'a'.repeat(64),snapshot:'b'.repeat(64),review:null as StoryReplacementPreview|null,original:null as StoryReplacementAck|null,lost:false,receipts:new Map<string,StoryReplacementAck>()})
    const currentStory=()=>roomStory(state.current.revision,state.current.text,state.current.hash)
    const source=useMemo<ManuscriptReplacementSource>(()=>{
        function preview(query:StoryReplacementRequest){
            const base=replacementPreview(),s=state.current
            const changes=query.targets.map((target)=>({sceneId:target.sceneId,position:target.position,startOffset:target.sceneId==='scene-reference'?1:0,endOffset:target.sceneId==='scene-reference'?5:s.text.length,
                quote:target.sceneId==='scene-reference'?'Gate':s.text,replacement:query.replacement,reason:target.sceneId==='scene-reference'?'reference' as const:s.text===query.replacement?'unchanged' as const:null,
                original:target.sceneId==='scene-reference'?[]:[{type:'text',text:s.text,marks:[{type:'italic'}]}],proposed:target.sceneId==='scene-reference'||!query.replacement?[]:[{type:'text',text:query.replacement,marks:[{type:'italic'}]}]}))
            const changed=changes.filter((item)=>item.reason===null).length,blocked=changes.filter((item)=>item.reason==='reference').length
            s.review={...base,sourceSnapshot:s.snapshot,operation:{op:'replace',preview:query},changes,scenes:changes.map((item)=>({sceneId:item.sceneId,title:item.sceneId==='scene-1'?'At dawn':item.sceneId==='scene-2'?'The keeper':'The remembered name',revision:s.revision,metadataRevision:1,contentHash:s.hash,targetHash:item.reason===null?'d'.repeat(64):s.hash,changed:item.reason===null?1:0})),
                counts:{selected:changes.length,changed,blocked,unchanged:changes.length-changed-blocked,scenes:changed},canApply:changed>0&&blocked===0}
            return s.review
        }
        return {key:'controlled-replacement-room',storyId:'story-1',isCurrent:()=>true,preview:async(query)=>preview(query),
            reverse:async(query)=>{
                const s=state.current,original=s.original!,base=replacementPreview(),toUndo=query.direction==='undo',replacement=original.write.operation.op==='replace'?original.write.operation.preview.replacement:'Gate'
                const changes=original.matches.map((item)=>({...item,quote:toUndo?replacement:item.quote,replacement:toUndo?item.quote:replacement,reason:null,
                    original:s.text?[{type:'text',text:s.text,marks:[{type:'italic'}]}]:[],proposed:(toUndo?item.quote:replacement)?[{type:'text',text:toUndo?item.quote:replacement,marks:[{type:'italic'}]}]:[]}))
                s.review={...base,sourceSnapshot:s.snapshot,operation:{op:'reverse',...query,sourceSnapshot:s.snapshot},changes,
                    scenes:original.scenes.map((item)=>({sceneId:item.sceneId,title:item.sceneId==='scene-1'?'At dawn':'The keeper',revision:s.revision,metadataRevision:1,contentHash:s.hash,targetHash:toUndo?item.fromHash:item.contentHash,changed:item.changed})),counts:{selected:changes.length,changed:changes.length,blocked:0,unchanged:0,scenes:original.scenes.length},canApply:true}
                return s.review
            },
            write:async(write)=>{
                const s=state.current,replay=s.receipts.get(write.requestId)
                if(replay)return replay
                const ack=replacementAck(write,s.review!);s.receipts.set(write.requestId,ack)
                if(write.operation.op==='replace'){s.original=ack;s.text=write.operation.preview.replacement}
                else s.text=write.operation.direction==='undo'?'Gate':s.original?.write.operation.op==='replace'?s.original.write.operation.preview.replacement:'Gate'
                s.revision++;s.hash=ack.scenes[0].contentHash;s.snapshot=(s.revision%2?'b':'e').repeat(64);setVersion(s.revision);setStory(currentStory())
                if(loseFirstResponse&&!s.lost){s.lost=true;throw new Error('Controlled response loss after commit')}
                return ack
            },recover:async(write)=>state.current.receipts.get(write.requestId)??null,refresh:async()=>currentStory()}
    },[loseFirstResponse])
    const replacements=useManuscriptReplacements(source,'controlled-replacement-desk',false)
    const search=useMemo<ManuscriptSearchSource>(()=>({key:'controlled-replacement-search',storyId:'story-1',isCurrent:()=>true,resolve:async()=>{throw new Error('Navigation is outside this fixture')},search:async(query)=>{
        const s=state.current,items=['scene-1','scene-2','scene-reference'].map((sceneId,index)=>searchMatch({sceneId,title:index===0?'At dawn':index===1?'The keeper':'The remembered name',position:index===2?2:1,startOffset:index===2?1:0,endOffset:index===2?5:s.text.length,quote:index===2?'Gate':s.text,revision:s.revision,contentHash:s.hash,before:index===2?'@':'',after:index===0?' at dawn.':index===1?' waits beside the road.':' remains a protected reference.'}))
            .filter((item)=>query.caseSensitive?item.quote===query.q:item.quote.toLowerCase()===query.q.toLowerCase())
        return searchPage({sourceSnapshot:s.snapshot,items,scenesSearched:3,matchingScenes:items.length})
    }}),[])
    return <div className="space-y-4 p-4"><Button onClick={()=>setOpen(true)}>Search manuscript</Button>
        <Callout role="status">Controlled manuscript revision {version}. All writes stay in this fixture.</Callout>
        <NovelPendingReplacements replacements={replacements}/>
        {story.chapters[0].scenes.map((scene)=><section className="space-y-2" key={scene.id}><h2 className="font-display text-h3">{scene.title}</h2><ManuscriptProse document={scene.document} onReference={()=>{}}/></section>)}
        <NovelManuscriptSearch open={open} onClose={()=>setOpen(false)} story={story} source={search} beforeNavigate={async()=>true} onNavigate={()=>false} replacements={replacements}/>
    </div>
}
function ReplacementDemo(props:ComponentProps<typeof ReplacementRoom>){return <AuthContext.Provider value={auth}><ReplacementRoom {...props}/></AuthContext.Provider>}
const meta={title:'Novel/Manuscript replacements',component:ReplacementDemo,tags:['autodocs'],parameters:{layout:'fullscreen',docs:{description:{component:'The actual selection, preview, journal and recovery UI with controlled literal matches and receipts. No backend or provider runs. Native HTTP/MySQL compiler fidelity is verified separately.'}}},args:{loseFirstResponse:false}} satisfies Meta<typeof ReplacementDemo>
export default meta
type Story=StoryObj<typeof meta>
export const Reviewed:Story={}
export const LostResponse:Story={args:{loseFirstResponse:true}}
