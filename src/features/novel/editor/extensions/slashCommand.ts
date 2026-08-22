/**
 * Slash command — typing "/" opens the command menu at the caret.
 *
 * Three kinds of item: BLOCK insertions that run a TipTap chain instantly, AI
 * COMMANDS that go straight to the inline-AI lifecycle, and BEAT, which opens
 * the composer so you can say what to do in your own words.
 *
 * Free text no longer becomes an invisible command. The old build appended an
 * unlabelled "custom" item under the block list and sent the raw query as the
 * instruction — undiscoverable, uneditable and impossible to re-run. Now typing
 * something that matches no command offers exactly one row that opens the beat
 * composer prefilled with what you typed.
 */

import { Extension, type Editor, type Range } from '@tiptap/core'
import { PluginKey } from '@tiptap/pm/state'
import { Suggestion, type SuggestionProps } from '@tiptap/suggestion'
import type { TFunction } from 'i18next'
import type { StoryGenerationCommand } from '@/shared'
import type { InlineAIPhase } from '../types'

export const SLASH_COMMAND_PLUGIN_KEY = new PluginKey('novelSlashCommand')

/** Write before Insert: this is an AI drafting tool, blocks are the second job. */
export type SlashSection = 'write' | 'insert'

interface SlashItemBase {
    key: string
    label: string
    /** Right-aligned muted hint — a shortcut or a one-word qualifier, never a sentence. */
    hint: string
    section: SlashSection
}

/** Opens the beat composer. */
export interface SlashBeatItem extends SlashItemBase {
    type: 'beat'
    section: 'write'
    /** Prefill, when the row came from free text. */
    instruction?: string
}

/** A canned AI command, straight to the lifecycle. */
export interface SlashCommandItem extends SlashItemBase {
    type: 'command'
    section: 'write'
    command: StoryGenerationCommand
}

/** A structural block insertion that mutates the document directly. */
export interface SlashBlockItem extends SlashItemBase {
    type: 'block'
    section: 'insert'
    /** Runs after the slash query range is already deleted. */
    run: (editor: Editor) => void
}

export type SlashItem = SlashBeatItem | SlashCommandItem | SlashBlockItem

interface CommandSpec {
    key: string
    command: StoryGenerationCommand
}

interface BlockSpec {
    key: string
    run: (editor: Editor) => void
}

const COMMAND_ITEMS: CommandSpec[] = [
    { key: 'continue', command: 'continue' },
    { key: 'describe', command: 'describe' },
    { key: 'critique', command: 'critique' },
]

const BLOCK_ITEMS: BlockSpec[] = [
    { key: 'heading', run: (editor) => editor.chain().focus().toggleHeading({ level: 2 }).run() },
    { key: 'subheading', run: (editor) => editor.chain().focus().toggleHeading({ level: 3 }).run() },
    { key: 'bulletList', run: (editor) => editor.chain().focus().toggleBulletList().run() },
    { key: 'orderedList', run: (editor) => editor.chain().focus().toggleOrderedList().run() },
    { key: 'quote', run: (editor) => editor.chain().focus().toggleBlockquote().run() },
    { key: 'sceneBreak', run: (editor) => editor.chain().focus().setHorizontalRule().run() },
]

export function buildSlashItems(query: string, t: TFunction): SlashItem[] {
    const needle = query.trim().toLowerCase()
    const matches = (label: string) => label.toLowerCase().includes(needle)

    const beat: SlashBeatItem = {
        type: 'beat',
        section: 'write',
        key: 'beat',
        label: t('novelEditor.slash.beat.label'),
        hint: t('novelEditor.slash.beat.hint'),
    }
    const commands: SlashItem[] = COMMAND_ITEMS.map(
        (spec): SlashCommandItem => ({
            type: 'command',
            section: 'write',
            key: spec.key,
            label: t(`novelEditor.slash.${spec.key}.label`),
            hint: t(`novelEditor.slash.${spec.key}.hint`),
            command: spec.command,
        }),
    )
    const blocks: SlashItem[] = BLOCK_ITEMS.map(
        (spec): SlashBlockItem => ({
            type: 'block',
            section: 'insert',
            key: spec.key,
            label: t(`novelEditor.slash.${spec.key}.label`),
            hint: t(`novelEditor.slash.${spec.key}.hint`),
            run: spec.run,
        }),
    )

    const items = [beat, ...commands, ...blocks].filter((item) => matches(item.label))
    if (items.length > 0) return items

    const trimmed = query.trim()
    if (!trimmed) return []
    // Nothing matched: offer the beat composer, prefilled and explicit.
    return [
        {
            type: 'beat',
            section: 'write',
            key: 'free',
            label: t('novelEditor.slash.free.label', { text: trimmed }),
            hint: t('novelEditor.slash.free.hint'),
            instruction: trimmed,
        },
    ]
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
