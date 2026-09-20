import { ArrowLeft, Mail } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigation } from '@/app/hooks'
import { legalArt } from '@/assets/marketing'
import { Badge, Button, Icon, IconTile, Illustration, PageHeader, cx } from '@/ui/primitives'
import { CONTACT_EMAIL, getLegalPageLinks, getLegalPages, type LegalPageId, type LegalSection } from './legalContent'

interface LegalPageProps {
    page: LegalPageId
}

export function LegalPage({ page }: LegalPageProps) {
    const { t } = useTranslation()
    const { setPage } = useNavigation()
    const links = getLegalPageLinks(t)
    const content = getLegalPages(t)[page]
    const art = legalArt[page]

    return (
        <div className="relative w-full">
            <div className="relative mx-auto flex w-full max-w-[1180px] flex-col gap-8 px-5 py-8 sm:px-8 sm:py-10">
                <PageHeader
                    eyebrow={content.eyebrow}
                    title={content.title}
                    subtitle={content.subtitle}
                    size="lg"
                    icon={<IconTile icon={content.icon} tone={page === 'privacy' ? 'arcane' : 'ember'} size="md" />}
                    actions={
                        <Button
                            variant="secondary"
                            size="sm"
                            iconLeft={<Icon icon={ArrowLeft} size={15} />}
                            onClick={() => setPage('landing')}
                        >
                            {t('legal.actions.explore')}
                        </Button>
                    }
                />

                <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
                    <main className="flex min-w-0 flex-col gap-6">
                        {art && (
                            <Illustration
                                src={art}
                                alt={t(`legal.pages.${page}.imageAlt`)}
                                aspect="aspect-[21/9]"
                                ring={page === 'privacy' ? 'arcane' : 'ember'}
                                vignette
                            />
                        )}
                        <section className={cx('grid gap-6 border-y border-line-faint py-6', content.highlights.length % 2 === 0 ? 'md:grid-cols-2' : 'md:grid-cols-3')} aria-label={t('legal.highlightsAria', { title: content.title })}>
                            {content.highlights.map((highlight) => (
                                <div key={highlight.title} className="min-w-0">
                                    <IconTile
                                        icon={highlight.icon}
                                        tone={highlight.tone ?? 'ember'}
                                        size="sm"
                                        className="mb-4"
                                    />
                                    <h2 className="m-0 font-ui text-body font-semibold text-parchment-50">
                                        {highlight.title}
                                    </h2>
                                    <p className="mt-2 font-narrative text-body leading-relaxed text-parchment-300">
                                        {highlight.body}
                                    </p>
                                </div>
                            ))}
                        </section>

                        <div className="flex flex-col divide-y divide-line-faint">
                            {content.sections.map((section) => (
                                <LegalSectionContent key={section.title} section={section} />
                            ))}
                        </div>
                    </main>

                    <aside className="flex min-w-0 flex-col gap-6 border-t border-line-faint pt-6 lg:sticky lg:top-6 lg:self-start lg:border-t-0 lg:border-l lg:pl-6 lg:pt-0">
                        <section>
                            <div className="mb-3 flex items-center justify-between gap-3">
                                <h2 className="m-0 font-ui text-label font-semibold uppercase tracking-[0.16em] text-fg-subtle">
                                    {t('legal.side.pages')}
                                </h2>
                                <Badge tone="neutral">{t('legal.side.public')}</Badge>
                            </div>
                            <nav aria-label={t('legal.navAria')} className="flex flex-col gap-1.5">
                                {links.map((link) => {
                                    const active = link.page === page
                                    return (
                                        <button
                                            key={link.page}
                                            type="button"
                                            aria-current={active ? 'page' : undefined}
                                            onClick={() => setPage(link.page)}
                                            className={cx(
                                                'rounded-md px-3 py-2 text-left font-ui text-label font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ember-500',
                                                active
                                                    ? 'bg-ember-500/15 text-ember-300'
                                                    : 'text-parchment-200 hover:bg-parchment-50/[.05] hover:text-parchment-50',
                                            )}
                                        >
                                            {link.label}
                                        </button>
                                    )
                                })}
                            </nav>
                        </section>

                        <section>
                            <div className="mb-3 flex items-center gap-2">
                                <Icon icon={Mail} size={16} className="text-ember-400" />
                                <h2 className="m-0 font-ui text-sm font-semibold text-parchment-50">{t('legal.side.contact')}</h2>
                            </div>
                            <a
                                href={`mailto:${CONTACT_EMAIL}`}
                                className="break-all font-ui text-body font-semibold text-ember-300 underline-offset-2 transition-colors hover:text-ember-400 hover:underline"
                            >
                                {CONTACT_EMAIL}
                            </a>
                            <p className="mt-3 font-ui text-caption leading-relaxed text-fg-subtle">
                                {t('legal.side.contactBody')}
                            </p>
                        </section>

                        <section>
                            <div className="mb-3 flex flex-wrap gap-2">
                                <Badge tone="ember">{t('legal.side.freePreview')}</Badge>
                                <Badge tone="nsfw">{t('legal.side.noNsfw')}</Badge>
                            </div>
                            <p className="m-0 font-ui text-caption leading-relaxed text-fg-subtle">
                                {t('legal.side.serviceNote')}
                            </p>
                            <p className="mt-3 font-ui text-caption text-fg-subtle">
                                {t('legal.side.lastUpdated', { date: content.updated })}
                            </p>
                        </section>
                    </aside>
                </div>
            </div>
        </div>
    )
}

function LegalSectionContent({ section }: { section: LegalSection }) {
    return (
        <section className="py-6 first:pt-0">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                <IconTile icon={section.icon} tone={section.tone ?? 'ember'} size="sm" />
                <div className="min-w-0 flex-1">
                    <h2 className="m-0 font-display text-h3 font-semibold leading-tight text-parchment-50">
                        {section.title}
                    </h2>
                    <div className="mt-3 flex max-w-[72ch] flex-col gap-3">
                        {section.body.map((paragraph) => (
                            <p key={paragraph} className="m-0 font-narrative text-narrative leading-relaxed text-parchment-200">
                                {paragraph}
                            </p>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    )
}
