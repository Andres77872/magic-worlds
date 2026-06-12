import { ArrowRight, Sparkles } from 'lucide-react'
import type { ForwardOption } from '../../../shared'
import { Eyebrow } from '../../../ui/primitives'

interface ForwardOptionsProps {
    options?: ForwardOption[]
    onOptionClick: (message: string) => void
}

export function ForwardOptions({ options, onOptionClick }: ForwardOptionsProps) {
    if (!options?.length) {
        return null
    }

    return (
        <div className="mt-3 w-full">
            <div className="mb-2 flex items-center gap-2">
                <Eyebrow tone="arcane">Suggested Actions</Eyebrow>
            </div>
            <div className="flex flex-col gap-2">
                {options.map((option, index) => (
                    <button
                        key={index}
                        className="group flex items-center gap-2.5 rounded-lg border border-arcane-500/30 bg-arcane-500/10 px-3.5 py-2.5 text-left text-[14px] text-parchment-100 transition-all hover:border-arcane-500/50 hover:bg-arcane-500/15"
                        onClick={() => onOptionClick(option.message)}
                        title={option.message}
                    >
                        <Sparkles size={15} strokeWidth={1.75} className="shrink-0 text-arcane-300" />
                        <span className="flex-1">{option.label}</span>
                        <ArrowRight
                            size={15}
                            strokeWidth={1.75}
                            className="shrink-0 text-arcane-300 transition-transform group-hover:translate-x-0.5"
                        />
                    </button>
                ))}
            </div>
        </div>
    )
}
