/**
 * FieldPalette — the "add a field" row of dormant recommended props. Each chip
 * activates a guided field; removed fields return here, so the palette is also
 * how an empty card grows its structure.
 */
import { useTranslation } from 'react-i18next'
import { Plus } from 'lucide-react'
import { Chip, Icon } from '@/ui/primitives'
import type { CardFieldDefinition } from './types'

export interface FieldPaletteProps {
    fields: CardFieldDefinition[]
    onAdd: (fieldId: string) => void
    label?: string
}

export function FieldPalette({ fields, onAdd, label }: FieldPaletteProps) {
    const { t } = useTranslation()
    if (fields.length === 0) return null
    return (
        <div className="flex flex-col gap-2">
            <span className="font-ui text-[12px] font-semibold uppercase tracking-[0.14em] text-parchment-400">
                {label ?? t('creation.common.fieldPalette.addLabel')}
            </span>
            <div className="flex flex-wrap gap-2">
                {fields.map((field) => (
                    <Chip
                        key={field.id}
                        onClick={() => onAdd(field.id)}
                        icon={<Icon icon={Plus} size={13} />}
                        title={field.helper ?? t('creation.common.fieldPalette.addTitle', { label: field.label })}
                    >
                        {field.label}
                    </Chip>
                ))}
            </div>
        </div>
    )
}
