/**
 * Re-point dialog (03 §5.16 I-29/I-34). A catalog change refused with 409
 * `voice_is_replacement` lists the dependent voices and why the change would
 * break them. Root picks one new replacement that fits all of them, and the
 * same PATCH is retried with `?repoint_dependents_to=`: the change and the
 * re-point are saved in one transaction. A 422 `repoint_target_invalid`
 * names the dependent the target does not fit and keeps the dialog open.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { AdminCatalogVoice } from '@/shared'
import { Button, Callout, Field, Modal, Select } from '@/ui/primitives'
import { repointCandidates } from '../../consoleRules'
import { publishFailureMessage } from '../../publishFailures'
import type { ReplacementDependents } from '../../replacementDependents'
import { voiceName, voiceSelectOptions } from '../../voiceOptions'
import { useVoiceConsole } from '../shell/VoiceConsoleContext'

interface RepointDialogProps {
    /** The voice whose change was refused. */
    voice: AdminCatalogVoice
    dependents: ReplacementDependents
    processing: boolean
    /** Why the last re-point failed, already worded; null before the first attempt. */
    error: string | null
    onConfirm: (targetKey: string) => void
    onCancel: () => void
}

export function RepointDialog({ voice, dependents, processing, error, onConfirm, onCancel }: RepointDialogProps) {
    const { t } = useTranslation()
    const { catalog } = useVoiceConsole()
    const [target, setTarget] = useState('')
    const known = dependents.keys.flatMap((key) => {
        const dependent = catalog.byKey.get(key)
        return dependent ? [dependent] : []
    })
    const unloaded = dependents.keys.filter((key) => !catalog.byKey.has(key))
    const candidates = repointCandidates(voice, known, catalog.voices)
    const canConfirm = !processing && candidates.some((candidate) => candidate.voice_key === target)

    return (
        <Modal
            open
            onClose={() => {
                if (!processing) onCancel()
            }}
            title={t('admin.voices.catalog.repoint.title', { name: voice.display_name })}
            size="lg"
            footer={
                <div className="flex flex-wrap justify-end gap-2">
                    <Button variant="secondary" onClick={onCancel} disabled={processing}>
                        {t('admin.voices.common.cancel')}
                    </Button>
                    <Button variant="primary" onClick={() => onConfirm(target)} disabled={!canConfirm}>
                        {processing ? t('admin.voices.common.saving') : t('admin.voices.catalog.repoint.confirm')}
                    </Button>
                </div>
            }
        >
            <div className="flex flex-col gap-4">
                <p className="font-ui text-sm text-parchment-200">{t('admin.voices.catalog.repoint.intro', { name: voice.display_name })}</p>
                <section className="flex flex-col gap-2" aria-label={t('admin.voices.catalog.repoint.dependents')}>
                    <p className="font-ui text-label font-semibold text-fg">{t('admin.voices.catalog.repoint.dependents')}</p>
                    <ul className="flex flex-col divide-y divide-line-faint">
                        {dependents.keys.map((key) => {
                            const reason = dependents.reasons[key]
                            return (
                                <li key={key} className="flex flex-col gap-0.5 py-1.5 font-ui text-sm">
                                    <span className="text-parchment-100">{voiceName(catalog.byKey.get(key), key, t)}</span>
                                    {reason && <span className="text-caption text-fg-muted">{publishFailureMessage({ code: reason, language: null }, t)}</span>}
                                </li>
                            )
                        })}
                    </ul>
                </section>
                <Field
                    label={t('admin.voices.catalog.repoint.target')}
                    helper={candidates.length === 0 ? t('admin.voices.catalog.repoint.noCandidates') : t('admin.voices.catalog.repoint.targetHelp')}
                >
                    <Select
                        options={voiceSelectOptions(candidates, t)}
                        value={target}
                        onChange={setTarget}
                        placeholder={t('admin.voices.common.notSet')}
                        disabled={processing || candidates.length === 0}
                    />
                </Field>
                {unloaded.length > 0 && (
                    <p className="font-ui text-caption text-fg-muted">
                        {t('admin.voices.catalog.repoint.unloaded', { names: unloaded.map((key) => voiceName(undefined, key, t)).join(', ') })}
                    </p>
                )}
                {error && (
                    <Callout tone="danger" role="alert" data-testid="repoint-error">
                        {error}
                    </Callout>
                )}
            </div>
        </Modal>
    )
}
