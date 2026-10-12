import { ApiError, apiService } from '@/infrastructure/api'
import type { LorebookResource } from '@/shared'
import { newLorebookResource, normalizeLorebookResource } from './lorebookResources'

/** PDFs become editable Markdown sources; their binary bytes stay out of JSON. */
export async function readLorebookResourceFile(file: File): Promise<LorebookResource> {
    if (file.name.toLowerCase().endsWith('.pdf')) {
        const imported = normalizeLorebookResource(await apiService.importLorebookResourcePdf(file))
        if (!imported || imported.fileType !== 'md') throw new Error('Invalid PDF import response.')
        return imported
    }
    return newLorebookResource(file.name, await file.text())
}

const pdfErrorKeys: Record<string, string> = {
    RESOURCE_EXTENSION_NOT_ALLOWED: 'uploadFileType',
    RESOURCE_MIME_NOT_ALLOWED: 'pdfInvalid',
    RESOURCE_FILE_TOO_LARGE: 'pdfTooLarge',
    RESOURCE_PDF_INVALID: 'pdfInvalid',
    RESOURCE_PDF_NO_TEXT: 'pdfNoText',
    RESOURCE_PDF_TEXT_TOO_LARGE: 'pdfTextTooLarge',
    RESOURCE_PDF_TOO_MANY_PAGES: 'pdfTooManyPages',
    RESOURCE_PDF_OCR_REQUIRED: 'pdfOcrRequired',
    RESOURCE_PDF_OCR_UNAVAILABLE: 'pdfOcrUnavailable',
    RESOURCE_PDF_ENCRYPTED: 'pdfEncrypted',
    RESOURCE_PDF_UNAVAILABLE: 'pdfUnavailable',
    RESOURCE_PDF_TIMEOUT: 'pdfTimeout',
    RESOURCE_PDF_BUSY: 'pdfBusy',
}

export function resourceFileErrorKey(error: unknown): string | null {
    const key = error instanceof ApiError && error.code ? pdfErrorKeys[error.code] : undefined
    return key ? `lorebookResourcesGallery.errors.${key}` : null
}
