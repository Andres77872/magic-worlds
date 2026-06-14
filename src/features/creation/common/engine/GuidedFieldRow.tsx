/**
 * GuidedFieldRow — one active guided field: label row with an optional
 * remove ×, the input by kind, a play-focused helper line, and a one-click
 * "Use example" ghost action when the field is empty but has a hint.
 */
import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { Feather, X } from 'lucide-react'
import { Icon, IconButton, Input, Select, SuggestInput, Textarea } from '@/ui/primitives'
import type { CardFieldDefinition } from './types'

export interface GuidedFieldRowProps {
    field: CardFieldDefinition
    value: string
    /** Effective ghost example (template override or definition default). */
    hint?: string
    /** Shown with a muted tag when the field doesn't match the current role. */
    offRole?: boolean
    onChange: (value: string) => void
    /** Omitted for non-removable fields. */
    onRemove?: () => void
    onUseExample?: () => void
}

export function GuidedFieldRow({ field, value, hint, offRole, onChange, onRemove, onUseExample }: GuidedFieldRowProps) {
    const { t } = useTranslation()
    const reactId = useId()
    const inputId = `guided-${field.id.replace(/\./g, '-')}-${reactId}`
    const placeholder = hint ?? field.placeholder

    const control = (() => {
        switch (field.input) {
            case 'textarea':
                return (
                    <Textarea
                        id={inputId}
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        placeholder={placeholder}
                        rows={field.rows ?? 3}
                        className="min-h-0 leading-normal"
                    />
                )
            case 'suggest':
                return (
                    <SuggestInput
                        id={inputId}
                        value={value}
                        onChange={onChange}
                        options={field.options ?? []}
                        placeholder={placeholder}
                    />
                )
            case 'select':
                return (
                    <Select
                        id={inputId}
                        value={value || undefined}
                        onChange={onChange}
                        options={field.options ?? []}
                        placeholder={placeholder ?? t('creation.common.fieldRow.selectPlaceholder')}
                    />
                )
            // 'chips' values are stored as one comma-separated string; a plain
            // input keeps the payload a simple attribute value.
            case 'chips':
            case 'text':
            default:
                return (
                    <Input
                        id={inputId}
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        placeholder={placeholder}
                    />
                )
        }
    })()

    return (
        <div data-guided-field={field.id}>
            <div className="mb-2 flex items-center justify-between gap-2">
                <label htmlFor={inputId} className="block font-ui text-[13px] font-semibold text-parchment-50">
                    {field.label}
                    {offRole && (
                        <span className="ml-2 font-normal italic text-parchment-400">{t('creation.common.fieldRow.offRole')}</span>
                    )}
                </label>
                {onRemove && (
                    <IconButton
                        label={t('creation.common.fieldRow.remove', { label: field.label })}
                        size="sm"
                        onClick={onRemove}
                    >
                        <Icon icon={X} size={14} />
                    </IconButton>
                )}
            </div>
            {control}
            <div className="mt-1.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                {field.helper && <span className="block text-[12px] text-parchment-200">{field.helper}</span>}
                {!value.trim() && hint && onUseExample && (
                    <button
                        type="button"
                        onClick={onUseExample}
                        className="inline-flex shrink-0 items-center gap-1 font-narrative text-[12px] italic text-arcane-300 transition-colors hover:text-arcane-400"
                        title={t('creation.common.fieldRow.useExampleTitle')}
                    >
                        <Icon icon={Feather} size={12} />
                        {t('creation.common.fieldRow.useExample')}
                    </button>
                )}
            </div>
        </div>
    )
}
