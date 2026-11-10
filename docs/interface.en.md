# Interface and game experience

[Português](./interface.md) | **English**

Highlords keeps its red and black identity with green felt, gold chips and clear primary actions. The table is visible before play; the local player's seat stays at the bottom during a hand. Dedicated 2–9 player layouts keep seats clear of the community cards.

Room creation groups Format, Structure and Review with a live seat/stack/big-blind-depth preview, Casual/Turbo/Deep stack presets and a structured blind-level editor. Cash presets affect stack and action time; level duration applies to tournaments. The preview uses the server's table-balancing function. Final assignments can change as players join or leave.

The room has Players, Chat and Structure panels, a prominent Deal cards control, empty-seat bot shortcuts, host bot management, standings and confirmed moderation. Host pause/resume commands validate role and status atomically without rejecting an intervening bot turn; betting still requires the current version. The table highlights turns, timers, dealer, bets and winners. Betting shortcuts clamp amounts to legal limits; top-ups and leaving use application dialogs. All chips remain virtual. Rules, deck generation, card privacy and payout policy are unchanged.

Design references: [247 Free Poker](https://www.247freepoker.com/), [Poker Now Club Tournaments](https://www.pokernow.com/blog/club-tournaments) and [Replay Poker lobby](https://replayhelp.casino.org/hc/en-us/articles/360001875053-Understanding-the-lobby). No third-party branding, images or code is reused.

Validation: `pnpm check` and `pnpm test:e2e`, including two independent sessions, bots, tournament editing, blind validation, room panels, 1440px/1366px/390px layouts, nine-seat overlap and horizontal overflow checks. Browser screenshots are available in the GitHub Actions `interface-previews` artifact.

## Learning and decisions

How to play, Hand rankings and Help are standalone routes requiring no profile. They include an interactive walkthrough, ten illustrated hand examples and a searchable glossary. Inside a room, guides open in a dialog while the connection and game remain active; viewing help does not pause your turn timer.

Your two private cards appear inside the felt near your bottom seat. Optional help names the best combination already available and highlights its five cards. Its only inputs are your own cards and the public board; it does not estimate odds. The preference is local. Call and raise buttons show chip amounts; “Raise to” is the total round bet. Invitation, export, leave and close actions live under Room options; pause/resume stays visible.

Tournaments show remaining players, tables, next blinds and a final podium. Animation respects reduced motion; the turn sound remains optional in the profile. Both languages cover the same features.

Teaching reference: [PokerStars — Texas Hold’em](https://www.pokerstars.com/pt-BR/poker/games/texas-holdem/?no_redirect=1). Original content and examples; no reference imagery or text is reused.

## Immersive layout

The home illustration uses a horizontal table with no rotation. `/mesas` is the dedicated lobby with real filters and presence. The game arena fits the available viewport while preserving its aspect ratio; phones use a more vertical table. Controls have their own region and do not cover cards or seats. Browser tests verify card containment, seat overlap and viewport overflow.

**Manage room** and **Chat** open a side dialog with keyboard focus containment and Escape dismissal. Players, bots, structure, history, time bank, top-ups and add-on remain connected to the server. Clicking a seat opens the selected participant. Guides are available from Room options without leaving the game.
