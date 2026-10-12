/**
 * Create or edit a workspace: name, optional description and preferred use
 * (which only picks where the workspace opens). Editing shows a concise
 * content summary from two cheap reads (the library total and the collection
 * list); the save sends the workspace's version (`If-Match`).
 */
import { useEffect, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Layers } from 'lucide-react'
import { apiService } from '@/infrastructure/api'
import type { Workspace, WorkspaceCreate, WorkspacePreferredUse } from '@/shared/types'
import { Button, Callout, Field, Icon, Input, Modal, Select, Textarea } from '@/ui/primitives'
import type { WorkspaceActionResult } from '../useWorkspaceActions'

const NAME_MAX = 160
const DESCRIPTION_MAX = 2000
const USES: readonly WorkspacePreferredUse[] = ['library', 'writing', 'roleplay', 'sandbox']

export interface WorkspaceFormValues extends Required<Pick<WorkspaceCreate, 'name' | 'preferred_use'>> {
    description: string | null
}

interface WorkspaceFormDialogProps {
    open: boolean
    /** The workspace to edit; omitted to create one. */
    workspace?: Workspace | null
    onClose: () => void
    /** Runs the create/update; the dialog shows its error and stays open on failure. */
    onSubmit: (values: WorkspaceFormValues) => Promise<WorkspaceActionResult>
    onSaved?: (workspace: Workspace) => void
    /** Skip the content summary reads (stories). */
    summary?: { cards: number; collections: number } | null
}

function useContentSummary(workspaceId: string | null, preset: WorkspaceFormDialogProps['summary']) {
    const [summary, setSummary] = useState<{ id: string; cards: number; collections: number } | null>(null)
    useEffect(() => {
        if (!workspaceId || preset !== undefined) return
        let cancelled = false
        void Promise.all([
            apiService.listLibraryCards(workspaceId, { limit: 1 }),
            apiService.listCollections(workspaceId),
        ]).then(([cards, collections]) => {
            if (!cancelled) setSummary({ id: workspaceId, cards: cards.total, collections: collections.items.length })
        }).catch(() => {
            // The summary is optional: the form works without it.
        })
        return () => {
            cancelled = true
        }
    }, [preset, workspaceId])
    if (preset !== undefined) return preset
    return summary && summary.id === workspaceId ? summary : null
}

export function WorkspaceFormDialog({ open, workspace = null, onClose, onSubmit, onSaved, summary: presetSummary }: WorkspaceFormDialogProps) {
    const { t } = useTranslation()
    const editing = workspace !== null
    const [name, setName] = useState(workspace?.name ?? '')
    const [description, setDescription] = useState(workspace?.description ?? '')
    const [preferredUse, setPreferredUse] = useState<WorkspacePreferredUse>(workspace?.preferred_use ?? 'library')
    const [touched, setTouched] = useState(false)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const summary = useContentSummary(open && editing ? workspace.id : null, presetSummary)

    // Reset whenever the dialog opens for a (different) workspace.
    const resetKey = open ? `${workspace?.id ?? 'new'}` : null
    const [appliedKey, setAppliedKey] = useState<string | null>(null)
    if (resetKey !== appliedKey) {
        setAppliedKey(resetKey)
        setName(workspace?.name ?? '')
        setDescription(workspace?.description ?? '')
        setPreferredUse(workspace?.preferred_use ?? 'library')
        setTouched(false)
        setSaving(false)
        setError(null)
    }

    const trimmedName = name.trim()
    const nameError = !trimmedName
        ? t('workspaceUi.form.nameRequired')
        : trimmedName.length > NAME_MAX ? t('workspaceUi.form.nameTooLong') : null
    const descriptionError = description.trim().length > DESCRIPTION_MAX ? t('workspaceUi.form.descriptionTooLong') : null
    const invalid = Boolean(nameError || descriptionError)

    const submit = async (event?: FormEvent) => {
        event?.preventDefault()
        setTouched(true)
        if (invalid || saving) return
        setSaving(true)
        setError(null)
        const result = await onSubmit({ name: trimmedName, description: description.trim() || null, preferred_use: preferredUse })
        setSaving(false)
        if (result.ok) {
            onSaved?.(result.workspace)
            onClose()
            return
        }
        setError(t(`workspaceUi.errors.${result.error}`))
    }

    const useOptions = USES.map((use) => ({ value: use, label: t(`workspaceUi.use.${use}`) }))
    const formId = editing ? 'workspace-edit-form' : 'workspace-create-form'

    return (
        <Modal
            open={open}
            onClose={saving ? () => {} : onClose}
            title={editing ? t('workspaceUi.form.editTitle') : t('workspaceUi.form.createTitle')}
            icon={<Icon icon={Layers} size={22} className="text-ember-400" />}
            initialFocus="first-control"
            footer={
                <>
                    <Button variant="ghost" onClick={onClose} disabled={saving}>{t('common.cancel')}</Button>
                    <Button variant="primary" type="submit" form={formId} disabled={saving || (touched && invalid)}>
                        {saving ? t('workspaceUi.form.saving') : editing ? t('workspaceUi.form.save') : t('workspaceUi.form.create')}
                    </Button>
                </>
            }
        >
            <form id={formId} className="flex flex-col gap-4" onSubmit={(event) => void submit(event)} noValidate>
                {error && <Callout tone="danger" role="alert">{error}</Callout>}
                <Field label={t('workspaceUi.form.name')} error={touched ? nameError : null}>
                    <Input
                        value={name}
                        maxLength={NAME_MAX + 20}
                        placeholder={t('workspaceUi.form.namePlaceholder')}
                        onChange={(event) => setName(event.target.value)}
                        autoComplete="off"
                    />
                </Field>
                <Field
                    label={t('workspaceUi.form.description')}
                    helper={t('workspaceUi.form.descriptionHelper')}
                    error={descriptionError}
                >
                    <Textarea value={description} rows={3} onChange={(event) => setDescription(event.target.value)} />
                </Field>
                <Field label={t('workspaceUi.use.label')} helper={t('workspaceUi.use.helper')}>
                    <Select options={useOptions} value={preferredUse} onChange={(value) => setPreferredUse(value as WorkspacePreferredUse)} />
                </Field>
                {editing && (
                    <p className="font-ui text-caption text-fg-muted" role="status">
                        {summary
                            ? t('workspaceUi.form.summary', {
                                cards: t('library.counts.cards', { count: summary.cards }),
                                collections: t('library.counts.collections', { count: summary.collections }),
                            })
                            : t('workspaceUi.form.summaryLoading')}
                    </p>
                )}
            </form>
        </Modal>
    )
}
