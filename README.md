# Highlords Poker ♠

**Poker com a galera, direto no navegador.** Texas Hold'em sem cadastro: escolha um nome, abra uma mesa e mande o link.
Fichas 100% virtuais — não há dinheiro real, depósitos ou prêmios.

### [Jogar agora →](https://highlords-poker.highlords.workers.dev)

## Como jogar

1. Abra o [site](https://highlords-poker.highlords.workers.dev), escolha seu nome e retrato.
2. **Criar mesa** (ou **Jogar contra bots** para uma mesa pronta em um clique).
3. Toque em **Convidar** para copiar o link. Quem abrir entra na hora e senta em uma cadeira vazia.

- **Formatos:** cash game (entre e saia quando quiser, com recompra) e Sit & Go (uma mesa, blinds que sobem, até sobrar um).
- **Bots** fáceis, médios e difíceis para treinar ou completar a mesa. Eles só enxergam as próprias cartas.
- **Mesas com senha**, lista de mesas abertas e entrada por código de 6 caracteres.
- **Perfil sem conta:** 12 retratos desenhados ou foto, cor da moldura e estatísticas só no seu navegador, editáveis a qualquer momento.
- **Para quem está aprendendo:** modo treino com chance de vitória, pot odds, outs e sugestão; passo a passo na primeira mesa; bots com estilos de jogo (fechado, solto, agressivo).
- **Para quem já joga:** tempo extra (time bank), mostrar ou esconder cartas no showdown, rever mãos, HUD opcional dos adversários e atalhos de teclado (F, C, R, T e 1 a 6).
- **Mais regras de mesa:** ante e straddle no cash, rodar duas vezes quando todos estão all-in, ritmo dos bots (calmo, normal, rápido) e QR code para convidar pelo celular.
- **Espectadores:** indicador com contagem e lista na barra da sala, aviso quando alguém passa a assistir e faixa clara para quem foi eliminado. Salas vazias expiram em 5 min e partidas encerradas em 10 min; o lobby só lista salas com gente online.
- **Mesa viva:** as cartas saem da mão do dealer na distribuição e as cartas comunitárias viram de verdade no flop, turn e river, com sons sincronizados (desligáveis em Ajustes > Acessibilidade > Reduzir animações; não dependem da configuração de animação do sistema).
- **Aparência:** prévia ao vivo da mesa com temas, versos de carta, naipes em 4 cores, tamanho de texto e das cartas e alto contraste, em grupos (Mesa, Cartas, Acessibilidade) e com "Restaurar padrão". Instalável como app (PWA).
- **Home:** hero de impacto com entrada direta (nome, bots, criar mesa, código), mesa de vitrine, mesas abertas e jogadores online em tempo real.
- **Visual "clube privê" (grafite, champanhe e bordô, ícones SVG, altura fixa da bandeja de ações):** lobby em tabela com filtros, mesa grande com chat fixo ao lado no desktop e faixa de chat + painel no celular, pensado para virar app (safe-area, alvos de toque de 44px, orientação retrato). Apelidos sorteados e 12 retratos desenhados em código ou foto própria.
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
