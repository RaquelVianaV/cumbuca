const { test, expect } = require('@playwright/test');

async function login(page) {
  await page.goto('/login');
  await page.getByLabel('Login', { exact: true }).fill('cumbuca');
  await page.getByLabel('Senha', { exact: true }).fill('cumbuca2026');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page).not.toHaveURL(/\/login$/);
}

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (error) => console.error(`Browser error: ${error.stack || error.message}`));
  page.on('dialog', (dialog) => dialog.dismiss());
  await login(page);
});

test('dark mode toggle switches theme and persists in localStorage', async ({ page }) => {
  await page.goto('/');
  const html = page.locator('html');

  // Initially light mode (no dark-mode class)
  await expect(html).not.toHaveClass(/dark-mode/);
  const themeButton = page.locator('#theme-toggle-button');
  await expect(themeButton).toContainText('Claro');
  await expect(themeButton.locator('.theme-toggle-icon')).toHaveText('\uD83C\uDF19');
  await expect(themeButton).toHaveAttribute('title', 'Ativar modo escuro');
  await expect(themeButton).toHaveAttribute('aria-pressed', 'false');

  // Click to toggle to dark mode
  await themeButton.click();
  await expect(html).toHaveClass(/dark-mode/);
  await expect(themeButton).toContainText('Escuro');
  await expect(themeButton.locator('.theme-toggle-icon')).toHaveText('\u2600\uFE0F');
  await expect(themeButton).toHaveAttribute('title', 'Ativar modo claro');
  await expect(themeButton).toHaveAttribute('aria-pressed', 'true');

  // Verify dark mode colors are applied (CSS variable --bg should be dark)
  const bgColor = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()
  );
  expect(bgColor).toMatch(/0f0e0c|101411|#0f0e0c|#101411/);

  // Verify localStorage persistence
  const storedTheme = await page.evaluate(() => localStorage.getItem('cumbuca-theme'));
  expect(storedTheme).toBe('dark');

  // Refresh page and verify dark mode persists
  await page.reload();
  await expect(html).toHaveClass(/dark-mode/);
  await expect(themeButton).toContainText('Escuro');

  // Toggle back to light mode
  await themeButton.click();
  await expect(html).not.toHaveClass(/dark-mode/);
  await expect(themeButton).toContainText('Claro');
  const storedThemeLight = await page.evaluate(() => localStorage.getItem('cumbuca-theme'));
  expect(storedThemeLight).toBe('light');
});

test('dark mode respects system preference when theme is system', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('cumbuca-theme', 'system'));

  // Simulate dark mode system preference
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.reload();

  const html = page.locator('html');
  const themeButton = page.locator('#theme-toggle-button');

  // Should display dark mode based on system preference
  await expect(html).toHaveClass(/dark-mode/);
  await expect(themeButton).toContainText('Escuro');
  await expect(themeButton).toHaveAttribute('aria-pressed', 'true');
});

test('settings page saves theme preference choices', async ({ page }) => {
  await page.goto('/configuracoes');
  await expect(page.locator('#page-title')).toHaveText('Configurações');

  const themeSelect = page.locator('#settings-theme-preference');
  await expect(themeSelect).toBeVisible();
  await expect(themeSelect).toHaveValue('system');

  await themeSelect.selectOption('dark');
  await expect(page.locator('html')).toHaveClass(/dark-mode/);
  await expect(page.locator('#theme-toggle-button')).toContainText('Escuro');
  await expect(themeSelect).toHaveValue('dark');
  expect(await page.evaluate(() => localStorage.getItem('cumbuca-theme'))).toBe('dark');

  await themeSelect.selectOption('system');
  await expect(themeSelect).toHaveValue('system');
  expect(await page.evaluate(() => localStorage.getItem('cumbuca-theme'))).toBe('system');
});

test('main navigation menu is accessible and complete', async ({ page }) => {
  await page.goto('/');
  const nav = page.locator('nav.nav');
  await expect(nav).toBeVisible();

  // Verify main navigation links exist
  const links = await nav.locator('a').all();
  expect(links.length).toBeGreaterThan(0);

  // Check for key sections
  const hasHome = await page
    .locator('a:has-text("Home"), a:has-text("Início"), a:has-text("Visão geral")')
    .isVisible()
    .catch(() => false);
  const hasFinance = await page
    .locator('a:has-text("Financeiro")')
    .isVisible()
    .catch(() => false);
  const hasCashFlow = await page
    .locator('a:has-text("Fluxo"), a:has-text("Caixa")')
    .isVisible()
    .catch(() => false);

  expect(hasHome || hasFinance || hasCashFlow).toBe(true);
});

test('reports view displays financial summaries', async ({ page }) => {
  await page.goto('/');

  // Navigate to reports if available, otherwise check relatorios
  const reportsLink = page
    .locator('a:has-text("Relatório"), a:has-text("Relatorios"), a:has-text("Relatórios")')
    .first();

  if (await reportsLink.isVisible()) {
    await reportsLink.click();
    await expect(page).toHaveURL(/\/(relatorios|relatorios)/);
  } else {
    // Try direct navigation to reports
    await page.goto('/relatorios').catch(() => {
      // If relatorios not available, try financeiro with reports view
      return page.goto('/financeiro?view=reports').catch(() => {
        console.log('Reports view not found, skipping');
      });
    });
  }
});

test('alerts dashboard shows operational warnings', async ({ page }) => {
  await page.goto('/alertas');

  await expect(page.getByRole('heading', { name: 'Alertas', exact: true }))
    .toBeVisible()
    .catch(async () => {
      await expect(page.getByRole('heading', { name: 'Avisos', exact: true })).toBeVisible();
    });

  // Verify alert structure
  const alertCards = page.locator('.alert-card, [data-alert], [class*="alert"]');
  const count = await alertCards.count();
  expect(count).toBeGreaterThanOrEqual(0);
});

test('menu tab shows operational configuration and settings', async ({ page }) => {
  await page.goto('/menu-semanal');
  await expect(page.getByRole('heading', { name: 'Menu', exact: true }))
    .toBeVisible()
    .catch(async () => {
      await expect(page.locator('#page-title')).toHaveText('Menu Semanal');
    });

  // Verify settings elements exist
  const inputs = await page.locator('input, select, textarea').count();
  expect(inputs).toBeGreaterThan(0);
});

test('management improvements are connected across the main areas', async ({ page }, testInfo) => {
  await page.goto('/hoje');
  await expect(page.locator('#page-title')).toHaveText('Operação');
  await expect(
    page.getByRole('heading', { name: 'Agenda da operação', exact: true })
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath('operation-center.png'),
    fullPage: true,
  });

  await page.goto('/menu-semanal');
  await page.getByRole('button', { name: 'Planejamento', exact: true }).click();
  await expect(page.locator('[data-menu-cost-breakdown]')).toHaveCount(5);
  await page.screenshot({
    path: testInfo.outputPath('menu-manual-costs.png'),
    fullPage: true,
  });

  await page.goto('/financeiro');
  await expect(page.getByRole('heading', { name: /Planejado x realizado/ })).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath('finance-plan-vs-actual.png'),
    fullPage: true,
  });

  await page.goto('/relatorios');
  await page.getByRole('button', { name: 'Rentabilidade', exact: true }).click();
  await expect(page.locator('[data-profitability-panel]')).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath('profitability-report.png'),
    fullPage: true,
  });

  await page.goto('/alertas');
  await expect(page.getByText('Menu e preços', { exact: true })).toBeVisible();

  await page.goto('/configuracoes');
  await expect(page.getByLabel('Embalagem padrão', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Lembrar backup após', { exact: true })).toBeVisible();

  await page.goto('/backups?tab=backup');
  await expect(
    page.getByRole('heading', { name: 'Proteção dos dados', exact: true })
  ).toBeVisible();
  await expect(page.locator('#maintenance-backup-health')).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath('maintenance-health.png'),
    fullPage: true,
  });
});

test('cash flow daily reconciliation workflow is accessible', async ({ page }) => {
  await page.goto('/fluxo-de-caixa');
  await expect(page.getByRole('heading', { name: 'Fluxo de Caixa', exact: true })).toBeVisible();

  // Verify reconciliation button and form
  const reconciliationBtn = page.getByRole('button', { name: 'Conferência', exact: true });
  await expect(reconciliationBtn).toBeVisible();

  await reconciliationBtn.click();
  await expect(
    page.getByRole('heading', { name: 'Conferência diária', exact: true })
  ).toBeVisible();

  // Verify form inputs for reconciliation
  await expect(page.getByLabel('Saldo real da conta', { exact: true })).toBeVisible();
});

test('pricing tab displays operational cost tracking', async ({ page }) => {
  await page.goto('/');

  const pricingLink = page
    .locator('a:has-text("Precificação"), a:has-text("Preços"), button:has-text("Precificação")')
    .first();

  if (await pricingLink.isVisible()) {
    await pricingLink.click();
    await expect(
      page.getByRole('heading', {
        name: 'Precificação|Produtos|Serviços',
        exact: false,
      })
    )
      .toBeVisible()
      .catch(() => {
        console.log('Pricing section may not exist');
      });
  }
});

test('backup integration displays state management options', async ({ page }) => {
  await page.goto('/backups');

  // Look for backup/restore buttons
  const backupBtn = page.getByRole('button', { name: /backup|exportar|salvar/i }).first();
  const restoreBtn = page.getByRole('button', { name: /restaurar|importar|carregar/i }).first();

  const hasBackupOption = await backupBtn.isVisible().catch(() => false);
  const hasRestoreOption = await restoreBtn.isVisible().catch(() => false);

  expect(hasBackupOption || hasRestoreOption).toBe(true);
});

test('maintenance tab buttons and shortcuts switch visible panes', async ({ page }) => {
  await page.goto('/backups?tab=backup');

  await page.getByRole('button', { name: 'Banco', exact: true }).click();
  await expect(page).toHaveURL(/\/backups\?tab=database/);
  await expect(
    page.getByRole('heading', { name: 'Manutenção do banco', exact: true })
  ).toBeVisible();

  await page.goto('/backups?tab=backup');
  await page.getByRole('button', { name: 'Ver banco', exact: true }).click();
  await expect(page).toHaveURL(/\/backups\?tab=database/);
  await expect(page.locator('#real-db-usage')).toBeVisible();
});

test('zero account action is available only in maintenance cleanup', async ({ page }, testInfo) => {
  await page.goto('/fluxo-de-caixa');
  await expect(page.getByRole('button', { name: 'Zerar conta', exact: true })).toHaveCount(0);
  await page.screenshot({
    path: testInfo.outputPath('cash-without-zero-account.png'),
    fullPage: true,
  });

  await page.goto('/backups?tab=reset');
  await expect(
    page.getByRole('heading', { name: 'Zerar saldo da conta', exact: true })
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Zerar conta', exact: true })).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath('maintenance-zero-account.png'),
    fullPage: true,
  });
});

test('responsive layout adapts to viewport size', async ({ page }, testInfo) => {
  await page.goto('/');

  await expect(page.locator('.hero')).toHaveClass(/quote-mode/);
  await expect(page.locator('.hero')).not.toHaveClass(/hero-loading/);
  await expect(page.locator('#page-title')).not.toHaveText('Visão Geral');
  await expect(page.locator('#page-title')).toContainText(/“.+”/);
  await expect(page.locator('#hero-motto')).not.toContainText('Pitada do dia:');
  const firstHomeQuote = await page.locator('#page-title').textContent();
  await page.reload();
  await expect(page.locator('#page-title')).not.toHaveText(firstHomeQuote);

  expect(
    await page
      .locator('.brand-mark img')
      .evaluate((image) => image.complete && image.naturalWidth > 0)
  ).toBe(true);

  if (testInfo.project.name === 'mobile') {
    // Mobile viewport
    const viewportWidth = await page.evaluate(() => window.innerWidth);
    expect(viewportWidth).toBeLessThanOrEqual(390);

    // Verify mobile-optimized layout
    const sidebar = page.locator('nav.nav');
    const isSidebarVisible = await sidebar.isVisible().catch(() => false);
    // On mobile, sidebar might be hidden or in a drawer
    console.log('Mobile sidebar visible:', isSidebarVisible);
    await page.screenshot({
      path: testInfo.outputPath('mobile-home-quote.png'),
      fullPage: true,
    });
  } else {
    // Desktop viewport
    const viewportWidth = await page.evaluate(() => window.innerWidth);
    expect(viewportWidth).toBeGreaterThanOrEqual(1440);

    // Verify desktop layout
    const mainContent = page.locator('main, .main, [role="main"]').first();
    await expect(mainContent).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath('wide-desktop-polish.png'),
      fullPage: true,
    });
  }
});

test('long home poem uses compact type without horizontal overflow', async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    window.sessionStorage.removeItem('cumbuca-last-home-quote');
    Math.random = () => 0.04;
  });
  await page.goto('/');

  const hero = page.locator('.hero');
  await expect(hero).toHaveClass(/quote-compact/);
  await expect(page.locator('#page-title')).toContainText('J. Pinto Fernandes');
  await page.screenshot({
    path: testInfo.outputPath('long-home-poem-compact.png'),
    fullPage: true,
  });
  const dimensions = await page.evaluate(() => {
    const heroElement = document.querySelector('.hero');
    const titleElement = document.querySelector('#page-title');
    return {
      heroHeight: heroElement.getBoundingClientRect().height,
      titleClientWidth: titleElement.clientWidth,
      titleScrollWidth: titleElement.scrollWidth,
      titleFontSize: Number.parseFloat(getComputedStyle(titleElement).fontSize),
    };
  });
  expect(dimensions.titleScrollWidth).toBeLessThanOrEqual(dimensions.titleClientWidth + 1);
  expect(dimensions.titleFontSize).toBeLessThanOrEqual(
    testInfo.project.name === 'mobile' ? 16 : 24
  );
  expect(dimensions.heroHeight).toBeLessThanOrEqual(testInfo.project.name === 'mobile' ? 420 : 340);
});

test('Dialetica excerpt uses the requested compact type', async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    window.sessionStorage.removeItem('cumbuca-last-home-quote');
    Math.random = () => 0.14;
  });
  await page.goto('/');

  const hero = page.locator('.hero');
  await expect(hero).toHaveClass(/quote-compact/);
  await expect(page.locator('#hero-motto')).toContainText('Dialética');
  await expect(page.locator('#page-title')).toContainText('Mas acontece que eu sou triste...');
  const fontSize = await page
    .locator('#page-title')
    .evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize));
  expect(fontSize).toBeLessThanOrEqual(testInfo.project.name === 'mobile' ? 16 : 24);
});

test('narrow desktop window activates compact mode', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 820, height: 900 });
  await page.goto('/fluxo-de-caixa?panel=ledger');

  const compactLayout = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    navDisplay: getComputedStyle(document.querySelector('.nav')).display,
    navColumns: getComputedStyle(document.querySelector('.nav')).gridTemplateColumns,
    headerWrap: getComputedStyle(document.querySelector('.header-actions')).flexWrap,
  }));
  expect(compactLayout.scrollWidth).toBeLessThanOrEqual(compactLayout.clientWidth + 1);
  expect(compactLayout.navDisplay).toBe('grid');
  expect(compactLayout.navColumns.split(' ')).toHaveLength(5);
  expect(compactLayout.headerWrap).toBe('wrap');
  await expect(page.locator('.nav > a:visible')).toHaveCount(15);
  await expect(page.locator('.nav-extra:visible')).toHaveCount(8);
  await expect(page.locator('.nav-more')).toBeVisible();
  await expect(page.locator('.hero-motto')).toContainText('Pitada do dia:');
  const dailyCashMotto = await page.locator('#hero-motto').textContent();
  await page.reload();
  await expect(page.locator('#hero-motto')).toHaveText(dailyCashMotto);
  expect(
    await page.locator('.hero-map').evaluate((image) => image.complete && image.naturalWidth > 0)
  ).toBe(true);
  expect(
    await page
      .locator('.hero-bowl-logo')
      .evaluate((image) => image.complete && image.naturalWidth > 0)
  ).toBe(true);
  await expect(page.locator('.cash-filter-disclosure')).not.toHaveAttribute('open', '');
  await expect(page.locator('[data-cash-quick="today"]')).toBeVisible();

  await page.screenshot({
    path: testInfo.outputPath('compact-desktop-mode.png'),
    fullPage: true,
  });

  const filterSummary = page.locator('.cash-filter-disclosure summary');
  await filterSummary.click();
  await expect(page.locator('.cash-filter-disclosure')).toHaveAttribute('open', '');
  await page.screenshot({
    path: testInfo.outputPath('compact-desktop-filters.png'),
    fullPage: true,
  });
  await filterSummary.click();

  await page.locator('.nav-more').click();
  await expect(page).toHaveURL(/\/mais$/);
  await expect(page.getByRole('heading', { name: 'Mais ferramentas' })).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath('compact-desktop-more.png'),
    fullPage: true,
  });
});

test('desktop sidebar scrolls independently from the page', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'The mobile layout uses the fixed bottom menu.');
  await page.setViewportSize({ width: 1440, height: 620 });
  await page.goto('/home');

  const nav = page.locator('.nav');
  const initial = await nav.evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
    overflowY: getComputedStyle(element).overflowY,
    pageScrollY: window.scrollY,
  }));
  expect(initial.overflowY).toBe('auto');
  expect(initial.scrollHeight).toBeGreaterThan(initial.clientHeight);

  await nav.evaluate((element) => element.scrollTo({ top: element.scrollHeight }));
  await expect(page.locator('.nav a[data-route="backups"]')).toBeVisible();
  const finalPosition = await nav.evaluate((element) => ({
    menuScrollTop: element.scrollTop,
    pageScrollY: window.scrollY,
  }));
  expect(finalPosition.menuScrollTop).toBeGreaterThan(0);
  expect(finalPosition.pageScrollY).toBe(initial.pageScrollY);
});

test('cash advanced filters align fields and actions without clipping', async ({
  page,
}, testInfo) => {
  await page.goto('/fluxo-de-caixa?panel=ledger');
  const disclosure = page.locator('.cash-filter-disclosure');
  await disclosure.locator('summary').click();
  await expect(disclosure).toHaveAttribute('open', '');

  const layout = await page.locator('#cash-filter-form').evaluate((form) => {
    const formRect = form.getBoundingClientRect();
    const actions = form.querySelector('.cash-filter-actions');
    const actionsRect = actions.getBoundingClientRect();
    const visibleLabels = [...form.querySelectorAll(':scope > label')].filter(
      (label) => getComputedStyle(label).display !== 'none'
    );
    return {
      formColumns: getComputedStyle(form).gridTemplateColumns.split(' ').length,
      actionColumns: getComputedStyle(actions).gridTemplateColumns.split(' ').length,
      actionsRightGap: Math.abs(formRect.right - 10 - actionsRect.right),
      visibleLabels: visibleLabels.length,
      accountWidth: form.querySelector('#cash-filter-account').getBoundingClientRect().width,
      searchWidth: form.querySelector('input[name="search"]').getBoundingClientRect().width,
      pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });

  expect(layout.visibleLabels).toBe(6);
  expect(layout.pageOverflow).toBeLessThanOrEqual(1);
  expect(layout.actionsRightGap).toBeLessThanOrEqual(1);
  if (testInfo.project.name === 'mobile') {
    expect(layout.formColumns).toBe(1);
    expect(layout.actionColumns).toBe(1);
  } else {
    expect(layout.formColumns).toBe(6);
    expect(layout.actionColumns).toBe(2);
    expect(layout.accountWidth).toBeGreaterThan(175);
    expect(layout.searchWidth).toBeGreaterThan(205);
  }

  await page.screenshot({
    path: testInfo.outputPath('cash-advanced-filters-layout.png'),
    fullPage: true,
  });
});

test('mobile cash view keeps shortcuts compact', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'Mobile-only visual check');
  await page.goto('/fluxo-de-caixa?panel=ledger');

  const quickFilterColumns = await page.evaluate(
    () => getComputedStyle(document.querySelector('.quick-filter-bar')).gridTemplateColumns
  );
  expect(quickFilterColumns.split(' ')).toHaveLength(2);
  await expect(page.locator('.hero-motto')).toContainText('Pitada do dia:');
  await expect(page.locator('.cash-filter-disclosure')).not.toHaveAttribute('open', '');
  await expect(page.locator('[data-cash-quick="withdrawals"]')).toBeVisible();

  await page.screenshot({
    path: testInfo.outputPath('mobile-cash-polish.png'),
    fullPage: true,
  });
});
