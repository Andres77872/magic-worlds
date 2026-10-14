import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowDown, ArrowUp, X } from 'lucide-react'
import { Button, Field, Icon, IconButton, Select, type SelectOption } from '@/ui/primitives'
import { voiceName } from '../../voiceOptions'
import { useVoiceConsole } from './VoiceConsoleContext'

interface OrderedVoiceListProps {
    label: string
    help?: string
    addLabel: string
    value: string[]
    options: SelectOption[]
    onChange: (next: string[]) => void
}

/** An ordered list of catalog voices with keyboard-reachable move and remove buttons. */
export function OrderedVoiceList({ label, help, addLabel, value, options, onChange }: OrderedVoiceListProps) {
    const { t } = useTranslation()
    const { catalog } = useVoiceConsole()
    const [adding, setAdding] = useState('')

    const move = (index: number, delta: number) => {
        const target = index + delta
        if (target < 0 || target >= value.length) return
        const next = [...value]
        ;[next[index], next[target]] = [next[target], next[index]]
        onChange(next)
    }

    return (
        <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 font-ui text-label font-semibold text-fg">{label}</legend>
            {help && <p className="font-ui text-caption text-fg-muted">{help}</p>}
            {value.length > 0 && (
                <ol className="flex flex-col gap-1.5">
                    {value.map((key, index) => {
                        const name = voiceName(catalog.byKey.get(key), key, t)
                        return (
                            <li key={key} className="flex items-center gap-2 rounded-md border border-line-faint bg-ink-900 px-3 py-1.5">
                                <span className="font-mono text-xs text-fg-muted">{index + 1}</span>
                                <span className="min-w-0 flex-1 truncate font-ui text-sm text-parchment-100">{name}</span>
                                <IconButton label={t('admin.voices.common.moveUp', { name })} size="sm" onClick={() => move(index, -1)} disabled={index === 0}>
                                    <Icon icon={ArrowUp} size={14} />
                                </IconButton>
                                <IconButton label={t('admin.voices.common.moveDown', { name })} size="sm" onClick={() => move(index, 1)} disabled={index === value.length - 1}>
                                    <Icon icon={ArrowDown} size={14} />
                                </IconButton>
                                <IconButton label={t('admin.voices.common.removeItem', { name })} size="sm" onClick={() => onChange(value.filter((item) => item !== key))}>
                                    <Icon icon={X} size={14} />
                                </IconButton>
                            </li>
                        )
                    })}
                </ol>
            )}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <Field label={addLabel} className="flex-1">
                    <Select options={options.filter((option) => !value.includes(option.value))} value={adding} onChange={setAdding} />
                </Field>
                <Button
                    variant="secondary"
                    onClick={() => {
                        if (adding) onChange([...value, adding])
                        setAdding('')
                    }}
                    disabled={!adding}
                >
                    {t('admin.voices.common.add')}
                </Button>
            </div>
        </fieldset>
    )
}
