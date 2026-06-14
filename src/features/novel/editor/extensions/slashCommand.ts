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
import type { TFunction } from 'i18next'
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

interface CannedSlashSpec {
    key: string
    labelKey: string
    descriptionKey: string
    command: StoryGenerationCommand
}

const CANNED_ITEMS: CannedSlashSpec[] = [
    { key: 'continue', labelKey: 'novelEditor.slash.continue.label', descriptionKey: 'novelEditor.slash.continue.description', command: 'continue' },
    { key: 'describe', labelKey: 'novelEditor.slash.describe.label', descriptionKey: 'novelEditor.slash.describe.description', command: 'describe' },
    { key: 'critique', labelKey: 'novelEditor.slash.critique.label', descriptionKey: 'novelEditor.slash.critique.description', command: 'critique' },
]

export function buildSlashItems(query: string, t: TFunction): SlashItem[] {
    const trimmed = query.trim()
    const resolved = CANNED_ITEMS.map((spec) => ({
        key: spec.key,
        label: t(spec.labelKey),
        description: t(spec.descriptionKey),
        command: spec.command,
    }))
    const canned = resolved.filter((item) => item.label.toLowerCase().includes(trimmed.toLowerCase()))
    if (!trimmed) return canned
    const custom: SlashItem = {
        key: 'custom',
        label: t('novelEditor.slash.custom.label', { text: trimmed }),
        description: t('novelEditor.slash.custom.description'),
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
