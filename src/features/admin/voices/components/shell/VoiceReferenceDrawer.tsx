import { useTranslation } from 'react-i18next'
import { Drawer } from '@/ui/primitives'

const SECTIONS = ['tiers', 'settings', 'tags', 'markup', 'slots', 'lifecycle', 'ivc'] as const

/** Root-only operating notes for the console. */
export function VoiceReferenceDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
    const { t } = useTranslation()
    return (
        <Drawer open={open} onClose={onClose} eyebrow={t('admin.voices.reference.eyebrow')} title={t('admin.voices.reference.title')} size="lg">
            <div className="flex flex-col gap-5">
                {SECTIONS.map((section) => (
                    <section key={section} aria-labelledby={`voice-reference-${section}`} className="flex flex-col gap-1.5">
                        <h3 id={`voice-reference-${section}`} className="font-display text-base font-semibold text-fg">
                            {t(`admin.voices.reference.${section}.title`)}
                        </h3>
                        <p className="font-ui text-sm leading-relaxed text-parchment-200">{t(`admin.voices.reference.${section}.body`)}</p>
                    </section>
                ))}
            </div>
        </Drawer>
    )
}
