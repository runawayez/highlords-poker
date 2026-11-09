# Development environment

This guide is for contributors and maintainers working on the source code. Players use the [official Highlords Poker website](https://highlords-poker.vercel.app); the creator handles its hosting and operation.

## Requirements

- Node.js 24 LTS
- pnpm 11.25.0

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open the Vite URL. Use separate browser profiles or an incognito window for independent players; tabs in one profile share an anonymous session. The local adapter requires no external service account or API key.

```sh
pnpm check                 # TypeScript, ESLint, unit/integration tests and production build
pnpm test:e2e              # Browser tests; requires Playwright Chromium
pnpm format:check          # Formatting validation
pnpm build                 # Production frontend build
pnpm start                 # Frontend + API with durable SQLite, default port 3001
```

Copy `.env.example` to `.env` when configuring the local server. Never commit `.env` or `.data`. SQLite defaults to `.data/poker.sqlite`; exactly one server process must own each database.

## Source map

| Location                     | Responsibility                                                 |
| ---------------------------- | -------------------------------------------------------------- |
| `apps/web`                   | React/Vite interface and local translations                    |
| `apps/local-server`          | Node HTTP, authenticated WebSocket and SQLite storage          |
| `apps/worker`                | Cloudflare Worker, Durable Object, sockets and alarms          |
| `packages/poker-engine`      | Deck, hand evaluation, betting and pot settlement              |
| `packages/tournament-engine` | Table balancing, blind clocks and prizes                       |
| `packages/contracts`         | Shared validation schemas and commands                         |
| `packages/server`            | Anonymous identity, room orchestration, views and transactions |
| `tests`                      | Rules, service, network and browser verification               |

See [architecture](architecture.md), [testing](testing.md), [security](threat-model.md) and [maintainer deployment](deployment.md) for details. Instructions here describe development and operation, not requirements for players.
