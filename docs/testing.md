# Verification

`pnpm check` runs TypeScript, ESLint, Vitest and the production Vite build. `pnpm format:check` verifies formatting. CI repeats these and installs Chromium for Playwright.

Rules tests cover all hand categories, kickers/wheel/ties, heads-up order, invalid actions, short/cumulative raises, all-in runouts, uncalled chips, split pots/odd chips, private projections and 2,000 randomized 2–9-player hands with nonnegative integer stacks, unique cards and chip conservation.

Service tests cover restart recovery, durable-write failure rollback, serialized concurrent commands, stale versions, idempotency, password secrecy, nickname impersonation, host permissions, plain-text chat/spam/mute, secret-free export, multitable assignments, empty-room pause, blind-clock freezing, configuration validation and preference catalog parity. A full nine-player tournament test restores the service at hand barriers and checks chips, unique assignments, final survivor and the virtual prize pool. Rebuy/add-on tests check retained receipts.

Transport integration launches a real Node server with a temporary SQLite database, uses three independent HTTP sessions and authenticated WebSockets, checks each private/spectator view, rejects an unwanted Origin and restarts the child process while a hand is active. Temporary data is cleaned afterwards.

`pnpm test:e2e` uses separate browser contexts for two players. It covers profile creation, room entry, starting a hand, chat, language change during a hand, refresh/reconnection, preferences and mobile viewport overflow. It is intended for local/CI execution with Playwright's Chromium installed (`pnpm exec playwright install chromium`).

Manual browser validation in this implementation used the managed preview for profile, lobby, room creation, chat, language change and refresh persistence. Typecheck, local server transport and Worker bundle checks do not replace a live Cloudflare deployment test. There is no independent security audit, provider load certification or unlimited-availability claim.

For bounded load verification run `node --import tsx tests/load/club.ts`. It measures the pure engine's time to create a nine-seat hand, complete hands and project snapshots for all seats; this is a local baseline, not a public-hosting capacity forecast. Do not raise production caps from this result alone.
