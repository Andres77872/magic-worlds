import { act,renderHook } from '@testing-library/react'
import { beforeEach,expect,it,vi } from 'vitest'
import { useOutlineView } from './useOutlineView'

beforeEach(()=>{localStorage.clear();vi.restoreAllMocks()})
it('retains the view across reopening and separates owner/novel scopes without rewriting scene selection',()=>{
    localStorage.setItem('owner-one-story-one',JSON.stringify({sceneId:'retained-scene'}))
    const view=renderHook(({scope})=>useOutlineView(scope),{initialProps:{scope:'owner-one-story-one'}})
    act(()=>view.result.current.setOutlineView({numbers:false,details:true}))
    const old=view.result.current.setOutlineView
    view.rerender({scope:'owner-two-story-one'});expect(view.result.current.outlineView).toEqual({numbers:true,details:false})
    act(()=>old({numbers:false,details:false}));expect(view.result.current.outlineView).toEqual({numbers:true,details:false})
    view.rerender({scope:'owner-one-story-one'});expect(view.result.current.outlineView).toEqual({numbers:false,details:true})
    expect(JSON.parse(localStorage.getItem('owner-one-story-one')!)).toEqual({sceneId:'retained-scene'})
    view.unmount();expect(renderHook(()=>useOutlineView('owner-one-story-one')).result.current.outlineView).toEqual({numbers:false,details:true})
})
it('keeps in-memory controls working when optional browser storage is unavailable',()=>{
    vi.spyOn(Storage.prototype,'getItem').mockImplementation(()=>{throw new Error('Unavailable')})
    vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new Error('Unavailable')})
    const {result}=renderHook(()=>useOutlineView('private-scope'))
    act(()=>result.current.setOutlineView({numbers:true,details:true}))
    expect(result.current.outlineView).toEqual({numbers:true,details:true})
})
