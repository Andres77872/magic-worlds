import type { StorySceneHeader,StoryStudioScene,StoryStudioSource } from '@/shared/types/storyStudio.types'
import { storyStudioSceneRequest,verifyStoryStudioScene } from '@/infrastructure/api/storyStudioContract'
import { canonicalJson } from '@/utils/json'

/** Confirmed reads only. Drafts/requests never enter this disposable cache. */
export class StudioSceneCache {
    private values=new Map<string,{value:StoryStudioScene;bytes:number}>()
    private bytes=0
    private readonly maxScenes:number
    private readonly maxBytes:number
    constructor(maxScenes=3,maxBytes=16*1024*1024){this.maxScenes=maxScenes;this.maxBytes=maxBytes}
    clear(){this.values.clear();this.bytes=0}
    get size(){return this.values.size}
    get byteSize(){return this.bytes}
    get(source:StoryStudioSource,head:StorySceneHeader):StoryStudioScene|null {
        const key=source.id+':'+head.id,item=this.values.get(key),request=storyStudioSceneRequest(source,head)
        if(!item||!request)return null
        if(canonicalJson(item.value.source)!==canonicalJson(request)||!verifyStoryStudioScene(item.value,source,head)){
            this.values.delete(key);this.bytes-=item.bytes;return null
        }
        this.values.delete(key);this.values.set(key,item)
        return item.value
    }
    put(source:StoryStudioSource,head:StorySceneHeader,value:StoryStudioScene){
        if(!verifyStoryStudioScene(value,source,head))return false
        const key=source.id+':'+head.id,previous=this.values.get(key)
        if(previous){this.values.delete(key);this.bytes-=previous.bytes}
        const bytes=new TextEncoder().encode(JSON.stringify(value)).byteLength
        if(bytes>this.maxBytes)return false
        this.values.set(key,{value,bytes});this.bytes+=bytes
        while(this.values.size>this.maxScenes||this.bytes>this.maxBytes){
            const oldest=this.values.keys().next().value
            if(oldest===undefined)break
            this.bytes-=this.values.get(oldest)!.bytes;this.values.delete(oldest)
        }
        return true
    }
}
