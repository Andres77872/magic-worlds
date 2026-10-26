/**
 * Choose the entire application before loading providers or backend clients.
 * Vite replaces this flag at build time; only the literal `true` enables it.
 */
export async function loadApplication() {
    if (import.meta.env.VITE_MAINTENANCE_MODE === 'true') {
        return import('@/features/maintenance/MaintenancePage')
    }

    // The normal locale bundles and authenticated app are unnecessary during
    // maintenance. Initialize translations before any regular UI can mount.
    const [, application] = await Promise.all([import('@/app/i18n'), import('@/app/App')])
    return application
}
