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
  const holder = {
    state: {},
    stateGetCount: 0,
    statePostCount: 0,
    statePostDelayMs: 0,
  };
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
    holder.stateGetCount += 1;
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

test('finance menu stays between the hero and period filters', async ({ page }, testInfo) => {
  const hero = page.locator('.hero');
  const menu = page.locator('.view-tabs-panel');
  const filters = page.locator('.finance-month-command');
  await expect(menu).toBeVisible();

  const [heroBox, menuBox, filtersBox] = await Promise.all([
    hero.boundingBox(),
    menu.boundingBox(),
    filters.boundingBox(),
  ]);
  expect(heroBox).not.toBeNull();
  expect(menuBox).not.toBeNull();
  expect(filtersBox).not.toBeNull();
  expect(menuBox.y).toBeGreaterThanOrEqual(heroBox.y + heroBox.height);
  expect(menuBox.y + menuBox.height).toBeLessThanOrEqual(filtersBox.y);
  await expectNoHorizontalOverflow(page);
  await expect(page.locator('.finance-month-command-head')).toHaveCount(0);

  const screenshotPath = testInfo.outputPath(`finance-menu-top-${testInfo.project.name}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: false });
  await testInfo.attach(`finance-menu-top-${testInfo.project.name}.png`, {
    path: screenshotPath,
    contentType: 'image/png',
  });

  await page.getByRole('button', { name: 'Contas', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Contas a pagar e receber', exact: true })
  ).toBeVisible();
  await expect(page.locator('.finance-month-command-head')).toHaveCount(0);
  await expect(page.locator('.finance-dashboard')).toHaveCount(0);
  await expect(page.locator('#financial-integrity-panel')).toHaveCount(0);

  await page.getByRole('button', { name: 'Fechamento', exact: true }).click();
  await expect(page.locator('.finance-month-command-head')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Fechamento mensal', exact: true })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Contas a pagar e receber', exact: true })
  ).toHaveCount(0);
});

test('weekly order revenue adds channel totals and delivery fees', async ({ page }) => {
  const database = await mockOnlineDatabase(page);
  database.state = {
    orders: [
      { id: 'weekly-order', menuKey: '2026-08-semana-1', amount: '8900.00' },
    ],
    channelReceipts: [
      {
        id: 'weekly-channels',
        date: '2026-08-05',
        cardapioWebNet: '18552.21',
        cardapioWebDeliveryFee: '664.96',
      },
      {
        id: 'outside-week',
        date: '2026-08-12',
        cardapioWebNet: '999.00',
        cardapioWebDeliveryFee: '99.00',
      },
    ],
  };

  await page.goto('/relatorios?ano=2026&mes=8');
  await page.locator('.report-filter-menu').click();
  const reportFilter = page.locator('#report-filter-form');
  await reportFilter.locator('select[name="type"]').selectOption('week');
  await reportFilter.locator('input[name="start"]').fill('2026-08-03');
  await reportFilter.locator('input[name="end"]').fill('2026-08-09');
  await reportFilter.locator('select[name="week"]').selectOption('1');
  await reportFilter.getByRole('button', { name: 'Atualizar', exact: true }).click();

  const revenue = page.locator('.report-grid .report-metric').filter({
    hasText: 'Receita de pedidos',
  });
  await expect(revenue).toContainText('R$ 19.217,17');
});

test('closed July can be reopened from the monthly closing panel', async ({ page }) => {
  const database = await mockOnlineDatabase(page);
  database.state = {
    monthlyClosings: {
      '2026-07': {
        id: '2026-07-closing',
        periodKey: '2026-07',
        locked: true,
        closedAt: '2026-08-01T12:00:00.000Z',
        closedBy: 'Raquel',
        availableForWithdrawal: 1000,
        suggestedWithdrawal: { savings: 100, vanessa: 630, raquel: 270 },
      },
    },
  };
  let reopenRequest = null;
  await page.route('**/api/closings/reopen', async (route) => {
    reopenRequest = JSON.parse(route.request().postData() || '{}');
    const reopenedClosing = {
      ...database.state.monthlyClosings['2026-07'],
      locked: false,
      reopenedAt: '2026-08-07T12:00:00.000Z',
      reopenReason: reopenRequest.reason,
    };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        database: true,
        saved: true,
        key: '2026-07',
        closing: reopenedClosing,
      }),
    });
  });
  await page.goto('/financeiro?view=closing&ano=2026&mes=7');
  await expect(page.getByRole('heading', { name: 'Fechamento mensal', exact: true })).toBeVisible();
  await expect(page.locator('#close-month')).toHaveCount(0);
  await page.getByRole('button', { name: 'Reabrir mês', exact: true }).click();
  const reopenForm = page.locator('#reopen-month-form');
  await expect(reopenForm).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await reopenForm.locator('input[name="reason"]').fill('Correção do fechamento de julho');
  await reopenForm.getByRole('button', { name: 'Confirmar reabertura', exact: true }).click();

  await expect
    .poll(() => reopenRequest)
    .toEqual({
      type: 'month',
      key: '2026-07',
      reason: 'Correção do fechamento de julho',
    });
  await expect(page.locator('.closing-record')).toContainText('StatusDestravado');
  await expect(page.getByRole('button', { name: 'Fechar novamente', exact: true })).toBeVisible();
  await expect(page.locator('.closing-record')).toContainText(
    'Motivo da reaberturaCorreção do fechamento de julho'
  );
  await expectNoHorizontalOverflow(page);
});

test('grouped navigation opens the menu and saves new orders', async ({ page }, testInfo) => {
  const database = await mockOnlineDatabase(page);
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  database.state = {
    weeklyMenusByPeriod: {
      '2026-08-semana-1': [
        {
          slot: 1,
          dish: 'Cumbuca teste',
          cost: '10.00',
          ingredients: [],
          status: 'planejado',
          notes: '',
        },
      ],
    },
    menuWeek: 1,
    menuPeriod: { year: 2026, month: 8 },
    menuDatesByPeriod: {},
    clients: [
      {
        name: 'Cliente teste',
        phone: '85999999999',
        plan: 'semanal',
        weeklyDeliveryFee: '5.00',
      },
    ],
    orders: [],
  };

  await page.goto('/pedidos?ano=2026&mes=8&semana=1');
  const navigation = page.locator('nav.nav');
  await expect(navigation.getByRole('link', { name: 'Semanal', exact: true })).toHaveCount(1);
  await expect(navigation.getByRole('link', { name: 'Semanal', exact: true })).toHaveClass(
    /active/
  );

  await page.locator('[data-order-tab="form"]').click();
  const orderForm = page.locator('#order-form');
  await orderForm.locator('select[name="clientPhone"]').selectOption('85999999999');
  await orderForm.locator('input[name="dish-1"]').fill('2');
  await orderForm.locator('input[name="orderValue"]').fill('40,00');
  await orderForm.getByRole('button', { name: 'Salvar pedido', exact: true }).click();

  await expect.poll(() => database.state.orders?.[0]?.amount).toBe(40);
  expect(database.state.orders[0]).toMatchObject({
    menuKey: '2026-08-semana-1',
    clientPhone: '85999999999',
    dishes: [{ slot: 1, quantity: 2 }],
    amount: 40,
  });
  await expect(page.locator('[data-order-tab="orders"]')).toHaveClass(/active/);
  await expect(page.getByText('Cliente teste', { exact: true }).first()).toBeVisible();
  expect(pageErrors).toEqual([]);
  await expectNoHorizontalOverflow(page);
  await page.screenshot({
    path: testInfo.outputPath(`menu-order-saved-${testInfo.project.name}.png`),
    fullPage: true,
  });

  await page.goto('/pedidos?ano=2026&mes=8&semana=1');
  await expect(page).toHaveURL(/\/pedidos\?ano=2026&mes=8&semana=1$/);
  await expect(navigation.getByRole('link', { name: 'Semanal', exact: true })).toHaveClass(
    /active/
  );
});

test('operation menu exposes Semanal, Loja and Precificação while expenses stays separate', async ({
  page,
}) => {
  const database = await mockOnlineDatabase(page);
  database.state = {
    weeklyMenusByPeriod: {
      '2026-08-semana-1': [
        {
          slot: 1,
          dish: 'Cumbuca teste',
          dishCost: 12,
          status: 'planejado',
          notes: '',
        },
      ],
    },
    menuWeek: 1,
    menuPeriod: { year: 2026, month: 8 },
    menuDatesByPeriod: {},
    clients: [],
    orders: [],
    cashEntries: [
      {
        id: 'expense-navigation',
        date: '2026-08-01',
        type: 'expense',
        category: 'aluguel',
        description: 'Despesa operacional teste',
        amount: '100.00',
        cashAccount: 'pj',
      },
      {
        id: 'income-navigation',
        date: '2026-08-01',
        type: 'income',
        category: 'venda',
        description: 'Venda que não é despesa',
        amount: '250.00',
        cashAccount: 'pj',
      },
    ],
  };

  await page.goto('/home');
  const navigation = page.locator('nav.nav');
  const navigateFromMenu = async (label) => {
    const directLink = navigation.getByRole('link', { name: label, exact: true });
    if (await directLink.isVisible()) {
      await directLink.click();
      return;
    }
    await navigation.getByRole('link', { name: 'Mais ferramentas', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'Mais ferramentas', exact: true })
    ).toBeVisible();
    await page
      .locator('.quick-actions a')
      .filter({ has: page.getByText(label, { exact: true }) })
      .click();
  };
  await expect.poll(() => database.stateGetCount).toBe(1);
  await page.evaluate(() => {
    window.__cumbucaNavigationMarker = 'preserved';
  });
  const operationLinks = await navigation
    .locator('.nav-section-label', { hasText: 'Operação' })
    .evaluate((label) => {
      const links = [];
      let sibling = label.nextElementSibling;
      while (sibling && !sibling.classList.contains('nav-section-label')) {
        if (sibling.tagName === 'A') {
          links.push({ label: sibling.textContent.trim(), href: sibling.getAttribute('href') });
        }
        sibling = sibling.nextElementSibling;
      }
      return links;
    });
  expect(operationLinks).toEqual([
    { label: '▤ Semanal', href: '/pedidos' },
    { label: '↗ Loja', href: '/loja?view=sales' },
    { label: '% Precificação', href: '/precificacao' },
  ]);

  await navigation.getByRole('link', { name: 'Semanal', exact: true }).click();
  await expect(page).toHaveURL(/\/pedidos$/);
  await expect(page.locator('#page-title')).toHaveText('Semanal');
  await expect(page.locator('[data-order-tab="orders"]')).toHaveClass(/active/);
  await expect(page.getByRole('heading', { name: 'Pedidos', exact: true })).toBeVisible();

  await navigation.getByRole('link', { name: 'Loja', exact: true }).click();
  await expect(page).toHaveURL(/\/loja\?view=sales$/);
  await expect(page.locator('#page-title')).toHaveText('Loja');

  await navigation.getByRole('link', { name: 'Precificação', exact: true }).click();
  await expect(page).toHaveURL(/\/precificacao$/);
  await expect(page.locator('#page-title')).toHaveText('Precificação');

  await navigateFromMenu('Despesas');
  await expect(page).toHaveURL(/\/despesas$/);
  await expect(page.locator('#page-title')).toHaveText('Despesas');
  await expect(page.getByRole('heading', { name: 'Nova despesa', exact: true })).toBeVisible();
  await expect(page.locator('#cash-form input[name="type"]')).toHaveValue('expense');
  await expect(page.locator('#cash-type')).toHaveValue('expense');
  await expect(page.locator('#cash-employee-field')).toBeHidden();

  await page.getByRole('button', { name: 'Despesas lançadas', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Despesas lançadas', exact: true })).toBeVisible();
  await expect(page.getByText('Despesa operacional teste', { exact: true })).toBeVisible();
  await expect(page.getByText('Venda que não é despesa', { exact: true })).toHaveCount(0);

  await navigateFromMenu('Financeiro');
  await expect(page).toHaveURL(/\/financeiro$/);
  await page.getByRole('button', { name: 'Planejamento', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Orçamento mensal por categoria', exact: true })
  ).toBeVisible();

  await navigateFromMenu('Manutenção');
  await expect(page).toHaveURL(/\/backups$/);
  await expect(page.locator('#page-title')).toHaveText('Manutenção');
  await expect.poll(() => database.stateGetCount).toBe(1);
  expect(await page.evaluate(() => window.__cumbucaNavigationMarker)).toBe('preserved');
});

test('monthly orders allow manual fees and only account for entered values', async ({ page }) => {
  const database = await mockOnlineDatabase(page);
  database.state = {
    weeklyMenusByPeriod: {
      '2026-08-semana-1': [
        {
          slot: 1,
          dish: 'Cumbuca mensal',
          cost: '10.00',
          ingredients: [],
          status: 'planejado',
          notes: '',
        },
      ],
    },
    menuWeek: 1,
    menuPeriod: { year: 2026, month: 8 },
    menuDatesByPeriod: {},
    clients: [
      {
        name: 'Cliente mensalista',
        phone: '85888888888',
        plan: 'mensalista',
        monthlyQuantity: '10',
      },
    ],
    orders: [],
  };

  await page.goto('/menu-semanal?ano=2026&mes=8&semana=1');
  await page.locator('#order-toggle').click();
  await page.locator('[data-order-tab="form"]').click();
  const orderForm = page.locator('#order-form');
  await orderForm.locator('select[name="clientPhone"]').selectOption('85888888888');
  await expect(orderForm.locator('#order-value-fields')).toBeVisible();
  await expect(orderForm.locator('input[name="orderValue"]')).toBeEnabled();
  await expect(orderForm.locator('input[name="orderValue"]')).not.toHaveAttribute('required', '');
  await expect(orderForm.locator('#order-value-label')).toHaveText('Mensalidade recebida');
  await expect(orderForm.locator('#order-value-hint')).toBeVisible();
  await expect(orderForm.locator('#order-delivery-fee-field')).toBeHidden();
  await orderForm.locator('input[name="dish-1"]').fill('2');
  await orderForm.getByRole('button', { name: 'Salvar pedido', exact: true }).click();

  await expect.poll(() => database.state.orders?.length || 0).toBe(1);
  expect(database.state.orders[0]).toMatchObject({
    clientPhone: '85888888888',
    amount: 0,
    paid: false,
    paidAmount: 0,
  });
  await expect(page.getByText('Mensalidade não paga', { exact: true }).first()).toBeVisible();

  await page.locator('[data-edit-order]').first().click();
  await expect(orderForm.locator('input[name="orderValue"]')).toHaveValue('');
  await orderForm.locator('input[name="orderValue"]').fill('37,50');
  await orderForm.getByRole('button', { name: 'Salvar edição', exact: true }).click();

  await expect.poll(() => database.state.orders?.[0]?.amount).toBe(37.5);
  expect(database.state.orders[0]).toMatchObject({
    clientPhone: '85888888888',
    amount: 37.5,
    paid: true,
    paidAmount: 37.5,
  });
  await expect(page.getByText('Mensalidade paga', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('R$ 37,50', { exact: true }).first()).toBeVisible();
});

test('monthly client balance decreases with orders and warns at five remaining', async ({
  page,
}) => {
  const database = await mockOnlineDatabase(page);
  database.state = {
    weeklyMenusByPeriod: {
      '2026-08-semana-1': [
        {
          slot: 1,
          dish: 'Cumbuca mensal',
          cost: '10.00',
          ingredients: [],
          status: 'planejado',
          notes: '',
        },
      ],
    },
    menuWeek: 1,
    menuPeriod: { year: 2026, month: 8 },
    menuDatesByPeriod: {},
    clients: [
      {
        name: 'Cliente mensalista',
        phone: '85888888888',
        plan: 'mensalista',
        monthlyQuantity: '6',
      },
    ],
    orders: [],
  };

  await page.goto('/menu-semanal?ano=2026&mes=8&semana=1');
  await page.locator('#order-toggle').click();
  await page.locator('[data-order-tab="form"]').click();
  const orderForm = page.locator('#order-form');
  await orderForm.locator('select[name="clientPhone"]').selectOption('85888888888');
  await orderForm.locator('input[name="dish-1"]').fill('1');

  let warningMessage = '';
  page.once('dialog', async (dialog) => {
    warningMessage = dialog.message();
    await dialog.accept();
  });
  await orderForm.getByRole('button', { name: 'Salvar pedido', exact: true }).click();

  await expect.poll(() => database.state.orders?.length).toBe(1);
  expect(database.state.orders[0].dishes).toEqual([{ slot: 1, quantity: 1 }]);
  expect(warningMessage).toContain('restam 5 cumbuca(s)');
  expect(warningMessage).toContain('Renovar quantidade');

  await page.locator('#client-toggle').click();
  await page.locator('[data-client-tab="list"]').click();
  const clientRow = page.locator('[data-client-row="0"]');
  await expect(clientRow).toContainText('5 restantes');
  await expect(clientRow).toContainText('Renovar em breve');
});

test('monthly balance includes orders from other weeks while editing', async ({ page }) => {
  const database = await mockOnlineDatabase(page);
  database.state = {
    weeklyMenusByPeriod: {
      '2026-08-semana-1': [
        { slot: 1, dish: 'Cumbuca 1', cost: '10.00', ingredients: [], status: 'planejado' },
      ],
      '2026-08-semana-2': [
        { slot: 1, dish: 'Cumbuca 2', cost: '10.00', ingredients: [], status: 'planejado' },
      ],
    },
    menuWeek: 2,
    menuPeriod: { year: 2026, month: 8 },
    menuDatesByPeriod: {},
    clients: [
      {
        name: 'Océlio Fernandes',
        phone: '85988254630',
        plan: 'mensalista',
        monthlyQuantity: '25',
      },
    ],
    orders: [
      {
        id: 1001,
        menuKey: '2026-08-semana-1',
        clientPhone: '85988254630',
        dishes: [{ slot: 1, quantity: 5 }],
        amount: 0,
      },
      {
        id: 1002,
        menuKey: '2026-08-semana-2',
        clientPhone: '85988254630',
        dishes: [{ slot: 1, quantity: 5 }],
        amount: 0,
      },
    ],
  };

  await page.goto('/menu-semanal?ano=2026&mes=8&semana=2');
  await page.locator('#order-toggle').click();
  await page.locator('[data-order-tab="orders"]').click();
  await page.locator('[data-edit-order="1002"]').first().click();

  const orderForm = page.locator('#order-form');
  await expect(orderForm.locator('select[name="clientPhone"] option:checked')).toContainText(
    'restam 15'
  );
  await expect(orderForm.locator('select[name="clientPhone"] option:checked')).not.toContainText(
    'restam 20'
  );

  await orderForm.locator('input[name="dish-1"]').fill('6');
  await orderForm.getByRole('button', { name: 'Salvar edição', exact: true }).click();
  await expect
    .poll(() => database.state.orders?.find((order) => order.id === 1002)?.dishes[0].quantity)
    .toBe(6);

  await page.locator('#client-toggle').click();
  await page.locator('[data-client-tab="list"]').click();
  await expect(page.locator('[data-client-row="0"]')).toContainText('14 restantes');
});

test('monthly payment covers orders in later weeks while paid units remain', async ({ page }) => {
  const database = await mockOnlineDatabase(page);
  database.state = {
    weeklyMenusByPeriod: {
      '2026-08-semana-2': [
        { slot: 1, dish: 'Cumbuca semanal', cost: '10.00', ingredients: [], status: 'planejado' },
      ],
    },
    menuWeek: 2,
    menuPeriod: { year: 2026, month: 8 },
    menuDatesByPeriod: {},
    clients: [
      {
        name: 'Thamires',
        phone: '85999999999',
        plan: 'mensalista',
        monthlyQuantity: '20',
      },
    ],
    orders: [
      {
        id: 2001,
        menuKey: '2026-08-semana-1',
        clientPhone: '85999999999',
        dishes: [{ slot: 1, quantity: 5 }],
        amount: 400,
        paid: true,
        paidAmount: 400,
        createdAt: '2026-08-06T12:00:00.000Z',
      },
      {
        id: 2002,
        menuKey: '2026-08-semana-2',
        clientPhone: '85999999999',
        dishes: [{ slot: 1, quantity: 5 }],
        amount: 0,
        paid: false,
        paidAmount: 0,
        createdAt: '2026-08-13T12:00:00.000Z',
      },
    ],
  };

  await page.goto('/menu-semanal?ano=2026&mes=8&semana=2');
  await page.locator('#order-toggle').click();
  await page.locator('[data-order-tab="orders"]').click();
  await expect(page.getByText('Mensalidade paga', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Mensalidade não paga', { exact: true })).toHaveCount(0);
});

test('monthly clients renew quantities manually and choose whether to launch the fee', async ({
  page,
}, testInfo) => {
  const database = await mockOnlineDatabase(page);
  database.state = {
    weeklyMenusByPeriod: {
      '2026-08-semana-1': [
        {
          slot: 1,
          dish: 'Cumbuca mensal',
          cost: '10.00',
          ingredients: [],
          status: 'planejado',
          notes: '',
        },
      ],
    },
    menuWeek: 1,
    menuPeriod: { year: 2026, month: 8 },
    menuDatesByPeriod: {},
    clients: [
      {
        name: 'Cliente mensalista',
        phone: '85888888888',
        plan: 'mensalista',
        monthlyQuantity: '10',
      },
    ],
    orders: [
      {
        id: 'monthly-order-exhausted',
        menuKey: '2026-08-semana-1',
        clientPhone: '85888888888',
        dishes: [{ slot: 1, quantity: 10 }],
        amount: 0,
        paid: false,
        paidAmount: 0,
      },
    ],
  };

  await page.goto('/menu-semanal?ano=2026&mes=8&semana=1');
  await page.locator('#order-toggle').click();
  await page.locator('[data-order-tab="form"]').click();
  const orderForm = page.locator('#order-form');
  await orderForm.locator('select[name="clientPhone"]').selectOption('85888888888');
  await orderForm.locator('input[name="dish-1"]').fill('1');
  let blockedOrderMessage = '';
  page.once('dialog', async (dialog) => {
    blockedOrderMessage = dialog.message();
    await dialog.accept();
  });
  await orderForm.getByRole('button', { name: 'Salvar pedido', exact: true }).click();
  expect(blockedOrderMessage).toContain('Saldo insuficiente');
  expect(blockedOrderMessage).toContain('Renovar quantidade');
  expect(database.state.orders).toHaveLength(1);

  await page.locator('#client-toggle').click();
  await page.locator('[data-client-tab="list"]').click();
  const clientRow = page.locator('[data-client-row="0"]');
  await expect(clientRow).toContainText('0 restantes');
  await clientRow.getByRole('button', { name: 'Renovar quantidade', exact: true }).click();

  let renewalForm = page.locator('#monthly-renewal-form');
  await expect(renewalForm).toBeVisible();
  await expect(renewalForm.locator('input[name="renewalQuantity"]')).toHaveValue('10');
  await expect(renewalForm.locator('[data-renewal-value-field]')).toBeHidden();
  await renewalForm.locator('input[name="renewalQuantity"]').fill('12');
  await renewalForm.getByRole('button', { name: 'Confirmar renovação', exact: true }).click();

  await expect.poll(() => database.state.orders?.length).toBe(2);
  expect(database.state.orders[1]).toMatchObject({
    clientPhone: '85888888888',
    monthlyRenewal: true,
    renewalQuantity: 12,
    amount: 0,
    paid: false,
    paidAmount: 0,
  });
  await expect(page.locator('[data-client-row="0"]')).toContainText('12 restantes');
  await expect(page.locator('[data-client-row="0"]')).toContainText('22 liberadas no mês');

  await page
    .locator('[data-client-row="0"]')
    .getByRole('button', { name: 'Renovar quantidade', exact: true })
    .click();
  renewalForm = page.locator('#monthly-renewal-form');
  await renewalForm.locator('input[name="renewalQuantity"]').fill('8');
  await renewalForm.locator('[data-renewal-payment-toggle]').check();
  await expect(renewalForm.locator('[data-renewal-value-field]')).toBeVisible();
  await renewalForm.locator('input[name="monthlyFeeAmount"]').fill('80,00');
  await expectNoHorizontalOverflow(page);
  await page.screenshot({
    path: testInfo.outputPath(`monthly-client-renewal-form-${testInfo.project.name}.png`),
    fullPage: true,
  });
  await renewalForm.getByRole('button', { name: 'Confirmar renovação', exact: true }).click();

  await expect.poll(() => database.state.orders?.length).toBe(3);
  expect(database.state.orders[2]).toMatchObject({
    clientPhone: '85888888888',
    monthlyRenewal: true,
    renewalQuantity: 8,
    amount: 80,
    paid: true,
    paidAmount: 80,
  });
  await expect(page.locator('[data-client-row="0"]')).toContainText('20 restantes');
  await expect(page.locator('[data-client-row="0"]')).toContainText('30 liberadas no mês');
  await expectNoHorizontalOverflow(page);
  await page.screenshot({
    path: testInfo.outputPath(`monthly-client-renewal-${testInfo.project.name}.png`),
    fullPage: true,
  });
});

test('menu planning divides the manual weekly supermarket total only by its menu orders', async ({
  page,
}, testInfo) => {
  const database = await mockOnlineDatabase(page);
  database.state = {
    pricingConfig: {
      sharedCosts: {
        averageMonthlyUnits: 100,
        gas: 100,
        energy: 100,
        staff: [{ id: 'staff-1', name: 'Equipe', salary: 500 }],
        rent: 200,
        accountant: 100,
        telephony: 0,
        marketing: 0,
        extraordinary: 0,
      },
    },
    weeklyMenusByPeriod: {},
    weeklyMenuSupermarketCostsByPeriod: {
      '2026-08-semana-1': '30.00',
    },
    menuWeek: 1,
    menuPeriod: { year: 2026, month: 8 },
    menuDatesByPeriod: {},
    clients: [{ name: 'Cliente teste', phone: '85999999999', plan: 'semanal' }],
    orders: [
      {
        id: 'order-pricing-source',
        menuKey: '2026-08-semana-1',
        clientPhone: '85999999999',
        dishes: [{ slot: 1, quantity: 2 }],
        amount: 50,
        deliveryFee: 0,
        paid: true,
        createdAt: '2026-08-03T12:00:00.000Z',
      },
    ],
    cashEntries: [
      {
        id: 'supermarket-expense',
        date: '2026-08-02',
        type: 'expense',
        category: 'supermercado',
        amount: '24.00',
      },
      {
        id: 'supermarket-income',
        date: '2026-08-03',
        type: 'income',
        category: 'supermercado',
        amount: '4.00',
      },
    ],
    storeSales: [
      {
        id: 'store-sales-outside-menu',
        date: '2026-08-03',
        quantity: 8,
      },
    ],
  };

  await page.goto('/menu-semanal?ano=2026&mes=8&semana=1');
  await page.locator('#planning-toggle').click();
  await expect(page.locator('.menu-pricing-source')).toContainText(
    'Cadastre os custos do menu diretamente no Planejamento'
  );
  await expect(
    page.getByRole('link', { name: 'Configurar outros custos rateados', exact: true })
  ).toHaveAttribute('href', '/precificacao?view=costs');
  await expect(page.locator('.menu-pricing-source')).toContainText(
    'dividido somente pelas 2 cumbuca(s) pedida(s) neste menu, ficando R$ 15,00 por unidade'
  );
  await expect(page.locator('[data-menu-weekly-supermarket-total]')).toHaveValue('30,00');
  await expect(page.locator('[data-menu-supermarket-quantity]')).toHaveText('2');
  await expect(page.locator('[data-menu-supermarket-unit]')).toHaveText('R$ 15,00');
  await expect(page.locator('[data-menu-packaging="0"]')).toHaveValue('1,60');
  await expect(page.locator('[data-menu-profit-percent="0"]')).toHaveValue('30,00');
  await expect(page.locator('[data-menu-supermarket-cost="0"]')).toHaveCount(0);

  await page.locator('[data-menu-dish="0"]').fill('Cumbuca da semana');
  await page.locator('[data-menu-dish-cost="0"]').fill('5,00');
  await expect(page.locator('[data-ingredient-row][data-menu-index="0"]')).toHaveCount(0);

  const breakdown = page.locator('[data-menu-cost-breakdown="0"]');
  await expect(breakdown.locator('[data-menu-dish-cost-value]')).toHaveText('R$ 5,00');
  await expect(breakdown.locator('[data-menu-supermarket-rate]')).toHaveText('R$ 15,00');
  await expect(breakdown.locator('[data-menu-shared-cost]')).toHaveText('R$ 10,00');
  await expect(breakdown.locator('[data-menu-packaging-cost]')).toHaveText('R$ 1,60');
  await expect(breakdown.locator('[data-menu-total-cost]')).toHaveText('R$ 31,60');
  await expect(breakdown.locator('[data-menu-profit-label]')).toHaveText('Lucro (30%)');
  await expect(breakdown.locator('[data-menu-profit]')).toHaveText('R$ 9,48');
  await expect(breakdown.locator('[data-menu-suggested-price]')).toHaveText('R$ 41,08');
  await expect(page.locator('[data-menu-weekly-cost]')).toHaveText('R$ 63,20');
  await expect(page.locator('[data-menu-weekly-quantity]')).toHaveText('2 cumbuca(s) pedida(s)');

  await page.locator('[data-menu-weekly-supermarket-total]').fill('40,00');
  await expect(page.locator('[data-menu-supermarket-unit]')).toHaveText('R$ 20,00');
  await expect(breakdown.locator('[data-menu-supermarket-rate]')).toHaveText('R$ 20,00');
  await expect(breakdown.locator('[data-menu-total-cost]')).toHaveText('R$ 36,60');
  await expect(page.locator('[data-menu-weekly-cost]')).toHaveText('R$ 73,20');
  await expectNoHorizontalOverflow(page);
  await page.screenshot({
    path: testInfo.outputPath(`menu-planning-profit-${testInfo.project.name}.png`),
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Salvar menu', exact: true }).click();

  await expect
    .poll(() => database.state.weeklyMenusByPeriod?.['2026-08-semana-1']?.[0]?.dish)
    .toBe('Cumbuca da semana');
  expect(database.state.weeklyMenuSupermarketCostsByPeriod).toMatchObject({
    '2026-08-semana-1': '40.00',
  });
  expect(database.state.weeklyMenusByPeriod['2026-08-semana-1'][0]).toMatchObject({
    dish: 'Cumbuca da semana',
    dishCost: '5.00',
    sharedCost: '10.00',
    packagingCost: '1.60',
    profitPercent: '30.00',
    cost: '36.60',
    profit: '10.98',
    suggestedPrice: '47.58',
  });
  expect(database.state.weeklyMenusByPeriod['2026-08-semana-1'][0]).not.toHaveProperty(
    'supermarketCost'
  );

  await page.goto('/relatorios?ano=2026&mes=8');
  await page.getByRole('button', { name: 'Rentabilidade', exact: true }).click();
  const profitability = page.locator('[data-profitability-panel]');
  await expect(profitability).toContainText(
    'A receita considera R$ 19,50 por cumbuca. O custo considera somente todo o supermercado informado mais R$ 1,60 de vasilha por unidade.'
  );
  await expect(
    profitability.locator('.metric').filter({ hasText: 'Receita considerada' })
  ).toContainText('R$ 39,00');
  await expect(
    profitability.locator('.metric').filter({ hasText: 'Custo total considerado' })
  ).toContainText('R$ 43,20');
  await expect(
    profitability.locator('.metric').filter({ hasText: 'Supermercado informado' })
  ).toContainText('R$ 40,00');
  await expect(
    profitability.locator('.metric').filter({ hasText: 'Supermercado por cumbuca' })
  ).toContainText('R$ 20,00');
  await expect(profitability.getByText('Vasilhas', { exact: true }).locator('..')).toContainText(
    'R$ 3,20'
  );
  await expect(profitability.locator('tbody tr').first()).toContainText('Cumbuca da semana');
  await expect(profitability.locator('tbody tr').first()).toContainText(
    'Supermercado da semana + vasilha R$ 1,60'
  );
  await expect(profitability.locator('tbody tr').first()).toContainText('R$ 19,50');
  await expect(profitability.locator('tbody tr').first()).toContainText('R$ 43,20');

  await page.locator('.report-filter-menu').click();
  const reportFilter = page.locator('#report-filter-form');
  await reportFilter.locator('select[name="type"]').selectOption('week');
  await reportFilter.locator('input[name="start"]').fill('2026-08-03');
  await reportFilter.locator('input[name="end"]').fill('2026-08-09');
  await reportFilter.locator('select[name="week"]').selectOption('1');
  await reportFilter.getByRole('button', { name: 'Atualizar', exact: true }).click();
  await page.getByRole('button', { name: 'Resultado da semana', exact: true }).click();
  const weeklyResult = page.locator('[data-weekly-result-panel]');
  await expect(weeklyResult).toContainText('03/08/2026 a 09/08/2026');
  await expect(weeklyResult).toContainText('R$ 50,00');
  await expect(page.getByRole('heading', { name: 'Loja × Semanal', exact: true })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Mais vendidos na semana', exact: true })
  ).toBeVisible();
  const weeklyTargets = page.locator('#weekly-targets-form');
  await weeklyTargets.locator('input[name="revenue"]').fill('100');
  await weeklyTargets.locator('input[name="profit"]').fill('20');
  await weeklyTargets.getByRole('button', { name: 'Salvar metas', exact: true }).click();
  await expect
    .poll(() => database.state.financialPlanning?.weeklyTargets)
    .toMatchObject({
      '2026-08-03_2026-08-09': expect.objectContaining({ revenue: 100, profit: 20 }),
    });
  await expect(page.getByRole('heading', { name: 'Contas da próxima semana' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Conferência para fechar' })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({
    path: testInfo.outputPath(`profitability-planning-cost-${testInfo.project.name}.png`),
    fullPage: true,
  });
});

test('monthly menu summary includes each manual weekly supermarket total', async ({
  page,
}, testInfo) => {
  const database = await mockOnlineDatabase(page);
  database.state = {
    pricingConfig: { sharedCosts: { averageMonthlyUnits: 1 } },
    weeklyMenusByPeriod: {
      '2026-08-semana-1': [
        {
          slot: 1,
          dish: 'Moqueca de peixe',
          dishCost: '9.50',
          ingredients: [{ name: 'Custo legado que não deve ser usado', value: '999.00' }],
          ingredientCost: '999.00',
          sharedCost: '0.00',
          packagingCost: '1.60',
          profitPercent: '30.00',
          cost: '15.36',
          status: 'pronto',
          notes: '',
        },
      ],
    },
    weeklyMenuSupermarketCostsByPeriod: {
      '2026-08-semana-1': '2408.00',
    },
    menuWeek: 1,
    menuPeriod: { year: 2026, month: 8 },
    menuDatesByPeriod: {},
    clients: [],
    orders: [
      {
        id: 'weekly-summary-order-1',
        menuKey: '2026-08-semana-1',
        clientPhone: '85111111111',
        dishes: [{ slot: 1, quantity: 100 }],
        amount: 2500,
      },
      {
        id: 'weekly-summary-order-2',
        menuKey: '2026-08-semana-1',
        clientPhone: '85222222222',
        dishes: [{ slot: 1, quantity: 75 }],
        amount: 1875,
      },
    ],
    cashEntries: [
      {
        id: 'monthly-supermarket',
        date: '2026-08-05',
        type: 'expense',
        category: 'supermercado',
        amount: '9999.00',
      },
    ],
  };

  await page.goto('/menu-semanal?ano=2026&mes=8&resumo=mes');
  const week = page.locator('[data-week-summary="1"]');
  await expect(week).toContainText('Semana 1');
  await expect(week).toContainText('Moqueca de peixe');
  await expect(week).toContainText('175');
  await expect(week).toContainText('R$ 2.408,00');
  await expect(week).toContainText('R$ 4.375,00');
  await expect(week).toContainText('R$ 1.967,00');
  await expect(page.locator('.month-summary-note')).toContainText(
    'somente o gasto total de supermercado informado em cada semana'
  );
  await expectNoHorizontalOverflow(page);
  await page.screenshot({
    path: testInfo.outputPath(`monthly-menu-week-result-${testInfo.project.name}.png`),
    fullPage: true,
  });
});

test('monthly menu catalog filters offered dishes and shows recorded costs', async ({
  page,
}, testInfo) => {
  const database = await mockOnlineDatabase(page);
  database.state = {
    pricingConfig: {
      sharedCosts: {
        averageMonthlyUnits: 100,
        rent: 100,
      },
    },
    weeklyMenusByPeriod: {
      '2026-08-semana-1': [
        {
          slot: 1,
          dish: 'Frango cremoso',
          ingredients: [
            { name: 'Arroz', value: '4.00' },
            { name: 'Frango', value: '5.00' },
          ],
          ingredientCost: '9.00',
          sharedCost: '1.00',
          packagingCost: '1.60',
          profitPercent: '30.00',
          cost: '11.60',
          status: 'pronto',
          notes: '',
        },
      ],
      '2026-08-semana-2': [
        {
          slot: 1,
          dish: 'Cumbuca vegetariana',
          ingredients: [{ name: 'Legumes', value: '8.00' }],
          ingredientCost: '8.00',
          sharedCost: '4.00',
          packagingCost: '1.60',
          profitPercent: '30.00',
          cost: '13.60',
          status: 'planejado',
          notes: '',
        },
      ],
      '2026-08-semana-3': [
        {
          slot: 2,
          dish: 'Frango cremoso',
          ingredients: [{ name: 'Frango', value: '10.00' }],
          ingredientCost: '10.00',
          sharedCost: '1.00',
          packagingCost: '1.60',
          profitPercent: '30.00',
          cost: '12.60',
          status: 'preparo',
          notes: 'Versão especial',
        },
      ],
      '2026-07-semana-1': [
        {
          slot: 1,
          dish: 'Prato de julho',
          ingredients: [{ name: 'Insumo antigo', value: '6.00' }],
          ingredientCost: '6.00',
          sharedCost: '2.00',
          packagingCost: '1.60',
          profitPercent: '30.00',
          cost: '9.60',
          status: 'pronto',
          notes: '',
        },
      ],
    },
    weeklyMenuSupermarketCostsByPeriod: {
      '2026-08-semana-1': '40.00',
      '2026-08-semana-2': '30.00',
      '2026-08-semana-3': '30.00',
    },
    menuWeek: 1,
    menuPeriod: { year: 2026, month: 8 },
    menuDatesByPeriod: {},
    clients: [],
    orders: [
      {
        id: 'catalog-order-1',
        menuKey: '2026-08-semana-1',
        dishes: [{ slot: 1, quantity: 4 }],
        totalQuantity: 4,
      },
      {
        id: 'catalog-order-2',
        menuKey: '2026-08-semana-2',
        dishes: [{ slot: 1, quantity: 3 }],
        totalQuantity: 3,
      },
      {
        id: 'catalog-order-3',
        menuKey: '2026-08-semana-3',
        dishes: [{ slot: 2, quantity: 3 }],
        totalQuantity: 3,
      },
    ],
    cashEntries: [
      {
        id: 'catalog-supermarket',
        date: '2026-08-08',
        type: 'expense',
        category: 'supermercado',
        amount: '9999.00',
      },
    ],
  };

  await page.goto('/menu-semanal?ano=2026&mes=8&catalogo=cumbucas');
  await expect(page.locator('[data-menu-catalog]')).toBeVisible();
  await expect(page.locator('[data-menu-catalog-link]')).toHaveClass(/active/);
  await expect(page.locator('[data-menu-catalog-card]')).toHaveCount(3);
  await expect(page.locator('.menu-catalog-summary')).toContainText('Disponibilizações3');
  await expect(page.locator('.menu-catalog-summary')).toContainText('Cumbucas diferentes2');
  await expect(page.locator('.menu-catalog-summary')).toContainText('R$ 12,60');
  await expect(page.locator('.menu-catalog-summary')).toContainText('R$ 3,78');
  await expect(page.getByText('Prato de julho', { exact: true })).toHaveCount(0);

  const filter = page.locator('#menu-catalog-filter');
  await filter.locator('input[name="search"]').fill('Frango');
  await filter.locator('select[name="week"]').selectOption('3');
  await filter.getByRole('button', { name: 'Filtrar', exact: true }).click();

  await expect(page.locator('[data-menu-catalog-card]')).toHaveCount(1);
  const result = page.locator('[data-menu-catalog-card]');
  await expect(result).toContainText('Semana 3');
  await expect(result).toContainText('Frango cremoso');
  await expect(result).toContainText(
    'Supermercado registrado na semana dividido pelas cumbucas vendidas na mesma semana'
  );
  await expect(result).toContainText('Supermercado por cumbuca');
  await expect(result).toContainText('R$ 10,00');
  await expect(result).toContainText('R$ 1,00');
  await expect(result).toContainText('R$ 1,60');
  await expect(result).toContainText('R$ 12,60');
  await expect(result).toContainText('R$ 3,78');
  await expect(result).toContainText('R$ 16,38');
  await expectNoHorizontalOverflow(page);
  await page.screenshot({
    path: testInfo.outputPath(`monthly-menu-catalog-${testInfo.project.name}.png`),
    fullPage: true,
  });
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

test('partner current accounts are usable without desktop or mobile clipping', async ({
  page,
}, testInfo) => {
  const database = await mockOnlineDatabase(page);
  database.state = {
    cashEntries: [],
    partnerAccounts: {
      partners: [
        { id: 'vanessa', name: 'Vanessa' },
        { id: 'raquel', name: 'Raquel' },
      ],
      movements: [
        {
          id: 'partner-opening-test',
          partnerId: 'vanessa',
          date: '2026-08-07',
          type: 'debit',
          amount: 150,
          description: 'Saldo inicial para teste',
          origin: 'other',
          observation: 'Sem movimentação de caixa',
          createdAt: '2026-08-07T12:00:00.000Z',
          updatedAt: '2026-08-07T12:00:00.000Z',
        },
      ],
      withdrawalSnapshots: [],
    },
  };

  await page.goto('/financeiro?view=partners');
  await expect(
    page.getByRole('heading', { name: 'Conta-corrente das sócias', exact: true })
  ).toBeVisible();
  const headingPosition = await page
    .getByRole('heading', { name: 'Conta-corrente das sócias', exact: true })
    .evaluate((heading) => ({
      top: heading.getBoundingClientRect().top,
      viewport: window.innerHeight,
    }));
  expect(headingPosition.top).toBeLessThan(headingPosition.viewport);
  await expect(page.locator('.partner-account-card')).toHaveCount(2);
  await expect(page.locator('.partner-account-card').first()).toContainText('R$ 150,00');
  await expect(page.locator('#partner-movement-form')).toBeVisible();
  await expect(page.locator('.partner-history-panel tbody tr')).toHaveCount(1);
  await expectNoHorizontalOverflow(page);

  const layout = await page.evaluate(() => ({
    formColumns: getComputedStyle(
      document.querySelector('.partner-movement-form')
    ).gridTemplateColumns.split(' ').length,
    cardsOverflow:
      document.querySelector('.partner-account-cards').scrollWidth -
      document.querySelector('.partner-account-cards').clientWidth,
  }));
  expect(layout.formColumns).toBe(testInfo.project.name === 'mobile' ? 1 : 3);
  expect(layout.cardsOverflow).toBeLessThanOrEqual(1);

  const screenshotPath = testInfo.outputPath('partner-current-accounts.png');
  await page.screenshot({ path: screenshotPath, fullPage: true });
  await testInfo.attach('partner-current-accounts.png', {
    path: screenshotPath,
    contentType: 'image/png',
  });
});

test('linking an existing cash entry to a partner does not move cash again', async ({ page }) => {
  const database = await mockOnlineDatabase(page);
  database.state = {
    cashEntries: [
      {
        id: 'existing-personal-expense',
        date: '2026-08-17',
        type: 'expense',
        category: 'outros',
        description: 'Presente pai',
        amount: '79.98',
        cashAccount: 'pf',
      },
    ],
    partnerAccounts: {
      partners: [
        { id: 'vanessa', name: 'Vanessa' },
        { id: 'raquel', name: 'Raquel' },
      ],
      movements: [],
      withdrawalSnapshots: [],
    },
  };

  await page.goto('/financeiro?view=partners');
  await page.locator('[data-new-partner-debit="vanessa"]').click();
  const form = page.locator('#partner-movement-form');
  await form.locator('input[name="date"]').fill('2026-08-18');
  await form.locator('input[name="description"]').fill('Presente pai');
  await form.locator('input[name="amount"]').fill('159,96');
  await form.locator('select[name="origin"]').selectOption('pf');
  await form.locator('select[name="cashMode"]').selectOption('link');
  await expect(form.locator('.partner-cash-explanation')).toContainText(
    'não cria outra entrada ou saída'
  );
  await form
    .locator('select[name="existingCashEntryId"]')
    .selectOption('existing-personal-expense');
  await form.getByRole('button', { name: 'Registrar movimentação', exact: true }).click();

  await expect.poll(() => database.state.partnerAccounts?.movements?.length).toBe(1);
  expect(database.state.cashEntries).toHaveLength(1);
  expect(database.state.cashEntries[0]).toMatchObject({
    id: 'existing-personal-expense',
    date: '2026-08-17',
    type: 'expense',
    amount: '79.98',
    cashAccount: 'pf',
  });
  expect(database.state.partnerAccounts.movements[0]).toMatchObject({
    partnerId: 'vanessa',
    date: '2026-08-17',
    amount: '79.98',
    cashEntryId: 'existing-personal-expense',
  });
});

test('future bills choose the cash account only when paid', async ({ page }) => {
  const database = await mockOnlineDatabase(page);
  database.state = { cashEntries: [] };
  const today = localDateKey();
  const tomorrowDate = new Date();
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrow = localDateKey(tomorrowDate);

  await page.goto('/hoje');
  const quickExpenseForm = page.locator('#today-expense-form');
  await quickExpenseForm.locator('#today-expense-category').selectOption('boleto');
  await expect(quickExpenseForm.locator('#today-expense-cash-account-field')).toBeVisible();
  await expect(quickExpenseForm.locator('#today-expense-cash-account')).toHaveValue('');
  await expect(quickExpenseForm.locator('#today-expense-cash-account')).not.toHaveAttribute(
    'required',
    ''
  );

  await page.goto('/fluxo-de-caixa');
  const cashForm = page.locator('#cash-form');
  await cashForm.locator('#cash-type').selectOption('expense');
  await cashForm.locator('#cash-category').selectOption('boleto');
  await expect(cashForm.locator('#cash-account-field')).toBeVisible();
  await expect(cashForm.locator('#cash-account')).toHaveValue('');
  await expect(cashForm.locator('#cash-account')).not.toHaveAttribute('required', '');
  await cashForm.getByLabel('Descrição', { exact: true }).fill('Boleto futuro sem conta');
  await cashForm.getByLabel('Local do boleto', { exact: true }).fill('Fornecedor Central');
  await cashForm.getByLabel('Vencimento', { exact: true }).fill(tomorrow);
  await cashForm.getByLabel('Valor', { exact: true }).fill('125,00');
  await cashForm.getByRole('button', { name: 'Adicionar', exact: true }).click();

  await expect.poll(() => database.state.cashEntries).toHaveLength(1);
  expect(database.state.cashEntries[0]).toMatchObject({
    category: 'boleto',
    billLocation: 'Fornecedor Central',
    dueDate: tomorrow,
    cashAccount: '',
    amount: '125.00',
  });
  expect(database.state.cashEntries[0].paidAt).toBeUndefined();
  expect(await page.evaluate((date) => window.accountBalanceUntilDate(date), today)).toBe(0);

  await page.getByRole('button', { name: 'Extrato', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Boletos por local', exact: true })).toBeVisible();
  await expect(page.getByText('Local: Fornecedor Central', { exact: true })).toBeVisible();
  const promptAnswers = [today, 'pj'];
  const paymentDialogs = async (dialog) => {
    if (dialog.type() === 'prompt') {
      await dialog.accept(promptAnswers.shift());
      return;
    }
    await dialog.accept();
  };
  page.on('dialog', paymentDialogs);
  await page.getByRole('button', { name: 'Marcar pago', exact: true }).click();
  page.off('dialog', paymentDialogs);

  await expect.poll(() => database.state.cashEntries[0]?.paidAt).toBeTruthy();
  expect(database.state.cashEntries[0]).toMatchObject({
    date: today,
    cashAccount: 'pj',
  });
  expect(await page.evaluate((date) => window.accountBalanceUntilDate(date), today)).toBe(-125);
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
  await expect(page.locator('.finance-dashboard')).toHaveCount(0);
  await expect(page.locator('#financial-integrity-panel')).toHaveCount(0);
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
  await expect(accountForm.locator('#financial-account-employee')).toHaveCount(0);
  await expect(accountForm.locator('#financial-account-category option')).toHaveCount(2);
  await accountForm.locator('#financial-account-category').selectOption('conta');
  await accountForm.locator('#financial-account-payment-timing').selectOption('future');
  await accountForm.getByLabel('Descrição', { exact: true }).fill('Conta fixa - teste');
  await accountForm.getByLabel('Vencimento', { exact: true }).fill(localDateKey());
  await accountForm.getByLabel('Valor total', { exact: true }).fill('200,00');
  await accountForm.getByRole('button', { name: 'Adicionar conta', exact: true }).click();
  await expect(page.locator('.account-row')).toHaveCount(1);
  expect(database.state.financialPlanning.accounts[0]).toMatchObject({
    category: 'conta',
    paymentTiming: 'future',
  });
  const fixedAccount = page.locator('.account-row');
  await fixedAccount
    .locator('form[data-account-settlement] select[name="cashAccount"]')
    .selectOption('pj');
  await fixedAccount.getByRole('button', { name: 'Registrar pagamento', exact: true }).click();

  await expect.poll(() => database.state.cashEntries?.length).toBe(2);
  expect(database.state.cashEntries[1]).toMatchObject({
    type: 'expense',
    category: 'conta',
    employeeId: '',
    cashAccount: 'pj',
    amount: '200.00',
  });
  await page.goto('/financeiro?view=employees');
  const accountUpdatedCard = page.locator('.employee-card').filter({ hasText: 'Maria Silva' });
  await expect(accountUpdatedCard).toContainText('R$ 800,00');
  await expect(accountUpdatedCard).toContainText('R$ 700,00');
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
    page.getByRole('button', { name: 'Revisar e confirmar ajuste', exact: true })
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

test('stored financial descriptions stay text instead of becoming HTML', async ({ page }) => {
  const database = await mockOnlineDatabase(page);
  const maliciousDescription = '<img src=x onerror=alert(1)> Caixa teste';
  database.state = {
    cashEntries: [
      {
        id: 'unsafe-description',
        date: '2026-08-09',
        type: 'expense',
        amount: '10.00',
        category: 'outros',
        cashAccount: 'pf',
        description: maliciousDescription,
      },
    ],
  };
  await page.goto('/fluxo-de-caixa?panel=ledger');
  const ledger = page.locator('.cash-ledger-table');
  await expect(ledger).toContainText(maliciousDescription);
  await expect.poll(() => ledger.locator('img').count()).toBe(0);
});

test('cash entry can use Cofrinho as the reserve account', async ({ page }) => {
  const database = await mockOnlineDatabase(page);
  const today = localDateKey();
  database.state = {
    cashEntries: [
      {
        id: 'cash-savings-pf-opening',
        date: today,
        description: 'Saldo PF',
        type: 'income',
        category: 'venda',
        cashAccount: 'pf',
        amount: '100.00',
      },
      {
        id: 'cash-savings-pj-opening',
        date: today,
        description: 'Saldo PJ',
        type: 'income',
        category: 'venda',
        cashAccount: 'pj',
        amount: '50.00',
      },
    ],
    financialPlanning: {
      savings: '200.00',
      savingsExpectedBalance: '200.00',
      savingsHistory: [
        {
          id: 'cash-savings-opening',
          date: today,
          type: 'set',
          amount: '200.00',
          balance: '200.00',
          description: 'Saldo inicial do Cofrinho',
        },
      ],
    },
  };

  await page.goto('/fluxo-de-caixa?panel=entry');
  const form = page.locator('#cash-form');
  await page.locator('#cash-type').selectOption('expense');
  await expect(form.locator('select[name="cashAccount"] option[value="savings"]')).toHaveText(
    'Conta Cofrinho'
  );
  await page.goto('/financeiro?view=accounts');
  await expect(page.locator('#financial-account-cash-account option[value="savings"]')).toHaveText(
    'Conta Cofrinho'
  );
  await page.goto('/fluxo-de-caixa?panel=reconciliation');
  await expect(page.locator('#daily-reconciliation-account option[value="savings"]')).toHaveText(
    'Conta Cofrinho'
  );
  await page.goto('/fluxo-de-caixa?panel=entry');
  await page.locator('#cash-type').selectOption('expense');
  await form.locator('input[name="description"]').fill('Compra paga pela reserva');
  await form.locator('select[name="category"]').selectOption('outros');
  await form.locator('select[name="cashAccount"]').selectOption('savings');
  await form.locator('input[name="amount"]').fill('240,00');
  await form.getByRole('button', { name: 'Adicionar', exact: true }).click();

  await expect.poll(() => database.state.financialPlanning?.savings).toBe('-40.00');
  const savingsCashEntry = database.state.cashEntries.find(
    (entry) => entry.description === 'Compra paga pela reserva'
  );
  expect(savingsCashEntry).toMatchObject({
    type: 'expense',
    cashAccount: 'savings',
    amount: '240.00',
  });
  expect(
    database.state.financialPlanning.savingsHistory.find(
      (entry) => entry.cashEntryId === String(savingsCashEntry.id)
    )
  ).toMatchObject({
    type: 'withdrawal',
    amount: '240.00',
    cashAccountMovement: true,
  });
  await expect(page.locator('[data-cash-account-summary="pf"]')).toContainText('R$ 100,00');
  await expect(page.locator('[data-cash-account-summary="pj"]')).toContainText('R$ 50,00');
  await expect(page.locator('[data-cash-account-summary="savings"]')).toContainText('-R$ 40,00');
  await expect(page.locator('.cash-hero > div:first-child')).toContainText('R$ 110,00');
  await page.goto('/fluxo-de-caixa?panel=ledger');
  await expect(page.locator('.cash-ledger-table')).toContainText('Compra paga pela reserva');
  await page.locator('.cash-filter-disclosure').evaluate((element) => {
    element.open = true;
  });
  const ledgerFilter = page.locator('#cash-filter-form');
  await ledgerFilter.locator('select[name="period"]').selectOption('day');
  await ledgerFilter.locator('input[name="date"]').fill(today);
  await ledgerFilter.locator('select[name="cashAccount"]').selectOption('savings');
  await ledgerFilter.getByRole('button', { name: 'Aplicar', exact: true }).click();
  const savingsLedger = page.locator('.cash-ledger-table');
  await expect(savingsLedger).toContainText('Saldo inicial do Cofrinho');
  await expect(savingsLedger).toContainText('Compra paga pela reserva');
  await expect(savingsLedger.locator('tr', { hasText: 'Saldo inicial do Cofrinho' })).toContainText(
    'Conta Cofrinho'
  );
  await page.goto('/fluxo-de-caixa?panel=savings');
  const savingsForm = page.locator('#savings-form');
  await savingsForm.locator('input[name="balance"]').fill('500,00');
  await savingsForm.locator('input[name="expectedBalance"]').fill('500,00');
  await savingsForm.locator('input[name="description"]').fill('Conferência final do Cofrinho');
  await savingsForm.getByRole('button', { name: 'Salvar cofrinho', exact: true }).click();
  await expect.poll(() => database.state.financialPlanning?.savings).toBe('500.00');
  await expect(page.locator('[data-cash-account-summary="savings"]')).toContainText('R$ 500,00');
  await expectNoHorizontalOverflow(page);
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
    financialPlanning: {
      savings: '80.00',
      savingsExpectedBalance: '80.00',
      savingsHistory: [
        {
          id: 'cash-ledger-savings-opening',
          date: today,
          type: 'set',
          amount: '80.00',
          balance: '80.00',
          description: 'Saldo inicial do Cofrinho',
        },
      ],
    },
  };
  await page.goto('/fluxo-de-caixa?panel=ledger');
  await expect(page.getByRole('heading', { name: 'Extrato', exact: true })).toBeVisible();
  const ledgerDescriptions = async () =>
    (await page.locator('.cash-ledger-table tbody tr td:nth-child(2)').allTextContents()).map(
      (description) => description.trim()
    );
  const descriptions = await ledgerDescriptions();
  expect(descriptions).toEqual([
    'Saldo inicial do Cofrinho',
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
      'Saldo inicial do Cofrinho',
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
    'Saldo inicial do Cofrinho',
    'Último lançamento',
    'Segundo lançamento',
    'Primeiro lançamento',
  ]);
  await filterFormBeforeSummaryReview.locator('#cash-filter-type').selectOption('all');
  await filterFormBeforeSummaryReview.getByRole('button', { name: 'Aplicar', exact: true }).click();

  const saleCategoryMenu = page.locator('[data-cash-summary-category="venda"]');
  const otherCategoryMenu = page.locator('[data-cash-summary-category="outros"]');
  await expect(saleCategoryMenu).toBeVisible();
  await expect(otherCategoryMenu).toBeVisible();
  await expect(saleCategoryMenu).toHaveAttribute('aria-pressed', 'false');
  await saleCategoryMenu.click();
  await expect(saleCategoryMenu).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#cash-filter-category')).toHaveValue('venda');
  expect(await ledgerDescriptions()).toEqual([
    'Último lançamento',
    'Segundo lançamento',
    'Primeiro lançamento',
  ]);
  await expect(otherCategoryMenu).toBeVisible();
  await saleCategoryMenu.click();
  await expect(saleCategoryMenu).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#cash-filter-category')).toHaveValue('all');
  expect(await ledgerDescriptions()).toEqual([
    'Saldo inicial do Cofrinho',
    'Saída sem conta',
    'Último lançamento',
    'Segundo lançamento',
    'Primeiro lançamento',
  ]);

  const formattedToday = today.split('-').reverse().join('/');
  const pfAccountSummary = page.locator('[data-cash-account-summary="pf"]');
  const pjAccountSummary = page.locator('[data-cash-account-summary="pj"]');
  const savingsAccountSummary = page.locator('[data-cash-account-summary="savings"]');
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
  await expect(savingsAccountSummary).toContainText('Conta Cofrinho');
  await expect(savingsAccountSummary).toContainText('R$ 80,00');
  await expect(savingsAccountSummary).toContainText(`Último movimento em ${formattedToday}`);
  await expect(unassignedAccountSummary).toContainText('Lançamentos sem conta');
  await expect(unassignedAccountSummary).toContainText('-R$ 15,00');
  await expect(unassignedAccountSummary).toContainText(`Último lançamento em ${formattedToday}`);
  await expect(filteredIncome).toContainText('R$ 60,00');
  await expect(filteredExpenses).toContainText('R$ 15,00');
  await expect(filteredResult).toContainText('R$ 45,00');
  await expect(accumulatedBalance).toContainText('R$ 45,00');
  await expect(page.locator('.cash-hero > div:first-child')).toContainText('R$ 125,00');

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

test('linked transfers preserve PF PJ savings totals and stay outside results', async ({
  page,
}, testInfo) => {
  const database = await mockOnlineDatabase(page);
  const today = localDateKey();
  database.state = {
    cashEntries: [
      {
        id: 'transfer-opening-pf',
        date: today,
        description: 'Saldo inicial PF',
        type: 'income',
        category: 'venda',
        cashAccount: 'pf',
        amount: '3000.00',
      },
      {
        id: 'transfer-opening-pj',
        date: today,
        description: 'Saldo inicial PJ',
        type: 'income',
        category: 'venda',
        cashAccount: 'pj',
        amount: '2000.00',
      },
    ],
    financialPlanning: {
      savings: '500.00',
      savingsExpectedBalance: '500.00',
      accountTransfers: [],
      savingsHistory: [
        {
          id: 'transfer-opening-savings',
          date: today,
          type: 'set',
          amount: '500.00',
          balance: '500.00',
          description: 'Saldo inicial do Cofrinho',
        },
      ],
    },
  };

  await page.goto('/fluxo-de-caixa?panel=transfers');
  await expect(
    page.getByRole('heading', { name: 'Transferência entre contas', exact: true })
  ).toBeVisible();
  const transferForm = page.locator('#account-transfer-form');
  const balances = page.locator('.account-transfer-balances');
  await expect(balances).toContainText('Conta PFR$ 3.000,00');
  await expect(balances).toContainText('Conta PJR$ 2.000,00');
  await expect(balances).toContainText('Conta CofrinhoR$ 500,00');
  await expect(balances).toContainText('Saldo consolidadoR$ 5.500,00');

  await transferForm.locator('select[name="origin"]').selectOption('pf');
  await transferForm.locator('select[name="destination"]').selectOption('pj');
  await transferForm.locator('input[name="amount"]').fill('1.000,00');
  await transferForm.locator('input[name="description"]').fill('Transferência para PJ');
  await transferForm.getByRole('button', { name: 'Transferir', exact: true }).click();

  await expect.poll(() => database.state.financialPlanning?.accountTransfers?.length).toBe(1);
  const firstTransfer = database.state.financialPlanning.accountTransfers[0];
  const firstTransferCash = database.state.cashEntries.filter(
    (entry) => entry.transferId === firstTransfer.id
  );
  expect(firstTransferCash).toHaveLength(2);
  expect(firstTransferCash.map((entry) => entry.accountTransferSide).sort()).toEqual([
    'destination',
    'source',
  ]);
  expect(new Set(firstTransferCash.map((entry) => entry.transferId))).toEqual(
    new Set([firstTransfer.id])
  );
  await expect(balances).toContainText('Conta PFR$ 2.000,00');
  await expect(balances).toContainText('Conta PJR$ 3.000,00');
  await expect(balances).toContainText('Saldo consolidadoR$ 5.500,00');

  await transferForm.locator('select[name="origin"]').selectOption('pj');
  await transferForm.locator('select[name="destination"]').selectOption('savings');
  await transferForm.locator('input[name="amount"]').fill('300,00');
  await transferForm.locator('input[name="description"]').fill('Guardar no Cofrinho');
  await transferForm.getByRole('button', { name: 'Transferir', exact: true }).click();
  await expect.poll(() => database.state.financialPlanning?.accountTransfers?.length).toBe(2);
  await expect(balances).toContainText('Conta PJR$ 2.700,00');
  await expect(balances).toContainText('Conta CofrinhoR$ 800,00');
  await expect(balances).toContainText('Saldo consolidadoR$ 5.500,00');

  await transferForm.locator('select[name="origin"]').selectOption('savings');
  await transferForm.locator('select[name="destination"]').selectOption('pj');
  await transferForm.locator('input[name="amount"]').fill('100,00');
  await transferForm.locator('input[name="description"]').fill('Volta para PJ');
  await transferForm.getByRole('button', { name: 'Transferir', exact: true }).click();
  await expect.poll(() => database.state.financialPlanning?.accountTransfers?.length).toBe(3);
  await expect(balances).toContainText('Conta PJR$ 2.800,00');
  await expect(balances).toContainText('Conta CofrinhoR$ 700,00');
  await expect(balances).toContainText('Saldo consolidadoR$ 5.500,00');

  const financialBeforeContribution = await page.evaluate(() => {
    const data = window.reportData();
    return {
      income: data.financial.income,
      expenses: data.financial.operationalExpenses,
      profit: window.operationalProfitForReport(data),
      sales: window.salesRevenueForPeriod(data.periodKey).total,
      purchases: window.productionPurchasesForPeriod(data.periodKey).combinedTotal,
      purchasesSalesPercent: window.productionPurchasesForPeriod(data.periodKey)
        .purchasesSalesPercent,
      purchasesPerBowl: window.productionPurchasesForPeriod(data.periodKey).purchasesPerBowl,
    };
  });
  expect(financialBeforeContribution).toEqual({
    income: 5000,
    expenses: 0,
    profit: 5000,
    sales: 5000,
    purchases: 0,
    purchasesSalesPercent: 0,
    purchasesPerBowl: 0,
  });

  await page.goto('/fluxo-de-caixa?panel=entry');
  const cashForm = page.locator('#cash-form');
  await cashForm.locator('input[name="description"]').fill('Aporte pessoal da Raquel');
  await page.locator('#cash-type').selectOption('income');
  await page.locator('#cash-category').selectOption('aporte-socia');
  await expect(page.locator('#cash-capital-contribution-hint')).toBeVisible();
  await page.locator('#cash-account').selectOption('pj');
  await cashForm.locator('input[name="amount"]').fill('2.000,00');
  await cashForm.getByRole('button', { name: 'Adicionar', exact: true }).click();
  await expect
    .poll(
      () =>
        database.state.cashEntries?.find((entry) => entry.category === 'aporte-socia')
          ?.nonOperationalPartnerContribution
    )
    .toBe(true);

  const reportPayload = await page.evaluate(() => {
    const data = window.reportData();
    const payload = window.reportExportPayload(data).data;
    return {
      accountBalance: data.accountBalance,
      savingsBalance: data.savingsBalance,
      consolidatedBalance: data.consolidatedBalance,
      income: data.financial.income,
      expenses: data.financial.operationalExpenses,
      profit: window.operationalProfitForReport(data),
      sales: window.salesRevenueForPeriod(data.periodKey).total,
      contributionTotal: data.capitalContributionTotal,
      contributionIsTransfer: Boolean(
        data.capitalContributionEntries[0]?.transferId ||
          data.capitalContributionEntries[0]?.accountTransferId
      ),
      transferRows: payload.transferRows,
      contributionRows: payload.capitalContributionRows,
      unifiedTransferRows: payload.accountPackageUnifiedRows.filter(
        (row) => row[4] === 'Transferência entre contas'
      ),
      pfTransferRows: payload.accountPackagePfRows.filter(
        (row) => row[4] === 'Transferência entre contas'
      ),
      pjTransferRows: payload.accountPackagePjRows.filter(
        (row) => row[4] === 'Transferência entre contas'
      ),
    };
  });
  expect(reportPayload).toMatchObject({
    accountBalance: 6800,
    savingsBalance: 700,
    consolidatedBalance: 7500,
    income: 5000,
    expenses: 0,
    profit: 5000,
    sales: 5000,
    contributionTotal: 2000,
    contributionIsTransfer: false,
  });
  expect(reportPayload.transferRows).toHaveLength(3);
  expect(reportPayload.contributionRows).toHaveLength(1);
  expect(reportPayload.unifiedTransferRows).toHaveLength(0);
  expect(reportPayload.pfTransferRows.length).toBeGreaterThan(0);
  expect(reportPayload.pjTransferRows.length).toBeGreaterThan(0);

  await page.goto('/fluxo-de-caixa?panel=transfers');
  let originalRow = page.locator('tr', { hasText: 'Transferência para PJ' });
  const editedTransferDateValue = new Date(`${today}T12:00:00`);
  editedTransferDateValue.setDate(editedTransferDateValue.getDate() - 1);
  const editedTransferDate = localDateKey(editedTransferDateValue);
  await originalRow.getByRole('button', { name: 'Editar data', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Editar transferência', exact: true })
  ).toBeVisible();
  await expect(page.locator('#account-transfer-form input[name="date"]')).toBeFocused();
  await page.locator('#account-transfer-form input[name="date"]').fill(editedTransferDate);
  await page
    .locator('#account-transfer-form')
    .getByRole('button', { name: 'Salvar transferência', exact: true })
    .click();
  await expect
    .poll(
      () =>
        database.state.financialPlanning.accountTransfers.find(
          (item) => item.id === firstTransfer.id
        )?.date
    )
    .toBe(editedTransferDate);
  expect(
    database.state.cashEntries
      .filter((entry) => entry.transferId === firstTransfer.id)
      .map((entry) => entry.date)
  ).toEqual([editedTransferDate, editedTransferDate]);

  originalRow = page.locator('tr', { hasText: 'Transferência para PJ' });
  page.once('dialog', (dialog) => dialog.accept());
  await originalRow.getByRole('button', { name: 'Estornar', exact: true }).click();
  await expect.poll(() => database.state.financialPlanning?.accountTransfers?.length).toBe(4);
  const reversal = database.state.financialPlanning.accountTransfers.find(
    (item) => item.reversalOf === firstTransfer.id
  );
  expect(reversal).toMatchObject({ origin: 'pj', destination: 'pf', amount: '1000.00' });
  await expect(page.locator('.account-transfer-balances')).toContainText(
    'Saldo consolidadoR$ 7.500,00'
  );
  await expectNoHorizontalOverflow(page);
  await page.screenshot({
    path: testInfo.outputPath('linked-account-transfers.png'),
    fullPage: true,
  });
});

test('withdrawals compensate debt only after an explicit choice', async ({ page }, testInfo) => {
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
    partnerAccounts: {
      partners: [
        { id: 'vanessa', name: 'Vanessa', active: true },
        { id: 'raquel', name: 'Raquel', active: true },
      ],
      movements: [
        {
          id: 'partner-debt-vanessa',
          partnerId: 'vanessa',
          date: today,
          type: 'debit',
          description: 'Retirada pessoal anterior',
          amount: '200.00',
          origin: 'pj',
          cashImpact: false,
          createdAt: `${today}T09:00:00.000Z`,
        },
        {
          id: 'partner-debt-raquel',
          partnerId: 'raquel',
          date: today,
          type: 'debit',
          description: 'Retirada pessoal anterior',
          amount: '50.00',
          origin: 'pj',
          cashImpact: false,
          createdAt: `${today}T09:05:00.000Z`,
        },
      ],
      withdrawalSnapshots: [],
    },
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
  await expect(form.locator('[data-withdrawal-debt="vanessa"]')).toContainText('R$ 200,00');
  await expect(form.locator('[data-withdrawal-debt="raquel"]')).toContainText('R$ 50,00');
  await expect(form.locator('select[name="partnerActionVanessa"]')).toHaveValue('keep');
  await expect(form.locator('select[name="partnerActionRaquel"]')).toHaveValue('keep');
  const defaultDebtCalculation = await page.evaluate(() =>
    window.withdrawalDistributionCalculation(4750, 200, 50)
  );
  expect(defaultDebtCalculation.paidToCashVanessa).toBe(0);
  expect(defaultDebtCalculation.paidToCashRaquel).toBe(0);
  await form.locator('select[name="partnerActionVanessa"]').selectOption('discount');
  await form.locator('select[name="partnerActionRaquel"]').selectOption('discount');
  await expect(form.locator('input[name="expectedSavings"]')).toHaveValue('500,00');
  await expect(form.locator('input[name="expectedVanessa"]')).toHaveValue('3.150,00');
  await expect(form.locator('input[name="expectedRaquel"]')).toHaveValue('1.350,00');
  await expect(form.locator('input[name="savings"]')).toHaveValue('500,00');
  await expect(form.locator('input[name="vanessa"]')).toHaveValue('2.950,00');
  await expect(form.locator('input[name="raquel"]')).toHaveValue('1.300,00');
  await expect(form.locator('.withdrawal-preview')).toContainText('Ajuste para igualar ao banco');
  await expect(form.locator('.withdrawal-preview')).toContainText('-R$ 250,00');
  await expect(form.locator('.withdrawal-preview')).toContainText('Base ajustada para a quebra');
  await expect(form.locator('.withdrawal-preview')).toContainText('R$ 5.000,00');
  await expect(form.locator('.withdrawal-preview')).toContainText('Total que sai agoraR$ 4.750,00');
  await expect(form.locator('.withdrawal-preview')).toContainText(
    'Vanessa - recebe da contaR$ 2.950,00'
  );
  await expect(form.locator('.withdrawal-preview')).toContainText(
    'Raquel - recebe da contaR$ 1.300,00'
  );
  await expect(form.locator('.withdrawal-preview')).toContainText('Dívida compensadaR$ 250,00');
  await form.locator('input[name="vanessa"]').fill('5.000,00');
  await expect(form.locator('.withdrawal-preview')).toContainText('Excede o saldo');
  await form.locator('input[name="vanessa"]').fill('2.950,00');
  const cappedCalculation = await page.evaluate(() =>
    window.withdrawalDistributionCalculation(2000, 10000, 0)
  );
  expect(cappedCalculation.total).toBeLessThanOrEqual(2000);
  expect(cappedCalculation.accountAfterWithdrawal).toBeGreaterThanOrEqual(0);
  const legacyReconstruction = await page.evaluate(() => window.withdrawalSplitFromRaquel(1350));
  expect(legacyReconstruction.total).toBeCloseTo(5000, 2);
  expect(legacyReconstruction.savings).toBeCloseTo(500, 2);
  expect(legacyReconstruction.vanessa).toBeCloseTo(3150, 2);
  expect(legacyReconstruction.raquel).toBeCloseTo(1350, 2);
  await expectNoHorizontalOverflow(page);
  page.once('dialog', (dialog) => dialog.accept());
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
    cashDebtAmount: '200.00',
    priorWithdrawalAmount: '200.00',
    accountBalanceBefore: '4750.00',
    cashAccount: 'pj',
    paidToCashAmount: '200.00',
    remainingDebtAmount: '0.00',
  });
  const firstRaquel = database.state.cashEntries.find(
    (entry) => entry.description === 'Retirada - Raquel'
  );
  expect(firstRaquel).toMatchObject({
    amount: '1300.00',
    expectedAmount: '1350.00',
    cashDebtAmount: '50.00',
    priorWithdrawalAmount: '50.00',
    accountBalanceBefore: '4750.00',
    cashAccount: 'pj',
    paidToCashAmount: '50.00',
    remainingDebtAmount: '0.00',
  });
  expect(database.state.partnerAccounts.withdrawalSnapshots).toHaveLength(1);
  expect(database.state.partnerAccounts.withdrawalSnapshots[0]).toMatchObject({
    physicalCash: '4750.00',
    receivablesTotal: '250.00',
    adjustedBase: '5000.00',
    companyReserve: '500.00',
    cashPaidTotal: '4750.00',
  });
  expect(database.state.partnerAccounts.movements).toHaveLength(4);
  expect(
    database.state.cashEntries
      .filter((entry) => String(entry.id || '').startsWith('withdrawal-'))
      .every((entry) => entry.cashAccount === 'pj')
  ).toBe(true);
  const monthSummary = page.locator('.partners-dashboard section').filter({
    hasText: 'Lucro operacional',
  });
  await expect(monthSummary).toContainText('Lucro operacionalR$ 5.000,00');
  await expect(monthSummary).toContainText('Vanessa - recebeu da contaR$ 2.950,00');
  await expect(monthSummary).toContainText('Raquel - distribuiçãoR$ 1.350,00');
  expect(
    await page.evaluate((dateKey) => window.accountBalanceUntilDate(dateKey), today)
  ).toBeCloseTo(0, 2);
  await page.screenshot({
    path: testInfo.outputPath('withdrawal-cash-compensation.png'),
    fullPage: true,
  });
  await page.goto('/financeiro?view=withdrawals');
  const withdrawalReport = page.locator('.withdrawal-person-panel');
  await expect(withdrawalReport).toContainText('Lucro operacionalR$ 5.000,00');
  await expect(withdrawalReport).toContainText('Cofrinho (10%)R$ 500,00');
  await expect(withdrawalReport).toContainText('Vanessa recebeuR$ 2.950,00');
  await expect(withdrawalReport).toContainText('Raquel - recebeu da contaR$ 1.300,00');
  await expect(withdrawalReport).toContainText('Dívidas compensadasR$ 250,00');
  await expect(withdrawalReport).toContainText('Total que saiu da contaR$ 4.750,00');
  await expect(withdrawalReport).toContainText('Dívida compensada');
  await expect(withdrawalReport).toContainText('Recebeu R$ 2.950,00Direito R$ 3.150,00');
  await expect(withdrawalReport).toContainText('Recebeu R$ 1.300,00Direito R$ 1.350,00');
  await expectNoHorizontalOverflow(page);
  await page.screenshot({
    path: testInfo.outputPath('withdrawal-report-breakdown.png'),
    fullPage: true,
  });
});

test('reviewing a legacy withdrawal saves its detailed closing', async ({ page }) => {
  const database = await mockOnlineDatabase(page);
  const today = localDateKey();
  database.state = {
    cashEntries: [
      {
        id: 'legacy-savings',
        date: today,
        type: 'expense',
        category: 'retirada',
        cashAccount: 'pf',
        description: 'Retirada - Cofrinho',
        amount: '10.00',
        expectedAmount: '10.00',
        distributionBase: '100.00',
        accountBalanceBefore: '100.00',
      },
      {
        id: 'legacy-vanessa',
        date: today,
        type: 'expense',
        category: 'retirada',
        cashAccount: 'pf',
        description: 'Retirada - Vanessa',
        amount: '63.00',
        expectedAmount: '63.00',
        distributionBase: '100.00',
        accountBalanceBefore: '100.00',
      },
      {
        id: 'legacy-raquel',
        date: today,
        type: 'expense',
        category: 'retirada',
        cashAccount: 'pf',
        description: 'Retirada - Raquel',
        amount: '27.00',
        expectedAmount: '27.00',
        distributionBase: '100.00',
        accountBalanceBefore: '100.00',
      },
    ],
    partnerAccounts: { movements: [], withdrawalSnapshots: [] },
    financialPlanning: { savings: '0.00', savingsHistory: [] },
  };

  await page.goto('/fluxo-de-caixa?panel=withdrawals');
  await expect(page.getByText('1 retirada(s) antiga(s) precisam de revisão')).toBeVisible();
  await page.getByRole('button', { name: 'Revisar e editar', exact: true }).click();
  page.once('dialog', (dialog) => dialog.accept());
  await page
    .locator('#withdrawal-form')
    .getByRole('button', { name: 'Salvar retirada', exact: true })
    .click();

  await expect.poll(() => database.state.partnerAccounts?.withdrawalSnapshots?.length).toBe(1);
  const withdrawalEntries = database.state.cashEntries.filter(
    (entry) => entry.category === 'retirada'
  );
  expect(withdrawalEntries).toHaveLength(3);
  expect(withdrawalEntries.every((entry) => entry.partnerWithdrawalSnapshotId)).toBe(true);
});

test('stored Vanessa compensation is displayed without rewriting the manual entry', async ({
  page,
}) => {
  const database = await mockOnlineDatabase(page);
  database.state = {
    cashEntries: [
      {
        id: 'confirmed-savings-2026-08-10',
        date: '2026-08-10',
        type: 'expense',
        category: 'retirada',
        cashAccount: 'pf',
        description: 'Retirada - Cofrinho',
        amount: '292.01',
        expectedAmount: '292.01',
      },
      {
        id: 'confirmed-vanessa-2026-08-10',
        date: '2026-08-10',
        type: 'expense',
        category: 'retirada',
        cashAccount: 'pf',
        description: 'Retirada - Vanessa',
        amount: '1441.68',
        expectedAmount: '1839.67',
        paidToCashAmount: '397.99',
      },
      {
        id: 'confirmed-raquel-2026-08-10',
        date: '2026-08-10',
        type: 'expense',
        category: 'retirada',
        cashAccount: 'pf',
        description: 'Retirada - Raquel',
        amount: '788.43',
        expectedAmount: '788.43',
      },
    ],
  };

  await page.goto('/fluxo-de-caixa?panel=withdrawals');
  const vanessaCard = page.locator('.withdrawal-partner-card').filter({ hasText: 'Vanessa' });
  await expect(vanessaCard).toContainText('Dívida compensadaR$ 397,99');
  await expect(vanessaCard).toContainText('Recebeu da contaR$ 1.441,68');
  await expect(vanessaCard).toContainText('SituaçãoQuitado');
  await expect(vanessaCard).not.toContainText('Ainda não retirou');

  await page.goto('/fluxo-de-caixa?panel=ledger');
  const vanessaCategory = page
    .locator('.cash-category-summary-card')
    .filter({ hasText: 'Vanessa' });
  await expect(vanessaCategory).toContainText('Saídas R$ 1.441,68');
  await expect(vanessaCategory).toContainText('Deveria receber R$ 1.839,67');
  await expect(vanessaCategory).toContainText('Dívida compensada R$ 397,99');

  await page.goto('/relatorios?periodo=month&ano=2026&mes=8');
  const reportVanessaCard = page
    .locator('.report-grid .metric')
    .filter({
      hasText: 'Vanessa recebeu',
    })
    .first();
  await expect(reportVanessaCard).toContainText('R$ 1.441,68');
  const reportRaquelCard = page
    .locator('.report-grid .metric')
    .filter({
      hasText: 'Raquel recebeu',
    })
    .first();
  await expect(reportRaquelCard).toContainText('R$ 788,43');
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
    localStorage.setItem('globalPeriod', JSON.stringify({ year: 2026, month: 7 }));
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

test('Cardápio Web delivery fees are saved only for conference', async ({ page }) => {
  const database = await mockOnlineDatabase(page);
  database.state = {
    cashEntries: [],
    channelReceipts: [],
    appConfig: { cardapioWebDebitFeePercent: 10 },
  };

  await page.goto('/loja?view=channels');
  const form = page.locator('#channel-receipt-form');
  await form.locator('input[name="date"]').fill('2026-08-15');
  await form.locator('input[name="cardapioWebDebit"]').fill('100,00');
  await form.locator('input[name="cardapioWebDeliveryFee"]').fill('15,00');
  await form.getByRole('button', { name: 'Salvar dia', exact: true }).click();

  await expect.poll(() => database.state.channelReceipts?.length).toBe(1);
  expect(database.state.channelReceipts[0]).toMatchObject({
    cardapioWebDebit: '90.00',
    cardapioWebDebitGross: '100.00',
    cardapioWebDebitFee: '10.00',
    cardapioWebDebitNet: '90.00',
    cardapioWebDeliveryFee: '15.00',
    cardapioWebGross: '100.00',
    cardapioWebFee: '10.00',
    cardapioWebNet: '90.00',
  });
  expect(database.state.cashEntries || []).toHaveLength(0);

  const row = page.locator('.channel-receipts-panel tbody tr').first();
  await expect(row.locator('td').nth(6)).toContainText('15,00');
  await expect(row.locator('td').nth(9)).toContainText('90,00');
  const feeMetric = page.locator('.channel-summary .metric', {
    hasText: 'Taxas de entrega (conferência)',
  });
  await expect(feeMetric).toContainText('15,00');
  const totalMetric = page.locator('.channel-summary .metric').filter({
    has: page.locator('span', { hasText: /^Total$/ }),
  });
  await expect(totalMetric).toContainText('90,00');

  await page.goto('/relatorios?periodo=month&ano=2026&mes=8');
  await page.getByRole('button', { name: 'Entradas', exact: true }).click();
  const channelBreakdown = page.locator('.channel-report-breakdown');
  await expect(channelBreakdown).toBeVisible();
  await expect(channelBreakdown.locator('.channel-report-total')).toContainText('R$ 90,00');
  await expect(channelBreakdown).toContainText('R$ 15,00');
  await expectNoHorizontalOverflow(page);
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
  await expect(form.getByLabel('Data da venda', { exact: true })).toBeVisible();
  await expect(form.locator('select[name="productId"]')).toHaveCount(0);
  await expect(page.locator('[data-store-sale-quantity-label]')).toHaveText('Quantidade de pratos');
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
    localStorage.setItem('globalPeriod', JSON.stringify({ year: 2026, month: 7 }));
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

  await expect(filterForm.locator('select[name="productId"]')).toHaveCount(0);
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
  await productForm.getByRole('button', { name: 'Cadastrar prato', exact: true }).click();
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
  expect(database.state.storeProductQuantities[0].updatedAt).toBeTruthy();
  const updatedDate = database.state.storeProductQuantities[0].updatedAt.slice(0, 10);
  await expect(page.locator('[data-store-last-sale-date]')).toContainText(
    updatedDate.split('-').reverse().join('/')
  );
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

test('store products link pricing and keep sales generic', async ({ page }, testInfo) => {
  const database = await mockOnlineDatabase(page);
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
    await productForm.getByRole('button', { name: 'Cadastrar prato', exact: true }).click();
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
  await expect(page.locator('.store-product-table')).toContainText('R$ 24,00');
  await expect(page.locator('.store-product-table')).toContainText('Praticado');

  const frango = database.state.storeProducts.find((item) => item.name === 'Frango Fit');
  const quantitiesForm = page.locator('#store-product-quantities-form');
  await quantitiesForm.getByLabel('Quantidade de Frango Fit', { exact: true }).fill('10');
  await quantitiesForm.getByRole('button', { name: 'Salvar quantidades do mês' }).click();
  const frangoFinancial = page.locator(`[data-store-product-financial="${frango.id}"]`);
  await expect(frangoFinancial).toContainText('R$ 300,00');
  await expect(frangoFinancial).toContainText('R$ 200,00');

  await page.getByRole('button', { name: 'Vendas', exact: true }).click();
  await expect(page.locator('#store-sale-form select[name="productId"]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Produtos', exact: true }).click();
  await expect(page.locator('[data-store-last-sale-date]')).toContainText('Último lançamento');
  await expect(page.locator('.store-product-table')).toContainText('Frango Fit');
  await expect(page.locator('.store-product-table')).toContainText('R$ 24,00');

  await page.goto('/relatorios');
  await page.getByRole('button', { name: 'Rentabilidade', exact: true }).click();
  const profitabilityRow = page.locator(`[data-profitability-store-product="${frango.id}"]`);
  await expect(profitabilityRow).toContainText('Frango Fit');
  await expect(profitabilityRow).toContainText('Quantidade mensal');
  await expect(profitabilityRow).toContainText('10');
  await expect(profitabilityRow).toContainText('R$ 300,00');
  await expect(profitabilityRow).toContainText('R$ 200,00');
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
  const today = localDateKey();
  const currentMonth = today.slice(0, 7);
  const elapsedDays = Number(today.slice(8, 10));
  const partialQuantity = 145;
  database.state = {
    pricingIngredients: [],
    pricingRecipes: [],
    pricingConfig: { sharedCosts: { labels: 3120 } },
    storeSales: [{ id: 'store-current', date: today, saleType: 'unit', quantity: 45 }],
    orders: [{ id: 'weekly-current', menuKey: `${currentMonth}-semana-1`, totalQuantity: 100 }],
  };

  await page.goto('/precificacao?view=costs');
  const costForm = page.locator('#pricing-shared-cost-form');
  await expect(costForm).toBeVisible();
  await expect(costForm.locator('input[name="labels"]')).toHaveCount(0);
  await expect(page.locator('[data-pricing-shared-preview="monthly"]')).toContainText('R$ 0,00');
  await expect(costForm).toContainText(
    `${partialQuantity} cumbuca(s) vendida(s) neste mês até o dia ${elapsedDays}: Loja 45 + Semanal 100`
  );
  await costForm
    .getByRole('button', { name: `Usar total vendido neste mês (${partialQuantity})`, exact: true })
    .click();
  await expect(costForm.locator('input[name="averageMonthlyUnits"]')).toHaveValue(
    String(partialQuantity)
  );
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
  await expect(page.locator('[data-pricing-shared-preview="total"]')).toContainText('8,62');
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

  await page.getByRole('button', { name: 'Pratos', exact: true }).click();
  const recipeForm = page.locator('#pricing-recipe-form');
  await expect(page.getByRole('button', { name: 'Ingredientes', exact: true })).toHaveCount(0);
  await recipeForm.locator('input[name="name"]').fill('Frango Fit');
  await recipeForm.locator('input[name="category"]').fill('Frango');
  await recipeForm.locator('input[name="weightGrams"]').fill('500');
  await recipeForm.locator('input[name="supermarketUnitCost"]').fill('4,75');
  await recipeForm.locator('input[name="packagingCost"]').fill('2');
  await recipeForm.locator('input[name="fixedFee"]').fill('0,50');
  await recipeForm.locator('input[name="variableFeePercent"]').fill('10');
  await recipeForm.locator('input[name="desiredMarginPercent"]').fill('40');
  await recipeForm.locator('input[name="practicedPrice"]').fill('30');
  await expect(page.locator('[data-pricing-preview="supermarket"]')).toContainText('R$ 4,75');
  await expect(page.locator('[data-pricing-preview="suggested"]')).toContainText('R$ 31,74');
  await expect(page.locator('[data-pricing-preview="profit"]')).toContainText('R$ 11,13');
  await expectNoHorizontalOverflow(page);
  await recipeForm.getByRole('button', { name: 'Cadastrar prato', exact: true }).click();
  await expect.poll(() => database.state.pricingRecipes?.length).toBe(1);
  expect(database.state.pricingRecipes[0]).toMatchObject({
    name: 'Frango Fit',
    supermarketUnitCost: 4.75,
    ingredients: [],
  });
  await expect(page).toHaveURL(/precificacao\?view=dashboard/);
  const recipeRow = page.locator('.pricing-table tbody tr');
  await expect(recipeRow).toHaveCount(1);
  await expect(recipeRow).toContainText('Frango Fit');
  await expect(recipeRow).toContainText('R$ 31,74');
  await expect(recipeRow).toContainText('R$ 11,13');
  await expect(recipeRow).toContainText('37,1%');
  await expect(recipeRow).toContainText('Atenção');
  await expect(page.locator('.pricing-table')).toContainText('Frango Fit');

  await page.setViewportSize({ width: 390, height: 844 });
  await expectNoHorizontalOverflow(page);
  await page.screenshot({
    path: testInfo.outputPath('pricing-recipe-dashboard.png'),
    fullPage: true,
  });
});

test('finance divides only supermarket, butcher and boleto expenses by all plates sold', async ({
  page,
}, testInfo) => {
  const database = await mockOnlineDatabase(page);
  database.state = {
    reportPeriod: { type: 'month', year: 2026, month: 8, week: 1 },
    pricingIngredients: [],
    pricingConfig: {},
    pricingRecipes: [
      {
        id: 'recipe-store',
        name: 'Frango da loja',
        supermarketUnitCost: 5,
        packagingCost: 0,
        fixedFee: 0,
        variableFeePercent: 0,
        desiredMarginPercent: 30,
        practicedPrice: 20,
        ingredients: [],
      },
    ],
    storeProducts: [
      { id: 'product-store', name: 'Frango da loja', pricingRecipeId: 'recipe-store' },
    ],
    storeSales: [
      {
        id: 'store-unit',
        date: '2026-08-03',
        productId: 'product-store',
        saleType: 'unit',
        quantity: 10,
      },
      {
        id: 'store-combo',
        date: '2026-08-04',
        productId: 'product-store',
        saleType: 'combo',
        quantity: 2,
        unitsPerCombo: 5,
      },
      {
        id: 'store-unlinked',
        date: '2026-08-04',
        productName: 'Produto sem prato vinculado',
        saleType: 'unit',
        quantity: 2,
      },
    ],
    weeklyMenusByPeriod: {
      '2026-08-semana-1': [
        {
          slot: 1,
          dish: 'Peixe semanal',
          ingredientCost: '8.00',
          packagingCost: '0.00',
          cost: '8.00',
          ingredients: [],
        },
      ],
    },
    orders: [
      {
        id: 'menu-order',
        menuKey: '2026-08-semana-1',
        dishes: [{ slot: 1, quantity: 10 }],
        totalQuantity: 10,
        amount: 200,
        createdAt: '2026-08-05T12:00:00.000Z',
      },
    ],
    cashEntries: [
      {
        id: 'paid-bill',
        date: '2026-08-06',
        dueDate: '2026-08-06',
        paidAt: '2026-08-06T12:00:00.000Z',
        type: 'expense',
        category: 'boleto',
        amount: '90.00',
      },
      {
        id: 'account-bill',
        date: '2026-08-07',
        type: 'expense',
        category: 'aluguel',
        amount: '30.00',
        financialAccountId: 'account-1',
      },
      {
        id: 'butcher-expense',
        date: '2026-08-07',
        dueDate: '2026-08-07',
        paidAt: '2026-08-07T12:00:00.000Z',
        type: 'expense',
        category: 'reason:Frigorífico',
        amount: '60.00',
      },
      {
        id: 'energy-account',
        date: '2026-08-07',
        type: 'expense',
        category: 'enel',
        amount: '40.00',
        financialAccountId: 'account-2',
      },
      {
        id: 'generic-account',
        date: '2026-08-07',
        dueDate: '2026-08-07',
        paidAt: '2026-08-07T12:00:00.000Z',
        type: 'expense',
        category: 'conta',
        amount: '70.00',
      },
      {
        id: 'separate-supermarket-entry',
        date: '2026-08-08',
        dueDate: '2026-08-08',
        paidAt: '2026-08-08T12:00:00.000Z',
        type: 'expense',
        category: 'supermercado',
        amount: '999.00',
      },
      {
        id: 'supermarket-refund',
        date: '2026-08-08',
        type: 'income',
        category: 'supermercado',
        amount: '99.00',
      },
      {
        id: 'pending-bill',
        date: '2026-08-09',
        dueDate: '2026-08-09',
        type: 'expense',
        category: 'boleto',
        amount: '999.00',
      },
    ],
  };

  await page.goto('/financeiro?ano=2026&mes=8');
  await page.locator('details.simple-details > summary').click();
  const panel = page.locator('[data-finance-food-cost]');
  await expect(panel).toBeVisible();
  await expect(panel.locator('[data-finance-supermarket-total]')).toHaveText('R$ 999,00');
  await expect(panel.locator('[data-finance-butcher-total]')).toHaveText('R$ 60,00');
  await expect(panel.locator('[data-finance-bills-total]')).toHaveText('R$ 90,00');
  await expect(panel.locator('[data-finance-input-total]')).toHaveText('R$ 1.149,00');
  await expect(panel).toContainText('Somente lançamentos na categoria Boleto');
  await expect(panel.locator('[data-finance-sold-plates]')).toContainText('32');
  await expect(
    panel.locator('.metric').filter({ hasText: 'Total de cumbucas vendidas' })
  ).toContainText('Menu 10 + Loja 22');
  await expect(panel.locator('[data-finance-cost-per-plate]')).toContainText('R$ 35,91');
  await expect(panel).not.toContainText('sem custo de supermercado identificado');
  await expectNoHorizontalOverflow(page);
  await page.screenshot({
    path: testInfo.outputPath('finance-food-and-bills-cost.png'),
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
  await expect(page.locator('#financial-account-cash-account-field')).toBeVisible();
  await expect(page.locator('#financial-account-cash-account')).toHaveValue('');
  await expect(page.locator('#financial-account-cash-account-help')).toContainText(
    'ao pagar, escolha PF, PJ ou Cofrinho'
  );

  await page.getByLabel('Descrição', { exact: true }).fill('Teste fornecedor');
  await page.getByLabel('Vencimento', { exact: true }).fill(today);
  await page.getByLabel('Valor total', { exact: true }).fill('100,00');
  await page.locator('#financial-account-schedule').selectOption('installments');
  await page.locator('#financial-account-count-field input[name="scheduleCount"]').fill('3');
  await page.getByRole('button', { name: 'Adicionar conta', exact: true }).click();
  await expect(page.locator('.account-row')).toHaveCount(3);
  expect(
    database.state.financialPlanning.accounts.every((account) => account.cashAccount === '')
  ).toBe(true);
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
  await expect(firstAccount).toContainText('Definir conta no pagamento');
  await firstAccount
    .locator('form[data-account-settlement] select[name="cashAccount"]')
    .selectOption('pj');
  await firstAccount.locator('form[data-account-settlement] input[name="amount"]').fill('30,00');
  await firstAccount.getByRole('button', { name: 'Registrar pagamento', exact: true }).click();
  firstAccount = page.locator('.account-row').filter({ hasText: 'Teste fornecedor' }).first();
  await expect(firstAccount).toContainText('R$ 30,00');
  await firstAccount.locator('details').click();
  await expect(firstAccount).toContainText('Conta PJ');

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
  await adjustedAccount
    .locator('form[data-account-settlement] select[name="cashAccount"]')
    .selectOption('pf');
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
  await page.getByRole('button', { name: 'Revisar e confirmar ajuste', exact: true }).click();
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
  expect(
    database.state.cashEntries?.find(
      (entry) => entry.description === 'Pagamento - Assinatura mensal'
    )?.cashAccount
  ).toBe('pf');
});

test('home dashboard prioritizes projected balance and actions', async ({ page }, testInfo) => {
  const database = await mockOnlineDatabase(page);
  const today = localDateKey();
  const tomorrowDate = new Date();
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrow = localDateKey(tomorrowDate);
  database.state = {
    cashEntries: [
      {
        id: 'home-pf-income',
        date: today,
        type: 'income',
        category: 'venda',
        cashAccount: 'pf',
        amount: '100.00',
      },
      {
        id: 'home-pj-income',
        date: today,
        type: 'income',
        category: 'venda',
        cashAccount: 'pj',
        amount: '50.00',
      },
      {
        id: 'home-pj-expense',
        date: today,
        type: 'expense',
        category: 'outros',
        cashAccount: 'pj',
        amount: '10.00',
      },
      {
        id: 'home-cash-bill',
        date: tomorrow,
        dueDate: tomorrow,
        description: 'Boleto futuro do caixa',
        type: 'expense',
        category: 'boleto',
        cashAccount: '',
        amount: '25.00',
      },
    ],
    financialPlanning: {
      savings: '60.00',
      savingsExpectedBalance: '60.00',
      savingsHistory: [
        {
          id: 'home-savings-opening',
          date: today,
          type: 'set',
          amount: '60.00',
          balance: '60.00',
          description: 'Saldo inicial do Cofrinho',
        },
      ],
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
    orders: [
      {
        id: 'home-order',
        menuKey: `${today.slice(0, 7)}-semana-1`,
        totalQuantity: 2,
        amount: '80.00',
      },
    ],
    storeSales: [{ id: 'home-store-sale', date: today, quantity: 1 }],
  };
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Situação da empresa', exact: true })
  ).toBeVisible();
  const indicators = page.locator('.executive-kpi-grid .executive-kpi');
  await expect(indicators).toHaveCount(6);
  await expect(page.locator('[data-home-projection]')).toContainText('Vendas');
  await expect(page.locator('[data-home-projection]')).toContainText('R$ 150,00');
  await expect(page.locator('[data-home-volume]')).toContainText('3');
  await expect(page.locator('[data-home-priorities]').first()).toBeVisible();
  await expect(page.locator('[data-home-budget]')).toBeVisible();
  await expect(page.locator('[data-home-volume]')).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'O que precisa da sua atenção', exact: true })
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'DRE gerencial simplificada' })).toBeVisible();
  await expect(page.locator('[data-management-dre]')).toContainText(
    /Lucro operacional\s*R\$\s*140,00/
  );
  await expect(page.locator('[data-management-dre]')).toContainText(
    /Saldo final PF \+ PJ\s*R\$\s*140,00/
  );
  await expect(page.locator('[data-management-dre]')).toContainText(
    /Saldo consolidado final(?:PF \+ PJ \+ Cofrinho)?\s*R\$\s*200,00/
  );
  await expect(
    page.getByRole('heading', { name: 'Comparação com mês anterior', exact: true })
  ).toBeVisible();
  await expect(page.locator('#global-new-button')).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: testInfo.outputPath('home-dashboard.png'), fullPage: true });
});

test('home period applies the selected month across monthly views', async ({ page }, testInfo) => {
  const database = await mockOnlineDatabase(page);
  database.state = {
    menuPeriod: { year: 2026, month: 8 },
    menuWeek: 1,
    weeklyMenusByPeriod: {},
    menuDatesByPeriod: {},
    cashFilter: {
      period: 'month',
      date: '2026-08-01',
      month: '2026-08',
      year: '2026',
      type: 'all',
      category: 'all',
      cashAccount: 'all',
      search: '',
    },
    cashEntries: [
      {
        id: 'withdrawal-july-vanessa',
        date: '2026-07-15',
        type: 'expense',
        category: 'retirada',
        description: 'Retirada - Vanessa',
        amount: '0.00',
        expectedAmount: '100.00',
        cashDebtAmount: '100.00',
        paidToCashAmount: '100.00',
        partnerWithdrawalSnapshotId: 'withdrawal-july-review',
      },
      {
        id: 'withdrawal-august-vanessa',
        date: '2026-08-15',
        type: 'expense',
        category: 'retirada',
        description: 'Retirada - Vanessa',
        amount: '0.00',
        expectedAmount: '200.00',
        cashDebtAmount: '200.00',
        paidToCashAmount: '200.00',
        partnerWithdrawalSnapshotId: 'withdrawal-august-review',
      },
    ],
  };

  await page.goto('/home');
  const globalForm = page.locator('#global-period-form');
  await expect(globalForm).toBeVisible();
  await globalForm.locator('input[name="period"]').fill('2026-07');
  await globalForm.getByRole('button', { name: 'Aplicar em todo o sistema', exact: true }).click();
  await expect(page.locator('.executive-toolbar')).toContainText('julho de 2026');
  await expect(page.locator('#global-period-form input[name="period"]')).toHaveValue('2026-07');
  await expect(
    page.locator('#global-period-form').getByRole('button', {
      name: 'Aplicar em todo o sistema',
      exact: true,
    })
  ).toBeVisible();
  await page.mouse.move(0, 0);
  await expectNoHorizontalOverflow(page);
  await page.screenshot({
    path: testInfo.outputPath('global-period-' + testInfo.project.name + '.png'),
    fullPage: false,
  });

  const remembered = await page.evaluate(() => ({
    globalPeriod: JSON.parse(localStorage.getItem('globalPeriod') || 'null'),
    menuPeriod: JSON.parse(localStorage.getItem('menuPeriod') || 'null'),
    reportPeriod: JSON.parse(localStorage.getItem('reportPeriod') || 'null'),
    cashFilter: JSON.parse(localStorage.getItem('cashFilter') || 'null'),
    storeSalesFilter: JSON.parse(localStorage.getItem('storeSalesFilter') || 'null'),
    channelFilter: JSON.parse(localStorage.getItem('channelFilter') || 'null'),
    storeProductMonth: JSON.parse(localStorage.getItem('storeProductMonth') || 'null'),
  }));
  expect(remembered.globalPeriod).toEqual({ year: 2026, month: 7 });
  expect(remembered.menuPeriod).toEqual({ year: 2026, month: 7 });
  expect(remembered.reportPeriod).toMatchObject({ type: 'month', year: 2026, month: 7 });
  expect(remembered.cashFilter).toMatchObject({ period: 'month', month: '2026-07' });
  expect(remembered.storeSalesFilter).toMatchObject({ period: 'month', month: '2026-07' });
  expect(remembered.channelFilter).toMatchObject({ period: 'month', month: '2026-07' });
  expect(remembered.storeProductMonth).toBe('2026-07');

  await page.goto('/menu-semanal');
  await expect(page.locator('#menu-period-form input[name="year"]')).toHaveValue('2026');
  await expect(page.locator('#menu-period-form select[name="month"]')).toHaveValue('7');

  await page.goto('/financeiro');
  await expect(page.locator('#report-filter-form select[name="type"]')).toHaveValue('month');
  await expect(page.locator('#report-filter-form input[name="year"]')).toHaveValue('2026');
  await expect(page.locator('#report-filter-form select[name="month"]')).toHaveValue('7');

  await page.goto('/fluxo-de-caixa?panel=withdrawals');
  const compensation = page
    .locator('.partners-dashboard section')
    .filter({ hasText: 'Valores compensados ao caixa' });
  await expect(compensation).toContainText('julho de 2026');
  await expect(compensation).toContainText('Compensado na retirada R$ 100,00');
  await expect(compensation).not.toContainText('R$ 300,00');

  await page.goto('/loja');
  await expect(page.locator('#store-sales-filter-form input[name="month"]')).toHaveValue('2026-07');

  await page.goto('/loja?view=channels');
  await expect(page.locator('#channel-filter-form input[name="month"]')).toHaveValue('2026-07');

  await page.goto('/relatorios');
  await expect(page.locator('#report-filter-form input[name="year"]')).toHaveValue('2026');
  await expect(page.locator('#report-filter-form select[name="month"]')).toHaveValue('7');
});

test('finance dashboard separates PF, PJ, Cofrinho and consolidated balance', async ({
  page,
}, testInfo) => {
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
      savings: '60.00',
      savingsExpectedBalance: '60.00',
      savingsHistory: [
        {
          id: 'finance-savings-opening',
          date: today,
          type: 'set',
          amount: '60.00',
          balance: '60.00',
          description: 'Saldo inicial do Cofrinho',
        },
      ],
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
  await expect(balanceCard).toContainText('Saldo consolidado');
  await expect(balanceCard).toContainText('PF + PJ + Cofrinho');
  await expect(balanceCard).toContainText('R$ 200,00');
  await expect(balanceCard).toContainText('Conta PF R$ 100,00');
  await expect(balanceCard).toContainText('Conta PJ R$ 40,00');
  await expect(balanceCard).toContainText('Conta Cofrinho R$ 60,00');
  const forecastCards = page.locator('[data-view-pane="accounts"] .cash-forecast-metric');
  await expect(forecastCards).toHaveCount(3);
  const projection30 = forecastCards.filter({ hasText: 'Próximos 30 dias' });
  await expect(projection30).toContainText('PF + PJ + Cofrinho');
  await expect(projection30).toContainText('Conta PF');
  await expect(projection30).toContainText('Conta PJ');
  await expect(projection30).toContainText('Conta Cofrinho');
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
});
