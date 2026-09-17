/** Coalesce expensive view updates without delaying terminal transitions. */
export function frameBatch<T>(apply: (items: T[]) => void) {
    let frame: number | undefined
    let pending: T[] = []
    const flush = () => {
        if (frame !== undefined) cancelAnimationFrame(frame)
        frame = undefined
        if (!pending.length) return
        const items = pending
        pending = []
        apply(items)
    }
    return {
        push(item: T) {
            pending.push(item)
            if (frame === undefined) frame = requestAnimationFrame(flush)
        },
        flush,
        cancel() {
            if (frame !== undefined) cancelAnimationFrame(frame)
            frame = undefined
            pending = []
        },
    }
}
