/**
 * Common field component for creator forms
 */

import type { ReactNode } from 'react';
import { FaQuestionCircle } from 'react-icons/fa';
import '../styles/CreatorField.css';

export interface CreatorFieldProps {
    label: string;
    htmlFor?: string;
    required?: boolean;
    tooltip?: string;
    children: ReactNode;
    className?: string;
}

export function CreatorField({
    label,
    htmlFor,
    required = false,
    tooltip,
    children,
    className = ''
}: CreatorFieldProps) {
    return (
        <div className={`creator-field ${className}`}>
            <label className="creator-field-label" htmlFor={htmlFor}>
                {label}
                {required && <span className="creator-field-required">*</span>}
            </label>
            <div className="creator-field-wrapper">
                <div className="creator-field-input-wrapper">
                    {children}
                </div>
                {tooltip && (
                    <span className="creator-tooltip-trigger">
                        <FaQuestionCircle />
                        <div className="creator-tooltip">
                            {tooltip}
                        </div>
                    </span>
                )}
            </div>
        </div>
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
        <input
            id={id}
            className={`creator-field-input ${className}`}
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
        <textarea
            id={id}
            className={`creator-field-textarea ${className}`}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            required={required}
            autoFocus={autoFocus}
            rows={rows}
        />
    );
} 