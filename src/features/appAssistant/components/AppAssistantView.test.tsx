import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { AssistantTurn } from '@/features/creation/common/components/assistant/assistantModel'
import { AssistantLinkContext } from '@/features/creation/common/components/assistant/assistantLinkContext'
import { APP_ASSISTANT_SUGGESTIONS } from '../assistantSuggestions'
import { AppAssistantView, type AppAssistantViewProps } from './AppAssistantView'
import { AssistantReplyLink } from './AssistantReplyLink'

function turn(id: number, role: 'user' | 'assistant', content: string): AssistantTurn {
    return {
        message: { message_id: id, conversation_id: 3, sequence_no: id, role, status: 'completed', content },
        appliedChanges: [],
        isStreaming: false,
        isInterrupted: false,
    }
}

function props(overrides: Partial<AppAssistantViewProps> = {}): AppAssistantViewProps {
    return {
        signedIn: true,
        onLogin: vi.fn(),
        status: 'idle',
        historyReady: true,
        conversations: [{ conversation_id: 3, kind: 'app', title: 'Lore check', updated_at: '2026-10-10T09:00:00Z' }],
        activeConversation: null,
        targetNames: new Map(),
        turns: [],
        notice: null,
        suggestions: APP_ASSISTANT_SUGGESTIONS,
        knowledgeSummary: '12 cards · 3 lorebooks',
        knowledge: {
            sources: ['guide', 'library', 'lorebooks'],
            sections: [
                { key: 'guide', count: 11, markdown: 'x', tokens: 900, truncated: false },
                { key: 'library', count: 12, markdown: 'x', tokens: 600, truncated: false },
                { key: 'lorebooks', count: 3, markdown: 'x', tokens: 200, truncated: false },
            ],
            enabled: new Set(['guide', 'library']),
            onToggle: vi.fn(),
            focus: [{ kind: 'lorebook', id: 'l1', name: 'Saltmarsh lore' }],
            focusLimit: 6,
            onAddFocus: vi.fn(),
            onRemoveFocus: vi.fn(),
            tokens: 1500,
            truncated: false,
        },
        onSend: vi.fn(),
        onStop: vi.fn(),
        onRetry: vi.fn(),
        onReload: vi.fn(),
        onDismissNotice: vi.fn(),
        onNewConversation: vi.fn(),
        onSelectConversation: vi.fn(),
        onDeleteConversation: vi.fn(),
        onContinueInEditor: vi.fn(),
        onNavigateLink: vi.fn(),
        ...overrides,
    }
}

describe('AppAssistantView', () => {
    it('invites a signed-out reader to log in', () => {
        const view = props({ signedIn: false })
        render(<AppAssistantView {...view} />)
        expect(screen.getByRole('heading', { name: 'Your guide to Magic Worlds' })).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Log in to chat' }))
        expect(view.onLogin).toHaveBeenCalled()
        expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    })

    it('greets with what it can read and sends a starter question in the reader’s language', () => {
        const view = props()
        render(<AppAssistantView {...view} />)
        expect(screen.getByTestId('assistant-knowledge-summary')).toHaveTextContent('12 cards · 3 lorebooks')
        fireEvent.click(screen.getByRole('button', { name: /Summarize my library/ }))
        expect(view.onSend).toHaveBeenCalledWith(expect.stringMatching(/^Summarize my library: /))
    })

    it('keeps the history readable but sends nothing while the workspace is archived', () => {
        const view = props({
            readOnly: true,
            activeConversation: { conversation_id: 3, kind: 'app', title: 'Lore check' },
            turns: [turn(1, 'user', 'Where is my lore?'), turn(2, 'assistant', 'In Saltmarsh lore.')],
        })
        render(<AppAssistantView {...view} />)
        expect(screen.getByText('In Saltmarsh lore.')).toBeInTheDocument()
        fireEvent.change(screen.getByRole('textbox'), { target: { value: 'And the keeper?' } })
        expect(screen.getByRole('button', { name: /send message/i })).toBeDisabled()
        fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' })
        expect(view.onSend).not.toHaveBeenCalled()
        expect(screen.getAllByRole('button', { name: /Lore check/ }).length).toBeGreaterThan(0)
        expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument()
    })

    it('routes in-app links from replies through the page instead of the browser', () => {
        const view = props({
            activeConversation: { conversation_id: 3, kind: 'app', title: 'Lore check' },
            turns: [turn(1, 'user', 'Where is my lore?'), turn(2, 'assistant', 'Open [Saltmarsh lore](#/lorebook?lorebook=l1) or [the web](https://example.com).')],
        })
        render(<AppAssistantView {...view} />)
        const internal = screen.getByRole('link', { name: 'Saltmarsh lore' })
        expect(fireEvent.click(internal)).toBe(false)
        expect(view.onNavigateLink).toHaveBeenCalledWith('#/lorebook?lorebook=l1')

        fireEvent.click(screen.getByRole('link', { name: 'the web' }))
        expect(view.onNavigateLink).toHaveBeenCalledTimes(1)
    })

    it('leaves links meant for a new tab to the browser', () => {
        const view = props({
            activeConversation: { conversation_id: 3, kind: 'app', title: 'Lore check' },
            turns: [turn(1, 'user', 'What next?'), turn(2, 'assistant', 'Start from [Create world](#/world) or browse [Items](#/gallery/items).')],
        })
        render(
            <AssistantLinkContext.Provider value={AssistantReplyLink}>
                <AppAssistantView {...view} />
            </AssistantLinkContext.Provider>,
        )
        const create = screen.getByRole('link', { name: 'Create world' })
        expect(create).toHaveAttribute('target', '_blank')
        expect(create).toHaveAttribute('rel', 'noopener noreferrer')
        // jsdom cannot open tabs: stop the browser's own follow after the thread has had its say.
        create.addEventListener('click', (event) => event.preventDefault())
        fireEvent.click(create)
        expect(view.onNavigateLink).not.toHaveBeenCalled()
    })

    it('lists conversations and switches between them', () => {
        const view = props()
        render(<AppAssistantView {...view} />)
        const history = screen.getByRole('complementary', { name: 'Conversations' })
        fireEvent.click(within(history).getByRole('button', { name: /^Lore check/ }))
        expect(view.onSelectConversation).toHaveBeenCalledWith(3)
        fireEvent.click(within(history).getByRole('button', { name: 'New chat' }))
        expect(view.onNewConversation).toHaveBeenCalled()
    })

    it('tags every assistant’s conversation and filters the history by kind', () => {
        const view = props({
            conversations: [
                { conversation_id: 3, kind: 'app', title: 'Lore check', updated_at: '2026-10-10T09:00:00Z' },
                { conversation_id: 7, kind: 'card', card_type: 'character', card_id: 'c1', title: 'Untitled character', updated_at: '2026-10-09T09:00:00Z' },
                { conversation_id: 6, kind: 'lorebook', lorebook_id: 'l1', title: 'Saltmarsh lore', updated_at: '2026-10-08T09:00:00Z' },
            ],
            targetNames: new Map([['c1', 'Mira Vell']]),
        })
        render(<AppAssistantView {...view} />)
        const history = screen.getByRole('complementary', { name: 'Conversations' })
        const rows = () => within(history).getAllByRole('listitem').map((row) => row.textContent)
        // The live card name replaces the draft title the conversation started with.
        expect(rows()).toEqual([
            expect.stringMatching(/^Lore check.*Guide/),
            expect.stringMatching(/^Mira Vell.*Character/),
            expect.stringMatching(/^Saltmarsh lore.*Lorebook/),
        ])

        const filter = within(history).getByRole('combobox', { name: 'Show conversations from' })
        expect(filter).toHaveTextContent('All assistants')
        fireEvent.click(filter)
        expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual(['All assistants', 'Guide', 'Character', 'Lorebook'])
        fireEvent.click(screen.getByRole('option', { name: 'Character' }))
        expect(filter).toHaveTextContent('Character')
        expect(rows()).toEqual([expect.stringMatching(/^Mira Vell/)])
        fireEvent.click(filter)
        fireEvent.click(screen.getByRole('option', { name: 'All assistants' }))
        expect(rows()).toHaveLength(3)
    })

    it('hides the filters while the history holds a single assistant', () => {
        render(<AppAssistantView {...props()} />)
        const history = screen.getByRole('complementary', { name: 'Conversations' })
        expect(within(history).queryByRole('combobox')).not.toBeInTheDocument()
    })

    it('reads a card conversation and hands it to its editor instead of the composer', () => {
        const card = { conversation_id: 7, kind: 'card' as const, card_type: 'character' as const, card_id: 'c1', title: 'Untitled character' }
        const view = props({
            conversations: [card],
            activeConversation: card,
            targetNames: new Map([['c1', 'Mira Vell']]),
            turns: [turn(1, 'user', 'Make her an archivist.'), turn(2, 'assistant', 'Done.')],
        })
        render(<AppAssistantView {...view} />)
        const thread = screen.getByRole('region', { name: 'Assistant' })
        expect(within(thread).getByRole('banner')).toHaveTextContent('CharacterMira Vell')
        expect(within(thread).getByText('Make her an archivist.')).toBeInTheDocument()
        expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
        expect(within(thread).getByText('Character assistant')).toBeInTheDocument()
        expect(within(thread).getByText(/This conversation edits “Mira Vell”/)).toBeInTheDocument()

        fireEvent.click(within(thread).getByRole('button', { name: 'Continue in editor' }))
        expect(view.onContinueInEditor).toHaveBeenCalledWith(card)
    })

    it('continues a conversation that started on an unsaved draft in a new draft', () => {
        const draft = { conversation_id: 5, kind: 'lorebook' as const, lorebook_id: null, title: 'Untitled lorebook' }
        render(<AppAssistantView {...props({ conversations: [draft], activeConversation: draft, turns: [turn(1, 'user', 'Start a lorebook.')] })} />)
        expect(screen.getByText('Lorebook assistant')).toBeInTheDocument()
        expect(screen.getByText(/started on an unsaved draft/)).toBeInTheDocument()
        expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    })

    it('shows what reaches the model and lets the reader toggle sources and focus', () => {
        const view = props()
        render(<AppAssistantView {...view} />)
        const panel = screen.getByRole('complementary', { name: 'What the assistant knows' })
        expect(within(panel).getByText('≈1,500 tokens')).toBeInTheDocument()
        expect(within(panel).getByText('3 lorebooks')).toBeInTheDocument()

        const lorebooks = within(panel).getByRole('switch', { name: 'Include Lorebooks' })
        expect(lorebooks).toHaveAttribute('aria-checked', 'false')
        fireEvent.click(lorebooks)
        expect(view.knowledge.onToggle).toHaveBeenCalledWith('lorebooks', true)

        fireEvent.click(within(panel).getByRole('button', { name: 'Remove Saltmarsh lore from focus' }))
        expect(view.knowledge.onRemoveFocus).toHaveBeenCalledWith(expect.objectContaining({ kind: 'lorebook', id: 'l1' }))
    })

    it('explains a server without the assistant instead of inviting questions', () => {
        const onRecheck = vi.fn()
        const view = props({ unavailable: true, onRecheck, modelControl: null })
        render(<AppAssistantView {...view} />)
        expect(screen.getByRole('heading', { name: 'The assistant is not switched on here yet' })).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /Summarize my library/ })).not.toBeInTheDocument()
        expect(screen.queryByRole('alert')).not.toBeInTheDocument()

        const composer = screen.getByRole('textbox', { name: 'The assistant is not available on this server yet.' })
        fireEvent.change(composer, { target: { value: 'Hello?' } })
        fireEvent.keyDown(composer, { key: 'Enter' })
        expect(view.onSend).not.toHaveBeenCalled()

        fireEvent.click(screen.getByRole('button', { name: 'Check again' }))
        expect(onRecheck).toHaveBeenCalled()
    })

    it('surfaces a notice with retry above the composer', () => {
        const view = props({ notice: { kind: 'error', message: 'Model overloaded', canRetry: true } })
        render(<AppAssistantView {...view} />)
        expect(screen.getByRole('alert')).toHaveTextContent('Model overloaded')
        fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
        expect(view.onRetry).toHaveBeenCalled()
    })
})
