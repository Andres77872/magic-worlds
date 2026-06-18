/**
 * NovelEditor — the manuscript surface. TipTap (markdown in/out, serif
 * prose) with custom layers: the inline AI suggestion lifecycle (slash command
 * → shimmer → typewriter → keep/discard, edits imply keep), codex @mentions,
 * inline reference detection (lorebook triggers + codex names), a grouped
 * selection toolbar, and a "/" block + AI command menu.
 *
 * Body emission is gated while a suggestion is alive so suggestion text can
 * never reach autosave; the studio additionally suspends its timer via
 * onSuggestionPhaseChange. The studio must remount this component per
 * chapter (key={chapterId}) — initialBody is read once.
 */

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from '@tiptap/markdown'
import Placeholder from '@tiptap/extension-placeholder'
import Typography from '@tiptap/extension-typography'
import { PluginKey } from '@tiptap/pm/state'
import type { MentionNodeAttrs } from '@tiptap/extension-mention'
import { exitSuggestion, type SuggestionProps } from '@tiptap/suggestion'
import type { StoryGenerationCommand } from '@/shared'
import { Toast, cx } from '@/ui/primitives'
import { useOpenLoreEntry } from '@/features/lorebook/hooks/useOpenLoreEntry'
import { AiSuggestion, findAiSuggestionRange } from './extensions/aiSuggestion'
import { createCodexMention } from './extensions/codexMention'
import { buildDetectionMatchers, createDetection, DETECTION_META, type DetectionMatchers } from './extensions/detection'
import { SearchReplace } from './extensions/searchReplace'
import { createSlashCommand, type SlashItem, type SlashMenuController } from './extensions/slashCommand'
import { AiSuggestionPill } from './components/AiSuggestionPill'
import { EditorBubbleMenu } from './components/EditorBubbleMenu'
import { FindReplacePanel } from './components/FindReplacePanel'
import { MentionMenu } from './components/MentionMenu'
import { SlashCommandMenu } from './components/SlashCommandMenu'
import { useEditorAnchor } from './hooks/useEditorAnchor'
import { useInlineAI } from './hooks/useInlineAI'
import { editorSelection } from './markdownSelection'
import type { EditorCodexEntry, InlineAIPhase, NovelEditorHandle, NovelEditorProps } from './types'

/** A stable signature for the detection inputs — when it changes, the decoration
 *  plugin recomputes once (instead of rebuilding the whole editor). */
function detectionSignature(props: NovelEditorProps): string {
    const names = (props.detectionNames ?? []).map((n) => `${n.id}:${n.label}`).join('|')
    const lore = (props.loreEntries ?? []).map((l) => `${l.entry.id}:${l.entry.enabled ? 1 : 0}:${l.entry.keys.join(',')}`).join('|')
    return `${names}__${lore}`
}

const CODEX_MENTION_SUGGESTION_KEY = new PluginKey('codexMentionSuggestion')

interface MenuAnchor {
    left: number
    top: number
}

interface MenuState<T> {
    items: T[]
    anchor: MenuAnchor
    command: (item: T) => void
    range: { from: number; to: number }
}

interface MentionMenuController {
    onStart: (props: SuggestionProps<EditorCodexEntry, MentionNodeAttrs>) => void
    onUpdate: (props: SuggestionProps<EditorCodexEntry, MentionNodeAttrs>) => void
    onExit: () => void
    onKeyDown: (event: KeyboardEvent) => boolean
}

function menuAnchorFor(container: HTMLElement | null, clientRect: (() => DOMRect | null) | null | undefined): MenuAnchor | null {
    const rect = clientRect?.()
    if (!rect || !container) return null
    const containerRect = container.getBoundingClientRect()
    return {
        left: Math.max(8, rect.left - containerRect.left),
        top: rect.bottom - containerRect.top + container.scrollTop + 6,
    }
}

export const NovelEditor = forwardRef<NovelEditorHandle, NovelEditorProps>(function NovelEditor(props, ref) {
    const { t } = useTranslation()
    const containerRef = useRef<HTMLDivElement | null>(null)
    const propsRef = useRef(props)
    propsRef.current = props
    // Read live inside the memoized extensions so language changes take effect.
    const tRef = useRef(t)
    tRef.current = t
    const codexRef = useRef<EditorCodexEntry[]>(props.codexEntries)
    codexRef.current = props.codexEntries

    // Inline detection: matchers are rebuilt only when the codex changes (the
    // memo key), then read live by the decoration plugin through a ref.
    const detectionSig = detectionSignature(props)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- detectionSig captures the inputs
    const detectionMatchers = useMemo<DetectionMatchers>(() => buildDetectionMatchers(props.detectionNames ?? [], props.loreEntries ?? []), [detectionSig])
    const detectionRef = useRef<DetectionMatchers>(detectionMatchers)
    detectionRef.current = detectionMatchers

    const openLore = useOpenLoreEntry()
    const openLoreRef = useRef(openLore)
    openLoreRef.current = openLore

    const [armed, setArmed] = useState(false)
    const [findOpen, setFindOpen] = useState(false)
    const [phase, setPhaseState] = useState<InlineAIPhase>('idle')
    const phaseRef = useRef<InlineAIPhase>('idle')

    // --- menu bridges (extensions are memoized once; everything dynamic goes through refs) ---
    const [slashMenu, setSlashMenu] = useState<MenuState<SlashItem> | null>(null)
    const [slashIndex, setSlashIndex] = useState(0)
    const slashRef = useRef<{ menu: MenuState<SlashItem> | null; index: number }>({ menu: null, index: 0 })
    slashRef.current = { menu: slashMenu, index: slashIndex }

    const [mentionMenu, setMentionMenu] = useState<MenuState<EditorCodexEntry> | null>(null)
    const [mentionIndex, setMentionIndex] = useState(0)
    const mentionRef = useRef<{ menu: MenuState<EditorCodexEntry> | null; index: number }>({ menu: null, index: 0 })
    mentionRef.current = { menu: mentionMenu, index: mentionIndex }

    const slashControllerRef = useRef<SlashMenuController | null>(null)
    const mentionControllerRef = useRef<MentionMenuController | null>(null)
    const aiHandlersRef = useRef<{
        escape: (phase: InlineAIPhase) => void
        acceptKey: () => void
        rejectKey: () => void
        implicitAccept: () => void
    }>({
        escape: () => {},
        acceptKey: () => {},
        rejectKey: () => {},
        implicitAccept: () => {},
    })
    const submitSlashRef = useRef<(item: SlashItem) => void>(() => {})

    const extensions = useMemo(
        () => [
            StarterKit.configure({
                heading: { levels: [1, 2, 3] },
                codeBlock: false,
                code: false,
                link: false,
                underline: false,
            }),
            Markdown.configure({ indentation: { style: 'space', size: 2 } }),
            Placeholder.configure({ placeholder: tRef.current('novelEditor.editor.placeholder') }),
            Typography,
            SearchReplace,
            AiSuggestion.configure({
                onPhaseChange: (nextPhase) => {
                    phaseRef.current = nextPhase
                    setPhaseState(nextPhase)
                    propsRef.current.onSuggestionPhaseChange?.(nextPhase)
                },
                onImplicitAccept: () => aiHandlersRef.current.implicitAccept(),
                onEscape: (escapePhase) => aiHandlersRef.current.escape(escapePhase),
                onAcceptRequest: () => aiHandlersRef.current.acceptKey(),
                onRejectRequest: () => aiHandlersRef.current.rejectKey(),
            }),
            createSlashCommand({
                controllerRef: slashControllerRef,
                getPhase: () => phaseRef.current,
                getT: () => tRef.current,
                onSubmit: (item) => submitSlashRef.current(item),
            }),
            createCodexMention(() => codexRef.current).configure({
                HTMLAttributes: { class: 'codex-mention' },
                renderText: ({ node }) => `@${node.attrs.label ?? node.attrs.id}`,
                suggestion: {
                    char: '@',
                    pluginKey: CODEX_MENTION_SUGGESTION_KEY,
                    allow: () => phaseRef.current === 'idle',
                    items: ({ query }) => {
                        const needle = query.trim().toLowerCase()
                        return codexRef.current
                            .filter((entry) => entry.enabled && entry.label.toLowerCase().includes(needle))
                            .slice(0, 8)
                    },
                    render: () => ({
                        onStart: (p) => mentionControllerRef.current?.onStart(p),
                        onUpdate: (p) => mentionControllerRef.current?.onUpdate(p),
                        onExit: () => mentionControllerRef.current?.onExit(),
                        onKeyDown: ({ event }) => mentionControllerRef.current?.onKeyDown(event) ?? false,
                    }),
                },
            }),
            createDetection({
                getMatchers: () => detectionRef.current,
                getPhase: () => phaseRef.current,
                getLabels: () => ({
                    lore: (name) => tRef.current('loreTrigger.openHint', { name }),
                    codex: (label) => tRef.current('novelEditor.reference.codexOpenHint', { label }),
                }),
                onOpenLore: (match) => openLoreRef.current(match),
                onOpenCodex: (codexId) => propsRef.current.onOpenCodexEntry?.(codexId),
            }),
        ],
        [],
    )

    const editor = useEditor({
        extensions,
        content: props.initialBody || '',
        contentType: 'markdown',
        editorProps: {
            attributes: {
                'aria-label': tRef.current('novelEditor.editor.bodyLabel'),
                class: 'story-editor-prose',
            },
        },
        onUpdate: ({ editor: next }) => {
            const currentPhase = phaseRef.current
            // Suggestion text must never reach the draft; prompting queries are
            // transient and self-heal when the range is deleted.
            if (currentPhase === 'pending' || currentPhase === 'revealing' || currentPhase === 'reviewing') return
            propsRef.current.onBodyChange(next.getMarkdown())
        },
    })
    const editorRef = useRef(editor)
    editorRef.current = editor

    // Recompute detection decorations once when the codex changes.
    useEffect(() => {
        const target = editorRef.current
        if (!target || target.isDestroyed) return
        target.view.dispatch(target.state.tr.setMeta(DETECTION_META, true))
    }, [detectionSig])

    // "Armed" affordance: holding Ctrl/Cmd brightens detected references and
    // turns the cursor into a pointer (mirrors the chat composer).
    useEffect(() => {
        const sync = (event: KeyboardEvent) => setArmed(event.ctrlKey || event.metaKey)
        const reset = () => setArmed(false)
        window.addEventListener('keydown', sync)
        window.addEventListener('keyup', sync)
        window.addEventListener('blur', reset)
        return () => {
            window.removeEventListener('keydown', sync)
            window.removeEventListener('keyup', sync)
            window.removeEventListener('blur', reset)
        }
    }, [])

    // Typewriter mode: keep the caret line vertically centered. Never runs during
    // the AI reveal (which owns its own scrollIntoView).
    useEffect(() => {
        if (!editor || !props.typewriter) return
        const recenter = () => {
            if (phaseRef.current !== 'idle') return
            const container = containerRef.current
            if (!container) return
            try {
                const coords = editor.view.coordsAtPos(editor.state.selection.head)
                const rect = container.getBoundingClientRect()
                container.scrollTop += coords.top - rect.top - rect.height * 0.45
            } catch {
                // coordsAtPos can throw mid-transaction; skip this tick.
            }
        }
        editor.on('selectionUpdate', recenter)
        editor.on('update', recenter)
        return () => {
            editor.off('selectionUpdate', recenter)
            editor.off('update', recenter)
        }
    }, [editor, props.typewriter])

    const inlineAI = useInlineAI(editor, {
        onRequestSaveFlush: () => propsRef.current.onRequestSaveFlush(),
        onGenerate: (request) => propsRef.current.onGenerate(request),
        onAcceptGeneration: (id) => propsRef.current.onAcceptGeneration(id),
        onDiscardGeneration: (id) => propsRef.current.onDiscardGeneration(id),
        onCritiqueResult: (generation) => propsRef.current.onCritiqueResult(generation),
    })

    aiHandlersRef.current = {
        escape: inlineAI.handleEscape,
        acceptKey: () => void inlineAI.accept(),
        rejectKey: () => void inlineAI.reject(),
        implicitAccept: inlineAI.handleImplicitAccept,
    }
    submitSlashRef.current = (item) => {
        if (item.type === 'block') {
            const target = editorRef.current
            if (target) item.run(target)
            return
        }
        void inlineAI.submit(item.command, item.instruction)
    }

    // --- slash menu controller ---
    slashControllerRef.current = {
        onStart: (suggestionProps) => {
            window.queueMicrotask(() => editorRef.current?.commands.aiSetPrompting(true))
            const anchor = menuAnchorFor(containerRef.current, suggestionProps.clientRect)
            if (!anchor) return
            setSlashMenu({ items: suggestionProps.items, anchor, command: suggestionProps.command, range: suggestionProps.range })
            setSlashIndex(0)
        },
        onUpdate: (suggestionProps) => {
            const anchor = menuAnchorFor(containerRef.current, suggestionProps.clientRect)
            if (!anchor) return
            setSlashMenu({ items: suggestionProps.items, anchor, command: suggestionProps.command, range: suggestionProps.range })
            setSlashIndex((index) => Math.min(index, Math.max(suggestionProps.items.length - 1, 0)))
        },
        onExit: () => {
            setSlashMenu(null)
            window.queueMicrotask(() => editorRef.current?.commands.aiSetPrompting(false))
        },
        onKeyDown: (event) => {
            const { menu, index } = slashRef.current
            if (!menu) return false
            if (event.key === 'ArrowDown') {
                setSlashIndex((index + 1) % menu.items.length)
                return true
            }
            if (event.key === 'ArrowUp') {
                setSlashIndex((index - 1 + menu.items.length) % menu.items.length)
                return true
            }
            if (event.key === 'Enter') {
                const item = menu.items[index]
                if (item) menu.command(item)
                return true
            }
            if (event.key === 'Escape') {
                // Leave no stray "/instruction" in the manuscript.
                editorRef.current?.chain().focus().deleteRange(menu.range).run()
                return true
            }
            return false
        },
    }

    // --- mention menu controller (same bridge shape, different item type) ---
    const mentionMenuFrom = (suggestionProps: SuggestionProps<EditorCodexEntry, MentionNodeAttrs>): MenuState<EditorCodexEntry> | null => {
        const anchor = menuAnchorFor(containerRef.current, suggestionProps.clientRect)
        if (!anchor) return null
        return {
            items: suggestionProps.items,
            anchor,
            command: (item) => suggestionProps.command({ id: item.id, label: item.label }),
            range: suggestionProps.range,
        }
    }
    mentionControllerRef.current = {
        onStart: (suggestionProps) => {
            const menu = mentionMenuFrom(suggestionProps)
            if (!menu) return
            setMentionMenu(menu)
            setMentionIndex(0)
        },
        onUpdate: (suggestionProps) => {
            const menu = mentionMenuFrom(suggestionProps)
            if (!menu) return
            setMentionMenu(menu)
            setMentionIndex((index) => Math.min(index, Math.max(suggestionProps.items.length - 1, 0)))
        },
        onExit: () => setMentionMenu(null),
        onKeyDown: (event) => {
            const { menu, index } = mentionRef.current
            if (!menu) return false
            if (event.key === 'ArrowDown') {
                setMentionIndex(menu.items.length ? (index + 1) % menu.items.length : 0)
                return true
            }
            if (event.key === 'ArrowUp') {
                setMentionIndex(menu.items.length ? (index - 1 + menu.items.length) % menu.items.length : 0)
                return true
            }
            if (event.key === 'Enter') {
                const item = menu.items[index]
                if (item) menu.command(item)
                return true
            }
            if (event.key === 'Escape') {
                const view = editorRef.current?.view
                if (view) exitSuggestion(view, CODEX_MENTION_SUGGESTION_KEY)
                return true
            }
            return false
        },
    }

    const handleSelectionCommand = (command: StoryGenerationCommand) => {
        const target = editorRef.current
        if (!target) return
        const selection = editorSelection(target)
        const { from, to } = target.state.selection
        if (!selection || from === to) return
        if (command === 'describe') {
            void inlineAI.submit(command, undefined, { selection, anchorPos: to })
        } else {
            void inlineAI.submit(command, undefined, { selection, replaceRange: { from, to } })
        }
    }

    const handleAddToCodex = () => {
        const target = editorRef.current
        if (!target) return
        const { from, to } = target.state.selection
        if (from === to) return
        const text = target.state.doc.textBetween(from, to, ' ').trim()
        if (text) propsRef.current.onAddToCodex?.(text)
    }

    const pillAnchor = useEditorAnchor(
        editor,
        containerRef,
        () => {
            const target = editorRef.current
            if (!target) return null
            return findAiSuggestionRange(target.state.doc)?.to ?? null
        },
        phase === 'reviewing',
    )

    useImperativeHandle(
        ref,
        (): NovelEditorHandle => ({
            getMarkdown: () => editorRef.current?.getMarkdown() ?? '',
            focus: () => {
                editorRef.current?.commands.focus()
            },
            hasActiveSuggestion: () => phaseRef.current !== 'idle',
            resolveSuggestion: (mode) => inlineAI.resolve(mode),
        }),
        [inlineAI],
    )

    return (
        <>
            <div
                ref={containerRef}
                className={cx(
                    'story-editor-shell relative flex min-h-[480px] flex-1 flex-col overflow-auto rounded-md border border-parchment-50/10 bg-ink-900/45 transition focus-within:border-ember-500/60',
                    armed && 'is-armed',
                )}
                data-focus={props.focusMode ? 'true' : undefined}
                data-typewriter={props.typewriter ? 'true' : undefined}
                data-testid="novel-editor"
                onKeyDown={(event) => {
                    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') {
                        event.preventDefault()
                        setFindOpen(true)
                    }
                }}
            >
                {editor && (
                    <EditorBubbleMenu
                        editor={editor}
                        phase={phase}
                        onSelectionCommand={handleSelectionCommand}
                        onAddToCodex={props.onAddToCodex ? handleAddToCodex : undefined}
                    />
                )}
                {editor && findOpen && (
                    <FindReplacePanel
                        editor={editor}
                        disabled={phase !== 'idle'}
                        onClose={() => {
                            setFindOpen(false)
                            editorRef.current?.commands.focus()
                        }}
                    />
                )}
                <EditorContent editor={editor} className="flex min-h-0 flex-1 flex-col" />
                {slashMenu && (
                    <SlashCommandMenu
                        items={slashMenu.items}
                        selectedIndex={slashIndex}
                        anchor={slashMenu.anchor}
                        onHover={setSlashIndex}
                        onSelect={(item) => slashMenu.command(item)}
                    />
                )}
                {mentionMenu && (
                    <MentionMenu
                        items={mentionMenu.items}
                        selectedIndex={mentionIndex}
                        anchor={mentionMenu.anchor}
                        onHover={setMentionIndex}
                        onSelect={(item) => mentionMenu.command(item)}
                    />
                )}
                {phase === 'reviewing' && pillAnchor && (
                    <AiSuggestionPill anchor={pillAnchor} onAccept={() => void inlineAI.accept()} onReject={() => void inlineAI.reject()} />
                )}
            </div>
            <Toast
                open={Boolean(inlineAI.error)}
                tone="error"
                title={t('novelEditor.editor.museFaltered')}
                message={inlineAI.error ?? undefined}
                onClose={inlineAI.clearError}
            />
        </>
    )
})
