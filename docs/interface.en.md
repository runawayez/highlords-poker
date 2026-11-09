# Interface and game experience

[Português](./interface.md) | **English**

Highlords keeps its red and black identity with green felt, gold chips and clear primary actions. The table is visible before play; the local player's seat stays at the bottom during a hand. Dedicated 2–9 player layouts keep seats clear of the community cards.

Room creation groups Format, Structure and Review with a live seat/stack/big-blind-depth preview, Casual/Turbo/Deep stack presets and a structured blind-level editor. Cash presets affect stack and action time; level duration applies to tournaments. The preview uses the server's table-balancing function. Final assignments can change as players join or leave.

The room has Players, Chat and Structure panels, a prominent Deal cards control, empty-seat bot shortcuts, host bot management, standings and confirmed moderation. Host pause/resume commands validate role and status atomically without rejecting an intervening bot turn; betting still requires the current version. The table highlights turns, timers, dealer, bets and winners. Betting shortcuts clamp amounts to legal limits; top-ups and leaving use application dialogs. All chips remain virtual. Rules, deck generation, card privacy and payout policy are unchanged.

Design references: [247 Free Poker](https://www.247freepoker.com/), [Poker Now Club Tournaments](https://www.pokernow.com/blog/club-tournaments) and [Replay Poker lobby](https://replayhelp.casino.org/hc/en-us/articles/360001875053-Understanding-the-lobby). No third-party branding, images or code is reused.

Validation: `pnpm check` and `pnpm test:e2e`, including two independent sessions, bots, tournament editing, blind validation, room panels, 1440px/390px layouts, nine-seat overlap and horizontal overflow checks. Browser screenshots are available in the GitHub Actions `interface-previews` artifact.
