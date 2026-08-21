/**
 * Common form actions component for creator forms
 */

import { useTranslation } from 'react-i18next';
import { Button, Callout } from '@/ui/primitives';

export interface FormActionsProps {
    onCancel: () => void;
    submitLabel: string;
    cancelLabel?: string;
    isSubmitting?: boolean;
    /** Disable submit without the "saving…" label (e.g. read-only historical version view). */
    disabled?: boolean;
    /**
     * Gentle inline message shown above the buttons when a save fails — keeps the
     * form intact so the user can simply retry, instead of a blocking alert().
     */
    error?: string | null;
}

export function FormActions({
    onCancel,
    submitLabel,
    cancelLabel,
    isSubmitting = false,
    disabled = false,
    error = null
}: FormActionsProps) {
    const { t } = useTranslation();
    const resolvedCancelLabel = cancelLabel ?? t('common.cancel');
    return (
        <div className="mt-8 border-t-2 border-parchment-50/10 pt-6">
            {error && (
                <Callout tone="danger" role="alert" className="mb-4 text-[13px]">
                    {error}
                </Callout>
            )}
            <div className="flex justify-end gap-4 max-sm:flex-col max-sm:gap-3">
                <Button
                    variant="secondary"
                    onClick={onCancel}
                    disabled={isSubmitting}
                    className="max-sm:w-full"
                >
                    {resolvedCancelLabel}
                </Button>
                <Button
                    variant="primary"
                    type="submit"
                    disabled={isSubmitting || disabled}
                    className="max-sm:w-full"
                >
                    {isSubmitting ? t('creation.common.formActions.saving') : submitLabel}
                </Button>
            </div>
        </div>
    );
}
