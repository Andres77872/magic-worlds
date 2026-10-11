/**
 * Custom provider props: a model-agnostic JSON object editor for
 * `config.provider_options`. Validates on every keystroke with the same rules
 * as the server (object, at most 16 lowercase keys, no reserved fields, no
 * placeholders, at most 4 KB) and only reports a value upward while it is valid.
 * Remount it (via `key`) to load a different profile's value.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Field, Textarea } from '@/ui/primitives'
import { formatProviderOptions, parseProviderOptions, type ProviderOptionsIssue } from './llmProfileModel'

interface ProviderPropsFieldProps {
    value: Record<string, unknown> | undefined
    disabled?: boolean
    /** Called with the parsed object while the text is valid (an empty object means none). */
    onChange: (value: Record<string, unknown>) => void
    /** Called on every edit with whether the text is valid. */
    onValidityChange?: (valid: boolean) => void
    /** A server rejection to show under the field. */
    serverError?: string
}

export function ProviderPropsField({ value, disabled = false, onChange, onValidityChange, serverError }: ProviderPropsFieldProps) {
    const { t } = useTranslation()
    const [text, setText] = useState(() => formatProviderOptions(value))
    const [issue, setIssue] = useState<ProviderOptionsIssue | null>(() => {
        const initial = parseProviderOptions(text)
        return initial.ok ? null : initial.issue
    })

    const update = (next: string) => {
        setText(next)
        const result = parseProviderOptions(next)
        const nextIssue = result.ok ? null : result.issue
        onValidityChange?.(!nextIssue)
        setIssue(nextIssue)
        if (result.ok) onChange(result.value)
    }

    const parsed = issue ? null : parseProviderOptions(text)
    const count = parsed?.ok ? Object.keys(parsed.value).length : 0
    const message = issue && t(`llmProfiles.editor.propsErrors.${issue.code}`,
        { key: 'key' in issue ? issue.key : '', open: '{{', close: '}}' })

    return <div className="flex flex-col gap-2">
        <Field label={t('llmProfiles.editor.propsLabel')} error={message || serverError}
            helper={t('llmProfiles.editor.propsHint')}>
            <Textarea value={text} rows={5} spellCheck={false} disabled={disabled} placeholder="{}"
                className="font-mono text-label" onChange={event => update(event.target.value)} />
        </Field>
        <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-ui text-caption text-parchment-300" aria-live="polite">
                {count > 0 ? t('llmProfiles.editor.propsCount', { n: count }) : t('llmProfiles.editor.propsNone')}
            </span>
            <Button variant="ghost" size="sm" disabled={disabled || Boolean(issue) || count === 0}
                onClick={() => parsed?.ok && setText(formatProviderOptions(parsed.value))}>
                {t('llmProfiles.editor.format')}
            </Button>
        </div>
    </div>
}
