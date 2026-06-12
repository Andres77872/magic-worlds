import { EyeOff, KeyRound, Plus, ScrollText, Trash2 } from 'lucide-react'
import type { LorebookEntry } from '@/shared'
import { Badge, Button, Card, Icon, IconButton, cx } from '@/ui/primitives'
import { estimateTokens } from '../lorebookTransforms'
import { entryTypeLabel } from '../lorebookCopy'

interface LoreEntryTableProps {
    entries: LorebookEntry[]
    selectedId?: string
    onSelect: (entry: LorebookEntry) => void
    onAdd: () => void
    onDelete: (entryId: string) => void
}

export function LoreEntryTable({ entries, selectedId, onSelect, onAdd, onDelete }: LoreEntryTableProps) {
    return (
        <Card className="rounded-xl">
            <div className="flex items-center justify-between gap-4 border-b border-parchment-50/[.08] px-4 py-3">
                <div>
                    <h3 className="font-display text-xl font-semibold text-parchment-50">Entries</h3>
                    <p className="font-ui text-xs text-parchment-300">{entries.length} stored facts and activation rules</p>
                </div>
                <Button size="sm" kind="secondary" iconLeft={<Icon icon={Plus} size={15} />} onClick={onAdd}>
                    Entry
                </Button>
            </div>
            <div className="max-h-[calc(100vh-280px)] min-h-[360px] overflow-y-auto">
                {entries.length === 0 ? (
                    <button
                        type="button"
                        onClick={onAdd}
                        className="flex min-h-[280px] w-full flex-col items-center justify-center gap-3 px-6 text-center text-parchment-300 transition-colors hover:bg-parchment-50/[.03] hover:text-parchment-100"
                    >
                        <Icon icon={ScrollText} size={34} className="text-ember-400" />
                        <span className="font-display text-xl text-parchment-50">Start the first entry</span>
                        <span className="max-w-[34ch] font-narrative text-sm">
                            Entries are the facts the prompt retrieval engine can activate from chat text.
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
                                                {entry.title || 'Untitled entry'}
                                            </span>
                                            {!entry.enabled && <Badge tone="neutral">disabled</Badge>}
                                            {entry.constant && <Badge tone="arcane">constant</Badge>}
                                            {entry.isSecret && (
                                                <Badge tone="nsfw" icon={<Icon icon={EyeOff} size={11} />}>
                                                    secret
                                                </Badge>
                                            )}
                                        </div>
                                        <p className="mt-1 line-clamp-2 font-narrative text-sm leading-snug text-parchment-300">
                                            {entry.content || 'No prompt content yet.'}
                                        </p>
                                        <div className="mt-2 flex flex-wrap items-center gap-2 font-ui text-[11px] text-parchment-400">
                                            <span>{entryTypeLabel(entry.entryType)}</span>
                                            <span>{estimateTokens(entry.content)} tokens</span>
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
                                        label={`Delete ${entry.title || 'entry'}`}
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
