import { LogOut } from 'lucide-react'
import { Button, Icon, Modal } from '../primitives'

interface LogoutConfirmDialogProps {
    open: boolean
    username?: string | null
    onCancel: () => void
    onConfirm: () => void
}

export function LogoutConfirmDialog({ open, username, onCancel, onConfirm }: LogoutConfirmDialogProps) {
    return (
        <Modal
            open={open}
            onClose={onCancel}
            title="Log out?"
            icon={<Icon icon={LogOut} size={21} className="text-ember-400" />}
            showClose={false}
            footer={
                <>
                    <Button kind="secondary" onClick={onCancel}>
                        Cancel
                    </Button>
                    <Button kind="primary" onClick={onConfirm} iconLeft={<Icon icon={LogOut} size={16} />}>
                        Log out
                    </Button>
                </>
            }
        >
            <div className="flex flex-col gap-3 text-[15px] leading-relaxed text-parchment-200">
                <p>
                    {username ? (
                        <>
                            You are signed in as{' '}
                            <span className="font-ui font-semibold text-parchment-50">{username}</span>.
                        </>
                    ) : (
                        'You are signed in.'
                    )}
                </p>
                <p>Confirm to end this session on this device. Any unsaved changes in open forms may be lost.</p>
            </div>
        </Modal>
    )
}
