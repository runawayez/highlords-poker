# Publicação

Tudo roda em um Worker da Cloudflare (plano gratuito basta).

```bash
pnpm worker:deploy      # compila o site e publica; exige CONFIRM_FREE_PLAN=yes
```

Requer `CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID`. O GitHub Actions publica a cada push na `main` quando os secrets
existem. O Worker se chama `highlords-poker`; o endereço sai em `https://highlords-poker.<subdomínio>.workers.dev`.

A migração `v1` cria as classes `PokerRoom` e `Lobby`. A versão anterior (Worker `highlords-poker-api` + Vercel) pode ser
desligada depois que o novo endereço estiver no ar; mesas em andamento nela não migram.
