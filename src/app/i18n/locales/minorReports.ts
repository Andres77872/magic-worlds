/**
 * "Report a minor" copy (R2-BE-02 FE, 13 §3.4), spread top-level as
 * `minorReports.*`: the Contact-page form and, under `admin.*`, the root
 * review module of the voice console.
 *
 * The success copy never says whether anything happened to the reported
 * account. Legal wording for the Contact page (CN-9) replaces these lines when
 * counsel signs; nothing here is a legal placeholder.
 */
export const minorReportsEn = {
    title: 'Report a possible minor',
    intro: 'If you believe someone using Magic Worlds is under 18, tell us. Our team reviews every report.',
    subjectKind: {
        label: 'What are you reporting?',
        public_card: 'A public card',
        username: 'A username',
    },
    subjectRef: {
        label: 'Card ID or username',
        cardPlaceholder: 'The card’s ID',
        usernamePlaceholder: 'The username',
    },
    reason: {
        label: 'Reason',
        stated_age: 'They said they are under 18',
        content: 'Their content suggests they are under 18',
        other: 'Something else',
    },
    details: {
        label: 'Details (optional)',
        hint: 'Up to {{max}} characters. Don’t include your own personal information.',
    },
    submit: 'Send report',
    submitting: 'Sending…',
    success: {
        title: 'Thank you',
        body: 'We received your report.',
    },
    errors: {
        limit: 'You’ve reached today’s report limit. Try again tomorrow.',
        disabled: 'Reporting is turned off for your account.',
        invalid: 'Check the fields and try again.',
        generic: 'Your report couldn’t be sent. Try again in a moment.',
    },
    admin: {
        title: 'Minor reports',
        description: 'Reports that a user may be under 18. Review each one: unfounded and inconclusive lift any voice hold; escalated keeps voice off and flags the account.',
        empty: 'No reports to review.',
        loadMore: 'Load more',
        refresh: 'Refresh',
        loadFailed: 'Reports couldn’t be loaded.',
        reviewFailed: 'The review couldn’t be saved.',
        alreadyReviewed: 'This report was already reviewed.',
        filterStatus: 'Status',
        columns: {
            created: 'Reported',
            subject: 'Subject',
            reason: 'Reason',
            reporter: 'Reporter',
            eligible: 'Eligible reporter',
            hold: 'Voice hold',
            status: 'Status',
            actions: 'Review',
        },
        status: {
            open: 'Open',
            lifted: 'Lifted',
            escalated: 'Escalated',
            expired: 'Expired',
        },
        outcome: {
            unfounded: 'Unfounded',
            inconclusive: 'Inconclusive',
            escalated: 'Escalate',
        },
        hold: {
            none: 'No hold',
            active: 'Until {{time}}',
            lifted: 'Lifted',
        },
        eligible: {
            yes: 'Yes',
            no: 'No',
        },
        unresolved: 'Not matched to an account',
        details: 'Details',
        caption: 'Minor reports for review',
        reviewed: 'Review saved.',
        reviewing: 'Saving…',
        reviewedOutcome: 'Reviewed: {{outcome}}',
        escalateConfirm: {
            title: 'Escalate this report?',
            body: 'Escalating lifts the temporary hold and turns voice off for the reported account until an operator lifts the kill switch.',
            confirm: 'Escalate',
        },
    },
}

export const minorReportsEs: typeof minorReportsEn = {
    title: 'Denunciar a un posible menor',
    intro: 'Si crees que alguien que usa Magic Worlds es menor de 18 años, avísanos. Nuestro equipo revisa cada denuncia.',
    subjectKind: {
        label: '¿Qué quieres denunciar?',
        public_card: 'Una carta pública',
        username: 'Un nombre de usuario',
    },
    subjectRef: {
        label: 'ID de la carta o nombre de usuario',
        cardPlaceholder: 'El ID de la carta',
        usernamePlaceholder: 'El nombre de usuario',
    },
    reason: {
        label: 'Motivo',
        stated_age: 'Dijo que es menor de 18 años',
        content: 'Su contenido sugiere que es menor de 18 años',
        other: 'Otro motivo',
    },
    details: {
        label: 'Detalles (opcional)',
        hint: 'Hasta {{max}} caracteres. No incluyas tus propios datos personales.',
    },
    submit: 'Enviar denuncia',
    submitting: 'Enviando…',
    success: {
        title: 'Gracias',
        body: 'Recibimos tu denuncia.',
    },
    errors: {
        limit: 'Alcanzaste el límite de denuncias de hoy. Inténtalo de nuevo mañana.',
        disabled: 'Las denuncias están desactivadas para tu cuenta.',
        invalid: 'Revisa los campos e inténtalo de nuevo.',
        generic: 'No se pudo enviar tu denuncia. Inténtalo de nuevo en un momento.',
    },
    admin: {
        title: 'Denuncias de menores',
        description: 'Denuncias de que un usuario podría ser menor de 18 años. Revisa cada una: infundada e inconclusa levantan cualquier suspensión de voz; escalada mantiene la voz desactivada y marca la cuenta.',
        empty: 'No hay denuncias que revisar.',
        loadMore: 'Cargar más',
        refresh: 'Actualizar',
        loadFailed: 'No se pudieron cargar las denuncias.',
        reviewFailed: 'No se pudo guardar la revisión.',
        alreadyReviewed: 'Esta denuncia ya se revisó.',
        filterStatus: 'Estado',
        columns: {
            created: 'Denunciada',
            subject: 'Sujeto',
            reason: 'Motivo',
            reporter: 'Denunciante',
            eligible: 'Denunciante válido',
            hold: 'Suspensión de voz',
            status: 'Estado',
            actions: 'Revisión',
        },
        status: {
            open: 'Abierta',
            lifted: 'Levantada',
            escalated: 'Escalada',
            expired: 'Caducada',
        },
        outcome: {
            unfounded: 'Infundada',
            inconclusive: 'Inconclusa',
            escalated: 'Escalar',
        },
        hold: {
            none: 'Sin suspensión',
            active: 'Hasta {{time}}',
            lifted: 'Levantada',
        },
        eligible: {
            yes: 'Sí',
            no: 'No',
        },
        unresolved: 'No coincide con ninguna cuenta',
        details: 'Detalles',
        caption: 'Denuncias de menores pendientes de revisión',
        reviewed: 'Revisión guardada.',
        reviewing: 'Guardando…',
        reviewedOutcome: 'Revisada: {{outcome}}',
        escalateConfirm: {
            title: '¿Escalar esta denuncia?',
            body: 'Escalar levanta la suspensión temporal y desactiva la voz de la cuenta denunciada hasta que un operador levante el bloqueo.',
            confirm: 'Escalar',
        },
    },
}
