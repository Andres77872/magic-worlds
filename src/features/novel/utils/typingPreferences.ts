export interface TypingPreferences {quotes:'manuscript'|'curly'|'angle'|'straight';punctuation:boolean;symbols:boolean}
export const DEFAULT_TYPING:TypingPreferences=Object.freeze({quotes:'manuscript',punctuation:true,symbols:true})
export const PLAIN_TYPING:TypingPreferences=Object.freeze({quotes:'straight',punctuation:false,symbols:false})
export function isTypingPreferences(value:unknown):value is TypingPreferences {
    if(!value||typeof value!=='object'||Array.isArray(value))return false
    const v=value as Record<string,unknown>
    return Object.keys(v).length===3&&typeof v.quotes==='string'&&['manuscript','curly','angle','straight'].includes(v.quotes)&&typeof v.punctuation==='boolean'&&typeof v.symbols==='boolean'
}
export function typingQuoteStyle(preferences:TypingPreferences,language:string|null|undefined):'curly'|'angle'|'straight'{
    if(preferences.quotes!=='manuscript')return preferences.quotes
    return /^(?:es(?:[-_][a-z0-9]{2,8})*|español|espanol|spanish|castellano)$/.test(language?.trim().toLowerCase()??'')?'angle':'curly'
}
