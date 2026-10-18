import { useMemo, useRef, useState, type ComponentProps } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import type { Editor } from '@tiptap/core'
import { AuthContext } from '@/app/providers/AuthProvider'
import { FloatingWindowsProvider } from '@/app/providers/FloatingWindowsProvider'
import { Button, Callout, Card, Field, PageHeader, Textarea } from '@/ui/primitives'
import { controlledAuthorVariants } from '@/test/fixtures/controlledAuthorVariants'
import { documentSignature } from '@/shared/storyDocument'
import type { InlineAIPhase, NovelEditorHandle } from '../editor/types'
import { NovelEditor } from '../editor/NovelEditor'
import { useStudioVariantReview } from '../hooks/useStudioVariantReview'
import { NovelAuthorVariants } from './NovelAuthorVariants'
import { NovelRefinementSummary } from './NovelRefinementSummary'
import { readVariantRefinement } from '../hooks/novelRefinementTarget'
import type { NovelRefinementSource } from '@/shared/types/storyAssistant.types'

const auth = { userHash: 'fictional-version-author', isAuthenticated: true } as NonNullable<ComponentProps<typeof AuthContext.Provider>['value']>
function AuthorVersionRoom({ changedSources = false, readOnly = false, refinementHandoff=false }: { changedSources?: boolean; readOnly?: boolean; refinementHandoff?:boolean }) {
    const f = useMemo(() => controlledAuthorVariants({ changedSources }), [changedSources])
    const [open, setOpen] = useState(true), [document, setDocument] = useState(f.scene.document), [phase, setPhase] = useState<InlineAIPhase>('idle')
    const [notice, setNotice] = useState(''), [applied, setApplied] = useState(false)
    const [refinement,setRefinement]=useState<NovelRefinementSource|null>(null),[instruction,setInstruction]=useState('Keep my quieter ending and make the candlelight more vivid.')
    const editor = useRef<NovelEditorHandle | null>(null), dirty = documentSignature(document) !== documentSignature(f.scene.document)
    const review = useStudioVariantReview({ source: f.source, story: f.index, scene: f.scene, selectedUnit: f.scene.id,
        draft: { sceneId: f.scene.id, document, saveState: 'saved', recovery: null, conflictServer: null, suspended: phase !== 'idle', online: true, getRevision: () => f.scene.revision },
        editorRef: editor, readOnly, blocked: applied, loadError: false, beforeReview: async () => !dirty && phase === 'idle', selectScene: async () => true,
        onStaged: () => { setOpen(false); setNotice('Your saved version is in manuscript review. Accept it to change the writing, or keep it for later.') } })
    return <div className="mx-auto max-w-4xl space-y-4 p-4">
        <PageHeader title="The sealed letter" subtitle="Edit a private version before deciding whether it belongs in the manuscript." />
        <Callout tone="info">This example uses fictional in-memory records. It makes no API or model request.</Callout>
        {refinementHandoff&&<Field label="Unsent editing instruction"><Textarea value={instruction} onChange={event=>setInstruction(event.target.value)}/></Field>}
        {refinement&&<NovelRefinementSummary value={refinement} onClear={()=>setRefinement(null)}/>}
        {notice && <Callout tone="info" role="status">{notice}</Callout>}
        <div className="flex flex-wrap gap-2"><Button disabled={phase !== 'idle'} onClick={() => setOpen(true)}>Open authored versions</Button>
            <Button variant="secondary" disabled={!applied || phase !== 'idle'} onClick={() => { (editor.current?.getInstanceToken() as Editor | null)?.commands.undo(); setNotice('The previous rich writing was restored in one undo event.') }}>Undo accepted version</Button></div>
        <Card className="min-h-64 p-3"><NovelEditor ref={editor} initialDocument={f.scene.document} codexEntries={[]} readOnly={readOnly}
            onDocumentChange={setDocument} onRequestSaveFlush={async () => true} onGenerate={async () => { throw new Error('This controlled example does not run a model') }}
            onAcceptGeneration={async (generationId, variant) => {
                const actual = editor.current?.getDocument(), saved = variant ? f.records.get(variant.id) : null
                if (!variant || !actual || !saved || generationId !== f.generation.id || documentSignature(actual) !== documentSignature(variant.operation.document)) throw new Error('The reviewed version changed')
                saved.status = 'accepted'; saved.appliedRevision = variant.operation.expectedRevision + 1; setApplied(true)
                setNotice('The exact authored JSON was accepted. The original model output remains a separate saved result.')
            }} onDiscardGeneration={async () => {}} onCritiqueResult={() => {}} onSuggestionPhaseChange={setPhase} /></Card>
        {open && <NovelAuthorVariants source={f.source} generationId={f.generation.id} readOnly={readOnly} startEditing={!readOnly}
            onClose={() => setOpen(false)} onReview={review} onRefine={refinementHandoff?async(record,signal)=>{
                const target=await readVariantRefinement({storyId:f.index.id,isCurrent:f.source.isCurrent,api:{
                    getStoryVariant:(_storyId,id,options)=>f.source.read(id,options?.signal??signal),
                    getStoryRefinementParent:async()=>structuredClone(f.context.parent),
                    getStoryGenerationHistoryDetail:async()=>structuredClone(f.detail),
                    getStoryRevision:async()=>{throw new Error('An authored quotation does not reuse old selection coordinates')},
                }},record,signal)
                setRefinement(target.refinement);setNotice('Your saved version is selected as quoted input. Your instruction is retained; no prompt was sent and the manuscript is unchanged.')
                return true
            }:undefined}/>} 
    </div>
}
const meta = { title: 'Novel/Authored suggestion versions', component: AuthorVersionRoom, tags: ['autodocs'], args: { changedSources: false, readOnly: false },
    decorators: [Story => <AuthContext.Provider value={auth}><FloatingWindowsProvider><Story /></FloatingWindowsProvider></AuthContext.Provider>],
    parameters: { layout: 'fullscreen', docs: { description: { component: 'The production private editor, retained creation/decision journal and Studio version handoff over a fictional in-memory transport. Amber marks author choices and violet the original model output. Saving does not apply prose; explicit manuscript acceptance preserves the exact authored JSON. This is prepared UI evidence, not authenticated-author, native transport, model-quality or release qualification.' } } },
} satisfies Meta<typeof AuthorVersionRoom>
export default meta
type Story = StoryObj<typeof meta>
export const EditReviewSaveAndApply: Story = {}
export const ChangedSources: Story = { args: { changedSources: true } }
export const ReadOnlyVersions: Story = { args: { readOnly: true } }
export const SavedVersionRefinement:Story={args:{refinementHandoff:true}}
