import { beforeEach as beforeEachGrantedFeatures } from 'vitest'
import { setAllTestFeatureFlags as grantFixtureFeatures } from '@/shared/hooks/testing/featureFlagTestUtils'
beforeEachGrantedFeatures(() => grantFixtureFeatures(true))
import { setTestFeatureFlags } from '@/shared/hooks/testing/featureFlagTestUtils'
import { act,render,renderHook,screen } from '@testing-library/react'
import { afterEach,beforeEach,expect,it,vi } from 'vitest'
import type { ApiService } from '@/infrastructure/api'
import type { NovelCreateModalProps } from '@/features/novel/components/NovelCreateModal'
import type { GalleryItem } from '../galleryConfig'
import { novel } from '@/test/fixtures/story'

const mocks=vi.hoisted(()=>({createStory:vi.fn(),setPage:vi.fn(),current:true,dialog:null as NovelCreateModalProps|null}))
vi.mock('@/app/hooks',()=>({useAuth:()=>({isAuthenticated:true,openLoginModal:vi.fn()}),useNavigation:()=>({setPage:mocks.setPage}),
    useData:()=>({characters:[],worlds:[],items:[],templateAdventures:[],createStory:mocks.createStory,novelCreations:{items:[]}})}))
vi.mock('@/app/hooks/useWorkspace',()=>({useWorkspace:()=>({capture:()=>({workspaceId:'work-one'}),isCurrent:()=>mocks.current})}))
vi.mock('@/features/call',()=>({useStartCall:()=>({callsUnavailable:false,personaPickOpen:false}),CallStartErrorToast:()=>null}))
vi.mock('@/features/creation/common/components',()=>({VersionHistoryDrawer:()=>null}))
vi.mock('@/features/novel/components/NovelCreateDialog',()=>({NovelCreateDialog:(props:NovelCreateModalProps)=>{mocks.dialog=props;return <div role="dialog" aria-label="Review novel sources"/>}}))
vi.mock('@/features/novel/components/NovelPendingCreations',()=>({NovelPendingCreations:()=>null}))
import { useGalleryCardActions } from './useGalleryCardActions'
const api={} as ApiService,card={id:'mira',galleryType:'character',title:'Mira'} as GalleryItem
const options={api,onItemChanged:vi.fn(),onItemRemoved:vi.fn()}
beforeEach(()=>{vi.resetAllMocks();mocks.current=true;mocks.dialog=null;mocks.createStory.mockResolvedValue(novel());setTestFeatureFlags({ novels: true })})
afterEach(()=>vi.unstubAllEnvs())
it('opens the shared prefilled source review before creating from a library card',async()=>{
    const hook=renderHook(()=>useGalleryCardActions(options))
    const action=hook.result.current.optionsFor(card).find((option)=>option.type==='custom'&&option.label==='Write')!
    act(()=>action.onClick?.())
    render(hook.result.current.overlays)
    expect(screen.getByRole('dialog',{name:'Review novel sources'})).toBeInTheDocument()
    expect(mocks.createStory).not.toHaveBeenCalled()
    expect(mocks.dialog?.initial).toMatchObject({card:{type:'character',id:'mira',name:'Mira'}})
    const request={title:'The glass road',source:{kind:'character' as const,id:'mira',title:'Mira'},expectedSourceVersion:'a'.repeat(64),chapters:[{title:'Opening'}]}
    await act(async()=>{await mocks.dialog!.onCreate(request)})
    expect(mocks.createStory).toHaveBeenCalledWith(request)
    expect(mocks.setPage).toHaveBeenCalledWith('story')
})
it('closes a stale source review on a committed switch and hides creation for archived cards',()=>{
    const hook=renderHook(({readOnly})=>useGalleryCardActions({...options,readOnly}),{initialProps:{readOnly:false}})
    const action=hook.result.current.optionsFor(card).find((option)=>option.type==='custom'&&option.label==='Write')!
    act(()=>action.onClick?.())
    const view=render(hook.result.current.overlays)
    expect(screen.getByRole('dialog',{name:'Review novel sources'})).toBeInTheDocument()
    mocks.current=false;hook.rerender({readOnly:true});view.rerender(hook.result.current.overlays)
    expect(screen.queryByRole('dialog',{name:'Review novel sources'})).not.toBeInTheDocument()
    expect(hook.result.current.optionsFor(card).some((option)=>option.type==='custom'&&option.label==='Write')).toBe(false)
    expect(mocks.createStory).not.toHaveBeenCalled()
})
