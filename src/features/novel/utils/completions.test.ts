import { expect,it } from 'vitest'
import { DEFAULT_COMPLETIONS,completionInstruction,isCompletionPreferences } from './completions'

it('keeps completions off by default and accepts only the two known lengths',()=>{
    expect(DEFAULT_COMPLETIONS).toEqual({enabled:false,length:'sentence'})
    expect(isCompletionPreferences({enabled:true,length:'paragraph'})).toBe(true)
    for(const value of [null,[],{enabled:true},{enabled:'yes',length:'sentence'},{enabled:true,length:'scene'},{enabled:true,length:'sentence',extra:1}])
        expect(isCompletionPreferences(value)).toBe(false)
    expect(completionInstruction('sentence')).toBe('Write one or two sentences that continue from the cursor.')
    expect(completionInstruction('paragraph')).toBe('Write about one paragraph that continues from the cursor.')
})
