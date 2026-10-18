/** The manuscript's StarterKit configuration, shared by the editor and by headless suggestion application. */
import StarterKit from '@tiptap/starter-kit'
import { isManuscriptLinkHref } from './manuscriptLinks'

export const manuscriptStarterKit = () => StarterKit.configure({
    heading: { levels: [1, 2, 3] },
    codeBlock: false,
    // Canonical scene structure changes only through author edits.
    trailingNode: false,
    code: false,
    link: { openOnClick: false, autolink: true,defaultProtocol:'https',isAllowedUri:(href,context)=>context.defaultValidate(href)&&isManuscriptLinkHref(href),shouldAutoLink:isManuscriptLinkHref },
    underline: false,
})
