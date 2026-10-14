/**
 * Companion safeguards copy (R2-BE-01 FE, 13 §2.7), spread top-level as
 * `voiceSafety.*`.
 *
 * Only generic, product-approved lines live here. Crisis-line names and
 * numbers are legal content: they stay as LEGAL_PENDING drafts in
 * `@/features/safety/crisisResources` and are never rendered until counsel
 * signs them (CN-7). Break-nudge copy is neutral: no guilt, no streaks.
 */
export const voiceSafetyEn = {
    title: 'Voice is paused',
    paused: 'Voice is paused for now. Text chat keeps working.',
    pausedRetry_one: 'Voice comes back in about {{count}} minute.',
    pausedRetry_other: 'Voice comes back in about {{count}} minutes.',
    emergency: 'If you are in danger or thinking about harming yourself, contact your local emergency services now.',
    resourcesTitle: 'Support',
    close: 'Close',
    narrationPaused: 'Narration is paused for now.',
    breakNudge: {
        title: 'Time for a break?',
        body: 'You’ve been using voice for a while. Taking a short break is a good idea.',
        dismiss: 'Dismiss',
    },
}

export const voiceSafetyEs: typeof voiceSafetyEn = {
    title: 'La voz está en pausa',
    paused: 'La voz está en pausa por ahora. El chat de texto sigue funcionando.',
    pausedRetry_one: 'La voz vuelve en aproximadamente {{count}} minuto.',
    pausedRetry_other: 'La voz vuelve en aproximadamente {{count}} minutos.',
    emergency: 'Si estás en peligro o piensas en hacerte daño, contacta ahora con los servicios de emergencia de tu zona.',
    resourcesTitle: 'Ayuda',
    close: 'Cerrar',
    narrationPaused: 'La narración está en pausa por ahora.',
    breakNudge: {
        title: '¿Un descanso?',
        body: 'Llevas un rato usando la voz. Tomarte un breve descanso es buena idea.',
        dismiss: 'Descartar',
    },
}
