# Arquitetura

**Português** | [English — detailed reference](./architecture.en.md)

O navegador envia comandos de jogo. O servidor valida a sessão, a cadeira, a vez e a versão da sala antes de aplicar cada comando. Cada mesa tem baralho, pote e relógio próprios. A resposta de cada jogador contém apenas as cartas que ele pode ver.

O coordenador processa uma alteração por vez e grava o resultado antes de confirmar a ação. Entre mãos, distribui os participantes pelas mesas do torneio em uma única transação. Se a gravação falhar, a versão anterior continua válida.

O perfil fica no navegador e pode ser editado a partir da home mesmo com o multiplayer indisponível. O lobby público lista salas. Cada conversa pertence a uma sala e exige participação nela.

A presença é registrada por sala, com detecção de ausência em até 60 segundos. Sem humanos, a partida pausa e a sala expira após 30 minutos de ausência. Bots e broadcasts do servidor não renovam o prazo. O resultado de torneio expira uma hora após o término, sem renovação por chat ou visitas. O anfitrião pode encerrar a sala com confirmação; sessões e outras salas continuam intactas. Os prazos também são verificados ao acessar a sala, mesmo antes da próxima rotina de limpeza.
