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
