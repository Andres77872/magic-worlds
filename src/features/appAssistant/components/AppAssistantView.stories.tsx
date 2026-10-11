import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import type { AssistantTurn } from '@/features/creation/common/components/assistant/assistantModel'
import type { AssistantChatMessage, AssistantConversation } from '@/shared/types/assistant.types'
import { APP_ASSISTANT_SUGGESTIONS } from '../assistantSuggestions'
import { AppAssistantView } from './AppAssistantView'

function turn(id: number, role: AssistantChatMessage['role'], content: string, extra: Partial<AssistantTurn> = {}): AssistantTurn {
    return {
        message: { message_id: id, conversation_id: 4, sequence_no: id, role, status: 'completed', content, created_at: '2026-10-10T18:42:00Z' },
        appliedChanges: [],
        isStreaming: false,
        isInterrupted: false,
        ...extra,
    }
}

const CONVERSATIONS: AssistantConversation[] = [
    { conversation_id: 4, kind: 'app', title: 'Plan an adventure in Saltmarsh', updated_at: '2026-10-10T18:42:00Z' },
    { conversation_id: 7, kind: 'card', card_type: 'character', card_id: 'c1', title: 'Untitled character', updated_at: '2026-10-10T16:20:00Z' },
    { conversation_id: 3, kind: 'app', title: 'How do resources work?', updated_at: '2026-10-09T11:05:00Z' },
    { conversation_id: 6, kind: 'lorebook', lorebook_id: 'l1', title: 'Saltmarsh lore', updated_at: '2026-10-08T20:10:00Z' },
    { conversation_id: 5, kind: 'card', card_type: 'world', card_id: null, title: 'Untitled world', updated_at: '2026-10-05T09:15:00Z' },
    { conversation_id: 2, kind: 'app', title: 'Review my lorebooks', updated_at: '2026-10-02T21:30:00Z' },
]

/** Live library names: the character conversation began on a draft that the assistant then saved as Mira Vell. */
const TARGET_NAMES: ReadonlyMap<string, string> = new Map([['c1', 'Mira Vell'], ['l1', 'Saltmarsh lore']])

const THREAD: AssistantTurn[] = [
    turn(1, 'user', 'Suggest an adventure I could start with cards already in my library.'),
    turn(2, 'assistant', [
        'Here is a scene your library can carry tonight:',
        '',
        '**The drowned bells** — the harbor bells of [Saltmarsh](#/gallery/worlds?card=w1) stop ringing at low tide.',
        '',
        '- **Cast:** [Mira Vell](#/gallery/characters?card=c1), the archivist who hears them underwater, and your persona [Wren](#/gallery/personas?card=p1).',
        '- **Item:** the [Tide lantern](#/gallery/items?card=i1) lets Wren follow the sound below the surface.',
        '- **Lore:** your [Saltmarsh lore](#/lorebook?lorebook=l1) lorebook already defines the Bell guild, so the GM will pull it in when the guild is named.',
        '',
        'To set it up, open [Adventures](#/gallery/adventures) and choose **New adventure**, then add the cast and world above.',
    ].join('\n')),
]

const CARD_THREAD: AssistantTurn[] = [
    turn(1, 'user', 'Make her an archivist who can hear the drowned bells.'),
    turn(2, 'assistant', 'Done. Mira is now the Bell guild archivist; her backstory ties her hearing to the night the harbor flooded.', {
        appliedChanges: [{ kind: 'patch', fields: ['name', 'description', 'backstory'] }],
    }),
]

const KNOWLEDGE = {
    sources: ['guide', 'library', 'lorebooks', 'resources', 'novels'] as const,
    sections: [
        { key: 'guide' as const, count: 11, markdown: '', tokens: 2100, truncated: false },
        { key: 'library' as const, count: 18, markdown: '', tokens: 1300, truncated: false },
        { key: 'lorebooks' as const, count: 3, markdown: '', tokens: 640, truncated: false },
        { key: 'resources' as const, count: 5, markdown: '', tokens: 380, truncated: false },
        { key: 'novels' as const, count: 1, markdown: '', tokens: 90, truncated: false },
    ],
    enabled: new Set(['guide', 'library', 'lorebooks', 'resources'] as const),
    onToggle: fn(),
    focus: [
        { kind: 'world' as const, id: 'w1', name: 'Saltmarsh' },
        { kind: 'lorebook' as const, id: 'l1', name: 'Saltmarsh lore' },
    ],
    focusLimit: 6,
    onAddFocus: fn(),
    onRemoveFocus: fn(),
    tokens: 4420,
    truncated: false,
}

/**
 * The app-wide assistant page (`#/assistant`, "Assistant" beside Explore and
 * Community). History on the left, the thread in the center, and "what the
 * assistant knows" on the right; arcane marks the AI side, ember the reader's
 * own actions. Replies link back into the app with in-app hashes.
 */
const meta = {
    title: 'Assistant/App assistant',
    component: AppAssistantView,
    tags: ['autodocs'],
    parameters: {
        layout: 'fullscreen',
        docs: {
            description: {
                component: 'The app-wide assistant view. Presentational: the page wires the knowledge sources, the `/assistant` stream (kind `app`), link routing, and the hand-off of card and lorebook conversations to their editors. The history lists every assistant, tagged and filterable by kind.',
            },
        },
    },
    decorators: [(Story) => <div className="flex h-[760px] flex-col bg-ink-800"><Story /></div>],
    args: {
        signedIn: true,
        onLogin: fn(),
        status: 'idle',
        historyReady: true,
        conversations: CONVERSATIONS,
        activeConversation: null,
        targetNames: TARGET_NAMES,
        turns: [],
        notice: null,
        suggestions: APP_ASSISTANT_SUGGESTIONS,
        knowledgeSummary: '18 cards · 3 lorebooks · 5 resources · 1 novel',
        knowledge: KNOWLEDGE,
        onSend: fn(),
        onStop: fn(),
        onRetry: fn(),
        onReload: fn(),
        onDismissNotice: fn(),
        onNewConversation: fn(),
        onSelectConversation: fn(),
        onDeleteConversation: fn(),
        onContinueInEditor: fn(),
        onNavigateLink: fn(),
    },
    argTypes: {
        status: { control: 'inline-radio', options: ['idle', 'initializing', 'switching', 'streaming'] },
        signedIn: { control: 'boolean' },
        knowledge: { control: false },
        turns: { control: false },
        suggestions: { control: false },
    },
} satisfies Meta<typeof AppAssistantView>

export default meta
type Story = StoryObj<typeof meta>

export const Welcome: Story = {}

export const Conversation: Story = {
    args: { activeConversation: CONVERSATIONS[0], turns: THREAD },
}

export const Streaming: Story = {
    args: {
        status: 'streaming',
        activeConversation: CONVERSATIONS[1],
        turns: [
            turn(1, 'user', 'How do resources work?'),
            turn(2, 'assistant', 'Resources are reusable `.md` or `.txt` sources. Create one in [Resources](#/gallery/resources), then', { isStreaming: true }),
        ],
    },
}

/** A card assistant's conversation reads here, tagged with its kind, and continues in the character editor. */
export const CardConversation: Story = {
    args: { activeConversation: CONVERSATIONS[1], turns: CARD_THREAD },
}

/** A conversation that started on an unsaved draft continues in a new draft. */
export const DraftConversation: Story = {
    args: {
        activeConversation: CONVERSATIONS[4],
        turns: [
            turn(1, 'user', 'A coastal world where the tide never fully returns.'),
            turn(2, 'assistant', 'I can shape that once you save a first draft. Start with a name and the shoreline you have in mind.'),
        ],
    },
}

/** The server switched the app assistant off (`503 ASSISTANT_DISABLED`): no model picker, no starters, a way to check again. */
export const ServerUnavailable: Story = {
    args: { unavailable: true, onRecheck: fn() },
}

export const PartialContext: Story = {
    args: { knowledge: { ...KNOWLEDGE, tokens: 15200, truncated: true } },
}

export const SignedOut: Story = {
    args: { signedIn: false },
}
