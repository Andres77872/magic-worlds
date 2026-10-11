/**
 * AppAssistantView — the presentational assistant page: every assistant's
 * conversation history on the left, the thread in the center, and "what the
 * assistant knows" on the right. Below `lg` the history moves into a drawer;
 * below `xl` the context panel does. A card or lorebook conversation reads here
 * and continues in its editor. Everything arrives through props so Storybook
 * can render every state without the API.
 *
 * Arcane marks the assistant's side (avatar ring, context panel, "thinking");
 * ember stays with the reader's own actions (send, active thread, new chat).
 */
import type { MouseEvent, ReactNode } from 'react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowRight, History, LogIn, MessageSquarePlus, MessagesSquare, RefreshCw, SlidersHorizontal, Unplug } from 'lucide-react'
import { Avatar, Button, Drawer, Eyebrow, Icon, IconButton, IconTile, Tag, cx } from '@/ui/primitives'
import { AssistantBanner } from '@/features/creation/common/components/assistant/AssistantBanner'
import { AssistantComposer } from '@/features/creation/common/components/assistant/AssistantComposer'
import { AssistantMessageList } from '@/features/creation/common/components/assistant/AssistantMessageList'
import {
    conversationTargetId,
    type AssistantNotice,
    type AssistantStatus,
    type AssistantTurn,
} from '@/features/creation/common/components/assistant/assistantModel'
import type { AssistantConversation } from '@/shared/types/assistant.types'
import type { AppAssistantSuggestion } from '../assistantSuggestions'
import { ASSISTANT_TAG_ICONS, assistantTag, conversationLabel } from '../assistantTags'
import { AssistantConversationRail } from './AssistantConversationRail'
import { AssistantKnowledgePanel, type AssistantKnowledgePanelProps } from './AssistantKnowledgePanel'

export interface AppAssistantViewProps {
    signedIn: boolean
    onLogin: () => void
    status: AssistantStatus
    /** True once the history list has loaded (or failed). */
    historyReady: boolean
    /** Every assistant's conversations, newest first. */
    conversations: AssistantConversation[]
    activeConversation: AssistantConversation | null
    /** Live names of the cards and lorebooks the conversations edit, by id. */
    targetNames: ReadonlyMap<string, string>
    turns: AssistantTurn[]
    notice: AssistantNotice | null
    /** The server does not offer the assistant: explain instead of inviting a question. */
    unavailable?: boolean
    /** Asks the server again (shown with the unavailable state). */
    onRecheck?: () => void
    suggestions: readonly AppAssistantSuggestion[]
    /** One-line summary of what the assistant can read ("12 cards · 3 lorebooks"). */
    knowledgeSummary: string
    knowledge: AssistantKnowledgePanelProps
    /** The model picker for the `app_assistant` feature (omitted in stories). */
    modelControl?: ReactNode
    onSend: (text: string) => void
    onStop: () => void
    onRetry: () => void
    onReload: () => void
    onDismissNotice: () => void
    onNewConversation: () => void
    onSelectConversation: (id: number) => void
    onDeleteConversation: (id: number) => void
    /** Opens a card or lorebook conversation in its editor, where it can keep editing. */
    onContinueInEditor: (conversation: AssistantConversation) => void
    /** In-app links (`#/…`) inside replies; the page decides how each opens. */
    onNavigateLink: (href: string) => void
    /** Drawers and modals owned by the page (focus picker, card preview). */
    overlays?: ReactNode
}

function SignedOutState({ onLogin }: { onLogin: () => void }) {
    const { t } = useTranslation()
    return (
        <div className="mx-auto flex max-w-xl flex-1 flex-col items-center justify-center gap-5 px-5 py-16 text-center">
            <IconTile icon={MessagesSquare} tone="arcane" size="lg" />
            <Eyebrow tone="arcane">{t('appAssistant.eyebrow')}</Eyebrow>
            <h1 className="font-display text-h2 font-semibold text-parchment-50">{t('appAssistant.signedOut.title')}</h1>
            <p className="font-narrative text-narrative text-parchment-300">{t('appAssistant.signedOut.body')}</p>
            <Button variant="primary" iconLeft={<Icon icon={LogIn} size={16} />} onClick={onLogin}>
                {t('appAssistant.signedOut.login')}
            </Button>
        </div>
    )
}

function OfflineState({ checking, onRecheck }: { checking: boolean; onRecheck?: () => void }) {
    const { t } = useTranslation()
    return (
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-8 sm:px-6 sm:py-12">
            <div className="mx-auto flex max-w-xl flex-col items-center gap-4 text-center">
                <IconTile icon={Unplug} tone="arcane" size="lg" />
                <Eyebrow tone="arcane">{t('appAssistant.eyebrow')}</Eyebrow>
                <h2 className="font-display text-h2 font-semibold leading-tight text-parchment-50">{t('appAssistant.offline.title')}</h2>
                <p className="max-w-prose font-narrative text-narrative text-parchment-300">{t('appAssistant.offline.body')}</p>
                {onRecheck && (
                    <Button variant="secondary" iconLeft={<Icon icon={RefreshCw} size={16} />} disabled={checking} onClick={onRecheck}>
                        {t('appAssistant.offline.recheck')}
                    </Button>
                )}
            </div>
        </div>
    )
}

function Welcome({ suggestions, knowledgeSummary, disabled, onSend }: {
    suggestions: readonly AppAssistantSuggestion[]
    knowledgeSummary: string
    disabled: boolean
    onSend: (text: string) => void
}) {
    const { t } = useTranslation()
    return (
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-8 sm:px-6 sm:py-12">
            <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 text-center">
                <Avatar name={t('appAssistant.avatarName')} size={64} ring="arcane" />
                <Eyebrow tone="arcane">{t('appAssistant.eyebrow')}</Eyebrow>
                <h2 className="font-display text-h2 font-semibold leading-tight text-parchment-50">{t('appAssistant.welcome.title')}</h2>
                <p className="max-w-prose font-narrative text-narrative text-parchment-300">{t('appAssistant.welcome.body')}</p>
                {knowledgeSummary && (
                    <p className="font-mono text-caption text-arcane-300" data-testid="assistant-knowledge-summary">{knowledgeSummary}</p>
                )}
                <ul className="mt-4 grid w-full grid-cols-1 gap-3 text-left sm:grid-cols-2">
                    {suggestions.map((suggestion) => (
                        <li key={suggestion.key}>
                            <button
                                type="button"
                                disabled={disabled}
                                onClick={() => onSend(t(`appAssistant.suggestions.${suggestion.key}.prompt`))}
                                className={cx(
                                    'group flex h-full w-full items-start gap-3 rounded-lg border border-parchment-50/[.08] bg-ink-700 p-4 text-left transition-all',
                                    'hover:-translate-y-[3px] disabled:pointer-events-none disabled:opacity-60',
                                    suggestion.tone === 'arcane' ? 'hover:shadow-card-hover-arcane' : 'hover:shadow-card-hover',
                                )}
                            >
                                <IconTile icon={suggestion.icon} tone={suggestion.tone} size="sm" glow />
                                <span className="min-w-0">
                                    <span className="block font-ui text-label font-semibold text-parchment-50">{t(`appAssistant.suggestions.${suggestion.key}.label`)}</span>
                                    <span className="mt-0.5 block font-ui text-caption leading-relaxed text-parchment-400">{t(`appAssistant.suggestions.${suggestion.key}.hint`)}</span>
                                </span>
                            </button>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    )
}

/** Replaces the composer for a card or lorebook conversation: it continues where it can apply changes. */
function EditorHandoff({ conversation, name, onContinue }: {
    conversation: AssistantConversation
    name: string | null
    onContinue: () => void
}) {
    const { t } = useTranslation()
    const tag = assistantTag(conversation)
    const bound = conversationTargetId(conversation) !== null
    return (
        <div className="flex flex-col gap-3 rounded-xl border border-parchment-50/10 bg-ink-700 p-4 shadow-md sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-1 items-start gap-3">
                <IconTile icon={ASSISTANT_TAG_ICONS[tag]} tone="ember" size="sm" />
                <div className="min-w-0">
                    <p className="font-ui text-label font-semibold text-parchment-50">
                        {t('appAssistant.handoff.title', { kind: t(`appAssistant.kinds.${tag}`) })}
                    </p>
                    <p className="mt-0.5 font-ui text-caption leading-relaxed text-parchment-300">
                        {bound && name ? t('appAssistant.handoff.bound', { name }) : t('appAssistant.handoff.draft')}
                    </p>
                </div>
            </div>
            <Button variant="primary" size="sm" className="shrink-0 self-end sm:self-auto" iconRight={<Icon icon={ArrowRight} size={16} />} onClick={onContinue}>
                {t('appAssistant.handoff.continue')}
            </Button>
        </div>
    )
}

export function AppAssistantView(props: AppAssistantViewProps) {
    const { t } = useTranslation()
    const [historyOpen, setHistoryOpen] = useState(false)
    const [contextOpen, setContextOpen] = useState(false)
    const streaming = props.status === 'streaming'
    const busy = props.status === 'streaming' || props.status === 'switching'
    const active = props.activeConversation
    const activeId = active?.conversation_id ?? null
    // Another assistant's conversation reads here and continues in its editor.
    const foreign = active !== null && active.kind !== 'app' ? active : null
    const activeTag = active ? assistantTag(active) : null
    const activeLabel = active ? conversationLabel(active, props.targetNames) : null
    const showWelcome = !props.turns.length && props.status !== 'switching' && !foreign
    const offline = Boolean(props.unavailable)

    if (!props.signedIn) {
        return (
            <div className="flex min-h-0 flex-1 flex-col">
                <SignedOutState onLogin={props.onLogin} />
            </div>
        )
    }

    const rail = (
        <AssistantConversationRail
            conversations={props.conversations}
            targetNames={props.targetNames}
            activeId={activeId}
            busy={busy || offline}
            loading={!props.historyReady}
            onNew={() => {
                setHistoryOpen(false)
                props.onNewConversation()
            }}
            onSelect={(id) => {
                setHistoryOpen(false)
                props.onSelectConversation(id)
            }}
            onDelete={props.onDeleteConversation}
        />
    )

    const context = (
        <div className="flex flex-col gap-5">
            {props.modelControl}
            <AssistantKnowledgePanel {...props.knowledge} disabled={props.knowledge.disabled || streaming} />
        </div>
    )

    // Replies link into the app with `#/…` hashes; route them in-app instead of
    // letting the browser jump (keeps the back stack and opens previews in place).
    const handleThreadClick = (event: MouseEvent<HTMLDivElement>) => {
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
        const anchor = (event.target as HTMLElement).closest('a')
        const href = anchor?.getAttribute('href')
        if (!href?.startsWith('#/')) return
        event.preventDefault()
        props.onNavigateLink(href)
    }

    return (
        <div className="flex min-h-0 flex-1 overflow-hidden">
            <aside
                aria-label={t('appAssistant.history.title')}
                className="hidden w-64 shrink-0 flex-col border-r border-parchment-50/[.08] bg-ink-900/40 px-3 py-4 lg:flex"
            >
                {rail}
            </aside>

            <section aria-label={t('appAssistant.title')} className="flex min-w-0 flex-1 flex-col">
                <header className="flex items-center gap-3 border-b border-parchment-50/[.08] px-4 py-3 sm:px-6">
                    <IconButton label={t('appAssistant.history.open')} className="lg:hidden" onClick={() => setHistoryOpen(true)}>
                        <History size={18} />
                    </IconButton>
                    <Avatar name={t('appAssistant.avatarName')} size={38} ring="arcane" status={streaming ? 'think' : 'none'} />
                    <div className="min-w-0 flex-1">
                        <h1 className="truncate font-display text-[21px] font-semibold leading-tight text-parchment-50">{t('appAssistant.title')}</h1>
                        <p className="flex min-w-0 items-center gap-2 font-ui text-caption text-parchment-400">
                            {activeTag && (
                                <Tag className="shrink-0 gap-1">
                                    <Icon icon={ASSISTANT_TAG_ICONS[activeTag]} size={12} />
                                    {/* Narrow headers keep the room for the name; the icon still tags the kind. */}
                                    <span className="sr-only sm:not-sr-only">{t(`appAssistant.kinds.${activeTag}`)}</span>
                                </Tag>
                            )}
                            <span className="truncate">
                                {active ? activeLabel ?? t('appAssistant.history.untitled') : t('appAssistant.newConversation')}
                            </span>
                        </p>
                    </div>
                    <IconButton label={t('appAssistant.history.newChat')} disabled={busy || offline} className="lg:hidden" onClick={props.onNewConversation}>
                        <MessageSquarePlus size={18} />
                    </IconButton>
                    <IconButton label={t('appAssistant.knowledge.open')} className="xl:hidden" onClick={() => setContextOpen(true)}>
                        <SlidersHorizontal size={18} />
                    </IconButton>
                </header>

                <div className="flex min-h-0 flex-1 flex-col" onClickCapture={handleThreadClick}>
                    {offline && showWelcome ? (
                        <OfflineState checking={props.status === 'initializing'} onRecheck={props.onRecheck} />
                    ) : showWelcome ? (
                        <Welcome
                            suggestions={props.suggestions}
                            knowledgeSummary={props.knowledgeSummary}
                            disabled={busy}
                            onSend={props.onSend}
                        />
                    ) : (
                        <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col">
                            <AssistantMessageList
                                turns={props.turns}
                                status={props.status}
                                suggestions={[]}
                                onSuggestion={props.onSend}
                                conversationKey={activeId}
                            />
                        </div>
                    )}
                </div>

                <div className="mx-auto w-full max-w-3xl px-3 pb-3 sm:px-4 sm:pb-4">
                    {props.notice && (
                        <div className="mb-2 overflow-hidden rounded-lg">
                            <AssistantBanner
                                notice={props.notice}
                                onRetry={props.onRetry}
                                onReload={props.onReload}
                                onDismiss={props.onDismissNotice}
                            />
                        </div>
                    )}
                    {foreign ? (
                        <EditorHandoff
                            conversation={foreign}
                            name={activeLabel}
                            onContinue={() => props.onContinueInEditor(foreign)}
                        />
                    ) : (
                        <>
                            <AssistantComposer
                                streaming={streaming}
                                disabled={props.status === 'switching' || offline}
                                placeholder={offline ? t('appAssistant.notices.unavailable') : t('appAssistant.composerPlaceholder')}
                                onSend={props.onSend}
                                onStop={props.onStop}
                                className="rounded-xl border shadow-md"
                            />
                            <p className="mt-2 text-center font-ui text-micro text-parchment-500">{t('appAssistant.disclaimer')}</p>
                        </>
                    )}
                </div>
            </section>

            <aside
                aria-label={t('appAssistant.knowledge.title')}
                className="hidden w-80 shrink-0 overflow-y-auto border-l border-parchment-50/[.08] bg-ink-900/40 px-4 py-5 [scrollbar-width:thin] xl:block"
            >
                {context}
            </aside>

            <Drawer
                open={historyOpen}
                onClose={() => setHistoryOpen(false)}
                size="sm"
                eyebrow={t('appAssistant.eyebrow')}
                title={t('appAssistant.history.title')}
                icon={<Icon icon={History} size={18} />}
                className="lg:hidden"
            >
                <div className="flex h-full min-h-[60vh] flex-col">{rail}</div>
            </Drawer>
            <Drawer
                open={contextOpen}
                onClose={() => setContextOpen(false)}
                size="md"
                eyebrow={t('appAssistant.eyebrow')}
                title={t('appAssistant.knowledge.title')}
                icon={<Icon icon={SlidersHorizontal} size={18} />}
                className="xl:hidden"
            >
                {context}
            </Drawer>

            {props.overlays}
        </div>
    )
}
