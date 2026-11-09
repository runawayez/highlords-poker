# Highlords Poker ♠

[Português (Brasil)](README.md) | **English**

A free, anonymous multiplayer poker club for the browser. React + TypeScript, server-authoritative no-limit Texas Hold'em, virtual chips only, Portuguese (default) and English.

## Run locally

Requires **Node.js 24 LTS** and **pnpm 11.25.0**.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open the Vite URL, choose a nickname, create a table and invite friends. Use another **browser profile / incognito window** for another player; tabs in the same browser intentionally share a session. No accounts or external service keys are needed locally.

```sh
pnpm check                 # TypeScript, ESLint, rules/integration tests, production build
pnpm test:e2e              # Playwright multi-browser journey; installs browsers separately
pnpm format:check
pnpm build
pnpm start                 # Serves frontend + API on port 3001 with durable SQLite
```

Copy `.env.example` to `.env` for the production local server. The development runner also reads `.env`. Never commit `.env` or `.data`. Database defaults to `.data/poker.sqlite`. One server process owns the database; do not run clustered replicas against this adapter.

## Included behavior

- Public room lobby, filters, password-gated rooms, direct invitation URLs and spectators.
- 2–9 player cash tables, Sit & Go, multi-table tournaments up to 90 entrants.
- Blinds, individual antes, secure shuffle, private hole cards, all streets, timers/time bank, fold/check/call/raise/all-in, short raises, side pots and split pots.
- Buy-in bounds, cash top-ups, limited rebuys, one add-on, late registration, blind levels, breaks, pause/resume, eliminations, virtual payouts and final-table balancing.
- Recoverable sessions and hands, typed commands, state versions, deduplication, persist-before-ack and transaction rollback on write failure.
- Lobby/room/tournament chat, reactions, host mute/kick/ban and host-visible reports.
- Local avatars, frames, accents, table/card/chip themes, optional turn sound, local wins, preference import/export without credentials.
- Local static translations via i18next, Portuguese on first visit regardless of browser language, remembered language choice, accessible language selector, keyboard dialogs, mobile layout and reduced-motion support.
- Node + SQLite adapter and Cloudflare Worker + SQLite-backed Durable Object adapter sharing the same rules and service.

## Project map

| Location                     | Responsibility                                                           |
| ---------------------------- | ------------------------------------------------------------------------ |
| `apps/web`                   | Vite/React UI and local translation catalogs                             |
| `apps/local-server`          | Node HTTP, authenticated WebSocket and SQLite storage                    |
| `apps/worker`                | Cloudflare routing, Durable Object storage, sockets and alarms           |
| `packages/poker-engine`      | Provider-independent deck, evaluation, betting and pots                  |
| `packages/tournament-engine` | Balancing, level clock and prize allocation                              |
| `packages/contracts`         | Shared schemas and commands                                              |
| `packages/server`            | Anonymous identity, room orchestration, projection and transactions      |
| `tests`                      | Rule tests, randomized hands, durable service, network and browser tests |
| `docs`                       | Architecture, house rules, security, operations and deployment           |
| `PROJECT.md`                 | Original product brief, preserved as supplied                            |

Read [house rules](docs/game-rules.md), [architecture](docs/architecture.md), [deployment](docs/deployment.md) and [verification](docs/testing.md) before operating a public instance.

## Publish for friends

The frontend can be imported using [Publish on Vercel](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Frunawayez%2Fhighlords-poker&env=VITE_API_URL&project-name=highlords-poker&repository-name=highlords-poker). Set `VITE_API_URL` to your **already deployed** backend URL. Vercel alone serves the interface; it does not run this project's durable multiplayer backend.

Publish the Cloudflare Worker on Workers Free, allow the exact frontend origin in `ALLOWED_ORIGINS`, set its URL on Vercel, and rebuild the frontend. Follow the [deployment guide](docs/deployment.md). Until the backend is connected, there is no playable public multiplayer link.

## Deployment and cost

The repository does **not** provision paid infrastructure, enable billing, or automatically deploy on a push. CI validates code only. [Deployment instructions](docs/deployment.md) cover Vercel static frontend + Cloudflare Workers Free, and self-hosting. Free services have finite quotas and may fail when exhausted. Local software needs no paid services; running your own hardware is not a promise of zero electricity/internet cost.

Cloud hosting requires the operator's provider accounts, origin configuration and explicit verification of the Free plan. No card, paid upgrades, paid translation API, analytics, real deposits, withdrawals or real prizes are part of this project.
