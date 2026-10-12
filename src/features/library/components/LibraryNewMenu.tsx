/**
 * The Library header's New menu (document 08 "Creation from the unified
 * library"): New collection (root only), each card type's existing creator,
 * and Import card, respecting the feature flags. A type filter is never a
 * destination: every available type stays in the menu.
 */
import { useRef, useState, type RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, FolderPlus, Gem, Globe, Import, Plus, Swords, UserCircle, Users } from 'lucide-react'
import { CardActionMenu, type CardMenuAnchor, type CardOption } from '@/ui/components'
import { Button, Icon } from '@/ui/primitives'

export type LibraryNewKind = 'collection' | 'character' | 'persona' | 'world' | 'item' | 'adventure' | 'import'

interface LibraryNewMenuProps {
    /** Inside a collection: no nested collection creation. */
    inCollection: boolean
    /** Which kinds the feature flags allow (collection/character/persona/world/item are always on). */
    adventuresEnabled: boolean
    importEnabled: boolean
    /** "Saves to Workspace / Collection" — the trigger's description. */
    destinationLabel: string
    onSelect: (kind: LibraryNewKind) => void
}

const MENU_WIDTH = 216

export function LibraryNewMenu({ inCollection, adventuresEnabled, importEnabled, destinationLabel, onSelect }: LibraryNewMenuProps) {
    const { t } = useTranslation()
    const [open, setOpen] = useState(false)
    const [anchor, setAnchor] = useState<CardMenuAnchor | null>(null)
    // Button doesn't take a ref: anchor on its wrapper and return focus to the button inside.
    const wrapperRef = useRef<HTMLDivElement>(null)
    const buttonRef = useRef<HTMLButtonElement | null>(null)

    const pick = (kind: LibraryNewKind) => () => {
        setOpen(false)
        onSelect(kind)
    }

    const options: CardOption[] = [
        ...(!inCollection ? [{ type: 'custom' as const, icon: <Icon icon={FolderPlus} size={15} />, label: t('library.newMenu.collection'), onClick: pick('collection') }] : []),
        { type: 'custom', icon: <Icon icon={Users} size={15} />, label: t('library.newMenu.character'), onClick: pick('character'), separatorBefore: !inCollection },
        { type: 'custom', icon: <Icon icon={UserCircle} size={15} />, label: t('library.newMenu.persona'), onClick: pick('persona') },
        { type: 'custom', icon: <Icon icon={Globe} size={15} />, label: t('library.newMenu.world'), onClick: pick('world') },
        { type: 'custom', icon: <Icon icon={Gem} size={15} />, label: t('library.newMenu.item'), onClick: pick('item') },
        ...(adventuresEnabled ? [{ type: 'custom' as const, icon: <Icon icon={Swords} size={15} />, label: t('library.newMenu.adventure'), onClick: pick('adventure') }] : []),
        ...(importEnabled ? [{ type: 'custom' as const, icon: <Icon icon={Import} size={15} />, label: t('library.newMenu.importCard'), onClick: pick('import'), separatorBefore: true }] : []),
    ]

    const toggle = () => {
        if (open) {
            setOpen(false)
            return
        }
        buttonRef.current = wrapperRef.current?.querySelector('button') ?? null
        const rect = buttonRef.current?.getBoundingClientRect()
        if (!rect) return
        setAnchor({ top: rect.bottom + 8, left: Math.max(8, rect.right - MENU_WIDTH) })
        setOpen(true)
    }

    return (
        <div ref={wrapperRef} className="relative shrink-0">
            <Button
                variant="primary"
                iconLeft={<Icon icon={Plus} size={16} />}
                iconRight={<Icon icon={ChevronDown} size={15} />}
                aria-haspopup="menu"
                aria-expanded={open}
                aria-controls="library-new-menu"
                aria-label={t('library.newMenu.open')}
                title={destinationLabel}
                onClick={toggle}
                id="library-new-trigger"
                data-testid="library-new-trigger"
            >
                {t('library.newMenu.label')}
            </Button>
            <CardActionMenu
                options={options}
                open={open}
                anchor={anchor}
                labelledBy="library-new-trigger"
                menuId="library-new-menu"
                menuTestId="library-new-menu"
                optionTestIdPrefix="library-new"
                excludeRefs={[wrapperRef as RefObject<HTMLElement>]}
                returnFocusRef={buttonRef as RefObject<HTMLElement>}
                onClose={() => setOpen(false)}
            />
        </div>
    )
}
