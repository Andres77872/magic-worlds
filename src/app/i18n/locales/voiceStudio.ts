/**
 * Voice studio V2 copy (R1-FE-02, 05 §5 and §9.3, 09 §5.2): the new
 * `voices.recipe` keys (spread beside the shared speed and emotion labels),
 * the narration tier labels (`voices.tier.*`) and `voices.studio.v2.*`.
 * Copy that names credit multiples is not used (D05 is open). es drafts await
 * LOC review. Also the Studio usage strip (`voices.usage.*`, 05 §9.3, AC-S3).
 */
export const voiceRecipeV2En = {
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
    speedExpressiveNote: 'Speed applies to Standard narration and calls.',
    emotionStandardHint: 'Subtle on Standard voices',
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
    stability: 'Estabilidad',
    stabilityLow: 'Más expresiva',
    stabilityHigh: 'Más constante',
    similarity: 'Similitud',
    similarityLow: 'Más libre',
    similarityHigh: 'Más fiel a la voz',
    speedValueText: '{{label}} {{value}} veces',
    outOfRange: '{{label}}: se guardó como {{stored}}, fuera del rango admitido, así que se muestra como {{adjusted}}. Al guardar este preset quedará en {{adjusted}}.',
    outOfRangeHidden: '{{label}}: se guardó como {{stored}}, fuera del rango admitido. Al guardar este preset quedará en {{adjusted}}.',
    speedExpressiveNote: 'La velocidad se aplica a la narración estándar y a las llamadas.',
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
    myPresets: 'My presets',
    globalPresets: 'Global presets',
    preview: 'Preview',
    duplicateName: '{{name}} (copy)',
    readOnlyGlobal: 'Global presets are read-only. Duplicate one to change it.',
    baseVoice: 'Base voice',
    changeVoice: 'Change voice',
    save: 'Save preset',
    saved: 'Preset saved',
    saveFailed: 'Could not save this preset.',
    /** 05 §10 Modals: the editor drawer's title states the preset name. */
    editTitle: 'Edit “{{name}}”',
    duplicateTitle: 'Duplicate “{{name}}”',
    /** 05 §10 Modals: closing with unsaved changes asks first. */
    discardTitle: 'Discard unsaved changes?',
    discardMessage: 'Your changes to “{{name}}” haven’t been saved. If you close the editor now, they’ll be lost.',
    discardMessageNew: 'This preset hasn’t been saved. If you close the editor now, it will be lost.',
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
    myPresets: 'Mis presets',
    globalPresets: 'Presets globales',
    preview: 'Escuchar',
    duplicateName: '{{name}} (copia)',
    readOnlyGlobal: 'Los presets globales son de solo lectura. Duplica uno para cambiarlo.',
    baseVoice: 'Voz base',
    changeVoice: 'Cambiar voz',
    save: 'Guardar preset',
    saved: 'Preset guardado',
    saveFailed: 'No se pudo guardar este preset.',
    editTitle: 'Editar «{{name}}»',
    duplicateTitle: 'Duplicar «{{name}}»',
    discardTitle: '¿Descartar los cambios sin guardar?',
    discardMessage: 'Los cambios en «{{name}}» no se han guardado. Si cierras el editor ahora, se perderán.',
    discardMessageNew: 'Este preset no se ha guardado. Si cierras el editor ahora, se perderá.',
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
