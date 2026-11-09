# Comunicação em tempo real

**Português** | [English — detailed reference](./realtime-protocol.en.md)

O lobby público recebe resumos de salas por `GET /api/lobby`. Para jogar, o navegador obtém uma sessão anônima em `POST /api/session`. Comandos seguem por `POST /api/command` e o WebSocket distribui atualizações. A autenticação do socket ocorre na primeira mensagem, sem credenciais na URL.

Os comandos de jogo incluem um ID único e a versão esperada da sala. Se a versão mudou, o cliente recupera o estado atual antes de tentar novamente. Chat, reações e moderação exigem o identificador da sala e uma sessão autorizada. O lobby não transmite histórico de conversas.
