# HIGHLORDS POKER

> Documento-base de arquitetura, estrutura do repositório e planejamento do desenvolvimento.
>
> **Status:** planejamento / preparação do MVP  
> **Atualizado em:** 09/11/2026  
> **Produto:** poker multiplayer, gratuito, pelo navegador, sem conta de usuário.

---

## 1. Visão do produto

O **Highlords Poker** é um site de partidas de poker inspirado no fluxo simples de acesso do Gartic Phone e na experiência de salas do Highlords VTT.

**Experiência principal:** abrir o site → escolher nickname e perfil → visualizar o lobby → criar ou entrar em uma sala → jogar, conversar e, quando necessário, recuperar a sessão.

### Princípios inegociáveis

1. **R$ 0 de cobrança obrigatória para o operador e para os jogadores.** Nunca habilitar plano pago, upgrade automático, cobrança por excedente ou funcionalidade dependente de cartão de crédito. Hospedagem gratuita tem limites: ao alcançá-los, o serviço pode ficar temporariamente indisponível; não prometer escala nem disponibilidade ilimitadas.
2. **Sem cadastro, e-mail, senha de conta ou login.** Identificação por nickname e credencial de sessão anônima.
3. **Lobby público:** salas aparecem na listagem, inclusive as protegidas por senha. A senha restringe a entrada, não a visibilidade.
4. **Link direto:** qualquer sala pode ser acessada por URL; se protegida, exige a senha.
5. **Múltiplas salas independentes:** partidas e torneios não compartilham estado por acidente.
6. **Partidas retomáveis:** desconexão ou atualização de página não devem apagar jogadores, cartas ou fichas.
7. **Poker justo:** a autoridade das cartas, ações, apostas e vencedores fica no servidor, nunca no navegador.
8. **Dinheiro exclusivamente fictício:** buy-in, rebuy, add-on, stacks e premiações usam fichas virtuais. Sem depósitos, saques, transferências monetárias, pagamentos ou prêmios reais.
9. **Chat e personalização:** funcionalidades principais, não complementos opcionais.
10. **Mobile e desktop:** interface responsiva, com desktop como referência para mesas completas.
11. **Bilíngue desde o MVP:** Português do Brasil (`pt-BR`) e Inglês (`en`), com seletor compacto de idioma no cabeçalho (ícone de globo + nome do idioma), troca instantânea e gratuita.

### Observação sobre "100% gratuito"

O software pode ser desenvolvido com ferramentas gratuitas e configurado para **não gerar cobranças**, mas provedores gratuitos impõem cotas, condições de uso e podem mudar suas políticas. Portanto **custo zero não significa uso ilimitado ou SLA garantido**. Registrar e monitorar limitações antes de publicar; se o provedor exigir cobrança para continuar, **falhar de forma controlada**, sem contratar recursos pagos automaticamente.

---

## 2. Funcionalidades

### 2.1 Lobby

- Lista pública de salas e torneios, com atualização em tempo real ou por polling controlado.
- Nome, modalidade, ocupação, capacidade, blinds, status e ícone de senha.
- Filtros por modalidade, vagas, status e mesas com/sem senha.
- Criar sala, copiar convite, entrar pelo lobby ou por link.
- Status sugeridos: `WAITING`, `RUNNING`, `PAUSED`, `FINISHED`, `EXPIRED`.
- A criação de salas deve ter rate limiting e limites para salas abandonadas.
- Senhas verificadas no servidor; nunca expor senha, hash ou segredo no retorno do lobby.

### 2.2 Acesso anônimo e reconexão

- Jogador escolhe nickname (com tamanho e caracteres validados).
- Servidor emite um **token aleatório secreto** de sessão/jogador, vinculado à sala.
- Cliente guarda credencial de reconexão em armazenamento local adequado; nunca colocá-la na URL compartilhada.
- Nome visível não é identidade nem prova de posse da cadeira.
- Atualização de página: reconectar com token, buscar snapshot filtrado para aquele jogador e continuar.
- Reentrada após fechamento do navegador: possível enquanto sessão, armazenamento local e credencial permanecerem válidos.
- Sem contas: não prometer sincronização automática de perfil entre dispositivos.

### 2.3 Mesa de poker

**Primeira modalidade:** Texas Hold'em No-Limit.

- Mesas de 2 a 9 participantes (2 / 6 / 9 como predefinições).
- Dealer button, small blind, big blind, ante (quando habilitado).
- Baralho de 52 cartas, embaralhamento criptograficamente seguro no backend.
- Hole cards privadas, flop, turn, river e showdown.
- Turnos, temporizador, `fold`, `check`, `call`, `bet`, `raise`, `all-in`.
- Regras de aposta mínima, aumentos, ações possíveis e all-ins curtos.
- Side pots, split pots, empates e avaliação correta de mãos.
- Eliminação ou sit-out conforme modalidade.
- Histórico de ações; histórico de mãos concluídas com cuidado para não revelar informações privadas antecipadamente.
- Efeitos visuais opcionais; estado real sempre controlado pelo servidor.

### 2.4 Modalidades e configuração

| Modalidade | Escopo |
|---|---|
| Cash Game (fichas virtuais) | Buy-in mínimo/máximo, blinds fixos, sit-in/sit-out, recarga conforme regras |
| Sit & Go | Inscrição, stack inicial, começo por lotação/organizador, eliminação, vencedor |
| Torneio multimesa | Inscrições, distribuição em mesas, níveis de blinds, pausas, transferências e classificação |

**Configuração inicial:** título, senha opcional, modalidade, número de assentos, stack inicial, blinds, ante, duração dos níveis, buy-in em fichas fictícias, rebuy, add-on, late registration, time bank e ações do anfitrião.

> Para regras competitivas, consultar regulamento atualizado de Texas Hold'em e regras de torneio (ex.: Poker TDA). O motor deve ter uma política de regras versionada e testes para situações de borda.

### 2.5 Campeonatos

- Um `Tournament` coordena várias `Table` independentes.
- Cada jogador possui stack e identidade no escopo do campeonato.
- Estrutura de blinds configurável por níveis e intervalos.
- Pausas controladas; persistir instante de início/fim do nível ou tempo restante quando pausado.
- Eliminados, classificação, premiação **somente em fichas/pontos virtuais**.
- Rebalanceamento de mesas, mesa final, tratamento de jogador desconectado.
- Transferências de jogadores idempotentes e recuperáveis (sem duplicar jogador/fichas).
- Histórico de resultados, enquanto houver política de retenção ativa.
- **Regra de recuperação:** campeonato não depende de navegador ou anfitrião conectado para manter seu estado durável.

### 2.6 Chat

- Chat global do lobby, chat por sala e chat por campeonato.
- Mensagens de sistema (pote vencido, início do nível, entrada e saída etc.).
- Emojis e reações simples; texto puro escapado para evitar XSS.
- Limites de tamanho e frequência, anti-spam, mute, kick e report.
- Histórico recente com janela de retenção curta e tamanho máximo.
- Admin/moderação vinculada a credencial de host, nunca somente ao nickname.
- Nunca enviar cartas privadas ou segredos para os canais de chat.

### 2.7 Perfil personalizável, sem conta

- Nickname, avatar (ícones pré-definidos), moldura, cor de destaque, frase de perfil.
- Temas de mesa, verso das cartas e cores das fichas.
- Preferências locais em `IndexedDB` ou `localStorage`, com esquema versionado.
- Exportação/importação opcional de **preferências de perfil**, sem incluir tokens de sessão.
- Avatares pré-definidos no MVP; upload de imagens fica fora do escopo inicial para evitar custos, armazenamento e problemas de moderação.
- Conquistas locais inicialmente; ranking público persistente exige regras anti-fraude e identidade durável e fica para etapa posterior.

### 2.8 Internacionalização (i18n) — Português / Inglês

**Requisito obrigatório desde o MVP:** permitir alternar toda a interface entre **Português do Brasil (`pt-BR`)** e **Inglês (`en`)**, por **seletor compacto com ícone de globo e nome do idioma atual** no cabeçalho (e em posição acessível no mobile), sem recarregar a página nem criar uma conta. **Não utilizar um toggle binário como controle principal.**

- **Padrão de UX aprovado:** no desktop, posicionar no canto superior direito um botão discreto `🌐 Português` ou `🌐 English`, que abre um menu com opções nomeadas `Português (Brasil)` e `English` (cada nome no próprio idioma). No mobile, usar o mesmo seletor compacto no cabeçalho ou no menu principal, com acesso fácil inclusive durante a partida.
- **Escalabilidade:** menu preparado para acrescentar `Español` e outros idiomas no futuro sem redesenhar o cabeçalho; evitar toggle de duas posições e não depender exclusivamente de bandeiras para representar idiomas.
- **Acessibilidade:** seletor navegável por teclado, foco visível, rótulo acessível `Selecionar idioma`/`Select language`, indicador da opção selecionada, sem mudança inesperada de contexto. Não usar emoji de globo como único rótulo.
- Idioma inicial: detectar `navigator.language`/`navigator.languages`; usar inglês quando for o idioma preferido suportado e português como fallback padrão.
- Salvar a escolha em `localStorage` e aplicá-la automaticamente nas próximas visitas, inclusive ao abrir links diretos de salas.
- Utilizar **i18next + react-i18next**, bibliotecas open source, com traduções estáticas locais versionadas no Git. **Não utilizar APIs pagas de tradução automática**, LLMs ou chamadas externas para traduzir a UI.
- Externalizar **todos** os textos visíveis: home, lobby, criação de salas, perfil, chat (botões/avisos), mesa, torneios, configurações, modais, erros, validações, toasts, textos de acessibilidade e mensagens do sistema.
- Nomes de usuário, nomes livres das salas e **mensagens escritas por jogadores no chat não serão traduzidos automaticamente**; permanecem no idioma original. Somente a interface e eventos gerados pelo sistema mudam de idioma.
- O backend deve transmitir **códigos de erro e eventos tipados**, sem depender de textos em português ou inglês. Cada navegador traduz localmente para seu idioma. Exemplo: `PLAYER_FOLDED` com `{ playerName }`, exibido como `Berkas desistiu` ou `Berkas folded`.
- Usar interpolação segura, pluralização e formatação de números/datas via `Intl`; separar texto de valores monetários fictícios e não traduzir identificadores técnicos.
- Não concatenar traduções em fragmentos de frase nem espalhar strings literais em componentes. Adicionar chaves novas simultaneamente em ambos os idiomas, com fallback explícito.
- Identificadores estáveis, como `roomId`, `playerId`, estados (`WAITING`) e eventos de API, **não mudam** quando o usuário troca de idioma.
- Compatibilidade com futuras línguas: organização por namespaces (`common`, `lobby`, `game`, `tournament`, `chat`, `profile`, `errors`) sem refatoração da lógica.
- Testar troca de idioma durante uma mão, persistência após refresh, mobile, textos longos em inglês, traduções ausentes e acessibilidade (`<html lang>` e rótulos traduzidos).

**Exemplos de traduções**

| Chave | pt-BR | en |
|---|---|---|
| `common.createRoom` | Criar sala | Create room |
| `lobby.joinRoom` | Entrar na sala | Join room |
| `game.fold` | Desistir | Fold |
| `game.call` | Pagar | Call |
| `game.raise` | Aumentar | Raise |
| `chat.placeholder` | Digite uma mensagem... | Type a message... |
| `tournament.standings` | Classificação | Standings |
| `errors.invalidPassword` | Senha incorreta | Incorrect password |

**Critério de conclusão:** nenhuma página principal pode ter textos fixos apenas em português; o idioma escolhido deve ser respeitado em toda a jornada, inclusive em notificações de tempo real.

---

## 3. Arquitetura proposta

### 3.1 Serviços

```text
┌───────────────────────────────────────────────┐
│ Browser — React + Vite + TypeScript           │
│ Lobby | Mesa | Chat | Perfil | Torneio | i18n  │
└───────────────────────┬───────────────────────┘
                        │ HTTPS / WebSocket
                        ▼
┌───────────────────────────────────────────────┐
│ API / Realtime Gateway                        │
│ Criação de sala, entrada, lobby, validação    │
└───────────────┬───────────────────────────────┘
                │
     ┌──────────┴─────────────┐
     ▼                        ▼
┌────────────────┐   ┌─────────────────────────┐
│ Lobby / índice │   │ Coordenador de torneio │
│ de salas       │   │ e transferências       │
└────────────────┘   └────────────┬────────────┘
                                 │
                   ┌─────────────┴─────────────┐
                   ▼                           ▼
            ┌─────────────┐             ┌─────────────┐
            │ Mesa A      │             │ Mesa B      │
            │ Engine      │             │ Engine      │
            │ Estado      │             │ Estado      │
            │ Persistência│             │ Persistência│
            └─────────────┘             └─────────────┘
```

**Separação obrigatória:** `poker-engine` é puro TypeScript e não depende do provedor, React ou WebSocket. O backend coordena salas, valida credenciais, persiste estados e transmite **visões filtradas por jogador**.

### 3.2 Stack inicial sugerida

| Camada | Tecnologia |
|---|---|
| Frontend | React + TypeScript + Vite |
| UI | Tailwind CSS |
| Internacionalização | i18next + react-i18next; catálogos JSON locais |
| Estado de tela | Zustand ou solução React simples |
| Validação de contratos | Zod |
| Pacotes / monorepo | pnpm workspaces |
| Motor de poker | TypeScript puro |
| Testes unitários | Vitest |
| Testes E2E | Playwright |
| Deploy do frontend | Vercel Hobby (site estático) |
| API / multiplayer | Cloudflare Workers + Durable Objects (avaliar elegibilidade e limites gratuitos antes de ativar) |
| Persistência das salas | Armazenamento SQLite dos Durable Objects, se disponível no plano gratuito |
| Persistência local do perfil | IndexedDB/localStorage |

**Não assumir que Vercel Functions executará um servidor Node.js persistente, com sockets e memória compartilhada.** O frontend no Vercel e o backend de sessão são projetos/serviços separados.

**Plano de contingência:** manter adaptadores para backend local Node.js + SQLite durante desenvolvimento. Esse backend também permite auto-hospedagem, mas auto-hospedagem não é automaticamente gratuita (energia, hardware e internet). Não confundir ambiente de desenvolvimento local com infraestrutura pública disponível 24/7.

### 3.3 Contratos fundamentais

- Cliente envia **comandos/intenção** (`RAISE`, `FOLD`, `JOIN_TABLE`), não estados arbitrários.
- Servidor valida comando, credencial, ação, stack, turno e versão do estado.
- Estado durável é gravado **antes** de confirmar a jogada ao cliente.
- Eventos possuem `actionId`/`eventId` para deduplicação.
- Cada sala possui `stateVersion` monotônico.
- Cliente recebe projeção pública e projeção privada **apenas do próprio jogador**.
- Ao reconectar, cliente recebe snapshot autorizado + eventos posteriores, se necessário.
- Nunca guardar baralho secreto em logs, URLs ou payloads públicos.

---

## 4. Persistência e política de sessão

**Cache não é fonte da verdade.** Estado em RAM acelera leitura e difusão, mas o estado autoritativo deve ser restaurável do armazenamento durável.

### 4.1 Dados persistidos

- `Room`: identidade, configuração, senha derivada/segura, estado, timestamps, dono.
- `PlayerSeat`: jogador, cadeira, stack, presença, status e credencial associada de forma segura.
- `Hand`: baralho/ordem protegidos, cartas, street, board, turnos, pote(s), apostas, versões.
- `GameEvent`: comandos aceitos, resultados e IDs de deduplicação.
- `Tournament`: participantes, mesas, blinds, cronograma, classificação e transações de transferência.
- `ChatMessage`: mensagens recentes, moderação e prazo de expiração.

### 4.2 Retomada

1. Jogador abre a URL da sala.
2. Cliente apresenta token de reconexão armazenado localmente.
3. Servidor valida o token e lê o estado durável.
4. Servidor entrega o snapshot **com cartas ocultas dos adversários**.
5. Cliente retorna à mesa e recebe atualizações novas em tempo real.

### 4.3 Ciclo de vida

```text
WAITING -> RUNNING -> PAUSED -> RUNNING -> FINISHED -> EXPIRED
                 \-----------------------------------^
```

- **Sala vazia:** pausa automática após uma janela configurável, em vez de continuar eliminando jogadores invisíveis.
- **Campeonato pausado:** relógio de blinds também pausa; tempo restante é salvo.
- **Campeonato finalizado:** retenção finita e limpeza posterior, evitando crescimento ilimitado.
- **Backups:** exportação administrativa de snapshot com aviso de sigilo; não expor baralho ou token no arquivo público. Considerar backups fora do provedor em fase de amadurecimento.
- **Falhas:** se a persistência estiver indisponível, bloquear novas ações de jogo em vez de confirmar jogadas apenas na RAM.

---

## 5. Estrutura sugerida do repositório

```text
highlords-poker/
├── README.md
├── PROJECT.md                      # Este documento
├── .gitignore
├── .env.example                    # Sem segredos reais
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── eslint.config.js
│
├── apps/
│   ├── web/                         # Frontend Vite + React
│   │   ├── public/
│   │   │   ├── avatars/
│   │   │   ├── cards/
│   │   │   └── sounds/
│   │   ├── src/
│   │   │   ├── app/                 # Router, providers, bootstrap
│   │   │   ├── i18n/                # Configuração, detecção e troca de idioma
│   │   │   │   ├── index.ts
│   │   │   │   └── locales/
│   │   │   │       ├── pt-BR/       # common, lobby, game, chat etc.
│   │   │   │       └── en/          # Mesmas chaves traduzidas
│   │   │   ├── pages/
│   │   │   │   ├── HomePage.tsx
│   │   │   │   ├── LobbyPage.tsx
│   │   │   │   ├── RoomPage.tsx
│   │   │   │   ├── TournamentPage.tsx
│   │   │   │   └── ProfilePage.tsx
│   │   │   ├── features/
│   │   │   │   ├── lobby/
│   │   │   │   ├── room/
│   │   │   │   ├── table/
│   │   │   │   ├── chat/
│   │   │   │   ├── profile/
│   │   │   │   └── tournament/
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   ├── lib/
│   │   │   ├── stores/
│   │   │   └── styles/
│   │   └── vite.config.ts
│   │
│   ├── worker/                      # Cloudflare Worker (API)
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── routes/
│   │   │   ├── middleware/
│   │   │   ├── durable-objects/
│   │   │   │   ├── LobbyObject.ts
│   │   │   │   ├── TableObject.ts
│   │   │   │   └── TournamentObject.ts
│   │   │   └── adapters/
│   │   ├── migrations/
│   │   └── wrangler.jsonc
│   │
│   └── local-server/               # Dev/alternativa self-hosted
│       └── src/
│           ├── index.ts
│           └── persistence/
│
├── packages/
│   ├── poker-engine/
│   │   └── src/
│   │       ├── deck.ts
│   │       ├── actions.ts
│   │       ├── betting.ts
│   │       ├── evaluator.ts
│   │       ├── pots.ts
│   │       ├── state-machine.ts
│   │       └── index.ts
│   ├── tournament-engine/
│   │   └── src/
│   │       ├── blinds.ts
│   │       ├── balancing.ts
│   │       ├── eliminations.ts
│   │       └── index.ts
│   ├── contracts/
│   │   └── src/                     # Tipos, schemas e eventos
│   ├── realtime/
│   │   └── src/                     # Protocolos, sockets, sync
│   ├── persistence/
│   │   └── src/                     # Interfaces e adaptadores
│   └── ui/
│       └── src/                     # Componentes reutilizáveis
│
├── tests/
│   ├── fixtures/
│   ├── integration/
│   ├── e2e/
│   └── load/
│
├── docs/
│   ├── architecture.md
│   ├── game-rules.md
│   ├── realtime-protocol.md
│   ├── persistence.md
│   ├── i18n.md                      # Convenções e glossário pt-BR/en
│   ├── threat-model.md
│   ├── testing.md
│   └── decisions/                   # ADRs: decisões arquiteturais
│
└── .github/
    └── workflows/
        └── ci.yml
```

> Estrutura-alvo, **não** significa que todos esses arquivos precisam existir no primeiro commit. Criar módulos conforme forem necessários para manter o MVP enxuto.

---

## 6. Modelo inicial de domínio

```ts
type RoomStatus = 'WAITING' | 'RUNNING' | 'PAUSED' | 'FINISHED' | 'EXPIRED';
type GameMode = 'CASH' | 'SIT_AND_GO' | 'TOURNAMENT';

type Room = {
  id: string;
  title: string;
  status: RoomStatus;
  mode: GameMode;
  maxPlayers: number;
  passwordProtected: boolean;
  tournamentId?: string;
  stateVersion: number;
  createdAt: string;
  updatedAt: string;
};

type PlayerPublicProfile = {
  playerId: string;
  nickname: string;
  avatarId: string;
  frameId: string;
  accentColor: string;
  tagline?: string;
};

type TablePublicView = {
  roomId: string;
  stateVersion: number;
  seats: Array<{ seat: number; playerId?: string; stack?: number }>;
  communityCards: string[];
  potTotal: number;
  actionPlayerId?: string;
};

type TablePrivateView = TablePublicView & {
  myHoleCards?: [string, string];
  allowedActions: string[];
};
```

Esses tipos representam **contratos de leitura** e são apenas ilustrativos. O estado interno deve conter mais informações privadas e invariantes; nunca serializar o estado autoritativo integralmente para todos os participantes.

---

## 7. Segurança, moderação e custo controlado

### Segurança de jogo

- Embaralhamento com fonte aleatória criptograficamente segura no servidor.
- Nunca aceitar `stack`, cartas ou vencedor enviados pelo navegador como verdade.
- Validação de turnos, limites, comandos e versão do estado.
- Tokens de jogador, anfitrião e espectador separados por permissões.
- Senha de sala processada/verificada no servidor e submetida a rate limit.
- Proteção de WebSocket por autenticação de sessão, origem permitida e limites de payload.
- Projeções privadas por conexão: ninguém recebe cartas de outro jogador.
- Auditoria por eventos de jogo e testes de deduplicação.

### Antiabuso / moderação

- Limites por IP/identificador para criar salas e mandar mensagens; não tratar IP como identidade forte.
- Limite de salas por usuário anônimo e salas simultâneas por capacidade disponível.
- Mensagens com filtro básico, escape e tamanho máximo.
- Mute/kick/ban por sala com prazo configurável e poderes limitados do anfitrião.
- Expiração de salas inativas e histórico de chat curto.

### Controle de custo

- **Não adicionar cartão nem recursos que aceitem cobrança automática.**
- Revisar políticas e limites dos provedores antes do deploy.
- Usar apenas funcionalidades comprovadamente disponíveis no plano gratuito.
- Rate limits, quota de criação de salas e caps de conexões, conforme medições reais.
- Monitorar uso e estabelecer **modo de manutenção/limitação** quando próximo dos tetos.
- Nenhum serviço de analytics, e-mail, upload de mídia ou observabilidade pago no MVP.
- Não prometer 24/7 ilimitado com infraestrutura de terceiros gratuita.

---

## 8. Roadmap

### Fase 0 — Fundação

- [ ] Inicializar monorepo (`pnpm`), TypeScript, lint, formatação, CI.
- [ ] Criar design system dark minimalista (preto/vermelho, acessibilidade).
- [ ] Configurar i18next/react-i18next e catálogos `pt-BR`/`en`, com seletor compacto de globo + idioma atual (sem toggle binário).
- [ ] Definir contratos de eventos e estados da mesa.
- [ ] Provar conexão realtime e persistência durável em protótipo simples.
- [ ] Confirmar zero cobrança e limites dos planos antes de provisionar.

### Fase 1 — MVP jogável

- [ ] Tela inicial, nickname e perfil local.
- [ ] Traduzir home, lobby, mesa, chat, perfil, erros e mensagens do sistema para português e inglês.
- [ ] Lobby público, criar sala, senha opcional e link direto.
- [ ] Assentos, entrada/saída/reconexão e presença.
- [ ] Texas Hold'em No-Limit completo em **uma mesa**.
- [ ] Chat por sala e mensagens do sistema.
- [ ] Persistir estado a cada ação aceita.
- [ ] Teste E2E com múltiplos navegadores.

### Fase 2 — Estabilidade e customização

- [ ] Chat do lobby, moderação e anti-spam.
- [ ] Revisar pluralização, textos extensos, acessibilidade e cobertura i18n.
- [ ] Avatares, molduras, temas de mesa e verso de carta.
- [ ] Reentrada após queda de conexão, restauração após reinício de backend.
- [ ] Histórico de mãos e exportação administrativa protegida.
- [ ] Carga básica e instrumentação para limites de uso gratuito.

### Fase 3 — Modalidades

- [ ] Cash Game com fichas fictícias, buy-in/rebuy.
- [ ] Sit & Go, temporizador e estrutura de blinds.
- [ ] Add-on, registro tardio e configurações avançadas.

### Fase 4 — Campeonatos

- [ ] Torneios com múltiplas mesas.
- [ ] Coordenador persistente, transferências idempotentes.
- [ ] Rebalanceamento, mesa final, classificação e encerramento.
- [ ] Recuperação de torneio durante transferências e reinícios.

### Fase 5 — Polimento

- [ ] Estatísticas e conquistas compatíveis com anonimato.
- [ ] Espectadores com proteção contra informações privadas.
- [ ] UX mobile, animações e acessibilidade.
- [ ] Auditoria de segurança e testes de carga mais robustos.

---

## 9. Critérios de aceite do primeiro lançamento

- [ ] Usuário entra só com nickname, sem cadastro.
- [ ] Lobby lista salas públicas e salas com senha, sem revelar segredos.
- [ ] Link direto abre a sala correta.
- [ ] Duas salas simultâneas não interferem uma na outra.
- [ ] Uma mesa com jogadores em navegadores distintos conclui mãos corretamente.
- [ ] Ações ilegais são rejeitadas pelo servidor.
- [ ] Nenhum cliente recebe cartas privadas dos adversários.
- [ ] Chat funciona e aplica proteção básica contra spam/XSS.
- [ ] Perfil local persiste após atualizar a página.
- [ ] Seletor compacto `🌐 Português` / `🌐 English` funciona sem refresh, em todas as páginas, inclusive durante partidas, e persiste após nova visita.
- [ ] Mensagens automáticas do servidor respeitam o idioma de cada jogador; chat dos usuários não sofre tradução automática.
- [ ] As traduções dos dois idiomas têm cobertura integral das chaves usadas.
- [ ] Seletor de idioma é acessível por teclado, tem opção selecionada clara e adapta-se ao desktop e ao mobile, sem depender de bandeiras.
- [ ] Um jogador atualiza o navegador e recupera sua cadeira e suas cartas.
- [ ] O backend é reiniciado durante uma mão; o estado confirmado reaparece corretamente.
- [ ] Operação pública não possui caminho de cobrança automática.
- [ ] O limite gratuito é documentado e o comportamento ao ultrapassá-lo é conhecido.

---

## 10. Primeiros passos práticos

1. Criar pasta `highlords-poker` e abrir no VS Code/Kimi/Claude Code.
2. Colocar este arquivo na raiz como `PROJECT.md`.
3. Inicializar monorepo `pnpm` com `apps/web`, `apps/worker` e `packages/poker-engine`.
4. Criar uma interface mockada de lobby e mesa para validar UX.
5. Desenvolver e testar o motor de cartas, apostas, side pots e showdown sem frontend.
6. Integrar um protótipo de sala em tempo real e persistente.
7. Liberar chat, perfil e fluxo de reconexão.
8. Implementar torneios somente depois que o motor e a recuperação estiverem estáveis.

### Ordem de prioridades para agentes de código

**Corretude do poker > proteção de cartas > persistência > reconexão > experiência multiplayer > chat e perfil > efeitos visuais.**

### Definition of Done para cada feature

- Contratos tipados e validados.
- Testes de regra e de falhas relevantes.
- Estados de loading/erro/reconexão tratados.
- Sem divulgação de segredos do jogo.
- Sem dependência de serviço pago.
- Documentação atualizada no mesmo PR.
- Textos de interface e eventos incluídos em `pt-BR` e `en`, sem strings hardcoded.

---

## 11. Decisões pendentes (não bloqueiam a Fase 0)

- Política exata de inatividade e expiração de salas/torneios.
- Número inicial de salas e jogadores simultâneos permitido (definir com testes e cotas).
- Comportamento de jogador ausente no turno (auto-fold/check se permitido, time bank).
- Exibição de estatísticas sem contas e mitigação de manipulação de ranking.
- Política de observadores durante uma mão.
- Definição de regras detalhadas para rebuys, late registration e blinds de torneio.
- Confirmação da elegibilidade dos planos gratuitos para o padrão de uso real.

---

**Resumo:** construir primeiro um motor seguro, testável e independente de infraestrutura; depois conectá-lo a salas reais, lobby, chat, perfis e persistência. O produto é gratuito e sem cadastro, mas não promete capacidade ilimitada de serviços gratuitos.
