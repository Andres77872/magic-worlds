import { act, renderHook } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from '@tiptap/markdown'
import { EditorView } from '@tiptap/pm/view'
import { undoDepth } from '@tiptap/pm/history'
import { manuscript, storyGeneration } from '@/test/fixtures/story'
import { identifyDocument, documentText } from '@/shared/storyDocument'
import type { StoryManuscriptDocument } from '@/shared'
import { AiSuggestion } from '../extensions/aiSuggestion'
import { ManuscriptIdentity } from '../extensions/manuscriptIdentity'
import { createCodexMention } from '../extensions/codexMention'
import { captureDocument } from '../manuscript'
import type { SavedGenerationReview } from '../types'
import { useInlineAI, type InlineAICallbacks } from './useInlineAI'
import wire from '@/test/fixtures/storyVariantsNative.json'
import type { StoryVariantSnapshot } from '@/shared'

const rich = identifyDocument({ type: 'doc', content: [
    { type: 'paragraph', content: [{ type: 'text', text: 'A 🌙 letter for ', marks: [{ type: 'bold' }] },
        { type: 'codexMention', attrs: { id: 'aria-pin', label: 'Aria' } }] },
    { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Keep the seal.' }] }] }] },
] })
const editors: Editor[] = []
afterEach(() => { editors.forEach(editor => editor.destroy()); editors.length = 0; vi.restoreAllMocks() })
function setup(document: StoryManuscriptDocument = rich) {
    vi.spyOn(EditorView.prototype as unknown as { scrollToSelection: () => void }, 'scrollToSelection').mockImplementation(() => {})
    const editor = new Editor({ element: window.document.createElement('div'),
        extensions: [StarterKit.configure({ trailingNode: false }), Markdown, ManuscriptIdentity, AiSuggestion, createCodexMention(() => [])], content: document.content })
    editors.push(editor)
    const callbacks: InlineAICallbacks = { onRequestSaveFlush: vi.fn(async () => true), onGenerate: vi.fn(),
        onAcceptGeneration: vi.fn(async () => {}), onDiscardGeneration: vi.fn(async () => {}), onCritiqueResult: vi.fn() }
    return { editor, callbacks, ...renderHook(() => useInlineAI(editor, callbacks)) }
}
function review(document: StoryManuscriptDocument, operation: SavedGenerationReview['operation']): SavedGenerationReview {
    const text = documentText(document), start = text.indexOf('letter')
    return { document, operation, generation: storyGeneration({ id: 'saved-assistant-candidate',
        command: operation === 'append_scene' ? 'continue' : 'rewrite', instruction: 'Keep the seal intact.',
        inputRange: operation === 'append_scene' ? null : operation === 'replace_scene'
            ? { startOffset: 0, endOffset: text.length, text } : { startOffset: start, endOffset: start + 6, text: 'letter' },
        output: operation === 'replace_scene' ? '# The reply\n\nA quiet answer.' : 'The letter arrived.' }) }
}

function authoredReview():SavedGenerationReview {
    const variant=structuredClone(wire.preview) as StoryVariantSnapshot,p=variant.parent.parent
    return {variant,document:variant.baseDocument,operation:'replace_scene',generation:storyGeneration({id:p.id,storyId:p.storyId,
        chapterId:p.chapterId,sceneId:p.sceneId,baseRevision:p.baseRevision,command:p.command,output:p.output,instruction:p.instruction,inputRange:null})}
}
it('reviews the exact authored JSON and IDs as one reversible event, without parsing or mutating the model output',async()=>{
    const saved=authoredReview(),test=setup(saved.document),original=structuredClone(saved.variant!),before=captureDocument(test.editor)
    const parse=vi.spyOn(test.editor.markdown!,'parse')
    act(()=>expect(test.result.current.reviewGeneration(saved)).toBe(true))
    expect(captureDocument(test.editor)).toEqual(before)
    expect(parse).not.toHaveBeenCalled()
    // The caller cannot mutate an already inspected decoration or its commit.
    saved.variant!.operation.document.content.content![0].content![0].text='Changed outside review'
    act(()=>{test.editor.commands.insertContentAt(1,'Unreviewed prefix')})
    expect(captureDocument(test.editor)).toEqual(before)
    await act(async()=>test.result.current.accept())
    expect(captureDocument(test.editor)).toEqual(original.operation.document)
    expect(test.callbacks.onAcceptGeneration).toHaveBeenCalledExactlyOnceWith(saved.generation.id,original)
    expect(saved.generation.output).toBe(original.parent.parent.output)
    expect(undoDepth(test.editor.state)).toBe(1)
    act(()=>expect(test.editor.commands.undo()).toBe(true));expect(captureDocument(test.editor)).toEqual(before)
    act(()=>expect(test.editor.commands.redo()).toBe(true));expect(captureDocument(test.editor)).toEqual(original.operation.document)
    act(()=>test.editor.commands.insertContentAt(1,'Later '))
    act(()=>expect(test.editor.commands.undo()).toBe(true));expect(captureDocument(test.editor)).toEqual(original.operation.document)
    expect(test.callbacks.onGenerate).not.toHaveBeenCalled();expect(parse).not.toHaveBeenCalled()
})
it('closing an authored review leaves both immutable saved versions available and makes no parent rejection',async()=>{
    const saved=authoredReview(),test=setup(saved.document),before=captureDocument(test.editor)
    act(()=>expect(test.result.current.reviewGeneration(saved)).toBe(true))
    await act(async()=>test.result.current.reject())
    expect(captureDocument(test.editor)).toEqual(before)
    expect(test.callbacks.onDiscardGeneration).not.toHaveBeenCalled()
    expect(test.callbacks.onAcceptGeneration).not.toHaveBeenCalled()
})
it.each(['parent_output','parent_identity','base','operation','document_shape'])('blocks authored %s drift before staging',change=>{
    const saved=authoredReview(),test=setup(saved.document),before=captureDocument(test.editor)
    if(change==='parent_output')saved.generation.output='Different model output'
    if(change==='parent_identity')saved.generation.id='another-parent'
    if(change==='base')saved.variant!.baseDocument=manuscript('Another base')
    if(change==='operation')saved.operation='replace_selection'
    if(change==='document_shape')saved.variant!.operation.document.content.content![0].attrs!.unsupported='unreviewed'
    act(()=>expect(test.result.current.reviewGeneration(saved)).toBe(false))
    expect(captureDocument(test.editor)).toEqual(before);expect(test.callbacks.onAcceptGeneration).not.toHaveBeenCalled()
})

it.each<SavedGenerationReview['operation']>(['replace_selection', 'replace_scene', 'append_scene'])('%s stays a decoration until acceptance, then commits once and supports exact undo', async operation => {
    const test = setup(), before = captureDocument(test.editor), saved = review(before, operation)
    act(() => expect(test.result.current.reviewGeneration(saved)).toBe(true))
    expect(captureDocument(test.editor)).toEqual(before)
    expect(test.editor.storage.aiSuggestionState.phase).toBe('reviewing')
    expect(test.result.current.canRegenerate).toBe(false)
    act(() => expect(test.result.current.reviewGeneration(saved)).toBe(false))
    await act(async () => { await test.result.current.accept(); await test.result.current.accept() })
    expect(test.callbacks.onAcceptGeneration).toHaveBeenCalledExactlyOnceWith('saved-assistant-candidate')
    expect(test.callbacks.onGenerate).not.toHaveBeenCalled()
    expect(test.callbacks.onRequestSaveFlush).not.toHaveBeenCalled()
    expect(documentText(captureDocument(test.editor))).toContain(operation === 'replace_scene' ? 'A quiet answer.' : 'The letter arrived.')
    if (operation === 'replace_scene') expect(captureDocument(test.editor).content.content?.[0].type).toBe('heading')
    else expect(captureDocument(test.editor).content.content?.[0].content?.some(node => node.type === 'codexMention' && node.attrs?.id === 'aria-pin')).toBe(true)
    expect(undoDepth(test.editor.state)).toBe(1)
    act(() => expect(test.editor.commands.undo()).toBe(true))
    expect(captureDocument(test.editor)).toEqual(before)
})

it('declining a saved review leaves the rich manuscript exact and records the original candidate', async () => {
    const test = setup(), before = captureDocument(test.editor), saved = review(before, 'replace_scene')
    saved.generation.status = 'stashed'
    act(() => expect(test.result.current.reviewGeneration(saved)).toBe(true))
    await act(async () => { await test.result.current.reject() })
    expect(captureDocument(test.editor)).toEqual(before)
    expect(test.callbacks.onDiscardGeneration).toHaveBeenCalledExactlyOnceWith(saved.generation.id)
    expect(test.callbacks.onAcceptGeneration).not.toHaveBeenCalled()
})

it('appending to an empty scene replaces its placeholder and undo restores the same empty block', async () => {
    const test = setup(manuscript('')), before = captureDocument(test.editor)
    act(() => expect(test.result.current.reviewGeneration(review(before, 'append_scene'))).toBe(true))
    await act(async () => { await test.result.current.accept() })
    expect(documentText(captureDocument(test.editor))).toBe('The letter arrived.')
    expect(captureDocument(test.editor).content.content).toHaveLength(1)
    act(() => test.editor.commands.undo())
    expect(captureDocument(test.editor)).toEqual(before)
})

it.each(['changed_document', 'wrong_quote', 'surrogate_half', 'partial_mention', 'accepted', 'rejected'])('blocks %s without staging or editing', change => {
    const test = setup(), before = captureDocument(test.editor), saved = review(before, 'replace_selection'), text = documentText(before)
    if (change === 'changed_document') saved.document = manuscript('Different saved source.')
    if (change === 'wrong_quote') saved.generation.inputRange!.text = 'LETTER'
    if (change === 'surrogate_half') { const at = text.indexOf('🌙'); saved.generation.inputRange = { startOffset: at + 1, endOffset: at + 2, text: text.slice(at + 1, at + 2) } }
    if (change === 'partial_mention') { const at = text.indexOf('@Aria'); saved.generation.inputRange = { startOffset: at + 1, endOffset: at + 4, text: text.slice(at + 1, at + 4) } }
    if (change === 'accepted' || change === 'rejected') saved.generation.status = change
    act(() => expect(test.result.current.reviewGeneration(saved)).toBe(false))
    expect(captureDocument(test.editor)).toEqual(before)
    expect(test.editor.storage.aiSuggestionState.phase).toBe('idle')
    expect(test.callbacks.onGenerate).not.toHaveBeenCalled()
    expect(test.callbacks.onAcceptGeneration).not.toHaveBeenCalled()
})
