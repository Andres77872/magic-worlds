import type { AssistantAdapter } from '@/features/creation/common/components/assistant/assistantModel'

const TITLE_MAX = 80

/** A conversation title from the opening question: first line, clipped. */
export function titleFromQuestion(text: string): string {
    const line = text.split('\n').find((part) => part.trim())?.trim() ?? ''
    return line.length > TITLE_MAX ? `${line.slice(0, TITLE_MAX - 1).trimEnd()}…` : line
}

/**
 * The app-wide guide at `#/assistant`. It edits nothing, so it has no target:
 * each turn sends the question with the client-built knowledge, the reply
 * language, and the page the reader came from.
 */
export const appAssistantAdapter: AssistantAdapter<'app'> = {
    kind: 'app',
    lifecycle: 'page',
    scope: () => ({ kind: 'app' }),
    title: (_binding, firstMessage) => titleFromQuestion(firstMessage),
    turnBody: (binding, message) => ({
        kind: 'app',
        message,
        context: binding.context,
        locale: binding.locale,
        page: binding.page,
    }),
}
