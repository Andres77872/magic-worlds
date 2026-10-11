import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { i18n } from '@/app/i18n'
import { AssistantMarkdown } from '@/features/creation/common/components/assistant/AssistantMarkdown'
import { AssistantLinkContext } from '@/features/creation/common/components/assistant/assistantLinkContext'
import type { FocusRef } from '../appKnowledge'
import { buildHoverNameIndex, focusMatchKey, hoverCardFromLibrary, type HoverCardModel, type HoverCardRef } from './hoverCardModel'
import { HOVER_CARD_REPLY, hoverCardLibrary } from './hoverCardFixtures'
import { HoverCardLink } from './HoverCardLink'
import { HoverCardsProvider } from './HoverCardsProvider'
import { HoverCardView } from './HoverCardView'

const t = i18n.getFixedT('en')

function model(ref: HoverCardRef): HoverCardModel {
    const found = hoverCardFromLibrary(hoverCardLibrary, ref, t)
    if (!found) throw new Error(`Missing fixture ${ref.kind}:${ref.id}`)
    return found
}

const nameIndex = buildHoverNameIndex(hoverCardLibrary)
const LYRA = model({ kind: 'character', id: 'c-lyra' })

const meta = {
    title: 'Assistant/Hover card',
    component: HoverCardView,
    tags: ['autodocs'],
    parameters: {
        docs: {
            description: {
                component: 'The preview a library link in an assistant reply opens on hover. The ember bar fills for a second while the card is transient, then it turns arcane and the card locks open. Names of other library records inside it open nested cards; dragging the grip tears the card off so it stays until closed; Focus pins the record into what the assistant reads in full.',
            },
        },
    },
    argTypes: {
        locked: { control: 'boolean', description: 'Locked open (the bar has filled).' },
        torn: { control: 'boolean', description: 'Dragged off its link: arcane border and a close button.' },
        data: { control: false },
        focus: { control: false },
        nameIndex: { control: false },
        renderLink: { control: false },
        handleProps: { control: false },
        onClose: { action: 'closed' },
        onToggleFocus: { action: 'focus toggled' },
        onOpen: { action: 'opened' },
        onRetry: { action: 'retried' },
    },
    args: {
        uid: 1,
        kind: 'character',
        label: 'Lyra Brisaveloz',
        data: { status: 'ready', model: LYRA },
        locked: false,
        torn: false,
        focus: { inFocus: false, tokens: 420, blockedReason: null },
        nameIndex,
        renderLink: (_ref, text, key) => (
            <a key={key} href="#" className="text-ember-300 underline decoration-ember-400/45 underline-offset-[3px]">{text}</a>
        ),
        onClose: fn(),
        onToggleFocus: fn(),
        onOpen: fn(),
    },
} satisfies Meta<typeof HoverCardView>

export default meta
type Story = StoryObj<typeof meta>

/** Just opened: the lock bar is filling. */
export const Transient: Story = {}

/** After a second the card holds, so the reader can move into it and hover its links. */
export const Locked: Story = { args: { locked: true } }

/** Already on the focus shelf: the assistant reads it in full with every question. */
export const InFocus: Story = { args: { locked: true, focus: { inFocus: true, tokens: 420, blockedReason: null } } }

/** The shelf is full, so the pin explains why it cannot be added. */
export const FocusFull: Story = {
    args: { locked: true, focus: { inFocus: false, tokens: 420, blockedReason: t('appAssistant.hoverCard.focusFull', { limit: 6 }) } },
}

/** Dragged off its link: it stays open until its close button. */
export const TornOff: Story = { args: { locked: true, torn: true } }

/** An adventure lists its world and cast as nested links. */
export const Adventure: Story = {
    args: {
        kind: 'adventure',
        label: 'A grand gathering of wizards…',
        locked: true,
        data: { status: 'ready', model: model({ kind: 'adventure', id: 'a-conclave' }) },
        focus: { inFocus: false, tokens: 610, blockedReason: null },
    },
}

/** A lorebook shows its entry count and first entries. */
export const Lorebook: Story = {
    args: {
        kind: 'lorebook',
        label: 'Aetheric Resonance — Hard Magic System',
        data: { status: 'ready', model: model({ kind: 'lorebook', id: 'l-resonance' }) },
        focus: { inFocus: false, tokens: 1850, blockedReason: null },
    },
}

/** A card outside the library is fetched once, only when hovered. */
export const Loading: Story = { args: { label: 'Kai (old draft)', data: { status: 'loading' }, focus: null } }

/** The request failed (offline, server error): nothing is cached, so Retry asks again. */
export const LoadError: Story = { args: { label: 'Kai (old draft)', locked: true, data: { status: 'error' }, focus: null, onRetry: fn() } }

/** The server says the card is gone; the answer is remembered for the session. */
export const Missing: Story = { args: { label: 'Kai (old draft)', locked: true, data: { status: 'missing', checked: true }, focus: null } }

function InteractiveReply() {
    const [focus, setFocus] = useState<FocusRef[]>([])
    const toggle = (ref: HoverCardRef) => setFocus((current) => (
        current.some((entry) => focusMatchKey(entry) === focusMatchKey(ref))
            ? current.filter((entry) => focusMatchKey(entry) !== focusMatchKey(ref))
            : [...current, ref]
    ))
    return (
        <HoverCardsProvider
            library={hoverCardLibrary}
            focus={focus}
            focusLimit={6}
            focusBusy={false}
            focusTokens={() => 420}
            onToggleFocus={toggle}
            onOpen={fn()}
        >
            <AssistantLinkContext.Provider value={HoverCardLink}>
                <div className="max-w-2xl">
                    <AssistantMarkdown content={HOVER_CARD_REPLY} />
                </div>
            </AssistantLinkContext.Provider>
        </HoverCardsProvider>
    )
}

/**
 * The real thing: hover any link (Ctrl/Cmd opens at once), wait for the lock,
 * hover a name inside the card, drag a card by its grip, and pin with Focus.
 */
export const InAReply: Story = {
    parameters: { layout: 'padded', controls: { disable: true } },
    render: () => <InteractiveReply />,
}
