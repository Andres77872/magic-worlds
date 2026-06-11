import { useEffect, useRef, useState } from 'react'
import { Check, History, Plus, Trash2 } from 'lucide-react'
import { cx, IconButton } from '@/ui/primitives'
import { formatRelativeTime } from '@/utils/time'
import type { CardAssistantConversation } from '@/shared/types/aiCard.types'
import { conversationKey } from './useCardAssistant'

interface ConversationMenuProps {
    conversations: CardAssistantConversation[]
    activeId: number | null
    disabled?: boolean
    onSelect: (id: number) => void
    onNew: () => void
    onDelete: (id: number) => void
}

/** Header popover: "New chat" plus the conversation history with inline delete. */
export function ConversationMenu({ conversations, activeId, disabled, onSelect, onNew, onDelete }: ConversationMenuProps) {
    const [open, setOpen] = useState(false)
    const [confirmId, setConfirmId] = useState<number | null>(null)
    const containerRef = useRef<HTMLDivElement | null>(null)

    useEffect(() => {
        if (!open) return
        const onPointerDown = (event: MouseEvent) => {
            if (!containerRef.current?.contains(event.target as Node)) {
                setOpen(false)
                setConfirmId(null)
            }
        }
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setOpen(false)
                setConfirmId(null)
            }
        }
        document.addEventListener('mousedown', onPointerDown)
        document.addEventListener('keydown', onKeyDown)
        return () => {
            document.removeEventListener('mousedown', onPointerDown)
            document.removeEventListener('keydown', onKeyDown)
        }
    }, [open])

    const close = () => {
        setOpen(false)
        setConfirmId(null)
    }

    return (
        <div ref={containerRef} className="relative">
            <IconButton
                label="Conversations"
                size="sm"
                disabled={disabled}
                aria-haspopup="menu"
                aria-expanded={open}
                className="disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => setOpen((value) => !value)}
            >
                <History size={16} />
            </IconButton>

            {open && (
                <div
                    role="menu"
                    aria-label="Assistant conversations"
                    className="absolute right-0 top-full z-10 mt-2 w-72 rounded-lg border border-parchment-50/10 bg-ink-700 p-1.5 shadow-lg"
                >
                    <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                            onNew()
                            close()
                        }}
                        className="mb-1 flex w-full items-center gap-2 rounded-sm border-b border-parchment-50/[.08] px-2.5 py-2 pb-3 text-left font-ui text-[13px] font-semibold text-ember-300 hover:bg-parchment-50/[.06]"
                    >
                        <Plus size={14} />
                        New chat
                    </button>

                    <div className="max-h-64 overflow-y-auto">
                        {!conversations.length && (
                            <p className="px-2.5 py-3 text-center font-ui text-[12px] text-parchment-400">No previous chats.</p>
                        )}
                        {conversations.map((conversation, index) => {
                            const id = conversationKey(conversation)
                            if (!id) return null
                            const title = conversation.title || `Conversation ${conversations.length - index}`
                            const isActive = id === activeId
                            return (
                                <div key={id} className="group flex items-center gap-1 rounded-sm hover:bg-parchment-50/[.06]">
                                    <button
                                        type="button"
                                        role="menuitem"
                                        onClick={() => {
                                            onSelect(id)
                                            close()
                                        }}
                                        className="flex min-w-0 flex-1 items-center gap-2 px-2.5 py-2 text-left"
                                    >
                                        <span className={cx('truncate font-ui text-[13px]', isActive ? 'text-ember-300' : 'text-parchment-100')}>
                                            {title}
                                        </span>
                                        {isActive && <Check size={13} className="shrink-0 text-ember-400" />}
                                        <span
                                            className="ml-auto shrink-0 font-mono text-[11px] text-parchment-400"
                                            title={conversation.updated_at}
                                        >
                                            {formatRelativeTime(conversation.updated_at)}
                                        </span>
                                    </button>
                                    {confirmId === id ? (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                onDelete(id)
                                                close()
                                            }}
                                            className="shrink-0 rounded-sm px-2 py-1.5 font-ui text-[11px] font-semibold text-blood-500 hover:bg-blood-500/10"
                                        >
                                            Delete?
                                        </button>
                                    ) : (
                                        <IconButton
                                            label={`Delete ${title}`}
                                            size="sm"
                                            tone="danger"
                                            className="opacity-0 focus-visible:opacity-100 group-hover:opacity-100"
                                            onClick={() => setConfirmId(id)}
                                        >
                                            <Trash2 size={14} />
                                        </IconButton>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}
        </div>
    )
}
