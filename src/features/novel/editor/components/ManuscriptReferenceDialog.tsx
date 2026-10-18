import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Callout, Modal } from '@/ui/primitives'
import type { ManuscriptReferenceChoice } from '../referenceChoices'
import type { EditorCodexEntry } from '../types'
import { ReferenceEntrySummary } from './ReferenceEntrySummary'

interface Props {
    choices: ManuscriptReferenceChoice[]
    entries: EditorCodexEntry[]
    canChangeContext: () => boolean
    onSetContext?: (entry: EditorCodexEntry, enabled: boolean) => Promise<void>
    onPreview?: (id: string) => void
    onClose: () => void
}

export function ManuscriptReferenceDialog({ choices, entries, canChangeContext, onSetContext, onPreview, onClose }: Props) {
    const { t } = useTranslation()
    const [selected, setSelected] = useState<string | null>(choices.length === 1 ? choices[0].key : null)
    const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null), [saved, setSaved] = useState(false)
    const alive = useRef(true), writing = useRef(false)
    useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
    const choice = choices.find((item) => item.key === selected)
    const entry = choice?.kind !== 'lore' ? entries.find((item) => item.id === choice?.id) : undefined
    const state = entry?.contextState ?? (entry?.enabled ? 'enabled' : 'disabled')
    const contextEligible = Boolean(entry && !entry.removed && (state === 'enabled' || state === 'disabled'))
    const changeContext = async () => {
        if (!entry || !onSetContext || !contextEligible || writing.current) return
        if (!canChangeContext()) { setError(t('novelEditor.references.review')); return }
        writing.current = true; setBusy(true); setError(null); setSaved(false)
        try { await onSetContext(entry, !entry.enabled); if (alive.current) setSaved(true) }
        catch (cause) { if (alive.current) setError(cause instanceof Error ? cause.message : t('novelEditor.references.failed')) }
        finally { writing.current = false; if (alive.current) setBusy(false) }
    }
    return <Modal open onClose={onClose} title={t('novelEditor.references.title')} size="lg" footer={<Button variant="ghost" onClick={onClose}>{t('common.close')}</Button>}>
        <div className="flex flex-col gap-4">
            <p className="text-body text-parchment-300">{t('novelEditor.references.contextHelp')}</p>
            {choices.length === 0 && <p className="text-body text-parchment-200">{t('novelEditor.references.help')}</p>}
            {choices.length > 1 && <>
                <p className="text-body text-parchment-200">{t('novelEditor.references.choose')}</p>
                <div className="flex max-h-80 flex-col gap-2 overflow-y-auto" role="group" aria-label={t('novelEditor.references.choose')}>
                    {choices.map((item) => {
                        const pin = item.kind !== 'lore' ? entries.find((candidate) => candidate.id === item.id) : undefined
                        return <Button key={item.key} variant="secondary" className="h-auto justify-start whitespace-normal py-3" aria-pressed={selected === item.key} onClick={() => { setSelected(item.key); setError(null); setSaved(false) }}>
                            {pin ? <ReferenceEntrySummary entry={pin} preview /> : <span>{item.label} · {t(`novelEditor.references.${item.kind}`)}</span>}
                        </Button>
                    })}
                </div>
            </>}
            {choice && <section className="flex min-w-0 flex-col gap-3" aria-label={choice.label}>
                <p className="text-caption text-parchment-400">{t(`novelEditor.references.${choice.kind}`)} · {t('novelEditor.references.manuscriptLabel', { label: choice.label })}</p>
                {entry ? <>
                    <ReferenceEntrySummary entry={entry} />
                    {entry.sourceVersionId && <p className="break-all text-caption text-parchment-400">{t('novelEditor.references.versionPin', { id: entry.sourceVersionId })}</p>}
                    {Boolean(entry.aliases?.length) && <p className="text-caption text-parchment-300">{t('novelEditor.references.aliases', { aliases: entry.aliases!.join(', ') })}</p>}
                    <p className="max-h-80 overflow-y-auto whitespace-pre-wrap break-words font-narrative text-body text-parchment-100">{entry.description || t('novelEditor.references.noContent')}</p>
                    <div className="flex flex-wrap gap-2">
                        {onSetContext && contextEligible && canChangeContext() && <Button size="sm" variant="secondary" disabled={busy} onClick={() => void changeContext()}>{t(entry.enabled ? 'novelEditor.references.exclude' : 'novelEditor.references.include')}</Button>}
                        {onPreview && <Button size="sm" variant="ghost" onClick={() => { onPreview(entry.id); onClose() }}>{t('novelEditor.references.preview')}</Button>}
                    </div>
                </> : choice.match ? <p className="max-h-80 overflow-y-auto whitespace-pre-wrap break-words font-narrative text-body">{choice.match.entry.content || t('novelEditor.references.noContent')}</p>
                    : <Callout tone="warning" role="status">{t('novelEditor.references.unavailable')}</Callout>}
            </section>}
            {error && <Callout tone="danger" role="alert">{error}</Callout>}
            {saved && <p className="text-caption text-parchment-200" role="status">{t('novelEditor.references.changed')}</p>}
        </div>
    </Modal>
}
