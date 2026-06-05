import { cx } from '../../../ui/primitives'

interface ChatImageProps {
    imageUrl: string
    isAssistant: boolean
    alt?: string
}

export function ChatImage({ imageUrl, isAssistant, alt = 'Generated scene' }: ChatImageProps) {
    return (
        <div
            className={cx(
                'mt-2 max-w-[420px] overflow-hidden rounded-lg border border-parchment-50/10 shadow-md',
                !isAssistant && 'ml-auto',
            )}
        >
            <img src={imageUrl} alt={alt} className="block h-auto w-full" loading="lazy" />
        </div>
    )
}
