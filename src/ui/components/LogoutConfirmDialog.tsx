import { LogOut } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button, Icon, Modal } from '../primitives'

interface LogoutConfirmDialogProps {
    open: boolean
    username?: string | null
    onCancel: () => void
    onConfirm: () => void
}

export function LogoutConfirmDialog({ open, username, onCancel, onConfirm }: LogoutConfirmDialogProps) {
    const { t } = useTranslation()

    return (
        <Modal
            open={open}
            onClose={onCancel}
            title={t('logout.title')}
            icon={<Icon icon={LogOut} size={21} className="text-ember-400" />}
            showClose={false}
            footer={
                <>
                    <Button kind="secondary" onClick={onCancel}>
                        {t('logout.cancel')}
                    </Button>
                    <Button kind="primary" onClick={onConfirm} iconLeft={<Icon icon={LogOut} size={16} />}>
                        {t('logout.confirm')}
                    </Button>
                </>
            }
        >
            <div className="flex flex-col gap-3 text-[15px] leading-relaxed text-parchment-200">
                <p>
                    {username ? (
                        <>
                            {t('logout.signedInAs')}{' '}
                            <span className="font-ui font-semibold text-parchment-50">{username}</span>.
                        </>
                    ) : (
                        t('logout.signedIn')
                    )}
                </p>
                <p>{t('logout.body')}</p>
            </div>
        </Modal>
    )
}
