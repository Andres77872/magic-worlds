import type { ReactNode } from 'react'
import '../App.css'

/**
 * A modal confirmation dialog.
 * Renders over content when visible.
 */
export function ConfirmDialog({
  visible,
  message,
  onConfirm,
  onCancel,
}: {
  visible: boolean
  message: string | ReactNode
  onConfirm: () => void
  onCancel: () => void
}) {
  if (!visible) return null
  return (
    <div className="confirm-overlay">
      <div className="confirm-dialog">
        <div className="confirm-message">{message}</div>
        <div className="confirm-buttons">
          <button className="confirm-button cancel" onClick={onCancel}>
            Cancel
          </button>
          <button className="confirm-button confirm" onClick={onConfirm}>
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}