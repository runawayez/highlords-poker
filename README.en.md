# Highlords Poker ♠

[Português (Brasil)](README.md) | **English**

**Poker with friends, right in your browser.** Highlords Poker is a free Texas Hold'em website hosted and maintained by [Matheus Martins (Berkas)](https://github.com/runawayez). Choose a nickname, customize your profile and gather your friends around a table, with no sign-up or installation.

### [Visit Highlords Poker →](https://highlords-poker.vercel.app)

> **Status:** multiplayer is deployed and connected. Room creation, a hand with two independent sessions, chat and reconnection have been verified on the public website.

## How it works

To play:

1. Visit the website and choose your nickname and avatar.
2. Create a table or join a room from the lobby.
3. Share the room link with your friends.
4. Play and talk through the table chat.

The project's creator handles hosting and operation. **Players use the official website directly in their browser.**

## The experience

- **No-limit Texas Hold'em:** tables for 2–9 players, blinds, antes, all-ins, side pots and split pots.
- **Different formats:** virtual-chip cash games, Sit & Go and multi-table tournaments.
- **Your table, your settings:** optional passwords, stacks, buy-ins, rebuys, add-ons, blind levels and breaks.
- **Poker with friends:** a public lobby, room invitation links, spectators, room-only chat and reactions.
- **Customizable profiles:** nickname, avatar, frame, accent color, tagline, table theme and card back.
- **Recoverable sessions:** return to your seat and cards in the same browser while your session and local credential remain valid.
- **Portuguese and English:** Brazilian Portuguese on the first visit, with a language selector and a saved preference.
- **Desktop and mobile:** a responsive interface with keyboard-accessible controls.

**All chips and prizes are fictional.** There are no deposits, withdrawals, monetary wagers or real prizes.

## About this repository

This is the **public source code of the Highlords Poker website**, maintained here for reference, transparency and development tracking. Players use the official website to play.

Suggestions and bug reports are welcome through the [project's issues](https://github.com/runawayez/highlords-poker/issues). Describe what happened, what you expected and, when possible, how to reproduce it. Never include session credentials or private cards from a hand in progress.

## Technical documentation

For readers who want to study the code or contribute to development:

- [Development environment](docs/development.en.md)
- [Architecture](docs/architecture.en.md)
- [House rules](docs/game-rules.en.md)
- [Testing and verification](docs/testing.en.md)
- [Internationalization](docs/i18n.en.md)
- [Security](docs/threat-model.en.md)
- [Maintainer operations and deployment](docs/deployment.en.md)

The links above open the English technical references. The original product brief is preserved in [PROJECT.md](PROJECT.md).

## Bots

Before dealing, the host can add up to eight bots, choose Easy, Medium or Hard, fill the table with bots, and remove them. Friends and bots can share a room in all three formats. Bots follow the same rules and only see their own cards and the public board. Strategies and bounded simulations run on the server without paid AI services; Hard is not a professional poker player.

Bots use virtual chips and do not automatically rebuy or take add-ons. Games pause when all humans disconnect. This feature requires updating both the Worker and the frontend.
