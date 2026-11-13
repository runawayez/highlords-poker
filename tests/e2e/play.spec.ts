import { test, expect } from '@playwright/test';

// O passo a passo da primeira mesa cobriria os botões: os testes de jogo o dão por visto.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem('highlords.prefs'))
      localStorage.setItem('highlords.prefs', JSON.stringify({ tourDone: true }));
  });
});

test('abrir o site, jogar contra bots e agir na mesa', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.getByRole('button', { name: /Jogar contra bots/ }).click();
  await expect(page).toHaveURL(/\/mesa\/[A-Z2-9]{6}$/);
  // Cartas próprias na mesa e a barra de ações na minha vez (ou aguardando a vez dos bots).
  await expect(page.locator('.seat.me .hole-card').first()).toBeVisible();
  const fold = page.getByRole('button', { name: /Desistir/ });
  await expect(fold).toBeVisible({ timeout: 30000 });
  await fold.click();
  await expect(page.locator('.seat.me.folded')).toBeVisible();
  // O gameplay não gera rolagem horizontal nem estoura a tela.
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test('duas pessoas entram pelo código e conversam no chat', async ({ browser, page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Criar mesa/ }).click();
  await page.getByRole('button', { name: /Abrir mesa/ }).click();
  await expect(page).toHaveURL(/\/mesa\//);
  const code = page.url().split('/').pop()!;

  const guest = await (await browser.newContext()).newPage();
  await guest.goto('/');
  await guest.getByLabel(/Tem um código/).fill(code);
  await guest.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(guest).toHaveURL(new RegExp(`/mesa/${code}$`));
  await guest.getByRole('button', { name: /Sentar em uma cadeira/ }).click();
  await expect(page.locator('.seat:not(.empty)')).toHaveCount(2);

  // Em tela larga o chat já fica fixo ao lado da mesa; no celular ele abre pela faixa/botão.
  const openChat = async (view: typeof page) => {
    const toggle = view.getByRole('button', { name: 'Chat' }).first();
    if (await toggle.isVisible()) await toggle.click();
  };
  await openChat(guest);
  await guest.getByPlaceholder(/Digite uma mensagem/).fill('oi pessoal');
  await guest.getByRole('button', { name: 'Enviar' }).click();
  await openChat(page);
  await expect(page.locator('.chat').getByText('oi pessoal')).toBeVisible();
  await guest.context().close();
});

test('a página de aprender funciona e o idioma muda', async ({ page }) => {
  await page.goto('/como-jogar');
  await expect(page.getByRole('tab').first()).toBeVisible();
  await page.getByRole('button', { name: 'Idioma' }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});

test('o campo de senha mantém o foco enquanto se digita', async ({ browser, page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Criar mesa/ }).click();
  await page.getByText('Mais opções').click();
  await page.getByLabel(/Senha/).fill('segredo');
  await page.getByRole('button', { name: /Abrir mesa/ }).click();
  await expect(page).toHaveURL(/\/mesa\//);
  const code = page.url().split('/').pop()!;

  const guest = await (await browser.newContext()).newPage();
  await guest.goto(`/mesa/${code}`);
  const input = guest.locator('.modal input[type=password]');
  await expect(input).toBeFocused();
  await input.pressSequentially('segredo', { delay: 40 });
  await expect(input).toBeFocused();
  await expect(input).toHaveValue('segredo');
  await guest.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(guest.locator('.modal')).toHaveCount(0);
  await guest.context().close();
});

test('cada assento tem no máximo duas cartas ao longo de várias mãos', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/');
  await page.getByRole('button', { name: /Jogar contra bots/ }).click();
  await expect(page.locator('.seat.me .hole-card').first()).toBeVisible();
  const deadline = Date.now() + 90_000;
  const handsSeen = new Set<string>();
  while (Date.now() < deadline && handsSeen.size < 3) {
    const call = page.getByRole('button', { name: /Pagar|Passar/ });
    if (await call.isVisible()) await call.click().catch(() => undefined);
    const extra = await page.evaluate(
      () =>
        [...document.querySelectorAll('.seat')].filter(
          (seat) =>
            seat.querySelectorAll('.hole').length > 1 ||
            seat.querySelectorAll('.hole-card').length > 2 ||
            seat.querySelectorAll('.card').length > 2 ||
            [...seat.querySelectorAll('.card')].some(
              (card) => card.querySelectorAll('.card-face').length !== 1,
            ),
        ).length,
    );
    expect(extra).toBe(0);
    const hand = (await page.locator('body').innerText()).match(/Mão #(\d+)/);
    if (hand) handsSeen.add(hand[1]);
    await page.waitForTimeout(150);
  }
  expect(handsSeen.size).toBeGreaterThanOrEqual(2);
});

test('o perfil pode ser editado e aparece na mesa', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Personalizar perfil/ }).click();
  await page.locator('.modal').getByLabel('Seu nome').fill('Ana Teste');
  await page.getByRole('radio', { name: 'Azul' }).click();
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.locator('.modal')).toHaveCount(0);
  await page.getByRole('button', { name: /Jogar contra bots/ }).click();
  await expect(page).toHaveURL(/\/mesa\//);
  await page.getByRole('button', { name: 'Menu' }).click();
  await expect(page.locator('.roster')).toContainText('Ana Teste');
  // Edita de novo já dentro da sala: o novo apelido chega a quem está na mesa.
  await page.getByRole('button', { name: 'Editar perfil' }).click();
  await page.locator('.modal').getByLabel('Seu nome').fill('Ana Mudou');
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.locator('.roster')).toContainText('Ana Mudou');
});

test('o passo a passo não abre sozinho na primeira mesa', async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('highlords.prefs', '{}');
  });
  await page.goto('/');
  await page.getByRole('button', { name: /Jogar contra bots/ }).click();
  await expect(page.locator('.seat.me .hole-card').first()).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Passo a passo' })).toHaveCount(0);
});

test('os ajustes trocam o tema da mesa e persistem', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Ajustes' }).click();
  await page.getByRole('radio', { name: /Real/ }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'royal');
  await page.keyboard.press('Escape');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'royal');
});

test('o dado sorteia outro nome e o perfil só oferece emblemas', async ({ page }) => {
  await page.goto('/');
  const nickname = page.locator('#nickname');
  const before = await nickname.inputValue();
  expect(before).not.toMatch(/^Highlord\d+$/);
  // Sorteia até mudar (a chance de repetir seguidas é desprezível).
  for (let attempt = 0; attempt < 5 && (await nickname.inputValue()) === before; attempt++) {
    await page.getByRole('button', { name: /Sortear outro nome/ }).click();
  }
  expect(await nickname.inputValue()).not.toBe(before);
  await page.getByRole('button', { name: /Personalizar perfil/ }).click();
  await expect(page.locator('.avatar-picker button')).toHaveCount(12);
});

test('no desktop o chat fica fixo ao lado da mesa', async ({ page, isMobile }) => {
  test.skip(!!isMobile, 'a faixa compacta do celular tem outro fluxo');
  await page.goto('/');
  await page.getByRole('button', { name: /Jogar contra bots/ }).click();
  await expect(page.locator('.dock .chat')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Chat' })).toHaveCount(0);
});

test('no celular o chat aparece como faixa e abre em painel', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'só vale no celular');
  await page.goto('/');
  await page.getByRole('button', { name: /Jogar contra bots/ }).click();
  await page.locator('.chat-strip').click();
  await expect(page.locator('.side-panel .chat')).toBeVisible();
});

test('a mesa não pula entre a minha vez e a dos outros', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/');
  await page.getByRole('button', { name: /Jogar contra bots/ }).click();
  await expect(page.locator('.seat.me .hole-card').first()).toBeVisible();
  const geometry = () =>
    page.evaluate(() => {
      const rail = document.querySelector('.rail')!.getBoundingClientRect();
      const bar = document.querySelector('.action-bar')!.getBoundingClientRect();
      return `${Math.round(rail.top)}/${Math.round(rail.height)}/${Math.round(bar.height)}`;
    });
  const seen = new Set<string>();
  const turns = new Set<boolean>();
  const deadline = Date.now() + 45_000;
  while (
    Date.now() < deadline &&
    !(turns.size === 2 && seen.size >= 1 && Date.now() > deadline - 30_000)
  ) {
    seen.add(await geometry());
    turns.add(await page.locator('.action-bar.my-turn').isVisible());
    const call = page.getByRole('button', { name: /Pagar|Passar/ });
    if (await call.isVisible()) await call.click().catch(() => undefined);
    await page.waitForTimeout(150);
  }
  expect(turns.size).toBe(2);
  // A mesa e a bandeja de ações ficam sempre do mesmo tamanho e no mesmo lugar.
  expect([...seen]).toHaveLength(1);
});

test('a aparência mostra uma prévia da mesa que acompanha as escolhas e restaura o padrão', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Ajustes' }).click();
  await expect(page.locator('.pv')).toBeVisible();
  await expect(page.locator('.pv .pv-board .pv-card')).toHaveCount(5);
  await page.getByRole('radio', { name: /Real/ }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'royal');
  await page.getByRole('button', { name: 'Restaurar padrão' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'night');
});

test('mensagens de chat em rajada mostram aviso discreto e a mesa mantém D/SB/BB juntos', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Jogar contra bots/ }).click();
  await expect(page).toHaveURL(/\/mesa\//);
  const toggle = page.getByRole('button', { name: 'Chat' }).first();
  if (await toggle.isVisible()) await toggle.click();
  const input = page.getByPlaceholder(/Digite uma mensagem/);
  await input.fill('a');
  await page.getByRole('button', { name: 'Enviar' }).click();
  await input.fill('b');
  await page.getByRole('button', { name: 'Enviar' }).click();
  await expect(page.locator('.chat-hint')).toBeVisible();
  await expect(page.locator('.pos-cluster').first()).toBeVisible();
});

test('as animações da mesa rodam mesmo com o sistema em movimento reduzido e podem ser desligadas nos ajustes', async ({
  browser,
}) => {
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.addInitScript(() => {
    if (!localStorage.getItem('highlords.prefs'))
      localStorage.setItem('highlords.prefs', JSON.stringify({ tourDone: true }));
  });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'full');
  await page.getByRole('button', { name: /Jogar contra bots/ }).click();
  await expect(page.locator('.seat.me .hole-card').first()).toBeVisible();
  const duration = () =>
    page
      .locator('.seat.me .hole-card')
      .first()
      .evaluate((card) => getComputedStyle(card).animationDuration);
  expect(await duration()).toBe('0.5s');
  expect(
    await page
      .locator('.seat.me .hole-card')
      .first()
      .evaluate((card) => getComputedStyle(card).animationName),
  ).toBe('deal-fly');

  await page.evaluate(() => {
    const prefs = JSON.parse(localStorage.getItem('highlords.prefs') ?? '{}');
    localStorage.setItem('highlords.prefs', JSON.stringify({ ...prefs, reduceMotion: true }));
  });
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduced');
  await expect(page.locator('.seat.me .hole-card').first()).toBeVisible();
  expect(parseFloat(await duration())).toBeLessThan(0.001);
  await context.close();
});
