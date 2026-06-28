import type {ReactNode} from 'react';
import {useTranslation} from 'react-i18next';
import {Button, Eyebrow} from '@/ui/primitives';

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
    const { t } = useTranslation()

    return (
        <div
            className={`col-[1/-1] my-4 flex w-full flex-col items-center justify-center rounded-md border border-dashed border-parchment-50/20 bg-ink-700 px-4 py-6 text-center text-parchment-400 ${className}`}
        >
            {icon && (
                <div className="mb-4 flex items-center justify-center text-parchment-500">
                    {icon}
                </div>
            )}
            <Eyebrow tone="muted" className="mb-2">{t('emptyState.eyebrow')}</Eyebrow>
            <h3 className="m-0 font-display text-h3 font-semibold text-parchment-50">
                {message}
            </h3>
            {secondaryText && (
                <p className="mx-auto mb-4 mt-2 max-w-[400px] font-narrative leading-normal text-parchment-400">
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
