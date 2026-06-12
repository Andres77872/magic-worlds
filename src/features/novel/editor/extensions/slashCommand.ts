/**
 * Slash command — typing "/" opens the inline AI menu at the caret
 * (Notion-AI style). Built on @tiptap/suggestion: the query tracks live
 * (spaces allowed, styled arcane via decorationClass), and any free text
 * becomes a `custom` instruction sent with the chapter. Rendering is bridged
 * to React through a controller ref so the extension stays stable.
 */

import { Extension, type Editor, type Range } from '@tiptap/core'
import { PluginKey } from '@tiptap/pm/state'
import { Suggestion, type SuggestionProps } from '@tiptap/suggestion'
import type { StoryGenerationCommand } from '@/shared'
import type { InlineAIPhase } from '../types'

export const SLASH_COMMAND_PLUGIN_KEY = new PluginKey('novelSlashCommand')

export interface SlashItem {
    key: string
    label: string
    description: string
    command: StoryGenerationCommand
    instruction?: string
}

const CANNED_ITEMS: SlashItem[] = [
    { key: 'continue', label: 'Continue writing', description: 'Carry the chapter forward in the same voice', command: 'continue' },
    { key: 'describe', label: 'Describe the moment', description: 'Paint the current scene in vivid detail', command: 'describe' },
    { key: 'critique', label: 'Critique chapter', description: 'Craft and continuity feedback — never touches the text', command: 'critique' },
]

export function buildSlashItems(query: string): SlashItem[] {
    const trimmed = query.trim()
    const canned = CANNED_ITEMS.filter((item) => item.label.toLowerCase().includes(trimmed.toLowerCase()))
    if (!trimmed) return canned
    const custom: SlashItem = {
        key: 'custom',
        label: `Write: “${trimmed}”`,
        description: 'Send this instruction with the chapter',
        command: 'custom',
        instruction: trimmed,
    }
    // Free text leads when nothing canned matches; otherwise it trails.
    return canned.length > 0 ? [...canned, custom] : [custom]
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
    /** Selecting an item: the query range is already deleted before this fires. */
    onSubmit: (item: SlashItem) => void
}

export function createSlashCommand({ controllerRef, getPhase, onSubmit }: SlashCommandConfig) {
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
                    items: ({ query }) => buildSlashItems(query),
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
