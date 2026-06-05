import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { ConfirmDialog } from '../../../ui/components'
import { Button, Icon } from '../../../ui/primitives'

interface LandingFooterProps {
    hasContent: boolean
    onClearAll: () => Promise<void>
}

export function LandingFooter({ hasContent, onClearAll }: LandingFooterProps) {
    const [confirmClear, setConfirmClear] = useState(false)

    const handleClearAll = async () => {
        await onClearAll()
        setConfirmClear(false)
    }

    return (
        <>
            <footer className="relative z-[2] mt-auto border-t border-parchment-50/10 bg-ink-900 px-4 py-12 text-center sm:px-6">
                {hasContent && (
                    <Button
                        kind="danger"
                        size="sm"
                        onClick={() => setConfirmClear(true)}
                        aria-describedby="clear-warning"
                        iconLeft={<Icon icon={Trash2} size={16} />}
                    >
                        Clear All Data
                    </Button>
                )}
                <p id="clear-warning" className="sr-only">
                    This action will permanently delete all your characters, worlds, and adventures
                </p>
            </footer>

            {confirmClear && (
                <ConfirmDialog
                    visible={confirmClear}
                    title="Clear All Data"
                    message="Are you sure you want to delete all characters, worlds, and adventures? This action cannot be undone."
                    onConfirm={handleClearAll}
                    onCancel={() => setConfirmClear(false)}
                />
            )}
        </>
    )
}
