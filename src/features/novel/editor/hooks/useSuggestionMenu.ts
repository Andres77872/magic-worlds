/**
 * useSuggestionMenu — one bridge between a @tiptap/suggestion plugin and a
 * React-rendered menu. Both the "/" command menu and the "@" codex mention
 * menu used to carry their own copy of this: the controller ref, the anchor
 * maths against the scroll container, and the arrow/enter/escape handling.
 * They were the same hundred lines twice, so they are this hook now.
 *
 * The extensions are memoized once and read the controller through a ref, so
 * nothing here may be captured at extension-construction time.
 */

import { useEffect, useRef, useState, type RefObject } from 'react'
import type { SuggestionProps } from '@tiptap/suggestion'

export interface MenuAnchor {
    left: number
    top: number
}

export interface SuggestionMenuState<TItem> {
    items: TItem[]
    anchor: MenuAnchor
    range: { from: number; to: number }
    command: (item: TItem) => void
}

export interface SuggestionMenuController<TItem, TCommand> {
    onStart: (props: SuggestionProps<TItem, TCommand>) => void
    onUpdate: (props: SuggestionProps<TItem, TCommand>) => void
    onExit: () => void
    onKeyDown: (event: KeyboardEvent) => boolean
}

interface UseSuggestionMenuOptions<TItem, TCommand> {
    /** The editor's scrollport; anchors are measured against it. */
    containerRef: RefObject<HTMLElement | null>
    /** Adapt the suggestion plugin's command to one taking the item itself. */
    toCommand: (props: SuggestionProps<TItem, TCommand>) => (item: TItem) => void
    /** Escape while the menu is open. Default: nothing (the menu just closes). */
    onEscape?: (state: SuggestionMenuState<TItem>) => void
    /** Fired when the menu opens and closes — the slash menu drives the AI phase with it. */
    onOpenChange?: (open: boolean) => void
}

/**
 * Place a popover of `width` under the caret, inside the scrollport. Clamping
 * only the left edge lets a caret in the right half of the column push the
 * popover past the viewport and grow a horizontal scrollbar.
 */
export function popoverAnchor(container: HTMLElement | null, left: number, bottom: number, width: number): MenuAnchor {
    const containerRect = container?.getBoundingClientRect()
    const available = container?.clientWidth ?? 0
    const maxLeft = Math.max(8, available - width - 8)
    return {
        left: Math.min(Math.max(8, left - (containerRect?.left ?? 0)), maxLeft),
        top: bottom - (containerRect?.top ?? 0) + (container?.scrollTop ?? 0) + 6,
    }
}

const MENU_WIDTH = 300

function anchorFor(container: HTMLElement | null, clientRect: (() => DOMRect | null) | null | undefined): MenuAnchor | null {
    const rect = clientRect?.()
    if (!rect || !container) return null
    return popoverAnchor(container, rect.left, rect.bottom, MENU_WIDTH)
}

export function useSuggestionMenu<TItem, TCommand = TItem>({
    containerRef,
    toCommand,
    onEscape,
    onOpenChange,
}: UseSuggestionMenuOptions<TItem, TCommand>) {
    const [menu, setMenu] = useState<SuggestionMenuState<TItem> | null>(null)
    const [index, setIndex] = useState(0)

    // The controller is rebuilt on every render and the plugin reads it through
    // the ref at event time, so these handlers already close over the current
    // menu and index — no mirror ref needed.
    const controllerRef = useRef<SuggestionMenuController<TItem, TCommand> | null>(null)

    const stateFrom = (props: SuggestionProps<TItem, TCommand>): SuggestionMenuState<TItem> | null => {
        const anchor = anchorFor(containerRef.current, props.clientRect)
        if (!anchor) return null
        return { items: props.items, anchor, range: props.range, command: toCommand(props) }
    }

    const controller: SuggestionMenuController<TItem, TCommand> = {
        onStart: (props) => {
            onOpenChange?.(true)
            const next = stateFrom(props)
            if (!next) return
            setMenu(next)
            setIndex(0)
        },
        onUpdate: (props) => {
            const next = stateFrom(props)
            if (!next) return
            setMenu(next)
            setIndex((current) => Math.min(current, Math.max(props.items.length - 1, 0)))
        },
        onExit: () => {
            setMenu(null)
            onOpenChange?.(false)
        },
        onKeyDown: (event) => {
            if (!menu) return false
            const count = menu.items.length
            if (event.key === 'ArrowDown') {
                setIndex(count ? (index + 1) % count : 0)
                return true
            }
            if (event.key === 'ArrowUp') {
                setIndex(count ? (index - 1 + count) % count : 0)
                return true
            }
            if (event.key === 'Enter') {
                const item = menu.items[index]
                if (item) menu.command(item)
                return true
            }
            if (event.key === 'Escape') {
                onEscape?.(menu)
                return true
            }
            return false
        },
    }

    // Published after commit, not during render: the plugin only ever reads the
    // controller from an event handler, which is necessarily after mount.
    useEffect(() => {
        controllerRef.current = controller
    })

    return { menu, index, setIndex, controllerRef }
}
