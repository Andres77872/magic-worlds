/**
 * NovelStudioHeader — one 48px row of chrome, and nothing more. The old
 * masthead carried two always-live inputs and eight peer controls in a wrapping
 * flex row, so at 1280px the Save button dropped to a second line and nothing
 * in the cluster read as more important than anything else.
 *
 * Here the left is identity (novel · chapter) and the right is the two panel
 * toggles; everything rarer than that lives behind More. The novel description
 * left the header entirely — a logline is not something a writer needs in view
 * every minute.
 *
 * The counters and the save state are NOT here. They live on the status strip
 * under the manuscript, in the writer's line of sight, and printing them in
 * both places was the same number twice. There is no Save button either: the
 * chapter autosaves 1.2s after the last keystroke, retries failures and flushes
 * on unmount, so an explicit Save is a no-op in every state except `error` —
 * where the strip grows a Retry.
 *
 * The title edits in place but is not a permanently-live input: a live input in
 * the chrome invites accidental edits every time the pointer lands on it.
 */

import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import {
    AlignVerticalSpaceAround,
    ArrowLeft,
    History,
    Maximize2,
    Minimize2,
    MoreHorizontal,
    PanelRight,
    Search,
    type LucideIcon,
} from 'lucide-react'
import type { Story } from '@/shared'
import { Icon, IconButton } from '@/ui/primitives'

export interface NovelStudioHeaderProps {
    story: Story
    chapterTitle: string
    focusMode: boolean
    codexOpen: boolean
    typewriter: boolean
    onToggleFocusMode: () => void
    onToggleCodex: () => void
    onToggleTypewriter: () => void
    onOpenHistory: () => void
    onOpenFind: () => void
    onBack: () => void
    onSaveMeta: (patch: { title?: string; description?: string }) => void
}

// The Find binding is Ctrl **or** Cmd, so the hint must not claim ⌘ on Windows.
const IS_APPLE =
    typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent || '')
const FIND_KEY = IS_APPLE ? '⌘F' : 'Ctrl+F'

export function NovelStudioHeader({
    story,
    chapterTitle,
    focusMode,
    codexOpen,
    typewriter,
    onToggleFocusMode,
    onToggleCodex,
    onToggleTypewriter,
    onOpenHistory,
    onOpenFind,
    onBack,
    onSaveMeta,
}: NovelStudioHeaderProps) {
    const { t } = useTranslation()
    const [editing, setEditing] = useState(false)
    const [draft, setDraft] = useState(story.title)
    const [menuOpen, setMenuOpen] = useState(false)
    const menuRef = useRef<HTMLDivElement | null>(null)
    const menuTriggerRef = useRef<HTMLButtonElement | null>(null)
    // Escape reverts by blurring, so the blur handler must know not to commit.
    const revertRef = useRef(false)

    useEffect(() => {
        if (!menuOpen) return
        const handlePointer = (event: MouseEvent) => {
            if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false)
        }
        const handleKey = (event: globalThis.KeyboardEvent) => {
            if (event.key !== 'Escape') return
            event.preventDefault()
            setMenuOpen(false)
            menuTriggerRef.current?.focus()
        }
        document.addEventListener('mousedown', handlePointer)
        document.addEventListener('keydown', handleKey)
        return () => {
            document.removeEventListener('mousedown', handlePointer)
            document.removeEventListener('keydown', handleKey)
        }
    }, [menuOpen])

    const startEditing = () => {
        setDraft(story.title)
        revertRef.current = false
        setEditing(true)
    }

    const commitTitle = () => {
        setEditing(false)
        if (revertRef.current) {
            revertRef.current = false
            return
        }
        const next = draft.trim() || t('novelEditor.header.untitled')
        if (next !== story.title) onSaveMeta({ title: next })
    }

    const onTitleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') {
            event.preventDefault()
            event.currentTarget.blur()
        } else if (event.key === 'Escape') {
            event.preventDefault()
            revertRef.current = true
            event.currentTarget.blur()
        }
    }

    const runMenuItem = (action: () => void) => {
        setMenuOpen(false)
        // The clicked row unmounts with the menu, so focus would land on <body>.
        // Hand it back to the trigger first; anything the action opens (drawer,
        // find panel) claims focus for itself afterwards.
        menuTriggerRef.current?.focus()
        action()
    }

    return (
        <header className="flex h-12 shrink-0 items-center gap-2 border-b border-parchment-50/10 bg-ink-900/70 px-2 sm:px-3">
            <IconButton label={t('novelEditor.header.back')} size="sm" onClick={onBack}>
                <Icon icon={ArrowLeft} size={16} />
            </IconButton>

            <div className="flex min-w-0 flex-1 items-baseline gap-2">
                {editing ? (
                    <input
                        value={draft}
                        autoFocus
                        onChange={(event) => setDraft(event.target.value)}
                        onBlur={commitTitle}
                        onKeyDown={onTitleKeyDown}
                        aria-label={t('novelEditor.header.titleLabel')}
                        placeholder={t('novelEditor.header.untitled')}
                        className="min-w-0 max-w-[38ch] flex-1 rounded-xs border border-ember-500/50 bg-ink-800 px-1.5 py-0.5 font-display text-[20px] font-semibold text-parchment-50 outline-none placeholder:text-parchment-500"
                        data-testid="novel-title-input"
                    />
                ) : (
                    <button
                        type="button"
                        onClick={startEditing}
                        aria-label={t('novelEditor.header.titleLabel')}
                        className="min-w-0 max-w-[38ch] cursor-pointer truncate rounded-xs px-1.5 py-0.5 text-left font-display text-[20px] font-semibold text-parchment-50 transition-colors hover:bg-parchment-50/[.06]"
                        data-testid="novel-title"
                    >
                        {story.title || t('novelEditor.header.untitled')}
                    </button>
                )}
                <span className="shrink-0 text-[13px] text-parchment-500" aria-hidden="true">
                    /
                </span>
                <span className="min-w-0 truncate font-ui text-[13px] text-parchment-300" data-testid="novel-header-chapter">
                    {chapterTitle || t('novelEditor.studio.chapterTitlePlaceholder')}
                </span>
            </div>

            <div className="flex shrink-0 items-center gap-2">
                {!focusMode && (
                    <IconButton
                        label={t('novelEditor.header.codex')}
                        size="sm"
                       
                        tone={codexOpen ? 'active' : 'default'}
                        aria-pressed={codexOpen}
                        onClick={onToggleCodex}
                    >
                        <Icon icon={PanelRight} size={16} />
                    </IconButton>
                )}
                <IconButton
                    label={t('novelEditor.header.focus')}
                    size="sm"
                   
                    tone={focusMode ? 'active' : 'default'}
                    aria-pressed={focusMode}
                    onClick={onToggleFocusMode}
                >
                    <Icon icon={focusMode ? Minimize2 : Maximize2} size={16} />
                </IconButton>

                <div className="relative" ref={menuRef}>
                    <IconButton
                        ref={menuTriggerRef}
                        label={t('novelEditor.header.more')}
                        size="sm"
                       
                        aria-haspopup="menu"
                        aria-expanded={menuOpen}
                        onClick={() => setMenuOpen((open) => !open)}
                        data-testid="novel-header-more"
                    >
                        <Icon icon={MoreHorizontal} size={16} />
                    </IconButton>
                    {menuOpen && (
                        <div
                            role="menu"
                            aria-label={t('novelEditor.header.more')}
                            className="absolute right-0 top-[calc(100%+6px)] z-40 w-[252px] rounded-md border border-parchment-50/10 bg-ink-700 p-1 shadow-lg"
                            data-testid="novel-header-menu"
                        >
                            <MenuItem
                                icon={AlignVerticalSpaceAround}
                                label={t('novelEditor.header.typewriter')}
                                hint={typewriter ? t('novelEditor.header.typewriterOn') : t('novelEditor.header.typewriterOff')}
                                checked={typewriter}
                                onSelect={() => runMenuItem(onToggleTypewriter)}
                            />
                            <MenuItem
                                icon={Search}
                                label={t('novelEditor.header.find')}
                                hint={FIND_KEY}
                                onSelect={() => runMenuItem(onOpenFind)}
                            />
                            <MenuItem
                                icon={History}
                                label={t('novelEditor.header.history')}
                                onSelect={() => runMenuItem(onOpenHistory)}
                            />
                        </div>
                    )}
                </div>
            </div>
        </header>
    )
}


function MenuItem({
    icon,
    label,
    hint,
    checked,
    onSelect,
}: {
    icon: LucideIcon
    label: string
    hint?: string
    checked?: boolean
    onSelect: () => void
}) {
    return (
        <button
            type="button"
            role={checked === undefined ? 'menuitem' : 'menuitemcheckbox'}
            aria-checked={checked}
            onClick={onSelect}
            className="flex h-8 w-full cursor-pointer items-center gap-2 rounded-xs px-2 text-left font-ui text-[13px] text-parchment-100 transition-colors hover:bg-parchment-50/[.06]"
            data-testid="novel-header-menu-item"
        >
            <Icon icon={icon} size={14} className="shrink-0 text-parchment-300" />
            <span className="truncate">{label}</span>
            {hint && <span className="ml-auto shrink-0 font-mono text-[11px] text-parchment-400">{hint}</span>}
        </button>
    )
}
