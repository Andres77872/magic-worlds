import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import {
    Bot,
    CornerDownLeft,
    History,
    Loader2,
    Lock,
    Play,
    Plus,
    RefreshCw,
    Rocket,
    Save,
    Trash2,
} from 'lucide-react'
import { useAuth } from '@/app/hooks'
import { makeRequestId } from '@/utils/uuid'
import { apiService, ApiError } from '@/infrastructure/api'
import type { LlmRequest } from '@/shared/types/llm.types'
import type {
    AgentDetail,
    AgentOutputMode,
    AgentSummary,
    AgentTestResponse,
    AgentVersion,
} from '@/shared'
import {
    Badge,
    Button,
    Card,
    Drawer,
    Field,
    Icon,
    IconButton,
    IconTile,
    Input,
    PageHeader,
    SectionHeader,
    Select,
    type SelectOption,
    Textarea,
    Toast,
    controlClass,
    cx,
} from '@/ui/primitives'
import { ConfirmDialog } from '@/ui/components/ConfirmDialog'
import { EmptyState } from '@/ui/components/common/EmptyState'
import { LlmFeatureControl } from '@/features/llmProfiles/LlmFeatureControl'
import { llmRecoveryMessage } from '@/features/llmProfiles/llmRecovery'
import {
    INPUT_TOKEN,
    type AgentForm,
    copyFormFromDetail,
    deriveJsonOutput,
    formFromDetail,
    slugifyWorkflowKey,
    toCreateRequest,
    toUpdateRequest,
    validateAgentForm,
} from '../agentValidation'

const NEW_KEY = '__new__'

const OUTPUT_MODE_LABEL: Record<AgentOutputMode, string> = {
    strict_card_schema: 'Strict card schema',
    json_object: 'JSON object',
    markdown: 'Markdown',
}

type ToastState = { tone: 'success' | 'error'; title: string; message?: string } | null

export function AdminAgentsPage() {
    const { user } = useAuth()
    return <AgentStudioPage key={user?.user_hash ?? 'signed-out'} />
}

function AgentStudioPage() {
    const { t } = useTranslation()
    const { isAuthenticated, user, openLoginModal } = useAuth()
    const isRoot = isAuthenticated && user?.user_type === 'root'

    const [agents, setAgents] = useState<AgentSummary[]>([])
    const [selectedKey, setSelectedKey] = useState<string | null>(null)
    const [detail, setDetail] = useState<AgentDetail | null>(null)
    const [form, setForm] = useState<AgentForm | null>(null)
    const [baseline, setBaseline] = useState<AgentForm | null>(null)
    const [loadingList, setLoadingList] = useState(false)
    const [loadingDetail, setLoadingDetail] = useState(false)
    const [saving, setSaving] = useState(false)
    const [publishing, setPublishing] = useState(false)
    const [deleting, setDeleting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [toast, setToast] = useState<ToastState>(null)
    const [versions, setVersions] = useState<AgentVersion[]>([])
    const [versionsOpen, setVersionsOpen] = useState(false)
    const [pendingDelete, setPendingDelete] = useState<AgentSummary | null>(null)
    const [pendingRollback, setPendingRollback] = useState<AgentVersion | null>(null)
    const [rollingBack, setRollingBack] = useState(false)

    const isNew = selectedKey === NEW_KEY
    const isImmutable = !isNew && detail?.kind !== 'custom'
    const errors = useMemo(
        () => (form ? validateAgentForm(form, { isNew, schemaModel: detail?.schema_model ?? null }, t) : {}),
        [form, isNew, detail?.schema_model, t],
    )
    const hasErrors = Object.keys(errors).length > 0
    const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(baseline), [form, baseline])

    const refreshAgents = useCallback(async () => {
        if (!isRoot) return
        setLoadingList(true)
        try {
            setAgents(await apiService.listAgents())
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not load agents.')
        } finally {
            setLoadingList(false)
        }
    }, [isRoot])

    useEffect(() => {
        if (!isRoot) return
        void refreshAgents()
    }, [isRoot, refreshAgents])

    const applyDetail = useCallback((next: AgentDetail) => {
        const nextForm = formFromDetail(next)
        setDetail(next)
        setForm(nextForm)
        setBaseline(nextForm)
        setSelectedKey(next.workflow_key)
    }, [])

    const selectAgent = useCallback(
        async (workflowKey: string) => {
            setError(null)
            setLoadingDetail(true)
            try {
                applyDetail(await apiService.getAgent(workflowKey))
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Could not load that agent.')
            } finally {
                setLoadingDetail(false)
            }
        },
        [applyDetail],
    )

    const startCopy = useCallback(
        async (sourceKey?: string) => {
            const key = sourceKey ?? detail?.workflow_key ?? agents[0]?.workflow_key
            if (!key) {
                setError('Load an agent before creating a custom copy.')
                return
            }
            setError(null)
            setLoadingDetail(true)
            try {
                const source = detail?.workflow_key === key ? detail : await apiService.getAgent(key)
                const fresh = copyFormFromDetail(source)
                setDetail(source)
                setSelectedKey(NEW_KEY)
                setForm(fresh)
                setBaseline(fresh)
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Could not load the source agent.')
            } finally {
                setLoadingDetail(false)
            }
        },
        [agents, detail],
    )

    const patchEditable = useCallback((changes: Partial<AgentForm['editable']>) => {
        setForm((current) => (current ? { ...current, editable: { ...current.editable, ...changes } } : current))
    }, [])

    const setOutputMode = useCallback((mode: AgentOutputMode) => {
        setForm((current) =>
            current
                ? { ...current, outputMode: mode, editable: { ...current.editable, json_output: deriveJsonOutput(mode) } }
                : current,
        )
    }, [])

    const save = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        if (!form || hasErrors || saving || (!isNew && detail?.kind !== 'custom')) return
        setSaving(true)
        setError(null)
        try {
            const next = isNew
                ? await apiService.createAgent(toCreateRequest(form))
                : await apiService.updateAgentDraft(detail!.workflow_key, toUpdateRequest(form, isImmutable), detail!.kind === 'custom' ? detail!.row_version : 0)
            applyDetail(next)
            await refreshAgents()
            setToast({ tone: 'success', title: isNew ? 'Agent created' : 'Draft saved', message: next.display_name })
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Could not save the agent.'
            setError(message)
            setToast({ tone: 'error', title: 'Save failed', message })
        } finally {
            setSaving(false)
        }
    }

    const publish = async () => {
        if (detail?.kind !== 'custom' || isNew || publishing) return
        setPublishing(true)
        setError(null)
        try {
            const next = await apiService.publishAgent(detail.workflow_key, detail.row_version)
            applyDetail(next)
            await refreshAgents()
            if (versionsOpen) await loadVersions(next.workflow_key)
            setToast({ tone: 'success', title: 'Published', message: `Version ${next.current_version_number}` })
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Could not publish.'
            setError(message)
            setToast({ tone: 'error', title: 'Publish failed', message })
        } finally {
            setPublishing(false)
        }
    }

    const loadVersions = useCallback(async (workflowKey: string) => {
        try {
            const res = await apiService.listAgentVersions(workflowKey)
            setVersions(res.versions)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not load versions.')
        }
    }, [])

    const openVersions = async () => {
        if (!detail || isNew) return
        setVersionsOpen(true)
        await loadVersions(detail.workflow_key)
    }

    const confirmRollback = async () => {
        const target = pendingRollback
        setPendingRollback(null)
        if (!target || detail?.kind !== 'custom') return
        setRollingBack(true)
        try {
            const next = await apiService.rollbackAgentVersion(detail.workflow_key, target.version_id, detail.row_version)
            applyDetail(next)
            await refreshAgents()
            await loadVersions(next.workflow_key)
            setToast({ tone: 'success', title: 'Rolled back', message: `Version ${target.version_number}` })
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Could not roll back.'
            setError(message)
            setToast({ tone: 'error', title: 'Rollback failed', message })
        } finally {
            setRollingBack(false)
        }
    }

    const confirmDelete = async () => {
        const target = pendingDelete
        setPendingDelete(null)
        if (target?.kind !== 'custom') return
        setDeleting(true)
        try {
            await apiService.deleteAgent(target.workflow_key, target.row_version)
            setAgents((current) => current.filter((agent) => agent.workflow_key !== target.workflow_key))
            if (selectedKey === target.workflow_key) {
                setSelectedKey(null)
                setDetail(null)
                setForm(null)
                setBaseline(null)
            }
            setToast({ tone: 'success', title: 'Agent deleted', message: target.display_name })
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Could not delete the agent.'
            setError(message)
            setToast({ tone: 'error', title: 'Delete failed', message })
        } finally {
            setDeleting(false)
        }
    }

    if (!isAuthenticated) {
        return (
            <RootAccessState
                secondaryText="Log in with a root account to manage generation agents."
                action={{ label: 'Log in', onClick: openLoginModal }}
            />
        )
    }
    if (!isRoot) {
        return <RootAccessState secondaryText="Agent Studio configures generation workflows and is limited to root users." />
    }

    return (
        <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-6 px-5 py-8 sm:px-8 sm:py-10">
            <PageHeader
                eyebrow="Root console"
                eyebrowTone="arcane"
                icon={<IconTile icon={Bot} tone="arcane" />}
                title="Agent Studio"
                subtitle="Version prompts and workflows for AI generation. Execution settings come from the selected profile."
                size="lg"
                actions={
                    <div className="flex gap-2">
                        <Button
                            variant="secondary"
                            size="sm"
                            iconLeft={<Icon icon={Plus} size={15} />}
                            onClick={() => void startCopy()}
                        >
                            Create custom copy
                        </Button>
                        <Button
                            variant="secondary"
                            size="sm"
                            iconLeft={<Icon icon={RefreshCw} size={15} className={loadingList ? 'animate-spin' : undefined} />}
                            onClick={() => void refreshAgents()}
                            disabled={loadingList}
                        >
                            Refresh
                        </Button>
                    </div>
                }
                divider
            />

            {error && (
                <div
                    className="flex items-center justify-between gap-4 rounded-lg border border-blood-500/30 bg-blood-500/10 px-4 py-3 font-ui text-sm text-parchment-200"
                    role="alert"
                >
                    <span>{error}</span>
                    <Button variant="secondary" size="sm" onClick={() => setError(null)}>
                        Dismiss
                    </Button>
                </div>
            )}

            {(!error || agents.length > 0) && <div className="grid gap-8 xl:grid-cols-[minmax(0,280px)_minmax(0,1fr)]">
                <AgentList
                    agents={agents}
                    loading={loadingList}
                    selectedKey={selectedKey}
                    onSelect={(key) => void selectAgent(key)}
                    onNew={() => void startCopy()}
                    onDelete={setPendingDelete}
                />

                {form ? (
                    <AgentEditor
                        form={form}
                        detail={detail}
                        errors={errors}
                        isNew={isNew}
                        isImmutable={isImmutable}
                        sourceOptions={agents.map((agent) => ({
                            value: agent.workflow_key,
                            label: agent.display_name,
                            description: agent.kind !== 'custom' ? 'Built-in file agent' : 'Custom database agent',
                        }))}
                        dirty={dirty}
                        loading={loadingDetail}
                        saving={saving}
                        publishing={publishing}
                        canSave={!hasErrors}
                        onSubmit={save}
                        onPatch={patchEditable}
                        onOutputMode={setOutputMode}
                        onDisplayName={(value) =>
                            setForm((c) => (c ? { ...c, displayName: value } : c))
                        }
                        onSlug={(value) => setForm((c) => (c ? { ...c, slug: value } : c))}
                        onSource={(value) => void startCopy(value)}
                        onCreateCopy={() => void startCopy(detail?.workflow_key)}
                        onPublish={() => void publish()}
                        onVersions={() => void openVersions()}
                        onDelete={() => detail && setPendingDelete(detail)}
                        setToast={setToast}
                        setError={setError}
                    />
                ) : (
                    <Card>
                        <div className="p-6">
                            <EmptyState
                                icon={<Icon icon={Bot} size={40} />}
                                message="Select an agent"
                                secondaryText="Pick a generation agent to inspect, or create a detached custom copy."
                                button={{ label: 'Create custom copy', onClick: () => void startCopy() }}
                            />
                        </div>
                    </Card>
                )}
            </div>}

            <VersionHistoryDrawer
                open={versionsOpen}
                versions={versions}
                onClose={() => setVersionsOpen(false)}
                onRollback={setPendingRollback}
            />

            <ConfirmDialog
                visible={pendingDelete !== null}
                title="Delete agent"
                message={pendingDelete ? `Delete “${pendingDelete.display_name}”? This removes all of its versions.` : ''}
                confirmLabel="Delete"
                variant="danger"
                isProcessing={deleting}
                onConfirm={() => void confirmDelete()}
                onCancel={() => setPendingDelete(null)}
            />
            <ConfirmDialog
                visible={pendingRollback !== null}
                title="Roll back agent"
                message={
                    pendingRollback
                        ? `Restore custom version ${pendingRollback.version_number} as this agent’s current version? Built-in production agents are unaffected.`
                        : ''
                }
                confirmLabel="Roll back"
                variant="primary"
                isProcessing={rollingBack}
                onConfirm={() => void confirmRollback()}
                onCancel={() => setPendingRollback(null)}
            />

            {toast && (
                <Toast
                    open
                    tone={toast.tone}
                    title={toast.title}
                    message={toast.message}
                    onClose={() => setToast(null)}
                    autoCloseMs={3500}
                />
            )}
        </div>
    )
}

function RootAccessState({
    secondaryText,
    action,
}: {
    secondaryText: string
    action?: { label: string; onClick: () => void }
}) {
    return (
        <div className="mx-auto flex w-full max-w-[960px] px-5 py-10 sm:px-8">
            <EmptyState icon={<Icon icon={Bot} size={44} />} message="Root access required" secondaryText={secondaryText} button={action} />
        </div>
    )
}

function statusBadge(detail: AgentDetail | null, isNew: boolean, dirty: boolean) {
    if (isNew) return <Badge tone="ember">New · unsaved</Badge>
    if (!detail) return null
    if (detail.kind !== 'custom') return <Badge tone="neutral">Built-in v{detail.builtin_version}</Badge>
    if (dirty || detail.has_draft_changes) return <Badge tone="ember">Unpublished changes</Badge>
    return <Badge tone="arcane">Published v{detail.current_version_number}</Badge>
}

function AgentList({
    agents,
    loading,
    selectedKey,
    onSelect,
    onNew,
    onDelete,
}: {
    agents: AgentSummary[]
    loading: boolean
    selectedKey: string | null
    onSelect: (key: string) => void
    onNew: () => void
    onDelete: (agent: AgentSummary) => void
}) {
    return (
        <section className="flex min-w-0 flex-col gap-4 self-start">
            <SectionHeader
                icon={Bot}
                title="Agents"
                tone="arcane"
                right={<Badge tone={loading ? 'neutral' : 'glass'}>{loading ? 'Loading' : `${agents.length}`}</Badge>}
            />
            <Button variant="secondary" size="sm" iconLeft={<Icon icon={Plus} size={14} />} onClick={onNew}>
                Create custom copy
            </Button>
            <div className="flex flex-col gap-2">
                {agents.length === 0 && !loading && (
                    <p className="py-3 font-ui text-sm text-parchment-300">
                        No agents yet.
                    </p>
                )}
                {/* Row container is a <div>, not a <button>: the delete control is a
                    real <button> and nesting one inside another is invalid HTML —
                    assistive tech folds the inner control into the row's name and
                    never exposes it as a separate action. Select and delete are
                    siblings in a two-column grid instead. */}
                {agents.map((agent) => (
                    <div
                        key={agent.workflow_key}
                        className={cx(
                            'grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2 rounded-md border-l-2 px-3 py-3 transition-colors',
                            selectedKey === agent.workflow_key
                                ? 'border-ember-500 bg-ember-500/10'
                                : 'border-transparent hover:bg-surface-raised',
                        )}
                    >
                        <button
                            type="button"
                            onClick={() => onSelect(agent.workflow_key)}
                            aria-pressed={selectedKey === agent.workflow_key}
                            className="flex min-w-0 flex-col gap-1.5 rounded-xs text-left"
                        >
                            <span className="min-w-0 truncate font-ui text-sm font-semibold text-parchment-50">
                                {agent.display_name}
                            </span>
                            <span className="flex flex-wrap items-center gap-1.5">
                                <Badge tone="glass">{OUTPUT_MODE_LABEL[agent.output_mode]}</Badge>
                                {agent.kind === 'custom' && agent.has_draft_changes && (
                                    <Badge tone="ember">Draft</Badge>
                                )}
                            </span>
                        </button>
                        {agent.kind !== 'custom' ? (
                            <Badge tone="neutral" icon={<Icon icon={Lock} size={10} />}>
                                File
                            </Badge>
                        ) : (
                            <IconButton label={`Delete ${agent.display_name}`} size="sm" onClick={() => onDelete(agent)}>
                                <Icon icon={Trash2} size={14} />
                            </IconButton>
                        )}
                    </div>
                ))}
            </div>
        </section>
    )
}

interface EditorProps {
    form: AgentForm
    detail: AgentDetail | null
    errors: Record<string, string>
    isNew: boolean
    isImmutable: boolean
    sourceOptions: SelectOption[]
    dirty: boolean
    loading: boolean
    saving: boolean
    publishing: boolean
    canSave: boolean
    onSubmit: (event: FormEvent<HTMLFormElement>) => void
    onPatch: (changes: Partial<AgentForm['editable']>) => void
    onOutputMode: (mode: AgentOutputMode) => void
    onDisplayName: (value: string) => void
    onSlug: (value: string) => void
    onSource: (value: string) => void
    onCreateCopy: () => void
    onPublish: () => void
    onVersions: () => void
    onDelete: () => void
    setToast: (toast: ToastState) => void
    setError: (message: string | null) => void
}

function AgentEditor(props: EditorProps) {
    const { t } = useTranslation()
    const {
        form,
        detail,
        errors,
        isNew,
        isImmutable,
        sourceOptions,
        dirty,
        saving,
        publishing,
        canSave,
        onSubmit,
        onPatch,
        onOutputMode,
        onDisplayName,
        onSlug,
        onSource,
        onCreateCopy,
        onPublish,
        onVersions,
        onDelete,
    } = props
    const e = form.editable
    const readOnly = isNew || isImmutable

    const outputModeOptions: SelectOption[] = isImmutable || isNew || !!detail?.schema_model
        ? [{ value: form.outputMode, label: OUTPUT_MODE_LABEL[form.outputMode] }]
        : [
              ...(detail?.schema_model
                  ? [{ value: 'strict_card_schema', label: 'Strict card schema', description: 'Validate against the copied card schema' }]
                  : []),
              { value: 'json_object', label: 'JSON object', description: 'Model returns one JSON object' },
              { value: 'markdown', label: 'Markdown', description: 'Model returns free-form text' },
          ]

    return (
        <form className="flex min-w-0 flex-col gap-8" onSubmit={onSubmit}>
            <section className="flex flex-col gap-5 border-t border-line-faint pt-6 first:border-t-0 first:pt-0">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <SectionHeader icon={Bot} title={isNew ? 'Create custom copy' : form.displayName} tone="arcane" />
                    <div className="flex items-center gap-2">{statusBadge(detail, isNew, dirty)}</div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                    {isNew && (
                        <Field label="Copy from" error={errors.sourceWorkflowKey} helper="The new agent starts as a detached copy of this source.">
                            <Select
                                options={sourceOptions}
                                value={form.sourceWorkflowKey}
                                onChange={onSource}
                                aria-label="Copy from"
                            />
                        </Field>
                    )}
                    <Field label="Name" error={errors.displayName}>
                        <Input
                            value={form.displayName}
                            disabled={!isNew}
                            maxLength={128}
                            onChange={(event) => onDisplayName(event.target.value)}
                            onBlur={() => {
                                if (isNew && !form.slug.trim() && form.displayName.trim()) {
                                    onSlug(slugifyWorkflowKey(form.displayName))
                                }
                            }}
                            placeholder="World generator"
                        />
                    </Field>
                    <Field
                        label="Workflow key"
                        error={errors.slug}
                        helper={isNew ? 'Lowercase id; stored as custom_<key>.' : 'Built-in key (read-only).'}
                    >
                        <Input
                            value={form.slug}
                            disabled={!isNew}
                            maxLength={40}
                            onChange={(event) => onSlug(slugifyWorkflowKey(event.target.value))}
                            placeholder="my_generator"
                        />
                    </Field>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Output mode" error={errors.outputMode} helper="Controls whether JSON output is requested.">
                        <Select
                            options={outputModeOptions}
                            value={form.outputMode}
                            onChange={(value) => onOutputMode(value as AgentOutputMode)}
                            disabled={readOnly}
                            aria-label="Output mode"
                        />
                    </Field>

                </div>
            </section>

            <section className="flex flex-col gap-5 border-t border-line-faint pt-6 first:border-t-0 first:pt-0">
                <SectionHeader icon={CornerDownLeft} title="Prompts" tone="ember" />
                <Field label="System message" error={errors.system_message}>
                    <Textarea
                        value={e.system_message}
                        onChange={(event) => onPatch({ system_message: event.target.value })}
                        maxLength={20000}
                        disabled={readOnly}
                        rows={4}
                        placeholder="You generate Magic Worlds content cards..."
                    />
                </Field>
                <PromptTemplateField
                    value={e.prompt_template}
                    error={errors.prompt_template}
                    onChange={(value) => onPatch({ prompt_template: value })}
                    disabled={readOnly}
                />
            </section>

            <p className="font-ui text-sm text-parchment-300">{t('admin.agents.profileSettings')}</p>

            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex gap-2">
                    {!isNew && !isImmutable && (
                        <Button
                            variant="danger"
                            size="sm"
                            type="button"
                            iconLeft={<Icon icon={Trash2} size={14} />}
                            onClick={onDelete}
                        >
                            Delete
                        </Button>
                    )}
                </div>
                <div className="flex flex-wrap gap-2">
                    {isImmutable ? (
                        <Button type="button" variant="primary" size="sm" iconLeft={<Icon icon={Plus} size={14} />} onClick={onCreateCopy}>
                            Create custom copy
                        </Button>
                    ) : (
                        <>
                            {!isNew && (
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    type="button"
                                    iconLeft={<Icon icon={History} size={14} />}
                                    onClick={onVersions}
                                >
                                    Versions
                                </Button>
                            )}
                            <Button
                                type="submit"
                                variant="secondary"
                                size="sm"
                                iconLeft={<Icon icon={saving ? Loader2 : Save} size={14} className={saving ? 'animate-spin' : undefined} />}
                                disabled={!canSave || saving || (!dirty && !isNew)}
                            >
                                {isNew ? 'Create copy' : 'Save draft'}
                            </Button>
                            {!isNew && (
                                <Button
                                    type="button"
                                    variant="primary"
                                    size="sm"
                                    iconLeft={<Icon icon={publishing ? Loader2 : Rocket} size={14} className={publishing ? 'animate-spin' : undefined} />}
                                    onClick={onPublish}
                                    disabled={publishing || !canSave || dirty}
                                >
                                    Publish custom version
                                </Button>
                            )}
                        </>
                    )}
                </div>
            </div>

            {!isNew && detail && <AgentTestPanel key={detail.workflow_key} workflowKey={detail.workflow_key} outputMode={detail.output_mode} source={detail.kind === 'custom' ? 'draft' : 'current'} setToast={props.setToast} setError={props.setError} />}
        </form>
    )
}

function PromptTemplateField({
    value,
    error,
    onChange,
    disabled = false,
}: {
    value: string
    error?: string
    onChange: (value: string) => void
    disabled?: boolean
}) {
    const ref = useRef<HTMLTextAreaElement>(null)
    const fieldId = 'agent-prompt-template'

    const insertToken = () => {
        const el = ref.current
        if (!el) {
            onChange(`${value}${INPUT_TOKEN}`)
            return
        }
        const start = el.selectionStart ?? value.length
        const end = el.selectionEnd ?? value.length
        const next = `${value.slice(0, start)}${INPUT_TOKEN}${value.slice(end)}`
        onChange(next)
        requestAnimationFrame(() => {
            el.focus()
            const caret = start + INPUT_TOKEN.length
            el.setSelectionRange(caret, caret)
        })
    }

    return (
        <Field
            htmlFor={fieldId}
            label={
                <span className="flex items-center justify-between gap-2">
                    <span>Prompt template</span>
                    <button
                        type="button"
                        onClick={insertToken}
                        disabled={disabled}
                        className="inline-flex items-center gap-1 rounded-md border border-parchment-50/15 px-2 py-1 text-[11px] font-semibold text-parchment-100 transition-colors hover:border-ember-500/60"
                    >
                        <Icon icon={Plus} size={11} /> Insert input token
                    </button>
                </span>
            }
            error={error}
            helper={`Use ${INPUT_TOKEN} where the user's input should appear.`}
        >
            <textarea
                ref={ref}
                id={fieldId}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                disabled={disabled}
                maxLength={40000}
                rows={8}
                aria-invalid={error ? true : undefined}
                className={cx(controlClass, 'min-h-[120px] resize-y')}
                placeholder={`Create one card from this description:\n${INPUT_TOKEN}`}
            />
        </Field>
    )
}

function VersionHistoryDrawer({
    open,
    versions,
    onClose,
    onRollback,
}: {
    open: boolean
    versions: AgentVersion[]
    onClose: () => void
    onRollback: (version: AgentVersion) => void
}) {
    return (
        <Drawer open={open} onClose={onClose} title="Version history" eyebrow="Root console" icon={<Icon icon={History} size={18} />} size="lg">
            <div className="flex flex-col gap-3 p-5">
                {versions.length === 0 && (
                    <p className="font-ui text-sm text-parchment-300">No published versions yet.</p>
                )}
                {versions.map((version) => (
                    <div
                        key={version.version_id}
                        className="flex flex-wrap items-center justify-between gap-3 border-b border-line-faint py-4 last:border-b-0"
                    >
                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <span className="font-ui text-sm font-semibold text-parchment-50">v{version.version_number}</span>
                                {version.is_current && <Badge tone="arcane">Current</Badge>}
                                <Badge tone="neutral">{OUTPUT_MODE_LABEL[version.output_mode]}</Badge>
                            </div>
                            <p className="mt-1 font-mono text-xs text-parchment-400">{version.graph_version}</p>
                            {version.created_at && (
                                <p className="font-mono text-xs text-parchment-400">{version.created_at}</p>
                            )}
                        </div>
                        {!version.is_current && (
                            <Button variant="secondary" size="sm" onClick={() => onRollback(version)}>
                                Roll back
                            </Button>
                        )}
                    </div>
                ))}
            </div>
        </Drawer>
    )
}

function AgentTestPanel({
    workflowKey,
    outputMode,
    source,
    setToast,
    setError,
}: {
    workflowKey: string
    outputMode: AgentOutputMode
    source: 'draft' | 'current'
    setToast: (toast: ToastState) => void
    setError: (message: string | null) => void
}) {
    const { t } = useTranslation()
    const [input, setInput] = useState('')
    const [running, setRunning] = useState(false)
    const [result, setResult] = useState<AgentTestResponse | null>(null)
    // A failed run of the same test keeps its request ID, so trying again
    // recovers that run instead of paying for a second one.
    const attemptRef = useRef<{ key: string; requestId: string; llm?: LlmRequest; nextRetry?: LlmRequest } | null>(null)

    const run = async () => {
        if (!input.trim() || running) return
        setRunning(true)
        setError(null)
        const key = JSON.stringify([workflowKey, source, outputMode, input.trim()])
        if (attemptRef.current?.key !== key) attemptRef.current = { key, requestId: makeRequestId('mw-agent-test') }
        if (attemptRef.current.nextRetry) attemptRef.current = { key, requestId: makeRequestId('mw-agent-test'), llm: attemptRef.current.nextRetry }
        const attempt = attemptRef.current
        try {
            const res = await apiService.testAgent(workflowKey, { input_text: input.trim(), source, ...(attempt.llm ? { llm: attempt.llm } : {}) }, attempt.requestId,
                outputMode === 'markdown' ? 'novel' : 'card_generation')
            if (attemptRef.current === attempt) attemptRef.current = null
            setResult(res)
        } catch (err) {
            if (err instanceof ApiError && err.llmRetry && attemptRef.current === attempt) attempt.nextRetry = { ...err.llmRetry }
            const message = llmRecoveryMessage(err, t) ?? (err instanceof Error ? err.message : 'Test failed.')
            setError(message)
            setToast({ tone: 'error', title: 'Test failed', message })
        } finally {
            setRunning(false)
        }
    }

    const rendered = result
        ? result.text_output ?? JSON.stringify(result.json_output ?? {}, null, 2)
        : ''

    return (
        <Card>
            <div className="flex flex-col gap-4 p-5">
                <SectionHeader
                    icon={Play}
                    title={t(source === 'draft' ? 'admin.agents.testDraft' : 'admin.agents.testCurrent')}
                    tone="ember"
                    right={<Badge tone="ember">Not saved as a card</Badge>}
                />
                <LlmFeatureControl feature={outputMode === 'markdown' ? 'novel' : 'card_generation'} disabled={running} />
                <Field label="Sample input" helper={t('admin.agents.testExecution')}>
                    <Textarea
                        value={input}
                        onChange={(event) => setInput(event.target.value)}
                        rows={3}
                        placeholder="A cursed lighthouse keeper who guards a drowned city..."
                    />
                </Field>
                <div className="flex justify-end">
                    <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        iconLeft={<Icon icon={running ? Loader2 : Play} size={14} className={running ? 'animate-spin' : undefined} />}
                        onClick={() => void run()}
                        disabled={!input.trim() || running}
                    >
                        Run test
                    </Button>
                </div>
                {result && <Badge tone="arcane">{result.llm_execution.credential_mode} · {result.llm_execution.revision_id}</Badge>}
                {result && (
                    <pre className="max-h-[360px] overflow-auto rounded-lg border border-parchment-50/[.08] bg-ink-900 p-4 font-mono text-xs leading-relaxed text-parchment-200 whitespace-pre-wrap">
                        {rendered}
                    </pre>
                )}
            </div>
        </Card>
    )
}
