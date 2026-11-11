# Highlords Poker — interface redesign

Implemented on 11 November 2026. Branding remains black, white and crimson; gameplay and multiplayer authority stay on the existing backend.

## Research and decisions

- [PokerNow](https://www.pokernow.com/): create a table, share a link and play without an account. The invitation is now a visible room action.
- [ClubGG lobby/table creation improvements](https://www.clubgg.com/post/clubgg-october-21-update-notes): separate table discovery, configuration and room interaction. Home introduces the club; `/mesas` owns search and filtering; creation has format, structure and review steps.
- [GGPoker Smart Betting](https://ggpoker.com/poker-games/smart-betting/): use explicit amounts and useful bet shortcuts. Half-pot, pot and double-pot are now visibly distinct.

## Implementation

One stylesheet replaces seven accumulated legacy stylesheets. Layouts use normal document flow and a responsive table arena, with independent positions for seats, community cards, private cards and bets. Opponents' cards are attached to their seat, rather than floating over unrelated parts of the arena. On phones, the table height leaves room for decisions; chat opens as a dismissible bottom panel. The room menu closes when selecting an action. Management, learning, profile and appearance dialogs share the same visual system.

Room creation keeps its live preview on desktop and offers an expandable live preview on phones. Continuing into review cannot accidentally submit the form; Enter advances the current step before final submission. Empty lobby states offer a useful next action. The initial connection probe no longer flashes an unavailable banner before its first result.

## Validation

- TypeScript, ESLint, unit/integration tests and production build.
- Browser inspection of desktop home and a live nine-player room with eight bots.
- Actual embedded viewports at 390 × 844 and 360 × 844: home, lobby, creation, full table and chat. Document width, board and seat bounds inspected for overflow/overlap.
- Live room creation, bot fill, deal, pause, language change during the hand and message delivery.
- End-to-end selectors and geometry expectations updated for the new navigation, progressive creation, room menu and phone chat.

The temporary responsive inspection page is excluded from the deliverable. No paid dependencies, external fonts, runtime image generation or hosting migrations were introduced.

The initial CI attempt could not install Ubuntu font packages because the runner failed to resolve Ubuntu archive hosts. CI uses its preinstalled stable Google Chrome through Playwright's `chrome` channel, verifies that Chrome is present, and still executes the complete browser suite; local Playwright keeps its bundled Chromium default.
