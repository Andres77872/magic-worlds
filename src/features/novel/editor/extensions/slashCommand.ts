/**
 * Slash command — typing "/" opens the inline menu at the caret (Notion style).
 * Two kinds of items: BLOCK insertions (headings, lists, quote, scene break)
 * that run a TipTap chain instantly, and AI commands (continue/describe/critique
 * + free-text custom) that route to the inline-AI lifecycle. Built on
 * @tiptap/suggestion: the query tracks live (spaces allowed, styled arcane via
 * decorationClass), and rendering is bridged to React through a controller ref so
 * the extension stays stable.
 */

import { Extension, type Editor, type Range } from '@tiptap/core'
import { PluginKey } from '@tiptap/pm/state'
import { Suggestion, type SuggestionProps } from '@tiptap/suggestion'
import type { TFunction } from 'i18next'
import type { StoryGenerationCommand } from '@/shared'
import type { InlineAIPhase } from '../types'

export const SLASH_COMMAND_PLUGIN_KEY = new PluginKey('novelSlashCommand')

export type SlashSection = 'block' | 'ai'

interface SlashItemBase {
    key: string
    label: string
    description: string
    section: SlashSection
}

/** An AI command routed through the inline-AI lifecycle. */
export interface SlashAiItem extends SlashItemBase {
    type: 'ai'
    section: 'ai'
    command: StoryGenerationCommand
    instruction?: string
}

/** A structural block insertion that mutates the document directly. */
export interface SlashBlockItem extends SlashItemBase {
    type: 'block'
    section: 'block'
    /** Runs after the slash query range is already deleted. */
    run: (editor: Editor) => void
}

export type SlashItem = SlashAiItem | SlashBlockItem

interface CannedSlashSpec {
    key: string
    labelKey: string
    descriptionKey: string
    command: StoryGenerationCommand
}

interface BlockSlashSpec {
    key: string
    labelKey: string
    descriptionKey: string
    run: (editor: Editor) => void
}

const BLOCK_ITEMS: BlockSlashSpec[] = [
    { key: 'heading', labelKey: 'novelEditor.slash.heading.label', descriptionKey: 'novelEditor.slash.heading.description', run: (editor) => editor.chain().focus().toggleHeading({ level: 2 }).run() },
    { key: 'subheading', labelKey: 'novelEditor.slash.subheading.label', descriptionKey: 'novelEditor.slash.subheading.description', run: (editor) => editor.chain().focus().toggleHeading({ level: 3 }).run() },
    { key: 'bulletList', labelKey: 'novelEditor.slash.bulletList.label', descriptionKey: 'novelEditor.slash.bulletList.description', run: (editor) => editor.chain().focus().toggleBulletList().run() },
    { key: 'orderedList', labelKey: 'novelEditor.slash.orderedList.label', descriptionKey: 'novelEditor.slash.orderedList.description', run: (editor) => editor.chain().focus().toggleOrderedList().run() },
    { key: 'quote', labelKey: 'novelEditor.slash.quote.label', descriptionKey: 'novelEditor.slash.quote.description', run: (editor) => editor.chain().focus().toggleBlockquote().run() },
    { key: 'sceneBreak', labelKey: 'novelEditor.slash.sceneBreak.label', descriptionKey: 'novelEditor.slash.sceneBreak.description', run: (editor) => editor.chain().focus().setHorizontalRule().run() },
]

const CANNED_ITEMS: CannedSlashSpec[] = [
    { key: 'continue', labelKey: 'novelEditor.slash.continue.label', descriptionKey: 'novelEditor.slash.continue.description', command: 'continue' },
    { key: 'describe', labelKey: 'novelEditor.slash.describe.label', descriptionKey: 'novelEditor.slash.describe.description', command: 'describe' },
    { key: 'critique', labelKey: 'novelEditor.slash.critique.label', descriptionKey: 'novelEditor.slash.critique.description', command: 'critique' },
]

export function buildSlashItems(query: string, t: TFunction): SlashItem[] {
    const needle = query.trim().toLowerCase()
    const matches = (label: string) => label.toLowerCase().includes(needle)

    const blocks: SlashItem[] = BLOCK_ITEMS.map(
        (spec): SlashBlockItem => ({ type: 'block', section: 'block', key: spec.key, label: t(spec.labelKey), description: t(spec.descriptionKey), run: spec.run }),
    ).filter((item) => matches(item.label))

    const canned: SlashItem[] = CANNED_ITEMS.map(
        (spec): SlashAiItem => ({ type: 'ai', section: 'ai', key: spec.key, label: t(spec.labelKey), description: t(spec.descriptionKey), command: spec.command }),
    ).filter((item) => matches(item.label))

    const items = [...blocks, ...canned]
    const trimmed = query.trim()
    if (!trimmed) return items
    // Free text is always offered as a custom instruction to the muse.
    const custom: SlashAiItem = {
        type: 'ai',
        section: 'ai',
        key: 'custom',
        label: t('novelEditor.slash.custom.label', { text: trimmed }),
        description: t('novelEditor.slash.custom.description'),
        command: 'custom',
        instruction: trimmed,
    }
    return [...items, custom]
}

export interface SlashMenuController {
    onStart: (props: SuggestionProps<SlashItem, SlashItem>) => void
    onUpdate: (props: SuggestionProps<SlashItem, SlashItem>) => void
    onExit: () => void
    onKeyDown: (event: KeyboardEvent) => boolean
}

export interface SlashCommandConfig {
    controllerRef: { current: SlashMenuController | null }
    getPhase: () => InlineAIPhase
    /** Resolve the slash item copy; read live so language changes take effect. */
    getT: () => TFunction
    /** Selecting an item: the query range is already deleted before this fires. */
    onSubmit: (item: SlashItem) => void
}

export function createSlashCommand({ controllerRef, getPhase, getT, onSubmit }: SlashCommandConfig) {
    return Extension.create({
        name: 'novelSlashCommand',

        addProseMirrorPlugins() {
            return [
                Suggestion<SlashItem, SlashItem>({
                    editor: this.editor,
                    pluginKey: SLASH_COMMAND_PLUGIN_KEY,
                    char: '/',
                    allowSpaces: true,
                    decorationClass: 'slash-query',
                    allow: () => getPhase() === 'idle' || getPhase() === 'prompting',
                    items: ({ query }) => buildSlashItems(query, getT()),
                    command: ({ editor, range, props }: { editor: Editor; range: Range; props: SlashItem }) => {
                        editor.chain().focus().deleteRange(range).run()
                        onSubmit(props)
                    },
                    render: () => ({
                        onStart: (props) => controllerRef.current?.onStart(props),
                        onUpdate: (props) => controllerRef.current?.onUpdate(props),
                        onExit: () => controllerRef.current?.onExit(),
                        onKeyDown: ({ event }) => controllerRef.current?.onKeyDown(event) ?? false,
                    }),
                }),
            ]
        },
    })
}
