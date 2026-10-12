/** This explicit rejection happens before any extraction is admitted. */
export function isLorebookExtractionDisabled(error: unknown): boolean {
    return Boolean(error && typeof error === 'object'
        && (error as { code?: unknown }).code === 'LOREBOOK_EXTRACTION_DISABLED')
}

export function resourceExtractionErrorKey(error: unknown): string {
    if (isLorebookExtractionDisabled(error)) return 'lorebookResourcesGallery.errors.extractionDisabled'
    const value = error && typeof error === 'object' ? error as { code?: unknown; status?: unknown } : {}
    if (value.status === 0 || ['lorebook_extraction_unknown', 'lorebook_extraction_pending', 'lorebook_extraction_recovery_required'].includes(String(value.code))) {
        return 'lorebookResourcesGallery.errors.extractionAfterSave'
    }
    return 'lorebookResourcesGallery.errors.extractionFailed'
}
