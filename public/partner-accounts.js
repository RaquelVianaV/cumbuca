(function initPartnerAccountRules(root, factory) {
  const rules = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = rules;
  }
  if (root) {
    root.CumbucaPartnerAccounts = rules;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function partnerAccountRulesFactory() {
  "use strict";

  const MOVEMENT_TYPES = new Set([
    "debit",
    "payment",
    "withdrawal_compensation",
    "manual_adjustment"
  ]);
  const DEFAULT_PARTNERS = [
    { id: "vanessa", name: "Vanessa", active: true },
    { id: "raquel", name: "Raquel", active: true }
  ];

  function roundedMoney(value) {
    return Math.round(Number(value || 0) * 100) / 100;
  }

  function positiveMoney(value) {
    return Math.max(0, roundedMoney(value));
  }

  function defaultPartnerAccounts() {
    return {
      partners: DEFAULT_PARTNERS.map(partner => ({ ...partner })),
      movements: [],
      withdrawalSnapshots: [],
      withdrawalReversals: []
    };
  }

  function normalizePartnerAccounts(value = {}) {
    const source = value && typeof value === "object" ? value : {};
    const partners = Array.isArray(source.partners) && source.partners.length
      ? source.partners.map(partner => ({
          id: String(partner?.id || "").trim().toLowerCase(),
          name: String(partner?.name || partner?.id || "").trim(),
          active: partner?.active !== false
        }))
      : DEFAULT_PARTNERS.map(partner => ({ ...partner }));
    return {
      partners,
      withdrawalReversals: Array.isArray(source.withdrawalReversals) ? source.withdrawalReversals : [],
      movements: Array.isArray(source.movements) ? source.movements : [],
      withdrawalSnapshots: Array.isArray(source.withdrawalSnapshots)
        ? source.withdrawalSnapshots
        : []
    };
  }

  function movementEffect(movement = {}) {
    const amount = positiveMoney(movement.amount);
    if (movement.type === "debit") {
      return amount;
    }
    if (["payment", "withdrawal_compensation"].includes(movement.type)) {
      return -amount;
    }
    if (movement.type === "manual_adjustment") {
      return movement.direction === "decrease" ? -amount : amount;
    }
    return 0;
  }

  function movementHasCashImpact(movement = {}) {
    if (movement.type === "payment") {
      return true;
    }
    return movement.type === "debit" && movement.cashImpact !== false;
  }

  function isPartnerCashEntry(entry = {}) {
    return Boolean(
      entry.nonOperationalPartnerAccount === true ||
      entry.partnerMovementId ||
      String(entry.category || "").toLowerCase() === "conta-socia"
    );
  }

  function cashEntrySpecForMovement(movement = {}) {
    if (!movementHasCashImpact(movement)) {
      return null;
    }
    return {
      type: movement.type === "payment" ? "income" : "expense",
      amount: positiveMoney(movement.amount),
      date: String(movement.date || "").slice(0, 10)
    };
  }

  function repairPartnerCashLinks(account = {}, cashEntries = []) {
    const normalized = normalizePartnerAccounts(account);
    const sourceEntries = Array.isArray(cashEntries) ? cashEntries : [];
    const expectedLinks = new Map(
      normalized.movements
        .filter(movement => cashEntrySpecForMovement(movement) && movement.cashEntryId)
        .map(movement => [String(movement.id || ""), String(movement.cashEntryId || "")])
    );
    let changed = false;
    const repairedEntries = sourceEntries.map(entry => {
      const movementId = String(entry.partnerMovementId || "");
      const validLink = movementId
        && expectedLinks.get(movementId) === String(entry.id || "");
      const original = entry.partnerAccountOriginal;
      if (
        validLink
        && entry.partnerAccountGenerated === false
        && original
        && typeof original === "object"
      ) {
        const restored = {
          ...entry,
          ...original,
          partnerMovementId: entry.partnerMovementId,
          nonOperationalPartnerAccount: true,
          partnerAccountGenerated: false,
          partnerAccountOriginal: original
        };
        if (JSON.stringify(restored) !== JSON.stringify(entry)) changed = true;
        return restored;
      }
      if (!movementId || validLink) {
        return entry;
      }
      const repaired = { ...entry };
      delete repaired.partnerMovementId;
      changed = true;
      return repaired;
    });
    return changed ? repairedEntries : sourceEntries;
  }

  function repairPartnerMovementsFromCash(account = {}, cashEntries = []) {
    const normalized = normalizePartnerAccounts(account);
    const entriesById = new Map(
      (Array.isArray(cashEntries) ? cashEntries : []).map(entry => [String(entry.id || ""), entry])
    );
    let changed = false;
    const movements = normalized.movements.map(movement => {
      const entry = entriesById.get(String(movement.cashEntryId || ""));
      const original = entry?.partnerAccountOriginal;
      if (entry?.partnerAccountGenerated !== false || !original || typeof original !== "object") {
        return movement;
      }
      const date = String(original.date || "").slice(0, 10);
      const amount = positiveMoney(original.amount);
      const type = original.type === "income" ? "payment" : "debit";
      if (!date || amount <= 0) return movement;
      const repaired = { ...movement, date, amount: amount.toFixed(2), type, cashImpact: true };
      if (JSON.stringify(repaired) !== JSON.stringify(movement)) changed = true;
      return repaired;
    });
    return changed ? { ...normalized, movements } : normalized;
  }

  function movementsThroughDate(account = {}, throughDate = "") {
    const movements = normalizePartnerAccounts(account).movements;
    const end = String(throughDate || "").slice(0, 10);
    return end ? movements.filter(movement => String(movement.date || "") <= end) : movements;
  }

  function partnerBalances(account = {}, throughDate = "") {
    const normalized = normalizePartnerAccounts(account);
    const balances = Object.fromEntries(normalized.partners.map(partner => [partner.id, 0]));
    movementsThroughDate(normalized, throughDate).forEach(movement => {
      const partnerId = String(movement.partnerId || "").toLowerCase();
      balances[partnerId] = roundedMoney((balances[partnerId] || 0) + movementEffect(movement));
    });
    return balances;
  }

  function partnerAccountSummary(account = {}, partnerId = "", options = {}) {
    const normalizedId = String(partnerId || "").toLowerCase();
    const start = String(options.start || "").slice(0, 10);
    const end = String(options.end || "").slice(0, 10);
    const rows = normalizePartnerAccounts(account).movements
      .filter(movement => String(movement.partnerId || "").toLowerCase() === normalizedId)
      .filter(movement => !start || String(movement.date || "") >= start)
      .filter(movement => !end || String(movement.date || "") <= end);
    const summary = rows.reduce((totals, movement) => {
      const amount = positiveMoney(movement.amount);
      if (movement.type === "debit") totals.debits += amount;
      if (movement.type === "payment") totals.payments += amount;
      if (movement.type === "withdrawal_compensation") totals.compensations += amount;
      if (movement.type === "manual_adjustment") totals.adjustments += movementEffect(movement);
      totals.periodBalance += movementEffect(movement);
      return totals;
    }, { debits: 0, payments: 0, compensations: 0, adjustments: 0, periodBalance: 0 });
    const currentBalance = partnerBalances(account)[normalizedId] || 0;
    return Object.fromEntries(
      Object.entries({ ...summary, currentBalance }).map(([key, value]) => [key, roundedMoney(value)])
    );
  }

  function calculateWithdrawalDistribution(input = {}) {
    const physicalBalance = positiveMoney(input.physicalBalance);
    const savingsPercent = Math.min(100, positiveMoney(input.savingsPercent));
    const partners = Array.isArray(input.partners) ? input.partners.map(partner => ({
      id: String(partner.id || "").toLowerCase(),
      name: String(partner.name || partner.id || ""),
      share: positiveMoney(partner.share),
      openingDebt: positiveMoney(partner.openingDebt),
      realPayment: positiveMoney(partner.realPayment),
      compensation: positiveMoney(partner.compensation),
      cashPaid: partner.cashPaid == null ? null : positiveMoney(partner.cashPaid)
    })) : [];
    const openingDebtTotal = roundedMoney(
      partners.reduce((sum, partner) => sum + partner.openingDebt, 0)
    );
    const distributionBase = input.distributionBase == null
      ? roundedMoney(physicalBalance + openingDebtTotal)
      : positiveMoney(input.distributionBase);
    const expectedSavings = roundedMoney(distributionBase * (savingsPercent / 100));
    const partnerPool = roundedMoney(distributionBase - expectedSavings);
    const shareTotal = partners.reduce((sum, partner) => sum + partner.share, 0) || 100;
    let assignedRights = 0;
    const calculatedPartners = partners.map((partner, index) => {
      const expectedRight = index === partners.length - 1
        ? roundedMoney(partnerPool - assignedRights)
        : roundedMoney(partnerPool * (partner.share / shareTotal));
      assignedRights = roundedMoney(assignedRights + expectedRight);
      const realPayment = Math.min(partner.openingDebt, partner.realPayment);
      const debtAfterPayment = roundedMoney(partner.openingDebt - realPayment);
      const compensation = Math.min(debtAfterPayment, expectedRight, partner.compensation);
      return {
        ...partner,
        expectedRight,
        realPayment,
        debtAfterPayment,
        compensation,
        remainingDebt: roundedMoney(debtAfterPayment - compensation),
        netClaim: roundedMoney(expectedRight - compensation)
      };
    });
    const realPaymentsTotal = roundedMoney(
      calculatedPartners.reduce((sum, partner) => sum + partner.realPayment, 0)
    );
    const cashAvailable = roundedMoney(physicalBalance + realPaymentsTotal);
    const savingsPaid = Math.min(expectedSavings, cashAvailable);
    const availableForPartners = roundedMoney(Math.max(0, cashAvailable - savingsPaid));
    const claimsTotal = roundedMoney(
      calculatedPartners.reduce((sum, partner) => sum + partner.netClaim, 0)
    );
    const paymentRatio = claimsTotal > availableForPartners && claimsTotal > 0
      ? availableForPartners / claimsTotal
      : 1;
    let partnerCashAssigned = 0;
    calculatedPartners.forEach((partner, index) => {
      const availableCash = roundedMoney(Math.max(0, availableForPartners - partnerCashAssigned));
      const cashPaid = partner.cashPaid == null
        ? index === calculatedPartners.length - 1
          ? Math.min(partner.netClaim, availableCash)
          : Math.min(partner.netClaim, roundedMoney(partner.netClaim * paymentRatio))
        : Math.min(partner.netClaim, partner.cashPaid, availableCash);
      partner.cashPaid = roundedMoney(Math.max(0, cashPaid));
      partnerCashAssigned = roundedMoney(partnerCashAssigned + partner.cashPaid);
      partner.pendingDistribution = roundedMoney(partner.netClaim - partner.cashPaid);
    });
    const compensationTotal = roundedMoney(
      calculatedPartners.reduce((sum, partner) => sum + partner.compensation, 0)
    );
    const cashPaidTotal = roundedMoney(savingsPaid + partnerCashAssigned);
    return {
      physicalBalance,
      openingDebtTotal,
      distributionBase,
      expectedTotal: roundedMoney(expectedSavings + partnerPool),
      expectedSavings,
      savingsPaid,
      partnerPool,
      partners: calculatedPartners,
      realPaymentsTotal,
      cashAvailable,
      compensationTotal,
      cashPaidTotal,
      accountAfterWithdrawal: roundedMoney(Math.max(0, cashAvailable - cashPaidTotal))
    };
  }

  function snapshotMovementIds(snapshot = {}) {
    return new Set(
      (Array.isArray(snapshot.partners) ? snapshot.partners : []).flatMap(partner => [
        ...(Array.isArray(partner.openingMovementIds) ? partner.openingMovementIds : []),
        partner.paymentMovementId,
        partner.compensationMovementId
      ]).filter(Boolean).map(String)
    );
  }

  function consolidatedMovementIds(account = {}) {
    const ids = new Set();
    normalizePartnerAccounts(account).withdrawalSnapshots.forEach(snapshot => {
      snapshotMovementIds(snapshot).forEach(id => ids.add(id));
    });
    return ids;
  }

  function buildWithdrawalReversal(account, cashEntries, snapshotId, reason, createdBy, createdAt) {
    const normalized = normalizePartnerAccounts(account);
    const snapshot = normalized.withdrawalSnapshots.find(row => row.id === snapshotId);
    if (!snapshot) throw new Error("Retirada não encontrada. Revise os registros antigos antes de estornar.");
    if (!String(reason || "").trim()) throw new Error("Informe o motivo do estorno.");
    if (!String(createdBy || "").trim() || !Number.isFinite(Date.parse(createdAt))) throw new Error("Responsável ou data do estorno inválidos.");
    if (normalized.withdrawalReversals.some(row => row.snapshotId === snapshotId)) throw new Error("Esta retirada já foi estornada.");
    const id = `withdrawal-reversal-${snapshotId}`;
    const settlements = normalized.movements.filter(row => row.withdrawalSnapshotId === snapshotId);
    if (settlements.some(row => normalized.movements.some(other => other.reversalOf === row.id))) {
      throw new Error("Uma movimentação desta retirada já foi estornada. Confira a conta da sócia.");
    }
    const originalIds = [...new Set([
      ...(snapshot.withdrawalEntryIds || []),
      ...settlements.map(row => row.cashEntryId).filter(Boolean)
    ])];
    if (snapshot.companyReservePaid == null) throw new Error("O fechamento não informa o repasse efetivo ao Cofrinho. Revise o registro antes de estornar.");
    if (!originalIds.length || originalIds.some(entryId => !cashEntries.some(row => row.id === entryId))) {
      throw new Error("Os lançamentos vinculados à retirada estão incompletos.");
    }
    const cash = originalIds.map(entryId => cashEntries.find(row => row.id === entryId));
    const reversal = {
      id, snapshotId, date: snapshot.date, reason: String(reason).trim(), createdBy, createdAt,
      originalCashEntryIds: originalIds,
      originalMovementIds: settlements.map(row => row.id),
      savingsAmount: positiveMoney(snapshot.companyReservePaid).toFixed(2)
    };
    const movements = settlements.map(row => ({
      id: `${id}-movement-${row.id}`, partnerId: row.partnerId, date: snapshot.date,
      type: "manual_adjustment", direction: movementEffect(row) < 0 ? "increase" : "decrease",
      amount: positiveMoney(row.amount).toFixed(2), description: `Estorno de ${row.description}`,
      observation: reversal.reason, origin: "", cashImpact: false, reversalOf: row.id,
      withdrawalReversalId: id, createdAt, updatedAt: createdAt, createdBy
    }));
    const reversedCash = cash.filter(row => row.cashImpact !== false && Number(row.amount) > 0).map(row => ({
      id: `${id}-cash-${row.id}`, date: row.date, type: row.type === "expense" ? "income" : "expense",
      amount: positiveMoney(row.amount).toFixed(2), cashAccount: row.cashAccount || "",
      category: "ajuste-conta", description: `Estorno da retirada: ${row.description || row.id}`,
      withdrawalReversalId: id, reversalOf: row.id, reversalReason: reversal.reason,
      // Payments remain outside operational and adjustment totals, like their originals.
      ...(isPartnerCashEntry(row) ? { nonOperationalPartnerAccount: true } : {})
    }));
    const savings = Number(reversal.savingsAmount) > 0 ? [{
      id: `${id}-savings`, date: snapshot.date, type: "withdrawal", amount: reversal.savingsAmount,
      description: `Estorno da retirada: ${reversal.reason}`, withdrawalReversalId: id, balance: "0.00"
    }] : [];
    return { reversal, movements, cashEntries: reversedCash, savingsHistory: savings };
  }

  function validateWithdrawalReversals(account, cashEntries, previousAccount, savingsHistory) {
    const normalized = normalizePartnerAccounts(account);
    const errors = [];
    const seen = new Set();
    for (const reversal of normalized.withdrawalReversals) {
      if (seen.has(reversal.snapshotId)) errors.push("A retirada não pode ser estornada duas vezes.");
      seen.add(reversal.snapshotId);
      try {
        const source = {
          ...normalized, withdrawalReversals: [],
          movements: normalized.movements.filter(row => row.withdrawalReversalId !== reversal.id)
        };
        const expected = buildWithdrawalReversal(source, cashEntries, reversal.snapshotId, reversal.reason, reversal.createdBy, reversal.createdAt);
        if (JSON.stringify(expected.reversal) !== JSON.stringify(reversal)) errors.push("Registro de estorno de retirada inconsistente.");
        for (const [rows, required] of [[cashEntries, expected.cashEntries], [normalized.movements, expected.movements], ...(savingsHistory ? [[savingsHistory, expected.savingsHistory]] : [])]) {
          if (rows.filter(row => row.withdrawalReversalId === reversal.id).length !== required.length) errors.push("Quantidade de movimentos do estorno inconsistente.");
        }
        for (const [rows, required] of [[cashEntries, expected.cashEntries], [normalized.movements, expected.movements], ...(savingsHistory ? [[savingsHistory, expected.savingsHistory]] : [])]) {
          for (const item of required) {
            const matches = rows.filter(row => row.id === item.id);
            if (matches.length !== 1 || Object.keys(item).some(key => key !== "balance" && JSON.stringify(matches[0][key]) !== JSON.stringify(item[key]))) {
              errors.push("Os movimentos do estorno de retirada estão incompletos ou inconsistentes.");
            }
          }
        }
      } catch (error) { errors.push(error.message); }
    }
    const reversalIds = new Set(normalized.withdrawalReversals.map(row => row.id));
    for (const row of [...cashEntries, ...normalized.movements, ...(savingsHistory || [])]) {
      if (row.withdrawalReversalId && !reversalIds.has(row.withdrawalReversalId)) errors.push("Movimento sem registro de estorno de retirada.");
    }
    for (const row of normalizePartnerAccounts(previousAccount).withdrawalReversals) {
      if (JSON.stringify(normalized.withdrawalReversals.find(item => item.id === row.id)) !== JSON.stringify(row)) {
        errors.push("Um estorno registrado não pode ser alterado ou excluído.");
      }
    }
    return errors;
  }

  function validatePartnerAccountState(account = {}, cashEntries = [], previousAccount = null, savingsHistory = null, previousCashEntries = null) {
    const normalized = normalizePartnerAccounts(account);
    const errors = validateWithdrawalReversals(account, cashEntries, previousAccount, savingsHistory);
    if (previousAccount && previousCashEntries) {
      const protectedIds = new Set(normalizePartnerAccounts(previousAccount).withdrawalSnapshots.flatMap(snapshot => [
        ...(snapshot.withdrawalEntryIds || []),
        ...normalizePartnerAccounts(previousAccount).movements.filter(row => row.withdrawalSnapshotId === snapshot.id).map(row => row.cashEntryId).filter(Boolean)
      ]));
      for (const id of protectedIds) {
        const before = previousCashEntries.find(row => row.id === id);
        const after = cashEntries.find(row => row.id === id);
        if (before && (!after || ["type", "amount", "cashAccount", "date", "category", "cashImpact", "partnerWithdrawalSnapshotId"].some(key => JSON.stringify(before[key]) !== JSON.stringify(after[key])))) {
          errors.push("Os lançamentos de uma retirada consolidada devem ser estornados juntos, não alterados ou excluídos.");
        }
      }
    }
    const partnerIds = normalized.partners.map(partner => partner.id);
    if (partnerIds.some(id => !id) || new Set(partnerIds).size !== partnerIds.length) {
      errors.push("As sócias precisam ter identificadores únicos.");
    }
    const movementIds = new Set();
    const linkedCashIds = new Set();
    normalized.movements.forEach(movement => {
      const id = String(movement.id || "");
      const partnerId = String(movement.partnerId || "").toLowerCase();
      const amount = Number(movement.amount);
      if (!id || movementIds.has(id)) errors.push("As movimentações precisam ter IDs únicos.");
      movementIds.add(id);
      if (!partnerIds.includes(partnerId)) errors.push(`Sócia inválida na movimentação ${id || "sem ID"}.`);
      if (!MOVEMENT_TYPES.has(movement.type)) errors.push(`Tipo inválido na movimentação ${id || "sem ID"}.`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(movement.date || ""))) errors.push(`Data inválida na movimentação ${id || "sem ID"}.`);
      if (!Number.isFinite(amount) || amount <= 0) errors.push(`O valor da movimentação ${id || "sem ID"} deve ser positivo.`);
      if (!String(movement.description || "").trim()) errors.push(`A descrição da movimentação ${id || "sem ID"} é obrigatória.`);
      if (movement.type === "debit" && !String(movement.origin || "").trim()) errors.push(`A origem do débito ${id || "sem ID"} é obrigatória.`);
      if (movement.type === "manual_adjustment" && !String(movement.observation || "").trim()) errors.push(`A observação do ajuste ${id || "sem ID"} é obrigatória.`);
      if (movement.type === "manual_adjustment" && !["increase", "decrease"].includes(movement.direction)) errors.push(`A direção do ajuste ${id || "sem ID"} é inválida.`);
      if (movement.type === "withdrawal_compensation" && !movement.withdrawalSnapshotId) errors.push(`A compensação ${id || "sem ID"} precisa referenciar a quebra.`);
      const spec = cashEntrySpecForMovement(movement);
      if (!spec) {
        return;
      }
      const cashEntryId = String(movement.cashEntryId || "");
      if (!cashEntryId || linkedCashIds.has(cashEntryId)) {
        errors.push(`A movimentação ${id || "sem ID"} precisa de um lançamento de caixa exclusivo.`);
        return;
      }
      linkedCashIds.add(cashEntryId);
      const linkedEntries = cashEntries.filter(
        entry => String(entry.partnerMovementId || "") === id
      );
      const cashEntry = cashEntries.find(entry => String(entry.id || "") === cashEntryId);
      if (linkedEntries.length !== 1) {
        errors.push(`A movimentação ${id || "sem ID"} deve afetar o caixa exatamente uma vez.`);
      }
      if (!cashEntry || String(cashEntry.partnerMovementId || "") !== id) {
        errors.push(`O lançamento de caixa da movimentação ${id || "sem ID"} não foi encontrado.`);
        return;
      }
      if (
        cashEntry.type !== spec.type ||
        roundedMoney(cashEntry.amount) !== spec.amount ||
        String(cashEntry.date || "").slice(0, 10) !== spec.date ||
        !isPartnerCashEntry(cashEntry)
      ) {
        errors.push(`O lançamento de caixa da movimentação ${id || "sem ID"} está inconsistente.`);
      }
    });
    Object.entries(partnerBalances(normalized)).forEach(([partnerId, balance]) => {
      if (balance < -0.009) errors.push(`O saldo devedor de ${partnerId} não pode ficar negativo.`);
    });
    const snapshotIds = new Set();
    const movementMap = new Map(normalized.movements.map(movement => [String(movement.id), movement]));
    normalized.withdrawalSnapshots.forEach(snapshot => {
      const id = String(snapshot.id || "");
      if (!id || snapshotIds.has(id)) errors.push("As quebras precisam ter IDs únicos.");
      snapshotIds.add(id);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(snapshot.date || ""))) errors.push(`A quebra ${id || "sem ID"} tem data inválida.`);
      if (!Array.isArray(snapshot.partners)) errors.push(`A quebra ${id || "sem ID"} não possui o snapshot das sócias.`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(snapshot.period?.start || "")) || !/^\d{4}-\d{2}-\d{2}$/.test(String(snapshot.period?.end || ""))) errors.push(`A quebra ${id || "sem ID"} não possui período válido.`);
      ["physicalCash", "receivablesTotal", "adjustedBase", "companyReserve", "cashPaidTotal"].forEach(field => {
        const value = Number(snapshot[field]);
        if (!Number.isFinite(value) || value < 0) errors.push(`A quebra ${id || "sem ID"} não possui ${field} válido.`);
      });
      if (!String(snapshot.closedBy || "").trim()) errors.push(`A quebra ${id || "sem ID"} precisa do responsável pelo fechamento.`);
      if (snapshot.distributionBaseOverride != null && (!Number.isFinite(Number(snapshot.distributionBaseOverride)) || Number(snapshot.distributionBaseOverride) <= 0)) errors.push("A base manual da divisão deve ser positiva.");
      const snapshotPartners = Array.isArray(snapshot.partners) ? snapshot.partners : [];
      const openingDebtTotal = snapshotPartners.reduce(
        (sum, partner) => sum + positiveMoney(partner.openingDebt),
        0
      );
      if (Math.abs(roundedMoney(snapshot.distributionBaseOverride == null ? Number(snapshot.physicalCash) + openingDebtTotal : snapshot.distributionBaseOverride) - roundedMoney(snapshot.adjustedBase)) > 0.009) {
        errors.push(`A base ajustada da quebra ${id || "sem ID"} está inconsistente.`);
      }
      snapshotPartners.forEach(partner => {
        if (!partnerIds.includes(String(partner.partnerId || "").toLowerCase())) errors.push(`A quebra ${id || "sem ID"} possui sócia inválida.`);
        ["openingDebt", "distributionRight", "realPayment", "compensation", "cashPaid", "remainingDebt"].forEach(field => {
          const value = Number(partner[field]);
          if (!Number.isFinite(value) || value < 0) errors.push(`A quebra ${id || "sem ID"} possui ${field} inválido.`);
        });
        (Array.isArray(partner.openingMovementIds) ? partner.openingMovementIds : []).forEach(movementId => {
          const row = movementMap.get(String(movementId));
          if (!row || row.partnerId !== partner.partnerId) errors.push(`A quebra ${id || "sem ID"} referencia movimentação inicial inválida.`);
        });
        [[partner.paymentMovementId, "payment"], [partner.compensationMovementId, "withdrawal_compensation"]].forEach(([movementId, type]) => {
          if (!movementId) return;
          const row = movementMap.get(String(movementId));
          if (!row || row.type !== type || row.withdrawalSnapshotId !== id) errors.push(`A quebra ${id || "sem ID"} referencia liquidação inválida.`);
        });
      });
    });
    normalized.movements
      .filter(movement => movement.type === "withdrawal_compensation")
      .forEach(movement => {
        if (!snapshotIds.has(String(movement.withdrawalSnapshotId || ""))) {
          errors.push(`A compensação ${movement.id} referencia uma quebra inexistente.`);
        }
      });
    cashEntries
      .filter(entry => entry.partnerMovementId)
      .forEach(entry => {
        const row = movementMap.get(String(entry.partnerMovementId));
        if (!row || String(row.cashEntryId || "") !== String(entry.id || "")) {
          errors.push(`O lançamento de caixa ${entry.id || "sem ID"} está sem vínculo válido.`);
        }
      });
    if (previousAccount) {
      const previous = normalizePartnerAccounts(previousAccount);
      const nextSnapshots = new Map(normalized.withdrawalSnapshots.map(snapshot => [String(snapshot.id), snapshot]));
      previous.withdrawalSnapshots.forEach(snapshot => {
        if (JSON.stringify(nextSnapshots.get(String(snapshot.id))) !== JSON.stringify(snapshot)) {
          errors.push(`A quebra consolidada ${snapshot.id} não pode ser alterada ou excluída.`);
        }
      });
      const previousMovementMap = new Map(previous.movements.map(movement => [String(movement.id), movement]));
      const nextMovementMap = new Map(normalized.movements.map(movement => [String(movement.id), movement]));
      consolidatedMovementIds(previous).forEach(id => {
        if (JSON.stringify(nextMovementMap.get(id)) !== JSON.stringify(previousMovementMap.get(id))) {
          errors.push(`A movimentação consolidada ${id} deve ser estornada, não alterada.`);
        }
      });
    }
    return { valid: errors.length === 0, errors: [...new Set(errors)] };
  }

  return {
    MOVEMENT_TYPES,
    buildWithdrawalReversal,
    calculateWithdrawalDistribution,
    cashEntrySpecForMovement,
    consolidatedMovementIds,
    defaultPartnerAccounts,
    isPartnerCashEntry,
    movementEffect,
    movementHasCashImpact,
    normalizePartnerAccounts,
    partnerAccountSummary,
    partnerBalances,
    repairPartnerCashLinks,
    repairPartnerMovementsFromCash,
    positiveMoney,
    roundedMoney,
    snapshotMovementIds,
    validatePartnerAccountState
  };
});
