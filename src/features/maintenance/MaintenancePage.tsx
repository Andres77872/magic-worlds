import { useEffect, useState } from 'react'
import { BookOpen, RefreshCw, Wrench } from 'lucide-react'
import {
    resolveCurrentLanguage,
    SUPPORTED_LANGUAGE_OPTIONS,
    syncDocumentLanguage,
    writeStoredLanguage,
    type SupportedLanguage,
} from '@/app/i18n/languages'
import wordmark from '@/assets/brand/logo-wordmark.svg'
import maintenanceArt from '@/assets/marketing/maintenance.webp'
// Leaf imports are intentional: the UI barrel also loads authenticated media
// and playlist modules. This screen must work without that application graph.
import { Badge } from '@/ui/primitives/Badge'
import { Button } from '@/ui/primitives/Button'
import { Eyebrow } from '@/ui/primitives/Eyebrow'
import { Icon } from '@/ui/primitives/Icon'
import { Illustration } from '@/ui/primitives/Illustration'
import { maintenanceCopy } from './maintenanceCopy'

interface MaintenancePageProps {
    /** Optional preview language; visitors otherwise use their saved/browser language. */
    initialLanguage?: SupportedLanguage
    onReload?: () => void
}

export default function MaintenancePage({ initialLanguage, onReload }: MaintenancePageProps) {
    const [language, setLanguage] = useState(() => initialLanguage ?? resolveCurrentLanguage())
    const copy = maintenanceCopy[language]

    useEffect(() => {
        const previous = { title: document.title, lang: document.documentElement.lang, dir: document.documentElement.dir }
        document.title = copy.documentTitle
        syncDocumentLanguage(language)
        return () => {
            document.title = previous.title
            document.documentElement.lang = previous.lang
            document.documentElement.dir = previous.dir
        }
    }, [copy.documentTitle, language])

    function changeLanguage(next: SupportedLanguage) {
        writeStoredLanguage(next)
        setLanguage(next)
    }

    return (
        <div className="flex min-h-dvh flex-col bg-ink-900 text-fg">
            <header className="border-b border-line-faint">
                <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-5 sm:px-8">
                    <img src={wordmark} alt="Reverie" width={300} height={76} className="h-9 w-auto sm:h-11" />
                    <div role="group" aria-label={copy.languageLabel} className="flex items-center gap-1">
                        {SUPPORTED_LANGUAGE_OPTIONS.map((option) => (
                            <Button
                                key={option.code}
                                variant={language === option.code ? 'secondary' : 'ghost'}
                                size="sm"
                                className="min-h-11"
                                lang={option.code}
                                aria-pressed={language === option.code}
                                onClick={() => changeLanguage(option.code)}
                            >
                                {option.nativeLabel}
                            </Button>
                        ))}
                    </div>
                </div>
            </header>

            <main className="mx-auto grid w-full max-w-7xl flex-1 items-center gap-12 px-6 py-12 sm:px-8 sm:py-16 lg:grid-cols-2 lg:gap-16">
                <section aria-labelledby="maintenance-title" className="min-w-0">
                    <Badge tone="ember" icon={<Icon icon={Wrench} size={14} />}>
                        {copy.status}
                    </Badge>
                    <h1 id="maintenance-title" className="mt-6 font-display text-display text-fg">
                        {copy.title}{' '}
                        <span className="block font-normal italic text-ember-300">{copy.titleAccent}</span>
                    </h1>
                    <p className="mt-6 max-w-lg font-narrative text-narrative text-fg-muted">
                        {copy.description}
                    </p>
                    <div className="mt-9 flex flex-col items-start gap-3">
                        <Button
                            size="lg"
                            iconLeft={<Icon icon={RefreshCw} size={18} />}
                            onClick={onReload ?? (() => window.location.reload())}
                            aria-describedby="maintenance-retry-hint"
                        >
                            {copy.retry}
                        </Button>
                        <p id="maintenance-retry-hint" className="text-label text-fg-subtle">
                            {copy.retryHint}
                        </p>
                    </div>
                </section>

                <figure className="min-w-0">
                    <Illustration
                        src={maintenanceArt}
                        alt={copy.illustrationAlt}
                        aspect="aspect-[3/2]"
                        ring="ember"
                        eager
                        className="w-full"
                    />
                    <figcaption className="mt-6 flex items-start gap-3 px-1">
                        <Icon icon={BookOpen} size={20} className="mt-1 shrink-0 text-ember-300" />
                        <div>
                            <Eyebrow tone="muted">{copy.illustrationLabel}</Eyebrow>
                            <p className="mt-1 font-narrative text-body italic text-fg-muted">
                                {copy.illustrationCaption}
                            </p>
                        </div>
                    </figcaption>
                </figure>
            </main>

            <footer className="border-t border-line-faint">
                <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-6 py-6 text-label text-fg-subtle sm:px-8">
                    <p>Magic Worlds <span aria-hidden="true">·</span> {copy.tagline}</p>
                    <p>{copy.footer}</p>
                </div>
            </footer>
        </div>
    )
}
