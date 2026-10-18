import { useRef, useState } from 'react'
import type { Editor } from '@tiptap/core'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { FloatingWindowsProvider } from '@/app/providers/FloatingWindowsProvider'
import { Button, SwitchRow } from '@/ui/primitives'
import { identifyDocument } from '@/shared/storyDocument'
import { NovelEditor } from '../editor/NovelEditor'
import type { NovelEditorHandle } from '../editor/types'

const initial = identifyDocument({ type: 'doc', content: [
    { type: 'paragraph', attrs: { nodeId: 'move-first' }, content: [{ type: 'text', text: 'The lantern waited beside the window.' }] },
    { type: 'paragraph', attrs: { nodeId: 'move-rich' }, content: [{ type: 'text', text: 'Mira pocketed the ' }, { type: 'text', text: 'field notes', marks: [{ type: 'bold' }, { type: 'link', attrs: { href: 'https://example.com/notes', title: 'Original notes' } }] }, { type: 'text', text: ' and watched the sea. 🌒' }] },
    { type: 'paragraph', attrs: { nodeId: 'move-third' }, content: [{ type: 'text', text: 'The lantern waited beside the window.' }] },
    { type: 'orderedList', attrs: { nodeId: 'move-list', start: 3 }, content: [
        { type: 'listItem', attrs: { nodeId: 'item-tide' }, content: [{ type: 'paragraph', attrs: { nodeId: 'tide-text' }, content: [{ type: 'text', text: 'Check the tide.' }] }, { type: 'bulletList', attrs: { nodeId: 'nested-list' }, content: [{ type: 'listItem', attrs: { nodeId: 'nested-item' }, content: [{ type: 'paragraph', attrs: { nodeId: 'nested-text' }, content: [{ type: 'text', text: 'Keep the coastal warning with this item.' }] }] }] }] },
        { type: 'listItem', attrs: { nodeId: 'item-beacon' }, content: [{ type: 'paragraph', attrs: { nodeId: 'beacon-text' }, content: [{ type: 'text', text: 'Light the beacon.' }] }] },
    ] },
] })
function Room() {
    const editor = useRef<NovelEditorHandle | null>(null)
    const [readOnly, setReadOnly] = useState(false), [draft, setDraft] = useState(initial)
    return <div className="novel-reading-room flex h-screen flex-col">
        <div className="space-y-3 p-4"><h1 className="font-display text-h3">Move manuscript blocks</h1>
            <p className="text-caption text-parchment-300">Controlled editor fixture. Place the cursor in a paragraph or list item. Use Alt+Shift+↑/↓ or review a destination below. Undo/redo acts on the real editor history. This preview makes no API or provider requests.</p>
            <div className="flex flex-wrap gap-2"><Button disabled={readOnly} onClick={() => editor.current?.openBlockMove()}>Move blocks</Button>
                <Button variant="secondary" disabled={readOnly} onClick={() => (editor.current?.getInstanceToken() as Editor | null)?.commands.undo()}>Undo</Button><Button variant="secondary" disabled={readOnly} onClick={() => (editor.current?.getInstanceToken() as Editor | null)?.commands.redo()}>Redo</Button></div>
            <SwitchRow label="Read-only preview" checked={readOnly} onChange={setReadOnly} />
        </div>
        <NovelEditor ref={editor} initialDocument={draft} codexEntries={[]} readOnly={readOnly} onDocumentChange={setDraft} onRequestSaveFlush={async () => true}
            onGenerate={async () => { throw new Error('No generation in this fixture') }} onAcceptGeneration={async () => {}} onDiscardGeneration={async () => {}} onCritiqueResult={() => {}} />
    </div>
}
const meta = { title: 'Novel/Block movement', component: Room, tags: ['autodocs'], parameters: { layout: 'fullscreen', docs: { description: { component: 'Reviewed and keyboard manuscript movement with complete nested nodes, stable identities and normal undo history.' } } }, decorators: [(Story) => <FloatingWindowsProvider><Story /></FloatingWindowsProvider>] } satisfies Meta<typeof Room>
export default meta
type Story = StoryObj<typeof meta>
export const RichAndNestedBlocks: Story = {}
