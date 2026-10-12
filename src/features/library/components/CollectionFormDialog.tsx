/**
 * Create or edit a flat collection (name + optional description). Editing
 * sends the collection's version (`If-Match`); the caller reports a conflict
 * after reloading the list, and the form stays open with the user's input.
 */
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { FolderPlus, Pencil } from 'lucide-react'
import type { Collection } from '@/shared/types'
import { Button, Callout, Field, Icon, Input, Modal, Textarea } from '@/ui/primitives'

const NAME_MAX = 160
const DESCRIPTION_MAX = 2000

export interface CollectionFormValues {
    name: string
    description: string | null
}

/** null on success, else the message to show. */
export type CollectionFormSubmit = (values: CollectionFormValues) => Promise<string | null>

interface CollectionFormDialogProps {
    open: boolean
    /** The collection to edit; omitted to create one. */
    collection?: Pick<Collection, 'id' | 'name' | 'description'> | null
    onClose: () => void
    onSubmit: CollectionFormSubmit
}

export function CollectionFormDialog({ open, collection = null, onClose, onSubmit }: CollectionFormDialogProps) {
    const { t } = useTranslation()
    const editing = collection !== null
    const [name, setName] = useState(collection?.name ?? '')
    const [description, setDescription] = useState(collection?.description ?? '')
    const [touched, setTouched] = useState(false)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const resetKey = open ? (collection?.id ?? 'new') : null
    const [appliedKey, setAppliedKey] = useState<string | null>(null)
    if (resetKey !== appliedKey) {
        setAppliedKey(resetKey)
        setName(collection?.name ?? '')
        setDescription(collection?.description ?? '')
        setTouched(false)
        setSaving(false)
        setError(null)
    }

    const trimmedName = name.trim()
    const nameError = !trimmedName
        ? t('library.collectionForm.nameRequired')
        : trimmedName.length > NAME_MAX ? t('library.collectionForm.nameTooLong') : null
    const descriptionError = description.trim().length > DESCRIPTION_MAX ? t('library.collectionForm.descriptionTooLong') : null
    const invalid = Boolean(nameError || descriptionError)
    const formId = editing ? 'collection-edit-form' : 'collection-create-form'

    const submit = async (event: FormEvent) => {
        event.preventDefault()
        setTouched(true)
        if (invalid || saving) return
        setSaving(true)
        setError(null)
        const message = await onSubmit({ name: trimmedName, description: description.trim() || null })
        setSaving(false)
        if (message) setError(message)
        else onClose()
    }

    return (
        <Modal
            open={open}
            onClose={saving ? () => {} : onClose}
            title={editing ? t('library.collectionForm.editTitle') : t('library.collectionForm.createTitle')}
            icon={<Icon icon={editing ? Pencil : FolderPlus} size={22} className="text-ember-400" />}
            initialFocus="first-control"
            footer={
                <>
                    <Button variant="ghost" onClick={onClose} disabled={saving}>{t('common.cancel')}</Button>
                    <Button variant="primary" type="submit" form={formId} disabled={saving || (touched && invalid)}>
                        {saving
                            ? t('library.collectionForm.saving')
                            : editing ? t('library.collectionForm.save') : t('library.collectionForm.create')}
                    </Button>
                </>
            }
        >
            <form id={formId} className="flex flex-col gap-4" onSubmit={(event) => void submit(event)} noValidate>
                {error && <Callout tone="danger" role="alert">{error}</Callout>}
                <Field label={t('library.collectionForm.name')} error={touched ? nameError : null}>
                    <Input
                        value={name}
                        placeholder={t('library.collectionForm.namePlaceholder')}
                        onChange={(event) => setName(event.target.value)}
                        autoComplete="off"
                    />
                </Field>
                <Field
                    label={t('library.collectionForm.description')}
                    helper={t('library.collectionForm.descriptionHelper')}
                    error={descriptionError}
                >
                    <Textarea value={description} rows={3} onChange={(event) => setDescription(event.target.value)} />
                </Field>
            </form>
        </Modal>
    )
}
