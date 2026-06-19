const { test, expect } = require('@playwright/test');

async function login(page) {
  await page.goto('/login');
  await page.getByLabel('Login', { exact: true }).fill('cumbuca');
  await page.getByLabel('Senha', { exact: true }).fill('cumbuca2026');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page).not.toHaveURL(/\/login$/);
}

test('login and show dashboard shell', async ({ page }) => {
  await login(page);
  await expect(page.getByRole('banner')).toBeVisible();
  await expect(page.locator('a.account-button')).toBeVisible();
  await expect(page.getByText('Operação Cumbuca')).toBeVisible();
});

test('navigate to financeira and verify account panel', async ({ page }) => {
  await login(page);
  await page.goto('/financeiro?view=accounts');
  await expect(page).toHaveURL(/\/financeiro\?view=accounts/);
  await expect(
    page.getByRole('heading', { name: 'Contas a pagar e receber', exact: true })
  ).toBeVisible();
  await expect(page.locator('.account-row')).toHaveCount(0);
});
