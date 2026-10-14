/**
 * Audio file helpers shared by the voice screens (05 §2.2-§2.3, 09 §4): a
 * duration probe for the IVC sample check (R1-OPT-01), which validates sample
 * length before an upload. No screen calls it yet.
 */

/**
 * Read an audio file's duration in seconds via a metadata-only <audio> probe.
 * The probe object URL is always revoked. Rejects when metadata can't load
 * (callers treat that as a soft warning; the server re-validates anyway).
 */
export function readAudioDuration(file: File): Promise<number> {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file)
        const audio = document.createElement('audio')
        audio.preload = 'metadata'
        const cleanup = () => {
            audio.removeAttribute('src')
            URL.revokeObjectURL(url)
        }
        audio.addEventListener('loadedmetadata', () => {
            const { duration } = audio
            cleanup()
            if (Number.isFinite(duration) && duration > 0) resolve(duration)
            else reject(new Error('Could not read audio duration.'))
        })
        audio.addEventListener('error', () => {
            cleanup()
            reject(new Error('Could not read audio metadata.'))
        })
        audio.src = url
    })
}
