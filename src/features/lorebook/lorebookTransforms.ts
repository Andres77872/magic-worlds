import type {
    LoreActivationPreviewResponse,
    LoreActivationResult,
    Lorebook,
    LorebookAttachment,
    LorebookDraft,
    LorebookEntry,
    LorebookEntryDraft,
    LorebookEntryType,
    LorebookInsertionPosition,
    LorebookIssue,
    LorebookSelectiveLogic,
    LorebookSettings,
    LorebookTargetKind,
} from '@/shared'

type Raw = Record<string, unknown>

const ENTRY_TYPES = new Set<LorebookEntryType>([
    'character',
    'world',
    'faction',
    'place',
    'item',
    'rule',
    'secret',
    'quest',
    'state',
    'relationship',
    'other',
])

const TARGET_KINDS = new Set<LorebookTargetKind>([
    'global',
    'character',
    'world',
    'adventure_template',
    'adventure_session',
    'character_chat',
])

function isRecord(value: unknown): value is Raw {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function stringValue(value: unknown, fallback = ''): string {
    return typeof value === 'string' ? value : fallback
}

function maybeString(value: unknown): string | null {
    return typeof value === 'string' && value.trim() ? value : null
}

function numberValue(value: unknown, fallback: number): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function boolValue(value: unknown, fallback: boolean): boolean {
    return typeof value === 'boolean' ? value : fallback
}

function stringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return []
    return value.map((item) => (typeof item === 'string' ? item.trim() : '')).filter(Boolean)
}

function metadataValue(value: unknown): Record<string, unknown> | undefined {
    return isRecord(value) ? value : undefined
}

function first<T extends string>(value: unknown, allowed: Set<T>, fallback: T): T {
    return typeof value === 'string' && allowed.has(value as T) ? (value as T) : fallback
}

export const DEFAULT_LOREBOOK_SETTINGS: LorebookSettings = {
    scanDepth: 8,
    tokenBudget: 1200,
    recursiveScanning: false,
    matchWholeWords: true,
    caseSensitive: false,
}

export function blankLorebookDraft(): LorebookDraft {
    return {
        name: '',
        description: '',
        tags: [],
        enabled: true,
        settings: { ...DEFAULT_LOREBOOK_SETTINGS },
        metadata: {},
        entries: [],
    }
}

export function blankEntryDraft(order: number): LorebookEntryDraft {
    return {
        title: '',
        entryType: 'other',
        content: '',
        keys: [],
        secondaryKeys: [],
        selectiveLogic: 'any',
        enabled: true,
        constant: false,
        caseSensitive: false,
        matchWholeWords: true,
        regex: false,
        isSecret: false,
        revealCondition: '',
        insertionOrder: order,
        priority: 0,
        insertionPosition: 'before_context',
        tokenBudget: null,
        metadata: {},
    }
}

export function normalizeLorebookEntry(raw: unknown, lorebookIdFallback = ''): LorebookEntry {
    const item = isRecord(raw) ? raw : {}
    return {
        id: stringValue(item.id ?? item.entry_id, crypto.randomUUID?.() ?? `entry-${Date.now()}`),
        lorebookId: stringValue(item.lorebookId ?? item.lorebook_id, lorebookIdFallback),
        title: stringValue(item.title, 'Untitled entry'),
        entryType: first(item.entryType ?? item.entry_type, ENTRY_TYPES, 'other'),
        content: stringValue(item.content),
        keys: stringArray(item.keys),
        secondaryKeys: stringArray(item.secondaryKeys ?? item.secondary_keys),
        selectiveLogic: first(item.selectiveLogic ?? item.selective_logic, new Set<LorebookSelectiveLogic>(['any', 'all', 'and_any', 'and_all', 'not_any', 'not_all']), 'any'),
        enabled: boolValue(item.enabled, true),
        constant: boolValue(item.constant, false),
        caseSensitive: boolValue(item.caseSensitive ?? item.case_sensitive, false),
        matchWholeWords: boolValue(item.matchWholeWords ?? item.match_whole_words, true),
        regex: boolValue(item.regex, false),
        isSecret: boolValue(item.isSecret ?? item.is_secret, false),
        revealCondition: maybeString(item.revealCondition ?? item.reveal_condition),
        insertionOrder: numberValue(item.insertionOrder ?? item.insertion_order, 0),
        priority: numberValue(item.priority, 0),
        insertionPosition: first(item.insertionPosition ?? item.insertion_position, new Set<LorebookInsertionPosition>(['before_context', 'after_context', 'author_note', 'system']), 'before_context'),
        tokenBudget: item.tokenBudget === null || item.token_budget === null ? null : numberValue(item.tokenBudget ?? item.token_budget, 0) || null,
        metadata: metadataValue(item.metadata),
        createdAt: stringValue(item.createdAt ?? item.created_at, undefined as never),
        updatedAt: stringValue(item.updatedAt ?? item.updated_at, undefined as never),
    }
}

export function normalizeLorebookAttachment(raw: unknown): LorebookAttachment {
    const item = isRecord(raw) ? raw : {}
    return {
        id: stringValue(item.id ?? item.attachment_id, crypto.randomUUID?.() ?? `attachment-${Date.now()}`),
        lorebookId: stringValue(item.lorebookId ?? item.lorebook_id),
        targetKind: first(item.targetKind ?? item.target_kind, TARGET_KINDS, 'global'),
        targetId: maybeString(item.targetId ?? item.target_id),
        mode: item.mode === 'snapshot' ? 'snapshot' : 'linked',
        snapshot: isRecord(item.snapshot) ? normalizeLorebook(item.snapshot) : null,
        createdAt: stringValue(item.createdAt ?? item.created_at, undefined as never),
        updatedAt: stringValue(item.updatedAt ?? item.updated_at, undefined as never),
    }
}

export function normalizeLorebook(raw: unknown): Lorebook {
    const item = isRecord(raw) ? raw : {}
    const settings = isRecord(item.settings) ? item.settings : item
    const id = stringValue(item.id ?? item.lorebook_id, crypto.randomUUID?.() ?? `lorebook-${Date.now()}`)
    return {
        id,
        name: stringValue(item.name, 'Untitled lorebook'),
        description: maybeString(item.description),
        tags: stringArray(item.tags),
        enabled: boolValue(item.enabled, true),
        settings: {
            scanDepth: numberValue(settings.scanDepth ?? settings.scan_depth, DEFAULT_LOREBOOK_SETTINGS.scanDepth),
            tokenBudget: numberValue(settings.tokenBudget ?? settings.token_budget, DEFAULT_LOREBOOK_SETTINGS.tokenBudget),
            recursiveScanning: boolValue(settings.recursiveScanning ?? settings.recursive_scanning, DEFAULT_LOREBOOK_SETTINGS.recursiveScanning),
            matchWholeWords: boolValue(settings.matchWholeWords ?? settings.match_whole_words, DEFAULT_LOREBOOK_SETTINGS.matchWholeWords),
            caseSensitive: boolValue(settings.caseSensitive ?? settings.case_sensitive, DEFAULT_LOREBOOK_SETTINGS.caseSensitive),
        },
        entries: Array.isArray(item.entries) ? item.entries.map((entry) => normalizeLorebookEntry(entry, id)) : [],
        attachments: Array.isArray(item.attachments) ? item.attachments.map(normalizeLorebookAttachment) : [],
        metadata: metadataValue(item.metadata),
        createdAt: stringValue(item.createdAt ?? item.created_at, undefined as never),
        updatedAt: stringValue(item.updatedAt ?? item.updated_at, undefined as never),
    }
}

export function normalizeLorebookList(raw: unknown): Lorebook[] {
    if (Array.isArray(raw)) return raw.map(normalizeLorebook)
    if (isRecord(raw) && Array.isArray(raw.items)) return raw.items.map(normalizeLorebook)
    return []
}

export function lorebookToApiPayload(lorebook: Lorebook | LorebookDraft | Partial<LorebookDraft>): Record<string, unknown> {
    return {
        name: lorebook.name,
        description: lorebook.description || null,
        tags: lorebook.tags ?? [],
        enabled: lorebook.enabled ?? true,
        scan_depth: lorebook.settings?.scanDepth ?? DEFAULT_LOREBOOK_SETTINGS.scanDepth,
        token_budget: lorebook.settings?.tokenBudget ?? DEFAULT_LOREBOOK_SETTINGS.tokenBudget,
        recursive_scanning: lorebook.settings?.recursiveScanning ?? DEFAULT_LOREBOOK_SETTINGS.recursiveScanning,
        match_whole_words: lorebook.settings?.matchWholeWords ?? DEFAULT_LOREBOOK_SETTINGS.matchWholeWords,
        case_sensitive: lorebook.settings?.caseSensitive ?? DEFAULT_LOREBOOK_SETTINGS.caseSensitive,
        metadata: lorebook.metadata ?? {},
        entries: 'entries' in lorebook && Array.isArray(lorebook.entries)
            ? lorebook.entries.map(entryToApiPayload)
            : undefined,
    }
}

export function entryToApiPayload(entry: Partial<LorebookEntry | LorebookEntryDraft>): Record<string, unknown> {
    return {
        title: entry.title ?? '',
        entry_type: entry.entryType ?? 'other',
        content: entry.content ?? '',
        keys: entry.keys ?? [],
        secondary_keys: entry.secondaryKeys ?? [],
        selective_logic: entry.selectiveLogic ?? 'any',
        enabled: entry.enabled ?? true,
        constant: entry.constant ?? false,
        case_sensitive: entry.caseSensitive ?? false,
        match_whole_words: entry.matchWholeWords ?? true,
        regex: entry.regex ?? false,
        is_secret: entry.isSecret ?? false,
        reveal_condition: entry.revealCondition || null,
        insertion_order: entry.insertionOrder ?? 0,
        priority: entry.priority ?? 0,
        insertion_position: entry.insertionPosition ?? 'before_context',
        token_budget: entry.tokenBudget ?? null,
        metadata: entry.metadata ?? {},
    }
}

export function estimateTokens(text: string): number {
    return Math.max(1, Math.ceil(text.trim().split(/\s+/).filter(Boolean).length * 1.35))
}

export function validateLorebookLocally(lorebook: Lorebook | LorebookDraft): LorebookIssue[] {
    const issues: LorebookIssue[] = []
    const entries = lorebook.entries ?? []
    if (!lorebook.name.trim()) {
        issues.push({ severity: 'error', code: 'name_required', message: 'Name the lorebook before saving.' })
    }
    if (entries.length === 0) {
        issues.push({ severity: 'warning', code: 'empty_book', message: 'Add at least one entry so the book can activate.' })
    }
    const seenKeys = new Map<string, string>()
    for (const entry of entries) {
        const title = entry.title.trim() || 'Untitled entry'
        const entryId = (entry as Partial<LorebookEntry>).id
        if (!entry.content.trim()) {
            issues.push({ severity: 'error', code: 'entry_content_required', message: `${title} needs prompt content.`, entryId })
        }
        if (!entry.constant && entry.keys.length === 0) {
            issues.push({ severity: 'warning', code: 'entry_keys_missing', message: `${title} needs activation keys or constant mode.`, entryId })
        }
        if (estimateTokens(entry.content) > 220) {
            issues.push({ severity: 'warning', code: 'entry_long', message: `${title} is long enough to pressure context budget.`, entryId })
        }
        for (const key of entry.keys) {
            const normalized = key.toLowerCase()
            if (normalized.length <= 2) {
                issues.push({ severity: 'warning', code: 'entry_key_short', message: `"${key}" is likely too broad to be a reliable key.`, entryId })
            }
            const previous = seenKeys.get(normalized)
            if (previous && previous !== title) {
                issues.push({ severity: 'warning', code: 'duplicate_key', message: `"${key}" is shared by ${previous} and ${title}.`, entryId })
            } else {
                seenKeys.set(normalized, title)
            }
        }
    }
    return issues
}

export function previewLocally(lorebook: Lorebook | LorebookDraft, sample: string): LoreActivationPreviewResponse {
    const haystack = sample.toLowerCase()
    const results: LoreActivationResult[] = (lorebook.entries ?? []).map((entry) => {
        const matchedKeys = entry.constant
            ? ['constant']
            : entry.keys.filter((key) => haystack.includes(entry.caseSensitive ? key : key.toLowerCase()))
        const active = Boolean(entry.enabled && matchedKeys.length > 0)
        return {
            entryId: (entry as Partial<LorebookEntry>).id ?? entry.title,
            lorebookId: 'id' in lorebook ? lorebook.id : 'draft',
            title: entry.title || 'Untitled entry',
            matchedKeys,
            status: active ? 'activated' : 'skipped',
            reason: active ? undefined : entry.enabled ? 'No key matched the sample text.' : 'Entry disabled.',
            estimatedTokens: estimateTokens(entry.content),
            insertionOrder: entry.insertionOrder,
            priority: entry.priority,
        }
    })
    const activated = results.filter((result) => result.status === 'activated')
    return {
        targetKind: 'global',
        activeAttachments: [],
        results,
        totalEstimatedTokens: activated.reduce((sum, result) => sum + result.estimatedTokens, 0),
        tokenBudget: lorebook.settings.tokenBudget,
        promptPreview: activated.map((result) => {
            const entry = (lorebook.entries ?? []).find((candidate) => ('id' in candidate ? candidate.id : candidate.title) === result.entryId)
            return entry?.content ?? ''
        }).filter(Boolean).join('\n\n'),
        issues: validateLorebookLocally(lorebook),
    }
}
