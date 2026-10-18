import type { ReadingScope } from '../hooks/useManuscriptReading'
import { isManuscriptReadingScope } from '../hooks/useManuscriptReading'
import type { StoryReadingPage } from '@/shared/types/storyReading.types'
import { canonicalJson } from '@/utils/json'

export interface ReaderPosition {
    schemaVersion:1;scope:ReadingScope;sceneId:string;contentHash:string;nodeId:string|null
    blockOffset:number;blockHeight:number;width:number;appearance:string
}
const number=(v:unknown,min:number,max:number):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max
const record=(v:unknown):v is Record<string,unknown>=>Boolean(v&&typeof v==='object'&&!Array.isArray(v))
export function isReaderPosition(value:unknown):value is ReaderPosition {
    if(!record(value)||Object.keys(value).length!==9)return false
    return value.schemaVersion===1&&isManuscriptReadingScope(value.scope)&&typeof value.sceneId==='string'&&/^[A-Za-z0-9._:-]{1,64}$/.test(value.sceneId)
        &&typeof value.contentHash==='string'&&/^[a-f0-9]{64}$/.test(value.contentHash)&&(value.nodeId===null||typeof value.nodeId==='string'&&value.nodeId.length>0&&value.nodeId.length<=64)
        &&number(value.blockOffset,0,1_000_000_000)&&number(value.blockHeight,1,1_000_000_000)&&value.blockOffset<=value.blockHeight
        &&number(value.width,1,100_000)&&typeof value.appearance==='string'&&value.appearance.length<=512
}
export function readReaderPosition(key:string|null,scope:ReadingScope):{position:ReaderPosition|null;unavailable:boolean}{
    if(!key)return {position:null,unavailable:false}
    try{
        const raw=localStorage.getItem(key),value:unknown=raw&&raw.length<=2048?JSON.parse(raw):null
        return {position:isReaderPosition(value)&&canonicalJson(value.scope)===canonicalJson(scope)?value:null,unavailable:false}
    }catch{return {position:null,unavailable:true}}
}
export function captureReaderPosition(root:HTMLElement,contents:HTMLElement,pages:StoryReadingPage[],scope:ReadingScope,appearance:string):ReaderPosition|null {
    const top=root.getBoundingClientRect().top,bottom=root.getBoundingClientRect().bottom
    const sceneElement=Array.from(contents.querySelectorAll<HTMLElement>('[data-reader-scene-id]')).find((scene)=>{const r=scene.getBoundingClientRect();return r.bottom>top&&r.top<bottom&&r.height>0})
    if(!sceneElement)return null
    const blocks=sceneElement.querySelectorAll<HTMLElement>('[data-manuscript-node-id]')
    // Text blocks are in ordinary single-column flow. Locate the first visible
    // block without measuring every earlier paragraph on every scroll frame.
    let low=0,high=blocks.length
    while(low<high){const mid=(low+high)>>>1;if(blocks[mid].getBoundingClientRect().bottom<=top)low=mid+1;else high=mid}
    const candidate=blocks[low],element=candidate&&candidate.getBoundingClientRect().top<bottom?candidate:sceneElement
    const sceneId=sceneElement.dataset.readerSceneId
    const scene=pages.flatMap((page)=>page.items).find((item)=>item.header.sceneId===sceneId)
    if(!scene||!sceneId)return null
    const rect=element.getBoundingClientRect()
    const value:ReaderPosition={schemaVersion:1,scope:{...scope},sceneId,contentHash:scene.header.contentHash,nodeId:element.dataset.manuscriptNodeId??null,
        blockOffset:element===sceneElement?0:Math.max(0,Math.min(rect.height,top-rect.top)),blockHeight:rect.height,width:root.getBoundingClientRect().width,appearance}
    return isReaderPosition(value)?value:null
}
export function restoreReaderPosition(root:HTMLElement,contents:HTMLElement,pages:StoryReadingPage[],position:ReaderPosition,appearance:string):'restored'|'changed' {
    const item=pages.flatMap((page)=>page.items).find((item)=>item.header.sceneId===position.sceneId)
    if(!item||item.header.contentHash!==position.contentHash)return 'changed'
    const scene=Array.from(contents.querySelectorAll<HTMLElement>('[data-reader-scene-id]')).find((node)=>node.dataset.readerSceneId===position.sceneId)
    const element=position.nodeId===null?scene:scene&&Array.from(scene.querySelectorAll<HTMLElement>('[data-manuscript-node-id]')).find((node)=>node.dataset.manuscriptNodeId===position.nodeId)
    if(!element)return 'changed'
    const rect=element.getBoundingClientRect(),bounds=root.getBoundingClientRect()
    if(rect.height<=0||bounds.width<=0)return 'changed'
    const sameLayout=appearance===position.appearance&&Math.abs(bounds.width-position.width)<1&&Math.abs(rect.height-position.blockHeight)<1
    const offset=sameLayout?Math.min(position.blockOffset,rect.height):Math.min(rect.height,position.blockOffset/position.blockHeight*rect.height)
    root.scrollTop=Math.max(0,root.scrollTop+rect.top-bounds.top+offset)
    return 'restored'
}
