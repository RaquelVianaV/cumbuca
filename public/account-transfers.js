(function initAccountTransferRules(root, factory) {
  const rules = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = rules;
  }
  if (root) {
    root.CumbucaAccountTransfers = rules;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function accountTransferRulesFactory() {
  "use strict";

  const ACCOUNT_IDS = ["pf", "pj", "savings"];
  const TRANSFER_CATEGORY = "transferencia-contas";

  function roundedMoney(value) {
    return Math.round(Number(value || 0) * 100) / 100;
  }

  function accountLabel(value) {
    if (value === "pf") return "Conta PF";
    if (value === "pj") return "Conta PJ";
    if (value === "savings") return "Cofrinho";
    return "Conta inválida";
  }

  function normalizedAccount(value, fallback = "") {
    const account = String(value || "").trim().toLowerCase();
    return ACCOUNT_IDS.includes(account) ? account : fallback;
  }

  function defaultAccountTransfers() {
    return [];
  }

  function normalizedAccountTransfer(value = {}) {
    const id = String(value.id || "").trim();
    const origin = normalizedAccount(value.origin);
    const destination = normalizedAccount(value.destination);
    const date = String(value.date || "").slice(0, 10);
    const amount = roundedMoney(value.amount);
    const cashEntryIds = [];
    if (origin && origin !== "savings") cashEntryIds.push(`${id}-source`);
    if (destination && destination !== "savings") cashEntryIds.push(`${id}-destination`);
    return {
      ...value,
      id,
      date,
      origin,
      destination,
      amount: amount.toFixed(2),
      description: String(value.description || "").trim(),
      cashEntryIds,
      savingsEntryId: origin === "savings" || destination === "savings"
        ? `${id}-savings`
        : ""
    };
  }

  function normalizeAccountTransfers(value = []) {
    return (Array.isArray(value) ? value : [])
      .filter(Boolean)
      .map(normalizedAccountTransfer);
  }

  function accountTransferCashEntries(value = {}) {
    const transfer = normalizedAccountTransfer(value);
    const common = {
      date: transfer.date,
      category: TRANSFER_CATEGORY,
      amount: transfer.amount,
      transferId: transfer.id,
      accountTransferId: transfer.id,
      nonOperationalAccountTransfer: true,
      transferDescription: transfer.description
    };
    const entries = [];
    if (transfer.origin && transfer.origin !== "savings") {
      entries.push({
        ...common,
        id: `${transfer.id}-source`,
        description: `Transferência para ${accountLabel(transfer.destination)}`,
        type: "expense",
        cashAccount: transfer.origin,
        accountTransferSide: "source"
      });
    }
    if (transfer.destination && transfer.destination !== "savings") {
      entries.push({
        ...common,
        id: `${transfer.id}-destination`,
        description: `Transferência recebida de ${accountLabel(transfer.origin)}`,
        type: "income",
        cashAccount: transfer.destination,
        accountTransferSide: "destination"
      });
    }
    return entries;
  }

  function accountTransferSavingsEntry(value = {}) {
    const transfer = normalizedAccountTransfer(value);
    if (transfer.origin !== "savings" && transfer.destination !== "savings") {
      return null;
    }
    const withdrawal = transfer.origin === "savings";
    return {
      id: `${transfer.id}-savings`,
      date: transfer.date,
      type: withdrawal ? "withdrawal" : "deposit",
      amount: transfer.amount,
      balance: "0.00",
      description: withdrawal
        ? `Transferência para ${accountLabel(transfer.destination)}`
        : `Transferência recebida de ${accountLabel(transfer.origin)}`,
      accountTransferId: transfer.id,
      transferId: transfer.id
    };
  }

  function isAccountTransferCashEntry(entry = {}) {
    return Boolean(
      entry.nonOperationalAccountTransfer === true ||
      entry.transferId ||
      entry.accountTransferId ||
      String(entry.category || "").toLowerCase() === TRANSFER_CATEGORY
    );
  }

  function accountBalanceEffects(value = {}) {
    const transfer = normalizedAccountTransfer(value);
    const effects = { pf: 0, pj: 0, savings: 0, totalCash: 0 };
    if (ACCOUNT_IDS.includes(transfer.origin)) {
      effects[transfer.origin] = roundedMoney(effects[transfer.origin] - Number(transfer.amount));
    }
    if (ACCOUNT_IDS.includes(transfer.destination)) {
      effects[transfer.destination] = roundedMoney(effects[transfer.destination] + Number(transfer.amount));
    }
    effects.totalCash = roundedMoney(effects.pf + effects.pj);
    return effects;
  }

  function validateAccountTransferState(transfers = [], cashEntries = [], savingsHistory = []) {
    const sourceTransfers = Array.isArray(transfers) ? transfers : [];
    const normalizedTransfers = normalizeAccountTransfers(sourceTransfers);
    const errors = [];
    const transferIds = new Set();
    const cashIds = new Set();
    const savingsIds = new Set();
    const transferMap = new Map(normalizedTransfers.map(transfer => [transfer.id, transfer]));

    sourceTransfers.forEach((source, index) => {
      const transfer = normalizedTransfers[index];
      const label = transfer.id || `na posição ${index + 1}`;
      if (!transfer.id || transferIds.has(transfer.id)) {
        errors.push("As transferências precisam ter identificadores únicos.");
      }
      transferIds.add(transfer.id);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(transfer.date)) {
        errors.push(`A transferência ${label} tem data inválida.`);
      }
      if (!ACCOUNT_IDS.includes(transfer.origin) || !ACCOUNT_IDS.includes(transfer.destination)) {
        errors.push(`A transferência ${label} possui conta inválida.`);
      }
      if (transfer.origin === transfer.destination) {
        errors.push(`A transferência ${label} precisa ter contas diferentes.`);
      }
      if (!Number.isFinite(Number(source.amount)) || Number(source.amount) <= 0) {
        errors.push(`O valor da transferência ${label} deve ser positivo.`);
      }

      const expectedCash = accountTransferCashEntries(transfer);
      const linkedCash = cashEntries.filter(entry => String(entry.accountTransferId || entry.transferId || "") === transfer.id);
      if (linkedCash.length !== expectedCash.length) {
        errors.push(`A transferência ${label} não possui os dois lados financeiros esperados.`);
      }
      expectedCash.forEach(expected => {
        if (cashIds.has(expected.id)) errors.push(`O lançamento ${expected.id} foi usado mais de uma vez.`);
        cashIds.add(expected.id);
        const actual = cashEntries.find(entry => String(entry.id || "") === expected.id);
        if (!actual || [
          "date",
          "category",
          "type",
          "cashAccount",
          "transferId",
          "accountTransferId",
          "accountTransferSide"
        ].some(field => String(actual?.[field] || "") !== String(expected[field] || "")) ||
          roundedMoney(actual?.amount) !== roundedMoney(expected.amount) ||
          !isAccountTransferCashEntry(actual)) {
          errors.push(`O lançamento ${expected.id} está inconsistente com a transferência ${label}.`);
        }
      });

      const expectedSavings = accountTransferSavingsEntry(transfer);
      const linkedSavings = savingsHistory.filter(entry => String(entry.accountTransferId || entry.transferId || "") === transfer.id);
      if (!expectedSavings && linkedSavings.length) {
        errors.push(`A transferência ${label} não deveria movimentar o Cofrinho.`);
      }
      if (expectedSavings) {
        if (linkedSavings.length !== 1) {
          errors.push(`A transferência ${label} precisa movimentar o Cofrinho exatamente uma vez.`);
        }
        if (savingsIds.has(expectedSavings.id)) errors.push(`O registro ${expectedSavings.id} foi usado mais de uma vez.`);
        savingsIds.add(expectedSavings.id);
        const actual = savingsHistory.find(entry => String(entry.id || "") === expectedSavings.id);
        if (!actual || ["date", "type", "transferId", "accountTransferId"].some(
          field => String(actual?.[field] || "") !== String(expectedSavings[field] || "")
        ) || roundedMoney(actual?.amount) !== roundedMoney(expectedSavings.amount)) {
          errors.push(`O registro do Cofrinho está inconsistente com a transferência ${label}.`);
        }
      }

      if (transfer.reversalOf) {
        const original = transferMap.get(String(transfer.reversalOf));
        if (!original || original.origin !== transfer.destination || original.destination !== transfer.origin ||
          roundedMoney(original.amount) !== roundedMoney(transfer.amount)) {
          errors.push(`O estorno ${label} não corresponde à transferência original.`);
        }
      }
      if (transfer.reversedBy) {
        const reversal = transferMap.get(String(transfer.reversedBy));
        if (!reversal || String(reversal.reversalOf || "") !== transfer.id) {
          errors.push(`A transferência ${label} possui um estorno inválido.`);
        }
      }
    });

    cashEntries.filter(isAccountTransferCashEntry).forEach(entry => {
      if (!transferIds.has(String(entry.accountTransferId || entry.transferId || ""))) {
        errors.push(`O lançamento de transferência ${entry.id || "sem ID"} está sem vínculo válido.`);
      }
    });
    savingsHistory.filter(entry => entry.accountTransferId || entry.transferId).forEach(entry => {
      if (!transferIds.has(String(entry.accountTransferId || entry.transferId || ""))) {
        errors.push(`O registro do Cofrinho ${entry.id || "sem ID"} está sem transferência válida.`);
      }
    });

    return { valid: errors.length === 0, errors: [...new Set(errors)] };
  }

  return {
    ACCOUNT_IDS,
    TRANSFER_CATEGORY,
    accountBalanceEffects,
    accountLabel,
    accountTransferCashEntries,
    accountTransferSavingsEntry,
    defaultAccountTransfers,
    isAccountTransferCashEntry,
    normalizeAccountTransfers,
    normalizedAccount,
    normalizedAccountTransfer,
    roundedMoney,
    validateAccountTransferState
  };
});
