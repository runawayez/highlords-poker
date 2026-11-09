# Decisão 001 — Coordenador do clube

**Português** | [English — detailed reference](./001-bounded-coordinator.en.md)

Para evitar duplicação de jogadores ou fichas em uma transferência, a atribuição de mesas e os stacks são gravados juntos. Cada mesa mantém seu próprio baralho e sua mão. Essa decisão simplifica a recuperação após falhas, com o custo de serializar alterações do clube e limitar o tamanho do estado persistido.
