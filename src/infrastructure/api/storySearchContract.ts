import type { StorySearchEnvelope,StorySearchMatch,StorySearchPage,StorySearchRequest,StorySearchResolve,StorySearchResult } from '@/shared/types/storySearch.types'
import { verifyStoryScene } from './storyContract'
import { documentText } from '@/shared/storyDocument'

const record=(v:unknown):v is Record<string,unknown>=>Boolean(v&&typeof v==='object'&&!Array.isArray(v))
const integer=(v:unknown,min=0,max=Number.MAX_SAFE_INTEGER):v is number=>Number.isSafeInteger(v)&&Number(v)>=min&&Number(v)<=max
const text=(v:unknown,min:number,max:number):v is string=>typeof v==='string'&&Array.from(v).length>=min&&Array.from(v).length<=max&&Array.from(v).every((c)=>c.length!==1||c.charCodeAt(0)<0xd800||c.charCodeAt(0)>0xdfff)
const id=(v:unknown):v is string=>typeof v==='string'&&/^[A-Za-z0-9._:-]{1,64}$/.test(v)
const hash=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v)
const revision=(v:unknown):v is number=>integer(v,1)
const statuses=['draft','revising','complete','archived']
export function verifySearchEnvelope(v:unknown,storyId:string):v is StorySearchEnvelope {
    return record(v)&&v.schemaVersion===1&&v.storyId===storyId&&v.algorithm==='mysql-icu-literal-v1'&&hash(v.sourceSnapshot)&&hash(v.queryHash)
        &&revision(v.sourceStructureRevision)&&revision(v.sourceMetadataRevision)&&revision(v.sourceContextRevision)
}
export function verifySearchMatch(v:unknown):v is StorySearchMatch {
    const fields=['sceneId','position','chapterId','partId','title','chapterTitle','partTitle','chapterMetadataRevision','partMetadataRevision','revision','metadataRevision','contentHash','status','archived','readOnly','startOffset','endOffset','quote','before','after','beforeCut','afterCut']
    return record(v)&&Object.keys(v).every((key)=>fields.includes(key))&&id(v.sceneId)&&id(v.chapterId)&&(v.partId===null||id(v.partId))&&text(v.title,1,255)&&text(v.chapterTitle,1,255)
        &&(v.partId===null?v.partTitle===null&&v.partMetadataRevision===null:text(v.partTitle,1,255)&&revision(v.partMetadataRevision))
        &&revision(v.chapterMetadataRevision)&&revision(v.revision)&&revision(v.metadataRevision)&&hash(v.contentHash)&&statuses.includes(String(v.status))
        &&typeof v.archived==='boolean'&&typeof v.readOnly==='boolean'&&(!v.archived||v.readOnly)
        &&integer(v.position,1,2_000_001)&&integer(v.startOffset,0,2_000_000)&&integer(v.endOffset,1,2_000_000)&&v.endOffset>v.startOffset
        &&text(v.quote,1,4096)&&v.quote.length===v.endOffset-v.startOffset&&text(v.before,0,80)&&text(v.after,0,80)
        &&typeof v.beforeCut==='boolean'&&typeof v.afterCut==='boolean'
}
export function verifySearchPage(v:unknown,storyId:string,request:StorySearchRequest):v is StorySearchPage {
    if(!verifySearchEnvelope(v,storyId))return false
    const page=v as unknown as Record<string,unknown>
    if(['document','body','plainText','chapters','scenes','activeCardRefs','generationHistory'].some((key)=>key in page)||!integer(page.scenesSearched)||!integer(page.matchingScenes,0,page.scenesSearched)||!Array.isArray(page.items)||page.items.length>(request.limit??20)
        ||!page.items.every(verifySearchMatch)||!(page.nextCursor===null||typeof page.nextCursor==='string'&&/^[A-Za-z0-9_-]{1,2048}$/.test(page.nextCursor))
        ||page.nextCursor!==null&&page.items.length!==(request.limit??20))return false
    const identities=new Set<string>()
    return new Set(page.items.map((item)=>item.sceneId)).size<=page.matchingScenes&&page.items.every((item)=>{
        const key=item.sceneId+':'+item.position
        if(identities.has(key)||request.sceneId&&request.sceneId!==item.sceneId||request.chapterId&&request.chapterId!==item.chapterId||request.partId&&request.partId!==item.partId
            ||request.status&&request.status!==item.status||!request.includeArchived&&item.archived||request.caseSensitive&&item.quote!==request.q)return false
        identities.add(key);return true
    })
}
export function verifySearchResult(v:unknown,storyId:string,request:StorySearchResolve):v is StorySearchResult {
    if(!verifySearchEnvelope(v,storyId)||v.sourceSnapshot!==request.sourceSnapshot)return false
    const result=v as unknown as Record<string,unknown>,scene=result.scene,match=result.match
    if(result.projection!=='scene_document'||!record(scene)||'activeCardRefs' in scene||'generationHistory' in scene||!verifySearchMatch(match)
        ||!verifyStoryScene({...scene,activeCardRefs:[],generationHistory:[]},storyId,request.target.sceneId)||!record(scene.inheritance))return false
    if(match.sceneId!==request.target.sceneId||match.position!==request.target.position||scene.chapterId!==match.chapterId||scene.revision!==match.revision
        ||scene.metadataRevision!==match.metadataRevision||scene.contentHash!==match.contentHash||scene.trashedAt!==null||scene.title!==match.title
        ||!verifySearchPage({...v,items:[match],scenesSearched:1,matchingScenes:1,nextCursor:null},storyId,{...request,limit:1}))return false
    const plain=documentText(scene.document as StorySearchResult['scene']['document'])
    return plain.slice(match.startOffset,match.endOffset)===match.quote&&Array.from(plain.slice(0,match.startOffset)).length+1===match.position
        &&(scene.inheritance.readOnly!==true||match.readOnly)
}
export function sameSearchMatch(a:StorySearchMatch,b:StorySearchMatch):boolean {
    return (['sceneId','chapterId','partId','revision','metadataRevision','chapterMetadataRevision','partMetadataRevision','contentHash','position','startOffset','endOffset','quote','status','archived','readOnly'] as const).every((key)=>a[key]===b[key])
}
