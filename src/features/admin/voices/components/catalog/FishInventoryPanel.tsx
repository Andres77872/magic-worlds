import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { apiService } from '@/infrastructure/api'
import type { FishInventoryResponse, FishReferenceImport } from '@/shared'
import { Button, Callout, Field, Input, Select } from '@/ui/primitives'

export function FishInventoryPanel({ onImported }: { onImported: () => void }) {
    const { t } = useTranslation()
    const [open, setOpen] = useState(false)
    const [inventory, setInventory] = useState<FishInventoryResponse | null>(null)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [query, setQuery] = useState('')
    const [nextPage, setNextPage] = useState<number | null>(null)
    const [draft, setDraft] = useState<FishReferenceImport>({
        provider_voice_id: '', display_name: '', primary_language: 'en', source_kind: 'owned_reference', rights_reference: '',
    })
    const load = async () => {
        setBusy(true)
        setError(null)
        try {
            setInventory(await apiService.getFishInventory())
            setNextPage(null)
            setDraft((value) => ({ ...value, source_kind: 'owned_reference', provider_voice_id: '' }))
        }
        catch { setError(t('admin.voices.fish.unavailable')) }
        finally { setBusy(false) }
    }
    const browse = async (page = 1) => {
        setBusy(true)
        setError(null)
        try {
            const result = await apiService.getFishReferences(draft.primary_language, query, page)
            setInventory((previous) => ({ ...result, items: page === 1 ? result.items : [...new Map(
                [...(previous?.items ?? []), ...result.items].map((item) => [item.provider_voice_id, item]),
            ).values()] }))
            setNextPage(result.next_page)
            setDraft((value) => ({ ...value, source_kind: 'licensed_reference', ...(page === 1 ? { provider_voice_id: '' } : {}) }))
        } catch { setError(t('admin.voices.fish.unavailable')) }
        finally { setBusy(false) }
    }
    const resetResults = () => { setInventory(null); setNextPage(null) }
    const save = async () => {
        if (!/^[A-Za-z0-9_-]{1,64}$/.test(draft.provider_voice_id) || !draft.display_name.trim() || !draft.rights_reference.trim()) return
        setBusy(true)
        setError(null)
        try {
            await apiService.importFishReference({ ...draft, display_name: draft.display_name.trim(), rights_reference: draft.rights_reference.trim() })
            onImported()
            setOpen(false)
        } catch { setError(t('admin.voices.fish.importFailed')) }
        finally { setBusy(false) }
    }
    return (
        <div className="flex flex-col gap-3">
            <Button variant="secondary" className="self-start" aria-expanded={open} onClick={() => setOpen(!open)}>
                {t('admin.voices.fish.title')}
            </Button>
            {open && <div className="flex flex-col gap-3 rounded-lg border border-line-faint bg-ink-800 p-4">
                <p className="text-caption text-parchment-300">{t('admin.voices.fish.description')}</p>
                {error && <Callout tone="danger" role="alert">{error}</Callout>}
                <Field label={t('admin.voices.fish.language')}><Select value={draft.primary_language} disabled={busy} options={[{ value: 'en', label: 'English' }, { value: 'es', label: 'Español' }]} onChange={(value) => {
                    resetResults()
                    setDraft({ ...draft, primary_language: value, provider_voice_id: '' })
                }} /></Field>
                <Field label={t('admin.voices.fish.search')}><Input value={query} maxLength={100} disabled={busy} onChange={(event) => {
                    setQuery(event.target.value)
                    resetResults()
                    setDraft({ ...draft, provider_voice_id: '' })
                }} /></Field>
                <Button variant="secondary" disabled={busy} onClick={() => void browse()}>{t('admin.voices.fish.browse')}</Button>
                <Button variant="secondary" disabled={busy} onClick={() => void load()}>{t('admin.voices.fish.load')}</Button>
                {inventory && <Field label={t(draft.source_kind === 'licensed_reference' ? 'admin.voices.fish.licensedVoice' : 'admin.voices.fish.inventory')}>
                    <Select value={draft.provider_voice_id} options={inventory.items.filter((item) => item.available).map((item) => ({ value: item.provider_voice_id, label: item.display_name }))}
                        onChange={(id) => {
                            const item = inventory.items.find((entry) => entry.provider_voice_id === id)
                            setDraft({ ...draft, provider_voice_id: id, display_name: item?.display_name ?? draft.display_name })
                        }} />
                </Field>}
                {inventory?.items.length === 0 && <p className="text-caption text-parchment-300">{t('admin.voices.fish.noResults')}</p>}
                {nextPage !== null && <Button variant="secondary" disabled={busy} onClick={() => void browse(nextPage)}>{t('admin.voices.fish.more')}</Button>}
                <Field label={t('admin.voices.fish.referenceId')}><Input value={draft.provider_voice_id} maxLength={64} onChange={(event) => setDraft({ ...draft, provider_voice_id: event.target.value })} /></Field>
                <Field label={t('admin.voices.fish.name')}><Input value={draft.display_name} maxLength={255} onChange={(event) => setDraft({ ...draft, display_name: event.target.value })} /></Field>
                <Field label={t('admin.voices.fish.provenance')}><Select value={draft.source_kind}
                    options={[{ value: 'owned_reference', label: t('admin.voices.fish.owned') }, { value: 'licensed_reference', label: t('admin.voices.fish.licensed') }]}
                    onChange={(value) => setDraft({ ...draft, source_kind: value as FishReferenceImport['source_kind'] })} /></Field>
                <Field label={t('admin.voices.fish.rights')}><Input value={draft.rights_reference} maxLength={255} onChange={(event) => setDraft({ ...draft, rights_reference: event.target.value })} /></Field>
                <Button disabled={busy || !/^[A-Za-z0-9_-]{1,64}$/.test(draft.provider_voice_id) || !draft.display_name.trim() || !draft.rights_reference.trim()} onClick={() => void save()}>{t('admin.voices.fish.import')}</Button>
            </div>}
        </div>
    )
}
