/**
 * Danger-zone card for the profile Security tab — the irreversible
 * "delete all my data" entry. Opening the confirm dialog (a type-to-confirm
 * gate) is owned by the parent via {@link DeleteDataDialog}; this just renders
 * the warning surface and the trigger.
 */
import { Trash2, TriangleAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button, Card, Icon, SectionHeader } from '@/ui/primitives'

interface DangerZoneProps {
    /** Opens the delete-all-data confirmation dialog. */
    onRequestDelete: () => void
}

export function DangerZone({ onRequestDelete }: DangerZoneProps) {
    const { t } = useTranslation()

    return (
        <section className="flex flex-col gap-4">
            <SectionHeader icon={TriangleAlert} title={t('profile.danger.title')} />
            <Card className="border-blood-500/25">
                <div className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-col gap-1">
                        <span className="font-ui text-[14px] font-semibold text-parchment-50">{t('profile.danger.deleteAllTitle')}</span>
                        <span className="font-ui text-[13px] text-parchment-400">{t('profile.danger.deleteAllBody')}</span>
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
            </Card>
        </section>
    )
}
