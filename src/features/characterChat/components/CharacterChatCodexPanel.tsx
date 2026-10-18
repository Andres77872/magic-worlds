import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Trash2 } from 'lucide-react'
import type { CharacterChatCodexCard } from '@/shared'
import { useFloatingWindows } from '@/app/hooks'
import { cardWindow } from '@/features/floatingWindows'
import { CodexCardPickerDrawer, KIND_ICONS, snapshotDisplayDescription, snapshotDisplayLabel, snapshotToCardPreview, type CodexLibraryCardSelection } from '@/features/codex'
import { ConfirmDialog, ReferenceGroup, ReferenceRow } from '@/ui/components'
import { Button, Callout, Icon, IconButton, Switch } from '@/ui/primitives'
import { useCardSourceStatuses } from '@/features/codex/hooks/useCardSourceStatuses'
import { cardSourceStatusText, type CodexContextCard } from '@/features/codex/utils/cardSourceStatus'
import { resolveMediaUrl } from '@/infrastructure/api'

interface CharacterChatCodexPanelProps {
    cards: CharacterChatCodexCard[]
    participantCardIds: ReadonlySet<string>
    participantCards?: readonly CodexContextCard[]
    onAddCards: (cards: CodexLibraryCardSelection[]) => Promise<unknown>
    onToggleCard: (card: CharacterChatCodexCard, enabled: boolean) => Promise<unknown>
    onRemoveCard: (card: CharacterChatCodexCard) => Promise<unknown>
    /** Workspace R1: the chat's own workspace; the picker browses that library. */
    workspaceId?: string | null
}

const NO_PARTICIPANT_CARDS: readonly CodexContextCard[] = []

export function CharacterChatCodexPanel({ cards, participantCardIds, participantCards = NO_PARTICIPANT_CARDS, onAddCards, onToggleCard, onRemoveCard, workspaceId }: CharacterChatCodexPanelProps) {
    const { t } = useTranslation()
    const { openWindow } = useFloatingWindows()
    const [pickerOpen, setPickerOpen] = useState(false)
    const [pendingRemove, setPendingRemove] = useState<CharacterChatCodexCard | null>(null)
    const [pendingOps, setPendingOps] = useState(0)
    const [error, setError] = useState<string | null>(null)
    const busy = pendingOps > 0
    const existingCardKeys = useMemo(() => new Set([
        ...cards.map((card) => `${card.kind}:${card.cardId}`),
        ...Array.from(participantCardIds, (id) => `character:${id}`),
    ]), [cards, participantCardIds])
    const conflictingCards = cards.filter((card) => card.enabled && participantCardIds.has(card.cardId))
    const contextCards = useMemo(() => [...cards, ...participantCards], [cards, participantCards])
    const sources = useCardSourceStatuses(contextCards.map((card) => ({ card_type: card.kind, card_id: card.cardId })), workspaceId)
    const contextCardDetails = new Map(contextCards.map((card) => {
        const key = `${card.kind}:${card.cardId}`
        const source = sources.statuses.get(key)
        return [key, { type: card.kind, id: card.cardId, name: snapshotDisplayLabel(card.snapshot, card.cardId),
            imageUrl: typeof card.snapshot.image_url === 'string' ? resolveMediaUrl(card.snapshot.image_url) : undefined,
            status: cardSourceStatusText(card.kind, card.snapshot, source, sources.state, t),
            sourceUnavailable: sources.state === 'ready' && source?.available === false }] as const
    }))

    const track = async (operation: Promise<unknown>) => {
        setPendingOps((count) => count + 1)
        setError(null)
        try {
            await operation
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : t('characterChat.codex.updateFailed'))
        } finally {
            setPendingOps((count) => count - 1)
        }
    }

    return (
        <>
            {conflictingCards.length > 0 && (
                <Callout tone="warning" role="alert" data-testid="chat-codex-participant-warning">
                    {t('characterChat.codex.participantWarning', {
                        names: conflictingCards.map((card) => snapshotDisplayLabel(card.snapshot, card.cardId)).join(', '),
                    })}
                </Callout>
            )}
            {error && <Callout tone="danger" role="alert">{error}</Callout>}
            {sources.state === 'failed' && (
                <Callout tone="warning" role="status" action={<Button variant="ghost" size="sm" onClick={sources.recheck}>{t('common.tryAgain')}</Button>}>
                    {t('characterChat.codex.sourceStatus.failed')}
                </Callout>
            )}
            <ReferenceGroup
                label={t('characterChat.codex.title')}
                tone="ember"
                count={cards.length}
                onAdd={() => { setPickerOpen(true); sources.recheck() }}
                addLabel={t('characterChat.codex.addCards')}
                addDisabled={busy}
                isEmpty={cards.length === 0}
                emptyText={t('characterChat.codex.emptyDescription')}
            >
                <div className="flex flex-col gap-1">
                    {cards.map((card) => {
                        const label = snapshotDisplayLabel(card.snapshot, card.cardId)
                        const description = snapshotDisplayDescription(card.snapshot)
                        const arcane = card.kind === 'world'
                        const status = cardSourceStatusText(card.kind, card.snapshot, sources.statuses.get(`${card.kind}:${card.cardId}`), sources.state, t)
                        return (
                            <div key={card.id}>
                                <ReferenceRow
                                    testId="chat-codex-card"
                                    dimmed={!card.enabled}
                                    leading={<Icon icon={KIND_ICONS[card.kind]} size={18} className={arcane ? 'text-arcane-300' : 'text-ember-400'} />}
                                    title={label}
                                    description={description || undefined}
                                    onTitleClick={() => openWindow(cardWindow({ ...snapshotToCardPreview(card.snapshot, card.kind, card.cardId), sourceStatusLabel: status }))}
                                    titleAriaLabel={t('characterChat.codex.open', { label })}
                                    trailing={
                                        <>
                                            <IconButton
                                                label={t('characterChat.codex.removeAria', { label })}
                                                size="sm"
                                                tone="danger"
                                                onClick={() => setPendingRemove(card)}
                                                disabled={busy}
                                            >
                                                <Icon icon={Trash2} size={14} />
                                            </IconButton>
                                            <Switch
                                                checked={card.enabled}
                                                onChange={() => {
                                                    void track(onToggleCard(card, !card.enabled))
                                                }}
                                                size="sm"
                                                disabled={busy || (!card.enabled && participantCardIds.has(card.cardId))}
                                                aria-label={
                                                    card.enabled
                                                        ? t('characterChat.codex.disableAria', { label })
                                                        : t('characterChat.codex.enableAria', { label })
                                                }
                                            />
                                        </>
                                    }
                                />
                                <p className="m-0 px-2 pb-1 font-ui text-caption text-parchment-400" data-testid="chat-codex-source-status">{status}</p>
                            </div>
                        )
                    })}
                </div>
            </ReferenceGroup>

            <CodexCardPickerDrawer
                open={pickerOpen}
                workspaceId={workspaceId}
                busy={busy}
                existingCardKeys={existingCardKeys}
                contextCardDetails={contextCardDetails}
                onClose={() => setPickerOpen(false)}
                onAdd={(selected) => track(onAddCards(selected))}
                copyKeys={{
                    eyebrow: 'characterChat.codex.title',
                    title: 'characterChat.codex.pickerTitle',
                    hint: 'characterChat.codex.pickerHint',
                    searchPlaceholder: 'characterChat.codex.searchPlaceholder',
                    noMatches: 'characterChat.codex.noMatches',
                    inCodex: 'characterChat.codex.alreadyInContext',
                    add: 'characterChat.codex.addToCodex',
                    addCount: 'characterChat.codex.addCount',
                    adding: 'characterChat.codex.adding',
                }}
            />
            <ConfirmDialog
                visible={pendingRemove !== null}
                title={t('characterChat.codex.removeTitle')}
                message={
                    pendingRemove
                        ? t('characterChat.codex.removeMessage', { label: snapshotDisplayLabel(pendingRemove.snapshot, pendingRemove.cardId) })
                        : ''
                }
                confirmLabel={t('characterChat.codex.remove')}
                variant="danger"
                onConfirm={() => {
                    if (pendingRemove) void track(onRemoveCard(pendingRemove))
                    setPendingRemove(null)
                }}
                onCancel={() => setPendingRemove(null)}
            />
        </>
    )
}
