import { AlertTriangle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { CardPreviewModal } from '@/features/cards/components/CardPreviewModal'
import { ConfirmDialog } from '@/ui/components/ConfirmDialog'
import { Icon } from '@/ui/primitives'
import { galleryItemToCardPreview } from '../galleryCardPreview'
import type { GalleryItem } from '../galleryConfig'
import type { ImportSource, useCardImport } from '../hooks/useCardImport'

interface CardImportOverlaysProps {
    importHook: ReturnType<typeof useCardImport>
    previewItem: GalleryItem | null
    onClosePreview: () => void
    /** Build the import source for the preview's Import button (defaults to a clone). */
    toSource?: (item: GalleryItem) => ImportSource
}

/**
 * Page-level overlays shared by every community/import surface: the
 * preview-before-import modal and the warn+confirm dedup dialog, both driven by
 * a single {@link useCardImport} instance.
 */
export function CardImportOverlays({
    importHook,
    previewItem,
    onClosePreview,
    toSource = (item) => ({ kind: 'clone', item }),
}: CardImportOverlaysProps) {
    const { t } = useTranslation()
    const { importingKey, pendingConfirm, requestImport, confirmForceImport, cancelConfirm, openExisting } = importHook

    const previewCard = previewItem ? galleryItemToCardPreview(previewItem) : null
    const previewTarget = previewCard
        ? { type: previewCard.type, id: previewCard.id, fallbackName: previewCard.title }
        : null
    const previewKey = previewItem ? `${previewItem.backendType}:${previewItem.id}` : null
    const previewAlreadyImported = Boolean(previewItem?.resource?.already_imported)
    const previewExistingId = previewItem?.resource?.existing_card_id ?? null

    return (
        <>
            <CardPreviewModal
                target={previewTarget}
                card={previewCard}
                loading={false}
                error={null}
                onClose={onClosePreview}
                originalCreatorName={previewItem?.originalCreatorName}
                alreadyImported={previewAlreadyImported}
                importing={previewKey !== null && importingKey === previewKey}
                importDisabled={importingKey !== null}
                onImport={previewItem ? () => void requestImport(toSource(previewItem)) : undefined}
                onOpenExisting={
                    previewAlreadyImported && previewExistingId && previewItem
                        ? () => openExisting(previewExistingId, previewItem.galleryType)
                        : undefined
                }
            />
            <ConfirmDialog
                visible={Boolean(pendingConfirm)}
                variant="warning"
                icon={<Icon icon={AlertTriangle} size={18} />}
                title={t('gallery.confirmImport.title')}
                message={t('gallery.confirmImport.message', { title: pendingConfirm?.title ?? '' })}
                confirmLabel={t('gallery.confirmImport.confirm')}
                cancelLabel={t('common.cancel')}
                isProcessing={importingKey !== null}
                onConfirm={() => void confirmForceImport()}
                onCancel={cancelConfirm}
            />
        </>
    )
}
