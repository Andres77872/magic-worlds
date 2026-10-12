/** Workspace R1 rollout states (document 08 "Release compatibility and rollout UI"). */
export const workspacesEn = {
    unavailable: {
        title: 'Your library is unavailable while the service is updating',
        body: 'Your content is safe. This page tries again automatically.',
        retry: 'Try again',
        retrying: 'Trying again…',
    },
    stale: {
        title: 'This page is out of date',
        body: 'Reload to continue. Changes that were not saved before the update can’t be saved from this tab.',
        reload: 'Reload',
        dismiss: 'Not now',
    },
    hidden: {
        message: 'Some workspaces are temporarily unavailable. Their content is safe.',
    },
}

export const workspacesEs: typeof workspacesEn = {
    unavailable: {
        title: 'Tu biblioteca no está disponible mientras el servicio se actualiza',
        body: 'Tu contenido está a salvo. Esta página lo vuelve a intentar automáticamente.',
        retry: 'Reintentar',
        retrying: 'Reintentando…',
    },
    stale: {
        title: 'Esta página está desactualizada',
        body: 'Recarga para continuar. Los cambios que no se guardaron antes de la actualización no se pueden guardar desde esta pestaña.',
        reload: 'Recargar',
        dismiss: 'Ahora no',
    },
    hidden: {
        message: 'Algunos espacios de trabajo no están disponibles temporalmente. Su contenido está a salvo.',
    },
}
