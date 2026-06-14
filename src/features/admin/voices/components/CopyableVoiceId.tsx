import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Copy } from 'lucide-react'
import { cx, Icon, IconButton } from '@/ui/primitives'

/** A monospace voice-id chip with a copy-to-clipboard affordance. */
export function CopyableVoiceId({ value, compact = false }: { value: string; compact?: boolean }) {
    const { t } = useTranslation()
    const [copied, setCopied] = useState(false)

    const copy = async () => {
        try {
            await navigator.clipboard?.writeText(value)
            setCopied(true)
            window.setTimeout(() => setCopied(false), 1500)
        } catch {
            // Clipboard may be unavailable in tests or insecure contexts.
        }
    }

    return (
        <div className={cx('mt-2 flex min-w-0 items-center gap-1.5', compact && 'mt-1')}>
            <code className="min-w-0 truncate rounded-md border border-parchment-50/[.08] bg-ink-900 px-2 py-1 font-mono text-xs text-parchment-300">
                {value}
            </code>
            <IconButton label={copied ? t('admin.voices.copyId.copied') : t('admin.voices.copyId.copy')} size="sm" onClick={copy}>
                <Icon icon={copied ? Check : Copy} size={14} className={copied ? 'text-verdant-500' : undefined} />
            </IconButton>
        </div>
    )
}
