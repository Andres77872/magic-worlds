/**
 * Conversation history for the assistant page: "New chat" on top, then every
 * assistant's threads newest-first, each tagged with the assistant it belongs
 * to (the guide, a card type, or the lorebook studio), filterable by that tag,
 * with a two-step inline delete. Ember marks the open thread (the reader's own
 * place), never arcane.
 */
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MessageSquarePlus, Trash2 } from 'lucide-react'
import type { AssistantConversation } from '@/shared/types/assistant.types'
import { Button, Eyebrow, Icon, IconButton, Select, Tag, cx } from '@/ui/primitives'
import { formatApiDateTime, formatRelativeTime } from '@/utils/time'
import { ASSISTANT_TAGS, ASSISTANT_TAG_ICONS, assistantTag, conversationLabel, type AssistantTag } from '../assistantTags'

export interface AssistantConversationRailProps {
    conversations: AssistantConversation[]
    /** Live names of the cards and lorebooks the conversations edit, by id. */
    targetNames: ReadonlyMap<string, string>
    activeId: number | null
    /** Disables switching/deleting while a reply streams. */
    busy: boolean
    loading: boolean
    onNew: () => void
    onSelect: (id: number) => void
    onDelete: (id: number) => void
}

function isTag(value: string): value is AssistantTag {
    return (ASSISTANT_TAGS as readonly string[]).includes(value)
}

export function AssistantConversationRail({ conversations, targetNames, activeId, busy, loading, onNew, onSelect, onDelete }: AssistantConversationRailProps) {
    const { t } = useTranslation()
    const [confirmId, setConfirmId] = useState<number | null>(null)
    const [filter, setFilter] = useState<AssistantTag | 'all'>('all')

    const present = useMemo(() => {
        const tags = new Set(conversations.map(assistantTag))
        return ASSISTANT_TAGS.filter((tag) => tags.has(tag))
    }, [conversations])
    // A filter whose last conversation was deleted falls back to everything.
    const shown = filter !== 'all' && present.includes(filter) ? filter : 'all'
    const visible = shown === 'all' ? conversations : conversations.filter((conversation) => assistantTag(conversation) === shown)

    return (
        <div className="flex min-h-0 flex-1 flex-col gap-3">
            <Button
                variant="secondary"
                size="sm"
                full
                disabled={busy}
                iconLeft={<Icon icon={MessageSquarePlus} size={16} />}
                onClick={onNew}
            >
                {t('appAssistant.history.newChat')}
            </Button>

            <Eyebrow tone="muted" className="px-1">{t('appAssistant.history.title')}</Eyebrow>

            {present.length > 1 && (
                <Select
                    size="sm"
                    aria-label={t('appAssistant.history.filterLabel')}
                    value={shown}
                    onChange={(value) => setFilter(isTag(value) ? value : 'all')}
                    options={[
                        { value: 'all', label: t('appAssistant.history.all') },
                        ...present.map((tag) => ({
                            value: tag,
                            textValue: t(`appAssistant.kinds.${tag}`),
                            label: (
                                <span className="inline-flex items-center gap-2">
                                    <Icon icon={ASSISTANT_TAG_ICONS[tag]} size={14} />
                                    {t(`appAssistant.kinds.${tag}`)}
                                </span>
                            ),
                        })),
                    ]}
                />
            )}

            <nav aria-label={t('appAssistant.history.title')} className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1 [scrollbar-width:thin]">
                {loading && !conversations.length && (
                    <div className="space-y-2" aria-hidden>
                        <div className="image-shimmer h-11 rounded-md" />
                        <div className="image-shimmer h-11 rounded-md" />
                        <div className="image-shimmer h-11 rounded-md" />
                    </div>
                )}
                {!loading && !conversations.length && (
                    <p className="px-1 py-2 font-ui text-caption text-parchment-400">{t('appAssistant.history.empty')}</p>
                )}
                <ul className="flex flex-col gap-1">
                    {visible.map((conversation) => {
                        const id = conversation.conversation_id
                        const tag = assistantTag(conversation)
                        const kindLabel = t(`appAssistant.kinds.${tag}`)
                        const title = conversationLabel(conversation, targetNames) ?? t('appAssistant.history.untitled')
                        const active = id === activeId
                        return (
                            <li key={id} className={cx('group flex items-center gap-1 rounded-md transition-colors', active ? 'bg-ember-500/15' : 'hover:bg-parchment-50/[.05]')}>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setConfirmId(null)
                                        onSelect(id)
                                    }}
                                    disabled={busy && !active}
                                    aria-current={active ? 'true' : undefined}
                                    className="flex min-w-0 flex-1 items-start gap-2.5 px-2.5 py-2 text-left disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    <Icon icon={ASSISTANT_TAG_ICONS[tag]} size={15} className={cx('mt-0.5 shrink-0', active ? 'text-ember-400' : 'text-parchment-400')} />
                                    <span className="min-w-0 flex-1">
                                        <span className={cx('block truncate font-ui text-label', active ? 'font-semibold text-ember-300' : 'text-parchment-100')}>{title}</span>
                                        <span className="mt-1 flex min-w-0 items-center gap-1.5">
                                            <Tag className="shrink-0">{kindLabel}</Tag>
                                            <span className="truncate font-mono text-micro text-parchment-500" title={formatApiDateTime(conversation.updated_at)}>
                                                {formatRelativeTime(conversation.updated_at)}
                                            </span>
                                        </span>
                                    </span>
                                </button>
                                {confirmId === id ? (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setConfirmId(null)
                                            onDelete(id)
                                        }}
                                        className="mr-1 shrink-0 rounded-sm px-2 py-1.5 font-ui text-caption font-semibold text-blood-500 hover:bg-blood-500/10"
                                    >
                                        {t('appAssistant.history.confirmDelete')}
                                    </button>
                                ) : (
                                    <IconButton
                                        label={t('appAssistant.history.delete', { title })}
                                        size="sm"
                                        tone="danger"
                                        disabled={busy}
                                        className="mr-1 opacity-0 focus-visible:opacity-100 group-hover:opacity-100 pointer-coarse:opacity-100 disabled:opacity-0"
                                        onClick={() => setConfirmId(id)}
                                    >
                                        <Trash2 size={14} />
                                    </IconButton>
                                )}
                            </li>
                        )
                    })}
                </ul>
            </nav>
        </div>
    )
}
