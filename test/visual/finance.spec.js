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

test('employee registry links employee expenses automatically', async ({ page }, testInfo) => {
  const database = await mockOnlineDatabase(page);
  database.state = {
    cashEntries: [],
    financialPlanning: {
      accounts: [],
      employees: [],
    },
  };

  await page.goto('/financeiro?view=employees');
  await expect(
    page.getByRole('heading', { name: 'Funcionários da Cumbuca', exact: true })
  ).toBeVisible();
  const employeeForm = page.locator('#financial-employee-form');
  await employeeForm.getByLabel('Nome do funcionário', { exact: true }).fill('Maria Silva');
  await employeeForm.getByLabel('Função', { exact: true }).fill('Cozinheira');
  await employeeForm.getByLabel('Salário mensal', { exact: true }).fill('1.500,00');
  await employeeForm.getByRole('button', { name: 'Cadastrar funcionário', exact: true }).click();

  await expect.poll(() => database.state.financialPlanning?.employees?.length).toBe(1);
  const employee = database.state.financialPlanning.employees[0];
  expect(employee.name).toBe('Maria Silva');
  expect(employee.monthlySalary).toBe('1500.00');

  const employeeCard = page.locator('.employee-card').filter({ hasText: 'Maria Silva' });
  await expect(employeeCard).toContainText('R$ 1.500,00');
  await employeeCard.getByRole('link', { name: 'Lançar pagamento', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`employee=${employee.id}`));
  await expect(page.locator('#cash-type')).toHaveValue('expense');
  await expect(page.locator('#cash-category')).toHaveValue('funcionarios');
  await expect(page.locator('#cash-employee')).toHaveValue(employee.id);
  await expect(page.locator('#cash-employee-field')).toBeVisible();

  const cashForm = page.locator('#cash-form');
  await cashForm.locator('#cash-account').selectOption('pj');
  await cashForm.getByLabel('Valor', { exact: true }).fill('800,00');
  await cashForm.getByRole('button', { name: 'Adicionar', exact: true }).click();

  await expect.poll(() => database.state.cashEntries?.length).toBe(1);
  expect(database.state.cashEntries[0]).toMatchObject({
    type: 'expense',
    category: 'funcionarios',
    employeeId: employee.id,
    cashAccount: 'pj',
    amount: '800.00',
  });

  await page.goto('/financeiro?view=employees');
  const updatedCard = page.locator('.employee-card').filter({ hasText: 'Maria Silva' });
  await expect(updatedCard).toContainText('Pago no mês');
  await expect(updatedCard).toContainText('R$ 800,00');
  await expect(updatedCard).toContainText('Falta pagar');
  await expect(updatedCard).toContainText('R$ 700,00');
  const paymentsSection = page
    .getByRole('heading', { name: 'Pagamentos de funcionários no mês', exact: true })
    .locator('..');
  await expect(paymentsSection.locator('.report-table')).toContainText('Pagamento - Maria Silva');
  await expectNoHorizontalOverflow(page);

  const screenshotPath = testInfo.outputPath('finance-employees.png');
  await page.screenshot({ path: screenshotPath, fullPage: true });
  await testInfo.attach('finance-employees.png', {
    path: screenshotPath,
    contentType: 'image/png',
  });

  await page.goto('/financeiro?view=accounts');
  const accountForm = page.locator('#financial-account-form');
  await accountForm.locator('#financial-account-employee').selectOption(employee.id);
  await expect(accountForm.locator('#financial-account-category')).toHaveValue('funcionarios');
  await expect(accountForm.locator('#financial-account-description')).toHaveValue(
    'Salário - Maria Silva'
  );
  await accountForm.getByLabel('Vencimento', { exact: true }).fill(localDateKey());
  await accountForm.getByLabel('Valor total', { exact: true }).fill('200,00');
  await accountForm.getByRole('button', { name: 'Adicionar conta', exact: true }).click();
  await expect(page.locator('.account-row')).toHaveCount(1);
  await page
    .locator('.account-row')
    .getByRole('button', { name: 'Registrar pagamento', exact: true })
    .click();

  await expect.poll(() => database.state.cashEntries?.length).toBe(2);
  expect(database.state.cashEntries[1]).toMatchObject({
    type: 'expense',
    category: 'funcionarios',
    employeeId: employee.id,
    amount: '200.00',
  });
  await page.goto('/financeiro?view=employees');
  const accountUpdatedCard = page.locator('.employee-card').filter({ hasText: 'Maria Silva' });
  await expect(accountUpdatedCard).toContainText('R$ 1.000,00');
  await expect(accountUpdatedCard).toContainText('R$ 500,00');
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
  await expect(reconciliationAccount).toContainText('Conta PF');
  await expect(reconciliationAccount).toContainText('Conta PJ');
  await expect(reconciliationAccount).not.toContainText('Unificado PF + PJ');
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
      {
        id: 'cash-order-4',
        date: today,
        description: 'Saída sem conta',
        type: 'expense',
        category: 'outros',
        amount: '15.00',
      },
    ],
  };
  await page.goto('/fluxo-de-caixa?panel=ledger');
  await expect(page.getByRole('heading', { name: 'Extrato', exact: true })).toBeVisible();
  const ledgerDescriptions = async () =>
    (await page.locator('.cash-ledger-table tbody tr td:nth-child(2)').allTextContents()).map(
      (description) => description.trim()
    );
  const descriptions = await ledgerDescriptions();
  expect(descriptions).toEqual([
    'Saída sem conta',
    'Último lançamento',
    'Segundo lançamento',
    'Primeiro lançamento',
  ]);

  const dateSort = page.locator('[data-sort-cash="date"]');
  await expect(dateSort).toHaveClass(/active/);
  await expect(dateSort).toContainText('↓');
  if (testInfo.project.name === 'desktop') {
    await dateSort.click();
    expect(await ledgerDescriptions()).toEqual([
      'Primeiro lançamento',
      'Segundo lançamento',
      'Último lançamento',
      'Saída sem conta',
    ]);
  }

  const filterDisclosure = page.locator('.cash-filter-disclosure');
  await expect(filterDisclosure).toBeVisible();
  await filterDisclosure.locator('summary').click();
  const filterFormBeforeSummaryReview = page.locator('#cash-filter-form');
  await filterFormBeforeSummaryReview.locator('#cash-filter-type').selectOption('income');
  await filterFormBeforeSummaryReview.getByRole('button', { name: 'Aplicar', exact: true }).click();
  await expect(page.locator('[data-sort-cash="date"]')).toContainText('↓');
  expect(await ledgerDescriptions()).toEqual([
    'Último lançamento',
    'Segundo lançamento',
    'Primeiro lançamento',
  ]);
  await filterFormBeforeSummaryReview.locator('#cash-filter-type').selectOption('all');
  await filterFormBeforeSummaryReview.getByRole('button', { name: 'Aplicar', exact: true }).click();

  const formattedToday = today.split('-').reverse().join('/');
  const pfAccountSummary = page.locator('[data-cash-account-summary="pf"]');
  const pjAccountSummary = page.locator('[data-cash-account-summary="pj"]');
  const unassignedAccountSummary = page.locator('[data-cash-account-summary="unassigned"]');
  const filteredIncome = page.locator('[data-cash-filter-income]');
  const filteredExpenses = page.locator('[data-cash-filter-expenses]');
  const filteredResult = page.locator('[data-cash-filter-result]');
  const accumulatedBalance = page.locator('[data-cash-accumulated-balance]');
  await expect(pfAccountSummary).toContainText('Conta PF');
  await expect(pfAccountSummary).toContainText('R$ 40,00');
  await expect(pfAccountSummary).toContainText(`Último lançamento em ${formattedToday}`);
  await expect(pjAccountSummary).toContainText('Conta PJ');
  await expect(pjAccountSummary).toContainText('R$ 20,00');
  await expect(pjAccountSummary).toContainText(`Último lançamento em ${formattedToday}`);
  await expect(unassignedAccountSummary).toContainText('Lançamentos sem conta');
  await expect(unassignedAccountSummary).toContainText('-R$ 15,00');
  await expect(unassignedAccountSummary).toContainText(`Último lançamento em ${formattedToday}`);
  await expect(filteredIncome).toContainText('R$ 60,00');
  await expect(filteredExpenses).toContainText('R$ 15,00');
  await expect(filteredResult).toContainText('R$ 45,00');
  await expect(accumulatedBalance).toContainText('R$ 45,00');

  await page.getByRole('button', { name: 'Revisar lançamentos', exact: true }).click();
  const filterForm = page.locator('#cash-filter-form');
  await expect(filterForm.locator('#cash-filter-account')).toHaveValue('unassigned');
  expect(await ledgerDescriptions()).toEqual(['Saída sem conta']);
  await expect(filteredIncome).toContainText('R$ 0,00');
  await expect(filteredExpenses).toContainText('R$ 15,00');
  await expect(filteredResult).toContainText('-R$ 15,00');
  await expect(accumulatedBalance).toContainText('R$ 45,00');
  await expectNoHorizontalOverflow(page);
  await page.screenshot({
    path: testInfo.outputPath('cash-ledger-latest-first.png'),
    fullPage: true,
  });
});

test('withdrawals separate account balance, prior withdrawals and cash compensation', async ({
  page,
}, testInfo) => {
  const database = await mockOnlineDatabase(page);
  const today = localDateKey();
  database.state = {
    cashEntries: [
      {
        id: 'withdrawal-opening-balance',
        date: today,
        description: 'Saldo para retiradas',
        type: 'income',
        category: 'venda',
        cashAccount: 'pj',
        amount: '5000.00',
      },
    ],
    financialPlanning: {
      savings: '1000.00',
      savingsExpectedBalance: '1000.00',
      savingsHistory: [],
    },
  };

  await page.goto('/fluxo-de-caixa?panel=withdrawals');
  const form = page.locator('#withdrawal-form');
  await form.locator('select[name="cashAccount"]').selectOption('pj');
  await expect(form.locator('input[name="accountBalanceBefore"]')).toHaveValue('5.000,00');
  await form.locator('input[name="accountBalanceBefore"]').fill('4.750,00');
  await form.locator('input[name="priorVanessa"]').fill('200,00');
  await form.locator('input[name="priorRaquel"]').fill('50,00');
  await expect(form.locator('input[name="expectedSavings"]')).toHaveValue('500,00');
  await expect(form.locator('input[name="expectedVanessa"]')).toHaveValue('3.150,00');
  await expect(form.locator('input[name="expectedRaquel"]')).toHaveValue('1.350,00');
  await expect(form.locator('input[name="savings"]')).toHaveValue('500,00');
  await expect(form.locator('input[name="vanessa"]')).toHaveValue('2.950,00');
  await expect(form.locator('input[name="raquel"]')).toHaveValue('1.300,00');
  await expect(form.locator('.withdrawal-preview')).toContainText('Ajuste para igualar ao banco');
  await expect(form.locator('.withdrawal-preview')).toContainText('-R$ 250,00');
  await expect(form.locator('.withdrawal-preview')).toContainText('Base da divisão');
  await expect(form.locator('.withdrawal-preview')).toContainText('R$ 5.000,00');
  await form.locator('input[name="vanessa"]').fill('2.800,00');
  await expect(form.locator('.withdrawal-preview')).toContainText('Pagou ao caixa R$ 200,00');
  await expect(form.locator('.withdrawal-preview')).toContainText('Ainda não retirou R$ 150,00');
  await form.locator('input[name="vanessa"]').fill('2.950,00');
  await expectNoHorizontalOverflow(page);
  await page.screenshot({
    path: testInfo.outputPath('withdrawal-cash-compensation.png'),
    fullPage: true,
  });
  await form.getByRole('button', { name: 'Registrar retiradas', exact: true }).click();

  await expect.poll(() => database.state.cashEntries?.length).toBe(5);
  const balanceAdjustment = database.state.cashEntries.find(
    (entry) => entry.withdrawalBalanceAdjustment
  );
  expect(balanceAdjustment).toMatchObject({
    type: 'expense',
    category: 'ajuste-conta',
    cashAccount: 'pj',
    amount: '250.00',
  });
  const firstVanessa = database.state.cashEntries.find(
    (entry) => entry.description === 'Retirada - Vanessa'
  );
  expect(firstVanessa).toMatchObject({
    amount: '2950.00',
    expectedAmount: '3150.00',
    priorWithdrawalAmount: '200.00',
    accountBalanceBefore: '4750.00',
    cashAccount: 'pj',
  });
  const firstRaquel = database.state.cashEntries.find(
    (entry) => entry.description === 'Retirada - Raquel'
  );
  expect(firstRaquel).toMatchObject({
    amount: '1300.00',
    expectedAmount: '1350.00',
    priorWithdrawalAmount: '50.00',
    accountBalanceBefore: '4750.00',
    cashAccount: 'pj',
  });
  expect(
    database.state.cashEntries
      .filter((entry) => String(entry.id || '').startsWith('withdrawal-'))
      .every((entry) => entry.cashAccount === 'pj')
  ).toBe(true);
  const accumulated = page
    .locator('.partners-dashboard section')
    .filter({ hasText: 'Valores compensados ao caixa' });
  await expect(accumulated).toContainText('Vanessa');
  await expect(accumulated).toContainText('Pagou ao caixa R$ 200,00');
  await expect(accumulated).toContainText('Pagou ao caixa R$ 50,00');
  expect(
    await page.evaluate((dateKey) => window.accountBalanceUntilDate(dateKey), today)
  ).toBeCloseTo(0, 2);
});

test('store sales filter by day, week and month with previous month comparison', async ({
  page,
}, testInfo) => {
  const database = await mockOnlineDatabase(page);
  database.state = {
    storeSales: [
      { id: 'store-day', date: '2026-07-15', quantity: 10, notes: 'Dia selecionado' },
      { id: 'store-week', date: '2026-07-13', quantity: 5, notes: 'Mesma semana' },
      { id: 'store-month', date: '2026-07-01', quantity: 3, notes: 'Mesmo mês' },
      { id: 'store-previous', date: '2026-06-20', quantity: 7, notes: 'Mês anterior' },
    ],
  };
  await page.evaluate(() => {
    localStorage.setItem(
      'storeSalesFilter',
      JSON.stringify({ period: 'month', date: '2026-07-15', month: '2026-07' })
    );
  });

  await page.goto('/loja');
  const filterForm = page.locator('#store-sales-filter-form');
  const filteredTotal = page.locator('[data-store-sales-filter-total]');
  const comparison = page.locator('[data-store-sales-comparison]');
  const filteredRows = page.locator('.report-section .report-table tbody tr');

  await expect(filteredTotal).toContainText('18');
  await expect(filteredRows).toHaveCount(3);
  await expect(page.getByRole('button', { name: 'Editar', exact: true })).toHaveCount(3);
  await expect(page.getByRole('button', { name: 'Excluir', exact: true })).toHaveCount(3);
  await expect(comparison).toContainText('julho de 2026');
  await expect(comparison).toContainText('18');
  await expect(comparison).toContainText('junho de 2026');
  await expect(comparison).toContainText('7');
  await expect(comparison).toContainText('+11');

  await filterForm.locator('select[name="period"]').selectOption('day');
  await filterForm.locator('input[name="date"]').fill('2026-07-15');
  await filterForm.getByRole('button', { name: 'Aplicar', exact: true }).click();
  await expect(filteredTotal).toContainText('10');
  await expect(filteredRows).toHaveCount(1);

  await filterForm.locator('select[name="period"]').selectOption('week');
  await filterForm.locator('input[name="date"]').fill('2026-07-15');
  await filterForm.getByRole('button', { name: 'Aplicar', exact: true }).click();
  await expect(filteredTotal).toContainText('15');
  await expect(filteredRows).toHaveCount(2);

  await filterForm.locator('select[name="period"]').selectOption('month');
  await filterForm.locator('input[name="month"]').fill('2026-07');
  await filterForm.getByRole('button', { name: 'Aplicar', exact: true }).click();
  await expect(filteredTotal).toContainText('18');
  await expect(filteredRows).toHaveCount(3);
  await expectNoHorizontalOverflow(page);
  await page.screenshot({
    path: testInfo.outputPath('store-sales-filters.png'),
    fullPage: true,
  });
});

test('channels tab lives in store and old cash link redirects', async ({ page }) => {
  await page.goto('/fluxo-de-caixa');
  await expect(page.locator('[data-cash-panel="channels"]')).toHaveCount(0);

  await page.goto('/loja?view=channels');
  const channelsTab = page.getByRole('button', { name: 'Canais', exact: true });
  await expect(channelsTab).toBeVisible();
  await expect(channelsTab).toHaveClass(/active/);
  await expect(
    page.getByRole('heading', { name: 'Entradas por canal', exact: true })
  ).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.getByRole('button', { name: 'Vendas', exact: true }).click();
  await expect(page).toHaveURL(/\/loja\?view=sales$/);
  await expect(page.locator('#store-sale-form')).toBeVisible();

  await page.goto('/fluxo-de-caixa?panel=channels');
  await expect(page).toHaveURL(/\/loja\?view=channels$/);
  await expect(
    page.getByRole('heading', { name: 'Entradas por canal', exact: true })
  ).toBeVisible();
});

test('store sale supports unit and combo quantities', async ({ page }, testInfo) => {
  const database = await mockOnlineDatabase(page);
  database.state = { storeSales: [] };

  await page.goto('/loja?view=sales');
  const form = page.locator('#store-sale-form');
  const unitOption = form.locator('input[name="saleType"][value="unit"]');
  const comboOption = form.locator('input[name="saleType"][value="combo"]');
  const quantity = form.locator('input[name="quantity"]');
  const unitsPerCombo = form.locator('input[name="unitsPerCombo"]');
  const comboField = page.locator('#store-combo-units-field');
  const totalPreview = page.locator('[data-store-sale-total]');

  await expect(unitOption).toBeChecked();
  await expect(comboField).toBeHidden();
  await comboOption.check();
  await expect(comboField).toBeVisible();
  await expect(page.locator('[data-store-sale-quantity-label]')).toHaveText('Quantidade de combos');

  await quantity.fill('3');
  await unitsPerCombo.fill('4');
  await expect(totalPreview).toContainText('12 unidade(s)');
  await form.getByRole('button', { name: 'Adicionar', exact: true }).click();

  await expect.poll(() => database.state.storeSales?.length).toBe(1);
  expect(database.state.storeSales[0]).toMatchObject({
    saleType: 'combo',
    quantity: 3,
    unitsPerCombo: 4,
  });
  await expect(page.locator('[data-store-sales-filter-total]')).toContainText('12');
  const row = page.locator('.store-sales-results tbody tr');
  await expect(row).toHaveCount(1);
  await expect(row).toContainText('Combo');
  await expect(row).toContainText('12');

  await row.getByRole('button', { name: 'Editar', exact: true }).click();
  await expect(comboOption).toBeChecked();
  await expect(quantity).toHaveValue('3');
  await expect(unitsPerCombo).toHaveValue('4');

  await unitOption.check();
  await expect(comboField).toBeHidden();
  await expect(totalPreview).toBeHidden();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({
    path: testInfo.outputPath('store-sale-unit-combo.png'),
    fullPage: true,
  });
});

test('store sales can filter combos and count combos separately from units', async ({
  page,
}, testInfo) => {
  const database = await mockOnlineDatabase(page);
  database.state = {
    storeProducts: [
      { id: 'product-a', name: 'Cumbuca A' },
      { id: 'product-b', name: 'Cumbuca B' },
    ],
    storeSales: [
      {
        id: 'combo-1',
        date: '2026-07-29',
        productId: 'product-a',
        saleType: 'combo',
        quantity: 2,
        unitsPerCombo: 10,
        notes: 'Combo maior',
      },
      {
        id: 'combo-2',
        date: '2026-07-28',
        productId: 'product-b',
        saleType: 'combo',
        quantity: 39,
        unitsPerCombo: 6,
        notes: 'Combo menor',
      },
      {
        id: 'unit-1',
        date: '2026-07-28',
        productId: 'product-b',
        saleType: 'unit',
        quantity: 31,
        notes: 'Avulsas',
      },
      {
        id: 'combo-previous',
        date: '2026-06-20',
        productId: 'product-b',
        saleType: 'combo',
        quantity: 4,
        unitsPerCombo: 6,
        notes: 'Mês anterior',
      },
    ],
  };
  await page.evaluate(() => {
    localStorage.setItem(
      'storeSalesFilter',
      JSON.stringify({
        period: 'month',
        saleType: 'all',
        date: '2026-07-29',
        month: '2026-07',
      })
    );
  });

  await page.goto('/loja?view=sales');
  const filterForm = page.locator('#store-sales-filter-form');
  const rows = page.locator('.store-sales-results tbody tr');

  await filterForm.locator('select[name="saleType"]').selectOption('combo');
  await filterForm.getByRole('button', { name: 'Aplicar', exact: true }).click();

  await expect(rows).toHaveCount(2);
  await expect(page.locator('[data-store-sales-filter-combos]')).toHaveText(/Combos vendidos\s*41/);
  await expect(page.locator('[data-store-sales-filter-combo-units]')).toHaveText(
    /Unidades nos combos\s*254/
  );
  await expect(page.locator('[data-store-sales-filter-standalone-units]')).toContainText('0');
  await expect(page.locator('[data-store-sales-filter-total]')).toHaveText(
    /Total de unidades\s*254/
  );
  await expect(page.locator('[data-store-sales-filter-best-day]')).toContainText('28/07/2026');
  await expect(page.locator('[data-store-sales-filter-best-day]')).toContainText('234 unidade(s)');
  await expect(page.locator('[data-store-sales-day-ranking]')).toContainText('Mais vendeu');
  await expect(page.locator('[data-store-sales-comparison]')).toContainText(
    'Comparação de combos com o mês anterior'
  );
  await expect(page.locator('[data-store-sales-comparison]')).toContainText('+37');
  await page.screenshot({
    path: testInfo.outputPath('store-sales-combo-summary.png'),
    fullPage: true,
  });

  await filterForm.locator('select[name="saleType"]').selectOption('unit');
  await filterForm.getByRole('button', { name: 'Aplicar', exact: true }).click();

  await expect(rows).toHaveCount(1);
  await expect(page.locator('[data-store-sales-filter-standalone-units]')).toHaveText(
    /Unidades avulsas\s*31/
  );
  await expect(page.locator('[data-store-sales-filter-combos]')).toContainText('0');
  await expect(page.locator('[data-store-sales-filter-total]')).toHaveText(
    /Total de unidades\s*31/
  );

  await filterForm.locator('select[name="saleType"]').selectOption('all');
  await filterForm.locator('select[name="productId"]').selectOption('product-b');
  await filterForm.getByRole('button', { name: 'Aplicar', exact: true }).click();

  await expect(rows).toHaveCount(2);
  await expect(page.locator('[data-store-sales-filter-combos]')).toContainText('39');
  await expect(page.locator('[data-store-sales-filter-standalone-units]')).toContainText('31');
  await expect(page.locator('[data-store-sales-filter-total]')).toContainText('265');
  await expect(page.locator('[data-store-sales-filter-best-day]')).toContainText('265 unidade(s)');
});

test('store products receive individual monthly quantities', async ({ page }, testInfo) => {
  const database = await mockOnlineDatabase(page);
  database.state = {
    storeProducts: [],
    storeProductQuantities: [],
  };

  await page.goto('/loja?view=products&month=2026-07');
  const productsTab = page.getByRole('button', { name: 'Produtos', exact: true });
  await expect(productsTab).toBeVisible();
  await expect(productsTab).toHaveClass(/active/);

  const productForm = page.locator('#store-product-form');
  await productForm.locator('input[name="name"]').fill('Cumbuca 500 ml');
  await productForm.getByRole('button', { name: 'Cadastrar produto', exact: true }).click();
  await expect.poll(() => database.state.storeProducts?.length).toBe(1);
  expect(database.state.storeProducts[0].name).toBe('Cumbuca 500 ml');

  const quantitiesForm = page.locator('#store-product-quantities-form');
  const quantity = quantitiesForm.getByLabel('Quantidade de Cumbuca 500 ml', { exact: true });
  await quantity.fill('24');
  await quantitiesForm.locator('button[type="submit"]').click();
  await expect.poll(() => database.state.storeProductQuantities?.length).toBe(1);
  expect(database.state.storeProductQuantities[0]).toMatchObject({
    productId: database.state.storeProducts[0].id,
    month: '2026-07',
    quantity: 24,
  });
  await expect(page.locator('[data-store-product-month-total]')).toContainText('24');
  await expect(page.locator('.store-product-history')).toContainText('julho de 2026');
  await expect(page.locator('.store-product-history')).toContainText('24');

  const monthForm = page.locator('#store-product-month-form');
  await monthForm.locator('input[name="month"]').fill('2026-06');
  await monthForm.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/view=products&month=2026-06/);
  await expect(
    page
      .locator('#store-product-quantities-form')
      .getByLabel('Quantidade de Cumbuca 500 ml', { exact: true })
  ).toHaveValue('');
  await expectNoHorizontalOverflow(page);
  await page.screenshot({
    path: testInfo.outputPath('store-products-monthly.png'),
    fullPage: true,
  });
});

test('store products link recipes and rank sales with estimated profit', async ({
  page,
}, testInfo) => {
  const database = await mockOnlineDatabase(page);
  const today = localDateKey();
  database.state = {
    pricingIngredients: [],
    pricingConfig: {},
    pricingRecipes: [
      {
        id: 'recipe-a',
        name: 'Receita Frango',
        ingredients: [],
        packagingCost: 10,
        fixedFee: 0,
        variableFeePercent: 0,
        desiredMarginPercent: 80,
        practicedPrice: 30,
      },
      {
        id: 'recipe-b',
        name: 'Receita Carne',
        ingredients: [],
        packagingCost: 5,
        fixedFee: 0,
        variableFeePercent: 0,
        desiredMarginPercent: 40,
        practicedPrice: 25,
      },
      {
        id: 'recipe-c',
        name: 'Receita Vegetariana',
        ingredients: [],
        packagingCost: 8,
        fixedFee: 0,
        variableFeePercent: 0,
        desiredMarginPercent: 40,
        practicedPrice: 24,
      },
    ],
    storeProducts: [],
    storeProductQuantities: [],
    storeSales: [],
  };

  await page.goto('/loja?view=products');
  const productForm = page.locator('#store-product-form');
  const createProduct = async (name, recipeId) => {
    await productForm.locator('input[name="name"]').fill(name);
    await productForm.locator('select[name="pricingRecipeId"]').selectOption(recipeId);
    await productForm.getByRole('button', { name: 'Cadastrar produto', exact: true }).click();
    await expect
      .poll(() => database.state.storeProducts?.some((item) => item.name === name))
      .toBe(true);
  };

  await createProduct('Frango Fit', 'recipe-a');
  await createProduct('Carne Caseira', 'recipe-b');
  await createProduct('Vegetariana', 'recipe-c');
  expect(database.state.storeProducts).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ name: 'Frango Fit', pricingRecipeId: 'recipe-a' }),
      expect.objectContaining({ name: 'Carne Caseira', pricingRecipeId: 'recipe-b' }),
      expect.objectContaining({ name: 'Vegetariana', pricingRecipeId: 'recipe-c' }),
    ])
  );
  await expect(page.locator('.store-product-table')).toContainText('Receita Frango');

  const frango = database.state.storeProducts.find((item) => item.name === 'Frango Fit');
  const carne = database.state.storeProducts.find((item) => item.name === 'Carne Caseira');

  await page.getByRole('button', { name: 'Vendas', exact: true }).click();
  const saleForm = page.locator('#store-sale-form');
  await saleForm.locator('input[name="date"]').fill(today);
  await saleForm.locator('select[name="productId"]').selectOption(frango.id);
  await saleForm.locator('input[name="quantity"]').fill('10');
  await saleForm.getByRole('button', { name: 'Adicionar', exact: true }).click();
  await expect.poll(() => database.state.storeSales?.length).toBe(1);
  expect(database.state.storeSales[0]).toMatchObject({
    productId: frango.id,
    productName: 'Frango Fit',
    quantity: 10,
  });

  await saleForm.locator('select[name="productId"]').selectOption(carne.id);
  await saleForm.locator('input[name="saleType"][value="combo"]').check();
  await saleForm.locator('input[name="quantity"]').fill('2');
  await saleForm.locator('input[name="unitsPerCombo"]').fill('3');
  await saleForm.getByRole('button', { name: 'Adicionar', exact: true }).click();
  await expect.poll(() => database.state.storeSales?.length).toBe(2);

  await saleForm.locator('select[name="productId"]').selectOption('');
  await saleForm.locator('input[name="saleType"][value="unit"]').check();
  await saleForm.locator('input[name="quantity"]').fill('2');
  await saleForm.getByRole('button', { name: 'Adicionar', exact: true }).click();
  await expect.poll(() => database.state.storeSales?.length).toBe(3);
  await expect(page.locator('.store-sales-results tbody')).toContainText('Frango Fit');
  await expect(page.locator('.store-sales-results tbody')).toContainText('Carne Caseira');

  await page.goto('/relatorios');
  await page.getByRole('button', { name: 'Produtos', exact: true }).click();
  const performance = page.locator('[data-store-product-performance]');
  await expect(performance).toBeVisible();
  await expect(page.locator('[data-product-performance-units]')).toContainText('18');
  await expect(page.locator('[data-product-performance-profit]')).toContainText('R$ 320,00');
  const rankingRows = performance.locator('tbody tr');
  await expect(rankingRows).toHaveCount(4);
  await expect(rankingRows.nth(0)).toContainText('Frango Fit');
  await expect(rankingRows.nth(0)).toContainText('10');
  await expect(rankingRows.nth(0)).toContainText('R$ 200,00');
  await expect(rankingRows.nth(1)).toContainText('Carne Caseira');
  await expect(rankingRows.nth(1)).toContainText('6');
  await expect(rankingRows.nth(1)).toContainText('R$ 120,00');
  await expect(
    page.getByRole('heading', { name: 'Produtos com saída e margem abaixo da meta' })
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: /Produtos sem saída/ })).toBeVisible();
  await expect(page.locator('.view-pane[data-view-pane="products"]')).toContainText('Vegetariana');
  await expectNoHorizontalOverflow(page);
  await page.screenshot({
    path: testInfo.outputPath('store-product-performance.png'),
    fullPage: true,
  });
});

test('pricing rates monthly costs and calculates recipe profitability', async ({
  page,
}, testInfo) => {
  const database = await mockOnlineDatabase(page);
  database.state = {
    pricingIngredients: [],
    pricingRecipes: [],
    pricingConfig: { sharedCosts: { labels: 3120 } },
    storeProductQuantities: [
      { id: 'q-1', productId: 'product-1', month: '2026-06', quantity: 100 },
      { id: 'q-2', productId: 'product-1', month: '2026-07', quantity: 200 },
    ],
  };

  await page.goto('/precificacao?view=costs');
  const costForm = page.locator('#pricing-shared-cost-form');
  await expect(costForm).toBeVisible();
  await expect(costForm.locator('input[name="labels"]')).toHaveCount(0);
  await expect(page.locator('[data-pricing-shared-preview="monthly"]')).toContainText('R$ 0,00');
  await costForm.getByRole('button', { name: 'Usar média da Loja (150)', exact: true }).click();
  await expect(costForm.locator('input[name="averageMonthlyUnits"]')).toHaveValue('150');
  await costForm.locator('input[name="gas"]').fill('100');
  await costForm.locator('input[name="energy"]').fill('50');
  await expect(costForm.locator('input[name="water"]')).toHaveCount(0);
  await expect(costForm.locator('input[name="labor"]')).toHaveCount(0);
  await costForm.locator('input[name="staffName"]').fill('Ana');
  await costForm.locator('input[name="staffSalary"]').fill('300');
  await costForm.getByRole('button', { name: 'Adicionar funcionário', exact: true }).click();
  await expect.poll(() => database.state.pricingConfig?.sharedCosts?.staff?.length).toBe(1);
  expect(database.state.pricingConfig.sharedCosts).toMatchObject({
    labor: 300,
    staff: [expect.objectContaining({ name: 'Ana', salary: 300 })],
  });
  const anaRow = costForm.locator('[data-pricing-staff-member]').filter({ hasText: 'Ana' });
  await expect(anaRow).toContainText('R$ 300,00');
  await anaRow.getByRole('button', { name: 'Editar', exact: true }).click();
  await costForm.locator('input[name="staffName"]').fill('Ana Silva');
  await costForm.getByRole('button', { name: 'Salvar funcionário', exact: true }).click();
  await expect
    .poll(() => database.state.pricingConfig?.sharedCosts?.staff?.[0]?.name)
    .toBe('Ana Silva');

  await costForm.locator('input[name="staffName"]').fill('Temporário');
  await costForm.locator('input[name="staffSalary"]').fill('50');
  await costForm.getByRole('button', { name: 'Adicionar funcionário', exact: true }).click();
  await expect.poll(() => database.state.pricingConfig?.sharedCosts?.staff?.length).toBe(2);
  const temporaryRow = costForm
    .locator('[data-pricing-staff-member]')
    .filter({ hasText: 'Temporário' });
  page.once('dialog', (dialog) => dialog.accept());
  await temporaryRow.getByRole('button', { name: 'Excluir', exact: true }).click();
  await expect.poll(() => database.state.pricingConfig?.sharedCosts?.staff?.length).toBe(1);
  await expect(page.locator('[data-pricing-staff-total]')).toContainText('R$ 300,00');
  await costForm.locator('input[name="rent"]').fill('600');
  await costForm.locator('input[name="accountant"]').fill('150');
  await costForm.locator('input[name="telephony"]').fill('50');
  await expect(page.locator('[data-pricing-shared-preview="total"]')).toContainText('8,33');
  await expectNoHorizontalOverflow(page);
  await page.screenshot({
    path: testInfo.outputPath('pricing-team-costs.png'),
    fullPage: true,
  });
  const statePostCountBeforeCostsSave = database.statePostCount;
  await costForm.getByRole('button', { name: 'Salvar custos rateados', exact: true }).click();
  await expect.poll(() => database.statePostCount).toBeGreaterThan(statePostCountBeforeCostsSave);
  await expect.poll(() => database.state.pricingConfig?.sharedCosts?.accountant).toBe(150);
  expect(database.state.pricingConfig.sharedCosts).toMatchObject({
    accountant: 150,
    telephony: 50,
    labor: 300,
    staff: [expect.objectContaining({ name: 'Ana Silva', salary: 300 })],
  });
  expect(database.state.pricingConfig.sharedCosts).not.toHaveProperty('water');
  expect(database.state.pricingConfig.sharedCosts).not.toHaveProperty('labels');

  await page.getByRole('button', { name: 'Receitas', exact: true }).click();
  let recipeForm = page.locator('#pricing-recipe-form');
  await expect(page.locator('.pricing-recipe-step')).toHaveText('Etapa 1 de 2');
  await expect(recipeForm.locator('[data-pricing-recipe-ingredient]')).toHaveCount(0);
  await recipeForm.locator('input[name="name"]').fill('Frango Fit');
  await recipeForm.locator('input[name="category"]').fill('Frango');
  await recipeForm.locator('input[name="weightGrams"]').fill('500');
  await recipeForm.locator('input[name="packagingCost"]').fill('2');
  await recipeForm.locator('input[name="fixedFee"]').fill('0,50');
  await recipeForm.locator('input[name="variableFeePercent"]').fill('10');
  await recipeForm.locator('input[name="desiredMarginPercent"]').fill('40');
  await recipeForm.locator('input[name="practicedPrice"]').fill('30');
  await recipeForm
    .getByRole('button', { name: 'Cadastrar receita e continuar', exact: true })
    .click();
  await expect.poll(() => database.state.pricingRecipes?.length).toBe(1);
  expect(database.state.pricingRecipes[0]).toMatchObject({
    name: 'Frango Fit',
    ingredientBatchSize: 50,
    ingredients: [],
  });

  recipeForm = page.locator('#pricing-recipe-form');
  await expect(page.locator('.pricing-recipe-step')).toHaveText('Etapa 2 de 2');
  await expect(
    page.locator(
      '.view-pane[data-view-pane="recipes"] .report-section table .pricing-status.pending'
    )
  ).toContainText('Ingredientes pendentes');
  await recipeForm
    .getByRole('button', { name: 'Cadastrar primeiro ingrediente', exact: true })
    .click();

  let ingredientForm = page.locator('#pricing-ingredient-form');
  await expect(page.locator('.pricing-workflow-context')).toContainText('Frango Fit');
  const unitSelect = ingredientForm.locator('select[name="unit"]');
  await expect(unitSelect.locator('option')).toHaveCount(3);
  await expect(unitSelect.locator('option')).toHaveText(['Quilograma (kg)', 'Unidade', 'Caixa']);
  await ingredientForm.locator('input[name="name"]').fill('Peito de frango');
  await unitSelect.selectOption('kg');
  await ingredientForm.locator('input[name="purchaseQuantity"]').fill('1');
  await ingredientForm.locator('input[name="purchaseCost"]').fill('20');
  await expect(page.locator('[data-pricing-ingredient-unit-cost]')).toContainText('20,00');
  await ingredientForm.getByRole('button', { name: 'Cadastrar ingrediente', exact: true }).click();
  await expect.poll(() => database.state.pricingIngredients?.length).toBe(1);
  await expect(page).toHaveURL(/precificacao\?view=recipes/);
  expect(database.state.pricingIngredients[0]).toMatchObject({ unit: 'kg' });

  recipeForm = page.locator('#pricing-recipe-form');
  await recipeForm.getByRole('button', { name: 'Cadastrar novo ingrediente', exact: true }).click();
  ingredientForm = page.locator('#pricing-ingredient-form');
  await ingredientForm.locator('input[name="name"]').fill('Arroz');
  await ingredientForm.locator('select[name="unit"]').selectOption('box');
  await ingredientForm.locator('input[name="purchaseQuantity"]').fill('1');
  await ingredientForm.locator('input[name="purchaseCost"]').fill('25');
  await ingredientForm.getByRole('button', { name: 'Cadastrar ingrediente', exact: true }).click();
  await expect.poll(() => database.state.pricingIngredients?.length).toBe(2);
  await expect(page).toHaveURL(/precificacao\?view=recipes/);
  expect(database.state.pricingIngredients[1]).toMatchObject({ unit: 'box' });

  recipeForm = page.locator('#pricing-recipe-form');
  await expect(recipeForm.locator('fieldset')).toContainText('50 pratos');
  await recipeForm.locator('[data-pricing-recipe-ingredient]').nth(0).fill('10');
  await recipeForm.locator('[data-pricing-recipe-ingredient]').nth(1).fill('1.5');
  await expect(page.locator('[data-pricing-preview="suggested"]')).toContainText('31,17');
  await expect(page.locator('[data-pricing-preview="profit"]')).toContainText('11,42');
  await expectNoHorizontalOverflow(page);
  await page.screenshot({
    path: testInfo.outputPath('pricing-recipe-batch-50.png'),
    fullPage: true,
  });
  await recipeForm
    .getByRole('button', { name: 'Salvar ingredientes e cadastrar outra receita', exact: true })
    .click();
  await expect.poll(() => database.state.pricingRecipes?.[0]?.ingredients?.length).toBe(2);
  expect(database.state.pricingRecipes[0]).toMatchObject({
    ingredientBatchSize: 50,
    ingredients: [
      expect.objectContaining({ quantity: 10 }),
      expect.objectContaining({ quantity: 1.5 }),
    ],
  });
  await expect(page).toHaveURL(/precificacao\?view=recipes/);
  await expect(page.locator('#pricing-recipe-form input[name="name"]')).toHaveValue('');

  await page.locator('[data-view-tab="dashboard"]').click();
  await expect(page).toHaveURL(/precificacao\?view=dashboard/);
  const recipeRow = page.locator('.pricing-table tbody tr');
  await expect(recipeRow).toHaveCount(1);
  await expect(recipeRow).toContainText('Frango Fit');
  await expect(recipeRow).toContainText('R$ 31,17');
  await expect(recipeRow).toContainText('R$ 11,42');
  await expect(recipeRow).toContainText('38,1%');
  await expect(recipeRow).toContainText('Atenção');
  await expect(page.getByRole('heading', { name: 'Lucro estimado por lote' })).toBeVisible();

  delete database.state.pricingRecipes[0].ingredientBatchSize;
  database.state.pricingRecipes[0].ingredients[0].quantity = 0.2;
  database.state.pricingRecipes[0].ingredients[1].quantity = 0.03;
  await page.reload();
  await page
    .locator('.pricing-table tbody tr')
    .getByRole('button', { name: 'Editar', exact: true })
    .click();
  const legacyRecipeForm = page.locator('#pricing-recipe-form');
  await expect(legacyRecipeForm.locator('[data-pricing-recipe-ingredient]').nth(0)).toHaveValue(
    '10'
  );
  await expect(legacyRecipeForm.locator('[data-pricing-recipe-ingredient]').nth(1)).toHaveValue(
    '1.5'
  );
  await expect(page.locator('[data-pricing-preview="suggested"]')).toContainText('31,17');
  await legacyRecipeForm
    .getByRole('button', { name: 'Salvar ingredientes da receita', exact: true })
    .click();
  await expect.poll(() => database.state.pricingRecipes?.[0]?.ingredientBatchSize).toBe(50);

  await page.setViewportSize({ width: 390, height: 844 });
  await expectNoHorizontalOverflow(page);
  await page.screenshot({
    path: testInfo.outputPath('pricing-recipe-dashboard.png'),
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
