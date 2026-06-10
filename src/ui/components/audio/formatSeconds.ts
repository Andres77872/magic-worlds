/** `95.4` → `"1:35"` — mm:ss for player readouts and aria-valuetext. */
export function formatSeconds(seconds: number): string {
    const total = Math.max(0, Math.round(seconds))
    const minutes = Math.floor(total / 60)
    const rest = total % 60
    return `${minutes}:${String(rest).padStart(2, '0')}`
}
