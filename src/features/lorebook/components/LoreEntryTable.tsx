import { useTranslation } from 'react-i18next'
import { EyeOff, KeyRound, Plus, ScrollText, Trash2 } from 'lucide-react'
import type { LorebookEntry } from '@/shared'
import { Badge, Button, Card, Icon, IconButton, cx } from '@/ui/primitives'
import { estimateTokens } from '../lorebookTransforms'
import { entryTypeLabelKey } from '../lorebookCopy'

interface LoreEntryTableProps {
    entries: LorebookEntry[]
    selectedId?: string
    onSelect: (entry: LorebookEntry) => void
    onAdd: () => void
    onDelete: (entryId: string) => void
}

export function LoreEntryTable({ entries, selectedId, onSelect, onAdd, onDelete }: LoreEntryTableProps) {
    const { t } = useTranslation()
    return (
        <Card className="rounded-xl">
            <div className="flex items-center justify-between gap-4 border-b border-parchment-50/[.08] px-4 py-3">
                <div>
                    <h3 className="font-display text-xl font-semibold text-parchment-50">{t('lorebookStudio.entryTable.heading')}</h3>
                    <p className="font-ui text-xs text-parchment-300">{t('lorebookStudio.entryTable.subtitle', { count: entries.length })}</p>
                </div>
                <Button size="sm" variant="secondary" iconLeft={<Icon icon={Plus} size={15} />} onClick={onAdd}>
                    {t('lorebookStudio.entryTable.addEntry')}
                </Button>
            </div>
            <div className="max-h-[calc(100vh-280px)] min-h-[360px] overflow-y-auto">
                {entries.length === 0 ? (
                    <button
                        type="button"
                        onClick={onAdd}
                        className="flex min-h-[280px] w-full flex-col items-center justify-center gap-3 px-6 text-center text-parchment-300 transition-colors hover:bg-parchment-50/[.03] hover:text-parchment-100"
                    >
                        <Icon icon={ScrollText} size={34} className="text-arcane-300" />
                        <span className="font-display text-xl text-parchment-50">{t('lorebookStudio.entryTable.empty.title')}</span>
                        <span className="max-w-[34ch] font-narrative text-sm">
                            {t('lorebookStudio.entryTable.empty.description')}
                        </span>
                    </button>
                ) : (
                    <div className="divide-y divide-parchment-50/[.06]">
                        {entries.map((entry) => {
                            const active = entry.id === selectedId
                            return (
                                <div
                                    key={entry.id}
                                    className={cx(
                                        'group grid grid-cols-[minmax(0,1fr)_auto] gap-3 px-4 py-3 transition-colors',
                                        active ? 'bg-ember-500/10' : 'hover:bg-parchment-50/[.035]',
                                    )}
                                >
                                    <button
                                        type="button"
                                        onClick={() => onSelect(entry)}
                                        aria-pressed={active}
                                        className="min-w-0 rounded-md text-left focus-visible:bg-parchment-50/[.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ember-500/60"
                                    >
                                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                                            <span className="truncate font-ui text-sm font-semibold text-parchment-50">
                                                {entry.title || t('lorebookStudio.entryTable.untitled')}
                                            </span>
                                            {!entry.enabled && <Badge tone="neutral">{t('lorebookStudio.entryTable.badges.disabled')}</Badge>}
                                            {entry.constant && <Badge tone="arcane">{t('lorebookStudio.entryTable.badges.constant')}</Badge>}
                                            {entry.isSecret && (
                                                <Badge tone="nsfw" icon={<Icon icon={EyeOff} size={11} />}>
                                                    {t('lorebookStudio.entryTable.badges.secret')}
                                                </Badge>
                                            )}
                                        </div>
                                        <p className="mt-1 line-clamp-2 font-narrative text-sm leading-snug text-parchment-300">
                                            {entry.content || t('lorebookStudio.entryTable.noContent')}
                                        </p>
                                        <div className="mt-2 flex flex-wrap items-center gap-2 font-ui text-meta text-parchment-400">
                                            <span>{t(entryTypeLabelKey(entry.entryType))}</span>
                                            <span>{t('lorebookStudio.entryTable.tokens', { count: estimateTokens(entry.content) })}</span>
                                            {entry.keys.slice(0, 3).map((key) => (
                                                <span key={key} className="inline-flex items-center gap-1 rounded-full bg-ink-900/50 px-2 py-0.5">
                                                    <Icon icon={KeyRound} size={10} />
                                                    {key}
                                                </span>
                                            ))}
                                            {entry.keys.length > 3 && (
                                                <span className="rounded-full bg-ink-900/50 px-2 py-0.5">+{entry.keys.length - 3}</span>
                                            )}
                                        </div>
                                    </button>
                                    <IconButton
                                        size="sm"
                                        tone="danger"
                                        label={t('lorebookStudio.entryTable.deleteEntry', { title: entry.title || t('lorebookStudio.entryTable.entryFallback') })}
                                        onClick={() => onDelete(entry.id)}
                                        className="opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
                                    >
                                        <Icon icon={Trash2} size={14} />
                                    </IconButton>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </Card>
    )
}
