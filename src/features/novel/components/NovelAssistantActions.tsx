/**
 * Named assistant actions beside the composer: a POV/tense transform, line edit, dialogue or bridge returns a
 * proposal for review (Suggest); brainstorming, outlines and summaries answer in prose (Ask). Choosing one sets
 * the matching task and, while the message is empty or still the previous action's wording, its instruction.
 */

import { useTranslation } from 'react-i18next'
import { ASSISTANT_ACTION_TASKS, LINE_EDIT_FOCUS, isAssistantAction } from '@/infrastructure/api/storyAssistantContextContract'
import type { StoryAssistantAction, StoryAssistantActionKind } from '@/shared/types/storyAssistant.types'
import { Badge, Chip, Field, Input, Select } from '@/ui/primitives'
import { withoutAction, type AssistantSourceSettings } from '../persistence/assistantDraftJournal'
import { ASSISTANT_ACTION_KINDS, assistantActionMessage, defaultAssistantAction } from '../utils/assistantActions'

interface Props {
    value: AssistantSourceSettings
    message: string
    disabled?: boolean
    onChange: (settings: AssistantSourceSettings, message: string) => void
}

export function NovelAssistantActions({ value, message, disabled, onChange }: Props) {
    const { t } = useTranslation(), text = (key: string) => t('novelEditor.assistantActions.' + key)
    const action = value.action
    const choose = (next: StoryAssistantAction | null) => {
        const settings = next ? { ...value, task: ASSISTANT_ACTION_TASKS[next.kind], action: next } : withoutAction(value)
        // The author's own words stay; an empty message or the previous action's wording follows the new choice.
        const previous = action ? assistantActionMessage(t, action) : ''
        onChange(settings, !message.trim() || message.trim() === previous ? next ? assistantActionMessage(t, next) : '' : message)
    }
    const needs = action && !isAssistantAction(action.kind === 'dialogue' ? { ...action, speaker: action.speaker.trim() } : action)
        ? text(action.kind === 'transform' ? 'transformNeeds' : action.kind === 'line_edit' ? 'focusNeeds' : 'speakerNeeds') : null
    return <section aria-label={text('label')} className="space-y-3 rounded-lg border border-line p-3">
        <Field label={text('label')} helper={action ? t('novelEditor.assistantActions.kindHelp.' + action.kind) : text('help')}>
            <Select value={action?.kind ?? ''} disabled={disabled} onChange={(kind) => choose(kind ? defaultAssistantAction(kind as StoryAssistantActionKind) : null)}
                options={[{ value: '', label: text('none') }, ...ASSISTANT_ACTION_KINDS.map((kind) => ({ value: kind, label: t('novelEditor.assistantActions.kinds.' + kind) }))]} />
        </Field>
        {action && <Badge tone={ASSISTANT_ACTION_TASKS[action.kind] === 'suggest' ? 'ember' : 'arcane'}>{text(ASSISTANT_ACTION_TASKS[action.kind] === 'suggest' ? 'proposal' : 'answer')}</Badge>}
        {action?.kind === 'transform' && <div className="grid gap-3 sm:grid-cols-2">
            <Field label={text('pov')}><Select value={action.pov ?? ''} disabled={disabled} onChange={(pov) => choose({ ...action, pov: (pov || null) as typeof action.pov })}
                options={[{ value: '', label: text('keep') }, ...(['first', 'second', 'third'] as const).map((pov) => ({ value: pov, label: t('novelEditor.assistantActions.povs.' + pov) }))]} /></Field>
            <Field label={text('tense')}><Select value={action.tense ?? ''} disabled={disabled} onChange={(tense) => choose({ ...action, tense: (tense || null) as typeof action.tense })}
                options={[{ value: '', label: text('keep') }, ...(['past', 'present'] as const).map((tense) => ({ value: tense, label: t('novelEditor.assistantActions.tenses.' + tense) }))]} /></Field>
        </div>}
        {action?.kind === 'line_edit' && <fieldset className="space-y-2"><legend className="text-label text-parchment-200">{text('focus')}</legend><div className="flex flex-wrap gap-2">
            {LINE_EDIT_FOCUS.map((focus) => <Chip key={focus} active={action.focus.includes(focus)} aria-pressed={action.focus.includes(focus)} disabled={disabled}
                onClick={() => choose({ ...action, focus: action.focus.includes(focus) ? action.focus.filter((item) => item !== focus) : LINE_EDIT_FOCUS.filter((item) => item === focus || action.focus.includes(item)) })}>
                {t('novelEditor.assistantActions.focuses.' + focus)}</Chip>)}
        </div></fieldset>}
        {action?.kind === 'dialogue' && <Field label={text('speaker')} helper={text('speakerHelp')}>
            <Input value={action.speaker} maxLength={120} disabled={disabled} onChange={(event) => choose({ ...action, speaker: event.target.value.trimStart() })} /></Field>}
        {action?.kind === 'brainstorm' && <Field label={text('topic')}><Select value={action.topic} disabled={disabled} onChange={(topic) => choose({ ...action, topic: topic as typeof action.topic })}
            options={(['premise', 'conflict', 'stakes', 'names', 'what_if'] as const).map((topic) => ({ value: topic, label: t('novelEditor.assistantActions.topics.' + topic) }))} /></Field>}
        {action?.kind === 'outline' && <Field label={text('target')}><Select value={action.target} disabled={disabled} onChange={(target) => choose({ ...action, target: target as typeof action.target })}
            options={(['synopsis', 'beats', 'chapter_plan'] as const).map((target) => ({ value: target, label: t('novelEditor.assistantActions.targets.' + target) }))} /></Field>}
        {needs && <p role="status" className="text-caption text-ember-300">{needs}</p>}
    </section>
}
