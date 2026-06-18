import type { Lorebook, LorebookEntry, LorebookResource, LorebookResourceExtraction, LorebookResourceSnippet } from '@/shared'
import { makeRequestId } from '@/utils/uuid'

export const LOREBOOK_RESOURCE_MAX_CHARS = 80_000
export const LOREBOOK_RESOURCE_MAX_RESOURCES = 24
export const LOREBOOK_RESOURCE_MAX_TRIGGERS = 24
export const LOREBOOK_RESOURCE_ACCEPT = '.md,.txt,text/markdown,text/plain'

type Raw = Record<string, unknown>
export type LorebookResourceValidationError =
    | { type: 'count' }
    | { type: 'size' | 'fileType' | 'triggers'; resource: LorebookResource }

export interface LorebookResourceStats {
    total: number
    completed: number
    pending: number
    failed: number
    snippets: number
    keywords: number
}

function isRecord(value: unknown): value is Raw {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function stringValue(value: unknown, fallback = ''): string {
    return typeof value === 'string' ? value : fallback
}

function maybeString(value: unknown): string | null {
    return typeof value === 'string' && value.trim() ? value : null
}

function stringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return []
    return value.map((item) => (typeof item === 'string' ? item.trim() : '')).filter(Boolean)
}

function maybeBool(value: unknown): boolean | undefined {
    return typeof value === 'boolean' ? value : undefined
}

export function lorebookResourceFileTypeFromName(fileName: string): 'md' | 'txt' {
    return fileName.toLowerCase().endsWith('.md') ? 'md' : 'txt'
}

export function isAllowedResourceFile(file: File): boolean {
    const name = file.name.toLowerCase()
    return name.endsWith('.md') || name.endsWith('.txt')
}

export function resourceTitleFromFileName(fileName: string): string {
    return fileName.trim() || 'Untitled resource'
}

export function newLorebookResource(fileName: string, content: string): LorebookResource {
    return {
        id: makeRequestId('resource'),
        title: resourceTitleFromFileName(fileName),
        description: '',
        triggers: [],
        fileName,
        fileType: lorebookResourceFileTypeFromName(fileName),
        content,
        contentLength: content.length,
        extractionStatus: 'pending',
        extraction: null,
    }
}

export function nextLorebookResourceFileName(resources: LorebookResource[], fileType: 'md' | 'txt'): string {
    const extension = fileType === 'md' ? 'md' : 'txt'
    const used = new Set(resources.map((resource) => resource.fileName.toLowerCase()))
    const base = `resource.${extension}`
    if (!used.has(base)) return base
    for (let index = 2; index < 1000; index += 1) {
        const candidate = `resource-${index}.${extension}`
        if (!used.has(candidate)) return candidate
    }
    return `${makeRequestId('resource')}.${extension}`
}

function normalizeSnippet(raw: unknown): LorebookResourceSnippet | null {
    if (!isRecord(raw)) return null
    const content = stringValue(raw.content).trim()
    if (!content) return null
    return {
        id: maybeString(raw.id) ?? undefined,
        title: stringValue(raw.title, 'Resource snippet').trim() || 'Resource snippet',
        content,
        triggers: stringArray(raw.triggers),
        source: maybeString(raw.source),
    }
}

function normalizeExtraction(raw: unknown): LorebookResourceExtraction | null {
    if (!isRecord(raw)) return null
    return {
        keywords: stringArray(raw.keywords),
        shortSummary: stringValue(raw.shortSummary ?? raw.short_summary),
        longSummary: stringValue(raw.longSummary ?? raw.long_summary),
        notes: stringArray(raw.notes),
        snippets: Array.isArray(raw.snippets) ? raw.snippets.map(normalizeSnippet).filter((snippet): snippet is LorebookResourceSnippet => Boolean(snippet)) : [],
        model: maybeString(raw.model) ?? undefined,
        schemaVersion: maybeString(raw.schemaVersion ?? raw.schema_version) ?? undefined,
        sourceHash: maybeString(raw.sourceHash ?? raw.source_hash) ?? undefined,
        updatedAt: maybeString(raw.updatedAt ?? raw.updated_at) ?? undefined,
    }
}

export function normalizeLorebookResource(raw: unknown): LorebookResource | null {
    if (!isRecord(raw)) return null
    const fileName = stringValue(raw.fileName ?? raw.file_name, 'resource.txt').trim() || 'resource.txt'
    const content = stringValue(raw.content)
    const status = stringValue(raw.extractionStatus ?? raw.extraction_status, 'pending')
    const rawLinkCount = raw.linkCount ?? raw.link_count
    const evaluationHash = maybeString(raw.evaluationHash ?? raw.evaluation_hash) ?? undefined
    const extraction = normalizeExtraction(raw.extraction)
    const metadataOutdated = maybeBool(raw.metadataOutdated ?? raw.metadata_outdated)
        ?? Boolean(extraction?.sourceHash && evaluationHash && extraction.sourceHash !== evaluationHash)
    return {
        id: stringValue(raw.id, makeRequestId('resource')),
        title: stringValue(raw.title, resourceTitleFromFileName(fileName)).trim() || resourceTitleFromFileName(fileName),
        description: maybeString(raw.description),
        triggers: stringArray(raw.triggers),
        fileName,
        fileType: lorebookResourceFileTypeFromName(fileName),
        content,
        contentLength: typeof raw.contentLength === 'number' ? raw.contentLength : typeof raw.content_length === 'number' ? raw.content_length : content.length,
        contentHash: maybeString(raw.contentHash ?? raw.content_hash) ?? undefined,
        evaluationHash,
        extractionStatus: status === 'completed' || status === 'failed' ? status : 'pending',
        extraction,
        metadataOutdated,
        linkCount: typeof rawLinkCount === 'number' ? rawLinkCount : undefined,
        createdAt: maybeString(raw.createdAt ?? raw.created_at) ?? undefined,
        updatedAt: maybeString(raw.updatedAt ?? raw.updated_at) ?? undefined,
    }
}

export function lorebookResourceCompletedExtraction(resource: LorebookResource): LorebookResourceExtraction | null {
    return resource.extractionStatus === 'completed' && resource.extraction ? resource.extraction : null
}

export function invalidateLorebookResourceExtraction(resource: LorebookResource, changes: Partial<LorebookResource>): LorebookResource {
    const next: LorebookResource = { ...resource, ...changes }
    if (typeof changes.content === 'string' && !Object.prototype.hasOwnProperty.call(changes, 'contentLength')) {
        next.contentLength = changes.content.length
    }
    const invalidatesExtraction = ['title', 'description', 'triggers', 'fileName', 'fileType', 'content'].some((key) => (
        Object.prototype.hasOwnProperty.call(changes, key)
    ))
    if (invalidatesExtraction) {
        if (resource.extractionStatus === 'completed' && resource.extraction) {
            next.extractionStatus = 'completed'
            next.extraction = resource.extraction
            next.metadataOutdated = true
        } else {
            next.extractionStatus = 'pending'
            next.extraction = null
            next.metadataOutdated = false
        }
    }
    return next
}

export function lorebookResourceToApiPayload(resource: LorebookResource): Record<string, unknown> {
    return {
        id: resource.id,
        title: resource.title,
        description: resource.description || null,
        triggers: resource.triggers,
        fileName: resource.fileName,
        fileType: resource.fileType,
        content: resource.content,
        contentLength: resource.contentLength ?? resource.content.length,
    }
}

export function lorebookResourcesFromMetadata(metadata: Record<string, unknown> | undefined): LorebookResource[] {
    return mergeLorebookResources(
        embeddedLorebookResourcesFromMetadata(metadata),
        sharedLorebookResourcesFromMetadata(metadata),
    )
}

export function embeddedLorebookResourcesFromMetadata(metadata: Record<string, unknown> | undefined): LorebookResource[] {
    const resources = metadata?.resources
    if (!Array.isArray(resources)) return []
    return resources
        .map(normalizeLorebookResource)
        .filter((resource): resource is LorebookResource => Boolean(resource))
}

export function sharedLorebookResourcesFromMetadata(metadata: Record<string, unknown> | undefined): LorebookResource[] {
    const resources = metadata?.sharedResources
    if (!Array.isArray(resources)) return []
    return resources
        .map(normalizeLorebookResource)
        .filter((resource): resource is LorebookResource => Boolean(resource))
}

export function lorebookResourceIdsFromMetadata(metadata: Record<string, unknown> | undefined): string[] {
    const raw = metadata?.resourceIds
    if (!Array.isArray(raw)) return sharedLorebookResourcesFromMetadata(metadata).map((resource) => resource.id)
    return raw.map((item) => (typeof item === 'string' ? item : '')).filter(Boolean)
}

export function mergeLorebookResources(...groups: LorebookResource[][]): LorebookResource[] {
    const merged: LorebookResource[] = []
    const seen = new Set<string>()
    for (const group of groups) {
        for (const resource of group) {
            const key = resource.id || `${resource.fileName}:${resource.title}`
            if (seen.has(key)) continue
            seen.add(key)
            merged.push(resource)
        }
    }
    return merged
}

export function stripHydratedLorebookResourceMetadata(metadata: Record<string, unknown> | undefined): Record<string, unknown> {
    const next = { ...(metadata ?? {}) }
    delete next.sharedResources
    delete next.resourceIds
    return next
}

export function withLorebookResources(metadata: Record<string, unknown> | undefined, resources: LorebookResource[]): Record<string, unknown> {
    return {
        ...(metadata ?? {}),
        resources,
    }
}

export function findInvalidLorebookResource(resources: LorebookResource[]): LorebookResourceValidationError | null {
    if (resources.length > LOREBOOK_RESOURCE_MAX_RESOURCES) return { type: 'count' }
    const oversized = resources.find((resource) => resource.content.length > LOREBOOK_RESOURCE_MAX_CHARS)
    if (oversized) return { type: 'size', resource: oversized }
    const triggerHeavy = resources.find((resource) => resource.triggers.length > LOREBOOK_RESOURCE_MAX_TRIGGERS)
    if (triggerHeavy) return { type: 'triggers', resource: triggerHeavy }
    const invalid = resources.find((resource) => !resource.fileName.toLowerCase().endsWith('.md') && !resource.fileName.toLowerCase().endsWith('.txt'))
    if (invalid) return { type: 'fileType', resource: invalid }
    return null
}

export function validateLorebookResources(resources: LorebookResource[]): string | null {
    const invalid = findInvalidLorebookResource(resources)
    if (!invalid) return null
    if (invalid.type === 'count') return `Lorebooks can include up to ${LOREBOOK_RESOURCE_MAX_RESOURCES.toLocaleString()} resources.`
    if (invalid.type === 'triggers') return `${invalid.resource.title || invalid.resource.fileName} has more than ${LOREBOOK_RESOURCE_MAX_TRIGGERS.toLocaleString()} resource triggers.`
    return invalid.type === 'size'
        ? `${invalid.resource.title || invalid.resource.fileName} is over ${LOREBOOK_RESOURCE_MAX_CHARS.toLocaleString()} characters.`
        : `${invalid.resource.fileName} must be a .md or .txt file.`
}

export function lorebookResourceStats(resources: LorebookResource[]): LorebookResourceStats {
    return resources.reduce<LorebookResourceStats>((stats, resource) => {
        const status = resource.extractionStatus ?? 'pending'
        const extraction = resource.metadataOutdated ? null : lorebookResourceCompletedExtraction(resource)
        stats.total += 1
        if (status === 'completed' && !resource.metadataOutdated) stats.completed += 1
        else if (status === 'failed') stats.failed += 1
        else stats.pending += 1
        stats.snippets += extraction?.snippets.length ?? 0
        stats.keywords += extraction?.keywords.length ?? 0
        return stats
    }, { total: 0, completed: 0, pending: 0, failed: 0, snippets: 0, keywords: 0 })
}

export function lorebookHasResourceContent(lorebook: Lorebook | { metadata?: Record<string, unknown> }): boolean {
    return lorebookResourcesFromMetadata(lorebook.metadata).some((resource) => resource.content.trim().length > 0)
}

export function lorebookResourceSearchText(lorebook: Lorebook): string {
    return lorebookResourcesFromMetadata(lorebook.metadata).flatMap((resource) => {
        const extraction = lorebookResourceCompletedExtraction(resource)
        return [
            resource.title,
            resource.description ?? '',
            resource.fileName,
            ...resource.triggers,
            ...(extraction?.keywords ?? []),
            extraction?.shortSummary ?? '',
            extraction?.longSummary ?? '',
            ...(extraction?.notes ?? []),
            ...(extraction?.snippets.flatMap((snippet) => [
                snippet.title,
                snippet.content,
                snippet.source ?? '',
                ...snippet.triggers,
            ]) ?? []),
        ]
    }).join(' ')
}

export function lorebookResourceActivationEntries(lorebook: Lorebook): LorebookEntry[] {
    const resources = lorebookResourcesFromMetadata(lorebook.metadata)
    const entries: LorebookEntry[] = []
    for (const [resourceIndex, resource] of resources.entries()) {
        if (resource.extractionStatus !== 'completed' || !resource.extraction) continue
        const resourceId = resource.id || `resource-${resourceIndex}`
        const resourceTitle = resource.title || resource.fileName || 'Resource'
        const baseKeys = [...resource.triggers, ...resource.extraction.keywords].filter(Boolean)
        const summary = (resource.extraction.longSummary || resource.extraction.shortSummary || '').trim()
        if (summary) {
            entries.push(makeResourceEntry({
                lorebook,
                id: `resource:${resourceId}:summary`,
                title: `${resourceTitle} summary`,
                content: summary,
                keys: baseKeys,
                insertionOrder: 9000 + resourceIndex * 100,
                priority: -10,
                resourceId,
                source: resource.fileName,
            }))
        }
        for (const [snippetIndex, snippet] of resource.extraction.snippets.entries()) {
            const content = snippet.content.trim()
            if (!content) continue
            entries.push(makeResourceEntry({
                lorebook,
                id: `resource:${resourceId}:snippet:${snippet.id ?? snippetIndex}`,
                title: snippet.title || resourceTitle,
                content,
                keys: snippet.triggers.length > 0 ? snippet.triggers : baseKeys,
                insertionOrder: 9010 + resourceIndex * 100 + snippetIndex,
                priority: 0,
                resourceId,
                source: snippet.source ?? resource.fileName,
            }))
        }
    }
    return entries
}

function makeResourceEntry({
    lorebook,
    id,
    title,
    content,
    keys,
    insertionOrder,
    priority,
    resourceId,
    source,
}: {
    lorebook: Lorebook
    id: string
    title: string
    content: string
    keys: string[]
    insertionOrder: number
    priority: number
    resourceId: string
    source?: string | null
}): LorebookEntry {
    return {
        id,
        lorebookId: lorebook.id || 'draft',
        title,
        entryType: 'other',
        content,
        keys,
        secondaryKeys: [],
        selectiveLogic: 'any',
        enabled: true,
        constant: false,
        caseSensitive: false,
        matchWholeWords: true,
        regex: false,
        isSecret: false,
        revealCondition: null,
        insertionOrder,
        priority,
        insertionPosition: 'before_context',
        tokenBudget: null,
        metadata: { resourceId, resourceGenerated: true, source: source ?? null },
    }
}
