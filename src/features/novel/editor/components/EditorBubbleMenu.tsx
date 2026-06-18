/**
 * EditorBubbleMenu — the selection toolbar. Three grouped clusters: text format
 * (bold/italic/strikethrough), block transform (H1/H2/quote/bullet/numbered),
 * and the AI cluster — a single "Ask the muse" trigger that opens BubbleAiMenu
 * (rewrite/expand/condense/describe) plus an "Add to codex" action.
 *
 * Every control uses preventToolbarBlur (onMouseDown preventDefault) so the live
 * selection survives; AI entries disable while a suggestion is alive.
 */

import { useState, type MouseEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { Editor } from '@tiptap/core'
import { BubbleMenu } from '@tiptap/react/menus'
import {
    Bold,
    BookmarkPlus,
    Heading1,
    Heading2,
    Italic,
    List,
    ListOrdered,
    Maximize2,
    Minimize2,
    PenLine,
    Quote,
    ScrollText,
    Sparkles,
    Strikethrough,
} from 'lucide-react'
import type { StoryGenerationCommand } from '@/shared'
import { Button, Icon, IconButton, cx } from '@/ui/primitives'
import type { InlineAIPhase } from '../types'
import { BubbleAiMenu, type BubbleAiItem } from './BubbleAiMenu'

function preventToolbarBlur(event: MouseEvent) {
    event.preventDefault()
}

interface EditorBubbleMenuProps {
    editor: Editor
    phase: InlineAIPhase
    onSelectionCommand: (command: StoryGenerationCommand) => void
    onAddToCodex?: () => void
}

export function EditorBubbleMenu({ editor, phase, onSelectionCommand, onAddToCodex }: EditorBubbleMenuProps) {
    const { t } = useTranslation()
    const [aiOpen, setAiOpen] = useState(false)
    // While a suggestion is alive the trigger is disabled and the menu render is
    // gated below, so the submenu can never act on a stale selection.
    const aiDisabled = phase !== 'idle'

    const aiItems: BubbleAiItem[] = [
        { command: 'rewrite', label: t('novelEditor.bubbleMenu.rewrite'), description: t('novelEditor.bubbleMenu.rewriteHint'), icon: PenLine },
        { command: 'expand', label: t('novelEditor.bubbleMenu.expand'), description: t('novelEditor.bubbleMenu.expandHint'), icon: Maximize2 },
        { command: 'condense', label: t('novelEditor.bubbleMenu.condense'), description: t('novelEditor.bubbleMenu.condenseHint'), icon: Minimize2 },
        { command: 'describe', label: t('novelEditor.bubbleMenu.describe'), description: t('novelEditor.bubbleMenu.describeHint'), icon: ScrollText },
    ]

    return (
        <BubbleMenu
            editor={editor}
            className="flex items-center gap-1 rounded-md border border-parchment-50/10 bg-ink-900/95 p-1 shadow-lg"
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

            <ToolButton
                label={t('novelEditor.bubbleMenu.heading')}
                active={editor.isActive('heading', { level: 2 })}
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            >
                <Icon icon={Heading1} size={14} />
            </ToolButton>
            <ToolButton
                label={t('novelEditor.bubbleMenu.subheading')}
                active={editor.isActive('heading', { level: 3 })}
                onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            >
                <Icon icon={Heading2} size={14} />
            </ToolButton>
            <ToolButton label={t('novelEditor.bubbleMenu.quote')} active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
                <Icon icon={Quote} size={14} />
            </ToolButton>
            <ToolButton
                label={t('novelEditor.bubbleMenu.bulletList')}
                active={editor.isActive('bulletList')}
                onClick={() => editor.chain().focus().toggleBulletList().run()}
            >
                <Icon icon={List} size={14} />
            </ToolButton>
            <ToolButton
                label={t('novelEditor.bubbleMenu.orderedList')}
                active={editor.isActive('orderedList')}
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
            >
                <Icon icon={ListOrdered} size={14} />
            </ToolButton>

            <Divider />

            <div className="relative">
                <Button
                    variant="ghost"
                    size="sm"
                    disabled={aiDisabled}
                    onMouseDown={preventToolbarBlur}
                    onClick={() => setAiOpen((open) => !open)}
                    iconLeft={<Icon icon={Sparkles} size={13} />}
                    className="text-arcane-300"
                    aria-haspopup="menu"
                    aria-expanded={aiOpen}
                    data-testid="bubble-ai-trigger"
                >
                    {t('novelEditor.bubbleMenu.askMuse')}
                </Button>
                {aiOpen && !aiDisabled && (
                    <BubbleAiMenu
                        items={aiItems}
                        onSelect={(command) => {
                            setAiOpen(false)
                            onSelectionCommand(command)
                        }}
                        onClose={() => setAiOpen(false)}
                    />
                )}
            </div>

            {onAddToCodex && (
                <ToolButton label={t('novelEditor.bubbleMenu.addToCodex')} active={false} onClick={onAddToCodex} disabled={aiDisabled}>
                    <Icon icon={BookmarkPlus} size={14} />
                </ToolButton>
            )}
        </BubbleMenu>
    )
}

function Divider() {
    return <span className="h-5 w-px bg-parchment-50/10" aria-hidden="true" />
}

function ToolButton({
    label,
    active,
    onClick,
    disabled,
    children,
}: {
    label: string
    active: boolean
    onClick: () => void
    disabled?: boolean
    children: React.ReactNode
}) {
    return (
        <IconButton
            label={label}
            size="sm"
            tone={active ? 'active' : 'default'}
            disabled={disabled}
            onMouseDown={preventToolbarBlur}
            onClick={onClick}
            className={cx('h-7 w-7')}
        >
            {children}
        </IconButton>
    )
}
