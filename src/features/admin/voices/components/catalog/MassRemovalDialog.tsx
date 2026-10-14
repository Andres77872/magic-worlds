/**
 * Mass-removal override (D19 item 7, I-29/I-34). Offered only while Job B's
 * last run aborted on `mass_removal`. Root picks the voices to re-check (1–100),
 * reads the impact, acknowledges having checked the provider account, and the
 * console sends `{job: 'B', voice_keys, confirm_removal: true}`. The BFF removes
 * only the voices the provider confirms as gone and reports the voices left
 * without a replacement as `replacement_orphans`.
 */
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle } from 'lucide-react'
import { apiService } from '@/infrastructure/api'
import type { AdminVoiceSyncResponse } from '@/shared'
import { Button, Callout, Field, Icon, Input, Modal } from '@/ui/primitives'
import { formatDateTime, formatNumber } from '../../format'
import { MAX_CONFIRM_REMOVAL_KEYS, SYNC_LEASE_HELD, removalCandidates, selectionDependents } from '../../massRemoval'
import { CheckboxField } from '../shell/CheckboxField'
import { useLoadErrorMessage, useVoiceConsole } from '../shell/VoiceConsoleContext'

interface MassRemovalDialogProps {
    onClose: () => void
    /** A `completed` override answer; the dialog closes after it. */
    onConfirmed: (result: AdminVoiceSyncResponse) => void
}

export function MassRemovalDialog({ onClose, onConfirmed }: MassRemovalDialogProps) {
    const { t } = useTranslation()
    const { catalog, locale, reportError } = useVoiceConsole()
    const loadError = useLoadErrorMessage(catalog.error)
    const [filter, setFilter] = useState('')
    const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set())
    const [acknowledged, setAcknowledged] = useState(false)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const candidates = useMemo(() => removalCandidates(catalog.voices), [catalog.voices])
    const query = filter.trim().toLocaleLowerCase(locale)
    const shown = query
        ? candidates.filter((voice) => voice.display_name.toLocaleLowerCase(locale).includes(query) || voice.voice_key.toLocaleLowerCase(locale).includes(query))
        : candidates
    const dependents = selectionDependents(catalog.voices, selected)
    const full = selected.size >= MAX_CONFIRM_REMOVAL_KEYS
    const canConfirm = !busy && acknowledged && selected.size > 0 && selected.size <= MAX_CONFIRM_REMOVAL_KEYS

    const toggle = (voiceKey: string, checked: boolean) => {
        setSelected((previous) => {
            const next = new Set(previous)
            if (checked) next.add(voiceKey)
            else next.delete(voiceKey)
            return next
        })
    }

    const confirm = async () => {
        if (!canConfirm) return
        setBusy(true)
        setError(null)
        try {
            // Catalog order keeps the request stable whatever order root ticked the boxes in.
            const voiceKeys = candidates.filter((voice) => selected.has(voice.voice_key)).map((voice) => voice.voice_key)
            const result = await apiService.syncAdminCatalog({ job: 'B', voice_keys: voiceKeys, confirm_removal: true })
            if (result?.status === 'running' && result.detail === SYNC_LEASE_HELD) {
                setError(t('admin.voices.catalog.massRemoval.leaseHeld'))
                return
            }
            onConfirmed(result)
        } catch (caught) {
            setError(reportError(caught))
        } finally {
            setBusy(false)
        }
    }

    return (
        <Modal
            open
            onClose={() => {
                if (!busy) onClose()
            }}
            title={t('admin.voices.catalog.massRemoval.title')}
            size="lg"
            footer={
                <div className="flex flex-wrap justify-end gap-2">
                    <Button variant="secondary" onClick={onClose} disabled={busy}>
                        {t('admin.voices.common.cancel')}
                    </Button>
                    <Button variant="danger" onClick={() => void confirm()} disabled={!canConfirm}>
                        {busy ? t('admin.voices.catalog.massRemoval.confirming') : t('admin.voices.catalog.massRemoval.confirm', { count: selected.size })}
                    </Button>
                </div>
            }
        >
            <div className="flex flex-col gap-4">
                <p className="font-ui text-sm text-parchment-200">{t('admin.voices.catalog.massRemoval.intro')}</p>
                <Callout tone="danger" role="note" icon={<Icon icon={AlertTriangle} size={16} />}>
                    {t('admin.voices.catalog.massRemoval.impact')}
                </Callout>

                <Field label={t('admin.voices.catalog.massRemoval.filter')}>
                    <Input type="search" value={filter} placeholder={t('admin.voices.catalog.massRemoval.filterPlaceholder')} onChange={(event) => setFilter(event.target.value)} />
                </Field>

                <fieldset className="flex min-w-0 flex-col gap-2">
                    <legend className="font-ui text-label font-semibold text-fg">{t('admin.voices.catalog.massRemoval.listLabel')}</legend>
                    <p className="font-ui text-caption text-fg-muted">
                        {t('admin.voices.catalog.massRemoval.listHint', { max: MAX_CONFIRM_REMOVAL_KEYS })}{' '}
                        <span aria-live="polite" className="font-mono tabular-nums text-parchment-200">
                            {t('admin.voices.catalog.massRemoval.selected', { selected: selected.size, max: MAX_CONFIRM_REMOVAL_KEYS })}
                        </span>
                    </p>
                    {catalog.loading && catalog.voices.length === 0 ? (
                        <p role="status" className="font-ui text-sm text-fg-muted">{t('admin.voices.catalog.massRemoval.loadingVoices')}</p>
                    ) : loadError && catalog.voices.length === 0 ? (
                        <Callout tone="danger" role="alert" action={<Button variant="secondary" size="sm" onClick={catalog.reload}>{t('admin.voices.common.retry')}</Button>}>
                            {loadError}
                        </Callout>
                    ) : shown.length === 0 ? (
                        <p className="font-ui text-sm text-fg-muted">{t('admin.voices.catalog.massRemoval.noVoices')}</p>
                    ) : (
                        <ul className="flex max-h-[40vh] flex-col divide-y divide-line-faint overflow-y-auto rounded-lg border border-line-faint bg-ink-800/70 px-3">
                            {shown.map((voice) => {
                                const checked = selected.has(voice.voice_key)
                                return (
                                    <li key={voice.voice_key} className="py-2">
                                        <CheckboxField
                                            label={voice.display_name}
                                            checked={checked}
                                            disabled={busy || (!checked && full)}
                                            onChange={(value) => toggle(voice.voice_key, value)}
                                            description={t('admin.voices.catalog.massRemoval.voiceMeta', {
                                                key: voice.voice_key,
                                                status: t(`admin.voices.status.${voice.status}`),
                                                synced: formatDateTime(voice.last_synced_at, locale),
                                                references: formatNumber(voice.reference_count, locale),
                                            })}
                                        />
                                    </li>
                                )
                            })}
                        </ul>
                    )}
                </fieldset>

                {dependents.length > 0 && (
                    <Callout tone="warning" role="status" data-testid="mass-removal-dependents">
                        {t('admin.voices.catalog.massRemoval.dependents', {
                            count: dependents.length,
                            names: dependents.map((voice) => voice.display_name).join(', '),
                        })}
                    </Callout>
                )}

                <CheckboxField label={t('admin.voices.catalog.massRemoval.acknowledge')} checked={acknowledged} disabled={busy} onChange={setAcknowledged} />

                {error && (
                    <Callout tone="danger" role="alert" data-testid="mass-removal-error">
                        {error}
                    </Callout>
                )}
            </div>
        </Modal>
    )
}
