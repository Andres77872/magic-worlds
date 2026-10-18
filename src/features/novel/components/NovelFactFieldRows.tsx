/**
 * The details a fact review can change, one row each: the value now and, once the author chooses to change it, an
 * editable value after. Details left on Keep are not written.
 */

import { Lock, PencilLine } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Field, Icon, Input, SegmentedControl, Textarea } from '@/ui/primitives'
import type { FactFieldDraft, FactFieldRow } from '../utils/factCodex'

export function NovelFactFieldRows({ rows, value, disabled, onChange }: {
    rows: FactFieldRow[]; value: FactFieldDraft; disabled?: boolean
    onChange: (next: FactFieldDraft) => void
}) {
    const { t } = useTranslation()
    const copy = (key: string, values?: Record<string, unknown>) => t('novelEditor.planningViews.facts.fields.' + key, values)
    const set = (key: string, patch: Partial<FactFieldDraft[string]>) => onChange({ ...value, [key]: { ...value[key], ...patch } })
    return <div className="flex flex-col gap-3">
        {rows.map((row) => {
            const label = copy('names.' + row.key), state = value[row.key] ?? { change: false, text: row.before }
            return <section key={row.key} aria-label={label} className="space-y-2 rounded-md border border-parchment-50/10 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-ui text-label text-parchment-100">{label}</h3>
                    <SegmentedControl aria-label={copy('choice', { field: label })} showLabels value={state.change ? 'change' : 'keep'}
                        onChange={(next) => { if (!disabled) set(row.key, { change: next === 'change' }) }}
                        options={[{ value: 'keep', label: copy('keep'), icon: <Icon icon={Lock} size={14} /> },
                            { value: 'change', label: copy('change'), icon: <Icon icon={PencilLine} size={14} /> }]} />
                </div>
                <p className="max-h-40 overflow-y-auto whitespace-pre-wrap break-words text-body text-parchment-200">
                    <span className="mr-2 font-ui text-caption text-parchment-400">{copy('now')}</span>{row.before || <em className="text-parchment-400">{copy('empty')}</em>}
                </p>
                {state.change && <Field label={copy('after', { field: label })} helper={row.key === 'keys' ? copy('keysHelp') : undefined}>
                    {row.multiline
                        ? <Textarea rows={6} value={state.text} disabled={disabled} onChange={(event) => set(row.key, { text: event.target.value })} />
                        : <Input value={state.text} disabled={disabled} maxLength={row.key === 'keys' ? 2000 : 255} onChange={(event) => set(row.key, { text: event.target.value })} />}
                </Field>}
            </section>
        })}
    </div>
}
