/**
 * Test fixture (never imported by the application): the exact
 * `GET /voices/capabilities` body of the purged BFF (I-68), generated offline from
 * `VoiceCapabilityRegistry().public_capabilities()` with no caller: the
 * `provider_route` constant `elevenlabs`, Standard only, consent `voice-v2`, the
 * fail-open status, the always-present (all-off) safeguards, and per tier the D18
 * `steps` and the `user_editable` map (which also lists the `emotion` key the
 * adapter ignores). There is no `admin_lab` surface in the DTO.
 */
export const BFF_R0_BODY = {
    "surfaces": {
        "narration": {
            "standard": {
                "controls": [
                    "stability",
                    "similarity_boost",
                    "speed",
                    "emotion"
                ],
                "ranges": {
                    "stability": [
                        0,
                        1
                    ],
                    "similarity_boost": [
                        0,
                        1
                    ],
                    "speed": [
                        0.7,
                        1.2
                    ]
                },
                "defaults": {
                    "stability": 0.5,
                    "similarity_boost": 0.75,
                    "speed": 1
                },
                "steps": {
                    "stability": 0.05,
                    "similarity_boost": 0.05,
                    "speed": 0.05
                },
                "user_editable": {
                    "stability": true,
                    "similarity_boost": true,
                    "speed": true,
                    "emotion": true
                },
                "supports_emotion": true,
                "supports_speed": true,
                "max_chars": 1200,
                "max_turn_chars": 2500,
                "healthy": true
            },
            "expressive": {
                "controls": [
                    "stability",
                    "similarity_boost",
                    "emotion"
                ],
                "ranges": {
                    "stability": [
                        0,
                        1
                    ],
                    "similarity_boost": [
                        0,
                        1
                    ]
                },
                "defaults": {
                    "stability": 0.5,
                    "similarity_boost": 0.75
                },
                "steps": {
                    "stability": 0.05,
                    "similarity_boost": 0.05
                },
                "user_editable": {
                    "stability": true,
                    "similarity_boost": true,
                    "emotion": true
                },
                "supports_emotion": true,
                "supports_speed": false,
                "max_chars": 1200,
                "max_turn_chars": 2500,
                "healthy": true
            }
        },
        "call": {
            "standard": {
                "controls": [
                    "stability",
                    "similarity_boost",
                    "speed",
                    "emotion"
                ],
                "ranges": {
                    "stability": [
                        0,
                        1
                    ],
                    "similarity_boost": [
                        0,
                        1
                    ],
                    "speed": [
                        0.7,
                        1.2
                    ]
                },
                "defaults": {
                    "stability": 0.5,
                    "similarity_boost": 0.75,
                    "speed": 1
                },
                "steps": {
                    "stability": 0.05,
                    "similarity_boost": 0.05,
                    "speed": 0.05
                },
                "user_editable": {
                    "stability": true,
                    "similarity_boost": true,
                    "speed": true,
                    "emotion": true
                },
                "supports_emotion": true,
                "supports_speed": true,
                "max_chars": 1200,
                "max_turn_chars": null,
                "healthy": true
            }
        },
        "preview": {
            "text_ids_per_language": 3,
            "max_chars": 150,
            "tiers": {
                "standard": {
                    "controls": [
                        "stability",
                        "similarity_boost",
                        "speed",
                        "emotion"
                    ],
                    "ranges": {
                        "stability": [
                            0,
                            1
                        ],
                        "similarity_boost": [
                            0,
                            1
                        ],
                        "speed": [
                            0.7,
                            1.2
                        ]
                    },
                    "defaults": {
                        "stability": 0.5,
                        "similarity_boost": 0.75,
                        "speed": 1
                    },
                    "steps": {
                        "stability": 0.05,
                        "similarity_boost": 0.05,
                        "speed": 0.05
                    },
                    "user_editable": {
                        "stability": true,
                        "similarity_boost": true,
                        "speed": true,
                        "emotion": true
                    },
                    "supports_emotion": true,
                    "supports_speed": true,
                    "max_chars": 1200,
                    "max_turn_chars": null,
                    "healthy": true
                },
                "expressive": {
                    "controls": [
                        "stability",
                        "similarity_boost",
                        "emotion"
                    ],
                    "ranges": {
                        "stability": [
                            0,
                            1
                        ],
                        "similarity_boost": [
                            0,
                            1
                        ]
                    },
                    "defaults": {
                        "stability": 0.5,
                        "similarity_boost": 0.75
                    },
                    "steps": {
                        "stability": 0.05,
                        "similarity_boost": 0.05
                    },
                    "user_editable": {
                        "stability": true,
                        "similarity_boost": true,
                        "emotion": true
                    },
                    "supports_emotion": true,
                    "supports_speed": false,
                    "max_chars": 1200,
                    "max_turn_chars": null,
                    "healthy": true
                }
            }
        }
    },
    "provider_route": "elevenlabs",
    "tiers_allowed": [
        "standard"
    ],
    "narration_tier": "standard",
    "consent_version_required": "voice-v2",
    "status": {
        "narration_available": true,
        "calls_available": true,
        "auto_narration_paused": false
    },
    "safeguards": {
        "retention_guard": false,
        "self_harm_pause": false,
        "break_nudge_minutes": null,
        "paused_until": null
    }
}

/**
 * The same body for a Free account (Standard only; byte-identical to the no-caller
 * body) and a Plus account (both tiers, Expressive chosen), generated the same way
 * with `CallerVoiceState(plan_rank=0)` and `CallerVoiceState(plan_rank=1,
 * narration_tier='expressive')`.
 */
export const BFF_EL_FREE_BODY = {
    ...BFF_R0_BODY,
    tiers_allowed: ['standard'],
    narration_tier: 'standard',
}

export const BFF_EL_PLUS_BODY = {
    ...BFF_EL_FREE_BODY,
    tiers_allowed: ['standard', 'expressive'],
    narration_tier: 'expressive',
}
