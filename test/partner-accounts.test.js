const test = require('node:test');
const assert = require('node:assert/strict');

process.env.VERCEL = '1';
process.env.CUMBUCA_AUTH_SECRET = 'cumbuca-partner-test-secret-2026-safe';
process.env.CUMBUCA_PASSWORD = 'cumbuca-partner-test-password';
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
  repairPartnerCashLinks,
  repairPartnerMovementsFromCash,
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

test('compensação escolhida fecha a diferença sem criar saída bancária', () => {
  const result = calculateWithdrawalDistribution({
    physicalBalance: 2522.12,
    savingsPercent: 10,
    partners: [
      {
        id: 'vanessa',
        share: 70,
        openingDebt: 397.99,
        compensation: 397.99,
        cashPaid: 1441.68,
      },
      {
        id: 'raquel',
        share: 30,
        openingDebt: 0,
        cashPaid: 788.43,
      },
    ],
  });
  const vanessa = result.partners.find((partner) => partner.id === 'vanessa');
  const raquel = result.partners.find((partner) => partner.id === 'raquel');

  assert.equal(result.distributionBase, 2920.11);
  assert.equal(result.expectedSavings, 292.01);
  assert.equal(vanessa.expectedRight, 1839.67);
  assert.equal(vanessa.cashPaid, 1441.68);
  assert.equal(vanessa.compensation, 397.99);
  assert.equal(vanessa.cashPaid + vanessa.compensation, vanessa.expectedRight);
  assert.equal(vanessa.pendingDistribution, 0);
  assert.equal(vanessa.remainingDebt, 0);
  assert.equal(raquel.expectedRight, 788.43);
  assert.equal(raquel.cashPaid, 788.43);
  assert.equal(raquel.compensation, 0);
  assert.equal(result.compensationTotal, 397.99);
  assert.equal(result.cashPaidTotal, 2522.12);
  assert.equal(result.accountAfterWithdrawal, 0);

  const compensation = movement({
    id: 'compensation-required-example',
    type: 'withdrawal_compensation',
    amount: vanessa.compensation,
    cashImpact: false,
  });
  assert.equal(cashEntrySpecForMovement(compensation), null);
  assert.equal(
    partnerBalances(
      account([movement({ id: 'debt-required-example', amount: '397.99' }), compensation])
    ).vanessa,
    0
  );
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

test('percentual do cofrinho nunca ultrapassa 100% da base de distribuicao', () => {
  const result = calculateWithdrawalDistribution({
    physicalBalance: 100,
    savingsPercent: 150,
    partners: [
      { id: 'vanessa', share: 70 },
      { id: 'raquel', share: 30 },
    ],
  });
  assert.equal(result.expectedSavings, 100);
  assert.equal(result.partnerPool, 0);
  assert.equal(result.compensationTotal, 0);
  assert.equal(result.accountAfterWithdrawal, 0);
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

test('reparo mantém somente o vínculo de caixa indicado pela movimentação', () => {
  const debit = movement({
    id: 'movement-duplicate',
    cashImpact: true,
    cashEntryId: 'cash-correct',
  });
  const rows = [
    { id: 'cash-correct', partnerMovementId: debit.id, amount: '100.00' },
    { id: 'cash-duplicate', partnerMovementId: debit.id, amount: '100.00' },
  ];

  const repaired = repairPartnerCashLinks(account([debit]), rows);
  assert.equal(repaired[0].partnerMovementId, debit.id);
  assert.equal(repaired[1].partnerMovementId, undefined);
  assert.equal(repaired[1].amount, '100.00');
});

test('reparo restaura a conta original de um lançamento existente vinculado', () => {
  const debit = movement({ id: 'debit-pf', cashImpact: true, cashEntryId: 'cash-pf' });
  const rows = [
    {
      ...linkedCashEntry(debit),
      cashAccount: 'pj',
      partnerAccountGenerated: false,
      partnerAccountOriginal: { cashAccount: 'pf' },
    },
  ];
  const repaired = repairPartnerCashLinks(account([debit]), rows);
  assert.equal(repaired[0].cashAccount, 'pf');
  assert.equal(repaired.length, 1);
});

test('reparo de vínculo antigo devolve a saída à data original sem duplicar o caixa', () => {
  const debit = movement({
    id: 'debit-vanessa-79',
    date: '2026-08-17',
    amount: '79.98',
    cashImpact: true,
    cashEntryId: 'cash-vanessa-79',
  });
  const rows = [
    {
      ...linkedCashEntry(debit),
      date: '2026-08-17',
      cashAccount: 'pj',
      partnerAccountGenerated: false,
      partnerAccountOriginal: {
        date: '2026-08-07',
        type: 'expense',
        amount: '79.98',
        cashAccount: 'pf',
        category: 'outros',
        description: 'Presente pai',
      },
    },
  ];

  const repairedAccount = repairPartnerMovementsFromCash(account([debit]), rows);
  const repairedRows = repairPartnerCashLinks(repairedAccount, rows);

  assert.equal(repairedAccount.movements[0].date, '2026-08-07');
  assert.equal(repairedRows[0].date, '2026-08-07');
  assert.equal(repairedRows[0].cashAccount, 'pf');
  assert.equal(repairedRows[0].description, 'Presente pai');
  assert.equal(repairedRows.length, 1);
  assert.equal(validatePartnerAccountState(repairedAccount, repairedRows).valid, true);
});

test('base informada divide apenas o valor escolhido e preserva o caixa real', () => {
  const result = calculateWithdrawalDistribution({
    physicalBalance: 2000,
    distributionBase: 1000,
    savingsPercent: 10,
    partners: [
      { id: 'vanessa', share: 70, openingDebt: 100 },
      { id: 'raquel', share: 30, openingDebt: 0 },
    ],
  });
  assert.equal(result.distributionBase, 1000);
  assert.equal(result.physicalBalance, 2000);
  assert.equal(result.expectedSavings, 100);
  assert.equal(result.partners[0].expectedRight, 630);
  assert.equal(result.partners[1].expectedRight, 270);
});

function withdrawalReversalFixture() {
  const debit = movement({ id: 'opening-debt', amount: '500.00', cashImpact: false });
  const payment = movement({
    id: 'payment',
    type: 'payment',
    amount: '200.00',
    cashEntryId: 'payment-cash',
    withdrawalSnapshotId: 'closed',
  });
  const compensation = movement({
    id: 'compensation',
    type: 'withdrawal_compensation',
    amount: '300.00',
    withdrawalSnapshotId: 'closed',
  });
  const snapshot = {
    id: 'closed',
    date: '2026-08-07',
    period: { start: '2026-08-03', end: '2026-08-09' },
    cashAccount: 'pj',
    physicalCash: '2000.00',
    receivablesTotal: '500.00',
    adjustedBase: '2500.00',
    companyReserve: '250.00',
    companyReservePaid: '250.00',
    cashPaidTotal: '2200.00',
    closedBy: 'Teste',
    withdrawalEntryIds: ['savings', 'vanessa', 'raquel'],
    partners: [
      {
        partnerId: 'vanessa',
        openingDebt: '500.00',
        openingMovementIds: ['opening-debt'],
        distributionRight: '1575.00',
        realPayment: '200.00',
        paymentMovementId: 'payment',
        compensation: '300.00',
        compensationMovementId: 'compensation',
        cashPaid: '1275.00',
        remainingDebt: '0.00',
      },
    ],
  };
  const cash = [
    {
      id: 'opening',
      date: snapshot.date,
      type: 'income',
      category: 'venda',
      cashAccount: 'pj',
      amount: '2000.00',
    },
    {
      id: 'payment-cash',
      date: snapshot.date,
      type: 'income',
      category: 'conta-socia',
      cashAccount: 'pj',
      amount: '200.00',
      partnerMovementId: 'payment',
    },
    ...[
      ['savings', '250.00'],
      ['vanessa', '1275.00'],
      ['raquel', '675.00'],
    ].map(([id, amount]) => ({
      id,
      amount,
      date: snapshot.date,
      type: 'expense',
      category: 'retirada',
      cashAccount: 'pj',
      partnerWithdrawalSnapshotId: snapshot.id,
    })),
  ];
  return { account: account([debit, payment, compensation], [snapshot]), cash };
}

function reversedWithdrawalFixture() {
  const original = withdrawalReversalFixture();
  const result = handleRequest._test.partnerAccountRules.buildWithdrawalReversal(
    original.account,
    original.cash,
    'closed',
    'Conta incorreta',
    'Teste',
    '2026-08-07T15:00:00Z'
  );
  const next = {
    ...original.account,
    movements: [...original.account.movements, ...result.movements],
    withdrawalReversals: [result.reversal],
  };
  return { original, result, next, cash: [...original.cash, ...result.cashEntries] };
}

test('estorno integral preserva fechamento e restaura caixa, dívida e Cofrinho', () => {
  const { original, result, next, cash } = reversedWithdrawalFixture();
  const validation = validatePartnerAccountState(
    next,
    cash,
    original.account,
    result.savingsHistory,
    original.cash
  );
  assert.equal(validation.valid, true, validation.errors.join('\n'));
  assert.equal(partnerBalances(original.account).vanessa, 0);
  assert.equal(partnerBalances(next).vanessa, 500);
  assert.equal(
    cash.reduce((sum, row) => sum + (row.type === 'income' ? 1 : -1) * Number(row.amount), 0),
    2000
  );
  assert.equal(result.savingsHistory[0].type, 'withdrawal');
  assert.equal(result.savingsHistory[0].amount, '250.00');
  assert.deepEqual(next.withdrawalSnapshots, original.account.withdrawalSnapshots);
  assert.deepEqual(next.movements.slice(0, 3), original.account.movements);
});

test('estorno exige motivo, impede repetição e rejeita movimentos faltantes', () => {
  const { original, result, next, cash } = reversedWithdrawalFixture();
  const build = handleRequest._test.partnerAccountRules.buildWithdrawalReversal;
  assert.throws(
    () => build(original.account, original.cash, 'closed', ' ', 'Teste', '2026-08-07T15:00:00Z'),
    /motivo/
  );
  assert.throws(
    () => build(next, cash, 'closed', 'Novamente', 'Teste', '2026-08-07T15:00:00Z'),
    /já foi estornada/
  );
  assert.equal(
    validatePartnerAccountState(next, cash.slice(0, -1), original.account, result.savingsHistory)
      .valid,
    false
  );
  assert.equal(validatePartnerAccountState(next, cash, original.account, []).valid, false);
  assert.equal(
    validatePartnerAccountState(
      { ...next, withdrawalReversals: [] },
      cash,
      next,
      result.savingsHistory
    ).valid,
    false
  );
  assert.equal(
    validatePartnerAccountState(
      { ...next, withdrawalReversals: [result.reversal, result.reversal] },
      cash,
      original.account,
      result.savingsHistory
    ).valid,
    false
  );
});

test('caixa da retirada fechada não pode ser alterado ou excluído isoladamente', () => {
  const { account: original, cash } = withdrawalReversalFixture();
  const edited = cash.map((row) => (row.id === 'vanessa' ? { ...row, amount: '1.00' } : row));
  assert.equal(validatePartnerAccountState(original, edited, original, [], cash).valid, false);
  assert.equal(
    validatePartnerAccountState(
      original,
      cash.filter((row) => row.id !== 'vanessa'),
      original,
      [],
      cash
    ).valid,
    false
  );
});

test('base manual do fechamento também é aceita pela validação do servidor', () => {
  const { account: original, cash } = withdrawalReversalFixture();
  const snapshot = {
    ...original.withdrawalSnapshots[0],
    adjustedBase: '1000.00',
    distributionBaseOverride: '1000.00',
  };
  const next = { ...original, withdrawalSnapshots: [snapshot] };
  assert.equal(validatePartnerAccountState(next, cash).valid, true);
  assert.equal(
    validatePartnerAccountState(
      { ...next, withdrawalSnapshots: [{ ...snapshot, distributionBaseOverride: '999.00' }] },
      cash
    ).valid,
    false
  );
});

test('estorno de retirada respeita fechamento mensal e mantém permissão de ajuste de sócias', () => {
  const { original, next, cash } = reversedWithdrawalFixture();
  const current = normalizeState({
    partnerAccounts: original.account,
    cashEntries: original.cash,
    monthlyClosings: { '2026-08': { closedAt: '2026-08-31T12:00:00Z' } },
  });
  const violation = stateWriteViolation(current, { partnerAccounts: next, cashEntries: cash });
  assert.ok(violation);
  assert.equal(partnerManualAdjustmentsChanged(original.account, next), true);
});
