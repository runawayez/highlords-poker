import { test, expect, type Page } from '@playwright/test';
async function enter(page: Page, nickname: string) {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.locator('.chat')).toHaveCount(0);
  await page.getByRole('button', { name: 'Meu perfil', exact: true }).click();
  await page.getByLabel('Como te chamamos?').fill(nickname);
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
}
test('two independent guests play, chat, change language mid-hand and reconnect', async ({
  browser,
  baseURL,
}) => {
  const contextA = await browser.newContext({ baseURL, locale: 'en-US' }),
    contextB = await browser.newContext({ baseURL, locale: 'en-US' });
  const a = await contextA.newPage(),
    b = await contextB.newPage();
  try {
    await enter(a, 'Alpha');
    await a.getByRole('button', { name: /Criar uma mesa/ }).click();
    await a.getByLabel('Nome da mesa').fill('Browser ' + Date.now());
    await a.getByRole('button', { name: 'Criar uma mesa', exact: true }).click();
    await expect(a).toHaveURL(/\/room\//);
    const roomUrl = a.url();
    await enter(b, 'Beta');
    await b.goto(roomUrl);
    await b.getByRole('button', { name: 'Confirmar', exact: true }).click();
    await expect(b.getByRole('dialog')).not.toBeVisible();
    await expect(a.getByRole('cell', { name: /Beta/ })).toBeVisible();
    await a.getByRole('button', { name: 'Distribuir cartas', exact: true }).click();
    await expect(a.locator('.hole-cards .playing-card:not(.card-back)')).toHaveCount(2);
    await expect(b.locator('.hole-cards .playing-card:not(.card-back)')).toHaveCount(2);
    await a.getByLabel('Selecionar idioma').selectOption('en');
    await expect(a.locator('html')).toHaveAttribute('lang', 'en');
    await expect(a.getByRole('button', { name: 'House rules', exact: true })).toBeVisible();
    await expect(b.getByRole('button', { name: 'Regras da casa', exact: true })).toBeVisible();
    await a.getByRole('tab', { name: 'Chat', exact: true }).click();
    await b.getByRole('tab', { name: 'Chat', exact: true }).click();
    await a.getByPlaceholder('Type a message…').fill('<img src=x onerror=alert(1)>');
    await a.getByRole('button', { name: 'Send', exact: true }).click();
    await expect(b.getByText('<img src=x onerror=alert(1)>', { exact: true })).toBeVisible();
    await expect(b.locator('.messages img')).toHaveCount(0);
    // All-in is always available for the preflop heads-up actor. Locate it in either independent client.
    const actorA = await a.getByRole('button', { name: 'All-in', exact: true }).isVisible();
    const actor = actorA ? a : b;
    await actor.getByRole('button', { name: 'All-in', exact: true }).click();
    const other = actorA ? b : a;
    await expect(other.getByRole('button', { name: 'All-in', exact: true })).toBeVisible();
    await other.getByRole('button', { name: 'All-in', exact: true }).click();
    await expect(a.locator('.community .playing-card:not(.card-empty)')).toHaveCount(5);
    await expect(a.locator('.winner').first()).toBeVisible();
    await a.reload();
    await expect(a.getByRole('button', { name: 'House rules', exact: true })).toBeVisible();
    await expect(a.getByRole('cell', { name: /Alpha/ })).toBeVisible();
    await expect(a.getByRole('dialog')).not.toBeVisible();
    await expect(a.locator('.community .playing-card:not(.card-empty)')).toHaveCount(5);
  } finally {
    await contextA.close().catch(() => undefined);
    await contextB.close().catch(() => undefined);
  }
});
test('mobile profile, language menu and lobby fit without horizontal overflow', async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({
    baseURL,
    locale: 'pt-BR',
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const p = await context.newPage();
  try {
    await enter(p, 'Mobile');
    await p.getByLabel('Selecionar idioma').selectOption('en');
    await expect(p.getByRole('button', { name: /Create a table/ })).toBeVisible();
    expect(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
      true,
    );
    await p.reload();
    await expect(p.getByRole('button', { name: 'Mobile', exact: true })).toBeVisible();
    await expect(p.locator('html')).toHaveAttribute('lang', 'en');
  } finally {
    await context.close().catch(() => undefined);
  }
});

test('profile survives reload when multiplayer returns the static site', async ({ page }) => {
  await page.route('**/api/**', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<html></html>' }),
  );
  await enter(page, 'Berkas');
  await page.reload();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Berkas', exact: true })).toBeVisible();
});

test('host adds and removes bots, plays a hand and reconnects', async ({ page }) => {
  await enter(page, 'Solo');
  await page.getByRole('button', { name: /Criar uma mesa/ }).click();
  await page.getByLabel('Nome da mesa').fill('Bots ' + Date.now());
  await page.getByRole('button', { name: 'Criar uma mesa', exact: true }).click();
  await expect(page).toHaveURL(/\/room\//);
  await page.getByLabel('Dificuldade dos bots').selectOption('HARD');
  await page.getByRole('button', { name: 'Adicionar bot', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Remover bot', exact: true })).toHaveCount(1);
  await page.getByRole('button', { name: 'Remover bot', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Remover bot', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Adicionar bot', exact: true }).click();
  await expect(page.getByRole('cell', { name: /Highlord Bot/ }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Distribuir cartas', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Adicionar bot', exact: true })).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'All-in', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'All-in', exact: true }).click();
  await expect(page.locator('.winner').first()).toBeVisible();
  await page.reload();
  await expect(page.getByRole('cell', { name: /Highlord Bot/ }).first()).toBeVisible();
  await expect(page.locator('.winner').first()).toBeVisible();
});

for (const viewport of [
  { width: 1440, height: 1050 },
  { width: 390, height: 844 },
]) {
  test(`visual table setup and nine-player controls at ${viewport.width}px`, async ({
    browser,
    baseURL,
  }) => {
    const context = await browser.newContext({ baseURL, viewport, locale: 'pt-BR' });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    try {
      await enter(page, 'Designer');
      if (viewport.width === 1440)
        await page.screenshot({ path: 'test-results/ui-desktop-lobby.png', fullPage: true });
      await page.getByRole('button', { name: /Criar uma mesa/ }).click();
      await expect(page.getByLabel('Prévia da mesa')).toBeVisible();
      await page.getByLabel('Nome da mesa').fill('Highlords Championship');
      await page.getByRole('button', { name: /Deep stack/ }).click();
      await page.getByLabel('Assentos por mesa').selectOption('9');
      await expect(page.locator('.preview-seat')).toHaveCount(9);
      await expect(
        page.locator('.preview-stats').getByText('200 BB', { exact: true }),
      ).toBeVisible();
      await page.screenshot({
        path: `test-results/ui-${viewport.width}-builder.png`,
        fullPage: true,
      });
      await page.getByRole('button', { name: 'Criar uma mesa', exact: true }).click();
      await expect(page).toHaveURL(/\/room\//);
      await expect(
        page.getByRole('button', { name: 'Distribuir cartas', exact: true }),
      ).toBeDisabled();
      await page.getByRole('button', { name: 'Completar com bots', exact: true }).click();
      await expect(page.locator('.roster tbody tr')).toHaveCount(9);
      await expect(page.locator('.empty-seat')).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Adicionar bot', exact: true })).toBeDisabled();
      await page.screenshot({
        path: `test-results/ui-${viewport.width}-waiting.png`,
        fullPage: true,
      });
      await page.getByRole('button', { name: 'Distribuir cartas', exact: true }).click();
      await expect(page.locator('.seat-profile')).toHaveCount(9);
      await expect(page.locator('.self .hole-cards .playing-card:not(.card-back)')).toHaveCount(2);
      await expect(page.locator('.self .seat-status')).toBeVisible();
      const boxes = await page.locator('.seat-profile').evaluateAll((elements) =>
        elements.map((e) => {
          const r = e.getBoundingClientRect();
          return { x: r.x, y: r.y, w: r.width, h: r.height };
        }),
      );
      for (let i = 0; i < boxes.length; i++)
        for (let j = i + 1; j < boxes.length; j++) {
          const a = boxes[i],
            b = boxes[j];
          const overlapX = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
          const overlapY = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
          expect(overlapX > 2 && overlapY > 2, `seats ${i} and ${j} overlap`).toBe(false);
        }
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
      await page.getByRole('button', { name: 'Pausar', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Retomar', exact: true })).toBeVisible();
      await page.screenshot({
        path: `test-results/ui-${viewport.width}-playing.png`,
        fullPage: true,
      });
      await page.getByRole('button', { name: 'Retomar', exact: true }).click();
      await page.getByRole('tab', { name: 'Chat', exact: true }).click();
      await page.getByPlaceholder('Digite uma mensagem…').fill('Mesa pronta!');
      await page.getByRole('button', { name: 'Enviar', exact: true }).click();
      await expect(page.getByText('Mesa pronta!', { exact: true })).toBeVisible();
      await page.getByRole('tab', { name: 'Jogadores', exact: false }).click();
      await page.locator('.seat-profile').first().click();
      await expect(page.locator('.selected-player')).toHaveCount(1);
      await page.getByRole('button', { name: 'Sair da sala', exact: true }).click();
      await expect(page.getByRole('dialog', { name: 'Sair da sala' })).toBeVisible();
      await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
      await expect(page.getByRole('dialog')).not.toBeVisible();
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
}

test('tournament builder edits levels, validates values and previews multiple tables', async ({
  page,
}) => {
  await enter(page, 'Director');
  await page.getByRole('button', { name: /Criar uma mesa/ }).click();
  await page.getByRole('button', { name: /Torneio multimesa/ }).click();
  await page.getByLabel('Assentos por mesa').selectOption('3');
  await page.getByLabel('Participantes no torneio').fill('15');
  await page.getByRole('button', { name: /2.*Estrutura/ }).click();
  await page.getByRole('button', { name: 'Adicionar nível', exact: false }).click();
  await expect(page.locator('.blind-editor tbody tr')).toHaveCount(6);
  await page.getByLabel('Small — Nível 1', { exact: true }).fill('100');
  await page.getByLabel('Big — Nível 1', { exact: true }).fill('50');
  await page.getByRole('button', { name: 'Criar uma mesa', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: /Revise/ })).toBeVisible();
  await page.getByLabel('Small — Nível 1', { exact: true }).fill('25');
  await page.getByRole('button', { name: /3.*Revisão/ }).click();
  await expect(page.getByText('Tudo pronto para receber a galera', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Criar uma mesa', exact: true }).click();
  await expect(page).toHaveURL(/\/room\//);
  await page.getByRole('button', { name: 'Adicionar bot', exact: true }).click();
  await page.getByRole('button', { name: 'Adicionar bot', exact: true }).click();
  await page.getByRole('button', { name: 'Adicionar bot', exact: true }).click();
  await expect(page.locator('.table-tabs button')).toHaveCount(2);
  await page.getByRole('tab', { name: 'Estrutura', exact: true }).click();
  await expect(page.locator('.levels-list>div')).toHaveCount(6);
  await expect(page.locator('.room-stats')).toContainText(/\/\s*15/);
  await page.screenshot({ path: 'test-results/ui-tournament-structure.png', fullPage: true });
});
