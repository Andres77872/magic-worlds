import { useMemo, useState } from 'react'
import { ArrowLeft, BookOpen, CheckCircle2, Library, Save, Search, Settings2, Tags } from 'lucide-react'
import { useAuth, useData, useNavigation } from '@/app/hooks'
import { apiService } from '@/infrastructure/api'
import type { Lorebook, LorebookEntry } from '@/shared'
import { Badge, Button, Card, Field, Icon, Input, PageHeader, Select, Textarea } from '@/ui/primitives'
import { TriggersField } from '@/features/creation/common/components'
import {
    blankEntryDraft,
    blankLorebookDraft,
    entryToApiPayload,
    lorebookToApiPayload,
    normalizeLorebook,
    validateLorebookLocally,
} from '../lorebookTransforms'
import { ActivationPreviewPanel } from './ActivationPreviewPanel'
import { LorebookAttachPanel } from './LorebookAttachPanel'
import { LoreEntryEditor } from './LoreEntryEditor'
import { LoreEntryTable } from './LoreEntryTable'
import { LorebookIssueList } from './LorebookIssueList'

function makeId(prefix: string): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return `${prefix}-${crypto.randomUUID()}`
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function newLorebook(): Lorebook {
    const draft = blankLorebookDraft()
    return {
        id: '',
        name: draft.name,
        description: draft.description,
        tags: draft.tags,
        enabled: draft.enabled,
        settings: draft.settings,
        entries: [],
        attachments: [],
        metadata: draft.metadata,
    }
}

function newEntry(lorebookId: string, order: number): LorebookEntry {
    const draft = blankEntryDraft(order)
    return {
        ...draft,
        id: makeId('draft-entry'),
        lorebookId,
    }
}

function upsertLorebook(list: Lorebook[], next: Lorebook): Lorebook[] {
    const index = list.findIndex((item) => item.id === next.id)
    if (index < 0) return [next, ...list]
    return list.map((item) => (item.id === next.id ? next : item))
}

export function LorebookStudio() {
    const { setPage } = useNavigation()
    const { isAuthenticated, openLoginModal } = useAuth()
    const { editingLorebook, setEditingLorebook, lorebooks, setLorebooks } = useData()
    const [draft, setDraft] = useState<Lorebook>(() => editingLorebook ?? newLorebook())
    const [selectedId, setSelectedId] = useState<string | undefined>(() => (editingLorebook?.entries ?? [])[0]?.id)
    const [saving, setSaving] = useState(false)
    const [saveError, setSaveError] = useState<string | null>(null)
    const [savedNotice, setSavedNotice] = useState<string | null>(null)

    const selectedEntry = draft.entries.find((entry) => entry.id === selectedId)
    const issues = useMemo(() => validateLorebookLocally(draft), [draft])
    const errorCount = issues.filter((issue) => issue.severity === 'error').length
    const saved = Boolean(draft.id)

    const patchDraft = (changes: Partial<Lorebook>) => {
        setDraft((current) => ({ ...current, ...changes }))
        setSavedNotice(null)
    }

    const patchSettings = (changes: Partial<Lorebook['settings']>) => {
        setDraft((current) => ({ ...current, settings: { ...current.settings, ...changes } }))
        setSavedNotice(null)
    }

    const addEntry = () => {
        setDraft((current) => {
            const entry = newEntry(current.id, current.entries.length * 10)
            setSelectedId(entry.id)
            return { ...current, entries: [...current.entries, entry] }
        })
        setSavedNotice(null)
    }

    const updateEntry = (entry: LorebookEntry) => {
        setDraft((current) => ({
            ...current,
            entries: current.entries.map((candidate) => (candidate.id === entry.id ? entry : candidate)),
        }))
        setSavedNotice(null)
    }

    const deleteEntry = async (entryId: string) => {
        const currentId = draft.id
        setDraft((current) => {
            const nextEntries = current.entries.filter((entry) => entry.id !== entryId)
            if (selectedId === entryId) setSelectedId(nextEntries[0]?.id)
            return { ...current, entries: nextEntries }
        })
        setSavedNotice(null)
        if (currentId && !entryId.startsWith('draft-entry-')) {
            try {
                await apiService.deleteLorebookEntry(currentId, entryId)
            } catch (error) {
                console.warn('Failed to delete lorebook entry immediately; next save will reconcile:', error)
            }
        }
    }

    const saveLorebook = async () => {
        if (!isAuthenticated) {
            openLoginModal()
            return
        }
        setSaveError(null)
        setSavedNotice(null)
        if (errorCount > 0) {
            setSaveError('Resolve validation errors before saving.')
            return
        }
        setSaving(true)
        try {
            const payload = {
                ...lorebookToApiPayload(draft),
                entries: draft.entries.map(entryToApiPayload),
            }
            const raw = draft.id
                ? await apiService.updateLorebook(draft.id, payload)
                : await apiService.createLorebook(payload)
            const savedLorebook = normalizeLorebook(raw)
            setDraft(savedLorebook)
            setEditingLorebook(savedLorebook)
            setLorebooks(upsertLorebook(lorebooks, savedLorebook))
            setSelectedId((current) => current && savedLorebook.entries.some((entry) => entry.id === current) ? current : savedLorebook.entries[0]?.id)
            setSavedNotice(draft.id ? 'Lorebook updated.' : 'Lorebook created.')
        } catch (error) {
            setSaveError(error instanceof Error ? error.message : 'Failed to save lorebook.')
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-5 py-8 sm:px-8 sm:py-10">
            <PageHeader
                eyebrow="Lorebook Studio"
                title={draft.name.trim() || 'Untitled lorebook'}
                subtitle="Edit entries, keys, budget, attachments, and activation behavior from one workbench."
                icon={<span className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-ember-500/15 text-ember-400"><Icon icon={BookOpen} size={22} /></span>}
                divider
                actions={
                    <>
                        <Button kind="ghost" iconLeft={<Icon icon={ArrowLeft} size={16} />} onClick={() => setPage('gallery-lorebooks')}>
                            Back
                        </Button>
                        <Button kind="primary" iconLeft={<Icon icon={Save} size={16} />} onClick={saveLorebook} disabled={saving}>
                            {saving ? 'Saving...' : 'Save'}
                        </Button>
                    </>
                }
            />

            {saveError && (
                <div className="rounded-lg border border-blood-500/30 bg-blood-500/10 px-4 py-3 font-ui text-sm text-parchment-200" role="alert">
                    {saveError}
                </div>
            )}
            {savedNotice && (
                <div className="rounded-lg border border-verdant-500/25 bg-verdant-500/10 px-4 py-3 font-ui text-sm text-parchment-200" role="status">
                    <span className="inline-flex items-center gap-2">
                        <Icon icon={CheckCircle2} size={16} className="text-verdant-500" />
                        {savedNotice}
                    </span>
                </div>
            )}

            <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)_420px]">
                <aside className="flex flex-col gap-4 xl:sticky xl:top-4 xl:self-start">
                    <Card className="p-4">
                        <div className="mb-4 flex items-center gap-2 font-ui text-sm font-semibold text-parchment-50">
                            <Icon icon={Library} size={16} className="text-ember-400" />
                            Book profile
                        </div>
                        <div className="flex flex-col gap-4">
                            <Field label="Name">
                                <Input value={draft.name} onChange={(event) => patchDraft({ name: event.target.value })} placeholder="Aurelian Lore" />
                            </Field>
                            <Field label="Description">
                                <Textarea
                                    value={draft.description ?? ''}
                                    onChange={(event) => patchDraft({ description: event.target.value })}
                                    placeholder="What this book controls and where it should be used."
                                    className="min-h-[110px]"
                                />
                            </Field>
                            <TriggersField
                                values={draft.tags}
                                onChange={(tags) => patchDraft({ tags })}
                                label="Tags"
                                helper="Library filters for genre, campaign, or source."
                                placeholder="setting, factions, secrets"
                            />
                            <label className="flex items-center justify-between gap-3 rounded-lg border border-parchment-50/[.08] bg-ink-700 px-3 py-2.5">
                                <span className="font-ui text-sm font-semibold text-parchment-50">Enabled</span>
                                <input
                                    type="checkbox"
                                    checked={draft.enabled}
                                    onChange={(event) => patchDraft({ enabled: event.target.checked })}
                                    className="h-4 w-4 accent-ember-500"
                                />
                            </label>
                        </div>
                    </Card>

                    <Card className="p-4">
                        <div className="mb-4 flex items-center gap-2 font-ui text-sm font-semibold text-parchment-50">
                            <Icon icon={Settings2} size={16} className="text-arcane-300" />
                            Defaults
                        </div>
                        <div className="grid gap-4">
                            <Field label="Scan depth">
                                <Input type="number" min={1} value={draft.settings.scanDepth} onChange={(event) => patchSettings({ scanDepth: Number(event.target.value) })} />
                            </Field>
                            <Field label="Token budget">
                                <Input type="number" min={100} value={draft.settings.tokenBudget} onChange={(event) => patchSettings({ tokenBudget: Number(event.target.value) })} />
                            </Field>
                            <Field label="Whole-word matching">
                                <Select value={draft.settings.matchWholeWords ? 'yes' : 'no'} onChange={(event) => patchSettings({ matchWholeWords: event.target.value === 'yes' })}>
                                    <option value="yes">On</option>
                                    <option value="no">Off</option>
                                </Select>
                            </Field>
                            <Field label="Case sensitivity">
                                <Select value={draft.settings.caseSensitive ? 'yes' : 'no'} onChange={(event) => patchSettings({ caseSensitive: event.target.value === 'yes' })}>
                                    <option value="no">Case-insensitive</option>
                                    <option value="yes">Exact case</option>
                                </Select>
                            </Field>
                            <label className="flex items-center justify-between gap-3 rounded-lg border border-parchment-50/[.08] bg-ink-700 px-3 py-2.5">
                                <span className="font-ui text-sm font-semibold text-parchment-50">Recursive scanning</span>
                                <input
                                    type="checkbox"
                                    checked={draft.settings.recursiveScanning}
                                    onChange={(event) => patchSettings({ recursiveScanning: event.target.checked })}
                                    className="h-4 w-4 accent-arcane-500"
                                />
                            </label>
                        </div>
                    </Card>

                    <Card className="p-4">
                        <div className="mb-3 flex items-center gap-2 font-ui text-sm font-semibold text-parchment-50">
                            <Icon icon={Tags} size={16} className="text-ember-400" />
                            Summary
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <Badge tone="ember">{draft.entries.length} entries</Badge>
                            <Badge tone="arcane">{draft.entries.reduce((sum, entry) => sum + entry.keys.length, 0)} keys</Badge>
                            <Badge tone={errorCount > 0 ? 'nsfw' : 'live'}>{issues.length} issues</Badge>
                            <Badge tone={saved ? 'live' : 'neutral'}>{saved ? 'saved' : 'draft'}</Badge>
                        </div>
                    </Card>
                </aside>

                <main className="flex min-w-0 flex-col gap-6">
                    <LoreEntryTable
                        entries={draft.entries}
                        selectedId={selectedId}
                        onSelect={(entry) => setSelectedId(entry.id)}
                        onAdd={addEntry}
                        onDelete={(entryId) => void deleteEntry(entryId)}
                    />
                    <div className="grid gap-6 lg:grid-cols-2">
                        <div className="flex flex-col gap-4 rounded-xl border border-parchment-50/10 bg-ink-800 p-5">
                            <div className="flex items-center gap-2">
                                <Icon icon={Search} size={16} className="text-ember-400" />
                                <h3 className="font-display text-xl font-semibold text-parchment-50">Validation</h3>
                            </div>
                            <LorebookIssueList issues={issues} />
                        </div>
                        <LorebookAttachPanel lorebook={draft} />
                    </div>
                    <ActivationPreviewPanel lorebook={draft} saved={saved} />
                </main>

                <aside className="min-w-0 xl:sticky xl:top-4 xl:self-start">
                    <LoreEntryEditor
                        entry={selectedEntry}
                        onChange={updateEntry}
                        onDelete={(entryId) => void deleteEntry(entryId)}
                    />
                </aside>
            </div>
        </div>
    )
}
