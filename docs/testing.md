# Testes e verificação

**Português** | [English — detailed reference](./testing.en.md)

Execute `pnpm check` para verificar tipos, lint, testes e build. Para os testes de navegador, instale o Chromium com `pnpm exec playwright install chromium` e execute `pnpm test:e2e`. Use `pnpm format:check` para verificar a formatação.

A suíte verifica conservação de fichas, potes laterais, empates, privacidade das cartas, permissões, comandos repetidos e recuperação após reinício do servidor SQLite. Os cenários de navegador usam duas sessões independentes, troca de idioma durante uma mão, chat da sala e acesso em tela de celular. Há também um cenário que simula a resposta HTML de um site estático quando a API está indisponível e verifica o perfil após recarregar.

O ciclo de vida das salas é testado com relógio controlado: presença por sala, lobby sem renovar salas antigas, espectadores, pausa e reconexão, expiração de salas em espera/pausadas/em jogo, resultado de torneio por uma hora e impedimento de reativação após o prazo. Há testes de permissão e persistência do encerramento. Um cenário de navegador fecha uma página sem enviar “Sair”, aguarda a presença mudar e verifica o retorno ao lobby de todos quando o anfitrião encerra, preservando os perfis.
