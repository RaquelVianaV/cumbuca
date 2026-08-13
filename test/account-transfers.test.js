const test = require('node:test');
const assert = require('node:assert/strict');

const {
  accountBalanceEffects,
  accountTransferCashEntries,
  accountTransferSavingsEntry,
  isAccountTransferCashEntry,
  normalizeAccountTransfers,
  normalizedAccountTransfer,
  validateAccountTransferState,
} = require('../public/account-transfers');

function transfer(overrides = {}) {
  return normalizedAccountTransfer({
    id: 'transfer-main',
    date: '2026-08-10',
    origin: 'pf',
    destination: 'pj',
    amount: 1000,
    description: 'Transferência para PJ',
    ...overrides,
  });
}

test('PF para PJ altera os saldos individuais e preserva o consolidado', () => {
  const effects = accountBalanceEffects(transfer());
  assert.deepEqual(effects, { pf: -1000, pj: 1000, savings: 0, totalCash: 0 });

  const initial = { pf: 3000, pj: 2000, savings: 500 };
  const final = {
    pf: initial.pf + effects.pf,
    pj: initial.pj + effects.pj,
    savings: initial.savings + effects.savings,
  };
  assert.deepEqual(final, { pf: 2000, pj: 3000, savings: 500 });
  assert.equal(initial.pf + initial.pj + initial.savings, 5500);
  assert.equal(final.pf + final.pj + final.savings, 5500);
});

test('PJ para PF preserva o saldo consolidado', () => {
  const effects = accountBalanceEffects(transfer({ origin: 'pj', destination: 'pf', amount: 250 }));
  assert.deepEqual(effects, { pf: 250, pj: -250, savings: 0, totalCash: 0 });
  assert.equal(effects.pf + effects.pj + effects.savings, 0);
});

test('transferências com Cofrinho preservam o saldo consolidado', () => {
  const toSavings = accountBalanceEffects(
    transfer({ origin: 'pj', destination: 'savings', amount: 300 })
  );
  const fromSavings = accountBalanceEffects(
    transfer({ origin: 'savings', destination: 'pj', amount: 125 })
  );
  assert.deepEqual(toSavings, { pf: 0, pj: -300, savings: 300, totalCash: -300 });
  assert.deepEqual(fromSavings, { pf: 0, pj: 125, savings: -125, totalCash: 125 });
  assert.equal(toSavings.pf + toSavings.pj + toSavings.savings, 0);
  assert.equal(fromSavings.pf + fromSavings.pj + fromSavings.savings, 0);
});

test('as duas pontas de PF para PJ compartilham o mesmo transferId', () => {
  const row = transfer();
  const entries = accountTransferCashEntries(row);
  assert.equal(entries.length, 2);
  assert.equal(entries[0].type, 'expense');
  assert.equal(entries[0].cashAccount, 'pf');
  assert.equal(entries[1].type, 'income');
  assert.equal(entries[1].cashAccount, 'pj');
  assert.ok(entries.every((entry) => entry.transferId === row.id));
  assert.ok(entries.every((entry) => entry.accountTransferId === row.id));
  assert.ok(entries.every(isAccountTransferCashEntry));
});

test('Cofrinho gera uma única ponta no caixa e uma única ponta no histórico próprio', () => {
  const row = transfer({ origin: 'pj', destination: 'savings', amount: 300 });
  const cashEntries = accountTransferCashEntries(row);
  const savingsEntry = accountTransferSavingsEntry(row);
  assert.equal(cashEntries.length, 1);
  assert.match(cashEntries[0].id, /-source$/);
  assert.equal(savingsEntry.type, 'deposit');
  assert.equal(savingsEntry.amount, '300.00');
  assert.equal(savingsEntry.transferId, row.id);

  const reverseRow = transfer({ origin: 'savings', destination: 'pj', amount: 100 });
  assert.equal(accountTransferSavingsEntry(reverseRow).type, 'withdrawal');
  assert.equal(accountTransferCashEntries(reverseRow)[0].type, 'income');
});

test('validação impede origem igual ao destino e pontas duplicadas ou ausentes', () => {
  const invalidAccounts = transfer({ origin: 'pf', destination: 'pf' });
  assert.equal(validateAccountTransferState([invalidAccounts], [], []).valid, false);

  const row = transfer();
  const entries = accountTransferCashEntries(row);
  assert.equal(validateAccountTransferState([row], entries, []).valid, true);
  assert.equal(validateAccountTransferState([row], [entries[0]], []).valid, false);
  assert.equal(validateAccountTransferState([row], [...entries, entries[0]], []).valid, false);
});

test('estorno inverte a operação e restaura os saldos', () => {
  const original = transfer();
  const reversal = transfer({
    id: 'transfer-reversal',
    origin: original.destination,
    destination: original.origin,
    amount: original.amount,
    reversalOf: original.id,
  });
  const originalEffects = accountBalanceEffects(original);
  const reversalEffects = accountBalanceEffects(reversal);
  assert.equal(originalEffects.pf + reversalEffects.pf, 0);
  assert.equal(originalEffects.pj + reversalEffects.pj, 0);
  assert.equal(originalEffects.savings + reversalEffects.savings, 0);
  assert.equal(
    validateAccountTransferState(
      [original, reversal],
      [...accountTransferCashEntries(original), ...accountTransferCashEntries(reversal)],
      []
    ).valid,
    true
  );
});

test('normalização preserva uma operação única sem criar registros extras', () => {
  const rows = normalizeAccountTransfers([transfer()]);
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0].cashEntryIds, ['transfer-main-source', 'transfer-main-destination']);
  assert.equal(rows[0].savingsEntryId, '');
});

test('transferência pode superar o saldo disponível da conta de origem', () => {
  const row = transfer({ amount: 1000 });
  const entries = accountTransferCashEntries(row);

  assert.equal(validateAccountTransferState([row], entries, []).valid, true);
  assert.equal(accountBalanceEffects(row).pf, -1000);
});
