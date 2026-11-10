# Highlords Poker — experience redesign

This revision introduces a deliberately structured poker client rather than a recolored landing page.

- **Lobby:** desktop tabular table list with category, blind stakes, seat occupancy, game state, and join/watch actions; contextual learning panel; mobile two-column information hierarchy.
- **Table:** stable rail proportions, warmer cards, consistent thin card framing and stronger highlighting of the player's best five, readable action separation.
- **Identity:** Obsidian & Crimson with restrained gold/ivory accents. No third-party assets or AGPL source copied.
- **Compatibility:** existing anonymous nickname, room permissions, real-time protocol, translations and backend kept unchanged.

## Verification checklist
Run `pnpm check` and `pnpm test:e2e`. Inspect populated 2/6/9-seat rooms at desktop and portrait viewports, under both languages. Check interaction with lobby filters, Join/Watch, room drawer and Raise controls. The commit does not claim that browser validation was executed by the author.
