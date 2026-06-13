/**
 * ResumeCard — a landscape row card for a session in motion. Deliberately
 * nothing like the portrait discovery cards: Avatar instead of Portrait, a
 * mode-toned left rule, mono metadata, and a circular play/chat affordance.
 * Ember = adventure, arcane = chat, per MODE_META's color language.
 */

import type { KeyboardEvent } from 'react'
import { MessageCircle, Play, Trash2 } from 'lucide-react'
import { resolveMediaUrl } from '@/infrastructure/api'
import { MODE_META } from '@/shared/modes'
import { ModeBadge } from '@/ui/components/common/ModeBadge'
import { CardOptions, type CardOption } from '@/ui/components/lists/Card'
import { Avatar, Icon, cx } from '@/ui/primitives'
import type { ResumeSession } from './resumeModel'

export interface ResumeCardProps {
    session: ResumeSession
    onContinue: () => void
    onDelete?: () => void
    deleting?: boolean
}

export function ResumeCard({ session, onContinue, onDelete, deleting = false }: ResumeCardProps) {
    const isChat = session.kind === 'chat'
    const meta = MODE_META[session.kind]

    const options: CardOption[] = [
        {
            type: 'custom',
            icon: <Icon icon={isChat ? MessageCircle : Play} size={15} />,
            label: meta.resumeLabel,
            onClick: onContinue,
            disabled: deleting,
        },
        ...(onDelete
            ? [
                  {
                      type: 'custom',
                      icon: <Icon icon={Trash2} size={15} />,
                      label: 'Delete',
                      onClick: onDelete,
                      disabled: deleting,
                      danger: true,
                  } as CardOption,
              ]
            : []),
    ]

    const handleKeyDown = (e: KeyboardEvent<HTMLElement>) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onContinue()
        }
    }

    return (
        <article
            role="button"
            tabIndex={deleting ? undefined : 0}
            aria-label={`${meta.resumeLabel}: ${session.title}`}
            aria-busy={deleting || undefined}
            onClick={deleting ? undefined : onContinue}
            onKeyDown={deleting ? undefined : handleKeyDown}
            className={cx(
                'group relative flex cursor-pointer items-center gap-4 rounded-lg border border-parchment-50/[.08]',
                'border-l-2 bg-ink-700 p-4 transition-all hover:-translate-y-[2px]',
                isChat
                    ? 'border-l-arcane-500/50 hover:border-arcane-500/45 hover:shadow-card-hover-arcane'
                    : 'border-l-ember-500/50 hover:border-ember-500/45 hover:shadow-card-hover',
                deleting && 'pointer-events-none opacity-60',
            )}
            data-testid="resume-card"
        >
            <Avatar
                name={session.title}
                src={resolveMediaUrl(session.imageUrl)}
                size={56}
                ring={isChat ? 'arcane' : 'ember'}
            />
            <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-2">
                    <h3 className="m-0 truncate font-display text-[18px] font-semibold leading-tight text-parchment-50">
                        {session.title}
                    </h3>
                    <ModeBadge mode={session.kind} compact />
                </div>
                {session.snippet && (
                    <p className="m-0 mt-1 line-clamp-1 font-narrative text-sm italic text-parchment-400">
                        {session.snippet}
                    </p>
                )}
                <p className="m-0 mt-1.5 font-mono text-[11px] tracking-wide text-parchment-400">{session.meta}</p>
            </div>
            <div
                className="opacity-100 transition-opacity sm:opacity-0 sm:focus-within:opacity-100 sm:group-hover:opacity-100"
                onClick={(e) => e.stopPropagation()}
            >
                <CardOptions options={options} aria-label={`Actions for ${session.title}`} />
            </div>
            <span
                aria-hidden="true"
                className={cx(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-all',
                    isChat
                        ? 'border-arcane-500/40 bg-arcane-500/15 text-arcane-300 group-hover:bg-arcane-500/30 group-hover:shadow-glow-arcane'
                        : 'border-ember-500/35 bg-ember-500/10 text-ember-400 group-hover:bg-ember-500 group-hover:text-on-ember group-hover:shadow-glow-ember',
                )}
            >
                <Icon icon={isChat ? MessageCircle : Play} size={15} />
            </span>
            {deleting && (
                <div className="absolute inset-0 z-[1] flex items-center justify-center rounded-lg bg-ink-900/70 font-medium text-parchment-50">
                    Deleting…
                </div>
            )}
        </article>
    )
}
