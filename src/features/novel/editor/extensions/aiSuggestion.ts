/**
 * AiSuggestion — the inline AI lifecycle inside the manuscript.
 *
 * Generated prose is REAL document text carrying the `aiSuggestion` mark
 * (arcane tint): the writer reads it in flow and can edit it directly — any
 * non-AI edit while it is live implicitly accepts it. The mark declares no
 * markdown rendering, so it can never leak syntax into the saved body; the
 * editor additionally suspends body emission while it is alive.
 *
 * The whole generation lands in ONE transaction. There is no typewriter and no
 * `revealing` phase: text you cannot skim until an interval finishes is an
 * animation in the way of reading, and per-tick transactions made a single
 * undo unwind 18ms of a beat. One transaction also means one history event, so
 * ⌘Z after accepting removes the generation, not a chunk of it.
 *
 * The decision controls are a widget decoration at the block boundary after
 * the run (see aiActionRow) — document content, so they are attached to the
 * text by construction rather than positioned against it.
 *
 * Positions (pending anchor, replaced range, suggestion bounds) live in a
 * ProseMirror plugin so they survive concurrent edits via transaction mapping.
 * The phase lives in extension storage for synchronous access from keymaps and
 * the slash trigger's `allow()` gate. Async work belongs to useInlineAI.
 */

import { Extension, Mark, type JSONContent } from '@tiptap/core'
import { AI_BEAT_NODE_NAME } from './aiBeat'
import { Fragment, Slice, type Mark as PMMark, type Node as PMNode } from '@tiptap/pm/model'
import { Plugin, PluginKey, TextSelection, type Transaction } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { InlineAIPhase } from '../types'
import { renderActionRow, type AiActionRowModel } from './aiActionRow'

/** Transaction meta flag marking AI-owned transactions (never implicit-accept triggers). */
export const AI_SUGGESTION_META = 'aiSuggestion$'

export const AI_SUGGESTION_MARK_NAME = 'aiSuggestion'

export const aiTrackKey = new PluginKey<AiTrackState>('aiSuggestionTrack')

interface AiTrackState {
    /** Where the action row sits while a request is in flight (continuation flows). */
    pendingPos: number | null
    /** Passage to be replaced when the response arrives (rewrite/expand/condense). */
    pendingRange: { from: number; to: number } | null
    suggestStart: number | null
    suggestEnd: number | null
}

type AiTrackAction =
    | { type: 'startPending'; pos: number; range: { from: number; to: number } | null }
    | { type: 'inserted'; from: number; to: number }
    | { type: 'clear' }

const EMPTY_TRACK: AiTrackState = { pendingPos: null, pendingRange: null, suggestStart: null, suggestEnd: null }

export interface AiSuggestionOptions {
    onPhaseChange: (phase: InlineAIPhase) => void
    /** A non-AI doc change happened while a suggestion was under review. */
    onImplicitAccept: () => void
    /** Escape pressed during pending/reviewing (prompting is the menu's). */
    onEscape: (phase: InlineAIPhase) => void
    /** Tab/Enter pressed while reviewing. */
    onAcceptRequest: () => void
    /** Mod-z while reviewing (undo-as-decline), or Mod-z while pending (cancel). */
    onRejectRequest: () => void
    /** Mod-Enter while reviewing. */
    onRegenerateRequest: () => void
    /** Live model for the in-document action row; null hides it. */
    getRowModel: () => AiActionRowModel | null
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
            /** pending → reviewing. The whole generation, one transaction. */
            aiInsertGeneration: (json: JSONContent, options?: { inline?: boolean; prompt?: string }) => ReturnType
            aiAccept: () => ReturnType
            aiReject: () => ReturnType
            /** reviewing → pending, in place: restore the original and re-arm the same anchor. */
            aiRegenerate: () => ReturnType
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

/**
 * Apply the suggestion mark to every inline node in a fragment, BEFORE it is
 * inserted. Marking afterwards would mean knowing where the content landed —
 * and `tr.replace` refits a closed slice, so the inserted end is not simply
 * the anchor mapped forward.
 */
function markInline(fragment: Fragment, mark: PMMark): Fragment {
    const marked: PMNode[] = []
    fragment.forEach((child) => {
        marked.push(child.isInline ? child.mark(mark.addToSet(child.marks)) : child.copy(markInline(child.content, mark)))
    })
    return Fragment.fromArray(marked)
}

/**
 * Where the content inserted by the steps from `stepsBefore` onward ends.
 *
 * Neither of the obvious answers works. Mapping the insertion point forward
 * returns the insertion point: `tr.replace` refits a closed slice into a single
 * step that swallows the host paragraph's closing token, and a position at the
 * start of a non-empty replaced range always maps to the start. Adding the
 * document's growth undershoots for the same reason — the region begins after
 * the anchor, not at it. The step maps themselves report the changed range in
 * the new document, so ask them.
 */
function insertedEnd(tr: Transaction, stepsBefore: number, fallback: number): number {
    let end = fallback
    for (let index = stepsBefore; index < tr.steps.length; index += 1) {
        tr.steps[index].getMap().forEach((_oldStart, _oldEnd, _newStart, newEnd) => {
            // Later steps can move it again; carry it through them.
            const mapped = tr.mapping.slice(index + 1).map(newEnd, 1)
            if (mapped > end) end = mapped
        })
    }
    return Math.min(end, tr.doc.content.size)
}

/** The position just after the top-level block containing `pos`. */
function blockBoundaryAfter(doc: PMNode, pos: number): number {
    const clamped = Math.max(0, Math.min(pos, doc.content.size))
    const $pos = doc.resolve(clamped)
    // `.after(1)`, not `.after()`: a run ending inside a list item or blockquote
    // must place the row after the whole top-level block, and depth 0 throws.
    return $pos.depth > 0 ? $pos.after(1) : clamped
}

/**
 * Delete the live suggestion and put the writer's own passage back, byte for
 * byte. Shared by reject and regenerate — a second copy of this is how the two
 * paths drift apart.
 */
function restoreOriginal(
    tr: Transaction,
    schema: PMNode['type']['schema'],
    track: AiTrackState,
    storage: AiSuggestionStorage,
): { pos: number; range: { from: number; to: number } | null } {
    const start = track.suggestStart
    const end = track.suggestEnd
    if (start != null && end != null && end > start) {
        tr.delete(start, Math.min(end, tr.doc.content.size))
        // A reused empty block may have been retyped (e.g. to a heading) without
        // a deletable boundary — revert it.
        const $start = tr.doc.resolve(Math.min(start, tr.doc.content.size))
        if (
            $start.parent.isTextblock &&
            $start.parent.content.size === 0 &&
            $start.parent.type !== schema.nodes.paragraph
        ) {
            const at = Math.min(start, tr.doc.content.size)
            tr.setBlockType(at, at, schema.nodes.paragraph)
        }
    }
    let range: { from: number; to: number } | null = null
    if (storage.original && storage.originalFrom != null) {
        const insertAt = Math.min(storage.originalFrom, tr.doc.content.size)
        const stepsBefore = tr.steps.length
        tr.replaceRange(insertAt, insertAt, storage.original)
        range = { from: insertAt, to: tr.mapping.slice(stepsBefore).map(insertAt, 1) }
    }
    storage.original = null
    storage.originalFrom = null
    return { pos: range ? range.from : (start ?? tr.selection.to), range }
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
            onRegenerateRequest: () => {},
            getRowModel: () => null,
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
                        tr.setMeta('addToHistory', false)
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
                        tr.setMeta('addToHistory', false)
                        this.storage.original = null
                        this.storage.originalFrom = null
                        setPhase('idle')
                    }
                    return true
                },

            aiInsertGeneration:
                (json: JSONContent, options?: { inline?: boolean; prompt?: string }) =>
                ({ state, tr, dispatch }) => {
                    if (this.storage.phase !== 'pending') return false
                    const content = Fragment.fromJSON(state.schema, json.content ?? [])
                    if (content.childCount === 0) return false
                    const track = aiTrackKey.getState(state) ?? EMPTY_TRACK
                    const range = track.pendingRange
                    const anchor = range ? range.from : (track.pendingPos ?? state.selection.to)
                    if (!dispatch) return true

                    if (range && range.to > range.from) {
                        this.storage.original = state.doc.slice(range.from, range.to)
                        this.storage.originalFrom = range.from
                        tr.delete(range.from, range.to)
                    } else {
                        this.storage.original = null
                        this.storage.originalFrom = null
                    }

                    const from = Math.max(0, Math.min(anchor, tr.doc.content.size))
                    // Open ends flow the first and last block into the surrounding
                    // textblock, which is what a mid-paragraph rewrite needs.
                    const open = options?.inline ? 1 : 0
                    // The beat note leads the run it asked for, so declining takes
                    // it away with the prose and accepting keeps both. It is a
                    // block, so it cannot join a mid-paragraph rewrite: those
                    // record their prompt on the action row and in the history.
                    const beatType = state.schema.nodes[AI_BEAT_NODE_NAME]
                    const prompt = options?.prompt?.trim()
                    const withBeat =
                        prompt && beatType && !options?.inline
                            ? Fragment.from(beatType.create({ prompt })).append(content)
                            : content
                    const marked = markInline(withBeat, state.schema.marks[AI_SUGGESTION_MARK_NAME].create())
                    const stepsBefore = tr.steps.length
                    tr.replace(from, from, new Slice(marked, open, open))
                    // Not "where the mark ends": a generation closing with a rule or
                    // a list leaves unmarked nodes that declining still has to take
                    // with it, along with the block split the insertion created.
                    const to = insertedEnd(tr, stepsBefore, from)

                    tr.setMeta(aiTrackKey, { type: 'inserted', from, to } satisfies AiTrackAction)
                    tr.setMeta(AI_SUGGESTION_META, true)
                    // A REPLACE flow's history event is [delete the writer's passage,
                    // insert the take]. Its inverse re-inserts that passage — and
                    // because declining restores it outside history, prosemirror
                    // rebases the stale event instead of dropping it, so one undo
                    // after a declined rewrite duplicates the writer's own prose.
                    // Continuation flows have no such inverse: their event maps to
                    // nothing once the take is gone, which is what makes a single
                    // undo after accepting remove the whole generation.
                    if (range && range.to > range.from) tr.setMeta('addToHistory', false)
                    tr.setSelection(TextSelection.near(tr.doc.resolve(Math.min(to, tr.doc.content.size))))
                    tr.scrollIntoView()
                    setPhase('reviewing')
                    return true
                },

            aiAccept:
                () =>
                ({ state, tr, dispatch }) => {
                    if (this.storage.phase !== 'reviewing') return false
                    if (dispatch) {
                        const markType = state.schema.marks[AI_SUGGESTION_MARK_NAME]
                        tr.removeMark(0, tr.doc.content.size, markType)
                        tr.setMeta(aiTrackKey, { type: 'clear' } satisfies AiTrackAction)
                        tr.setMeta(AI_SUGGESTION_META, true)
                        // Stripping the tint is not an edit. Leaving it out of history
                        // makes the insertion the last event, so one undo after
                        // accepting removes the generation rather than re-tinting it.
                        tr.setMeta('addToHistory', false)
                        this.storage.original = null
                        this.storage.originalFrom = null
                        setPhase('idle')
                    }
                    return true
                },

            aiReject:
                () =>
                ({ state, tr, dispatch }) => {
                    if (this.storage.phase !== 'reviewing') return false
                    const track = aiTrackKey.getState(state) ?? EMPTY_TRACK
                    if (dispatch) {
                        const { pos } = restoreOriginal(tr, state.schema, track, this.storage)
                        tr.setMeta(aiTrackKey, { type: 'clear' } satisfies AiTrackAction)
                        tr.setMeta(AI_SUGGESTION_META, true)
                        // Undoing a declined candidate must never resurrect it: the
                        // history maps its insertion event through this deletion away.
                        tr.setMeta('addToHistory', false)
                        tr.setSelection(TextSelection.near(tr.doc.resolve(Math.min(pos, tr.doc.content.size))))
                        setPhase('idle')
                    }
                    return true
                },

            aiRegenerate:
                () =>
                ({ state, tr, dispatch }) => {
                    if (this.storage.phase !== 'reviewing') return false
                    const track = aiTrackKey.getState(state) ?? EMPTY_TRACK
                    if (dispatch) {
                        // Restore, then re-arm the SAME geometry and go straight back
                        // to pending — never through idle, or the position is lost.
                        const { pos, range } = restoreOriginal(tr, state.schema, track, this.storage)
                        tr.setMeta(aiTrackKey, { type: 'startPending', pos, range } satisfies AiTrackAction)
                        tr.setMeta(AI_SUGGESTION_META, true)
                        tr.setMeta('addToHistory', false)
                        tr.setSelection(TextSelection.near(tr.doc.resolve(Math.min(pos, tr.doc.content.size))))
                        setPhase('pending')
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
                if (phase === 'pending' || phase === 'reviewing') {
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
            'Mod-Enter': () => {
                if (this.storage.phase !== 'reviewing') return false
                this.options.onRegenerateRequest()
                return true
            },
            // History must never be touched while the lifecycle owns the document:
            // undo during review is a decline, undo mid-request cancels it.
            'Mod-z': () => {
                const phase = this.storage.phase
                if (phase !== 'pending' && phase !== 'reviewing') return false
                this.options.onRejectRequest()
                return true
            },
            'Mod-y': () => this.storage.phase !== 'idle' && this.storage.phase !== 'prompting',
            'Mod-Shift-z': () => this.storage.phase !== 'idle' && this.storage.phase !== 'prompting',
        }
    },

    onTransaction({ transaction }) {
        if (!transaction.docChanged) return
        if (transaction.getMeta(AI_SUGGESTION_META)) return
        if (this.storage.phase === 'reviewing') this.options.onImplicitAccept()
    },

    addProseMirrorPlugins() {
        const getPhase = () => this.storage.phase
        const getRowModel = () => this.options.getRowModel()

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
                            } else if (action.type === 'inserted') {
                                next = { ...EMPTY_TRACK, suggestStart: action.from, suggestEnd: action.to }
                            } else {
                                next = { ...EMPTY_TRACK }
                            }
                        }
                        return next
                    },
                },
                props: {
                    decorations(state) {
                        const phase = getPhase()
                        if (phase !== 'pending' && phase !== 'reviewing') return null
                        const track = aiTrackKey.getState(state)
                        if (!track) return null

                        const decorations: Decoration[] = []
                        const replacing =
                            phase === 'pending' &&
                            track.pendingRange != null &&
                            track.pendingRange.to > track.pendingRange.from
                        if (replacing && track.pendingRange) {
                            decorations.push(
                                Decoration.inline(track.pendingRange.from, track.pendingRange.to, {
                                    class: 'ai-pending-source',
                                }),
                            )
                        }
                        // The anchor is chosen by phase — never a max() over
                        // coordinates that are only meaningful in different phases.
                        const anchor =
                            phase === 'pending'
                                ? (replacing ? track.pendingRange?.to : track.pendingPos) ?? null
                                : track.suggestEnd
                        if (anchor == null) return null

                        const model = getRowModel()
                        if (!model) return null
                        decorations.push(
                            Decoration.widget(blockBoundaryAfter(state.doc, anchor), () => renderActionRow(getRowModel), {
                                // Stable across transactions, so the row is not rebuilt
                                // (and hover/focus lost) on every keystroke; changes only
                                // when what the row says changes.
                                key: `ai-action-row:${model.state}:${model.meta}:${model.prompt}:${model.canRegenerate}:${model.labels.generating}`,
                                side: 1,
                                marks: [],
                                ignoreSelection: true,
                                // Only swallow events from the controls: making the whole
                                // row inert would put a dead strip across the manuscript.
                                stopEvent: (event) => {
                                    const target = event.target as HTMLElement | null
                                    return Boolean(target?.closest?.('button'))
                                },
                            }),
                        )
                        return DecorationSet.create(state.doc, decorations)
                    },
                },
            }),
        ]
    },
})
