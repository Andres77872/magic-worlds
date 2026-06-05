import { useState, useEffect } from 'react'
import { Button, Textarea } from '../../../ui/primitives'

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
        <div className="flex flex-col gap-2">
            <Textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                    isUser
                        ? 'Enter your action...'
                        : 'Enter the assistant response (markdown supported)...'
                }
                autoFocus
                rows={isUser ? 3 : 8}
            />
            <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" onClick={handleSave} disabled={!editContent.trim()}>
                    Save
                </Button>
                <Button kind="secondary" size="sm" onClick={onCancel}>
                    Cancel
                </Button>
                <span className="text-[12px] italic text-parchment-400">
                    Ctrl+Enter to save, Escape to cancel
                </span>
            </div>
        </div>
    )
}
