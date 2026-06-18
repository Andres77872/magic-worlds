import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Trash2 } from 'lucide-react'
import type { CharacterChatCodexCard } from '@/shared'
import { useFloatingWindows } from '@/app/hooks'
import { cardWindow } from '@/features/floatingWindows'
import { CodexCardPickerDrawer, KIND_ICONS, snapshotDisplayDescription, snapshotDisplayLabel, snapshotToCardPreview, type CodexLibraryCardSelection } from '@/features/codex'
import { ConfirmDialog, ReferenceGroup, ReferenceRow } from '@/ui/components'
import { Icon, IconButton, IconTile, Switch } from '@/ui/primitives'

interface CharacterChatCodexPanelProps {
    cards: CharacterChatCodexCard[]
    onAddCards: (cards: CodexLibraryCardSelection[]) => Promise<unknown>
    onToggleCard: (card: CharacterChatCodexCard, enabled: boolean) => Promise<unknown>
    onRemoveCard: (card: CharacterChatCodexCard) => Promise<unknown>
}

export function CharacterChatCodexPanel({ cards, onAddCards, onToggleCard, onRemoveCard }: CharacterChatCodexPanelProps) {
    const { t } = useTranslation()
    const { openWindow } = useFloatingWindows()
    const [pickerOpen, setPickerOpen] = useState(false)
    const [pendingRemove, setPendingRemove] = useState<CharacterChatCodexCard | null>(null)
    const [pendingOps, setPendingOps] = useState(0)
    const busy = pendingOps > 0
    const existingCardKeys = useMemo(() => new Set(cards.map((card) => `${card.kind}:${card.cardId}`)), [cards])

    const track = async (operation: Promise<unknown>) => {
        setPendingOps((count) => count + 1)
        try {
            await operation
        } finally {
            setPendingOps((count) => count - 1)
        }
    }

    return (
        <>
            <ReferenceGroup
                label={t('characterChat.codex.title')}
                tone="ember"
                count={cards.length}
                onAdd={() => setPickerOpen(true)}
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
                        return (
                            <ReferenceRow
                                key={card.id}
                                testId="chat-codex-card"
                                dimmed={!card.enabled}
                                leading={<IconTile icon={KIND_ICONS[card.kind]} tone={arcane ? 'arcane' : 'ember'} size="sm" />}
                                title={label}
                                description={description || undefined}
                                onTitleClick={() => openWindow(cardWindow(snapshotToCardPreview(card.snapshot, card.kind, card.cardId)))}
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
                                            disabled={busy}
                                            aria-label={
                                                card.enabled
                                                    ? t('characterChat.codex.disableAria', { label })
                                                    : t('characterChat.codex.enableAria', { label })
                                            }
                                        />
                                    </>
                                }
                            />
                        )
                    })}
                </div>
            </ReferenceGroup>

            <CodexCardPickerDrawer
                open={pickerOpen}
                busy={busy}
                existingCardKeys={existingCardKeys}
                onClose={() => setPickerOpen(false)}
                onAdd={(selected) => track(onAddCards(selected))}
                copyKeys={{
                    eyebrow: 'characterChat.codex.title',
                    title: 'characterChat.codex.pickerTitle',
                    hint: 'characterChat.codex.pickerHint',
                    searchPlaceholder: 'characterChat.codex.searchPlaceholder',
                    noMatches: 'characterChat.codex.noMatches',
                    inCodex: 'characterChat.codex.inCodex',
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
