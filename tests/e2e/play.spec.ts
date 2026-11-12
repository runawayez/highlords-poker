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

  await guest.getByRole('button', { name: 'Chat' }).first().click();
  await guest.getByPlaceholder(/Digite uma mensagem/).fill('oi pessoal');
  await guest.getByRole('button', { name: 'Enviar' }).click();
  await page.getByRole('button', { name: 'Chat' }).first().click();
  await expect(page.getByText('oi pessoal')).toBeVisible();
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
  await page.goto('/');
  await page.getByRole('button', { name: /Jogar contra bots/ }).click();
  await expect(page.locator('.seat.me .hole-card').first()).toBeVisible();
  const deadline = Date.now() + 40_000;
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

test('o passo a passo aparece na primeira mesa e pode ser pulado', async ({ page }) => {
  await page.addInitScript(() => {
    // Só na primeira carga: depois de pular o tour, recarregar não pode trazê-lo de volta.
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('highlords.prefs', '{}');
  });
  await page.goto('/');
  await page.getByRole('button', { name: /Jogar contra bots/ }).click();
  const tour = page.getByRole('dialog', { name: 'Passo a passo' });
  await expect(tour).toBeVisible();
  await tour.getByRole('button', { name: 'Pular' }).click();
  await expect(tour).toHaveCount(0);
  await page.reload();
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
