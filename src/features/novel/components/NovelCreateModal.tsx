/**
 * NovelCreateModal — title/description plus a "begin from" choice: a blank
 * page, or an existing card (character/world/item/adventure). Picking a card
 * sets the story source; the backend clones that card into the codex on
 * creation, so the modal never builds card refs itself.
 */

import { useState } from 'react'
import { BookOpenText, Feather, Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { StoryCreateRequest } from '@/shared'
import { CardPicker } from '@/features/gallery/media/components/CardPicker'
import type { CardRef } from '@/features/gallery/media/mediaGalleryTypes'
import { Button, cx, Field, Icon, Input, Modal, Textarea } from '@/ui/primitives'

type SourceMode = 'blank' | 'card'

export interface NovelCreateModalProps {
    open: boolean
    creating: boolean
    onClose: () => void
    onCreate: (request: StoryCreateRequest) => void
}

export function NovelCreateModal({ open, creating, onClose, onCreate }: NovelCreateModalProps) {
    const { t } = useTranslation()
    const [title, setTitle] = useState('')
    const [description, setDescription] = useState('')
    const [sourceMode, setSourceMode] = useState<SourceMode>('blank')
    const [sourceCard, setSourceCard] = useState<CardRef | undefined>(undefined)

    const reset = () => {
        setTitle('')
        setDescription('')
        setSourceMode('blank')
        setSourceCard(undefined)
    }

    const close = () => {
        if (creating) return
        reset()
        onClose()
    }

    const submit = () => {
        if (creating || (sourceMode === 'card' && !sourceCard)) return
        onCreate({
            title: title.trim() || t('novelGallery.create.untitledFallback'),
            description: description.trim() || undefined,
            source:
                sourceMode === 'card' && sourceCard
                    ? { kind: sourceCard.type, id: sourceCard.id, title: sourceCard.name ?? null }
                    : { kind: 'blank' },
            chapters: [{ title: 'Chapter 1', body: '', status: 'draft', order: 0 }],
        })
    }

    const modeButton = (mode: SourceMode, label: string, icon: typeof Feather) => (
        <button
            type="button"
            onClick={() => setSourceMode(mode)}
            aria-pressed={sourceMode === mode}
            className={cx(
                'inline-flex cursor-pointer items-center gap-2 rounded-full border px-4 py-2 font-ui text-sm font-medium transition-all',
                sourceMode === mode
                    ? 'border-ember-500/45 bg-ember-500/15 text-ember-300'
                    : 'border-parchment-50/[.08] bg-ink-600 text-parchment-300 hover:border-parchment-50/20 hover:text-parchment-100',
            )}
            data-testid={`novel-create-source-${mode}`}
        >
            <Icon icon={icon} size={15} />
            {label}
        </button>
    )

    return (
        <Modal
            open={open}
            onClose={close}
            title={t('novelGallery.create.title')}
            icon={<Icon icon={BookOpenText} size={20} />}
            size="lg"
            closeLabel={t('common.close')}
            footer={
                <div className="flex w-full items-center justify-end gap-2">
                    <Button variant="ghost" onClick={close} disabled={creating}>
                        {t('novelGallery.create.cancel')}
                    </Button>
                    <Button
                        variant="primary"
                        onClick={submit}
                        disabled={creating || (sourceMode === 'card' && !sourceCard)}
                        iconLeft={<Icon icon={Sparkles} size={15} />}
                        data-testid="novel-create-submit"
                    >
                        {creating ? t('novelGallery.create.creating') : t('novelGallery.create.create')}
                    </Button>
                </div>
            }
        >
            <div className="flex flex-col gap-4">
                <Field label={t('novelGallery.create.titleField')}>
                    <Input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder={t('novelGallery.create.titlePlaceholder')}
                        autoFocus
                        data-testid="novel-create-title"
                    />
                </Field>
                <Field label={t('novelGallery.create.descriptionField')} helper={t('novelGallery.create.descriptionHelper')}>
                    <Textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        rows={3}
                        placeholder={t('novelGallery.create.descriptionPlaceholder')}
                    />
                </Field>
                <Field label={t('novelGallery.create.beginFrom')}>
                    <div className="flex flex-wrap items-center gap-2">
                        {modeButton('blank', t('novelGallery.create.blank'), Feather)}
                        {modeButton('card', t('novelGallery.create.card'), BookOpenText)}
                        {sourceMode === 'card' && (
                            <CardPicker cardType="all" value={sourceCard} onChange={setSourceCard} />
                        )}
                    </div>
                    {sourceMode === 'card' && (
                        <p className="m-0 mt-2 font-ui text-xs text-parchment-400">
                            {t('novelGallery.create.cardHint')}
                        </p>
                    )}
                </Field>
            </div>
        </Modal>
    )
}
