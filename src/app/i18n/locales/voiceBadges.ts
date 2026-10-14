/**
 * Voice badges and notices (`voices.badge.*`, `voices.notice.*`; R1-FE-03).
 * Badge keys equal the BFF badge values (03 §5.12), so
 * t(`voices.badge.${badge}`) maps `effective_voice.badges[]` directly. en copy
 * follows 09 §5.1 and 05 §9.3; es drafts follow 05 §9.3 and await LOC review.
 */
export const voiceBadgesEn = {
    leaving: 'Leaving on {{date}}',
    leaving_soon: 'Leaving soon',
    needs_reselect: 'Voice needs re-selection',
    review: 'Review this voice: some settings changed',
    retired: 'Retired: pick another anytime',
    replaced: 'Voice replaced',
    replaced_tooltip: '{{original}} isn’t available; using {{name}}',
    replaced_tooltip_generic: 'The chosen voice isn’t available, so a similar voice is used.',
    call_voice: 'Call voice: {{name}}',
    locked: 'Locked',
    locked_hint: 'Upgrade to pick this voice',
    /** 03 §5.12: the `locked` badge names the plan that unlocks the voice (`min_plan`). */
    locked_plus: 'Plus',
    locked_pro: 'Pro',
    /** Screen-reader text of a plan-named lock (the lock icon never carries meaning alone). */
    locked_plan_sr: 'Locked: requires {{plan}}',
    expressive_only: 'Expressive',
    standard_fallback: 'Standard voice',
    standard_fallback_tooltip: 'Expressive wasn’t available for this reply',
    not_tested_language: 'Not tested in {{language}}',
    house_voice: 'House voice',
    daily_limit: 'Daily voice limit reached. Narration resumes tomorrow.',
    previews_left_one: '{{count}} preview left today',
    previews_left_other: '{{count}} previews left today',
}

export const voiceBadgesEs = {
    leaving: 'Se retira el {{date}}',
    leaving_soon: 'Se retira pronto',
    needs_reselect: 'Vuelve a elegir la voz',
    review: 'Revisa esta voz: cambiaron algunos ajustes',
    retired: 'Retirada: elige otra cuando quieras',
    replaced: 'Voz reemplazada',
    replaced_tooltip: '{{original}} no está disponible; se usa {{name}}',
    replaced_tooltip_generic: 'La voz elegida no está disponible, así que se usa una voz parecida.',
    call_voice: 'Voz de llamada: {{name}}',
    locked: 'Bloqueada',
    locked_hint: 'Mejora tu plan para elegir esta voz',
    locked_plus: 'Plus',
    locked_pro: 'Pro',
    locked_plan_sr: 'Bloqueada: requiere {{plan}}',
    expressive_only: 'Expresiva',
    standard_fallback: 'Voz estándar',
    standard_fallback_tooltip: 'La voz expresiva no estaba disponible para esta respuesta',
    not_tested_language: 'Sin probar en {{language}}',
    house_voice: 'Voz de la casa',
    daily_limit: 'Alcanzaste el límite diario de voz. La narración se reanuda mañana.',
    previews_left_one: 'Te queda {{count}} vista previa hoy',
    previews_left_other: 'Te quedan {{count}} vistas previas hoy',
}

/**
 * The 05 §7.8 one-click owner prompts next to `leaving`, `needs_reselect` and
 * `retired`, at the 05 §9.3 path `voices.prompt.*` (en.ts/es.ts spread them as
 * `voices.prompt`; the components read the prefix from `VOICE_PROMPT_KEYS`).
 */
export const voicePromptEn = {
    switchTo: 'Switch to {{name}}',
    chooseVoice: 'Choose a voice',
    keepForNow: 'Keep for now',
    pickAnother: 'Pick another',
}

export const voicePromptEs = {
    switchTo: 'Cambiar a {{name}}',
    chooseVoice: 'Elegir una voz',
    keepForNow: 'Mantener por ahora',
    pickAnother: 'Elegir otra',
}

export const voiceNoticesEn = {
    first_exposure: 'Voices have a new engine. We picked the closest match for your existing voices; you can change them anytime.',
    first_exposure_dismiss: 'Got it',
    /** 05 §10 Notices: the banner is a region named by this heading; its dismiss button names what it dismisses (and keeps its visible label). */
    first_exposure_title: 'New voice engine',
    first_exposure_dismissLabel: 'Got it, dismiss the new voice engine notice',
    language_scope: 'Voices are tuned for English and Spanish; other languages may sound less natural.',
    substituted: 'Plays as {{name}}',
    reviewFlag: 'This voice used settings the new voice engine doesn’t support. Listen and adjust, or pick another voice.',
    reviewFlagDetail: {
        pitch_dropped: 'Pitch is no longer applied.',
        vol_dropped: 'Volume is no longer applied.',
        speed_clamped: 'Speed was moved into the supported range.',
        needs_review: 'A default voice was picked for you. Choose the one you want.',
    },
    /** 05 §10 Notices: the notice is a region named by this heading (with the record's name in a list). */
    reviewFlagHeading: 'Review this voice',
    reviewFlagHeadingFor: 'Review this voice: {{name}}',
    reviewFlagAdjust: 'Adjust',
    reviewFlagDismiss: 'Dismiss',
    /** The Dismiss button's accessible name (05 §10: "Dismiss review notice for Gruff mentor"). */
    reviewFlagDismissLabel: 'Dismiss review notice',
    reviewFlagDismissFor: 'Dismiss review notice for {{name}}',
    reviewFlagDismissFailed: 'Could not dismiss this notice. Try again.',
    /** 05 §7.8: "[▶ Listen] [Adjust] [Dismiss]"; Listen plays the voice's free catalog sample (aria-pressed while it plays). */
    reviewFlagListen: 'Listen',
    /** The Listen button's accessible name in a list of notices (05 §10: it names the record). */
    reviewFlagListenFor: 'Listen to {{name}}',
    /**
     * 05 §10 Audio controls: once Listen has resolved the voice, its name also says the voice and the
     * sample's language ("Listen to Lyra: Maren, English"), keeping the visible word.
     */
    reviewFlagListenVoice: 'Listen: {{voice}}',
    reviewFlagListenVoiceFor: 'Listen to {{name}}: {{voice}}',
    reviewFlagVoiceIn: '{{voice}}, {{language}}',
    /** A record name that repeats in a list of notices is numbered, so each region and button name is distinct. */
    reviewFlagNumbered: '{{name}} ({{n}})',
}

export const voiceNoticesEs = {
    first_exposure: 'Las voces tienen un nuevo motor. Elegimos la opción más parecida para tus voces actuales; puedes cambiarlas cuando quieras.',
    first_exposure_dismiss: 'Entendido',
    first_exposure_title: 'Nuevo motor de voz',
    first_exposure_dismissLabel: 'Entendido, descartar el aviso del nuevo motor de voz',
    language_scope: 'Las voces están afinadas para inglés y español; en otros idiomas pueden sonar menos naturales.',
    substituted: 'Suena como {{name}}',
    reviewFlag: 'Esta voz usaba ajustes que el nuevo motor de voz no admite. Escúchala y ajústala, o elige otra voz.',
    reviewFlagDetail: {
        pitch_dropped: 'El tono ya no se aplica.',
        vol_dropped: 'El volumen ya no se aplica.',
        speed_clamped: 'La velocidad se ajustó al rango admitido.',
        needs_review: 'Se eligió una voz predeterminada. Elige la que prefieras.',
    },
    reviewFlagHeading: 'Revisa esta voz',
    reviewFlagHeadingFor: 'Revisa esta voz: {{name}}',
    reviewFlagAdjust: 'Ajustar',
    reviewFlagDismiss: 'Descartar',
    reviewFlagDismissLabel: 'Descartar el aviso de revisión',
    reviewFlagDismissFor: 'Descartar el aviso de revisión de {{name}}',
    reviewFlagDismissFailed: 'No se pudo descartar este aviso. Inténtalo de nuevo.',
    reviewFlagListen: 'Escuchar',
    reviewFlagListenFor: 'Escuchar {{name}}',
    reviewFlagListenVoice: 'Escuchar: {{voice}}',
    reviewFlagListenVoiceFor: 'Escuchar {{name}}: {{voice}}',
    reviewFlagVoiceIn: '{{voice}}, {{language}}',
    reviewFlagNumbered: '{{name}} ({{n}})',
}
