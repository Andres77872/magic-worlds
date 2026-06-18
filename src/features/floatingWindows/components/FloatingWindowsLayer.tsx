/**
 * FloatingWindowsLayer — renders every open preview window above the app. Lives
 * at the app-shell root (outside <main>) so windows survive page-content
 * remounts, and closes them all on navigation since a preview is contextual to
 * the surface that opened it. Windows are non-modal and stack by array order
 * (last = topmost); z stays in the 46–49 band, strictly below the z-50 editor
 * drawers so an Edit action always opens above its window.
 */
import { useEffect } from 'react'
import { useFloatingWindows, useNavigation } from '@/app/hooks'
import { FloatingWindow } from '@/ui/components'
import { CardPreviewBody } from '@/features/cards/components/CardPreviewBody'
import { LorebookPreviewBody } from '@/features/lorebook/components/LorebookPreviewBody'
import { LoreEntryPreviewBody } from '@/features/lorebook/components/LoreEntryPreviewBody'
import type { FloatingWindowContent } from '../floatingWindow.types'

const BASE_Z = 46
const MAX_Z = 49

function FloatingWindowBody({ content }: { content: FloatingWindowContent }) {
    switch (content.kind) {
        case 'card':
            return <CardPreviewBody card={content.preview} loading={false} error={null} showUsage />
        case 'lorebook':
            return <LorebookPreviewBody lorebook={content.lorebook} />
        case 'loreEntry':
            return <LoreEntryPreviewBody entry={content.entry} sourceName={content.sourceName} originLabel={content.originLabel} />
        default:
            return null
    }
}

export function FloatingWindowsLayer() {
    const { windows, closeWindow, focusWindow, closeAll } = useFloatingWindows()
    const { currentPage } = useNavigation()

    // Close all windows when the page changes — a preview belongs to the surface
    // that opened it, and its underlying snapshot data is gone once that unmounts.
    useEffect(() => {
        closeAll()
    }, [currentPage, closeAll])

    if (windows.length === 0) return null

    return (
        <>
            {windows.map((w, index) => (
                <FloatingWindow
                    key={w.id}
                    title={w.title}
                    isTop={index === windows.length - 1}
                    zIndex={Math.min(BASE_Z + index, MAX_Z)}
                    initialPosition={{ x: 120 + index * 28, y: 96 + index * 28 }}
                    onClose={() => closeWindow(w.id)}
                    onFocus={() => focusWindow(w.id)}
                    onEdit={w.onEdit}
                    editLabel={w.editLabel}
                >
                    <FloatingWindowBody content={w.content} />
                </FloatingWindow>
            ))}
        </>
    )
}
