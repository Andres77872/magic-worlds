/** Require a provably newer head to remove a known archive. */
export function preferWorkspaceState(previous: { rowVersion?: number; archived: boolean }, incoming: { rowVersion?: number; archived: boolean }): boolean {
    if (previous.rowVersion === undefined) return !previous.archived || incoming.archived
    if (incoming.rowVersion === undefined) return false
    if (incoming.rowVersion !== previous.rowVersion) return incoming.rowVersion > previous.rowVersion
    return !previous.archived && incoming.archived
}
