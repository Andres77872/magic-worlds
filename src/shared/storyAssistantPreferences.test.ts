import { expect,it } from 'vitest'
import { DEFAULT_PREFERENCES,isAssistantPreferences,isAssistantPreferencesState } from './storyAssistantPreferences'

const saved={length:'brief',format:'lists',tone:'direct',replyLanguage:'novel',note:'Call me Sam. 🙂'} as const

it('accepts exactly the preference object the BFF accepts, counting the note by code point',()=>{
    expect(isAssistantPreferences(saved)).toBe(true);expect(isAssistantPreferences(DEFAULT_PREFERENCES)).toBe(true)
    expect(isAssistantPreferences({...saved,note:'🙂'.repeat(500)})).toBe(true)
    for(const bad of [{...saved,note:'🙂'.repeat(501)},{...saved,tone:'rude'},{...saved,extra:1},{length:'brief',format:'lists',tone:'direct',replyLanguage:'novel'},{...saved,note:null},null,[]])
        expect(isAssistantPreferences(bad)).toBe(false)
})

it('reads a saved state only with a positive version, and none only at version 0',()=>{
    expect(isAssistantPreferencesState({schemaVersion:1,preferences:null,version:0})).toBe(true)
    expect(isAssistantPreferencesState({schemaVersion:1,preferences:saved,version:3})).toBe(true)
    for(const bad of [{schemaVersion:1,preferences:null,version:2},{schemaVersion:1,preferences:saved,version:0},{schemaVersion:2,preferences:null,version:0},
        {schemaVersion:1,preferences:{...saved,length:'long'},version:1},{schemaVersion:1,preferences:null,version:-1},{schemaVersion:1,preferences:null,version:0,extra:true}])
        expect(isAssistantPreferencesState(bad)).toBe(false)
})
