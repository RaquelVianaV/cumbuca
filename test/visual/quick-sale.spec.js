const { test, expect } = require('@playwright/test');

test('registro rápido abre inclusão de venda e permite cancelar', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Login', { exact: true }).fill('cumbuca');
  await page.getByLabel('Senha', { exact: true }).fill('cumbuca2026');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page).not.toHaveURL(/\/login$/);
  await page.locator('#global-new-button').click();
  await page
    .locator('#global-new-dialog')
    .getByRole('link', { name: 'Venda Loja, combo ou unidade', exact: true })
    .click();
  const form = page.locator('#store-sale-form');
  await expect(form).toBeVisible();
  await expect(page.locator('#store-daily-sales-form')).toHaveCount(0);
  await form.locator('input[name="saleType"][value="combo"]').check();
  await form.getByLabel('Quantidade de combos').fill('2');
  await form.getByLabel('Unidades em cada combo').fill('5');
  await expect(form.locator('[data-store-sale-total-value]')).toHaveText('10 unidade(s)');
  await form.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await expect(page.locator('#store-daily-sales-form')).toBeVisible();
  await expect(page).not.toHaveURL(/novo=venda/);
});
