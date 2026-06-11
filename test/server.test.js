const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");

process.env.VERCEL = "1";
const handleRequest = require("../server");
const {
  backupVersionId,
  calculateCashFlow,
  legacyBackupDate,
  normalizeState
} = handleRequest._test;

test("calculateCashFlow normalizes values and preserves entry IDs", () => {
  const result = calculateCashFlow([
    { id: "out-1", description: "Compra", date: "2026-06-02", type: "expense", amount: -30, category: "insumos" },
    { id: "in-1", description: "Venda", date: "2026-06-01", type: "income", amount: "100", category: "vendas" }
  ]);

  assert.equal(result.income, 100);
  assert.equal(result.expenses, 30);
  assert.equal(result.balance, 70);
  assert.deepEqual(result.entries.map(entry => entry.id), ["in-1", "out-1"]);
  assert.equal(result.entries[1].amount, 30);
});

test("normalizeState fills missing keys without replacing supplied values", () => {
  const cashEntries = [{ id: "entry-1", amount: 50 }];
  const state = normalizeState({ cashEntries });

  assert.equal(state.cashEntries, cashEntries);
  assert.deepEqual(state.clients, []);
  assert.deepEqual(state.weeklyClosings, {});
  assert.equal(state.appConfig.storeName, "Cumbuca");
});

test("automatic backups share one version per UTC hour", () => {
  const first = backupVersionId("automatic", new Date("2026-06-10T12:05:00.000Z"));
  const second = backupVersionId("automatic", new Date("2026-06-10T12:59:59.000Z"));

  assert.equal(first, "2026-06-10T12:00:00.000Z-automatic");
  assert.equal(second, first);
});

test("protected backups receive unique version IDs", () => {
  const date = new Date("2026-06-10T12:05:00.000Z");
  const first = backupVersionId("pre-reset", date);
  const second = backupVersionId("pre-reset", date);

  assert.notEqual(first, second);
  assert.match(first, /^\d{17}-pre-reset-[a-f0-9]{8}$/);
});

test("legacy backup references resolve to the original date", () => {
  assert.equal(legacyBackupDate("2026-06-10"), "2026-06-10");
  assert.equal(legacyBackupDate("legacy-2026-06-10"), "2026-06-10");
  assert.equal(legacyBackupDate("2026-06-10T12:00:00.000Z-automatic"), "");
});

test("financial reset endpoints require authentication", async t => {
  const server = http.createServer(handleRequest);
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const { port } = server.address();

  for (const pathname of ["/api/reset-financial-state", "/api/reset-state"]) {
    const response = await fetch(`http://127.0.0.1:${port}${pathname}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    });
    const payload = await response.json();

    assert.equal(response.status, 401);
    assert.match(payload.error, /login/i);
  }
});
