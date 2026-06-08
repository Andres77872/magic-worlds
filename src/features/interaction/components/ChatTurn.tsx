import { useState } from 'react'
import type { ChatImageAsset, ForwardOption, ImageLifecycleStatus, TurnEntry } from '../../../shared'
import { cx, Eyebrow } from '../../../ui/primitives'
import { ChatAvatar } from './ChatAvatar'
import { ChatMessage } from './ChatMessage'
import { ChatActions } from './ChatActions'
import { ForwardOptions } from './ForwardOptions'
import { EditMode } from './EditMode'

// Extend TurnEntry to include forward options and the (out-of-scope) image prompt
interface ExtendedTurnEntry extends TurnEntry {
    forwardOptions?: ForwardOption[]
    isStreaming?: boolean
    imagePrompt?: string
    imageStatus?: ImageLifecycleStatus
    imageAssets?: ChatImageAsset[]
    imageUrl?: string
}

interface ChatTurnProps {
    turn: ExtendedTurnEntry
    onForwardOptionClick: (message: string) => void
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

    const safeAssets = (turn.imageAssets ?? []).filter((asset) => isSafeGeneratedImageUrl(asset.url))
    const imageUrl = safeAssets[0]?.url ?? (turn.imageUrl && isSafeGeneratedImageUrl(turn.imageUrl) ? turn.imageUrl : undefined)
    const pendingImage = turn.imageStatus === 'pending' || turn.imageStatus === 'in_progress' || turn.imageStatus === 'mirroring'
    // 'unavailable' means image generation is turned off server-side — not a real
    // per-turn failure the player can act on, so it renders nothing (no banner).
    const failedImage = turn.imageStatus === 'failed' || turn.imageStatus === 'canceled' || turn.imageStatus === 'invalid' || turn.imageStatus === 'quota_exceeded'

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
                                <ChatMessage content={turn.content} isUser={isUser} isStreaming={turn.isStreaming} />
                            )}
                            {!isUser && !isEditing && pendingImage && (
                                <div className="mt-3 rounded-xl border border-arcane-400/25 bg-arcane-500/10 px-4 py-3 text-[13px] text-arcane-200">
                                    Generating image…
                                </div>
                            )}
                            {!isUser && !isEditing && turn.imageStatus === 'completed' && imageUrl && (
                                <figure className="mt-3 overflow-hidden rounded-xl border border-parchment-50/10 bg-ink-700/70">
                                    <img src={imageUrl} alt="Generated scene" className="max-h-[420px] w-full object-contain" loading="lazy" />
                                </figure>
                            )}
                            {!isUser && !isEditing && failedImage && (
                                <div className="mt-3 rounded-xl border border-blood-500/25 bg-blood-500/10 px-4 py-3 text-[13px] text-blood-200">
                                    {turn.imageError?.detail || 'Image generation failed.'}
                                </div>
                            )}
                        </>
                    )}
                </div>

                <ForwardOptions
                    options={turn.forwardOptions}
                    onOptionClick={onForwardOptionClick}
                />
            </div>
        </div>
    )
}

function isSafeGeneratedImageUrl(value: string): boolean {
    const text = String(value || '').trim()
    const lowered = text.toLowerCase()
    if (!text || lowered.startsWith('data:') || lowered.includes('fal.media') || lowered.includes('signature=') || lowered.includes('x-amz-signature') || lowered.includes('/var/') || lowered.includes('/tmp/')) {
        return false
    }
    if (text.startsWith('/')) return !text.startsWith('//')
    return lowered.startsWith('http://') || lowered.startsWith('https://')
}
