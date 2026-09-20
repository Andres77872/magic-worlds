import { useTranslation } from 'react-i18next'
import { CornerDownRight, Sparkles } from 'lucide-react'
import type { ForwardOption } from '../../../shared'
import { Button, Eyebrow } from '@/ui/primitives'

interface ForwardOptionsProps {
    options?: ForwardOption[]
    onOptionClick: (message: string) => void
}

export function ForwardOptions({ options, onOptionClick }: ForwardOptionsProps) {
    const { t } = useTranslation()
    if (!options?.length) {
        return null
    }

    return (
        <div className="mt-2 w-full border-t border-parchment-50/10 pt-3">
            <div className="mb-1 flex items-center gap-2">
                <Sparkles size={14} strokeWidth={1.75} className="text-arcane-300" aria-hidden />
                <Eyebrow tone="arcane">{t('interaction.forwardOptions.title')}</Eyebrow>
            </div>
            <ul className="m-0 flex list-none flex-col p-0">
                {options.map((option, index) => (
                    <li key={index}>
                        <Button
                            variant="ghost"
                            size="sm"
                            full
                            className="group min-h-11 justify-start gap-3 whitespace-normal! text-left font-normal!"
                            onClick={() => onOptionClick(option.message)}
                            title={option.message}
                        >
                            <span className="min-w-0 flex-1 break-words">{option.label}</span>
                            {/* A suggestion fills the composer; the player can edit it before sending. */}
                            <CornerDownRight
                                size={15}
                                strokeWidth={1.75}
                                aria-hidden
                                className="shrink-0 text-parchment-400 transition-colors group-hover:text-arcane-300 group-focus-visible:text-arcane-300"
                            />
                        </Button>
                    </li>
                ))}
            </ul>
        </div>
    )
}
