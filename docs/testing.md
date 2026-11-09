# Testes e verificação

**Português** | [English — detailed reference](./testing.en.md)

Execute `pnpm check` para verificar tipos, lint, testes e build. Para os testes de navegador, instale o Chromium com `pnpm exec playwright install chromium` e execute `pnpm test:e2e`. Use `pnpm format:check` para verificar a formatação.

A suíte verifica conservação de fichas, potes laterais, empates, privacidade das cartas, permissões, comandos repetidos e recuperação após reinício do servidor SQLite. Os cenários de navegador usam duas sessões independentes, troca de idioma durante uma mão, chat da sala e acesso em tela de celular. Há também um cenário que simula a resposta HTML de um site estático quando a API está indisponível e verifica o perfil após recarregar.
