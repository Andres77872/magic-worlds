/** Deterministic JSON identity: object key order is irrelevant; array order is not. */
export function canonicalJson(value: unknown): string {
    return JSON.stringify(value, (_key, item) => {
        if (item && typeof item === 'object' && !Array.isArray(item)) {
            return Object.fromEntries(Object.keys(item).sort().map((key) => [key, item[key]]))
        }
        return item
    }) ?? 'undefined'
}
