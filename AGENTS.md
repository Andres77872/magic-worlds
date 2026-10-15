# magic-worlds

React 19 + Vite + Tailwind CSS v4 + TypeScript SPA (AI roleplay frontend) with Storybook. Package manager: **pnpm** (not npm/yarn). Imports use the `@/` alias for `src/`.

## Project structure

```
src/
├── app/                    # App shell. App.tsx = <ErrorBoundary><AppProvider><AppRouter/></AppProvider></ErrorBoundary>
│   ├── providers/          # App-level React contexts + reducers; AppProvider.tsx nests 14 providers (order below)
│   ├── hooks/              # useAuth, useData, useNavigation, useApiStatus, useBackgroundTasks, usePlaylist,
│   │                       #   useLanguage, useWorkspace, useCookieConsent, useFloatingWindows, usePageFocus, …
│   ├── i18n/               # i18next setup, supported languages (en, es), per-domain locales/
│   ├── bootstrap/          # Pre-render bootstrap (api.auth email deep links)
│   └── router/             # AppRouter.tsx — hand-rolled router (no React Router), switches on Navigation page state
├── features/               # Feature modules (one folder each):
│   │                       #   admin (root consoles: voices, agents, creditCodes = credit tokens, membership =
│   │                       #   plans / members / usage), appAssistant (in-app assistant), auth (email verify,
│   │                       #   password reset, Google callback), billing (plans & credits), call (voice calls),
│   │                       #   cards (preview modal), characterChat (1:1 chat), codex (codex card picker),
│   │                       #   creation (character/world/item/adventure creators + shared engine), docs (guide +
│   │                       #   roadmap), errorPages, floatingWindows, gallery (+ media), imageProfiles,
│   │                       #   interaction (adventure play loop), landing, legal (+ 18+/Terms attestation),
│   │                       #   library (+ collections, creation origin), llmProfiles (+ LlmSession), lorebook,
│   │                       #   notifications, novel (Story Studio, TipTap), profile, safety (crisis resources,
│   │                       #   break nudges), tasks (background-job drawer), voices (voice studio, presets,
│   │                       #   catalog), workspaces (workspace switching, origin navigation)
├── infrastructure/api/     # Backend layer: index.ts (apiService singleton), chatSocket.ts (per-session
│   │                       #   WebSocket), voiceSocket.ts (voice-call WebSocket), sse.ts, baseUrl.ts (env
│   │                       #   resolution), *Contract.ts (wire parsers), useAuthenticatedMediaUrl.ts, __tests__/
├── shared/                 # types/ (per-domain *.types.ts + barrel index.ts), cross-feature hooks/, voice/
│   │                       #   helpers, feature flags (featureFlags.ts, *FeatureFlag.ts), workspaceStorage.ts
├── ui/                     # Design system: primitives/, components/ (Sidebar, modals, audio/PlaylistDock),
│   │                       #   styles/theme.css (Reverie tokens), docs/ (Storybook MDX)
├── utils/                  # cardTransforms, characterRoles, chatSegments, chatTitle, displayName, download,
│   │                       #   errors, frameBatch, motion, time, uuid
├── assets/                 # brand/ (logo, wordmark) + marketing/ (page imagery)
├── test/                   # setup.ts (Vitest/testing-library setup) + shared fixtures; helpers in test-utils/
└── main.tsx                # Entry point (createRoot → <App/>)
```

Provider nesting (outermost → innermost, `src/app/providers/AppProvider.tsx`): **ApiStatus → Auth → LlmSession → Language → Workspace → Navigation → OriginNavigation → CreationOrigin → CookieConsent → Data → BackgroundTasks → AudioPlaylist → FloatingWindows → Attestation**. Four of them live in feature folders: LlmSession (`features/llmProfiles`), OriginNavigation (`features/workspaces`), CreationOrigin (`features/library`), Attestation (`features/legal/attestation`). State is React-context only — no Redux/Zustand.

## Commands

- `pnpm dev` — dev server
- `pnpm test` — vitest (jsdom + testing-library)
- `pnpm build` — typecheck + production build (**the real green/red signal**)
- `pnpm lint` — eslint. Caveat: pre-existing React-Compiler rule errors — lint redness is not necessarily caused by your change.
- `pnpm storybook` — Storybook on :6006
- `pnpm typecheck:stories` — typecheck story files (run after editing `*.stories.tsx`)

## Dependencies

Source of truth: `package.json`. Path alias `@/` → `src/` is defined in `vite.config.ts`, `tsconfig.app.json`, and `vitest.config.ts`.

- **Package manager / runtime:** pnpm `>=11 <12` (pinned `pnpm@11.5.1`, `engine-strict=true` via `.npmrc`); Node `^20.19 || ^22.13 || >=24`.
- **Core runtime deps:** React 19 (`react`/`react-dom` ^19.2) · Tailwind CSS v4 (`tailwindcss` + `@tailwindcss/vite`) · TipTap 3 editor stack (`@tiptap/core`, `react`, `starter-kit`, `markdown`, `mention`, `suggestion`, `typography`, `placeholder`, `pm`) for the novel editor · `lucide-react` (icons) · `react-markdown` + `remark-gfm` (markdown rendering).
- **Build / tooling (dev):** Vite 8 + `@vitejs/plugin-react` · TypeScript ~6.0 · Vitest 4 + `jsdom` + `@testing-library/react`/`jest-dom` · ESLint 10 + `typescript-eslint` + `eslint-plugin-react-hooks`/`react-refresh` · Storybook 10 (`@storybook/react-vite`, `addon-docs`, `addon-a11y`).

## UI work: read the skills first

Project skills live in `.agents/skills/` (`.claude/skills/` is a symlink to the same directory):

- **ui-design-system** (`.agents/skills/ui-design-system/SKILL.md`) — the Reverie look & feel: design tokens, color/typography/motion rules, ember-vs-arcane semantics. Read before styling anything. Tokens live in `src/ui/styles/theme.css`; never hardcode colors/fonts/shadows.
- **ui-components** (`.agents/skills/ui-components/SKILL.md`) — primitive/component catalog and composition recipes (pages, forms, overlays, card grids). Read before building any screen, form, or dialog. Reuse primitives before writing new markup.
- **ui-storybook** (`.agents/skills/ui-storybook/SKILL.md`) — story conventions and copy-paste templates. Read before touching `*.stories.tsx`, `.storybook/`, or `src/ui/docs/`.

## Architecture & backend integration

This SPA is the frontend of a multi-service stack. It talks to exactly one backend (`magic-worlds-api`), which fans out to the other services over HTTP.

```
Frontend (this repo: React 19 SPA)
  └─ VITE_API_BASE_URL (dev :8010) ─▶ magic-worlds-api  (FastAPI + MySQL/aiomysql — the BFF)
        ├─ HTTP ─▶ api.auth         login/register/refresh/validate (JWT + rotating refresh, argon2, Redis)
        ├─ HTTP ─▶ api.magic_llm     POST /v1/chat/completions with inline agent graphs ("agt")
        │             ├─ imports ─▶ magic-agents   graph runtime (run_agent, node system)
        │             └─ imports ─▶ magic-llm      provider abstraction (OpenAI/Anthropic/Google/MiniMax…)
        └─ direct ─▶ fal.ai (images · theme songs: fal-ai/ace-step, minimax/music-3) · ElevenLabs (TTS: narration, previews, calls)
```

- **Frontend → backend.** All traffic goes through the `apiService` singleton (`src/infrastructure/api/index.ts`). The base URL comes from `VITE_API_BASE_URL` (`.env`); a literal `{hostname}` placeholder is replaced at runtime with `window.location.hostname` (default fallback `http://localhost:8000`, dev value `:8010`). Local/LAN same-site HTTP uses `SameSite=lax` + `Secure=false`; cross-site production requires HTTPS, `SameSite=None` + `Secure=true`, and the exact SPA origin in credentialed CORS allow-lists. The access token lives in `localStorage` (`magic_worlds:token`); refresh rides the HttpOnly cookie. `AuthProvider` syncs on the `auth:expired` (terminal) and `auth:refreshed` (new token) custom events; a 401 triggers an automatic refresh-and-retry.
- **Real-time chat.** `ChatSocket` (`src/infrastructure/api/chatSocket.ts`) opens one WebSocket per session at `{ws}/<basePath>/<sessionId>/ws`, where `basePath` is `adventure-sessions` or `character-chats` (identical frame protocol, URL differs). Auth is the Bearer token passed via the `Sec-WebSocket-Protocol` subprotocol (browsers can't set WS headers). Server frames are a typed envelope: `delta` (text chunk) / `metadata` / `image` / `done` / `error`; 25s heartbeat with backoff reconnect.
- **magic-worlds-api** — the only backend the frontend calls. FastAPI on `APP_PORT` (default 8000, `:8010` in this dev setup), MySQL via raw SQL over `aiomysql` (no ORM). Its routers mirror the frontend features: `/auth`, `/user`, cards (`/characters`, `/worlds`, `/items`, `/adventure-templates`), `/adventure-sessions`, `/character-chats`, `/images`, `/tts`, `/theme-songs`, `/lorebooks`, `/stories`, `/tasks`, `/assistant` (kinds `card`, `lorebook`, `app`). It **does not import** `magic-agents`/`magic-llm` (enforced by tests) — it calls `api.auth` and `api.magic_llm` over HTTP and ships server-owned JSON agent graphs from `src/agent_graphs/`.
- **api.auth** — issues JWT access tokens + rotating refresh tokens (argon2 hashing, Redis-backed). `magic-worlds-api` validates tokens against it with a TTL cache + circuit breaker; login/register require `PROJECT_HASH` / `USER_GROUP_HASH`.
- **api.magic_llm** — an OpenAI-compatible "agents API". The backend posts inline agent graphs to `POST /v1/chat/completions` for AI card generation, adventure/character chat, and the card/lorebook assistants. Internally it runs `magic-agents` (the graph runtime — `run_agent`, node system) over `magic-llm` (multi-provider LLM client; also embeddings/TTS).
- **Media.** Images and theme songs via fal.ai (theme songs: the client picks `model_alias` `minimax_music_3` | `ace_step` plus an optional `instrumental` flag; the backend writes each model's own tags/prompt + lyrics with a per-model LLM writer graph and transcodes the provider WAV to an owned MP3); narration TTS via ElevenLabs (voice calls stream ElevenLabs audio in real time). These are async **jobs** — the frontend surfaces them through `BackgroundTasksProvider` and fetches finished assets as authed blobs.

**Key env vars.** Frontend: `VITE_API_BASE_URL` (+ optional `VITE_AI_CARD_CLIENT_TIMEOUT_MS`). Backend (`magic-worlds-api/.env`, see its `.env.example`): required `CORS_ORIGINS`, `AUTH_API_URL`, `MAGIC_LLM_API_URL`, `MYSQL_PASSWORD`; route-gated `PROJECT_HASH`, `USER_GROUP_HASH`; profile transport `LLM_PROFILES_ENABLED`, `MAGIC_LLM_DELEGATION_API_KEY`; media `FAL_KEY`; voice `ELEVENLABS_KEY_*`, `VOICE_LAST_RESORT_VOICE_KEY`; runtime `APP_PORT`, `MYSQL_*`. No env var selects an LLM model: chat, cards, novel, assistants, extraction and the internal image/theme-song writers resolve published profiles.

The sibling backend repos live at `/home/andres/PycharmProjects/{magic-worlds-api,api.auth,api.magic_llm,magic-agents,magic-llm}` — separate projects, not part of this repo's build or `node_modules`.
