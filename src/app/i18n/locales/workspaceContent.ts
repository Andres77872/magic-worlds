/**
 * Workspace R1 copy for the content features (creators, card assistant,
 * lorebooks, Story Studio / Codex, media gallery). Sentence case.
 */
export const workspaceContentEn = {
    codex: {
        collectionLabel: 'Collection',
        allCards: 'All cards',
        loadMore: 'Load more',
        loadFailed: 'Could not load your cards.',
        showing: 'Showing {{shown}} of {{total}}',
    },
    media: {
        themeTitleFallback: 'Theme song',
    },
    destination: {
        label: 'Will be saved in {{workspace}} / {{collection}}',
        root: 'Library',
        unknownWorkspace: 'this workspace',
        unknownCollection: 'a collection',
    },
    organizationWarnings: {
        collectionRemoved_one: 'Saved in the library. The collection it was going into was deleted, so it is not in that collection.',
        collectionRemoved_other: 'Saved in the library. {{count}} collections it was going into were deleted, so it is not in them.',
    },
    saveErrors: {
        collectionMissing: 'The collection this card was going into no longer exists. Go back to the library and choose where to save it.',
        archived: 'This workspace is archived. Restore it to create or edit content.',
    },
}

export const workspaceContentEs: typeof workspaceContentEn = {
    codex: {
        collectionLabel: 'Colección',
        allCards: 'Todas las cartas',
        loadMore: 'Cargar más',
        loadFailed: 'No se pudieron cargar tus cartas.',
        showing: 'Mostrando {{shown}} de {{total}}',
    },
    media: {
        themeTitleFallback: 'Tema musical',
    },
    destination: {
        label: 'Se guardará en {{workspace}} / {{collection}}',
        root: 'Biblioteca',
        unknownWorkspace: 'este espacio de trabajo',
        unknownCollection: 'una colección',
    },
    organizationWarnings: {
        collectionRemoved_one: 'Se guardó en la biblioteca. La colección a la que iba se eliminó, así que no está en esa colección.',
        collectionRemoved_other: 'Se guardó en la biblioteca. Se eliminaron {{count}} colecciones a las que iba, así que no está en ellas.',
    },
    saveErrors: {
        collectionMissing: 'La colección a la que iba esta carta ya no existe. Vuelve a la biblioteca y elige dónde guardarla.',
        archived: 'Este espacio de trabajo está archivado. Restáuralo para crear o editar contenido.',
    },
}
