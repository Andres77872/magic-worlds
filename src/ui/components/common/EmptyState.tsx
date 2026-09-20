import type {ReactNode} from 'react';
import {Button, cx} from '@/ui/primitives';

interface EmptyStateProps {
    /** The main message to display */
    message: string;
    /** Optional icon to display above the message */
    icon?: ReactNode;
    /** Optional secondary text to display below the main message */
    secondaryText?: string;
    /** Optional button to display below the message */
    button?: {
        label: string;
        onClick: () => void;
        className?: string;
    };
    /** Additional class name for the container */
    className?: string;
    /** Optional custom action node rendered below the message/button. */
    children?: ReactNode;
}

export function EmptyState({
                               message,
                               icon,
                               secondaryText,
                               button,
                           className = '',
                           children,
                       }: EmptyStateProps) {
    return (
        <div
            className={cx('col-[1/-1] my-4 flex min-w-0 w-full flex-col items-center justify-center px-4 py-10 text-center text-fg-subtle', className)}
        >
            {icon && (
                <div aria-hidden="true" className="mb-4 flex items-center justify-center text-fg-subtle">
                    {icon}
                </div>
            )}
            <h3 className="m-0 font-display text-h3 font-semibold text-parchment-50">
                {message}
            </h3>
            {secondaryText && (
                <p className="mx-auto mb-4 mt-2 max-w-sm font-ui text-body text-fg-subtle">
                    {secondaryText}
                </p>
            )}
            {button && (
                <Button
                    variant="primary"
                    className={`mt-2 ${button.className || ''}`}
                    onClick={button.onClick}
                >
                    {button.label}
                </Button>
            )}
            {children}
        </div>
    );
}
