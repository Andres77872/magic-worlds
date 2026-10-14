import { useTranslation } from 'react-i18next'
import { Coins } from 'lucide-react'
import { ConfirmDialog } from '@/ui/components/ConfirmDialog'
import { Icon } from '@/ui/primitives'
import type { PreviewCreditConfirm } from '../usePreviewCreditConfirm'

interface PreviewCreditDialogProps {
    confirm: PreviewCreditConfirm
}

/**
 * The one-time "previews now cost 1 credit" confirmation (AC-P5, 05 §6.3),
 * driven by `usePreviewCreditConfirm`. Built on the Modal, so it stacks over
 * the editor drawer: Escape closes it alone and focus returns to the button.
 */
export function PreviewCreditDialog({ confirm }: PreviewCreditDialogProps) {
    const { t } = useTranslation()
    return (
        <ConfirmDialog
            visible={confirm.open}
            title={t('voices.preview.confirmCreditTitle')}
            message={t('voices.preview.confirmCredit')}
            icon={<Icon icon={Coins} size={18} className="text-ember-400" />}
            confirmLabel={t('voices.preview.confirmCreditAction')}
            cancelLabel={t('common.cancel')}
            onConfirm={confirm.confirm}
            onCancel={confirm.cancel}
        />
    )
}
