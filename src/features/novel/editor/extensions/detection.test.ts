import { describe, expect, it, vi } from 'vitest'
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from '@tiptap/markdown'
import type { SessionLoreEntry } from '@/features/lorebook/loreTriggers'
import type { LorebookEntry } from '@/shared'
import type { CodexDetectionName } from '../../hooks/useCodex'
import type { InlineAIPhase } from '../types'
import { createCodexMention } from './codexMention'
import { buildDetectionMatchers, createDetection, DETECTION_META, DETECTION_PLUGIN_KEY } from './detection'

function loreEntry(id: string, keys: string[], enabled = true): SessionLoreEntry {
    const entry: LorebookEntry = {
        id,
        lorebookId: 'lb',
        title: id,
        entryType: 'other',
        content: '',
        keys,
        secondaryKeys: [],
        selectiveLogic: 'any',
        enabled,
        constant: false,
        caseSensitive: false,
        matchWholeWords: true,
        regex: false,
        isSecret: false,
        insertionOrder: 0,
        priority: 0,
        insertionPosition: 'before_context',
    }
    return { entry, lorebookId: 'lb', lorebookName: 'Codex Lore' }
}

function makeEditor(opts: { content?: string; names?: CodexDetectionName[]; lore?: SessionLoreEntry[]; phase?: InlineAIPhase }) {
    let phase: InlineAIPhase = opts.phase ?? 'idle'
    const names = opts.names ?? []
    const matchers = buildDetectionMatchers(names, opts.lore ?? [])
    const onOpenLore = vi.fn()
    const onOpenCodex = vi.fn()
    const editor = new Editor({
        element: document.createElement('div'),
        extensions: [
            StarterKit,
            Markdown,
            createCodexMention(() => names.map((n) => ({ id: n.id, label: n.label, kind: n.kind, enabled: true }))),
            createDetection({
                getMatchers: () => matchers,
                getPhase: () => phase,
                getLabels: () => ({ lore: () => 'open lore', codex: () => 'open codex' }),
                onOpenLore,
                onOpenCodex,
            }),
        ],
        content: opts.content ?? '',
        contentType: 'markdown',
    })
    return {
        editor,
        setPhase: (next: InlineAIPhase) => {
            phase = next
        },
        recompute: () => editor.view.dispatch(editor.state.tr.setMeta(DETECTION_META, true)),
        hits: () => DETECTION_PLUGIN_KEY.getState(editor.state)?.hits ?? [],
    }
}

describe('buildDetectionMatchers', () => {
    it('returns null matchers when there is nothing to detect', () => {
        const matchers = buildDetectionMatchers([], [])
        expect(matchers.loreMatcher).toBeNull()
        expect(matchers.nameMatcher).toBeNull()
    })

    it('skips disabled lore entries and indexes codex names by id', () => {
        const matchers = buildDetectionMatchers([{ id: 'c1', label: 'Elara', kind: 'character' }], [loreEntry('l1', ['Oath'], false)])
        expect(matchers.nameMatcher).not.toBeNull()
        expect(matchers.loreMatcher).toBeNull()
        expect(matchers.codexById.get('c1')?.label).toBe('Elara')
    })
})

describe('createDetection', () => {
    it('marks codex names (ember) and lore triggers (arcane), with lore winning overlaps', () => {
        const harness = makeEditor({
            content: 'Elara entered the Iron Citadel to swear the Blood Oath.',
            names: [
                { id: 'c1', label: 'Elara', kind: 'character' },
                { id: 'c2', label: 'Iron Citadel', kind: 'world' },
            ],
            lore: [loreEntry('l1', ['Iron Citadel']), loreEntry('l2', ['Blood Oath'])],
        })
        const hits = harness.hits()
        const names = hits.filter((hit) => hit.kind === 'name')
        const lore = hits.filter((hit) => hit.kind === 'lore')
        // "Iron Citadel" is both a name and a lore key — lore wins, so only Elara remains a name.
        expect(names.map((hit) => hit.codexId)).toEqual(['c1'])
        expect(lore).toHaveLength(2)
        harness.editor.destroy()
    })

    it('produces no decorations while a suggestion is alive', () => {
        const harness = makeEditor({ content: 'Elara walks.', names: [{ id: 'c1', label: 'Elara', kind: 'character' }] })
        expect(harness.hits()).toHaveLength(1)
        harness.setPhase('pending')
        harness.recompute()
        expect(harness.hits()).toHaveLength(0)
        harness.editor.destroy()
    })

    it('marks plain-text names but never the label inside an @mention node', () => {
        const harness = makeEditor({ content: '@Elara met Elara.', names: [{ id: 'c1', label: 'Elara', kind: 'character' }] })
        const hits = harness.hits()
        expect(hits).toHaveLength(1)
        expect(hits[0].kind).toBe('name')
        harness.editor.destroy()
    })

    it('never leaks decorations into the saved markdown', () => {
        const markdown = 'Elara swears the Blood Oath.'
        const harness = makeEditor({
            content: markdown,
            names: [{ id: 'c1', label: 'Elara', kind: 'character' }],
            lore: [loreEntry('l1', ['Blood Oath'])],
        })
        expect(harness.hits().length).toBeGreaterThan(0)
        expect(harness.editor.getMarkdown()).toBe(markdown)
        harness.editor.destroy()
    })
})
