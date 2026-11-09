# Highlords Poker ♠

**Português (Brasil)** | [English](README.en.md)

**Poker com os amigos, direto pelo navegador.** O Highlords Poker é um site gratuito de Texas Hold'em, disponibilizado e mantido por [Matheus Martins (Berkas)](https://github.com/runawayez). Você escolhe um nickname, personaliza seu perfil e reúne a galera em uma mesa, sem cadastro ou instalação.

### [Acessar o Highlords Poker →](https://highlords-poker.vercel.app)

> **Status:** multiplayer publicado e conectado. Criação de sala, partida com duas sessões independentes, chat e reconexão verificados no endereço público.

## Como funciona

Para jogar:

1. Acesse o site e escolha seu nickname e avatar.
2. Crie uma mesa ou entre em uma sala do lobby.
3. Compartilhe o link da sala com seus amigos.
4. Jogue e converse pelo chat da mesa.

A hospedagem e a operação do site ficam a cargo do criador do projeto. **Os jogadores acessam o endereço oficial pelo navegador.**

## A experiência

- **Texas Hold'em No-Limit:** mesas de 2 a 9 jogadores, blinds, antes, all-in, side pots e divisão de potes.
- **Diferentes formatos:** cash game com fichas virtuais, Sit & Go e torneios multimesa.
- **Mesas do seu jeito:** senha opcional, stacks, buy-ins, rebuys, add-on, níveis de blinds e intervalos configuráveis.
- **Jogue com bots:** o anfitrião pode adicionar até oito bots antes de começar, escolher dificuldade fácil, média ou difícil e misturar amigos e bots na mesma sala.
- **Poker entre amigos:** lobby público, convites por link, espectadores, chat restrito a cada sala e reações.
- **Perfil personalizável:** nickname, avatar, moldura, cor, frase, tema da mesa e verso das cartas.
- **Sessões retomáveis:** recuperação da cadeira e das cartas no mesmo navegador, enquanto a sessão e a credencial local permanecerem válidas.
- **Português e inglês:** português do Brasil na primeira visita, com seletor de idioma e preferência salva.
- **Desktop e celular:** interface responsiva, com controles acessíveis por teclado.

**Todas as fichas e premiações são fictícias.** Não há depósitos, saques, apostas monetárias ou prêmios reais.

## Sobre este repositório

Este é o **código público do site Highlords Poker**, mantido aqui para consulta, transparência e acompanhamento do desenvolvimento. A experiência principal para quem quer jogar acontece no site oficial.

Sugestões e relatos de problemas podem ser enviados pelas [issues do projeto](https://github.com/runawayez/highlords-poker/issues). Descreva o que aconteceu, o comportamento esperado e, quando possível, como reproduzir o problema. Nunca inclua credenciais de sessão ou cartas privadas de uma mão em andamento.

## Documentação técnica

Para quem deseja estudar o código ou contribuir com o desenvolvimento:

- [Ambiente de desenvolvimento](docs/development.md)
- [Arquitetura](docs/architecture.md)
- [Regras da casa](docs/game-rules.md)
- [Testes e validação](docs/testing.md)
- [Internacionalização](docs/i18n.md)
- [Segurança](docs/threat-model.md)
- [Operação e publicação pelo mantenedor](docs/deployment.md)

Os guias técnicos abrem em português e incluem links para as referências detalhadas em inglês. O documento original do produto permanece em [PROJECT.md](PROJECT.md).

## Bots

Na sala, antes de distribuir as cartas, escolha a dificuldade e use **Adicionar bot** ou **Completar com bots**. O anfitrião também pode remover bots antes do início. Eles seguem as mesmas regras e enxergam apenas suas próprias cartas e a mesa. As dificuldades usam estratégias e simulações locais no servidor, sem serviços de IA pagos; o nível difícil não é um jogador profissional.

Bots usam fichas virtuais e podem participar dos três formatos. Não fazem rebuy ou add-on automaticamente. Quando todos os humanos ficam desconectados, a partida pausa; bots não mantêm salas jogando sozinhas. O recurso exige a atualização do Worker além do frontend.

Consulte [Interface e experiência de jogo](docs/interface.md) para criação com prévia, organização da sala e referências visuais.

## Organização das salas

Não é necessário criar uma conta. O lobby separa **pessoas online**, **pessoas ausentes**, **bots**, **espectadores online** e **assentos ocupados**. A presença pertence à sala: ficar no lobby ou em outra mesa não mantém uma sala antiga aberta.

Após até um minuto sem sinal de conexão de nenhum humano, uma partida em andamento pausa. A sala fica reservada por **30 minutos de ausência** para reconectar e retomar. Bots não mantêm salas abertas. Isso também vale para salas em espera ou pausadas manualmente. Se um humano voltar antes do prazo, a reserva é renovada; o anfitrião pode retomar a partida.

Torneios encerrados mantêm os resultados por **1 hora**, mesmo que alguém continue visitando ou conversando na sala. O anfitrião também pode usar **Encerrar sala**, com confirmação, para removê-la do lobby para todos. Perfis e credenciais de outras salas são preservados. Não há painel administrativo global nem login obrigatório.
