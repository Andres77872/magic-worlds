/**
 * Reverie form primitives — Field (label + helper/error wrapper) and styled
 * Input / Textarea / Select. Focus shows the ember ring.
 */
import type {
    InputHTMLAttributes,
    LabelHTMLAttributes,
    ReactNode,
    SelectHTMLAttributes,
    TextareaHTMLAttributes,
} from 'react'
import { cx } from './cx'

export const controlClass =
    'w-full bg-ink-700 text-parchment-50 placeholder:text-parchment-400 border border-parchment-50/[.13] rounded-md px-3.5 py-2.5 text-[15px] font-ui transition-all ' +
    'hover:border-parchment-50/22 focus:outline-none focus:border-ember-500 focus:shadow-[0_0_0_3px_rgba(232,162,74,.14)] ' +
    'disabled:opacity-50 disabled:cursor-not-allowed'

interface FieldProps extends LabelHTMLAttributes<HTMLLabelElement> {
    label?: ReactNode
    error?: ReactNode
    helper?: ReactNode
    children: ReactNode
}

export function Field({ label, error, helper, className, children, ...rest }: FieldProps) {
    return (
        <label className={cx('block', className)} {...rest}>
            {label && (
                <span className="mb-2 block text-[13px] font-semibold font-ui text-parchment-50">{label}</span>
            )}
            {children}
            {error && (
                <span className="mt-1.5 block text-[12px] text-blood-500">{error}</span>
            )}
            {!error && helper && (
                <span className="mt-1.5 block text-[12px] text-parchment-200">{helper}</span>
            )}
        </label>
    )
}

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
    return <input className={cx(controlClass, className)} {...rest} />
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
    return <textarea className={cx(controlClass, 'min-h-[120px] resize-y', className)} {...rest} />
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
    return (
        <select className={cx(controlClass, 'cursor-pointer', className)} {...rest}>
            {children}
        </select>
    )
}
