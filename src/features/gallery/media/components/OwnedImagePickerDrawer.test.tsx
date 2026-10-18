import { act,fireEvent,render,screen,waitFor } from '@testing-library/react'
import { beforeEach,expect,it,vi } from 'vitest'
import type { WorkspaceMediaPage } from '@/shared'
import { OwnedImagePickerDrawer,type OwnedImagePickerApi } from './OwnedImagePickerDrawer'
vi.mock('@/infrastructure/api/useAuthenticatedMediaUrl',()=>({useAuthenticatedMediaUrl:(src:string)=>({src,loading:false,error:null})}))
const workspace='11111111-1111-4111-8111-111111111111'
const page=(ids:string[]=[],owner=workspace):WorkspaceMediaPage=>({items:ids.map((id)=>({media_kind:'image',asset_id:id,job_id:null,organization:{workspace_id:owner},asset:{asset_id:id,url:'/images/assets/'+id}})),total:ids.length,limit:24,offset:0})
const api={listWorkspaceMedia:vi.fn(),uploadCardImage:vi.fn()} satisfies OwnedImagePickerApi
beforeEach(()=>{vi.resetAllMocks();api.listWorkspaceMedia.mockResolvedValue(page(['image-one']))})
it('keeps records selectable when a file preview is unavailable and requires an explicit choice',async()=>{
    const choose=vi.fn(),close=vi.fn();render(<OwnedImagePickerDrawer open api={api} workspaceId={workspace} sessionKey="owner-one" onChoose={choose} onClose={close}/>)
    const image=await screen.findByRole('button',{name:'Image 1'})
    fireEvent.error(image.querySelector('img')!)
    expect(screen.getByText('The image preview is unavailable. Its record and selection are retained.')).toBeInTheDocument()
    expect(image).toBeEnabled();expect(choose).not.toHaveBeenCalled()
    fireEvent.click(image);expect(image).toHaveAttribute('aria-pressed','true')
    fireEvent.click(screen.getByRole('button',{name:'Use image'}))
    expect(choose).toHaveBeenCalledWith('image-one');expect(close).toHaveBeenCalledOnce()
    expect(api.listWorkspaceMedia).toHaveBeenCalledWith(workspace,{media_kind:'image',offset:0,limit:24})
})
it('keeps an uncertain upload recoverable from the library without automatically uploading it again',async()=>{
    api.listWorkspaceMedia.mockResolvedValueOnce(page()).mockResolvedValue(page(['uploaded']))
    api.uploadCardImage.mockRejectedValue(new Error('Response lost'))
    const choose=vi.fn()
    render(<OwnedImagePickerDrawer open api={api} workspaceId={workspace} sessionKey="owner-one" onChoose={choose} onClose={()=>{}}/>)
    await screen.findByText('No images in this workspace')
    fireEvent.change(screen.getByLabelText('Upload image'),{target:{files:[new File(['test'],'cover.png',{type:'image/png'})]}})
    await screen.findByRole('alert')
    fireEvent.click(screen.getByRole('button',{name:'Refresh images'}))
    fireEvent.click(await screen.findByRole('button',{name:'Image 1'}));fireEvent.click(screen.getByRole('button',{name:'Use image'}))
    expect(choose).toHaveBeenCalledWith('uploaded');expect(api.uploadCardImage).toHaveBeenCalledOnce()
})
it('rejects a foreign page and ignores an old upload result after changing account/workspace scope',async()=>{
    api.listWorkspaceMedia.mockResolvedValueOnce(page(['foreign'],'22222222-2222-4222-8222-222222222222'))
    let finish!:(value:{asset_id:string;url:string;content_type:'image/png'})=>void
    api.uploadCardImage.mockImplementation(()=>new Promise((resolve)=>{finish=resolve}))
    const choose=vi.fn(),view=render(<OwnedImagePickerDrawer open api={api} workspaceId={workspace} sessionKey="owner-one" onChoose={choose} onClose={()=>{}}/>)
    await screen.findByRole('alert');expect(screen.queryByRole('button',{name:'Image 1'})).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Upload image'),{target:{files:[new File(['test'],'cover.png',{type:'image/png'})]}})
    await waitFor(()=>expect(api.uploadCardImage).toHaveBeenCalledOnce())
    const next={listWorkspaceMedia:vi.fn().mockResolvedValue(page()),uploadCardImage:vi.fn()}
    view.rerender(<OwnedImagePickerDrawer open api={next} workspaceId={workspace} sessionKey="owner-two" onChoose={choose} onClose={()=>{}}/>)
    await act(async()=>{finish({asset_id:'old-upload',url:'/images/assets/old-upload',content_type:'image/png'})})
    expect(screen.getByRole('button',{name:'Use image'})).toBeDisabled();expect(choose).not.toHaveBeenCalled()
    expect(next.uploadCardImage).not.toHaveBeenCalled()
})
