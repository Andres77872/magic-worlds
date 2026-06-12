import { CheckCircle2, Coins, Crown, Lock, Rocket, Sparkles, WalletCards } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type {
    MembershipPaygProfileCard,
    MembershipProfileCardCredits,
    MembershipProfileCardLimit,
    MembershipTierProfileCard,
    UserProfile,
} from '@/shared'
import { Badge, Button, Card, Eyebrow, Icon, IconTile, SectionHeader, Tag } from '@/ui/primitives'
import { cx } from '@/ui/primitives/cx'
import { formatNumber, operationLabel, orderedLimitEntries } from './membership.helpers'

interface MembershipSectionProps {
    profile: UserProfile
}

const VISUAL_ICONS: Record<string, LucideIcon> = {
    sparkles: Sparkles,
    rocket: Rocket,
    crown: Crown,
    coins: Coins,
}

export function MembershipSection({ profile }: MembershipSectionProps) {
    const membership = profile.membership

    if (!membership?.profile_cards) {
        return <LegacyCreditsCard credits={profile.user_usage} />
    }

    const { profile_cards: cards } = membership

    return (
        <section className="flex flex-col gap-4" aria-labelledby="membership-heading">
            <SectionHeader
                icon={WalletCards}
                title={<span id="membership-heading">Membership</span>}
                right={<Badge tone="neutral">{formatNumber(membership.total_available_credits)} available</Badge>}
            />

            <div className="grid gap-4 md:grid-cols-3">
                {cards.tiers.map((tier) => (
                    <TierCard key={tier.plan_code} tier={tier} />
                ))}
            </div>
            <PaygCard card={cards.payg} />
        </section>
    )
}

function TierCard({ tier }: { tier: MembershipTierProfileCard }) {
    const isCurrent = tier.status === 'current'
    const icon = iconFor(tier.visual.icon)

    return (
        <Card
            className={cx(
                'flex flex-col gap-5 p-5',
                isCurrent ? 'border-ember-500/45 shadow-glow-ember' : 'bg-ink-700/75',
            )}
        >
            <div className="flex items-start justify-between gap-3">
                <TierIcon icon={icon} current={isCurrent} />
                <Badge tone={isCurrent ? 'ember' : 'neutral'} icon={!isCurrent ? <Icon icon={Lock} size={11} /> : undefined}>
                    {tier.badge}
                </Badge>
            </div>

            <div className="flex flex-col gap-1.5">
                <h3 className="break-words font-display text-h3 font-semibold text-parchment-50">{tier.display_name}</h3>
                <p className="min-h-[44px] font-ui text-[13px] leading-relaxed text-parchment-300">{tier.description}</p>
            </div>

            <AllowanceStat credits={tier.credits} current={isCurrent} />

            <div className="flex flex-col gap-2">
                {tier.highlights.slice(0, 3).map((highlight) => (
                    <span
                        key={highlight}
                        className={cx(
                            'flex items-center gap-2 font-ui text-[12px]',
                            isCurrent ? 'text-parchment-200' : 'text-parchment-300',
                        )}
                    >
                        <Icon icon={CheckCircle2} size={14} className={isCurrent ? 'text-ember-400' : 'text-parchment-400'} />
                        {highlight}
                    </span>
                ))}
            </div>

            <LimitRows limits={tier.limits} preview={!isCurrent} />

            <Button kind={isCurrent ? 'secondary' : 'ghost'} size="sm" disabled full className="mt-auto">
                {tier.action.label}
            </Button>
        </Card>
    )
}

/**
 * Locked tiers get a muted ink tile instead of an accent one — ember is
 * reserved for the current plan and arcane for AI/magic, not "locked".
 */
function TierIcon({ icon, current }: { icon: LucideIcon; current: boolean }) {
    if (current) {
        return <IconTile icon={icon} tone="ember" size="sm" />
    }
    return (
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-ink-600 text-parchment-300">
            <Icon icon={icon} size={20} />
        </span>
    )
}

/**
 * Plan-spec allowance stat. Live usage intentionally lives in the separate
 * "Today's usage" section, never on the plan cards.
 */
function AllowanceStat({ credits, current }: { credits: MembershipProfileCardCredits; current: boolean }) {
    return (
        <div className="flex flex-col gap-1">
            <div className="flex items-baseline gap-1.5">
                <span
                    className={cx(
                        'font-display text-h2 font-semibold leading-none',
                        current ? 'text-parchment-50' : 'text-parchment-100',
                    )}
                >
                    {formatNumber(credits.max)}
                </span>
                <span className="font-ui text-[12px] text-parchment-400">credits / day</span>
            </div>
            <span className="font-ui text-[12px] text-parchment-400">
                {current ? 'Included daily credits' : 'Indicative daily included credits'}
            </span>
        </div>
    )
}

function PaygCard({ card }: { card: MembershipPaygProfileCard }) {
    return (
        <Card className="border-ember-500/25 p-5">
            <div className="flex flex-col gap-5 md:flex-row md:gap-8">
                <div className="flex flex-col gap-4 md:w-[300px] md:shrink-0">
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <IconTile icon={Coins} tone="ember" size="sm" />
                            <h3 className="font-display text-h3 font-semibold text-parchment-50">Pay as you go</h3>
                        </div>
                        <Badge tone="ember">{card.badge}</Badge>
                    </div>

                    <div className="rounded-lg border border-parchment-50/[.08] bg-ink-800/70 px-4 py-3">
                        <Eyebrow tone="muted">Wallet balance</Eyebrow>
                        <div className="mt-1.5 flex items-baseline gap-2">
                            <span className="font-display text-h2 font-semibold leading-none text-ember-300">
                                {formatNumber(card.balance)}
                            </span>
                            <span className="font-ui text-[13px] text-parchment-300">credits</span>
                        </div>
                    </div>
                </div>

                <div className="flex min-w-0 flex-1 flex-col gap-4">
                    <p className="font-ui text-[13px] leading-relaxed text-parchment-300">{card.description}</p>

                    <div className="flex flex-col gap-1.5">
                        <Eyebrow tone="muted">How it works</Eyebrow>
                        <div className="flex flex-wrap gap-2">
                            <Tag>1 credit per action</Tag>
                            {card.non_expiring && <Tag>Non-expiring</Tag>}
                            <Tag>After daily credits</Tag>
                        </div>
                    </div>

                    {card.covered_operations.length > 0 && (
                        <div className="flex flex-col gap-1.5">
                            <Eyebrow tone="muted">Covers</Eyebrow>
                            <div className="flex flex-wrap gap-2">
                                {card.covered_operations.map((operation) => (
                                    <Tag key={operation}>{operationLabel(operation)}</Tag>
                                ))}
                            </div>
                        </div>
                    )}

                    <Button kind="secondary" size="sm" disabled className="mt-auto w-full md:w-auto md:self-end">
                        {card.action.label}
                    </Button>
                </div>
            </div>
        </Card>
    )
}

function LimitRows({ limits, preview = false }: { limits: Record<string, MembershipProfileCardLimit>; preview?: boolean }) {
    const entries = orderedLimitEntries(limits)

    return (
        <div className="flex flex-col gap-1.5">
            <Eyebrow tone="muted">{preview ? 'Indicative limits' : 'Daily limits'}</Eyebrow>
            <div className="flex flex-col overflow-hidden rounded-lg border border-parchment-50/[.08]">
                {entries.map(([operation, limit]) => (
                    <div
                        key={operation}
                        className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-parchment-50/[.06] px-3 py-2 last:border-b-0"
                    >
                        <span className="block min-w-0 truncate font-ui text-[12px] font-semibold text-parchment-100">
                            {operationLabel(operation)}
                        </span>
                        <div className="text-right font-ui text-[11px] text-parchment-300">
                            <span className="block">{formatNumber(limit.daily_limit)}/day</span>
                            <span className="block text-parchment-500">{limit.max_in_flight} in-flight</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}

function LegacyCreditsCard({ credits }: { credits: number }) {
    return (
        <section className="flex flex-col gap-4" aria-labelledby="membership-heading">
            <SectionHeader icon={WalletCards} title={<span id="membership-heading">Membership</span>} />
            <Card className="flex flex-col gap-2 px-5 py-4">
                <Eyebrow tone="muted">Available credits</Eyebrow>
                <span className="font-display text-h2 font-semibold leading-none text-parchment-50">{formatNumber(credits)}</span>
                <p className="font-ui text-[13px] text-parchment-400">
                    Detailed membership tiers will appear here when the profile API includes them.
                </p>
            </Card>
        </section>
    )
}

function iconFor(icon: string) {
    return VISUAL_ICONS[icon] ?? Sparkles
}
