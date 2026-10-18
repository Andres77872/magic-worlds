import { useRef, useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { FloatingWindowsProvider } from '@/app/providers/FloatingWindowsProvider'
import { Button, SwitchRow } from '@/ui/primitives'
import { manuscript } from '@/test/fixtures/story'
import { NovelEditor } from '../editor/NovelEditor'
import type { EditorCodexEntry, NovelEditorHandle } from '../editor/types'

const initial = manuscript('', 'reference-passage')
initial.content.content![0].content = [{ type: 'codexMention', attrs: { id: 'keeper', label: 'Mira' } }, { type: 'text', text: ' kept the lantern lit. Mira waited by the sea. ' }, { type: 'codexMention', attrs: { id: 'retired', label: 'Mira of old' } }]
const pins: EditorCodexEntry[] = [
    { id: 'keeper', label: 'Mira', kind: 'character', enabled: false, contextState: 'disabled', description: 'A lighthouse keeper who protects the coast. Her beacon warns ships away from the drowned city.', scope: 'scene', scopeLabel: 'The beacon', sourceId: 'Mira · lighthouse notes', sourceVersionNumber: 3, contextRevision: 1 },
    { id: 'physician', label: 'Mira', kind: 'character', enabled: true, contextState: 'enabled', description: 'A physician at the winter court. She knows why the king cannot sleep.', scope: 'novel', scopeLabel: 'The winter court', sourceId: 'Mira · court notes', sourceVersionNumber: 7, contextRevision: 1 },
    { id: 'retired', label: 'Mira before the storm', kind: 'character', enabled: false, contextState: 'removed', removed: true, description: 'The earlier pinned portrait remains available for this saved mention.', sourceId: 'Mira · original notes', sourceVersionNumber: 1 },
]
function Room() {
    const editor = useRef<NovelEditorHandle | null>(null)
    const [readOnly, setReadOnly] = useState(false), [entries, setEntries] = useState(pins), [draft, setDraft] = useState(initial)
    return <div className="novel-reading-room flex h-screen flex-col">
        <div className="space-y-3 p-4"><h1 className="font-display text-h3">Manuscript references</h1>
            <p className="text-caption text-parchment-300">Controlled fixture with two Miras and a removed pin. Place the cursor beside a mention and press Alt+Enter, or select the passage to choose among its sources. Edits stay in this preview; no API or provider requests run.</p>
            <Button onClick={() => editor.current?.openReferences()}>Inspect references</Button>
            <SwitchRow label="Read-only preview" checked={readOnly} onChange={setReadOnly} />
        </div>
        <NovelEditor ref={editor} initialDocument={draft} codexEntries={entries.filter((entry) => !entry.removed)} referenceEntries={entries}
            detectionNames={entries.filter((entry) => !entry.removed).map(({ id, label, kind }) => ({ id, label, kind }))} readOnly={readOnly}
            onSetReferenceContext={async (target, enabled) => { setEntries((current) => current.map((entry) => entry.id === target.id ? { ...entry, enabled, contextState: enabled ? 'enabled' : 'disabled', contextRevision: (entry.contextRevision ?? 0) + 1 } : entry)) }}
            onDocumentChange={setDraft} onRequestSaveFlush={async () => true} onGenerate={async () => { throw new Error('No generation in this fixture') }} onAcceptGeneration={async () => {}} onDiscardGeneration={async () => {}} onCritiqueResult={() => {}} />
    </div>
}
const meta = { title: 'Novel/Manuscript references', component: Room, tags: ['autodocs'], parameters: { layout: 'fullscreen', docs: { description: { component: 'Stable saved-reference inspection and explicit duplicate-name choices using ember source details and shared dialogs.' } } }, decorators: [(Story) => <FloatingWindowsProvider><Story /></FloatingWindowsProvider>] } satisfies Meta<typeof Room>
export default meta
type Story = StoryObj<typeof meta>
export const DuplicateAndRemovedPins: Story = {}
