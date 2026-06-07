/**
 * Common form actions component for creator forms
 */

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
    cancelLabel = 'Cancel',
    isSubmitting = false,
    error = null
}: FormActionsProps) {
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
                    kind="secondary"
                    onClick={onCancel}
                    disabled={isSubmitting}
                    className="max-sm:w-full"
                >
                    {cancelLabel}
                </Button>
                <Button
                    kind="primary"
                    type="submit"
                    disabled={isSubmitting}
                    className="max-sm:w-full"
                >
                    {isSubmitting ? 'Saving...' : submitLabel}
                </Button>
            </div>
        </div>
    );
}
