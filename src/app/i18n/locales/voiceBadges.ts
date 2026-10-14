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
    language_scope: 'Voices are tuned for English and Spanish; other languages may sound less natural.',
    substituted: 'Plays as {{name}}',
}

export const voiceNoticesEs = {
    language_scope: 'Las voces están afinadas para inglés y español; en otros idiomas pueden sonar menos naturales.',
    substituted: 'Suena como {{name}}',
}
