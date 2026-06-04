import { useState, useEffect } from 'react'
import './EditMode.css'

interface EditModeProps {
    initialContent: string
    isUser: boolean
    onSave: (content: string) => void
    onCancel: () => void
}

export function EditMode({ initialContent, isUser, onSave, onCancel }: EditModeProps) {
    const [editContent, setEditContent] = useState(initialContent)
    
    useEffect(() => {
        setEditContent(initialContent)
    }, [initialContent])
    
    const handleSave = () => {
        if (editContent.trim() !== initialContent) {
            onSave(editContent.trim())
        } else {
            onCancel()
        }
    }
    
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault()
            handleSave()
        } else if (e.key === 'Escape') {
            e.preventDefault()
            onCancel()
        }
    }
    
    return (
        <div className="edit-mode">
            <textarea
                className="edit-mode__textarea"
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                    isUser 
                        ? "Enter your action..." 
                        : "Enter the assistant response (markdown supported)..."
                }
                autoFocus
                rows={isUser ? 3 : 8}
            />
            <div className="edit-mode__actions">
                <button 
                    className="btn btn-primary btn-sm"
                    onClick={handleSave}
                    disabled={!editContent.trim()}
                >
                    Save
                </button>
                <button 
                    className="btn btn-secondary btn-sm"
                    onClick={onCancel}
                >
                    Cancel
                </button>
                <span className="edit-mode__hint" style={{fontSize: 'var(--font-size-xs)', color: 'var(--text-color-secondary)', fontStyle: 'italic', opacity: 0.8}}>
                    Ctrl+Enter to save, Escape to cancel
                </span>
            </div>
        </div>
    )
} 