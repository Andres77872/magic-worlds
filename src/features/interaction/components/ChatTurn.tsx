import { useFeatureFlags } from '@/shared/hooks/useFeatureFlags'
import { isVoicesFeatureEnabled } from '@/shared/featureFlags'
import { memo, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Phone } from 'lucide-react'
import type { ChatNarratorIdentity, ChatResponseSegment, ForwardOption, TurnEntry } from '../../../shared'
import { Badge, cx, Eyebrow, Icon } from '../../../ui/primitives'
import type { TriggerMatcher } from '@/features/lorebook'
import { formatApiTime } from '@/utils/time'
import { callTurnDisplay, isCallReply, isCallTurn, turnVoiceSessionId } from '../utils/callTurnMarkup'
import { ChatAvatar } from './ChatAvatar'
import { ChatMessage } from './ChatMessage'
import { ChatActions } from './ChatActions'
import { ReplyVersionSwitcher } from './ReplyVersionSwitcher'
import type { ReplyVersions } from '../utils/chatTurnVisibility'
import { ForwardOptions } from './ForwardOptions'
import { EditMode } from './EditMode'
import { ChatTurnImages } from './ChatTurnImages'
import type { ChatTurnImagesView } from '../hooks/useChatImages'
import { TurnNarration } from './TurnNarration'
import type { VoiceRefreshTarget } from './NarrationVoiceNotes'

// Extend TurnEntry with the live-only fields the chat panel adds while streaming
interface ExtendedTurnEntry extends TurnEntry {
    forwardOptions?: ForwardOption[]
    segments?: ChatResponseSegment[]
    isStreaming?: boolean
    narratorIdentity?: ChatNarratorIdentity | null
}

interface ChatTurnProps {
    turn: ExtendedTurnEntry
    onForwardOptionClick: (message: string) => void
    onRegenerateClick?: (turnId: string) => void
    onDeleteClick?: (turnId: string) => void
    onConfirmDeleteClick?: (turnId: string) => void
    onCancelDeleteClick?: () => void
    onEditClick?: (turnId: string, newContent: string) => void
    /** Omitted while narration cannot be requested (a read-only workspace): stored clips still play. */
    onRequestNarration?: (assistantMessageId?: number, turnId?: string) => void
    /** Opens the age and terms attestation when narration is refused for it (D26); same ids as `onRequestNarration`, to retry once. */
    onAttestNarration?: (assistantMessageId?: number, turnId?: string) => void
    /** The server switched narration off (`capabilities.status`, 09 §7): the narrate control is disabled with copy; stored clips still play. */
    narrationUnavailable?: boolean
    /** Label for the AI speaker (e.g. "Game Master" or a character's name). */
    aiLabel?: string
    /** Render the suggested-replies (forwardOptions) row (`ChatSessionConfig.showForwardOptions`). */
    showForwardOptions?: boolean
    /** Render per-turn generated scene images (`ChatSessionConfig.showImages`). */
    showImage?: boolean
    /**
     * This reply's scene images (`useChatImages`), one view per assistant
     * message; actions come from `ChatImageActionsContext`.
     */
    images?: ChatTurnImagesView
    /** Hide mutating turn actions while the session is busy. */
    actionsDisabled?: boolean
    confirmingDelete?: boolean
    deleting?: boolean
    /** Session-lore matcher passed to ChatMessage for inline trigger marking. */
    loreMatcher?: TriggerMatcher | null
    /** The single AI character of a 1:1 chat: its portrait replaces the GM glyph. */
    aiSpeaker?: { id: string; name: string; imageUrl?: string | null }
    /** Stored versions of the latest reply; with a selector, the player can switch between them. */
    versions?: ReplyVersions
    onSelectVersion?: (turnId: string) => void
    /** Separate from `actionsDisabled` so a switch in flight keeps focus on its button. */
    versionsDisabled?: boolean
    /** "Voice replaced" refresh for a cast speaker (R1); passed through to TurnNarration. */
    onRefreshVoice?: (target: VoiceRefreshTarget) => Promise<unknown>
    /** "Voice replaced" action for the narrator; passed through to TurnNarration. */
    onEditNarratorVoice?: () => void
    refreshDisabled?: boolean
    /** Told when this turn's narration starts or stops playing (stable callback; keyed by turn id). */
    onNarrationPlayingChange?: (turnId: string, playing: boolean) => void
    /** Open the saved voice-call transcript for this turn's call session. */
    onOpenCallTranscript?: (voiceSessionId: string) => void
}

// Memoized: the panel re-renders on every streaming delta and composer
// keystroke — untouched turns keep their object identity and must not re-run
// their markdown rendering.
export const ChatTurn = memo(function ChatTurn({ turn, onForwardOptionClick, onRegenerateClick, onDeleteClick, onConfirmDeleteClick, onCancelDeleteClick, onEditClick, onRequestNarration, onAttestNarration, narrationUnavailable = false, aiLabel, showForwardOptions = true, showImage = true, images, actionsDisabled = false, confirmingDelete = false, deleting = false, loreMatcher, aiSpeaker, versions, onSelectVersion, versionsDisabled = false, onRefreshVoice, onEditNarratorVoice, refreshDisabled, onNarrationPlayingChange, onOpenCallTranscript }: ChatTurnProps) {
    useFeatureFlags()
    const { t } = useTranslation()
    const resolvedAiLabel = aiLabel ?? t('interaction.chat.gameMaster')
    const isUser = turn.type === 'user'
    const [isEditing, setIsEditing] = useState(false)
    const callReply = isCallReply(turn)
    const callTurn = isCallTurn(turn)
    const callSessionId = turnVoiceSessionId(turn)

    const handleEditStart = () => {
        if (callTurn) return
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

    const hasNarration = Boolean(turn.ttsUrl || turn.ttsAssets?.length || turn.ttsSegments?.length)
    // D23: a call reply shows, and copies, without speech markup; any other turn passes its own content and segments.
    // Editing still starts from the stored text.
    const display = useMemo(() => callTurnDisplay(turn), [turn])

    return (
        <article className={cx('mb-8 flex gap-3', isUser && 'flex-row-reverse')}>
            <ChatAvatar isUser={isUser} aiName={aiSpeaker?.name} aiImageUrl={aiSpeaker?.imageUrl} thinking={turn.isStreaming} />

            <div className={cx('flex min-w-0 max-w-[640px] flex-1 flex-col gap-2', isUser ? 'items-end' : 'items-start')}>
                <header className={cx('flex min-h-8 w-full min-w-0 items-center gap-3', isUser && 'flex-row-reverse')}>
                    <Eyebrow tone={isUser ? 'ember' : 'arcane'} className="min-w-0 truncate">
                        {isUser ? t('interaction.chat.player') : turn.narratorIdentity?.name || resolvedAiLabel}
                    </Eyebrow>
                    {callTurn && (
                        callSessionId && onOpenCallTranscript ? (
                            <button
                                type="button"
                                onClick={() => onOpenCallTranscript(callSessionId)}
                                className="inline-flex shrink-0 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-arcane-400"
                                title={t('interaction.chat.viewCallTranscript')}
                                data-testid="chat-turn-call-badge"
                            >
                                <Badge tone="arcane" icon={<Icon icon={Phone} size={11} />}>
                                    {t('interaction.chat.callBadge')}
                                </Badge>
                            </button>
                        ) : (
                            <Badge tone="arcane" icon={<Icon icon={Phone} size={11} />} data-testid="chat-turn-call-badge">
                                {t('interaction.chat.callBadge')}
                            </Badge>
                        )
                    )}
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
                        <ChatMessage content={display.content} isUser={isUser} isStreaming={turn.isStreaming} segments={display.segments} narratorIdentity={turn.narratorIdentity} aiLabel={resolvedAiLabel} loreMatcher={loreMatcher} soloSpeakerId={aiSpeaker?.id} />
                    )}
                    {!isUser && !isEditing && showImage && (
                        <ChatTurnImages
                            messageId={turn.assistantMessageId}
                            images={images}
                            hasPrompt={Boolean(turn.imagePrompt)}
                            streaming={turn.isStreaming}
                        />
                    )}
                </div>

                {/* Utilities follow their content, leaving the speaker line and prose quiet.
                    Keep them visible for keyboard, touch, and first-time readers. */}
                {!isEditing && (
                    <div className="flex max-w-full flex-wrap items-center gap-0.5">
                        {versions && onSelectVersion && versions.ids.length > 1 && (
                            <ReplyVersionSwitcher
                                index={versions.index}
                                count={versions.ids.length}
                                disabled={versionsDisabled || turn.isStreaming}
                                onSelect={(index) => onSelectVersion(versions.ids[index])}
                            />
                        )}
                        {isVoicesFeatureEnabled() && !isUser && (callReply ? hasNarration : (onRequestNarration || hasNarration)) && (
                            <TurnNarration
                                mode={callReply ? 'call' : 'narration'}
                                status={turn.ttsStatus}
                                url={turn.ttsUrl ?? turn.ttsAssets?.[0]?.url}
                                segments={turn.ttsSegments}
                                error={turn.ttsError}
                                canRequest={!callReply && Boolean(onRequestNarration) && !turn.isStreaming && Boolean(turn.assistantMessageId || turn.turnId)}
                                onRequest={() => onRequestNarration?.(turn.assistantMessageId, turn.turnId)}
                                onAttest={onAttestNarration ? () => onAttestNarration(turn.assistantMessageId, turn.turnId) : undefined}
                                unavailable={narrationUnavailable}
                                onRefreshVoice={onRefreshVoice}
                                onEditNarratorVoice={onEditNarratorVoice}
                                refreshDisabled={refreshDisabled}
                                onPlayingChange={onNarrationPlayingChange ? (playing) => onNarrationPlayingChange(turn.id, playing) : undefined}
                            />
                        )}
                        <ChatActions
                            turnId={turn.id}
                            isUser={isUser}
                            isEditing={isEditing}
                            isStreaming={turn.isStreaming}
                            actionsDisabled={actionsDisabled}
                            messageContent={display.content}
                            onEditClick={!callTurn && onEditClick ? handleEditStart : undefined}
                            onRegenerateClick={onRegenerateClick}
                            onDeleteClick={onDeleteClick}
                            confirmingDelete={confirmingDelete}
                            deleting={deleting}
                            onConfirmDelete={() => onConfirmDeleteClick?.(turn.id)}
                            onCancelDelete={onCancelDeleteClick}
                        />
                    </div>
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

