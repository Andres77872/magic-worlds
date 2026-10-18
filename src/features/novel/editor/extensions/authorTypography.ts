import { Extension,InputRule } from '@tiptap/core'
import { openDoubleQuote,closeDoubleQuote,openSingleQuote,closeSingleQuote,emDash,ellipsis,leftArrow,rightArrow,copyright,trademark,servicemark,registeredTrademark,oneHalf,plusMinus,notEqual,laquo,raquo,multiplication,superscriptTwo,superscriptThree,oneQuarter,threeQuarters } from '@tiptap/extension-typography'
import { typingQuoteStyle,type TypingPreferences } from '../../utils/typingPreferences'
const gated=(rule:InputRule,enabled:()=>boolean)=>new InputRule({find:rule.find,undoable:rule.undoable,handler:(context)=>enabled()?rule.handler(context):null})
/** Stock typing rules read current preferences; the editor instance stays alive. */
export function createAuthorTypography(preferences:()=>TypingPreferences,language:()=>string|null|undefined){
    return Extension.create({name:'authorTypography',addInputRules(){
        const quoteStyle=()=>typingQuoteStyle(preferences(),language())
        const quotes=(style:'curly'|'angle')=>[openDoubleQuote(style==='angle'?'«':'“'),closeDoubleQuote(style==='angle'?'»':'”'),openSingleQuote(),closeSingleQuote()].map((rule)=>gated(rule,()=>quoteStyle()===style))
        return [
            ...[emDash(),ellipsis()].map((rule)=>gated(rule,()=>preferences().punctuation)),...quotes('curly'),...quotes('angle'),
            ...[leftArrow(),rightArrow(),copyright(),trademark(),servicemark(),registeredTrademark(),oneHalf(),plusMinus(),notEqual(),laquo(),raquo(),multiplication(),superscriptTwo(),superscriptThree(),oneQuarter(),threeQuarters()].map((rule)=>gated(rule,()=>preferences().symbols)),
        ]
    }})
}
