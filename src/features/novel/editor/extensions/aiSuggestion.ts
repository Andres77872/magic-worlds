/** Review proposals live in decorations; only explicit acceptance edits prose. */
import { Extension, Mark, type JSONContent } from '@tiptap/core'
import { closeHistory } from '@tiptap/pm/history'
import { DOMSerializer, Fragment, Slice, type Node as PMNode } from '@tiptap/pm/model'
import { Plugin, PluginKey, type Transaction } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { InlineAIPhase } from '../types'
import { AI_BEAT_NODE_NAME } from './aiBeat'
import { renderActionRow, type AiActionRowModel } from './aiActionRow'
import { identifyManuscriptTransaction } from './manuscriptIdentity'
import { documentSignature, isStoryDocument, normalizeEditorDocument } from '@/shared/storyDocument'

export const AI_SUGGESTION_META = 'aiSuggestion$'
export const AI_SUGGESTION_MARK_NAME = 'aiSuggestion'
interface AiTrackState {
    pendingPos: number | null
    pendingRange: { from: number; to: number } | null
    preview: { content: JSONContent; inline: boolean; prompt?: string; exactSnapshot?: boolean } | null
}
export const aiTrackKey = new PluginKey<AiTrackState>('aiSuggestionTrack')
const EMPTY_TRACK: AiTrackState = { pendingPos: null, pendingRange: null, preview: null }
type AiTrackAction =
    | { type: 'startPending'; pos: number; range: { from: number; to: number } | null }
    | { type: 'preview'; content: JSONContent; inline: boolean; prompt?: string; exactSnapshot?: boolean }
    | { type: 'clear' }

export interface AiSuggestionOptions {
    onPhaseChange: (phase: InlineAIPhase) => void
    onEscape: (phase: InlineAIPhase) => void
    onAcceptRequest: () => void
    onRejectRequest: () => void
    onRegenerateRequest: () => void
    getRowModel: () => AiActionRowModel | null
}
export interface AiSuggestionStorage { phase: InlineAIPhase }
// Kept in the schema to render an approved fragment copied from a review.
const AiSuggestionMark = Mark.create({
    name: AI_SUGGESTION_MARK_NAME,
    inclusive: false,
    renderHTML: () => ['span', { class: 'ai-suggestion-text' }, 0],
})
declare module '@tiptap/core' {
    interface Storage { aiSuggestionState: AiSuggestionStorage }
    interface Commands<ReturnType> {
        aiSuggestion: {
            aiSetPrompting: (prompting: boolean) => ReturnType
            aiStartPending: (pos: number, range?: { from: number; to: number }) => ReturnType
            aiCancelPending: () => ReturnType
            aiInsertGeneration: (json: JSONContent, options?: { inline?: boolean; prompt?: string; exactSnapshot?: boolean }) => ReturnType
            aiAccept: () => ReturnType
            aiReject: () => ReturnType
            aiRegenerate: () => ReturnType
        }
    }
}
export function findAiSuggestionRange(doc: PMNode): { from: number; to: number } | null {
    let result: { from: number; to: number } | null = null
    doc.descendants((node, pos) => {
        if (node.marks.some((mark) => mark.type.name === AI_SUGGESTION_MARK_NAME)) {
            result = { from: result?.from ?? pos, to: pos + node.nodeSize }
        }
    })
    return result
}
function mapTrack(track: AiTrackState, tr: Transaction): AiTrackState {
    if (!tr.docChanged) return track
    return { ...track,
        pendingPos: track.pendingPos == null ? null : tr.mapping.map(track.pendingPos),
        pendingRange: track.pendingRange ? {
            from: tr.mapping.map(track.pendingRange.from, 1),
            to: tr.mapping.map(track.pendingRange.to, -1),
        } : null,
    }
}
function blockBoundaryAfter(doc: PMNode, pos: number): number {
    const at = Math.max(0, Math.min(pos, doc.content.size))
    const resolved = doc.resolve(at)
    return resolved.depth > 0 ? resolved.after(1) : at
}

export const AiSuggestion = Extension.create<AiSuggestionOptions, AiSuggestionStorage>({
    name: 'aiSuggestionState',
    addOptions: () => ({ onPhaseChange: () => {}, onEscape: () => {}, onAcceptRequest: () => {},
        onRejectRequest: () => {}, onRegenerateRequest: () => {}, getRowModel: () => null }),
    addStorage: () => ({ phase: 'idle' }),
    addExtensions: () => [AiSuggestionMark],
    addCommands() {
        const phase = (next: InlineAIPhase) => {
            if (next === this.storage.phase) return
            this.storage.phase = next
            this.options.onPhaseChange(next)
        }
        const meta = (tr: Transaction, action: AiTrackAction) =>
            tr.setMeta(aiTrackKey, action).setMeta(AI_SUGGESTION_META, true).setMeta('addToHistory', false)
        return {
            aiSetPrompting: (prompting) => ({ tr, dispatch }) => {
                if (prompting ? this.storage.phase !== 'idle' : this.storage.phase !== 'prompting') return false
                if (dispatch) { tr.setMeta(AI_SUGGESTION_META, true); phase(prompting ? 'prompting' : 'idle') }
                return true
            },
            aiStartPending: (pos, range) => ({ tr, dispatch }) => {
                if (this.storage.phase !== 'idle' && this.storage.phase !== 'prompting') return false
                if (dispatch) { meta(tr, { type: 'startPending', pos, range: range ?? null }); phase('pending') }
                return true
            },
            aiCancelPending: () => ({ tr, dispatch }) => {
                if (this.storage.phase !== 'pending') return false
                if (dispatch) { meta(tr, { type: 'clear' }); phase('idle') }
                return true
            },
            aiInsertGeneration: (json, options) => ({ state, tr, dispatch }) => {
                if (this.storage.phase !== 'pending' || !Fragment.fromJSON(state.schema, json.content ?? []).childCount) return false
                if (options?.exactSnapshot) {
                    const track = aiTrackKey.getState(state), document = { schemaVersion: 1, content: json }
                    if (options.inline || options.prompt || track?.pendingRange?.from !== 0 || track.pendingRange.to !== state.doc.content.size
                        || !isStoryDocument(document) || documentSignature(document) !== documentSignature({ schemaVersion: 1,
                            content: normalizeEditorDocument(state.schema.nodeFromJSON(json).toJSON()) })) return false
                }
                if (dispatch) {
                    meta(tr, { type: 'preview', content: structuredClone(json), inline: Boolean(options?.inline), prompt: options?.prompt, exactSnapshot: options?.exactSnapshot })
                    phase('reviewing')
                }
                return true
            },
            aiAccept: () => ({ state, tr, dispatch }) => {
                const track = aiTrackKey.getState(state)
                if (this.storage.phase !== 'reviewing' || !track?.preview) return false
                if (dispatch) {
                    const preview = track.preview
                    const content = Fragment.fromJSON(state.schema, preview.content.content ?? [])
                    const from = track.pendingRange?.from ?? track.pendingPos ?? state.selection.to
                    const to = track.pendingRange?.to ?? from
                    const open = preview.inline ? 1 : 0
                    const beat = state.schema.nodes[AI_BEAT_NODE_NAME]
                    const prompt = preview.prompt?.trim()
                    const withBeat = prompt && beat && !preview.inline
                        ? Fragment.from(beat.create({ prompt })).append(content) : content
                    // The first canonical edit is one isolated, undoable transaction.
                    closeHistory(tr)
                    if (preview.exactSnapshot) {
                        // A reviewed full snapshot never receives a fitted range,
                        // a beat block, or freshly assigned identities.
                        if (from !== 0 || to !== state.doc.content.size) return false
                        tr.replaceWith(0, state.doc.content.size, content)
                        if (documentSignature({ schemaVersion: 1, content: normalizeEditorDocument(tr.doc.toJSON()) })
                            !== documentSignature({ schemaVersion: 1, content: preview.content })) return false
                    } else tr.replaceRange(from, to, new Slice(withBeat, open, open))
                    // New block IDs belong to the accepted prose event. Deferring
                    // them until appendTransaction can create a second undo event
                    // after this extension closes the accepted history group.
                    identifyManuscriptTransaction(tr)
                    tr.setMeta(aiTrackKey, { type: 'clear' } satisfies AiTrackAction)
                    tr.setMeta(AI_SUGGESTION_META, true)
                    phase('idle')
                }
                return true
            },
            aiReject: () => ({ tr, dispatch }) => {
                if (this.storage.phase !== 'reviewing') return false
                if (dispatch) { meta(tr, { type: 'clear' }); phase('idle') }
                return true
            },
            aiRegenerate: () => ({ state, tr, dispatch }) => {
                const track = aiTrackKey.getState(state)
                if (this.storage.phase !== 'reviewing' || !track) return false
                if (dispatch) {
                    meta(tr, { type: 'startPending', pos: track.pendingPos ?? state.selection.to, range: track.pendingRange })
                    phase('pending')
                }
                return true
            },
        }
    },
    addKeyboardShortcuts() {
        const active = () => this.storage.phase === 'pending' || this.storage.phase === 'reviewing'
        return {
            Escape: () => { if (!active()) return false; this.options.onEscape(this.storage.phase); return true },
            'Mod-Enter': () => {
                if (this.storage.phase !== 'reviewing') return false
                this.options.onRegenerateRequest(); return true
            },
            'Mod-z': () => { if (!active()) return false; this.options.onRejectRequest(); return true },
            'Mod-y': active,
            'Mod-Shift-z': active,
        }
    },
    addProseMirrorPlugins() {
        const getPhase = () => this.storage.phase
        const getRowModel = () => this.options.getRowModel()
        return [new Plugin<AiTrackState>({
            key: aiTrackKey,
            // End the accepted event as well as starting it. Immediate typing
            // must undo separately from the author's accepted replacement.
            appendTransaction(transactions, _previous, next) {
                if (transactions.some((tr) => tr.docChanged && tr.getMeta(AI_SUGGESTION_META))) {
                    return closeHistory(next.tr).setMeta('addToHistory', false)
                }
                return null
            },
            // Edits outside a pending target remain ordinary edits. Edits through
            // the target require declining first; never silently rebase a quote.
            filterTransaction(tr, state) {
                if (!tr.docChanged || tr.getMeta(AI_SUGGESTION_META) || !['pending', 'reviewing'].includes(getPhase())) return true
                const track = aiTrackKey.getState(state)
                if (track?.preview?.exactSnapshot) return false
                const range = track?.pendingRange
                if (!range) return true
                let overlaps = false
                let mapped = range
                for (const map of tr.mapping.maps) {
                    map.forEach((from, to) => {
                        if (from < mapped.to && to > mapped.from) overlaps = true
                    })
                    mapped = { from: map.map(mapped.from, 1), to: map.map(mapped.to, -1) }
                }
                return !overlaps
            },
            state: {
                init: () => ({ ...EMPTY_TRACK }),
                apply(tr, value) {
                    const next = mapTrack(value, tr)
                    const action = tr.getMeta(aiTrackKey) as AiTrackAction | undefined
                    if (!action) return next
                    if (action.type === 'startPending') return { ...EMPTY_TRACK, pendingPos: action.pos, pendingRange: action.range }
                    if (action.type === 'preview') return { ...next, preview: action }
                    return { ...EMPTY_TRACK }
                },
            },
            props: {
                decorations(state) {
                    if (!['pending', 'reviewing'].includes(getPhase())) return null
                    const track = aiTrackKey.getState(state)
                    if (!track) return null
                    const anchor = track.pendingRange?.to ?? track.pendingPos
                    if (anchor == null) return null
                    const at = blockBoundaryAfter(state.doc, anchor)
                    const decorations: Decoration[] = []
                    if (track.pendingRange && track.pendingRange.to > track.pendingRange.from) {
                        decorations.push(Decoration.inline(track.pendingRange.from, track.pendingRange.to, { class: 'ai-pending-source' }))
                    }
                    if (track.preview) {
                        const preview = track.preview
                        decorations.push(Decoration.widget(at, () => {
                            const wrapper = document.createElement('div')
                            wrapper.className = 'ai-suggestion-text story-editor-prose'
                            wrapper.setAttribute('contenteditable', 'false')
                            wrapper.setAttribute('data-testid', 'ai-proposal-preview')
                            wrapper.append(DOMSerializer.fromSchema(state.schema).serializeFragment(
                                Fragment.fromJSON(state.schema, preview.content.content ?? [])))
                            return wrapper
                        }, { key: 'ai-preview', side: 1, ignoreSelection: true }))
                    }
                    const model = getRowModel()
                    if (model) decorations.push(Decoration.widget(at, () => renderActionRow(getRowModel), {
                        key: `ai-action-row:${model.state}:${model.meta}:${model.prompt}:${model.canRegenerate}:${model.labels.generating}`,
                        side: 2, marks: [], ignoreSelection: true,
                        stopEvent: (event) => Boolean((event.target as HTMLElement | null)?.closest?.('button')),
                    }))
                    return DecorationSet.create(state.doc, decorations)
                },
            },
        })]
    },
})
