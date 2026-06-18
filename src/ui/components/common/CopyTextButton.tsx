import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Copy } from 'lucide-react'
import { Icon, IconButton, type IconButtonSize } from '@/ui/primitives'
import { writeClipboardText } from './clipboard'

const COPIED_FEEDBACK_MS = 1500

export interface CopyTextButtonProps {
    text: string
    size?: IconButtonSize
    disabled?: boolean
    className?: string
    copyLabel?: string
    copiedLabel?: string
    onError?: (error: unknown) => void
}

/** Icon-only copy affordance with local checkmark feedback. */
export function CopyTextButton({
    text,
    size = 'sm',
    disabled = false,
    className,
    copyLabel,
    copiedLabel,
    onError,
}: CopyTextButtonProps) {
    const { t } = useTranslation()
    const copiedTimerRef = useRef<number | null>(null)
    const [copied, setCopied] = useState(false)
    const canCopy = !disabled && text.length > 0
    const label = copied
        ? copiedLabel ?? t('common.messageCopied')
        : copyLabel ?? t('common.copyMessage')

    useEffect(() => {
        return () => {
            if (copiedTimerRef.current !== null) window.clearTimeout(copiedTimerRef.current)
        }
    }, [])

    const handleCopy = async () => {
        if (!canCopy) return
        try {
            await writeClipboardText(text)
            setCopied(true)
            if (copiedTimerRef.current !== null) window.clearTimeout(copiedTimerRef.current)
            copiedTimerRef.current = window.setTimeout(() => {
                setCopied(false)
                copiedTimerRef.current = null
            }, COPIED_FEEDBACK_MS)
        } catch (error) {
            onError?.(error)
        }
    }

    return (
        <IconButton
            label={label}
            size={size}
            disabled={!canCopy}
            className={className}
            onClick={() => void handleCopy()}
        >
            <Icon icon={copied ? Check : Copy} size={14} className={copied ? 'text-verdant-500' : undefined} />
        </IconButton>
    )
}
