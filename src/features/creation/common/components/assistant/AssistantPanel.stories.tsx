import type { Meta, StoryObj } from '@storybook/react-vite'
import { MessageCircle } from 'lucide-react'
import { AssistantBanner } from './AssistantBanner'
import { AssistantComposer } from './AssistantComposer'
import { AssistantHeader } from './AssistantHeader'
import { AssistantMessageList } from './AssistantMessageList'
import { AssistantPendingCardBanner } from './CardAssistantChatbot'
import { ConversationMenu } from './ConversationMenu'
import { SAMPLE_CONVERSATIONS, SAMPLE_CONVERSATION_TURNS } from './assistantFixtures'
import { ASSISTANT_SUGGESTIONS } from './suggestions'
import type { AssistantNotice, AssistantStatus, AssistantTurn } from './useCardAssistant'

/**
 * Static composition of the full Card Assistant panel. The real
 * `CardAssistantChatbot` drives these exact pieces through the
 * `useCardAssistant` hook (live SSE streaming + API calls), which a story
 * can't host — so this assembles the same layout from the presentational
 * parts to document the end-to-end look.
 */
function PanelComposition({
  turns = SAMPLE_CONVERSATION_TURNS,
  status = 'idle',
  streaming = false,
  notice = null,
  pendingCard = false,
}: {
  turns?: AssistantTurn[]
  status?: AssistantStatus
  streaming?: boolean
  notice?: AssistantNotice | null
  pendingCard?: boolean
}) {
  return (
    <section
      aria-label="Card assistant"
      className="flex h-[640px] w-[420px] flex-col overflow-hidden rounded-xl border border-parchment-50/10 bg-ink-800 shadow-xl"
    >
      <AssistantHeader
        cardTitle="The Vitrine Expanse"
        streaming={streaming}
        onClose={() => {}}
        menu={(
          <ConversationMenu
            conversations={SAMPLE_CONVERSATIONS}
            activeId={1}
            disabled={streaming}
            onSelect={() => {}}
            onNew={() => {}}
            onDelete={() => {}}
          />
        )}
      />
      {pendingCard && <AssistantPendingCardBanner onApply={() => {}} onDismiss={() => {}} />}
      <AssistantMessageList
        turns={turns}
        status={status}
        suggestions={ASSISTANT_SUGGESTIONS.world}
        onSuggestion={() => {}}
        conversationKey={1}
      />
      {notice && <AssistantBanner notice={notice} onRetry={() => {}} onReload={() => {}} onDismiss={() => {}} />}
      <AssistantComposer streaming={streaming} onSend={() => {}} onStop={() => {}} />
    </section>
  )
}

const meta: Meta = {
  title: 'Creation/Assistant/Panel',
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'The floating AI copilot for the card creators (FAB bottom-right → this 420px panel). Composed here statically from the assistant subcomponents; in the app, `CardAssistantChatbot` + `useCardAssistant` add live SSE streaming, tool-call application, and conversation management on top of this exact layout.',
      },
    },
  },
}

export default meta
type Story = StoryObj<typeof meta>

/** A settled session: history in the menu, applied-change badges, ready composer. */
export const FullPanel: Story = {
  render: () => <PanelComposition />,
}

/** First open on a fresh card — suggestion chips invite the first instruction. */
export const EmptyState: Story = {
  render: () => <PanelComposition turns={[]} />,
}

/** Mid-generation: the header avatar pulses, the dots stream, Send is Stop. */
export const StreamingReply: Story = {
  render: () => (
    <PanelComposition
      streaming
      status="streaming"
      turns={SAMPLE_CONVERSATION_TURNS.slice(0, 1)}
    />
  ),
}

/** After switching to an older conversation that carries a card snapshot. */
export const PendingCardSnapshot: Story = {
  render: () => <PanelComposition pendingCard />,
}

/** A retryable failure surfaced above the composer. */
export const WithErrorBanner: Story = {
  render: () => (
    <PanelComposition
      notice={{ kind: 'error', message: 'The assistant is briefly unavailable. Try again in a moment.', canRetry: true }}
    />
  ),
}

/** The collapsed launcher — an ember FAB pinned bottom-right in the app. */
export const FloatingLauncher: Story = {
  render: () => (
    <button
      type="button"
      aria-label="Open card assistant"
      className="grid h-14 w-14 cursor-pointer place-items-center rounded-full bg-ember-500 text-on-ember shadow-lg transition-all hover:bg-ember-400 hover:shadow-glow-ember active:scale-[.98]"
    >
      <MessageCircle size={24} />
    </button>
  ),
}
