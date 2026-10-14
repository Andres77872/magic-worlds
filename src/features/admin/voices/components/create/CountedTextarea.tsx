import { useTranslation } from 'react-i18next'
import { Field, Textarea } from '@/ui/primitives'

interface CountedTextareaProps {
    label: string
    helper?: string
    value: string
    onChange: (value: string) => void
    min: number
    max: number
    disabled?: boolean
    showError: boolean
    rows?: number
    lang?: string
}

export const lengthOk = (value: string, min: number, max: number) => value.trim().length >= min && value.trim().length <= max

/** A textarea with a live character counter and a min/max length error. */
export function CountedTextarea({ label, helper, value, onChange, min, max, disabled, showError, rows = 4, lang }: CountedTextareaProps) {
    const { t } = useTranslation()
    const invalid = showError && !disabled && !lengthOk(value, min, max)
    return (
        <Field label={label} helper={helper} error={invalid ? t('admin.voices.design.lengthError', { min, max }) : undefined}>
            <Textarea value={value} onChange={(event) => onChange(event.target.value)} rows={rows} disabled={disabled} maxLength={max} lang={lang} />
            <span className="mt-1 block text-right font-mono text-[11px] text-fg-muted" aria-hidden>
                {t('admin.voices.common.chars', { count: value.trim().length, max })}
            </span>
        </Field>
    )
}
