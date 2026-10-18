import { useTranslation } from 'react-i18next'
import type { StoryOutline } from '@/shared/types/storyStudio.types'
import { ASSISTANT_ACTION_TASKS } from '@/infrastructure/api/storyAssistantContextContract'
import { withoutAction, type AssistantSourceSettings } from '../persistence/assistantDraftJournal'
import { Chip, Field, Input, Select, SwitchRow } from '@/ui/primitives'

export function NovelAssistantSourceFields({ value, story, disabled, onChange }: {
    value: AssistantSourceSettings; story: StoryOutline; disabled?: boolean; onChange: (value: AssistantSourceSettings) => void
}) {
    const { t } = useTranslation(), text = (key: string) => t('novelEditor.assistantContext.' + key)
    const scenes = story.chapters.flatMap(chapter => chapter.scenes.map(scene => ({ value: scene.id, label: chapter.title + ' · ' + scene.title })))
    const patch = (change: Partial<AssistantSourceSettings>) => onChange({ ...value, ...change })
    return <fieldset disabled={disabled} className="space-y-4">
        <legend className="mb-3 text-label text-parchment-200">{text('scope')}</legend>
        <Field label={text('anchor')}><Select value={value.anchorSceneId} options={scenes} disabled={disabled} onChange={anchorSceneId => patch({ anchorSceneId, selection: null, scope: value.scope === 'selection' ? 'scene' : value.scope, sceneIds: value.scope === 'scenes' ? [anchorSceneId] : [] })} /></Field>
        <div className="grid gap-3 sm:grid-cols-2">
            <Field label={text('task')}><Select value={value.task} disabled={disabled} onChange={task => onChange(value.action && ASSISTANT_ACTION_TASKS[value.action.kind] !== task ? { ...withoutAction(value), task: task as AssistantSourceSettings['task'] } : { ...value, task: task as AssistantSourceSettings['task'] })} options={(['ask', 'suggest'] as const).map(task => ({ value: task, label: text(task) }))} /></Field>
            <Field label={text('scope')}><Select value={value.scope} disabled={disabled} onChange={scope => patch({ scope: scope as AssistantSourceSettings['scope'], sceneIds: scope === 'scenes' ? [value.anchorSceneId] : [] })} options={(['selection', 'scene', 'chapter', 'novel', 'scenes'] as const).map(scope => ({ value: scope, label: text(scope), disabled: scope === 'selection' && !value.selection }))} /></Field>
        </div>
        {value.scope === 'selection' && value.selection && <blockquote aria-label={text('selectionQuote')} className="whitespace-pre-wrap break-words font-narrative text-body text-parchment-200">{value.selection.quote}</blockquote>}
        {value.scope === 'scenes' && <section aria-label={text('selectedScenes')} className="space-y-2"><p className="text-label">{text('selectedScenes')}</p><div className="flex flex-wrap gap-2">{scenes.map(scene => <Chip key={scene.value} disabled={disabled || scene.value === value.anchorSceneId || value.sceneIds.length >= 20 && !value.sceneIds.includes(scene.value)} active={scene.value === value.anchorSceneId || value.sceneIds.includes(scene.value)} onClick={() => patch({ sceneIds: value.sceneIds.includes(scene.value) ? value.sceneIds.filter(id => id !== scene.value) : [...value.sceneIds, scene.value] })}>{scene.label}</Chip>)}</div></section>}
        <Field label={text('policy')} helper={text('policyHelp')}><Select value={value.revealPolicy} disabled={disabled} onChange={revealPolicy => patch({ revealPolicy: revealPolicy as AssistantSourceSettings['revealPolicy'] })} options={(['through_anchor', 'author_analysis'] as const).map(policy => ({ value: policy, label: text(policy) }))} /></Field>
        <SwitchRow label={text('includeArchived')} description={text('includeArchivedHelp')} disabled={disabled} checked={value.includeArchived} onChange={includeArchived => patch({ includeArchived })} />
        <SwitchRow label={text('includeCodex')} description={text('includeCodexHelp')} disabled={disabled} checked={value.includeCodex} onChange={includeCodex => patch({ includeCodex })} />
        <fieldset className="space-y-3"><legend className="text-label text-parchment-200">{text('limits')}</legend><div className="grid grid-cols-2 gap-3">
            {(['contextWindow', 'outputTokens', 'maxSources', 'maxPassages'] as const).map(key => <Field key={key} label={text(key)}><Input inputMode="numeric" pattern="[0-9]*" maxLength={7} value={value.limits[key]} onChange={event => { const next = event.target.value; if (/^\d{0,7}$/.test(next)) patch({ limits: { ...value.limits, [key]: next } }) }} /></Field>)}
        </div><p className="text-caption text-parchment-300">{text('limitsHelp')}</p></fieldset>
    </fieldset>
}
