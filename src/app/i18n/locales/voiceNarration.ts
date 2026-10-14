/**
 * Narration and call voice copy owned by R1-FE-04/05 (block H):
 * - `voices.refresh.*`: the "Voice replaced" refresh action, its states and errors
 *   (09 §5.1, 07 §5.1; U-10 for the busy conflict);
 * - `voices.sessionTier.*`: the per-session narration tier toggle (EP-1). The
 *   Standard and Expressive option labels reuse `voices.tier.*`;
 * - `voices.call.*`: the call header voice notes and the unsupported-audio
 *   fallback (07 §5.2).
 * Spread into en.ts and es.ts by the locale owner. es drafts await LOC review.
 */
export const voiceRefreshEn = {
    action: 'Use the card’s current voice',
    narratorAction: 'Change narrator voice',
    busy: 'Updating voice…',
    done: 'Voice updated. New replies use it.',
    busyConflict: 'Finish the current reply or call first.',
    // 409 voice_source_unavailable (D36/D39): the card was deleted, copied elsewhere or is in
    // another workspace (05 §7.8, 09 §2.2); `reason: no_voice` means the card has no voice.
    sourceUnavailable: 'The original card isn’t in this workspace anymore.',
    sourceNoVoice: 'The card’s voice isn’t available. Pick another voice on the card.',
    notEligible: 'This voice can’t be used for narration.',
    appliesNextCall: 'Applies from your next call.',
    // D36 header, cast menu and adventure cast menu (05 §7.8, 09 §4.4-4.5, AC-C6).
    regionLabel: 'Chat voice',
    cardChanged: 'Card voice changed',
    cardNow: 'The card now uses {{name}}.',
    cardNowGeneric: 'The card now uses a different voice.',
    castMenu: 'Voice options for {{name}}',
    castSummary_one: '{{count}} character sounds different from their card.',
    castSummary_other: '{{count}} characters sound different from their cards.',
    castOpen: 'Use the cards’ current voices',
    castLegend: 'Characters to update',
    castMember: 'Now {{current}} · card {{card}}',
    castApply_one: 'Update {{count}} voice',
    castApply_other: 'Update {{count}} voices',
    castRegionLabel: 'Cast voices',
}

export const voiceRefreshEs = {
    action: 'Usar la voz actual de la carta',
    narratorAction: 'Cambiar la voz del narrador',
    busy: 'Actualizando la voz…',
    done: 'Voz actualizada. Las nuevas respuestas la usan.',
    busyConflict: 'Termina primero la respuesta o la llamada en curso.',
    sourceUnavailable: 'La carta original ya no está en este espacio de trabajo.',
    sourceNoVoice: 'La voz de la carta no está disponible. Elige otra voz en la carta.',
    notEligible: 'Esta voz no se puede usar para la narración.',
    appliesNextCall: 'Se aplica desde tu próxima llamada.',
    regionLabel: 'Voz del chat',
    cardChanged: 'La voz de la carta cambió',
    cardNow: 'La carta ahora usa {{name}}.',
    cardNowGeneric: 'La carta ahora usa otra voz.',
    castMenu: 'Opciones de voz de {{name}}',
    castSummary_one: '{{count}} personaje suena distinto a su carta.',
    castSummary_other: '{{count}} personajes suenan distinto a sus cartas.',
    castOpen: 'Usar las voces actuales de las cartas',
    castLegend: 'Personajes que se actualizan',
    castMember: 'Ahora {{current}} · carta {{card}}',
    castApply_one: 'Actualizar {{count}} voz',
    castApply_other: 'Actualizar {{count}} voces',
    castRegionLabel: 'Voces del reparto',
}

export const voiceSessionTierEn = {
    label: 'Narration for this session',
    default: 'Default ({{tier}})',
    hint: 'Applies from the next reply.',
}

export const voiceSessionTierEs = {
    label: 'Narración de esta sesión',
    default: 'Predeterminada ({{tier}})',
    hint: 'Se aplica desde la próxima respuesta.',
}

export const voiceCallNoteEn = {
    audioUnsupported: 'This reply’s audio couldn’t play. The text is shown instead.',
    voiceReplaced: 'Voice replaced: {{name}}',
    callVoiceTooltip: 'This character’s voice isn’t available in calls.',
    pickCallReady: 'Pick a call-ready voice on the character card.',
}

export const voiceCallNoteEs = {
    audioUnsupported: 'No se pudo reproducir el audio de esta respuesta. Se muestra el texto.',
    voiceReplaced: 'Voz reemplazada: {{name}}',
    callVoiceTooltip: 'La voz de este personaje no está disponible en llamadas.',
    pickCallReady: 'Elige en la carta del personaje una voz apta para llamadas.',
}
