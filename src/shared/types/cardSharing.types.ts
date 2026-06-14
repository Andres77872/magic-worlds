import type {
    AdventureTemplateCardResponse,
    CharacterCardResponse,
    ItemCardResponse,
    WorldCardResponse,
} from './aiCard.types'

export type ShareableCardType = 'character' | 'world' | 'adventure_template' | 'item'
export type ShareSourceAccess = 'owner' | 'public' | 'share_link' | 'share_link_owner' | string

export interface CardVisibility {
    public?: boolean
    share_link?: boolean
}

export interface CardActor {
    user_id?: number | null
    username?: string | null
}

export type ShareableCardResponse =
    | CharacterCardResponse
    | WorldCardResponse
    | AdventureTemplateCardResponse
    | ItemCardResponse
    | Record<string, unknown>

export interface SharedCardResource<TCard = ShareableCardResponse> {
    card_type: ShareableCardType
    card: TCard
    visibility?: CardVisibility
    original_card_id?: string
    original_creator?: CardActor
    owner?: CardActor
    clone_source_card_id?: string | null
    access?: ShareSourceAccess
    created_at?: string | null
    updated_at?: string | null
    share_token?: string
    share_created_at?: string | null
    /** True when the signed-in viewer already imported this card. */
    already_imported?: boolean
    /** The viewer's existing copy of this card, when `already_imported`. */
    existing_card_id?: string | null
}

export interface CardShareLinkResponse {
    share_token: string
    share_url: string
    resource: SharedCardResource
}

export interface SharedCardListResponse {
    items: SharedCardResource[]
    skip: number
    limit: number
}

export interface CardCloneResponse<TCard = ShareableCardResponse> {
    card_type: ShareableCardType
    card: TCard
    cloned_from?: ShareableCardResponse
    source_access?: ShareSourceAccess
    original_card_id?: string
    original_creator?: CardActor
}

/**
 * Shape of the `detail` payload returned with HTTP 409 when a user tries to
 * import a card they already have (unless `force` is set).
 */
export interface AlreadyImportedConflict {
    category: 'already_imported'
    detail?: string
    existing_card_id?: string | null
    existing_card_name?: string | null
    original_card_id?: string
}
