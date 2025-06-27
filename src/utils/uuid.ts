/**
 * UUID generation utility with fallback support
 */

/**
 * Generates a UUID v4 string with fallback for environments without crypto.randomUUID
 */
export function generateUUID(): string {
    // Try to use the native crypto.randomUUID if available
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    
    // Fallback implementation using Math.random()
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
} 