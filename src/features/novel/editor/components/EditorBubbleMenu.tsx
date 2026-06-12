/**
 * EditorBubbleMenu — selection toolbar: minimal formatting plus the AI
 * selection commands (rewrite/expand/condense replace the passage through
 * the inline suggestion flow; describe writes after it). AI entries disable
 * while a suggestion is alive.
 */

import type { MouseEvent } from 'react'
import type { Editor } from '@tiptap/core'
import { BubbleMenu } from '@tiptap/react/menus'
import { Bold, Heading1, Heading2, Italic, Quote, Sparkles } from 'lucide-react'
import type { StoryGenerationCommand } from '@/shared'
import { Button, Icon, IconButton, cx } from '@/ui/primitives'
import type { InlineAIPhase } from '../types'

const SELECTION_COMMANDS: Array<{ command: StoryGenerationCommand; label: string }> = [
    { command: 'rewrite', label: 'Rewrite' },
    { command: 'expand', label: 'Expand' },
    { command: 'condense', label: 'Condense' },
    { command: 'describe', label: 'Describe' },
]

function preventToolbarBlur(event: MouseEvent) {
    event.preventDefault()
}

interface EditorBubbleMenuProps {
    editor: Editor
    phase: InlineAIPhase
    onSelectionCommand: (command: StoryGenerationCommand) => void
}

export function EditorBubbleMenu({ editor, phase, onSelectionCommand }: EditorBubbleMenuProps) {
    const aiDisabled = phase !== 'idle'
    return (
        <BubbleMenu
            editor={editor}
            className="flex items-center gap-1 rounded-md border border-parchment-50/10 bg-ink-900/95 p-1 shadow-lg"
        >
            <ToolButton label="Bold" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
                <Icon icon={Bold} size={14} />
            </ToolButton>
            <ToolButton label="Italic" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
                <Icon icon={Italic} size={14} />
            </ToolButton>
            <ToolButton
                label="Heading"
                active={editor.isActive('heading', { level: 2 })}
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            >
                <Icon icon={Heading1} size={14} />
            </ToolButton>
            <ToolButton
                label="Subheading"
                active={editor.isActive('heading', { level: 3 })}
                onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            >
                <Icon icon={Heading2} size={14} />
            </ToolButton>
            <ToolButton label="Quote" active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
                <Icon icon={Quote} size={14} />
            </ToolButton>
            <span className="h-5 w-px bg-parchment-50/10" />
            <span className="pl-1 text-arcane-400" aria-hidden="true">
                <Icon icon={Sparkles} size={13} />
            </span>
            {SELECTION_COMMANDS.map(({ command, label }) => (
                <Button
                    key={command}
                    kind="ghost"
                    size="sm"
                    disabled={aiDisabled}
                    onMouseDown={preventToolbarBlur}
                    onClick={() => onSelectionCommand(command)}
                    className="text-arcane-300"
                >
                    {label}
                </Button>
            ))}
        </BubbleMenu>
    )
}

function ToolButton({
    label,
    active,
    onClick,
    children,
}: {
    label: string
    active: boolean
    onClick: () => void
    children: React.ReactNode
}) {
    return (
        <IconButton
            label={label}
            size="sm"
            tone={active ? 'active' : 'default'}
            onMouseDown={preventToolbarBlur}
            onClick={onClick}
            className={cx('h-7 w-7')}
        >
            {children}
        </IconButton>
    )
}
