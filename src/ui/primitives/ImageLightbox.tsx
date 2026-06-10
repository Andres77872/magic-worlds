/**
 * Reverie image lightbox — a full-bleed portal overlay that shows a single image
 * at its natural size (capped to the viewport). Dim+blur scrim, click-scrim or
 * Esc to close. `src` is used as-is (resolve relative media URLs before passing).
 */
import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { IconButton } from './IconButton'

interface ImageLightboxProps {
    open: boolean
    src?: string
    alt?: string
    onClose: () => void
}

export function ImageLightbox({ open, src, alt = '', onClose }: ImageLightboxProps) {
    useEffect(() => {
        if (!open) return
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose()
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [open, onClose])

    if (!open || !src) return null
    return createPortal(
        <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-ink-900/80 p-4 backdrop-blur-sm"
            onClick={onClose}
        >
            <IconButton label="Close" onClick={onClose} className="absolute right-4 top-4 bg-ink-900/40">
                <X size={20} strokeWidth={1.75} />
            </IconButton>
            <img
                src={src}
                alt={alt}
                className="max-h-[90vh] max-w-[90vw] rounded-xl object-contain shadow-lg"
                onClick={(e) => e.stopPropagation()}
            />
        </div>,
        document.body,
    )
}
