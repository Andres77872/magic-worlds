/**
 * Common form actions component for creator forms
 */

import { useTranslation } from 'react-i18next';
import { Button } from '@/ui/primitives';

export interface FormActionsProps {
    onCancel: () => void;
    submitLabel: string;
    cancelLabel?: string;
    isSubmitting?: boolean;
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
    error = null
}: FormActionsProps) {
    const { t } = useTranslation();
    const resolvedCancelLabel = cancelLabel ?? t('common.cancel');
    return (
        <div className="mt-8 border-t-2 border-parchment-50/10 pt-6">
            {error && (
                <p
                    role="status"
                    aria-live="polite"
                    className="mb-4 rounded-md border border-parchment-50/10 bg-parchment-50/5 px-4 py-3 font-ui text-[13px] text-parchment-200"
                >
                    {error}
                </p>
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
                    disabled={isSubmitting}
                    className="max-sm:w-full"
                >
                    {isSubmitting ? t('creation.common.formActions.saving') : submitLabel}
                </Button>
            </div>
        </div>
    );
}
