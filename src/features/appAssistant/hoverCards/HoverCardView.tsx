/**
 * HoverCardView — the presentational hover card: a lock bar that fills while
 * the card is transient, a drag handle (grip + kind), portrait, title, badge,
 * last update, description with nested links, tags, and a one-line footer with
 * compact Focus / View / Open actions. View previews the record over the
 * thread; Open is a real link to its editor, in a new browser tab. Every state
 * arrives through props so Storybook can render it without the controller or
 * the API.
 *
 * Ember marks the reader's own actions (links, View, Open); arcane marks what
 * the assistant reads (the lock once it holds, the Focus pin).
 */
import { useMemo, type HTMLAttributes, type ReactNode, type Ref } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowUpRight, BookOpen, Check, Clock, Crosshair, Eye, GripVertical, History, Lock, RotateCw, X } from 'lucide-react'
import { Button, ButtonLink, Eyebrow, Icon, IconButton, Tag, cx, gradientFor, type DragHandleProps } from '@/ui/primitives'
import { formatApiDateTime, formatRelativeTime } from '@/utils/time'
import { FOCUS_ICONS } from '../components/knowledgeIcons'
import { hoverCardDomId } from './hoverCardController'
import {
    linkifyHoverText,
    type HoverCardKind,
    type HoverCardModel,
    type HoverCardRef,
    type HoverNameIndex,
} from './hoverCardModel'

export type HoverCardData =
    | { status: 'loading' }
    | { status: 'ready'; model: HoverCardModel }
    /** `checked`: the server was asked and the record is gone (remembered for the session). */
    | { status: 'missing'; checked: boolean }
    | { status: 'error' }

export interface HoverCardFocusState {
    inFocus: boolean
    /** Rough cost of reading the record in full with every question. */
    tokens: number
    /** Why the pin cannot change right now (reply streaming, shelf full). */
    blockedReason: string | null
}

export interface HoverCardViewProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
    ref?: Ref<HTMLDivElement>
    uid: number
    kind: HoverCardKind
    /** The link text: the title while loading or when the record is gone. */
    label: string
    data: HoverCardData
    imageSrc?: string | null
    imageLoading?: boolean
    locked: boolean
    torn: boolean
    /** Null hides the Focus action (records outside the library cannot join focus). */
    focus: HoverCardFocusState | null
    /** Other library names to link inside the text; null renders plain text (deepest card). */
    nameIndex?: HoverNameIndex | null
    renderLink?: (ref: HoverCardRef, text: string, key: string) => ReactNode
    handleProps?: Partial<DragHandleProps>
    onClose?: () => void
    onToggleFocus?: () => void
    /** Previews the record over the thread (the card preview modal, a lorebook window). */
    onView?: () => void
    /** The record's editor; Open shows it in a new tab. Null hides Open (records outside the library). */
    editorHref?: string | null
    /** Fires as the Open link is followed (the card chain closes). */
    onOpenEditor?: () => void
    /** Shown on the error state: asks the server again. */
    onRetry?: () => void
}

function initials(name: string): string {
    return name.trim().split(/\s+/).slice(0, 2).map((word) => word.charAt(0)).join('').toUpperCase() || '?'
}

function Portrait({ kind, title, src, loading }: { kind: HoverCardKind; title: string; src: string | null; loading: boolean }) {
    if (kind === 'lorebook') {
        return (
            <span className="grid size-14 shrink-0 place-items-center rounded-md bg-ink-600 text-parchment-200" aria-hidden>
                <Icon icon={BookOpen} size={24} />
            </span>
        )
    }
    return (
        <span
            className={cx(
                'grid size-14 shrink-0 place-items-center overflow-hidden rounded-md font-display text-[22px] font-semibold text-ember-200',
                loading && 'image-shimmer',
            )}
            style={src || loading ? undefined : { background: gradientFor(title) }}
            aria-hidden
        >
            {src ? <img src={src} alt="" className="h-full w-full object-cover" /> : !loading && initials(title)}
        </span>
    )
}

export function HoverCardView({
    ref,
    uid,
    kind,
    label,
    data,
    imageSrc = null,
    imageLoading = false,
    locked,
    torn,
    focus,
    nameIndex = null,
    renderLink,
    handleProps,
    onClose,
    onToggleFocus,
    onView,
    editorHref = null,
    onOpenEditor,
    onRetry,
    className,
    ...rest
}: HoverCardViewProps) {
    const { t, i18n } = useTranslation()
    const model = data.status === 'ready' ? data.model : null
    const kindLabel = t(`appAssistant.focusKinds.${kind}`)
    const title = model?.title || label || kindLabel

    const segments = useMemo(
        () => (model ? (nameIndex && renderLink ? linkifyHoverText(model.description, nameIndex, model.ref) : [model.description].filter(Boolean)) : []),
        [model, nameIndex, renderLink],
    )
    const link = (ref: HoverCardRef | null, text: string, key: string) => (ref && nameIndex && renderLink ? renderLink(ref, text, key) : <span key={key}>{text}</span>)
    const world = model?.relations.find((relation) => relation.role === 'world')
    const cast = model?.relations.filter((relation) => relation.role === 'cast') ?? []
    const relative = model?.updatedAt ? formatRelativeTime(model.updatedAt) : ''

    return (
        <div
            ref={ref}
            id={hoverCardDomId(uid)}
            data-hover-card={uid}
            role="dialog"
            aria-label={title}
            className={cx(
                'w-[300px] max-w-[calc(100vw-16px)] overflow-hidden rounded-xl border bg-ink-700 font-ui text-parchment-100 shadow-lg',
                torn ? 'border-arcane-400/60' : 'border-ember-500/35',
                className,
            )}
            {...rest}
        >
            <div className="h-0.5 bg-ink-600" aria-hidden>
                <div className={cx('h-full origin-left', locked ? 'bg-arcane-400' : 'animate-hover-lock bg-ember-500')} />
            </div>

            <div className="flex items-center gap-1 px-2 pt-1.5">
                <button
                    type="button"
                    {...handleProps}
                    aria-label={t('appAssistant.hoverCard.move')}
                    title={t('appAssistant.hoverCard.move')}
                    className="flex min-w-0 flex-1 cursor-grab touch-none select-none items-center gap-1.5 rounded-xs px-1 py-1 text-left active:cursor-grabbing"
                >
                    <span className="shrink-0 text-parchment-400"><Icon icon={GripVertical} size={14} /></span>
                    <Eyebrow tone="arcane" className="flex min-w-0 items-center gap-1 text-[10px]">
                        <Icon icon={FOCUS_ICONS[kind]} size={12} />
                        <span className="truncate">{model?.version ? `${kindLabel} · v${model.version}` : kindLabel}</span>
                    </Eyebrow>
                </button>
                {locked && (
                    <span className="grid size-6 place-items-center text-arcane-300" title={t('appAssistant.hoverCard.locked')}>
                        <Icon icon={Lock} size={13} />
                        <span className="sr-only">{t('appAssistant.hoverCard.locked')}</span>
                    </span>
                )}
                {torn && onClose && (
                    <IconButton label={t('appAssistant.hoverCard.close')} size="sm" onClick={onClose}>
                        <Icon icon={X} size={14} />
                    </IconButton>
                )}
            </div>

            {data.status === 'loading' && (
                <div className="flex gap-3 px-3.5 pb-3.5 pt-1.5" aria-busy="true">
                    <span className="image-shimmer size-14 shrink-0 rounded-md" />
                    <span className="flex flex-1 flex-col gap-2 pt-1">
                        <span className="image-shimmer h-3 w-3/5 rounded-xs" />
                        <span className="image-shimmer h-2.5 w-11/12 rounded-xs" />
                    </span>
                    <span className="sr-only">{t('appAssistant.hoverCard.loading')}</span>
                </div>
            )}

            {(data.status === 'missing' || data.status === 'error') && (
                <>
                    <div className="px-3.5 pb-3 pt-1">
                        <h3 className="font-display text-[20px] font-semibold leading-tight text-parchment-400">{title}</h3>
                        <p className="mt-1 font-narrative text-[13px] leading-relaxed text-parchment-300">
                            {data.status === 'missing' ? t('appAssistant.hoverCard.missing') : t('appAssistant.hoverCard.error')}
                        </p>
                    </div>
                    {data.status === 'missing' && data.checked && (
                        <div className="flex items-center gap-1 border-t border-parchment-50/[.07] px-3.5 py-2 text-meta text-parchment-400">
                            <Icon icon={History} size={12} />
                            {t('appAssistant.hoverCard.checked')}
                        </div>
                    )}
                    {data.status === 'error' && onRetry && (
                        <div className="flex justify-end border-t border-parchment-50/[.07] py-2 pl-3.5 pr-2.5">
                            <Button size="xs" variant="secondary" iconLeft={<Icon icon={RotateCw} size={14} />} onClick={onRetry}>
                                {t('appAssistant.hoverCard.retry')}
                            </Button>
                        </div>
                    )}
                </>
            )}

            {model && (
                <>
                    <div className="flex gap-3 px-3.5 pb-2 pt-1">
                        <Portrait kind={kind} title={model.title} src={imageSrc} loading={imageLoading} />
                        <div className="min-w-0">
                            <h3 className="line-clamp-2 font-display text-[20px] font-semibold leading-tight text-parchment-50">{model.title}</h3>
                            {model.badge && <Tag className="mt-1 max-w-full truncate">{model.badge}</Tag>}
                            {relative && (
                                <p className="mt-1 flex min-w-0 items-center gap-1 text-meta text-parchment-400" title={formatApiDateTime(model.updatedAt)}>
                                    <Icon icon={Clock} size={12} />
                                    <span className="truncate">{relative}</span>
                                </p>
                            )}
                        </div>
                    </div>

                    <p className={cx('line-clamp-4 px-3.5 font-narrative text-[13px] leading-relaxed', segments.length ? 'text-parchment-200' : 'italic text-parchment-400')}>
                        {segments.length
                            ? segments.map((segment, index) => (typeof segment === 'string' ? segment : link(segment.ref, segment.text, `link-${index}`)))
                            : t('appAssistant.hoverCard.noDescription')}
                    </p>

                    {(world || cast.length > 0) && (
                        <dl className="mt-2 flex flex-col gap-0.5 px-3.5 text-caption">
                            {world && (
                                <div className="flex min-w-0 gap-1.5">
                                    <dt className="shrink-0 text-parchment-400">{t('appAssistant.hoverCard.world')}</dt>
                                    <dd className="min-w-0 truncate text-parchment-200">{link(world.ref, world.name, 'world')}</dd>
                                </div>
                            )}
                            {cast.length > 0 && (
                                <div className="flex min-w-0 gap-1.5">
                                    <dt className="shrink-0 text-parchment-400">{t('appAssistant.hoverCard.cast')}</dt>
                                    <dd className="min-w-0 text-parchment-200">
                                        {cast.map((member, index) => (
                                            <span key={`cast-${index}`}>
                                                {index > 0 && ', '}
                                                {link(member.ref, member.name, `cast-link-${index}`)}
                                            </span>
                                        ))}
                                    </dd>
                                </div>
                            )}
                        </dl>
                    )}

                    {(model.tags.length > 0 || model.moreTags > 0) && (
                        <div className="flex flex-wrap gap-1 px-3.5 pt-2">
                            {model.tags.map((tag, index) => <Tag key={`${tag}-${index}`} className="max-w-full truncate">{tag}</Tag>)}
                            {model.moreTags > 0 && <Tag>+{model.moreTags}</Tag>}
                        </div>
                    )}

                    <div className="mt-2.5 flex items-center justify-end gap-1.5 border-t border-parchment-50/[.07] py-2 pl-3.5 pr-2.5">
                        {focus && (
                            <span
                                className="inline-flex"
                                title={focus.blockedReason
                                    ?? (focus.inFocus
                                        ? t('appAssistant.hoverCard.focusRemove')
                                        : t('appAssistant.hoverCard.focusAdd', { tokens: focus.tokens.toLocaleString(i18n.language) }))}
                            >
                                <Button
                                    size="xs"
                                    variant={focus.inFocus ? 'arcane' : 'secondary'}
                                    aria-pressed={focus.inFocus}
                                    disabled={Boolean(focus.blockedReason)}
                                    iconLeft={<Icon icon={focus.inFocus ? Check : Crosshair} size={14} />}
                                    onClick={onToggleFocus}
                                >
                                    {focus.inFocus ? t('appAssistant.hoverCard.inFocus') : t('appAssistant.hoverCard.focus')}
                                </Button>
                            </span>
                        )}
                        {onView && (
                            <Button
                                size="xs"
                                variant="secondary"
                                title={t('appAssistant.hoverCard.viewHint')}
                                iconLeft={<Icon icon={Eye} size={14} />}
                                onClick={onView}
                            >
                                {t('appAssistant.hoverCard.view')}
                            </Button>
                        )}
                        {editorHref && (
                            <ButtonLink
                                size="xs"
                                variant="secondary"
                                href={editorHref}
                                target="_blank"
                                rel="noopener noreferrer"
                                title={t('appAssistant.hoverCard.openHint')}
                                iconRight={<Icon icon={ArrowUpRight} size={14} />}
                                onClick={onOpenEditor}
                            >
                                {t('appAssistant.hoverCard.open')}
                            </ButtonLink>
                        )}
                    </div>
                </>
            )}
        </div>
    )
}
