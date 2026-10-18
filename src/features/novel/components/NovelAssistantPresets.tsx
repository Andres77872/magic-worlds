/**
 * The author's own prompt presets (A19): an instruction with named inputs, the task and action it is written for, and
 * optional source and model defaults. Using one fills the message and those choices; the author still prepares,
 * reviews and sends the request, and the reply keeps which preset version asked for it.
 */

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ApiError } from '@/infrastructure/api'
import { PRESET_LIMITS, presetLength, presetValueValid, renderPreset } from '@/infrastructure/api/storyAssistantPresetContract'
import type { LlmSelection } from '@/shared/types/llm.types'
import type { StoryAssistantPreset, StoryAssistantPresetDefinition, StoryAssistantPresetList } from '@/shared/types/storyAssistant.types'
import { Badge, Button, Callout, Field, Input, Select, SwitchRow, Textarea } from '@/ui/primitives'
import { generateUUID } from '@/utils/uuid'
import type { AssistantSourceSettings } from '../persistence/assistantDraftJournal'
import { formDefinition, formIssues, initialPresetValues, newPresetForm, nextInputKey, presetToForm, type PresetForm, type PresetInputForm } from '../utils/presetForm'
import { NovelAssistantActions } from './NovelAssistantActions'

export interface AssistantPresetsApi {
    list: (signal: AbortSignal) => Promise<StoryAssistantPresetList>
    create: (presetId: string, name: string, definition: StoryAssistantPresetDefinition) => Promise<StoryAssistantPreset>
    update: (presetId: string, name: string, definition: StoryAssistantPresetDefinition, expectedRevision: number) => Promise<StoryAssistantPreset>
    setTrashed: (presetId: string, trashed: boolean, expectedRevision: number) => Promise<StoryAssistantPreset>
    remove: (presetId: string, expectedRevision: number) => Promise<void>
}
export type PresetUse = 'applied' | 'confirm' | 'blocked'
type Load = { state: 'idle' | 'loading' | 'failed' } | { state: 'ready'; list: StoryAssistantPresetList }
type Mode = { kind: 'list' } | { kind: 'edit'; preset: StoryAssistantPreset | null; presetId: string; form: PresetForm; tried: boolean }
    | { kind: 'fill'; preset: StoryAssistantPreset; values: Record<string, string>; confirm: boolean }
type Status = null | 'created' | 'saved' | 'trashed' | 'restored' | 'deleted' | 'changed' | 'limit' | 'invalid' | 'failed'
const SCOPES = ['selection', 'scene', 'chapter', 'novel'] as const

export function NovelAssistantPresets({ api, disabled = false, useDisabled = false, settings, selection, activePresetId = null, onUse }: {
    api?: AssistantPresetsApi
    /** Read-only drawer: presets can be read but not used or changed. */
    disabled?: boolean
    /** The drawer cannot take a new message now (a request in flight, a refinement, the assistant unavailable). */
    useDisabled?: boolean
    settings: AssistantSourceSettings; selection: LlmSelection
    /** The preset whose unchanged message is in the composer now. */
    activePresetId?: string | null
    onUse: (preset: StoryAssistantPreset, values: Record<string, string>, replace: boolean) => PresetUse
}) {
    const { t } = useTranslation(), text = (key: string, options?: Record<string, unknown>) => t('novelEditor.assistantPresets.' + key, options)
    const [open, setOpen] = useState(false), [load, setLoad] = useState<Load>({ state: 'idle' })
    const [mode, setMode] = useState<Mode>({ kind: 'list' }), [status, setStatus] = useState<Status>(null)
    const [working, setWorking] = useState(false), [deleting, setDeleting] = useState<string | null>(null)
    useEffect(() => {
        if (!open || !api || load.state !== 'loading') return
        const controller = new AbortController()
        api.list(controller.signal).then((list) => { if (!controller.signal.aborted) setLoad({ state: 'ready', list }) })
            .catch(() => { if (!controller.signal.aborted) setLoad({ state: 'failed' }) })
        return () => controller.abort()
    }, [open, api, load.state])
    const list = load.state === 'ready' ? load.list : null
    const inUse = list?.presets.filter((preset) => !preset.trashedAt) ?? [], trashed = list?.presets.filter((preset) => preset.trashedAt) ?? []
    const replace = (preset: StoryAssistantPreset) => setLoad((current) => current.state === 'ready'
        ? { state: 'ready', list: { ...current.list, presets: [preset, ...current.list.presets.filter((item) => item.id !== preset.id)] } } : current)
    async function write(action: () => Promise<StoryAssistantPreset | void>, done: Status, after?: () => void) {
        setWorking(true); setStatus(null)
        try {
            const result = await action()
            if (result) replace(result)
            after?.(); setStatus(done)
        } catch (error) {
            // Another tab saved first, or the limit was reached: show what is saved now and keep the author's form.
            const code = error instanceof ApiError ? error.code : null
            if (code === 'STORY_ASSISTANT_PRESET_CHANGED' || code === 'STORY_ASSISTANT_PRESET_NOT_FOUND') { setStatus('changed'); setLoad({ state: 'loading' }) }
            else setStatus(code === 'STORY_ASSISTANT_PRESET_LIMIT' ? 'limit' : error instanceof ApiError && error.status === 422 ? 'invalid' : 'failed')
        } finally { setWorking(false) }
    }
    const taskBadge = (definition: StoryAssistantPresetDefinition) => <>
        <Badge tone={definition.task === 'suggest' ? 'ember' : 'arcane'}>{t('novelEditor.assistantContext.' + definition.task)}</Badge>
        {definition.action && <Badge tone="neutral">{t('novelEditor.assistantActions.kinds.' + definition.action.kind)}</Badge>}
    </>

    function editor(value: Extract<Mode, { kind: 'edit' }>) {
        const form = value.form, saved = value.preset?.definition.profile?.mode === 'profile' ? value.preset.definition.profile : null
        const definition = formDefinition(form, { current: selection, saved }), issues = formIssues(form, definition)
        const patch = (change: Partial<PresetForm>) => setMode({ ...value, form: { ...form, ...change } })
        const patchInput = (index: number, change: Partial<PresetInputForm>) => patch({ inputs: form.inputs.map((input, n) => n === index ? { ...input, ...change } : input) })
        const save = () => {
            if (issues.length) { setMode({ ...value, tried: true }); return }
            const name = form.name.trim()
            void write(() => value.preset ? api!.update(value.preset.id, name, definition, value.preset.revision) : api!.create(value.presetId, name, definition),
                value.preset ? 'saved' : 'created', () => setMode({ kind: 'list' }))
        }
        const profiles = [{ value: 'keep', label: text('profileKeep') }, { value: 'inherit', label: text('profileInherit') },
            ...(selection.mode === 'profile' ? [{ value: 'current', label: text('profileCurrent') }] : []), ...(saved ? [{ value: 'saved', label: text('profileSaved') }] : [])]
        return <section aria-label={text(value.preset ? 'editLabel' : 'newLabel')} className="space-y-3 rounded-lg border border-line p-3">
            <Field label={text('name')}><Input value={form.name} maxLength={PRESET_LIMITS.name} disabled={working} onChange={(event) => patch({ name: event.target.value })} /></Field>
            <Field label={text('instruction')} helper={text('instructionHelp', { count: presetLength(form.instruction), max: PRESET_LIMITS.instruction, example: '{{detail}}' })}>
                <Textarea rows={4} value={form.instruction} disabled={working} onChange={(event) => patch({ instruction: event.target.value })} /></Field>
            <fieldset className="space-y-3">
                <legend className="mb-1 text-label text-parchment-200">{text('inputs')}</legend>
                <p className="text-caption text-parchment-300">{text('inputsHelp', { example: '{{detail}}' })}</p>
                {form.inputs.map((input, index) => <div key={index} role="group" aria-label={text('inputLabel', { key: input.key || index + 1 })} className="space-y-3 rounded-md border border-parchment-50/10 bg-ink-800/60 p-3">
                    <div className="grid gap-3 sm:grid-cols-3">
                        <Field label={text('key')} helper={text('keyHelp')}><Input value={input.key} maxLength={32} disabled={working} onChange={(event) => patchInput(index, { key: event.target.value })} /></Field>
                        <Field label={text('label')}><Input value={input.label} maxLength={PRESET_LIMITS.label} disabled={working} onChange={(event) => patchInput(index, { label: event.target.value })} /></Field>
                        <Field label={text('kind')}><Select value={input.kind} disabled={working} onChange={(kind) => patchInput(index, { kind: kind as PresetInputForm['kind'] })}
                            options={[{ value: 'text', label: text('kinds.text') }, { value: 'choice', label: text('kinds.choice') }]} /></Field>
                    </div>
                    {input.kind === 'text'
                        ? <Field label={text('maxLength')} helper={text('maxLengthHelp', { max: PRESET_LIMITS.textInput })}><Input inputMode="numeric" value={input.maxLength} disabled={working}
                            onChange={(event) => patchInput(index, { maxLength: event.target.value.replace(/\D/g, '').slice(0, 3) })} /></Field>
                        : <Field label={text('options')} helper={text('optionsHelp', { max: PRESET_LIMITS.options })}><Textarea rows={3} value={input.options} disabled={working}
                            onChange={(event) => patchInput(index, { options: event.target.value })} /></Field>}
                    <SwitchRow label={text('required')} checked={input.required} disabled={working} onChange={(required) => patchInput(index, { required })} />
                    <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="secondary" disabled={working || !input.key} onClick={() => patch({ instruction: form.instruction + (form.instruction && !/\s$/.test(form.instruction) ? ' ' : '') + '{{' + input.key + '}}' })}>
                            {text('insert', { token: '{{' + input.key + '}}' })}</Button>
                        <Button size="sm" variant="ghost" disabled={working} onClick={() => patch({ inputs: form.inputs.filter((_, n) => n !== index) })}>{text('removeInput')}</Button>
                    </div>
                </div>)}
                <Button size="sm" variant="secondary" disabled={working || form.inputs.length >= PRESET_LIMITS.inputs}
                    onClick={() => patch({ inputs: [...form.inputs, { key: nextInputKey(form.inputs), label: '', kind: 'text', required: true, maxLength: '200', options: '' }] })}>{text('addInput')}</Button>
            </fieldset>
            <NovelAssistantActions value={form.settings} message={form.instruction} disabled={working} onChange={(next, instruction) => patch({ settings: next, instruction })} />
            {!form.settings.action && <Field label={t('novelEditor.assistantContext.task')}><Select value={form.settings.task} disabled={working}
                onChange={(task) => patch({ settings: { ...form.settings, task: task as PresetForm['settings']['task'] } })}
                options={(['ask', 'suggest'] as const).map((task) => ({ value: task, label: t('novelEditor.assistantContext.' + task) }))} /></Field>}
            <div className="grid gap-3 sm:grid-cols-2">
                <Field label={text('scope')}><Select value={form.scope} disabled={working} onChange={(scope) => patch({ scope: scope as PresetForm['scope'] })}
                    options={[{ value: '', label: text('keepChoice') }, ...SCOPES.map((scope) => ({ value: scope, label: t('novelEditor.assistantContext.' + scope) }))]} /></Field>
                <Field label={text('policy')}><Select value={form.revealPolicy} disabled={working} onChange={(revealPolicy) => patch({ revealPolicy: revealPolicy as PresetForm['revealPolicy'] })}
                    options={[{ value: '', label: text('keepChoice') }, ...(['through_anchor', 'author_analysis'] as const).map((policy) => ({ value: policy, label: t('novelEditor.assistantContext.' + policy) }))]} /></Field>
            </div>
            <Field label={text('profile')} helper={text('profileHelp')}><Select value={form.profile} disabled={working} onChange={(profile) => patch({ profile: profile as PresetForm['profile'] })} options={profiles} /></Field>
            {value.tried && issues.length > 0 && <Callout tone="warning" role="alert"><ul className="list-disc space-y-1 pl-4">{issues.map((issue) => <li key={issue}>{text('issues.' + issue, { max: PRESET_LIMITS.inputs, example: '{{detail}}' })}</li>)}</ul></Callout>}
            {value.preset && <p className="text-caption text-parchment-400">{text('nextVersion', { version: value.preset.revision + 1 })}</p>}
            <div className="flex flex-wrap gap-2">
                <Button size="sm" disabled={working} onClick={save}>{text(working ? 'saving' : 'save')}</Button>
                <Button size="sm" variant="ghost" disabled={working} onClick={() => setMode({ kind: 'list' })}>{t('common.cancel')}</Button>
            </div>
        </section>
    }

    function filler(value: Extract<Mode, { kind: 'fill' }>) {
        const definition = value.preset.definition, message = renderPreset(definition, value.values)
        const use = (replaceMessage: boolean) => {
            const result = onUse(value.preset, value.values, replaceMessage)
            if (result === 'confirm') setMode({ ...value, confirm: true })
            else if (result === 'applied') setMode({ kind: 'list' })
        }
        return <section aria-label={text('fillLabel', { name: value.preset.name })} className="space-y-3 rounded-lg border border-line p-3">
            <div className="flex flex-wrap items-center gap-2"><h4 className="font-display text-body font-semibold text-parchment-50">{value.preset.name}</h4>{taskBadge(definition)}</div>
            {definition.inputs.map((input) => {
                const current = value.values[input.key] ?? '', set = (next: string) => setMode({ ...value, confirm: false, values: { ...value.values, [input.key]: next } })
                const error = current && !presetValueValid(input, current) ? text('valueInvalid') : undefined
                return input.kind === 'text'
                    ? <Field key={input.key} label={input.label + (input.required ? '' : ' · ' + text('optional'))} error={error} helper={text('valueHelp', { count: presetLength(current), max: input.maxLength })}>
                        <Input value={current} maxLength={input.maxLength} disabled={useDisabled} onChange={(event) => set(event.target.value)} /></Field>
                    : <Field key={input.key} label={input.label + (input.required ? '' : ' · ' + text('optional'))}>
                        <Select value={current} disabled={useDisabled} onChange={set} options={[...(input.required ? [] : [{ value: '', label: text('noOption') }]), ...input.options.map((option) => ({ value: option, label: option }))]} /></Field>
            })}
            <div><p className="mb-1 text-label text-parchment-200">{text('filled')}</p>
                {message ? <blockquote className="whitespace-pre-wrap break-words rounded-md border border-parchment-50/10 bg-ink-800/60 p-3 text-body text-parchment-100">{message}</blockquote>
                    : <p className="text-caption text-parchment-400">{text('fillRequired')}</p>}</div>
            {value.confirm && <Callout tone="warning" role="alert">{text('replaceHelp')}</Callout>}
            <div className="flex flex-wrap gap-2">
                <Button size="sm" disabled={useDisabled || !message} onClick={() => use(value.confirm)}>{text(value.confirm ? 'replace' : 'use')}</Button>
                <Button size="sm" variant="ghost" onClick={() => setMode({ kind: 'list' })}>{t('common.cancel')}</Button>
            </div>
        </section>
    }

    const row = (preset: StoryAssistantPreset) => <li key={preset.id} className="flex min-w-0 flex-col gap-2 rounded-md border border-parchment-50/10 bg-ink-800/60 p-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h4 className="min-w-0 truncate font-display text-body font-semibold text-parchment-50">{preset.name}</h4>{taskBadge(preset.definition)}
            <span className="text-caption text-parchment-400">{text('version', { version: preset.revision })}</span>
            {activePresetId === preset.id && <Badge tone="live">{text('inMessage')}</Badge>}
        </div>
        <p className="line-clamp-2 whitespace-pre-wrap break-words text-caption text-parchment-300">{preset.definition.instruction}</p>
        {!disabled && <div className="flex flex-wrap gap-2">
            <Button size="sm" aria-label={text('useFor', { name: preset.name })} disabled={useDisabled || working}
                onClick={() => { setStatus(null); setMode({ kind: 'fill', preset, values: initialPresetValues(preset.definition), confirm: false }) }}>{text('useEllipsis')}</Button>
            <Button size="sm" variant="secondary" aria-label={text('editFor', { name: preset.name })} disabled={working}
                onClick={() => { setStatus(null); setMode({ kind: 'edit', preset, presetId: preset.id, form: presetToForm(preset, settings), tried: false }) }}>{text('edit')}</Button>
            <Button size="sm" variant="ghost" aria-label={text('trashFor', { name: preset.name })} disabled={working}
                onClick={() => void write(() => api!.setTrashed(preset.id, true, preset.revision), 'trashed')}>{text('trash')}</Button>
        </div>}
    </li>

    return <details onToggle={(event) => { const isOpen = event.currentTarget.open; setOpen(isOpen); if (isOpen && load.state !== 'ready') setLoad({ state: 'loading' }) }}>
        <summary className="mb-3 cursor-pointer text-label">{text('title')}{list && ' · ' + inUse.length}</summary>
        <div className="space-y-3">
            <p className="text-caption text-parchment-300">{text('help')}</p>
            {!api && <Callout tone="warning">{text('unavailable')}</Callout>}
            {load.state === 'loading' && <p role="status" className="text-caption text-parchment-300">{text('loading')}</p>}
            {load.state === 'failed' && <Callout tone="warning" role="alert"><p>{text('loadFailed')}</p>
                <Button size="sm" variant="secondary" className="mt-2" onClick={() => setLoad({ state: 'loading' })}>{text('retry')}</Button></Callout>}
            {status && <Callout tone={['changed', 'limit', 'invalid', 'failed'].includes(status) ? 'warning' : 'info'} role={['changed', 'limit', 'invalid', 'failed'].includes(status) ? 'alert' : 'status'}>
                {text('status.' + status, { max: PRESET_LIMITS.presets })}</Callout>}
            {list && mode.kind === 'edit' && editor(mode)}
            {list && mode.kind === 'fill' && filler(mode)}
            {list && mode.kind === 'list' && <>
                {inUse.length ? <ul className="flex flex-col gap-2" aria-label={text('listLabel')}>{inUse.map(row)}</ul> : <p className="text-caption text-parchment-400">{text(trashed.length ? 'emptyInUse' : 'empty')}</p>}
                {!disabled && <Button size="sm" variant="secondary" disabled={working || inUse.length >= list.limit}
                    onClick={() => { setStatus(null); setMode({ kind: 'edit', preset: null, presetId: generateUUID(), form: newPresetForm(settings), tried: false }) }}>{text('new')}</Button>}
                {inUse.length >= list.limit && <p className="text-caption text-parchment-400">{text('status.limit', { max: list.limit })}</p>}
                {trashed.length > 0 && <details><summary className="mb-2 cursor-pointer text-label">{text('trashTitle', { count: trashed.length })}</summary>
                    <ul className="flex flex-col gap-2" aria-label={text('trashTitle', { count: trashed.length })}>{trashed.map((preset) => <li key={preset.id} className="flex min-w-0 flex-wrap items-center gap-2 rounded-md border border-parchment-50/10 p-3">
                        <span className="min-w-0 flex-1 truncate text-body text-parchment-200">{preset.name}</span>
                        {!disabled && <>
                            <Button size="sm" variant="secondary" aria-label={text('restoreFor', { name: preset.name })} disabled={working}
                                onClick={() => void write(() => api!.setTrashed(preset.id, false, preset.revision), 'restored')}>{text('restore')}</Button>
                            <Button size="sm" variant="danger-ghost" aria-label={text(deleting === preset.id ? 'deleteConfirmFor' : 'deleteFor', { name: preset.name })} disabled={working}
                                onClick={() => {
                                    if (deleting !== preset.id) { setDeleting(preset.id); return }
                                    setDeleting(null)
                                    void write(() => api!.remove(preset.id, preset.revision), 'deleted', () => setLoad((current) => current.state === 'ready'
                                        ? { state: 'ready', list: { ...current.list, presets: current.list.presets.filter((item) => item.id !== preset.id) } } : current))
                                }}>{text(deleting === preset.id ? 'deleteConfirm' : 'delete')}</Button>
                        </>}
                    </li>)}</ul>
                    <p className="mt-2 text-caption text-parchment-400">{text('trashHelp')}</p>
                </details>}
            </>}
        </div>
    </details>
}
