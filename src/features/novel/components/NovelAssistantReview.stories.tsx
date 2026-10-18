import { useLayoutEffect, useMemo, useRef, useState, type ComponentProps } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import type { Editor } from '@tiptap/core'
import { AuthContext } from '@/app/providers/AuthProvider'
import { FloatingWindowsProvider } from '@/app/providers/FloatingWindowsProvider'
import type { AssistantTurn } from '@/features/creation/common/components/assistant/assistantModel'
import type { StoryGenerationStatus } from '@/shared'
import { documentSignature } from '@/shared/storyDocument'
import { novelAssistantReviewFixture } from '@/test/fixtures/novelAssistantReview'
import { Button, Callout, Card, PageHeader } from '@/ui/primitives'
import { NovelEditor } from '../editor/NovelEditor'
import type { InlineAIPhase, NovelEditorHandle } from '../editor/types'
import type { NovelAssistantSource } from '../hooks/useNovelAssistantSource'
import { useStudioAssistantReview } from '../hooks/useStudioAssistantReview'
import { NovelAssistantEvidence } from './NovelAssistantEvidence'

const auth = { userHash: 'controlled-assistant-review-author', isAuthenticated: true } as NonNullable<ComponentProps<typeof AuthContext.Provider>['value']>

/** Local fictional state only; no API, provider, catalog or credential requests. */
function SavedSuggestionRoom({ changedContext = false }: { changedContext?: boolean }) {
    const fixture = useMemo(() => novelAssistantReviewFixture(), [])
    const [document, setDocument] = useState(fixture.scene.document), [status, setStatus] = useState<StoryGenerationStatus>('candidate')
    const [phase, setPhase] = useState<InlineAIPhase>('idle'), [notice, setNotice] = useState<string | null>(null), [epoch, setEpoch] = useState(0)
    const editor = useRef<NovelEditorHandle | null>(null), committed = useRef({ status, changedContext })
    useLayoutEffect(() => { committed.current = { status, changedContext } })
    const source = useMemo<NovelAssistantSource>(() => {
        const detail = () => ({ ...fixture.detail, generation: { ...fixture.detail.generation, status: committed.current.status } })
        return { key: 'fictional-assistant-review', storyId: fixture.index.id, isCurrent: () => true,
            prepare: async () => fixture.record.context, preview: async () => { throw new Error('No model request is available in this controlled review.') },
            refinement: async () => { throw new Error('Refinement is not part of this controlled manuscript-review example.') },
            refinementForGeneration:async()=>{throw new Error('History refinement is covered by its dedicated example.')},
            refinementForVariant:async()=>{throw new Error('Authored-source refinement has its own example.')},
            readRefinementSource:async()=>{throw new Error('This original suggestion has no refinement source.')}, getTurn: async () => null, turnState: async () => { throw new Error('This preview sends no requests.') }, stopTurn: async () => { throw new Error('This preview sends no requests.') }, generation: async () => detail(), stash: async () => { setStatus('stashed') }, sceneDocument: async () => { throw new Error('This preview sends no requests.') }, acceptTogether: async () => { throw new Error('This preview sends no requests.') }, recoverTogether: async () => null, undoTogether: async () => { throw new Error('This preview sends no requests.') },
            reviewCandidate: async () => {
                if (committed.current.changedContext || !['candidate', 'stashed'].includes(committed.current.status)) throw new Error('The saved source or suggestion changed.')
                return { index: fixture.index, detail: detail() }
            } }
    }, [fixture])
    const dirty = documentSignature(document) !== documentSignature(fixture.scene.document)
    const review = useStudioAssistantReview({ source, story: fixture.index, scene: fixture.scene, selectedUnit: fixture.scene.id,
        draft: { sceneId: fixture.scene.id, document, saveState: dirty ? 'dirty' : 'saved', suspended: phase !== 'idle', recovery: null,
            conflictServer: null, online: true, getRevision: () => fixture.scene.revision }, editorRef: editor,
        readOnly: false, blocked: false, loadError: false, beforeReview: async () => !dirty && phase === 'idle', selectScene: async () => true,
        onStaged: () => setNotice('The suggestion is open in the manuscript. Accept it or decline it before continuing.') })
    const turn: AssistantTurn = { message: { message_id: 11, conversation_id: 7, sequence_no: 2, role: 'assistant', status: 'completed',
        content: fixture.record.result.answer, metadata: { request_id: 'fictional-reviewed-turn', novel: fixture.record } },
        appliedChanges: [], isStreaming: false, isInterrupted: false }
    return <div className="mx-auto max-w-4xl space-y-4 p-4">
        <PageHeader title="The sealed letter" subtitle="Compare the saved suggestion before accepting it in the manuscript." />
        {changedContext && <Callout tone="warning">The saved context changed after this suggestion. Its evidence remains readable.</Callout>}
        {notice && <Callout tone="info" role="status">{notice}</Callout>}
        <NovelAssistantEvidence turns={[turn]} story={fixture.index} source={source} readOnly={false} onReviewSuggestion={review} />
        <Card className="min-h-48 p-3"><NovelEditor key={epoch} ref={editor} initialDocument={fixture.scene.document} codexEntries={[]}
            onDocumentChange={setDocument} onRequestSaveFlush={async () => !dirty}
            onGenerate={async () => { throw new Error('Review the saved suggestion to continue.') }}
            onAcceptGeneration={async () => {
                if (committed.current.changedContext) throw new Error('The saved sources changed. The edit remains available for review.')
                setStatus('accepted');setNotice('The suggestion is accepted. Undo restores the previous writing in one step.')
            }}
            onDiscardGeneration={async () => { setStatus('rejected');setNotice('The suggestion was declined. The manuscript is unchanged.') }}
            onCritiqueResult={() => {}} onSuggestionPhaseChange={setPhase} /></Card>
        <div className="flex flex-wrap gap-2">
            <Button variant="secondary" disabled={phase !== 'idle' || !dirty} onClick={() => (editor.current?.getInstanceToken() as Editor | null)?.commands.undo()}>Undo accepted text</Button>
            <Button variant="ghost" disabled={phase !== 'idle'} onClick={() => { setDocument(fixture.scene.document);setStatus('candidate');setNotice(null);setEpoch(value => value + 1) }}>Start review again</Button>
        </div>
    </div>
}

const meta = { title: 'Novel/Assistant manuscript review', component: SavedSuggestionRoom, tags: ['autodocs'], args: { changedContext: false },
    decorators: [Story => <AuthContext.Provider value={auth}><FloatingWindowsProvider><Story /></FloatingWindowsProvider></AuthContext.Provider>],
    parameters: { layout: 'fullscreen', docs: { description: { component: 'Controlled saved-candidate handoff into the actual editor decoration, explicit acceptance and exact undo flow. Fictional compiler evidence and local callbacks make no API, provider or credential request. Source changes keep the evidence readable and block handoff. The feature remains prepared and uninstalled.' } } },
} satisfies Meta<typeof SavedSuggestionRoom>
export default meta
type Story = StoryObj<typeof meta>
export const SavedCandidate: Story = {}
export const ChangedSavedSources: Story = { args: { changedContext: true } }
