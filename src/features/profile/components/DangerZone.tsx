/**
 * Danger-zone card for the profile Security tab — the irreversible
 * "delete all my data" entry. Opening the confirm dialog (a type-to-confirm
 * gate) is owned by the parent via {@link DeleteDataDialog}; this just renders
 * the warning surface and the trigger.
 */
import { Trash2, TriangleAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button, Icon, SectionHeader } from '@/ui/primitives'

interface DangerZoneProps {
    /** Opens the delete-all-data confirmation dialog. */
    onRequestDelete: () => void
}

export function DangerZone({ onRequestDelete }: DangerZoneProps) {
    const { t } = useTranslation()

    return (
        <section className="flex flex-col gap-4 border-t border-line-faint pt-6">
            <SectionHeader icon={TriangleAlert} title={t('profile.danger.title')} />
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-col gap-1">
                    <span className="font-ui text-sm font-semibold text-parchment-50">{t('profile.danger.deleteAllTitle')}</span>
                    <span className="font-ui text-label text-parchment-400">{t('profile.danger.deleteAllBody')}</span>
                </div>
                <Button
                    variant="danger"
                    size="sm"
                    iconLeft={<Icon icon={Trash2} size={15} />}
                    onClick={onRequestDelete}
                    className="shrink-0"
                >
                    {t('profile.danger.deleteAllAction')}
                </Button>
            </div>
        </section>
    )
}
