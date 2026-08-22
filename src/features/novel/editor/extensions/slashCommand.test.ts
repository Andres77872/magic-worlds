import { describe, expect, it } from 'vitest'
import type { TFunction } from 'i18next'
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { buildSlashItems } from './slashCommand'

// The menu copy is resolved through t(); echo the key so we can assert structure.
const t = ((key: string) => key) as unknown as TFunction

describe('buildSlashItems', () => {
    it('puts Beat first and the Write section before Insert', () => {
        const items = buildSlashItems('', t)
        expect(items[0].key).toBe('beat')
        expect(items[0].type).toBe('beat')
        const lastWrite = items.map((item) => item.section).lastIndexOf('write')
        const firstInsert = items.findIndex((item) => item.section === 'insert')
        expect(firstInsert).toBeGreaterThan(lastWrite)
    })

    it('exposes block items with a run() and canned commands with a command', () => {
        const items = buildSlashItems('', t)
        const heading = items.find((item) => item.key === 'heading')
        const describe_ = items.find((item) => item.key === 'describe')
        expect(heading?.type).toBe('block')
        expect(describe_?.type).toBe('command')
        if (describe_?.type === 'command') expect(describe_.command).toBe('describe')
    })

    it('offers one explicit Beat row when free text matches nothing', () => {
        const items = buildSlashItems('make it darker', t)
        expect(items).toHaveLength(1)
        expect(items[0].key).toBe('free')
        expect(items[0].type).toBe('beat')
        if (items[0].type === 'beat') expect(items[0].instruction).toBe('make it darker')
    })

    it('does not offer the free-text row while a real command still matches', () => {
        // The label echoes the key, so 'quote' matches the quote block item.
        const items = buildSlashItems('quote', t)
        expect(items.some((item) => item.key === 'free')).toBe(false)
        expect(items.some((item) => item.key === 'quote')).toBe(true)
    })

    it('returns nothing for an empty query with no matches to invent', () => {
        // An empty query always yields the full menu, never a free-text row.
        expect(buildSlashItems('', t).some((item) => item.key === 'free')).toBe(false)
    })

    it('runs the TipTap chain for a block item', () => {
        const editor = new Editor({ element: document.createElement('div'), extensions: [StarterKit], content: '<p>hello</p>' })
        editor.commands.setTextSelection(3)
        const bullet = buildSlashItems('', t).find((item) => item.key === 'bulletList')
        expect(bullet?.type).toBe('block')
        if (bullet?.type === 'block') bullet.run(editor)
        expect(editor.isActive('bulletList')).toBe(true)
        editor.destroy()
    })
})
