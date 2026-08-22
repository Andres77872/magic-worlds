/**
 * CodexPanel — the novel's isolated reference shelf. Cloned snapshots are
 * grouped by kind with enable toggles; entries are added from the card browser
 * or by cloning lorebook entries, and every entry feeds the editor's @mention
 * autocomplete.
 *
 * The chrome is deliberately thin: one Add control instead of a pair repeated in
 * the empty state, a filter so a long codex stays navigable, and a context meter
 * that reports what the last generation actually sent. It is an editor sidebar,
 * not a dashboard.
 */

import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BookMarked, BookOpenText, LayoutGrid, Plus } from 'lucide-react'
import type { StoryCardKind, StoryContextTrace } from '@/shared'
import { EmptyState } from '@/ui/components/common/EmptyState'
import { ConfirmDialog } from '@/ui/components/ConfirmDialog'
import { ReferenceGroup } from '@/ui/components'
import { Badge, Button, Eyebrow, Icon, controlBaseClass, cx } from '@/ui/primitives'
import type { CodexApi, CodexEntry } from '../../hooks/useCodex'
import { CodexContextMeter } from './CodexContextMeter'
import { CodexEntryDrawer } from './CodexEntryDrawer'
import { CodexEntryRow } from './CodexEntryRow'
import { CodexLorebookPickerDrawer } from './CodexLorebookPickerDrawer'

export interface CodexPanelProps {
    codex: CodexApi
    /** Gate mutations behind login; returns false (and opens the modal) when logged out. */
    requireAuth: () => boolean
    /** Opens the card picker (owned by the studio so "Add to codex" works panel-closed). */
    onOpenCardPicker: () => void
    /** Trace from the latest generation; null until one has run. */
    contextTrace?: StoryContextTrace | null
}

export function CodexPanel({ codex, requireAuth, onOpenCardPicker, contextTrace }: CodexPanelProps) {
    const { t } = useTranslation()
    const [lorebookPickerOpen, setLorebookPickerOpen] = useState(false)
    const [editingEntry, setEditingEntry] = useState<CodexEntry | null>(null)
    const [pendingRemove, setPendingRemove] = useState<CodexEntry | null>(null)
    const [filter, setFilter] = useState('')

    const openLorebookPicker = () => requireAuth() && setLorebookPickerOpen(true)

    const query = filter.trim().toLowerCase()
    const groups = query
        ? codex.groups
              .map((group) => ({ ...group, entries: group.entries.filter((entry) => matches(entry, query)) }))
              .filter((group) => group.entries.length > 0)
        : codex.groups
    const noMatches = query.length > 0 && groups.length === 0

    const addMenu = <AddMenu onAddCards={onOpenCardPicker} onAddLorebook={openLorebookPicker} />

    return (
        <aside
            className="flex min-h-0 flex-col border-t border-parchment-50/10 bg-ink-900/35 lg:border-l lg:border-t-0"
            aria-label={t('novelEditor.codex.title')}
            data-testid="codex-panel"
        >
            <div className="flex items-center gap-2 px-3 py-2.5">
                <Eyebrow tone="muted">{t('novelEditor.codex.title')}</Eyebrow>
                <Badge tone="neutral">{codex.entries.length}</Badge>
                <span className="ml-auto">{addMenu}</span>
            </div>

            <div className="px-3 pb-2">
                <CodexContextMeter
                    enabledCount={codex.entries.filter((entry) => entry.enabled).length}
                    totalCount={codex.entries.length}
                    estimatedTokens={contextTrace ? contextTrace.totalEstimatedTokens : null}
                    chapterCount={contextTrace ? contextTrace.chapters.length : null}
                />
            </div>

            {codex.entries.length > 0 && (
                <div className="px-3 pb-2">
                    <input
                        type="search"
                        value={filter}
                        onChange={(event) => setFilter(event.target.value)}
                        placeholder={t('novelEditor.codex.filterPlaceholder')}
                        aria-label={t('novelEditor.codex.filterPlaceholder')}
                        className={cx(controlBaseClass, 'h-8 px-2.5 text-label')}
                        data-testid="codex-filter"
                    />
                </div>
            )}

            <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3 pb-3">
                {codex.entries.length === 0 ? (
                    <EmptyState
                        icon={<Icon icon={BookOpenText} size={32} />}
                        message={t('novelEditor.codex.emptyTitle')}
                        secondaryText={t('novelEditor.codex.emptyDescription')}
                    >
                        <div className="flex justify-center">{addMenu}</div>
                    </EmptyState>
                ) : noMatches ? (
                    <p className="m-0 py-6 text-center font-ui text-xs text-parchment-400" data-testid="codex-no-matches">
                        {t('novelEditor.codex.noMatches')}
                    </p>
                ) : (
                    groups.map((group) => (
                        <ReferenceGroup
                            key={group.kind}
                            flush
                            label={t(group.labelKey)}
                            tone={groupTone(group.kind)}
                            count={group.entries.length}
                        >
                            <div className="flex flex-col gap-1">
                                {group.entries.map((entry) => (
                                    <CodexEntryRow
                                        key={entry.id}
                                        entry={entry}
                                        disabled={codex.busy}
                                        onToggle={(target) => {
                                            if (requireAuth()) void codex.toggleEntry(target)
                                        }}
                                        onEdit={setEditingEntry}
                                        onRemove={setPendingRemove}
                                    />
                                ))}
                            </div>
                        </ReferenceGroup>
                    ))
                )}
            </div>

            <CodexLorebookPickerDrawer
                open={lorebookPickerOpen}
                busy={codex.busy}
                existingEntryIds={codex.existingEntryIds}
                onClose={() => setLorebookPickerOpen(false)}
                onClone={codex.cloneLorebookEntries}
            />
            <CodexEntryDrawer
                entry={editingEntry}
                busy={codex.busy}
                onClose={() => setEditingEntry(null)}
                onSave={async (entry, patch) => {
                    if (!requireAuth()) return
                    await codex.saveSnapshot(entry, patch)
                }}
            />
            <ConfirmDialog
                visible={pendingRemove !== null}
                title={t('novelEditor.codex.removeTitle')}
                message={
                    pendingRemove
                        ? t('novelEditor.codex.removeMessage', { label: pendingRemove.label })
                        : ''
                }
                confirmLabel={t('novelEditor.codex.remove')}
                variant="danger"
                onConfirm={() => {
                    if (pendingRemove && requireAuth()) void codex.removeEntry(pendingRemove)
                    setPendingRemove(null)
                }}
                onCancel={() => setPendingRemove(null)}
            />
        </aside>
    )
}

/**
 * One Add control, two destinations — same menu contract as the studio header's
 * overflow menu: `aria-haspopup="menu"` over a real `role="menu"`, closing on
 * item choice, outside mousedown, and Escape (which hands focus back to the
 * trigger). The Button primitive is not a forwardRef, so the trigger is
 * refocused through the menu root rather than a ref on the component.
 */
function AddMenu({ onAddCards, onAddLorebook }: { onAddCards: () => void; onAddLorebook: () => void }) {
    const { t } = useTranslation()
    const [open, setOpen] = useState(false)
    const rootRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!open) return
        const onPointerDown = (event: MouseEvent) => {
            if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
        }
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return
            event.preventDefault()
            setOpen(false)
            rootRef.current?.querySelector<HTMLButtonElement>('[data-testid="codex-add"]')?.focus()
        }
        document.addEventListener('mousedown', onPointerDown)
        document.addEventListener('keydown', onKeyDown)
        return () => {
            document.removeEventListener('mousedown', onPointerDown)
            document.removeEventListener('keydown', onKeyDown)
        }
    }, [open])

    const item =
        'flex h-8 w-full cursor-pointer items-center gap-2 whitespace-nowrap rounded-xs border-none bg-transparent px-2 text-left font-ui text-label text-parchment-100 transition-colors hover:bg-parchment-50/[.06]'

    // Activating a row unmounts it, so focus has to be handed back explicitly
    // or it falls to <body>.
    const runItem = (action: () => void) => {
        // Button does not forward a ref; the trigger is the only testid'd
        // button inside this root.
        rootRef.current?.querySelector<HTMLButtonElement>('[data-testid="codex-add"]')?.focus()
        setOpen(false)
        action()
    }

    return (
        <div ref={rootRef} className="relative">
            <Button
                variant="secondary"
                size="sm"
                iconLeft={<Icon icon={Plus} size={14} />}
                aria-haspopup="menu"
                aria-expanded={open}
                onClick={() => setOpen((value) => !value)}
                data-testid="codex-add"
            >
                {t('novelEditor.codex.add')}
            </Button>
            {open && (
                <div
                    role="menu"
                    aria-label={t('novelEditor.codex.add')}
                    className="absolute right-0 top-[calc(100%+4px)] z-40 flex min-w-[170px] flex-col rounded-md border border-parchment-50/10 bg-ink-700 p-1 shadow-lg"
                >
                    <button
                        type="button"
                        role="menuitem"
                        className={item}
                        onClick={() => runItem(onAddCards)}
                    >
                        <Icon icon={LayoutGrid} size={14} className="shrink-0 text-parchment-300" />
                        {t('novelEditor.codex.addCards')}
                    </button>
                    <button
                        type="button"
                        role="menuitem"
                        className={item}
                        onClick={() => runItem(onAddLorebook)}
                    >
                        <Icon icon={BookMarked} size={14} className="shrink-0 text-parchment-300" />
                        {t('novelEditor.codex.addLorebook')}
                    </button>
                </div>
            )}
        </div>
    )
}

function matches(entry: CodexEntry, query: string): boolean {
    return entry.label.toLowerCase().includes(query) || entry.description.toLowerCase().includes(query)
}

function groupTone(kind: StoryCardKind): 'ember' | 'arcane' {
    return kind === 'world' || kind === 'lorebook' || kind === 'lorebook_entry' ? 'arcane' : 'ember'
}
