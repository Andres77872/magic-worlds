import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { apiService } from '@/infrastructure/api'
import type { PronunciationDictionary, PronunciationReference, PronunciationRule } from '@/shared'
import { Badge, Button, Field, Input, Select, SwitchRow } from '@/ui/primitives'

const blankRule = (): PronunciationRule => ({ text: '', pronunciation: '', kind: 'spoken', case_sensitive: false })

interface Props {
    language: 'en' | 'es'
    phonemes: boolean
    value: PronunciationReference[]
    onChange: (value: PronunciationReference[]) => void
}

export function PronunciationEditor({ language, phonemes, value, onChange }: Props) {
    const { t } = useTranslation()
    const key = (name: string) => t(`voices.performance.${name}`)
    const [rows, setRows] = useState<PronunciationDictionary[]>([])
    const [editing, setEditing] = useState<PronunciationDictionary | null>(null)
    const [name, setName] = useState('')
    const [rules, setRules] = useState<PronunciationRule[]>([blankRule()])
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState(false)
    useEffect(() => {
        let live = true
        apiService.listPronunciationDictionaries().then(result => { if (live) setRows(result.items) }).catch(() => { if (live) setError(true) })
        return () => { live = false }
    }, [])
    const editRule = (index: number, patch: Partial<PronunciationRule>) => setRules(current => current.map((rule, i) => i === index ? { ...rule, ...patch } : rule))
    const reset = () => { setEditing(null); setName(''); setRules([blankRule()]) }
    const save = async () => {
        setBusy(true); setError(false)
        try {
            const saved = await apiService.savePronunciationDictionary({ name, language, rules,
                ...(editing ? { expected_version_id: editing.version_id } : {}) }, editing?.dictionary_id)
            setRows(current => [...current.filter(row => row.dictionary_id !== saved.dictionary_id), saved])
            reset()
        } catch { setError(true) } finally { setBusy(false) }
    }
    const archive = async (row: PronunciationDictionary) => {
        setBusy(true); setError(false)
        try {
            await apiService.archivePronunciationDictionary(row.dictionary_id)
            setRows(current => current.filter(item => item.dictionary_id !== row.dictionary_id))
            if (editing?.dictionary_id === row.dictionary_id) reset()
        } catch { setError(true) } finally { setBusy(false) }
    }
    return <section className="flex flex-col gap-3" aria-label={key('dictionaries')}>
        <h4 className="font-ui text-label text-fg-primary">{key('dictionaries')}</h4>
        <p className="text-caption text-fg-muted">{key('versionHint')} {key('limit')}</p>
        {rows.filter(row => row.language === language).map(row => {
            const pin = value.find(ref => ref.dictionary_id === row.dictionary_id)
            return <div key={row.dictionary_id} className="flex flex-wrap items-center gap-2">
                <Button variant="secondary" size="sm" aria-pressed={!!pin} disabled={busy || (!pin && value.length >= 3)} onClick={() => onChange(pin
                    ? value.filter(ref => ref.dictionary_id !== row.dictionary_id)
                    : [...value, { dictionary_id: row.dictionary_id, version_id: row.version_id }])}>{t('voices.performance.useVersion', { name: row.name })}</Button>
                {pin && pin.version_id !== row.version_id && <><Badge tone="neutral">{key('pinned')}</Badge><Button size="sm" variant="ghost" disabled={busy} onClick={() => onChange(value.map(ref => ref.dictionary_id === row.dictionary_id ? { dictionary_id: row.dictionary_id, version_id: row.version_id } : ref))}>{t('voices.performance.useLatest', { name: row.name })}</Button></>}
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => { setEditing(row); setName(row.name); setRules(row.rules.map(rule => ({ ...rule }))) }}>{t('voices.performance.edit', { name: row.name })}</Button>
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => void archive(row)}>{t('voices.performance.archive', { name: row.name })}</Button>
            </div>
        })}
        {value.filter(ref => !rows.some(row => row.dictionary_id === ref.dictionary_id && row.language === language)).map(ref => <div key={ref.dictionary_id} className="flex flex-wrap items-center gap-2">
            <p className="text-caption text-fg-muted">{key('pinnedMissing')}</p><Button size="sm" variant="ghost" onClick={() => onChange(value.filter(item => item.dictionary_id !== ref.dictionary_id))}>{t('voices.performance.remove', { label: ref.dictionary_id })}</Button>
        </div>)}
        <Field label={key('dictionaryName')}><Input disabled={busy} value={name} maxLength={80} onChange={event => setName(event.target.value)} /></Field>
        {rules.map((rule, index) => <div key={index} className="flex flex-col gap-2 rounded-md border border-line-faint p-3">
            <div className="grid gap-3 sm:grid-cols-2">
                <Field label={`${key('match')} ${index + 1}`}><Input disabled={busy} maxLength={80} value={rule.text} onChange={event => editRule(index, { text: event.target.value })} /></Field>
                <Field label={`${key('reading')} ${index + 1}`}><Input disabled={busy} maxLength={160} value={rule.pronunciation} onChange={event => editRule(index, { pronunciation: event.target.value })} /></Field>
            </div>
            {phonemes && <Field label={key('ruleKind')}><Select disabled={busy} value={rule.kind} onChange={kind => editRule(index, { kind: kind as PronunciationRule['kind'] })} options={[{ value: 'spoken', label: key('spoken') }, { value: 'cmu', label: key('cmu') }]} /></Field>}
            <SwitchRow disabled={busy} label={key('caseSensitive')} checked={rule.case_sensitive} onChange={checked => editRule(index, { case_sensitive: checked })} />
            {rules.length > 1 && <Button variant="ghost" size="sm" disabled={busy} onClick={() => setRules(current => current.filter((_, i) => i !== index))}>{t('voices.performance.remove', { label: `${index + 1}` })}</Button>}
        </div>)}
        <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="ghost" disabled={rules.length >= 64 || busy} onClick={() => setRules(current => [...current, blankRule()])}>{key('addRule')}</Button>
            <Button size="sm" variant="secondary" disabled={busy || !name.trim() || rules.some(rule => !rule.text.trim() || !rule.pronunciation.trim())} onClick={() => void save()}>{key('saveDictionary')}</Button>
            {editing && <Button size="sm" variant="ghost" disabled={busy} onClick={reset}>{key('newDictionary')}</Button>}
        </div>
        {error && <p role="alert" className="text-caption text-blood-300">{key('dictionaryError')}</p>}
    </section>
}
