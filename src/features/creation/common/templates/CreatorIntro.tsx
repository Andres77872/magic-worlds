/**
 * CreatorIntro — the page shown before the creator form in create mode: the
 * same masthead chrome as CreatorStudio over a TemplateGallery. `children` is
 * a slot for floating affordances (the card assistant chatbot) so AI-first
 * creation works straight from the gallery.
 */
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowLeft } from 'lucide-react'
import { Button, Icon, PageHeader } from '@/ui/primitives'

export interface CreatorIntroProps {
    eyebrow?: string
    title: string
    /** Display icon — emoji string or an <Icon> element. */
    icon?: ReactNode
    onBack: () => void
    /** The TemplateGallery. */
    children: ReactNode
    /** Floating extras (CardAssistantChatbot). */
    overlay?: ReactNode
}

export function CreatorIntro({ eyebrow, title, icon, onBack, children, overlay }: CreatorIntroProps) {
    const { t } = useTranslation()
    return (
        <div className="mx-auto my-6 w-full max-w-[1180px] px-4 text-parchment-50 sm:px-6">
            <PageHeader
                className="mb-8"
                eyebrow={eyebrow ?? t('creation.common.creationEyebrow')}
                title={title}
                icon={icon ? <span className="text-[28px] leading-none max-sm:text-2xl">{icon}</span> : undefined}
                divider
                actions={
                    <Button variant="ghost" onClick={onBack} iconLeft={<Icon icon={ArrowLeft} size={16} />}>
                        {t('creation.common.back')}
                    </Button>
                }
            />
            {children}
            {overlay}
        </div>
    )
}
