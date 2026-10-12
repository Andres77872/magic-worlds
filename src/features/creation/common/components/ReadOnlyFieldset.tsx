/**
 * ReadOnlyFieldset — a borderless `<fieldset>` that disables every native
 * control inside it (inputs, selects, textareas, buttons) at once. The creators
 * wrap their fields in it while the card's workspace is archived (Workspace R1,
 * document 08: an archived workspace is read-only until it is restored).
 */
import type { ReactNode } from 'react'
import { cx } from '@/ui/primitives'

export function ReadOnlyFieldset({ disabled, className, children }: { disabled: boolean; className?: string; children: ReactNode }) {
    return (
        <fieldset disabled={disabled} aria-disabled={disabled || undefined} className={cx('m-0 min-w-0 border-0 p-0', className)}>
            {children}
        </fieldset>
    )
}
