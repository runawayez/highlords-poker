---
name: poker-engine-audit
description: Auditar o motor de Texas Hold'em (apostas, side pots, ficha ímpar, all-in curto, ordem de ação). Use após qualquer alteração em packages/poker-engine ou ao suspeitar de erro de pote.
---

# Auditoria do motor NLHE

1. Rode `pnpm vitest run tests/engine.test.ts tests/engine-fuzz.test.ts`.
2. O fuzz joga milhares de mãos aleatórias (2–9 jogadores, stacks desiguais) com ações legais e verifica:
   - **conservação**: soma das fichas depois == antes;
   - **terminação**: a mão acaba em no máximo 200 ações;
   - **awards**: soma dos prêmios + devoluções coerente com o pote;
   - **sigilo**: `publicHand(h, id)` nunca expõe cartas alheias antes do showdown.
3. Casos manuais que costumam quebrar: all-in curto que não reabre a ação, BB com opção, heads-up (botão = SB),
   ficha ímpar ao primeiro à esquerda do botão, side pots com jogador que desistiu, devolução de aposta não coberta.
4. Se achar bug, escreva primeiro o teste que falha, depois corrija.
