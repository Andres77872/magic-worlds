/**
 * Recipe-preview copy (`voices.preview.*`, D18, 05 §6.3–6.4 and §9.3): the
 * fixed-text chooser, the transcript, the "{n} previews left today" helper and
 * the preview errors. es drafts follow 05 §9.3 and await LOC review.
 */
export const voicePreviewEn = {
    error: 'Could not generate a preview.',
    textLabel: 'Preview text',
    textIds: {
        narration: 'Narration',
        dialogue: 'Dialogue',
        thought: 'Thought',
    },
    transcript: 'Transcript',
    previewsLeft_one: '{{count}} preview left today',
    previewsLeft_other: '{{count}} previews left today',
    limitReached: 'Daily preview limit reached. Previews reset tomorrow.',
    generating: 'Generating preview…',
    stop: 'Stop',
    rateLimited: 'Too many previews at once. Try again in a moment.',
    noCredits: 'Not enough credits for another preview.',
    unavailable: 'Preview is temporarily unavailable.',
    voiceUnavailable: 'This voice is not available right now.',
    freeSample: 'Free: voice sample',
    /** AC-P5, 05 §6.3 / §9.3: past the free renders the button reads "Preview · 1 credit", confirmed once a session. */
    costsCredit: '1 credit',
    confirmCreditTitle: 'Preview with credits?',
    confirmCredit: 'Previews now cost 1 credit each. Continue?',
    confirmCreditAction: 'Continue',
}

export const voicePreviewEs = {
    error: 'No se pudo generar una vista previa.',
    textLabel: 'Texto de prueba',
    textIds: {
        narration: 'Narración',
        dialogue: 'Diálogo',
        thought: 'Pensamiento',
    },
    transcript: 'Transcripción',
    previewsLeft_one: 'Te queda {{count}} vista previa hoy',
    previewsLeft_other: 'Te quedan {{count}} vistas previas hoy',
    limitReached: 'Alcanzaste el límite diario de vistas previas. Se restablecen mañana.',
    generating: 'Generando vista previa…',
    stop: 'Detener',
    rateLimited: 'Demasiadas vistas previas a la vez. Inténtalo de nuevo en un momento.',
    noCredits: 'No tienes créditos suficientes para otra vista previa.',
    unavailable: 'La vista previa no está disponible por ahora.',
    voiceUnavailable: 'Esta voz no está disponible ahora mismo.',
    freeSample: 'Gratis: muestra de voz',
    costsCredit: '1 crédito',
    confirmCreditTitle: '¿Usar créditos para escuchar?',
    confirmCredit: 'Ahora cada vista previa cuesta 1 crédito. ¿Continuar?',
    confirmCreditAction: 'Continuar',
}
