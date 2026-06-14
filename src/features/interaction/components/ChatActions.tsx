import {
    useCallback,
    useEffect,
    useId,
    useLayoutEffect,
    useRef,
    useState,
    type RefObject,
} from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { Loader2, Pencil, RotateCcw, Trash2 } from 'lucide-react'
import { useClickOutside } from '../../../shared/hooks/useClickOutside'
import { Button, IconButton } from '../../../ui/primitives'

interface PopoverAnchor {
    top: number
    left: number
}

interface MessageDeleteConfirmPopoverProps {
    open: boolean
    anchor: PopoverAnchor | null
    popoverId: string
    labelledBy: string
    triggerRef: RefObject<HTMLElement>
    deleting: boolean
    onCancel?: () => void
    onConfirm?: () => void
}

const POPOVER_WIDTH = 184
const POPOVER_GAP = 8
const VIEWPORT_MARGIN = 8

function clampPopover(anchor: PopoverAnchor, popover: HTMLDivElement | null): PopoverAnchor {
    if (typeof window === 'undefined') return anchor
    const width = popover?.offsetWidth || POPOVER_WIDTH
    const height = popover?.offsetHeight || 0
    return {
        left: Math.max(VIEWPORT_MARGIN, Math.min(anchor.left, window.innerWidth - width - VIEWPORT_MARGIN)),
        top: Math.max(VIEWPORT_MARGIN, Math.min(anchor.top, window.innerHeight - height - VIEWPORT_MARGIN)),
    }
}

function MessageDeleteConfirmPopover({
    open,
    anchor,
    popoverId,
    labelledBy,
    triggerRef,
    deleting,
    onCancel,
    onConfirm,
}: MessageDeleteConfirmPopoverProps) {
    const { t } = useTranslation()
    const popoverRef = useRef<HTMLDivElement>(null!)
    const [coords, setCoords] = useState<PopoverAnchor | null>(anchor)

    const close = useCallback(() => {
        if (deleting) return
        onCancel?.()
        triggerRef.current?.focus()
    }, [deleting, onCancel, triggerRef])

    useClickOutside(
        popoverRef,
        () => {
            if (open) close()
        },
        [triggerRef],
    )

    useLayoutEffect(() => {
        if (!open || !anchor) return
        setCoords(clampPopover(anchor, popoverRef.current))
    }, [anchor, open])

    useEffect(() => {
        if (!open) return
        const timer = window.setTimeout(() => popoverRef.current?.focus(), 0)
        return () => window.clearTimeout(timer)
    }, [open])

    useEffect(() => {
        if (!open) return
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return
            event.preventDefault()
            close()
        }
        document.addEventListener('keydown', handleKeyDown)
        return () => document.removeEventListener('keydown', handleKeyDown)
    }, [close, open])

    if (!open || !anchor || typeof document === 'undefined') return null

    const renderedCoords = coords ?? anchor

    return createPortal(
        <div
            ref={popoverRef}
            id={popoverId}
            role="dialog"
            aria-modal="false"
            aria-labelledby={labelledBy}
            tabIndex={-1}
            data-testid="message-delete-popover"
            style={{ position: 'fixed', top: renderedCoords.top, left: renderedCoords.left, width: POPOVER_WIDTH }}
            className="z-[100] rounded-lg border border-parchment-50/10 bg-ink-800/95 p-2 shadow-xl ring-1 ring-ink-900/60 backdrop-blur-md"
        >
            <div id={labelledBy} className="px-1 pb-2 font-ui text-[13px] font-semibold text-parchment-100">
                {t('interaction.actions.deleteMessageConfirm')}
            </div>
            <div className="flex items-center justify-end gap-2">
                <Button kind="ghost" size="sm" onClick={close} disabled={deleting}>
                    {t('common.cancel')}
                </Button>
                <Button
                    kind="danger"
                    size="sm"
                    onClick={onConfirm}
                    disabled={deleting}
                    iconLeft={deleting ? <Loader2 size={13} strokeWidth={1.75} className="animate-spin" /> : undefined}
                >
                    {t('interaction.actions.delete')}
                </Button>
            </div>
        </div>,
        document.body,
    )
}

interface ChatActionsProps {
    turnId: string
    isUser: boolean
    isEditing: boolean
    isStreaming?: boolean
    onEditClick?: () => void
    onRegenerateClick?: (turnId: string) => void
    onDeleteClick?: (turnId: string) => void
    confirmingDelete?: boolean
    deleting?: boolean
    onConfirmDelete?: () => void
    onCancelDelete?: () => void
}

export function ChatActions({
    turnId,
    isUser,
    isEditing,
    isStreaming,
    onEditClick,
    onRegenerateClick,
    onDeleteClick,
    confirmingDelete = false,
    deleting = false,
    onConfirmDelete,
    onCancelDelete,
}: ChatActionsProps) {
    const { t } = useTranslation()
    const deleteButtonRef = useRef<HTMLButtonElement>(null)
    const popoverTitleId = useId()
    const popoverId = `${popoverTitleId}-popover`

    const popoverAnchor = (() => {
        if (!confirmingDelete || typeof window === 'undefined') return null
        const rect = deleteButtonRef.current?.getBoundingClientRect()
        if (!rect) return null
        return {
            left: rect.right - POPOVER_WIDTH,
            top: rect.bottom + POPOVER_GAP,
        }
    })()

    return (
        <div className="flex items-center gap-0.5">
            {onEditClick && !isEditing && !isStreaming && (
                <IconButton label={t('interaction.actions.editMessage')} size="sm" onClick={onEditClick}>
                    <Pencil size={14} strokeWidth={1.75} />
                </IconButton>
            )}
            {!isUser && onRegenerateClick && !isStreaming && !isEditing && (
                <IconButton label={t('interaction.actions.regenerate')} size="sm" onClick={() => onRegenerateClick(turnId)}>
                    <RotateCcw size={14} strokeWidth={1.75} />
                </IconButton>
            )}
            {onDeleteClick && !isStreaming && !isEditing ? (
                <>
                    <IconButton
                        ref={deleteButtonRef}
                        label={t('interaction.actions.deleteMessage')}
                        size="sm"
                        tone={confirmingDelete ? 'active' : 'danger'}
                        aria-expanded={confirmingDelete}
                        aria-haspopup="dialog"
                        aria-controls={confirmingDelete ? popoverId : undefined}
                        disabled={deleting}
                        onClick={() => {
                            if (confirmingDelete) onCancelDelete?.()
                            else onDeleteClick(turnId)
                        }}
                    >
                        <Trash2 size={14} strokeWidth={1.75} />
                    </IconButton>
                    <MessageDeleteConfirmPopover
                        open={confirmingDelete}
                        anchor={popoverAnchor}
                        popoverId={popoverId}
                        labelledBy={popoverTitleId}
                        triggerRef={deleteButtonRef as RefObject<HTMLElement>}
                        deleting={deleting}
                        onCancel={onCancelDelete}
                        onConfirm={onConfirmDelete}
                    />
                </>
            ) : null}
        </div>
    )
}
