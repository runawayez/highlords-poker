---
name: poker-ui-polish
description: Diretrizes visuais e de experiência da mesa do Highlords (cassino noturno: feltro, madeira, latão). Use ao criar ou ajustar telas, animações e sons.
---

# Direção visual: salão noturno

- Paleta (tokens em `:root` de `styles.css`): feltro `--felt`, madeira `--wood`, latão `--brass`, carmesim `--crimson`.
- Sem fontes externas; pilha serifada para títulos, humanista para texto.
- Animação só com `transform`/`opacity`; respeitar `prefers-reduced-motion`.
- Toda ação do jogo tem feedback: som + movimento. Vez do jogador: anel de tempo + som.
- Mobile primeiro: a mesa cabe na tela sem rolagem e os botões de ação ficam no rodapé, 48px de altura mínima.
- Sem login, sem formulários longos: o caminho "abrir site → sentar" tem no máximo 2 toques.
