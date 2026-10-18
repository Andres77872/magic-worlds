import { isRecord } from '@/shared/novelMutationJournal'
import type { NovelGenerationReference,NovelRefinementContext,NovelRefinementReference } from '@/shared/types/storyAssistant.types'
import { isStoryVariantReference } from './storyVariantIdentityContract'

const exact=(v:Record<string,unknown>,keys:string[])=>Object.keys(v).length===keys.length&&keys.every(key=>key in v)
const scalar=(v:unknown,max:number):v is string=>typeof v==='string'&&Array.from(v).length<=max&&!/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(v)
const id=(v:unknown):v is string=>scalar(v,64)&&Boolean(v)&&v===v.trim()
const hash=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v)
const integer=(v:unknown,min:number):v is number=>Number.isSafeInteger(v)&&Number(v)>=min

export function isNovelGenerationReference(v:unknown):v is NovelGenerationReference {
    return isRecord(v)&&exact(v,['generationId','parentHash'])&&id(v.generationId)&&hash(v.parentHash)
}

export function isNovelRefinementReference(v:unknown):v is NovelRefinementReference {
    return isNovelGenerationReference(v)||isRecord(v)&&exact(v,['generationId','parentHash','variant'])
        &&id(v.generationId)&&hash(v.parentHash)&&isStoryVariantReference(v.variant)&&v.variant.id!==v.generationId
}

/** Hashes are server CAS references; the paid request rechecks the owned SQL parent. */
export function verifyNovelRefinement(v:unknown,storyId:string,sceneId?:string):v is NovelRefinementContext {
    if(!isRecord(v)||!exact(v,['schemaVersion','parent','parentHash'])||v.schemaVersion!==1||!hash(v.parentHash)||!isRecord(v.parent))return false
    const p=v.parent,r=p.range
    return exact(p,['id','storyId','chapterId','sceneId','baseRevision','command','range','output','instruction','parentGenerationId'])
        &&id(p.id)&&p.storyId===storyId&&id(p.chapterId)&&id(p.sceneId)&&(sceneId===undefined||p.sceneId===sceneId)&&integer(p.baseRevision,1)
        &&['continue','rewrite','expand','condense','describe','custom'].includes(String(p.command))
        &&scalar(p.output,128000)&&Boolean(p.output.trim())&&(p.instruction===null||scalar(p.instruction,65535))
        &&(p.parentGenerationId===null||id(p.parentGenerationId)&&p.parentGenerationId!==p.id)
        &&(r===null||isRecord(r)&&exact(r,['startOffset','endOffset','textHash'])&&integer(r.startOffset,0)&&integer(r.endOffset,Number(r.startOffset))&&hash(r.textHash))
}

export function refinementReference(v:NovelRefinementContext):NovelGenerationReference {
    return {generationId:v.parent.id,parentHash:v.parentHash}
}
