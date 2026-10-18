import { useRef, useState, type ComponentProps, type RefObject } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { AuthContext } from '@/app/providers/AuthProvider'
import { FloatingWindowsProvider } from '@/app/providers/FloatingWindowsProvider'
import { API_BASE_URL } from '@/infrastructure/api/baseUrl'
import { apiStorageOrigin, workspaceStorageKey } from '@/shared/workspaceStorage'
import type { StoryManuscriptDocument } from '@/shared'
import { Button, Callout, Drawer, Field, Select, cx } from '@/ui/primitives'
import { manuscript, novel, storyChapter, storyScene } from '@/test/fixtures/story'
import { NovelEditor } from '../editor/NovelEditor'
import type { NovelEditorHandle } from '../editor/types'
import { useScenePosition } from '../hooks/useScenePosition'
import { useStudioView } from '../hooks/useStudioView'
import { useStudioLayout } from '../hooks/useStudioLayout'
import { NovelStudioHeader } from './NovelStudioHeader'

const auth = { userHash: 'controlled-novel-view-author' } as NonNullable<ComponentProps<typeof AuthContext.Provider>['value']>
const arrival = manuscript('The visitor arrived before dawn. Someone had already opened the gate.', 'view-arrival-block')
arrival.content.content!.push(...Array.from({ length: 28 }, (_, index) => ({ type: 'paragraph', attrs: { nodeId: `view-journal-${index}` }, content: [{ type: 'text', text: `Entry ${index + 1}. The lantern at the eastern gate burned through the rain. Mara waited beside the watchman, holding the letter beneath her coat. Every footstep on the road sounded like a promise.` }] })))
const scenes = [
    storyScene({ id: 'view-opening', title: 'At the window', document: manuscript('The letter waited by the window.\n\nMara recognized the seal.', 'view-opening-block') }),
    storyScene({ id: 'view-arrival', title: 'The visitor', order: 1, document: arrival }),
]
const story = novel({ id: 'controlled-view-novel', title: 'The sealed letter', chapters: [storyChapter({ scenes })] })
const workspaceId = 'controlled-view-workspace'
const viewKey = workspaceStorageKey('magic-worlds:novel-view:v1:' + story.id, { apiOrigin: apiStorageOrigin(API_BASE_URL), userHash: auth.userHash!, workspaceId })

function Scene({ sceneId, document, onChange, editorRef, focusMode, typewriter }: { sceneId: string; document: StoryManuscriptDocument; onChange: (document: StoryManuscriptDocument) => void; editorRef: RefObject<NovelEditorHandle | null>; focusMode: boolean; typewriter: boolean }) {
    const position = useScenePosition(story.id, sceneId, workspaceId)
    return <NovelEditor ref={editorRef} focusMode={focusMode} typewriter={typewriter} initialDocument={document} getInitialPosition={position.getInitialPosition} onPositionChange={position.onPositionChange} codexEntries={[]}
        onDocumentChange={onChange} onRequestSaveFlush={async () => true} onGenerate={async () => { throw new Error('Generation is unavailable in this local view fixture') }}
        onAcceptGeneration={async () => {}} onDiscardGeneration={async () => {}} onCritiqueResult={() => {}} />
}
function Room({ documents, onDocument, onClose }: { documents: Record<string, StoryManuscriptDocument>; onDocument: (id: string, document: StoryManuscriptDocument) => void; onClose: () => void }) {
    const view = useStudioView(viewKey)
    const {containerRef,outlineDocked,inspectorDocked} = useStudioLayout()
    const editor = useRef<NovelEditorHandle | null>(null)
    const scene = scenes.find((value) => value.id === view.selectedUnit) ?? scenes[0]
    const narrow = view.narrowPanel === 'outline' && !outlineDocked ? 'outline' : view.narrowPanel === 'codex' && !inspectorDocked ? 'codex' : null
    const outline = <div className="space-y-2 p-3">{scenes.map((value) => <Button key={value.id} variant={scene.id === value.id ? 'secondary' : 'ghost'} onClick={() => view.selectUnit(value.id)}>{value.title}</Button>)}</div>
    const codex = <aside className="space-y-3 p-3"><h2 className="font-display text-h3">Codex</h2><Field label="Context scope"><Select value={view.codexScope} onChange={(value) => view.setCodexScope(value as typeof view.codexScope)} options={['novel', 'chapter', 'scene'].map((value) => ({ value, label: value }))} /></Field></aside>
    return <div ref={containerRef} className="novel-reading-room flex h-screen flex-col">
        <NovelStudioHeader story={story} chapterTitle={scene.title} focusMode={view.focusMode} codexOpen={inspectorDocked ? view.codexOpen : narrow === 'codex'} typewriter={view.typewriter}
            onToggleFocusMode={view.toggleFocusMode} onToggleCodex={() => inspectorDocked ? view.setCodexOpen(!view.codexOpen) : view.setNarrowPanel(narrow === 'codex' ? null : 'codex')}
            onToggleTypewriter={view.toggleTypewriter} onOpenFind={() => editor.current?.openFind()} onOpenHistory={() => {}} onBack={onClose} onEditDetails={() => {}} />
        <div className="flex flex-wrap gap-2 p-3"><Button variant="secondary" onClick={onClose}>Close writing room</Button>{!outlineDocked && <Button variant="secondary" onClick={() => view.setNarrowPanel('outline')}>Scenes</Button>}</div>
        {view.viewStorageUnavailable && <Callout tone="warning">This browser could not retain the view.</Callout>}
        <div className={cx('grid min-h-0 flex-1 grid-cols-1', !view.focusMode && outlineDocked && (view.codexOpen && inspectorDocked ? 'grid-cols-[224px_minmax(0,1fr)_300px]' : 'grid-cols-[224px_minmax(0,1fr)]'))}>
            {!view.focusMode && outlineDocked && outline}
            <section className="novel-reading-surface flex min-h-0 min-w-0 flex-col"><h1 className="mx-auto w-full max-w-[var(--width-manuscript)] px-7 pt-6 font-display text-h3">{scene.title}</h1><Scene key={scene.id} sceneId={scene.id} document={documents[scene.id]} onChange={(document) => onDocument(scene.id, document)} editorRef={editor} focusMode={view.focusMode} typewriter={view.typewriter} /></section>
            {!view.focusMode && view.codexOpen && inspectorDocked && codex}
        </div>
        <Drawer open={narrow === 'outline'} onClose={() => view.setNarrowPanel(null)} title="Scenes">{outline}</Drawer>
        <Drawer open={narrow === 'codex'} onClose={() => view.setNarrowPanel(null)} title="Codex">{codex}</Drawer>
    </div>
}
function ViewResume() {
    const [open, setOpen] = useState(true)
    const [documents, setDocuments] = useState<Record<string, StoryManuscriptDocument>>(() => Object.fromEntries(scenes.map((scene) => [scene.id, scene.document])))
    return <AuthContext.Provider value={auth}><FloatingWindowsProvider>{open
        ? <Room documents={documents} onDocument={(id, document) => setDocuments((current) => ({ ...current, [id]: document }))} onClose={() => setOpen(false)} />
        : <div className="space-y-4 p-6"><p className="font-display text-h3">The sealed letter</p><Button onClick={() => setOpen(true)}>Reopen writing room</Button></div>
    }</FloatingWindowsProvider></AuthContext.Provider>
}
const meta = { title: 'Novel/Studio view resume', component: ViewResume, tags: ['autodocs'], parameters: { layout: 'fullscreen', docs: { description: { component: 'Controlled view/position persistence around the real editor and header. Select a scene, change panel choices, then close/reopen the room. Writing remains in local fixture state; no project or provider requests run.' } } } } satisfies Meta<typeof ViewResume>
export default meta
type Story = StoryObj<typeof meta>
export const Reopen: Story = {}
