import type { StoryOutline,StorySceneOutline,StoryUnitMetadata } from './types'

const ordered=(a:StoryUnitMetadata,b:StoryUnitMetadata)=>{
    if(a.order!==b.order)return a.order-b.order
    const first=Array.from(a.id),second=Array.from(b.id)
    for(let index=0;index<Math.min(first.length,second.length);index++){const difference=first[index].codePointAt(0)!-second[index].codePointAt(0)!;if(difference)return difference}
    return first.length-second.length
}
function chapters(story:StoryOutline){
    const parts=[...story.parts].sort(ordered),order=new Map(parts.map((part,index)=>[part.id,index+1]))
    const hidden=new Set(parts.filter((part)=>part.trashedAt).map((part)=>part.id))
    return story.chapters.filter((chapter)=>!chapter.trashedAt&&!hidden.has(chapter.partId??''))
        .sort((a,b)=>(order.get(a.partId??'')??0)-(order.get(b.partId??'')??0)||ordered(a,b))
}
const first=(items:StorySceneOutline[])=>items.filter((scene)=>!scene.trashedAt).sort(ordered)[0]??null
export function sceneForStudioUnit(story:StoryOutline,id:string):{found:boolean;scene:StorySceneOutline|null} {
    const all=chapters(story),chapter=all.find((chapter)=>chapter.id===id)
    if(chapter)return {found:true,scene:first(chapter.scenes)}
    const part=story.parts.find((part)=>part.id===id&&!part.trashedAt)
    if(part){
        for(const child of all.filter((chapter)=>chapter.partId===part.id)){const scene=first(child.scenes);if(scene)return {found:true,scene}}
        return {found:true,scene:null}
    }
    for(const chapter of all){const scene=chapter.scenes.find((scene)=>scene.id===id&&!scene.trashedAt);if(scene)return {found:true,scene}}
    return {found:false,scene:null}
}
export function initialStudioScene(story:StoryOutline,id:string|null):StorySceneOutline|null {
    if(id){const selected=sceneForStudioUnit(story,id);if(selected.found)return selected.scene}
    for(const chapter of chapters(story)){const scene=first(chapter.scenes);if(scene)return scene}
    return null
}
