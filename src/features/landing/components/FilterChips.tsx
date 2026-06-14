/**
 * Genre filter row for the scene gallery. "All" plus tags derived from the
 * user's own templates (so the chips always reflect real content).
 */

import { Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Chip, Icon } from '@/ui/primitives'

export interface FilterChipsProps {
    /** Genre tags derived from the data (without the leading "All"). */
    options: string[]
    /** Active filter — either "All" or one of `options`. */
    active: string
    onChange: (value: string) => void
}

export function FilterChips({ options, active, onChange }: FilterChipsProps) {
    const { t } = useTranslation()
    if (options.length === 0) return null
    return (
        <div className="flex flex-wrap gap-2">
            <Chip
                active={active === 'All'}
                onClick={() => onChange('All')}
                icon={<Icon icon={Sparkles} size={13} />}
            >
                {t('landing.begin.all')}
            </Chip>
            {options.map((option) => (
                <Chip key={option} active={active === option} onClick={() => onChange(option)}>
                    {option}
                </Chip>
            ))}
        </div>
    )
}
