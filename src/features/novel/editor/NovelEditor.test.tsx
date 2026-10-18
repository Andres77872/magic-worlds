import { documentText, identifyDocument } from '@/shared/storyDocument'
import { manuscript } from '@/test/fixtures/story'
import { novelAssistantReviewFixture } from '@/test/fixtures/novelAssistantReview'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { Editor } from '@tiptap/core'
import { createRef,useState } from 'react'
import { DEFAULT_READING, readingAttributes, readingPresets, type ReadingPreferences } from '../utils/readingPreferences'
import { DEFAULT_TYPING,PLAIN_TYPING } from '../utils/typingPreferences'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { EditorView } from '@tiptap/pm/view'
import { webcrypto } from 'node:crypto'
import * as positionFingerprints from './positionFingerprint'

// The editor opens detected lore/codex references in floating windows.
vi.mock('@/app/hooks', () => ({
    useFloatingWindows: () => ({ openWindow: vi.fn(), closeWindow: vi.fn(), closeAll: vi.fn(), focusWindow: vi.fn(), windows: [] }),
}))

import { NovelEditor } from './NovelEditor'
import type { NovelEditorHandle,NovelEditorProps } from './types'

const originalElementFromPoint = document.elementFromPoint

function props(overrides: Partial<NovelEditorProps> = {}): NovelEditorProps {
    return {
        initialBody: '',
        codexEntries: [],
        onDocumentChange: vi.fn(),
        onRequestSaveFlush: vi.fn(async () => true),
        onGenerate: vi.fn(),
        onAcceptGeneration: vi.fn(async () => {}),
        onDiscardGeneration: vi.fn(async () => {}),
        onCritiqueResult: vi.fn(),
        ...overrides,
    }
}

// The pinned BubbleMenu retains its 250ms selection debounce after unregistering.
// Keep this file's jsdom alive until that pending callback has run.
afterAll(async () => { await new Promise((resolve) => setTimeout(resolve, 300)) })

describe('NovelEditor', () => {
    it.each(['writable', 'read_only', 'offline'])('guards a saved suggestion in a %s editor and announces only available actions', async mode => {
        const fixture = novelAssistantReviewFixture(), ref = createRef<NovelEditorHandle>(), options = props({ initialDocument: fixture.scene.document,
            readOnly: mode === 'read_only', aiDisabled: mode === 'offline' })
        render(<NovelEditor ref={ref} {...options} />)
        await screen.findByRole('textbox', { name: 'Scene manuscript' })
        act(() => expect(ref.current!.reviewGeneration({ generation: fixture.detail.generation,
            operation: fixture.record.result.proposal!.operation, document: fixture.scene.document })).toBe(mode === 'writable'))
        expect(ref.current!.getDocument()).toEqual(fixture.scene.document)
        expect(options.onGenerate).not.toHaveBeenCalled()
        if (mode === 'writable') {
            expect(screen.getByTestId('ai-suggestion-announcer')).toHaveTextContent('Accept or decline')
            expect(screen.getByTestId('ai-suggestion-announcer')).not.toHaveTextContent('regenerate')
        } else expect(ref.current!.hasActiveSuggestion()).toBe(false)
    })
    it('preserves an existing proposal when remote AI pauses instead of declining it on an offline transition', async () => {
        const onDiscardGeneration = vi.fn(async () => {}), baseProps = props({ initialBody: 'The gate held.', onDiscardGeneration })
        const view = render(<NovelEditor {...baseProps} />)
        const surface = await screen.findByLabelText('Scene manuscript'), editor = (surface as HTMLElement & { editor: Editor }).editor
        act(() => { editor.commands.aiStartPending(editor.state.doc.content.size - 1); editor.commands.aiInsertGeneration(editor.markdown!.parse('A proposal awaiting approval.')) })
        expect(editor.storage.aiSuggestionState.phase).toBe('reviewing')
        view.rerender(<NovelEditor {...baseProps} aiDisabled />)
        expect(editor.storage.aiSuggestionState.phase).toBe('reviewing')
        expect(editor.getMarkdown()).toBe('The gate held.')
        expect(onDiscardGeneration).not.toHaveBeenCalled()
        view.rerender(<NovelEditor {...baseProps} aiDisabled={false} />)
        expect(editor.storage.aiSuggestionState.phase).toBe('reviewing')
    })
    it('keeps manual prose and formatting editable while device mode disables AI shortcuts', async () => {
        const ref = createRef<NovelEditorHandle>(), onDocumentChange = vi.fn(), onGenerate = vi.fn(), onRequestSaveFlush = vi.fn(async () => true)
        render(<NovelEditor ref={ref} {...props({ initialDocument: manuscript('Mara read the letter.', 'device-prose'), aiDisabled: true, onDocumentChange, onGenerate, onRequestSaveFlush })} />)
        const surface = await screen.findByLabelText('Scene manuscript'), editor = ref.current!.getInstanceToken() as Editor
        expect(surface).toHaveAttribute('contenteditable', 'true')
        act(() => { editor.commands.setTextSelection(1); editor.commands.insertContent('Later, '); editor.commands.setTextSelection({ from: 1, to: 6 }); editor.commands.toggleBold() })
        expect(documentText(ref.current!.getDocument()!)).toBe('Later, Mara read the letter.')
        expect(ref.current!.getDocument()!.content.content![0].content![0].marks).toContainEqual({ type: 'bold' })
        fireEvent.keyDown(surface, { key: 'Enter', ctrlKey: true })
        expect(screen.queryByRole('textbox', { name: /what happens next/i })).not.toBeInTheDocument()
        expect(onGenerate).not.toHaveBeenCalled(); expect(onRequestSaveFlush).not.toHaveBeenCalled()
        expect(onDocumentChange).toHaveBeenCalled()
    })
    it('does not reclaim editor focus when the author interacts elsewhere after a dialog move', async () => {
        const frames: FrameRequestCallback[] = [], raf = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => { frames.push(callback); return frames.length })
        try {
            const ref = createRef<NovelEditorHandle>(), initialDocument = manuscript('First', 'focus-first')
            initialDocument.content.content!.push({ type: 'paragraph', attrs: { nodeId: 'focus-second' }, content: [{ type: 'text', text: 'Second' }] })
            render(<NovelEditor ref={ref} {...props({ initialDocument })} />)
            await screen.findByLabelText('Scene manuscript')
            act(() => ref.current!.openBlockMove())
            const focus = vi.spyOn((ref.current!.getInstanceToken() as Editor).view, 'focus')
            fireEvent.click(screen.getByRole('button', { name: 'Move down' }))
            fireEvent.pointerDown(document.body)
            act(() => { for (const callback of frames.splice(0)) callback(0) })
            expect(focus).not.toHaveBeenCalled()
            expect(ref.current!.getDocument()!.content.content![0].attrs!.nodeId).toBe('focus-second')
        } finally { raf.mockRestore() }
    })
    it('keeps an ending ordered list canonical through selection, a dialog move and undo without appending prose', async () => {
        const ref = createRef<NovelEditorHandle>(), onDocumentChange = vi.fn()
        const initialDocument = identifyDocument({ type: 'doc', content: [{ type: 'orderedList', attrs: { nodeId: 'ending-list', start: 3 }, content: [
            { type: 'listItem', attrs: { nodeId: 'first-item' }, content: [{ type: 'paragraph', attrs: { nodeId: 'first-text' }, content: [{ type: 'text', text: 'First' }] }] },
            { type: 'listItem', attrs: { nodeId: 'second-item' }, content: [{ type: 'paragraph', attrs: { nodeId: 'second-text' }, content: [{ type: 'text', text: 'Second' }] }] },
        ] }] })
        render(<NovelEditor ref={ref} {...props({ initialDocument, onDocumentChange })} />)
        await screen.findByLabelText('Scene manuscript')
        act(() => { (ref.current!.getInstanceToken() as Editor).commands.setTextSelection(3); ref.current!.openBlockMove() })
        expect(ref.current!.getDocument()).toEqual(initialDocument); expect(onDocumentChange).not.toHaveBeenCalled()
        fireEvent.click(screen.getByRole('button', { name: 'Move down' }))
        expect(ref.current!.getDocument()!.content.content).toHaveLength(1)
        expect(ref.current!.getDocument()!.content.content![0].content!.map((node) => node.attrs!.nodeId)).toEqual(['second-item', 'first-item'])
        act(() => { (ref.current!.getInstanceToken() as Editor).commands.undo() })
        expect(ref.current!.getDocument()).toEqual(initialDocument)
    })
    it('moves a paragraph with the keyboard and undoes only that move while preserving stable selection', async () => {
        const ref = createRef<NovelEditorHandle>(), initialDocument = manuscript('First passage.', 'move-first'), onDocumentChange = vi.fn()
        initialDocument.content.content!.push({ type: 'paragraph', attrs: { nodeId: 'move-second' }, content: [{ type: 'text', text: 'Second passage.' }] })
        render(<NovelEditor ref={ref} {...props({ initialDocument, onDocumentChange })} />)
        const prose = await screen.findByLabelText('Scene manuscript')
        const editor = ref.current!.getInstanceToken() as Editor
        act(() => { editor.commands.setTextSelection(4) })
        const point = ref.current!.getPosition()
        fireEvent.keyDown(prose, { key: 'ArrowDown', altKey: true, shiftKey: true })
        expect(ref.current!.getDocument()!.content.content!.map((node) => node.attrs!.nodeId)).toEqual(['move-second', 'move-first'])
        expect(ref.current!.getPosition()!.anchor).toEqual(point!.anchor)
        expect(onDocumentChange).toHaveBeenCalled()
        act(() => { editor.commands.undo() })
        expect(ref.current!.getDocument()).toEqual(initialDocument)
    })
    it('refuses block movement in a reader and during an AI prompt without changing prose', async () => {
        const ref = createRef<NovelEditorHandle>(), initialDocument = manuscript('A passage.', 'move-guard'), onDocumentChange = vi.fn()
        initialDocument.content.content!.push({ type: 'paragraph', attrs: { nodeId: 'move-next' }, content: [{ type: 'text', text: 'Another passage.' }] })
        const base = props({ initialDocument, readOnly: true, onDocumentChange })
        const { rerender } = render(<NovelEditor ref={ref} {...base} />)
        const prose = await screen.findByLabelText('Scene manuscript')
        fireEvent.keyDown(prose, { key: 'ArrowDown', altKey: true, shiftKey: true })
        expect(ref.current!.getDocument()).toEqual(initialDocument)
        rerender(<NovelEditor ref={ref} {...base} readOnly={false} />)
        act(() => { (ref.current!.getInstanceToken() as Editor).commands.aiSetPrompting(true); ref.current!.openBlockMove() })
        expect(screen.queryByRole('dialog', { name: 'Move manuscript blocks' })).not.toBeInTheDocument()
        expect(ref.current!.getDocument()).toEqual(initialDocument); expect(onDocumentChange).not.toHaveBeenCalled()
    })
    it('opens an exact renamed saved reference by Alt+Enter in a reader without changing prose or context', async () => {
        const ref = createRef<NovelEditorHandle>(), initialDocument = manuscript('', 'reference-reader'), onDocumentChange = vi.fn(), onSetReferenceContext = vi.fn()
        initialDocument.content.content![0].content = [{ type: 'codexMention', attrs: { id: 'old-pin', label: 'Mira' } }, { type: 'text', text: ' waited.' }]
        render(<NovelEditor ref={ref} {...props({ initialDocument, readOnly: true, onDocumentChange, onSetReferenceContext, codexEntries: [], referenceEntries: [
            { id: 'old-pin', label: 'Mira before the storm', kind: 'character', enabled: false, removed: true, contextState: 'removed', description: 'The original lighthouse keeper.' },
            { id: 'other-pin', label: 'Mira', kind: 'character', enabled: true, description: 'A different physician.' },
        ] })} />)
        const prose = await screen.findByLabelText('Scene manuscript')
        const beforeInspection = ref.current!.getDocument()
        fireEvent.keyDown(prose, { key: 'Enter', altKey: true })
        await screen.findByRole('dialog', { name: 'Manuscript references' })
        expect(screen.getByText('The original lighthouse keeper.')).toBeInTheDocument()
        expect(screen.queryByText('A different physician.')).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /Include in AI context/ })).not.toBeInTheDocument()
        expect(ref.current!.getDocument()).toEqual(beforeInspection)
        expect(onDocumentChange).not.toHaveBeenCalled(); expect(onSetReferenceContext).not.toHaveBeenCalled()
    })
    it('requires an explicit duplicate-name choice for detected text and keeps enabled state unchanged', async () => {
        const ref = createRef<NovelEditorHandle>(), onDocumentChange = vi.fn(), onSetReferenceContext = vi.fn()
        const entries = [
            { id: 'keeper', label: 'Mira', kind: 'character' as const, enabled: false, description: 'Lighthouse keeper.' },
            { id: 'doctor', label: 'Mira', kind: 'character' as const, enabled: true, description: 'Court physician.' },
        ]
        render(<NovelEditor ref={ref} {...props({ initialDocument: manuscript('Mira waited.', 'duplicate-name'), codexEntries: entries, detectionNames: entries, onDocumentChange, onSetReferenceContext })} />)
        await screen.findByLabelText('Scene manuscript')
        act(() => { (ref.current!.getInstanceToken() as Editor).commands.setTextSelection(3); ref.current!.openReferences() })
        expect(screen.getByRole('group')).toHaveTextContent('Lighthouse keeper.')
        expect(screen.getByRole('group')).toHaveTextContent('Court physician.')
        expect(screen.queryByRole('button', { name: 'Include in AI context' })).not.toBeInTheDocument()
        expect(onDocumentChange).not.toHaveBeenCalled(); expect(onSetReferenceContext).not.toHaveBeenCalled()
    })
    it('refuses an autocomplete choice whose displayed source changed before the click', async () => {
        const ref = createRef<NovelEditorHandle>()
        const entry = { id: 'keeper', label: 'Mira', kind: 'character' as const, enabled: false, description: 'The lighthouse keeper.' }
        const base = props({ initialDocument: manuscript('@Mi', 'stale-choice'), codexEntries: [entry] })
        const { rerender } = render(<NovelEditor ref={ref} {...base} />)
        await screen.findByLabelText('Scene manuscript')
        act(() => { const editor = ref.current!.getInstanceToken() as Editor; editor.commands.setTextSelection(4); editor.commands.insertContent('r') })
        const option = await screen.findByRole('option', { name: /lighthouse keeper/ })
        rerender(<NovelEditor ref={ref} {...base} codexEntries={[{ ...entry, description: 'A changed source.' }]} />)
        const before = ref.current!.getDocument()
        fireEvent.click(option)
        expect(ref.current!.getDocument()).toEqual(before)
        expect(screen.getByRole('status')).toHaveTextContent('The reference changed.')
    })
    it('previews the keyboard-selected autocomplete source without inserting or enabling it', async () => {
        const ref = createRef<NovelEditorHandle>(), onSetReferenceContext = vi.fn()
        render(<NovelEditor ref={ref} {...props({ initialDocument: manuscript('@Mi', 'choice-preview'), codexEntries: [
            { id: 'keeper', label: 'Mira', kind: 'character', enabled: false, description: 'The original keeper.' },
            { id: 'doctor', label: 'Mira', kind: 'character', enabled: false, description: 'The court physician.' },
        ], onSetReferenceContext })} />)
        const prose = await screen.findByLabelText('Scene manuscript')
        act(() => { const editor = ref.current!.getInstanceToken() as Editor; editor.commands.setTextSelection(4); editor.commands.insertContent('r') })
        await screen.findByRole('option', { name: /original keeper/ })
        const before = ref.current!.getDocument()
        act(() => {
            fireEvent.keyDown(prose, { key: 'ArrowDown' })
            fireEvent.keyDown(prose, { key: 'Enter', altKey: true })
        })
        const dialog = await screen.findByRole('dialog', { name: 'Manuscript references' })
        expect(dialog).toHaveTextContent('The court physician.')
        expect(dialog).not.toHaveTextContent('The original keeper.')
        expect(ref.current!.getDocument()).toEqual(before)
        expect(onSetReferenceContext).not.toHaveBeenCalled()
    })
    it('creates a visible URL through the keyboard link dialog and undoes it as one edit',async()=>{
        const ref=createRef<NovelEditorHandle>(),initialDocument=manuscript('A saved passage.','link-p'),onDocumentChange=vi.fn()
        render(<NovelEditor ref={ref} {...props({initialDocument,onDocumentChange})}/> )
        const prose=await screen.findByLabelText('Scene manuscript');fireEvent.keyDown(prose,{key:'k',ctrlKey:true})
        await screen.findByRole('dialog',{name:'Manuscript link'})
        fireEvent.change(screen.getByLabelText('Destination URL'),{target:{value:'https://example.com/source'}})
        fireEvent.click(screen.getByRole('button',{name:'Apply link'}))
        expect(documentText(ref.current!.getDocument()!)).toBe('https://example.com/sourceA saved passage.')
        expect(onDocumentChange).toHaveBeenCalled()
        act(()=>{(ref.current!.getInstanceToken() as Editor).commands.undo()})
        expect(ref.current!.getDocument()).toEqual(initialDocument)
    })
    it('inspects a link in a reader without offering a document write',async()=>{
        const ref=createRef<NovelEditorHandle>(),initialDocument=manuscript('Read source','reader-link'),onDocumentChange=vi.fn()
        initialDocument.content.content![0].content![0].marks=[{type:'link',attrs:{href:'https://example.com/source',title:'Original title'}}]
        render(<NovelEditor ref={ref} {...props({initialDocument,readOnly:true,onDocumentChange})}/> )
        await screen.findByLabelText('Scene manuscript');act(()=>ref.current!.openLink())
        expect(screen.getByLabelText('Scene manuscript')).toHaveAttribute('aria-readonly','true')
        await screen.findByRole('dialog',{name:'Manuscript link'})
        expect(screen.getByLabelText('Destination URL')).toHaveValue('https://example.com/source')
        expect(screen.getByLabelText('Destination URL')).toHaveAttribute('readonly')
        expect(screen.queryByRole('button',{name:'Apply link'})).toBeNull();expect(onDocumentChange).not.toHaveBeenCalled()
    })
    it('changes typing preferences without remounting, rewriting, or moving the selection',async()=>{
        const ref=createRef<NovelEditorHandle>(),initialDocument=manuscript('Original "text".','typing-p'),onDocumentChange=vi.fn()
        const view=render(<NovelEditor ref={ref} {...props({initialDocument,onDocumentChange,typingPreferences:DEFAULT_TYPING,manuscriptLanguage:'English'})}/> )
        await screen.findByLabelText('Scene manuscript')
        const editor=ref.current!.getInstanceToken() as Editor;act(()=>{editor.commands.setTextSelection({from:2,to:7})})
        const before=ref.current!.getPosition()
        view.rerender(<NovelEditor ref={ref} {...props({initialDocument,onDocumentChange,typingPreferences:PLAIN_TYPING,manuscriptLanguage:'Español'})}/> )
        expect(ref.current!.getInstanceToken()).toBe(editor);expect(ref.current!.getPosition()).toEqual(before);expect(ref.current!.getDocument()).toEqual(initialDocument)
        expect(onDocumentChange).not.toHaveBeenCalled()
        act(()=>{
            editor.commands.setTextSelection(editor.state.doc.content.size-1)
            const {from,to}=editor.state.selection
            const handled=editor.view.someProp('handleTextInput',(handler)=>handler(editor.view,from,to,'"',()=>editor.state.tr.insertText('"',from,to)))
            if(!handled)editor.commands.insertContent('"')
        })
        expect(documentText(ref.current!.getDocument()!)).toBe('Original "text"."')
    })
    it('does not run a delayed result scroll after the reader wheels the viewport',async()=>{
        const frames:FrameRequestCallback[]=[],raf=vi.spyOn(window,'requestAnimationFrame').mockImplementation((callback)=>{frames.push(callback);return frames.length})
        try{
            const initialDocument=manuscript('A🙂 gate waits.','search-cancel'),onSearchReveal=vi.fn()
            render(<NovelEditor {...props({initialDocument,searchTarget:{document:initialDocument,startOffset:4,endOffset:8,quote:'gate',token:'cancel-scroll'},onSearchReveal})}/> )
            await waitFor(()=>expect(onSearchReveal).toHaveBeenCalledWith('cancel-scroll',true))
            const port=screen.getByTestId('novel-editor'),setScroll=vi.fn()
            Object.defineProperty(port,'scrollTop',{configurable:true,get:()=>0,set:setScroll})
            fireEvent.wheel(port,{deltaY:120})
            act(()=>{for(const callback of frames.splice(0))callback(0)})
            expect(setScroll).not.toHaveBeenCalled()
        }finally{raf.mockRestore()}
    })
    it('reports a blocked saved target without changing selection or prose',async()=>{
        const initialDocument=manuscript('A🙂 gate waits.','search-blocked'),onSearchReveal=vi.fn(),onDocumentChange=vi.fn()
        render(<NovelEditor {...props({initialDocument,onDocumentChange,searchTargetBlocked:true,searchTarget:{document:initialDocument,startOffset:4,endOffset:8,quote:'gate',token:'blocked'},onSearchReveal})}/> )
        await waitFor(()=>expect(onSearchReveal).toHaveBeenCalledWith('blocked',false))
        expect(document.querySelector('.search-match-active')).toBeNull();expect(onDocumentChange).not.toHaveBeenCalled()
    })
    it('reveals a saved result after creation without restoring an older view range or emitting a prose edit',async()=>{
        const ref=createRef<NovelEditorHandle>(),initialDocument=manuscript('A🙂 gate waits.','search-p'),onSearchReveal=vi.fn(),onDocumentChange=vi.fn()
        render(<NovelEditor ref={ref} {...props({initialDocument,onDocumentChange,
            initialPosition:{anchor:{nodeId:'search-p',offset:0},head:{nodeId:'search-p',offset:1},scrollTop:0},
            searchTarget:{document:initialDocument,startOffset:4,endOffset:8,quote:'gate',token:'exact-target'},onSearchReveal})}/> )
        await waitFor(()=>expect(onSearchReveal).toHaveBeenCalledWith('exact-target',true))
        expect(screen.getByText('gate',{selector:'.search-match-active'})).toBeInTheDocument()
        expect(ref.current!.getPosition()?.anchor).toEqual({nodeId:'search-p',offset:4})
        expect(ref.current!.getPosition()?.head).toEqual({nodeId:'search-p',offset:4})
        expect(onDocumentChange).not.toHaveBeenCalled()
    })
    beforeAll(() => {
        document.elementFromPoint = vi.fn(() => document.body)
        // jsdom has no layout, and the beat composer refuses to open without
        // caret coordinates.
        vi.spyOn(EditorView.prototype, 'coordsAtPos').mockReturnValue({ left: 40, right: 42, top: 80, bottom: 98 })
    })

    afterAll(() => {
        document.elementFromPoint = originalElementFromPoint
        vi.restoreAllMocks()
    })

    afterEach(() => {
        window.localStorage.clear()
    })

    it('renders a single flex-filling manuscript surface', async () => {
        render(<NovelEditor {...props()} />)

        const shell = screen.getByTestId('novel-editor')
        expect(shell).toHaveClass('flex', 'flex-col')

        const prose = await screen.findByLabelText('Scene manuscript')
        expect(prose).toHaveClass('story-editor-prose')

        await waitFor(() => expect(prose.parentElement).toHaveClass('flex', 'min-h-0', 'flex-1', 'flex-col'))
    })

    it('reads the latest resume point at creation and does not replace its saved scroll with the initial zero', async () => {
        const onPositionChange = vi.fn()
        const onActivate = vi.fn()
        const initialDocument = manuscript('The sealed letter waited by the window.', 'resume-block')
        const latest = { anchor: { nodeId: 'resume-block', offset: 9 }, head: { nodeId: 'resume-block', offset: 9 }, scrollTop: 640 }
        const getInitialPosition = vi.fn(() => latest)
        const options = props({ initialDocument, initialPosition: { ...latest, scrollTop: 20 }, getInitialPosition, onPositionChange, onActivate })
        render(<NovelEditor {...options} />)
        const prose = await screen.findByLabelText('Scene manuscript')
        const editor = (prose as HTMLElement & { editor: Editor }).editor
        await waitFor(() => expect(screen.getByTestId('novel-editor').scrollTop).toBe(640))
        expect(getInitialPosition).toHaveBeenCalledOnce()
        expect(editor.state.selection.anchor).toBe(10)
        expect(editor.state.selection.head).toBe(10)
        expect(onPositionChange).not.toHaveBeenCalled()
        expect(onActivate).not.toHaveBeenCalled()
        expect(options.onDocumentChange).not.toHaveBeenCalled()
        act(() => { editor.commands.setTextSelection(4) })
        expect(onPositionChange).toHaveBeenLastCalledWith({ anchor: { nodeId: 'resume-block', offset: 3 }, head: { nodeId: 'resume-block', offset: 3 }, scrollTop: 640 })
        expect(editor.getJSON()).toEqual(initialDocument.content)
        // An explicit focus may scroll to the caret; it follows the restore check.
        act(() => { editor.commands.focus() })
        await waitFor(() => expect(onActivate).toHaveBeenCalledOnce())
    })

    it('does not jump to an unrelated scroll location when the saved block no longer exists', async () => {
        render(<NovelEditor {...props({ initialDocument: manuscript('Current scene.', 'current-block'), initialPosition: {
            anchor: { nodeId: 'removed-block', offset: 5 }, head: { nodeId: 'removed-block', offset: 5 }, scrollTop: 9000,
        } })} />)
        await screen.findByLabelText('Scene manuscript')
        await waitFor(() => expect(screen.getByTestId('novel-editor').scrollTop).toBe(0))
    })

    it('restores a range only for the exact document and otherwise resumes a cursor at its head', async () => {
        const original = globalThis.crypto
        vi.stubGlobal('crypto', webcrypto)
        try {
            const saved = manuscript('The sealed letter waited by the window.', 'bound-block')
            const fingerprint = await positionFingerprints.positionDocumentFingerprint(saved)
            expect(fingerprint).toMatch(/^[a-f0-9]{64}$/)
            for (const same of [true, false]) {
                const view = render(<NovelEditor {...props({ initialDocument: same ? saved : manuscript('A later author changed the opening.', 'bound-block'), initialPosition: {
                    anchor: { nodeId: 'bound-block', offset: 9 }, head: { nodeId: 'bound-block', offset: 2 }, scrollTop: 360, documentFingerprint: fingerprint!,
                } })} />)
                const prose = await screen.findByLabelText('Scene manuscript')
                const editor = (prose as HTMLElement & { editor: Editor }).editor
                await waitFor(() => expect(screen.getByTestId('novel-editor').scrollTop).toBe(360))
                expect(editor.state.selection.anchor).toBe(same ? 10 : 3)
                expect(editor.state.selection.head).toBe(3)
                view.unmount()
            }
        } finally { vi.stubGlobal('crypto', original) }
    })

    it.each(['edit', 'pointer', 'key'])('does not apply a late verified resume range over a new user interaction (%s)', async (interaction) => {
        let finish!: (value: string | null) => void
        const proof = 'a'.repeat(64)
        const digest = vi.spyOn(positionFingerprints, 'editorPositionFingerprint').mockImplementation(() => new Promise((resolve) => { finish = resolve }))
        try {
            render(<NovelEditor {...props({ initialDocument: manuscript('The letter waited.', 'late-block'), initialPosition: {
                anchor: { nodeId: 'late-block', offset: 9 }, head: { nodeId: 'late-block', offset: 2 }, scrollTop: 900, documentFingerprint: proof,
            } })} />)
            const prose = await screen.findByLabelText('Scene manuscript')
            const editor = (prose as HTMLElement & { editor: Editor }).editor
            await waitFor(() => expect(digest).toHaveBeenCalledOnce())
            if(interaction==='edit')act(() => { editor.commands.insertContentAt(1, 'My new words. ') })
            else if(interaction==='pointer')fireEvent.pointerDown(screen.getByTestId('novel-editor'))
            else fireEvent.keyDown(screen.getByTestId('novel-editor'),{key:'Shift'})
            const selection = editor.state.selection.toJSON()
            await act(async () => { finish(proof); await Promise.resolve() })
            expect(editor.getText()).toBe(interaction==='edit'?'My new words. The letter waited.':'The letter waited.')
            expect(editor.state.selection.toJSON()).toEqual(selection)
            expect(screen.getByTestId('novel-editor').scrollTop).toBe(0)
        } finally { digest.mockRestore() }
    })

    it('falls back to a cursor when native fingerprinting is unavailable', async () => {
        const original = globalThis.crypto
        vi.stubGlobal('crypto', { subtle: undefined })
        try {
            render(<NovelEditor {...props({ initialDocument: manuscript('The letter waited.', 'no-crypto-block'), initialPosition: {
                anchor: { nodeId: 'no-crypto-block', offset: 9 }, head: { nodeId: 'no-crypto-block', offset: 2 }, scrollTop: 240, documentFingerprint: 'a'.repeat(64),
            } })} />)
            const prose = await screen.findByLabelText('Scene manuscript')
            const editor = (prose as HTMLElement & { editor: Editor }).editor
            await waitFor(() => expect(screen.getByTestId('novel-editor').scrollTop).toBe(240))
            expect(editor.state.selection.anchor).toBe(3)
            expect(editor.state.selection.head).toBe(3)
            expect(editor.getText()).toBe('The letter waited.')
        } finally { vi.stubGlobal('crypto', original) }
    })

    it('does not promote a superseded position when its fingerprint resolves', async () => {
        let finish!: (value: string | null) => void
        const digest = vi.spyOn(positionFingerprints, 'editorPositionFingerprint').mockImplementation(() => new Promise((resolve) => { finish = resolve }))
        const onPositionChange = vi.fn()
        try {
            render(<NovelEditor {...props({ initialDocument: manuscript('The letter waited.', 'superseded-block'), onPositionChange })} />)
            const prose = await screen.findByLabelText('Scene manuscript')
            const editor = (prose as HTMLElement & { editor: Editor }).editor
            act(() => { editor.commands.setTextSelection({ from: 2, to: 7 }) })
            expect(digest).toHaveBeenCalledOnce()
            act(() => { editor.commands.setTextSelection(4) })
            const count = onPositionChange.mock.calls.length
            await act(async () => { finish('a'.repeat(64)); await Promise.resolve() })
            expect(onPositionChange).toHaveBeenCalledTimes(count)
            expect(onPositionChange).toHaveBeenLastCalledWith({ anchor: { nodeId: 'superseded-block', offset: 3 }, head: { nodeId: 'superseded-block', offset: 3 }, scrollTop: 0 })
        } finally { digest.mockRestore() }
    })

    it('toggles visible whitespace without remounting, changing prose/caret, autosaving or consuming manual undo',async()=>{
        const ref=createRef<NovelEditorHandle>(),options=props({initialDocument:manuscript('A🙂  gate\t waits.','visibility-block')})
        let show!:(visible:boolean)=>void
        function Room(){const [visible,setVisible]=useState(false);show=setVisible;return <NovelEditor ref={ref} {...options} showInvisibles={visible}/>}
        render(<Room/>);const prose=await screen.findByLabelText('Scene manuscript'),editor=ref.current!.getInstanceToken() as Editor
        act(()=>{editor.commands.insertContentAt(1,'New ');editor.commands.setTextSelection({from:5,to:8})})
        const document=ref.current!.getDocument(),selection=editor.state.selection.toJSON(),updates=vi.mocked(options.onDocumentChange).mock.calls.length
        act(()=>show(true))
        await waitFor(()=>expect(prose.querySelector('.manuscript-invisible-marker')).not.toBeNull())
        expect(ref.current!.getInstanceToken()).toBe(editor);expect(ref.current!.getDocument()).toEqual(document)
        expect(editor.state.selection.toJSON()).toEqual(selection);expect(options.onDocumentChange).toHaveBeenCalledTimes(updates)
        act(()=>show(false));expect(prose.querySelector('.manuscript-invisible-marker')).toBeNull()
        act(()=>{editor.commands.undo()});expect(documentText(ref.current!.getDocument()!)).toBe('A🙂  gate\t waits.')
    })

    it('keeps the editor, rich document, selection and manual undo history when reading appearance changes', async () => {
        const options = props({ initialBody: 'The **sealed letter** waited by the window.' })
        let change!: (value: ReadingPreferences) => void
        function Room() {
            const [appearance, setAppearance] = useState(DEFAULT_READING)
            change = setAppearance
            return <div className="novel-reading-room" {...readingAttributes(appearance)}><NovelEditor {...options} /></div>
        }
        render(<Room />)
        const prose = await screen.findByLabelText('Scene manuscript')
        const editor = (prose as HTMLElement & { editor: Editor }).editor
        act(() => {
            editor.commands.insertContentAt(1, 'My ')
            editor.commands.setTextSelection({ from: 5, to: 11 })
        })
        const document = editor.getJSON()
        const selection = editor.state.selection.toJSON()
        const changes = vi.mocked(options.onDocumentChange).mock.calls.length
        for (const appearance of [readingPresets.close, readingPresets.spacious, DEFAULT_READING]) {
            act(() => change(appearance))
            expect(screen.getByLabelText('Scene manuscript')).toBe(prose)
            expect((prose as HTMLElement & { editor: Editor }).editor).toBe(editor)
            expect(editor.getJSON()).toEqual(document)
            expect(editor.state.selection.toJSON()).toEqual(selection)
            expect(options.onDocumentChange).toHaveBeenCalledTimes(changes)
        }
        act(() => { editor.commands.undo() })
        expect(editor.getText()).toBe('The sealed letter waited by the window.')
    })

    it('journals ordinary edits during review while excluding the proposed text', async () => {
        const onDocumentChange = vi.fn()
        render(<NovelEditor {...props({ initialBody: 'The gate held.', onDocumentChange })} />)
        const prose = await screen.findByLabelText('Scene manuscript')
        const editor = (prose as HTMLElement & { editor: Editor }).editor
        act(() => {
            editor.commands.aiStartPending(editor.state.doc.content.size - 1)
            editor.commands.aiInsertGeneration(editor.markdown!.parse('A proposal awaiting approval.'))
        })
        expect(onDocumentChange).not.toHaveBeenCalled()
        act(() => { editor.commands.insertContentAt(1, 'My new words. ') })
        expect(documentText(onDocumentChange.mock.calls[onDocumentChange.mock.calls.length-1][0])).toBe('My new words. The gate held.')
        expect(editor.storage.aiSuggestionState.phase).toBe('reviewing')
        expect(editor.getMarkdown()).not.toContain('awaiting approval')
    })
})

describe('NovelEditor keyboard ownership', () => {
    beforeAll(() => {
        document.elementFromPoint = vi.fn(() => document.body)
        vi.spyOn(EditorView.prototype, 'coordsAtPos').mockReturnValue({ left: 40, right: 42, top: 80, bottom: 98 })
    })

    afterAll(() => {
        document.elementFromPoint = originalElementFromPoint
        vi.restoreAllMocks()
    })

    async function openComposer() {
        render(<NovelEditor {...props({ initialBody: 'The gate held.' })} />)
        const shell = screen.getByTestId('novel-editor')
        fireEvent.keyDown(shell, { key: 'Enter', ctrlKey: true })
        return await screen.findByTestId('beat-instruction')
    }

    it('retains an unsent instruction across an offline transition while preventing keyboard and button submission', async () => {
        const onGenerate = vi.fn(), baseProps = props({ initialBody: 'The gate held.', onGenerate })
        const view = render(<NovelEditor {...baseProps} />)
        fireEvent.keyDown(screen.getByTestId('novel-editor'), { key: 'Enter', ctrlKey: true })
        const instruction = await screen.findByTestId('beat-instruction')
        fireEvent.change(instruction, { target: { value: 'Keep this instruction until the connection returns.' } })
        view.rerender(<NovelEditor {...baseProps} aiDisabled />)
        expect(screen.getByTestId('beat-instruction')).toHaveValue('Keep this instruction until the connection returns.')
        expect(screen.getByTestId('beat-write')).toBeDisabled()
        fireEvent.keyDown(screen.getByTestId('beat-instruction'), { key: 'Enter' })
        expect(onGenerate).not.toHaveBeenCalled()
        expect(screen.getByTestId('beat-instruction')).toHaveValue('Keep this instruction until the connection returns.')
    })

    it('continues from the caret with Mod-Shift-Enter only while completions are on', async () => {
        const onGenerate = vi.fn(() => new Promise<never>(() => {})), onRequestSaveFlush = vi.fn(async () => true)
        const view = render(<NovelEditor {...props({ initialBody: 'The gate held.', onGenerate, onRequestSaveFlush })} />)
        const surface = await screen.findByLabelText('Scene manuscript'), editor = (surface as HTMLElement & { editor: Editor }).editor
        // A real Enter (key code 13): the view cancels it, so only the prose keymap can answer.
        const press = () => fireEvent.keyDown(surface, { key: 'Enter', code: 'Enter', keyCode: 13, ctrlKey: true, shiftKey: true })
        act(() => { editor.commands.setTextSelection(editor.state.doc.content.size - 1) })
        press()
        await act(async () => {})
        expect(onGenerate).not.toHaveBeenCalled(); expect(editor.getMarkdown()).toBe('The gate held.')
        view.rerender(<NovelEditor {...props({ initialBody: 'The gate held.', onGenerate, onRequestSaveFlush, completionInstruction: 'Write one or two sentences that continue from the cursor.' })} />)
        act(() => { editor.commands.setTextSelection(editor.state.doc.content.size - 1) })
        press()
        await waitFor(() => expect(onGenerate).toHaveBeenCalledOnce())
        expect(onGenerate).toHaveBeenCalledWith(expect.objectContaining({ command: 'continue', cursorOffset: 14,
            instruction: 'Write one or two sentences that continue from the cursor.' }), expect.anything())
        expect(screen.queryByTestId('beat-composer')).not.toBeInTheDocument()
    })

    it('opens the beat composer at the caret with Mod-Enter', async () => {
        await openComposer()
        expect(screen.getByTestId('beat-composer')).toBeInTheDocument()
    })

    it('does not re-open (and wipe) itself when Mod-Enter fires from its own controls', async () => {
        const textarea = await openComposer()
        fireEvent.change(textarea, { target: { value: 'she follows him' } })
        expect(textarea).toHaveValue('she follows him')

        // The composer lives inside the scrollport, so its controls bubble to
        // the shell's shortcut handler.
        fireEvent.keyDown(screen.getByTestId('beat-options-toggle'), { key: 'Enter', ctrlKey: true, bubbles: true })

        expect(screen.getByTestId('beat-instruction')).toHaveValue('she follows him')
    })

    it('does not bury the composer under the find panel when Mod-F fires inside it', async () => {
        const textarea = await openComposer()

        fireEvent.keyDown(textarea, { key: 'f', ctrlKey: true, bubbles: true })

        expect(screen.queryByRole('search')).not.toBeInTheDocument()
        expect(screen.getByTestId('beat-composer')).toBeInTheDocument()
    })
})

describe('NovelEditor read-only (archived workspace)', () => {
    beforeAll(() => {
        document.elementFromPoint = vi.fn(() => document.body)
        vi.spyOn(EditorView.prototype, 'coordsAtPos').mockReturnValue({ left: 40, right: 42, top: 80, bottom: 98 })
    })

    afterAll(() => {
        document.elementFromPoint = originalElementFromPoint
        vi.restoreAllMocks()
    })

    it('reads and finds, but never edits, generates or removes a beat note', async () => {
        const onDocumentChange = vi.fn()
        const onGenerate = vi.fn()
        render(<NovelEditor {...props({ initialBody: '<!-- beat: More rain -->\n\nThe gate held.', readOnly: true, onDocumentChange, onGenerate })} />)

        expect(await screen.findByLabelText('Scene manuscript')).toHaveAttribute('contenteditable', 'false')
        const shell = screen.getByTestId('novel-editor')
        expect(shell).toHaveAttribute('data-readonly', 'true')

        // A beat note is a record, not a control: removing it would be an edit.
        fireEvent.click(screen.getByTestId('ai-beat-remove'))
        expect(screen.getByTestId('ai-beat')).toHaveTextContent('More rain')

        // Mod-Enter opens no composer.
        fireEvent.keyDown(shell, { key: 'Enter', ctrlKey: true })
        expect(screen.queryByTestId('beat-composer')).not.toBeInTheDocument()

        // Mod-F opens Find; Replace is disabled and says why.
        fireEvent.keyDown(shell, { key: 'f', ctrlKey: true })
        fireEvent.change(await screen.findByTestId('find-input'), { target: { value: 'gate' } })
        await waitFor(() => expect(screen.getByTestId('find-count')).toHaveTextContent('1'))
        expect(screen.getByTestId('replace-input')).toBeDisabled()
        expect(screen.getByTestId('replace-one')).toBeDisabled()
        expect(screen.getByTestId('replace-all')).toBeDisabled()
        expect(screen.getByTestId('find-archived')).toHaveTextContent('This workspace is archived. Restore it to create or edit content.')

        expect(onDocumentChange).not.toHaveBeenCalled()
        expect(onGenerate).not.toHaveBeenCalled()
    })

    it('follows the workspace when it is archived or restored while open', async () => {
        const { rerender } = render(<NovelEditor {...props({ initialBody: 'The gate held.' })} />)
        const prose = await screen.findByLabelText('Scene manuscript')
        expect(prose).toHaveAttribute('contenteditable', 'true')

        rerender(<NovelEditor {...props({ initialBody: 'The gate held.', readOnly: true })} />)
        await waitFor(() => expect(screen.getByLabelText('Scene manuscript')).toHaveAttribute('contenteditable', 'false'))

        rerender(<NovelEditor {...props({ initialBody: 'The gate held.', readOnly: false })} />)
        await waitFor(() => expect(screen.getByLabelText('Scene manuscript')).toHaveAttribute('contenteditable', 'true'))
    })
})
