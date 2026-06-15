const { test, expect } = require("@playwright/test");

async function login(page) {
  await page.goto("/login");
  await page.getByLabel("Login", { exact: true }).fill("cumbuca");
  await page.getByLabel("Senha", { exact: true }).fill("cumbuca2026");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).not.toHaveURL(/\/login$/);
}

async function expectNoHorizontalOverflow(page) {
  const dimensions = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
}

async function mockOnlineDatabase(page) {
  const holder = { state: {} };
  const json = body => ({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(body)
  });
  await page.route("**/api/health", route => route.fulfill(json({ status: "online", database: true })));
  await page.route("**/api/persistence-check", route => route.fulfill(json({ database: true, saved: true })));
  await page.route("**/api/financial-integrity", route => route.fulfill(json({
    database: true,
    status: "ok",
    checkedAt: new Date().toISOString(),
    totals: { balance: 0, adjustments: 0 },
    backup: { updatedAt: new Date().toISOString() },
    closings: { unlockedMonths: [], unlockedWeeks: [] },
    checks: []
  })));
  await page.route("**/api/state", async route => {
    if (route.request().method() === "POST") {
      holder.state = JSON.parse(route.request().postData() || "{}").state || {};
      await route.fulfill(json({ database: true, saved: true }));
      return;
    }
    await route.fulfill(json({ database: true, state: holder.state }));
  });
  return holder;
}

test.beforeEach(async ({ page }) => {
  page.on("pageerror", error => console.error(`Browser error: ${error.stack || error.message}`));
  await login(page);
  await page.goto("/financeiro");
  await expect(page.getByRole("heading", { name: "Financeiro", exact: true })).toBeVisible();
});

test("finance summary and pending dashboard fit the viewport", async ({ page }, testInfo) => {
  await expectNoHorizontalOverflow(page);
  await page.getByRole("button", { name: "Pendências", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Painel de pendências", exact: true })).toBeVisible();
  await expect(page.locator("#finance-pending-dashboard")).not.toContainText("Conferindo pendências...");
  await expectNoHorizontalOverflow(page);
  const screenshotPath = testInfo.outputPath("finance-pending.png");
  await page.screenshot({ path: screenshotPath, fullPage: true });
  await testInfo.attach("finance-pending.png", {
    path: screenshotPath,
    contentType: "image/png"
  });
});

test("accounts workflow is visible and responsive", async ({ page }, testInfo) => {
  await page.getByRole("button", { name: "Contas", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Contas a pagar e receber", exact: true })).toBeVisible();
  await expect(page.getByLabel("Descrição", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Vencimento", { exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  const screenshotPath = testInfo.outputPath("finance-accounts.png");
  await page.screenshot({ path: screenshotPath, fullPage: true });
  await testInfo.attach("finance-accounts.png", {
    path: screenshotPath,
    contentType: "image/png"
  });
});

test("reconciliation exposes authorized adjustment preview", async ({ page }, testInfo) => {
  await page.goto("/fluxo-de-caixa");
  await expect(page.getByRole("heading", { name: "Fluxo de Caixa", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Conferência", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Conferência diária", exact: true })).toBeVisible();
  await expect(page.getByLabel("Saldo real da conta", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Responsável", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Conferir e lançar ajuste", exact: true })).toBeEnabled();
  const formColumns = await page.evaluate(() =>
    getComputedStyle(document.querySelector("#daily-reconciliation-form")).gridTemplateColumns.split(" ").length
  );
  expect(formColumns).toBe(testInfo.project.name === "mobile" ? 1 : 4);
  await expectNoHorizontalOverflow(page);
  const screenshotPath = testInfo.outputPath("finance-reconciliation.png");
  await page.screenshot({ path: screenshotPath, fullPage: true });
  await testInfo.attach("finance-reconciliation.png", {
    path: screenshotPath,
    contentType: "image/png"
  });
});

test("controlled finance workflow covers installments, reversal, alerts and reconciliation", async ({ page }) => {
  const database = await mockOnlineDatabase(page);
  const today = new Date().toISOString().slice(0, 10);
  await page.goto("/financeiro?view=accounts");
  await expect(page.getByRole("heading", { name: "Contas a pagar e receber", exact: true })).toBeVisible();

  await page.getByLabel("Descrição", { exact: true }).fill("Teste fornecedor");
  await page.getByLabel("Vencimento", { exact: true }).fill(today);
  await page.getByLabel("Valor total", { exact: true }).fill("100,00");
  await page.locator("#financial-account-schedule").selectOption("installments");
  await page.locator('#financial-account-count-field input[name="scheduleCount"]').fill("3");
  await page.getByRole("button", { name: "Adicionar conta", exact: true }).click();
  await expect(page.locator(".account-row")).toHaveCount(3);
  expect(database.state.financialPlanning.accounts.map(account => account.amount)).toEqual(["33.34", "33.33", "33.33"]);
  expect(await page.evaluate(() => addMonthsClamped("2026-01-31", 1))).toBe("2026-02-28");

  await page.getByLabel("Descrição", { exact: true }).fill("Assinatura mensal");
  await page.getByLabel("Vencimento", { exact: true }).fill(today);
  await page.getByLabel("Valor total", { exact: true }).fill("25,00");
  await page.locator("#financial-account-schedule").selectOption("monthly");
  await page.locator('#financial-account-count-field input[name="scheduleCount"]').fill("2");
  await page.getByRole("button", { name: "Adicionar conta", exact: true }).click();
  await expect(page.locator(".account-row")).toHaveCount(5);
  expect(database.state.financialPlanning.accounts.slice(0, 2).map(account => account.amount)).toEqual(["25.00", "25.00"]);

  let firstAccount = page.locator(".account-row").filter({ hasText: "Teste fornecedor" }).first();
  await firstAccount.locator('form[data-account-settlement] input[name="amount"]').fill("30,00");
  await firstAccount.getByRole("button", { name: "Registrar pagamento", exact: true }).click();
  firstAccount = page.locator(".account-row").filter({ hasText: "Teste fornecedor" }).first();
  await expect(firstAccount).toContainText("R$ 30,00");
  await firstAccount.locator("details").click();

  const reversalDialogs = async dialog => {
    if (dialog.type() === "prompt" && dialog.message().includes("Data do estorno")) {
      await dialog.accept(today);
    } else if (dialog.type() === "prompt") {
      await dialog.accept("Teste automatizado");
    } else {
      await dialog.accept();
    }
  };
  page.on("dialog", reversalDialogs);
  await firstAccount.getByRole("button", { name: "Estornar", exact: true }).click();
  page.off("dialog", reversalDialogs);
  firstAccount = page.locator(".account-row").filter({ hasText: "Teste fornecedor" }).first();
  await firstAccount.locator("details").click();
  await expect(firstAccount).toContainText("Estornado");

  await page.goto("/alertas");
  await expect(page.locator(".alert-card").filter({ hasText: "Conta vence em breve" }).first()).toBeVisible();

  await page.goto("/fluxo-de-caixa");
  await page.getByRole("button", { name: "Conferência", exact: true }).click();
  await page.getByLabel("Saldo real da conta", { exact: true }).fill("50,00");
  page.once("dialog", dialog => dialog.accept());
  await page.getByRole("button", { name: "Conferir e lançar ajuste", exact: true }).click();
  await expect.poll(() => database.state.cashEntries?.some(entry => entry.reconciliation)).toBe(true);
  expect(database.state.financialPlanning.accounts).toHaveLength(5);
  const testedAccount = database.state.financialPlanning.accounts.find(account => account.description === "Teste fornecedor");
  expect(testedAccount.payments[0].reversedAt).toBeTruthy();
});
