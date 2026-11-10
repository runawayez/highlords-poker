# Interface e experiência de jogo

**Português** | [English](./interface.en.md)

A interface mantém a identidade Highlords em preto e vermelho, com feltro verde, fichas douradas e contraste nos controles. A mesa é o foco da sala desde a espera; a cadeira do jogador permanece na parte inferior durante a mão. Os assentos de 2 a 9 jogadores têm posições próprias para manter a área das cartas comunitárias livre.

## Criação e organização

- Criação em Formato, Estrutura e Revisão, com prévia ao vivo de assentos, stack e profundidade em big blinds.
- Presets Casual, Turbo e Deep stack. No cash game, a duração dos níveis não se aplica; o preset ajusta stack e tempo de ação. Em Sit & Go e torneios, também ajusta a duração dos níveis.
- Editor de blinds com campos por nível, antes, duração, intervalos e inclusão/remoção de níveis. O número de nível exibido começa em 1.
- Configuração avançada separada das escolhas principais. A validação usa o mesmo contrato do servidor.
- Sala de espera com botão Distribuir cartas em destaque, habilitado a partir de dois participantes. Assentos livres permitem adicionar um bot médio; o painel oferece dificuldades e preenchimento da mesa.
- Prévia de múltiplas mesas usa o mesmo balanceamento do servidor. A organização definitiva pode mudar com novas entradas e saídas.

## Durante a partida

O painel lateral separa Jogadores, Chat e Estrutura. Os controles de bots aparecem antes do início; moderação e classificação ficam junto dos participantes. Clicar em um assento destaca o jogador na lista. Ações de moderação pedem confirmação e o chat continua restrito à sala. Pausa e retomada são validadas atomicamente pelo anfitrião e pelo status, sem rejeitar o clique por uma ação simultânea de bot; apostas continuam exigindo a versão atual da mão.

A mesa destaca o jogador da vez, cronômetro, dealer, cartas privadas, apostas e vencedores. As ações de aposta ficam abaixo da mesa; os atalhos de meio pote, pote e dois potes ajustam o valor dentro dos limites legais. Recargas e add-ons respeitam as condições da mão e da sala; sair e recarregar usam diálogos próprios.

O produto continua usando apenas fichas virtuais. A interface não altera o baralho, as regras de apostas, a privacidade ou a distribuição de premiações.

## Referências

Foram estudados padrões de hierarquia e controles, sem reutilizar imagens, marcas ou código de terceiros:

- [247 Free Poker](https://www.247freepoker.com/): reconhecimento imediato da mesa, assentos e ações.
- [Poker Now — Club Tournaments](https://www.pokernow.com/blog/club-tournaments): separação das configurações, gestão de participantes e prévias.
- [Replay Poker — Understanding the lobby](https://replayhelp.casino.org/hc/en-us/articles/360001875053-Understanding-the-lobby): legibilidade de informações de salas e torneios.

## Verificação

`pnpm check` cobre tipos, lint, regras, integração, idiomas e build. `pnpm test:e2e` cobre partidas em sessões independentes, bots, criação e edição de torneio, validação de blinds, navegação do painel e telas de 1440, 1366 e 390 pixels. A suíte mede sobreposição dos nove cartões de jogador e overflow horizontal, além de salvar capturas no artefato `interface-previews` do GitHub Actions.

## Aprendizado e decisões

Os menus Como jogar, Ranking de mãos e Ajuda abrem rotas próprias sem exigir perfil. O guia tem etapas interativas, exemplos das dez mãos e glossário pesquisável. Na sala, os mesmos guias abrem em diálogo, mantendo a conexão e a partida ativas: consultar ajuda não pausa o cronômetro.

As duas cartas próprias ficam dentro do feltro, próximas do assento inferior; a ajuda opcional descreve a melhor combinação já formada e destaca as cinco cartas correspondentes. O cálculo recebe exclusivamente as cartas do próprio jogador e as comunitárias, sem estimativas de chances. A preferência é local. As apostas mostram os valores em fichas; “Aumentar para” é o total da rodada. Copiar convite, exportar, sair e encerrar ficam em Opções da sala; pausa/retomada permanecem visíveis.

Torneios têm resumo de jogadores restantes, mesas e próximos blinds, além de pódio final. Animações respeitam movimento reduzido; o aviso sonoro de turno continua opcional no perfil. As duas línguas têm a mesma cobertura.

Referência educativa: [PokerStars — Texas Hold’em](https://www.pokerstars.com/pt-BR/poker/games/texas-holdem/?no_redirect=1). Conteúdo e exemplos próprios, sem reprodução de imagens ou texto da referência.

## Layout imersivo

A home usa uma ilustração horizontal original, sem rotação da mesa. A rota `/mesas` oferece o lobby dedicado e preserva filtros e presença reais. A arena do jogo mantém proporção fixa e se dimensiona pelo espaço disponível, usando mesa mais vertical no celular. Ações ocupam uma região própria, sem encobrir cartas ou assentos. Os testes também verificam que as cartas comunitárias e privadas permanecem dentro do feltro e que a sala não ultrapassa a altura da tela.

**Gerenciar sala** e **Chat** abrem um painel lateral com fechamento por botão ou Escape e foco contido. Participantes, bots, estrutura, histórico, banco de tempo, recargas e add-on continuam integrados ao servidor. Clicar em um assento abre o participante selecionado. A home e os guias ficam acessíveis pelo menu do clube; os guias também abrem sem sair da partida por Opções.
