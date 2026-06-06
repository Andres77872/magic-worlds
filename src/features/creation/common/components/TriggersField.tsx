/**
 * TriggersField — chip editor for a card's trigger keywords.
 *
 * Triggers are the words that pull a character / world / adventure into the
 * scene when they appear in the adventure chat. Matching happens server-side
 * and is case-insensitive, so stored case is irrelevant — we only trim, drop
 * empties, and dedupe case-insensitively here.
 */

import { useState, type KeyboardEvent } from 'react'
import { X } from 'lucide-react'
import { Chip, Field, Icon, Input } from '@/ui/primitives'

export interface TriggersFieldProps {
    values: string[]
    onChange: (next: string[]) => void
    label?: string
    helper?: string
    placeholder?: string
}

export function TriggersField({
    values,
    onChange,
    label = 'Triggers:',
    helper = 'Keywords that pull this into the scene when mentioned in the adventure chat. Press Enter or comma to add.',
    placeholder = 'e.g. wizard, ancient ruins, the king…',
}: TriggersFieldProps) {
    const [draft, setDraft] = useState('')

    const commit = (raw: string) => {
        const next = raw.trim()
        setDraft('')
        if (!next) return
        // Dedupe case-insensitively — the server matcher casefolds both sides.
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
                    {values.map((trigger, index) => (
                        <Chip
                            key={`${trigger}-${index}`}
                            active
                            onClick={() => remove(index)}
                            title="Remove trigger"
                            icon={<Icon icon={X} size={13} />}
                        >
                            {trigger}
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
