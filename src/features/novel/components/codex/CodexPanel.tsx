import { useFeatureFlags } from '@/shared/hooks/useFeatureFlags'
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
 *
 * Workspace R1: while the story's workspace is archived (`codex.readOnly`) the
 * shelf is read-only — entries stay filterable and open for reading, while Add,
 * remove, the enable switches and snapshot edits are disabled.
 */
import { isLorebooksFeatureEnabled } from '@/shared/featureFlags'

import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BookMarked, BookOpenText, LayoutGrid, Plus } from 'lucide-react'
import type { StoryCardKind, StoryContextTrace } from '@/shared'
import { EmptyState } from '@/ui/components/common/EmptyState'
import { ConfirmDialog } from '@/ui/components/ConfirmDialog'
import { ReferenceGroup } from '@/ui/components'
import { Badge, Callout, Button, Eyebrow, Icon, controlBaseClass, cx } from '@/ui/primitives'
import type { CodexApi, CodexEntry } from '../../hooks/useCodex'
import { CodexContextMeter } from './CodexContextMeter'
import { CodexEntryDrawer } from './CodexEntryDrawer'
import { CodexEntryRow } from './CodexEntryRow'
import { CodexLorebookPickerDrawer } from './CodexLorebookPickerDrawer'
import { CodexLibraryReview } from './CodexLibraryReview'
import { useCodexLibraryVersions } from '../../hooks/useCodexLibraryVersions'
import { newerLibraryVersion } from '../../utils/codexLibrary'

export interface CodexPanelProps {
    codex: CodexApi
    /** The story's workspace — the lorebook picker browses it (default: the committed workspace). */
    workspaceId?: string | null
    /** Gate mutations behind login; returns false (and opens the modal) when logged out. */
    requireAuth: () => boolean
    /** Opens the card picker (owned by the studio so "Add to codex" works panel-closed). */
    onOpenCardPicker: () => void
    /** Trace from the latest generation; null until one has run. */
    contextTrace?: StoryContextTrace | null
}

export function CodexPanel({ codex, workspaceId, requireAuth, onOpenCardPicker, contextTrace }: CodexPanelProps) {
    useFeatureFlags()
    const { t } = useTranslation()
    const [lorebookPickerOpen, setLorebookPickerOpen] = useState(false)
    const [editingEntry, setEditingEntry] = useState<CodexEntry | null>(null)
    const [pendingRemove, setPendingRemove] = useState<CodexEntry | null>(null)
    const [operationFailed,setOperationFailed]=useState(false)
    const [filter, setFilter] = useState('')
    const [reviewing, setReviewing] = useState<string | null>(null)
    const libraryVersions = useCodexLibraryVersions(codex.storyId, codex.contextRevision, workspaceId)
    const libraryVersion = (entry: CodexEntry) => libraryVersions.changed.has(entry.id) ? 'changed' as const : newerLibraryVersion(entry.ref.snapshot, libraryVersions.versions.get(entry.id))
    const reviewed = reviewing ? codex.resolveEntry(reviewing) ?? null : null
    const reviewedScope = codex.referenceEntries.find((row) => row.id === reviewing)

    const readOnly = codex.readOnly
    const blocked=readOnly||Boolean(codex.pending)
    // A remove confirmation left open when the shelf turns read-only goes with it.
    if (readOnly && pendingRemove) setPendingRemove(null)
    const openLorebookPicker = () => isLorebooksFeatureEnabled() && !blocked && requireAuth() && setLorebookPickerOpen(true)

    const query = filter.trim().toLowerCase()
    const groups = query
        ? codex.groups
              .map((group) => ({ ...group, entries: group.entries.filter((entry) => matches(entry, query)) }))
              .filter((group) => group.entries.length > 0)
        : codex.groups
    const noMatches = query.length > 0 && groups.length === 0

    const addMenu = <AddMenu disabled={blocked||codex.busy} onAddCards={onOpenCardPicker} onAddLorebook={openLorebookPicker} />

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
                    sceneCount={contextTrace ? contextTrace.scenes.length : null}
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
                {groups.length === 0&&!query ? (
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
                                        disabled={codex.busy || blocked}
                                        onToggle={(target) => {
                                            if (!readOnly && requireAuth()) void codex.toggleEntry(target).catch(()=>setOperationFailed(true))
                                        }}
                                        onEdit={setEditingEntry}
                                        onRemove={setPendingRemove}
                                        libraryVersion={libraryVersion(entry)}
                                        onReviewLibrary={(target) => setReviewing(target.id)}
                                    />
                                ))}
                            </div>
                        </ReferenceGroup>
                    ))
                )}
            </div>

            {codex.pending&&<Callout tone="warning" role="status" className="m-3">
                <p>{t('novelEditor.structure.codexPending')}</p>
                <Button variant="secondary" size="sm" disabled={codex.busy||!codex.canRetry} onClick={()=>void codex.retry().catch(()=>setOperationFailed(true))}>{t('novelEditor.save.retry')}</Button>
                {codex.storageFailed&&<p>{t('novelEditor.recovery.storageFailed')}</p>}
            </Callout>}
            {(operationFailed||codex.error)&&<Callout tone="warning" role="alert" className="m-3">{t('novelEditor.structure.'+(codex.error??'failed'))}</Callout>}
            {codex.removedEntries.length>0&&<section className="space-y-2 border-t border-line p-3">
                <h3 className="font-ui text-label text-parchment-300">{t('novelEditor.structure.removed')}</h3>
                <p className="text-caption text-parchment-400">{t('novelEditor.structure.removedHelp')}</p>
                {codex.removedEntries.map((entry)=><div key={entry.id} className="flex flex-wrap items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={()=>setEditingEntry(entry)}>{entry.label}</Button>
                    <Button variant="secondary" size="sm" disabled={blocked||codex.busy} onClick={()=>{if(requireAuth())void codex.restoreEntry(entry).catch(()=>setOperationFailed(true))}}>{t('novelEditor.structure.restoreEntry',{title:entry.label})}</Button>
                </div>)}
            </section>}
            {isLorebooksFeatureEnabled() && <CodexLorebookPickerDrawer
                open={lorebookPickerOpen}
                workspaceId={workspaceId}
                busy={codex.busy}
                readOnly={blocked}
                existingEntryIds={codex.existingEntryIds}
                onClose={() => setLorebookPickerOpen(false)}
                onClone={codex.cloneLorebookEntries}
            />}
            <CodexEntryDrawer
                workspaceId={workspaceId}
                entry={editingEntry?(codex.resolveEntry(editingEntry.id)??editingEntry):null}
                busy={codex.busy||Boolean(codex.pending)}
                readOnly={readOnly||Boolean(editingEntry?.ref.removedAt)}
                onClose={() => setEditingEntry(null)}
                onSave={async (entry, patch) => {
                    if (readOnly || !requireAuth()) return
                    await codex.saveSnapshot(entry, patch)
                }}
            />
            <CodexLibraryReview
                entry={reviewed && !reviewed.ref.removedAt ? reviewed : null}
                scope={{ scope: reviewedScope?.scope ?? 'novel', title: reviewedScope?.scopeLabel }}
                workspaceId={workspaceId}
                busy={codex.busy || Boolean(codex.pending)}
                readOnly={readOnly}
                onClose={() => setReviewing(null)}
                onApply={async (entry, sourceVersionId, take) => {
                    if (readOnly || !requireAuth()) return
                    await codex.refreshEntry(entry, sourceVersionId, take)
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
                    if(pendingRemove&&!readOnly&&requireAuth())void codex.removeEntry(pendingRemove).then(()=>setPendingRemove(null)).catch(()=>setOperationFailed(true))
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
function AddMenu({ disabled, onAddCards, onAddLorebook }: { disabled: boolean; onAddCards: () => void; onAddLorebook: () => void }) {
    useFeatureFlags()
    const { t } = useTranslation()
    const [open, setOpen] = useState(false)
    const rootRef = useRef<HTMLDivElement>(null)
    // A menu left open when the shelf turns read-only closes with it.
    if (disabled && open) setOpen(false)

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
                disabled={disabled}
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
                    {isLorebooksFeatureEnabled() && <button
                        type="button"
                        role="menuitem"
                        className={item}
                        onClick={() => runItem(onAddLorebook)}
                    >
                        <Icon icon={BookMarked} size={14} className="shrink-0 text-parchment-300" />
                        {t('novelEditor.codex.addLorebook')}
                    </button>}
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
