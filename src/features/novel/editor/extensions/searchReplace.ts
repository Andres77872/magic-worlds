/**
 * searchReplace — in-editor find & replace. A ProseMirror plugin holds the
 * query, the resolved match ranges, and the active index; it decorates matches
 * (`.search-match` / `.search-match-active`) and recomputes them whenever the
 * doc or the query changes. Navigation moves a collapsed selection to the match
 * (so it scrolls into view without opening the selection toolbar). Replacement
 * is gated by the caller while an AI suggestion is alive.
 */

import { Extension } from '@tiptap/core'
import type { Node as PMNode } from '@tiptap/pm/model'
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

export const SEARCH_PLUGIN_KEY = new PluginKey<SearchState>('novelSearchReplace')
const ATOM_PLACEHOLDER = '￼'

interface SearchMatch {
    from: number
    to: number
}

export interface SearchState {
    query: string
    caseSensitive: boolean
    matches: SearchMatch[]
    activeIndex: number
    deco: DecorationSet
}

const EMPTY_STATE: SearchState = { query: '', caseSensitive: false, matches: [], activeIndex: 0, deco: DecorationSet.empty }

type SearchMeta =
    | { type: 'setQuery'; query: string; caseSensitive: boolean }
    | { type: 'setActive'; index: number }
    | { type: 'clear' }

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        novelSearchReplace: {
            setSearchTerm: (query: string, caseSensitive: boolean) => ReturnType
            findNext: () => ReturnType
            findPrev: () => ReturnType
            replaceCurrent: (replacement: string) => ReturnType
            replaceAll: (replacement: string) => ReturnType
            clearSearch: () => ReturnType
        }
    }
}

function findMatches(doc: PMNode, query: string, caseSensitive: boolean): SearchMatch[] {
    if (!query) return []
    const needle = caseSensitive ? query : query.toLowerCase()
    const matches: SearchMatch[] = []
    doc.descendants((node, pos) => {
        if (!node.isTextblock) return true
        const blockStart = pos + 1
        let text = ''
        node.forEach((child) => {
            text += child.isText ? child.text ?? '' : ATOM_PLACEHOLDER.repeat(child.nodeSize)
        })
        const haystack = caseSensitive ? text : text.toLowerCase()
        let idx = haystack.indexOf(needle)
        while (idx !== -1) {
            matches.push({ from: blockStart + idx, to: blockStart + idx + query.length })
            idx = haystack.indexOf(needle, idx + Math.max(1, query.length))
        }
        return false
    })
    return matches
}

function buildDeco(doc: PMNode, matches: SearchMatch[], activeIndex: number): DecorationSet {
    if (matches.length === 0) return DecorationSet.empty
    return DecorationSet.create(
        doc,
        matches.map((match, index) =>
            Decoration.inline(match.from, match.to, { class: index === activeIndex ? 'search-match search-match-active' : 'search-match' }),
        ),
    )
}

export const SearchReplace = Extension.create({
    name: 'novelSearchReplace',

    addCommands() {
        return {
            setSearchTerm:
                (query: string, caseSensitive: boolean) =>
                ({ tr, dispatch }) => {
                    if (dispatch) dispatch(tr.setMeta(SEARCH_PLUGIN_KEY, { type: 'setQuery', query, caseSensitive } satisfies SearchMeta))
                    return true
                },
            clearSearch:
                () =>
                ({ tr, dispatch }) => {
                    if (dispatch) dispatch(tr.setMeta(SEARCH_PLUGIN_KEY, { type: 'clear' } satisfies SearchMeta))
                    return true
                },
            findNext:
                () =>
                ({ state, tr, dispatch }) => {
                    const search = SEARCH_PLUGIN_KEY.getState(state)
                    if (!search || search.matches.length === 0) return false
                    const index = (search.activeIndex + 1) % search.matches.length
                    if (dispatch) {
                        const pos = Math.min(search.matches[index].from, tr.doc.content.size)
                        dispatch(tr.setMeta(SEARCH_PLUGIN_KEY, { type: 'setActive', index } satisfies SearchMeta).setSelection(TextSelection.create(tr.doc, pos)).scrollIntoView())
                    }
                    return true
                },
            findPrev:
                () =>
                ({ state, tr, dispatch }) => {
                    const search = SEARCH_PLUGIN_KEY.getState(state)
                    if (!search || search.matches.length === 0) return false
                    const index = (search.activeIndex - 1 + search.matches.length) % search.matches.length
                    if (dispatch) {
                        const pos = Math.min(search.matches[index].from, tr.doc.content.size)
                        dispatch(tr.setMeta(SEARCH_PLUGIN_KEY, { type: 'setActive', index } satisfies SearchMeta).setSelection(TextSelection.create(tr.doc, pos)).scrollIntoView())
                    }
                    return true
                },
            replaceCurrent:
                (replacement: string) =>
                ({ state, tr, dispatch }) => {
                    const search = SEARCH_PLUGIN_KEY.getState(state)
                    if (!search || search.matches.length === 0) return false
                    const match = search.matches[search.activeIndex] ?? search.matches[0]
                    if (dispatch) dispatch(tr.insertText(replacement, match.from, match.to))
                    return true
                },
            replaceAll:
                (replacement: string) =>
                ({ state, tr, dispatch }) => {
                    const search = SEARCH_PLUGIN_KEY.getState(state)
                    if (!search || search.matches.length === 0) return false
                    if (dispatch) {
                        // Last → first so each edit leaves the earlier (lower) offsets valid.
                        for (let i = search.matches.length - 1; i >= 0; i -= 1) {
                            const match = search.matches[i]
                            tr.insertText(replacement, match.from, match.to)
                        }
                        dispatch(tr)
                    }
                    return true
                },
        }
    },

    addProseMirrorPlugins() {
        return [
            new Plugin<SearchState>({
                key: SEARCH_PLUGIN_KEY,
                state: {
                    init: () => EMPTY_STATE,
                    apply(tr, prev, _oldState, newState) {
                        const meta = tr.getMeta(SEARCH_PLUGIN_KEY) as SearchMeta | undefined
                        let next = prev
                        if (meta) {
                            if (meta.type === 'clear') return EMPTY_STATE
                            if (meta.type === 'setQuery') next = { ...next, query: meta.query, caseSensitive: meta.caseSensitive, activeIndex: 0 }
                            else if (meta.type === 'setActive') next = { ...next, activeIndex: meta.index }
                        }
                        if (meta || tr.docChanged) {
                            const matches = next.query ? findMatches(newState.doc, next.query, next.caseSensitive) : []
                            const activeIndex = matches.length ? Math.min(next.activeIndex, matches.length - 1) : 0
                            next = { ...next, matches, activeIndex, deco: buildDeco(newState.doc, matches, activeIndex) }
                        }
                        return next
                    },
                },
                props: {
                    decorations: (state) => SEARCH_PLUGIN_KEY.getState(state)?.deco ?? null,
                },
            }),
        ]
    },
})
