# Publicação pelo mantenedor

**Português** | [English — detailed reference](./deployment.en.md)

O frontend é publicado no Vercel. Para habilitar partidas, publique também o Worker com o Durable Object SQLite em uma conta Workers Free. Confira o plano da conta antes de publicar.

1. Configure `ALLOWED_ORIGINS` em `apps/worker/wrangler.jsonc` com a origem HTTPS exata do site.
2. Autentique o Wrangler na conta do mantenedor e execute `CONFIRM_FREE_PLAN=yes pnpm worker:deploy` em um shell compatível.
3. Configure `VITE_API_URL` no Vercel com a origem HTTPS pública do Worker e refaça o build.
4. Teste criação de sala, convite e uma mão com dois navegadores independentes.

Para auto-hospedar, execute `pnpm build` e `pnpm start` com disco persistente, HTTPS e suporte a WebSocket no proxy. Consulte os detalhes em inglês abaixo para cotas, monitoramento e manutenção.

## Publicação automática pelo GitHub

A Vercel já acompanha a branch `main`. O job **Publicar Worker** do workflow **Verify** publica o backend após os testes de regras, integração e navegador, a formatação e o empacotamento do Worker passarem. Pull requests e outras branches não publicam o backend. Uma execução antiga é ignorada se a `main` já recebeu um commit mais recente; as publicações são serializadas.

### Configuração única

1. No [painel de tokens da Cloudflare](https://dash.cloudflare.com/profile/api-tokens), crie um **API token** com o modelo **Edit Cloudflare Workers**, limitado à conta usada pelo Highlords Poker. Não use a Global API Key.
2. Abra os [secrets do repositório](https://github.com/runawayez/highlords-poker/settings/secrets/actions) e adicione dois **Repository secrets**:
   - `CLOUDFLARE_API_TOKEN`: o token criado.
   - `CLOUDFLARE_ACCOUNT_ID`: o Account ID mostrado no painel da conta Cloudflare (não é o Zone ID).
3. Abra [Actions → Verify](https://github.com/runawayez/highlords-poker/actions/workflows/ci.yml), clique em **Run workflow**, selecione `main` e execute. Essa primeira execução confirma a autenticação e a publicação sem usar o terminal.

Depois disso, cada atualização da `main` passa pelos testes e publica automaticamente. Não é necessário repetir `wrangler login`, definir a variável no PowerShell ou executar `worker:deploy` no computador. A automação usa o mesmo Worker existente e verifica `/api/health` após publicar.

Enquanto os secrets não estiverem cadastrados, o job mostra um aviso e registra **Publicação não executada** no resumo; os testes continuam funcionando. Se o token expirar ou for revogado, atualize o secret e execute o workflow novamente. Nunca envie o token pelo chat nem o grave em arquivos do projeto. O login local do Wrangler não é transferido ao GitHub Actions.

O workflow mantém `CONFIRM_FREE_PLAN=yes` conforme a operação Workers Free já escolhida pelo mantenedor; não consulta nem altera o plano de cobrança. Referência: [Cloudflare — GitHub Actions](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/).
