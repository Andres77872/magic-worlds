/**
 * Voice studio V2 copy (R1-FE-02, 05 §5 and §9.3, 09 §5.2): the new
 * `voices.recipe` keys (spread beside the shared speed and emotion labels),
 * the narration tier labels (`voices.tier.*`) and `voices.studio.v2.*`.
 * Copy that names credit multiples is not used (D05 is open). es drafts await
 * LOC review. Also the Studio usage strip (`voices.usage.*`, 05 §9.3, AC-S3).
 */
export const voiceRecipeV2En = {
    model: 'Speech model',
    elevenModel: 'v4 for previews and narration · v4 Turbo for calls',
    stability: 'Stability',
    /** 05 §5.1 / §9.3: the slider end labels. */
    stabilityLow: 'More expressive',
    stabilityHigh: 'More consistent',
    similarity: 'Similarity',
    similarityLow: 'Looser',
    similarityHigh: 'Closer to the voice',
    /** 05 §10: the spoken speed value ("Speed 1.05 times"); the readout shows "1.05×". */
    speedValueText: '{{label}} {{value}} times',
    /** AC-E2: a stored value outside the capabilities range, shown clamped under its slider. */
    outOfRange: '{{label}} was saved as {{stored}}, outside the supported range, so it shows as {{adjusted}}. Saving this preset stores {{adjusted}}.',
    /** AC-E2: the same for a value with no slider here (speed on Expressive) or a read-only recipe. */
    outOfRangeHidden: '{{label}} was saved as {{stored}}, outside the supported range. Saving this preset stores {{adjusted}}.',
    speedExpressiveNote: 'These speech models use stability and similarity controls.',
    emotionStandardHint: 'Adds an emotional delivery cue',
    emotionNone: 'None',
    languageNote: 'Your story’s language is used when it’s known.',
    /** AC-E4, 05 §5.1 / §9.3: the read-only language line once a voice is picked. */
    languageLabel: 'Primary language: {{language}} · {{accent}}',
    /** The same without an accent (none stored, or no label for it yet: the accent taxonomy is deferred). */
    languageLabelNoAccent: 'Primary language: {{language}}',
    /** Labels for catalog accent slugs; a slug without one is left out of the language line. */
    accent: {
        american: 'American accent',
        british: 'British accent',
        australian: 'Australian accent',
        irish: 'Irish accent',
        scottish: 'Scottish accent',
        canadian: 'Canadian accent',
        indian: 'Indian accent',
        mexican: 'Mexican accent',
        castilian: 'Castilian accent',
        latin_american: 'Latin American accent',
        argentine: 'Argentine accent',
        colombian: 'Colombian accent',
    },
    useDefaults: 'Use voice defaults',
    voiceDefaults: 'Voice defaults',
    /** 05 §5.1: the tag on a slider whose value equals the voice default. */
    defaultTag: 'Voice default',
    /** 05 §5.1: on Expressive, switches the preview tier to Standard (where speed is shown). */
    showStandardControls: 'Show Standard controls',
    /** 05 §5.3, D13: the Expressive emotion options say what the user will hear. */
    emotionEffect: {
        calm: 'Calm: adds a relaxed delivery',
        happy: 'Happy: adds a cheerful delivery',
        sad: 'Sad: adds a sorrowful delivery',
        angry: 'Angry: adds a heated delivery',
        fearful: 'Fearful: adds a nervous delivery',
        disgusted: 'Disgusted: adds a repulsed delivery',
        surprised: 'Surprised: adds an astonished delivery',
    },
    /** 05 §5.1 / §5.4, D16: thought delivery is a note per tier, never a control. */
    thoughtNoteStandard: 'Thoughts are spoken a little quieter.',
    thoughtNoteExpressive: 'Thoughts are whispered and a little quieter.',
    /** 05 §5.5: the preview panel's language chips. */
    previewLanguage: 'Preview language',
}

export const voiceRecipeV2Es = {
    model: 'Modelo de voz',
    elevenModel: 'v4 para muestras y narración · v4 Turbo para llamadas',
    stability: 'Estabilidad',
    stabilityLow: 'Más expresiva',
    stabilityHigh: 'Más constante',
    similarity: 'Similitud',
    similarityLow: 'Más libre',
    similarityHigh: 'Más fiel a la voz',
    speedValueText: '{{label}} {{value}} veces',
    outOfRange: '{{label}}: se guardó como {{stored}}, fuera del rango admitido, así que se muestra como {{adjusted}}. Al guardar este preset quedará en {{adjusted}}.',
    outOfRangeHidden: '{{label}}: se guardó como {{stored}}, fuera del rango admitido. Al guardar este preset quedará en {{adjusted}}.',
    speedExpressiveNote: 'Estos modelos usan controles de estabilidad y similitud.',
    emotionStandardHint: 'Sutil en las voces estándar',
    emotionNone: 'Ninguna',
    languageNote: 'Se usa el idioma de tu historia cuando se conoce.',
    languageLabel: 'Idioma principal: {{language}} · {{accent}}',
    languageLabelNoAccent: 'Idioma principal: {{language}}',
    accent: {
        american: 'Acento estadounidense',
        british: 'Acento británico',
        australian: 'Acento australiano',
        irish: 'Acento irlandés',
        scottish: 'Acento escocés',
        canadian: 'Acento canadiense',
        indian: 'Acento indio',
        mexican: 'Acento mexicano',
        castilian: 'Acento castellano',
        latin_american: 'Acento latinoamericano',
        argentine: 'Acento argentino',
        colombian: 'Acento colombiano',
    },
    useDefaults: 'Usar los valores de la voz',
    voiceDefaults: 'Valores de la voz',
    defaultTag: 'Valor de la voz',
    showStandardControls: 'Mostrar controles estándar',
    emotionEffect: {
        calm: 'Calmada: añade un tono sereno',
        happy: 'Alegre: añade un tono jovial',
        sad: 'Triste: añade un tono afligido',
        angry: 'Enojada: añade un tono airado',
        fearful: 'Temerosa: añade un tono nervioso',
        disgusted: 'Disgustada: añade un tono de rechazo',
        surprised: 'Sorprendida: añade un tono de asombro',
    },
    thoughtNoteStandard: 'Los pensamientos se dicen un poco más bajo.',
    thoughtNoteExpressive: 'Los pensamientos se susurran y suenan un poco más bajo.',
    previewLanguage: 'Idioma de la vista previa',
}

export const voiceTierEn = {
    label: 'Narration quality',
    standard: 'Standard',
    expressive: 'Expressive',
    expressiveDescription: 'More emotional delivery.',
    expressiveUpsell: 'Expressive narration is available on Plus and Pro.',
    lockedHint: 'Available on Plus and Pro.',
}

export const voiceTierEs = {
    label: 'Calidad de narración',
    standard: 'Estándar',
    expressive: 'Expresiva',
    expressiveDescription: 'Una interpretación más emotiva.',
    expressiveUpsell: 'La narración expresiva está disponible en Plus y Pro.',
    lockedHint: 'Disponible en Plus y Pro.',
}

export const voiceStudioV2En = {
    catalogTab: 'Explore voices',
    savedTab: 'Saved settings',
    tabsLabel: 'Voices and saved settings',
    catalogTitle: 'Find a voice for your characters',
    catalogHelp: 'Each voice is a different speaker. Listen to a sample, then choose a voice to save its settings and reuse it on your characters.',
    savedHelp: 'These are saved settings for existing voices. Changing emotion or delivery does not create a new voice.',
    createVoice: 'Create a voice',
    manageVoices: 'Manage catalog',
    configureVoice: 'Use this voice',
    editorHelp: 'Save a name and delivery settings for this voice. You can then choose it when editing a character.',
    elevenLabsQuality: 'ElevenLabs narration quality',
    fishQuality: 'Fish Audio uses its own voice model; this setting applies to ElevenLabs.',
    /** The Saved settings aside: the account setting and today's allowance. */
    accountSettings: 'Account voice settings',
    allowanceTitle: 'Today',
    exploreVoices: 'Explore voices',
    refreshSaved: 'Refresh saved settings',
    /** A root user's way into the console from the Studio, on each catalog voice. */
    manageVoice: 'Manage {{name}} in the voice console',
    myPresets: 'My saved settings',
    globalPresets: 'Shared settings',
    preview: 'Preview',
    duplicateName: '{{name}} (copy)',
    readOnlyGlobal: 'Shared settings are read-only. Make a copy to change them.',
    baseVoice: 'Base voice',
    changeVoice: 'Change voice',
    /** Closes the editor's voice picker on the voice already chosen. */
    keepVoice: 'Keep current voice',
    /** The editor's section headings, after "Base voice". */
    sections: {
        delivery: 'Delivery',
        listen: 'Listen',
        details: 'Name and notes',
    },
    save: 'Save settings',
    saved: 'Voice settings saved',
    saveFailed: 'Could not save these settings.',
    /** 05 §10 Modals: the editor drawer's title states the preset name. */
    editTitle: 'Edit “{{name}}”',
    duplicateTitle: 'Duplicate “{{name}}”',
    /** 05 §10 Modals: closing with unsaved changes asks first. */
    discardTitle: 'Discard unsaved changes?',
    discardMessage: 'Your changes to “{{name}}” haven’t been saved. If you close the editor now, they’ll be lost.',
    discardMessageNew: 'These voice settings haven’t been saved. If you close the editor now, they will be lost.',
    discardConfirm: 'Discard changes',
    keepEditing: 'Keep editing',
    /** 05 §6.4: the action next to a preview's 409 `voice_unavailable`. */
    pickAnotherVoice: 'Pick another voice',
    /** 05 §6.4: the membership-page link next to "Not enough credits for another preview." */
    viewMembership: 'View membership',
    /** Screen-reader suffix of a link the editor opens in a new tab (it keeps the unsaved draft). */
    opensInNewTab: '(opens in a new tab)',
    /**
     * 05 §10 audio controls: a card's Preview button names the preset, its voice and, when the card can
     * tell, the language heard ("Preview Harbour master, Eldrin, English"). The visible text stays "Preview".
     */
    previewNamed: 'Preview {{name}}, {{voice}}, {{language}}',
    previewNamedVoice: 'Preview {{name}}, {{voice}}',
    /** WCAG 2.5.3: a paid preview's name starts with its visible text (`label`, "Preview · 1 credit"). */
    previewNamedCredit: '{{label}}: {{name}}, {{voice}}, {{language}}',
    previewNamedVoiceCredit: '{{label}}: {{name}}, {{voice}}',
    stopNamed: 'Stop the preview of {{name}}',
}

export const voiceStudioV2Es = {
    catalogTab: 'Explorar voces',
    savedTab: 'Ajustes guardados',
    tabsLabel: 'Voces y ajustes guardados',
    catalogTitle: 'Encuentra una voz para tus personajes',
    catalogHelp: 'Cada voz es un hablante distinto. Escucha una muestra y elige una voz para guardar sus ajustes y reutilizarla en tus personajes.',
    savedHelp: 'Son ajustes de voces que ya existen. Cambiar la emoción o la interpretación no crea una voz nueva.',
    createVoice: 'Crear una voz',
    manageVoices: 'Gestionar catálogo',
    configureVoice: 'Usar esta voz',
    editorHelp: 'Guarda un nombre y los ajustes de interpretación de esta voz. Después podrás elegirla al editar un personaje.',
    elevenLabsQuality: 'Calidad de narración de ElevenLabs',
    fishQuality: 'Fish Audio usa su propio modelo de voz; este ajuste se aplica a ElevenLabs.',
    accountSettings: 'Ajustes de voz de la cuenta',
    allowanceTitle: 'Hoy',
    exploreVoices: 'Explorar voces',
    refreshSaved: 'Actualizar ajustes guardados',
    manageVoice: 'Gestionar {{name}} en la consola de voces',
    myPresets: 'Mis ajustes guardados',
    globalPresets: 'Ajustes compartidos',
    preview: 'Escuchar',
    duplicateName: '{{name}} (copia)',
    readOnlyGlobal: 'Los ajustes compartidos son de solo lectura. Crea una copia para cambiarlos.',
    baseVoice: 'Voz base',
    changeVoice: 'Cambiar voz',
    keepVoice: 'Mantener la voz actual',
    sections: {
        delivery: 'Interpretación',
        listen: 'Escuchar',
        details: 'Nombre y notas',
    },
    save: 'Guardar ajustes',
    saved: 'Ajustes de voz guardados',
    saveFailed: 'No se pudieron guardar estos ajustes.',
    editTitle: 'Editar «{{name}}»',
    duplicateTitle: 'Duplicar «{{name}}»',
    discardTitle: '¿Descartar los cambios sin guardar?',
    discardMessage: 'Los cambios en «{{name}}» no se han guardado. Si cierras el editor ahora, se perderán.',
    discardMessageNew: 'Estos ajustes de voz no se han guardado. Si cierras el editor ahora, se perderán.',
    discardConfirm: 'Descartar cambios',
    keepEditing: 'Seguir editando',
    pickAnotherVoice: 'Elegir otra voz',
    viewMembership: 'Ver membresía',
    opensInNewTab: '(se abre en una pestaña nueva)',
    previewNamed: 'Escuchar {{name}}, {{voice}}, {{language}}',
    previewNamedVoice: 'Escuchar {{name}}, {{voice}}',
    previewNamedCredit: '{{label}}: {{name}}, {{voice}}, {{language}}',
    previewNamedVoiceCredit: '{{label}}: {{name}}, {{voice}}',
    stopNamed: 'Detener la vista previa de {{name}}',
}

/** The Studio usage strip (`voices.usage.*`, 05 §9.3, AC-S3): what is left today from the D24 usage DTO. */
export const voiceUsageStripEn = {
    label: 'Voice allowance today',
    previews: 'Previews left today: {{count}}',
    narration_one: 'Narration left today: {{value}} character',
    narration_other: 'Narration left today: {{value}} characters',
    calls: 'Call time left today: {{minutes}} min',
}

export const voiceUsageStripEs = {
    label: 'Lo que te queda de voz hoy',
    previews: 'Vistas previas restantes hoy: {{count}}',
    narration_one: 'Narración restante hoy: {{value}} carácter',
    narration_other: 'Narración restante hoy: {{value}} caracteres',
    calls: 'Tiempo de llamada restante hoy: {{minutes}} min',
}
