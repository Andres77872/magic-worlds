/**
 * The voice console's place in the URL: `#/admin/voices?module=<module>`, and
 * on the catalog `&voice=<key>` for one voice's drawer (the Studio's root
 * "Manage" link). An unknown module opens the catalog.
 */
import type { ConsoleModule } from './components/shell/VoiceConsoleContext'

export const CONSOLE_MODULES: readonly ConsoleModule[] = ['catalog', 'create', 'acceptance', 'defaults', 'globalPresets', 'library', 'lab', 'metrics', 'reports']
/** The modules under the console's "Tools" tab. */
export const TOOL_MODULES: readonly ConsoleModule[] = ['defaults', 'globalPresets', 'library', 'lab', 'metrics', 'reports']

/** Where the URL asks the console to open: a module (else the catalog) and, on the catalog, a voice. */
export function consoleLocation(hash: string = window.location.hash): { module: ConsoleModule; voiceKey: string | null } {
    const params = new URLSearchParams(hash.split('?')[1] ?? '')
    const requested = params.get('module')
    const module = CONSOLE_MODULES.find((value) => value === requested) ?? 'catalog'
    return { module, voiceKey: module === 'catalog' ? params.get('voice') || null : null }
}
