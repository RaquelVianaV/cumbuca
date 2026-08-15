const { test, expect } = require('@playwright/test');

async function login(page) {
  await page.goto('/login');
  await page.getByLabel('Login', { exact: true }).fill('cumbuca');
  await page.getByLabel('Senha', { exact: true }).fill('cumbuca2026');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page).not.toHaveURL(/\/login$/);
}

async function mockOnlineDatabase(page) {
  const holder = { state: {} };
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
  await page.route('**/api/state', async (route) => {
    if (route.request().method() === 'POST') {
      holder.state = JSON.parse(route.request().postData() || '{}').state || {};
      await route.fulfill(json({ database: true, saved: true }));
      return;
    }
    await route.fulfill(json({ database: true, state: holder.state }));
  });

  return holder;
}

function julyFinancialState() {
  return {
    reportPeriod: { type: 'month', year: 2026, month: 7 },
    globalPeriod: { year: 2026, month: 7 },
    cashEntries: [
      {
        id: 'income-july',
        date: '2026-07-10',
        type: 'income',
        category: 'venda',
        amount: '50713.74',
      },
      {
        id: 'market-july',
        date: '2026-07-11',
        type: 'expense',
        category: 'supermercado',
        amount: '12000.00',
      },
      {
        id: 'butcher-july',
        date: '2026-07-11',
        type: 'expense',
        category: 'frigorifico',
        amount: '5000.00',
      },
      {
        id: 'bill-july',
        date: '2026-07-12',
        paidAt: '2026-07-12T12:00:00.000Z',
        type: 'expense',
        category: 'boleto',
        amount: '1949.09',
      },
      {
        id: 'rent-july',
        date: '2026-07-12',
        type: 'expense',
        category: 'aluguel',
        amount: '1500.00',
      },
      {
        id: 'energy-july',
        date: '2026-07-12',
        type: 'expense',
        category: 'enel',
        amount: '980.00',
      },
      {
        id: 'staff-july',
        date: '2026-07-12',
        type: 'expense',
        category: 'funcionarios',
        amount: '6457.00',
      },
      {
        id: 'other-july',
        date: '2026-07-12',
        type: 'expense',
        category: 'outros',
        amount: '19956.74',
      },
      {
        id: 'withdrawal-july-savings',
        date: '2026-07-31',
        type: 'expense',
        category: 'retirada',
        description: 'Retirada - Cofrinho',
        amount: '500.00',
        expectedAmount: '500.00',
        partnerWithdrawalSnapshotId: 'withdrawal-july-review',
      },
      {
        id: 'withdrawal-july-vanessa',
        date: '2026-07-31',
        type: 'expense',
        category: 'retirada',
        description: 'Retirada - Vanessa',
        amount: '4000.00',
        expectedAmount: '4200.00',
        cashDebtAmount: '200.00',
        paidToCashAmount: '200.00',
        partnerWithdrawalSnapshotId: 'withdrawal-july-review',
      },
      {
        id: 'withdrawal-july-raquel',
        date: '2026-07-31',
        type: 'expense',
        category: 'retirada',
        description: 'Retirada - Raquel',
        amount: '1627.40',
        expectedAmount: '1677.40',
        cashDebtAmount: '50.00',
        paidToCashAmount: '50.00',
        partnerWithdrawalSnapshotId: 'withdrawal-july-review',
      },
      {
        id: 'income-june',
        date: '2026-06-10',
        type: 'income',
        category: 'venda',
        amount: '40000.00',
      },
      {
        id: 'expense-june',
        date: '2026-06-11',
        type: 'expense',
        category: 'outros',
        amount: '32000.00',
      },
      {
        id: 'market-june',
        date: '2026-06-11',
        type: 'expense',
        category: 'supermercado',
        amount: '6000.00',
      },
      {
        id: 'withdrawal-june-savings',
        date: '2026-06-30',
        type: 'expense',
        category: 'retirada',
        description: 'Retirada - Cofrinho',
        amount: '200.00',
        expectedAmount: '200.00',
      },
      {
        id: 'withdrawal-june-vanessa',
        date: '2026-06-30',
        type: 'expense',
        category: 'retirada',
        description: 'Retirada - Vanessa',
        amount: '560.00',
        expectedAmount: '560.00',
      },
      {
        id: 'withdrawal-june-raquel',
        date: '2026-06-30',
        type: 'expense',
        category: 'retirada',
        description: 'Retirada - Raquel',
        amount: '240.00',
        expectedAmount: '240.00',
      },
      {
        id: 'income-may',
        date: '2026-05-10',
        type: 'income',
        category: 'venda',
        amount: '10000.00',
      },
      {
        id: 'market-may',
        date: '2026-05-11',
        type: 'expense',
        category: 'supermercado',
        amount: '6000.00',
      },
      {
        id: 'butcher-may',
        date: '2026-05-11',
        type: 'expense',
        category: 'frigorifico',
        amount: '2500.00',
      },
      {
        id: 'bill-may',
        date: '2026-05-12',
        paidAt: '2026-05-12T12:00:00.000Z',
        type: 'expense',
        category: 'boleto',
        amount: '1500.00',
      },
      {
        id: 'market-august',
        date: '2026-08-04',
        type: 'expense',
        category: 'supermercado',
        amount: '20000.00',
      },
      {
        id: 'sale-august',
        date: '2026-08-05',
        type: 'income',
        category: 'venda',
        amount: '5000.00',
      },
      {
        id: 'sale-september',
        date: '2026-09-05',
        type: 'income',
        category: 'venda',
        amount: '1000.00',
      },
      {
        id: 'capital-september',
        date: '2026-09-05',
        type: 'income',
        category: 'vanessa',
        amount: '500.00',
      },
      {
        id: 'difference-september',
        date: '2026-09-05',
        type: 'income',
        category: 'diferenca',
        amount: '200.00',
      },
      {
        id: 'adjustment-september',
        date: '2026-09-05',
        type: 'income',
        category: 'ajuste-conta',
        amount: '300.00',
      },
      {
        id: 'market-october',
        date: '2026-10-05',
        type: 'expense',
        category: 'supermercado',
        amount: '100.00',
      },
    ],
    orders: [
      { id: 'order-july', menuKey: '2026-07-semana-1', totalQuantity: 100, amount: '5000.00' },
      {
        id: 'renewal-july',
        menuKey: '2026-07-semana-1',
        totalQuantity: 999,
        monthlyRenewal: true,
        amount: '800.00',
      },
      { id: 'order-june', menuKey: '2026-06-semana-1', totalQuantity: 50, amount: '2500.00' },
      { id: 'order-may', menuKey: '2026-05-semana-1', totalQuantity: 40, amount: '20000.00' },
      { id: 'order-august', menuKey: '2026-08-semana-1', totalQuantity: 10, amount: '1000.00' },
      { id: 'order-september', menuKey: '2026-09-semana-1', totalQuantity: 5, amount: '400.00' },
    ],
    storeSales: [
      { id: 'store-july', date: '2026-07-15', quantity: 20 },
      { id: 'store-june', date: '2026-06-15', quantity: 10 },
      { id: 'store-may', date: '2026-05-15', quantity: 10 },
    ],
    financialPlanning: { savings: '500.00', savingsHistory: [] },
  };
}

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (error) => console.error(`Browser error: ${error.stack || error.message}`));
  await login(page);
});

test('lucro e resultado usam operação e somente retiradas reais de caixa', async ({ page }) => {
  await page.goto('/home');

  const result = await page.evaluate(() => {
    const profit = 2870.91;
    const baseFinancial = {
      income: 50713.74,
      operationalExpenses: 47842.83,
      profitBeforeWithdrawals: profit,
      withdrawals: { savings: 0, vanessa: 0, raquel: 0, other: 0, total: 0 },
      withdrawalEntries: [],
    };
    const withoutWithdrawals = { financial: baseFinancial, partnerWithdrawalControl: {} };
    const withWithdrawals = {
      financial: {
        ...baseFinancial,
        withdrawals: { savings: 500, vanessa: 4000, raquel: 1627.4, other: 0, total: 6127.4 },
        withdrawalEntries: [{ id: 'withdrawal-test' }],
      },
      partnerWithdrawalControl: { paidToCashVanessa: 0, paidToCashRaquel: 0 },
    };
    const withDebtCompensation = {
      ...withWithdrawals,
      partnerWithdrawalControl: { paidToCashVanessa: 200, paidToCashRaquel: 50 },
    };

    return {
      withoutWithdrawals: {
        profit: window.operationalProfitForReport(withoutWithdrawals),
        result: window.operationalResultForReport(withoutWithdrawals),
      },
      withWithdrawals: {
        profit: window.operationalProfitForReport(withWithdrawals),
        result: window.operationalResultForReport(withWithdrawals),
      },
      withDebtCompensation: {
        profit: window.operationalProfitForReport(withDebtCompensation),
        result: window.operationalResultForReport(withDebtCompensation),
        cashWithdrawals: window.cashWithdrawalsForReport(withDebtCompensation),
        debtCompensation: window.debtCompensationForReport(withDebtCompensation),
        distribution: window.profitDistributionForReport(withDebtCompensation),
      },
    };
  });

  expect(result.withoutWithdrawals.profit).toBeCloseTo(2870.91, 2);
  expect(result.withoutWithdrawals.result).toBeCloseTo(2870.91, 2);
  expect(result.withWithdrawals.profit).toBeCloseTo(2870.91, 2);
  expect(result.withWithdrawals.result).toBeCloseTo(-3256.49, 2);
  expect(result.withDebtCompensation.profit).toBeCloseTo(2870.91, 2);
  expect(result.withDebtCompensation.result).toBeCloseTo(-3256.49, 2);
  expect(result.withDebtCompensation.cashWithdrawals).toBeCloseTo(6127.4, 2);
  expect(result.withDebtCompensation.debtCompensation).toBeCloseTo(250, 2);
  expect(result.withDebtCompensation.distribution).toBeCloseTo(6377.4, 2);
});

test('PDF e Excel recebem o lucro operacional verdadeiro', async ({ page }) => {
  const database = await mockOnlineDatabase(page);
  database.state = julyFinancialState();
  const payloads = { pdf: null, xlsx: null };

  await page.route('**/api/report-pdf', async (route) => {
    payloads.pdf = route.request().postDataJSON();
    await route.fulfill({ status: 200, contentType: 'application/pdf', body: '' });
  });
  await page.route('**/api/report-xlsx', async (route) => {
    payloads.xlsx = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      body: '',
    });
  });

  await page.goto('/relatorios?ano=2026&mes=7');
  await page.evaluate(async () => {
    const originalClick = HTMLAnchorElement.prototype.click;
    const originalCreateObjectUrl = URL.createObjectURL;
    HTMLAnchorElement.prototype.click = () => {};
    URL.createObjectURL = () => 'blob:financial-regression';
    try {
      await window.downloadReportPdf();
      await window.downloadReportXlsx();
    } finally {
      HTMLAnchorElement.prototype.click = originalClick;
      URL.createObjectURL = originalCreateObjectUrl;
    }
  });
  await expect.poll(() => payloads.pdf).not.toBeNull();
  await expect.poll(() => payloads.xlsx).not.toBeNull();

  for (const payload of [payloads.pdf, payloads.xlsx]) {
    expect(payload.data.profitBeforeWithdrawals).toBeCloseTo(2870.91, 2);
    expect(payload.data.profitBeforeWithdrawals).not.toBeCloseTo(6377.4, 2);
    expect(payload.data.availableForWithdrawal).toBeCloseTo(-3256.49, 2);
    expect(payload.data.withdrawalTotal).toBeCloseTo(6127.4, 2);
    expect(payload.data.withdrawalGrossTotal).toBeCloseTo(6377.4, 2);
    expect(payload.data.withdrawalDebtCompensation).toBeCloseTo(250, 2);
    expect(payload.data.salesRevenue).toBeCloseTo(50713.74, 2);
    expect(payload.data.productionPurchases).toBeCloseTo(18949.09, 2);
    expect(payload.data.productionPurchasesBills).toBeCloseTo(1949.09, 2);
    expect(payload.data.productionPurchasesSupermarket).toBeCloseTo(12000, 2);
    expect(payload.data.productionPurchasesButcher).toBeCloseTo(5000, 2);
    expect(payload.data.purchasesPerBowl).toBeCloseTo(157.909083, 5);
    expect(payload.data.purchasesSalesPercent).toBeCloseTo(37.3648, 3);
  }
});

test('relatório semanal exporta somente o intervalo selecionado', async ({ page }) => {
  const database = await mockOnlineDatabase(page);
  database.state = julyFinancialState();

  await page.goto('/relatorios?ano=2026&mes=7&semana=1&inicio=2026-07-06&fim=2026-07-12');
  const result = await page.evaluate(() => {
    const data = window.reportData();
    const payload = window.reportExportPayload(data);
    return {
      type: data.type,
      periodLabel: payload.periodLabel,
      periodType: payload.data.periodType,
      periodStart: payload.data.periodStart,
      periodEnd: payload.data.periodEnd,
      cashDates: payload.data.cashRows.map((row) => row[0]),
      expenses: payload.data.operationalExpenses,
      productionPurchases: payload.data.productionPurchases,
    };
  });

  expect(result).toMatchObject({
    type: 'week',
    periodLabel: '06/07/2026 a 12/07/2026',
    periodType: 'week',
    periodStart: '2026-07-06',
    periodEnd: '2026-07-12',
    expenses: 47842.83,
    productionPurchases: 18949.09,
  });
  expect(result.cashDates.length).toBeGreaterThan(0);
  expect(result.cashDates.every((date) => date >= '2026-07-06' && date <= '2026-07-12')).toBe(true);
  expect(result.cashDates).not.toContain('2026-07-31');
});

test('relatório lê Vanessa de Retiradas e Sócias e o previsto do Cofrinho', async ({ page }) => {
  const database = await mockOnlineDatabase(page);
  database.state = {
    ...julyFinancialState(),
    financialPlanning: {
      savings: '500.00',
      savingsExpectedBalance: '4321.00',
      savingsHistory: [],
    },
    partnerAccounts: {
      partners: [
        { id: 'vanessa', name: 'Vanessa', active: true },
        { id: 'raquel', name: 'Raquel', active: true },
      ],
      movements: [
        {
          id: 'v-debit',
          partnerId: 'vanessa',
          type: 'debit',
          date: '2026-07-05',
          amount: '1000.00',
        },
        {
          id: 'v-payment',
          partnerId: 'vanessa',
          type: 'payment',
          date: '2026-07-10',
          amount: '300.00',
        },
      ],
      withdrawalSnapshots: [],
    },
  };

  await page.goto('/relatorios?ano=2026&mes=7');
  const data = await page.evaluate(() => window.reportData());

  expect(data.vanessaFinancial).toEqual({ received: 4000, paid: 300, debt: 700 });
  expect(data.savingsExpectedBalance).toBe(4321);
});

test('comparativo usa lucro real e insumos somam somente boleto, supermercado e frigorífico', async ({
  page,
}) => {
  const database = await mockOnlineDatabase(page);
  database.state = julyFinancialState();

  await page.goto('/relatorios?ano=2026&mes=7');
  const result = await page.evaluate(() => {
    const data = window.reportData();
    const profitRow = window
      .comparisonReportRows(data)
      .find((row) => row.label === 'Lucro operacional');
    const inputs = window.monthlyFoodAndBillsCost('2026-07');
    return {
      profitRow,
      inputs,
      totalSoldQuantity: data.totalSoldQuantity,
      operationalExpenses: data.financial.operationalExpenses,
    };
  });

  expect(result.profitRow.current).toBeCloseTo(2870.91, 2);
  expect(result.profitRow.previous).toBeCloseTo(2000, 2);
  expect(result.profitRow.current).not.toBeCloseTo(6377.4, 2);
  expect(result.inputs.supermarketTotal).toBeCloseTo(12000, 2);
  expect(result.inputs.butcherTotal).toBeCloseTo(5000, 2);
  expect(result.inputs.billsTotal).toBeCloseTo(1949.09, 2);
  expect(result.inputs.combinedTotal).toBeCloseTo(18949.09, 2);
  expect(result.inputs.combinedTotal).not.toBeCloseTo(47842.83, 2);
  expect(result.inputs.salesRevenue).toBeCloseTo(50713.74, 2);
  expect(result.inputs.purchasesSalesPercent).toBeCloseTo(37.3648, 3);
  expect(result.totalSoldQuantity).toBe(120);
  expect(result.inputs.costPerPlate).toBeCloseTo(157.909083, 5);
  expect(result.operationalExpenses).toBeCloseTo(47842.83, 2);
});

test('compras por cumbuca e compras/vendas são seguras quando o divisor é zero', async ({
  page,
}) => {
  const database = await mockOnlineDatabase(page);
  database.state = julyFinancialState();

  await page.goto('/home');
  const result = await page.evaluate(() => window.productionPurchasesForPeriod('2026-10'));

  expect(result.purchasesProduction).toBeCloseTo(100, 2);
  expect(result.totalQuantity).toBe(0);
  expect(result.purchasesPerBowl).toBe(0);
  expect(result.purchasesSalesPercent).toBe(0);
  expect(Number.isFinite(result.purchasesPerBowl)).toBe(true);
  expect(Number.isFinite(result.purchasesSalesPercent)).toBe(true);
});

test('receita de vendas usa o Caixa e não duplica pedidos, aportes, diferenças ou ajustes', async ({
  page,
}) => {
  const database = await mockOnlineDatabase(page);
  database.state = julyFinancialState();

  await page.goto('/home');
  const result = await page.evaluate(() => {
    const sales = window.salesRevenueForPeriod('2026-09');
    const dre = window.managementDreData('2026-09');
    return {
      sales,
      financialIncomeReconciliation: dre.financialIncomeReconciliation,
      statement: window.managementStatementHtml(dre),
    };
  });

  expect(result.sales.cashSales).toBeCloseTo(1000, 2);
  expect(result.sales.total).toBeCloseTo(1000, 2);
  expect(result.sales.orderSales).toBeUndefined();
  expect(result.financialIncomeReconciliation).toBeCloseTo(700, 2);
  expect(result.statement).toContain('Conciliação com entradas do Financeiro');
});

test('conta-corrente de sócia afeta caixa sem alterar operação, insumos ou lucro', async ({
  page,
}) => {
  const database = await mockOnlineDatabase(page);
  database.state = {
    cashEntries: [
      {
        id: 'sale-1',
        date: '2026-08-07',
        type: 'income',
        category: 'venda',
        amount: '1000.00',
        cashAccount: 'pj',
      },
      {
        id: 'partner-cash-debit-1',
        date: '2026-08-07',
        type: 'expense',
        category: 'conta-socia',
        amount: '300.00',
        cashAccount: 'pj',
        partnerMovementId: 'partner-debit-1',
        nonOperationalPartnerAccount: true,
      },
      {
        id: 'partner-cash-payment-1',
        date: '2026-08-07',
        type: 'income',
        category: 'conta-socia',
        amount: '100.00',
        cashAccount: 'pj',
        partnerMovementId: 'partner-payment-1',
        nonOperationalPartnerAccount: true,
      },
    ],
    partnerAccounts: {
      partners: [
        { id: 'vanessa', name: 'Vanessa', active: true },
        { id: 'raquel', name: 'Raquel', active: true },
      ],
      movements: [
        {
          id: 'partner-debit-1',
          partnerId: 'vanessa',
          date: '2026-08-07',
          type: 'debit',
          description: 'Compra pessoal',
          amount: '300.00',
          origin: 'pj',
          cashImpact: true,
          cashEntryId: 'partner-cash-debit-1',
        },
        {
          id: 'partner-payment-1',
          partnerId: 'vanessa',
          date: '2026-08-07',
          type: 'payment',
          description: 'Pagamento via Pix',
          amount: '100.00',
          origin: 'pix',
          cashImpact: true,
          cashEntryId: 'partner-cash-payment-1',
        },
      ],
      withdrawalSnapshots: [],
    },
  };

  await page.goto('/financeiro?view=partners&ano=2026&mes=8');
  await expect(page.locator('[data-partner-current-accounts]')).toContainText(
    'Conta-corrente das sócias'
  );
  await expect(page.locator('.partner-account-card').filter({ hasText: 'Vanessa' })).toContainText(
    'R$ 200,00'
  );
  const result = await page.evaluate(() => {
    const periodEntries = window.reportCashEntries('2026-08', '');
    const financial = window.financialSummary(periodEntries);
    const purchases = window.productionPurchasesForPeriod('2026-08');
    const dre = window.managementDreData('2026-08');
    return {
      physicalCash: window.accountBalanceUntilDate('2026-08-07', [], 'pj'),
      operationalIncome: financial.income,
      operationalExpenses: financial.operationalExpenses,
      operationalProfit: financial.profitBeforeWithdrawals,
      purchases: purchases.purchasesProduction,
      sales: purchases.salesRevenue,
      reconciliation: dre.financialIncomeReconciliation,
    };
  });

  expect(result.physicalCash).toBeCloseTo(800, 2);
  expect(result.operationalIncome).toBeCloseTo(1000, 2);
  expect(result.operationalExpenses).toBe(0);
  expect(result.operationalProfit).toBeCloseTo(1000, 2);
  expect(result.purchases).toBe(0);
  expect(result.sales).toBeCloseTo(1000, 2);
  expect(result.reconciliation).toBe(0);
});

test('comparação mensal calcula variação, pontos percentuais e média de três meses', async ({
  page,
}) => {
  const database = await mockOnlineDatabase(page);
  database.state = julyFinancialState();

  await page.goto('/home');
  const result = await page.evaluate(() => {
    const rows = window.managementComparisonRows('2026-07');
    return {
      sales: rows.find((row) => row.key === 'sales'),
      purchasesRatio: rows.find((row) => row.key === 'purchasesSalesPercent'),
      bowls: rows.find((row) => row.key === 'bowls'),
      average: window.managementMovingAverage('2026-07', 3),
      partialAverage: window.managementMovingAverage('2026-05', 3),
    };
  });

  expect(result.sales.current).toBeCloseTo(50713.74, 2);
  expect(result.sales.previous).toBeCloseTo(40000, 2);
  expect(result.sales.delta).toBeCloseTo(10713.74, 2);
  expect(result.bowls.current).toBe(120);
  expect(result.bowls.previous).toBe(60);
  expect(result.purchasesRatio.current).toBeCloseTo(37.3648, 3);
  expect(result.purchasesRatio.previous).toBeCloseTo(15, 3);
  expect(result.purchasesRatio.percentagePointDelta).toBeCloseTo(22.3648, 3);
  expect(result.average.monthsUsed).toBe(3);
  expect(result.average.monthKeys).toEqual(['2026-07', '2026-06', '2026-05']);
  expect(result.average.purchasesProduction).toBeCloseTo(11649.6967, 3);
  expect(result.average.purchasesPerBowl).toBeCloseTo(152.6364, 3);
  expect(result.average.sales).toBeCloseTo(33571.2467, 3);
  expect(result.average.bowls).toBeCloseTo(76.6667, 3);
  expect(result.partialAverage.monthsUsed).toBe(1);
  expect(result.partialAverage.monthKeys).toEqual(['2026-05']);
  expect(result.partialAverage.purchasesProduction).toBeCloseTo(10000, 2);
});

test('alertas detectam compras por cumbuca em alta e compras maiores com produção menor', async ({
  page,
}) => {
  const database = await mockOnlineDatabase(page);
  database.state = julyFinancialState();

  await page.goto('/home');
  const result = await page.evaluate(() => {
    const current = window.managementPeriodMetrics('2026-08');
    const previous = window.managementPeriodMetrics('2026-07');
    const average = window.managementMovingAverage('2026-08', 3);
    const positiveCurrent = window.managementPeriodMetrics('2026-06');
    const positivePrevious = window.managementPeriodMetrics('2026-05');
    return {
      alerts: window.managementAttentionItems(current, previous, average),
      positive: window.managementAttentionItems(
        positiveCurrent,
        positivePrevious,
        window.managementMovingAverage('2026-06', 3)
      ),
    };
  });
  const { alerts, positive } = result;

  expect(alerts.map((item) => item.title)).toContain('Compras por cumbuca aumentaram');
  expect(alerts.map((item) => item.title)).toContain(
    'Compras aumentaram enquanto as cumbucas vendidas caíram'
  );
  expect(alerts.map((item) => item.title)).toContain(
    'Compras estão consumindo uma parcela maior das vendas'
  );
  expect(alerts.find((item) => item.title.includes('cumbucas vendidas caíram')).detail).toContain(
    'Pode indicar'
  );
  expect(positive.some((item) => item.tone === 'positive')).toBe(true);
  expect(positive.map((item) => item.title)).toContain(
    'Vendas cresceram enquanto as compras caíram'
  );
});

test('DRE separa compras, despesas, distribuições e caixa sem alterar o lucro operacional', async ({
  page,
}) => {
  const database = await mockOnlineDatabase(page);
  database.state = julyFinancialState();

  await page.goto('/home');
  const result = await page.evaluate(() => {
    const dre = window.managementDreData('2026-07');
    return {
      purchases: dre.purchasesProduction,
      marginAfterPurchases: dre.marginAfterPurchases,
      financialIncomeReconciliation: dre.financialIncomeReconciliation,
      otherOperationalExpenses: dre.otherOperationalExpenses,
      groupedOtherExpenses: dre.otherExpenseGroups.reduce((sum, item) => sum + item.value, 0),
      groupLabels: dre.otherExpenseGroups.map((item) => item.label),
      operationalExpenses: dre.financial.operationalExpenses,
      operationalProfit: dre.operationalProfit,
      cashWithdrawals: dre.cashWithdrawals,
      debtCompensation: dre.debtCompensation,
      distribution: dre.distribution,
      openingCashBalance: dre.openingCashBalance,
      cashIncome: dre.cashIncome,
      cashExpenses: dre.cashExpenses,
      adjustments: dre.accountAdjustmentTotals.balance,
      finalCashBalance: dre.finalCashBalance,
      html: window.managementStatementHtml(dre),
    };
  });

  expect(result.purchases).toBeCloseTo(18949.09, 2);
  expect(result.marginAfterPurchases).toBeCloseTo(31764.65, 2);
  expect(result.financialIncomeReconciliation).toBe(0);
  expect(result.operationalExpenses).toBeCloseTo(47842.83, 2);
  expect(result.otherOperationalExpenses).toBeCloseTo(28893.74, 2);
  expect(result.groupedOtherExpenses).toBeCloseTo(28893.74, 2);
  expect(result.groupLabels).not.toContain('Retirada');
  expect(result.operationalProfit).toBeCloseTo(2870.91, 2);
  expect(
    result.marginAfterPurchases -
      result.otherOperationalExpenses +
      result.financialIncomeReconciliation
  ).toBeCloseTo(result.operationalProfit, 2);
  expect(result.cashWithdrawals).toBeCloseTo(6127.4, 2);
  expect(result.debtCompensation).toBeCloseTo(250, 2);
  expect(result.distribution).toBeCloseTo(6377.4, 2);
  expect(result.openingCashBalance).toBeCloseTo(1000, 2);
  expect(
    result.openingCashBalance + result.cashIncome - result.cashExpenses + result.adjustments
  ).toBeCloseTo(result.finalCashBalance, 2);
  expect(result.html).toContain('Margem após compras');
  expect(result.html).not.toContain('Conciliação com entradas do Financeiro');
  expect(result.html).toContain('dívida compensada');
  expect(result.html).toContain('Direito reconhecido que não saiu da conta');
  expect(result.html).toContain('Movimentação de caixa');
  expect(result.html).toContain('Saldo inicial');
});

test('painel local apresenta os indicadores financeiros corrigidos', async ({ page }, testInfo) => {
  const database = await mockOnlineDatabase(page);
  database.state = julyFinancialState();

  await page.goto('/home');
  await page.evaluate(() => {
    localStorage.setItem('globalPeriod', JSON.stringify({ year: 2026, month: 7 }));
  });
  await page.reload();

  await expect(
    page.getByRole('heading', { name: 'Situação da empresa', exact: true })
  ).toBeVisible();
  await expect(page.locator('.executive-kpi-grid')).toContainText(/Vendas\s*R\$\s*50\.713,74/);
  await expect(page.locator('.executive-kpi-grid')).toContainText(
    /Compras de insumos\s*R\$\s*18\.949,09/
  );
  await expect(page.locator('.executive-kpi-grid')).toContainText(/Compras \/ Vendas\s*37,4%/);
  await expect(page.locator('.executive-kpi-grid')).toContainText(/Cumbucas vendidas\s*120/);
  await expect(page.locator('.executive-kpi-grid')).toContainText(
    /Compras por cumbuca\s*R\$\s*157,91/
  );
  await expect(page.locator('.executive-kpi-grid')).toContainText(
    /Lucro operacional\s*R\$\s*2\.870,91/
  );
  await expect(page.locator('.executive-attention')).toContainText('O que precisa da sua atenção');
  await expect(page.locator('[data-management-dre]')).toContainText('Margem após compras');
  await expect(page.locator('[data-management-dre]')).toContainText(
    'Saldo inicial PF + PJR$ 1.000,00'
  );
  await expect(page.locator('[data-management-dre]')).toContainText(
    'Saldo final PF + PJ-R$ 2.256,49'
  );
  await expect(page.locator('[data-management-dre]')).toContainText(
    'Saldo consolidado finalPF + PJ + Cofrinho-R$ 1.756,49'
  );
  await expect(page.locator('.management-comparison-panel')).toContainText(
    'Comparação com mês anterior'
  );

  const screenshotPath = testInfo.outputPath(`dashboard-financeiro-${testInfo.project.name}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  await testInfo.attach(`dashboard-financeiro-${testInfo.project.name}.png`, {
    path: screenshotPath,
    contentType: 'image/png',
  });
});
