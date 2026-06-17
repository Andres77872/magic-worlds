import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ChatImageAsset, ChatNarratorIdentity, ChatResponseSegment, ForwardOption, ImageLifecycleStatus, TurnEntry } from '../../../shared'
import { cx, Eyebrow } from '../../../ui/primitives'
import { formatApiTime } from '@/utils/time'
import { isSafeAssetUrl } from '../utils/chatImageTurnState'
import { ChatAvatar } from './ChatAvatar'
import { ChatMessage } from './ChatMessage'
import { ChatActions } from './ChatActions'
import { ForwardOptions } from './ForwardOptions'
import { EditMode } from './EditMode'
import { GeneratedImage } from './GeneratedImage'
import { TurnNarration } from './TurnNarration'

// Extend TurnEntry to include forward options and the (out-of-scope) image prompt
interface ExtendedTurnEntry extends TurnEntry {
    forwardOptions?: ForwardOption[]
    segments?: ChatResponseSegment[]
    isStreaming?: boolean
    narratorIdentity?: ChatNarratorIdentity | null
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
    onConfirmDeleteClick?: (turnId: string) => void
    onCancelDeleteClick?: () => void
    onEditClick?: (turnId: string, newContent: string) => void
    onRequestNarration?: (assistantMessageId?: number, turnId?: string) => void
    /** Label for the AI speaker (e.g. "Game Master" or a character's name). */
    aiLabel?: string
    /** Render the suggested-replies (forwardOptions) row. Off for 1:1 character chat. */
    showForwardOptions?: boolean
    /** Render per-turn generated scene images. Off for 1:1 character chat. */
    showImage?: boolean
    /** Hide mutating turn actions while the session is busy. */
    actionsDisabled?: boolean
    confirmingDelete?: boolean
    deleting?: boolean
}

export function ChatTurn({ turn, onForwardOptionClick, onRegenerateClick, onDeleteClick, onConfirmDeleteClick, onCancelDeleteClick, onEditClick, onRequestNarration, aiLabel, showForwardOptions = true, showImage = true, actionsDisabled = false, confirmingDelete = false, deleting = false }: ChatTurnProps) {
    const { t } = useTranslation()
    const resolvedAiLabel = aiLabel ?? t('interaction.chat.gameMaster')
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

    const safeAssets = (turn.imageAssets ?? []).filter((asset) => isSafeAssetUrl(asset.url))
    const imageUrl = safeAssets[0]?.url ?? (turn.imageUrl && isSafeAssetUrl(turn.imageUrl) ? turn.imageUrl : undefined)

    return (
        <div className={cx('mb-6 flex gap-3', isUser && 'flex-row-reverse')}>
            <ChatAvatar isUser={isUser} />

            <div className={cx('flex min-w-0 max-w-[640px] flex-col gap-1.5', isUser ? 'items-end' : 'items-start')}>
                <div className={cx('flex items-center gap-2', isUser && 'flex-row-reverse')}>
                    <Eyebrow tone={isUser ? 'ember' : 'arcane'} className="min-w-0 truncate text-[11px] tracking-[0.16em]">
                        {isUser ? t('interaction.chat.player') : turn.narratorIdentity?.name || resolvedAiLabel}
                    </Eyebrow>
                    <div className={cx('flex shrink-0 items-center gap-2', isUser && 'flex-row-reverse')}>
                        <span className="font-mono text-[11px] text-parchment-500">
                            {formatApiTime(turn.timestamp)}
                        </span>
                        {/* Group TTS + copy/edit/regenerate/delete into one quiet toolbar so they
                            read as a single control cluster rather than glyphs crowding the name. */}
                        {!isEditing && (
                            <div className="flex items-center gap-0.5 rounded-full border border-parchment-50/[.08] bg-ink-700/60 px-1 py-0.5">
                                {!isUser && onRequestNarration && (
                                    <TurnNarration
                                        status={turn.ttsStatus}
                                        url={turn.ttsUrl ?? turn.ttsAssets?.[0]?.url}
                                        segments={turn.ttsSegments}
                                        errorDetail={turn.ttsError?.detail}
                                        canRequest={!turn.isStreaming && Boolean(turn.assistantMessageId || turn.turnId)}
                                        onRequest={() => onRequestNarration(turn.assistantMessageId, turn.turnId)}
                                    />
                                )}
                                <ChatActions
                                    turnId={turn.id}
                                    isUser={isUser}
                                    isEditing={isEditing}
                                    isStreaming={turn.isStreaming}
                                    actionsDisabled={actionsDisabled}
                                    messageContent={turn.content}
                                    onEditClick={onEditClick ? handleEditStart : undefined}
                                    onRegenerateClick={onRegenerateClick}
                                    onDeleteClick={onDeleteClick}
                                    confirmingDelete={confirmingDelete}
                                    deleting={deleting}
                                    onConfirmDelete={() => onConfirmDeleteClick?.(turn.id)}
                                    onCancelDelete={onCancelDeleteClick}
                                />
                            </div>
                        )}
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
                                <ChatMessage content={turn.content} isUser={isUser} isStreaming={turn.isStreaming} segments={turn.segments} />
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
                                <ChatMessage content={turn.content} isUser={isUser} isStreaming={turn.isStreaming} segments={turn.segments} narratorIdentity={turn.narratorIdentity} aiLabel={resolvedAiLabel} />
                            )}
                            {!isUser && !isEditing && showImage && (
                                <GeneratedImage
                                    status={turn.imageStatus}
                                    url={imageUrl}
                                    width={safeAssets[0]?.width}
                                    height={safeAssets[0]?.height}
                                    errorDetail={turn.imageError?.detail}
                                />
                            )}
                        </>
                    )}
                </div>

                {showForwardOptions && (
                    <ForwardOptions
                        options={turn.forwardOptions}
                        onOptionClick={onForwardOptionClick}
                    />
                )}
            </div>
        </div>
    )
}
