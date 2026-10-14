/**
 * Copy for voice access in R0 (D26, D24, D37): the 18+ and Terms of Service
 * attestation (`attestation.*`), the draft Terms of Service page
 * (`legal.pages.terms`), voice refusals (`voices.errors.*`, 09 §2.2) and the
 * voice usage rows of the usage monitor (`usage.voice.*`).
 *
 * The Terms page is an outline built from the 13 §3.3 checklist. Its text is
 * not the agreement: counsel drafts that (CN-2), and the page says so.
 */
export const attestationEn = {
    title: 'Confirm your age and the terms',
    body: 'Magic Worlds is for adults. Confirm your age and accept the Terms of Service to keep using your account.',
    required: 'Confirm your age and accept the terms to use voice features',
    groupLabel: 'Age and terms',
    age: 'I am 18 or older',
    terms: 'I agree to the <0>Terms of Service</0>',
    submit: 'Confirm',
    submitting: 'Saving…',
    notNow: 'Not now',
    signOut: 'Sign out',
    signupMissing: 'Confirm you are 18 or older and accept the Terms of Service to create an account.',
    saveFailed: 'Your confirmation could not be saved. Try again in a moment.',
    callRequired: 'Confirm your age and accept the terms, then start the call again.',
    termsVersion: 'Terms of Service, version {{version}}',
    termsUnavailable: 'Updated terms are being published. Voice is unavailable until then.',
    termsChanged: 'The Terms of Service were updated. Review this version and confirm again.',
}

export const attestationEs = {
    title: 'Confirma tu edad y los términos',
    body: 'Magic Worlds es para personas adultas. Confirma tu edad y acepta los Términos del servicio para seguir usando tu cuenta.',
    required: 'Confirma tu edad y acepta los términos para usar las funciones de voz',
    groupLabel: 'Edad y términos',
    age: 'Tengo 18 años o más',
    terms: 'Acepto los <0>Términos del servicio</0>',
    submit: 'Confirmar',
    submitting: 'Guardando…',
    notNow: 'Ahora no',
    signOut: 'Cerrar sesión',
    signupMissing: 'Confirma que tienes 18 años o más y acepta los Términos del servicio para crear una cuenta.',
    saveFailed: 'No se pudo guardar tu confirmación. Inténtalo de nuevo en un momento.',
    callRequired: 'Confirma tu edad y acepta los términos; después vuelve a iniciar la llamada.',
    termsVersion: 'Términos del servicio, versión {{version}}',
    termsUnavailable: 'Estamos publicando los términos actualizados. La voz no está disponible hasta entonces.',
    termsChanged: 'Los Términos del servicio se actualizaron. Revisa esta versión y vuelve a confirmar.',
}

export const termsPageEn = {
    eyebrow: 'Terms',
    title: 'Terms of Service',
    subtitle: 'The rules for using Magic Worlds, including its voice features.',
    updated: 'October 12, 2026 (draft)',
    version: 'Terms version: {{version}}',
    effectiveDate: 'In effect from {{date}}',
    imageAlt: 'Terms of Service',
    draftNotice: {
        title: 'Draft — pending legal review',
        body: 'This page is an outline. The final Terms of Service are being prepared with legal counsel and are not in effect yet. Each section says what it will cover.',
    },
    highlights: {
        adults: {
            title: 'Adults only',
            body: 'Magic Worlds is for people 18 or older. The final terms set out the exact age rule.',
        },
        providers: {
            title: 'AI providers',
            body: 'The final terms will name the AI providers that process your content and the rules of theirs that apply to you.',
        },
        voices: {
            title: 'AI voices',
            body: 'Every voice in Magic Worlds is AI-generated and labelled as an AI voice.',
        },
    },
    sections: {
        eligibility: {
            title: 'Eligibility and age',
            body1: 'Pending legal review. This section will require you to be 18 or older, or the age of majority where you live if that is higher, and will confirm that Magic Worlds is not offered to anyone younger.',
        },
        acceptableUse: {
            title: 'Acceptable use',
            body1: 'Pending legal review. This section will list prohibited content and conduct, including content that sexualises minors, encourages self-harm, or harasses or impersonates real people; extracting or scraping the service; using its outputs to train AI models; and automated abuse or using several accounts to get around limits.',
        },
        providers: {
            title: 'Third-party AI providers',
            body1: 'Pending legal review. This section will name the providers that process your content to write stories, generate voices, transcribe speech and screen content for safety, and will explain which of their usage policies apply to voice features.',
        },
        enforcement: {
            title: 'Enforcement',
            body1: 'Pending legal review. This section will describe when we may block or remove content and suspend voice features or accounts, including temporary voice holds and limits after repeated violations.',
        },
        aiVoices: {
            title: 'AI-generated voices',
            body1: 'Pending legal review. This section will explain that voices are AI-generated, are labelled as AI voices, and may be retired and replaced.',
        },
        changes: {
            title: 'Accepting and updating the terms',
            body1: 'Pending legal review. This section will explain how you accept the terms when you create an account and how we ask you to accept them again when they change.',
        },
    },
}

export const termsPageEs = {
    eyebrow: 'Términos',
    title: 'Términos del servicio',
    subtitle: 'Las reglas para usar Magic Worlds, incluidas sus funciones de voz.',
    updated: '12 de octubre de 2026 (borrador)',
    version: 'Versión de los términos: {{version}}',
    effectiveDate: 'En vigor desde el {{date}}',
    imageAlt: 'Términos del servicio',
    draftNotice: {
        title: 'Borrador: pendiente de revisión legal',
        body: 'Esta página es un esquema. Los Términos del servicio definitivos se están preparando con asesoría legal y todavía no están en vigor. Cada sección indica lo que cubrirá.',
    },
    highlights: {
        adults: {
            title: 'Solo para personas adultas',
            body: 'Magic Worlds es para personas de 18 años o más. Los términos definitivos fijan la regla de edad exacta.',
        },
        providers: {
            title: 'Proveedores de IA',
            body: 'Los términos definitivos nombrarán a los proveedores de IA que procesan tu contenido y las reglas suyas que se te aplican.',
        },
        voices: {
            title: 'Voces de IA',
            body: 'Todas las voces de Magic Worlds se generan con IA y se identifican como voces de IA.',
        },
    },
    sections: {
        eligibility: {
            title: 'Requisitos y edad',
            body1: 'Pendiente de revisión legal. Esta sección exigirá que tengas 18 años o más, o la mayoría de edad de tu país si es mayor, y confirmará que Magic Worlds no se ofrece a nadie menor.',
        },
        acceptableUse: {
            title: 'Uso aceptable',
            body1: 'Pendiente de revisión legal. Esta sección enumerará el contenido y las conductas prohibidas, como el contenido que sexualiza a menores, fomenta las autolesiones o acosa o suplanta a personas reales; la extracción o el scraping del servicio; usar sus resultados para entrenar modelos de IA; y el abuso automatizado o el uso de varias cuentas para eludir límites.',
        },
        providers: {
            title: 'Proveedores de IA externos',
            body1: 'Pendiente de revisión legal. Esta sección nombrará a los proveedores que procesan tu contenido para escribir historias, generar voces, transcribir voz y revisar la seguridad del contenido, y explicará qué políticas de uso suyas se aplican a las funciones de voz.',
        },
        enforcement: {
            title: 'Aplicación de las normas',
            body1: 'Pendiente de revisión legal. Esta sección describirá cuándo podemos bloquear o retirar contenido y suspender las funciones de voz o las cuentas, incluidas las suspensiones temporales de voz y los límites tras infracciones repetidas.',
        },
        aiVoices: {
            title: 'Voces generadas con IA',
            body1: 'Pendiente de revisión legal. Esta sección explicará que las voces se generan con IA, se identifican como voces de IA y pueden retirarse y sustituirse.',
        },
        changes: {
            title: 'Aceptación y cambios de los términos',
            body1: 'Pendiente de revisión legal. Esta sección explicará cómo aceptas los términos al crear una cuenta y cómo te pediremos que los aceptes de nuevo cuando cambien.',
        },
    },
}

/** Voice refusals that are not the user's daily quota (09 §2.2). */
export const voiceErrorsEn = {
    rateLimited: 'You’re going a bit fast. Try again in a moment.',
    budgetUnavailable: 'Voice is unavailable right now. Text keeps working.',
    freeNotEligible: 'Voice on the Free plan needs a verified email and an account at least 24 hours old.',
    /** `voice_tier_unavailable`: the plan allows Expressive but the Expressive model is not available right now (I-32). */
    tierUnavailable: 'Expressive narration isn’t available for your account yet. Standard narration keeps working.',
    // Voice write refusals (I-36), mapped by `voiceWriteErrorKey` in `@/shared/voice/voiceWriteErrors`.
    // `voice_not_eligible` maps to `voices.picker.eligibilityError` (05 §9.3, voiceCatalog.ts).
    /** `voice_plan_locked`. */
    planLocked: 'Your plan doesn’t include this voice option.',
    /** `voice_invalid`. */
    invalid: 'This voice choice isn’t valid. Choose the voice again.',
    /** `voice_reload_required` (409). */
    reloadRequired: 'Voices changed since this page loaded. Reload to continue.',
    /** `voice_region_unavailable` (PC-2). */
    regionUnavailable: 'Voice is not available in your region.',
    /** `voice_safety_pause` (PC-1). */
    safetyPause: 'Voice is paused for now.',
    /** Call end reason `voice_restricted`. */
    callRestricted: 'Voice isn’t available for your account right now, so the call ended.',
}

export const voiceErrorsEs = {
    rateLimited: 'Vas un poco rápido. Inténtalo de nuevo en un momento.',
    budgetUnavailable: 'La voz no está disponible ahora mismo. El texto sigue funcionando.',
    freeNotEligible: 'La voz en el plan gratuito requiere un correo verificado y una cuenta con al menos 24 horas de antigüedad.',
    tierUnavailable: 'La narración expresiva aún no está disponible para tu cuenta. La narración estándar sigue funcionando.',
    planLocked: 'Tu plan no incluye esta opción de voz.',
    invalid: 'Esta elección de voz no es válida. Vuelve a elegir la voz.',
    reloadRequired: 'Las voces cambiaron desde que se cargó esta página. Recarga para continuar.',
    regionUnavailable: 'La voz no está disponible en tu región.',
    safetyPause: 'La voz está en pausa por ahora.',
    callRestricted: 'La voz no está disponible para tu cuenta ahora mismo, así que la llamada terminó.',
}

/** Usage monitor rows for the D24 voice caps (`usage.voice.*`). */
export const voiceUsageEn = {
    title: 'Voice',
    narrationChars: 'Narration characters',
    narrationCharsMeter: 'Narration characters used today',
    callMinutes: 'Call minutes',
    callMinutesMeter: 'Call minutes used today',
    minutesOf: '{{used}} of {{max}} min',
    charsRemaining_one: '{{value}} character left today',
    charsRemaining_other: '{{value}} characters left today',
    minutesRemaining_one: '{{value}} minute left today',
    minutesRemaining_other: '{{value}} minutes left today',
    previews: 'Voice previews',
    previewsLeft_one: '{{count}} preview left today',
    previewsLeft_other: '{{count}} previews left today',
    dailyLimit: 'Daily voice limit reached. Narration resumes tomorrow.',
}

export const voiceUsageEs = {
    title: 'Voz',
    narrationChars: 'Caracteres de narración',
    narrationCharsMeter: 'Caracteres de narración usados hoy',
    callMinutes: 'Minutos de llamada',
    callMinutesMeter: 'Minutos de llamada usados hoy',
    minutesOf: '{{used}} de {{max}} min',
    charsRemaining_one: 'Queda {{value}} carácter hoy',
    charsRemaining_other: 'Quedan {{value}} caracteres hoy',
    minutesRemaining_one: 'Queda {{value}} minuto hoy',
    minutesRemaining_other: 'Quedan {{value}} minutos hoy',
    previews: 'Vistas previas de voz',
    previewsLeft_one: 'Queda {{count}} vista previa hoy',
    previewsLeft_other: 'Quedan {{count}} vistas previas hoy',
    dailyLimit: 'Alcanzaste el límite diario de voz. La narración se reanuda mañana.',
}
