const { test, expect } = require('@playwright/test');

async function login(page) {
  await page.goto('/login');
  await page.getByLabel('Login', { exact: true }).fill('cumbuca');
  await page.getByLabel('Senha', { exact: true }).fill('cumbuca2026');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page).not.toHaveURL(/\/login$/);
}

async function expectNoHorizontalOverflow(page) {
  const dimensions = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
}

function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`;
}

async function mockOnlineDatabase(page) {
  const holder = { state: {}, statePostCount: 0, statePostDelayMs: 0 };
  const json = (body) => ({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
  await page.route('**/api/health', (route) =>
    route.fulfill(json({ status: 'online', database: true }))
  );
  await page.route('**/api/persistence-check', (route) =>
    route.fulfill(json({ database: true, saved: true }))
  );
  await page.route('**/api/financial-integrity', (route) =>
    route.fulfill(
      json({
        database: true,
        status: 'ok',
        checkedAt: new Date().toISOString(),
        totals: { balance: 0, adjustments: 0 },
        backup: { updatedAt: new Date().toISOString() },
        closings: { unlockedMonths: [], unlockedWeeks: [] },
        checks: [],
      })
    )
  );
  await page.route('**/api/state', async (route) => {
    if (route.request().method() === 'POST') {
      holder.statePostCount += 1;
      if (holder.statePostDelayMs) {
        await new Promise((resolve) => setTimeout(resolve, holder.statePostDelayMs));
      }
      holder.state = JSON.parse(route.request().postData() || '{}').state || {};
      await route.fulfill(json({ database: true, saved: true }));
      return;
    }
    await route.fulfill(json({ database: true, state: holder.state }));
  });
  return holder;
}

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (error) => console.error(`Browser error: ${error.stack || error.message}`));
  await login(page);
  await page.goto('/financeiro');
  await expect(page.getByRole('heading', { name: 'Financeiro', exact: true })).toBeVisible();
});

test('finance summary and pending dashboard fit the viewport', async ({ page }, testInfo) => {
  await expectNoHorizontalOverflow(page);
  await page.getByRole('button', { name: 'Pendências', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Painel de pendências', exact: true })
  ).toBeVisible();
  await expect(page.locator('#finance-pending-dashboard')).not.toContainText(
    'Conferindo pendências...'
  );
  await expect(
    page.locator('.pending-item').filter({ hasText: 'Diferenças da conciliação' })
  ).toHaveAttribute('href', '/fluxo-de-caixa?panel=reconciliation');
  await expectNoHorizontalOverflow(page);
  const screenshotPath = testInfo.outputPath('finance-pending.png');
  await page.screenshot({ path: screenshotPath, fullPage: true });
  await testInfo.attach('finance-pending.png', {
    path: screenshotPath,
    contentType: 'image/png',
  });
});

test('accounts workflow is visible and responsive', async ({ page }, testInfo) => {
  await page.getByRole('button', { name: 'Contas', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Contas a pagar e receber', exact: true })
  ).toBeVisible();
  await expect(page.getByLabel('Descrição', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Vencimento', { exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  const screenshotPath = testInfo.outputPath('finance-accounts.png');
  await page.screenshot({ path: screenshotPath, fullPage: true });
  await testInfo.attach('finance-accounts.png', {
    path: screenshotPath,
    contentType: 'image/png',
  });
});

test('reconciliation exposes authorized adjustment preview', async ({ page }, testInfo) => {
  await page.goto('/fluxo-de-caixa');
  await expect(page.getByRole('heading', { name: 'Fluxo de Caixa', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Conferência', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Conferência diária', exact: true })
  ).toBeVisible();
  const reconciliationAccount = page.locator('#daily-reconciliation-account');
  await expect(reconciliationAccount).toBeVisible();
  await expect(reconciliationAccount).toContainText('Unificado PF + PJ');
  await reconciliationAccount.selectOption('pj');
  await expect(page.locator('#reconciliation-account-label')).toContainText('Conta PJ');
  await expect(page.getByLabel('Saldo real da conta', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Responsável', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Conferir e lançar ajuste', exact: true })
  ).toBeEnabled();
  const formColumns = await page.evaluate(
    () =>
      getComputedStyle(
        document.querySelector('#daily-reconciliation-form')
      ).gridTemplateColumns.split(' ').length
  );
  expect(formColumns).toBe(testInfo.project.name === 'mobile' ? 1 : 4);
  await expectNoHorizontalOverflow(page);
  const screenshotPath = testInfo.outputPath('finance-reconciliation.png');
  await page.screenshot({ path: screenshotPath, fullPage: true });
  await testInfo.attach('finance-reconciliation.png', {
    path: screenshotPath,
    contentType: 'image/png',
  });
});

test('cash entry defaults to today and keeps the last used date and category', async ({
  page,
}, testInfo) => {
  const database = await mockOnlineDatabase(page);
  await page.goto('/fluxo-de-caixa');
  await expect(page.locator('#cash-account')).toContainText('Conta PF');
  await expect(page.locator('#cash-account')).toContainText('Conta PJ');
  await expect(page.locator('#cash-account')).not.toContainText('Entrada');
  const dates = await page.evaluate(() => {
    const format = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };
    const todayDate = new Date();
    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    return { today: format(todayDate), yesterday: format(yesterdayDate) };
  });

  const dateField = page.locator('#cash-entry-date');
  await expect(dateField).toHaveValue(dates.today);
  await expect(page.getByRole('button', { name: 'Hoje', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true'
  );

  await page.getByRole('button', { name: 'Ontem', exact: true }).click();
  await expect(dateField).toHaveValue(dates.yesterday);
  await page.getByLabel('Descrição', { exact: true }).fill('Entrada rápida teste');
  await page.locator('#cash-category').selectOption('ifood');
  await page.getByLabel('Valor', { exact: true }).fill('25,00');
  await page.getByRole('button', { name: 'Adicionar', exact: true }).click();

  await expect.poll(() => database.state.cashEntries).toHaveLength(1);
  await expect(page.locator('#cash-entry-date')).toHaveValue(dates.yesterday);
  await expect(page.locator('#cash-type')).toHaveValue('income');
  await expect(page.locator('#cash-category')).toHaveValue('ifood');
  await expect(page.getByLabel('Descrição', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('Valor', { exact: true })).toHaveValue('');
  await expect
    .poll(() =>
      page.evaluate(() => JSON.parse(localStorage.getItem('cashEntryDraft') || '{}').date)
    )
    .toBe(dates.yesterday);

  await page.reload();
  await expect(page.locator('#cash-entry-date')).toHaveValue(dates.yesterday);
  await expect(page.locator('#cash-type')).toHaveValue('income');
  await expect(page.locator('#cash-category')).toHaveValue('ifood');
  const screenshotPath = testInfo.outputPath('cash-entry-date-shortcuts.png');
  await page.screenshot({ path: screenshotPath, fullPage: true });
  await testInfo.attach('cash-entry-date-shortcuts.png', {
    path: screenshotPath,
    contentType: 'image/png',
  });
});

test('cash form ignores repeated submits while an entry or expense is saving', async ({ page }) => {
  const database = await mockOnlineDatabase(page);
  database.statePostDelayMs = 250;
  const dialogMessages = [];
  page.on('dialog', async (dialog) => {
    dialogMessages.push(dialog.message());
    await dialog.dismiss();
  });

  await page.goto('/fluxo-de-caixa');
  const cashForm = page.locator('#cash-form');
  const submitButton = cashForm.locator('button[type="submit"]');
  await cashForm.locator('input[name="description"]').fill('Entrada sem duplicar');
  await cashForm.locator('input[name="amount"]').fill('25,00');
  await page.evaluate(() => {
    const form = document.querySelector('#cash-form');
    form.requestSubmit();
    form.requestSubmit();
  });
  await expect(submitButton).toBeDisabled();
  await expect(submitButton).toHaveText('Salvando...');
  await expect.poll(() => database.state.cashEntries?.length).toBe(1);
  expect(database.statePostCount).toBe(1);
  await expect(submitButton).toBeEnabled();

  await cashForm.locator('input[name="description"]').fill('Saída sem duplicar');
  await page.locator('#cash-type').selectOption('expense');
  await cashForm.locator('input[name="amount"]').fill('10,00');
  await page.evaluate(() => {
    const form = document.querySelector('#cash-form');
    form.requestSubmit();
    form.requestSubmit();
  });
  await expect(submitButton).toBeDisabled();
  await expect(submitButton).toHaveText('Salvando...');
  await expect.poll(() => database.state.cashEntries?.length).toBe(2);
  expect(database.statePostCount).toBe(2);
  expect(database.state.cashEntries.map((entry) => entry.type)).toEqual(['income', 'expense']);
  expect(dialogMessages).toEqual([]);
});

test('cash ledger shows the latest entry first by default', async ({ page }, testInfo) => {
  const database = await mockOnlineDatabase(page);
  const today = localDateKey();
  database.state = {
    cashEntries: [
      {
        id: 'cash-order-1',
        date: today,
        description: 'Primeiro lançamento',
        type: 'income',
        category: 'venda',
        cashAccount: 'pf',
        amount: '10.00',
      },
      {
        id: 'cash-order-2',
        date: today,
        description: 'Segundo lançamento',
        type: 'income',
        category: 'venda',
        cashAccount: 'pj',
        amount: '20.00',
      },
      {
        id: 'cash-order-3',
        date: today,
        description: 'Último lançamento',
        type: 'income',
        category: 'venda',
        cashAccount: 'pf',
        amount: '30.00',
      },
    ],
  };
  await page.goto('/fluxo-de-caixa?panel=ledger');
  await expect(page.getByRole('heading', { name: 'Extrato', exact: true })).toBeVisible();
  const descriptions = await page
    .locator('.cash-ledger-table tbody tr td:nth-child(2)')
    .allTextContents();
  expect(descriptions).toEqual(['Último lançamento', 'Segundo lançamento', 'Primeiro lançamento']);
  const formattedToday = today.split('-').reverse().join('/');
  const pfAccountSummary = page.locator('[data-cash-account-summary="pf"]');
  const pjAccountSummary = page.locator('[data-cash-account-summary="pj"]');
  await expect(pfAccountSummary).toContainText('Conta PF');
  await expect(pfAccountSummary).toContainText('R$ 40,00');
  await expect(pfAccountSummary).toContainText(`Último lançamento em ${formattedToday}`);
  await expect(pjAccountSummary).toContainText('Conta PJ');
  await expect(pjAccountSummary).toContainText('R$ 20,00');
  await expect(pjAccountSummary).toContainText(`Último lançamento em ${formattedToday}`);
  await expectNoHorizontalOverflow(page);
  await page.screenshot({
    path: testInfo.outputPath('cash-ledger-latest-first.png'),
    fullPage: true,
  });
});

test('maintenance zero account creates the balancing adjustment', async ({ page }) => {
  const database = await mockOnlineDatabase(page);
  const today = localDateKey();
  database.state = {
    cashEntries: [
      {
        id: 'maintenance-zero-source',
        date: today,
        description: 'Saldo para zerar',
        type: 'income',
        category: 'venda',
        cashAccount: 'pf',
        amount: '50.00',
      },
    ],
  };

  await page.goto('/fluxo-de-caixa');
  await expect(page.getByRole('button', { name: 'Zerar conta', exact: true })).toHaveCount(0);
  await page.goto('/backups?tab=reset');
  const zeroAccountButton = page.getByRole('button', { name: 'Zerar conta', exact: true });
  await expect(zeroAccountButton).toBeEnabled();
  page.once('dialog', (dialog) => dialog.accept());
  await zeroAccountButton.click();

  await expect.poll(() => database.state.cashEntries?.length).toBe(2);
  expect(database.state.cashEntries[1]).toMatchObject({
    date: today,
    type: 'expense',
    category: 'ajuste-conta',
    amount: '50.00',
  });
  await expect(zeroAccountButton).toBeDisabled();
});

test('expense can leave the account negative without using savings', async ({ page }, testInfo) => {
  const database = await mockOnlineDatabase(page);
  const today = localDateKey();
  database.state = {
    cashEntries: [],
    financialPlanning: {
      savings: '500.00',
      savingsExpectedBalance: '500.00',
      savingsHistory: [
        {
          id: 'savings-opening-test',
          date: today,
          type: 'set',
          amount: '500.00',
          balance: '500.00',
          description: 'Saldo inicial de teste',
        },
      ],
    },
  };
  const dialogMessages = [];
  page.on('dialog', async (dialog) => {
    dialogMessages.push(dialog.message());
    await dialog.dismiss();
  });

  await page.goto('/fluxo-de-caixa');
  const cashForm = page.locator('#cash-form');
  await cashForm.locator('input[name="description"]').fill('Saida acima do saldo');
  await page.locator('#cash-type').selectOption('expense');
  await page.locator('#cash-category').selectOption('outros');
  await cashForm.locator('input[name="amount"]').fill('700,00');
  await cashForm.getByRole('button', { name: 'Adicionar', exact: true }).click();

  await expect.poll(() => database.state.cashEntries).toHaveLength(1);
  expect(dialogMessages).toEqual([]);
  expect(database.state.cashEntries[0]).toMatchObject({
    type: 'expense',
    amount: '700.00',
    description: 'Saida acima do saldo',
  });
  expect(database.state.cashEntries.some((entry) => entry.automaticSavingsCoverage)).toBe(false);
  expect(database.state.financialPlanning.savings).toBe('500.00');
  expect(database.state.financialPlanning.savingsHistory).toHaveLength(1);
  const accountBalance = await page.evaluate(
    (dateKey) => window.accountBalanceUntilDate(dateKey),
    today
  );
  expect(accountBalance).toBe(-700);
  const screenshotPath = testInfo.outputPath('negative-cash-with-savings-untouched.png');
  await page.screenshot({ path: screenshotPath, fullPage: true });
  await testInfo.attach('negative-cash-with-savings-untouched.png', {
    path: screenshotPath,
    contentType: 'image/png',
  });
});

test('controlled finance workflow covers installments, reversal, alerts and reconciliation', async ({
  page,
}) => {
  const database = await mockOnlineDatabase(page);
  const today = localDateKey();
  await page.goto('/financeiro?view=accounts');
  await expect(
    page.getByRole('heading', { name: 'Contas a pagar e receber', exact: true })
  ).toBeVisible();

  await page.getByLabel('Descrição', { exact: true }).fill('Teste fornecedor');
  await page.getByLabel('Vencimento', { exact: true }).fill(today);
  await page.getByLabel('Valor total', { exact: true }).fill('100,00');
  await page.locator('#financial-account-schedule').selectOption('installments');
  await page.locator('#financial-account-count-field input[name="scheduleCount"]').fill('3');
  await page.getByRole('button', { name: 'Adicionar conta', exact: true }).click();
  await expect(page.locator('.account-row')).toHaveCount(3);
  expect(database.state.financialPlanning.accounts.map((account) => account.amount)).toEqual([
    '33.34',
    '33.33',
    '33.33',
  ]);
  expect(await page.evaluate(() => addMonthsClamped('2026-01-31', 1))).toBe('2026-02-28');

  await page.getByLabel('Descrição', { exact: true }).fill('Assinatura mensal');
  await page.getByLabel('Vencimento', { exact: true }).fill(today);
  await page.getByLabel('Valor total', { exact: true }).fill('25,00');
  await page.locator('#financial-account-schedule').selectOption('monthly');
  await page.locator('#financial-account-count-field input[name="scheduleCount"]').fill('2');
  await page.getByRole('button', { name: 'Adicionar conta', exact: true }).click();
  await expect(page.locator('.account-row')).toHaveCount(5);
  expect(
    database.state.financialPlanning.accounts.slice(0, 2).map((account) => account.amount)
  ).toEqual(['25.00', '25.00']);

  let firstAccount = page.locator('.account-row').filter({ hasText: 'Teste fornecedor' }).first();
  await firstAccount.locator('form[data-account-settlement] input[name="amount"]').fill('30,00');
  await firstAccount.getByRole('button', { name: 'Registrar pagamento', exact: true }).click();
  firstAccount = page.locator('.account-row').filter({ hasText: 'Teste fornecedor' }).first();
  await expect(firstAccount).toContainText('R$ 30,00');
  await firstAccount.locator('details').click();

  const reversalDialogs = async (dialog) => {
    if (dialog.type() === 'prompt' && dialog.message().includes('Data do estorno')) {
      await dialog.accept(today);
    } else if (dialog.type() === 'prompt') {
      await dialog.accept('Teste automatizado');
    } else {
      await dialog.accept();
    }
  };
  page.on('dialog', reversalDialogs);
  await firstAccount.getByRole('button', { name: 'Estornar', exact: true }).click();
  page.off('dialog', reversalDialogs);
  firstAccount = page.locator('.account-row').filter({ hasText: 'Teste fornecedor' }).first();
  await firstAccount.locator('details').click();
  await expect(firstAccount).toContainText('Estornado');

  let adjustedAccount = page
    .locator('.account-row')
    .filter({ hasText: 'Assinatura mensal' })
    .first();
  await adjustedAccount.locator('form[data-account-settlement] input[name="amount"]').fill('28,50');
  await adjustedAccount.getByRole('button', { name: 'Registrar pagamento', exact: true }).click();
  adjustedAccount = page
    .locator('.account-row')
    .filter({ hasText: 'Assinatura mensal' })
    .filter({ hasText: 'Baixado R$ 28,50' })
    .first();
  await expect(adjustedAccount).toContainText('Total R$ 28,50');
  await expect(adjustedAccount).toContainText('Baixado R$ 28,50');

  page.once('dialog', (dialog) => dialog.accept());
  await adjustedAccount.getByRole('button', { name: 'Excluir', exact: true }).click();
  await expect(page.locator('.account-row').filter({ hasText: 'Assinatura mensal' })).toHaveCount(
    1
  );

  await page.goto('/alertas');
  await expect(
    page.locator('.alert-card').filter({ hasText: 'Conta vence em breve' }).first()
  ).toBeVisible();

  await page.goto('/fluxo-de-caixa');
  await page.getByRole('button', { name: 'Conferência', exact: true }).click();
  await page.getByLabel('Saldo real da conta', { exact: true }).fill('50,00');
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Conferir e lançar ajuste', exact: true }).click();
  await expect
    .poll(() => database.state.cashEntries?.some((entry) => entry.reconciliation))
    .toBe(true);
  await expect(page.getByRole('button', { name: 'Excluir', exact: true })).toBeVisible();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Excluir', exact: true }).click();
  await expect.poll(() => database.state.financialPlanning.reconciliationHistory).toHaveLength(0);
  expect(database.state.cashEntries?.some((entry) => entry.reconciliation)).toBe(false);
  expect(database.state.financialPlanning.accounts).toHaveLength(4);
  const testedAccount = database.state.financialPlanning.accounts.find(
    (account) => account.description === 'Teste fornecedor'
  );
  expect(testedAccount.payments[0].reversedAt).toBeTruthy();
  expect(
    database.state.cashEntries?.some(
      (entry) => entry.description === 'Pagamento - Assinatura mensal' && entry.amount === '28.50'
    )
  ).toBe(true);
});

test('home dashboard prioritizes projected balance and actions', async ({ page }, testInfo) => {
  const database = await mockOnlineDatabase(page);
  const today = localDateKey();
  database.state = {
    cashEntries: [
      { id: 'home-pf-income', date: today, type: 'income', cashAccount: 'pf', amount: '100.00' },
      { id: 'home-pj-income', date: today, type: 'income', cashAccount: 'pj', amount: '50.00' },
      { id: 'home-pj-expense', date: today, type: 'expense', cashAccount: 'pj', amount: '10.00' },
    ],
    financialPlanning: {
      accounts: [
        {
          id: 'home-pf-payable',
          description: 'Fornecedor PF',
          dueDate: today,
          kind: 'payable',
          cashAccount: 'pf',
          amount: '20.00',
          payments: [],
        },
        {
          id: 'home-pj-receivable',
          description: 'Cliente PJ',
          dueDate: today,
          kind: 'receivable',
          cashAccount: 'pj',
          amount: '30.00',
          payments: [],
        },
      ],
    },
  };
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Operação e financeiro', exact: true })
  ).toBeVisible();
  const balanceCard = page.locator('.dashboard-metric.is-primary');
  await expect(balanceCard).toContainText('Saldo das contas');
  await expect(balanceCard).toContainText('Unificado');
  await expect(balanceCard).toContainText('Conta PF R$ 100,00');
  await expect(balanceCard).toContainText('Conta PJ R$ 40,00');
  const projectionCard = page
    .locator('.dashboard-metric.has-account-breakdown')
    .filter({ hasText: 'Projeção 30 dias' });
  await expect(projectionCard).toContainText('R$ 150,00');
  await expect(projectionCard).toContainText('Conta PF R$ 80,00');
  await expect(projectionCard).toContainText('Conta PJ R$ 70,00');
  await expect(projectionCard).toContainText('A pagar R$ 20,00');
  await expect(projectionCard).toContainText('receber R$ 30,00');
  await expect(page.getByRole('heading', { name: 'Prioridades', exact: true })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Próximos vencimentos', exact: true })
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Ações principais', exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: testInfo.outputPath('home-dashboard.png'), fullPage: true });
});

test('finance dashboard separates PF, PJ and unified balances', async ({ page }, testInfo) => {
  const database = await mockOnlineDatabase(page);
  const today = localDateKey();
  database.state = {
    cashEntries: [
      { id: 'finance-pf-income', date: today, type: 'income', cashAccount: 'pf', amount: '100.00' },
      { id: 'finance-pj-income', date: today, type: 'income', cashAccount: 'pj', amount: '50.00' },
      {
        id: 'finance-pj-expense',
        date: today,
        type: 'expense',
        cashAccount: 'pj',
        amount: '10.00',
      },
    ],
    financialPlanning: {
      accounts: [
        {
          id: 'finance-pf-payable',
          description: 'Fornecedor PF',
          dueDate: today,
          kind: 'payable',
          cashAccount: 'pf',
          amount: '20.00',
          payments: [],
        },
        {
          id: 'finance-pj-receivable',
          description: 'Cliente PJ',
          dueDate: today,
          kind: 'receivable',
          cashAccount: 'pj',
          amount: '30.00',
          payments: [],
        },
      ],
    },
  };
  await page.goto('/financeiro?view=accounts');
  const balanceCard = page.locator('.account-balance-metric');
  await expect(balanceCard).toContainText('Saldo das contas');
  await expect(balanceCard).toContainText('Unificado');
  await expect(balanceCard).toContainText('R$ 140,00');
  await expect(balanceCard).toContainText('Conta PF R$ 100,00');
  await expect(balanceCard).toContainText('Conta PJ R$ 40,00');
  const forecastCards = page.locator('[data-view-pane="accounts"] .cash-forecast-metric');
  await expect(forecastCards).toHaveCount(3);
  const projection30 = forecastCards.filter({ hasText: 'Próximos 30 dias' });
  await expect(projection30).toContainText('Unificado');
  await expect(projection30).toContainText('Conta PF');
  await expect(projection30).toContainText('Conta PJ');
  await expect(projection30).toContainText('A pagar R$ 20,00');
  await expect(projection30).toContainText('a receber R$ 30,00');
  await expectNoHorizontalOverflow(page);
  await page.screenshot({
    path: testInfo.outputPath('finance-account-breakdown.png'),
    fullPage: true,
  });
});

test('monthly category budget compares limits with operational expenses', async ({
  page,
}, testInfo) => {
  const database = await mockOnlineDatabase(page);
  const today = localDateKey();
  const month = today.slice(0, 7);
  database.state = {
    cashEntries: [
      {
        id: 'budget-expense',
        description: 'Compra de teste',
        date: today,
        type: 'expense',
        category: 'supermercado',
        amount: '90.00',
      },
    ],
    financialPlanning: {
      monthlyBudgets: {
        [month]: { supermercado: '100.00' },
      },
    },
  };
  await page.goto(
    `/financeiro?view=planning&ano=${today.slice(0, 4)}&mes=${Number(today.slice(5, 7))}`
  );
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Orçamento mensal por categoria', exact: true })
  ).toBeVisible();
  await expect(page.locator('.budget-row').filter({ hasText: 'Supermercado' })).toContainText(
    'R$ 90,00 de R$ 100,00'
  );
  await expect(page.locator('.budget-row').filter({ hasText: 'Supermercado' })).toContainText(
    'Restam R$ 10,00'
  );
  await page.screenshot({ path: testInfo.outputPath('monthly-budget.png'), fullPage: true });
  await page.locator('#monthly-budget-form input[name="limit"]').fill('80,00');
  await page.getByRole('button', { name: 'Salvar limite', exact: true }).click();
  await expect(page.locator('.budget-row').filter({ hasText: 'Supermercado' })).toContainText(
    'Excedeu R$ 10,00'
  );

  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Orçamento por categoria', exact: true })
  ).toBeVisible();
  await expect(page.locator('.budget-mini-list').filter({ hasText: 'Supermercado' })).toContainText(
    '113%'
  );
  await expect(page.getByText('Orçamento excedido', { exact: true })).toBeVisible();
});
