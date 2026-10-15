/**
 * The Privacy page's voice section (R2-FE-01; 13 §5.8). The existing variant
 * now describes provider-specific processing for the Fish HTTP integration:
 *
 * - `elevenlabsOnly`: retained internal ID; selected Fish voices use Fish for
 *   previews/narration, ElevenLabs serves other voices and calls, and Groq
 *   transcribes calls. The pre-speech safety check is named. `final`. The
 *   published locale keys ({@link PRIVACY_VOICE_LOCALE_KEYS}) mirror it word
 *   for word; a test pins them.
 *
 * {@link PRIVACY_VOICE_VARIANT} is the wired one. The ship gate
 * (`legalDocuments.gate.test.ts`) refuses a wired variant that is not final or
 * carries the `LEGAL_PENDING` marker; at runtime {@link privacyVoiceCopy}
 * answers null for such a variant and the Privacy page shows the published
 * locale text instead, as a second line of defence.
 */
import { isShippable, type LegalDraft, type LegalLanguage } from './legalPending'

export interface PrivacyVoiceCopy {
    title: string
    /** Paragraphs, in order. */
    body: string[]
}

export type PrivacyVoiceVariantId = 'elevenlabsOnly'

/** The published locale keys the wired variant mirrors, in paragraph order (the runtime fallback). */
export const PRIVACY_VOICE_LOCALE_KEYS = Object.freeze({
    title: 'legal.pages.privacy.sections.voice.title',
    body: [
        'legal.pages.privacy.sections.voice.body1',
        'legal.pages.privacy.sections.voice.body2',
        'legal.pages.privacy.sections.voice.body3',
    ],
})

export const PRIVACY_VOICE_VARIANTS: Readonly<Record<PrivacyVoiceVariantId, LegalDraft<PrivacyVoiceCopy>>> = Object.freeze({
    elevenlabsOnly: {
        id: 'privacy-voice-elevenlabs',
        status: 'final',
        en: {
            title: 'Voice narration, calls and transcripts',
            body: [
                'When you select a Fish Audio voice, narration and previews send the text to Fish Audio (Drama 3). Fish Audio processes that text under its own retention policies; our ElevenLabs history cleanup does not manage Fish requests. Other narration and call replies use ElevenLabs. In calls, Groq transcribes your speech. ElevenLabs processes the text sent to it, may store it in the United States, and may have its safety team review it to enforce its usage policy. We delete it from ElevenLabs’ history on a regular schedule, and we have opted out of ElevenLabs using it to train its models. Before text is spoken, an automated safety check reviews it using the AI providers that already process your stories for generation.',
                'Magic Worlds does not store raw microphone audio. The final transcript, call metadata and the AI’s spoken replies are saved with the chat so the conversation can continue. Our providers may keep request data under their own retention policies.',
                'Ending the call stops microphone capture and voice playback. Browser microphone permission can also be revoked through your browser settings.',
            ],
        },
        es: {
            title: 'Narración por voz, llamadas y transcripciones',
            body: [
                'Cuando eliges una voz de Fish Audio, la narración y las vistas previas envían el texto a Fish Audio (Drama 3). Fish Audio procesa ese texto según sus propias políticas de retención; nuestra limpieza del historial de ElevenLabs no gestiona las solicitudes de Fish. Las demás narraciones y las respuestas de las llamadas usan ElevenLabs. En las llamadas, Groq transcribe tu voz. ElevenLabs procesa el texto que recibe, puede guardarlo en Estados Unidos y puede hacer que su equipo de seguridad lo revise para hacer cumplir su política de uso. Lo eliminamos del historial de ElevenLabs de forma periódica y hemos desactivado la opción de que ElevenLabs lo use para entrenar sus modelos. Antes de pronunciar texto, un control de seguridad automático lo revisa mediante los proveedores de IA que ya procesan tus historias para generarlas.',
                'Magic Worlds no guarda el audio bruto del micrófono. La transcripción final, los metadatos de la llamada y las respuestas habladas de la IA se guardan con el chat para que la conversación pueda continuar. Nuestros proveedores pueden conservar los datos de las solicitudes según sus propias políticas de retención.',
                'Terminar la llamada detiene la captura del micrófono y la reproducción de voz. También puedes revocar el permiso de micrófono desde la configuración de tu navegador.',
            ],
        },
    },
})

/** Keep the existing variant ID for release compatibility; copy updated for Fish on 2026-10-15. */
export const PRIVACY_VOICE_VARIANT: PrivacyVoiceVariantId = 'elevenlabsOnly'

/**
 * The voice section of `doc` (the wired variant by default) in one language,
 * or null when `doc` is not shippable: the Privacy page then shows the
 * published locale text ({@link PRIVACY_VOICE_LOCALE_KEYS}). A production
 * build logs the refusal with `console.error` (the document id only), so a
 * mis-wired draft is loud but never shown.
 */
export function privacyVoiceCopy(
    language: LegalLanguage,
    doc: LegalDraft<PrivacyVoiceCopy> = PRIVACY_VOICE_VARIANTS[PRIVACY_VOICE_VARIANT],
): PrivacyVoiceCopy | null {
    if (isShippable(doc)) return doc[language]
    if (import.meta.env.PROD) {
        console.error(`[legal] document "${doc.id}" is not shippable (status ${doc.status}); using the published locale text`)
    }
    return null
}
