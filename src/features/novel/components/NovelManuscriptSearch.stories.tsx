import { useMemo,useRef,useState,type ComponentProps } from 'react'
import type { Meta,StoryObj } from '@storybook/react-vite'
import { AuthContext } from '@/app/providers/AuthProvider'
import { FloatingWindowsProvider } from '@/app/providers/FloatingWindowsProvider'
import type { StoryManuscriptDocument } from '@/shared'
import type { StorySearchMatch,StorySearchOptions,StorySearchResult } from '@/shared/types/storySearch.types'
import { manuscript,novel,storyChapter,storyScene } from '@/test/fixtures/story'
import { searchPage,searchResult,searchSceneProjection } from '@/test/fixtures/storySearch'
import { documentSignature,documentText } from '@/shared/storyDocument'
import { makeRequestId } from '@/utils/uuid'
import { Button,Callout,SwitchRow } from '@/ui/primitives'
import { NovelEditor } from '../editor/NovelEditor'
import type { NovelEditorHandle } from '../editor/types'
import type { ManuscriptSearchSource } from '../hooks/useManuscriptSearchSource'
import type { ManuscriptSearchTarget } from '../editor/extensions/manuscriptSearchTarget'
import { NovelManuscriptSearch } from './NovelManuscriptSearch'
import { NovelStudioHeader } from './NovelStudioHeader'

const auth={userHash:'controlled-search-author'} as NonNullable<ComponentProps<typeof AuthContext.Provider>['value']>
const later=manuscript('Mira carried the letter into the rain.','search-later-intro')
later.content.content!.push(...Array.from({length:24},(_,index)=>({type:'paragraph',attrs:{nodeId:'search-later-'+index},content:[{type:'text',text:`Entry ${index+1}. The lantern burned through the rain. Mira waited beside the watchman, holding the letter beneath her coat. Every footstep on the road sounded like a promise.`}]})),
    {type:'paragraph',attrs:{nodeId:'search-last'},content:[{type:'text',text:'At midnight, the gate opened for Mira.'}]})
const scenes=[storyScene({id:'scene-one',title:'The letter',document:manuscript('Mira waited at the gate. The gate stayed shut.','search-first')}),storyScene({id:'scene-two',title:'After midnight',order:1,document:later})]
const story=novel({title:'The sealed letter',chapters:[storyChapter({scenes})]})
/** ASCII fixture only. Native ICU/Unicode behavior is verified by the retained MySQL smoke. */
function matches(query:StorySearchOptions):StorySearchMatch[]{
    if(!query.q||query.status&&query.status!=='draft'||query.partId)return []
    const pattern=new RegExp(query.q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),query.caseSensitive?'gu':'giu')
    return scenes.filter((scene)=>(!query.sceneId||query.sceneId===scene.id)&&(!query.chapterId||query.chapterId===scene.chapterId)).flatMap((scene)=>{
        const text=documentText(scene.document)
        return [...text.matchAll(pattern)].map((match)=>({sceneId:scene.id,chapterId:scene.chapterId,partId:null,title:scene.title,chapterTitle:'Chapter 1',partTitle:null,
            chapterMetadataRevision:1,partMetadataRevision:null,revision:1,metadataRevision:1,contentHash:scene.contentHash,status:'draft' as const,archived:false,readOnly:false,
            position:Array.from(text.slice(0,match.index)).length+1,startOffset:match.index,endOffset:match.index+match[0].length,quote:match[0],
            before:text.slice(Math.max(0,match.index-80),match.index),after:text.slice(match.index+match[0].length,match.index+match[0].length+80),beforeCut:match.index>80,afterCut:match.index+match[0].length+80<text.length}))
    })
}
function SearchRoom(){
    const [open,setOpen]=useState(false),[sceneId,setSceneId]=useState(scenes[0].id),[target,setTarget]=useState<ManuscriptSearchTarget|null>(null),[message,setMessage]=useState(''),[review,setReview]=useState(false)
    const [documents,setDocuments]=useState<Record<string,StoryManuscriptDocument>>(()=>Object.fromEntries(scenes.map((scene)=>[scene.id,scene.document])))
    const editor=useRef<NovelEditorHandle|null>(null),scene=scenes.find((scene)=>scene.id===sceneId)!
    const source=useMemo<ManuscriptSearchSource>(()=>({key:'controlled-search',storyId:story.id,isCurrent:()=>true,
        search:async(query)=>{const items=matches(query);return searchPage({items,scenesSearched:2,matchingScenes:new Set(items.map((match)=>match.sceneId)).size})},
        resolve:async(query)=>{
            const match=matches(query).find((match)=>match.sceneId===query.target.sceneId&&match.position===query.target.position)!
            const scene=searchSceneProjection(scenes.find((scene)=>scene.id===match.sceneId)!)
            return searchResult({match,scene}) as StorySearchResult
        }}),[])
    return <div className="novel-reading-room flex h-screen flex-col">
        <NovelStudioHeader story={story} chapterTitle={scene.title} focusMode={false} codexOpen={false} typewriter={false}
            onToggleFocusMode={()=>{}} onToggleCodex={()=>{}} onToggleTypewriter={()=>{}} onOpenHistory={()=>{}} onOpenFind={()=>editor.current?.openFind()}
            onOpenSearch={()=>setOpen(true)} onBack={()=>{}} onEditDetails={()=>{}}/>
        <div className="space-y-2 p-3"><Button onClick={()=>setOpen(true)}>Search manuscript</Button><SwitchRow label="Simulate unresolved AI review" checked={review} onChange={setReview}/>
            <p className="text-caption text-parchment-400">Controlled saved ASCII fixture. Search for “gate”, then open the last result. Local edits remain in this preview; no project or provider requests run.</p>
            {message&&<Callout role="status">{message}</Callout>}</div>
        <section className="novel-reading-surface flex min-h-0 flex-1 flex-col"><h1 className="mx-auto w-full max-w-[var(--width-manuscript)] px-7 py-4 font-display text-h3">{scene.title}</h1>
            <NovelEditor key={scene.id} ref={editor} initialDocument={documents[scene.id]} codexEntries={[]} searchTarget={target}
                onSearchReveal={(_token,applied)=>{setMessage(applied?'Saved passage opened with a collapsed cursor.':'The local document changed; the result was not opened.');setTarget(null)}}
                onDocumentChange={(document)=>setDocuments((current)=>({...current,[scene.id]:document}))} onRequestSaveFlush={async()=>true}
                onGenerate={async()=>{throw new Error('No provider in this preview')}} onAcceptGeneration={async()=>{}} onDiscardGeneration={async()=>{}} onCritiqueResult={()=>{}}/>
        </section>
        <NovelManuscriptSearch open={open} onClose={()=>setOpen(false)} story={story} source={source}
            beforeNavigate={async()=>!review&&documentSignature(documents[sceneId])===documentSignature(scene.document)}
            onNavigate={(result)=>{setSceneId(result.scene.id);setTarget({document:result.scene.document,startOffset:result.match.startOffset,endOffset:result.match.endOffset,quote:result.match.quote,token:makeRequestId('search-preview')});return true}}/>
    </div>
}
function Preview(){return <AuthContext.Provider value={auth}><FloatingWindowsProvider><SearchRoom/></FloatingWindowsProvider></AuthContext.Provider>}
const meta={title:'Novel/Manuscript search',component:Preview,tags:['autodocs'],parameters:{layout:'fullscreen',docs:{description:{component:'Controlled saved ASCII excerpts around the actual manuscript search drawer, header and editor. Demonstrates result location, collapsed-cursor highlighting and blocked review/draft navigation. Native ICU and source-snapshot correctness are covered separately by real MySQL tests.'}}}} satisfies Meta<typeof Preview>
export default meta
type Story=StoryObj<typeof meta>
export const SavedResultNavigation:Story={}
