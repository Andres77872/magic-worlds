import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BookOpenText, Plus, Trash2 } from 'lucide-react'
import type { CharacterChatCodexCard } from '@/shared'
import { CodexCardPickerDrawer, KIND_ICONS, snapshotDisplayDescription, snapshotDisplayLabel, type CodexLibraryCardSelection } from '@/features/codex'
import { ConfirmDialog } from '@/ui/components/ConfirmDialog'
import { Badge, Button, Eyebrow, Icon, IconButton, IconTile, Switch, cx } from '@/ui/primitives'

interface CharacterChatCodexPanelProps {
    cards: CharacterChatCodexCard[]
    onAddCards: (cards: CodexLibraryCardSelection[]) => Promise<unknown>
    onToggleCard: (card: CharacterChatCodexCard, enabled: boolean) => Promise<unknown>
    onRemoveCard: (card: CharacterChatCodexCard) => Promise<unknown>
}

export function CharacterChatCodexPanel({ cards, onAddCards, onToggleCard, onRemoveCard }: CharacterChatCodexPanelProps) {
    const { t } = useTranslation()
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
        <section className="flex flex-col gap-3 rounded-lg border border-parchment-50/10 bg-ink-800 px-4 py-3" aria-label={t('characterChat.codex.title')}>
            <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                    <Eyebrow tone="arcane">{t('characterChat.codex.title')}</Eyebrow>
                    {cards.length > 0 && <Badge tone="arcane">{cards.length}</Badge>}
                </div>
                <Button
                    variant="secondary"
                    size="sm"
                    iconLeft={<Icon icon={Plus} size={14} />}
                    onClick={() => setPickerOpen(true)}
                    disabled={busy}
                >
                    {t('characterChat.codex.addCards')}
                </Button>
            </div>

            {cards.length === 0 ? (
                <div className="flex items-start gap-2 rounded-md bg-ink-900/35 px-3 py-3">
                    <span className="mt-0.5 text-parchment-500">
                        <Icon icon={BookOpenText} size={18} />
                    </span>
                    <div className="min-w-0">
                        <p className="m-0 font-ui text-sm font-semibold text-parchment-100">{t('characterChat.codex.emptyTitle')}</p>
                        <p className="m-0 mt-1 font-ui text-xs leading-snug text-parchment-400">{t('characterChat.codex.emptyDescription')}</p>
                    </div>
                </div>
            ) : (
                <div className="flex flex-col gap-1.5">
                    {cards.map((card) => {
                        const label = snapshotDisplayLabel(card.snapshot, card.cardId)
                        const description = snapshotDisplayDescription(card.snapshot)
                        const arcane = card.kind === 'world'
                        return (
                            <div
                                key={card.id}
                                className={cx(
                                    'group flex items-center gap-2.5 rounded-md border border-parchment-50/10 bg-ink-700/60 px-2.5 py-2 transition-colors hover:border-parchment-50/20',
                                    !card.enabled && 'opacity-50',
                                )}
                                data-testid="chat-codex-card"
                            >
                                <IconTile icon={KIND_ICONS[card.kind]} tone={arcane ? 'arcane' : 'ember'} size="sm" />
                                <div className="min-w-0 flex-1">
                                    <span className="block truncate font-ui text-sm font-semibold text-parchment-100">{label}</span>
                                    {description && (
                                        <span className="block truncate font-ui text-xs text-parchment-400">{description}</span>
                                    )}
                                </div>
                                <div className="flex shrink-0 items-center gap-1">
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
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

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
        </section>
    )
}
