---
name: highlords-poker
description: Contexto e convenções do HGL Poker (clube de Texas Hold'em servidor autoritativo, 1 Durable Object por sala). Use ao mexer em sala, protocolo, runtime, lobby, worker ou front-end do jogo.
---

# HGL Poker — mapa do projeto

## Fluxo de uma mensagem

1. Cliente abre WebSocket em `/api/rooms/:id/ws` e envia `HELLO {key, profile, password?}`.
2. `RoomRuntime.message()` valida com zod e chama `RoomEngine.command(playerId, command, now)`.
3. O runtime persiste o estado, reprograma o alarme (`engine.nextWake()`) e envia a cada conexão o `view()` dela.
4. Alarmes chamam `engine.tick(now)`: timeouts de vez, bots, próxima mão, pausa por ausência, expiração.

## Onde mexer

| Quero mudar                               | Arquivo                                       |
| ----------------------------------------- | --------------------------------------------- |
| Regra de aposta/showdown                  | `packages/poker-engine/src/index.ts` (+ fuzz) |
| Fluxo da sala (entrar, sentar, bots, SNG) | `packages/server/src/room.ts`                 |
| Protocolo/validação                       | `packages/contracts/src/index.ts`             |
| Sockets, persistência, alarmes            | `packages/server/src/runtime.ts`              |
| Rotas HTTP e Durable Objects              | `apps/worker/src/index.ts`                    |
| Mesa (visual)                             | `apps/web/src/table.tsx`, `styles.css`        |
| Sons                                      | `apps/web/src/audio.ts`                       |

## Checklist antes de concluir

`pnpm typecheck && pnpm lint && pnpm test && pnpm build`. Para UI, rode `pnpm dev` e confira desktop (1280) e
celular (390×844) com o Playwright MCP.
