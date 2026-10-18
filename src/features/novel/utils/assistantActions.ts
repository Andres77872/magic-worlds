import type { TFunction } from 'i18next'
import type { StoryAssistantAction, StoryAssistantActionKind } from '@/shared/types/storyAssistant.types'

export const ASSISTANT_ACTION_KINDS: readonly StoryAssistantActionKind[] = ['transform', 'line_edit', 'dialogue', 'bridge', 'translate', 'brainstorm', 'outline', 'summary', 'copy']

/** The starting parameters when the author picks an action. */
export function defaultAssistantAction(kind: StoryAssistantActionKind): StoryAssistantAction {
    switch (kind) {
        case 'transform': return { kind, pov: 'first', tense: null }
        case 'line_edit': return { kind, focus: ['clarity', 'repetition'] }
        case 'dialogue': return { kind, speaker: '' }
        case 'translate': return { kind, language: '' }
        case 'brainstorm': return { kind, topic: 'conflict' }
        case 'outline': return { kind, target: 'beats' }
        case 'copy': return { kind, form: 'blurb' }
        default: return { kind }
    }
}

const key = (t: TFunction, path: string, values?: Record<string, unknown>) => t('novelEditor.assistantActions.' + path, values)

/** The instruction an action starts the composer with; the author can rewrite it. */
export function assistantActionMessage(t: TFunction, action: StoryAssistantAction): string {
    const word = (path: string) => key(t, 'words.' + path)
    switch (action.kind) {
        case 'transform': {
            const pov = action.pov && word('povs.' + action.pov), tense = action.tense && word('tenses.' + action.tense)
            return key(t, 'messages.' + (pov && tense ? 'transformBoth' : pov ? 'transformPov' : tense ? 'transformTense' : 'transformNone'), { pov, tense })
        }
        case 'line_edit': return key(t, 'messages.line_edit', { focus: action.focus.map((focus) => word('focuses.' + focus)).join(', ') })
        case 'dialogue': return key(t, 'messages.dialogue', { speaker: action.speaker.trim() || key(t, 'theSpeaker') })
        case 'translate': return key(t, 'messages.translate', { language: action.language.trim() || key(t, 'theLanguage') })
        case 'brainstorm': return key(t, 'messages.brainstorm', { topic: word('topics.' + action.topic) })
        case 'outline': return key(t, 'messages.outline', { target: word('targets.' + action.target) })
        case 'copy': return key(t, 'messages.copy.' + action.form)
        default: return key(t, 'messages.' + action.kind)
    }
}

/** A short label of the action and its parameters, for the prepared-turn review. */
export function assistantActionLabel(t: TFunction, action: StoryAssistantAction): string {
    const detail = action.kind === 'transform' ? [action.pov && key(t, 'povs.' + action.pov), action.tense && key(t, 'tenses.' + action.tense)].filter(Boolean).join(', ')
        : action.kind === 'line_edit' ? action.focus.map((focus) => key(t, 'focuses.' + focus)).join(', ')
            : action.kind === 'dialogue' ? action.speaker
                : action.kind === 'translate' ? action.language
                : action.kind === 'brainstorm' ? key(t, 'topics.' + action.topic)
                    : action.kind === 'outline' ? key(t, 'targets.' + action.target)
                        : action.kind === 'copy' ? key(t, 'forms.' + action.form) : ''
    return key(t, 'kinds.' + action.kind) + (detail ? ' · ' + detail : '')
}
