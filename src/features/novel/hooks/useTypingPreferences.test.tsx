import { act,renderHook } from '@testing-library/react'
import { afterEach,beforeEach,expect,it,vi } from 'vitest'
import { DEFAULT_TYPING,PLAIN_TYPING,isTypingPreferences,typingQuoteStyle } from '../utils/typingPreferences'
import { useTypingPreferences } from './useTypingPreferences'
beforeEach(()=>{localStorage.clear()});afterEach(()=>vi.restoreAllMocks())
it('retains settings in the supplied novel scope without touching reading preferences or prose',()=>{
    localStorage.setItem('one:reading','reading preferences')
    const view=renderHook(()=>useTypingPreferences('one'));act(()=>view.result.current.setPreferences(PLAIN_TYPING));view.unmount()
    const next=renderHook(()=>useTypingPreferences('one'));expect(next.result.current.preferences).toEqual(PLAIN_TYPING)
    expect(localStorage.getItem('one:reading')).toBe('reading preferences')
    expect(Object.keys(JSON.parse(localStorage.getItem('one:typing')!)).sort()).toEqual(['punctuation','quotes','schemaVersion','symbols'])
})
it('rejects invalid/oversized/future values and leaves their stored source untouched',()=>{
    for(const raw of ['{',JSON.stringify({schemaVersion:2,...PLAIN_TYPING}),JSON.stringify({schemaVersion:1,...PLAIN_TYPING,quotes:['curly']}),'x'.repeat(2049)]){
        localStorage.setItem('one:typing',raw);const view=renderHook(()=>useTypingPreferences('one'))
        expect(view.result.current.preferences).toEqual(DEFAULT_TYPING);expect(localStorage.getItem('one:typing')).toBe(raw);view.unmount()
    }
    expect(isTypingPreferences({...DEFAULT_TYPING,symbols:1})).toBe(false)
})
it('retires old scope and unmounted setters and keeps unavailable storage choices usable',()=>{
    const view=renderHook(({key})=>useTypingPreferences(key),{initialProps:{key:'old'}}),old=view.result.current.setPreferences
    view.rerender({key:'new'});act(()=>old(PLAIN_TYPING));expect(localStorage.getItem('old:typing')).toBeNull();expect(view.result.current.preferences).toEqual(DEFAULT_TYPING)
    vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new Error('quota')})
    act(()=>view.result.current.setPreferences(PLAIN_TYPING));expect(view.result.current.preferences).toEqual(PLAIN_TYPING);expect(view.result.current.storageUnavailable).toBe(true)
    const retired=view.result.current.setPreferences;view.unmount();act(()=>retired(DEFAULT_TYPING))
})
it('uses only recognized manuscript language aliases and honors explicit author styles',()=>{
    for(const language of ['es','es-MX','es_ES','Español','Spanish','Castellano'])expect(typingQuoteStyle(DEFAULT_TYPING,language)).toBe('angle')
    for(const language of ['en','English','French','',null])expect(typingQuoteStyle(DEFAULT_TYPING,language)).toBe('curly')
    expect(typingQuoteStyle({...DEFAULT_TYPING,quotes:'straight'},'es')).toBe('straight')
})
