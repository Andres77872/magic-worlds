/**
 * "What you can build" — an illustrated gallery on the guest front-door that
 * shows each creation surface with its generated candlelit illustration. Purely
 * presentational (mirrors HowItWorksSection's section shell); no actions/gating.
 */

import { useTranslation } from 'react-i18next'
import { featureArt } from '@/assets/marketing'
import { Card, Eyebrow, Illustration } from '@/ui/primitives'
import { FEATURE_GALLERY, isFeatureGalleryItemEnabled } from './landingContent'

export function FeatureGallery() {
    const { t } = useTranslation()
    return (
        <section className="w-full px-5 py-14 sm:px-8 sm:py-16">
            <div className="mx-auto max-w-[1160px]">
                <div className="mb-9 flex flex-col gap-2 text-center sm:mb-11">
                    <Eyebrow tone="arcane">{t('landing.gallery.eyebrow')}</Eyebrow>
                    <h2 className="font-display text-h1 font-semibold leading-[1.05] text-parchment-50">
                        {t('landing.gallery.title')}
                    </h2>
                </div>
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                    {FEATURE_GALLERY.filter(isFeatureGalleryItemEnabled).map((item) => (
                        <Card key={item.key} className="overflow-hidden p-0">
                            <Illustration
                                src={featureArt[item.key]}
                                alt={t(`landing.gallery.alt.${item.key}`)}
                                aspect="aspect-[3/2]"
                                ring="none"
                                className="rounded-none"
                            />
                            <div className="p-5">
                                <h3 className="font-ui text-[16px] font-semibold tracking-[-0.01em] text-parchment-50">
                                    {t(item.titleKey)}
                                </h3>
                                <p className="mt-1.5 font-narrative text-[14.5px] leading-[1.5] text-parchment-400">
                                    {t(item.descKey)}
                                </p>
                            </div>
                        </Card>
                    ))}
                </div>
            </div>
        </section>
    )
}
