/** The writing-room header opens the shared, recoverable novel details form. */

import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
    AlignVerticalSpaceAround,
    ArrowLeft,
    ArrowUpDown,
    History,
    Maximize2,
    Minimize2,
    MoreHorizontal,
    Camera,
    Archive,
    Download,
    TrendingUp,
    BookOpen,
    Bookmark,
    Keyboard,
    Link,
    PanelRight,
    Search,
    StickyNote,
    type LucideIcon,
} from 'lucide-react'
import type { StoryOutline } from '@/shared'
import { Icon, IconButton } from '@/ui/primitives'
import { NovelSurfaceSwitch, type NovelSurface } from './NovelSurfaceSwitch'

export interface NovelStudioHeaderProps {
    story: StoryOutline
    chapterTitle: string
    focusMode: boolean
    codexOpen: boolean
    typewriter: boolean
    onToggleFocusMode: () => void
    onToggleCodex: () => void
    onToggleTypewriter: () => void
    onOpenHistory: () => void
    onOpenSnapshots?:()=>void
    onOpenExport?:()=>void
    onOpenPackage?:()=>void
    onOpenProgress?:()=>void
    onOpenAnnotations?:()=>void
    onOpenBookmarks?:()=>void
    onOpenAssistantContext?:()=>void
    onOpenManuscript?:()=>void
    onOpenReading?:()=>void
    onOpenTyping?:()=>void
    onOpenLink?:()=>void
    onOpenReferences?:()=>void
    onOpenBlockMove?:()=>void
    /** Write, Plan or Review in the centre column (U01); hidden in focus mode, which is Write only. */
    surface?:NovelSurface
    onSurfaceChange?:(surface:NovelSurface)=>void
    /** Review is offered when revision tasks and the stash are available. */
    review?:boolean
    reviewCount?:number
    linkReadOnly?:boolean
    onOpenSearch?:()=>void
    onOpenFind: () => void
    onBack: () => void
    onEditDetails: () => void
    /** The story's workspace is archived: the title is not editable. */
    readOnly?: boolean
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
    onOpenSnapshots,
    onOpenExport,
    onOpenPackage,
    onOpenProgress,
    onOpenAnnotations,
    onOpenBookmarks,
    onOpenAssistantContext,
    onOpenManuscript,
    onOpenReading,
    onOpenTyping,
    onOpenLink,
    onOpenReferences,
    onOpenBlockMove,
    surface = 'write',
    onSurfaceChange,
    review = false,
    reviewCount,
    linkReadOnly,
    onOpenSearch,
    onOpenFind,
    onBack,
    onEditDetails,
    readOnly = false,
}: NovelStudioHeaderProps) {
    const { t } = useTranslation()
    const [menuOpen, setMenuOpen] = useState(false)
    const menuRef = useRef<HTMLDivElement | null>(null)
    const menuTriggerRef = useRef<HTMLButtonElement | null>(null)
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
                <button
                    type="button"
                    onClick={onEditDetails}
                    aria-label={t('novelEditor.header.titleLabel')}
                    aria-haspopup="dialog"
                    aria-description={readOnly?t('novelEditor.structure.readOnly'):undefined}
                    className="min-w-0 max-w-[38ch] cursor-pointer truncate rounded-xs px-1.5 py-0.5 text-left font-display text-xl font-semibold text-parchment-50 transition-colors hover:bg-parchment-50/[.06]"
                    data-testid="novel-title"
                >
                    {story.title || t('novelEditor.header.untitled')}
                </button>
                <span className="shrink-0 text-label text-parchment-500" aria-hidden="true">
                    /
                </span>
                <span className="min-w-0 truncate font-ui text-label text-parchment-300" data-testid="novel-header-chapter">
                    {chapterTitle || t('novelEditor.studio.chapterTitlePlaceholder')}
                </span>
            </div>

            <div className="flex shrink-0 items-center gap-2">
                {!focusMode && onSurfaceChange && (
                    <NovelSurfaceSwitch value={surface} onChange={onSurfaceChange} review={review} reviewCount={reviewCount} />
                )}
                {!focusMode && surface === 'write' && (
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
                            {onOpenAssistantContext&&<MenuItem icon={BookOpen} label={t('novelEditor.assistant.title')} onSelect={()=>runMenuItem(onOpenAssistantContext)}/>}
                            {onOpenAnnotations&&<MenuItem icon={StickyNote} label={t('novelEditor.annotations.title')} onSelect={()=>runMenuItem(onOpenAnnotations)}/>}
                            {onOpenBookmarks&&<MenuItem icon={Bookmark} label={t('novelEditor.bookmarks.title')} onSelect={()=>runMenuItem(onOpenBookmarks)}/>}
                            {onOpenManuscript&&<MenuItem icon={BookOpen} label={t('novelEditor.reader.title')} onSelect={()=>runMenuItem(onOpenManuscript)}/>}
                            {onOpenReading&&<MenuItem icon={BookOpen} label={t('novelEditor.reading.title')} onSelect={()=>runMenuItem(onOpenReading)}/>}
                            {onOpenTyping&&<MenuItem icon={Keyboard} label={t('novelEditor.typing.title')} onSelect={()=>runMenuItem(onOpenTyping)}/>}
                            {onOpenLink&&<MenuItem icon={Link} label={t((linkReadOnly??readOnly)?'novelEditor.links.inspect':'novelEditor.links.edit')} hint={IS_APPLE?'⌘K':'Ctrl+K'} onSelect={()=>runMenuItem(onOpenLink)}/>}
                            {onOpenReferences&&<MenuItem icon={BookOpen} label={t('novelEditor.references.inspect')} hint={t('novelEditor.references.shortcut')} onSelect={()=>runMenuItem(onOpenReferences)}/>}
                            {onOpenBlockMove&&<MenuItem icon={ArrowUpDown} label={t('novelEditor.blocks.open')} hint={t('novelEditor.blocks.shortcut')} onSelect={()=>runMenuItem(onOpenBlockMove)}/>}
                            {onOpenSearch&&<MenuItem icon={Search} label={t('novelEditor.search.title')} onSelect={()=>runMenuItem(onOpenSearch)}/>}
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
                            {onOpenSnapshots&&<MenuItem icon={Camera} label={t('novelEditor.snapshots.title')} onSelect={()=>runMenuItem(onOpenSnapshots)}/>}
                            {onOpenExport&&<MenuItem icon={Download} label={t('novelEditor.export.menu')} onSelect={()=>runMenuItem(onOpenExport)}/>}
                            {onOpenPackage&&<MenuItem icon={Archive} label={t('novelEditor.package.menu')} onSelect={()=>runMenuItem(onOpenPackage)}/>}
                            {onOpenProgress&&<MenuItem icon={TrendingUp} label={t('novelEditor.writingProgress.menu')} onSelect={()=>runMenuItem(onOpenProgress)}/>}
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
            className="flex h-8 w-full cursor-pointer items-center gap-2 rounded-xs px-2 text-left font-ui text-label text-parchment-100 transition-colors hover:bg-parchment-50/[.06]"
            data-testid="novel-header-menu-item"
        >
            <Icon icon={icon} size={14} className="shrink-0 text-parchment-300" />
            <span className="truncate">{label}</span>
            {hint && <span className="ml-auto shrink-0 font-mono text-[11px] text-parchment-400">{hint}</span>}
        </button>
    )
}
