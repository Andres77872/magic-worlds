/**
 * Docs search input. The visible line under it shows the live match count (or
 * the keyboard hint when idle); a separate visually hidden status region
 * announces the count only once typing settles, and focus never moves.
 */
import { useId, type RefObject } from 'react'
import { Search, X } from 'lucide-react'
import { Icon } from '@/ui/primitives'

interface DocsSearchFieldProps {
    inputRef: RefObject<HTMLInputElement | null>
    value: string
    onChange: (value: string) => void
    label: string
    placeholder: string
    clearLabel: string
    shortcut: { modifier: string; hint: string }
    /** Visible match count while filtering, else empty. */
    resultText: string
    /** Debounced copy of `resultText` for the live region. */
    announcement: string
}

const KBD = 'rounded-xs border border-line bg-surface-raised px-1.5 py-px font-mono text-meta text-fg-muted'

export function DocsSearchField({
    inputRef,
    value,
    onChange,
    label,
    placeholder,
    clearLabel,
    shortcut,
    resultText,
    announcement,
}: DocsSearchFieldProps) {
    const statusId = useId()
    return (
        <div className="w-full min-w-0 md:max-w-sm">
            <div className="relative">
                <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle">
                    <Icon icon={Search} size={16} />
                </span>
                <input
                    ref={inputRef}
                    type="search"
                    aria-label={label}
                    aria-describedby={statusId}
                    aria-keyshortcuts="Control+K Meta+K"
                    placeholder={placeholder}
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                    onKeyDown={(event) => {
                        if (event.key === 'Escape' && value) {
                            event.preventDefault()
                            onChange('')
                        }
                    }}
                    className="h-11 w-full rounded-md border border-line bg-ink-900/70 pl-9 pr-10 font-ui text-sm text-fg transition-colors placeholder:text-fg-faint hover:border-line-strong focus:border-ember-500/50 [&::-webkit-search-cancel-button]:appearance-none"
                />
                {value && (
                    <button
                        type="button"
                        aria-label={clearLabel}
                        onClick={() => {
                            onChange('')
                            inputRef.current?.focus()
                        }}
                        className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-fg-subtle transition-colors hover:bg-parchment-50/[.06] hover:text-fg"
                    >
                        <Icon icon={X} size={15} />
                    </button>
                )}
            </div>
            <p id={statusId} className="m-0 mt-1.5 min-h-[18px] font-ui text-caption text-fg-subtle">
                {resultText || (
                    <span className="hidden items-center gap-1 sm:inline-flex">
                        <kbd className={KBD}>{shortcut.modifier}</kbd>
                        <kbd className={KBD}>K</kbd>
                        <span className="ml-0.5">{shortcut.hint}</span>
                    </span>
                )}
            </p>
            <p role="status" className="sr-only">
                {announcement}
            </p>
        </div>
    )
}
