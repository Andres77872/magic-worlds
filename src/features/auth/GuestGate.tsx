/**
 * Guest gate — what a signed-out visitor sees in place of a page that only lists
 * their own content (library, chats, media, notifications). One full-page
 * invitation instead of skeletons or "nothing yet": candlelit art that previews
 * the page, a plain explanation, the perks of an account, and one primary
 * action (create a free account) with sign-in as the quieter alternative.
 *
 * Presentational: the router (or a page with its own guest mode) wires the
 * callbacks. The page stays on its own URL, so signing in renders it in place.
 */
import type { ReactNode } from 'react'
import { ArrowLeft, Check, LogIn, UserPlus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { docsArt } from '@/assets/marketing'
import type { GuestGateKind } from '@/app/router/pageAccess'
import { Button, Eyebrow, Icon, Illustration } from '@/ui/primitives'

const GATE_ART: Record<GuestGateKind, string> = {
    library: docsArt.library,
    play: docsArt.play,
    media: docsArt.media,
    notifications: docsArt['best-practices'],
}

const PERKS = ['free', 'saved', 'anywhere'] as const

export interface GuestGateProps {
    kind: GuestGateKind
    /** The page's own name (its nav label), shown as the eyebrow. */
    eyebrow: string
    onSignUp: () => void
    onSignIn: () => void
    /** Back to the public front door. */
    onExplore?: () => void
    /** A page-specific way to keep browsing signed out (e.g. its public view). */
    extraAction?: ReactNode
}

export function GuestGate({ kind, eyebrow, onSignUp, onSignIn, onExplore, extraAction }: GuestGateProps) {
    const { t } = useTranslation()
    return (
        <div className="relative w-full" data-testid="guest-gate">
            <div className="mx-auto flex min-h-[70vh] w-full max-w-[760px] flex-col items-center justify-center gap-8 px-5 py-12 text-center sm:py-16">
                <Illustration
                    src={GATE_ART[kind]}
                    alt={t(`guestGate.${kind}.imageAlt`)}
                    aspect="aspect-[3/1]"
                    ring="ember"
                    vignette
                    eager
                    className="w-full"
                />

                <div className="flex flex-col items-center gap-3">
                    <Eyebrow tone="ember">{eyebrow}</Eyebrow>
                    <h1 className="m-0 font-display text-h1 font-semibold leading-[1.05] text-parchment-50">
                        {t(`guestGate.${kind}.title`)}
                    </h1>
                    <p className="m-0 max-w-[52ch] font-narrative text-[17px] leading-relaxed text-parchment-300">
                        {t(`guestGate.${kind}.body`)}
                    </p>
                </div>

                <ul className="m-0 flex list-none flex-wrap items-center justify-center gap-x-5 gap-y-2 p-0">
                    {PERKS.map((perk) => (
                        <li key={perk} className="inline-flex items-center gap-1.5 font-ui text-label text-parchment-300">
                            <Icon icon={Check} size={14} className="text-ember-400" />
                            {t(`guestGate.perks.${perk}`)}
                        </li>
                    ))}
                </ul>

                <div className="flex flex-col items-center gap-4">
                    <div className="flex flex-wrap items-center justify-center gap-3">
                        <Button variant="primary" size="lg" iconLeft={<Icon icon={UserPlus} size={18} />} onClick={onSignUp}>
                            {t('guestGate.signUp')}
                        </Button>
                        <Button variant="secondary" size="lg" iconLeft={<Icon icon={LogIn} size={18} />} onClick={onSignIn}>
                            {t('guestGate.signIn')}
                        </Button>
                    </div>
                    {(extraAction || onExplore) && (
                        <div className="flex flex-wrap items-center justify-center gap-2">
                            {extraAction}
                            {onExplore && (
                                <Button variant="ghost" size="sm" iconLeft={<Icon icon={ArrowLeft} size={15} />} onClick={onExplore}>
                                    {t('guestGate.explore')}
                                </Button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
