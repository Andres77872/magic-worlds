import { useTranslation } from 'react-i18next'
import { CornerDownRight, Sparkles } from 'lucide-react'
import type { ForwardOption } from '../../../shared'
import { Eyebrow } from '../../../ui/primitives'

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
        <div className="mt-3 w-full">
            <div className="mb-2 flex items-center gap-3">
                <Eyebrow tone="arcane">{t('interaction.forwardOptions.title')}</Eyebrow>
                <span className="h-px flex-1 bg-parchment-50/10" aria-hidden />
            </div>
            <div className="flex flex-col gap-1.5">
                {options.map((option, index) => (
                    <button
                        key={index}
                        className="group flex items-center gap-2.5 rounded-lg border border-arcane-500/25 bg-arcane-500/[.08] px-3.5 py-2 text-left text-[14px] text-parchment-100 transition-all hover:border-arcane-500/50 hover:bg-arcane-500/15"
                        onClick={() => onOptionClick(option.message)}
                        title={option.message}
                    >
                        <Sparkles
                            size={15}
                            strokeWidth={1.75}
                            className="shrink-0 text-arcane-400 transition-colors group-hover:text-arcane-300"
                        />
                        <span className="flex-1">{option.label}</span>
                        {/* Reads "insert into your reply", not "send" — a click only fills the composer.
                            Hidden until hover so the row stays calm at rest. */}
                        <CornerDownRight
                            size={15}
                            strokeWidth={1.75}
                            aria-hidden
                            className="shrink-0 text-arcane-300 opacity-0 transition-opacity group-hover:opacity-100"
                        />
                    </button>
                ))}
            </div>
        </div>
    )
}
