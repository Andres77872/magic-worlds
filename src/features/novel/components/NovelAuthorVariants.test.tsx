import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { i18n } from '@/app/i18n'
import { manuscript } from '@/test/fixtures/story'
import { controlledAuthorVariants } from '@/test/fixtures/controlledAuthorVariants'
import { NovelAuthorVariants } from './NovelAuthorVariants'

vi.mock('../editor/NovelEditor', async () => {
    const React = await import('react'), { documentText } = await import('@/shared/storyDocument')
    return { NovelEditor: React.forwardRef(function ControlledEditor(props: import('../editor/types').NovelEditorProps, ref) {
        const [value, setValue] = React.useState(documentText(props.initialDocument!)), token = React.useRef({})
        React.useImperativeHandle(ref, () => ({ getInstanceToken: () => token.current, prepareVariantDraft: () => props.initialDocument }))
        return <textarea aria-label="Controlled manuscript editor" readOnly={props.readOnly} value={value} onChange={event => {
            setValue(event.target.value); props.onDocumentChange(manuscript(event.target.value), null)
        }} />
    }) }
})
beforeEach(async () => { localStorage.clear(); vi.restoreAllMocks(); await i18n.changeLanguage('en') })
it('keeps private editing and reviewed storage separate from manuscript application', async () => {
    const f = controlledAuthorVariants({ empty: true }), create = vi.spyOn(f.source, 'create'), onReview = vi.fn(async () => false)
    render(<NovelAuthorVariants source={f.source} generationId={f.generation.id} readOnly={false} onClose={() => {}} onReview={onReview} />)
    const section = await screen.findByRole('region', { name: 'Private version editor' }), editor = within(section).getByRole('textbox')
    await waitFor(() => expect(editor).not.toHaveAttribute('readonly'))
    fireEvent.change(screen.getByRole('textbox', { name: 'Version name' }), { target: { value: 'A quieter version' } })
    fireEvent.change(editor, { target: { value: 'My private letter.' } })
    expect(screen.getByRole('button', { name: 'Save reviewed version' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Review this version' }))
    await screen.findByText(/The complete scene and original sources were checked/)
    fireEvent.change(editor, { target: { value: 'A later private letter.' } })
    expect(screen.getByRole('button', { name: 'Save reviewed version' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Review this version' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save reviewed version' })).toBeEnabled())
    fireEvent.click(screen.getByRole('button', { name: 'Save reviewed version' }))
    const action = await screen.findByRole('button', { name: 'Review A quieter version in manuscript' })
    expect(create).toHaveBeenCalledOnce(); expect(onReview).not.toHaveBeenCalled()
    expect(f.scene.document).toEqual(f.snapshot.baseDocument)
    fireEvent.click(action)
    await screen.findByText(/The saved version or manuscript target changed/)
    expect(onReview).toHaveBeenCalledOnce(); expect(editor).toHaveValue('A later private letter.')
    expect(create.mock.calls[0][0].intent.operation.document).toEqual(manuscript('A later private letter.'))
})
it('does not close or send a request when private storage is unavailable', async () => {
    const f = controlledAuthorVariants({ empty: true }), close = vi.fn(), create = vi.spyOn(f.source, 'create')
    render(<NovelAuthorVariants source={f.source} generationId={f.generation.id} readOnly={false} onClose={close} onReview={async () => false} />)
    await screen.findByRole('textbox', { name: 'Version name' })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Quota') })
    fireEvent.change(screen.getByRole('textbox', { name: 'Version name' }), { target: { value: 'Private writing' } })
    fireEvent.click(screen.getAllByRole('button', { name: 'Close' })[0])
    await screen.findByText(/The private draft could not be saved/)
    expect(close).not.toHaveBeenCalled(); expect(create).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Download private draft' })).toBeEnabled()
})
it('keeps saved versions readable in a read-only novel without creating an editing draft or mutation', async () => {
    const f = controlledAuthorVariants(), context = vi.spyOn(f.source, 'context'), create = vi.spyOn(f.source, 'create'), decide = vi.spyOn(f.source, 'decide')
    render(<NovelAuthorVariants source={f.source} generationId={f.generation.id} readOnly startEditing={false} canCreate={false} onClose={() => {}} onReview={async () => true} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Read version' }))
    await screen.findByText('Saved version: ' + f.snapshot.title)
    expect(screen.queryByRole('button', { name: 'Review '+f.snapshot.title+' in manuscript' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Stash version' })).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: 'Version name' })).not.toBeInTheDocument()
    expect(context).not.toHaveBeenCalled(); expect(create).not.toHaveBeenCalled(); expect(decide).not.toHaveBeenCalled()
})

it('refines an accepted saved version as quoted input without reopening application or saving private edits',async()=>{
    const f=controlledAuthorVariants(),saved=f.records.get(f.snapshot.id)!,refine=vi.fn(async()=>false),review=vi.fn(async()=>true)
    saved.status='accepted';saved.appliedRevision=f.snapshot.operation.expectedRevision+1
    const create=vi.spyOn(f.source,'create')
    render(<NovelAuthorVariants source={f.source} generationId={f.generation.id} startEditing={false} canCreate={false} readOnly={false}
        onClose={()=>{}} onReview={review} onRefine={refine}/>)
    fireEvent.click(await screen.findByRole('button',{name:'Read version'}))
    fireEvent.click(await screen.findByRole('button',{name:'Refine saved version'}))
    await waitFor(()=>expect(refine).toHaveBeenCalledWith(saved,expect.any(AbortSignal)))
    expect(screen.getByText('Saved version: '+saved.variant.title)).toBeVisible()
    expect(screen.queryByRole('button',{name:'Review '+saved.variant.title+' in manuscript'})).not.toBeInTheDocument()
    expect(review).not.toHaveBeenCalled();expect(create).not.toHaveBeenCalled()
})

it.each(['readOnly','owner'] as const)('does not close a saved-version handoff after %s retires',async reason=>{
    const f=controlledAuthorVariants(),close=vi.fn();let finish!:(ready:boolean)=>void
    const refine=vi.fn(()=>new Promise<boolean>(resolve=>{finish=resolve}))
    const props={source:f.source,generationId:f.generation.id,startEditing:false,readOnly:false,onClose:close,onReview:async()=>true,onRefine:refine}
    const view=render(<NovelAuthorVariants {...props}/>)
    fireEvent.click(await screen.findByRole('button',{name:'Read version'}))
    fireEvent.click(await screen.findByRole('button',{name:'Refine saved version'}))
    await waitFor(()=>expect(refine).toHaveBeenCalledOnce())
    if(reason==='readOnly')view.rerender(<NovelAuthorVariants {...props} readOnly/>);else f.retire()
    await act(async()=>finish(true))
    await waitFor(()=>expect(close).not.toHaveBeenCalled())
    if(reason==='readOnly')expect(screen.queryByRole('button',{name:'Refine saved version'})).not.toBeInTheDocument()
})
it('retains later input and an uncertain creation through dialog recovery', async () => {
    const f = controlledAuthorVariants({ empty: true }), original = f.source.create.bind(f.source)
    const create = vi.spyOn(f.source, 'create').mockImplementationOnce(async (write, signal) => { await original(write, signal); throw new Error('Reply lost') })
    const props = { source: f.source, generationId: f.generation.id, readOnly: false, onClose: () => {}, onReview: async () => false }
    const first = render(<NovelAuthorVariants {...props} />)
    fireEvent.change(await screen.findByRole('textbox', { name: 'Version name' }), { target: { value: 'Original version name' } })
    await waitFor(() => expect(screen.getByRole('button', { name: 'Review this version' })).toBeEnabled())
    fireEvent.click(screen.getByRole('button', { name: 'Review this version' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save reviewed version' })).toBeEnabled())
    fireEvent.click(screen.getByRole('button', { name: 'Save reviewed version' }))
    await screen.findByRole('button', { name: 'Recover original request' })
    fireEvent.change(screen.getByRole('textbox', { name: 'Version name' }), { target: { value: 'Later private name' } })
    first.unmount(); render(<NovelAuthorVariants {...props} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Resume private version' }))
    expect(screen.getByRole('textbox', { name: 'Version name' })).toHaveValue('Later private name')
    fireEvent.click(screen.getByRole('button', { name: 'Recover original request' }))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Recover original request' })).not.toBeInTheDocument())
    expect(create).toHaveBeenCalledOnce(); expect(screen.getByRole('textbox', { name: 'Version name' })).toHaveValue('Later private name')
})
