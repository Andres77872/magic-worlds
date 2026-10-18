import {expect,it} from 'vitest'
import {confirmedGenerationApplicationRejection} from './generationApplication'

it('requires both the receipt-first domain error and its expected status before declaring an application rejected',()=>{
    expect(confirmedGenerationApplicationRejection({status:409,code:'STORY_ASSISTANT_SOURCE_CHANGED'})).toBe('sources_changed')
    expect(confirmedGenerationApplicationRejection({status:404,code:'STORY_GENERATION_NOT_FOUND'})).toBe('unavailable')
    for(const status of [401,403,404,408,429,500,502])expect(confirmedGenerationApplicationRejection({status,code:'STORY_ASSISTANT_SOURCE_CHANGED'})).toBeNull()
    for(const code of ['WORKSPACE_FORBIDDEN','WORKSPACE_ARCHIVED','VALIDATION_ERROR','UNKNOWN'])expect(confirmedGenerationApplicationRejection({status:409,code})).toBeNull()
})
it.each(['STORY_VARIANT_BASE_CHANGED','STORY_VARIANT_TARGET_CHANGED','STORY_VARIANT_PARENT_CHANGED',
    'STORY_VARIANT_DECISION_CHANGED','STORY_VARIANT_REVIEW_CHANGED','STORY_VARIANT_DOCUMENT_CHANGED','STORY_VARIANT_MAPPING_CHANGED','STORY_VARIANT_TARGET_UNAVAILABLE'])(
    'classifies %s only after its receipt-first conflict status',code=>{
        expect(confirmedGenerationApplicationRejection({status:409,code})).not.toBeNull()
        for(const status of [401,403,404,422,500,502])expect(confirmedGenerationApplicationRejection({status,code})).toBeNull()
    })
it('does not confuse a missing version with a pre-receipt permission/validation failure',()=>{
    expect(confirmedGenerationApplicationRejection({status:404,code:'STORY_VARIANT_NOT_FOUND'})).toBe('unavailable')
    for(const code of ['STORY_VARIANT_RECORD_INVALID','STORY_VARIANT_REQUEST_INVALID','story_variant_contract'])
        expect(confirmedGenerationApplicationRejection({status:422,code})).toBeNull()
})
