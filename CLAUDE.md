# HGL Poker

Clube de Texas Hold'em no navegador: sem login, fichas virtuais, uma mesa por sala.

## Arquitetura (resumo)

- `packages/poker-engine`: regras puras do NLHE (sem I/O). Fonte de verdade das mãos.
- `packages/poker-bot`: decisões dos bots (só vê as próprias cartas e a mesa).
- `packages/contracts`: schemas zod e tipos do protocolo cliente-servidor.
- `packages/server`: `room.ts` (estado e regras da sala, puro), `runtime.ts` (sockets + persistência + relógio,
  agnóstico de plataforma), `lobby.ts` (registro de salas públicas).
- `apps/worker`: Cloudflare Worker. Serve o site (assets) e roteia `/api/*` para um Durable Object **por sala**
  (`PokerRoom`) e um `Lobby` singleton.
- `apps/local-server`: o mesmo runtime em Node (`ws`) para desenvolvimento e testes.
- `apps/web`: React + Vite. CSS único em `src/styles.css`, áudio sintetizado em `src/audio.ts`.

Identidade: o navegador gera uma chave secreta (`localStorage`); o servidor guarda só o hash. Não há contas.

## Comandos

`pnpm dev` (servidor local + Vite), `pnpm check` (typecheck, lint, testes, build), `pnpm test:e2e` (Playwright).

## Regras do projeto

- Cartas dos outros jogadores nunca saem do servidor antes do showdown (`publicHand`).
- Toda mudança no motor exige o teste de fuzz (`tests/engine-fuzz.test.ts`) verde: conservação de fichas.
- Cada sala é um Durable Object; nada de estado global compartilhado entre salas além do Lobby.
- Textos de interface passam por i18n (pt-BR e en); `tests/i18n.test.ts` valida paridade.
- Fichas e prêmios são fictícios. Nunca introduzir dinheiro real.
