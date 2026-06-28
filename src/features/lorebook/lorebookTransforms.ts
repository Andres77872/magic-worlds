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
import {
    LOREBOOK_RESOURCE_MAX_CHARS,
    LOREBOOK_RESOURCE_MAX_RESOURCES,
    LOREBOOK_RESOURCE_MAX_TRIGGERS,
    findInvalidLorebookResource,
    lorebookHasResourceContent,
    lorebookResourceActivationEntries,
    lorebookResourcesFromMetadata,
    stripHydratedLorebookResourceMetadata,
} from './lorebookResources'
import { buildKeyRegex } from './loreTriggers'

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
        metadata: stripHydratedLorebookResourceMetadata(lorebook.metadata),
        entries: 'entries' in lorebook && Array.isArray(lorebook.entries)
            ? lorebook.entries.map(entryToApiPayload)
            : undefined,
    }
}

export function entryToApiPayload(entry: Partial<LorebookEntry | LorebookEntryDraft>): Record<string, unknown> {
    const id = 'id' in entry && typeof entry.id === 'string' && !entry.id.startsWith('draft-entry-')
        ? entry.id
        : undefined
    return {
        ...(id ? { id } : {}),
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

export function attachmentToApiPayload(attachment: Partial<LorebookAttachment>): Record<string, unknown> {
    return {
        ...(attachment.id ? { id: attachment.id } : {}),
        lorebook_id: attachment.lorebookId,
        target_kind: attachment.targetKind ?? 'global',
        target_id: attachment.targetId || null,
        mode: attachment.mode ?? 'linked',
        snapshot: attachment.snapshot ? lorebookToApiPayload(attachment.snapshot) : null,
    }
}

export function estimateTokens(text: string): number {
    return Math.max(1, Math.ceil(text.trim().split(/\s+/).filter(Boolean).length * 1.35))
}

type MatchOptions = {
    caseSensitive: boolean
    matchWholeWords: boolean
    regex: boolean
}

type EntryMatch = {
    active: boolean
    matchedKeys: string[]
    reason?: string
}

const POSITION_ORDER: Record<LorebookInsertionPosition, number> = {
    system: 0,
    before_context: 1,
    author_note: 2,
    after_context: 3,
}

function hasKey(value: Partial<LorebookEntry | LorebookEntryDraft>, key: keyof LorebookEntry): boolean {
    return Object.prototype.hasOwnProperty.call(value, key)
}

function matchKey(sample: string, key: string, options: MatchOptions): boolean {
    // Shares its key→regex compilation with the inline trigger scanner so the two
    // can never drift apart on escaping / whole-word / regex semantics.
    const regex = buildKeyRegex(key, options)
    return regex ? regex.test(sample || '') : false
}

function matchedKeys(sample: string, keys: string[], options: MatchOptions): string[] {
    return keys.filter((key) => matchKey(sample, key, options))
}

function allKeysMatched(keys: string[], matched: string[]): boolean {
    return keys.length > 0 && keys.every((key) => matched.includes(key))
}

function entryMatchOptions(lorebook: Lorebook | LorebookDraft, entry: LorebookEntry | LorebookEntryDraft): MatchOptions {
    return {
        caseSensitive: hasKey(entry, 'caseSensitive') ? entry.caseSensitive : lorebook.settings.caseSensitive,
        matchWholeWords: hasKey(entry, 'matchWholeWords') ? entry.matchWholeWords : lorebook.settings.matchWholeWords,
        regex: entry.regex,
    }
}

function evaluateEntryMatch(lorebook: Lorebook | LorebookDraft, entry: LorebookEntry | LorebookEntryDraft, sample: string): EntryMatch {
    if (!entry.enabled) return { active: false, matchedKeys: [], reason: 'Entry disabled.' }
    if (entry.constant) return { active: true, matchedKeys: ['constant'] }

    const options = entryMatchOptions(lorebook, entry)
    const primary = matchedKeys(sample, entry.keys, options)
    const secondary = matchedKeys(sample, entry.secondaryKeys, options)
    const primaryAny = primary.length > 0
    const primaryAll = allKeysMatched(entry.keys, primary)
    const secondaryAny = secondary.length > 0
    const secondaryAll = allKeysMatched(entry.secondaryKeys, secondary)
    const primaryGate = entry.selectiveLogic === 'all' ? primaryAll : primaryAny

    let active = false
    switch (entry.selectiveLogic) {
        case 'all':
            active = primaryAll
            break
        case 'and_any':
            active = primaryGate && secondaryAny
            break
        case 'and_all':
            active = primaryGate && secondaryAll
            break
        case 'not_any':
            active = primaryGate && !secondaryAny
            break
        case 'not_all':
            active = primaryGate && !secondaryAll
            break
        case 'any':
        default:
            active = primaryAny
            break
    }

    const matched = [...primary, ...secondary]
    if (active && entry.isSecret && entry.revealCondition?.trim()) {
        const revealed = matchKey(sample, entry.revealCondition, {
            ...options,
            regex: false,
            matchWholeWords: false,
        })
        if (!revealed) {
            return { active: false, matchedKeys: matched, reason: 'Reveal condition not met.' }
        }
        matched.push(entry.revealCondition)
    }

    return {
        active,
        matchedKeys: matched,
        reason: active ? undefined : 'No key matched the sample text.',
    }
}

function sortEntriesForPrompt(entries: Array<{ entry: LorebookEntry | LorebookEntryDraft; result: LoreActivationResult }>) {
    return [...entries].sort((a, b) => {
        const positionDelta = POSITION_ORDER[a.entry.insertionPosition] - POSITION_ORDER[b.entry.insertionPosition]
        if (positionDelta !== 0) return positionDelta
        const orderDelta = a.entry.insertionOrder - b.entry.insertionOrder
        if (orderDelta !== 0) return orderDelta
        return b.entry.priority - a.entry.priority
    })
}

export function validateLorebookLocally(lorebook: Lorebook | LorebookDraft): LorebookIssue[] {
    const issues: LorebookIssue[] = []
    const entries = lorebook.entries ?? []
    const resources = lorebookResourcesFromMetadata(lorebook.metadata)
    if (!lorebook.name.trim()) {
        issues.push({ severity: 'error', code: 'name_required', message: 'Name the lorebook before saving.' })
    }
    if (lorebook.settings.scanDepth < 1) {
        issues.push({ severity: 'error', code: 'scan_depth_invalid', message: 'Scan depth must be at least 1.' })
    }
    if (lorebook.settings.tokenBudget < 100) {
        issues.push({ severity: 'error', code: 'token_budget_invalid', message: 'Token budget must be at least 100.' })
    }
    if (entries.length === 0 && !lorebookHasResourceContent(lorebook)) {
        issues.push({ severity: 'warning', code: 'empty_book', message: 'Add at least one entry so the book can activate.' })
    }
    const invalidResource = findInvalidLorebookResource(resources)
    if (invalidResource?.type === 'count') {
        issues.push({ severity: 'error', code: 'resource_count_invalid', message: `Lorebooks can include up to ${LOREBOOK_RESOURCE_MAX_RESOURCES} resources.` })
    } else if (invalidResource?.type === 'size') {
        issues.push({
            severity: 'error',
            code: 'resource_size_invalid',
            message: `${invalidResource.resource.fileName} is over ${LOREBOOK_RESOURCE_MAX_CHARS} characters.`,
        })
    } else if (invalidResource?.type === 'triggers') {
        issues.push({
            severity: 'error',
            code: 'resource_triggers_invalid',
            message: `${invalidResource.resource.fileName} has more than ${LOREBOOK_RESOURCE_MAX_TRIGGERS} resource triggers.`,
        })
    } else if (invalidResource?.type === 'fileType') {
        issues.push({
            severity: 'error',
            code: 'resource_file_type_invalid',
            message: `${invalidResource.resource.fileName} must be a .md or .txt file.`,
        })
    }
    const seenKeys = new Map<string, string>()
    for (const entry of entries) {
        const title = entry.title.trim() || 'Untitled entry'
        const entryId = (entry as Partial<LorebookEntry>).id
        if (!entry.content.trim()) {
            issues.push({ severity: 'error', code: 'entry_content_required', message: `${title} needs prompt content.`, messageParams: { title }, entryId })
        }
        if (!entry.constant && entry.keys.length === 0) {
            issues.push({ severity: 'warning', code: 'entry_keys_missing', message: `${title} needs activation keys or constant mode.`, messageParams: { title }, entryId })
        }
        if (estimateTokens(entry.content) > 220) {
            issues.push({ severity: 'warning', code: 'entry_long', message: `${title} is long enough to pressure context budget.`, messageParams: { title }, entryId })
        }
        if (entry.regex) {
            for (const key of [...entry.keys, ...entry.secondaryKeys]) {
                try {
                    new RegExp(key)
                } catch {
                    issues.push({ severity: 'error', code: 'entry_regex_invalid', message: `"${key}" is not a valid regular expression.`, messageParams: { key }, entryId })
                }
            }
        }
        if (entry.isSecret && !entry.revealCondition?.trim()) {
            issues.push({ severity: 'warning', code: 'entry_reveal_missing', message: `${title} is secret but has no reveal condition.`, messageParams: { title }, entryId })
        }
        if (entry.tokenBudget !== null && entry.tokenBudget !== undefined && entry.tokenBudget < 1) {
            issues.push({ severity: 'error', code: 'entry_token_budget_invalid', message: `${title} has an invalid entry token cap.`, messageParams: { title }, entryId })
        }
        for (const key of entry.keys) {
            const normalized = key.toLowerCase()
            if (normalized.length <= 2) {
                issues.push({ severity: 'warning', code: 'entry_key_short', message: `"${key}" is likely too broad to be a reliable key.`, messageParams: { key }, entryId })
            }
            const previous = seenKeys.get(normalized)
            if (previous && previous !== title) {
                issues.push({ severity: 'warning', code: 'duplicate_key', message: `"${key}" is shared by ${previous} and ${title}.`, messageParams: { key, previous, title }, entryId })
            } else {
                seenKeys.set(normalized, title)
            }
        }
    }
    return issues
}

export function previewLocally(lorebook: Lorebook | LorebookDraft, sample: string): LoreActivationPreviewResponse {
    const includeBook = lorebook.enabled
    const results: LoreActivationResult[] = []
    const activatedEntries: Array<{ entry: LorebookEntry | LorebookEntryDraft; result: LoreActivationResult }> = []
    let searchText = sample
    let usedTokens = 0
    const maxPasses = lorebook.settings.recursiveScanning ? Math.max(1, lorebook.settings.scanDepth) : 1
    const manualEntries = lorebook.entries ?? []
    const entries = 'id' in lorebook
        ? [...manualEntries, ...lorebookResourceActivationEntries(lorebook)]
        : manualEntries
    const activatedIds = new Set<string>()

    for (let pass = 0; pass < maxPasses; pass += 1) {
        let changed = false
        const activatedThisPass: Array<LorebookEntry | LorebookEntryDraft> = []
        for (const entry of entries) {
            const entryId = (entry as Partial<LorebookEntry>).id ?? entry.title
            if (activatedIds.has(entryId)) continue
            const tokens = estimateTokens(entry.content)
            let match: EntryMatch = includeBook
                ? evaluateEntryMatch(lorebook, entry, searchText)
                : { active: false, matchedKeys: [], reason: 'Lorebook disabled.' }
            if (match.active && entry.tokenBudget !== null && entry.tokenBudget !== undefined && tokens > entry.tokenBudget) {
                match = { active: false, matchedKeys: match.matchedKeys, reason: 'Entry exceeds its token cap.' }
            }
            if (match.active && usedTokens + tokens > lorebook.settings.tokenBudget) {
                match = { active: false, matchedKeys: match.matchedKeys, reason: 'Lorebook token budget exhausted.' }
            }
            if (!match.active && pass > 0 && match.matchedKeys.length === 0) continue
            const result: LoreActivationResult = {
                entryId,
                lorebookId: 'id' in lorebook ? lorebook.id : 'draft',
                title: entry.title || 'Untitled entry',
                matchedKeys: match.matchedKeys,
                status: match.active ? 'activated' : 'skipped',
                reason: match.reason,
                estimatedTokens: tokens,
                insertionOrder: entry.insertionOrder,
                priority: entry.priority,
            }
            if (pass === 0) {
                results.push(result)
            } else {
                const index = results.findIndex((candidate) => candidate.entryId === entryId)
                if (index >= 0) results[index] = result
            }
            if (match.active) {
                activatedIds.add(entryId)
                activatedEntries.push({ entry, result })
                activatedThisPass.push(entry)
                usedTokens += tokens
                changed = true
            }
        }
        if (!lorebook.settings.recursiveScanning || !changed) break
        searchText = `${searchText}\n\n${activatedThisPass.map((entry) => entry.content).join('\n\n')}`
    }

    for (const entry of entries) {
        const entryId = (entry as Partial<LorebookEntry>).id ?? entry.title
        if (results.some((result) => result.entryId === entryId)) continue
        results.push({
            entryId,
            lorebookId: 'id' in lorebook ? lorebook.id : 'draft',
            title: entry.title || 'Untitled entry',
            matchedKeys: [],
            status: 'skipped',
            reason: includeBook ? 'No key matched the sample text.' : 'Lorebook disabled.',
            estimatedTokens: estimateTokens(entry.content),
            insertionOrder: entry.insertionOrder,
            priority: entry.priority,
        })
    }
    const activated = results.filter((result) => result.status === 'activated')
    return {
        targetKind: 'global',
        activeAttachments: [],
        results,
        totalEstimatedTokens: activated.reduce((sum, result) => sum + result.estimatedTokens, 0),
        tokenBudget: lorebook.settings.tokenBudget,
        promptPreview: sortEntriesForPrompt(activatedEntries).map(({ entry }) => entry.content).filter(Boolean).join('\n\n'),
        issues: validateLorebookLocally(lorebook),
    }
}
