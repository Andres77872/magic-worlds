/**
 * Add a Library voice to the catalog (D09, 05 §8.7, AC-R6): the D09 terms
 * checklist (re-checked by the BFF), both root attestations, and the
 * fewer-than-5-ops preflight. The new row is a root-only draft.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { apiService } from '@/infrastructure/api'
import type { AdminCatalogVoice, LibraryVoice } from '@/shared'
import { Button, Callout, Field, Input, Modal } from '@/ui/primitives'
import { allPassed, libraryChecklist } from '../../consoleRules'
import { CheckboxField } from '../shell/CheckboxField'
import { RuleChecklist } from '../shell/RuleChecklist'
import { summarizeLimits } from '../shell/limitsMath'
import { useVoiceConsole } from '../shell/VoiceConsoleContext'

interface AddLibraryVoiceDialogProps {
    voice: LibraryVoice
    onCancel: () => void
    onAdded: (voice: AdminCatalogVoice) => void
}

export function AddLibraryVoiceDialog({ voice, onCancel, onAdded }: AddLibraryVoiceDialogProps) {
    const { t } = useTranslation()
    const { limits, reportError } = useVoiceConsole()
    const [name, setName] = useState(voice.name)
    const [notChildLike, setNotChildLike] = useState(false)
    const [noPublicFigure, setNoPublicFigure] = useState(false)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const checks = libraryChecklist(voice)
    const { opsLeft, opsLow } = summarizeLimits(limits.data)
    const ready = allPassed(checks) && notChildLike && noPublicFigure && !opsLow && name.trim().length > 0

    const add = async () => {
        setSaving(true)
        setError(null)
        try {
            const added = await apiService.addAdminLibraryVoice({
                public_owner_id: voice.public_owner_id,
                library_voice_id: voice.library_voice_id,
                new_name: name.trim(),
                attest_not_child_like: notChildLike,
                attest_no_public_figure: noPublicFigure,
            })
            onAdded(added)
        } catch (caught) {
            setError(reportError(caught))
        } finally {
            setSaving(false)
        }
    }

    return (
        <Modal
            open
            onClose={() => {
                if (!saving) onCancel()
            }}
            title={t('admin.voices.library.addTitle', { name: voice.name })}
            size="lg"
            footer={
                <div className="flex flex-wrap justify-end gap-2">
                    <Button variant="secondary" onClick={onCancel} disabled={saving}>
                        {t('admin.voices.common.cancel')}
                    </Button>
                    <Button variant="primary" onClick={() => void add()} disabled={!ready || saving}>
                        {saving ? t('admin.voices.common.saving') : t('admin.voices.library.add')}
                    </Button>
                </div>
            }
        >
            <div className="flex flex-col gap-4">
                <Field label={t('admin.voices.library.newName')}>
                    <Input value={name} onChange={(event) => setName(event.target.value)} maxLength={255} />
                </Field>
                <RuleChecklist title={t('admin.voices.library.checklist.title')} checks={checks} />
                <fieldset className="flex flex-col gap-2">
                    <legend className="mb-1 font-ui text-label font-semibold text-fg">{t('admin.voices.library.attest.title')}</legend>
                    <CheckboxField label={t('admin.voices.library.attest.notChildLike')} checked={notChildLike} onChange={setNotChildLike} />
                    <CheckboxField label={t('admin.voices.library.attest.noPublicFigure')} checked={noPublicFigure} onChange={setNoPublicFigure} />
                </fieldset>
                {opsLow ? (
                    <Callout tone="danger" role="alert">
                        {t('admin.voices.library.opsPreflight')}
                    </Callout>
                ) : opsLeft === null ? (
                    <p className="font-ui text-caption text-fg-muted">{t('admin.voices.library.opsUnknown')}</p>
                ) : null}
                <p className="font-ui text-caption text-amber-500">{t('admin.voices.library.blockedUntilL2')}</p>
                {error && (
                    <p role="alert" className="font-ui text-sm text-blood-300">
                        {error}
                    </p>
                )}
            </div>
        </Modal>
    )
}
