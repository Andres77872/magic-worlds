import { ArrowLeft, Home } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigation } from '@/app/hooks'
import { notFoundArt } from '@/assets/marketing'
import { Button, Eyebrow, GlowBackdrop, Icon, Illustration } from '@/ui/primitives'

/**
 * 404 fallback view. The router renders this for any `currentPage === 'not-found'`,
 * which `NavigationProvider` resolves from an unknown/broken URL hash. Candlelit
 * "you've wandered off the map" treatment, built from Reverie primitives.
 */
export function NotFoundPage() {
    const { t } = useTranslation()
    const { setPage, goBack, previousPage } = useNavigation()

    // Surface the offending link, but only when it's still visible (a runtime
    // navigation to a bad hash). A cold load normalizes the URL to `#/404`, and
    // `#/` is the landing route — neither is worth showing.
    const brokenHash = typeof window === 'undefined' ? '' : window.location.hash
    const showPath = Boolean(brokenHash) && brokenHash !== '#/404' && brokenHash !== '#/'

    return (
        <div className="relative w-full">
            <GlowBackdrop variant="center" />
            <div className="relative mx-auto flex min-h-[70vh] w-full max-w-[760px] flex-col items-center justify-center gap-7 px-5 py-12 text-center sm:py-16">
                <Illustration
                    src={notFoundArt}
                    alt={t('notFound.alt')}
                    aspect="aspect-[3/2]"
                    ring="ember"
                    vignette
                    eager
                    className="w-[min(560px,92vw)] shadow-glow-ember"
                />

                <div className="flex flex-col items-center gap-3">
                    <Eyebrow tone="ember">{t('notFound.eyebrow')}</Eyebrow>
                    <h1 className="m-0 font-display text-h1 font-semibold text-parchment-50">
                        {t('notFound.title')}
                    </h1>
                    <p className="m-0 max-w-[52ch] font-narrative text-[17px] leading-relaxed text-parchment-300">
                        {t('notFound.body')}
                    </p>
                    {showPath && (
                        <p className="mt-1 flex flex-wrap items-center justify-center gap-2 font-mono text-[12px] text-parchment-500">
                            <span className="uppercase tracking-[0.16em]">{t('notFound.pathLabel')}</span>
                            <span className="rounded-xs bg-parchment-50/[.06] px-2 py-0.5 text-parchment-400">{brokenHash}</span>
                        </p>
                    )}
                </div>

                <div className="flex flex-wrap items-center justify-center gap-3">
                    <Button
                        variant="primary"
                        size="md"
                        iconLeft={<Icon icon={Home} size={16} />}
                        onClick={() => setPage('landing')}
                    >
                        {t('notFound.actions.home')}
                    </Button>
                    {previousPage && (
                        <Button
                            variant="secondary"
                            size="md"
                            iconLeft={<Icon icon={ArrowLeft} size={16} />}
                            onClick={() => goBack('landing')}
                        >
                            {t('notFound.actions.back')}
                        </Button>
                    )}
                </div>
            </div>
        </div>
    )
}
