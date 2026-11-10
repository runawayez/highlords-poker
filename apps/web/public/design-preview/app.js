const $ = (id) => document.getElementById(id);
let current = 'home',
  mode = 'all',
  botCount = 3,
  seatCount = 6,
  toastTimer;
function card(rank, suit, back = false) {
  if (back) return '<div class="card back" aria-label="Carta fechada"></div>';
  if (!rank) return '<div class="card empty" aria-label="Carta comunitária ainda fechada">♠</div>';
  return (
    '<div class="card ' +
    (['♥', '♦'].includes(suit) ? 'red' : '') +
    '" aria-label="' +
    rank +
    ' ' +
    suit +
    '"><b>' +
    rank +
    '</b><span class="pip">' +
    suit +
    '</span><span class="suit">' +
    suit +
    '</span><span class="corner">' +
    rank +
    '</span></div>'
  );
}
function avatar(i = 0) {
  const colors = [
    ['#5a313d', '#d5a676'],
    ['#293d4c', '#a3b9c1'],
    ['#3b4530', '#b2b484'],
    ['#443452', '#b79fbf'],
    ['#544231', '#cbb17c'],
    ['#25443c', '#8dbdac'],
  ][i % 6];
  return (
    '<svg viewBox="0 0 100 100" aria-hidden="true"><defs><radialGradient id="a' +
    i +
    '"><stop stop-color="' +
    colors[0] +
    '"/><stop offset="1" stop-color="#191d20"/></radialGradient><linearGradient id="m' +
    i +
    '" x2="1" y2="1"><stop stop-color="' +
    colors[1] +
    '"/><stop offset=".5" stop-color="#686a63"/><stop offset="1" stop-color="#bdb19a"/></linearGradient></defs><circle cx="50" cy="50" r="50" fill="url(#a' +
    i +
    ')"/><path d="M11 100q2-25 27-28h24q25 3 27 28" fill="#171e22" stroke="' +
    colors[1] +
    '" stroke-width="2"/><path d="M50 13 25 29l3 38 22 17 22-17 3-38Z" fill="url(#m' +
    i +
    ')"/><path d="M50 13v71L28 67l-3-38Z" fill="#171e2580"/><path d="m25 39 23 8 27-8-5 16-20 6-20-6Z" fill="#10171a"/><path d="m32 46 13 4m10 0 13-4" stroke="' +
    colors[1] +
    '" stroke-width="2"/><path d="M50 43v33m-13-9 9 3m8 0 9-3" stroke="#172024" stroke-width="3"/><path d="m45 16 5-10 5 10" fill="' +
    colors[1] +
    '"/></svg>'
  );
}
const rooms = [
  {
    title: 'Noite dos Highlords',
    host: 'Berkas',
    mode: 'cash',
    type: 'Cash game',
    small: '25 / 50',
    players: 4,
    seats: 6,
    private: true,
    status: 'Em jogo',
  },
  {
    title: 'A última e vamos dormir',
    host: 'Bellato',
    mode: 'cash',
    type: 'Cash game',
    small: '50 / 100',
    players: 3,
    seats: 6,
    private: false,
    status: 'Em jogo',
  },
  {
    title: 'Copa Highlords · sexta-feira',
    host: 'Mahapralaya',
    mode: 'tournament',
    type: 'Campeonato',
    small: '25 / 50',
    players: 6,
    seats: 9,
    private: true,
    status: 'Aguardando',
  },
  {
    title: 'Mesa dos notívagos',
    host: 'Kyofu',
    mode: 'sng',
    type: 'Sit & Go',
    small: '10 / 20',
    players: 2,
    seats: 6,
    private: false,
    status: 'Aguardando',
  },
];
function dots(r) {
  return (
    '<span class="seats-dots">' +
    Array.from(
      { length: r.seats },
      (_, i) => '<i class="' + (i < r.players ? 'full' : '') + '"></i>',
    ).join('') +
    '</span>'
  );
}
function renderRooms() {
  $('homeRooms').innerHTML = rooms
    .slice(0, 3)
    .map(
      (r, i) =>
        '<button class="room-tile" onclick="selectRoom(' +
        i +
        ')"><div class="room-tile-top"><span>' +
        r.type +
        '</span><span>' +
        (r.private ? '⌑ Privada' : 'Pública') +
        '</span></div><h3>' +
        r.title +
        '</h3><p>' +
        r.small +
        ' · ' +
        r.players +
        '/' +
        r.seats +
        ' assentos</p><div class="tile-bottom">' +
        dots(r) +
        '<span>Sentar à mesa ↗</span></div></button>',
    )
    .join('');
  const q = $('search').value.toLocaleLowerCase(),
    access = $('access').value,
    found = rooms.filter(
      (r) =>
        (mode === 'all' || r.mode === mode) &&
        (r.title + ' ' + r.host).toLocaleLowerCase().includes(q) &&
        (access === 'all' || r.private === (access === 'private')),
    );
  $('lobbyRooms').innerHTML = found.length
    ? found
        .map(
          (r) =>
            '<tr><td><span class="table-symbol">' +
            (r.mode === 'tournament' ? '♛' : '♠') +
            '</span><strong>' +
            r.title +
            '</strong><small>' +
            r.type +
            ' · ' +
            r.host +
            (r.private ? ' · ⌑' : '') +
            '</small></td><td>' +
            r.small +
            '</td><td>' +
            r.players +
            ' / ' +
            r.seats +
            '<div style="margin-top:9px">' +
            dots(r) +
            '</div></td><td><span class="online">' +
            r.status +
            '</span></td><td><button class="btn" onclick="selectRoom(' +
            rooms.indexOf(r) +
            ')">Sentar à mesa →</button></td></tr>',
        )
        .join('')
    : '<tr><td colspan="5">Nenhuma mesa encontrada. Tente outro filtro.</td></tr>';
}
const people = [
  { name: 'Berkas', chips: '4.850', i: 0, self: true },
  { name: 'Bellato', chips: '6.200', i: 1 },
  { name: 'Magnus', chips: '3.750', i: 2, bot: true },
  { name: 'Kyofu', chips: '5.400', i: 3, folded: true },
  { name: 'Mahapralaya', chips: '7.150', i: 4 },
  { name: 'Raven', chips: '4.100', i: 5, bot: true },
];
function renderSeats() {
  const layout = {
    2: [
      [50, 88],
      [50, 11],
    ],
    6: [
      [50, 88],
      [13, 65],
      [17, 23],
      [50, 11],
      [83, 23],
      [87, 65],
    ],
    9: [
      [50, 89],
      [20, 81],
      [10, 53],
      [18, 23],
      [39, 10],
      [65, 10],
      [83, 23],
      [90, 53],
      [80, 81],
    ],
  };
  const positions = layout[seatCount],
    all = people
      .concat([
        { name: 'Fenrir', chips: '5.200', i: 1, bot: true },
        { name: 'Rook', chips: '3.900', i: 2, bot: true },
        { name: 'Ash', chips: '6.300', i: 3, bot: true },
      ])
      .slice(0, seatCount);
  $('arena').dataset.seats = seatCount;
  $('seatedCount').textContent = seatCount + ' jogadores à mesa';
  $('seats').innerHTML = all
    .map(
      (p, i) =>
        '<div class="seat ' +
        (p.self ? 'self active' : '') +
        ' ' +
        (p.bot ? 'bot' : '') +
        ' ' +
        (p.folded ? 'folded' : '') +
        '" style="left:' +
        positions[i][0] +
        '%;top:' +
        positions[i][1] +
        '%"><span class="avatar">' +
        avatar(p.i) +
        '</span><div class="nameplate"><strong>' +
        p.name +
        '</strong><b>' +
        p.chips +
        '</b>' +
        (p.self ? '<span class="timer"></span><span class="dealer">D</span>' : '') +
        '</div></div>' +
        (!p.self && !p.folded
          ? '<div class="table-cards" style="left:' +
            (positions[i][0] * 0.65 + 17.5) +
            '%;top:' +
            (positions[i][1] * 0.65 + 15.75) +
            '%">' +
            card(null, null, true) +
            card(null, null, true) +
            '</div>'
          : ''),
    )
    .join('');
}
function setState(s) {
  $('arena').className = 'arena ' + (s === 'playing' ? '' : s);
  document
    .querySelectorAll('[data-state]')
    .forEach((e) => e.classList.toggle('selected', e.dataset.state === s));
  $('board').innerHTML =
    card('A', '♠') +
    card('7', '♦') +
    card('2', '♣') +
    (s === 'victory' ? card('K', '♣') + card('K', '♥') : card() + card());
  $('street').textContent = s === 'victory' ? 'SHOWDOWN' : s === 'waiting' ? '—' : 'FLOP';
  $('pot').textContent = s === 'victory' ? '2.750' : '1.250';
  $('ownCaption').textContent = s === 'victory' ? 'DOIS PARES · ASES E REIS' : 'UM PAR · ASES';
  $('handDescription').textContent =
    s === 'victory'
      ? 'Dois pares: ases e reis'
      : s === 'waiting'
        ? 'Tudo pronto para começar'
        : 'Um par de ases';
  $('turn').textContent =
    s === 'victory' ? 'MÃO ENCERRADA' : s === 'waiting' ? 'AGUARDANDO AMIGOS' : 'SUA VEZ · 18s';
  $('ownCards').style.opacity = '';
  document
    .querySelectorAll('.decision,.amount input,.presets button')
    .forEach((e) => (e.disabled = s !== 'playing'));
  document
    .querySelectorAll('.table-cards,.arena>.bet')
    .forEach((e) => (e.style.visibility = s === 'waiting' ? 'hidden' : 'visible'));
}
function show(screen) {
  current = screen;
  document
    .querySelectorAll('.screen')
    .forEach((e) => e.classList.toggle('active', e.id === screen));
  $('header').style.display = screen === 'game' ? 'none' : 'flex';
  $('footer').style.display = screen === 'game' ? 'none' : 'flex';
  document
    .querySelectorAll('[data-nav]')
    .forEach((e) => e.classList.toggle('active', e.dataset.nav === screen));
  closeDrawer();
  window.scrollTo(0, 0);
  history.replaceState({}, '', '#' + screen);
}
function setMode(el) {
  mode = el.dataset.mode;
  document.querySelectorAll('[data-mode]').forEach((e) => e.classList.toggle('active', e === el));
  renderRooms();
}
function selectRoom(i) {
  $('gameTitle').textContent = rooms[i].title;
  setState(rooms[i].status === 'Aguardando' ? 'waiting' : 'playing');
  show('game');
}
function syncBet(value) {
  value = Math.max(500, Math.min(4850, Number(value) || 500));
  $('betSlider').value = value;
  $('betNumber').value = value;
  $('raiseLabel').textContent = 'Aumentar para ' + new Intl.NumberFormat('pt-BR').format(value);
}
function toast(message) {
  $('toast').textContent = message;
  $('toast').classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('toast').classList.remove('show'), 3500);
}
function act(action) {
  if (action === 'fold') {
    $('ownCards').style.opacity = '.3';
    $('ownCaption').textContent = 'DESISTIU';
    $('turn').textContent = 'SUA MÃO TERMINOU';
    document.querySelectorAll('.decision').forEach((e) => (e.disabled = true));
    toast('Você desistiu. Suas cartas continuam junto ao seu assento.');
  } else {
    toast(
      action === 'call'
        ? 'Você pagou 250 fichas. Resultado demonstrativo.'
        : 'Aposta simulada de ' + $('betNumber').value + ' fichas.',
    );
    setState('victory');
  }
}
function openDrawer(type) {
  $('drawer').classList.add('open');
  if (type === 'players') {
    $('drawerTitle').textContent = 'Sua mesa, seus convidados.';
    $('drawerContent').innerHTML =
      '<p>Os controles de anfitrião ficam aqui. O jogo continua sendo o foco.</p><div id="roster"></div><button class="btn" onclick="addBot()">＋ Adicionar bot</button><button class="btn" onclick="copyInvite()">Copiar link deste preview</button><button class="btn" onclick="toast(\'Demonstração pausada\')">Ⅱ Pausar demonstração</button>';
    drawRoster();
  } else {
    $('drawerTitle').textContent = 'Conversa da mesa';
    $('drawerContent').innerHTML =
      '<p>Mensagens demonstrativas. Este chat não envia nada para outros jogadores.</p><div id="messages"><div class="chat-message"><strong>Bellato</strong><p>Hoje tem revanche.</p></div><div class="chat-message"><strong>Kyofu</strong><p>Só mais uma mão e eu vou dormir…</p></div></div><form class="chat-input" onsubmit="sendChat(event)"><input id="chatInput" aria-label="Mensagem de demonstração" placeholder="Conversar com a mesa…" maxlength="200"><button aria-label="Enviar mensagem">↗</button></form>';
  }
}
function drawRoster() {
  $('roster').innerHTML = people
    .slice(0, 3)
    .concat(
      Array.from({ length: botCount }, (_, i) => ({
        name: ['Raven', 'Fenrir', 'Ash', 'Rook', 'Knight', 'Wisp'][i],
        i: i + 3,
        bot: true,
      })),
    )
    .map(
      (p, i) =>
        '<div class="roster-row"><span class="avatar">' +
        avatar(p.i) +
        '</span><div><strong>' +
        p.name +
        '</strong><small>' +
        (p.bot ? 'Bot · médio' : 'Amigo') +
        '</small></div>' +
        (i >= 3 ? '<button onclick="removeBot()">Remover</button>' : '') +
        '</div>',
    )
    .join('');
}
function addBot() {
  if (botCount >= 6) {
    toast('Mesa demonstrativa completa.');
    return;
  }
  botCount++;
  drawRoster();
}
function removeBot() {
  botCount = Math.max(0, botCount - 1);
  drawRoster();
}
function closeDrawer() {
  $('drawer').classList.remove('open');
}
async function copyInvite() {
  try {
    await navigator.clipboard.writeText(location.href);
    toast('Link do preview copiado.');
  } catch {
    toast(location.href);
  }
}
function sendChat(e) {
  e.preventDefault();
  const input = $('chatInput');
  if (!input.value.trim()) return;
  const div = document.createElement('div');
  div.className = 'chat-message';
  const strong = document.createElement('strong');
  strong.textContent = 'Berkas';
  const p = document.createElement('p');
  p.textContent = input.value;
  div.append(strong, p);
  $('messages').append(div);
  input.value = '';
}
function openBuilder() {
  updateBuilder();
  $('builder').showModal();
}
function closeBuilder() {
  $('builder').close();
}
function setFormat(el) {
  el.parentElement
    .querySelectorAll('button')
    .forEach((e) => e.classList.toggle('selected', e === el));
}
const palettes = {
  green: 'radial-gradient(ellipse,#286b51,#103e2e)',
  wine: 'radial-gradient(ellipse,#753a50,#401e31)',
  blue: 'radial-gradient(ellipse,#2e526e,#162d42)',
};
function updateBuilder() {
  $('previewTitle').textContent = $('newTitle').value || 'Mesa dos amigos';
  $('previewSeats').textContent = $('newSeats').value;
  $('previewStack').textContent = $('newStack').value;
  $('previewFelt').style.background = palettes[$('newTheme').value];
  $('previewFelt')
    .querySelectorAll('.mini-seat')
    .forEach((e) => e.remove());
  const count = Number($('newSeats').value);
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2,
      seat = document.createElement('i');
    seat.className = 'mini-seat';
    seat.style.left = 'calc(' + (50 + Math.sin(angle) * 47) + '% - 11px)';
    seat.style.top = 'calc(' + (50 + Math.cos(angle) * 45) + '% - 11px)';
    seat.textContent = i === 0 ? '♠' : i + 1;
    $('previewFelt').append(seat);
  }
}
function previewCreated() {
  $('gameTitle').textContent = $('newTitle').value || 'Mesa dos amigos';
  seatCount = Number($('newSeats').value);
  renderSeats();
  $('arena').querySelector('.felt').style.background = palettes[$('newTheme').value];
  $('builder').close();
  show('game');
  setState('waiting');
  toast('Simulação visual: nenhuma sala real foi criada.');
}
function openGuide() {
  $('guide').showModal();
}
function closeGuide() {
  $('guide').close();
}
Object.assign(window, {
  renderRooms,
  show,
  setMode,
  selectRoom,
  syncBet,
  toast,
  act,
  openDrawer,
  closeDrawer,
  addBot,
  removeBot,
  copyInvite,
  sendChat,
  openBuilder,
  closeBuilder,
  setFormat,
  updateBuilder,
  previewCreated,
  openGuide,
  closeGuide,
  setState,
});
$('heroHand').innerHTML = card('A', '♠') + card('K', '♥') + card('Q', '♣');
$('ownCards').innerHTML = card('A', '♥') + card('Q', '♠');
$('guideCards').innerHTML = ['A', 'K', 'Q', 'J', '10'].map((r) => card(r, '♠')).join('');
for (const id of ['back1', 'back2', 'back3']) $(id).remove();
document
  .querySelectorAll('[data-avatar]')
  .forEach((el) => (el.innerHTML = avatar(Number(el.dataset.avatar))));
renderRooms();
renderSeats();
setState('playing');
updateBuilder();
show(['home', 'lobby', 'game'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'home');
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeDrawer();
});
window.addEventListener('hashchange', () => {
  const next = location.hash.slice(1);
  if (['home', 'lobby', 'game'].includes(next) && next !== current) show(next);
});

window.addEventListener('load', () => window.scrollTo(0, 0), { once: true });
