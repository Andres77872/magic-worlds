/**
 * EditorBubbleMenu — the selection toolbar, cut down to what a selection can
 * usefully do: the three inline marks, quote, and the AI cluster. The block
 * transforms (headings, lists) are gone — the slash menu and the markdown input
 * rules ("## ", "- ") already own that job, and repeating them here made the
 * toolbar wide enough to cover the very sentence being edited.
 *
 * The AI menu lives in BubbleAiMenu, but the trigger, the open flag and the
 * dismissal handlers stay HERE, tracking both trigger and body portal: a menu
 * component owning its own outside-click listener would race this toolbar's,
 * and the loser closes the menu on the click that opened it.
 *
 * Every control uses preventToolbarBlur (onMouseDown preventDefault) so the live
 * selection survives; AI entries disable while a suggestion is alive.
 */

import { useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import type { Editor } from '@tiptap/core'
import { BubbleMenu } from '@tiptap/react/menus'
import {
    Bold,
    BookmarkPlus,
    ChevronDown,
    Italic,
    Quote,
    Sparkles,
    Strikethrough,
} from 'lucide-react'
import type { StoryGenerationCommand } from '@/shared'
import { Button, Icon, IconButton } from '@/ui/primitives'
import { useAnchoredPopup } from '@/ui/primitives/useAnchoredPopup'
import type { InlineAIPhase } from '../types'
import { BubbleAiMenu } from './BubbleAiMenu'

function preventToolbarBlur(event: MouseEvent) {
    event.preventDefault()
}

export interface EditorBubbleMenuProps {
    editor: Editor
    phase: InlineAIPhase
    onSelectionCommand: (command: StoryGenerationCommand) => void
    /** Opens the beat composer with the current selection as its target. */
    onBeatOnSelection: () => void
    onAddToCodex?: () => void
}

export function EditorBubbleMenu({ editor, phase, onSelectionCommand, onBeatOnSelection, onAddToCodex }: EditorBubbleMenuProps) {
    const { t } = useTranslation()
    const [aiOpen, setAiOpen] = useState(false)
    const aiRef = useRef<HTMLDivElement>(null!)
    const aiMenuRef = useRef<HTMLDivElement>(null!)
    // While a suggestion is alive the trigger is disabled and the menu render is
    // gated below, so the menu can never act on a stale selection.
    const aiDisabled = phase !== 'idle'
    const { position } = useAnchoredPopup(aiOpen && !aiDisabled, aiRef, aiMenuRef, undefined, 240)
    // The submenu is portalled outside TipTap's toolbar element, so it must
    // follow the toolbar's lifecycle when a keyboard action collapses selection.
    const bubbleOptions = useMemo(() => ({ onHide: () => setAiOpen(false) }), [])

    // A suggestion starting while the menu is open (keyboard shortcut, slash
    // menu) must drop the open flag too — otherwise the menu silently reappears
    // the moment the phase returns to idle, pointing at a selection that moved.
    // Adjusted during render rather than in an effect: React re-runs this
    // component before committing, so the menu never paints in the stale state.
    const [wasDisabled, setWasDisabled] = useState(aiDisabled)
    if (wasDisabled !== aiDisabled) {
        setWasDisabled(aiDisabled)
        if (aiDisabled && aiOpen) setAiOpen(false)
    }

    useEffect(() => {
        if (!aiOpen) return
        const handlePointer = (event: globalThis.MouseEvent) => {
            if (!aiRef.current?.contains(event.target as Node) && !aiMenuRef.current?.contains(event.target as Node)) setAiOpen(false)
        }
        const handleKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault()
                setAiOpen(false)
            }
        }
        // TipTap repositions its toolbar asynchronously; closing the submenu
        // avoids keeping coordinates from the previous selection geometry.
        const handleLayoutChange = () => setAiOpen(false)
        // Capture so the editor's own handlers don't swallow the outside click first.
        document.addEventListener('mousedown', handlePointer, true)
        document.addEventListener('keydown', handleKey)
        window.addEventListener('resize', handleLayoutChange)
        window.addEventListener('scroll', handleLayoutChange, true)
        return () => {
            document.removeEventListener('mousedown', handlePointer, true)
            document.removeEventListener('keydown', handleKey)
            window.removeEventListener('resize', handleLayoutChange)
            window.removeEventListener('scroll', handleLayoutChange, true)
        }
    }, [aiOpen])


    return (
        <BubbleMenu
            editor={editor}
            options={bubbleOptions}
            className="flex max-w-[calc(100vw-2rem)] flex-wrap items-center gap-1 rounded-md border border-parchment-50/10 bg-ink-900/95 p-1 shadow-lg"
        >
            <ToolButton label={t('novelEditor.bubbleMenu.bold')} active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
                <Icon icon={Bold} size={14} />
            </ToolButton>
            <ToolButton label={t('novelEditor.bubbleMenu.italic')} active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
                <Icon icon={Italic} size={14} />
            </ToolButton>
            <ToolButton
                label={t('novelEditor.bubbleMenu.strikethrough')}
                active={editor.isActive('strike')}
                onClick={() => editor.chain().focus().toggleStrike().run()}
            >
                <Icon icon={Strikethrough} size={14} />
            </ToolButton>

            <Divider />

            <ToolButton label={t('novelEditor.bubbleMenu.quote')} active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
                <Icon icon={Quote} size={14} />
            </ToolButton>

            <Divider />

            <div className="relative" ref={aiRef}>
                {/* variant="arcane" is the design system's AI treatment (arcane tint +
                    arcane-300 text). A ghost button with a text-arcane-300 override would
                    not work: cx() is a plain join, so ghost's own text colour wins. */}
                <Button
                    variant="arcane"
                    size="sm"
                    disabled={aiDisabled}
                    onMouseDown={preventToolbarBlur}
                    onClick={() => setAiOpen((open) => !open)}
                    iconLeft={<Icon icon={Sparkles} size={14} />}
                    iconRight={<Icon icon={ChevronDown} size={14} />}
                    aria-haspopup="menu"
                    aria-expanded={aiOpen}
                    data-testid="bubble-ai-trigger"
                >
                    {t('novelEditor.bubbleMenu.ai')}
                </Button>
                {aiOpen && !aiDisabled && createPortal(
                    <BubbleAiMenu
                        menuRef={aiMenuRef}
                        position={position}
                        onBeat={() => {
                            setAiOpen(false)
                            onBeatOnSelection()
                        }}
                        onSelectCommand={(command) => {
                            setAiOpen(false)
                            onSelectionCommand(command)
                        }}
                    />,
                    document.body,
                )}
            </div>

            {onAddToCodex && (
                <ToolButton label={t('novelEditor.bubbleMenu.addToCodex')} onClick={onAddToCodex} disabled={aiDisabled}>
                    <Icon icon={BookmarkPlus} size={14} />
                </ToolButton>
            )}
        </BubbleMenu>
    )
}

function Divider() {
    return <span className="h-5 w-px bg-parchment-50/10" aria-hidden="true" />
}


/** `active` marks a toggle (a mark or block that is on/off) and drives
 *  aria-pressed; one-shot actions such as "add to codex" omit it entirely so
 *  they are not announced as pressable toggles. */
function ToolButton({
    label,
    active,
    onClick,
    disabled,
    children,
}: {
    label: string
    active?: boolean
    onClick: () => void
    disabled?: boolean
    children: ReactNode
}) {
    return (
        <IconButton
            label={label}
            size="sm"
            tone={active ? 'active' : 'default'}
            disabled={disabled}
            aria-pressed={active}
            onMouseDown={preventToolbarBlur}
            onClick={onClick}
        >
            {children}
        </IconButton>
    )
}
