# ADR 002 — Uma mesa por Durable Object, um Worker

**Status:** aceita (novembro de 2026). Substitui o coordenador único da ADR 001.

## Contexto

O coordenador global existia para transferir jogadores entre mesas de torneio multimesa de forma atômica. Isso forçava
um único ponto de serialização para todas as salas, sessões globais com hash e polling.

## Decisão

- Remover torneios multimesa; manter cash game e Sit & Go (uma mesa).
- Um Durable Object por sala, WebSocket hibernável e relógio por alarme.
- Site e API no mesmo Worker; sem Vercel e sem CORS.
- Identidade por chave secreta do navegador, sem sessões no servidor.
- P2P puro descartado: poker precisa de um embaralhador confiável, sobrevivência da mesa quando o criador sai e
  conexões estáveis em celular (NAT). O servidor continua autoritativo.

## Consequências

Salas isoladas e escaláveis por construção; menos código (~metade). Perdemos torneios multimesa e a migração não
preserva mesas ativas. O motor, os bots e as páginas de aprendizado foram mantidos.
