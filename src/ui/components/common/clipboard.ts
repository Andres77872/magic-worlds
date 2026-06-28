export async function writeClipboardText(text: string): Promise<void> {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        try {
            await navigator.clipboard.writeText(text)
            return
        } catch (error) {
            if (typeof document === 'undefined') throw error
        }
    }

    if (typeof document === 'undefined') throw new Error('Clipboard unavailable')

    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.setAttribute('readonly', '')
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    const copied = document.execCommand('copy')
    textarea.remove()
    if (!copied) throw new Error('Clipboard copy failed')
}
