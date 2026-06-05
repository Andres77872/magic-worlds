/**
 * Common form actions component for creator forms
 */

import { Button } from '@/ui/primitives';

export interface FormActionsProps {
    onCancel: () => void;
    submitLabel: string;
    cancelLabel?: string;
    isSubmitting?: boolean;
}

export function FormActions({
    onCancel,
    submitLabel,
    cancelLabel = 'Cancel',
    isSubmitting = false
}: FormActionsProps) {
    return (
        <div className="mt-8 flex justify-end gap-4 border-t-2 border-parchment-50/10 pt-6 max-sm:flex-col max-sm:gap-3">
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
    );
}
