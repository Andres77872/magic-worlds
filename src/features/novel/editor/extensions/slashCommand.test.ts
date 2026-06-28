import { describe, expect, it } from 'vitest'
import type { TFunction } from 'i18next'
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { buildSlashItems } from './slashCommand'

// The menu copy is resolved through t(); echo the key so we can assert structure.
const t = ((key: string) => key) as unknown as TFunction

describe('buildSlashItems', () => {
    it('returns a Blocks section before the AI section', () => {
        const items = buildSlashItems('', t)
        const firstAi = items.findIndex((item) => item.section === 'ai')
        const lastBlock = items.map((item) => item.section).lastIndexOf('block')
        expect(items.some((item) => item.section === 'block')).toBe(true)
        expect(firstAi).toBeGreaterThan(lastBlock)
    })

    it('exposes block items with a run() and AI items with a command', () => {
        const items = buildSlashItems('', t)
        const heading = items.find((item) => item.key === 'heading')
        const describe_ = items.find((item) => item.key === 'describe')
        expect(heading?.type).toBe('block')
        expect(describe_?.type).toBe('ai')
        if (describe_?.type === 'ai') expect(describe_.command).toBe('describe')
    })

    it('appends a custom AI instruction when there is free text', () => {
        const items = buildSlashItems('make it darker', t)
        const custom = items.find((item) => item.key === 'custom')
        expect(custom?.type).toBe('ai')
        if (custom?.type === 'ai') expect(custom.instruction).toBe('make it darker')
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
