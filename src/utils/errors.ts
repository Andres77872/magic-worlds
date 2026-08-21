/**
 * One place to turn a thrown value into copy for the UI.
 *
 * This predicate was reimplemented byte-for-byte in five feature files under two
 * different names, so any change to how API failures are surfaced had to be
 * found in all five.
 */

/** The error's own message when it has one, else the caller's fallback. */
export function errorMessage(error: unknown, fallback: string): string {
    return error instanceof Error && error.message.trim() ? error.message : fallback
}
