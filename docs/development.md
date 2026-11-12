# Desenvolvimento

Requisitos: Node 22.13+, pnpm 11.

```bash
pnpm install
pnpm dev        # http://localhost:5173 (Vite) com a API em http://localhost:3001
```

O servidor local usa o mesmo `RoomRuntime` do Worker, com estado em memória. Para testar o Worker de verdade:
`pnpm worker:dev` (compila o site e roda `wrangler dev`).

## Testes

| Comando         | O que cobre                                                                                               |
| --------------- | --------------------------------------------------------------------------------------------------------- |
| `pnpm test`     | Motor (incluindo fuzz de 3000 mãos), sala, bots, transporte WebSocket, i18n                               |
| `pnpm test:e2e` | Fluxos no navegador (desktop e celular). Rode `pnpm build` antes; use `CI=1` para usar o Chrome instalado |
| `pnpm check`    | typecheck + lint + testes + build                                                                         |

Ao alterar o motor, o teste `tests/engine-fuzz.test.ts` precisa continuar verde (conservação de fichas, término, sigilo).
