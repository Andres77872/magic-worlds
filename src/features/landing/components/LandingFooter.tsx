import { useState } from 'react'
import { FiTrash2 } from 'react-icons/fi'
import { ConfirmDialog } from '../../../ui/components'
import './LandingFooter.css'

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
            <footer className="landing-footer">
                {hasContent && (
                    <button 
                        className="btn btn-danger btn-sm"
                        onClick={() => setConfirmClear(true)}
                        aria-describedby="clear-warning"
                    >
                        <FiTrash2 aria-hidden="true" />
                        Clear All Data
                    </button>
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