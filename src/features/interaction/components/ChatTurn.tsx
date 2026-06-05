import { useState } from 'react'
import type { TurnEntry } from '../../../shared'
import { cx, Eyebrow } from '../../../ui/primitives'
import { ChatAvatar } from './ChatAvatar'
import { ChatMessage } from './ChatMessage'
import { ChatActions } from './ChatActions'
import { ForwardOptions } from './ForwardOptions'
import { EditMode } from './EditMode'
import { ChatImage } from './ChatImage'

// Forward option interface
interface ForwardOption {
    forward_question: string
}

// Extend TurnEntry to include forward options
interface ExtendedTurnEntry extends TurnEntry {
    forwardOptions?: ForwardOption[]
    isStreaming?: boolean
    isStreamingForwardOptions?: boolean
    imageUrl?: string  // Add image URL field
}

interface ChatTurnProps {
    turn: ExtendedTurnEntry
    onForwardOptionClick: (option: string) => void
    onRegenerateClick?: (turnId: string) => void
    onDeleteClick?: (turnId: string) => void
    onEditClick?: (turnId: string, newContent: string) => void
}

export function ChatTurn({ turn, onForwardOptionClick, onRegenerateClick, onDeleteClick, onEditClick }: ChatTurnProps) {
    const isUser = turn.type === 'user'
    const [isEditing, setIsEditing] = useState(false)

    const handleEditStart = () => {
        setIsEditing(true)
    }

    const handleEditSave = (content: string) => {
        if (onEditClick && content.trim() !== turn.content) {
            onEditClick(turn.id, content.trim())
        }
        setIsEditing(false)
    }

    const handleEditCancel = () => {
        setIsEditing(false)
    }

    return (
        <div className={cx('mb-6 flex gap-3', isUser && 'flex-row-reverse')}>
            <ChatAvatar isUser={isUser} />

            <div className={cx('flex min-w-0 max-w-[640px] flex-col gap-1.5', isUser ? 'items-end' : 'items-start')}>
                <div className={cx('flex items-center gap-2', isUser && 'flex-row-reverse')}>
                    <Eyebrow tone={isUser ? 'ember' : 'arcane'} className="text-[11px] tracking-[0.16em]">
                        {isUser ? 'Player' : 'Game Master'}
                    </Eyebrow>
                    <div className={cx('flex items-center gap-2', isUser && 'flex-row-reverse')}>
                        <span className="font-mono text-[11px] text-parchment-500">
                            {new Date(turn.timestamp).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                            })}
                        </span>
                        <ChatActions
                            turnId={turn.id}
                            isUser={isUser}
                            isEditing={isEditing}
                            isStreaming={turn.isStreaming}
                            onEditClick={onEditClick ? handleEditStart : undefined}
                            onRegenerateClick={onRegenerateClick}
                            onDeleteClick={onDeleteClick}
                        />
                    </div>
                </div>

                <div className="w-full">
                    {isUser ? (
                        <div className="flex flex-col items-end">
                            {turn.imageUrl && (
                                <ChatImage imageUrl={turn.imageUrl} isAssistant={false} alt="Generated scene" />
                            )}
                            {isEditing ? (
                                <EditMode
                                    initialContent={turn.content}
                                    isUser={isUser}
                                    onSave={handleEditSave}
                                    onCancel={handleEditCancel}
                                />
                            ) : (
                                <ChatMessage content={turn.content} isUser={isUser} isStreaming={turn.isStreaming} />
                            )}
                        </div>
                    ) : (
                        <>
                            {isEditing ? (
                                <EditMode
                                    initialContent={turn.content}
                                    isUser={isUser}
                                    onSave={handleEditSave}
                                    onCancel={handleEditCancel}
                                />
                            ) : (
                                <div className="flex flex-col gap-3">
                                    <ChatMessage content={turn.content} isUser={isUser} isStreaming={turn.isStreaming} />
                                    {turn.imageUrl && (
                                        <ChatImage imageUrl={turn.imageUrl} isAssistant={true} alt="Generated scene" />
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>

                <ForwardOptions
                    options={turn.forwardOptions}
                    isStreaming={turn.isStreamingForwardOptions}
                    onOptionClick={onForwardOptionClick}
                />
            </div>
        </div>
    )
}
