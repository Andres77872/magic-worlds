/** The account's assistant reply preferences (A25), with the same exact rules as the BFF. */
import { isRecord } from './novelMutationJournal'
import type { StoryAssistantPreferences,StoryAssistantPreferencesState } from './types/storyAssistant.types'

export const PREFERENCE_CHOICES={length:['brief','balanced','detailed'],format:['any','prose','lists'],tone:['neutral','direct','encouraging'],replyLanguage:['question','novel']} as const
export const PREFERENCE_NOTE=500
/** What the assistant does without saved preferences; the form starts here. */
export const DEFAULT_PREFERENCES:StoryAssistantPreferences={length:'balanced',format:'any',tone:'neutral',replyLanguage:'question',note:''}
const KEYS=[...Object.keys(PREFERENCE_CHOICES),'note']

/** Python counts code points; the note stays within the same limit. */
export function isAssistantPreferences(v:unknown):v is StoryAssistantPreferences {
    return isRecord(v)&&Object.keys(v).length===KEYS.length&&KEYS.every((key)=>key in v)
        &&(Object.keys(PREFERENCE_CHOICES) as Array<keyof typeof PREFERENCE_CHOICES>).every((key)=>(PREFERENCE_CHOICES[key] as readonly unknown[]).includes(v[key]))
        &&typeof v.note==='string'&&Array.from(v.note).length<=PREFERENCE_NOTE
}

export function isAssistantPreferencesState(v:unknown):v is StoryAssistantPreferencesState {
    return isRecord(v)&&Object.keys(v).length===3&&v.schemaVersion===1&&Number.isSafeInteger(v.version)&&Number(v.version)>=0
        &&(v.preferences===null?v.version===0:Number(v.version)>0&&isAssistantPreferences(v.preferences))
}
