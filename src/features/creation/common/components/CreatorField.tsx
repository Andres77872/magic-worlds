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
    id?: string;
    type?: string;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    required?: boolean;
    autoFocus?: boolean;
    rows?: number;
    className?: string;
}

export function CreatorInput({
    id,
    type = 'text',
    value,
    onChange,
    placeholder,
    required,
    autoFocus,
    className = ''
}: InputProps) {
    return (
        <Input
            id={id}
            className={className}
            type={type}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            required={required}
            autoFocus={autoFocus}
        />
    );
}

export function CreatorTextarea({
    id,
    value,
    onChange,
    placeholder,
    required,
    autoFocus,
    rows = 4,
    className = ''
}: InputProps) {
    return (
        <Textarea
            id={id}
            className={`leading-normal ${className}`}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            required={required}
            autoFocus={autoFocus}
            rows={rows}
        />
    );
}
