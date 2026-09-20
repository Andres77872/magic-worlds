import { useTranslation } from 'react-i18next'
import { LoaderCircle } from 'lucide-react'
import { cx, Icon } from '@/ui/primitives'

export type ImageGenerationStage = 'starting' | 'pending' | 'in_progress' | 'mirroring' | 'loading' | 'uploading'

interface ImageGenerationStatusProps {
    stage: ImageGenerationStage
    description?: string
    className?: string
}

/** Real job stages, with one polite announcement when the stage changes. */
export function ImageGenerationStatus({ stage, description, className }: ImageGenerationStatusProps) {
    const { t } = useTranslation()
    return (
        <div
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className={cx(
                'image-shimmer flex items-center gap-3 overflow-hidden rounded-xl border border-arcane-400/25 bg-ink-800 p-4',
                className,
            )}
        >
            <Icon icon={LoaderCircle} size={22} className="relative shrink-0 animate-spin text-arcane-300" />
            <div className="relative min-w-0 space-y-1">
                <p className="font-ui text-label font-semibold text-arcane-200">{t(`imageGeneration.stages.${stage}`)}</p>
                <p className="text-caption text-parchment-300">{description ?? t(`imageGeneration.hints.${stage}`)}</p>
            </div>
        </div>
    )
}
