import { Ban, Code2, Flame, Mail, Server } from 'lucide-react'
import type { PageType } from '@/shared'
import { Badge, Icon } from '@/ui/primitives'
import { CONTACT_EMAIL, LEGAL_PAGE_LINKS } from '@/features/legal'
import { GITHUB_URL } from './landingContent'

interface LandingFooterProps {
    onNavigate: (page: PageType) => void
}

export function LandingFooter({ onNavigate }: LandingFooterProps) {
    return (
        <footer className="border-t border-parchment-50/[.08] bg-ink-900/40 px-5 py-10 sm:px-8">
            <div className="mx-auto grid w-full max-w-[1160px] gap-8 lg:grid-cols-[minmax(0,1fr)_auto]">
                <div className="max-w-[560px]">
                    <div className="flex items-center gap-2.5">
                        <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-ember-500/15 text-ember-400">
                            <Icon icon={Flame} size={19} />
                        </span>
                        <span className="font-display text-[24px] font-semibold text-parchment-50">Magic Worlds</span>
                    </div>
                    <p className="mt-3 font-narrative text-[16px] leading-relaxed text-parchment-300">
                        Free preview AI roleplay and story tools. Content is saved on the backend so your worlds,
                        sessions, stories, and media can be served when you return.
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                        <Badge tone="ember">Free for now</Badge>
                        <Badge tone="neutral" icon={<Icon icon={Server} size={11} />}>
                            Server saved
                        </Badge>
                        <Badge tone="nsfw" icon={<Icon icon={Ban} size={11} />}>
                            No illegal or NSFW content
                        </Badge>
                    </div>
                </div>

                <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-[160px_220px]">
                    <nav aria-label="Footer pages" className="flex flex-col gap-2">
                        <h2 className="font-ui text-[12px] font-semibold uppercase tracking-[0.16em] text-parchment-500">
                            Pages
                        </h2>
                        {LEGAL_PAGE_LINKS.map((link) => (
                            <button
                                key={link.page}
                                type="button"
                                onClick={() => onNavigate(link.page)}
                                className="w-fit rounded-md py-1 pr-2 text-left font-ui text-[14px] font-semibold text-parchment-200 transition-colors hover:text-ember-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-ember-500"
                            >
                                {link.label}
                            </button>
                        ))}
                    </nav>

                    <div className="flex flex-col gap-2">
                        <h2 className="font-ui text-[12px] font-semibold uppercase tracking-[0.16em] text-parchment-500">
                            Contact
                        </h2>
                        <a
                            href={`mailto:${CONTACT_EMAIL}`}
                            className="inline-flex w-fit items-center gap-2 rounded-md py-1 pr-2 font-ui text-[14px] font-semibold text-parchment-200 transition-colors hover:text-ember-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-ember-500"
                        >
                            <Icon icon={Mail} size={15} />
                            {CONTACT_EMAIL}
                        </a>
                        <a
                            href={GITHUB_URL}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex w-fit items-center gap-2 rounded-md py-1 pr-2 font-ui text-[14px] font-semibold text-parchment-200 transition-colors hover:text-ember-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-ember-500"
                        >
                            <Icon icon={Code2} size={15} />
                            View source
                        </a>
                    </div>
                </div>
            </div>
        </footer>
    )
}
