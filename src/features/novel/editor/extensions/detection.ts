/**
 * detection — inline reference highlighting inside the manuscript, the editor's
 * answer to the chat composer's lore underlines. A single read-only ProseMirror
 * decoration plugin paints two layers:
 *   • arcane `.lore-trigger`  — words matching a cloned lorebook entry's keys
 *   • ember  `.codex-reference` — names of codex entities (character/world/item/…)
 *
 * Both reuse the pure engine in `loreTriggers.ts`, so the match semantics are
 * identical to chat. Decorations are VIEW-ONLY: they never touch the document, so
 * nothing leaks into `getMarkdown()`. The plugin dispatches zero transactions and
 * returns an empty set whenever a suggestion is alive (phase !== 'idle'), so it
 * can never fight the AI lifecycle. Ctrl/Cmd-click opens the entry (mirroring the
 * chat composer); a plain click is a no-op so caret placement is never hijacked.
 */

import { Extension } from '@tiptap/core'
import type { Node as PMNode } from '@tiptap/pm/model'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import {
    buildTriggerMatcher,
    matcherIsEmpty,
    scanText,
    type SessionLoreEntry,
    type TriggerMatch,
    type TriggerMatcher,
} from '@/features/lorebook/loreTriggers'
import type { LorebookEntry } from '@/shared'
import type { CodexDetectionName } from '../../hooks/useCodex'
import type { InlineAIPhase } from '../types'
import { AI_SUGGESTION_META } from './aiSuggestion'

export const DETECTION_PLUGIN_KEY = new PluginKey<DetectionState>('novelDetection')
/** Transaction meta that forces a decoration recompute (matcher identity changed). */
export const DETECTION_META = 'novelDetection$'

export interface DetectionMatchers {
    loreMatcher: TriggerMatcher | null
    nameMatcher: TriggerMatcher | null
    /** synthetic-entry id (= codex entry id) → codex name, for click resolution. */
    codexById: Map<string, CodexDetectionName>
}

export interface DetectionLabels {
    lore: (lorebookName: string) => string
    codex: (label: string) => string
}

export interface DetectionConfig {
    getMatchers: () => DetectionMatchers
    getPhase: () => InlineAIPhase
    getLabels: () => DetectionLabels
    onOpenLore: (match: TriggerMatch) => void
    onOpenCodex: (codexId: string) => void
}

interface DetectionHit {
    from: number
    to: number
    kind: 'lore' | 'name'
    /** Present for lore hits — the full match drives the floating window. */
    match?: TriggerMatch
    /** Present for name hits — the codex entry id to open. */
    codexId?: string
}

interface DetectionState {
    deco: DecorationSet
    hits: DetectionHit[]
}

const EMPTY_STATE: DetectionState = { deco: DecorationSet.empty, hits: [] }

/** Object-replacement char: stands in for an inline atom (e.g. a @mention) so
 * scan offsets line up with doc positions and keys never match its label. */
const ATOM_PLACEHOLDER = '￼'

/** A codex entity name as a synthetic lorebook entry (so it flows through the same engine). */
function nameToLoreEntry(name: CodexDetectionName): LorebookEntry {
    return {
        id: name.id,
        lorebookId: 'codex',
        title: name.label,
        entryType: 'other',
        content: '',
        keys: [name.label],
        secondaryKeys: [],
        selectiveLogic: 'any',
        enabled: true,
        constant: false,
        caseSensitive: false,
        matchWholeWords: true,
        regex: false,
        isSecret: false,
        insertionOrder: 0,
        priority: 0,
        insertionPosition: 'before_context',
    }
}

/** Compile the two matchers (and the id→name index) once per codex change. */
export function buildDetectionMatchers(names: CodexDetectionName[], loreEntries: SessionLoreEntry[]): DetectionMatchers {
    const loreBuilt = buildTriggerMatcher(loreEntries)
    const nameBuilt = buildTriggerMatcher(names.map((name) => ({ entry: nameToLoreEntry(name), lorebookId: 'codex', lorebookName: '' })))
    return {
        loreMatcher: loreBuilt.keys.length > 0 ? loreBuilt : null,
        nameMatcher: nameBuilt.keys.length > 0 ? nameBuilt : null,
        codexById: new Map(names.map((name) => [name.id, name])),
    }
}

/**
 * Build the manuscript's reference text per textblock as a 1:1 string: text leaves
 * contribute their characters, inline atoms (e.g. a codex @mention) contribute one
 * placeholder per position. This keeps scan offsets aligned with doc positions
 * (so a name beside a mention still matches but the mention's label is never
 * scanned) while letting multi-word keys span mark boundaries (bold, italic).
 */
function buildDecorations(doc: PMNode, matchers: DetectionMatchers, labels: DetectionLabels): DetectionState {
    const { loreMatcher, nameMatcher } = matchers
    if (matcherIsEmpty(loreMatcher) && matcherIsEmpty(nameMatcher)) return EMPTY_STATE

    const decorations: Decoration[] = []
    const hits: DetectionHit[] = []

    doc.descendants((node, pos) => {
        if (!node.isTextblock) return true
        const blockStart = pos + 1
        let text = ''
        node.forEach((child) => {
            text += child.isText ? child.text ?? '' : ATOM_PLACEHOLDER.repeat(child.nodeSize)
        })
        if (!text.trim()) return false

        const occupied: Array<[number, number]> = []
        const overlaps = (start: number, end: number) => occupied.some(([s, e]) => start < e && end > s)

        // Lore wins on overlap with a codex name.
        for (const match of scanText(text, loreMatcher)) {
            if (overlaps(match.start, match.end)) continue
            occupied.push([match.start, match.end])
            const from = blockStart + match.start
            const to = blockStart + match.end
            hits.push({ from, to, kind: 'lore', match })
            decorations.push(
                Decoration.inline(from, to, { class: 'lore-trigger', 'data-lore-entry': match.entry.id, title: labels.lore(match.lorebookName) }),
            )
        }
        for (const match of scanText(text, nameMatcher)) {
            if (overlaps(match.start, match.end)) continue
            occupied.push([match.start, match.end])
            const from = blockStart + match.start
            const to = blockStart + match.end
            hits.push({ from, to, kind: 'name', codexId: match.entry.id })
            decorations.push(
                Decoration.inline(from, to, { class: 'codex-reference', 'data-codex-id': match.entry.id, title: labels.codex(match.keyword) }),
            )
        }
        return false
    })

    return { deco: DecorationSet.create(doc, decorations), hits }
}

export function createDetection(config: DetectionConfig) {
    const compute = (doc: PMNode): DetectionState => {
        if (config.getPhase() !== 'idle') return EMPTY_STATE
        return buildDecorations(doc, config.getMatchers(), config.getLabels())
    }

    return Extension.create({
        name: 'novelDetection',

        addProseMirrorPlugins() {
            return [
                new Plugin<DetectionState>({
                    key: DETECTION_PLUGIN_KEY,
                    state: {
                        init: (_config, state) => compute(state.doc),
                        apply: (tr, prev, _oldState, newState) => {
                            // Recompute on doc edits, matcher changes, or any AI-phase change
                            // (those transactions are meta-only but flip detection on/off).
                            if (tr.docChanged || tr.getMeta(DETECTION_META) || tr.getMeta(AI_SUGGESTION_META)) {
                                return compute(newState.doc)
                            }
                            return prev
                        },
                    },
                    props: {
                        decorations: (state) => DETECTION_PLUGIN_KEY.getState(state)?.deco ?? null,
                        handleClick: (view, pos, event) => {
                            if (!(event.ctrlKey || event.metaKey)) return false
                            const hit = DETECTION_PLUGIN_KEY.getState(view.state)?.hits.find((h) => pos >= h.from && pos < h.to)
                            if (!hit) return false
                            if (hit.kind === 'lore' && hit.match) {
                                event.preventDefault()
                                config.onOpenLore(hit.match)
                                return true
                            }
                            if (hit.kind === 'name' && hit.codexId) {
                                event.preventDefault()
                                config.onOpenCodex(hit.codexId)
                                return true
                            }
                            return false
                        },
                    },
                }),
            ]
        },
    })
}
