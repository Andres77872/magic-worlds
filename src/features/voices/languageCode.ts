/** Base ISO 639 code of a language tag (`es-MX` → `es`, `EN_us` → `en`), or null when it is not one. */
export function baseLanguageCode(value: string | null | undefined): string | null {
    const code = (value ?? '').trim().toLowerCase().split(/[-_]/)[0]
    return /^[a-z]{2,3}$/.test(code) ? code : null
}
