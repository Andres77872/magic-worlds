/**
 * StringListField — small chip editor for short string arrays.
 */

import { useState, type KeyboardEvent } from 'react'
import { X } from 'lucide-react'
import { Chip, Field, Icon, Input } from '@/ui/primitives'

export interface StringListFieldProps {
    values: string[]
    onChange: (next: string[]) => void
    label: string
    helper?: string
    placeholder?: string
    removeLabel?: string
}

export function StringListField({
    values,
    onChange,
    label,
    helper,
    placeholder,
    removeLabel = 'Remove item',
}: StringListFieldProps) {
    const [draft, setDraft] = useState('')

    const commit = (raw: string) => {
        const next = raw.trim()
        setDraft('')
        if (!next) return
        if (values.some((value) => value.toLowerCase() === next.toLowerCase())) return
        onChange([...values, next])
    }

    const remove = (index: number) => {
        onChange(values.filter((_, i) => i !== index))
    }

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault()
            commit(draft)
        } else if (e.key === 'Backspace' && !draft && values.length > 0) {
            remove(values.length - 1)
        }
    }

    return (
        <Field label={label} helper={helper}>
            {values.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-2">
                    {values.map((value, index) => (
                        <Chip
                            key={`${value}-${index}`}
                            active
                            onClick={() => remove(index)}
                            title={removeLabel}
                            icon={<Icon icon={X} size={13} />}
                        >
                            {value}
                        </Chip>
                    ))}
                </div>
            )}
            <Input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={() => commit(draft)}
                placeholder={placeholder}
            />
        </Field>
    )
}
