/**
 * NovelEditor — the manuscript surface. TipTap (markdown in/out, serif prose)
 * with custom layers: the inline AI lifecycle (beat composer → generation
 * written straight into the chapter and highlighted in place → accept /
 * regenerate / decline from a row that sits with the text), codex @mentions,
 * inline reference detection (lorebook triggers + codex names), a selection
 * toolbar, and the "/" command menu.
 *
 * Body emission is gated while the AI owns the document so generated text can
 * never reach autosave; the studio additionally suspends its timer via
 * onSuggestionPhaseChange. The studio must remount this component per chapter
 * (key={chapterId}) — initialBody is read once.
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
import { exitSuggestion } from '@tiptap/suggestion'
import type { StoryGenerationCommand } from '@/shared'
import { Toast, cx } from '@/ui/primitives'
import { useOpenLoreEntry } from '@/features/lorebook/hooks/useOpenLoreEntry'
import type { AiActionRowModel } from './extensions/aiActionRow'
import { AiBeat } from './extensions/aiBeat'
import { AiSuggestion } from './extensions/aiSuggestion'
import { createCodexMention } from './extensions/codexMention'
import { buildDetectionMatchers, createDetection, DETECTION_META, type DetectionMatchers } from './extensions/detection'
import { SearchReplace } from './extensions/searchReplace'
import { createSlashCommand, type SlashItem } from './extensions/slashCommand'
import { BeatComposer } from './components/BeatComposer'
import { EditorBubbleMenu } from './components/EditorBubbleMenu'
import { FindReplacePanel } from './components/FindReplacePanel'
import { MentionMenu } from './components/MentionMenu'
import { SlashCommandMenu } from './components/SlashCommandMenu'
import { useAiActionRow } from './hooks/useAiActionRow'
import { useBeatComposer } from './hooks/useBeatComposer'
import { useEditorChrome } from './hooks/useEditorChrome'
import { useInlineAI } from './hooks/useInlineAI'
import { useSuggestionMenu } from './hooks/useSuggestionMenu'
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

    const [findOpen, setFindOpen] = useState(false)
    const [phase, setPhaseState] = useState<InlineAIPhase>('idle')
    const phaseRef = useRef<InlineAIPhase>('idle')
    // Last markdown handed to onBodyChange — lets the idle transition re-emit
    // exactly once when gated edits (a "/query" left behind by a click-away)
    // changed the doc without ever reaching the draft.
    const lastEmittedRef = useRef<string | null>(null)

    // Everything the extensions need but cannot capture at construction time.
    const aiHandlersRef = useRef<{
        escape: (phase: InlineAIPhase) => void
        acceptKey: () => void
        rejectKey: () => void
        regenerateKey: () => void
        implicitAccept: () => void
    }>({
        escape: () => {},
        acceptKey: () => {},
        rejectKey: () => {},
        regenerateKey: () => {},
        implicitAccept: () => {},
    })
    const submitSlashRef = useRef<(item: SlashItem) => void>(() => {})
    const editorRef = useRef<ReturnType<typeof useEditor> | null>(null)
    const rowModelRef = useRef<AiActionRowModel | null>(null)

    const slash = useSuggestionMenu<SlashItem>({
        containerRef,
        toCommand: (suggestionProps) => suggestionProps.command,
        onEscape: (state) => {
            // Leave no stray "/query" in the manuscript.
            editorRef.current?.chain().focus().deleteRange(state.range).run()
        },
        onOpenChange: (open) => {
            window.queueMicrotask(() => editorRef.current?.commands.aiSetPrompting(open))
        },
    })

    const mention = useSuggestionMenu<EditorCodexEntry, MentionNodeAttrs>({
        containerRef,
        toCommand: (suggestionProps) => (item) => suggestionProps.command({ id: item.id, label: item.label }),
        onEscape: () => {
            const view = editorRef.current?.view
            if (view) exitSuggestion(view, CODEX_MENTION_SUGGESTION_KEY)
        },
    })

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
            AiBeat.configure({
                getLabels: () => ({
                    beat: tRef.current('novelEditor.beat.nodeLabel'),
                    remove: tRef.current('novelEditor.beat.nodeRemove'),
                }),
            }),
            AiSuggestion.configure({
                onPhaseChange: (nextPhase) => {
                    phaseRef.current = nextPhase
                    setPhaseState(nextPhase)
                    propsRef.current.onSuggestionPhaseChange?.(nextPhase)
                    // Body emission is gated while the AI owns the document, so
                    // edits made during those phases never reached the draft. When
                    // the lifecycle returns to idle without a doc change of its own
                    // (cancel has none), re-emit if the doc drifted. Deferred: the
                    // phase flips inside command execution, before dispatch lands.
                    if (nextPhase === 'idle') {
                        window.queueMicrotask(() => {
                            const target = editorRef.current
                            if (!target || target.isDestroyed || phaseRef.current !== 'idle') return
                            const markdown = target.getMarkdown()
                            if (lastEmittedRef.current !== null && markdown !== lastEmittedRef.current) {
                                lastEmittedRef.current = markdown
                                propsRef.current.onBodyChange(markdown)
                            }
                        })
                    }
                },
                onImplicitAccept: () => aiHandlersRef.current.implicitAccept(),
                onEscape: (escapePhase) => aiHandlersRef.current.escape(escapePhase),
                onAcceptRequest: () => aiHandlersRef.current.acceptKey(),
                onRejectRequest: () => aiHandlersRef.current.rejectKey(),
                onRegenerateRequest: () => aiHandlersRef.current.regenerateKey(),
                getRowModel: () => rowModelRef.current,
            }),
            createSlashCommand({
                controllerRef: slash.controllerRef,
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
                        onStart: (p) => mention.controllerRef.current?.onStart(p),
                        onUpdate: (p) => mention.controllerRef.current?.onUpdate(p),
                        onExit: () => mention.controllerRef.current?.onExit(),
                        onKeyDown: ({ event }) => mention.controllerRef.current?.onKeyDown(event) ?? false,
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
        // eslint-disable-next-line react-hooks/exhaustive-deps -- built once; everything dynamic goes through refs
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
        onCreate: ({ editor: created }) => {
            // Baseline for the idle re-emit comparison: getMarkdown() may
            // normalize initialBody, and that normalization alone must never
            // mark the draft dirty.
            lastEmittedRef.current = created.getMarkdown()
        },
        onUpdate: ({ editor: next }) => {
            // Generated text must never reach the draft; prompting queries are
            // transient and self-heal when the range is deleted.
            if (phaseRef.current !== 'idle') return
            const markdown = next.getMarkdown()
            // Doc changes that don't change the serialized body (mark removal on
            // accept) must not dirty the draft for a no-op save.
            if (markdown === lastEmittedRef.current) return
            lastEmittedRef.current = markdown
            propsRef.current.onBodyChange(markdown)
        },
    })
    editorRef.current = editor

    const { armed } = useEditorChrome(editor, {
        containerRef,
        typewriter: Boolean(props.typewriter),
        getPhase: () => phaseRef.current,
    })

    // Recompute detection decorations once when the codex changes.
    useEffect(() => {
        const target = editorRef.current
        if (!target || target.isDestroyed) return
        target.view.dispatch(target.state.tr.setMeta(DETECTION_META, true))
    }, [detectionSig])

    const inlineAI = useInlineAI(editor, {
        onRequestSaveFlush: () => propsRef.current.onRequestSaveFlush(),
        onGenerate: (request, options) => propsRef.current.onGenerate(request, options),
        onAcceptGeneration: (id) => propsRef.current.onAcceptGeneration(id),
        onDiscardGeneration: (id) => propsRef.current.onDiscardGeneration(id),
        onCritiquePreview: (text, state) => propsRef.current.onCritiquePreview?.(text, state),
        onCritiqueResult: (generation) => propsRef.current.onCritiqueResult(generation),
    })

    aiHandlersRef.current = {
        escape: inlineAI.handleEscape,
        acceptKey: () => void inlineAI.accept(),
        rejectKey: () => void inlineAI.reject(),
        regenerateKey: () => void inlineAI.regenerate(),
        implicitAccept: inlineAI.handleImplicitAccept,
    }

    const { announcement } = useAiActionRow(editorRef, phase, inlineAI, rowModelRef)

    const beat = useBeatComposer({ editorRef, containerRef, submit: inlineAI.submit })

    submitSlashRef.current = (item) => {
        if (item.type === 'block') {
            const target = editorRef.current
            if (target) item.run(target)
            return
        }
        if (item.type === 'beat') {
            beat.openAt(item.instruction ?? '')
            return
        }
        void inlineAI.submit(item.command)
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

    useImperativeHandle(
        ref,
        (): NovelEditorHandle => ({
            getMarkdown: () => editorRef.current?.getMarkdown() ?? '',
            focus: () => {
                editorRef.current?.commands.focus()
            },
            openFind: () => setFindOpen(true),
            hasActiveSuggestion: () => phaseRef.current !== 'idle',
            resolveSuggestion: (mode) => inlineAI.resolve(mode),
        }),
        [inlineAI],
    )

    return (
        <>
            {/* The shell is the editor's scrollport, so anything `absolute` inside it
                is placed against the scrolled content, not the visible area. The Find
                panel therefore lives in this non-scrolling wrapper and stays pinned
                while findNext() scrolls matches into view. */}
            <div className="relative flex min-h-0 flex-1 flex-col">
                <div
                    ref={containerRef}
                    className={cx('story-editor-shell relative flex min-h-0 flex-1 flex-col overflow-auto', armed && 'is-armed')}
                    data-focus={props.focusMode ? 'true' : undefined}
                    data-typewriter={props.typewriter ? 'true' : undefined}
                    data-testid="novel-editor"
                    onKeyDown={(event) => {
                        // The composer is rendered inside this scrollport, so its
                        // controls bubble here. It owns the keyboard while it is
                        // open — otherwise Mod-Enter on a length chip re-opens it
                        // and silently wipes the sentence being typed, and Mod-F
                        // buries it under the find panel.
                        if (beat.open) return
                        const mod = event.ctrlKey || event.metaKey
                        if (!mod) return
                        if (event.key.toLowerCase() === 'f') {
                            event.preventDefault()
                            setFindOpen(true)
                            return
                        }
                        // Mod-Enter belongs to Regenerate while a generation is under
                        // review — that binding lives in the extension keymap.
                        if (event.key === 'Enter' && phaseRef.current === 'idle') {
                            event.preventDefault()
                            beat.openAt('')
                        }
                    }}
                >
                    {editor && (
                        <EditorBubbleMenu
                            editor={editor}
                            phase={phase}
                            onSelectionCommand={handleSelectionCommand}
                            onBeatOnSelection={() => beat.openAt('')}
                            onAddToCodex={props.onAddToCodex ? handleAddToCodex : undefined}
                        />
                    )}
                    <EditorContent editor={editor} className="flex min-h-0 flex-1 flex-col" />
                    {slash.menu && (
                        <SlashCommandMenu
                            items={slash.menu.items}
                            selectedIndex={slash.index}
                            anchor={slash.menu.anchor}
                            onHover={slash.setIndex}
                            onSelect={(item) => slash.menu?.command(item)}
                        />
                    )}
                    {mention.menu && (
                        <MentionMenu
                            items={mention.menu.items}
                            selectedIndex={mention.index}
                            anchor={mention.menu.anchor}
                            onHover={mention.setIndex}
                            onSelect={(item) => mention.menu?.command(item)}
                        />
                    )}
                    {beat.open && beat.target && (
                        <BeatComposer
                            anchor={beat.target.anchor}
                            containerRef={containerRef}
                            instruction={beat.instruction}
                            length={beat.length}
                            contextLine={beat.contextLine}
                            contextCount={props.enabledContextCount ?? 0}
                            targetsSelection={Boolean(beat.target.replaceRange)}
                            optionsOpen={beat.optionsOpen}
                            onToggleOptions={beat.toggleOptions}
                            onInstructionChange={beat.setInstruction}
                            onLengthChange={beat.setLength}
                            onSubmit={beat.write}
                            onCancel={beat.cancel}
                        />
                    )}
                </div>
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
            </div>
            <span className="sr-only" aria-live="polite" data-testid="ai-suggestion-announcer">
                {announcement}
            </span>
            <Toast
                open={Boolean(inlineAI.error)}
                tone="error"
                title={t('novelEditor.editor.generationFailedTitle')}
                message={inlineAI.error ?? undefined}
                onClose={inlineAI.clearError}
            />
        </>
    )
})
