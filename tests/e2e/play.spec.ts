import { test, expect } from '@playwright/test';

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
