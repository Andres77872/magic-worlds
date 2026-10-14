/**
 * Chat header voice indicator (R1-FE-04; 09 §4.5, 05 §7.8, 03 §5.12, AC-C6).
 *
 * For a saved 1:1 character chat it shows:
 * - "Voice replaced" (tooltip: the voice heard) when the chat's voice is a
 *   forced substitution, else "Card voice changed" when the card now plays
 *   another voice than the chat;
 * - "Use the card's current voice" (D36, `POST /character-chats/{id}/voice/refresh`
 *   through DataProvider on the chat's workspace client) when the chat's voice
 *   differs from the card's current one and the card's voice could be copied
 *   (`sessionVoiceDrift`). A 409 shows the busy or source copy
 *   (`useVoiceRefresh`); success reads the chat's voices again, so the
 *   indicator goes once they match. Hidden when the workspace is archived.
 *   A refresh run elsewhere (a clip note, the call end panel) upserts the chat,
 *   which reads its voices again too (`useSessionVoices` revision).
 * - Without the source card in this workspace's library (deleted, moved, D39
 *   item 6) "Voice replaced" still shows, without the action (03 §5.12).
 *
 * Activating the action moves focus to the status line, which reports the
 * outcome and stays while it holds focus: the button it replaces may unmount.
 *
 * Group chats are not refreshable (the route answers 404) and show nothing
 * here; a failed read of the chat's voices shows nothing either.
 *
 * Reads DataProvider and the workspace through their contexts, so it renders
 * nothing outside them (stories, isolated tests).
 */
import { useContext, useId, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { RefreshCw } from 'lucide-react'
import { DataContext } from '@/app/providers/DataProvider'
import { organizationWorkspaceId } from '@/shared/hooks/useScopedApi'
import { readEffectiveVoice } from '@/shared/voice'
import { VoiceBadges } from '@/features/voices/components/VoiceBadges'
import { Badge, Button, Icon, cx } from '@/ui/primitives'
import { useVoiceRefresh } from '../../hooks/useVoiceRefresh'
import { invalidateSessionVoices } from './sessionVoiceCache'
import { sessionVoiceDrift, type SessionVoiceDrift } from './sessionVoiceDrift'
import { useDoneReset } from './useDoneReset'
import { useSessionClient } from './useSessionClient'
import { useSessionVoices } from './useSessionVoices'

export interface ChatVoiceIndicatorProps {
    /** `bar`: the slim mobile strip under the chat top bar; `panel`: the chat sidebar block. */
    variant: 'bar' | 'panel'
    /** The chat this describes; the active chat when omitted. */
    chatId?: string
    /** The chat's workspace when the caller already resolved it (the sidebar). */
    workspaceId?: string | null
    className?: string
}

export function ChatVoiceIndicator({ variant, chatId, workspaceId, className }: ChatVoiceIndicatorProps) {
    const { t } = useTranslation()
    const hintId = useId()
    const data = useContext(DataContext)
    const activeChat = data?.activeCharacterChat ?? null
    const chat = activeChat && (chatId === undefined || activeChat.id === chatId) ? activeChat : null
    const session = useSessionClient(workspaceId ?? organizationWorkspaceId(chat))
    const cardIds = chat?.character_ids?.length ? chat.character_ids : chat?.character_id ? [chat.character_id] : []
    const numericId = Number(chat?.id)
    const single = Boolean(
        chat && !chat.isDraft && chat.kind !== 'character_group' && cardIds.length <= 1
        && Number.isInteger(numericId) && numericId > 0,
    )
    const enabled = single
    // The source card counts only from the session's own workspace (D39 item 6); absent is fine.
    const card = enabled && session.active && cardIds[0] ? data?.characters.find((character) => character.id === cardIds[0]) : undefined
    const cardEffective = readEffectiveVoice(card?.effective_voice)
    const { key, voices } = useSessionVoices(enabled ? session.api : null, session.workspaceId, enabled ? numericId : null, chat)
    const drift = enabled ? sessionVoiceDrift(voices?.get('character.voice'), cardEffective) : null
    const refresh = useVoiceRefresh()
    const statusRef = useRef<HTMLSpanElement>(null)
    useDoneReset(refresh, statusRef)

    if (!enabled || !chat || (!drift && refresh.status === 'idle')) return null

    const refreshChat = data?.refreshCharacterChatVoice
    const api = session.api
    const canRefresh = Boolean(drift?.differs && !session.readOnly && api && key && typeof refreshChat === 'function')
    const onRefresh = () => {
        if (!api || !key || typeof refreshChat !== 'function') return
        // The button is disabled while busy and goes on success: keep focus on the outcome.
        statusRef.current?.focus()
        void refresh.run(async () => {
            await refreshChat(chat.id, api)
            invalidateSessionVoices(key)
        })
    }
    const hint = drift?.differs
        ? drift.cardName ? t('voices.refresh.cardNow', { name: drift.cardName }) : t('voices.refresh.cardNowGeneric')
        : null
    const status = (
        <span
            ref={statusRef}
            role="status"
            tabIndex={-1}
            className={cx('font-ui text-caption', refresh.status === 'error' ? 'text-blood-300' : 'text-parchment-300')}
        >
            {refresh.message}
        </span>
    )
    const action = canRefresh ? (
        <Button
            variant={variant === 'bar' ? 'ghost' : 'secondary'}
            size="sm"
            iconLeft={<Icon icon={RefreshCw} size={14} />}
            onClick={onRefresh}
            disabled={refresh.status === 'busy'}
            aria-describedby={hint ? hintId : undefined}
            className={variant === 'panel' ? 'self-start' : undefined}
        >
            {t('voices.refresh.action')}
        </Button>
    ) : null

    if (variant === 'bar') {
        return (
            <div
                className={cx('flex min-h-10 shrink-0 flex-wrap items-center gap-x-2 gap-y-1 border-b border-parchment-50/[.08] bg-ink-900/80 px-3 py-1.5', className)}
                data-testid="chat-voice-indicator"
                aria-label={t('voices.refresh.regionLabel')}
                role="group"
            >
                {drift && <DriftBadge drift={drift} />}
                {hint && <span id={hintId} className="sr-only">{hint}</span>}
                {action}
                {status}
            </div>
        )
    }

    return (
        <div
            className={cx('flex flex-col gap-2', className)}
            data-testid="chat-voice-indicator"
            aria-label={t('voices.refresh.regionLabel')}
            role="group"
        >
            {drift && (
                <div className="flex flex-wrap items-center gap-1.5">
                    <DriftBadge drift={drift} />
                </div>
            )}
            {hint && <p id={hintId} className="font-ui text-caption text-parchment-300">{hint}</p>}
            {action}
            {status}
        </div>
    )
}

function DriftBadge({ drift }: { drift: SessionVoiceDrift }) {
    const { t } = useTranslation()
    if (drift.replaced) return <VoiceBadges badges={['replaced']} context={{ name: drift.sessionName }} />
    return (
        <Badge tone="neutral" data-badge="card_changed">
            {t('voices.refresh.cardChanged')}
        </Badge>
    )
}
