/**
 * ContinueCard — a rail-width "in motion" card for the active adventures and
 * chats rails. Shares the ResumeSession view-model with ResumeCard but is built
 * for a fixed-width scroll-snap slot: an image/avatar banner, stacked title +
 * snippet + mono meta, and a tone-matched continue button. 1:1 vs group chat is
 * shown by an overlapped-avatar banner and a "Chat" vs "Group chat" badge.
 */

import { Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { resolveMediaUrl } from '@/infrastructure/api'
import { CardOptions, type CardOption } from '@/ui/components/lists/Card'
import { Avatar, Badge, Button, Icon, Portrait, cx, gradientFor } from '@/ui/primitives'
import { RESUME_KIND_META, type ResumeSession } from './resumeModel'

export interface ContinueCardProps {
    session: ResumeSession
    onContinue: () => void
    onDelete?: () => void
    deleting?: boolean
}

export function ContinueCard({ session, onContinue, onDelete, deleting = false }: ContinueCardProps) {
    const { t } = useTranslation()
    const meta = RESUME_KIND_META[session.kind]
    const isArcane = meta.tone === 'arcane'
    const isGroupChat = Boolean(session.isGroupChat)

    const options: CardOption[] | undefined = onDelete
        ? [
              {
                  type: 'custom',
                  icon: <Icon icon={Trash2} size={15} />,
                  label: t('gallery.delete'),
                  onClick: onDelete,
                  disabled: deleting,
                  danger: true,
              },
          ]
        : undefined

    return (
        <article
            className={cx(
                'group relative flex h-full flex-col overflow-hidden rounded-xl border border-parchment-50/[.08] bg-ink-700 transition-all hover:-translate-y-[3px]',
                isArcane ? 'hover:border-arcane-500/45 hover:shadow-card-hover-arcane' : 'hover:border-ember-500/45 hover:shadow-card-hover',
                deleting && 'pointer-events-none opacity-60',
            )}
            data-testid="continue-card"
        >
            <div className="relative">
                {isGroupChat && session.imageUrls?.length ? (
                    <div
                        className="flex h-[132px] items-center justify-center overflow-hidden"
                        style={{ background: gradientFor(session.title) }}
                    >
                        <div className="flex -space-x-6">
                            {session.imageUrls.slice(0, 3).map((url, index) => (
                                <Avatar
                                    key={`${url}-${index}`}
                                    name={`${session.title} ${index + 1}`}
                                    src={resolveMediaUrl(url)}
                                    size={64}
                                    ring="arcane"
                                    className="border-2 border-ink-700"
                                />
                            ))}
                        </div>
                    </div>
                ) : (
                    <Portrait name={session.title} src={session.imageUrl} height={132} lazy />
                )}
                <span
                    aria-hidden="true"
                    className={cx('absolute inset-x-0 top-0 h-0.5', isArcane ? 'bg-arcane-500/60' : 'bg-ember-500/60')}
                />
                <div className="absolute left-2.5 top-2.5">
                    {isGroupChat ? (
                        <Badge tone="arcane">{t('landing.continueCard.groupChat')}</Badge>
                    ) : (
                        <Badge tone={meta.tone} icon={<Icon icon={meta.icon} size={11} />}>
                            {t(meta.labelKey)}
                        </Badge>
                    )}
                </div>
                {options && (
                    <div
                        className="absolute right-2 top-2 opacity-100 transition-opacity sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <CardOptions options={options} aria-label={t('galleryCard.actions', { title: session.title })} />
                    </div>
                )}
            </div>
            <div className="flex flex-1 flex-col gap-2 p-3.5">
                <h3 className="m-0 line-clamp-1 font-display text-[16px] font-semibold leading-tight text-parchment-50">
                    {session.title}
                </h3>
                {session.snippet && (
                    <p className="m-0 line-clamp-2 font-narrative text-[13px] italic leading-snug text-parchment-400">
                        {session.snippet}
                    </p>
                )}
                <p className="m-0 mt-auto font-mono text-[11px] tracking-wide text-parchment-400">{session.meta}</p>
                <Button
                    variant={isArcane ? 'arcane' : 'primary'}
                    size="sm"
                    full
                    iconLeft={<Icon icon={meta.icon} size={15} />}
                    onClick={onContinue}
                    disabled={deleting}
                >
                    {t(meta.resumeLabelKey)}
                </Button>
            </div>
            {deleting && (
                <div className="absolute inset-0 z-[1] flex items-center justify-center bg-ink-900/70 font-medium text-parchment-50">
                    {t('galleryCard.deleting')}
                </div>
            )}
        </article>
    )
}
