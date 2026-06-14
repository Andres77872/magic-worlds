import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, BookOpen, Library, Save, Search, Settings2, Tags } from 'lucide-react'
import { useAuth, useData, useNavigation } from '@/app/hooks'
import { apiService } from '@/infrastructure/api'
import type { Lorebook, LorebookEntry } from '@/shared'
import { ConfirmDialog } from '@/ui/components'
import { Badge, Button, Card, Field, Icon, Input, PageHeader, SwitchRow, Textarea, Toast } from '@/ui/primitives'
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
import { LorebookAssistantChatbot } from './LorebookAssistantChatbot'
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
    const { t } = useTranslation()
    const { setPage } = useNavigation()
    const { isAuthenticated, openLoginModal } = useAuth()
    const { editingLorebook, setEditingLorebook, lorebooks, setLorebooks } = useData()
    const [draft, setDraft] = useState<Lorebook>(() => editingLorebook ?? newLorebook())
    const [selectedId, setSelectedId] = useState<string | undefined>(() => (editingLorebook?.entries ?? [])[0]?.id)
    const [saving, setSaving] = useState(false)
    const [saveError, setSaveError] = useState<string | null>(null)
    const [notice, setNotice] = useState<string | null>(null)
    const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
    const editorRef = useRef<HTMLElement>(null)

    const selectedEntry = draft.entries.find((entry) => entry.id === selectedId)
    const pendingDeleteEntry = draft.entries.find((entry) => entry.id === pendingDeleteId)
    const issues = useMemo(() => validateLorebookLocally(draft), [draft])
    const errorCount = issues.filter((issue) => issue.severity === 'error').length
    const saved = Boolean(draft.id)

    const patchDraft = (changes: Partial<Lorebook>) => {
        setDraft((current) => ({ ...current, ...changes }))
    }

    const patchSettings = (changes: Partial<Lorebook['settings']>) => {
        setDraft((current) => ({ ...current, settings: { ...current.settings, ...changes } }))
    }

    // Below the xl breakpoint the editor pane stacks far beneath the entry
    // table, so bring it into view when an entry is picked.
    const focusEditor = () => {
        if (typeof window === 'undefined' || window.matchMedia('(min-width: 1280px)').matches) return
        requestAnimationFrame(() => editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
    }

    const selectEntry = (entryId: string) => {
        setSelectedId(entryId)
        focusEditor()
    }

    const addEntry = () => {
        setDraft((current) => {
            const entry = newEntry(current.id, current.entries.length * 10)
            setSelectedId(entry.id)
            return { ...current, entries: [...current.entries, entry] }
        })
        focusEditor()
    }

    const updateEntry = (entry: LorebookEntry) => {
        setDraft((current) => ({
            ...current,
            entries: current.entries.map((candidate) => (candidate.id === entry.id ? entry : candidate)),
        }))
    }

    const deleteEntry = async (entryId: string) => {
        const currentId = draft.id
        setDraft((current) => {
            const nextEntries = current.entries.filter((entry) => entry.id !== entryId)
            if (selectedId === entryId) setSelectedId(nextEntries[0]?.id)
            return { ...current, entries: nextEntries }
        })
        if (currentId && !entryId.startsWith('draft-entry-')) {
            try {
                await apiService.deleteLorebookEntry(currentId, entryId)
            } catch (error) {
                console.warn('Failed to delete lorebook entry immediately; next save will reconcile:', error)
            }
        }
    }

    const requestEntryDelete = (entryId: string) => {
        const entry = draft.entries.find((candidate) => candidate.id === entryId)
        if (!entry) return
        const blank = !entry.title.trim() && !entry.content.trim() && entry.keys.length === 0
        if (blank) {
            void deleteEntry(entryId)
            return
        }
        setPendingDeleteId(entryId)
    }

    const saveLorebook = async () => {
        if (!isAuthenticated) {
            openLoginModal()
            return
        }
        setSaveError(null)
        if (errorCount > 0) {
            setSaveError(t('lorebookStudio.shell.errors.resolveValidation'))
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
            setNotice(draft.id ? t('lorebookStudio.shell.notices.updated') : t('lorebookStudio.shell.notices.created'))
        } catch (error) {
            setSaveError(error instanceof Error ? error.message : t('lorebookStudio.shell.errors.saveFailed'))
        } finally {
            setSaving(false)
        }
    }

    const applyAssistantLorebook = (lorebook: Lorebook) => {
        const next = normalizeLorebook(lorebook)
        setDraft(next)
        setEditingLorebook(next)
        setLorebooks(upsertLorebook(lorebooks, next))
        setSelectedId((current) => current && next.entries.some((entry) => entry.id === current) ? current : next.entries[0]?.id)
        setSaveError(null)
        setNotice(next.id === draft.id ? t('lorebookStudio.shell.notices.updatedByAssistant') : t('lorebookStudio.shell.notices.createdByAssistant'))
    }

    return (
        <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-5 py-8 sm:px-8 sm:py-10">
            <PageHeader
                eyebrow={t('lorebookStudio.shell.header.eyebrow')}
                title={draft.name.trim() || t('lorebookStudio.shell.header.untitled')}
                subtitle={t('lorebookStudio.shell.header.subtitle')}
                icon={<span className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-ember-500/15 text-ember-400"><Icon icon={BookOpen} size={22} /></span>}
                divider
                actions={
                    <>
                        <Button kind="ghost" iconLeft={<Icon icon={ArrowLeft} size={16} />} onClick={() => setPage('gallery-lorebooks')}>
                            {t('common.back')}
                        </Button>
                        <Button kind="primary" iconLeft={<Icon icon={Save} size={16} />} onClick={saveLorebook} disabled={saving}>
                            {saving ? t('common.saving') : t('common.save')}
                        </Button>
                    </>
                }
            />

            {saveError && (
                <div className="rounded-lg border border-blood-500/30 bg-blood-500/10 px-4 py-3 font-ui text-sm text-parchment-200" role="alert">
                    {saveError}
                </div>
            )}

            <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)_420px]">
                <aside className="flex flex-col gap-4 xl:sticky xl:top-4 xl:self-start">
                    <Card className="p-4">
                        <div className="mb-4 flex items-center gap-2 font-ui text-sm font-semibold text-parchment-50">
                            <Icon icon={Library} size={16} className="text-ember-400" />
                            {t('lorebookStudio.shell.sections.profile')}
                        </div>
                        <div className="flex flex-col gap-4">
                            <Field label={t('lorebookStudio.shell.fields.name.label')}>
                                <Input value={draft.name} onChange={(event) => patchDraft({ name: event.target.value })} placeholder={t('lorebookStudio.shell.fields.name.placeholder')} />
                            </Field>
                            <Field label={t('lorebookStudio.shell.fields.description.label')}>
                                <Textarea
                                    value={draft.description ?? ''}
                                    onChange={(event) => patchDraft({ description: event.target.value })}
                                    placeholder={t('lorebookStudio.shell.fields.description.placeholder')}
                                    className="min-h-[110px]"
                                />
                            </Field>
                            <TriggersField
                                values={draft.tags}
                                onChange={(tags) => patchDraft({ tags })}
                                label={t('lorebookStudio.shell.fields.tags.label')}
                                helper={t('lorebookStudio.shell.fields.tags.helper')}
                                placeholder={t('lorebookStudio.shell.fields.tags.placeholder')}
                            />
                            <SwitchRow
                                label={t('lorebookStudio.shell.toggles.enabled.label')}
                                description={t('lorebookStudio.shell.toggles.enabled.description')}
                                checked={draft.enabled}
                                onChange={(enabled) => patchDraft({ enabled })}
                            />
                        </div>
                    </Card>

                    <Card className="p-4">
                        <div className="mb-4 flex items-center gap-2 font-ui text-sm font-semibold text-parchment-50">
                            <Icon icon={Settings2} size={16} className="text-arcane-300" />
                            {t('lorebookStudio.shell.sections.defaults')}
                        </div>
                        <div className="grid gap-4">
                            <Field label={t('lorebookStudio.shell.fields.scanDepth.label')}>
                                <Input type="number" min={1} value={draft.settings.scanDepth} onChange={(event) => patchSettings({ scanDepth: Number(event.target.value) })} />
                            </Field>
                            <Field label={t('lorebookStudio.shell.fields.tokenBudget.label')}>
                                <Input type="number" min={100} value={draft.settings.tokenBudget} onChange={(event) => patchSettings({ tokenBudget: Number(event.target.value) })} />
                            </Field>
                            <SwitchRow
                                label={t('lorebookStudio.shell.toggles.wholeWord.label')}
                                description={t('lorebookStudio.shell.toggles.wholeWord.description')}
                                checked={draft.settings.matchWholeWords}
                                onChange={(matchWholeWords) => patchSettings({ matchWholeWords })}
                            />
                            <SwitchRow
                                label={t('lorebookStudio.shell.toggles.caseSensitive.label')}
                                description={t('lorebookStudio.shell.toggles.caseSensitive.description')}
                                checked={draft.settings.caseSensitive}
                                onChange={(caseSensitive) => patchSettings({ caseSensitive })}
                            />
                            <SwitchRow
                                label={t('lorebookStudio.shell.toggles.recursive.label')}
                                description={t('lorebookStudio.shell.toggles.recursive.description')}
                                checked={draft.settings.recursiveScanning}
                                onChange={(recursiveScanning) => patchSettings({ recursiveScanning })}
                            />
                        </div>
                    </Card>

                    <Card className="p-4">
                        <div className="mb-3 flex items-center gap-2 font-ui text-sm font-semibold text-parchment-50">
                            <Icon icon={Tags} size={16} className="text-ember-400" />
                            {t('lorebookStudio.shell.sections.summary')}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <Badge tone="ember">{t('lorebookStudio.shell.summary.entries', { count: draft.entries.length })}</Badge>
                            <Badge tone="arcane">{t('lorebookStudio.shell.summary.keys', { count: draft.entries.reduce((sum, entry) => sum + entry.keys.length, 0) })}</Badge>
                            <Badge tone={errorCount > 0 ? 'danger' : 'live'}>{t('lorebookStudio.shell.summary.issues', { count: issues.length })}</Badge>
                            <Badge tone={saved ? 'live' : 'neutral'}>{saved ? t('lorebookStudio.shell.summary.saved') : t('lorebookStudio.shell.summary.draft')}</Badge>
                        </div>
                    </Card>
                </aside>

                <main className="flex min-w-0 flex-col gap-6">
                    <LoreEntryTable
                        entries={draft.entries}
                        selectedId={selectedId}
                        onSelect={(entry) => selectEntry(entry.id)}
                        onAdd={addEntry}
                        onDelete={requestEntryDelete}
                    />
                    <div className="grid gap-6 lg:grid-cols-2">
                        <div className="flex flex-col gap-4 rounded-xl border border-parchment-50/10 bg-ink-800 p-5">
                            <div className="flex items-center gap-2">
                                <Icon icon={Search} size={16} className="text-ember-400" />
                                <h3 className="font-display text-xl font-semibold text-parchment-50">{t('lorebookStudio.shell.sections.validation')}</h3>
                            </div>
                            <LorebookIssueList issues={issues} />
                        </div>
                        <LorebookAttachPanel lorebook={draft} />
                    </div>
                    <ActivationPreviewPanel lorebook={draft} saved={saved} />
                </main>

                <aside ref={editorRef} className="min-w-0 scroll-mt-4 xl:sticky xl:top-4 xl:self-start">
                    <LoreEntryEditor
                        entry={selectedEntry}
                        onChange={updateEntry}
                        onDelete={requestEntryDelete}
                    />
                </aside>
            </div>
            <ConfirmDialog
                visible={pendingDeleteId !== null}
                title={t('lorebookStudio.shell.delete.title')}
                message={t('lorebookStudio.shell.delete.message', {
                    title: (pendingDeleteEntry?.title.trim() || t('lorebookStudio.shell.delete.untitledEntry')).slice(0, 80),
                    tail: saved ? t('lorebookStudio.shell.delete.tailSaved') : t('lorebookStudio.shell.delete.tailUnsaved'),
                })}
                confirmLabel={t('common.delete')}
                cancelLabel={t('lorebookStudio.shell.delete.keep')}
                variant="danger"
                onConfirm={() => {
                    const entryId = pendingDeleteId
                    setPendingDeleteId(null)
                    if (entryId) void deleteEntry(entryId)
                }}
                onCancel={() => setPendingDeleteId(null)}
            />
            <Toast
                open={Boolean(notice)}
                tone="success"
                title={notice ?? ''}
                autoCloseMs={3200}
                onClose={() => setNotice(null)}
            />
            <LorebookAssistantChatbot
                lorebookId={draft.id || null}
                title={draft.name.trim() || t('lorebookStudio.shell.header.untitled')}
                currentLorebook={draft as unknown as Record<string, unknown>}
                onLorebook={applyAssistantLorebook}
                isAuthenticated={isAuthenticated}
                onAuthRequired={openLoginModal}
            />
        </div>
    )
}
