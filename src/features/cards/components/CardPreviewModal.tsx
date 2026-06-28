import { BookOpen, Import, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button, Icon, Modal } from '@/ui/primitives'
import { CardPreviewBody } from './CardPreviewBody'
import type { CardPreview, CardPreviewTarget } from '../cardPreview'

export interface CardPreviewModalProps {
    target: CardPreviewTarget | null
    card: CardPreview | null
    loading: boolean
    error: string | null
    onClose: () => void
    /** Original-author attribution shown above the import action. */
    originalCreatorName?: string | null
    /** When true, render the "already in your library" badge + "Open existing". */
    alreadyImported?: boolean
    /** In-flight import state for this card. */
    importing?: boolean
    /** Provide to render the import footer; omit for a read-only preview. */
    onImport?: () => void
    /** Navigate to the caller's existing copy (shown when alreadyImported). */
    onOpenExisting?: () => void
    importDisabled?: boolean
    /** Show the owner-scoped usage line (own-library previews only, not foreign imports). */
    showUsage?: boolean
}

export function CardPreviewModal({
    target,
    card,
    loading,
    error,
    onClose,
    originalCreatorName,
    alreadyImported = false,
    importing = false,
    onImport,
    onOpenExisting,
    importDisabled = false,
    showUsage = false,
}: CardPreviewModalProps) {
    const { t } = useTranslation()
    const isOpen = Boolean(target)

    const footer = onImport ? (
        <div className="flex w-full flex-wrap items-center justify-between gap-3">
            <span className="min-w-0 truncate font-ui text-xs text-parchment-400">
                {originalCreatorName
                    ? t('gallery.preview.createdBy', { name: originalCreatorName })
                    : ''}
            </span>
            <div className="flex items-center gap-2">
                {alreadyImported && onOpenExisting && (
                    <Button variant="secondary" size="sm" onClick={onOpenExisting} disabled={importing}>
                        {t('gallery.preview.openExisting')}
                    </Button>
                )}
                <Button
                    variant="primary"
                    size="sm"
                    onClick={onImport}
                    disabled={importDisabled || importing}
                    iconLeft={
                        importing ? (
                            <Icon icon={Loader2} size={15} className="animate-spin" />
                        ) : (
                            <Icon icon={Import} size={15} />
                        )
                    }
                >
                    {importing
                        ? t('gallery.importing')
                        : alreadyImported
                          ? t('gallery.preview.importCopy')
                          : t('gallery.preview.import')}
                </Button>
            </div>
        </div>
    ) : undefined

    return (
        <Modal
            open={isOpen}
            onClose={onClose}
            size="lg"
            title={t('cardPreview.title')}
            icon={<Icon icon={BookOpen} size={18} className="text-arcane-300" />}
            closeLabel={t('common.close')}
            footer={footer}
        >
            <CardPreviewBody
                card={card}
                loading={loading}
                error={error}
                target={target}
                showUsage={showUsage}
                alreadyImported={alreadyImported}
            />
        </Modal>
    )
}
