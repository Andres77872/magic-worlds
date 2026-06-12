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

/** Shared control look minus sizing — composed into size variants below. */
export const controlBaseClass =
    'w-full bg-ink-700 text-parchment-50 placeholder:text-parchment-400 border border-parchment-50/[.13] rounded-md font-ui transition-all ' +
    'hover:border-parchment-50/22 focus:outline-none focus:border-ember-500 focus:shadow-[0_0_0_3px_rgba(232,162,74,.14)] ' +
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
    return (
        <div className={cx('block', className)} {...rest}>
            {label && (
                <label htmlFor={controlId} className="mb-2 block text-[13px] font-semibold font-ui text-parchment-50">
                    {label}
                </label>
            )}
            <FieldContext.Provider value={{ id: controlId, invalid: Boolean(error) }}>
                {children}
            </FieldContext.Provider>
            {error && (
                <span className="mt-1.5 block text-[12px] text-blood-500">{error}</span>
            )}
            {!error && helper && (
                <span className="mt-1.5 block text-[12px] text-parchment-200">{helper}</span>
            )}
        </div>
    )
}

export function Input({ className, id, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
    const ctx = useFieldContext()
    return <input id={id ?? ctx?.id} aria-invalid={ctx?.invalid || undefined} className={cx(controlClass, className)} {...rest} />
}

export function Textarea({ className, id, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
    const ctx = useFieldContext()
    return (
        <textarea
            id={id ?? ctx?.id}
            aria-invalid={ctx?.invalid || undefined}
            className={cx(controlClass, 'min-h-[120px] resize-y', className)}
            {...rest}
        />
    )
}
