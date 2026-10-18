import { act,renderHook } from '@testing-library/react'
import { afterEach,beforeEach,expect,it,vi } from 'vitest'
import { useInvisibleCharacters } from './useInvisibleCharacters'
beforeEach(()=>localStorage.clear())
afterEach(()=>vi.restoreAllMocks())
it('retains the view choice in its existing novel scope without rewriting reading or typing choices',()=>{
    localStorage.setItem('author-one:typing','retained typing data')
    const first=renderHook(()=>useInvisibleCharacters('author-one'))
    expect(first.result.current.preferences.visible).toBe(false)
    act(()=>first.result.current.setPreferences({visible:true}));first.unmount()
    const reopened=renderHook(()=>useInvisibleCharacters('author-one'))
    expect(reopened.result.current.preferences.visible).toBe(true)
    expect(localStorage.getItem('author-one:typing')).toBe('retained typing data')
})
it('refuses an old scope setter and keeps an in-memory choice when device storage fails',()=>{
    const view=renderHook(({scope})=>useInvisibleCharacters(scope),{initialProps:{scope:'author-one'}})
    const old=view.result.current.setPreferences
    view.rerender({scope:'author-two'})
    act(()=>old({visible:true}));expect(view.result.current.preferences.visible).toBe(false)
    vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new Error('Unavailable')})
    act(()=>view.result.current.setPreferences({visible:true}))
    expect(view.result.current.preferences.visible).toBe(true);expect(view.result.current.storageUnavailable).toBe(true)
})
