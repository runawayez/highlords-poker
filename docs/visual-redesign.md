# Highlords Poker — Obsidian & Crimson visual layer

The premium presentation is implemented entirely in `apps/web/src/premium.css`, imported after the legacy styles in `main.tsx`. The TypeScript poker engine, WebSocket contracts, persistence, i18n, lobby, chat, and learning pages are unchanged.

## Design choices
- Desktop arena ratio 1.48 instead of 1.65 to avoid an overly flat felt. The inner table has proportional insets and does not depend on the size of the action tray.
- On portrait screens the established 0.68 table-shell ratio remains, with its own rule set.
- Crimson/obsidian materials, restrained ivory cards, muted borders and darker chips; no dependency on third-party assets or code.
- Existing CSS selectors and component contracts are maintained; no server change or migrations.

## QA release gates (must run before declaring the rollout validated)
1. `pnpm install --frozen-lockfile && pnpm check`
2. `pnpm test:e2e` with the local server configured.
3. Inspect 1920×1080, 1366×768, 2560×1440, 768×1024, 390×844 and 360×740 with 2/6/9 players.
4. Verify that cards, opponent hole cards, stacks and bet markers never cover the five-card board, pot or local actions.
5. Test Raise slider, all-in, rebuys, side pots, showdown, chat/drawer, Portuguese/English switches and reconnection.
6. Check reduced-motion and keyboard focus; review actual screenshots before production rollout.

## Upstream references and license policy
- The Booth (MIT): inspiration for scene occupancy, poker materials and purposeful animation.
- Elite Poker (MIT): inspiration for independent React lobby/table UI parts.
- PokerTH Web Client (AGPL): product and QA reference only. No code imported.
No external code or assets have been copied into this visual layer.

**Status:** design-layer changes staged for review. Automated browser runs and screenshots are not claimed by this document.
