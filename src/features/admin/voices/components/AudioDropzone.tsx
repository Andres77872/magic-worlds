import { useRef, useState, type DragEvent, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckCircle2, Loader2, UploadCloud, X } from 'lucide-react'
import { cx, Icon, IconButton } from '@/ui/primitives'
import { CLONE_ACCEPT } from '../constants'

export interface AudioDropzoneSelection {
    name: string
    sizeBytes: number
    durationSec?: number | null
}

export interface AudioDropzoneProps {
    label: string
    hint: string
    selection?: AudioDropzoneSelection | null
    busy?: boolean
    error?: string
    disabled?: boolean
    onSelect: (file: File) => void
    onClear?: () => void
    compact?: boolean
}

function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function AudioDropzone({
    label,
    hint,
    selection,
    busy = false,
    error,
    disabled = false,
    onSelect,
    onClear,
    compact = false,
}: AudioDropzoneProps) {
    const { t } = useTranslation()
    const inputRef = useRef<HTMLInputElement>(null)
    const [dragActive, setDragActive] = useState(false)

    const pick = () => {
        if (disabled || busy) return
        inputRef.current?.click()
    }

    const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            pick()
        }
    }

    const onDrop = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault()
        setDragActive(false)
        if (disabled || busy) return
        const file = e.dataTransfer.files?.[0]
        if (file) onSelect(file)
    }

    return (
        <div className="flex flex-col gap-2">
            <div
                role="button"
                tabIndex={disabled ? -1 : 0}
                aria-label={label}
                aria-disabled={disabled || undefined}
                onClick={pick}
                onKeyDown={onKeyDown}
                onDragOver={(e) => {
                    e.preventDefault()
                    if (!disabled && !busy) setDragActive(true)
                }}
                onDragLeave={() => setDragActive(false)}
                onDrop={onDrop}
                className={cx(
                    'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed text-center transition-all',
                    compact ? 'px-4 py-4' : 'px-5 py-7',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-500/60',
                    dragActive
                        ? 'border-ember-500/60 bg-parchment-50/[.05]'
                        : 'border-parchment-50/15 bg-ink-800/70 hover:border-ember-500/40 hover:bg-parchment-50/[.04]',
                    (disabled || busy) && 'cursor-not-allowed opacity-60',
                )}
            >
                <Icon icon={busy ? Loader2 : UploadCloud} size={compact ? 18 : 22} className={cx('text-ember-300', busy && 'animate-spin')} />
                <p className="font-ui text-sm font-semibold text-parchment-100">
                    {busy ? t('admin.voices.dropzone.uploading') : label}
                </p>
                <p className="font-ui text-xs leading-relaxed text-parchment-400">{hint}</p>
                <input
                    ref={inputRef}
                    type="file"
                    accept={CLONE_ACCEPT}
                    className="hidden"
                    aria-hidden="true"
                    tabIndex={-1}
                    onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) onSelect(file)
                        e.target.value = ''
                    }}
                />
            </div>

            {selection && (
                <div className="flex items-center justify-between gap-2 rounded-md border border-parchment-50/[.08] bg-ink-900/50 px-3 py-2">
                    <div className="flex min-w-0 items-center gap-2">
                        <Icon icon={CheckCircle2} size={14} className="shrink-0 text-verdant-500" />
                        <span className="min-w-0 truncate font-ui text-sm text-parchment-100">{selection.name}</span>
                        <span className="shrink-0 font-mono text-[11px] text-parchment-400">
                            {formatBytes(selection.sizeBytes)}
                            {selection.durationSec ? ` · ${Math.round(selection.durationSec)}s` : ''}
                        </span>
                    </div>
                    {onClear && (
                        <IconButton label={t('admin.voices.dropzone.removeSample')} size="sm" onClick={onClear} disabled={busy}>
                            <Icon icon={X} size={14} />
                        </IconButton>
                    )}
                </div>
            )}

            {error && <p className="font-ui text-xs text-blood-500">{error}</p>}
        </div>
    )
}
