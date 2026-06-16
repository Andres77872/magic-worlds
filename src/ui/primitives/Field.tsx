/**
 * Reverie form primitives — Field (label + helper/error wrapper) and styled
 * Input / Textarea. Focus shows the ember ring.
 *
 * Field renders a real <label htmlFor> wired to the control through
 * FieldContext, so button-based controls (Select, Switch) can live inside a
 * Field without label-click double-activation.
 */
import {
    useId,
    type HTMLAttributes,
    type InputHTMLAttributes,
    type ReactNode,
    type TextareaHTMLAttributes,
} from 'react'
import { cx } from './cx'
import { FieldContext, useFieldContext } from './fieldContext'

/** Shared control look minus sizing — composed into size variants below. The
 *  candlelit `shadow-input-focus` (1px ember edge + soft glow) is more integrated
 *  than the global 4px focus ring, and overrides it on keyboard focus. */
export const controlBaseClass =
    'w-full bg-surface-raised text-fg placeholder:text-fg-faint border border-line rounded-md font-ui transition-all ' +
    'hover:border-line-strong focus-visible:outline-none focus-visible:border-ember-500 focus-visible:shadow-input-focus ' +
    'aria-invalid:border-blood-500/60 disabled:opacity-50 disabled:cursor-not-allowed'

export const controlClass = controlBaseClass + ' px-3.5 py-2.5 text-[15px]'

interface FieldProps extends HTMLAttributes<HTMLDivElement> {
    label?: ReactNode
    error?: ReactNode
    helper?: ReactNode
    htmlFor?: string
    children: ReactNode
}

export function Field({ label, error, helper, htmlFor, className, children, ...rest }: FieldProps) {
    const generatedId = useId()
    const controlId = htmlFor ?? generatedId
    // Wire the visible error/helper text to the control via aria-describedby so
    // screen readers announce it on focus (error takes precedence over helper).
    const messageId = error ? `${controlId}-error` : helper ? `${controlId}-helper` : undefined
    return (
        <div className={cx('block', className)} {...rest}>
            {label && (
                <label htmlFor={controlId} className="mb-2 block text-label font-semibold font-ui text-fg">
                    {label}
                </label>
            )}
            <FieldContext.Provider value={{ id: controlId, invalid: Boolean(error), describedById: messageId }}>
                {children}
            </FieldContext.Provider>
            {error && (
                <span id={messageId} className="mt-1.5 block text-caption text-blood-500">{error}</span>
            )}
            {!error && helper && (
                <span id={messageId} className="mt-1.5 block text-caption text-fg-muted">{helper}</span>
            )}
        </div>
    )
}

export function Input({ className, id, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
    const ctx = useFieldContext()
    return (
        <input
            id={id ?? ctx?.id}
            aria-invalid={ctx?.invalid || undefined}
            aria-describedby={ctx?.describedById}
            className={cx(controlClass, className)}
            {...rest}
        />
    )
}

export function Textarea({ className, id, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
    const ctx = useFieldContext()
    return (
        <textarea
            id={id ?? ctx?.id}
            aria-invalid={ctx?.invalid || undefined}
            aria-describedby={ctx?.describedById}
            className={cx(controlClass, 'min-h-[120px] resize-y', className)}
            {...rest}
        />
    )
}
