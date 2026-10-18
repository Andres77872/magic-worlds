import { useFeatureFlags } from '@/shared/hooks/useFeatureFlags'
/**
 * Character-chat sidebar. Single chats show one profile; group chats show the
 * frozen AI cast plus the user's persona.
 */

import { useId, useMemo, type ReactNode } from 'react'
import { ArrowLeft, MessageCircle, Pencil, Phone, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { Character, CharacterChatCodexCard } from '../../../shared'
import type { CodexLibraryCardSelection } from '@/features/codex'
import { useVoiceAvailability } from '@/features/interaction/hooks/useVoiceAvailability'
import { SessionNarrationTierToggle } from '@/features/interaction/components/SessionNarrationTierToggle'
import { ChatVoiceIndicator } from '@/features/interaction/components/voice/ChatVoiceIndicator'
import { SessionLorebookPanel } from '@/features/lorebook'
import { isLorebooksFeatureEnabled, isVoicesFeatureEnabled, isCallsFeatureEnabled } from '@/shared/featureFlags'
import { useWorkspaceReadOnly } from '@/shared/hooks/useWorkspaceReadOnly'
import { apiService, resolveMediaUrl } from '../../../infrastructure/api'
import { Avatar, Button, Eyebrow, Icon, Portrait } from '@/ui/primitives'
import { ModeBadge } from '../../../ui/components/common/ModeBadge'
import { CharacterChatCodexPanel } from './CharacterChatCodexPanel'
import { characterChatParticipantIds } from '../codexParticipants'

interface CharacterChatSidebarProps {
    sessionId?: string
    /** Workspace R1: the chat's own workspace (its lorebook attachments live there). */
    sessionWorkspaceId?: string | null
    character?: Character
    characters?: Character[]
    title?: string
    isGroup?: boolean
    persona?: Character
    /** Current engine mode; enables the in-place call/text toggle. */
    mode?: 'text' | 'voice'
    voiceEnabled?: boolean
    onSetMode?: (mode: 'text' | 'voice') => void
    codexCards?: CharacterChatCodexCard[]
    onAddCodexCards?: (cards: CodexLibraryCardSelection[]) => Promise<unknown>
    onToggleCodexCard?: (card: CharacterChatCodexCard, enabled: boolean) => Promise<unknown>
    onRemoveCodexCard?: (card: CharacterChatCodexCard) => Promise<unknown>
    onBack: () => void
    sceneNarration?: ReactNode
    onEditCharacter: (character: Character) => void
}

export function CharacterChatSidebar({
    sessionId,
    sessionWorkspaceId,
    character,
    characters,
    title,
    isGroup = false,
    persona,
    mode = 'text',
    voiceEnabled = false,
    onSetMode,
    codexCards = [],
    onAddCodexCards,
    onToggleCodexCard,
    onRemoveCodexCard,
    onBack,
    sceneNarration,
    onEditCharacter,
}: CharacterChatSidebarProps) {
    useFeatureFlags()
    const { t } = useTranslation()
    const cast: Character[] = isGroup ? (characters ?? []) : character ? [character] : []
    const lead = cast[0]
    const heading = title || cast.map((entry) => entry.name).filter(Boolean).join(', ') || t('characterChat.fallbackTitle')
    const hasCodexControls = Boolean(onAddCodexCards && onToggleCodexCard && onRemoveCodexCard)
    const lorebooksEnabled = isLorebooksFeatureEnabled()
    // Workspace R1: a chat in an archived workspace cannot start a call (as on CallsPage).
    const readOnly = useWorkspaceReadOnly(sessionWorkspaceId)
    // 09 §7: calls switched off for this account (the shared 60 s capabilities read,
    // fail open), only while the Call button is shown: disabled with the Calls page copy.
    const callOffered = !isGroup && Boolean(lead) && voiceEnabled && isCallsFeatureEnabled() && Boolean(onSetMode) && mode !== 'voice'
    const callsUnavailable = !useVoiceAvailability(apiService, callOffered, 0, lead?.voice?.provider ?? 'elevenlabs').calls_available
    const callsUnavailableId = useId()
    // R1-FE-04: the chat's narration tier override rides the chat's own workspace
    // client (EP-1); the toggle renders nothing when its reads fail.
    const sessionApi = useMemo(() => {
        if (!sessionWorkspaceId) return null
        try {
            return apiService.withWorkspace(sessionWorkspaceId)
        } catch {
            return null
        }
    }, [sessionWorkspaceId])
    const chatId = sessionId ? Number(sessionId) : Number.NaN
    const narrationTierOffered = isVoicesFeatureEnabled() && Boolean(sessionApi) && Number.isInteger(chatId) && chatId > 0

    return (
        <div className="flex h-full flex-col bg-ink-900">
            <div className="flex items-center gap-2 border-b border-parchment-50/10 px-4 py-3">
                <Button variant="ghost" size="sm" onClick={onBack} iconLeft={<ArrowLeft size={16} />}>
                    {t('common.back')}
                </Button>
                <span className="ml-auto">
                    <ModeBadge mode="chat" />
                </span>
            </div>

            <div className="flex-1 overflow-y-auto">
                <Portrait name={heading} src={resolveMediaUrl(lead?.image_url)} height={200}>
                    {isGroup && (
                        <div className="absolute bottom-3 left-3 z-[2] flex items-center gap-2 rounded-full border border-arcane-500/35 bg-ink-900/70 px-3 py-1.5 text-arcane-200 backdrop-blur">
                            <Icon icon={Users} size={14} />
                            <span className="font-ui text-xs font-semibold">{t('characterChat.sidebar.castCount', { count: cast.length })}</span>
                        </div>
                    )}
                </Portrait>

                <div className="flex flex-col gap-4 px-5 py-5">
                    <div className="flex flex-col gap-1.5">
                        <Eyebrow tone="arcane" className="text-meta">
                            {isGroup ? t('characterChat.sidebar.groupChat') : t('characterChat.sidebar.chattingWith')}
                        </Eyebrow>
                        <h2 className="font-display text-h3 font-semibold leading-tight text-parchment-50">
                            {heading}
                        </h2>
                        {!isGroup && lead?.race && <p className="text-label text-parchment-300">{lead.race}</p>}
                    </div>

                    {/* R1-FE-04 (D36): "Voice replaced" and "Use the card's current voice". */}
                    {isVoicesFeatureEnabled() && !isGroup && sessionId ? <ChatVoiceIndicator variant="panel" chatId={sessionId} workspaceId={sessionWorkspaceId} /> : null}

                    {persona && (
                        <section className="border-l-2 border-ember-500/40 py-1 pl-3">
                            <Eyebrow tone="ember" className="mb-1">
                                {t('characterChat.sidebar.youAre')}
                            </Eyebrow>
                            <p className="font-display text-body font-semibold text-parchment-50">{persona.name}</p>
                            {persona.race && <p className="mt-0.5 text-label text-parchment-300">{persona.race}</p>}
                        </section>
                    )}

                    {(hasCodexControls || (sessionId && lorebooksEnabled)) && (
                        <div className="flex flex-col divide-y divide-parchment-50/10 border-y border-parchment-50/10">
                            {onAddCodexCards && onToggleCodexCard && onRemoveCodexCard && (
                                <CharacterChatCodexPanel
                                    cards={codexCards}
                                    participantCardIds={characterChatParticipantIds({ characters: cast, persona })}
                                    participantCards={[...cast, ...(persona ? [persona] : [])].map((card) => ({
                                        kind: 'character', cardId: card.id, snapshot: { ...card },
                                    }))}
                                    onAddCards={onAddCodexCards}
                                    onToggleCard={onToggleCodexCard}
                                    onRemoveCard={onRemoveCodexCard}
                                    workspaceId={sessionWorkspaceId}
                                />
                            )}

                            {sessionId && lorebooksEnabled && (
                                <SessionLorebookPanel targetKind="character_chat" targetId={sessionId} framed={false} workspaceId={sessionWorkspaceId} />
                            )}
                        </div>
                    )}

                    {narrationTierOffered && sessionApi && (
                        <SessionNarrationTierToggle api={sessionApi} basePath="character-chats" sessionId={chatId} readOnly={readOnly} />
                    )}
                    {sceneNarration}

                    {isGroup ? (
                        <ul className="m-0 flex list-none flex-col divide-y divide-parchment-50/10 p-0">
                            {cast.map((member) => (
                                <li key={member.id} className="flex items-start gap-3 py-4">
                                    <Avatar
                                        name={member.name}
                                        src={resolveMediaUrl(member.image_url)}
                                        size={42}
                                        ring="arcane"
                                    />
                                    <div className="min-w-0 flex-1">
                                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                                            <p className="min-w-0 truncate font-display text-body font-semibold text-parchment-50">{member.name}</p>
                                            {member.race && <span className="text-caption text-parchment-300">{member.race}</span>}
                                        </div>
                                        {member.greeting && (
                                            <p className="mt-1 line-clamp-2 font-narrative text-label italic text-parchment-300">
                                                “{member.greeting}”
                                            </p>
                                        )}
                                        {member.description && !member.greeting && (
                                            <p className="mt-1 line-clamp-2 font-narrative text-label text-parchment-300">
                                                {member.description}
                                            </p>
                                        )}
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => onEditCharacter(member)}
                                        iconLeft={<Pencil size={14} />}
                                        aria-label={t('characterChat.sidebar.editAria', { name: member.name })}
                                    >
                                        {t('common.edit')}
                                    </Button>
                                </li>
                            ))}
                        </ul>
                    ) : lead?.greeting && (
                        <section>
                            <Eyebrow tone="muted" className="mb-2">
                                {t('characterChat.sidebar.openingLine')}
                            </Eyebrow>
                            <blockquote className="font-narrative text-body italic leading-relaxed text-parchment-200">
                                “{lead.greeting}”
                            </blockquote>
                        </section>
                    )}

                    {!isGroup && lead?.description && (
                        <p className="font-narrative text-body leading-relaxed text-parchment-200">
                            {lead.description}
                        </p>
                    )}
                </div>
            </div>

            {!isGroup && lead && (
                <div className="flex flex-col gap-2 border-t border-parchment-50/10 px-4 py-3">
                    {isCallsFeatureEnabled() && voiceEnabled && onSetMode && (
                        mode === 'voice' ? (
                            <Button
                                variant="secondary"
                                onClick={() => onSetMode('text')}
                                iconLeft={<Icon icon={MessageCircle} size={15} />}
                                className="w-full"
                            >
                                {t('characterChat.sidebar.switchToText')}
                            </Button>
                        ) : (
                            <>
                                <Button
                                    variant="primary"
                                    onClick={() => onSetMode('voice')}
                                    iconLeft={<Icon icon={Phone} size={15} />}
                                    className="w-full"
                                    disabled={readOnly || callsUnavailable}
                                    title={callsUnavailable ? t('call.page.unavailable') : undefined}
                                    aria-describedby={callsUnavailable ? callsUnavailableId : undefined}
                                >
                                    {t('characterChat.sidebar.call', { name: lead.name })}
                                </Button>
                                {callsUnavailable && (
                                    <span id={callsUnavailableId} hidden>
                                        {t('call.page.unavailable')}
                                    </span>
                                )}
                            </>
                        )
                    )}
                    <Button variant="secondary" onClick={() => onEditCharacter(lead)} iconLeft={<Pencil size={15} />} className="w-full">
                        {t('characterChat.sidebar.editCharacter')}
                    </Button>
                </div>
            )}
        </div>
    )
}
