import { test, expect } from '@playwright/test';
for (const viewport of [
  { width: 1440, height: 1000 },
  { width: 1366, height: 768 },
  { width: 390, height: 844 },
]) {
  test(`design concept: screens, geometry and simulated controls at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/design-preview/index.html#home');
    await expect(
      page.getByRole('heading', { name: 'A noite é nossa. A mesa também.' }),
    ).toBeVisible();
    await page.screenshot({
      path: `test-results/ui-concept-${viewport.width}-home.png`,
      fullPage: true,
    });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.getByRole('button', { name: 'Mesas', exact: true }).click();
    await page.getByLabel('Buscar mesa', { exact: true }).fill('notívagos');
    await expect(page.locator('#lobbyRooms tr')).toHaveCount(1);
    await page.getByLabel('Buscar mesa', { exact: true }).fill('');
    await page.screenshot({
      path: `test-results/ui-concept-${viewport.width}-lobby.png`,
      fullPage: true,
    });
    await page.getByRole('button', { name: 'Ver mesa', exact: true }).click();
    await expect(page.locator('.seat')).toHaveCount(6);
    const geometry = await page.evaluate(() => {
      const box = (selector: string) => {
        const r = document.querySelector(selector)!.getBoundingClientRect();
        return { x: r.x, y: r.y, w: r.width, h: r.height };
      };
      return {
        felt: box('.felt'),
        cards: box('#ownCards'),
        board: box('#board'),
        action: box('.decisions'),
        height: innerHeight,
        width: innerWidth,
        docHeight: document.documentElement.scrollHeight,
        docWidth: document.documentElement.scrollWidth,
      };
    });
    expect(geometry.docWidth).toBeLessThanOrEqual(viewport.width);
    expect(geometry.docHeight).toBeLessThanOrEqual(viewport.height + 1);
    for (const cards of [geometry.cards, geometry.board]) {
      expect(cards.x).toBeGreaterThan(geometry.felt.x);
      expect(cards.y).toBeGreaterThan(geometry.felt.y);
      expect(cards.x + cards.w).toBeLessThan(geometry.felt.x + geometry.felt.w);
      expect(cards.y + cards.h).toBeLessThan(geometry.felt.y + geometry.felt.h);
    }
    if (viewport.width > 700) {
      expect(geometry.felt.w / geometry.felt.h).toBeLessThan(2.1);
      expect(geometry.felt.w / geometry.felt.h).toBeGreaterThan(1.7);
    }
    expect(geometry.action.y + geometry.action.h).toBeLessThan(viewport.height);
    await page.screenshot({ path: `test-results/ui-concept-${viewport.width}-table.png` });
    await page.getByRole('button', { name: 'Vitória', exact: true }).click();
    await expect(page.locator('.win-banner')).toBeVisible();
    await expect(page.locator('#board .card')).toHaveCount(5);
    await page.screenshot({ path: `test-results/ui-concept-${viewport.width}-victory.png` });
    await page.getByRole('button', { name: 'Espera', exact: true }).click();
    await page.getByRole('button', { name: 'Distribuir cartas', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Pagar 250 Continuar na mão', exact: true }),
    ).toBeEnabled();
    await page.getByRole('button', { name: 'Gerenciar mesa', exact: true }).click();
    await page.getByRole('button', { name: 'Adicionar bot', exact: false }).click();
    await expect(page.locator('.roster-row')).toHaveCount(7);
    await page.getByRole('button', { name: 'Fechar painel', exact: true }).click();
    await page.getByRole('button', { name: 'Chat da mesa', exact: true }).click();
    await page.getByLabel('Mensagem de demonstração').fill('<img src=x onerror=alert(1)>');
    await page.getByRole('button', { name: 'Enviar mensagem' }).click();
    await expect(page.locator('#messages img')).toHaveCount(0);
    await expect(page.getByText('<img src=x onerror=alert(1)>', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Fechar painel', exact: true }).click();
    await page.getByRole('button', { name: 'Explorar telas ↗', exact: true }).click();
    await page.getByRole('button', { name: 'Criar uma mesa ↗', exact: true }).click();
    await page.getByLabel('Nome da mesa', { exact: true }).fill('Mesa de preview');
    await page.getByRole('combobox', { name: 'Assentos', exact: true }).selectOption('9');
    await page.getByLabel('Feltro da mesa').selectOption('wine');
    await expect(page.locator('#previewTitle')).toHaveText('Mesa de preview');
    await expect(page.locator('.mini-seat')).toHaveCount(9);
    await page.screenshot({
      path: `test-results/ui-concept-${viewport.width}-builder.png`,
      fullPage: true,
    });
    await page.getByRole('button', { name: 'Ver minha mesa →', exact: true }).click();
    await expect(page.locator('.seat')).toHaveCount(9);
    await expect(page.locator('#gameTitle')).toHaveText('Mesa de preview');
    await page.screenshot({ path: `test-results/ui-concept-${viewport.width}-nine.png` });
    expect(errors).toEqual([]);
  });
}
