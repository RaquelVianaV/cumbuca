const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const testPassword = 'cumbuca-server-test-password';
process.env.CUMBUCA_AUTH_SECRET = 'cumbuca-server-test-secret-2026';
process.env.CUMBUCA_PASSWORD = testPassword;
process.env.VERCEL = '1';
const handleRequest = require('../server');
const {
  backupVersionId,
  bulkFinancialClearRequested,
  calculateCashFlow,
  calculatePricing,
  financialPayloadChanged,
  financialIntegritySummary,
  integrationStatus,
  legacyBackupDate,
  normalizeState,
  normalizedPermissions,
  stateWriteViolation,
  userCan,
  validateBackupPayload,
  weekRangeFromDate,
} = handleRequest._test;

test('calculateCashFlow normalizes values and preserves entry IDs', () => {
  const result = calculateCashFlow([
    {
      id: 'out-1',
      description: 'Compra',
      date: '2026-06-02',
      type: 'expense',
      amount: -30,
      category: 'insumos',
    },
    {
      id: 'in-1',
      description: 'Venda',
      date: '2026-06-01',
      type: 'income',
      amount: '100',
      category: 'vendas',
    },
  ]);

  assert.equal(result.income, 100);
  assert.equal(result.expenses, 30);
  assert.equal(result.balance, 70);
  assert.deepEqual(
    result.entries.map((entry) => entry.id),
    ['in-1', 'out-1']
  );
  assert.equal(result.entries[1].amount, 30);
});

test('normalizeState fills missing keys without replacing supplied values', () => {
  const cashEntries = [{ id: 'entry-1', amount: 50 }];
  const state = normalizeState({ cashEntries });

  assert.equal(state.cashEntries, cashEntries);
  assert.deepEqual(state.clients, []);
  assert.deepEqual(state.storeProducts, []);
  assert.deepEqual(state.storeProductQuantities, []);
  assert.deepEqual(state.pricingRecipes, []);
  assert.deepEqual(state.weeklyClosings, {});
  assert.deepEqual(state.financialPlanning.accounts, []);
  assert.deepEqual(state.financialPlanning.reconciliationHistory, []);
  assert.deepEqual(state.financialPlanning.monthlyBudgets, {});
  assert.equal(state.appConfig.storeName, 'Cumbuca');
});

test('calculatePricing uses a manual supermarket unit cost and rates monthly costs', () => {
  const result = calculatePricing({
    sharedCosts: {
      averageMonthlyUnits: 1000,
      gas: 100,
      energy: 200,
      labor: 9999,
      staff: [
        { id: 'staff-1', name: 'Ana', salary: 600 },
        { id: 'staff-2', name: 'Bia', salary: 400 },
      ],
      rent: 1000,
      accountant: 100,
      labels: 9999,
      telephony: 60,
      marketing: 400,
      extraordinary: 100,
    },
    recipe: {
      supermarketUnitCost: 4.75,
      packagingCost: 2,
      fixedFee: 0.5,
      variableFeePercent: 10,
      desiredMarginPercent: 40,
      practicedPrice: 25,
    },
  });

  assert.equal(result.supermarketUnitCost, 4.75);
  assert.equal(result.ingredientCost, 4.75);
  assert.equal(result.productionCost, 0.3);
  assert.equal(result.laborCost, 1);
  assert.equal(result.otherCost, 1.66);
  assert.equal(result.baseCost, 10.21);
  assert.equal(result.suggestedPrice, 20.42);
  assert.equal(result.totalCost, 12.252);
  assert.ok(Math.abs(result.profit - 8.168) < 0.000001);
  assert.equal(result.realTotalCost, 12.71);
  assert.equal(result.realProfit, 12.29);
  assert.equal(result.realMarginPercent, 49.16);
  assert.equal(result.status, 'Lucrativa');
});

test('calculatePricing preserves legacy ingredient costs until a manual value is saved', () => {
  const result = calculatePricing({
    catalog: [{ id: 'chicken', unit: 'kg', purchaseQuantity: 1, purchaseCost: 20 }],
    recipe: {
      ingredients: [{ ingredientId: 'chicken', quantity: 0.2 }],
      desiredMarginPercent: 0,
      variableFeePercent: 0,
    },
  });

  assert.equal(result.ingredientCost, 4);
  assert.equal(result.supermarketUnitCost, 4);
  assert.equal(result.baseCost, 4);
});

test('calculatePricing preserves legacy labor until staff is registered', () => {
  const result = calculatePricing({
    catalog: [],
    sharedCosts: {
      averageMonthlyUnits: 100,
      labor: 500,
    },
    recipe: {
      supermarketUnitCost: 0,
      desiredMarginPercent: 0,
      variableFeePercent: 0,
    },
  });

  assert.equal(result.laborCost, 5);
  assert.equal(result.baseCost, 5);
  assert.equal(result.status, 'Custo de supermercado pendente');
});

test('automatic backups share one version per UTC hour', () => {
  const first = backupVersionId('automatic', new Date('2026-06-10T12:05:00.000Z'));
  const second = backupVersionId('automatic', new Date('2026-06-10T12:59:59.000Z'));

  assert.equal(first, '2026-06-10T12:00:00.000Z-automatic');
  assert.equal(second, first);
});

test('protected backups receive unique version IDs', () => {
  const date = new Date('2026-06-10T12:05:00.000Z');
  const first = backupVersionId('pre-reset', date);
  const second = backupVersionId('pre-reset', date);

  assert.notEqual(first, second);
  assert.match(first, /^\d{17}-pre-reset-[a-f0-9]{8}$/);
});

test('legacy backup references resolve to the original date', () => {
  assert.equal(legacyBackupDate('2026-06-10'), '2026-06-10');
  assert.equal(legacyBackupDate('legacy-2026-06-10'), '2026-06-10');
  assert.equal(legacyBackupDate('2026-06-10T12:00:00.000Z-automatic'), '');
});

test('closed months block financial changes at the API policy layer', () => {
  const current = normalizeState({
    cashEntries: [{ id: 'entry-1', date: '2026-06-10', type: 'income', amount: 100 }],
    monthlyClosings: { '2026-06': { locked: true } },
  });
  const violation = stateWriteViolation(current, {
    cashEntries: [{ id: 'entry-1', date: '2026-06-10', type: 'income', amount: 120 }],
  });

  assert.equal(violation.statusCode, 409);
  assert.match(violation.message, /fechado/i);
});

test('closed days block financial changes at the API policy layer', () => {
  const current = normalizeState({
    cashEntries: [{ id: 'entry-1', date: '2026-06-10', type: 'income', amount: 100 }],
    financialPlanning: { dailyClosings: { '2026-06-10': { locked: true } } },
  });
  const violation = stateWriteViolation(current, {
    cashEntries: [{ id: 'entry-1', date: '2026-06-10', type: 'income', amount: 120 }],
  });

  assert.equal(violation.statusCode, 409);
  assert.match(violation.message, /2026-06-10/);
});

test('closed months block monthly store product quantities', () => {
  const current = normalizeState({
    storeProductQuantities: [
      { id: 'quantity-1', productId: 'product-1', month: '2026-06', quantity: 10 },
    ],
    monthlyClosings: { '2026-06': { locked: true } },
  });
  const violation = stateWriteViolation(current, {
    storeProductQuantities: [
      { id: 'quantity-1', productId: 'product-1', month: '2026-06', quantity: 12 },
    ],
  });

  assert.equal(violation.statusCode, 409);
  assert.match(violation.message, /2026-06/);
});

test('admin reopens a period before financial values can change', () => {
  const current = normalizeState({
    cashEntries: [{ id: 'entry-1', date: '2026-06-10', type: 'income', amount: 100 }],
    monthlyClosings: { '2026-06': { locked: false, reopenReason: 'Correção contábil' } },
  });
  const violation = stateWriteViolation(current, {
    cashEntries: [{ id: 'entry-1', date: '2026-06-10', type: 'income', amount: 120 }],
  });

  assert.equal(violation, null);
});

test('detailed permissions keep admin access and restrict operators', () => {
  const operatorPermissions = normalizedPermissions(
    {
      editFinancial: false,
      manageClosings: true,
      restoreBackup: false,
      clearData: false,
    },
    'operator'
  );
  const operator = { role: 'operator', permissions: operatorPermissions };
  const admin = { role: 'admin', permissions: normalizedPermissions({}, 'admin') };

  assert.equal(userCan(operator, 'editFinancial'), false);
  assert.equal(userCan(operator, 'manageClosings'), true);
  assert.equal(userCan(operator, 'restoreBackup'), false);
  assert.equal(userCan(admin, 'clearData'), true);
});

test('financial payload detection ignores unrelated configuration changes', () => {
  const current = normalizeState({ cashEntries: [] });
  assert.equal(financialPayloadChanged(current, { appConfig: { storeName: 'Nova' } }), false);
  assert.equal(
    financialPayloadChanged(current, {
      cashEntries: [{ id: 'entry-1', date: '2026-06-12', type: 'income', amount: 10 }],
    }),
    true
  );
  assert.equal(
    financialPayloadChanged(current, {
      storeProducts: [{ id: 'product-1', name: 'Cumbuca 500 ml' }],
    }),
    true
  );
});

test('bulk financial clearing requires the dedicated clear-data permission', () => {
  const current = normalizeState({
    cashEntries: [{ id: 'entry-1' }],
    storeSales: [{ id: 'sale-1' }],
    channelReceipts: [{ id: 'receipt-1' }],
  });

  assert.equal(
    bulkFinancialClearRequested(current, {
      cashEntries: [],
      storeSales: [],
      channelReceipts: [],
    }),
    true
  );
  assert.equal(
    bulkFinancialClearRequested(current, {
      cashEntries: [],
      storeSales: current.storeSales,
      channelReceipts: current.channelReceipts,
    }),
    false
  );
});

test('integration status never exposes webhook URLs or tokens', () => {
  const status = integrationStatus();
  assert.deepEqual(
    Object.keys(status).sort(),
    ['alerts', 'externalBackup', 'tokenConfigured'].sort()
  );
  assert.equal(JSON.stringify(status).includes('http'), false);
});

test('weekly ranges use Monday through Sunday', () => {
  assert.deepEqual(weekRangeFromDate('2026-06-10'), {
    start: '2026-06-08',
    end: '2026-06-14',
  });
});

test('backup restore dry-run validates a complete normalized state', () => {
  const validation = validateBackupPayload({
    payload: { data: normalizeState({ cashEntries: [{ id: 'entry-1' }] }) },
  });

  assert.equal(validation.valid, true);
  assert.equal(validation.missingKeys.length, 0);
  assert.ok(validation.bytes > 100);
  assert.equal(validation.preview.cash, 1);
});

test('financial integrity reports negative balance and reopened periods', () => {
  const state = normalizeState({
    cashEntries: [{ id: 'out-1', date: '2026-06-10', type: 'expense', amount: 50 }],
    monthlyClosings: { '2026-05': { locked: false } },
  });
  const result = financialIntegritySummary(state, null);

  assert.equal(result.status, 'danger');
  assert.equal(result.totals.balance, -50);
  assert.deepEqual(result.closings.unlockedMonths, ['2026-05']);
});

test('financial integrity keeps account adjustments out of accumulated warnings', () => {
  const state = normalizeState({
    cashEntries: [
      { id: 'income-1', date: '2026-06-10', type: 'income', amount: 100 },
      {
        id: 'adjustment-1',
        date: '2026-06-10',
        type: 'expense',
        category: 'ajuste-conta',
        amount: 25,
      },
    ],
  });
  const result = financialIntegritySummary(state, null);

  assert.equal(result.totals.adjustments, -25);
  assert.equal(
    result.checks.some((check) => check.id === 'adjustments'),
    false
  );
  assert.equal(
    result.checks.some((check) => check.label === 'Ajustes acumulados'),
    false
  );
});

test('financial reset endpoints require authentication', async (t) => {
  const server = http.createServer(handleRequest);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const { port } = server.address();

  for (const pathname of ['/api/reset-financial-state', '/api/reset-state']) {
    const response = await fetch(`http://127.0.0.1:${port}${pathname}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const payload = await response.json();

    assert.equal(response.status, 401);
    assert.match(payload.error, /login/i);
  }
});

test('maintenance token reset endpoint stays unavailable without token env', async (t) => {
  const server = http.createServer(handleRequest);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const { port } = server.address();

  const response = await fetch(`http://127.0.0.1:${port}/api/maintenance/reset-state`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-cumbuca-reset-token': 'invalid',
    },
    body: JSON.stringify({ confirm: 'LIMPAR TODO O BANCO' }),
  });
  const payload = await response.json();

  assert.equal(response.status, 404);
  assert.match(payload.error, /indisponivel/i);
});

test('authenticated HTTP flow serves session, finance calculation and reports', async (t) => {
  const server = http.createServer(handleRequest);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  const login = await fetch(`${baseUrl}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'cumbuca', password: testPassword }),
  });
  assert.equal(login.status, 200);
  const cookie = login.headers.get('set-cookie').split(';')[0];

  const session = await fetch(`${baseUrl}/api/session`, { headers: { Cookie: cookie } });
  const sessionPayload = await session.json();
  assert.equal(sessionPayload.authenticated, true);
  assert.equal(sessionPayload.user.role, 'admin');
  assert.equal(sessionPayload.user.permissions.clearData, true);

  const integrations = await fetch(`${baseUrl}/api/integrations`, { headers: { Cookie: cookie } });
  const integrationsPayload = await integrations.json();
  assert.equal(integrations.status, 200);
  assert.equal(Object.prototype.hasOwnProperty.call(integrationsPayload.alerts, 'url'), false);

  const cashFlow = await fetch(`${baseUrl}/api/fluxo-de-caixa`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({
      entries: [
        { id: 'in-1', date: '2026-06-10', type: 'income', amount: 150 },
        { id: 'out-1', date: '2026-06-10', type: 'expense', amount: 40 },
      ],
    }),
  });
  assert.equal(cashFlow.status, 200);
  assert.equal((await cashFlow.json()).balance, 110);

  const reportPayload = {
    title: 'Teste financeiro',
    period: 'Junho 2026',
    summary: [{ label: 'Saldo', value: 'R$ 110,00' }],
    sections: [],
  };
  const pdf = await fetch(`${baseUrl}/api/report-pdf`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify(reportPayload),
  });
  assert.equal(pdf.status, 200);
  assert.match(pdf.headers.get('content-type'), /application\/pdf/);
  assert.ok((await pdf.arrayBuffer()).byteLength > 500);

  const xlsx = await fetch(`${baseUrl}/api/report-xlsx`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({
      filename: 'teste.xlsx',
      sheets: [{ name: 'Resumo', rows: [['Saldo', 110]] }],
    }),
  });
  assert.equal(xlsx.status, 200);
  assert.match(xlsx.headers.get('content-type'), /spreadsheet/);
  assert.ok((await xlsx.arrayBuffer()).byteLength > 500);
});
