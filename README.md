# Highlords Poker ♠

**Poker com a galera, direto no navegador.** Texas Hold'em sem cadastro: escolha um nome, abra uma mesa e mande o link.
Fichas 100% virtuais — não há dinheiro real, depósitos ou prêmios.

## Como jogar

1. Abra o site, escolha seu nome e retrato.
2. **Criar mesa** (ou **Jogar contra bots** para uma mesa pronta em um clique).
3. Toque em **Convidar** para copiar o link. Quem abrir entra na hora e senta em uma cadeira vazia.

- **Formatos:** cash game (entre e saia quando quiser, com recompra) e Sit & Go (uma mesa, blinds que sobem, até sobrar um).
- **Bots** fáceis, médios e difíceis para treinar ou completar a mesa. Eles só enxergam as próprias cartas.
- **Mesas com senha**, lista de mesas abertas e entrada por código de 6 caracteres.
- **Chat, emotes, sons e animações** de cartas, fichas e vitórias. Funciona no celular e no computador.
- **Aprender:** guia de como jogar, ranking de mãos, ajuda e regras da casa (português e inglês), além de uma dica opcional da sua mão atual.

## Arquitetura em uma linha

Um único **Cloudflare Worker** serve o site e a API. Cada mesa é um **Durable Object** (WebSocket hibernável, estado
persistido, relógio por alarme). O servidor é a autoridade: embaralha, guarda as cartas e só envia a cada jogador o
que ele pode ver. Detalhes em [docs/architecture.md](docs/architecture.md).

## Desenvolvimento

```bash
pnpm install
pnpm dev          # servidor local (3001) + Vite com proxy
pnpm check        # typecheck, lint, testes e build
pnpm test:e2e     # Playwright (rode pnpm build antes)
pnpm worker:dev   # o Worker de verdade via wrangler
```

Veja [docs/development.md](docs/development.md) e [docs/deployment.md](docs/deployment.md).

## Estrutura

| Pasta                   | Conteúdo                                            |
| ----------------------- | --------------------------------------------------- |
| `packages/poker-engine` | Regras puras do NLHE (apostas, side pots, showdown) |
| `packages/poker-bot`    | Decisão dos bots                                    |
| `packages/contracts`    | Schemas zod e protocolo                             |
| `packages/server`       | Sala (`room.ts`), runtime, lobby e API HTTP         |
| `apps/worker`           | Cloudflare Worker + Durable Objects                 |
| `apps/local-server`     | Mesmo runtime em Node, para dev e testes            |
| `apps/web`              | React + Vite                                        |

Sugestões e bugs: [issues do projeto](https://github.com/runawayez/highlords-poker/issues). Nunca inclua cartas privadas de uma mão em andamento.
