# Ambiente de desenvolvimento

**Português** | [English — detailed reference](./development.en.md)

Para trabalhar no código, use Node.js 24 LTS e pnpm 11.25.0. Na raiz do repositório, execute:

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Abra o endereço exibido pelo Vite. Use dois perfis de navegador para simular jogadores diferentes. A API local usa SQLite em `.data/poker.sqlite`. Execute apenas um processo por banco. Copie `.env.example` para `.env` para personalizar a configuração.

A interface fica em `apps/web`, os servidores em `apps/local-server` e `apps/worker`, e as regras compartilhadas em `packages`.
