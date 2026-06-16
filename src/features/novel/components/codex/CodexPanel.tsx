/**
 * CodexPanel — the novel's isolated reference shelf. Cloned snapshots are
 * grouped by kind with enable toggles; entries are added from the card
 * browser or by cloning lorebook entries, and every entry feeds the editor's
 * @mention autocomplete.
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BookMarked, BookOpenText, Plus } from 'lucide-react'
import type { StoryCardKind } from '@/shared'
import { EmptyState } from '@/ui/components/common/EmptyState'
import { ConfirmDialog } from '@/ui/components/ConfirmDialog'
import { Badge, Button, Eyebrow, Icon } from '@/ui/primitives'
import type { CodexApi, CodexEntry } from '../../hooks/useCodex'
import { CodexCardPickerDrawer } from './CodexCardPickerDrawer'
import { CodexEntryDrawer } from './CodexEntryDrawer'
import { CodexEntryRow } from './CodexEntryRow'
import { CodexLorebookPickerDrawer } from './CodexLorebookPickerDrawer'

interface CodexPanelProps {
    codex: CodexApi
    /** Gate mutations behind login; returns false (and opens the modal) when logged out. */
    requireAuth: () => boolean
}

export function CodexPanel({ codex, requireAuth }: CodexPanelProps) {
    const { t } = useTranslation()
    const [cardPickerOpen, setCardPickerOpen] = useState(false)
    const [lorebookPickerOpen, setLorebookPickerOpen] = useState(false)
    const [editingEntry, setEditingEntry] = useState<CodexEntry | null>(null)
    const [pendingRemove, setPendingRemove] = useState<CodexEntry | null>(null)

    const openCardPicker = () => requireAuth() && setCardPickerOpen(true)
    const openLorebookPicker = () => requireAuth() && setLorebookPickerOpen(true)

    const addButtons = (
        <>
            <Button variant="secondary" size="sm" iconLeft={<Icon icon={Plus} size={14} />} onClick={openCardPicker}>
                {t('novelEditor.codex.addCards')}
            </Button>
            <Button variant="secondary" size="sm" iconLeft={<Icon icon={BookMarked} size={14} />} onClick={openLorebookPicker}>
                {t('novelEditor.codex.addLorebook')}
            </Button>
        </>
    )

    return (
        <aside
            className="flex min-h-0 flex-col border-t border-parchment-50/10 bg-ink-900/35 lg:border-l lg:border-t-0"
            aria-label={t('novelEditor.codex.title')}
            data-testid="codex-panel"
        >
            <div className="flex items-center justify-between gap-2 px-4 pb-2 pt-4">
                <h2 className="m-0 flex items-center gap-2 font-ui text-sm font-semibold text-parchment-100">
                    {t('novelEditor.codex.title')}
                    {codex.entries.length > 0 && <Badge tone="ember">{codex.entries.length}</Badge>}
                </h2>
                <div className="flex gap-1.5">{addButtons}</div>
            </div>
            <p className="m-0 px-4 pb-3 font-ui text-xs text-parchment-400">
                {t('novelEditor.codex.subtitle')}
            </p>

            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4">
                {codex.entries.length === 0 ? (
                    <EmptyState
                        icon={<Icon icon={BookOpenText} size={32} />}
                        message={t('novelEditor.codex.emptyTitle')}
                        secondaryText={t('novelEditor.codex.emptyDescription')}
                    >
                        <div className="flex flex-wrap justify-center gap-2">{addButtons}</div>
                    </EmptyState>
                ) : (
                    codex.groups.map((group) => (
                        <section key={group.kind} aria-label={t(group.labelKey)}>
                            <div className="mb-2 flex items-center gap-2">
                                <Eyebrow tone={groupTone(group.kind)}>{t(group.labelKey)}</Eyebrow>
                                <span className="font-ui text-xs text-parchment-500">{group.entries.length}</span>
                            </div>
                            <div className="flex flex-col gap-1.5">
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
                        </section>
                    ))
                )}
            </div>

            <CodexCardPickerDrawer
                open={cardPickerOpen}
                busy={codex.busy}
                existingCardKeys={codex.existingCardKeys}
                onClose={() => setCardPickerOpen(false)}
                onAdd={codex.addCards}
            />
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

function groupTone(kind: StoryCardKind): 'ember' | 'arcane' {
    return kind === 'world' || kind === 'lorebook' || kind === 'lorebook_entry' ? 'arcane' : 'ember'
}
