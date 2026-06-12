/**
 * Client-side file download helpers — turn an in-memory Blob into a browser
 * "Save file" via a temporary object-URL anchor. Used by the media gallery to
 * download generated theme songs (and reusable for any future media export).
 */

/**
 * Make a string safe to use as a download filename: strips path separators and
 * characters Windows/macOS reject, collapses whitespace to single hyphens,
 * trims leading/trailing dots (hidden-file / extension confusion), and caps the
 * length. Falls back when nothing survives.
 */
export function safeFilename(name: string, fallback = 'audio'): string {
    const cleaned = name
        .replace(/[/\\?%*:|"<>]/g, ' ')
        .trim()
        .replace(/\s+/g, '-')
        .replace(/^\.+|\.+$/g, '')
        .slice(0, 80)
    return cleaned || fallback
}

/** Trigger a browser download of `blob` under `filename`. */
export function downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
}
