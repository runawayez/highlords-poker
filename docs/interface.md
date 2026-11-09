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

`pnpm check` cobre tipos, lint, regras, integração, idiomas e build. `pnpm test:e2e` cobre partidas em sessões independentes, bots, criação e edição de torneio, validação de blinds, navegação do painel e telas de 1440 e 390 pixels. A suíte mede sobreposição dos nove cartões de jogador e overflow horizontal, além de salvar capturas no artefato `interface-previews` do GitHub Actions.
