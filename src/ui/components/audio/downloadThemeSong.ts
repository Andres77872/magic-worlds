import { downloadBlob, safeFilename } from '@/utils/download'
import { getAudioBlob } from './audioData'

interface DownloadThemeSongArgs {
    url: string
    title?: string | null
    fallbackName?: string | null
    extension?: string | null
}

function audioExtension(value?: string | null): string {
    const cleaned = value?.trim().replace(/^\.+/, '').toLowerCase().replace(/[^a-z0-9]+/g, '')
    return cleaned || 'mp3'
}

export async function downloadThemeSong({
    url,
    title,
    fallbackName,
    extension,
}: DownloadThemeSongArgs): Promise<void> {
    const blob = await getAudioBlob(url)
    const name = title?.trim() || fallbackName?.trim() || 'theme'
    downloadBlob(blob, `${safeFilename(name, 'theme')}.${audioExtension(extension)}`)
}
