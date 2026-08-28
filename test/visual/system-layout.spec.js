const { test, expect } = require('@playwright/test');

async function login(page) {
  await page.goto('/login');
  await page.getByLabel('Login', { exact: true }).fill('cumbuca');
  await page.getByLabel('Senha', { exact: true }).fill('cumbuca2026');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page).not.toHaveURL(/\/login$/);
}

const routes = [
  '/home',
  '/hoje',
  '/pedidos',
  '/menu-semanal',
  '/menu-semanal?resumo=mes',
  '/menu-semanal?catalogo=cumbucas',
  '/loja?view=sales',
  '/loja?view=channels',
  '/precificacao?view=dashboard',
  '/precificacao?view=recipes',
  '/precificacao?view=costs',
  '/fluxo-de-caixa?panel=entry',
  '/fluxo-de-caixa?panel=ledger',
  '/fluxo-de-caixa?panel=reconciliation',
  '/fluxo-de-caixa?panel=transfers',
  '/fluxo-de-caixa?panel=withdrawals',
  '/fluxo-de-caixa?panel=savings',
  ...['summary', 'pending', 'accounts', 'employees', 'cash', 'planning', 'partners', 'withdrawals', 'audit', 'closing']
    .map((view) => `/financeiro?view=${view}`),
  '/relatorios',
  '/alertas',
  '/configuracoes',
  '/mais',
  '/backups?tab=backup',
  '/backups?tab=integrity',
  '/backups?tab=database',
  '/backups?tab=users',
  '/backups?tab=events',
  '/backups?tab=reset',
  '/minha-conta',
];

test('all system views fit desktop, notebook and mobile layouts', async ({ page }, testInfo) => {
  const browserErrors = [];
  page.on('pageerror', (error) => browserErrors.push(error.message));
  page.on('dialog', (dialog) => dialog.dismiss());
  await login(page);

  if (testInfo.project.name === 'desktop') {
    await page.setViewportSize({ width: 1366, height: 768 });
  }

  for (const route of routes) {
    await page.goto(route);
    await expect(page.locator('#app')).not.toHaveAttribute('aria-busy', 'true');
    const layout = await page.evaluate(() => {
      const root = document.documentElement;
      const viewportWidth = root.clientWidth;
      const overflowing = [...document.querySelectorAll('main, .workspace, .panel, form, .summary, .report-grid')]
        .filter((element) => {
          const style = getComputedStyle(element);
          const box = element.getBoundingClientRect();
          return style.display !== 'none'
            && box.width > 0
            && (box.left < -1 || box.right > viewportWidth + 1);
        })
        .map((element) => element.id || element.className || element.tagName)
        .slice(0, 8);
      const widest = [...document.body.querySelectorAll('*')]
        .map((element) => {
          const box = element.getBoundingClientRect();
          return { name: element.id || element.className || element.tagName, right: Math.round(box.right), width: Math.round(box.width) };
        })
        .filter((item) => item.right > viewportWidth + 1)
        .sort((left, right) => right.right - left.right)
        .slice(0, 8);
      return {
        pageOverflow: root.scrollWidth - viewportWidth,
        overflowing,
        widest,
      };
    });
    expect(layout.overflowing, `${route} must stay inside the viewport: ${JSON.stringify(layout.widest)}`).toEqual([]);
    expect(layout.pageOverflow, `${route} has horizontal page overflow: ${JSON.stringify(layout.widest)}`).toBeLessThanOrEqual(1);
  }

  expect(browserErrors).toEqual([]);
});
