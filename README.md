<p align="center">
  <img src="src/assets/marketing/readme-banner-1600.webp" alt="Reverie — Worlds that talk back." width="100%" />
</p>

# Magic Worlds (Reverie)

A React frontend for an AI-powered roleplay and storytelling platform. Implemented modules cover card creation, conversations, writing and media. Availability depends on frontend rollout flags and the backend configuration.

**Status reviewed 2026-10-14:** ten product features, including Story Studio, adventures, lorebooks, voices/calls, community, the app assistant and Workspace R1, are **WIP — disabled by default** in the example configuration. This checkout's local configuration opts into those ten; deployed availability is unverified. Chara Studio reference/edit/mask workflows remain **WIP planned**. See the [documentation index](docs/README.md), [actual feature status](docs/FEATURE_STATUS.md) and [roadmap](docs/ROADMAP.md) before treating the list below as available in a release.

The app is a client for a separate FastAPI backend (REST + WebSockets); all creations are persisted server-side behind authentication.

## Features

This is an implementation inventory. Gated modules are WIP when disabled; a source module is not evidence that a deployment enables it.

- **Card creation** — Form-based creators for characters (including player personas), worlds and items, with field templates, AI-assisted suggestions and a shared creation engine (`src/features/creation`). Adventure-template creation is **WIP — default off**
- **Galleries** — Image-forward, searchable galleries for every card type plus a mixed media gallery (generated images and theme songs) with debounced search and infinite scroll (`src/features/gallery`)
- **Adventure play — WIP, default off** — An AI game master runs a session built from your persona, cast, world and adventure template. Sessions keep their own editable snapshot of the cards they use (`src/features/interaction`)
- **Character chat** — 1:1, character.ai-style conversations with a single character, with greetings and per-character system instructions (`src/features/characterChat`)
- **Story Studio — WIP, default off** — Chapter-based Markdown drafting, staged AI generation and card codex (`src/features/novel`); persistent scenes/revisions and the expanded novel assistant are roadmap work
- **Lorebooks — WIP, default off** — World-info style lore entries authored in a dedicated studio and attached to play; resources require the additional resource gate (`src/features/lorebook`)
- **Media generation** — AI-generated card portraits and theme songs, TTS narration of GM turns (on-demand or auto-narrate), a background tasks drawer for job status, and a media history drawer to re-point a card's default image/theme
- **Global audio playlist** — One shared audio element behind a floating playlist dock; theme song buttons and wave players are all views of the same queue, persisted to localStorage (`src/app/providers/AudioPlaylistProvider.tsx`, `src/ui/components/audio`)
- **Profile & account** — Profile, account/security settings, display-name editing, verification/password flows, login, token refresh and logout confirmation (`src/features/profile`, `src/features/auth`)
- **In-app docs** — Documentation viewer built into the app (`src/features/docs`)

## Architecture

```
src/
├── app/                  # App root: providers, hooks, hand-rolled router
│   ├── providers/        # Auth, Workspace, LLM session, navigation, data, tasks, audio + UI contexts
│   └── router/           # AppRouter maps navigation state → page components
├── features/             # Feature-based organization
│   ├── cards/            # Card preview modal + preview state
│   ├── admin/            # Root membership, credit, agent and voice consoles
│   ├── auth/             # Reset/verification/provider-callback pages
│   ├── billing/          # Gated plans/credit checkout surface
│   ├── appAssistant/     # Gated app-wide assistant and knowledge builder
│   ├── call/             # Gated call history/page
│   ├── characterChat/    # 1:1 character chat
│   ├── creation/         # Card creators (character, world, item, adventure) + shared engine
│   ├── docs/             # In-app documentation viewer
│   ├── gallery/          # Card galleries + media gallery
│   ├── interaction/      # Adventure play (chat, TTS, session snapshot editing)
│   ├── imageProfiles/    # Image model/profile configuration
│   ├── landing/          # Landing page
│   ├── lorebook/         # Lorebook studio and gallery
│   ├── library/          # Workspace Library and collections
│   ├── llmProfiles/      # System/personal profiles and transient BYOK
│   ├── novel/            # Story Studio (long-form writing)
│   ├── profile/          # Account/profile page
│   ├── voices/           # Gated native Voice Studio
│   ├── workspaces/       # Workspace switching/management/navigation
│   └── tasks/            # Background tasks drawer
├── infrastructure/       # API layer: REST client, auth, WebSocket chat client
├── shared/               # Shared types (cards, chat, media, auth) and utilities
├── ui/                   # Design system: primitives, components, audio player
└── utils/                # Cross-feature utilities
```

Architectural notes:

- **Routing** is hand-rolled: `NavigationProvider` holds the current page and `AppRouter` renders it. There is no React Router.
- **State** lives in React context providers — no Redux/Zustand. `DataProvider` caches the selected workspace's content; `WorkspaceProvider` owns the handshake and committed scope, and `LlmSessionProvider` coordinates profile intent and transient credentials. The exact nesting is defined in `AppProvider.tsx`.
- **Workspace transport** is required even when the Workspace R1 product UI is disabled: private requests still carry the protected default workspace, and startup checks backend capabilities. See the [workspace status](docs/workspace_r1/02_current_status_and_findings.md).
- **Chat is WebSocket-based** (`src/infrastructure/api/chatSocket.ts`): a typed envelope (`delta` / `metadata` / `done` / `error`, plus TTS frames) over a per-session socket, authenticated via a bearer subprotocol. Adventure sessions and character chats share the same transport and chat engine.
- **Persistence is server-side** for saved content. localStorage also holds the access token, playlist and UI state, including some editor preferences/drafts; this is not a complete local recovery system. BYOK keys are transient client memory. The refresh token lives in an HttpOnly cookie managed by the backend.

## Getting Started

### Prerequisites

- Node.js `^20.19.0 || ^22.13.0 || >=24` (required by Vite 8 and ESLint 10; enforced via `engines` + `.npmrc` `engine-strict`)
- [pnpm](https://pnpm.io) 11.x — pinned via the `packageManager` field in `package.json`. Run `corepack enable` once and the correct pnpm version is activated automatically; otherwise install it with `npm install -g pnpm@11`.
- A running Magic Worlds API backend (FastAPI) for anything beyond the UI itself.

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd magic-worlds

# Install dependencies
pnpm install

# Start development server (LAN-exposed via --host)
pnpm dev
```

### Configuration

Create a `.env` file in the repo root:

```bash
# Base URL of the backend API (defaults to http://localhost:8000 if unset)
VITE_API_BASE_URL=http://localhost:8000
```

The value may contain a `{hostname}` placeholder (for example
`http://{hostname}:8010`), which resolves to the browser hostname at runtime.
Two browser-auth deployments are supported:

- Local/LAN same-site HTTP: use the hostname placeholder and configure the BFF
  refresh cookie with `SameSite=lax` and `Secure=false`.
- Cross-site production HTTPS: configure the BFF cookie with `SameSite=None`
  and `Secure=true`, and list the exact SPA origin in every credentialed CORS
  allow-list. Wildcard origins are invalid with credentials.

### Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Start the Vite dev server (`--host`, reachable on the LAN) |
| `pnpm build` | Type-check (`tsc -b`) and build for production |
| `pnpm preview` | Preview the production build |
| `pnpm test` | Run the Vitest suite |
| `pnpm lint` | Run ESLint |
| `pnpm storybook` | Start Storybook on port 6006 |
| `pnpm build-storybook` | Build the static Storybook |
| `pnpm typecheck:stories` | Type-check Storybook stories |

## Tech Stack

- **React 19** — UI framework (context + hooks, no external state library)
- **TypeScript** — Type safety throughout
- **Vite 8** — Build tool and dev server
- **Tailwind CSS 4** — Styling, with the custom "Reverie" design system (dark, candlelit palette: ink/parchment/ember/arcane tokens; Cormorant Garamond, Spectral, Hanken Grotesk, Space Mono)
- **TipTap 3** — Rich-text editing (Story Studio, mentions, markdown)
- **lucide-react** — Icon library
- **react-markdown + remark-gfm** — Markdown rendering in chat and docs
- **Vitest + Testing Library** — Unit/component tests (jsdom)
- **Storybook 10** — Component workshop with a11y and docs addons

## Development

### Conventions

- Use TypeScript for all new code
- Keep components small and focused; colocate tests as `*.test.tsx` next to the source
- Components in `src/ui` should have Storybook stories (`*.stories.tsx`)
- Reuse design-system primitives (`src/ui/primitives`) — Button, Modal, Drawer, PageHeader, GlowBackdrop, etc. — instead of one-off styling
- The `@` import alias resolves to `src/`

### Adding a New Feature

1. Create a new folder in `src/features/` with its components, hooks, and types
2. Export the public surface from the feature's `index.ts`
3. Register the page in `src/app/router/AppRouter.tsx` and the navigation state in `NavigationProvider`
4. Add API calls to `src/infrastructure/api` and shared types to `src/shared/types`

### Project Docs

The `docs/` folder at the repo root holds product and technical design notes (billing model, card enrichment, lorebooks, Story Studio architecture, chat image delivery, known issues). The in-app docs viewer lives in `src/features/docs`.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes following the project structure
4. Test your changes (`pnpm test`, `pnpm lint`)
5. Submit a pull request

## License

This project is licensed under the MIT License.
