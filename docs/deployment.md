# Publicação pelo mantenedor

**Português** | [English — detailed reference](./deployment.en.md)

O frontend é publicado no Vercel. Para habilitar partidas, publique também o Worker com o Durable Object SQLite em uma conta Workers Free. Confira o plano da conta antes de publicar.

1. Configure `ALLOWED_ORIGINS` em `apps/worker/wrangler.jsonc` com a origem HTTPS exata do site.
2. Autentique o Wrangler na conta do mantenedor e execute `CONFIRM_FREE_PLAN=yes pnpm worker:deploy` em um shell compatível.
3. Configure `VITE_API_URL` no Vercel com a origem HTTPS pública do Worker e refaça o build.
4. Teste criação de sala, convite e uma mão com dois navegadores independentes.

Para auto-hospedar, execute `pnpm build` e `pnpm start` com disco persistente, HTTPS e suporte a WebSocket no proxy. Consulte os detalhes em inglês abaixo para cotas, monitoramento e manutenção.
