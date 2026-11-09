import { test, expect, type Page } from '@playwright/test';
async function enter(page: Page, nickname: string) {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR');
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
