import type {
    LoreActivationPreviewRequest,
    Lorebook,
    LorebookAttachment,
    LorebookDraft,
    LorebookEntry,
    LorebookEntryDraft,
    LorebookResource,
    LorebookSettings,
} from '@/shared'

type RecordLike = Record<string, unknown>
type LorebookLike = Partial<Lorebook | LorebookDraft> & RecordLike
type EntryLike = Partial<LorebookEntry | LorebookEntryDraft> & RecordLike

const DEFAULT_SETTINGS: LorebookSettings = {
    scanDepth: 8,
    tokenBudget: 1200,
    recursiveScanning: false,
    matchWholeWords: true,
    caseSensitive: false,
}

function isRecord(value: unknown): value is RecordLike {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function settingsWire(settings?: Partial<LorebookSettings>): LorebookSettings {
    return {
        scanDepth: settings?.scanDepth ?? DEFAULT_SETTINGS.scanDepth,
        tokenBudget: settings?.tokenBudget ?? DEFAULT_SETTINGS.tokenBudget,
        recursiveScanning: settings?.recursiveScanning ?? DEFAULT_SETTINGS.recursiveScanning,
        matchWholeWords: settings?.matchWholeWords ?? DEFAULT_SETTINGS.matchWholeWords,
        caseSensitive: settings?.caseSensitive ?? DEFAULT_SETTINGS.caseSensitive,
    }
}

export function serializeLorebookResource(
    resource: Partial<LorebookResource> & RecordLike,
    { includeIdentity }: { includeIdentity: boolean },
): RecordLike {
    return {
        ...(includeIdentity && typeof resource.id === 'string' ? { id: resource.id } : {}),
        title: typeof resource.title === 'string' ? resource.title : null,
        description: typeof resource.description === 'string' && resource.description.trim() ? resource.description : null,
        triggers: Array.isArray(resource.triggers) ? resource.triggers : [],
        fileName: typeof resource.fileName === 'string' ? resource.fileName : 'resource.txt',
        fileType: resource.fileType === 'md' || resource.fileType === 'txt' ? resource.fileType : null,
        content: typeof resource.content === 'string' ? resource.content : '',
        contentLength: typeof resource.contentLength === 'number'
            ? resource.contentLength
            : typeof resource.content === 'string'
              ? resource.content.length
              : 0,
    }
}

function metadataWire(metadata: unknown): { resources: RecordLike[] } {
    const resources = isRecord(metadata) && Array.isArray(metadata.resources) ? metadata.resources : []
    return {
        resources: resources
            .filter(isRecord)
            .map((resource) => serializeLorebookResource(resource as Partial<LorebookResource> & RecordLike, { includeIdentity: true })),
    }
}

export function serializeLorebookEntry(
    entry: EntryLike,
    { includeIdentity }: { includeIdentity: boolean },
): RecordLike {
    const id = includeIdentity && typeof entry.id === 'string' && !entry.id.startsWith('draft-entry-')
        ? entry.id
        : undefined
    return {
        ...(id ? { id } : {}),
        title: entry.title ?? '',
        entryType: entry.entryType ?? 'other',
        content: entry.content ?? '',
        keys: entry.keys ?? [],
        secondaryKeys: entry.secondaryKeys ?? [],
        selectiveLogic: entry.selectiveLogic ?? 'any',
        enabled: entry.enabled ?? true,
        constant: entry.constant ?? false,
        caseSensitive: entry.caseSensitive ?? false,
        matchWholeWords: entry.matchWholeWords ?? true,
        regex: entry.regex ?? false,
        isSecret: entry.isSecret ?? false,
        revealCondition: entry.revealCondition || null,
        insertionOrder: entry.insertionOrder ?? 0,
        priority: entry.priority ?? 0,
        insertionPosition: entry.insertionPosition ?? 'before_context',
        tokenBudget: entry.tokenBudget ?? null,
    }
}

export function serializeLorebookDraft(
    lorebook: LorebookLike,
    { includeIdentity = false }: { includeIdentity?: boolean } = {},
): RecordLike {
    return {
        ...(includeIdentity && typeof lorebook.id === 'string' ? { id: lorebook.id } : {}),
        name: lorebook.name ?? '',
        description: lorebook.description || null,
        tags: lorebook.tags ?? [],
        enabled: lorebook.enabled ?? true,
        settings: settingsWire(lorebook.settings),
        metadata: metadataWire(lorebook.metadata),
        entries: Array.isArray(lorebook.entries)
            ? lorebook.entries.map((entry) => serializeLorebookEntry(entry as EntryLike, { includeIdentity: true }))
            : [],
    }
}

export function serializeLorebookSnapshot(lorebook: Lorebook): RecordLike {
    return {
        id: lorebook.id,
        name: lorebook.name,
        description: lorebook.description || null,
        tags: lorebook.tags,
        enabled: lorebook.enabled,
        settings: settingsWire(lorebook.settings),
        metadata: metadataWire(lorebook.metadata),
        entries: lorebook.entries.map((entry) => serializeLorebookEntry(entry as EntryLike, { includeIdentity: true })),
    }
}

export function serializeLorebookAttachment(
    attachment: Partial<LorebookAttachment> & RecordLike,
): RecordLike {
    return {
        ...(attachment.id ? { id: attachment.id } : {}),
        lorebookId: attachment.lorebookId,
        targetKind: attachment.targetKind ?? 'global',
        targetId: attachment.targetId ?? null,
        mode: attachment.mode ?? 'linked',
        snapshot: attachment.mode === 'snapshot' && attachment.snapshot
            ? serializeLorebookSnapshot(attachment.snapshot)
            : null,
    }
}

export function serializeActivationPreview(request: LoreActivationPreviewRequest): RecordLike {
    return {
        targetKind: request.targetKind,
        targetId: request.targetId ?? null,
        messages: request.messages.map(({ role, name, content }) => ({
            role,
            ...(name ? { name } : {}),
            content,
        })),
        includePromptPreview: request.includePromptPreview ?? false,
        ...(request.overrides
            ? {
                  overrides: {
                      ...(request.overrides.lorebookIds ? { lorebookIds: request.overrides.lorebookIds } : {}),
                      ...(request.overrides.lorebooks
                          ? { lorebooks: request.overrides.lorebooks.map(serializeLorebookSnapshot) }
                          : {}),
                      ...(request.overrides.scanDepth !== undefined ? { scanDepth: request.overrides.scanDepth } : {}),
                      ...(request.overrides.tokenBudget !== undefined ? { tokenBudget: request.overrides.tokenBudget } : {}),
                      includeDisabled: request.overrides.includeDisabled ?? false,
                  },
              }
            : {}),
    }
}
