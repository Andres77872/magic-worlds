/**
 * Global presets module (R1-FE-06, 05 §8.12, D12, D22): the root list of
 * `is_global` presets (EP-5 `GET /admin/voice-presets/global`, legacy rows
 * included), V2 create and edit in a drawer, and delete behind a confirm.
 * Deleting never breaks a card: presets are copied by value.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Bookmark, Plus, Trash2 } from 'lucide-react'
import { apiService } from '@/infrastructure/api'
import type { AdminGlobalPresetList, AdminGlobalPresetRow } from '@/shared'
import { ConfirmDialog } from '@/ui/components/ConfirmDialog'
import { Button, Callout, Icon } from '@/ui/primitives'
import type { GlobalPresetV2Row } from '../../globalPresetRules'
import { useAbortableLoad } from '../../hooks/useAbortableLoad'
import { ConsoleSection } from '../shell/ConsoleSection'
import { useLoadErrorMessage, useVoiceConsole } from '../shell/VoiceConsoleContext'
import { GlobalPresetEditorDrawer } from './GlobalPresetEditorDrawer'
import { GlobalPresetsTable } from './GlobalPresetsTable'

const loadPresets = () => apiService.listAdminGlobalPresets()

type Editing = { mode: 'create' } | { mode: 'edit'; row: GlobalPresetV2Row }

export function GlobalPresetsModule() {
    const { t } = useTranslation()
    const { notify, reportError } = useVoiceConsole()
    const presets = useAbortableLoad<AdminGlobalPresetList>(loadPresets, 'globalPresets')
    const errorMessage = useLoadErrorMessage(presets.error)
    const [editing, setEditing] = useState<Editing | null>(null)
    const [deleting, setDeleting] = useState<GlobalPresetV2Row | null>(null)
    const [deleteBusy, setDeleteBusy] = useState(false)
    const [deleteError, setDeleteError] = useState<string | null>(null)
    const rows = presets.data?.items ?? []

    const upsert = (row: AdminGlobalPresetRow | null | undefined) => {
        setEditing(null)
        // A write without a row in its answer: read the list again.
        if (!row?.preset_id) {
            presets.reload()
            return
        }
        presets.setData((previous) => {
            const items = previous?.items ?? []
            const index = items.findIndex((item) => item.preset_id === row.preset_id)
            return { items: index >= 0 ? items.map((item, position) => (position === index ? row : item)) : [row, ...items] }
        })
    }

    const closeDelete = () => {
        if (deleteBusy) return
        setDeleting(null)
        setDeleteError(null)
    }

    const confirmDelete = async () => {
        if (!deleting) return
        setDeleteBusy(true)
        setDeleteError(null)
        try {
            await apiService.deleteAdminGlobalPreset(deleting.preset_id)
            const removed = deleting.preset_id
            presets.setData((previous) => (previous ? { items: previous.items.filter((item) => item.preset_id !== removed) } : previous))
            notify(t('admin.voices.globalPresets.toasts.deleted'))
            setDeleting(null)
        } catch (error) {
            setDeleteError(reportError(error))
        } finally {
            setDeleteBusy(false)
        }
    }

    return (
        <ConsoleSection
            icon={Bookmark}
            title={t('admin.voices.globalPresets.title')}
            description={t('admin.voices.globalPresets.description')}
            right={
                <Button variant="primary" size="sm" iconLeft={<Icon icon={Plus} size={15} />} onClick={() => setEditing({ mode: 'create' })}>
                    {t('admin.voices.globalPresets.create')}
                </Button>
            }
        >
            {errorMessage && (
                <Callout tone="danger" role="alert" action={<Button variant="secondary" size="sm" onClick={presets.reload}>{t('admin.voices.common.retry')}</Button>}>
                    {errorMessage}
                </Callout>
            )}
            {presets.loading && !presets.data && <p role="status" className="font-ui text-sm text-fg-muted">{t('admin.voices.common.loading')}</p>}
            {presets.data && rows.length === 0 && <p className="font-ui text-sm text-fg-muted">{t('admin.voices.globalPresets.empty')}</p>}
            {rows.length > 0 && (
                <GlobalPresetsTable
                    rows={rows}
                    onEdit={(row) => setEditing({ mode: 'edit', row })}
                    onDelete={(row) => {
                        setDeleteError(null)
                        setDeleting(row)
                    }}
                />
            )}

            {editing && (
                <GlobalPresetEditorDrawer
                    key={editing.mode === 'edit' ? editing.row.preset_id : 'create'}
                    preset={editing.mode === 'edit' ? editing.row : null}
                    onClose={() => setEditing(null)}
                    onSaved={upsert}
                />
            )}

            <ConfirmDialog
                visible={deleting !== null}
                title={t('admin.voices.globalPresets.deleteConfirm.title')}
                message={
                    <span className="flex flex-col gap-2">
                        <span>{t('admin.voices.globalPresets.deleteConfirm.message', { name: deleting?.name ?? '' })}</span>
                        {deleteError && (
                            <span role="alert" className="font-ui text-sm text-blood-300">
                                {deleteError}
                            </span>
                        )}
                    </span>
                }
                icon={<Icon icon={Trash2} size={20} />}
                variant="danger"
                confirmLabel={t('admin.voices.globalPresets.deleteConfirm.confirm')}
                cancelLabel={t('admin.voices.common.cancel')}
                processingLabel={t('admin.voices.globalPresets.deleteConfirm.processing')}
                isProcessing={deleteBusy}
                onConfirm={() => void confirmDelete()}
                onCancel={closeDelete}
            />
        </ConsoleSection>
    )
}
