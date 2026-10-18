/**
 * Completion suggestions (A27): off until the author turns them on for a novel on this device. Once on, a shortcut asks
 * the Novel writing profile to continue from the cursor; the suggestion waits in place to be accepted or declined.
 */
export type CompletionLength='sentence'|'paragraph'
export interface CompletionPreferences {enabled:boolean;length:CompletionLength}
export const DEFAULT_COMPLETIONS:Readonly<CompletionPreferences>=Object.freeze({enabled:false,length:'sentence'})
export function isCompletionPreferences(value:unknown):value is CompletionPreferences {
    if(!value||typeof value!=='object'||Array.isArray(value))return false
    const v=value as Record<string,unknown>
    return Object.keys(v).length===2&&typeof v.enabled==='boolean'&&(v.length==='sentence'||v.length==='paragraph')
}
/** Sent with the continuation. English, like the beat composer's length sentences and the rest of the server-side prompt. */
const INSTRUCTION:Record<CompletionLength,string>={
    sentence:'Write one or two sentences that continue from the cursor.',
    paragraph:'Write about one paragraph that continues from the cursor.',
}
export const completionInstruction=(length:CompletionLength)=>INSTRUCTION[length]
