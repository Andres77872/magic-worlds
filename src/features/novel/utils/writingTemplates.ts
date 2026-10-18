import type { StoryTemplateUnit,StoryWritingTemplate } from '@/shared'

export type WritingPreset='short_story'|'three_acts'|'custom'
export type TemplateSelection={kind:'part';index:number}|{kind:'chapter';index:number}|{kind:'scene';chapterIndex:number;index:number}
type Copy=(key:string)=>string
export function writingTemplate(preset:WritingPreset,copy:Copy):StoryWritingTemplate {
    const scene=(key:string):StoryTemplateUnit=>({title:copy(key),details:{synopsis:copy(key+'Plan')}})
    const base={schemaVersion:1 as const,key:preset,version:1,name:copy(preset),defaults:{language:copy('defaultLanguage'),narrator:copy('defaultNarrator'),tense:copy('defaultTense'),styleGuide:''}}
    if(preset==='three_acts')return {...base,
        parts:['setup','confrontation','resolution'].map((key)=>({title:copy(key)})),
        chapters:[
            {title:copy('openingChapter'),partIndex:0,scenes:[scene('opening')]},
            {title:copy('middleChapter'),partIndex:1,scenes:[scene('turningPoint'),scene('crisis')]},
            {title:copy('endingChapter'),partIndex:2,scenes:[scene('ending')]},
        ]}
    return {...base,parts:[],chapters:[{title:copy('openingChapter'),partIndex:null,
        scenes:preset==='custom'?[{title:copy('opening')}]:[scene('opening'),scene('turningPoint'),scene('ending')]}]}
}
export const templateCounts=(value:StoryWritingTemplate)=>({parts:value.parts?.length??0,chapters:value.chapters.length,scenes:value.chapters.reduce((total,chapter)=>total+chapter.scenes.length,0)})
export function selectedTemplateUnit(value:StoryWritingTemplate,selection:TemplateSelection):StoryTemplateUnit|undefined {
    return selection.kind==='part'?value.parts?.[selection.index]:selection.kind==='chapter'?value.chapters[selection.index]:value.chapters[selection.chapterIndex]?.scenes[selection.index]
}
export function editTemplateUnit(value:StoryWritingTemplate,selection:TemplateSelection,patch:Partial<StoryTemplateUnit>):StoryWritingTemplate {
    if(selection.kind==='part')return {...value,parts:value.parts?.map((part,index)=>index===selection.index?{...part,...patch}:part)}
    return {...value,chapters:value.chapters.map((chapter,index)=>selection.kind==='chapter'
        ?index===selection.index?{...chapter,...patch}:chapter
        :index===selection.chapterIndex?{...chapter,scenes:chapter.scenes.map((scene,sceneIndex)=>sceneIndex===selection.index?{...scene,...patch}:scene)}:chapter)}
}
export function moveTemplateUnit(value:StoryWritingTemplate,selection:TemplateSelection,direction:-1|1):{value:StoryWritingTemplate;selection:TemplateSelection} {
    const indexes=selection.kind==='part'?(value.parts??[]).map((_,index)=>index):selection.kind==='scene'?value.chapters[selection.chapterIndex].scenes.map((_,index)=>index)
        :value.chapters.flatMap((chapter,index)=>(chapter.partIndex??null)===(value.chapters[selection.index].partIndex??null)?[index]:[])
    const position=indexes.indexOf(selection.index),other=indexes[position+direction]
    if(position<0||other===undefined)return {value,selection}
    const swap=<T,>(items:T[])=>items.map((item,index)=>index===selection.index?items[other]:index===other?items[selection.index]:item)
    const next=selection.kind==='part'?{...value,parts:swap(value.parts??[]),chapters:value.chapters.map((chapter)=>({...chapter,
        partIndex:chapter.partIndex===selection.index?other:chapter.partIndex===other?selection.index:chapter.partIndex}))}
        :selection.kind==='chapter'?{...value,chapters:swap(value.chapters)}:{...value,chapters:value.chapters.map((chapter,index)=>index===selection.chapterIndex?{...chapter,scenes:swap(chapter.scenes)}:chapter)}
    return {value:next,selection:{...selection,index:other}}
}
export function removeTemplateUnit(value:StoryWritingTemplate,selection:TemplateSelection):{value:StoryWritingTemplate;selection:TemplateSelection} {
    if(selection.kind==='part')return {value:{...value,parts:value.parts?.filter((_,index)=>index!==selection.index),chapters:value.chapters.map((chapter)=>({...chapter,
        partIndex:chapter.partIndex===selection.index?null:chapter.partIndex!=null&&chapter.partIndex>selection.index?chapter.partIndex-1:chapter.partIndex}))},selection:{kind:'chapter',index:0}}
    if(selection.kind==='chapter')return value.chapters.length<=1?{value,selection}:{value:{...value,chapters:value.chapters.filter((_,index)=>index!==selection.index)},selection:{kind:'chapter',index:Math.max(0,selection.index-1)}}
    const chapter=value.chapters[selection.chapterIndex]
    return chapter.scenes.length<=1?{value,selection}:{value:{...value,chapters:value.chapters.map((item,index)=>index===selection.chapterIndex?{...item,scenes:item.scenes.filter((_,index)=>index!==selection.index)}:item)},selection:{...selection,index:Math.max(0,selection.index-1)}}
}
export function templateRows(value:StoryWritingTemplate):Array<{selection:TemplateSelection;title:string;depth:number}> {
    const rows:Array<{selection:TemplateSelection;title:string;depth:number}>=[]
    const groups=new Map<number|null,Array<{chapter:StoryWritingTemplate['chapters'][number];index:number}>>()
    value.chapters.forEach((chapter,index)=>{const parent=chapter.partIndex??null;const group=groups.get(parent)??[];group.push({chapter,index});groups.set(parent,group)})
    function chapters(partIndex:number|null){
        for(const {chapter,index} of groups.get(partIndex)??[]){
            const depth=partIndex===null?0:1
            rows.push({selection:{kind:'chapter',index},title:chapter.title,depth})
            chapter.scenes.forEach((scene,sceneIndex)=>rows.push({selection:{kind:'scene',chapterIndex:index,index:sceneIndex},title:scene.title,depth:depth+1}))
        }
    }
    chapters(null)
    value.parts?.forEach((part,index)=>{rows.push({selection:{kind:'part',index},title:part.title,depth:0});chapters(index)})
    return rows
}
