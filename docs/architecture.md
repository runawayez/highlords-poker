# Arquitetura

## Visão geral

```
navegador ──HTTPS──► Worker ──┬─► Lobby (Durable Object único: lista de mesas públicas)
    │                         └─► PokerRoom (um Durable Object por mesa)
    └────WebSocket /api/rooms/:id/ws ─────────────┘
```

- **Um Worker, um domínio.** Os assets do site (`apps/web/dist`) e `/api/*` saem do mesmo Worker. Sem CORS, sem segundo host.
- **Uma mesa = um Durable Object.** Mesas são isoladas: nenhum estado global entre elas, nenhuma fila compartilhada.
- **Servidor autoritativo.** `RoomEngine` aplica cada comando, valida a vez e envia a cada conexão a `view()` dela
  (cartas alheias e baralho nunca saem antes do showdown).
- **Sem contas.** O navegador gera uma chave secreta (`localStorage`). O servidor guarda apenas `sha256("player:"+chave)`
  truncado como id do jogador.

## Camadas

| Camada     | Arquivo                            | Responsabilidade                                                                  |
| ---------- | ---------------------------------- | --------------------------------------------------------------------------------- |
| Regras     | `packages/poker-engine`            | Mão de NLHE pura e determinística (recebe o baralho)                              |
| Sala       | `packages/server/src/room.ts`      | Assentos, bots, relógio de vez, pausa, expiração, Sit & Go, chat, vistas          |
| Runtime    | `packages/server/src/runtime.ts`   | Valida mensagens, persiste, transmite, agenda alarmes; independente de plataforma |
| API        | `packages/server/src/api.ts`       | `POST /api/rooms`, `GET /api/lobby`, `GET /api/rooms/:id`                         |
| Plataforma | `apps/worker`, `apps/local-server` | Cloudflare DO ou Node `ws`                                                        |

## Ciclo de vida da mesa

1. `POST /api/rooms` gera um código (6 caracteres sem 0/O/1/I) e inicializa o Durable Object.
2. Cliente abre o WebSocket e envia `HELLO {key, profile, password?}`; recebe `STATE` a cada mudança.
3. Cash: a mão começa sozinha com 2+ jogadores. Sit & Go: começa com a mesa cheia ou quando o anfitrião inicia.
4. Tempo de vez esgotado: check/fold; dois seguidos colocam o jogador em pausa.
5. Sem humanos conectados por 60 s a mesa pausa; após 30 min sem ninguém ela é apagada. Sit & Go encerrado some em 1 h.
6. O Lobby só lista mesas públicas e esquece as que não renovam a entrada em 3 min.

## Orçamento do plano gratuito

Mensagens são pequenas, o estado é salvo uma vez por comando, bots limitam as simulações por decisão e a senha de sala usa
SHA-256 salgado (barato) em vez de PBKDF2.
