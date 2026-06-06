/**
 * AiGeneratePanel — the "Generate with AI" affordance shared by every creator.
 *
 * The backend AI endpoints generate AND persist the card, then return it, so on
 * success the creator typically reloads its data and navigates away. This panel
 * owns only the description input + busy/error state and delegates the actual
 * call to `onGenerate`, which must throw on failure so the error surfaces here.
 */

import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { Button, Icon, SectionHeader } from '@/ui/primitives'
import { CreatorTextarea } from './CreatorField'

export interface AiGeneratePanelProps {
    /** Lower-case card noun, e.g. "character" — used in copy and the button. */
    noun: string
    placeholder?: string
    onGenerate: (description: string) => Promise<void>
}

export function AiGeneratePanel({ noun, placeholder, onGenerate }: AiGeneratePanelProps) {
    const [description, setDescription] = useState('')
    const [isGenerating, setIsGenerating] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const label = noun.charAt(0).toUpperCase() + noun.slice(1)

    const handleGenerate = async () => {
        const prompt = description.trim()
        if (!prompt || isGenerating) return
        setIsGenerating(true)
        setError(null)
        try {
            await onGenerate(prompt)
            // On success the creator reloads and navigates away — nothing to do.
        } catch (err) {
            setError(err instanceof Error ? err.message : `Failed to generate ${noun}. Please try again.`)
            setIsGenerating(false)
        }
    }

    return (
        <div className="flex flex-col gap-4 rounded-md border border-arcane-500/30 bg-arcane-500/[.06] p-6">
            <SectionHeader icon={Sparkles} tone="arcane" title="Generate with AI" />
            <p className="font-narrative text-sm text-parchment-400">
                Describe the {noun} you have in mind and let the AI draft it — you can refine it afterwards.
            </p>
            <CreatorTextarea
                id={`ai-generate-${noun}`}
                value={description}
                onChange={setDescription}
                placeholder={placeholder ?? `Describe the ${noun}…`}
                rows={3}
            />
            {error && <p className="text-sm text-blood-500">{error}</p>}
            <div className="flex justify-end">
                <Button
                    kind="arcane"
                    onClick={handleGenerate}
                    disabled={!description.trim() || isGenerating}
                    iconLeft={<Icon icon={Sparkles} size={16} />}
                >
                    {isGenerating ? 'Generating…' : `Generate ${label}`}
                </Button>
            </div>
        </div>
    )
}
