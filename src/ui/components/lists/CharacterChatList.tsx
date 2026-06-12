import {useState} from 'react'
import type {CharacterChatSession} from '../../../shared/types'
import {MODE_META} from '@/shared/modes'
import {ConfirmDialog} from '../ConfirmDialog'
import {Card, CardGrid} from './Card'
import type {CardOption} from './Card'
import {EmptyState} from '../common/EmptyState'
import {ModeBadge} from '../common/ModeBadge'
import {MessageCircle, Trash2} from 'lucide-react'
import {Icon, Tag} from '@/ui/primitives'
import {resolveMediaUrl} from '@/infrastructure/api'

interface CharacterChatListProps {
    chats: CharacterChatSession[]
    /** Reopen the chat (the conversation continues where it left off). */
    onResume: (chat: CharacterChatSession) => void
    onDelete: (id: string) => Promise<void> | void
    loading?: boolean
    /** `grid` (default) for full pages; `rail` for dashboard shelves. */
    layout?: 'grid' | 'rail'
}

/** Last spoken line of the conversation, for the card body snippet. */
function lastMessage(chat: CharacterChatSession): string | undefined {
    const turns = chat.turns ?? []
    for (let i = turns.length - 1; i >= 0; i--) {
        const content = turns[i]?.content?.trim()
        if (content) return content
    }
    return undefined
}

export function CharacterChatList({
                                      chats,
                                      onResume,
                                      onDelete,
                                      loading = false,
                                      layout = 'grid',
                                  }: CharacterChatListProps) {
    const [pending, setPending] = useState<{ id: string; name: string } | null>(null)
    const [deletingId, setDeletingId] = useState<string | null>(null)

    const handleDelete = async () => {
        if (pending) {
            setDeletingId(pending.id)
            try {
                await onDelete(pending.id)
            } finally {
                setDeletingId(null)
                setPending(null)
            }
        }
    }

    return (
        <div className="flex flex-col gap-4 py-4">
            <CardGrid
                items={chats}
                layout={layout}
                loading={loading}
                emptyMessage={
                    <EmptyState
                        icon={<Icon icon={MessageCircle} size={32}/>}
                        message="No chats yet"
                        secondaryText='Press "Chat" on any character card to start a one-on-one conversation.'
                    />
                }
                renderCard={(chat) => {
                    const isDeleting = deletingId === chat.id
                    const name = chat.character?.name || 'Unknown character'
                    const snippet = lastMessage(chat)

                    const options: CardOption[] = [
                        {
                            type: 'custom',
                            icon: <Icon icon={MessageCircle} size={15}/>,
                            label: MODE_META.chat.resumeLabel,
                            onClick: () => onResume(chat),
                            disabled: isDeleting
                        },
                        {
                            type: 'custom',
                            icon: <Icon icon={Trash2} size={15}/>,
                            label: 'Delete',
                            onClick: () => setPending({id: chat.id, name}),
                            disabled: isDeleting,
                            danger: true
                        },
                    ]

                    return (
                        <Card
                            key={chat.id}
                            title={name}
                            subtitle={
                                <div className="flex flex-wrap items-center gap-1.5">
                                    <ModeBadge mode="chat"/>
                                    {chat.character?.race && <Tag>{chat.character.race}</Tag>}
                                </div>
                            }
                            options={options}
                            onClick={() => onResume(chat)}
                            imageUrl={resolveMediaUrl(chat.character?.image_url)}
                            className={isDeleting ? 'pointer-events-none opacity-50' : ''}
                        >
                            {snippet && (
                                <p className="m-0 line-clamp-2 font-narrative text-sm italic text-parchment-400">
                                    {snippet}
                                </p>
                            )}
                            {isDeleting && (
                                <div className="absolute inset-0 z-[1] flex items-center justify-center bg-ink-900/70 font-medium text-parchment-50">
                                    Deleting...
                                </div>
                            )}
                        </Card>
                    )
                }}
            />

            {pending && (
                <ConfirmDialog
                    title="Delete chat"
                    message={
                        <>
                            Delete your chat with <strong>{pending.name}</strong>? The conversation
                            cannot be recovered. {pending.name}&apos;s card is not affected.
                        </>
                    }
                    visible={true}
                    confirmLabel="Delete"
                    cancelLabel="Cancel"
                    variant="danger"
                    isProcessing={deletingId !== null}
                    onConfirm={handleDelete}
                    onCancel={() => setPending(null)}
                />
            )}
        </div>
    )
}
