import { createManuscriptInvisibles,setManuscriptInvisibles } from './extensions/manuscriptInvisibles'
import { createManuscriptHighlight } from './extensions/manuscriptHighlight'
import { captureDocument, capturePosition, documentMarkdown, isManuscriptPosition, restorePosition, splitCursor } from './manuscript'
import { documentSignature } from '@/shared/storyDocument'
import { editorPositionFingerprint } from './positionFingerprint'
import { transactionAnchorEdits } from './anchorEdits'
import { isStoryAnchorEdits } from '@/shared/storyAnchorEdits'
import type { StoryAnchorEdit } from '@/shared'
import { ManuscriptIdentity } from './extensions/manuscriptIdentity'
import { ManuscriptSearchHighlight,revealManuscriptSearchTarget,scrollManuscriptSearchTarget } from './extensions/manuscriptSearchTarget'
import { createManuscriptLinks } from './extensions/manuscriptLinks'
import { captureLinkTarget,type ManuscriptLinkTarget } from './manuscriptLinks'
import { ManuscriptLinkDialog } from './components/ManuscriptLinkDialog'
/**
 * NovelEditor — the manuscript surface. TipTap (markdown in/out, serif prose)
 * with custom layers: the inline AI lifecycle (beat composer → generation
 * previewed outside canonical prose → accept /
 * regenerate / decline from a row that sits with the text), codex @mentions,
 * inline reference detection (lorebook triggers + codex names), a selection
 * toolbar, and the "/" command menu.
 *
 * Ordinary prose edits continue into the local journal during review. Proposal
 * decorations never enter it; the studio suspends remote autosave through
 * onSuggestionPhaseChange. The studio must remount this component per chapter
 * (key={chapterId}) — initialBody is read once.
 *
 * `readOnly` (the story's workspace is archived) makes the manuscript a reader:
 * TipTap is not editable, so typing, "/" and "@" cannot start; the selection
 * toolbar, the beat composer and Replace are gone or disabled, and a beat note
 * cannot be removed. Selecting, copying, Find and Ctrl/Cmd-click on a detected
 * reference keep working. Turning read-only declines whatever the AI has live.
 */

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { EditorContent, useEditor } from '@tiptap/react'
import { manuscriptStarterKit } from './manuscriptStarterKit'
import { Markdown } from '@tiptap/markdown'
import Placeholder from '@tiptap/extension-placeholder'
import { createAuthorTypography } from './extensions/authorTypography'
import { DEFAULT_TYPING } from '../utils/typingPreferences'
import { PluginKey } from '@tiptap/pm/state'
import type { MentionNodeAttrs } from '@tiptap/extension-mention'
import { exitSuggestion } from '@tiptap/suggestion'
import type { StoryGenerationCommand } from '@/shared'
import { privateVariantSeed } from './privateVariantSeed'
import { Button,Callout,Toast, cx } from '@/ui/primitives'
import { useOpenLoreEntry } from '@/features/lorebook/hooks/useOpenLoreEntry'
import type { AiActionRowModel } from './extensions/aiActionRow'
import { AiBeat } from './extensions/aiBeat'
import { AiSuggestion } from './extensions/aiSuggestion'
import { createCodexMention } from './extensions/codexMention'
import { buildDetectionMatchers, createDetection, DETECTION_META, type DetectionMatchers } from './extensions/detection'
import { SearchReplace } from './extensions/searchReplace'
import { SLASH_COMMAND_PLUGIN_KEY, createSlashCommand, type SlashItem } from './extensions/slashCommand'
import { BeatComposer } from './components/BeatComposer'
import { EditorBubbleMenu } from './components/EditorBubbleMenu'
import { FindReplacePanel } from './components/FindReplacePanel'
import { MentionMenu } from './components/MentionMenu'
import { ManuscriptReferenceDialog } from './components/ManuscriptReferenceDialog'
import { referenceChoices, mentionChoices, type ManuscriptReferenceChoice } from './referenceChoices'
import { createReferenceInspection } from './extensions/referenceInspection'
import { captureBlockMove, moveBlockAdjacent, type BlockMoveTarget } from './blockMovement'
import { createBlockMovement } from './extensions/blockMovement'
import { ManuscriptBlockMoveDialog } from './components/ManuscriptBlockMoveDialog'
import { SlashCommandMenu } from './components/SlashCommandMenu'
import { useAiActionRow } from './hooks/useAiActionRow'
import { useBeatComposer } from './hooks/useBeatComposer'
import { useEditorChrome } from './hooks/useEditorChrome'
import { useInlineAI } from './hooks/useInlineAI'
import { useSuggestionMenu } from './hooks/useSuggestionMenu'
import { editorSelection } from './documentSelection'
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
    const restoringPositionRef = useRef(false)
    const positionSequenceRef = useRef(0)
    const interactionEpochRef = useRef(0)
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
    // Last markdown handed to onDocumentChange — lets the idle transition re-emit
    // exactly once when gated edits (a "/query" left behind by a click-away)
    // changed the doc without ever reaching the draft.
    const lastEmittedRef = useRef<string | null>(null)
    const anchorEditsRef=useRef<StoryAnchorEdit[]|null>([])

    // Everything the extensions need but cannot capture at construction time.
    const aiHandlersRef = useRef<{
        escape: (phase: InlineAIPhase) => void
        acceptKey: () => void
        rejectKey: () => void
        regenerateKey: () => void
    }>({
        escape: () => {},
        acceptKey: () => {},
        rejectKey: () => {},
        regenerateKey: () => {},
    })
    const submitSlashRef = useRef<(item: SlashItem) => void>(() => {})
    const editorRef = useRef<ReturnType<typeof useEditor> | null>(null)
    const [linkTarget,setLinkTarget]=useState<ManuscriptLinkTarget|null>(null)
    const [pasteAsText,setPasteAsText]=useState(0)
    const [linkUnavailable,setLinkUnavailable]=useState(false)
    const openLink=(position?:number)=>{
        const editor=editorRef.current
        if(!editor||editor.isDestroyed)return
        const target=captureLinkTarget(editor,position)
        if(!target||propsRef.current.readOnly&&(!target.hasLink||target.mixed)){setLinkUnavailable(true);return}
        setLinkUnavailable(false)
        if(target)setLinkTarget(target)
    }
    const openLinkRef=useRef(openLink)
    openLinkRef.current=openLink
    const recentReferences = useRef<string[]>([])
    const [referenceChanged, setReferenceChanged] = useState(false)
    const [referenceInspection, setReferenceInspection] = useState<{ choices: ManuscriptReferenceChoice[] } | null>(null)
    const inspectReferences = (position?: number) => {
        const target = editorRef.current
        if (target && !target.isDestroyed) setReferenceInspection({ choices: referenceChoices(target, position) })
    }
    const inspectReferencesRef = useRef(inspectReferences)
    inspectReferencesRef.current = inspectReferences
    const [blockMoveTarget, setBlockMoveTarget] = useState<BlockMoveTarget | null>(null)
    const [blockNotice, setBlockNotice] = useState<string | null>(null)
    const canMoveBlocks = () => !propsRef.current.readOnly && phaseRef.current === 'idle'
    const openBlockMove = () => {
        if (!canMoveBlocks()) { setBlockNotice('blocked'); return }
        const target = editorRef.current && captureBlockMove(editorRef.current)
        if (!target || !target.destinations.length) { setBlockNotice('noTarget'); return }
        setBlockNotice(null); setBlockMoveTarget(target)
    }
    const openBlockMoveRef = useRef(openBlockMove)
    openBlockMoveRef.current = openBlockMove
    const moveAdjacentBlocks = (direction: 'up' | 'down') => {
        if (!canMoveBlocks()) { setBlockNotice('blocked'); return }
        const target = editorRef.current && captureBlockMove(editorRef.current)
        setBlockNotice(target ? moveBlockAdjacent(target, direction, canMoveBlocks) : 'noTarget')
    }
    const moveAdjacentBlocksRef = useRef(moveAdjacentBlocks)
    moveAdjacentBlocksRef.current = moveAdjacentBlocks
    const afterDialogBlockMove = () => {
        setBlockNotice('moved')
        const target = editorRef.current
        if (!target) return
        const document = target.state.doc, selection = target.state.selection
        let cancelled = false
        const clean = () => { window.removeEventListener('pointerdown', cancel, true); window.removeEventListener('keydown', cancel, true) }
        const cancel = () => { cancelled = true; clean() }
        window.addEventListener('pointerdown', cancel, { capture: true, once: true })
        window.addEventListener('keydown', cancel, { capture: true, once: true })
        // The shared modal first restores its trigger. Return to the moved
        // passage after that cleanup; a newer user action always wins.
        window.requestAnimationFrame(() => {
            clean()
            if (cancelled || target.isDestroyed || editorRef.current !== target || target.state.doc !== document || !target.state.selection.eq(selection) || !canMoveBlocks()) return
            target.view.focus()
        })
    }
    const emitPosition = (target: NonNullable<typeof editorRef.current>, scrollTop: number) => {
        if (!propsRef.current.onPositionChange) return
        const position = capturePosition(target, scrollTop)
        if (!position) return
        const sequence = ++positionSequenceRef.current
        const document = target.state.doc
        propsRef.current.onPositionChange?.(position)
        if (position.anchor.nodeId === position.head.nodeId && position.anchor.offset === position.head.offset) return
        void editorPositionFingerprint(document).then((fingerprint) => {
            if (!fingerprint || target.isDestroyed || editorRef.current !== target || target.state.doc !== document || positionSequenceRef.current !== sequence) return
            propsRef.current.onPositionChange?.({ ...position, documentFingerprint: fingerprint })
        })
    }
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
        onInspect: (item) => setReferenceInspection({ choices: [{ key: `codex:${item.id}`, id: item.id, label: item.label, kind: 'candidate' }] }),
        toCommand: (suggestionProps) => (item) => {
            const current = codexRef.current.find((entry) => entry.id === item.id)
            if (propsRef.current.readOnly || phaseRef.current !== 'idle' || !current || current.removed || current.label !== item.label || current.description !== item.description || current.sourceVersionId !== item.sourceVersionId) {
                if (editorRef.current) exitSuggestion(editorRef.current.view, CODEX_MENTION_SUGGESTION_KEY)
                setReferenceChanged(true); return
            }
            recentReferences.current = [item.id, ...recentReferences.current.filter((id) => id !== item.id)].slice(0, 32)
            suggestionProps.command({ id: item.id, label: item.label })
        },
        onEscape: () => {
            const view = editorRef.current?.view
            if (view) exitSuggestion(view, CODEX_MENTION_SUGGESTION_KEY)
        },
    })

    const extensions = useMemo(
        () => [
            manuscriptStarterKit(),
            Markdown.configure({ indentation: { style: 'space', size: 2 } }),
            createManuscriptHighlight(()=>phaseRef.current==='idle'&&!propsRef.current.readOnly),
            createManuscriptInvisibles({viewport:()=>containerRef.current?.getBoundingClientRect()??null,labels:()=>({
                space:tRef.current('novelEditor.writingMarks.space'),tab:tRef.current('novelEditor.writingMarks.tab'),lineBreak:tRef.current('novelEditor.writingMarks.lineBreak'),paragraph:tRef.current('novelEditor.writingMarks.paragraph'),
                noBreakSpace:tRef.current('novelEditor.writingMarks.noBreakSpace'),zeroWidthSpace:tRef.current('novelEditor.writingMarks.zeroWidthSpace'),wordJoiner:tRef.current('novelEditor.writingMarks.wordJoiner'),byteOrderMark:tRef.current('novelEditor.writingMarks.byteOrderMark'),
            })}),
            Placeholder.configure({ placeholder: tRef.current('novelEditor.editor.placeholder') }),
            createAuthorTypography(()=>propsRef.current.typingPreferences??DEFAULT_TYPING,()=>propsRef.current.manuscriptLanguage),
            SearchReplace,
            ManuscriptIdentity,
            ManuscriptSearchHighlight,
            createManuscriptLinks({onOpen:(position)=>openLinkRef.current(position),onPasteAsText:(count)=>setPasteAsText(count)}),
            createReferenceInspection((position) => inspectReferencesRef.current(position)),
            createBlockMovement((direction) => moveAdjacentBlocksRef.current(direction)),
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
                            const document = captureDocument(target)
                            const signature = documentSignature(document)
                            if (lastEmittedRef.current !== null && signature !== lastEmittedRef.current) {
                                lastEmittedRef.current = signature
                                propsRef.current.onDocumentChange(document,anchorEditsRef.current)
                            }
                            anchorEditsRef.current=[]
                        })
                    }
                },
                onEscape: (escapePhase) => aiHandlersRef.current.escape(escapePhase),
                onAcceptRequest: () => aiHandlersRef.current.acceptKey(),
                onRejectRequest: () => aiHandlersRef.current.rejectKey(),
                onRegenerateRequest: () => aiHandlersRef.current.regenerateKey(),
                getRowModel: () => rowModelRef.current,
            }),
            createSlashCommand({
                getAiDisabled: () => Boolean(propsRef.current.aiDisabled),
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
                    items: ({ query }) => mentionChoices(codexRef.current, editorRef.current?.state.doc ?? null, query, recentReferences.current),
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
                onInspect: (position) => inspectReferencesRef.current(position),
                getReadOnly: () => Boolean(propsRef.current.readOnly),
            }),
        ],
        // eslint-disable-next-line react-hooks/exhaustive-deps -- built once; everything dynamic goes through refs
        [],
    )

    const readOnly = Boolean(props.readOnly)
    const editor = useEditor({
        extensions,
        content: props.initialDocument?.content ?? props.initialBody ?? '',
        ...(props.initialDocument ? {} : {contentType:'markdown' as const}),
        // Read once at creation; later changes go through setEditable below.
        editable: !readOnly,
        editorProps: {
            attributes: {
                role: 'textbox',
                'aria-multiline': 'true',
                'aria-readonly':readOnly?'true':'false',
                tabindex: '0',
                'aria-keyshortcuts': 'Alt+Enter Alt+Shift+ArrowUp Alt+Shift+ArrowDown',
                'aria-label': tRef.current('novelEditor.editor.bodyLabel'),
                class: 'story-editor-prose',
            },
        },
        onCreate: ({ editor: created }) => {
            // Baseline for the idle re-emit comparison: getMarkdown() may
            // normalize initialBody, and that normalization alone must never
            // mark the draft dirty.
            lastEmittedRef.current = documentSignature(captureDocument(created))
            anchorEditsRef.current=[]
            const position=propsRef.current.getInitialPosition ? propsRef.current.getInitialPosition() : propsRef.current.initialPosition
            if (!propsRef.current.searchTarget&&position&&isManuscriptPosition(position)) {
                const document=created.state.doc, selection=created.state.selection, epoch=interactionEpochRef.current
                const apply=(range:boolean)=>{
                    if(created.isDestroyed||created.state.doc!==document||!created.state.selection.eq(selection)||interactionEpochRef.current!==epoch)return
                    const target=range?position:{...position,anchor:{...position.head}}
                    restoringPositionRef.current=true
                    try {
                        if (restorePosition(created,target)&&containerRef.current) containerRef.current.scrollTop=position.scrollTop
                    } finally { restoringPositionRef.current=false }
                }
                if(position.documentFingerprint)void editorPositionFingerprint(document).then((fingerprint)=>apply(fingerprint!==null&&fingerprint===position.documentFingerprint))
                else apply(false)
            }
        },
        onSelectionUpdate: ({editor:next})=>{
            if (restoringPositionRef.current) return
            interactionEpochRef.current++
            emitPosition(next,containerRef.current?.scrollTop??0)
        },
        onFocus: () => { interactionEpochRef.current++; propsRef.current.onActivate?.() },
        onTransaction:({transaction,appendedTransactions})=>{
            if(!transaction.docChanged&&!appendedTransactions.some((value)=>value.docChanged))return
            const next=transactionAnchorEdits([transaction,...appendedTransactions])
            if(next===null||anchorEditsRef.current===null){anchorEditsRef.current=null;return}
            const combined=[...anchorEditsRef.current,...next]
            anchorEditsRef.current=isStoryAnchorEdits(combined)?combined:null
        },
        onUpdate: ({ editor: next }) => {
            // Proposals are decorations, so ordinary prose edits remain safe
            // to journal during pending/review. Only slash queries are transient.
            if (phaseRef.current === 'prompting'||SLASH_COMMAND_PLUGIN_KEY.getState(next.state)?.active) return
            const document = captureDocument(next)
            const signature = documentSignature(document)
            // Doc changes that don't change the serialized body (mark removal on
            // accept) must not dirty the draft for a no-op save.
            if (signature === lastEmittedRef.current) {anchorEditsRef.current=[];return}
            lastEmittedRef.current = signature
            propsRef.current.onDocumentChange(document,anchorEditsRef.current)
            anchorEditsRef.current=[]
        },
    })
    editorRef.current = editor
    const revealedSearchRef=useRef<string|null>(null)
    const searchScrollingRef=useRef<string|null>(null)
    const {searchTarget,searchTargetBlocked,onSearchReveal}=props
    useEffect(()=>{
        const target=searchTarget
        if(!editor||editor.isDestroyed||!target||revealedSearchRef.current===target.token)return
        revealedSearchRef.current=target.token
        interactionEpochRef.current++
        const applied=!searchTargetBlocked&&phaseRef.current==='idle'&&revealManuscriptSearchTarget(editor,target)
        if(applied){
            const document=editor.state.doc,selection=editor.state.selection,epoch=interactionEpochRef.current
            searchScrollingRef.current=target.token
            // Wait for the closing drawer and status message to finish layout.
            // New input, another result, or another document cancels this tail.
            window.requestAnimationFrame(()=>{
                try{
                    if(editor.isDestroyed||editorRef.current!==editor||editor.state.doc!==document||!editor.state.selection.eq(selection)||interactionEpochRef.current!==epoch||revealedSearchRef.current!==target.token)return
                    if(containerRef.current)scrollManuscriptSearchTarget(editor,containerRef.current)
                }finally{if(searchScrollingRef.current===target.token)searchScrollingRef.current=null}
            })
        }
        onSearchReveal?.(target.token,applied)
    },[editor,searchTarget,searchTargetBlocked,onSearchReveal])

    useEffect(()=>{if(editor&&!editor.isDestroyed)setManuscriptInvisibles(editor,Boolean(props.showInvisibles))},[editor,props.showInvisibles,t])

    // useEditor keeps the live editability across option updates, so a change
    // after creation (the workspace archived or restored) is applied here.
    useEffect(() => {
        if (!editor || editor.isDestroyed || editor.isEditable === !readOnly) return
        editor.setEditable(!readOnly, false)
    }, [editor, readOnly])

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

    const autocomplete=mention.menu??slash.menu
    const autocompleteId=mention.menu?mention.menuId:slash.menuId
    const autocompleteIndex=mention.menu?mention.index:slash.index
    useEffect(()=>{
        if(!editor||editor.isDestroyed)return
        const dom=editor.view.dom
        if(autocomplete){
            dom.setAttribute('aria-controls',autocompleteId)
            dom.setAttribute('aria-expanded','true')
            dom.setAttribute('aria-autocomplete','list')
            if(autocomplete.items.length>0)dom.setAttribute('aria-activedescendant',`${autocompleteId}-option-${autocompleteIndex}`)
            else dom.removeAttribute('aria-activedescendant')
        }else{
            for(const key of ['aria-controls','aria-expanded','aria-autocomplete','aria-activedescendant'])dom.removeAttribute(key)
        }
    },[editor,autocomplete,autocompleteId,autocompleteIndex])


    const inlineAI = useInlineAI(editor, {
        onRequestSaveFlush: () => propsRef.current.aiDisabled ? Promise.resolve(false) : propsRef.current.onRequestSaveFlush(),
        onGenerate: (request, options) => {
            if (propsRef.current.aiDisabled) return Promise.reject(new Error(tRef.current('novelEditor.offline.title')))
            return propsRef.current.onGenerate(request, options)
        },
        onAcceptGeneration: (id, variant) => variant ? propsRef.current.onAcceptGeneration(id, variant) : propsRef.current.onAcceptGeneration(id),
        onDiscardGeneration: (id) => propsRef.current.onDiscardGeneration(id),
        onCritiquePreview: (text, state) => propsRef.current.onCritiquePreview?.(text, state),
        onCritiqueResult: (generation) => propsRef.current.onCritiqueResult(generation),
    })

    aiHandlersRef.current = {
        escape: inlineAI.handleEscape,
        acceptKey: () => { if (!propsRef.current.aiDisabled) void inlineAI.accept() },
        rejectKey: () => void inlineAI.reject(),
        regenerateKey: () => { if (!propsRef.current.aiDisabled) void inlineAI.regenerate() },
    }

    const connectedActions = { ...inlineAI, canRegenerate: inlineAI.canRegenerate && !props.aiDisabled,
        accept: async () => { if (!propsRef.current.aiDisabled) await inlineAI.accept() },
        regenerate: async () => { if (!propsRef.current.aiDisabled) await inlineAI.regenerate() } }
    const { announcement } = useAiActionRow(editorRef, phase, connectedActions, rowModelRef)

    const beat = useBeatComposer({ editorRef, containerRef, submit: inlineAI.submit })

    // Turning read-only mid-flight: nothing the AI has live may land, and the
    // composer must not stay open over a manuscript that can no longer change.
    const { resolve: resolveSuggestion } = inlineAI
    const { open: beatOpen, cancel: cancelBeat } = beat
    useEffect(() => {
        if (!readOnly) return
        void resolveSuggestion('reject')
        if (beatOpen) cancelBeat()
    }, [beatOpen, cancelBeat, readOnly, resolveSuggestion])

    submitSlashRef.current = (item) => {
        if (propsRef.current.readOnly) return
        if (item.type === 'block') {
            const target = editorRef.current
            if (target) item.run(target)
            return
        }
        if (propsRef.current.aiDisabled) return
        if (item.type === 'beat') {
            beat.openAt(item.instruction ?? '')
            return
        }
        void inlineAI.submit(item.command)
    }

    const handleSelectionCommand = (command: StoryGenerationCommand) => {
        const target = editorRef.current
        if (!target || readOnly || propsRef.current.aiDisabled) return
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
        if (!target || readOnly) return
        const { from, to } = target.state.selection
        if (from === to) return
        const text = target.state.doc.textBetween(from, to, ' ').trim()
        if (text) propsRef.current.onAddToCodex?.(text)
    }

    useImperativeHandle(
        ref,
        (): NovelEditorHandle => ({
            getMarkdown: () => editorRef.current ? documentMarkdown(captureDocument(editorRef.current)) : '',
            getDocument: () => editorRef.current ? captureDocument(editorRef.current) : null,
            getSelection: () => editorRef.current ? editorSelection(editorRef.current) : null,
            getInstanceToken: () => editorRef.current,
            getSplitCursor: () => editorRef.current ? splitCursor(editorRef.current) : null,
            getPosition: () => editorRef.current ? capturePosition(editorRef.current,containerRef.current?.scrollTop??0) : null,
            focus: () => {
                editorRef.current?.commands.focus()
            },
            openFind: () => setFindOpen(true),
            openLink:()=>openLinkRef.current(),
            openReferences:()=>inspectReferencesRef.current(),
            openBlockMove:()=>openBlockMoveRef.current(),
            hasActiveSuggestion: () => phaseRef.current !== 'idle',
            resolveSuggestion: (mode) => inlineAI.resolve(mode),
            reviewGeneration: (review) => propsRef.current.readOnly || propsRef.current.aiDisabled ? false : inlineAI.reviewGeneration(review),
            prepareVariantDraft: (context) => editorRef.current ? privateVariantSeed(editorRef.current, context) : null,
            cutSelection: (expected) => {
                const target = editorRef.current
                if (!target || propsRef.current.readOnly || phaseRef.current !== 'idle') return false
                const { from, to } = target.state.selection
                if (from === to || editorSelection(target)?.text !== expected) return false
                return target.chain().focus().deleteRange({ from, to }).run()
            },
            insertText: (text) => {
                const target = editorRef.current
                if (!target || propsRef.current.readOnly || phaseRef.current !== 'idle' || !text) return false
                const paragraphs = text.split(/\n{2,}/)
                const content = paragraphs.length === 1 ? text : paragraphs.map((paragraph) => ({ type: 'paragraph', content: paragraph ? [{ type: 'text', text: paragraph }] : [] }))
                return target.chain().focus().insertContent(content).run()
            },
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
                    onScroll={()=>{
                        if(restoringPositionRef.current||searchScrollingRef.current)return
                        interactionEpochRef.current++
                        const current=editorRef.current
                        if(current)emitPosition(current,containerRef.current?.scrollTop??0)
                    }}
                    className={cx(
                        'story-editor-shell relative flex min-h-0 flex-1 flex-col overflow-auto',
                        armed && 'is-armed',
                        // A beat note's remove control is a write; read-only shows the note alone.
                        readOnly && '[&_.ai-beat-remove]:hidden',
                    )}
                    data-focus={props.focusMode ? 'true' : undefined}
                    data-typewriter={props.typewriter ? 'true' : undefined}
                    data-readonly={readOnly ? 'true' : undefined}
                    data-testid="novel-editor"
                    onPointerDown={()=>{interactionEpochRef.current++}}
                    onWheel={()=>{interactionEpochRef.current++}}
                    onTouchMove={()=>{interactionEpochRef.current++}}
                    onKeyDown={(event) => {
                        interactionEpochRef.current++
                        if(event.defaultPrevented)return
                        // The composer is rendered inside this scrollport, so its
                        // controls bubble here. It owns the keyboard while it is
                        // open — otherwise Mod-Enter on a length chip re-opens it
                        // and silently wipes the sentence being typed, and Mod-F
                        // buries it under the find panel.
                        if (beat.open) return
                        if (event.altKey && event.shiftKey && !event.ctrlKey && !event.metaKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
                            event.preventDefault(); moveAdjacentBlocksRef.current(event.key === 'ArrowUp' ? 'up' : 'down'); return
                        }
                        // Read-only ProseMirror views skip editing keymaps.
                        if (event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey && event.key === 'Enter') {
                            event.preventDefault(); inspectReferencesRef.current(); return
                        }
                        const mod = event.ctrlKey || event.metaKey
                        if (!mod) return
                        if (event.key.toLowerCase() === 'f') {
                            event.preventDefault()
                            setFindOpen(true)
                            return
                        }
                        // Mod-Enter belongs to Regenerate while a generation is under
                        // review — that binding lives in the extension keymap. Read-only,
                        // there is nothing to write, so it does nothing.
                        if (event.key === 'Enter' && phaseRef.current === 'idle' && !readOnly && !propsRef.current.aiDisabled) {
                            event.preventDefault()
                            beat.openAt('')
                        }
                    }}
                >
                    {editor && !readOnly && (
                        <EditorBubbleMenu
                            editor={editor}
                            phase={phase}
                            remoteDisabled={props.aiDisabled}
                            onSelectionCommand={handleSelectionCommand}
                            onBeatOnSelection={() => { if (!propsRef.current.aiDisabled) beat.openAt('') }}
                            onAddToCodex={props.onAddToCodex ? handleAddToCodex : undefined}
                            onEditLink={()=>openLink()}
                        />
                    )}
                    <EditorContent editor={editor} className="flex min-h-0 flex-1 flex-col" />
                    {slash.menu && (
                        <SlashCommandMenu
                            menuId={slash.menuId}
                            items={slash.menu.items}
                            selectedIndex={slash.index}
                            anchor={slash.menu.anchor}
                            onHover={slash.setIndex}
                            onSelect={(item) => slash.menu?.command(item)}
                        />
                    )}
                    {mention.menu && (
                        <MentionMenu
                            menuId={mention.menuId}
                            items={mention.menu.items}
                            selectedIndex={mention.index}
                            anchor={mention.menu.anchor}
                            onHover={mention.setIndex}
                            onSelect={(item) => mention.menu?.command(item)}
                        />
                    )}
                    {beat.open && beat.target && !readOnly && (
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
                            submitDisabled={props.aiDisabled}
                            onSubmit={() => { if (!propsRef.current.aiDisabled) beat.write() }}
                            onCancel={beat.cancel}
                        />
                    )}
                </div>
                {editor && findOpen && (
                    <FindReplacePanel
                        editor={editor}
                        disabled={phase !== 'idle'}
                        readOnly={readOnly}
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
            {linkTarget&&<ManuscriptLinkDialog key={linkTarget.id} target={linkTarget} editor={editor} readOnly={readOnly} blocked={phase!=='idle'} canWrite={()=>!propsRef.current.readOnly&&phaseRef.current==='idle'} onClose={()=>setLinkTarget(null)}/>}
            {referenceInspection && <ManuscriptReferenceDialog choices={referenceInspection.choices} entries={props.referenceEntries ?? props.codexEntries}
                canChangeContext={() => !propsRef.current.readOnly && phaseRef.current === 'idle'}
                onSetContext={props.onSetReferenceContext} onPreview={props.onOpenCodexEntry} onClose={() => setReferenceInspection(null)} />}
            {referenceChanged && <Callout role="status">{t('novelEditor.references.stale')} <Button variant="ghost" size="sm" onClick={() => setReferenceChanged(false)}>{t('common.close')}</Button></Callout>}
            {blockMoveTarget && <ManuscriptBlockMoveDialog key={blockMoveTarget.id} target={blockMoveTarget} blocked={readOnly || phase !== 'idle'} canWrite={canMoveBlocks} onClose={() => setBlockMoveTarget(null)} onMoved={afterDialogBlockMove} />}
            {blockNotice && <Callout role="status">{t(`novelEditor.blocks.${blockNotice}`)} <Button variant="ghost" size="sm" onClick={() => setBlockNotice(null)}>{t('common.close')}</Button></Callout>}
            {pasteAsText>0&&<Callout role="status">{t('novelEditor.links.pastedAsText',{count:pasteAsText})} <Button variant="ghost" size="sm" onClick={()=>setPasteAsText(0)}>{t('novelEditor.links.cancel')}</Button></Callout>}
            {linkUnavailable&&<Callout role="status">{t(readOnly?'novelEditor.links.noLink':'novelEditor.links.noText')} <Button variant="ghost" size="sm" onClick={()=>setLinkUnavailable(false)}>{t('novelEditor.links.cancel')}</Button></Callout>}
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
