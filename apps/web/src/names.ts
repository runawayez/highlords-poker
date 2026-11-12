/** Apelidos sorteados para quem ainda não escolheu um: "Ás Sereno", "Golden Bluff"... */
const PT = {
  nouns: [
    'Ás',
    'Rei',
    'Dama',
    'Valete',
    'Blefe',
    'Flop',
    'River',
    'Turn',
    'Trinca',
    'Sequência',
    'Coringa',
    'Croupier',
    'Banca',
    'Pote',
    'Feltro',
    'Ficha',
  ],
  adjectives: [
    'Sereno',
    'Dourado',
    'Noturno',
    'Astuto',
    'Calado',
    'Veloz',
    'Ousado',
    'Sortudo',
    'Frio',
    'Real',
    'Sombrio',
    'Brilhante',
    'Cauteloso',
    'Misterioso',
  ],
};
const EN = {
  nouns: [
    'Ace',
    'King',
    'Queen',
    'Jack',
    'Bluff',
    'Flop',
    'River',
    'Turn',
    'Flush',
    'Straight',
    'Joker',
    'Dealer',
    'Banker',
    'Pot',
    'Felt',
    'Chip',
  ],
  adjectives: [
    'Calm',
    'Golden',
    'Midnight',
    'Sly',
    'Silent',
    'Swift',
    'Bold',
    'Lucky',
    'Cold',
    'Royal',
    'Shady',
    'Bright',
    'Careful',
    'Mystic',
  ],
};

const pick = <T>(list: readonly T[], random: number) => list[random % list.length];

/** Nome aleatório com no máximo 20 caracteres, no idioma pedido (padrão: o do navegador). */
export function randomNickname(language = navigator.language): string {
  const portuguese = language.toLowerCase().startsWith('pt');
  const words = portuguese ? PT : EN;
  const [a, b] = crypto.getRandomValues(new Uint32Array(2));
  const noun = pick(words.nouns, a);
  const adjective = pick(words.adjectives, b);
  // Em inglês o adjetivo vem antes ("Golden Ace"); em português, depois ("Ás Dourado").
  const name = portuguese ? `${noun} ${adjective}` : `${adjective} ${noun}`;
  return name.slice(0, 20);
}
