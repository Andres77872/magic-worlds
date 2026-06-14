import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import {
    Bot,
    CornerDownLeft,
    FlaskConical,
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
import { apiService } from '@/infrastructure/api'
import type {
    AgentDetail,
    AgentModelOption,
    AgentOutputMode,
    AgentSummary,
    AgentTestResponse,
    AgentVersion,
} from '@/shared'
import {
    Badge,
    Button,
    Card,
    Chip,
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
    SwitchRow,
    Textarea,
    Toast,
    controlClass,
    cx,
} from '@/ui/primitives'
import { ConfirmDialog } from '@/ui/components/ConfirmDialog'
import { EmptyState } from '@/ui/components/common/EmptyState'
import {
    INPUT_TOKEN,
    type AgentForm,
    blankForm,
    deriveJsonOutput,
    formFromDetail,
    slugifyWorkflowKey,
    toCreateRequest,
    toUpdateRequest,
    validateAgentForm,
} from '../agentValidation'

const ENV_MODEL = '{{env.CARD_LLM_MODEL}}'
const NEW_KEY = '__new__'

const OUTPUT_MODE_LABEL: Record<AgentOutputMode, string> = {
    strict_card_schema: 'Strict card schema',
    json_object: 'JSON object',
    markdown: 'Markdown',
}

type ToastState = { tone: 'success' | 'error'; title: string; message?: string } | null

export function AdminAgentsPage() {
    const { t } = useTranslation()
    const { isAuthenticated, user, openLoginModal } = useAuth()
    const isRoot = isAuthenticated && user?.user_type === 'root'

    const [agents, setAgents] = useState<AgentSummary[]>([])
    const [selectedKey, setSelectedKey] = useState<string | null>(null)
    const [detail, setDetail] = useState<AgentDetail | null>(null)
    const [form, setForm] = useState<AgentForm | null>(null)
    const [baseline, setBaseline] = useState<AgentForm | null>(null)
    const [models, setModels] = useState<AgentModelOption[]>([])
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
    const isBuiltin = detail?.is_system ?? false
    const errors = useMemo(
        () => (form ? validateAgentForm(form, { isNew, isBuiltin }, t) : {}),
        [form, isNew, isBuiltin, t],
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
        apiService
            .listAgentModels()
            .then((res) => setModels(res.models))
            .catch(() => setModels([]))
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

    const startNew = useCallback(() => {
        setError(null)
        setDetail(null)
        setSelectedKey(NEW_KEY)
        const fresh = blankForm()
        setForm(fresh)
        setBaseline(fresh)
    }, [])

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
        if (!form || hasErrors || saving) return
        setSaving(true)
        setError(null)
        try {
            const next = isNew
                ? await apiService.createAgent(toCreateRequest(form))
                : await apiService.updateAgentDraft(detail!.workflow_key, toUpdateRequest(form, isBuiltin))
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
        if (!detail || isNew || publishing) return
        setPublishing(true)
        setError(null)
        try {
            const next = await apiService.publishAgent(detail.workflow_key)
            applyDetail(next)
            await refreshAgents()
            if (versionsOpen) await loadVersions(next.workflow_key)
            setToast({ tone: 'success', title: 'Published', message: `Version ${next.published_version_number}` })
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
        if (!target || !detail) return
        setRollingBack(true)
        try {
            const next = await apiService.rollbackAgentVersion(detail.workflow_key, target.version_id)
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
        if (!target) return
        setDeleting(true)
        try {
            await apiService.deleteAgent(target.workflow_key)
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
                subtitle="Configure the prompts, model, and parameters behind AI generation. Drafts stay private until you publish."
                size="lg"
                actions={
                    <div className="flex gap-2">
                        <Button
                            kind="secondary"
                            size="sm"
                            iconLeft={<Icon icon={Plus} size={15} />}
                            onClick={startNew}
                        >
                            New agent
                        </Button>
                        <Button
                            kind="secondary"
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
                    <Button kind="secondary" size="sm" onClick={() => setError(null)}>
                        Dismiss
                    </Button>
                </div>
            )}

            <div className="grid gap-6 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
                <AgentList
                    agents={agents}
                    loading={loadingList}
                    selectedKey={selectedKey}
                    onSelect={(key) => void selectAgent(key)}
                    onNew={startNew}
                    onDelete={setPendingDelete}
                />

                {form ? (
                    <AgentEditor
                        form={form}
                        detail={detail}
                        models={models}
                        errors={errors}
                        isNew={isNew}
                        isBuiltin={isBuiltin}
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
                                secondaryText="Pick a generation agent to edit, or create a new custom one."
                                button={{ label: 'New agent', onClick: startNew }}
                            />
                        </div>
                    </Card>
                )}
            </div>

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
                        ? `Point production at version ${pendingRollback.version_number}? This takes effect immediately.`
                        : ''
                }
                confirmLabel="Roll back"
                variant="warning"
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
    if (!detail?.has_published) return <Badge tone="ember">Draft · never published</Badge>
    if (dirty || detail.has_unpublished_draft) return <Badge tone="ember">Unpublished changes</Badge>
    return <Badge tone="arcane">Published v{detail.published_version_number}</Badge>
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
        <Card>
            <div className="flex flex-col gap-4 p-5">
                <SectionHeader
                    icon={Bot}
                    title="Agents"
                    tone="arcane"
                    right={<Badge tone={loading ? 'neutral' : 'glass'}>{loading ? 'Loading' : `${agents.length}`}</Badge>}
                />
                <Button kind="secondary" size="sm" iconLeft={<Icon icon={Plus} size={14} />} onClick={onNew}>
                    New custom agent
                </Button>
                <div className="flex flex-col gap-2">
                    {agents.length === 0 && !loading && (
                        <p className="rounded-lg border border-parchment-50/[.08] bg-ink-800/70 px-4 py-3 font-ui text-sm text-parchment-300">
                            No agents yet.
                        </p>
                    )}
                    {agents.map((agent) => (
                        <button
                            key={agent.workflow_key}
                            type="button"
                            onClick={() => onSelect(agent.workflow_key)}
                            className={cx(
                                'flex w-full flex-col gap-1.5 rounded-lg border px-3.5 py-3 text-left transition-colors',
                                selectedKey === agent.workflow_key
                                    ? 'border-ember-500/50 bg-ember-500/10'
                                    : 'border-parchment-50/[.08] bg-ink-800/70 hover:border-parchment-50/20',
                            )}
                        >
                            <div className="flex items-center justify-between gap-2">
                                <span className="min-w-0 truncate font-ui text-sm font-semibold text-parchment-50">
                                    {agent.display_name}
                                </span>
                                {agent.is_system ? (
                                    <Badge tone="neutral" icon={<Icon icon={Lock} size={10} />}>
                                        Built-in
                                    </Badge>
                                ) : (
                                    <IconButton
                                        label={`Delete ${agent.display_name}`}
                                        size="sm"
                                        onClick={(event) => {
                                            event.stopPropagation()
                                            onDelete(agent)
                                        }}
                                    >
                                        <Icon icon={Trash2} size={14} />
                                    </IconButton>
                                )}
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5">
                                <Chip>{OUTPUT_MODE_LABEL[agent.output_mode]}</Chip>
                                {agent.has_unpublished_draft && agent.has_published && (
                                    <Badge tone="ember">Draft</Badge>
                                )}
                                {!agent.has_published && <Badge tone="ember">Unpublished</Badge>}
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        </Card>
    )
}

interface EditorProps {
    form: AgentForm
    detail: AgentDetail | null
    models: AgentModelOption[]
    errors: Record<string, string>
    isNew: boolean
    isBuiltin: boolean
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
    onPublish: () => void
    onVersions: () => void
    onDelete: () => void
    setToast: (toast: ToastState) => void
    setError: (message: string | null) => void
}

function AgentEditor(props: EditorProps) {
    const {
        form,
        detail,
        models,
        errors,
        isNew,
        isBuiltin,
        dirty,
        saving,
        publishing,
        canSave,
        onSubmit,
        onPatch,
        onOutputMode,
        onDisplayName,
        onSlug,
        onPublish,
        onVersions,
        onDelete,
    } = props
    const e = form.editable

    const modelOptions = useMemo<SelectOption[]>(() => {
        const opts: SelectOption[] = [
            { value: ENV_MODEL, label: 'Server default', description: 'Uses the CARD_LLM_MODEL env value' },
        ]
        for (const model of models) {
            opts.push({
                value: model.id,
                label: model.label ?? model.id,
                description: model.owned_by ?? undefined,
            })
        }
        if (e.model && !opts.some((option) => option.value === e.model)) {
            opts.push({ value: e.model, label: e.model })
        }
        return opts
    }, [models, e.model])

    const outputModeOptions: SelectOption[] = isBuiltin
        ? [{ value: form.outputMode, label: OUTPUT_MODE_LABEL[form.outputMode] }]
        : [
              { value: 'json_object', label: 'JSON object', description: 'Model returns one JSON object' },
              { value: 'markdown', label: 'Markdown', description: 'Model returns free-form text' },
          ]

    return (
        <form className="flex flex-col gap-6" onSubmit={onSubmit}>
            <Card>
                <div className="flex flex-col gap-5 p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <SectionHeader icon={Bot} title={isNew ? 'New agent' : form.displayName} tone="arcane" />
                        <div className="flex items-center gap-2">{statusBadge(detail, isNew, dirty)}</div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="Name" error={errors.displayName}>
                            <Input
                                value={form.displayName}
                                disabled={!isNew}
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
                                disabled={isBuiltin}
                                aria-label="Output mode"
                            />
                        </Field>
                        <Field label="Model" error={errors.model} helper="Provider credentials stay server-side (env).">
                            <Select
                                options={modelOptions}
                                value={e.model || null}
                                onChange={(value) => onPatch({ model: value })}
                                placeholder="Select a model"
                                aria-label="Model"
                            />
                        </Field>
                    </div>
                </div>
            </Card>

            <Card>
                <div className="flex flex-col gap-5 p-5">
                    <SectionHeader icon={CornerDownLeft} title="Prompts" tone="ember" />
                    <Field label="System message" error={errors.system_message}>
                        <Textarea
                            value={e.system_message}
                            onChange={(event) => onPatch({ system_message: event.target.value })}
                            rows={4}
                            placeholder="You generate Magic Worlds content cards..."
                        />
                    </Field>
                    <PromptTemplateField
                        value={e.prompt_template}
                        error={errors.prompt_template}
                        onChange={(value) => onPatch({ prompt_template: value })}
                    />
                </div>
            </Card>

            <Card>
                <div className="flex flex-col gap-5 p-5">
                    <SectionHeader icon={FlaskConical} title="Generation parameters" tone="arcane" />
                    <div className="grid gap-4 sm:grid-cols-3">
                        <NumberField
                            label="Temperature"
                            value={e.temperature}
                            error={errors.temperature}
                            min={0}
                            max={2}
                            step={0.05}
                            onChange={(value) => onPatch({ temperature: value ?? 0 })}
                        />
                        <NumberField
                            label="Top-p"
                            value={e.top_p}
                            error={errors.top_p}
                            min={0}
                            max={1}
                            step={0.05}
                            allowEmpty
                            onChange={(value) => onPatch({ top_p: value })}
                        />
                        <NumberField
                            label="Max tokens"
                            value={e.max_tokens}
                            error={errors.max_tokens}
                            min={1}
                            max={32000}
                            step={1}
                            onChange={(value) => onPatch({ max_tokens: value ?? 0 })}
                        />
                    </div>
                    <SwitchRow
                        label="JSON output"
                        description="Derived from the output mode and not editable directly."
                        checked={e.json_output}
                        onChange={() => undefined}
                        disabled
                    />
                </div>
            </Card>

            <Card>
                <div className="flex flex-col gap-5 p-5">
                    <SectionHeader icon={History} title="Context window" tone="ember" />
                    <div className="grid gap-4 sm:grid-cols-3">
                        <NumberField
                            label="Max messages"
                            value={e.max_messages}
                            error={errors.max_messages}
                            min={1}
                            max={64}
                            step={1}
                            onChange={(value) => onPatch({ max_messages: value ?? 0 })}
                        />
                        <NumberField
                            label="Max input tokens"
                            value={e.max_input_tokens}
                            error={errors.max_input_tokens}
                            min={256}
                            max={200000}
                            step={256}
                            onChange={(value) => onPatch({ max_input_tokens: value ?? 0 })}
                        />
                        <Field label="Truncation">
                            <Select
                                options={[
                                    { value: 'tail', label: 'Tail (drop oldest)' },
                                    { value: 'token_budget', label: 'Token budget' },
                                ]}
                                value={e.truncation_strategy}
                                onChange={(value) => onPatch({ truncation_strategy: value as 'tail' | 'token_budget' })}
                                aria-label="Truncation strategy"
                            />
                        </Field>
                    </div>
                </div>
            </Card>

            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex gap-2">
                    {!isNew && !isBuiltin && (
                        <Button
                            kind="danger"
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
                    <Button
                        kind="secondary"
                        size="sm"
                        type="button"
                        iconLeft={<Icon icon={History} size={14} />}
                        onClick={onVersions}
                        disabled={isNew}
                    >
                        Versions
                    </Button>
                    <Button
                        type="submit"
                        kind="secondary"
                        size="sm"
                        iconLeft={<Icon icon={saving ? Loader2 : Save} size={14} className={saving ? 'animate-spin' : undefined} />}
                        disabled={!canSave || saving || (!dirty && !isNew)}
                    >
                        {isNew ? 'Create' : 'Save draft'}
                    </Button>
                    <Button
                        type="button"
                        kind="primary"
                        size="sm"
                        iconLeft={<Icon icon={publishing ? Loader2 : Rocket} size={14} className={publishing ? 'animate-spin' : undefined} />}
                        onClick={onPublish}
                        disabled={isNew || publishing || !canSave}
                    >
                        Publish
                    </Button>
                </div>
            </div>

            {!isNew && detail && <AgentTestPanel workflowKey={detail.workflow_key} setToast={props.setToast} setError={props.setError} />}
        </form>
    )
}

function PromptTemplateField({
    value,
    error,
    onChange,
}: {
    value: string
    error?: string
    onChange: (value: string) => void
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
                rows={8}
                aria-invalid={error ? true : undefined}
                className={cx(controlClass, 'min-h-[120px] resize-y')}
                placeholder={`Create one card from this description:\n${INPUT_TOKEN}`}
            />
        </Field>
    )
}

function NumberField({
    label,
    value,
    error,
    min,
    max,
    step,
    allowEmpty = false,
    onChange,
}: {
    label: string
    value: number | null
    error?: string
    min: number
    max: number
    step: number
    allowEmpty?: boolean
    onChange: (value: number | null) => void
}) {
    return (
        <Field label={label} error={error}>
            <Input
                type="number"
                value={value ?? ''}
                min={min}
                max={max}
                step={step}
                onChange={(event) => {
                    const raw = event.target.value
                    if (raw === '' && allowEmpty) {
                        onChange(null)
                        return
                    }
                    const parsed = Number(raw)
                    onChange(Number.isNaN(parsed) ? null : parsed)
                }}
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
                        className="flex items-center justify-between gap-3 rounded-lg border border-parchment-50/[.08] bg-ink-800/70 px-4 py-3"
                    >
                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <span className="font-ui text-sm font-semibold text-parchment-50">v{version.version_number}</span>
                                {version.is_current && <Badge tone="arcane">Current</Badge>}
                                <Chip>{OUTPUT_MODE_LABEL[version.output_mode]}</Chip>
                            </div>
                            <p className="mt-1 font-mono text-xs text-parchment-400">{version.graph_version}</p>
                            {version.published_at && (
                                <p className="font-mono text-xs text-parchment-400">{version.published_at}</p>
                            )}
                        </div>
                        {!version.is_current && (
                            <Button kind="secondary" size="sm" onClick={() => onRollback(version)}>
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
    setToast,
    setError,
}: {
    workflowKey: string
    setToast: (toast: ToastState) => void
    setError: (message: string | null) => void
}) {
    const [input, setInput] = useState('')
    const [running, setRunning] = useState(false)
    const [result, setResult] = useState<AgentTestResponse | null>(null)

    const run = async () => {
        if (!input.trim() || running) return
        setRunning(true)
        setError(null)
        try {
            const res = await apiService.testAgent(workflowKey, { input_text: input.trim(), source: 'draft' })
            setResult(res)
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Test failed.'
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
                    title="Test (current draft)"
                    tone="ember"
                    right={<Badge tone="ember">Not saved as a card</Badge>}
                />
                <Field label="Sample input" helper="Runs the current draft once; nothing is persisted.">
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
                        kind="primary"
                        size="sm"
                        iconLeft={<Icon icon={running ? Loader2 : Play} size={14} className={running ? 'animate-spin' : undefined} />}
                        onClick={() => void run()}
                        disabled={!input.trim() || running}
                    >
                        Run test
                    </Button>
                </div>
                {result && (
                    <pre className="max-h-[360px] overflow-auto rounded-lg border border-parchment-50/[.08] bg-ink-900 p-4 font-mono text-xs leading-relaxed text-parchment-200 whitespace-pre-wrap">
                        {rendered}
                    </pre>
                )}
            </div>
        </Card>
    )
}
