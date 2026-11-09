# Highlords Poker ♠

**Português (Brasil)** | [English](README.en.md)

Um clube de poker multiplayer, gratuito e sem cadastro, direto pelo navegador. React + TypeScript, Texas Hold'em No-Limit com regras controladas pelo servidor e **apenas fichas virtuais**.

O site abre em **português do Brasil** na primeira visita, independentemente do idioma do navegador. O seletor `🌐 Português / English` permite trocar o idioma a qualquer momento e salva a escolha para as próximas visitas.

## Executar localmente

Requisitos: **Node.js 24 LTS** e **pnpm 11.25.0**.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Abra o endereço exibido pelo Vite, escolha seu nickname, crie uma mesa e convide seus amigos. Para testar outro jogador no mesmo computador, use **outro perfil do navegador ou uma janela anônima**. Abas do mesmo perfil compartilham a sessão de propósito. O ambiente local não exige contas nem chaves de serviços externos.

```sh
pnpm check                 # TypeScript, lint, testes de regras/integração e build
pnpm test:e2e              # Testes de navegador com jogadores em sessões independentes
pnpm format:check          # Verificação da formatação
pnpm build                # Build de produção do frontend
pnpm start                # Frontend + API na porta 3001, com persistência SQLite
```

Copie `.env.example` para `.env` para configurar o servidor local. O ambiente de desenvolvimento também lê esse arquivo. Nunca envie `.env` ou `.data` para o Git. O banco fica em `.data/poker.sqlite` por padrão. Apenas um processo do servidor deve controlar cada banco; este adaptador não deve rodar em cluster.

## Funcionalidades

- Lobby público com filtros, salas com senha, links de convite e espectadores.
- Mesas cash de 2 a 9 jogadores, Sit & Go e torneios multimesa com até 90 participantes.
- Blinds, antes individuais, embaralhamento seguro, cartas privadas, todas as rodadas, temporizador e banco de tempo.
- Fold, check, call, bet, raise e all-in; aumentos curtos, side pots, empates e divisão dos potes.
- Limites de buy-in, recarga de fichas, rebuys limitados, add-on, registro tardio, níveis de blinds, intervalos, pausa e retomada.
- Eliminações, classificação, premiação virtual, rebalanceamento e formação da mesa final.
- Recuperação de sessões e mãos, contratos tipados, controle de versão, deduplicação e persistência antes da confirmação de ações.
- Chat do lobby, sala e torneio, reações, mute/kick/ban pelo anfitrião e denúncias disponíveis na exportação administrativa.
- Avatares, molduras, cores, frase de perfil, temas de mesa, versos de cartas e cores das fichas.
- Aviso sonoro opcional de turno, conquistas locais e importação/exportação de preferências sem credenciais.
- Traduções locais PT-BR/EN com i18next, seletor acessível, navegação por teclado, layout responsivo e redução de movimento.
- Backend local Node + SQLite e adaptador Cloudflare Worker + Durable Object com armazenamento SQLite.

## Estrutura do projeto

| Pasta                        | Responsabilidade                                              |
| ---------------------------- | ------------------------------------------------------------- |
| `apps/web`                   | Interface Vite/React e catálogos de tradução                  |
| `apps/local-server`          | API HTTP, WebSocket autenticado e persistência SQLite         |
| `apps/worker`                | Rotas Cloudflare, Durable Object, conexões e alarmes          |
| `packages/poker-engine`      | Baralho, avaliação de mãos, apostas e potes                   |
| `packages/tournament-engine` | Distribuição de mesas, relógio de níveis e premiação          |
| `packages/contracts`         | Schemas de validação e comandos compartilhados                |
| `packages/server`            | Identidade anônima, salas, permissões, projeções e transações |
| `tests`                      | Testes de regras, integração, rede e navegador                |
| `docs`                       | Arquitetura, regras, segurança, operação e publicação         |
| `PROJECT.md`                 | Documento original do produto, preservado como fornecido      |

Consulte as [regras da casa](docs/game-rules.md), a [arquitetura](docs/architecture.md), as [instruções de publicação](docs/deployment.md) e a [documentação dos testes](docs/testing.md). Esses documentos técnicos estão em inglês.

## Publicar para jogar com os amigos

[**Publicar o frontend no Vercel**](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Frunawayez%2Fhighlords-poker&env=VITE_API_URL&project-name=highlords-poker&repository-name=highlords-poker)

**O multiplayer precisa de duas partes online:** o frontend no Vercel e o backend persistente no Cloudflare. Publicar somente a interface não habilita partidas.

1. Publique `apps/worker` em uma conta **Cloudflare Workers Free**, seguindo o [guia de publicação](docs/deployment.md).
2. Configure `ALLOWED_ORIGINS` no Worker com o endereço exato do frontend, incluindo `https://`.
3. No projeto Vercel, configure `VITE_API_URL` com a URL do Worker publicado.
4. Faça um novo build/deploy do frontend e teste com duas sessões independentes antes de compartilhar o link.

O botão acima solicita `VITE_API_URL`: informe o endereço do backend **já publicado**. Não informe tokens ou senhas nessa variável; ela é pública no navegador. Como alternativa, o servidor Node pode hospedar a aplicação inteira em um servidor próprio com HTTPS e disco persistente.

## Gratuidade e limites

O projeto não provisiona infraestrutura paga, não habilita cobrança e não publica automaticamente apenas por executar os testes no GitHub Actions. Um projeto vinculado ao Vercel pode realizar deploys automáticos conforme a configuração da própria plataforma.

A opção em nuvem utiliza frontend estático no Vercel Hobby e backend no Cloudflare Workers Free, respeitando a elegibilidade e os termos dos provedores. **Serviços gratuitos têm limites:** ao atingir as cotas, podem ficar indisponíveis. O software não contrata upgrades para continuar funcionando.

Não há cartão obrigatório, tradução paga, analytics pago, depósitos, saques ou prêmios reais na aplicação. A auto-hospedagem não elimina eventuais custos de energia, equipamento ou conexão do operador.
