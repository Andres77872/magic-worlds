import { isRecord } from '@/shared/novelMutationJournal'
import type { StoryVariantReference } from '@/shared/types/storyVariant.types'

/** Kept separate from full snapshot parsing to avoid recursive source contracts. */
export function isStoryVariantReference(v:unknown):v is StoryVariantReference {
    return isRecord(v)&&Object.keys(v).length===2&&typeof v.id==='string'&&Boolean(v.id)&&v.id===v.id.trim()
        &&Array.from(v.id).length<=64&&!/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(v.id)
        &&typeof v.variantHash==='string'&&/^[a-f0-9]{64}$/.test(v.variantHash)
}
