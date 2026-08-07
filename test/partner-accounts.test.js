const test = require('node:test');
const assert = require('node:assert/strict');

process.env.VERCEL = '1';
const handleRequest = require('../server');
const {
  calculateWithdrawalDistribution,
  cashEntrySpecForMovement,
  defaultPartnerAccounts,
  isPartnerCashEntry,
  movementEffect,
  normalizePartnerAccounts,
  partnerAccountSummary,
  partnerBalances,
  validatePartnerAccountState,
} = handleRequest._test.partnerAccountRules;
const { normalizeState, partnerManualAdjustmentsChanged, stateWriteViolation } =
  handleRequest._test;

function movement(overrides = {}) {
  return {
    id: overrides.id || `movement-${Math.random()}`,
    partnerId: 'vanessa',
    date: '2026-08-07',
    type: 'debit',
    description: 'Uso pessoal',
    amount: '100.00',
    origin: 'pj',
    observation: '',
    direction: '',
    cashImpact: false,
    cashEntryId: '',
    createdAt: '2026-08-07T12:00:00.000Z',
    ...overrides,
  };
}

function account(movements = [], withdrawalSnapshots = []) {
  return {
    ...defaultPartnerAccounts(),
    movements,
    withdrawalSnapshots,
  };
}

function linkedCashEntry(row, overrides = {}) {
  const spec = cashEntrySpecForMovement(row);
  return {
    id: row.cashEntryId,
    partnerMovementId: row.id,
    nonOperationalPartnerAccount: true,
    category: 'conta-socia',
    description: row.description,
    date: spec.date,
    type: spec.type,
    amount: spec.amount.toFixed(2),
    ...overrides,
  };
}

test('débito de sócia aumenta o saldo devedor', () => {
  const result = partnerBalances(account([movement({ amount: '500.00' })]));
  assert.equal(result.vanessa, 500);
});

test('pagamento real reduz o saldo e exige entrada de caixa', () => {
  const debit = movement({ id: 'debit-1', amount: '500.00' });
  const payment = movement({
    id: 'payment-1',
    type: 'payment',
    amount: '200.00',
    origin: 'pix',
    cashImpact: true,
    cashEntryId: 'cash-payment-1',
  });
  assert.equal(partnerBalances(account([debit, payment])).vanessa, 300);
  assert.deepEqual(cashEntrySpecForMovement(payment), {
    type: 'income',
    amount: 200,
    date: '2026-08-07',
  });
});

test('compensação reduz a dívida sem criar entrada de caixa', () => {
  const compensation = movement({
    type: 'withdrawal_compensation',
    amount: '200.00',
    origin: 'withdrawal',
    cashImpact: false,
    withdrawalSnapshotId: 'snapshot-1',
  });
  assert.equal(movementEffect(compensation), -200);
  assert.equal(cashEntrySpecForMovement(compensation), null);
});

test('pagamento parcial mantém o saldo restante', () => {
  const rows = [
    movement({ id: 'debit-1', amount: '500.00' }),
    movement({ id: 'payment-1', type: 'payment', amount: '200.00', cashImpact: true }),
  ];
  assert.equal(partnerBalances(account(rows)).vanessa, 300);
});

test('dívida de uma sócia não afeta a outra', () => {
  const result = partnerBalances(
    account([
      movement({ id: 'debit-vanessa', partnerId: 'vanessa', amount: '500.00' }),
      movement({ id: 'debit-raquel', partnerId: 'raquel', amount: '40.00' }),
    ])
  );
  assert.deepEqual(result, { vanessa: 500, raquel: 40 });
});

test('lançamento da conta-corrente é classificado como caixa não operacional', () => {
  assert.equal(
    isPartnerCashEntry({ category: 'conta-socia', nonOperationalPartnerAccount: true }),
    true
  );
  assert.equal(isPartnerCashEntry({ category: 'supermercado' }), false);
});

test('débito pessoal com saída real produz somente uma especificação de caixa', () => {
  const debit = movement({ cashImpact: true, cashEntryId: 'cash-debit-1' });
  assert.deepEqual(cashEntrySpecForMovement(debit), {
    type: 'expense',
    amount: 100,
    date: '2026-08-07',
  });
});

test('base ajustada soma caixa real e valores a receber', () => {
  const result = calculateWithdrawalDistribution({
    physicalBalance: 2000,
    savingsPercent: 10,
    partners: [
      { id: 'vanessa', share: 70, openingDebt: 500, compensation: 500 },
      { id: 'raquel', share: 30, openingDebt: 0, compensation: 0 },
    ],
  });
  assert.equal(result.distributionBase, 2500);
  assert.equal(result.expectedSavings, 250);
});

test('dívida não altera artificialmente o caixa físico', () => {
  const result = calculateWithdrawalDistribution({
    physicalBalance: 2000,
    savingsPercent: 10,
    partners: [{ id: 'vanessa', share: 100, openingDebt: 500, compensation: 500 }],
  });
  assert.equal(result.physicalBalance, 2000);
  assert.equal(result.cashAvailable, 2000);
  assert.equal(result.compensationTotal, 500);
});

test('compensação reduz corretamente o valor transferido à sócia', () => {
  const result = calculateWithdrawalDistribution({
    physicalBalance: 2000,
    savingsPercent: 10,
    partners: [{ id: 'vanessa', share: 100, openingDebt: 500, compensation: 500 }],
  });
  assert.equal(result.partners[0].expectedRight, 2250);
  assert.equal(result.partners[0].cashPaid, 1750);
  assert.equal(result.partners[0].remainingDebt, 0);
});

test('pagamento real aumenta caixa disponível sem mudar a base ajustada', () => {
  const result = calculateWithdrawalDistribution({
    physicalBalance: 2000,
    savingsPercent: 10,
    partners: [
      { id: 'vanessa', share: 70, openingDebt: 500, realPayment: 200, compensation: 0 },
      { id: 'raquel', share: 30, openingDebt: 0 },
    ],
  });
  assert.equal(result.distributionBase, 2500);
  assert.equal(result.cashAvailable, 2200);
  assert.equal(result.partners[0].remainingDebt, 300);
});

test('histórico soma débitos, pagamentos, compensações e ajustes', () => {
  const rows = [
    movement({ id: 'debit-1', amount: '500.00' }),
    movement({ id: 'payment-1', type: 'payment', amount: '100.00' }),
    movement({ id: 'comp-1', type: 'withdrawal_compensation', amount: '200.00' }),
    movement({
      id: 'adjustment-1',
      type: 'manual_adjustment',
      amount: '25.00',
      direction: 'increase',
      observation: 'Correção',
    }),
  ];
  assert.deepEqual(partnerAccountSummary(account(rows), 'vanessa'), {
    debits: 500,
    payments: 100,
    compensations: 200,
    adjustments: 25,
    periodBalance: 225,
    currentBalance: 225,
  });
});

test('validação impede dois movimentos ligados ao mesmo lançamento de caixa', () => {
  const first = movement({ id: 'debit-1', cashImpact: true, cashEntryId: 'cash-1' });
  const second = movement({ id: 'debit-2', cashImpact: true, cashEntryId: 'cash-1' });
  const validation = validatePartnerAccountState(account([first, second]), [
    linkedCashEntry(first),
  ]);
  assert.equal(validation.valid, false);
  assert.match(validation.errors.join(' '), /exclusivo/i);
});

test('ajuste manual exige observação e valor positivo', () => {
  const invalid = movement({
    id: 'adjustment-1',
    type: 'manual_adjustment',
    amount: '-10',
    direction: 'increase',
    observation: '',
  });
  const validation = validatePartnerAccountState(account([invalid]), []);
  assert.equal(validation.valid, false);
  assert.match(validation.errors.join(' '), /positivo/i);
  assert.match(validation.errors.join(' '), /observação/i);
});

test('quebra semanal aceita snapshot com caixa, direitos e saldos usados', () => {
  const debit = movement({ id: 'debit-1', amount: '500.00' });
  const compensation = movement({
    id: 'comp-1',
    type: 'withdrawal_compensation',
    amount: '500.00',
    withdrawalSnapshotId: 'snapshot-1',
  });
  const snapshot = {
    id: 'snapshot-1',
    date: '2026-08-07',
    period: { start: '2026-08-03', end: '2026-08-09' },
    physicalCash: '2000.00',
    receivablesTotal: '500.00',
    adjustedBase: '2500.00',
    companyReserve: '250.00',
    cashPaidTotal: '2000.00',
    closedBy: 'Teste',
    partners: [
      {
        partnerId: 'vanessa',
        openingDebt: '500.00',
        openingMovementIds: ['debit-1'],
        distributionRight: '1750.00',
        realPayment: '0.00',
        paymentMovementId: '',
        compensation: '500.00',
        compensationMovementId: 'comp-1',
        cashPaid: '1250.00',
        remainingDebt: '0.00',
      },
    ],
  };
  const validation = validatePartnerAccountState(account([debit, compensation], [snapshot]), []);
  assert.equal(validation.valid, true, validation.errors.join('\n'));
});

test('alteração posterior não modifica snapshot de quebra já fechada', () => {
  const snapshot = { id: 'snapshot-1', date: '2026-08-07', partners: [] };
  const previous = account([], [snapshot]);
  const next = account([], [{ ...snapshot, adjustedBase: '9999.00' }]);
  const validation = validatePartnerAccountState(next, [], previous);
  assert.equal(validation.valid, false);
  assert.match(validation.errors.join(' '), /não pode ser alterada/i);
});

test('movimentação usada em quebra deve ser estornada e não editada', () => {
  const debit = movement({ id: 'debit-1', amount: '500.00' });
  const snapshot = {
    id: 'snapshot-1',
    date: '2026-08-07',
    partners: [{ partnerId: 'vanessa', openingMovementIds: ['debit-1'] }],
  };
  const previous = account([debit], [snapshot]);
  const next = account([{ ...debit, amount: '400.00' }], [snapshot]);
  const validation = validatePartnerAccountState(next, [], previous);
  assert.equal(validation.valid, false);
  assert.match(validation.errors.join(' '), /deve ser estornada/i);
});

test('período financeiro fechado impede mudança na conta-corrente', () => {
  const current = normalizeState({
    partnerAccounts: account([]),
    monthlyClosings: { '2026-08': { locked: true } },
  });
  const violation = stateWriteViolation(current, {
    partnerAccounts: account([movement({ id: 'debit-1' })]),
  });
  assert.equal(violation.statusCode, 409);
  assert.match(violation.message, /fechado/i);
});

test('mudança em ajuste manual aciona a permissão específica', () => {
  const previous = account([]);
  const next = account([
    movement({
      id: 'adjustment-1',
      type: 'manual_adjustment',
      direction: 'increase',
      observation: 'Correção autorizada',
    }),
  ]);
  assert.equal(partnerManualAdjustmentsChanged(previous, next), true);
});

test('normalização adiciona sócias sem migrar ou apagar histórico', () => {
  const originalMovement = movement({ id: 'historical-1' });
  const normalized = normalizePartnerAccounts({ movements: [originalMovement] });
  assert.deepEqual(
    normalized.partners.map((partner) => partner.id),
    ['vanessa', 'raquel']
  );
  assert.equal(normalized.movements[0], originalMovement);
});
