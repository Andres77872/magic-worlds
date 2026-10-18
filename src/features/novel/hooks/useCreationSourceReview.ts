import { useEffect,useLayoutEffect,useRef,useState } from 'react'
import type { ApiService } from '@/infrastructure/api'
import type { StoryApprovedMaterial,StoryCreationSourcesPreview,StoryCreationSourcesSelection,StorySourceInput } from '@/shared'
import { isCreationSourcesSelection,verifyCreationSourcesPreview } from '@/infrastructure/api/storyCreationSourcesContract'
import { canonicalJson } from '@/utils/json'

export type CreationSourceApi=Pick<ApiService,'previewStoryCreationSources'>
type SelectedCard=NonNullable<StoryCreationSourcesSelection['cardRefs']>[number]&{label:string}
export function useCreationSourceReview(source:StorySourceInput,api:CreationSourceApi|undefined,initial?:StoryCreationSourcesSelection){
    const [cards,setCards]=useState<SelectedCard[]>(()=>structuredClone(initial?.cardRefs??[]).map((ref)=>({...ref,label:ref.snapshot?.name||ref.snapshot?.alias||''})))
    const [materials,setMaterials]=useState<StoryApprovedMaterial[]>(()=>structuredClone(initial?.approvedMaterials??[]))
    const [review,setReview]=useState<{signature:string;api:CreationSourceApi;value:StoryCreationSourcesPreview;approved:boolean}|null>(null)
    const [pending,setPending]=useState<{signature:string;api:CreationSourceApi}|null>(null)
    const [failure,setFailure]=useState<{signature:string;api:CreationSourceApi|undefined;reason:'failed'|'changed'}|null>(null)
    const selection:StoryCreationSourcesSelection={source,...(cards.length?{cardRefs:cards.map((card)=>{const ref={...card};delete (ref as Partial<SelectedCard>).label;return ref})}:{}),...(materials.length?{approvedMaterials:materials}:{})}
    const signature=canonicalJson(selection),hasSources=source.kind!=='blank'||cards.length>0||materials.length>0
    const live=useRef({signature,api}),mounted=useRef(false),sequence=useRef(0)
    useLayoutEffect(()=>{live.current={signature,api}},[signature,api])
    useEffect(()=>{mounted.current=true;return()=>{mounted.current=false}},[])
    const current=review?.signature===signature&&review.api===api?review:null
    const busy=pending?.signature===signature&&pending.api===api
    async function refresh(){
        if(!api||!isCreationSourcesSelection(selection)||busy)return
        const request=++sequence.current,original=structuredClone(selection)
        setPending({signature,api});setFailure(null)
        try{
            const value=await api.previewStoryCreationSources(original)
            if(!mounted.current||request!==sequence.current||live.current.signature!==signature||live.current.api!==api)return
            if(!verifyCreationSourcesPreview(value,original))throw new Error('Invalid source review')
            setReview({signature,api,value,approved:false})
        }catch{
            if(mounted.current&&request===sequence.current&&live.current.signature===signature&&live.current.api===api){setFailure({signature,api,reason:'failed'});setReview(null)}
        }finally{if(mounted.current&&request===sequence.current)setPending(null)}
    }
    function reset(){sequence.current++;setCards([]);setMaterials([]);setReview(null);setPending(null);setFailure(null)}
    return {cards,setCards,materials,setMaterials,selection,signature,hasSources,current,available:Boolean(api),
        valid:isCreationSourcesSelection(selection),busy,failure:failure?.signature===signature&&failure.api===api?failure.reason:null,refresh,reset,
        canCreate:!hasSources||Boolean(current?.approved),
        approve:(approved:boolean)=>setReview((value)=>value?.signature===signature&&value.api===api?{...value,approved}:value),
        changed:()=>{sequence.current++;setReview(null);setPending(null);setFailure({signature,api,reason:'changed'})},
    }
}
export type CreationSourceReview=ReturnType<typeof useCreationSourceReview>
