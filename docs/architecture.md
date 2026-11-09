# Arquitetura

**Português** | [English — detailed reference](./architecture.en.md)

O navegador envia comandos de jogo. O servidor valida a sessão, a cadeira, a vez e a versão da sala antes de aplicar cada comando. Cada mesa tem baralho, pote e relógio próprios. A resposta de cada jogador contém apenas as cartas que ele pode ver.

O coordenador processa uma alteração por vez e grava o resultado antes de confirmar a ação. Entre mãos, distribui os participantes pelas mesas do torneio em uma única transação. Se a gravação falhar, a versão anterior continua válida.

O perfil fica no navegador e pode ser editado a partir da home mesmo com o multiplayer indisponível. O lobby público lista salas. Cada conversa pertence a uma sala e exige participação nela.
