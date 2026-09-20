import { memo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ChatImageAsset, ChatNarratorIdentity, ChatResponseSegment, ForwardOption, ImageLifecycleStatus, TurnEntry } from '../../../shared'
import { cx, Eyebrow } from '../../../ui/primitives'
import type { TriggerMatcher } from '@/features/lorebook'
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
    /** Session-lore matcher passed to ChatMessage for inline trigger marking. */
    loreMatcher?: TriggerMatcher | null
}

// Memoized: the panel re-renders on every streaming delta and composer
// keystroke — untouched turns keep their object identity and must not re-run
// their markdown rendering.
export const ChatTurn = memo(function ChatTurn({ turn, onForwardOptionClick, onRegenerateClick, onDeleteClick, onConfirmDeleteClick, onCancelDeleteClick, onEditClick, onRequestNarration, aiLabel, showForwardOptions = true, showImage = true, actionsDisabled = false, confirmingDelete = false, deleting = false, loreMatcher }: ChatTurnProps) {
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
        <article className={cx('mb-8 flex gap-3', isUser && 'flex-row-reverse')}>
            <ChatAvatar isUser={isUser} />

            <div className={cx('flex min-w-0 max-w-[640px] flex-1 flex-col gap-2', isUser ? 'items-end' : 'items-start')}>
                <header className={cx('flex min-h-8 w-full min-w-0 items-center gap-3', isUser && 'flex-row-reverse')}>
                    <Eyebrow tone={isUser ? 'ember' : 'arcane'} className="min-w-0 truncate">
                        {isUser ? t('interaction.chat.player') : turn.narratorIdentity?.name || resolvedAiLabel}
                    </Eyebrow>
                    <time dateTime={turn.timestamp} className="shrink-0 font-mono text-caption text-parchment-400">
                        {formatApiTime(turn.timestamp)}
                    </time>
                </header>

                <div className={cx('w-full min-w-0', isUser && 'flex flex-col items-end')}>
                    {isEditing ? (
                        <EditMode
                            initialContent={turn.content}
                            isUser={isUser}
                            onSave={handleEditSave}
                            onCancel={handleEditCancel}
                        />
                    ) : (
                        <ChatMessage content={turn.content} isUser={isUser} isStreaming={turn.isStreaming} segments={turn.segments} narratorIdentity={turn.narratorIdentity} aiLabel={resolvedAiLabel} loreMatcher={loreMatcher} />
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
                </div>

                {/* Utilities follow their content, leaving the speaker line and prose quiet.
                    Keep them visible for keyboard, touch, and first-time readers. */}
                {!isEditing && (
                    <div className="flex max-w-full flex-wrap items-center gap-0.5">
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

                {!isUser && !turn.isStreaming && turn.metadata?.interrupted === true && (
                    <p className="text-caption text-parchment-400">{t('streaming.interrupted')}</p>
                )}

                {showForwardOptions && (
                    <ForwardOptions
                        options={turn.forwardOptions}
                        onOptionClick={onForwardOptionClick}
                    />
                )}
            </div>
        </article>
    )
})
