/**
 * Workspace R1 copy for activity that outlives a workspace switch: chats and
 * calls bound to their session's workspace, background tasks, notifications,
 * the playlist and the app assistant (document 08 "Lifecycle and origin
 * interactions").
 */
export const workspaceActivityEn = {
    origin: {
        label: 'From {{name}}',
        unknown: 'From another workspace',
        aria: 'Origin workspace: {{name}}',
    },
    chat: {
        sessionUnavailable: 'This conversation is not available in this workspace.',
        workspaceArchived: 'This workspace is archived. Restore it to continue the conversation.',
        workspaceUnavailable: 'This conversation’s workspace is unavailable.',
        stale: 'This page is out of date. Reload to continue.',
    },
    call: {
        workspaceArchived: 'This workspace is archived. Restore it to call again.',
        workspaceUnavailable: 'This call’s workspace is unavailable.',
        stale: 'This page is out of date. Reload to continue.',
    },
    tasks: {
        openCard: 'Open card',
        openChat: 'Open chat',
        unavailable: 'This card’s workspace is unavailable.',
        targetUnavailable: 'This task’s workspace is unavailable.',
    },
    notifications: {
        unavailable: 'This item is no longer available. Its workspace may have been removed.',
    },
    assistant: {
        unavailable: 'This conversation’s workspace is unavailable.',
    },
    profile: {
        sharingScope: 'Cards shared from {{name}}.',
        unavailable: 'Shared cards are unavailable right now. Try again shortly.',
    },
}

export const workspaceActivityEs: typeof workspaceActivityEn = {
    origin: {
        label: 'De {{name}}',
        unknown: 'De otro espacio de trabajo',
        aria: 'Espacio de trabajo de origen: {{name}}',
    },
    chat: {
        sessionUnavailable: 'Esta conversación no está disponible en este espacio de trabajo.',
        workspaceArchived: 'Este espacio de trabajo está archivado. Restáuralo para continuar la conversación.',
        workspaceUnavailable: 'El espacio de trabajo de esta conversación no está disponible.',
        stale: 'Esta página está desactualizada. Recarga para continuar.',
    },
    call: {
        workspaceArchived: 'Este espacio de trabajo está archivado. Restáuralo para volver a llamar.',
        workspaceUnavailable: 'El espacio de trabajo de esta llamada no está disponible.',
        stale: 'Esta página está desactualizada. Recarga para continuar.',
    },
    tasks: {
        openCard: 'Abrir tarjeta',
        openChat: 'Abrir chat',
        unavailable: 'El espacio de trabajo de esta tarjeta no está disponible.',
        targetUnavailable: 'El espacio de trabajo de esta tarea no está disponible.',
    },
    notifications: {
        unavailable: 'Este elemento ya no está disponible. Es posible que se haya eliminado su espacio de trabajo.',
    },
    assistant: {
        unavailable: 'El espacio de trabajo de esta conversación no está disponible.',
    },
    profile: {
        sharingScope: 'Tarjetas compartidas desde {{name}}.',
        unavailable: 'Las tarjetas compartidas no están disponibles ahora. Inténtalo de nuevo en un momento.',
    },
}
