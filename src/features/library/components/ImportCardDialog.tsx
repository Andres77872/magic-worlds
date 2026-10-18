import { useFeatureFlags } from '@/shared/hooks/useFeatureFlags'
/**
 * Import card from the Library New menu: paste a shared card link, open its
 * preview (the existing preview-before-import modal takes over from there).
 * The caller imports through the destination's scoped client, so the copy
 * lands in this workspace (and the open collection, when there is one).
 */
import { isContentTypeFeatureEnabled } from '@/shared/featureFlags'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Import } from 'lucide-react'
import { apiService } from '@/infrastructure/api'
import { publicItems, type GalleryItem } from '@/features/gallery/galleryConfig'
import { parseSharedCardToken } from '@/features/gallery/galleryLinks'
import { Button, Callout, Field, Icon, Input, Modal } from '@/ui/primitives'

/** The share token of a pasted link (`…/#/shared/<token>`, the hash alone, or a bare token). */
export function sharedTokenFromInput(raw: string): string | null {
    const value = raw.trim()
    if (!value) return null
    const hashIndex = value.indexOf('#')
    const hash = hashIndex === -1 ? (value.startsWith('/shared/') ? `#${value}` : null) : value.slice(hashIndex)
    if (hash) return parseSharedCardToken(hash)
    return /^[A-Za-z0-9_-]{8,256}$/.test(value) ? value : null
}

interface ImportCardDialogProps {
    open: boolean
    /** "Workspace" or "Workspace / Collection". */
    destination: string
    onClose: () => void
    /** The link resolved to a card: show its preview with Import. */
    onResolved: (token: string, item: GalleryItem) => void
}

export function ImportCardDialog({ open, destination, onClose, onResolved }: ImportCardDialogProps) {
    useFeatureFlags()
    const { t } = useTranslation()
    const [link, setLink] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const [wasOpen, setWasOpen] = useState(open)
    if (wasOpen !== open) {
        setWasOpen(open)
        if (open) {
            setLink('')
            setError(null)
            setLoading(false)
        }
    }

    const submit = async (event: FormEvent) => {
        event.preventDefault()
        if (loading) return
        const token = sharedTokenFromInput(link)
        if (!token) {
            setError(t('library.import.invalid'))
            return
        }
        setLoading(true)
        setError(null)
        try {
            // Shared previews are public: no workspace header.
            const resource = await apiService.getSharedCard(token)
            const item = publicItems(resource)[0]
            if (!item || !isContentTypeFeatureEnabled(item.galleryType)) throw new Error('Card unavailable')
            onResolved(token, item)
        } catch {
            setError(t('library.import.failed'))
        } finally {
            setLoading(false)
        }
    }

    return (
        <Modal
            open={open}
            onClose={loading ? () => {} : onClose}
            title={t('library.import.title')}
            icon={<Icon icon={Import} size={22} className="text-ember-400" />}
            initialFocus="first-control"
            footer={
                <>
                    <Button variant="ghost" onClick={onClose} disabled={loading}>{t('common.cancel')}</Button>
                    <Button variant="primary" type="submit" form="library-import-form" disabled={loading || !link.trim()}>
                        {loading ? t('library.import.loading') : t('library.import.preview')}
                    </Button>
                </>
            }
        >
            <form id="library-import-form" className="flex flex-col gap-4" onSubmit={(event) => void submit(event)} noValidate>
                <p className="font-ui text-sm text-fg-muted">{t('library.import.body')}</p>
                {error && <Callout tone="danger" role="alert">{error}</Callout>}
                <Field label={t('library.import.link')} helper={t('library.import.destination', { destination })}>
                    <Input
                        value={link}
                        placeholder={t('library.import.placeholder')}
                        onChange={(event) => setLink(event.target.value)}
                        autoComplete="off"
                        inputMode="url"
                    />
                </Field>
            </form>
        </Modal>
    )
}
