/**
 * Common field component for creator forms — delegates to the Reverie <Field>
 * primitive. Help text is shown inline (no floating popover that can overflow).
 */

import type { ReactNode } from 'react';
import { Field, Input, Textarea } from '@/ui/primitives';

export interface CreatorFieldProps {
    label: string;
    htmlFor?: string;
    required?: boolean;
    /** Optional helper text rendered inline beneath the control. */
    tooltip?: string;
    /** Inline validation error — takes priority over the helper text. */
    error?: ReactNode;
    children: ReactNode;
    className?: string;
}

export function CreatorField({
    label,
    htmlFor,
    required = false,
    tooltip,
    error,
    children,
    className = ''
}: CreatorFieldProps) {
    const labelNode = (
        <>
            {label}
            {required && <span className="ml-1 text-blood-500">*</span>}
        </>
    );

    return (
        <Field label={labelNode} htmlFor={htmlFor} helper={tooltip} error={error} className={className}>
            {children}
        </Field>
    );
}

interface InputProps {
    'aria-label'?: string;
    id?: string;
    type?: string;
    value: string;
    onChange: (value: string) => void;
    /** Blur hook — creators use it to mark a required field as touched. */
    onBlur?: () => void;
    placeholder?: string;
    required?: boolean;
    autoFocus?: boolean;
    rows?: number;
    maxLength?: number;
    className?: string;
}

export function CreatorInput({
    'aria-label': ariaLabel,
    id,
    type = 'text',
    value,
    onChange,
    onBlur,
    placeholder,
    required,
    autoFocus,
    maxLength,
    className = ''
}: InputProps) {
    return (
        <Input
            aria-label={ariaLabel}
            id={id}
            className={className}
            type={type}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
            placeholder={placeholder}
            required={required}
            autoFocus={autoFocus}
            maxLength={maxLength}
        />
    );
}

export function CreatorTextarea({
    'aria-label': ariaLabel,
    id,
    value,
    onChange,
    onBlur,
    placeholder,
    required,
    autoFocus,
    rows = 4,
    maxLength,
    className = ''
}: InputProps) {
    return (
        <Textarea
            aria-label={ariaLabel}
            id={id}
            className={`leading-normal ${className}`}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
            placeholder={placeholder}
            required={required}
            autoFocus={autoFocus}
            rows={rows}
            maxLength={maxLength}
        />
    );
}
