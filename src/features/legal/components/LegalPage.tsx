import { ArrowLeft, Mail } from 'lucide-react'
import { useNavigation } from '@/app/hooks'
import { Badge, Button, Card, Icon, IconTile, PageHeader, cx } from '@/ui/primitives'
import { CONTACT_EMAIL, LEGAL_PAGE_LINKS, LEGAL_PAGES, type LegalPageId, type LegalSection } from './legalContent'

interface LegalPageProps {
    page: LegalPageId
}

export function LegalPage({ page }: LegalPageProps) {
    const { setPage } = useNavigation()
    const content = LEGAL_PAGES[page]

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
                            kind="secondary"
                            size="sm"
                            iconLeft={<Icon icon={ArrowLeft} size={15} />}
                            onClick={() => setPage('landing')}
                        >
                            Explore
                        </Button>
                    }
                />

                <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
                    <main className="flex min-w-0 flex-col gap-6">
                        <section className="grid gap-4 md:grid-cols-3" aria-label={`${content.title} highlights`}>
                            {content.highlights.map((highlight) => (
                                <Card key={highlight.title} className="p-5">
                                    <IconTile
                                        icon={highlight.icon}
                                        tone={highlight.tone ?? 'ember'}
                                        size="sm"
                                        className="mb-4"
                                    />
                                    <h2 className="m-0 font-ui text-[15px] font-semibold text-parchment-50">
                                        {highlight.title}
                                    </h2>
                                    <p className="mt-2 font-narrative text-[15.5px] leading-relaxed text-parchment-300">
                                        {highlight.body}
                                    </p>
                                </Card>
                            ))}
                        </section>

                        <div className="flex flex-col gap-5">
                            {content.sections.map((section) => (
                                <LegalSectionCard key={section.title} section={section} />
                            ))}
                        </div>
                    </main>

                    <aside className="flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start">
                        <Card className="p-4">
                            <div className="mb-3 flex items-center justify-between gap-3">
                                <h2 className="m-0 font-ui text-[13px] font-semibold uppercase tracking-[0.16em] text-parchment-400">
                                    Pages
                                </h2>
                                <Badge tone="neutral">Public</Badge>
                            </div>
                            <nav aria-label="Legal pages" className="flex flex-col gap-1.5">
                                {LEGAL_PAGE_LINKS.map((link) => {
                                    const active = link.page === page
                                    return (
                                        <button
                                            key={link.page}
                                            type="button"
                                            aria-current={active ? 'page' : undefined}
                                            onClick={() => setPage(link.page)}
                                            className={cx(
                                                'rounded-md px-3 py-2 text-left font-ui text-[13px] font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ember-500',
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
                        </Card>

                        <Card className="p-4">
                            <div className="mb-3 flex items-center gap-2">
                                <Icon icon={Mail} size={16} className="text-ember-400" />
                                <h2 className="m-0 font-ui text-sm font-semibold text-parchment-50">Contact</h2>
                            </div>
                            <a
                                href={`mailto:${CONTACT_EMAIL}`}
                                className="break-all font-ui text-[14px] font-semibold text-ember-300 underline-offset-2 transition-colors hover:text-ember-400 hover:underline"
                            >
                                {CONTACT_EMAIL}
                            </a>
                            <p className="mt-3 font-ui text-[12px] leading-relaxed text-parchment-400">
                                Use email for account, privacy, content, and service questions.
                            </p>
                        </Card>

                        <Card className="p-4">
                            <div className="mb-3 flex flex-wrap gap-2">
                                <Badge tone="ember">Free preview</Badge>
                                <Badge tone="nsfw">No NSFW</Badge>
                            </div>
                            <p className="m-0 font-ui text-[12px] leading-relaxed text-parchment-400">
                                Content is saved on the backend so the service can run. Illegal content is not allowed.
                            </p>
                            <p className="mt-3 font-ui text-[12px] text-parchment-500">
                                Last updated {content.updated}
                            </p>
                        </Card>
                    </aside>
                </div>
            </div>
        </div>
    )
}

function LegalSectionCard({ section }: { section: LegalSection }) {
    return (
        <Card className="p-5 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                <IconTile icon={section.icon} tone={section.tone ?? 'ember'} size="sm" />
                <div className="min-w-0 flex-1">
                    <h2 className="m-0 font-display text-[26px] font-semibold leading-tight text-parchment-50">
                        {section.title}
                    </h2>
                    <div className="mt-3 flex max-w-[72ch] flex-col gap-3">
                        {section.body.map((paragraph) => (
                            <p key={paragraph} className="m-0 font-narrative text-[17px] leading-relaxed text-parchment-200">
                                {paragraph}
                            </p>
                        ))}
                    </div>
                </div>
            </div>
        </Card>
    )
}
