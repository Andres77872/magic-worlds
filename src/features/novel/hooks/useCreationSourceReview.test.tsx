import { act,renderHook,waitFor } from '@testing-library/react'
import { expect,it,vi } from 'vitest'
import type { StoryCreationSourcesPreview,StorySourceInput } from '@/shared'
import { creationSourcesPreview } from '@/test/fixtures/storyCreationSources'
import { useCreationSourceReview,type CreationSourceApi } from './useCreationSourceReview'
const source:StorySourceInput={kind:'world',id:'gate',title:'The gate'}
it('requires approval of the current source review and invalidates it after a selection changes',async()=>{
    const api={previewStoryCreationSources:vi.fn(async(selection)=>creationSourcesPreview(selection))} satisfies CreationSourceApi
    const view=renderHook(()=>useCreationSourceReview(source,api))
    expect(view.result.current.canCreate).toBe(false)
    await act(async()=>{await view.result.current.refresh()})
    expect(view.result.current.current?.approved).toBe(false)
    act(()=>view.result.current.approve(true));expect(view.result.current.canCreate).toBe(true)
    act(()=>view.result.current.setMaterials([{key:'passage',kind:'approved_adventure_material',title:'Arrival',text:'Mira llegó 🙂.'}]))
    expect(view.result.current.current).toBeNull();expect(view.result.current.canCreate).toBe(false)
    await act(async()=>{await view.result.current.refresh()})
    expect(view.result.current.current?.value.references[1].snapshot.description).toBe('Mira llegó 🙂.')
    act(()=>view.result.current.changed())
    expect(view.result.current.materials[0].text).toBe('Mira llegó 🙂.');expect(view.result.current.failure).toBe('changed')
})
it('ignores a late preview after the selection or scoped client changes',async()=>{
    let finish!:(value:StoryCreationSourcesPreview)=>void
    const api={previewStoryCreationSources:vi.fn(()=>new Promise<StoryCreationSourcesPreview>((resolve)=>{finish=resolve}))}
    const other={previewStoryCreationSources:vi.fn(async(selection)=>creationSourcesPreview(selection,'b'))} satisfies CreationSourceApi
    const view=renderHook(({client})=>useCreationSourceReview(source,client),{initialProps:{client:api as CreationSourceApi}})
    let pending!:Promise<void>;act(()=>{pending=view.result.current.refresh()})
    await waitFor(()=>expect(api.previewStoryCreationSources).toHaveBeenCalledOnce())
    view.rerender({client:other})
    await act(async()=>{finish(creationSourcesPreview({source}));await pending})
    expect(view.result.current.current).toBeNull();expect(view.result.current.canCreate).toBe(false)
    await act(async()=>{await view.result.current.refresh()})
    expect(view.result.current.current?.value.sourceVersion).toBe('b'.repeat(64))
})
it('does not retain a malformed or unrelated snapshot as an approved review',async()=>{
    const value=creationSourcesPreview({source});value.references[0].cardId='foreign-card'
    const api={previewStoryCreationSources:vi.fn(async()=>value)}
    const view=renderHook(()=>useCreationSourceReview(source,api))
    await act(async()=>{await view.result.current.refresh()})
    expect(view.result.current.failure).toBe('failed');expect(view.result.current.current).toBeNull()
})
it('lets the new scoped reader review immediately while the previous reader is unresolved',async()=>{
    let finish!:(value:StoryCreationSourcesPreview)=>void
    const previous={previewStoryCreationSources:vi.fn(()=>new Promise<StoryCreationSourcesPreview>((resolve)=>{finish=resolve}))}
    const next={previewStoryCreationSources:vi.fn(async(selection)=>creationSourcesPreview(selection,'b'))} satisfies CreationSourceApi
    const view=renderHook(({api})=>useCreationSourceReview(source,api),{initialProps:{api:previous as CreationSourceApi}})
    let stale!:Promise<void>;act(()=>{stale=view.result.current.refresh()})
    expect(view.result.current.busy).toBe(true)
    view.rerender({api:next});expect(view.result.current.busy).toBe(false)
    await act(async()=>{await view.result.current.refresh()})
    expect(view.result.current.current?.value.sourceVersion).toBe('b'.repeat(64))
    await act(async()=>{finish(creationSourcesPreview({source}));await stale})
    expect(view.result.current.current?.value.sourceVersion).toBe('b'.repeat(64))
})
it('reopens authored reference options and exact material without inheriting an old approval',async()=>{
    const initial={cardRefs:[{kind:'snapshot_card' as const,cardId:'provided',source:'manual' as const,enabled:false,precedence:4,
        snapshot:{id:'provided',name:'Author notes',description:'An original note.',story_card_kind:'snapshot_card' as const}}],
        approvedMaterials:[{key:'arrival',kind:'approved_adventure_material' as const,title:'Arrival',text:'  Exact text 🙂.  '}]}
    const api={previewStoryCreationSources:vi.fn(async(selection)=>creationSourcesPreview(selection))} satisfies CreationSourceApi
    const view=renderHook(()=>useCreationSourceReview({kind:'blank'},api,initial))
    expect(view.result.current.selection).toEqual({source:{kind:'blank'},...initial})
    initial.approvedMaterials[0].text='A later caller edit'
    expect(view.result.current.materials[0].text).toBe('  Exact text 🙂.  ')
    expect(view.result.current.canCreate).toBe(false)
    await act(async()=>{await view.result.current.refresh()})
    expect(view.result.current.current?.approved).toBe(false)
    expect(view.result.current.current?.value.references[0]).toMatchObject({origin:'provided',enabled:false,precedence:4})
})
