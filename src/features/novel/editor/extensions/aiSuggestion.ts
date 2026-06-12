/**
 * AiSuggestion — the inline AI lifecycle inside the manuscript.
 *
 * Suggested prose is REAL document text carrying the `aiSuggestion` mark
 * (arcane tint): the user can read it in flow and edit it directly — any
 * non-AI edit while a suggestion is alive implicitly accepts it. The mark
 * declares no markdown rendering, so it can never leak syntax into the saved
 * body; the editor additionally suspends body emission while a suggestion is
 * alive.
 *
 * Positions (pending anchor, replaced range, typewriter cursor, suggestion
 * bounds) live in a ProseMirror plugin so they survive concurrent edits via
 * transaction mapping. The phase lives in extension storage for synchronous
 * access from keymaps and the slash trigger's `allow()` gate. Async work
 * (API calls, the typewriter timer) belongs to useInlineAI, not here.
 */

import { Extension, Mark } from '@tiptap/core'
import type { Node as PMNode, Slice } from '@tiptap/pm/model'
import { Plugin, PluginKey, TextSelection, type Transaction } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { InlineAIPhase } from '../types'
import { AI_SUGGESTION_MARK_NAME, type RevealStep } from './revealPlan'

/** Transaction meta flag marking AI-owned transactions (never implicit-accept triggers). */
export const AI_SUGGESTION_META = 'aiSuggestion$'

export const aiTrackKey = new PluginKey<AiTrackState>('aiSuggestionTrack')

interface AiTrackState {
    /** Where the pending shimmer widget sits (continue/describe flows). */
    pendingPos: number | null
    /** Selection to be replaced when the response arrives (rewrite/expand/condense). */
    pendingRange: { from: number; to: number } | null
    /** Typewriter insertion point. */
    cursor: number | null
    suggestStart: number | null
    suggestEnd: number | null
}

type AiTrackAction =
    | { type: 'startPending'; pos: number; range: { from: number; to: number } | null }
    | { type: 'beginReveal'; anchor: number }
    | { type: 'step'; cursor: number }
    | { type: 'clear' }

const EMPTY_TRACK: AiTrackState = { pendingPos: null, pendingRange: null, cursor: null, suggestStart: null, suggestEnd: null }

export interface AiSuggestionOptions {
    onPhaseChange: (phase: InlineAIPhase) => void
    /** A non-AI doc change happened while revealing/reviewing. */
    onImplicitAccept: () => void
    /** Escape pressed during pending/revealing/reviewing (prompting is the menu's). */
    onEscape: (phase: InlineAIPhase) => void
    /** Tab/Enter pressed while reviewing. */
    onAcceptRequest: () => void
    /** Mod-z while revealing/reviewing (undo-as-reject). */
    onRejectRequest: () => void
}

export interface AiSuggestionStorage {
    phase: InlineAIPhase
    original: Slice | null
    originalFrom: number | null
}

const AiSuggestionMark = Mark.create({
    name: AI_SUGGESTION_MARK_NAME,
    inclusive: false,
    renderHTML() {
        return ['span', { class: 'ai-suggestion-text' }, 0]
    },
    // No parseHTML and no renderMarkdown: the mark cannot round-trip through
    // paste or leak into serialized markdown.
})

declare module '@tiptap/core' {
    interface Storage {
        aiSuggestionState: AiSuggestionStorage
    }
    interface Commands<ReturnType> {
        aiSuggestion: {
            /** idle ↔ prompting (slash menu open/close). */
            aiSetPrompting: (prompting: boolean) => ReturnType
            aiStartPending: (pos: number, range?: { from: number; to: number }) => ReturnType
            aiCancelPending: () => ReturnType
            aiBeginReveal: () => ReturnType
            aiInsertStep: (step: RevealStep) => ReturnType
            aiFinishReveal: () => ReturnType
            aiAccept: () => ReturnType
            aiReject: () => ReturnType
        }
    }
}

function mapTrack(track: AiTrackState, tr: Transaction): AiTrackState {
    if (!tr.docChanged) return track
    const map = (pos: number | null, assoc: -1 | 1 = 1) => (pos == null ? null : tr.mapping.map(pos, assoc))
    return {
        pendingPos: map(track.pendingPos),
        pendingRange: track.pendingRange
            ? { from: tr.mapping.map(track.pendingRange.from, -1), to: tr.mapping.map(track.pendingRange.to, 1) }
            : null,
        cursor: map(track.cursor),
        suggestStart: map(track.suggestStart, -1),
        suggestEnd: map(track.suggestEnd, 1),
    }
}

/** Union of all ranges carrying the aiSuggestion mark (mark scan, position-safe). */
export function findAiSuggestionRange(doc: PMNode): { from: number; to: number } | null {
    let from: number | null = null
    let to: number | null = null
    doc.descendants((node, pos) => {
        if (node.marks.some((mark) => mark.type.name === AI_SUGGESTION_MARK_NAME)) {
            if (from == null || pos < from) from = pos
            const end = pos + node.nodeSize
            if (to == null || end > to) to = end
        }
        return true
    })
    return from != null && to != null ? { from, to } : null
}

function createPendingWidget(): HTMLElement {
    const widget = document.createElement('span')
    widget.className = 'ai-pending-widget'
    widget.setAttribute('aria-live', 'polite')
    widget.textContent = '✦ conjuring…'
    return widget
}

export const AiSuggestion = Extension.create<AiSuggestionOptions, AiSuggestionStorage>({
    name: 'aiSuggestionState',

    addOptions() {
        return {
            onPhaseChange: () => {},
            onImplicitAccept: () => {},
            onEscape: () => {},
            onAcceptRequest: () => {},
            onRejectRequest: () => {},
        }
    },

    addStorage() {
        return { phase: 'idle', original: null, originalFrom: null }
    },

    addExtensions() {
        return [AiSuggestionMark]
    },

    addCommands() {
        const setPhase = (phase: InlineAIPhase) => {
            if (this.storage.phase === phase) return
            this.storage.phase = phase
            this.options.onPhaseChange(phase)
        }

        return {
            aiSetPrompting:
                (prompting: boolean) =>
                ({ tr, dispatch }) => {
                    const phase = this.storage.phase
                    if (prompting && phase !== 'idle') return false
                    if (!prompting && phase !== 'prompting') return false
                    if (dispatch) {
                        tr.setMeta(AI_SUGGESTION_META, true)
                        setPhase(prompting ? 'prompting' : 'idle')
                    }
                    return true
                },

            aiStartPending:
                (pos: number, range?: { from: number; to: number }) =>
                ({ tr, dispatch }) => {
                    if (this.storage.phase !== 'idle' && this.storage.phase !== 'prompting') return false
                    if (dispatch) {
                        tr.setMeta(aiTrackKey, { type: 'startPending', pos, range: range ?? null } satisfies AiTrackAction)
                        tr.setMeta(AI_SUGGESTION_META, true)
                        setPhase('pending')
                    }
                    return true
                },

            aiCancelPending:
                () =>
                ({ tr, dispatch }) => {
                    if (this.storage.phase !== 'pending') return false
                    if (dispatch) {
                        tr.setMeta(aiTrackKey, { type: 'clear' } satisfies AiTrackAction)
                        tr.setMeta(AI_SUGGESTION_META, true)
                        setPhase('idle')
                    }
                    return true
                },

            aiBeginReveal:
                () =>
                ({ state, tr, dispatch }) => {
                    if (this.storage.phase !== 'pending') return false
                    const track = aiTrackKey.getState(state) ?? EMPTY_TRACK
                    const range = track.pendingRange
                    const anchor = range ? range.from : (track.pendingPos ?? state.selection.to)
                    if (dispatch) {
                        if (range && range.to > range.from) {
                            this.storage.original = state.doc.slice(range.from, range.to)
                            this.storage.originalFrom = range.from
                            tr.delete(range.from, range.to)
                        } else {
                            this.storage.original = null
                            this.storage.originalFrom = null
                        }
                        tr.setMeta(aiTrackKey, { type: 'beginReveal', anchor } satisfies AiTrackAction)
                        tr.setMeta(AI_SUGGESTION_META, true)
                        tr.setSelection(TextSelection.create(tr.doc, Math.min(anchor, tr.doc.content.size)))
                        setPhase('revealing')
                    }
                    return true
                },

            aiInsertStep:
                (step: RevealStep) =>
                ({ state, tr, dispatch }) => {
                    if (this.storage.phase !== 'revealing') return false
                    const track = aiTrackKey.getState(state) ?? EMPTY_TRACK
                    let pos = track.cursor ?? state.selection.to
                    if (!dispatch) return true

                    const clamp = (value: number) => Math.max(0, Math.min(value, tr.doc.content.size))
                    pos = clamp(pos)

                    try {
                        if (step.kind === 'text') {
                            if (!tr.doc.resolve(pos).parent.isTextblock) {
                                const paragraph = state.schema.nodes.paragraph.createAndFill()
                                if (paragraph) {
                                    tr.insert(pos, paragraph)
                                    pos += 1
                                }
                            }
                            const aiMark = state.schema.marks[AI_SUGGESTION_MARK_NAME]
                            const marks = (step.marks ?? [])
                                .map((mark) => state.schema.marks[mark.type]?.create(mark.attrs))
                                .filter((mark): mark is NonNullable<typeof mark> => Boolean(mark))
                            marks.push(aiMark.create())
                            tr.insert(pos, state.schema.text(step.text, marks))
                            pos += step.text.length
                        } else if (step.kind === 'atom') {
                            const node = state.schema.nodeFromJSON(step.node)
                            tr.insert(pos, node)
                            pos += node.nodeSize
                        } else if (step.kind === 'newBlock') {
                            const type = state.schema.nodes[step.nodeType] ?? state.schema.nodes.paragraph
                            const attrs = (step.attrs ?? null) as Record<string, unknown> | null
                            const $pos = tr.doc.resolve(pos)
                            if (!$pos.parent.isTextblock) {
                                const node = type.createAndFill(attrs)
                                if (!node) return false
                                tr.insert(pos, node)
                                pos += 1
                            } else if ($pos.parent.content.size === 0) {
                                if ($pos.parent.type !== type) tr.setBlockType(pos, pos, type, attrs)
                            } else {
                                tr.split(pos)
                                pos = tr.mapping.map(pos, 1)
                                if (tr.doc.resolve(pos).parent.type !== type) tr.setBlockType(pos, pos, type, attrs)
                            }
                        } else {
                            // Whole complex block (blockquote, list, hr, …).
                            const node = state.schema.nodeFromJSON(step.node)
                            let $pos = tr.doc.resolve(pos)
                            if ($pos.parent.isTextblock && $pos.parent.content.size > 0) {
                                tr.split(pos)
                                pos = tr.mapping.map(pos, 1)
                                $pos = tr.doc.resolve(pos)
                            }
                            if ($pos.parent.isTextblock) {
                                const before = $pos.before()
                                tr.insert(before, node)
                                pos = before + node.nodeSize + 1
                            } else {
                                tr.insert(pos, node)
                                pos += node.nodeSize
                            }
                        }
                    } catch (error) {
                        // A malformed step must never kill the reveal loop.
                        console.warn('aiInsertStep skipped a step:', error)
                        return true
                    }

                    tr.setMeta(aiTrackKey, { type: 'step', cursor: pos } satisfies AiTrackAction)
                    tr.setMeta(AI_SUGGESTION_META, true)
                    tr.setSelection(TextSelection.create(tr.doc, Math.min(pos, tr.doc.content.size)))
                    tr.scrollIntoView()
                    return true
                },

            aiFinishReveal:
                () =>
                ({ tr, dispatch }) => {
                    if (this.storage.phase !== 'revealing') return false
                    if (dispatch) {
                        tr.setMeta(AI_SUGGESTION_META, true)
                        setPhase('reviewing')
                    }
                    return true
                },

            aiAccept:
                () =>
                ({ state, tr, dispatch }) => {
                    if (this.storage.phase !== 'revealing' && this.storage.phase !== 'reviewing') return false
                    if (dispatch) {
                        const markType = state.schema.marks[AI_SUGGESTION_MARK_NAME]
                        tr.removeMark(0, tr.doc.content.size, markType)
                        tr.setMeta(aiTrackKey, { type: 'clear' } satisfies AiTrackAction)
                        tr.setMeta(AI_SUGGESTION_META, true)
                        this.storage.original = null
                        this.storage.originalFrom = null
                        setPhase('idle')
                    }
                    return true
                },

            aiReject:
                () =>
                ({ state, tr, dispatch }) => {
                    if (this.storage.phase !== 'revealing' && this.storage.phase !== 'reviewing') return false
                    const track = aiTrackKey.getState(state) ?? EMPTY_TRACK
                    if (dispatch) {
                        const start = track.suggestStart
                        const end = track.suggestEnd
                        if (start != null && end != null && end > start) {
                            tr.delete(start, Math.min(end, tr.doc.content.size))
                            // A reused empty block may have been retyped (e.g. to a
                            // heading) without a deletable boundary — revert it.
                            const $start = tr.doc.resolve(Math.min(start, tr.doc.content.size))
                            if (
                                $start.parent.isTextblock &&
                                $start.parent.content.size === 0 &&
                                $start.parent.type !== state.schema.nodes.paragraph
                            ) {
                                const at = Math.min(start, tr.doc.content.size)
                                tr.setBlockType(at, at, state.schema.nodes.paragraph)
                            }
                        }
                        if (this.storage.original && this.storage.originalFrom != null) {
                            const insertAt = Math.min(this.storage.originalFrom, tr.doc.content.size)
                            tr.replaceRange(insertAt, insertAt, this.storage.original)
                        }
                        tr.setMeta(aiTrackKey, { type: 'clear' } satisfies AiTrackAction)
                        tr.setMeta(AI_SUGGESTION_META, true)
                        if (start != null) {
                            tr.setSelection(TextSelection.create(tr.doc, Math.min(start, tr.doc.content.size)))
                        }
                        this.storage.original = null
                        this.storage.originalFrom = null
                        setPhase('idle')
                    }
                    return true
                },
        }
    },

    addKeyboardShortcuts() {
        return {
            Escape: () => {
                const phase = this.storage.phase
                // 'prompting' belongs to the slash menu's own key handling.
                if (phase === 'pending' || phase === 'revealing' || phase === 'reviewing') {
                    this.options.onEscape(phase)
                    return true
                }
                return false
            },
            Tab: () => {
                if (this.storage.phase !== 'reviewing') return false
                this.options.onAcceptRequest()
                return true
            },
            Enter: () => {
                if (this.storage.phase !== 'reviewing') return false
                this.options.onAcceptRequest()
                return true
            },
            'Mod-z': () => {
                const phase = this.storage.phase
                if (phase !== 'revealing' && phase !== 'reviewing') return false
                this.options.onRejectRequest()
                return true
            },
        }
    },

    onTransaction({ transaction }) {
        if (!transaction.docChanged) return
        if (transaction.getMeta(AI_SUGGESTION_META)) return
        const phase = this.storage.phase
        if (phase === 'revealing' || phase === 'reviewing') this.options.onImplicitAccept()
    },

    addProseMirrorPlugins() {
        const getPhase = () => this.storage.phase
        return [
            new Plugin<AiTrackState>({
                key: aiTrackKey,
                state: {
                    init: () => ({ ...EMPTY_TRACK }),
                    apply(tr, value) {
                        let next = mapTrack(value, tr)
                        const action = tr.getMeta(aiTrackKey) as AiTrackAction | undefined
                        if (action) {
                            if (action.type === 'startPending') {
                                next = { ...EMPTY_TRACK, pendingPos: action.pos, pendingRange: action.range }
                            } else if (action.type === 'beginReveal') {
                                next = {
                                    ...EMPTY_TRACK,
                                    cursor: action.anchor,
                                    suggestStart: action.anchor,
                                    suggestEnd: action.anchor,
                                }
                            } else if (action.type === 'step') {
                                next = { ...next, cursor: action.cursor, suggestEnd: action.cursor }
                            } else {
                                next = { ...EMPTY_TRACK }
                            }
                        }
                        return next
                    },
                },
                props: {
                    decorations(state) {
                        if (getPhase() !== 'pending') return null
                        const track = aiTrackKey.getState(state)
                        if (!track) return null
                        const decorations: Decoration[] = []
                        if (track.pendingRange && track.pendingRange.to > track.pendingRange.from) {
                            decorations.push(
                                Decoration.inline(track.pendingRange.from, track.pendingRange.to, { class: 'ai-pending-source' }),
                            )
                            decorations.push(Decoration.widget(track.pendingRange.to, createPendingWidget, { side: 1 }))
                        } else if (track.pendingPos != null) {
                            decorations.push(Decoration.widget(track.pendingPos, createPendingWidget, { side: 1 }))
                        }
                        return decorations.length > 0 ? DecorationSet.create(state.doc, decorations) : null
                    },
                },
            }),
        ]
    },
})
