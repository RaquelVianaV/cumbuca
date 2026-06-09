const app = document.querySelector("#app");
const title = document.querySelector("#page-title");
const todayDate = document.querySelector("#today-date");
const serverStatus = document.querySelector("#server-status");
const databaseStatus = document.querySelector("#database-status");
const saveStatus = document.querySelector("#save-status");
const backupButton = document.querySelector("#backup-button");
const logoutButton = document.querySelector("#logout-button");
const currentUserBadge = document.querySelector("#current-user");
const navLinks = [...document.querySelectorAll("[data-route]")];
let systemStatus = {
  server: false,
  database: false,
  persistence: false
};
let lastConfirmedPayload = null;
let offlineAlertOpen = false;
let suppressIssueLog = false;
const APP_DATA_RESET_VERSION = "2026-05-29-clean-start";
const defaultAppConfig = {
  storeName: "Cumbuca",
  defaultRoute: "hoje",
  splitSavingsPercent: 10,
  splitVanessaPercent: 70,
  splitRaquelPercent: 30
};
const configRouteOptions = [
  ["home", "Painel"],
  ["hoje", "Hoje"],
  ["pedidos", "Pedidos"],
  ["fluxo-de-caixa", "Caixa"],
  ["financeiro", "Financeiro"],
  ["alertas", "Alertas"]
];
const localStateKeys = [
  "cashEntries",
  "weeklyMenusByPeriod",
  "menuWeek",
  "menuPeriod",
  "menuDatesByPeriod",
  "clients",
  "orders",
  "storeSales",
  "channelReceipts",
  "cashCategories",
  "archivedCashCategories",
  "suppliers",
  "expenseReasons",
  "archivedExpenseReasons",
  "auditLog",
  "auditFilter",
  "monthlyClosings",
  "pricingIngredients",
  "pricingConfig",
  "cashFilter",
  "financialPlanning",
  "appConfig",
  "reportPeriod",
  "lastManualBackupAt"
];

if (localStorage.getItem("appDataResetVersion") !== APP_DATA_RESET_VERSION) {
  localStateKeys.forEach(key => localStorage.removeItem(key));
  localStorage.setItem("appDataResetVersion", APP_DATA_RESET_VERSION);
}

const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL"
});

const fullDate = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "2-digit",
  month: "long",
  year: "numeric"
});

const shortDateTime = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit"
});

const monthYear = new Intl.DateTimeFormat("pt-BR", {
  month: "long",
  year: "numeric"
});

if (todayDate) {
  const now = new Date();
  todayDate.dateTime = isoDate(now);
  todayDate.textContent = fullDate.format(now);
}

async function updateServerStatus() {
  if (!serverStatus || !databaseStatus) {
    return;
  }

  try {
    const response = await fetch("/api/health", { cache: "no-store" });
    if (!response.ok) {
      throw new Error("offline");
    }
    const result = await response.json();
    systemStatus.server = true;
    systemStatus.database = Boolean(result.database);
    state.database = Boolean(result.database);
    serverStatus.textContent = "Servidor online";
    serverStatus.classList.add("online");
    serverStatus.classList.remove("offline");
    databaseStatus.textContent = result.database ? "Banco online" : "Banco offline";
    databaseStatus.classList.toggle("online", Boolean(result.database));
    databaseStatus.classList.toggle("offline", !result.database);
  } catch (error) {
    systemStatus.server = false;
    systemStatus.database = false;
    state.database = false;
    serverStatus.textContent = "Servidor offline";
    serverStatus.classList.add("offline");
    serverStatus.classList.remove("online");
    databaseStatus.textContent = "Banco offline";
    databaseStatus.classList.add("offline");
    databaseStatus.classList.remove("online");
  }
}

function setSaveStatus(text, mode = "checking") {
  if (!saveStatus) {
    return;
  }

  saveStatus.textContent = text;
  saveStatus.classList.toggle("online", mode === "online");
  saveStatus.classList.toggle("offline", mode === "offline");
}

function showToast(text, mode = "success") {
  if ((mode === "error" || mode === "warning") && !suppressIssueLog) {
    recordSystemIssue(mode, text);
  }
  let area = document.querySelector(".toast-area");
  if (!area) {
    area = document.createElement("div");
    area.className = "toast-area";
    document.body.appendChild(area);
  }

  const toast = document.createElement("div");
  toast.className = `toast ${mode}`;
  toast.textContent = text;
  area.appendChild(toast);
  setTimeout(() => toast.classList.add("show"), 20);
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 180);
  }, 2600);
}

function clonePayload(payload) {
  return JSON.parse(JSON.stringify(payload));
}

function alertOfflineSave(reason) {
  const message = reason === "server"
    ? "Alteração não salva: o sistema está offline. Recarregue quando o servidor voltar."
    : "Alteração não salva: o banco está offline. Tente novamente quando o Supabase voltar.";
  setSaveStatus(reason === "server" ? "Servidor offline - nada salvo" : "Banco offline - nada salvo", "offline");
  showToast(message, "error");
  if (!offlineAlertOpen) {
    offlineAlertOpen = true;
    setTimeout(() => {
      alert(message);
      offlineAlertOpen = false;
    }, 20);
  }
}

async function onlineSaveCheck() {
  try {
    const healthResponse = await fetch("/api/health", { cache: "no-store" });
    if (!healthResponse.ok) {
      return { ok: false, reason: "server" };
    }
    const health = await healthResponse.json();
    systemStatus.server = true;
    systemStatus.database = Boolean(health.database);
    state.database = Boolean(health.database);
    if (!health.database) {
      return { ok: false, reason: "database" };
    }

    const persistenceResponse = await fetch("/api/persistence-check", { cache: "no-store" });
    if (!persistenceResponse.ok) {
      return { ok: false, reason: "database" };
    }
    const persistence = await persistenceResponse.json();
    systemStatus.persistence = Boolean(persistence.database && persistence.saved);
    if (!systemStatus.persistence) {
      return { ok: false, reason: "database" };
    }

    return { ok: true };
  } catch (error) {
    systemStatus.server = false;
    systemStatus.database = false;
    systemStatus.persistence = false;
    return { ok: false, reason: "server" };
  }
}

async function updatePersistenceStatus() {
  if (!saveStatus) {
    return;
  }

  setSaveStatus("Salvamento verificando");
  try {
    const response = await fetch("/api/persistence-check", { cache: "no-store" });
    if (!response.ok) {
      throw new Error("persistence check failed");
    }
    const result = await response.json();
    if (!result.database || !result.saved) {
      systemStatus.persistence = false;
      setSaveStatus("Banco offline - salvamento bloqueado", "offline");
      return;
    }

    systemStatus.persistence = true;
    setSaveStatus("Supabase ok - backup manual", "online");
  } catch (error) {
    systemStatus.persistence = false;
    setSaveStatus("Sem confirmação - salvamento bloqueado", "offline");
  }
}

if (logoutButton) {
  logoutButton.addEventListener("click", async () => {
    await fetch("/api/logout", { method: "POST" });
    location.href = "/login";
  });
}

const LOW_MONTHLY_QUANTITY = 5;
const defaultIncomeCategories = [
  ["venda", "Venda"],
  ["cardapio-web", "Cardápio Web"],
  ["ifood", "iFood"],
  ["99-food", "99 Food"],
  ["ajuste-conta", "Ajuste da conta"]
];
const channelDefinitions = [
  ["cardapioWeb", "Cardápio Web"],
  ["ifood", "iFood"],
  ["food99", "99 Food"]
];
const cardapioPaymentDefinitions = [
  ["debit", "Debito"],
  ["credit", "Credito"],
  ["onlineCredit", "Cartão de crédito online"],
  ["pix", "Pix"],
  ["cash", "Dinheiro"]
];
const defaultExpenseCategories = [
  ["supermercado", "Supermercado"],
  ["despesas-gerais", "Despesas gerais"],
  ["boleto", "Boleto"],
  ["conta", "Conta"],
  ["funcionarios", "Funcionários"],
  ["entregador", "Entregador"],
  ["99-uber", "99/Uber"],
  ["adesivos", "Adesivos"],
  ["aluguel", "Aluguel"],
  ["enel", "Enel"],
  ["contador", "Contador"],
  ["impostos", "Impostos"],
  ["nubank-cumbuca", "Nubank Cumbuca"],
  ["bee-delivery", "Bee Delivery"],
  ["gas", "Gás"],
  ["vivo", "Vivo"],
  ["retirada", "Retirada"],
  ["vanessa", "Vanessa"],
  ["raquel", "Raquel"],
  ["cofrinho", "Cofrinho"],
  ["troco", "Troco"],
  ["diferenca", "Diferença"],
  ["ajuste-conta", "Ajuste da conta"],
  ["outros", "Outros"]
];
const legacyCategoryLabels = [
  ["99", "99 Food"]
];
const defaultExpenseReasons = [
  "Supermercado",
  "Despesas gerais",
  "Funcionários",
  "Entregador",
  "99/Uber",
  "Adesivos",
  "Jean Veículos / MARTINS",
  "Gv Distribuidora / IDEAL",
  "Mab",
  "Praso",
  "Frical",
  "Frigorífico",
  "Sanduiches",
  "Sucos",
  "Semear",
  "Aluguel",
  "Enel",
  "Contador",
  "Impostos",
  "Nubank Cumbuca",
  "Bee Delivery",
  "Gás",
  "Vivo",
  "Vanessa",
  "Raquel",
  "Cofrinho",
  "Troco",
  "Diferença"
];

function localValue(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
  } catch (error) {
    return fallback;
  }
}

function seededExpenseReasons() {
  const saved = localValue("expenseReasons", null);
  if (Array.isArray(saved) && saved.length) {
    return saved;
  }
  const legacy = localValue("suppliers", null);
  if (Array.isArray(legacy) && legacy.length) {
    return legacy;
  }
  return defaultExpenseReasons;
}

function slugifyCategory(value) {
  const slug = String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || `categoria-${Date.now()}`;
}

function uniqueCategories(categories = []) {
  const seen = new Set();
  return categories
    .map(item => Array.isArray(item)
      ? [String(item[0] || slugifyCategory(item[1])), String(item[1] || item[0] || "").trim()]
      : [String(item?.key || slugifyCategory(item?.label)), String(item?.label || item?.key || "").trim()])
    .filter(([, label]) => Boolean(label))
    .filter(([key]) => {
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
}

function seededCashCategories(saved = localValue("cashCategories", null)) {
  const savedIncome = Array.isArray(saved?.income) ? saved.income : [];
  const savedExpense = Array.isArray(saved?.expense) ? saved.expense : [];
  const reasonCategories = seededExpenseReasons().map(reason => [slugifyCategory(reason), reason]);

  return {
    income: uniqueCategories([...defaultIncomeCategories, ...savedIncome]),
    expense: uniqueCategories([...defaultExpenseCategories, ...reasonCategories, ...savedExpense])
  };
}

const state = {
  cash: localValue("cashEntries", []),
  menus: localValue("weeklyMenusByPeriod", {}),
  menuWeek: Number(localStorage.getItem("menuWeek") || "1"),
  menuPeriod: localValue("menuPeriod", {
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1
  }),
  menuDates: localValue("menuDatesByPeriod", {}),
  clients: localValue("clients", []),
  orders: localValue("orders", []),
  storeSales: localValue("storeSales", []),
  channelReceipts: localValue("channelReceipts", []),
  cashCategories: seededCashCategories(),
  archivedCashCategories: localValue("archivedCashCategories", { income: [], expense: [] }),
  expenseReasons: seededExpenseReasons(),
  archivedExpenseReasons: localValue("archivedExpenseReasons", []),
  monthlyClosings: localValue("monthlyClosings", {}),
  showClients: false,
  showOrders: false,
  showPlanning: false,
  showMonthSummary: false,
  clientTab: "form",
  orderTab: "form",
  clientSearch: "",
  clientHistoryPhone: "",
  orderSearch: "",
  editClientIndex: null,
  editOrderId: null,
  editCashId: null,
  cashSort: { key: "", direction: "desc" },
  editWithdrawalGroup: null,
  editAccountAdjustmentId: null,
  editChannelReceiptId: null,
  editCashCategory: null,
  cashPanelTab: "entry",
  channelFilter: localValue("channelFilter", { period: "month" }),
  editStoreSaleId: null,
  editExpenseReasonIndex: null,
  editUserName: null,
  ingredients: localValue("pricingIngredients", []),
  pricingConfig: localValue("pricingConfig", {}),
  cashFilter: localValue("cashFilter", { period: "month" }),
  financialPlanning: localValue("financialPlanning", {
    savings: "",
    savingsUpdatedAt: "",
    savingsHistory: [],
    partnersHistory: [],
    monthlyGoal: "",
    improvements: [],
    purchases: []
  }),
  appConfig: localValue("appConfig", defaultAppConfig),
  reportPeriod: localValue("reportPeriod", {
    type: "month",
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    week: 1,
    date: isoDate(new Date()),
    start: "",
    end: "",
    expenseCategory: "all"
  }),
  orderFilter: localValue("orderFilter", {
    search: "",
    payment: "all",
    delivery: "all"
  }),
  maintenanceTab: localValue("maintenanceTab", "backup"),
  currentUser: null,
  database: false
};

if (localStorage.getItem("cashFilterDefaultMonthVersion") !== "2026-06") {
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const day = `${month}-${String(now.getDate()).padStart(2, "0")}`;
  if (!state.cashFilter || state.cashFilter.period === "all") {
    state.cashFilter = { period: "month", date: day, month, year: String(now.getFullYear()), type: "all", category: "all", search: "" };
  }
  localStorage.setItem("cashFilterDefaultMonthVersion", "2026-06");
}

function appStatePayload() {
  return {
    cashEntries: state.cash,
    weeklyMenusByPeriod: state.menus,
    menuWeek: state.menuWeek,
    menuPeriod: state.menuPeriod,
    menuDatesByPeriod: state.menuDates,
    clients: state.clients,
    orders: state.orders,
    storeSales: state.storeSales,
    channelReceipts: state.channelReceipts,
    cashCategories: state.cashCategories,
    archivedCashCategories: state.archivedCashCategories,
    expenseReasons: state.expenseReasons,
    archivedExpenseReasons: state.archivedExpenseReasons,
    monthlyClosings: state.monthlyClosings,
    pricingIngredients: state.ingredients,
    pricingConfig: state.pricingConfig,
    cashFilter: state.cashFilter,
    financialPlanning: state.financialPlanning,
    appConfig: state.appConfig
  };
}

function systemIssues() {
  return localValue("systemIssues", []);
}

function recordSystemIssue(type, message, detail = "") {
  const issue = {
    id: Date.now(),
    type,
    message: String(message || ""),
    detail: String(detail || ""),
    route: routeName(),
    createdAt: new Date().toISOString()
  };
  const issues = [issue, ...systemIssues()].slice(0, 40);
  localStorage.setItem("systemIssues", JSON.stringify(issues));
}

function applyPayloadToState(saved = {}) {
  state.cash = saved.cashEntries || [];
  state.menus = saved.weeklyMenusByPeriod || {};
  state.menuWeek = Number(saved.menuWeek || 1);
  state.menuPeriod = saved.menuPeriod || {
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1
  };
  state.menuDates = saved.menuDatesByPeriod || {};
  state.clients = saved.clients || [];
  state.orders = saved.orders || [];
  state.storeSales = saved.storeSales || [];
  state.channelReceipts = saved.channelReceipts || [];
  state.cashCategories = seededCashCategories(saved.cashCategories);
  state.archivedCashCategories = saved.archivedCashCategories || { income: [], expense: [] };
  state.expenseReasons = Array.isArray(saved.expenseReasons) && saved.expenseReasons.length
    ? saved.expenseReasons
    : seededExpenseReasons();
  state.archivedExpenseReasons = saved.archivedExpenseReasons || [];
  state.monthlyClosings = saved.monthlyClosings || {};
  state.ingredients = saved.pricingIngredients || [];
  state.pricingConfig = saved.pricingConfig || {};
  state.cashFilter = saved.cashFilter || { period: "month" };
  state.financialPlanning = {
    savings: "",
    savingsUpdatedAt: "",
    savingsHistory: [],
    partnersHistory: [],
    monthlyGoal: "",
    improvements: [],
    purchases: [],
    ...(saved.financialPlanning || {})
  };
  state.appConfig = {
    ...defaultAppConfig,
    ...(saved.appConfig || {})
  };
}

function renderCurrentRoute() {
  const render = routes[routeName()] || home;
  render();
}

function rollbackUnsavedChange() {
  if (!lastConfirmedPayload) {
    return;
  }
  applyPayloadToState(clonePayload(lastConfirmedPayload));
  persistLocal();
  setTimeout(renderCurrentRoute, 0);
}

function persistLocal() {
  Object.entries(appStatePayload()).forEach(([key, value]) => {
    localStorage.setItem(key, JSON.stringify(value));
  });
}

function recordAudit(action, detail) {
  return null;
}

async function persistState() {
  setSaveStatus("Conferindo conexão...");
  const online = await onlineSaveCheck();
  if (!online.ok) {
    rollbackUnsavedChange();
    alertOfflineSave(online.reason);
    updateServerStatus();
    return false;
  }

  setSaveStatus("Salvando...");
  try {
    const response = await fetch("/api/state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state: appStatePayload() })
    });
    const result = await response.json();
    if (response.ok && result.database) {
      persistLocal();
      lastConfirmedPayload = clonePayload(appStatePayload());
      const now = shortDateTime.format(new Date());
      setSaveStatus(`Salvo no Supabase ${now}`, "online");
      showToast("Salvo no Supabase", "success");
      return true;
    } else {
      rollbackUnsavedChange();
      alertOfflineSave("database");
      return false;
    }
  } catch (error) {
    rollbackUnsavedChange();
    alertOfflineSave("server");
    return false;
  }
}

async function hydrateState() {
  try {
    const response = await fetch("/api/state", { cache: "no-store" });
    if (!response.ok) {
      lastConfirmedPayload = clonePayload(appStatePayload());
      return;
    }
    const result = await response.json();
    state.database = Boolean(result.database);
    systemStatus.database = Boolean(result.database);
    const saved = result.state || {};
    if (result.database) {
      applyPayloadToState(saved);
      persistLocal();
      lastConfirmedPayload = clonePayload(appStatePayload());
    } else {
      lastConfirmedPayload = clonePayload(appStatePayload());
    }
  } catch (error) {
    state.database = false;
    systemStatus.database = false;
    lastConfirmedPayload = clonePayload(appStatePayload());
  }
}

async function hydrateSession() {
  try {
    const response = await fetch("/api/session", { cache: "no-store" });
    if (!response.ok) {
      return;
    }
    const result = await response.json();
    state.currentUser = result.user || null;
    if (currentUserBadge && state.currentUser) {
      currentUserBadge.textContent = `${state.currentUser.name || state.currentUser.username}${state.currentUser.role === "admin" ? " - admin" : ""}`;
    }
  } catch (error) {
    state.currentUser = null;
    if (currentUserBadge) {
      currentUserBadge.textContent = "";
    }
  }
}

function isAdminUser() {
  return state.currentUser?.role === "admin";
}

function canAccessMaintenanceTab(tab) {
  return !["users", "events", "reset"].includes(tab) || isAdminUser();
}

function setMaintenanceTab(tab) {
  state.maintenanceTab = canAccessMaintenanceTab(tab) ? tab : "backup";
  localStorage.setItem("maintenanceTab", JSON.stringify(state.maintenanceTab));
}

async function latestBackupPayload() {
  let payload = appStatePayload();
  let database = state.database;

  try {
    const response = await fetch("/api/state", { cache: "no-store" });
    if (response.ok) {
      const result = await response.json();
      database = Boolean(result.database);
      payload = {
        ...payload,
        ...(result.state || {})
      };
    }
  } catch (error) {
    database = false;
  }

  return {
    app: "Cumbuca",
    version: "1.0.0",
    exportedAt: new Date().toISOString(),
    source: database ? "postgres" : "localStorage",
    data: payload
  };
}

async function importBackupFile(file) {
  const text = await file.text();
  const parsed = JSON.parse(text);
  const data = parsed.data || parsed.state || parsed;

  applyPayloadToState({
    ...appStatePayload(),
    ...data
  });
  recordAudit("backup_importado", file.name || "backup manual");
  return persistState();
}

async function downloadBackup() {
  if (!backupButton) {
    return;
  }

  backupButton.disabled = true;
  const originalText = backupButton.textContent;
  backupButton.textContent = "Gerando...";

  try {
    const payload = await latestBackupPayload();
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json"
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `cumbuca-backup-${isoDate(new Date())}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    localStorage.setItem("lastManualBackupAt", new Date().toISOString());
    showToast("Backup JSON baixado.", "success");
  } finally {
    backupButton.disabled = false;
    backupButton.textContent = originalText;
  }
}

function yearFromMenuKey(key) {
  return String(key || "").slice(0, 4);
}

function cleanupPreview(year) {
  const target = String(year || "");
  return {
    cash: state.cash.filter(entry => String(entry.date || "").startsWith(target)).length,
    orders: state.orders.filter(order => yearFromMenuKey(order.menuKey) === target).length,
    menus: Object.keys(state.menus || {}).filter(key => yearFromMenuKey(key) === target).length,
    menuDates: Object.keys(state.menuDates || {}).filter(key => yearFromMenuKey(key) === target).length,
    storeSales: state.storeSales.filter(entry => String(entry.date || "").startsWith(target)).length,
    channelReceipts: state.channelReceipts.filter(entry => String(entry.date || "").startsWith(target)).length,
    monthlyClosings: Object.keys(state.monthlyClosings || {}).filter(key => String(key || "").startsWith(target)).length
  };
}

function formatBytes(bytes) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function estimatedBytes(value) {
  return new TextEncoder().encode(JSON.stringify(value || {})).length;
}

function databaseUsageEstimate() {
  const payload = appStatePayload();
  const sizeBytes = estimatedBytes(payload);
  const records = {
    cash: state.cash.length,
    orders: state.orders.length,
    menus: Object.keys(state.menus || {}).length,
    menuDates: Object.keys(state.menuDates || {}).length,
    storeSales: state.storeSales.length,
    monthlyClosings: Object.keys(state.monthlyClosings || {}).length,
    clients: state.clients.length,
    channelReceipts: state.channelReceipts.length,
    pricingIngredients: state.ingredients.length
  };
  const totalRecords = Object.values(records).reduce((sum, value) => sum + value, 0);
  const level = sizeBytes >= 5 * 1024 * 1024 || totalRecords >= 10000
    ? "high"
    : sizeBytes >= 1 * 1024 * 1024 || totalRecords >= 3000
      ? "medium"
      : "low";
  const label = level === "high" ? "Alto" : level === "medium" ? "Moderado" : "Leve";
  const message = level === "high"
    ? "Recomendado baixar backup e limpar anos antigos."
    : level === "medium"
      ? "Acompanhe o crescimento e planeje limpeza anual."
      : "Banco em tamanho tranquilo para uso normal.";

  return {
    sizeBytes,
    totalRecords,
    records,
    level,
    label,
    message
  };
}

function yearUsageEstimate(year) {
  const target = String(year || "");
  const scopedPayload = {
    cashEntries: state.cash.filter(entry => String(entry.date || "").startsWith(target)),
    orders: state.orders.filter(order => yearFromMenuKey(order.menuKey) === target),
    weeklyMenusByPeriod: Object.fromEntries(Object.entries(state.menus || {}).filter(([key]) => yearFromMenuKey(key) === target)),
    menuDatesByPeriod: Object.fromEntries(Object.entries(state.menuDates || {}).filter(([key]) => yearFromMenuKey(key) === target)),
    storeSales: state.storeSales.filter(entry => String(entry.date || "").startsWith(target)),
    channelReceipts: state.channelReceipts.filter(entry => String(entry.date || "").startsWith(target)),
    monthlyClosings: Object.fromEntries(Object.entries(state.monthlyClosings || {}).filter(([key]) => String(key || "").startsWith(target)))
  };

  return estimatedBytes(scopedPayload);
}

function databaseUsageHtml(selectedYear) {
  const usage = databaseUsageEstimate();
  const yearBytes = yearUsageEstimate(selectedYear);
  return `
    <div class="db-usage-card" data-level="${usage.level}">
      <div>
        <span>Status de lotacao</span>
        <strong>${usage.label}</strong>
        <p>${usage.message}</p>
      </div>
      <div class="db-usage-metrics">
        <div class="metric"><span>Uso estimado</span><strong>${formatBytes(usage.sizeBytes)}</strong></div>
        <div class="metric"><span>Registros</span><strong>${usage.totalRecords}</strong></div>
        <div class="metric"><span>Ano selecionado</span><strong>${formatBytes(yearBytes)}</strong></div>
      </div>
    </div>
  `;
}

function realDatabaseUsageHtml(result) {
  if (!result?.database) {
    return `<p class="muted">Não foi possível consultar o tamanho real do Supabase agora.</p>`;
  }

  if (!result.tables?.length) {
    return `<p class="muted">Nenhuma tabela da Cumbuca encontrada no Supabase.</p>`;
  }

  return `
    <div class="table-wrap report-table">
      <table>
        <thead><tr><th>Tabela</th><th>Linhas</th><th>Tamanho total</th><th>Dados</th></tr></thead>
        <tbody>
          ${result.tables.map(table => `
            <tr>
              <td>${table.name}</td>
              <td>${table.rows}</td>
              <td>${formatBytes(table.totalBytes || 0)}</td>
              <td>${formatBytes(table.tableBytes || 0)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

async function loadRealDatabaseUsage() {
  const target = document.querySelector("#real-db-usage");
  if (!target) {
    return;
  }

  try {
    const response = await fetch("/api/database-usage", { cache: "no-store" });
    const result = await response.json();
    target.innerHTML = realDatabaseUsageHtml(result);
  } catch (error) {
    target.innerHTML = `<p class="muted">Não foi possível consultar o tamanho real do Supabase agora.</p>`;
  }
}

function cleanupYears() {
  const years = new Set();
  state.cash.forEach(entry => {
    if (String(entry.date || "").slice(0, 4)) {
      years.add(String(entry.date || "").slice(0, 4));
    }
  });
  state.orders.forEach(order => {
    if (yearFromMenuKey(order.menuKey)) {
      years.add(yearFromMenuKey(order.menuKey));
    }
  });
  state.storeSales.forEach(entry => {
    if (String(entry.date || "").slice(0, 4)) {
      years.add(String(entry.date || "").slice(0, 4));
    }
  });
  state.channelReceipts.forEach(entry => {
    if (String(entry.date || "").slice(0, 4)) {
      years.add(String(entry.date || "").slice(0, 4));
    }
  });
  Object.keys(state.menus || {}).forEach(key => years.add(yearFromMenuKey(key)));
  Object.keys(state.monthlyClosings || {}).forEach(key => years.add(String(key || "").slice(0, 4)));

  const currentYear = String(new Date().getFullYear());
  return [...years]
    .filter(year => /^\d{4}$/.test(year))
    .filter(year => year !== currentYear)
    .sort((a, b) => b.localeCompare(a));
}

async function cleanupYear(year) {
  const target = String(year || "");
  const preview = cleanupPreview(target);

  state.cash = state.cash.filter(entry => !String(entry.date || "").startsWith(target));
  state.orders = state.orders.filter(order => yearFromMenuKey(order.menuKey) !== target);
  state.storeSales = state.storeSales.filter(entry => !String(entry.date || "").startsWith(target));
  state.channelReceipts = state.channelReceipts.filter(entry => !String(entry.date || "").startsWith(target));
  state.menus = Object.fromEntries(Object.entries(state.menus || {}).filter(([key]) => yearFromMenuKey(key) !== target));
  state.menuDates = Object.fromEntries(Object.entries(state.menuDates || {}).filter(([key]) => yearFromMenuKey(key) !== target));
  state.monthlyClosings = Object.fromEntries(Object.entries(state.monthlyClosings || {}).filter(([key]) => !String(key || "").startsWith(target)));

  recordAudit("limpeza_ano", `${target}: ${JSON.stringify(preview)}`);
  const saved = await persistState();
  return saved ? preview : null;
}

function clearLocalStateCache() {
  localStateKeys.forEach(key => localStorage.removeItem(key));
  localStorage.setItem("appDataResetVersion", APP_DATA_RESET_VERSION);
}

async function resetAllData() {
  await downloadBackup();
  if (!confirm("Limpar tudo do sistema online? Um backup foi baixado neste navegador e outro será salvo no Supabase antes da limpeza.")) {
    return false;
  }
  const typed = prompt("Digite LIMPAR para confirmar a limpeza completa.");
  if (typed !== "LIMPAR") {
    showToast("Limpeza cancelada", "warning");
    return false;
  }

  const response = await fetch("/api/reset-state", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ confirm: "LIMPAR" })
  });
  const result = await response.json();
  if (!response.ok || !result.database || !result.reset) {
    showToast(result.error || "Não foi possível limpar o banco.", "error");
    return false;
  }

  applyPayloadToState(result.state || {});
  clearLocalStateCache();
  persistLocal();
  lastConfirmedPayload = clonePayload(appStatePayload());
  showToast("Sistema limpo para começar.", "success");
  return true;
}

function cleanupPreviewHtml(year, preview) {
  const total = Object.values(preview).reduce((sum, value) => sum + value, 0);
  return `
    <div class="summary">
      <div class="metric"><span>Caixa</span><strong>${preview.cash}</strong></div>
      <div class="metric"><span>Pedidos</span><strong>${preview.orders}</strong></div>
      <div class="metric"><span>Menus</span><strong>${preview.menus}</strong></div>
      <div class="metric"><span>Datas menu</span><strong>${preview.menuDates}</strong></div>
      <div class="metric"><span>Loja</span><strong>${preview.storeSales}</strong></div>
      <div class="metric"><span>Canais</span><strong>${preview.channelReceipts}</strong></div>
      <div class="metric"><span>Fechamentos</span><strong>${preview.monthlyClosings}</strong></div>
    </div>
    <p class="muted">${total ? `A limpeza de ${year} removerá ${total} grupo(s)/registro(s) antigos.` : `Não há dados de ${year} para apagar.`}</p>
  `;
}

if (backupButton) {
  backupButton.addEventListener("click", downloadBackup);
}

updateServerStatus();
updatePersistenceStatus();
setInterval(updateServerStatus, 30000);
setInterval(updatePersistenceStatus, 120000);

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").catch(() => {});
}

function routeName() {
  return location.pathname.replace("/", "") || "home";
}

function setActive(route) {
  const moreRoutes = new Set(["menu-semanal", "loja", "precificacao", "relatorios", "alertas", "configuracoes", "backups"]);
  navLinks.forEach(link => {
    link.classList.toggle("active", link.dataset.route === route || (link.dataset.route === "mais" && moreRoutes.has(route)));
  });
}

function postJson(url, data) {
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  }).then(response => response.json());
}

function readForm(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function on(selector, eventName, handler, root = document) {
  const element = root.querySelector(selector);
  if (element) {
    element.addEventListener(eventName, handler);
  }
  return element;
}

function money(value) {
  return brl.format(Number(value || 0));
}

function parseMoneyInput(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  const raw = String(value || "").trim();
  if (!raw) {
    return 0;
  }
  const clean = raw.replace(/[^\d,.-]/g, "");
  const negative = clean.startsWith("-");
  const unsigned = clean.replace(/-/g, "");
  let normalized = unsigned;

  if (unsigned.includes(",")) {
    normalized = unsigned.replace(/\./g, "").replace(",", ".");
  } else {
    const parts = unsigned.split(".");
    if (parts.length === 2) {
      const [whole, fraction] = parts;
      if (fraction.length === 3) {
        normalized = `${whole}${fraction}`;
      } else if (fraction.length > 3) {
        const digits = `${whole}${fraction}`;
        normalized = `${digits.slice(0, -2)}.${digits.slice(-2)}`;
      }
    } else if (parts.length > 2) {
      const last = parts.at(-1);
      normalized = last.length === 2
        ? `${parts.slice(0, -1).join("")}.${last}`
        : parts.join("");
    }
  }

  const parsed = Number(normalized || 0);
  return negative ? -parsed : parsed;
}

function moneyInputValue(value) {
  const amount = Number(value || 0);
  return amount ? money(amount).replace("R$", "").trim() : "";
}

function passwordFieldHtml({ name, autocomplete, placeholder = "", required = false, minlength = "" }) {
  return `
    <div class="password-field">
      <input
        name="${name}"
        type="password"
        autocomplete="${autocomplete}"
        placeholder="${escapeHtml(placeholder)}"
        ${required ? "required" : ""}
        ${minlength ? `minlength="${minlength}"` : ""}
      >
      <button class="secondary password-toggle" type="button" data-password-toggle aria-label="Mostrar senha" title="Mostrar senha">Mostrar</button>
    </div>
  `;
}

function bindPasswordToggles(container = document) {
  container.querySelectorAll("[data-password-toggle]").forEach(button => {
    button.addEventListener("click", () => {
      const input = button.closest(".password-field")?.querySelector("input");
      if (!input) {
        return;
      }
      const showing = input.type === "text";
      input.type = showing ? "password" : "text";
      button.textContent = showing ? "Mostrar" : "Ocultar";
      button.setAttribute("aria-label", showing ? "Mostrar senha" : "Ocultar senha");
      button.title = showing ? "Mostrar senha" : "Ocultar senha";
    });
  });
}

function whatsappUrl(phone, text) {
  const cleanPhone = String(phone || "").replace(/\D/g, "");
  if (!cleanPhone) {
    return "#";
  }
  return `https://wa.me/55${cleanPhone}?text=${encodeURIComponent(text)}`;
}

function isoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function monthKeyFromDate(dateKey) {
  return String(dateKey || "").slice(0, 7);
}

function isMonthClosed(dateKey) {
  const key = monthKeyFromDate(dateKey);
  return Boolean(key && state.monthlyClosings?.[key]?.locked !== false && state.monthlyClosings?.[key]);
}

function blockClosedMonth(dateKey, action = "alterar") {
  const key = monthKeyFromDate(dateKey);
  if (!isMonthClosed(dateKey)) {
    return false;
  }
  showToast(`Mês ${formatMonthKeyBr(key)} fechado. Destrave o fechamento antes de ${action}.`, "warning");
  return true;
}

function addDays(dateKey, days) {
  const date = new Date(`${dateKey}T00:00:00`);
  date.setDate(date.getDate() + Number(days || 0));
  return isoDate(date);
}

function startOfWeek(date) {
  const copy = new Date(date);
  const day = copy.getDay() || 7;
  copy.setDate(copy.getDate() - day + 1);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function endOfWeek(date) {
  const copy = startOfWeek(date);
  copy.setDate(copy.getDate() + 6);
  return copy;
}

function normalizedCategory(value) {
  return String(value || "").replace(/^supplier:/, "reason:");
}

function archivedCategoryKeys(type) {
  return new Set((state.archivedCashCategories?.[type] || []).map(String));
}

function activeIncomeCategories() {
  const archived = archivedCategoryKeys("income");
  return uniqueCategories(state.cashCategories?.income || defaultIncomeCategories)
    .filter(([key]) => !archived.has(key));
}

function activeExpenseCategories() {
  const archived = archivedCategoryKeys("expense");
  return uniqueCategories(state.cashCategories?.expense || defaultExpenseCategories)
    .filter(([key]) => !archived.has(key));
}

function allCashCategories() {
  return uniqueCategories([
    ...activeIncomeCategories(),
    ...activeExpenseCategories(),
    ...(state.cashCategories?.income || []),
    ...(state.cashCategories?.expense || []),
    ...defaultIncomeCategories,
    ...defaultExpenseCategories,
    ...legacyCategoryLabels
  ]);
}

function getCashFilter() {
  const today = isoDate(new Date());
  const filter = {
    period: "month",
    date: today,
    month: today.slice(0, 7),
    year: today.slice(0, 4),
    type: "all",
    category: "all",
    search: "",
    ...(state.cashFilter || {})
  };

  if (filter.period === "week" && filter.month) {
    const periodYearMonth = filter.month;
    if (!filter.date.startsWith(periodYearMonth)) {
      filter.date = `${periodYearMonth}-01`;
    }
  }

  if (filter.period === "month" && filter.month) {
    if (!filter.date.startsWith(filter.month)) {
      filter.date = `${filter.month}-01`;
    }
  }

  if (filter.period === "year" && filter.year) {
    if (!filter.date.startsWith(filter.year)) {
      filter.date = `${filter.year}-01-01`;
    }
  }

  return filter;
}

function filterCashEntries(entries) {
  const currentFilter = getCashFilter();
  const { period, date, month, year, search, type, category } = currentFilter;
  const query = String(search || "").trim().toLowerCase();
  const searchedEntries = query
    ? entries.filter(entry => [
      entry.description,
      entry.category,
      categoryName(entry.category),
      entry.type === "expense" ? "saída" : "entrada"
    ].some(value => String(value || "").toLowerCase().includes(query)))
    : entries;

  const typedEntries = type && type !== "all"
    ? searchedEntries.filter(entry => (type === "expense" ? entry.type === "expense" : entry.type !== "expense"))
    : searchedEntries;

  const categorizedEntries = category && category !== "all"
    ? typedEntries.filter(entry => normalizedCategory(entry.category) === normalizedCategory(category)
      || slugifyCategory(categoryName(entry.category)) === category)
    : typedEntries;

  if (!period || period === "all") {
    return categorizedEntries;
  }

  return categorizedEntries.filter(entry => {
    if (!entry.date) {
      return false;
    }

    if (period === "day") {
      return entry.date === date;
    }

    if (period === "week") {
      const selected = date ? new Date(`${date}T00:00:00`) : new Date();
      const entryDate = new Date(`${entry.date}T00:00:00`);
      return entryDate >= startOfWeek(selected) && entryDate <= endOfWeek(selected);
    }

    if (period === "month") {
      return entry.date.startsWith(month || "");
    }

    if (period === "year") {
      return entry.date.startsWith(String(year || ""));
    }

    return true;
  });
}

function cashEntriesForSelectedPeriod(entries = state.cash) {
  const currentFilter = getCashFilter();
  const { period, date, month, year } = currentFilter;
  const accountedEntries = accountingCashEntries(entries);

  if (!period || period === "all") {
    return accountedEntries;
  }

  return accountedEntries.filter(entry => {
    const entryDateKey = cashAccountingDate(entry);
    if (!entryDateKey) {
      return false;
    }
    if (period === "day") {
      return entryDateKey === date;
    }
    if (period === "week") {
      const selected = date ? new Date(`${date}T00:00:00`) : new Date();
      const entryDate = new Date(`${entryDateKey}T00:00:00`);
      return entryDate >= startOfWeek(selected) && entryDate <= endOfWeek(selected);
    }
    if (period === "month") {
      return entryDateKey.startsWith(month || "");
    }
    if (period === "year") {
      return entryDateKey.startsWith(String(year || ""));
    }
    return true;
  });
}

function focusCashFilterOnDate(dateKey) {
  const date = String(dateKey || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return;
  }
  const period = state.cashFilter?.period || "month";
  state.cashFilter = {
    ...(state.cashFilter || {}),
    date,
    month: date.slice(0, 7),
    year: date.slice(0, 4)
  };
  if (period === "all") {
    state.cashFilter.period = "month";
    state.cashFilter.manualAll = false;
  }
}

function categoryName(value) {
  if (String(value || "").startsWith("supplier:")) {
    return String(value).replace(/^supplier:/, "");
  }
  if (String(value || "").startsWith("reason:")) {
    return String(value).replace(/^reason:/, "");
  }
  return allCashCategories().find(([key]) => key === value)?.[1] || "Outros";
}

function expenseReasonOptions() {
  return [];
}

function activeExpenseReasons() {
  const archived = new Set((state.archivedExpenseReasons || [])
    .map(name => String(name || "").trim())
    .filter(Boolean));

  return [...new Set((state.expenseReasons || [])
    .map(name => String(name || "").trim())
    .filter(Boolean))]
    .filter(name => !archived.has(name))
    .sort((a, b) => a.localeCompare(b, "pt-BR"));
}

function cashFilterCategoryOptions(selected = "all", type = "all") {
  const normalizedSelected = normalizedCategory(selected || "all");
  let selectedApplied = normalizedSelected === "all";
  const groups = [];

  if (!type || type === "all" || type === "income") {
    groups.push(["Entradas", activeIncomeCategories()]);
  }

  if (!type || type === "all" || type === "expense") {
    groups.push(["Saídas", activeExpenseCategories()]);
  }

  const optionHtml = ([value, label]) => {
    const normalizedValue = normalizedCategory(value);
    const shouldSelect = !selectedApplied && normalizedSelected === normalizedValue;
    if (shouldSelect) {
      selectedApplied = true;
    }
    return `<option value="${value}" ${shouldSelect ? "selected" : ""}>${label}</option>`;
  };

  return `
    <option value="all" ${normalizedSelected === "all" ? "selected" : ""}>Todas</option>
    ${groups.map(([label, options]) => `
      <optgroup label="${label}">
        ${options.map(optionHtml).join("")}
      </optgroup>
    `).join("")}
  `;
}

function cashCategorySummary(entries = []) {
  const rows = Object.entries(entries.reduce((acc, entry) => {
    const key = normalizedCategory(entry.category) || "outros";
    if (!acc[key]) {
      acc[key] = {
        label: categoryName(entry.category),
        income: 0,
        expenses: 0
      };
    }

    const amount = Number(entry.amount || 0);
    if (entry.type === "expense") {
      acc[key].expenses += amount;
    } else {
      acc[key].income += amount;
    }
    return acc;
  }, {}))
    .map(([, row]) => ({
      ...row,
      balance: row.income - row.expenses,
      total: row.income + row.expenses
    }))
    .sort((a, b) => b.total - a.total);

  if (!rows.length) {
    return "";
  }

  return `
    <div class="category-summary">
      ${rows.map(row => `
        <span>
          <b>${escapeHtml(row.label)}</b>
          <small>Entradas ${money(row.income)} - Saídas ${money(row.expenses)}</small>
          <strong class="${row.balance < 0 ? "negative" : "positive"}">${money(row.balance)}</strong>
        </span>
      `).join("")}
    </div>
  `;
}

function channelReceiptTotal(entry = {}) {
  return channelDefinitions.reduce((sum, [key]) => sum + channelReceiptAmount(entry, key, "net"), 0);
}

function channelReceiptAmount(entry = {}, key, kind = "net") {
  if (key === "cardapioWeb") {
    const paymentTotal = cardapioPaymentTotal(entry);
    const hasPaymentBreakdown = cardapioPaymentDefinitions.some(([paymentKey]) => entry[`cardapioWeb${capitalize(paymentKey)}`] !== undefined);
    if (hasPaymentBreakdown && (kind === "net" || kind === "gross")) {
      return paymentTotal;
    }
  }
  if (kind === "gross") {
    return Number(entry[`${key}Gross`] ?? entry[key] ?? 0);
  }
  if (kind === "fee") {
    return Number(entry[`${key}Fee`] ?? 0);
  }
  return Number(entry[`${key}Net`] ?? entry[key] ?? 0);
}

function capitalize(value) {
  const text = String(value || "");
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "";
}

function cardapioPaymentTotal(entry = {}) {
  return cardapioPaymentDefinitions.reduce((sum, [paymentKey]) => {
    return sum + Number(entry[`cardapioWeb${capitalize(paymentKey)}`] || 0);
  }, 0);
}

function hasCardapioPaymentBreakdown(entry = {}) {
  return cardapioPaymentDefinitions.some(([paymentKey]) => entry[`cardapioWeb${capitalize(paymentKey)}`] !== undefined);
}

function cardapioPaymentAmount(entry = {}, paymentKey) {
  if (hasCardapioPaymentBreakdown(entry)) {
    return Number(entry[`cardapioWeb${capitalize(paymentKey)}`] || 0);
  }
  return paymentKey === "pix" ? channelReceiptAmount(entry, "cardapioWeb", "net") : 0;
}

function channelReceiptFeeTotal(entry = {}) {
  return channelDefinitions.reduce((sum, [key]) => sum + channelReceiptAmount(entry, key, "fee"), 0);
}

function channelReceiptTotals(entries = []) {
  return entries.reduce((totals, entry) => {
    channelDefinitions.forEach(([key]) => {
      totals[`${key}Gross`] = (totals[`${key}Gross`] || 0) + channelReceiptAmount(entry, key, "gross");
      totals[`${key}Fee`] = (totals[`${key}Fee`] || 0) + channelReceiptAmount(entry, key, "fee");
      totals[`${key}Net`] = (totals[`${key}Net`] || 0) + channelReceiptAmount(entry, key, "net");
    });
    totals.total += channelReceiptTotal(entry);
    return totals;
  }, { total: 0 });
}

function channelReceiptMonthEntries(month) {
  return [...(state.channelReceipts || [])]
    .filter(entry => String(entry.date || "").startsWith(month || ""))
    .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
}

function channelFilterDefaults() {
  const today = isoDate(new Date());
  const savedFilter = state.channelFilter || {};
  return {
    period: savedFilter.period || "month",
    date: savedFilter.date || today,
    month: savedFilter.month || today.slice(0, 7)
  };
}

function channelReceiptFilteredEntries() {
  const filter = channelFilterDefaults();
  return [...(state.channelReceipts || [])]
    .filter(entry => {
      const date = String(entry.date || "");
      if (filter.period === "day") {
        return date === filter.date;
      }
      if (filter.period === "week") {
        const start = isoDate(startOfWeek(new Date(`${filter.date}T00:00:00`)));
        const end = isoDate(endOfWeek(new Date(`${filter.date}T00:00:00`)));
        return date >= start && date <= end;
      }
      return date.startsWith(filter.month);
    })
    .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
}

function channelFilterTitle(filter = channelFilterDefaults()) {
  if (filter.period === "day") {
    return formatIsoDateBr(filter.date);
  }
  if (filter.period === "week") {
    const start = isoDate(startOfWeek(new Date(`${filter.date}T00:00:00`)));
    const end = isoDate(endOfWeek(new Date(`${filter.date}T00:00:00`)));
    return `${formatIsoDateBr(start)} a ${formatIsoDateBr(end)}`;
  }
  return formatMonthKeyBr(filter.month);
}

function channelReceiptTable(entries = []) {
  if (!entries.length) {
    return `<p class="muted">Nenhum valor de canal lançado neste período.</p>`;
  }

  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Data</th>
            ${cardapioPaymentDefinitions.map(([, label]) => `<th>${label}</th>`).join("")}
            <th>iFood</th>
            <th>99 Food</th>
            <th>Total</th>
            <th>Observação</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${entries.map(item => `
            <tr>
              <td>${formatIsoDateBr(item.date)}</td>
              ${cardapioPaymentDefinitions.map(([paymentKey]) => `<td>${money(cardapioPaymentAmount(item, paymentKey))}</td>`).join("")}
              <td>${money(channelReceiptAmount(item, "ifood", "net"))}</td>
              <td>${money(channelReceiptAmount(item, "food99", "net"))}</td>
              <td><strong>${money(channelReceiptTotal(item))}</strong></td>
              <td>${escapeHtml(item.notes || "-")}</td>
              <td>
                <div class="table-actions">
                  <button class="secondary table-action" type="button" data-edit-channel-receipt="${item.id || ""}">Editar</button>
                  <button class="danger table-action" type="button" data-delete-channel-receipt="${item.id || ""}">Excluir</button>
                </div>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function channelReceiptsPanel(editing = null) {
  const channelFilter = channelFilterDefaults();
  const filteredEntries = channelReceiptFilteredEntries();
  const totals = channelReceiptTotals(filteredEntries);
  const dateValue = editing?.date || isoDate(new Date());

  return `
    <div class="cash-tab-section channel-receipts-panel">
      <div>
        <h2>Entradas por canal</h2>
        <p class="muted-inline">Controle separado do saldo da conta. Use para acompanhar quanto entrou em cada plataforma por dia.</p>
      </div>
      <form id="channel-receipt-form" class="form-grid single">
        <label>Data
          <input name="date" type="date" value="${dateValue}" required>
        </label>
        <div class="channel-fieldset">
          <strong>Cardápio Web</strong>
          <div class="channel-payment-grid">
            ${cardapioPaymentDefinitions.map(([paymentKey, label]) => `
              <label>${label}
                <input name="cardapioWeb${capitalize(paymentKey)}" type="text" inputmode="decimal" placeholder="0,00" value="${editing ? moneyInputValue(cardapioPaymentAmount(editing, paymentKey)) : ""}">
              </label>
            `).join("")}
          </div>
        </div>
        ${channelDefinitions.filter(([key]) => key !== "cardapioWeb").map(([key, label]) => `
          <div class="channel-fieldset">
            <strong>${label}</strong>
            <label>Valor diário
              <input name="${key}Net" type="text" inputmode="decimal" placeholder="0,00" value="${editing ? moneyInputValue(channelReceiptAmount(editing, key, "net")) : ""}">
            </label>
          </div>
        `).join("")}
        <label>Observação
          <input name="notes" placeholder="Ex.: repasse, fechamento, conferência" value="${escapeHtml(editing?.notes || "")}">
        </label>
        <div class="actions">
          <button type="submit">${editing ? "Salvar edição" : "Salvar dia"}</button>
          ${editing ? `<button class="secondary" type="button" id="cancel-channel-receipt-edit">Cancelar</button>` : ""}
        </div>
      </form>
      <form id="channel-filter-form" class="filter-bar">
        <label>Filtro
          <select name="period" id="channel-filter-period">
            <option value="day" ${channelFilter.period === "day" ? "selected" : ""}>Dia</option>
            <option value="week" ${channelFilter.period === "week" ? "selected" : ""}>Semana</option>
            <option value="month" ${channelFilter.period === "month" ? "selected" : ""}>Mês</option>
          </select>
        </label>
        <label class="channel-filter-date">Data / semana
          <input name="date" type="date" value="${channelFilter.date}">
        </label>
        <label class="channel-filter-month">Mês
          <input name="month" type="month" value="${channelFilter.month}">
        </label>
        <button type="submit">Aplicar</button>
      </form>
      <div class="summary channel-summary">
        ${channelDefinitions.map(([key, label]) => `
          <div class="metric"><span>${label}</span><strong>${money(totals[`${key}Net`])}</strong></div>
        `).join("")}
        <div class="metric"><span>Total</span><strong>${money(totals.total)}</strong></div>
      </div>
      <h3>${channelFilterTitle(channelFilter)}</h3>
      ${channelReceiptTable(filteredEntries)}
    </div>
  `;
}

function cashCategoryOptions(type, selected = "") {
  const normalizedSelected = normalizedCategory(selected);
  const options = type === "expense"
    ? activeExpenseCategories()
    : activeIncomeCategories();

  return options.map(([value, label]) => `
    <option value="${value}" ${normalizedSelected === value ? "selected" : ""}>${label}</option>
  `).join("");
}

function isBillCategory(value) {
  const normalized = String(value || "").replace(/^supplier:/, "reason:").toLowerCase();
  if (normalized === "ajuste-conta") {
    return false;
  }
  return normalized === "boleto"
    || normalized === "reason:boleto"
    || normalized === "conta"
    || normalized === "contas"
    || normalized === "reason:conta"
    || normalized === "reason:contas"
    || normalized.includes("boleto")
    || normalized.startsWith("conta-")
    || normalized.startsWith("reason:conta-");
}

function isBillEntry(entry = {}) {
  return entry.type === "expense" && (entry.dueDate || isBillCategory(entry.category));
}

function isPendingBill(entry = {}) {
  return isBillEntry(entry) && !entry.paidAt;
}

function cashAccountingDate(entry = {}) {
  return String(entry.date || "");
}

function accountingCashEntries(entries = state.cash) {
  return entries.filter(entry => !isPendingBill(entry));
}

function textLines(value) {
  return String(value || "")
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);
}

function planningText(items) {
  return Array.isArray(items) ? items.map(item => escapeHtml(item)).join("\n") : "";
}

function planningItemsHtml(items, emptyText) {
  const cleanItems = Array.isArray(items) ? items.filter(Boolean) : [];
  if (!cleanItems.length) {
    return `<p class="muted">${emptyText}</p>`;
  }

  return `
    <div class="recent-list">
      ${cleanItems.map(item => `<span><b>${escapeHtml(item)}</b></span>`).join("")}
    </div>
  `;
}

function cashCategoriesPanel(className = "panel supplier-panel") {
  const editing = state.editCashCategory;
  const editList = editing ? uniqueCategories(state.cashCategories?.[editing.type] || []) : [];
  const editingLabel = editing ? editList.find(([key]) => key === editing.key)?.[1] || "" : "";
  const archivedIncome = uniqueCategories(state.cashCategories?.income || []).filter(([key]) => archivedCategoryKeys("income").has(key));
  const archivedExpense = uniqueCategories(state.cashCategories?.expense || []).filter(([key]) => archivedCategoryKeys("expense").has(key));

  return `
    <section class="${className}">
      <h2>Categorias</h2>
      <p class="muted-inline">Adicione ou remova categorias usadas nos lançamentos. O histórico antigo continua preservado.</p>
      <form id="cash-category-admin-form" class="form-grid single">
        <label>Tipo
          <select name="type" ${editing ? "disabled" : ""}>
            <option value="income" ${editing?.type === "income" ? "selected" : ""}>Entrada</option>
            <option value="expense" ${editing?.type === "expense" ? "selected" : ""}>Saída</option>
          </select>
        </label>
        <label>Nome da categoria
          <input name="label" placeholder="Ex.: Cardápio Web, Mercado, Praso" value="${escapeHtml(editingLabel)}" required>
        </label>
        <div class="actions">
          <button type="submit">${editing ? "Salvar edição" : "Adicionar categoria"}</button>
          ${editing ? `<button class="secondary" type="button" id="cancel-cash-category-edit">Cancelar</button>` : ""}
        </div>
      </form>
      <h3>Entradas</h3>
      <div class="reason-list">
        ${activeIncomeCategories().map(([key, label]) => `
          <span>
            <b>${escapeHtml(label)}</b>
            <button class="secondary table-action" type="button" data-edit-cash-category-type="income" data-edit-cash-category="${key}">Editar</button>
            <button class="danger table-action" type="button" data-delete-cash-category-type="income" data-delete-cash-category="${key}">Excluir</button>
          </span>
        `).join("")}
      </div>
      <h3>Saídas</h3>
      ${activeExpenseCategories().length ? `
        <div class="reason-list">
          ${activeExpenseCategories().map(([key, label]) => `
            <span>
              <b>${escapeHtml(label)}</b>
              <button class="secondary table-action" type="button" data-edit-cash-category-type="expense" data-edit-cash-category="${key}">Editar</button>
              <button class="danger table-action" type="button" data-delete-cash-category-type="expense" data-delete-cash-category="${key}">Excluir</button>
            </span>
          `).join("")}
        </div>
      ` : `<p class="muted">Nenhuma categoria de saída cadastrada.</p>`}
      ${archivedIncome.length || archivedExpense.length ? `
        <h3>Excluídas</h3>
        <div class="reason-list archived-reason-list">
          ${[
            ...archivedIncome.map(([key, label]) => ["income", key, label]),
            ...archivedExpense.map(([key, label]) => ["expense", key, label])
          ].map(([type, key, label]) => `
            <span>
              <b>${escapeHtml(label)}</b>
              <small>${type === "income" ? "Entrada" : "Saída"}</small>
              <button class="secondary table-action" type="button" data-reactivate-cash-category-type="${type}" data-reactivate-cash-category="${key}">Reativar</button>
            </span>
          `).join("")}
        </div>
      ` : ""}
    </section>
  `;
}
function cashTotals(entries = state.cash) {
  return accountingCashEntries(entries).reduce((totals, entry) => {
    const amount = Number(entry.amount || 0);
    if (entry.type === "expense") {
      totals.expenses += amount;
    } else {
      totals.income += amount;
    }
    totals.balance = totals.income - totals.expenses;
    return totals;
  }, { income: 0, expenses: 0, balance: 0 });
}

function withdrawalSplit(amount) {
  const total = Math.max(0, parseMoneyInput(amount));
  const config = {
    ...defaultAppConfig,
    ...(state.appConfig || {})
  };
  const savingsPercent = Math.max(0, Number(config.splitSavingsPercent || 0));
  const vanessaPercent = Math.max(0, Number(config.splitVanessaPercent || 0));
  const raquelPercent = Math.max(0, Number(config.splitRaquelPercent || 0));
  const partnersTotal = vanessaPercent + raquelPercent || 100;
  const savings = total * (savingsPercent / 100);
  const remaining = total - savings;
  const vanessa = remaining * (vanessaPercent / partnersTotal);
  const raquel = remaining * (raquelPercent / partnersTotal);

  return { total, savings, remaining, vanessa, raquel };
}

function withdrawalSplitFromRaquel(raquelAmount) {
  const raquel = Math.max(0, parseMoneyInput(raquelAmount));
  const config = {
    ...defaultAppConfig,
    ...(state.appConfig || {})
  };
  const savingsPercent = Math.max(0, Number(config.splitSavingsPercent || 0));
  const vanessaPercent = Math.max(0, Number(config.splitVanessaPercent || 0));
  const raquelPercent = Math.max(0, Number(config.splitRaquelPercent || 0));
  const partnersTotal = vanessaPercent + raquelPercent || 100;

  if (!raquelPercent) {
    const total = raquel;
    return { total, savings: 0, remaining: total, vanessa: 0, raquel };
  }

  const base = raquel / (raquelPercent / partnersTotal);
  const savings = base * (savingsPercent / 100);
  const vanessa = base * (vanessaPercent / partnersTotal);
  const total = savings + vanessa + raquel;

  return { total, savings, remaining: base, vanessa, raquel };
}

function accountBalanceAdjustment(targetBalance, currentBalance) {
  const target = parseMoneyInput(targetBalance);
  const current = Number(currentBalance || 0);
  const difference = target - current;

  return {
    target,
    current,
    difference,
    type: difference < 0 ? "expense" : "income",
    amount: Math.abs(difference)
  };
}

function accountAdjustmentEntries(limit = 6) {
  return [...state.cash]
    .filter(isAccountAdjustmentEntry)
    .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")) || String(b.id || "").localeCompare(String(a.id || "")))
    .slice(0, limit);
}

function isAccountAdjustmentEntry(entry = {}) {
  return entry.category === "ajuste-conta" || String(entry.id || "").startsWith("account-adjustment-");
}

function reconciliationBaseForDate(dateKey, ignoredAdjustmentId = null) {
  const monthKey = String(dateKey || isoDate(new Date())).slice(0, 7);
  const entries = accountingCashEntries(state.cash).filter(entry => {
    return cashAccountingDate(entry).startsWith(monthKey)
      && String(entry.id) !== String(ignoredAdjustmentId ?? "")
      && !isAccountAdjustmentEntry(entry);
  });
  return cashTotals(entries).balance;
}

function removeAccountAdjustmentsForMonth(monthKey) {
  state.cash = state.cash.filter(entry => {
    if (!isAccountAdjustmentEntry(entry)) {
      return true;
    }
    return !cashAccountingDate(entry).startsWith(monthKey);
  });
}

function monthlyAccountBalance(monthKey) {
  const month = String(monthKey || "").slice(0, 7);
  if (!month) {
    return null;
  }
  const monthEntries = accountingCashEntries(state.cash).filter(entry => cashAccountingDate(entry).startsWith(month));
  return cashTotals(monthEntries).balance;
}

function accountAdjustmentHistoryHtml() {
  const adjustments = accountAdjustmentEntries();
  if (!adjustments.length) {
    return `<p class="muted">Nenhum ajuste de conta registrado.</p>`;
  }

  return `
    <div class="recent-list reconciliation-history">
      ${adjustments.map(entry => `
        <span>
          <b class="${entry.type === "expense" ? "negative" : "positive"}">${entry.type === "expense" ? "-" : "+"}${money(entry.amount)}</b>
          <em>${entry.description || "Ajuste da conta"}</em>
          <small>${formatIsoDateBr(entry.date)}</small>
          <div class="table-actions">
            <button class="secondary table-action" type="button" data-edit-account-adjustment="${escapeHtml(String(entry.id || ""))}">Editar</button>
            <button class="danger table-action" type="button" data-delete-account-adjustment="${escapeHtml(String(entry.id || ""))}">Excluir</button>
          </div>
        </span>
      `).join("")}
    </div>
  `;
}

function isWithdrawalEntry(entry = {}) {
  return entry.category === "retirada" || String(entry.description || "").toLowerCase().startsWith("retirada -");
}

function withdrawalTarget(entry = {}) {
  const text = String(entry.description || "").toLowerCase();
  if (text.includes("cofrinho")) {
    return "savings";
  }
  if (text.includes("vanessa")) {
    return "vanessa";
  }
  if (text.includes("raquel")) {
    return "raquel";
  }
  return "other";
}

function withdrawalGroupKey(entry = {}) {
  const match = String(entry.id || "").match(/^withdrawal-(.+)-(savings|vanessa|raquel)$/);
  return match ? `withdrawal-${match[1]}` : String(entry.id || "");
}

function withdrawalHistoryGroups(entries = cashEntriesForSelectedPeriod()) {
  const groups = new Map();
  entries.filter(isWithdrawalEntry).forEach(entry => {
    const key = withdrawalGroupKey(entry);
    const group = groups.get(key) || {
      key,
      date: entry.date || "",
      savings: 0,
      vanessa: 0,
      raquel: 0,
      other: 0,
      total: 0,
      distributionBase: 0,
      entries: []
    };
    const target = withdrawalTarget(entry);
    group[target] += Number(entry.amount || 0);
    group.total += Number(entry.amount || 0);
    group.distributionBase = Math.max(group.distributionBase, Number(entry.distributionBase || 0));
    group.entries.push(entry);
    groups.set(key, group);
  });
  return [...groups.values()].map(group => {
    const expected = withdrawalSplitFromRaquel(group.raquel);
    return {
      ...group,
      distributionBase: expected.total || group.distributionBase || group.total,
      expectedSavings: expected.savings,
      expectedVanessa: expected.vanessa,
      expectedRaquel: expected.raquel,
      differenceSavings: expected.savings - group.savings,
      differenceVanessa: expected.vanessa - group.vanessa
    };
  }).sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

function partnerDifferenceLabel(value) {
  const amount = Number(value || 0);
  if (Math.abs(amount) < 0.01) {
    return "Sem diferença";
  }
  return amount > 0
    ? `Diferença ${money(amount)}`
    : `Antecipação ${money(Math.abs(amount))}`;
}

function withdrawalGroupsBetween(start, end) {
  return withdrawalHistoryGroups(state.cash).filter(group => group.date >= start && group.date <= end);
}

function partnerPeriodTotals(groups = []) {
  return groups.reduce((totals, group) => {
    totals.savings += Number(group.savings || 0);
    totals.vanessa += Number(group.vanessa || 0);
    totals.raquel += Number(group.raquel || 0);
    totals.expectedVanessa += Number(group.expectedVanessa || 0);
    totals.expectedRaquel += Number(group.expectedRaquel || 0);
    totals.differenceSavings += Number(group.differenceSavings || 0);
    totals.differenceVanessa += Number(group.differenceVanessa || 0);
    return totals;
  }, {
    savings: 0,
    vanessa: 0,
    raquel: 0,
    expectedVanessa: 0,
    expectedRaquel: 0,
    differenceSavings: 0,
    differenceVanessa: 0
  });
}

function partnerDashboard(referenceDate, monthKey) {
  const selected = new Date(`${referenceDate}T00:00:00`);
  const weekStart = isoDate(startOfWeek(selected));
  const weekEnd = isoDate(endOfWeek(selected));
  const [year, month] = String(monthKey).split("-").map(Number);
  const monthStart = `${monthKey}-01`;
  const monthEnd = isoDate(new Date(year, month, 0));
  const week = partnerPeriodTotals(withdrawalGroupsBetween(weekStart, weekEnd));
  const monthTotals = partnerPeriodTotals(withdrawalGroupsBetween(monthStart, monthEnd));
  const monthEntries = accountingCashEntries(state.cash).filter(entry => {
    const date = cashAccountingDate(entry);
    return date >= monthStart && date <= monthEnd;
  });
  const financial = financialSummary(monthEntries);
  const today = isoDate(new Date());
  const projectionEnd = today < monthStart ? monthStart : today > monthEnd ? monthEnd : today;
  const elapsedDays = Math.max(1, daysBetweenInclusive(monthStart, projectionEnd));
  const totalDays = daysBetweenInclusive(monthStart, monthEnd);
  const projectedProfit = (financial.profitBeforeWithdrawals / elapsedDays) * totalDays;
  const projectedAvailable = projectedProfit - financial.withdrawals.total;

  return {
    weekStart,
    weekEnd,
    monthStart,
    monthEnd,
    week,
    month: monthTotals,
    projection: withdrawalSplit(Math.max(0, projectedAvailable))
  };
}

function withdrawalHistoryHtml() {
  const groups = withdrawalHistoryGroups();
  if (!groups.length) {
    return `<p class="muted">Nenhuma retirada registrada neste período.</p>`;
  }
  return `
    <div class="table-wrap report-table">
      <table>
        <thead><tr><th>Data</th><th>Cofrinho</th><th>Vanessa</th><th>Raquel</th><th>Diferenças</th><th>Total retirado</th><th></th></tr></thead>
        <tbody>
          ${groups.map(group => `
            <tr>
              <td>${formatIsoDateBr(group.date)}</td>
              <td>${money(group.savings)}</td>
              <td>${money(group.vanessa)}</td>
              <td>${money(group.raquel)}</td>
              <td>
                <small>Cofrinho: ${partnerDifferenceLabel(group.differenceSavings)}</small><br>
                <small>Vanessa: ${partnerDifferenceLabel(group.differenceVanessa)}</small><br>
              </td>
              <td><strong>${money(group.total)}</strong></td>
              <td><button class="secondary table-action" type="button" data-edit-withdrawal="${escapeHtml(group.key)}">Editar</button></td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function savingsBalance() {
  return Number(state.financialPlanning?.savings || 0);
}

function savingsHistoryRows() {
  return Array.isArray(state.financialPlanning?.savingsHistory)
    ? state.financialPlanning.savingsHistory
    : [];
}

function updateSavingsBalance({ amount, date, type, description }) {
  const current = savingsBalance();
  const numericAmount = Number(amount || 0);
  const nextBalance = type === "withdrawal"
    ? Math.max(0, current - numericAmount)
    : type === "set"
      ? Math.max(0, numericAmount)
      : Math.max(0, current + numericAmount);

  state.financialPlanning = {
    ...(state.financialPlanning || {}),
    savings: nextBalance.toFixed(2),
    savingsUpdatedAt: date || isoDate(new Date()),
    savingsHistory: [
      {
        id: `savings-${Date.now()}`,
        date: date || isoDate(new Date()),
        type,
        amount: numericAmount.toFixed(2),
        balance: nextBalance.toFixed(2),
        description: description || ""
      },
      ...savingsHistoryRows()
    ].slice(0, 40)
  };
  return nextBalance;
}

function partnersHistoryRows() {
  return Array.isArray(state.financialPlanning?.partnersHistory)
    ? state.financialPlanning.partnersHistory
    : [];
}

function partnersRecordForPeriod(periodKey = currentMonthKey()) {
  return partnersHistoryRows().find(entry => entry.periodKey === periodKey) || {
    periodKey,
    vanessa: "",
    raquel: "",
    difference: "",
    notes: "",
    updatedAt: ""
  };
}

function upsertPartnersRecord(record) {
  const rows = partnersHistoryRows().filter(entry => entry.periodKey !== record.periodKey);
  state.financialPlanning = {
    ...(state.financialPlanning || {}),
    partnersHistory: [
      {
        ...record,
        updatedAt: new Date().toISOString()
      },
      ...rows
    ].slice(0, 48)
  };
}

function financialSummary(cashEntries = []) {
  const summary = {
    income: 0,
    operationalExpenses: 0,
    withdrawals: {
      savings: 0,
      vanessa: 0,
      raquel: 0,
      other: 0,
      total: 0
    },
    withdrawalEntries: []
  };

  accountingCashEntries(cashEntries).forEach(entry => {
    const amount = Number(entry.amount || 0);
    if (entry.type !== "expense") {
      summary.income += amount;
      return;
    }

    if (isWithdrawalEntry(entry)) {
      const target = withdrawalTarget(entry);
      summary.withdrawals[target] += amount;
      summary.withdrawals.total += amount;
      summary.withdrawalEntries.push(entry);
      return;
    }

    summary.operationalExpenses += amount;
  });

  summary.profitBeforeWithdrawals = summary.income - summary.operationalExpenses;
  summary.availableForWithdrawal = summary.profitBeforeWithdrawals - summary.withdrawals.total;
  summary.balance = summary.availableForWithdrawal;
  summary.suggestedWithdrawal = withdrawalSplit(Math.max(0, summary.availableForWithdrawal));
  return summary;
}

function lastMonthKey(date = new Date()) {
  const copy = new Date(date.getFullYear(), date.getMonth() - 1, 1);
  return `${copy.getFullYear()}-${String(copy.getMonth() + 1).padStart(2, "0")}`;
}

function ensureCashEntryIds() {
  let changed = false;
  state.cash = state.cash.map((entry, index) => {
    if (entry.id) {
      return entry;
    }

    changed = true;
    return {
      id: `cash-${Date.now()}-${index}`,
      ...entry
    };
  });

  if (changed) {
    persistLocal();
  }
}

function menuKey(week = state.menuWeek) {
  const month = String(state.menuPeriod.month).padStart(2, "0");
  return `${state.menuPeriod.year}-${month}-semana-${week}`;
}

function menuPeriodKeyFromKey(key = menuKey()) {
  return String(key).slice(0, 7);
}

function currentMenuPeriodKey() {
  const month = String(state.menuPeriod.month).padStart(2, "0");
  return `${state.menuPeriod.year}-${month}`;
}

function reportPeriodKey() {
  const month = String(state.reportPeriod.month).padStart(2, "0");
  return `${state.reportPeriod.year}-${month}`;
}

function reportWeekKey() {
  return `${reportPeriodKey()}-semana-${Number(state.reportPeriod.week || 1)}`;
}

function defaultReportWeekRange() {
  const today = new Date();
  return {
    start: isoDate(startOfWeek(today)),
    end: isoDate(endOfWeek(today))
  };
}

function reportWeekRange() {
  const fallback = defaultReportWeekRange();
  return {
    start: state.reportPeriod.start || fallback.start,
    end: state.reportPeriod.end || fallback.end
  };
}

function formatIsoDateBr(date) {
  const [year, month, day] = String(date || "").split("-");
  if (!year || !month || !day) {
    return date || "";
  }

  return `${day}/${month}/${year}`;
}

function formatMonthKeyBr(key) {
  const [year, month] = String(key || "").split("-").map(Number);
  if (!year || !month) {
    return key || "";
  }
  return monthYear.format(new Date(year, month - 1, 1));
}

function reportWeekRangeLabel() {
  const { start, end } = reportWeekRange();
  return `${formatIsoDateBr(start)} a ${formatIsoDateBr(end)}`;
}

function reportDate() {
  return state.reportPeriod.date || isoDate(new Date());
}

function reportPeriodBounds(data = reportData()) {
  if (data.type === "day") {
    return { start: data.date, end: data.date };
  }
  if (data.type === "week") {
    return reportWeekRange();
  }
  const [year, month] = String(data.periodKey || currentMonthKey()).split("-").map(Number);
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate = new Date(year, month, 0);
  return { start, end: isoDate(endDate) };
}

function daysBetweenInclusive(start, end) {
  const startDate = new Date(`${start}T00:00:00`);
  const endDate = new Date(`${end}T00:00:00`);
  return Math.max(1, Math.round((endDate - startDate) / 86400000) + 1);
}

function monthOptions(selectedMonth) {
  const months = [
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro"
  ];

  return months.map((month, index) => {
    const value = index + 1;
    return `<option value="${value}" ${value === Number(selectedMonth) ? "selected" : ""}>${month}</option>`;
  }).join("");
}

function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function currentMonthEndDate() {
  const now = new Date();
  return isoDate(new Date(now.getFullYear(), now.getMonth() + 1, 0));
}

function dishNameForSlot(menuItems, slot) {
  return menuItems.find(item => Number(item.slot) === Number(slot))?.dish || `Cumbuca ${slot}`;
}

function weeklyDishTotals(menuItems, orders) {
  return [1, 2, 3, 4, 5]
    .map(slot => ({
      slot,
      dish: dishNameForSlot(menuItems, slot),
      quantity: orders.reduce((sum, order) => sum + orderDishQuantity(order, slot), 0)
    }))
    .filter(item => item.quantity > 0 || menuItems.some(menu => Number(menu.slot) === Number(item.slot)));
}

function dashboardPendingPayments(orders) {
  return orders.filter(order => {
    const client = clientByPhone(order.clientPhone);
    return client.plan === "semanal" && !isOrderPaid(order);
  });
}

function paymentReminderDate(entry) {
  const today = isoDate(new Date());
  if (entry.dueDate) {
    return entry.dueDate;
  }
  if (entry.date && entry.date >= today) {
    return entry.date;
  }
  return "";
}

function dashboardPendingCashPayments(limit = 5) {
  const monthEnd = currentMonthEndDate();

  return state.cash
    .filter(isPendingBill)
    .map(entry => ({
      ...entry,
      reminderDate: paymentReminderDate(entry)
    }))
    .filter(entry => entry.reminderDate && entry.reminderDate <= monthEnd)
    .sort((a, b) => String(a.reminderDate).localeCompare(String(b.reminderDate)))
    .slice(0, limit);
}

function dashboardLowMonthlyClients(currentKey) {
  return state.clients
    .filter(client => !client.inactive)
    .filter(client => client.plan === "mensalista")
    .filter(client => isLowMonthlyQuantity(client, currentKey) || clientRemainingQuantity(client, currentKey) <= 0)
    .slice(0, 5);
}

function dashboardClientsWithoutAddress() {
  return state.clients
    .filter(client => !client.inactive)
    .filter(client => !String(client.address || "").trim())
    .slice(0, 5);
}

function dashboardMenuWithoutCost(menuItems) {
  return menuItems.filter(item => String(item.dish || "").trim() && Number(item.cost || 0) <= 0);
}

function homeMetricData() {
  const monthKey = currentMonthKey();
  const currentMenuKey = menuKey(state.menuWeek || 1);
  const menuItems = state.menus[currentMenuKey] || [];
  const weekOrders = state.orders.filter(order => order.menuKey === currentMenuKey);
  const monthOrders = state.orders.filter(order => menuPeriodKeyFromKey(order.menuKey) === monthKey);
  const monthCash = accountingCashEntries(state.cash).filter(entry => cashAccountingDate(entry).startsWith(monthKey));
  const todayKey = isoDate(new Date());
  const todayCash = accountingCashEntries(state.cash).filter(entry => cashAccountingDate(entry) === todayKey);
  const todayOrders = weekOrders.filter(order => String(order.createdAt || "").slice(0, 10) === todayKey);
  const weekStart = isoDate(startOfWeek(new Date()));
  const weekEnd = isoDate(endOfWeek(new Date()));
  const weekCash = accountingCashEntries(state.cash).filter(entry => {
    const date = cashAccountingDate(entry);
    return date >= weekStart && date <= weekEnd;
  });
  const income = monthCash
    .filter(entry => entry.type !== "expense")
    .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const expenses = monthCash
    .filter(entry => entry.type === "expense")
    .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const todayIncome = todayCash
    .filter(entry => entry.type !== "expense")
    .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const todayExpenses = todayCash
    .filter(entry => entry.type === "expense")
    .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const weekIncome = weekCash
    .filter(entry => entry.type !== "expense")
    .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const weekExpenses = weekCash
    .filter(entry => entry.type === "expense")
    .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const recentExpenses = accountingCashEntries(state.cash)
    .filter(entry => entry.type === "expense")
    .sort((a, b) => cashAccountingDate(b).localeCompare(cashAccountingDate(a)))
    .slice(0, 3);
  const topMonthExpenses = [...monthCash]
    .filter(entry => entry.type === "expense" && !isWithdrawalEntry(entry))
    .sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0))
    .slice(0, 5);
  const monthFinancial = financialSummary(monthCash);
  const storeToday = state.storeSales
    .filter(entry => entry.date === todayKey)
    .reduce((sum, entry) => sum + Number(entry.quantity || 0), 0);

  return {
    balance: income - expenses,
    todayBalance: todayIncome - todayExpenses,
    todayIncome,
    todayExpenses,
    weekBalance: weekIncome - weekExpenses,
    weekIncome,
    weekExpenses,
    monthWithdrawals: monthFinancial.withdrawals.total,
    weekStart,
    weekEnd,
    todayOrders,
    weekOrders,
    orders: monthOrders.length,
    bowls: monthOrders.reduce((sum, order) => sum + orderQuantity(order), 0),
    clients: state.clients.filter(client => !client.inactive).length,
    planned: menuItems.length,
    ready: menuItems.filter(item => item.status === "pronto").length,
    storeToday,
    recentExpenses,
    topMonthExpenses,
    dishTotals: weeklyDishTotals(menuItems, weekOrders),
    pendingPayments: dashboardPendingPayments(weekOrders),
    pendingCashPayments: dashboardPendingCashPayments(),
    lowMonthlyClients: dashboardLowMonthlyClients(currentMenuKey),
    clientsWithoutAddress: dashboardClientsWithoutAddress(),
    menuWithoutCost: dashboardMenuWithoutCost(menuItems),
    monthKey
  };
}

function dashboardAlerts(metrics, weeklyOrders) {
  const alerts = [];

  if (metrics.weekBalance < 0) {
    alerts.push(["Saldo da semana negativo", money(metrics.weekBalance)]);
  }

  if (!weeklyOrders) {
    alerts.push(["Nenhum pedido na semana aberta", "Confira o menu"]);
  }

  if (metrics.pendingPayments.length) {
    alerts.push(["Pagamentos pendentes", `${metrics.pendingPayments.length} pedido(s)`]);
  }

  if (metrics.pendingCashPayments.length) {
    alerts.push(["Contas a vencer", `${metrics.pendingCashPayments.length} conta(s)`]);
  }

  if (metrics.lowMonthlyClients.length) {
    alerts.push(["Mensalistas no limite", `${metrics.lowMonthlyClients.length} cliente(s)`]);
  }

  if (metrics.clientsWithoutAddress.length) {
    alerts.push(["Cliente sem endereço", `${metrics.clientsWithoutAddress.length} cadastro(s)`]);
  }

  if (metrics.menuWithoutCost.length) {
    alerts.push(["Menu sem custo", `${metrics.menuWithoutCost.length} cumbuca(s)`]);
  }

  if (!metrics.storeToday) {
    alerts.push(["Loja sem venda lançada hoje", "Atualize se já vendeu"]);
  }

  if (!metrics.recentExpenses.length) {
    alerts.push(["Sem despesas recentes", "Tudo limpo por enquanto"]);
  }

  return alerts;
}

function monthlyClientRows(currentKey = menuKey(state.menuWeek || 1)) {
  return state.clients
    .filter(client => client.plan === "mensalista" && !client.inactive)
    .map(client => {
      const capacity = clientMonthlyCapacity(client, currentKey);
      const remaining = clientRemainingQuantity(client, currentKey);
      const used = Math.max(0, capacity - remaining);
      return {
        client,
        capacity,
        used,
        remaining,
        value: clientMonthlyValue(client, currentKey),
        packages: clientChargedPackageCount(client, currentKey)
      };
    })
    .sort((a, b) => a.remaining - b.remaining);
}

function monthlyClientsPanel(currentKey = menuKey(state.menuWeek || 1)) {
  const rows = monthlyClientRows(currentKey);
  return `
    <div class="panel dashboard-panel">
      <h2>Controle de mensalistas</h2>
      ${rows.length ? `
        <div class="recent-list compact">
          ${rows.slice(0, 8).map(row => `
            <span>
              <b>${row.remaining}/${row.capacity}</b>
              ${row.client.name || row.client.phone}
              <small>${money(row.value)} - usados ${row.used}${row.packages > 1 ? ` - ${row.packages} pacotes` : ""}</small>
              ${row.client.phone ? `<a class="secondary table-action" href="${monthlyRenewalWhatsAppUrl(row.client, currentKey)}" target="_blank" rel="noopener">WhatsApp</a>` : ""}
            </span>
          `).join("")}
        </div>
      ` : `<p class="muted">Nenhum mensalista ativo cadastrado.</p>`}
    </div>
  `;
}

function growthMetrics() {
  const currentKey = currentMonthKey();
  const previousKey = previousMonthKeyFromPeriod(currentKey);
  const currentOrders = state.orders.filter(order => menuPeriodKeyFromKey(order.menuKey) === currentKey);
  const previousOrders = state.orders.filter(order => menuPeriodKeyFromKey(order.menuKey) === previousKey);
  const currentStore = state.storeSales.filter(entry => String(entry.date || "").startsWith(currentKey));
  const previousStore = state.storeSales.filter(entry => String(entry.date || "").startsWith(previousKey));
  const currentRevenue = currentOrders.reduce((sum, order) => sum + Number(order.amount || 0) + Number(order.deliveryFee || 0), 0);
  const previousRevenue = previousOrders.reduce((sum, order) => sum + Number(order.amount || 0) + Number(order.deliveryFee || 0), 0);
  const currentBowls = currentOrders.reduce((sum, order) => sum + orderQuantity(order), 0) + currentStore.reduce((sum, entry) => sum + Number(entry.quantity || 0), 0);
  const previousBowls = previousOrders.reduce((sum, order) => sum + orderQuantity(order), 0) + previousStore.reduce((sum, entry) => sum + Number(entry.quantity || 0), 0);
  const currentClients = new Set(currentOrders.map(order => order.clientPhone).filter(Boolean)).size;
  const previousClients = new Set(previousOrders.map(order => order.clientPhone).filter(Boolean)).size;
  return {
    currentKey,
    previousKey,
    revenue: currentRevenue,
    revenueDelta: currentRevenue - previousRevenue,
    bowls: currentBowls,
    bowlsDelta: currentBowls - previousBowls,
    clients: currentClients,
    clientsDelta: currentClients - previousClients,
    averageTicket: currentOrders.length ? currentRevenue / currentOrders.length : 0
  };
}

function growthDashboardPanel() {
  const growth = growthMetrics();
  return `
    <div class="panel dashboard-panel growth-panel">
      <h2>Crescimento</h2>
      <div class="summary">
        <div class="metric"><span>Receita pedidos</span><strong>${money(growth.revenue)}</strong><small>${growth.revenueDelta < 0 ? "-" : "+"}${money(Math.abs(growth.revenueDelta))}</small></div>
        <div class="metric"><span>Cumbucas</span><strong>${growth.bowls}</strong><small>${growth.bowlsDelta < 0 ? "" : "+"}${growth.bowlsDelta}</small></div>
        <div class="metric"><span>Clientes ativos</span><strong>${growth.clients}</strong><small>${growth.clientsDelta < 0 ? "" : "+"}${growth.clientsDelta}</small></div>
        <div class="metric"><span>Ticket medio</span><strong>${money(growth.averageTicket)}</strong></div>
      </div>
      <p class="muted">Comparado com ${formatMonthKeyBr(growth.previousKey)}.</p>
    </div>
  `;
}

function notificationRows(metrics = homeMetricData(), weeklyOrders = 0) {
  const backupAt = localStorage.getItem("lastManualBackupAt") || "";
  const backupOld = !backupAt || (Date.now() - new Date(backupAt).getTime()) > 7 * 86400000;
  return [
    ...dashboardAlerts(metrics, weeklyOrders).map(([title, detail]) => ({ type: "alerta", title, detail, action: "/alertas" })),
    backupOld ? { type: "backup", title: "Backup manual antigo", detail: "Baixe ou salve um backup no Supabase.", action: "/backups" } : null,
    ...systemIssues().slice(0, 3).map(issue => ({ type: issue.type, title: issue.message, detail: new Date(issue.createdAt).toLocaleString("pt-BR"), action: "/backups" }))
  ].filter(Boolean);
}

function home() {
  title.textContent = "Cumbuca";
  setActive("");
  const metrics = homeMetricData();
  const weeklyOrders = state.orders.filter(order => order.menuKey === menuKey(state.menuWeek || 1)).length;
  const alerts = dashboardAlerts(metrics, weeklyOrders);
  const tools = [
    ["fluxo-de-caixa", "Fluxo de Caixa", "Entradas, saídas e saldo", money(metrics.weekBalance), "Saldo da semana", "cash"],
    ["menu-semanal", "Menu Semanal", "Pratos, preparo e pedidos", `${metrics.ready}/${metrics.planned || 0}`, "Prontos na semana", "menu"],
    ["loja", "Loja", "Vendas do balcão por data", String(metrics.storeToday), "Cumbucas hoje", "store"],
    ["financeiro", "Financeiro", "Conferência financeira", money(metrics.balance), "Saldo do mês", "finance"],
    ["precificacao", "Precificação", "Ingredientes, margem e venda", String(state.ingredients.length), "Itens cadastrados", "price"],
    ["relatorios", "Relatórios", "Leituras mensais e exportações", String(metrics.bowls), "Cumbucas no mês", "report"]
  ];

  app.innerHTML = `
    <section class="dashboard-band">
      <div class="dashboard-copy">
        <span>Painel ${formatMonthKeyBr(metrics.monthKey)}</span>
        <h2>Resumo rápido da operação</h2>
        <p>Caixa, clientes, pedidos e produção em uma visão para abrir o dia com clareza.</p>
      </div>
      <div class="dashboard-kpis">
        <div class="metric dashboard-metric is-primary">
          <span>Saldo do mês</span>
          <strong class="${metrics.balance < 0 ? "negative" : "positive"}">${money(metrics.balance)}</strong>
        </div>
        <div class="metric dashboard-metric">
          <span>Contas a vencer</span>
          <strong>${metrics.pendingCashPayments.length}</strong>
        </div>
        <div class="metric dashboard-metric">
          <span>Entradas da semana</span>
          <strong>${money(metrics.weekIncome)}</strong>
        </div>
        <div class="metric dashboard-metric">
          <span>Retiradas no mês</span>
          <strong>${money(metrics.monthWithdrawals)}</strong>
        </div>
      </div>
    </section>

    <section class="panel start-panel">
      <div class="section-heading">
        <div>
          <h2>Começar agora</h2>
          <p class="muted-inline">Ações mais usadas para operar o dia sem procurar nos menus.</p>
        </div>
      </div>
      <div class="quick-actions start-actions">
        <a href="/fluxo-de-caixa"><b>Lançar entrada</b><small>Vendas e ajustes da conta</small></a>
        <a href="/fluxo-de-caixa"><b>Lançar saída</b><small>Compras, boletos e despesas</small></a>
        <a href="/menu-semanal"><b>Cadastrar cliente</b><small>Semanalista ou mensalista</small></a>
        <a href="/menu-semanal"><b>Novo pedido</b><small>Pedido por cumbuca</small></a>
        <a href="/loja"><b>Venda da loja</b><small>Quantidade vendida hoje</small></a>
        <a href="/backups"><b>Backup</b><small>Baixar antes de mudanças</small></a>
      </div>
    </section>

    <div class="dashboard-section-title">
      <span>Ferramentas</span>
      <strong>Atalhos principais</strong>
    </div>
    <div class="home-grid">
      ${tools.map(([href, heading, text, value, label, tone]) => `
        <a class="card tool-card tone-${tone}" href="/${href}">
          <span class="card-icon" aria-hidden="true"></span>
          <div>
            <h2>${heading}</h2>
            <p>${text}</p>
          </div>
          <div class="card-footer">
            <span>
              <b>${value}</b>
              ${label}
            </span>
            <strong class="card-action">Abrir</strong>
          </div>
        </a>
      `).join("")}
    </div>

    <section class="dashboard-lane">
      <div class="panel dashboard-panel">
        <h2>Hoje e semana</h2>
        <div class="focus-list">
          <span><strong>${metrics.todayOrders.length}</strong> pedidos hoje</span>
          <span><strong>${money(metrics.weekIncome)}</strong> entradas</span>
          <span><strong>${money(metrics.weekExpenses)}</strong> saídas</span>
          <span><strong>${weeklyOrders}</strong> pedidos na semana aberta</span>
        </div>
      </div>
      <div class="panel dashboard-panel">
        <h2>Notificações</h2>
        ${notifications.length ? `
          <div class="alert-list">
            ${notifications.slice(0, 6).map(item => `<span><b>${item.title}</b>${item.detail}<a class="secondary table-action" href="${item.action}">Abrir</a></span>`).join("")}
          </div>
        ` : `<p class="muted">Nenhuma notificação agora.</p>`}
      </div>
    </section>

    <section class="dashboard-lane">
      ${growthDashboardPanel()}
      ${monthlyClientsPanel(menuKey(state.menuWeek || 1))}
    </section>

    <section class="dashboard-lane">
      <div class="panel dashboard-panel">
        <h2>Produção por sabor</h2>
        ${metrics.dishTotals.length ? `
          <div class="recent-list">
            ${metrics.dishTotals.map(item => `
              <span><b>${item.quantity}</b>${item.dish || `Cumbuca ${item.slot}`}<small>Cumbuca ${item.slot}</small></span>
            `).join("")}
          </div>
        ` : `<p class="muted">Nenhuma cumbuca planejada ou pedida nesta semana.</p>`}
      </div>
      <div class="panel dashboard-panel">
        <h2>Ações rápidas</h2>
        <div class="quick-actions">
          <a href="/fluxo-de-caixa"><b>Lançar canal</b><small>Cardápio, iFood e 99 Food</small></a>
          <a href="/fluxo-de-caixa"><b>Lançar saída</b><small>Caixa</small></a>
          <a href="/menu-semanal"><b>Novo pedido</b><small>Menu semanal</small></a>
          <a href="/financeiro"><b>Conferir caixa</b><small>Fechamento</small></a>
          <a href="/backups"><b>Manutenção</b><small>Backup e limpeza</small></a>
        </div>
      </div>
    </section>

    <section class="dashboard-lane">
      <div class="panel dashboard-panel">
        <h2>Mensalistas no limite</h2>
        ${metrics.lowMonthlyClients.length ? `
          <div class="recent-list">
            ${metrics.lowMonthlyClients.map(client => `
              <span><b>${clientRemainingQuantity(client, menuKey(state.menuWeek || 1))}</b>${client.name || client.phone}<small>restantes</small></span>
            `).join("")}
          </div>
        ` : `<p class="muted">Nenhum mensalista no limite agora.</p>`}
      </div>
      <div class="panel dashboard-panel">
        <h2>Pagamentos pendentes</h2>
        ${metrics.pendingPayments.length || metrics.pendingCashPayments.length ? `
          <div class="recent-list">
            ${metrics.pendingCashPayments.map(entry => `
              <span>
                <b>${money(entry.amount)}</b>
                ${entry.description || categoryName(entry.category)}
                <small>${formatIsoDateBr(entry.reminderDate)} - ${entry.dueDate ? dueDateDistanceLabel(entry.dueDate) : "Despesa programada"}</small>
              </span>
            `).join("")}
            ${metrics.pendingPayments.slice(0, 5).map(order => {
              const client = clientByPhone(order.clientPhone);
              return `<span><b>${money(order.amount)}</b>${client.name || order.clientPhone}<small>${orderQuantity(order)} cumbucas - pedido semanal</small></span>`;
            }).join("")}
          </div>
        ` : `<p class="muted">Nenhum pagamento ou conta pendente.</p>`}
      </div>
    </section>

    <section class="dashboard-lane">
      <div class="panel dashboard-panel">
        <h2>Despesas recentes</h2>
        ${metrics.recentExpenses.length ? `
            <div class="recent-list compact">
              ${metrics.recentExpenses.map(entry => `
                <span><b>${money(entry.amount)}</b>${entry.description || "Despesa"}<small>${formatIsoDateBr(cashAccountingDate(entry))}</small></span>
              `).join("")}
            </div>
          ` : `<p class="muted">Nenhuma despesa lançada ainda.</p>`}
      </div>
      <div class="panel dashboard-panel">
        <h2>Maiores gastos do mês</h2>
        ${metrics.topMonthExpenses.length ? `
            <div class="recent-list compact">
              ${metrics.topMonthExpenses.map(entry => `
                <span><b>${money(entry.amount)}</b>${entry.description || categoryName(entry.category)}<small>${categoryName(entry.category)} - ${formatIsoDateBr(cashAccountingDate(entry))}</small></span>
              `).join("")}
            </div>
          ` : `<p class="muted">Nenhuma despesa operacional no mês.</p>`}
      </div>
    </section>
  `;
}

function todayOperationData() {
  const today = isoDate(new Date());
  const monthEnd = currentMonthEndDate();
  const currentKey = menuKey(state.menuWeek || 1);
  const todayCash = accountingCashEntries(state.cash).filter(entry => cashAccountingDate(entry) === today);
  const todayStoreSales = state.storeSales.filter(entry => entry.date === today);
  const weekOrders = weeklyOrders(currentKey);
  const pendingPayments = weekOrders.filter(order => {
    const client = clientByPhone(order.clientPhone);
    return client.plan === "semanal" && !isOrderPaid(order);
  });
  const pendingDelivery = weekOrders.filter(order => !order.delivered);
  const billsDue = state.cash
    .filter(isPendingBill)
    .filter(entry => {
      const date = String(entry.dueDate || entry.date || "");
      return date && date <= monthEnd;
    })
    .sort((a, b) => String(a.dueDate || a.date || "").localeCompare(String(b.dueDate || b.date || "")));

  return {
    today,
    currentKey,
    todayCash,
    todayStoreSales,
    weekOrders,
    pendingPayments,
    pendingDelivery,
    billsDue,
    income: todayCash.filter(entry => entry.type !== "expense").reduce((sum, entry) => sum + Number(entry.amount || 0), 0),
    expenses: todayCash.filter(entry => entry.type === "expense").reduce((sum, entry) => sum + Number(entry.amount || 0), 0),
    storeQuantity: todayStoreSales.reduce((sum, entry) => sum + Number(entry.quantity || 0), 0)
  };
}

function renderToday() {
  title.textContent = "Hoje";
  setActive("hoje");
  ensureCashEntryIds();
  const data = todayOperationData();

  app.innerHTML = `
    <section class="dashboard-band today-band">
      <div class="dashboard-copy">
        <span>${formatIsoDateBr(data.today)}</span>
        <h2>Operação do dia</h2>
        <p>Vendas da loja, caixa rápido, pedidos da semana, contas e pendências em uma tela.</p>
      </div>
      <div class="dashboard-kpis">
        <div class="metric dashboard-metric is-primary"><span>Loja hoje</span><strong>${data.storeQuantity}</strong></div>
        <div class="metric dashboard-metric"><span>Entradas hoje</span><strong>${money(data.income)}</strong></div>
        <div class="metric dashboard-metric"><span>Saídas hoje</span><strong>${money(data.expenses)}</strong></div>
        <div class="metric dashboard-metric"><span>Pendências</span><strong>${data.pendingPayments.length + data.pendingDelivery.length + data.billsDue.length}</strong></div>
      </div>
    </section>

    <section class="dashboard-lane">
      <div class="panel dashboard-panel">
        <h2>Entrada rápida</h2>
        <form id="today-income-form" class="form-grid single">
          <label>Data
            <input name="date" type="date" value="${data.today}" required>
          </label>
          <label>Descrição
            <input name="description" placeholder="Venda, pix, ajuste" required>
          </label>
          <label>Valor
            <input name="amount" type="text" inputmode="decimal" placeholder="0,00" required>
          </label>
          <button type="submit">Salvar entrada</button>
        </form>
      </div>
      <div class="panel dashboard-panel">
        <h2>Saída rápida</h2>
        <form id="today-expense-form" class="form-grid today-expense-details">
          <label class="span-2">Descrição
            <input name="description" placeholder="Mercado, boleto, entregador" required>
          </label>
          <label>Data
            <input name="date" type="date" value="${data.today}" required>
          </label>
          <label>Categoria
            <select name="category" id="today-expense-category">
              ${cashCategoryOptions("expense", "outros")}
            </select>
          </label>
          <label id="today-expense-due-date-field">Vencimento
            <input name="dueDate" type="date">
          </label>
          <label id="today-expense-paid-field">
            <input name="paid" type="checkbox" value="yes">
            Já está pago
          </label>
          <label id="today-expense-paid-date-field">Pago em
            <input name="paidDate" type="date" value="${data.today}">
          </label>
          <label>Valor
            <input name="amount" type="text" inputmode="decimal" placeholder="0,00" required>
          </label>
          <div class="actions span-2">
            <button type="submit">Salvar saída</button>
          </div>
        </form>
      </div>
    </section>

    <section class="dashboard-lane">
      <div class="panel dashboard-panel">
        <h2>Venda da loja</h2>
        <form id="today-store-form" class="form-grid single">
          <label>Data
            <input name="date" type="date" value="${data.today}" required>
          </label>
          <label>Quantidade de cumbucas
            <input name="quantity" type="number" min="1" step="1" placeholder="0" required>
          </label>
          <label>Observação
            <input name="notes" placeholder="Opcional">
          </label>
          <button type="submit">Salvar venda</button>
        </form>
      </div>
      <div class="panel dashboard-panel">
        <h2>Pedidos da semana</h2>
        ${data.weekOrders.length ? `
          <div class="recent-list">
            ${data.weekOrders.slice(0, 8).map(order => {
              const client = clientByPhone(order.clientPhone);
              return `
                <span class="today-order-item">
                  <b>${orderQuantity(order)}</b>
                  ${client.name || order.clientPhone}
                  <small>${isOrderPaid(order) ? "Pago" : "Pagamento pendente"} - ${order.delivered ? "Entregue" : "Entrega pendente"}</small>
                  <span class="today-order-actions">
                    ${client.plan === "semanal" && !isOrderPaid(order) ? `<button class="secondary table-action" type="button" data-today-paid-order="${order.id}">Pago</button>` : ""}
                    ${!order.delivered ? `<button class="secondary table-action" type="button" data-today-delivered-order="${order.id}">Entregue</button>` : ""}
                  </span>
                </span>
              `;
            }).join("")}
          </div>
        ` : `<p class="muted">Nenhum pedido na semana aberta.</p>`}
      </div>
    </section>

    <section class="dashboard-lane">
      <div class="panel dashboard-panel">
        <h2>Contas a pagar do mês</h2>
        ${data.billsDue.length ? `
          <div class="recent-list">
            ${data.billsDue.slice(0, 8).map(entry => `
              <span class="today-order-item">
                <b>${money(entry.amount)}</b>
                ${entry.description || categoryName(entry.category)}
                <small>${entry.dueDate ? dueDateDistanceLabel(entry.dueDate) : formatIsoDateBr(entry.date)}</small>
                <span class="today-order-actions">
                  <button class="secondary table-action" type="button" data-pay-bill="${entry.id || ""}">Marcar pago</button>
                </span>
              </span>
            `).join("")}
          </div>
        ` : `<p class="muted">Nenhuma conta a pagar até o fim deste mês.</p>`}
      </div>
      <div class="panel dashboard-panel">
        <h2>Pendências</h2>
        <div class="alert-list">
          <span><b>Pagamentos</b>${data.pendingPayments.length} pedido(s)</span>
          <span><b>Entregas</b>${data.pendingDelivery.length} pedido(s)</span>
          <span><b>Contas</b>${data.billsDue.length} conta(s)</span>
        </div>
      </div>
    </section>
  `;

  bindTodayForms(data.today);
  bindTodayOrderActions();
  bindBillPaymentButtons(renderToday);
}

function bindTodayOrderActions() {
  document.querySelectorAll("[data-today-paid-order]").forEach(button => {
    button.addEventListener("click", async event => {
      const id = Number(event.currentTarget.dataset.todayPaidOrder);
      state.orders = state.orders.map(order => Number(order.id) === id
        ? { ...order, paid: true, paidAmount: Number(order.amount || 0), paidAt: new Date().toISOString() }
        : order);
      if (await persistState()) {
        showToast("Pedido marcado como pago.", "success");
        renderToday();
      }
    });
  });

  document.querySelectorAll("[data-today-delivered-order]").forEach(button => {
    button.addEventListener("click", async event => {
      const id = Number(event.currentTarget.dataset.todayDeliveredOrder);
      state.orders = state.orders.map(order => Number(order.id) === id
        ? { ...order, delivered: true, deliveredAt: new Date().toISOString() }
        : order);
      if (await persistState()) {
        showToast("Pedido marcado como entregue.", "success");
        renderToday();
      }
    });
  });
}

function bindBillPaymentButtons(afterPay = renderCurrentRoute) {
  document.querySelectorAll("[data-pay-bill]").forEach(button => {
    button.addEventListener("click", async event => {
      const id = event.currentTarget.dataset.payBill;
      const bill = state.cash.find(entry => String(entry.id) === String(id));
      if (!bill) {
        return;
      }

      const paidDate = prompt("Data em que o boleto foi pago:", isoDate(new Date()));
      if (paidDate === null) {
        return;
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(paidDate)) {
        showToast("Informe a data no formato AAAA-MM-DD.", "error");
        return;
      }
      if (blockClosedMonth(paidDate, "pagar conta")) {
        return;
      }
      if (!confirm(`Marcar ${bill.description || categoryName(bill.category)} como pago em ${formatIsoDateBr(paidDate)}?`)) {
        return;
      }

      state.cash = state.cash.map(entry => String(entry.id) === String(id)
        ? { ...entry, paidAt: `${paidDate}T12:00:00.000Z` }
        : entry);
      recordAudit("Conta paga", `${bill.description || categoryName(bill.category)} - ${money(bill.amount)} - ${formatIsoDateBr(paidDate)}`);
      if (await persistState()) {
        showToast("Conta marcada como paga.", "success");
        afterPay();
      }
    });
  });
}

function bindTodayForms(today) {
  on("#today-income-form", "submit", async event => {
    event.preventDefault();
    const values = readForm(event.currentTarget);
    const amount = parseMoneyInput(values.amount);
    if (!values.date || amount <= 0) {
      showToast("Informe data e valor maior que zero.", "error");
      return;
    }
    if (blockClosedMonth(values.date, "lançar entrada rápida")) {
      return;
    }

    state.cash.push({
      id: Date.now(),
      date: values.date,
      type: "income",
      category: "venda",
      description: values.description,
      amount: amount.toFixed(2)
    });
    if (await persistState()) {
      renderToday();
    }
  });

  on("#today-expense-form", "submit", async event => {
    event.preventDefault();
    const values = readForm(event.currentTarget);
    const amount = parseMoneyInput(values.amount);
    if (amount <= 0) {
      showToast("Informe valor maior que zero.", "error");
      return;
    }
    if (!values.date) {
      showToast("Informe a data da saída.", "error");
      return;
    }
    if (blockClosedMonth(values.date, "lançar saída rápida")) {
      return;
    }
    const entry = {
      id: Date.now(),
      date: values.date,
      type: "expense",
      category: values.category || "outros",
      description: values.description,
      amount: amount.toFixed(2)
    };
    if (isBillCategory(entry.category)) {
      entry.dueDate = values.dueDate || values.date;
      if (values.paid === "yes") {
        const paidDate = values.paidDate || values.date;
        if (blockClosedMonth(paidDate, "pagar boleto")) {
          return;
        }
        entry.paidAt = `${paidDate}T12:00:00.000Z`;
      }
    }
    state.cash.push(entry);
    if (await persistState()) {
      renderToday();
    }
  });

  const todayExpenseCategory = document.querySelector("#today-expense-category");
  const todayExpenseDueDateField = document.querySelector("#today-expense-due-date-field");
  const todayExpensePaidField = document.querySelector("#today-expense-paid-field");
  const todayExpensePaidDateField = document.querySelector("#today-expense-paid-date-field");
  const todayExpensePaidCheckbox = todayExpensePaidField?.querySelector("input");
  if (todayExpenseCategory && todayExpenseDueDateField && todayExpensePaidField && todayExpensePaidDateField && todayExpensePaidCheckbox) {
    const updateTodayExpenseBillFields = () => {
      const shouldShowBill = isBillCategory(todayExpenseCategory.value);
      const shouldShowPaidDate = shouldShowBill && todayExpensePaidCheckbox.checked;
      todayExpenseDueDateField.hidden = !shouldShowBill;
      todayExpenseDueDateField.querySelector("input").required = shouldShowBill;
      todayExpensePaidField.hidden = !shouldShowBill;
      todayExpensePaidDateField.hidden = !shouldShowPaidDate;
      todayExpensePaidDateField.querySelector("input").required = shouldShowPaidDate;
      if (!shouldShowBill) {
        todayExpenseDueDateField.querySelector("input").value = "";
        todayExpensePaidCheckbox.checked = false;
      }
    };
    todayExpenseCategory.addEventListener("change", updateTodayExpenseBillFields);
    todayExpensePaidCheckbox.addEventListener("change", updateTodayExpenseBillFields);
    updateTodayExpenseBillFields();
  }

  on("#today-store-form", "submit", async event => {
    event.preventDefault();
    const values = readForm(event.currentTarget);
    const quantity = Number(values.quantity || 0);
    if (!values.date || quantity <= 0) {
      showToast("Informe data e quantidade maior que zero.", "error");
      return;
    }
    if (blockClosedMonth(values.date, "lançar venda da loja")) {
      return;
    }
    state.storeSales.push({
      id: Date.now(),
      date: values.date,
      quantity,
      notes: values.notes || ""
    });
    if (await persistState()) {
      renderToday();
    }
  });
}

async function renderCash() {
  title.textContent = "Fluxo de Caixa";
  setActive("fluxo-de-caixa");
  ensureCashEntryIds();
  const today = isoDate(new Date());
  if (state.cashFilter?.period === "all" && !state.cashFilter.manualAll) {
    state.cashFilter = { period: "month", date: today, month: today.slice(0, 7), year: today.slice(0, 4), type: "all", category: "all", search: "" };
  }
  const editing = state.editCashId !== null
    ? state.cash.find(entry => String(entry.id) === String(state.editCashId))
    : null;
  const editingChannelReceipt = state.editChannelReceiptId !== null
    ? state.channelReceipts.find(entry => String(entry.id) === String(state.editChannelReceiptId))
    : null;
  const editingWithdrawal = state.editWithdrawalGroup
    ? withdrawalHistoryGroups(state.cash).find(group => group.key === state.editWithdrawalGroup)
    : null;
  const editingAccountAdjustment = state.editAccountAdjustmentId !== null
    ? state.cash.find(entry => String(entry.id) === String(state.editAccountAdjustmentId))
    : null;
  const filteredEntries = filterCashEntries(state.cash);
  const accountedEntries = accountingCashEntries(filteredEntries);
  const result = await postJson("/api/fluxo-de-caixa", { entries: accountedEntries });
  const currentCashFilter = getCashFilter();
  const selectedDate = currentCashFilter.date || today;
  const selectedMonth = currentCashFilter.month || today.slice(0, 7);
  const selectedYear = currentCashFilter.year || today.slice(0, 4);
  const selectedFilterType = currentCashFilter.type || "all";
  const selectedFilterCategory = currentCashFilter.category || "all";
  const selectedChannelMonth = currentCashFilter.month || today.slice(0, 7);
  const totalCash = cashTotals(cashEntriesForSelectedPeriod());
  const balanceMonthKey = (currentCashFilter.period === "day" || currentCashFilter.period === "week")
    ? selectedDate.slice(0, 7)
    : selectedMonth;
  const monthlyBalance = monthlyAccountBalance(balanceMonthKey);
  const usesMonthlyBalance = ["day", "week", "month"].includes(currentCashFilter.period);
  const displayedCashBalance = usesMonthlyBalance && monthlyBalance !== null ? monthlyBalance : totalCash.balance;
  const balanceLabel = usesMonthlyBalance ? "Saldo real da conta" : "Saldo do período";
  const reconciliationDate = editingAccountAdjustment?.date || selectedDate || today;
  const editingAdjustmentSignedAmount = editingAccountAdjustment
    ? Number(editingAccountAdjustment.amount || 0) * (editingAccountAdjustment.type === "expense" ? -1 : 1)
    : 0;
  const reconciliationBaseBalance = reconciliationBaseForDate(reconciliationDate, editingAccountAdjustment?.id);
  const reconciliationTargetBalance = editingAccountAdjustment
    ? reconciliationBaseBalance + editingAdjustmentSignedAmount
    : Math.max(0, reconciliationBaseBalance);
  const previewWithdrawal = withdrawalSplitFromRaquel(0);
  const withdrawalFormValues = editingWithdrawal || previewWithdrawal;
  const savingsPlanning = state.financialPlanning || {};
  const savingsCurrent = savingsBalance();
  const partnersPeriod = state.cashFilter?.month || today.slice(0, 7);
  const partnersRecord = partnersRecordForPeriod(partnersPeriod);
  const partnersDashboard = partnerDashboard(selectedDate, partnersPeriod);
  const activeCashPanel = editing ? "entry" : (editingChannelReceipt ? "channels" : (state.cashPanelTab || "entry"));

  app.innerHTML = `
    <section class="cash-hero">
      <div>
        <span>Fluxo de caixa</span>
        <h2>${money(displayedCashBalance)}</h2>
      </div>
      <div class="cash-hero-metrics">
        <span><b>${money(result.income)}</b>Entradas</span>
        <span><b>${money(result.expenses)}</b>Saídas</span>
        <span><b>${money(displayedCashBalance)}</b>${balanceLabel}</span>
      </div>
    </section>
    <div class="cash-layout">
      <section class="panel cash-command-panel">
        <div class="cash-panel-tabs" role="tablist" aria-label="Ferramentas do caixa">
          ${[
            ["entry", editing ? "Editar" : "Lançamento"],
            ["ledger", "Extrato"],
            ["channels", "Canais"],
            ["reconciliation", "Conciliação"],
            ["savings", "Cofrinho"],
            ["partners", "Sócias"],
            ["withdrawals", "Retiradas"],
            ["categories", "Categorias"]
          ].map(([tab, label]) => `
            <button class="${activeCashPanel === tab ? "active" : ""}" type="button" data-cash-panel="${tab}">${label}</button>
          `).join("")}
        </div>
        ${activeCashPanel === "entry" ? `
        <div class="cash-tab-section">
          <h2>${editing ? "Editar lançamento" : "Novo lançamento"}</h2>
        <form id="cash-form" class="form-grid single">
          <label>Descrição
            <input name="description" placeholder="Venda, iFood, supermercado, entregador" value="${editing?.description || ""}" required>
          </label>
          <label>Data
            <input name="date" type="date" value="${editing?.date || ""}" required>
          </label>
          <label>Tipo
            <select name="type" id="cash-type">
              <option value="income" ${editing?.type === "income" ? "selected" : ""}>Entrada</option>
              <option value="expense" ${editing?.type === "expense" ? "selected" : ""}>Saída</option>
            </select>
          </label>
          <label>Origem / categoria
            <select name="category" id="cash-category">
              ${cashCategoryOptions(editing?.type || "income", editing?.category || (editing?.type === "expense" ? "outros" : "venda"))}
            </select>
          </label>
          <label id="cash-due-date-field">Vencimento
            <input name="dueDate" type="date" value="${editing?.dueDate || ""}">
          </label>
          <label id="cash-paid-field">
            <input name="paid" type="checkbox" value="yes" ${editing?.paidAt ? "checked" : ""}>
            Já está pago
          </label>
          <label>Valor
            <input name="amount" type="text" inputmode="decimal" placeholder="0,00" value="${editing ? moneyInputValue(editing.amount) : ""}" required>
          </label>
          <div class="actions">
            <button type="submit">${editing ? "Salvar edição" : "Adicionar"}</button>
            ${editing ? `<button class="secondary" type="button" id="cancel-cash-edit">Cancelar</button>` : ""}
            <button class="secondary" type="button" id="clear-cash">Limpar</button>
          </div>
        </form>
        </div>
        ` : ""}
        ${activeCashPanel === "channels" ? channelReceiptsPanel(editingChannelReceipt, selectedChannelMonth) : ""}
        ${activeCashPanel === "reconciliation" ? `
        <div class="cash-tab-section account-balance-panel">
        <h2>${editingAccountAdjustment ? "Editar conciliação" : "Conciliação da conta"}</h2>
        <p class="muted-inline">A conciliação usa o saldo do mês da data informada, mesmo quando o extrato está filtrado por dia ou semana.</p>
        <form id="account-balance-form" class="form-grid single">
          <div class="summary reconciliation-summary">
            <div class="metric"><span>Saldo do mês antes do ajuste</span><strong id="account-system-preview">${money(reconciliationBaseBalance)}</strong></div>
            <div class="metric"><span>Valor na conta</span><strong id="account-real-preview">${money(reconciliationTargetBalance)}</strong></div>
            <div class="metric"><span>Diferença</span><strong id="account-difference-preview" class="${editingAdjustmentSignedAmount < 0 ? "negative" : editingAdjustmentSignedAmount > 0 ? "positive" : ""}">${editingAdjustmentSignedAmount < 0 ? "-" : ""}${money(Math.abs(editingAdjustmentSignedAmount))}</strong></div>
          </div>
          <label>Saldo real da conta
            <input name="balance" type="text" inputmode="decimal" placeholder="0,00" value="${moneyInputValue(reconciliationTargetBalance)}" required>
          </label>
          <label>Data do ajuste
            <input name="date" type="date" value="${reconciliationDate}" required>
          </label>
          <div class="actions">
            <button type="submit">${editingAccountAdjustment ? "Salvar conciliação" : "Ajustar conta"}</button>
            ${editingAccountAdjustment ? `<button class="secondary" type="button" id="cancel-account-adjustment-edit">Cancelar</button>` : ""}
          </div>
        </form>
        <h3>Histórico de ajustes</h3>
        ${accountAdjustmentHistoryHtml()}
        </div>
        ` : ""}
        ${activeCashPanel === "savings" ? `
        <div class="cash-tab-section savings-panel">
        <h2>Cofrinho</h2>
        <form id="savings-form" class="form-grid single">
          <div class="summary reconciliation-summary">
            <div class="metric"><span>Valor atual</span><strong>${money(savingsCurrent)}</strong></div>
            <div class="metric"><span>Atualizado em</span><strong>${savingsPlanning.savingsUpdatedAt ? formatIsoDateBr(savingsPlanning.savingsUpdatedAt) : "Sem data"}</strong></div>
            <div class="metric"><span>Últimos registros</span><strong>${savingsHistoryRows().length}</strong></div>
          </div>
          <label>Data do registro
            <input name="date" type="date" value="${today}" required>
          </label>
          <label>Valor que tenho no cofrinho hoje
            <input name="balance" type="text" inputmode="decimal" placeholder="0,00" value="${moneyInputValue(savingsCurrent)}" required>
          </label>
          <label>Retirada feita do cofrinho
            <input name="withdrawal" type="text" inputmode="decimal" placeholder="0,00">
          </label>
          <label>Observação
            <input name="description" placeholder="Ex.: tirei para compra, conferência do caixa">
          </label>
          <button type="submit">Salvar cofrinho</button>
        </form>
        <h3>Histórico do cofrinho</h3>
        ${savingsHistoryRows().length ? `
          <div class="recent-list">
            ${savingsHistoryRows().slice(0, 8).map(entry => `
              <span>
                <b>${entry.type === "withdrawal" ? "-" : entry.type === "deposit" ? "+" : ""}${money(entry.amount)}</b>
                ${entry.type === "withdrawal" ? "Retirada" : entry.type === "deposit" ? "Entrada" : "Saldo informado"}
                <small>${formatIsoDateBr(entry.date)} - saldo ${money(entry.balance)}${entry.description ? ` - ${escapeHtml(entry.description)}` : ""}</small>
              </span>
            `).join("")}
          </div>
        ` : `<p class="muted">Nenhum registro do cofrinho ainda.</p>`}
        </div>
        ` : ""}
        ${activeCashPanel === "partners" ? `
        <div class="cash-tab-section partners-panel">
        <h2>Sócias</h2>
        <p class="muted-inline">Valores calculados automaticamente pelas retiradas registradas.</p>
        <div class="partners-dashboard">
          <section>
            <h3>Semana de ${formatIsoDateBr(partnersDashboard.weekStart)} a ${formatIsoDateBr(partnersDashboard.weekEnd)}</h3>
            <div class="summary">
              <div class="metric"><span>Vanessa retirou</span><strong>${money(partnersDashboard.week.vanessa)}</strong></div>
              <div class="metric"><span>Raquel retirou</span><strong>${money(partnersDashboard.week.raquel)}</strong></div>
              <div class="metric"><span>Cofrinho</span><strong>${money(partnersDashboard.week.savings)}</strong></div>
              <div class="metric"><span>Diferença Cofrinho</span><strong>${partnerDifferenceLabel(partnersDashboard.week.differenceSavings)}</strong></div>
              <div class="metric"><span>Diferença Vanessa</span><strong>${partnerDifferenceLabel(partnersDashboard.week.differenceVanessa)}</strong></div>
            </div>
          </section>
          <section>
            <h3>${formatMonthKeyBr(partnersPeriod)}</h3>
            <div class="summary">
              <div class="metric"><span>Vanessa retirou</span><strong>${money(partnersDashboard.month.vanessa)}</strong></div>
              <div class="metric"><span>Raquel retirou</span><strong>${money(partnersDashboard.month.raquel)}</strong></div>
              <div class="metric"><span>Cofrinho no mês</span><strong>${money(partnersDashboard.month.savings)}</strong></div>
              <div class="metric"><span>Diferença Cofrinho</span><strong>${partnerDifferenceLabel(partnersDashboard.month.differenceSavings)}</strong></div>
              <div class="metric"><span>Diferença Vanessa</span><strong>${partnerDifferenceLabel(partnersDashboard.month.differenceVanessa)}</strong></div>
            </div>
          </section>
          <section>
            <h3>Projeção até ${formatIsoDateBr(partnersDashboard.monthEnd)}</h3>
            <div class="summary">
              <div class="metric"><span>Vanessa projetado</span><strong>${money(partnersDashboard.projection.vanessa)}</strong></div>
              <div class="metric"><span>Raquel projetado</span><strong>${money(partnersDashboard.projection.raquel)}</strong></div>
              <div class="metric"><span>Cofrinho projetado</span><strong>${money(partnersDashboard.projection.savings)}</strong></div>
              <div class="metric"><span>Saldo atual do cofrinho</span><strong>${money(savingsCurrent)}</strong></div>
            </div>
          </section>
        </div>
        <details class="partners-manual-adjustment">
          <summary>Ajuste manual do mês</summary>
          <form id="partners-form" class="form-grid single">
            <label>Mês do registro
              <input name="periodKey" type="month" value="${partnersRecord.periodKey}" required>
            </label>
            <label>Vanessa - ajuste informado
              <input name="vanessa" type="text" inputmode="decimal" placeholder="0,00" value="${moneyInputValue(partnersRecord.vanessa)}">
            </label>
            <label>Raquel - ajuste informado
              <input name="raquel" type="text" inputmode="decimal" placeholder="0,00" value="${moneyInputValue(partnersRecord.raquel)}">
            </label>
            <label>Diferença anterior
              <input name="difference" type="text" inputmode="decimal" placeholder="0,00" value="${moneyInputValue(partnersRecord.difference)}">
            </label>
            <label>Observação
              <input name="notes" placeholder="Ex.: antecipação de período anterior" value="${escapeHtml(partnersRecord.notes || "")}">
            </label>
            <button type="submit">Salvar ajuste manual</button>
          </form>
        </details>
        <h3>Histórico de ajustes manuais</h3>
        ${partnersHistoryRows().length ? `
          <div class="recent-list">
            ${partnersHistoryRows().slice(0, 8).map(entry => `
              <span>
                <b>${formatMonthKeyBr(entry.periodKey)}</b>
                Vanessa ${money(entry.vanessa)} / Raquel ${money(entry.raquel)}
                <small>Diferença / antecipado ${money(entry.difference)}${entry.notes ? ` - ${escapeHtml(entry.notes)}` : ""}</small>
              </span>
            `).join("")}
          </div>
        ` : `<p class="muted">Nenhum registro de sócias ainda.</p>`}
        </div>
        ` : ""}
        ${activeCashPanel === "withdrawals" ? `
        <div class="cash-tab-section withdrawal-panel">
        <h2>${editingWithdrawal ? "Editar retirada" : "Retiradas"}</h2>
        <form id="withdrawal-form" class="form-grid single">
          <label>Data
            <input name="date" type="date" value="${editingWithdrawal?.date || today}" required>
          </label>
          <label>Valor calculado pela Raquel
            <input name="amount" type="text" inputmode="decimal" value="${moneyInputValue(editingWithdrawal?.distributionBase ?? previewWithdrawal.total)}" readonly required>
          </label>
          <div class="withdrawal-fields">
            <label>Cofrinho
              <input name="savings" type="text" inputmode="decimal" value="${moneyInputValue(editingWithdrawal?.savings ?? previewWithdrawal.savings)}">
            </label>
            <label>Vanessa
              <input name="vanessa" type="text" inputmode="decimal" value="${moneyInputValue(editingWithdrawal?.vanessa ?? previewWithdrawal.vanessa)}">
            </label>
            <label>Raquel (30% - base do cálculo)
              <input name="raquel" type="text" inputmode="decimal" value="${moneyInputValue(editingWithdrawal?.raquel ?? previewWithdrawal.raquel)}">
            </label>
          </div>
          <div class="withdrawal-preview" aria-live="polite">
            <span><b>Caixa disponível</b>${money(displayedCashBalance)}</span>
            <span><b>Total informado</b>${money(withdrawalFormValues.total)}</span>
            <span><b>Cofrinho</b>${money(withdrawalFormValues.savings)}</span>
            <span><b>Vanessa / Raquel</b>${money(withdrawalFormValues.vanessa)} / ${money(withdrawalFormValues.raquel)}</span>
            <span><b>Diferença Cofrinho</b>${partnerDifferenceLabel(withdrawalFormValues.differenceSavings || 0)}</span>
            <span><b>Diferença Vanessa</b>${partnerDifferenceLabel(withdrawalFormValues.differenceVanessa || 0)}</span>
          </div>
          <div class="actions">
            <button type="submit" ${(displayedCashBalance > 0 || editingWithdrawal) ? "" : "disabled"}>${editingWithdrawal ? "Salvar retirada" : "Registrar retiradas"}</button>
            ${editingWithdrawal ? `<button class="secondary" type="button" id="cancel-withdrawal-edit">Cancelar</button>` : ""}
          </div>
        </form>
        <h3>Histórico de retiradas</h3>
        ${withdrawalHistoryHtml()}
        </div>
        ` : ""}
        ${activeCashPanel === "categories" ? cashCategoriesPanel("cash-tab-section supplier-panel") : ""}
        ${activeCashPanel === "ledger" ? `
        <div class="cash-tab-section cash-ledger-panel">
        <div class="cash-ledger-header">
          <div>
            <h2>Extrato</h2>
            <p class="muted-inline">Filtre, confira categorias e edite lançamentos.</p>
          </div>
        </div>
        <form id="cash-filter-form" class="filter-bar">
          <label>Filtrar
            <select name="period" id="cash-period">
              <option value="all" ${state.cashFilter.period === "all" ? "selected" : ""}>Tudo</option>
              <option value="day" ${state.cashFilter.period === "day" ? "selected" : ""}>Dia</option>
              <option value="week" ${state.cashFilter.period === "week" ? "selected" : ""}>Semana</option>
              <option value="month" ${state.cashFilter.period === "month" ? "selected" : ""}>Mês</option>
              <option value="year" ${state.cashFilter.period === "year" ? "selected" : ""}>Ano</option>
            </select>
          </label>
          <label class="filter-control filter-date">Data
            <input name="date" type="date" value="${selectedDate}">
          </label>
          <label class="filter-control filter-month">Mês
            <input name="month" type="month" value="${selectedMonth}">
          </label>
          <label class="filter-control filter-year">Ano
            <input name="year" type="number" min="2000" max="2100" step="1" value="${selectedYear}">
          </label>
          <label>Tipo
            <select name="type" id="cash-filter-type">
              <option value="all" ${selectedFilterType === "all" ? "selected" : ""}>Entradas e saídas</option>
              <option value="income" ${selectedFilterType === "income" ? "selected" : ""}>Entradas</option>
              <option value="expense" ${selectedFilterType === "expense" ? "selected" : ""}>Saídas</option>
            </select>
          </label>
          <label>Origem / categoria
            <select name="category" id="cash-filter-category">
              ${cashFilterCategoryOptions(selectedFilterCategory, selectedFilterType)}
            </select>
          </label>
          <label>Buscar
            <input name="search" placeholder="Nome, motivo ou origem" value="${state.cashFilter.search || ""}">
          </label>
          <button type="submit">Aplicar</button>
          <button class="secondary" type="button" id="clear-cash-filter">Limpar filtros</button>
        </form>
        <div class="quick-filter-bar">
          <button class="secondary" type="button" data-cash-quick="today">Hoje</button>
          <button class="secondary" type="button" data-cash-quick="week">Esta semana</button>
          <button class="secondary" type="button" data-cash-quick="month">Este mês</button>
          <button class="secondary" type="button" data-cash-quick="last-month">Mês passado</button>
        </div>
        <div class="summary">
          <div class="metric"><span>Entradas</span><strong>${money(result.income)}</strong></div>
          <div class="metric"><span>Saídas</span><strong>${money(result.expenses)}</strong></div>
          <div class="metric"><span>${balanceLabel}</span><strong class="${displayedCashBalance < 0 ? "negative" : "positive"}">${money(displayedCashBalance)}</strong></div>
        </div>
        ${cashCategorySummary(accountedEntries)}
        ${cashTable(filteredEntries)}
        </div>
        ` : ""}
      </section>
    </div>
  `;

  document.querySelectorAll("[data-cash-panel]").forEach(button => {
    button.addEventListener("click", event => {
      state.cashPanelTab = event.currentTarget.dataset.cashPanel;
      if (state.cashPanelTab !== "entry") {
        state.editCashId = null;
      }
      if (state.cashPanelTab !== "withdrawals") {
        state.editWithdrawalGroup = null;
      }
      if (state.cashPanelTab !== "reconciliation") {
        state.editAccountAdjustmentId = null;
      }
      if (state.cashPanelTab !== "channels") {
        state.editChannelReceiptId = null;
      }
      if (state.cashPanelTab !== "categories") {
        state.editCashCategory = null;
      }
      renderCash();
    });
  });

  const cashForm = document.querySelector("#cash-form");
  if (cashForm) {
    cashForm.addEventListener("submit", event => {
    event.preventDefault();
    const values = readForm(event.currentTarget);
    const amount = parseMoneyInput(values.amount);
    if (!values.date || amount <= 0) {
      showToast("Informe data e valor maior que zero.", "error");
      return;
    }
    if (blockClosedMonth(values.date, editing ? "editar lançamentos" : "lançar no caixa")) {
      return;
    }
    const isDuplicate = !editing && state.cash.some(item =>
      String(item.date || "") === String(values.date || "")
      && String(item.type || "") === String(values.type || "")
      && normalizedCategory(item.category) === normalizedCategory(values.category)
      && String(item.description || "").trim().toLowerCase() === String(values.description || "").trim().toLowerCase()
      && Number(item.amount || 0) === amount
    );
    if (isDuplicate && !confirm("Já existe um lançamento igual. Salvar mesmo assim?")) {
      return;
    }
    const entry = {
      id: editing?.id || Date.now(),
      ...values,
      amount: amount.toFixed(2)
    };
    const shouldTrackBillPayment = entry.type === "expense" && isBillCategory(entry.category);
    delete entry.paid;
    if (shouldTrackBillPayment && values.paid === "yes") {
      entry.paidAt = editing?.paidAt || `${values.date}T12:00:00.000Z`;
    } else {
      delete entry.paidAt;
    }

    if (editing) {
      state.cash = state.cash.map(item => String(item.id) === String(editing.id) ? entry : item);
      state.editCashId = null;
      recordAudit("Caixa editado", `${entry.description || "Lançamento"} - ${money(entry.amount)}`);
    } else {
      state.cash.push(entry);
      recordAudit("Caixa criado", `${entry.description || "Lançamento"} - ${money(entry.amount)}`);
    }
    persistState();
    renderCash();
    });
  }

  const cancelCashEdit = document.querySelector("#cancel-cash-edit");
  if (cancelCashEdit) {
    cancelCashEdit.addEventListener("click", () => {
      state.editCashId = null;
      renderCash();
    });
  }

  const cashTypeField = document.querySelector("#cash-type");
  const cashCategoryField = document.querySelector("#cash-category");
  const cashDueDateField = document.querySelector("#cash-due-date-field");
  const cashPaidField = document.querySelector("#cash-paid-field");
  if (cashTypeField && cashCategoryField && cashDueDateField && cashPaidField) {
    const updateCashBillFieldsVisibility = () => {
      const shouldShow = cashTypeField.value === "expense" && isBillCategory(cashCategoryField.value);
      cashDueDateField.hidden = !shouldShow;
      cashDueDateField.querySelector("input").required = shouldShow;
      cashPaidField.hidden = !shouldShow;
      if (!shouldShow) {
        cashDueDateField.querySelector("input").value = "";
        cashPaidField.querySelector("input").checked = false;
      }
    };
    cashTypeField.addEventListener("change", event => {
      const type = event.currentTarget.value;
      cashCategoryField.innerHTML = cashCategoryOptions(type, type === "expense" ? "outros" : "venda");
      updateCashBillFieldsVisibility();
    });
    cashCategoryField.addEventListener("change", updateCashBillFieldsVisibility);
    updateCashBillFieldsVisibility();
  }

  const channelReceiptForm = document.querySelector("#channel-receipt-form");
  if (channelReceiptForm) {
    channelReceiptForm.addEventListener("submit", event => {
      event.preventDefault();
      const values = readForm(event.currentTarget);
      const receipt = {
        id: editingChannelReceipt?.id || Date.now(),
        date: values.date,
        notes: String(values.notes || "").trim()
      };
      if (blockClosedMonth(receipt.date, editingChannelReceipt ? "editar canais" : "lançar canais")) {
        return;
      }
      const cardapioTotal = cardapioPaymentDefinitions.reduce((sum, [paymentKey]) => {
        const field = `cardapioWeb${capitalize(paymentKey)}`;
        const amount = parseMoneyInput(values[field]);
        receipt[field] = amount.toFixed(2);
        return sum + amount;
      }, 0);
      receipt.cardapioWebGross = cardapioTotal.toFixed(2);
      receipt.cardapioWebFee = "0.00";
      receipt.cardapioWebNet = cardapioTotal.toFixed(2);
      ["ifood", "food99"].forEach(key => {
        const amount = parseMoneyInput(values[`${key}Net`]);
        receipt[`${key}Gross`] = amount.toFixed(2);
        receipt[`${key}Fee`] = "0.00";
        receipt[`${key}Net`] = amount.toFixed(2);
      });

      const total = channelReceiptTotal(receipt);
      if (total <= 0) {
        showToast("Informe pelo menos um valor de canal.", "error");
        return;
      }

      if (editingChannelReceipt) {
        state.channelReceipts = state.channelReceipts.map(item => String(item.id) === String(editingChannelReceipt.id) ? receipt : item);
        state.editChannelReceiptId = null;
        recordAudit("Canais editados", `${formatIsoDateBr(receipt.date)} - ${money(total)}`);
      } else {
        const existing = state.channelReceipts.find(item => item.date === receipt.date);
        if (existing) {
          receipt.id = existing.id;
          state.channelReceipts = state.channelReceipts.map(item => item.date === receipt.date ? receipt : item);
          recordAudit("Canais atualizados", `${formatIsoDateBr(receipt.date)} - ${money(total)}`);
        } else {
          state.channelReceipts.push(receipt);
          recordAudit("Canais lançados", `${formatIsoDateBr(receipt.date)} - ${money(total)}`);
        }
      }
      persistState();
      renderCash();
    });
  }

  const channelFilterForm = document.querySelector("#channel-filter-form");
  const channelFilterPeriod = document.querySelector("#channel-filter-period");
  if (channelFilterForm && channelFilterPeriod) {
    const updateChannelFilterVisibility = () => {
      channelFilterForm.dataset.period = channelFilterPeriod.value;
    };
    channelFilterPeriod.addEventListener("change", updateChannelFilterVisibility);
    updateChannelFilterVisibility();
    channelFilterForm.addEventListener("submit", event => {
      event.preventDefault();
      state.channelFilter = readForm(event.currentTarget);
      localStorage.setItem("channelFilter", JSON.stringify(state.channelFilter));
      renderCash();
    });
  }

  const cancelChannelReceiptEdit = document.querySelector("#cancel-channel-receipt-edit");
  if (cancelChannelReceiptEdit) {
    cancelChannelReceiptEdit.addEventListener("click", () => {
      state.editChannelReceiptId = null;
      renderCash();
    });
  }

  document.querySelectorAll("[data-edit-channel-receipt]").forEach(button => {
    button.addEventListener("click", event => {
      state.editChannelReceiptId = event.currentTarget.dataset.editChannelReceipt;
      state.cashPanelTab = "channels";
      renderCash();
    });
  });

  document.querySelectorAll("[data-delete-channel-receipt]").forEach(button => {
    button.addEventListener("click", event => {
      const id = event.currentTarget.dataset.deleteChannelReceipt;
      const removed = state.channelReceipts.find(item => String(item.id) === String(id));
      if (!removed || !confirm(`Excluir os valores dos canais de ${formatIsoDateBr(removed.date)}?`)) {
        return;
      }
      if (blockClosedMonth(removed.date, "excluir canais")) {
        return;
      }
      state.channelReceipts = state.channelReceipts.filter(item => String(item.id) !== String(id));
      if (String(state.editChannelReceiptId) === String(id)) {
        state.editChannelReceiptId = null;
      }
      recordAudit("Canais excluídos", `${formatIsoDateBr(removed.date)} - ${money(channelReceiptTotal(removed))}`);
      persistState();
      renderCash();
    });
  });

  const cashCategoryAdminForm = document.querySelector("#cash-category-admin-form");
  if (cashCategoryAdminForm) {
    cashCategoryAdminForm.addEventListener("submit", event => {
      event.preventDefault();
      const values = readForm(event.currentTarget);
      const type = state.editCashCategory?.type || (values.type === "expense" ? "expense" : "income");
      const label = String(values.label || "").trim();
      if (!label) {
        return;
      }

      const categoryList = uniqueCategories(state.cashCategories?.[type] || []);
      const existingLabels = new Set(categoryList
        .filter(([key]) => key !== state.editCashCategory?.key)
        .map(([, itemLabel]) => itemLabel.toLowerCase()));
      if (existingLabels.has(label.toLowerCase())) {
        showToast("Essa categoria já existe.", "warning");
        return;
      }

      if (state.editCashCategory) {
        const oldLabel = categoryList.find(([key]) => key === state.editCashCategory.key)?.[1] || "";
        state.cashCategories = {
          ...state.cashCategories,
          [type]: categoryList.map(item => item[0] === state.editCashCategory.key ? [item[0], label] : item)
        };
        recordAudit("Categoria editada", `${type === "income" ? "Entrada" : "Saída"} - ${oldLabel} -> ${label}`);
        state.editCashCategory = null;
      } else {
        const existingKeys = new Set(categoryList.map(([key]) => key));
        let key = slugifyCategory(label);
        let suffix = 2;
        while (existingKeys.has(key)) {
          key = `${slugifyCategory(label)}-${suffix}`;
          suffix += 1;
        }

        state.cashCategories = {
          ...state.cashCategories,
          [type]: uniqueCategories([...categoryList, [key, label]])
        };
        state.archivedCashCategories = {
          income: state.archivedCashCategories?.income || [],
          expense: state.archivedCashCategories?.expense || [],
          [type]: (state.archivedCashCategories?.[type] || []).filter(item => item !== key)
        };
        recordAudit("Categoria criada", `${type === "income" ? "Entrada" : "Saída"} - ${label}`);
      }
      persistState();
      renderCash();
    });
  }

  const cancelCashCategoryEdit = document.querySelector("#cancel-cash-category-edit");
  if (cancelCashCategoryEdit) {
    cancelCashCategoryEdit.addEventListener("click", () => {
      state.editCashCategory = null;
      renderCash();
    });
  }

  document.querySelectorAll("[data-edit-cash-category]").forEach(button => {
    button.addEventListener("click", event => {
      state.editCashCategory = {
        type: event.currentTarget.dataset.editCashCategoryType === "expense" ? "expense" : "income",
        key: event.currentTarget.dataset.editCashCategory
      };
      renderCash();
    });
  });

  document.querySelectorAll("[data-delete-cash-category]").forEach(button => {
    button.addEventListener("click", event => {
      const key = event.currentTarget.dataset.deleteCashCategory;
      const type = event.currentTarget.dataset.deleteCashCategoryType === "expense" ? "expense" : "income";
      const label = (state.cashCategories?.[type] || []).find(([itemKey]) => itemKey === key)?.[1] || categoryName(key);
      if (!confirm(`Excluir a categoria "${label}" da lista? Lançamentos antigos continuam com essa categoria no histórico.`)) {
        return;
      }

      state.archivedCashCategories = {
        income: state.archivedCashCategories?.income || [],
        expense: state.archivedCashCategories?.expense || [],
        [type]: [...new Set([...(state.archivedCashCategories?.[type] || []), key])]
      };
      if (normalizedCategory(state.cashFilter.category) === normalizedCategory(key)) {
        state.cashFilter.category = "all";
      }
      recordAudit("Categoria excluída", `${type === "income" ? "Entrada" : "Saída"} - ${label}`);
      persistState();
      renderCash();
    });
  });

  document.querySelectorAll("[data-reactivate-cash-category]").forEach(button => {
    button.addEventListener("click", event => {
      const key = event.currentTarget.dataset.reactivateCashCategory;
      const type = event.currentTarget.dataset.reactivateCashCategoryType === "expense" ? "expense" : "income";
      const label = (state.cashCategories?.[type] || []).find(([itemKey]) => itemKey === key)?.[1] || categoryName(key);
      state.archivedCashCategories = {
        income: state.archivedCashCategories?.income || [],
        expense: state.archivedCashCategories?.expense || [],
        [type]: (state.archivedCashCategories?.[type] || []).filter(item => item !== key)
      };
      recordAudit("Categoria reativada", `${type === "income" ? "Entrada" : "Saída"} - ${label}`);
      persistState();
      renderCash();
    });
  });

  const expenseReasonForm = document.querySelector("#expense-reason-form");
  if (expenseReasonForm) {
    expenseReasonForm.addEventListener("submit", event => {
    event.preventDefault();
    const values = readForm(event.currentTarget);
    const reason = String(values.reason || "").trim();
    if (!reason) {
      return;
    }
    if (state.editExpenseReasonIndex !== null) {
      const originalReason = activeExpenseReasons()[state.editExpenseReasonIndex];
      state.expenseReasons = state.expenseReasons.map(item => item === originalReason ? reason : item);
      state.editExpenseReasonIndex = null;
      recordAudit("Motivo de saída editado", reason);
    } else {
      state.expenseReasons = [...new Set([...state.expenseReasons, reason])];
      state.archivedExpenseReasons = state.archivedExpenseReasons.filter(item => item !== reason);
      recordAudit("Motivo de saída criado", reason);
    }
    persistState();
    renderCash();
    });
  }

  const cancelExpenseReasonEdit = document.querySelector("#cancel-expense-reason-edit");
  if (cancelExpenseReasonEdit) {
    cancelExpenseReasonEdit.addEventListener("click", () => {
      state.editExpenseReasonIndex = null;
      renderCash();
    });
  }

  document.querySelectorAll("[data-edit-expense-reason]").forEach(button => {
    button.addEventListener("click", event => {
      state.editExpenseReasonIndex = Number(event.currentTarget.dataset.editExpenseReason);
      renderCash();
    });
  });

  document.querySelectorAll("[data-archive-expense-reason]").forEach(button => {
    button.addEventListener("click", event => {
      const index = Number(event.currentTarget.dataset.archiveExpenseReason);
      const reason = activeExpenseReasons()[index];
      if (!confirm(`Arquivar o motivo "${reason}"? Lançamentos antigos continuam salvos com esse nome.`)) {
        return;
      }
      state.archivedExpenseReasons = [...new Set([...(state.archivedExpenseReasons || []), reason])];
      if (state.editExpenseReasonIndex === index) {
        state.editExpenseReasonIndex = null;
      }
      recordAudit("Motivo de saída arquivado", reason);
      persistState();
      renderCash();
    });
  });

  document.querySelectorAll("[data-reactivate-expense-reason]").forEach(button => {
    button.addEventListener("click", event => {
      const index = Number(event.currentTarget.dataset.reactivateExpenseReason);
      const reason = (state.archivedExpenseReasons || [])[index];
      state.archivedExpenseReasons = state.archivedExpenseReasons.filter((_, itemIndex) => itemIndex !== index);
      state.expenseReasons = [...new Set([...state.expenseReasons, reason])];
      recordAudit("Motivo de saída reativado", reason);
      persistState();
      renderCash();
    });
  });

  const accountBalanceForm = document.querySelector("#account-balance-form");
  if (accountBalanceForm) {
    accountBalanceForm.addEventListener("input", () => {
      const baseBalance = reconciliationBaseForDate(
        accountBalanceForm.elements.date.value,
        editingAccountAdjustment?.id
      );
      const adjustment = accountBalanceAdjustment(accountBalanceForm.elements.balance.value, baseBalance);
      const systemPreview = document.querySelector("#account-system-preview");
      const realPreview = document.querySelector("#account-real-preview");
      const differencePreview = document.querySelector("#account-difference-preview");
      systemPreview.textContent = money(baseBalance);
      realPreview.textContent = money(adjustment.target);
      differencePreview.textContent = `${adjustment.difference < 0 ? "-" : ""}${money(adjustment.amount)}`;
      differencePreview.classList.toggle("negative", adjustment.difference < 0);
      differencePreview.classList.toggle("positive", adjustment.difference > 0);
    });

    accountBalanceForm.addEventListener("submit", async event => {
    event.preventDefault();
    const values = readForm(event.currentTarget);
    const baseBalance = reconciliationBaseForDate(values.date, editingAccountAdjustment?.id);
    const adjustment = accountBalanceAdjustment(values.balance, baseBalance);
    if (blockClosedMonth(values.date, editingAccountAdjustment ? "editar conciliação" : "conciliar conta")) {
      return;
    }
    if (editingAccountAdjustment && editingAccountAdjustment.date !== values.date
      && blockClosedMonth(editingAccountAdjustment.date, "editar conciliação")) {
      return;
    }
    const monthKey = String(values.date || today).slice(0, 7);
    const previousMonthKey = editingAccountAdjustment?.date ? String(editingAccountAdjustment.date).slice(0, 7) : monthKey;
    const replaceMonthAdjustments = () => {
      removeAccountAdjustmentsForMonth(monthKey);
      if (previousMonthKey !== monthKey) {
        removeAccountAdjustmentsForMonth(previousMonthKey);
      }
    };

    if (adjustment.amount <= 0.009) {
      const hadAdjustmentInMonth = state.cash.some(entry => isAccountAdjustmentEntry(entry) && cashAccountingDate(entry).startsWith(monthKey));
      if (!editingAccountAdjustment && !hadAdjustmentInMonth) {
        showToast("O saldo informado ja esta igual ao saldo calculado.", "warning");
        return;
      }
      replaceMonthAdjustments();
      state.editAccountAdjustmentId = null;
      focusCashFilterOnDate(values.date);
      state.cashFilter.period = "month";
      if (await persistState()) {
        showToast("Conciliação zerada porque não há diferença.", "success");
        renderCash();
      }
      return;
    }

    const entry = {
      id: editingAccountAdjustment?.id || `account-adjustment-${Date.now()}`,
      description: adjustment.type === "expense" ? "Ajuste do valor na conta" : "Valor existente na conta",
      date: values.date,
      type: adjustment.type,
      category: "ajuste-conta",
      amount: adjustment.amount.toFixed(2)
    };
    if (editingAccountAdjustment) {
      replaceMonthAdjustments();
      state.cash.push(entry);
      recordAudit("Conciliação editada", `Conta ${money(adjustment.target)} - ajuste ${money(adjustment.amount)}`);
    } else {
      replaceMonthAdjustments();
      state.cash.push(entry);
      recordAudit("Valor na conta ajustado", `Conta ${money(adjustment.target)} - ajuste ${money(adjustment.amount)}`);
    }
    focusCashFilterOnDate(values.date);
    state.cashFilter.period = "month";
    state.editAccountAdjustmentId = null;
    if (await persistState()) {
      showToast(editingAccountAdjustment ? "Conciliação atualizada." : "Conta ajustada.", "success");
      renderCash();
    }
    });
  }

  const cancelAccountAdjustmentEdit = document.querySelector("#cancel-account-adjustment-edit");
  if (cancelAccountAdjustmentEdit) {
    cancelAccountAdjustmentEdit.addEventListener("click", () => {
      state.editAccountAdjustmentId = null;
      renderCash();
    });
  }

  document.querySelectorAll("[data-edit-account-adjustment]").forEach(button => {
    button.addEventListener("click", event => {
      const id = event.currentTarget.dataset.editAccountAdjustment;
      const adjustment = state.cash.find(entry => String(entry.id) === String(id));
      if (adjustment?.date) {
        focusCashFilterOnDate(adjustment.date);
      }
      state.editAccountAdjustmentId = id;
      state.cashPanelTab = "reconciliation";
      renderCash();
    });
  });

  document.querySelectorAll("[data-delete-account-adjustment]").forEach(button => {
    button.addEventListener("click", async event => {
      const id = event.currentTarget.dataset.deleteAccountAdjustment;
      const adjustment = state.cash.find(entry => String(entry.id) === String(id));
      if (!adjustment) {
        showToast("Conciliação não encontrada.", "error");
        return;
      }
      if (blockClosedMonth(adjustment.date, "excluir conciliação")) {
        return;
      }
      if (!confirm(`Excluir a conciliação de ${formatIsoDateBr(adjustment.date)} no valor de ${money(adjustment.amount)}?`)) {
        return;
      }

      state.cash = state.cash.filter(entry => String(entry.id) !== String(id));
      if (String(state.editAccountAdjustmentId) === String(id)) {
        state.editAccountAdjustmentId = null;
      }
      recordAudit("Conciliação excluída", `${formatIsoDateBr(adjustment.date)} - ${money(adjustment.amount)}`);
      const saved = await persistState();
      if (saved) {
        showToast("Conciliação excluída.", "success");
      }
      renderCash();
    });
  });

  const savingsForm = document.querySelector("#savings-form");
  if (savingsForm) {
    savingsForm.addEventListener("submit", event => {
      event.preventDefault();
      const values = readForm(event.currentTarget);
      const balance = parseMoneyInput(values.balance);
      const withdrawal = parseMoneyInput(values.withdrawal);
      const date = values.date || today;

      if (balance < 0 || withdrawal < 0) {
        showToast("Informe valores válidos para o cofrinho.", "error");
        return;
      }

      const description = values.description || "Saldo informado no caixa";
      const nextBalance = updateSavingsBalance({
        amount: balance,
        date,
        type: "set",
        description
      });

      if (withdrawal > 0) {
        state.financialPlanning = {
          ...state.financialPlanning,
          savingsHistory: [
            {
              id: `savings-withdrawal-${Date.now()}`,
              date,
              type: "withdrawal",
              amount: withdrawal.toFixed(2),
              balance: nextBalance.toFixed(2),
              description: values.description || "Retirada registrada no cofrinho"
            },
            ...savingsHistoryRows()
          ].slice(0, 40)
        };
      }

      recordAudit("Cofrinho atualizado", `Saldo ${money(nextBalance)}${withdrawal > 0 ? ` - retirada ${money(withdrawal)}` : ""}`);
      persistState();
      renderCash();
    });
  }

  const partnersForm = document.querySelector("#partners-form");
  if (partnersForm) {
    partnersForm.addEventListener("submit", event => {
      event.preventDefault();
      const values = readForm(event.currentTarget);
      const periodKey = values.periodKey || today.slice(0, 7);
      const record = {
        periodKey,
        vanessa: parseMoneyInput(values.vanessa).toFixed(2),
        raquel: parseMoneyInput(values.raquel).toFixed(2),
        difference: parseMoneyInput(values.difference).toFixed(2),
        notes: values.notes || ""
      };

      upsertPartnersRecord(record);
      recordAudit("Sócias atualizado", `${formatMonthKeyBr(periodKey)} - Vanessa ${money(record.vanessa)}, Raquel ${money(record.raquel)}, diferença ${money(record.difference)}`);
      persistState();
      renderCash();
    });
  }

  const withdrawalForm = document.querySelector("#withdrawal-form");
  if (withdrawalForm) {
    const updateWithdrawalPreview = () => {
      const split = {
        distributionBase: parseMoneyInput(withdrawalForm.elements.amount.value),
        savings: parseMoneyInput(withdrawalForm.elements.savings.value),
        vanessa: parseMoneyInput(withdrawalForm.elements.vanessa.value),
        raquel: parseMoneyInput(withdrawalForm.elements.raquel.value)
      };
      split.total = split.savings + split.vanessa + split.raquel;
      const expected = withdrawalSplitFromRaquel(split.raquel);
      split.distributionBase = expected.total;
      withdrawalForm.elements.amount.value = moneyInputValue(expected.total);
      const differenceSavings = expected.savings - split.savings;
      const differenceVanessa = expected.vanessa - split.vanessa;
      const preview = withdrawalForm.querySelector(".withdrawal-preview");
      preview.innerHTML = `
        <span><b>Caixa disponível</b>${money(displayedCashBalance)}</span>
        <span><b>Divisão calculada</b>${money(split.distributionBase)}</span>
        <span><b>Total informado</b>${money(split.total)}</span>
        <span><b>Cofrinho</b>${money(split.savings)}</span>
        <span><b>Vanessa / Raquel</b>${money(split.vanessa)} / ${money(split.raquel)}</span>
        <span><b>Diferença Cofrinho</b>${partnerDifferenceLabel(differenceSavings)}</span>
        <span><b>Diferença Vanessa</b>${partnerDifferenceLabel(differenceVanessa)}</span>
      `;
    };

    withdrawalForm.addEventListener("input", event => {
      const fieldName = event.target.name;
      if (fieldName === "raquel") {
        const split = withdrawalSplitFromRaquel(event.target.value);
        withdrawalForm.elements.amount.value = moneyInputValue(split.total);
        withdrawalForm.elements.savings.value = moneyInputValue(split.savings);
        withdrawalForm.elements.vanessa.value = moneyInputValue(split.vanessa);
      }

      updateWithdrawalPreview();
    });

    withdrawalForm.addEventListener("submit", async event => {
    event.preventDefault();
    const values = readForm(event.currentTarget);
    const previousWithdrawal = state.editWithdrawalGroup
      ? withdrawalHistoryGroups(state.cash).find(group => group.key === state.editWithdrawalGroup)
      : null;
    const available = displayedCashBalance + Number(previousWithdrawal?.total || 0);
    const expected = withdrawalSplitFromRaquel(values.raquel);
    const split = {
      distributionBase: expected.total,
      total: parseMoneyInput(values.savings) + parseMoneyInput(values.vanessa) + parseMoneyInput(values.raquel),
      savings: parseMoneyInput(values.savings),
      vanessa: parseMoneyInput(values.vanessa),
      raquel: parseMoneyInput(values.raquel)
    };
    const amountsUnchanged = previousWithdrawal
      && Math.abs(split.savings - Number(previousWithdrawal.savings || 0)) < 0.01
      && Math.abs(split.vanessa - Number(previousWithdrawal.vanessa || 0)) < 0.01
      && Math.abs(split.raquel - Number(previousWithdrawal.raquel || 0)) < 0.01
      && Math.abs(split.distributionBase - Number(previousWithdrawal.distributionBase || previousWithdrawal.total || 0)) < 0.01;

    if (split.total <= 0) {
      showToast("Informe um valor maior que zero.", "error");
      return;
    }

    if (split.distributionBase <= 0) {
      showToast("Informe o valor que a Raquel retirou para calcular a divisão.", "error");
      return;
    }

    if (split.distributionBase > available) {
      showToast("O valor da divisão não pode ser maior que o caixa disponível.", "error");
      return;
    }

    if (!amountsUnchanged && split.total > available) {
      showToast("A retirada não pode ser maior que o caixa disponível.", "error");
      return;
    }

    if (blockClosedMonth(values.date, "registrar retiradas")) {
      return;
    }
    if (previousWithdrawal && previousWithdrawal.date !== values.date
      && blockClosedMonth(previousWithdrawal.date, "editar retiradas")) {
      return;
    }

    if (amountsUnchanged && previousWithdrawal) {
      const previousIds = new Set(previousWithdrawal.entries.map(entry => String(entry.id)));
      state.cash = state.cash.map(entry => previousIds.has(String(entry.id))
        ? { ...entry, date: values.date }
        : entry);
      recordAudit(
        "Data da retirada editada",
        `${formatIsoDateBr(previousWithdrawal.date)} para ${formatIsoDateBr(values.date)} - total ${money(split.total)}`
      );
      focusCashFilterOnDate(values.date);
      state.editWithdrawalGroup = null;
      if (await persistState()) {
        showToast("Data da retirada atualizada.", "success");
        renderCash();
      }
      return;
    }

    const idBase = previousWithdrawal
      ? previousWithdrawal.key.replace(/^withdrawal-/, "")
      : Date.now();
    const withdrawalEntries = [
      {
        id: `withdrawal-${idBase}-savings`,
        description: "Retirada - cofrinho",
        date: values.date,
        type: "expense",
        category: "retirada",
        amount: split.savings.toFixed(2),
        distributionBase: split.distributionBase.toFixed(2),
        expectedAmount: expected.savings.toFixed(2)
      },
      {
        id: `withdrawal-${idBase}-vanessa`,
        description: "Retirada - Vanessa",
        date: values.date,
        type: "expense",
        category: "retirada",
        amount: split.vanessa.toFixed(2),
        distributionBase: split.distributionBase.toFixed(2),
        expectedAmount: expected.vanessa.toFixed(2)
      },
      {
        id: `withdrawal-${idBase}-raquel`,
        description: "Retirada - Raquel",
        date: values.date,
        type: "expense",
        category: "retirada",
        amount: split.raquel.toFixed(2),
        distributionBase: split.distributionBase.toFixed(2),
        expectedAmount: expected.raquel.toFixed(2)
      }
    ].filter(entry => Number(entry.amount || 0) > 0);
    if (previousWithdrawal) {
      const previousIds = new Set(previousWithdrawal.entries.map(entry => String(entry.id)));
      state.cash = state.cash.filter(entry => !previousIds.has(String(entry.id)));
    }
    state.cash.push(...withdrawalEntries);
    const savingsDifference = split.savings - Number(previousWithdrawal?.savings || 0);
    if (Math.abs(savingsDifference) > 0.009) {
      updateSavingsBalance({
        amount: Math.abs(savingsDifference),
        date: values.date,
        type: savingsDifference > 0 ? "deposit" : "withdrawal",
        description: previousWithdrawal ? "Ajuste da retirada - cofrinho" : "Retirada - cofrinho"
      });
    }
    const auditDetail = amountsUnchanged && previousWithdrawal.date !== values.date
      ? `Data alterada de ${formatIsoDateBr(previousWithdrawal.date)} para ${formatIsoDateBr(values.date)} - total ${money(split.total)}`
      : `Calculado ${money(split.distributionBase)} - retirado ${money(split.total)} - cofrinho ${money(split.savings)}, Vanessa ${money(split.vanessa)} (${partnerDifferenceLabel(expected.vanessa - split.vanessa)}), Raquel ${money(split.raquel)} (${partnerDifferenceLabel(expected.raquel - split.raquel)})`;
    recordAudit(previousWithdrawal ? "Retirada editada" : "Retirada registrada", auditDetail);
    state.editWithdrawalGroup = null;
    if (await persistState()) {
      renderCash();
    }
    });
  }

  const cancelWithdrawalEdit = document.querySelector("#cancel-withdrawal-edit");
  if (cancelWithdrawalEdit) {
    cancelWithdrawalEdit.addEventListener("click", () => {
      state.editWithdrawalGroup = null;
      renderCash();
    });
  }

  document.querySelectorAll("[data-edit-withdrawal]").forEach(button => {
    button.addEventListener("click", event => {
      state.editWithdrawalGroup = event.currentTarget.dataset.editWithdrawal;
      state.cashPanelTab = "withdrawals";
      renderCash();
    });
  });

  const filterForm = document.querySelector("#cash-filter-form");
  const periodField = document.querySelector("#cash-period");
  const filterTypeField = document.querySelector("#cash-filter-type");
  const filterCategoryField = document.querySelector("#cash-filter-category");

  if (filterForm && periodField && filterTypeField && filterCategoryField) {
    function updateFilterVisibility() {
      const period = periodField.value;
      filterForm.dataset.period = period;
    }

    periodField.addEventListener("change", updateFilterVisibility);
    filterTypeField.addEventListener("change", event => {
      filterCategoryField.innerHTML = cashFilterCategoryOptions("all", event.currentTarget.value);
    });
    updateFilterVisibility();

    filterForm.addEventListener("submit", event => {
      event.preventDefault();
      const values = readForm(event.currentTarget);
      
      // Se está em modo semana e o mês foi alterado, ajusta a data para estar dentro do novo mês
      if (values.period === "week" && values.month && values.month !== state.cashFilter?.month) {
        const newDate = new Date(`${values.month}-01T00:00:00`);
        values.date = isoDate(newDate);
      }
      
      state.cashFilter = { ...values, manualAll: values.period === "all" };
      persistState();
      renderCash();
    });

    document.querySelector("#clear-cash-filter")?.addEventListener("click", () => {
      state.cashFilter = { period: "month", date: today, month: today.slice(0, 7), year: today.slice(0, 4), type: "all", category: "all", search: "" };
      persistState();
      renderCash();
    });

    document.querySelectorAll("[data-cash-quick]").forEach(button => {
      button.addEventListener("click", event => {
        const quick = event.currentTarget.dataset.cashQuick;
        if (quick === "today") {
          state.cashFilter = { ...state.cashFilter, period: "day", date: today, month: selectedMonth, year: selectedYear, manualAll: false };
        }
        if (quick === "week") {
          state.cashFilter = { ...state.cashFilter, period: "week", date: today, month: selectedMonth, year: selectedYear, manualAll: false };
        }
        if (quick === "month") {
          state.cashFilter = { ...state.cashFilter, period: "month", date: today, month: today.slice(0, 7), year: selectedYear, manualAll: false };
        }
        if (quick === "last-month") {
          state.cashFilter = { ...state.cashFilter, period: "month", date: today, month: lastMonthKey(), year: selectedYear, manualAll: false };
        }
        persistState();
        renderCash();
      });
    });
  }

  const clearCashButton = document.querySelector("#clear-cash");
  if (clearCashButton) {
    clearCashButton.addEventListener("click", async () => {
    if (!confirm("Antes de limpar o caixa, baixe um backup JSON. Deseja baixar agora?")) {
      return;
    }
    await downloadBackup();
    const confirmation = prompt('Esta ação apaga todos os lançamentos do fluxo de caixa. Digite "LIMPAR CAIXA" para confirmar.');
    if (confirmation !== "LIMPAR CAIXA") {
      showToast("Limpeza cancelada.", "warning");
      return;
    }
    const removedCount = state.cash.length;
    state.cash = [];
    state.editCashId = null;
    recordAudit("Caixa limpo", `${removedCount} lançamento(s) removido(s) após backup manual`);
    persistState();
    renderCash();
    });
  }

  document.querySelectorAll("[data-edit-cash]").forEach(button => {
    button.addEventListener("click", event => {
      state.editCashId = event.currentTarget.dataset.editCash;
      state.cashPanelTab = "entry";
      renderCash();
    });
  });

  document.querySelectorAll("[data-delete-cash]").forEach(button => {
    button.addEventListener("click", event => {
      if (!confirm("Excluir este lançamento?")) {
        return;
      }

      const id = event.currentTarget.dataset.deleteCash;
      const removed = state.cash.find(item => String(item.id) === String(id));
      if (blockClosedMonth(removed?.date, "excluir lançamentos")) {
        return;
      }
      state.cash = state.cash.filter(item => String(item.id) !== String(id));
      if (String(state.editCashId) === String(id)) {
        state.editCashId = null;
      }
      recordAudit("Caixa excluído", `${removed?.description || "Lançamento"} - ${money(removed?.amount)}`);
      persistState();
      renderCash();
    });
  });

  document.querySelectorAll("[data-sort-cash]").forEach(button => {
    button.addEventListener("click", event => {
      const key = event.currentTarget.dataset.sortCash;
      state.cashSort = {
        key,
        direction: state.cashSort?.key === key && state.cashSort.direction === "desc" ? "asc" : "desc"
      };
      renderCash();
    });
  });

  bindBillPaymentButtons(renderCash);
}

function sortedCashEntries(entries = []) {
  const key = state.cashSort?.key;
  if (!key) {
    return entries;
  }
  const direction = state.cashSort.direction === "asc" ? 1 : -1;
  const valueFor = entry => {
    if (key === "amount") {
      return Number(entry.amount || 0);
    }
    if (key === "type") {
      return entry.type === "expense" ? "Saída" : "Entrada";
    }
    if (key === "category") {
      return categoryName(entry.category);
    }
    if (key === "dueDate") {
      return String(entry.dueDate || "");
    }
    return String(entry[key] || "");
  };
  return [...entries].sort((a, b) => {
    const left = valueFor(a);
    const right = valueFor(b);
    if (typeof left === "number" && typeof right === "number") {
      return (left - right) * direction;
    }
    return String(left).localeCompare(String(right), "pt-BR", { numeric: true, sensitivity: "base" }) * direction;
  });
}

function cashSortHeader(key, label) {
  const active = state.cashSort?.key === key;
  const arrow = active ? (state.cashSort.direction === "asc" ? "↑" : "↓") : "↕";
  return `<button class="table-sort-button ${active ? "active" : ""}" type="button" data-sort-cash="${key}" title="Ordenar por ${label}">${label}<span aria-hidden="true">${arrow}</span></button>`;
}

function cashTable(entries) {
  if (!entries.length) {
    return `<p class="muted">Nenhum lançamento ainda.</p>`;
  }
  const sortedEntries = sortedCashEntries(entries);

  return `
    <div class="table-wrap cash-ledger-table">
      <table>
        <thead><tr><th>${cashSortHeader("date", "Data")}</th><th>${cashSortHeader("description", "Descrição")}</th><th>${cashSortHeader("type", "Tipo")}</th><th>${cashSortHeader("category", "Categoria")}</th><th>${cashSortHeader("dueDate", "Vencimento")}</th><th>${cashSortHeader("amount", "Valor")}</th><th></th></tr></thead>
        <tbody>
          ${sortedEntries.map(item => `
            <tr class="cash-row ${item.type === "income" ? "income-row" : "expense-row"}">
              <td>${formatIsoDateBr(item.date)}</td>
              <td>${item.description}</td>
              <td><span class="cash-type-badge ${item.type === "income" ? "income" : "expense"}">${item.type === "income" ? "Entrada" : "Saída"}</span></td>
              <td><span class="cash-category-badge">${categoryName(item.category)}</span></td>
              <td>
                ${item.dueDate ? formatIsoDateBr(item.dueDate) : "-"}
                ${isBillEntry(item) ? `<br><small>${item.paidAt ? `Pago em ${formatIsoDateBr(String(item.paidAt).slice(0, 10))}` : "A pagar"}</small>` : ""}
              </td>
              <td class="${item.type === "income" ? "positive" : "negative"}">${money(item.amount)}</td>
              <td>
                <div class="table-actions">
                  ${isPendingBill(item) ? `<button class="secondary table-action" type="button" data-pay-bill="${item.id || ""}">Marcar pago</button>` : ""}
                  <button class="secondary table-action" type="button" data-edit-cash="${item.id || ""}">Editar</button>
                  <button class="danger table-action" type="button" data-delete-cash="${item.id || ""}">Excluir</button>
                </div>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function planningIngredients(item) {
  const saved = Array.isArray(item.ingredients) ? item.ingredients : [];
  return Array.from({ length: Math.max(1, saved.length) }, (_, index) => {
    return saved[index] || { name: "", value: "" };
  });
}

function planningIngredientRow(menuIndex, ingredientIndex, ingredient = {}) {
  return `
    <div class="ingredient-row" data-ingredient-row data-menu-index="${menuIndex}">
      <input class="ingredient-name" name="ingredient-name-${menuIndex}-${ingredientIndex}" value="${ingredient.name || ""}" placeholder="Ingrediente">
      <input class="ingredient-value" name="ingredient-value-${menuIndex}-${ingredientIndex}" type="text" inputmode="decimal" value="${moneyInputValue(ingredient.value)}" placeholder="R$">
      <button class="ingredient-remove" type="button" data-remove-ingredient aria-label="Remover ingrediente">-</button>
    </div>
  `;
}

function planningIngredientRows(item, menuIndex) {
  return planningIngredients(item)
    .map((ingredient, ingredientIndex) => planningIngredientRow(menuIndex, ingredientIndex, ingredient))
    .join("");
}

function readPlanningIngredients(form, menuIndex) {
  return [...form.querySelectorAll(`[data-ingredient-row][data-menu-index="${menuIndex}"]`)]
    .map(row => ({
      name: String(row.querySelector(".ingredient-name")?.value || "").trim(),
      value: parseMoneyInput(row.querySelector(".ingredient-value")?.value).toFixed(2)
    }))
    .filter(item => item.name || Number(item.value || 0) > 0);
}

function planningIngredientTotal(ingredients) {
  return ingredients.reduce((sum, item) => sum + Number(item.value || 0), 0);
}

async function renderMenu() {
  title.textContent = "Menu Semanal";
  setActive("menu-semanal");
  const currentWeek = state.menuWeek || 1;
  const currentKey = menuKey(currentWeek);
  const result = await postJson("/api/menu-semanal", { meals: state.menus[currentKey] || [] });
  const planningStats = {
    shopping: result.plan.filter(item => item.status === "compras").length,
    prep: result.plan.filter(item => item.status === "preparo").length,
    ready: result.plan.filter(item => item.status === "pronto").length
  };
  const savedRange = state.menuDates[currentKey] || {};
  const today = new Date();
  const defaultStart = isoDate(startOfWeek(today));
  const defaultEnd = isoDate(endOfWeek(today));
  const menuStartDate = savedRange.start || savedRange || defaultStart;
  const menuEndDate = savedRange.end || defaultEnd;

  app.innerHTML = `
    <section class="panel">
      <form id="menu-period-form" class="period-picker">
        <label>Ano
          <input name="year" type="number" min="2020" max="2100" step="1" value="${state.menuPeriod.year}">
        </label>
        <label>Mês
          <select name="month">
            ${monthOptions(state.menuPeriod.month)}
          </select>
        </label>
        <button type="submit">Abrir</button>
      </form>
      <div class="week-tabs" aria-label="Semanas do menu">
        <div class="week-links">
          ${[1, 2, 3, 4, 5].map(week => `
            <a href="/menu-semanal?ano=${state.menuPeriod.year}&mes=${state.menuPeriod.month}&semana=${week}" class="${week === currentWeek && !state.showMonthSummary ? "active" : ""}" data-week="${week}">Semana ${week}</a>
          `).join("")}
          <a href="/menu-semanal?ano=${state.menuPeriod.year}&mes=${state.menuPeriod.month}&resumo=mes" class="${state.showMonthSummary ? "active" : ""}" data-month-summary>Resumo do mês</a>
        </div>
      </div>
      ${state.showMonthSummary ? monthSummaryPanel(currentKey) : `
      <form id="week-range-form" class="week-range-card">
        <h2>Semana ${currentWeek}</h2>
        <div class="date-range">
          <label>De
            <input id="menu-start-date" type="date" value="${menuStartDate}">
          </label>
          <label>Até
            <input id="menu-end-date" type="date" value="${menuEndDate}">
          </label>
        </div>
      </form>
      <div class="menu-actions">
        <button class="menu-action-button ${state.showClients ? "active" : ""}" type="button" id="client-toggle">Cadastro de clientes</button>
        <button class="menu-action-button ${state.showPlanning ? "active" : ""}" type="button" id="planning-toggle">Planejamento</button>
        <button class="menu-action-button ${state.showOrders ? "active" : ""}" type="button" id="order-toggle">Pedidos</button>
      </div>
      ${state.showClients ? clientPanel(currentKey) : ""}
      ${state.showOrders ? orderPanel(result.plan, currentKey) : ""}
      ${state.showPlanning ? `
        <section class="planning-panel">
          <div class="summary planning-summary">
            <div class="metric"><span>Custo semanal</span><strong>${money(result.totalCost)}</strong></div>
            <div class="metric"><span>Lista de compras</span><strong>${planningStats.shopping}</strong></div>
            <div class="metric"><span>Em preparo</span><strong>${planningStats.prep}</strong></div>
            <div class="metric"><span>Pratos prontos</span><strong>${planningStats.ready}/5</strong></div>
          </div>
          <form id="menu-form">
            <div class="planning-board">
              ${result.plan.map((item, index) => `
                <article class="planning-card" data-status="${item.status}">
                  <div class="planning-card-top">
                    <span>Cumbuca ${item.slot}</span>
                    <strong>${item.status === "pronto" ? "Pronto" : item.status === "preparo" ? "Preparo" : item.status === "compras" ? "Compras" : "Planejado"}</strong>
                  </div>
                  <label>Prato
                    <input name="dish-${index}" value="${item.dish}" placeholder="Nome da cumbuca">
                  </label>
                  <label>Custo total
                    <input name="cost-${index}" type="text" inputmode="decimal" value="${moneyInputValue(item.cost)}" placeholder="Soma dos ingredientes">
                  </label>
                  <div class="ingredient-list">
                    <div class="ingredient-list-title">
                      <span>Lista de ingredientes</span>
                      <span>Valor</span>
                      <span></span>
                    </div>
                    <div class="ingredient-rows" data-ingredient-rows="${index}">
                      ${planningIngredientRows(item, index)}
                    </div>
                    <button class="ingredient-add" type="button" data-add-ingredient="${index}">+ Ingrediente</button>
                  </div>
                  <label>Status
                    <select name="status-${index}">
                      <option value="planejado" ${item.status === "planejado" ? "selected" : ""}>Planejado</option>
                      <option value="compras" ${item.status === "compras" ? "selected" : ""}>Lista de compras</option>
                      <option value="preparo" ${item.status === "preparo" ? "selected" : ""}>Em preparo</option>
                      <option value="pronto" ${item.status === "pronto" ? "selected" : ""}>Pronto</option>
                    </select>
                  </label>
                  <label>Observação
                    <textarea name="notes-${index}" placeholder="Compra, preparo, entrega">${item.notes}</textarea>
                  </label>
                </article>
              `).join("")}
            </div>
            <div class="actions">
              <button type="submit">Salvar menu</button>
              ${currentWeek > 1 ? `<button class="secondary" type="button" id="copy-previous-menu">Duplicar semana anterior</button>` : ""}
              <button class="secondary" type="button" id="clear-menu">Limpar</button>
            </div>
          </form>
        </section>
      ` : ""}
      `}
    </section>
  `;

  document.querySelectorAll("[data-week]").forEach(link => {
    link.addEventListener("click", event => {
      event.preventDefault();
      state.menuWeek = Number(event.currentTarget.dataset.week);
      state.showMonthSummary = false;
      persistState();
      history.replaceState(null, "", `/menu-semanal?ano=${state.menuPeriod.year}&mes=${state.menuPeriod.month}&semana=${state.menuWeek}`);
      renderMenu();
    });
  });

  const monthSummaryLink = document.querySelector("[data-month-summary]");
  if (monthSummaryLink) {
    monthSummaryLink.addEventListener("click", event => {
      event.preventDefault();
      state.showMonthSummary = true;
      state.showClients = false;
      state.showOrders = false;
      state.showPlanning = false;
      history.replaceState(null, "", `/menu-semanal?ano=${state.menuPeriod.year}&mes=${state.menuPeriod.month}&resumo=mes`);
      renderMenu();
    });
  }

  const clientToggle = document.querySelector("#client-toggle");
  if (clientToggle) {
    clientToggle.addEventListener("click", () => {
    state.showClients = !state.showClients;
    state.showOrders = false;
    state.showPlanning = false;
    renderMenu();
    });
  }

  const orderToggle = document.querySelector("#order-toggle");
  if (orderToggle) {
    orderToggle.addEventListener("click", () => {
    state.showOrders = !state.showOrders;
    state.showClients = false;
    state.showPlanning = false;
    renderMenu();
    });
  }

  const planningToggle = document.querySelector("#planning-toggle");
  if (planningToggle) {
    planningToggle.addEventListener("click", () => {
    state.showPlanning = !state.showPlanning;
    state.showClients = false;
    state.showOrders = false;
    renderMenu();
    });
  }

  const clientForm = document.querySelector("#client-form");
  const clientBack = document.querySelector("#client-back");
  if (clientBack) {
    clientBack.addEventListener("click", () => {
      state.showClients = false;
      state.editClientIndex = null;
      renderMenu();
    });
  }

  document.querySelectorAll("[data-client-tab]").forEach(button => {
    button.addEventListener("click", event => {
      state.clientTab = event.currentTarget.dataset.clientTab;
      if (state.clientTab === "list") {
        state.editClientIndex = null;
      }
      renderMenu();
    });
  });

  document.querySelectorAll("[data-edit-client]").forEach(button => {
    button.addEventListener("click", event => {
      state.editClientIndex = Number(event.currentTarget.dataset.editClient);
      state.clientTab = "form";
      renderMenu();
    });
  });

  document.querySelectorAll("[data-client-history]").forEach(button => {
    button.addEventListener("click", event => {
      state.clientHistoryPhone = event.currentTarget.dataset.clientHistory;
      state.clientTab = "list";
      renderMenu();
    });
  });

  const closeClientHistory = document.querySelector("#close-client-history");
  if (closeClientHistory) {
    closeClientHistory.addEventListener("click", () => {
      state.clientHistoryPhone = "";
      renderMenu();
    });
  }

  document.querySelectorAll("[data-delete-client]").forEach(button => {
    button.addEventListener("click", event => {
      const index = Number(event.currentTarget.dataset.deleteClient);
      const client = state.clients[index];
      if (!confirm(`Inativar cadastro de ${client.name}? O histórico de pedidos será mantido.`)) {
        return;
      }
      state.clients[index] = {
        ...client,
        inactive: true,
        inactiveAt: new Date().toISOString()
      };
      state.editClientIndex = null;
      persistState();
      renderMenu();
    });
  });

  document.querySelectorAll("[data-reactivate-client]").forEach(button => {
    button.addEventListener("click", event => {
      const index = Number(event.currentTarget.dataset.reactivateClient);
      state.clients[index] = {
        ...state.clients[index],
        inactive: false,
        inactiveAt: ""
      };
      persistState();
      renderMenu();
    });
  });

  const clientSearch = document.querySelector("[data-client-search]");
  if (clientSearch) {
    clientSearch.addEventListener("input", event => {
      state.clientSearch = event.currentTarget.value;
      renderMenu();
    });
  }

  if (clientForm) {
    const cancelClientEdit = document.querySelector("#cancel-client-edit");
    if (cancelClientEdit) {
      cancelClientEdit.addEventListener("click", () => {
        state.editClientIndex = null;
        renderMenu();
      });
    }

    const planField = clientForm.querySelector("[name='plan']");
    const planValueField = clientForm.querySelector("[name='planValue']");
    const monthlyQuantityField = clientForm.querySelector("[name='monthlyQuantity']");
    function updateDeliveryVisibility() {
      clientForm.dataset.plan = planField.value;
      const isMonthly = planField.value === "mensalista";
      planValueField.required = isMonthly;
      monthlyQuantityField.required = isMonthly;
    }
    planField.addEventListener("change", updateDeliveryVisibility);
    updateDeliveryVisibility();

    clientForm.addEventListener("submit", event => {
      event.preventDefault();
      const data = readForm(event.currentTarget);
      const normalizedPhone = String(data.phone || "").replace(/\D/g, "");
      const duplicateClient = state.clients.find((client, index) => {
        const samePhone = String(client.phone || "").replace(/\D/g, "") === normalizedPhone;
        return samePhone && index !== state.editClientIndex;
      });
      if (duplicateClient) {
        alert(`Ja existe cliente cadastrado com este telefone: ${duplicateClient.name || duplicateClient.phone}`);
        return;
      }
      const periodKey = currentMenuPeriodKey();
      const monthlyPackages = {
        ...(state.editClientIndex !== null ? state.clients[state.editClientIndex]?.monthlyPackages || {} : {})
      };

      if (data.plan === "mensalista") {
        monthlyPackages[periodKey] = {
          planValue: parseMoneyInput(data.planValue).toFixed(2),
          monthlyQuantity: data.monthlyQuantity
        };
      }

      const client = {
        ...data,
        planValue: parseMoneyInput(data.planValue).toFixed(2),
        weeklyDeliveryFee: parseMoneyInput(data.weeklyDeliveryFee).toFixed(2),
        monthlyPackages
      };

      if (state.editClientIndex !== null) {
        const existing = state.clients[state.editClientIndex] || {};
        state.clients[state.editClientIndex] = {
          ...existing,
          ...client,
          createdAt: existing.createdAt || new Date().toISOString(),
          createdMenuKey: existing.createdMenuKey || ""
        };
      } else {
        state.clients.push({
          ...client,
          createdAt: new Date().toISOString(),
          createdMenuKey: currentKey
        });
      }
      persistState();
      state.editClientIndex = null;
      state.clientTab = "list";
      renderMenu();
    });
  }

  const orderBack = document.querySelector("#order-back");
  if (orderBack) {
    orderBack.addEventListener("click", () => {
      state.showOrders = false;
      state.editOrderId = null;
      renderMenu();
    });
  }

  document.querySelectorAll("[data-order-tab]").forEach(button => {
    button.addEventListener("click", event => {
      state.orderTab = event.currentTarget.dataset.orderTab;
      if (state.orderTab !== "form") {
        state.editOrderId = null;
      }
      renderMenu();
    });
  });

  const orderForm = document.querySelector("#order-form");
  if (orderForm) {
    const totalField = document.querySelector("#order-total");
    const clientField = orderForm.querySelector("[name='clientPhone']");
    const weeklyFields = document.querySelector("#weekly-order-fields");
    const deliveryFeeField = orderForm.querySelector("[name='orderDeliveryFee']");
    const quantityFields = [...orderForm.querySelectorAll("[data-dish-quantity]")];

    function selectedOrderClient() {
      return clientByPhone(clientField.value);
    }

    function updateOrderTotal() {
      const dishTotal = quantityFields.reduce((sum, field) => sum + Number(field.value || 0), 0);
      totalField.textContent = String(dishTotal);

      orderForm.querySelectorAll(".dish-option").forEach(option => {
        const values = [...option.querySelectorAll("input")].map(field => Number(field.value || 0));
        option.classList.toggle("has-quantity", values.some(value => value > 0));
      });
    }

    function updateWeeklyFields() {
      const client = selectedOrderClient();
      const isWeekly = client.plan === "semanal";
      weeklyFields.hidden = !isWeekly;
      if (isWeekly && deliveryFeeField && !state.editOrderId) {
        deliveryFeeField.value = moneyInputValue(client.weeklyDeliveryFee || client.deliveryFee);
      }
      weeklyFields.querySelectorAll("input").forEach(field => {
        field.disabled = !isWeekly;
        field.required = isWeekly && field.name === "weeklyValue";
      });
      updateOrderTotal();
    }

    clientField.addEventListener("change", updateWeeklyFields);
    quantityFields.forEach(field => {
      field.addEventListener("input", updateOrderTotal);
    });
    orderForm.querySelectorAll(".dish-option input").forEach(field => {
      field.addEventListener("input", updateOrderTotal);
    });
    updateOrderTotal();

    orderForm.addEventListener("submit", event => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      const dishes = [1, 2, 3, 4, 5]
        .map(slot => ({
          slot,
          quantity: Number(data.get(`dish-${slot}`) || 0)
        }))
        .filter(item => item.quantity > 0);
      const clientPhone = data.get("clientPhone");
      const client = clientByPhone(clientPhone);
      const weeklyValue = client.plan === "semanal" ? parseMoneyInput(data.get("weeklyValue")) : 0;
      const deliveryFee = client.plan === "semanal" ? parseMoneyInput(data.get("orderDeliveryFee")) : 0;
      const paid = client.plan === "semanal" && data.get("paid") === "on";

      if (!dishes.length) {
        showToast("Informe pelo menos uma cumbuca no pedido.", "error");
        return;
      }
      if (!clientPhone) {
        showToast("Selecione um cliente para o pedido.", "error");
        return;
      }
      const duplicateOrder = !state.editOrderId && state.orders.some(order =>
        order.menuKey === currentKey
        && String(order.clientPhone || "") === String(clientPhone || "")
      );
      if (duplicateOrder && !confirm("Este cliente já tem pedido nesta semana. Criar outro pedido mesmo assim?")) {
        return;
      }

      let remainingAfterOrder = null;
      let monthlyValue = 0;
      if (client.plan === "mensalista") {
        const requested = dishes.reduce((sum, dish) => sum + Number(dish.quantity || 0), 0);
        const packageQuantity = clientMonthlyQuantity(client, currentKey);
        const packageValue = clientMonthlyValue(client, currentKey);
        if (packageQuantity <= 0 || packageValue <= 0) {
          alert("Informe o valor e a quantidade do pacote mensal no cadastro deste cliente.");
          return;
        }
        monthlyValue = monthlyChargeForOrder(client, currentKey, requested, state.editOrderId);
        const orderedBefore = clientOrderedQuantity(client, currentKey, state.editOrderId);
        const capacityAfterOrder = clientMonthlyCapacity(client, currentKey, state.editOrderId)
          + (monthlyValue > 0 ? (monthlyValue / packageValue) * packageQuantity : 0);
        remainingAfterOrder = Math.max(0, capacityAfterOrder - orderedBefore - requested);
      }

      const savedOrder = {
        id: state.editOrderId || Date.now(),
        menuKey: currentKey,
        clientPhone,
        dishes,
        amount: client.plan === "mensalista" ? monthlyValue : weeklyValue,
        deliveryFee,
        paid,
        paidAmount: editing?.paidAmount || (paid ? weeklyValue : 0),
        delivered: editing?.delivered || false,
        deliveredAt: editing?.deliveredAt || "",
        totalQuantity: undefined,
        notes: String(data.get("notes") || "").trim(),
        createdAt: state.editOrderId
          ? state.orders.find(order => Number(order.id) === Number(state.editOrderId))?.createdAt || new Date().toISOString()
          : new Date().toISOString()
      };

      if (state.editOrderId) {
        state.orders = state.orders.map(order => Number(order.id) === Number(state.editOrderId) ? savedOrder : order);
      } else {
        state.orders.push(savedOrder);
      }
      persistState();
      state.editOrderId = null;
      state.orderTab = "orders";
      if (remainingAfterOrder !== null && remainingAfterOrder <= LOW_MONTHLY_QUANTITY) {
        alert(monthlyQuantityWarningText(client, remainingAfterOrder));
      }
      renderMenu();
    });
    updateWeeklyFields();

    document.querySelectorAll("[data-edit-order]").forEach(button => {
      button.addEventListener("click", event => {
        state.editOrderId = Number(event.currentTarget.dataset.editOrder);
        renderMenu();
      });
    });

    document.querySelectorAll("[data-toggle-paid-order]").forEach(button => {
      button.addEventListener("click", event => {
        const id = Number(event.currentTarget.dataset.togglePaidOrder);
        state.orders = state.orders.map(order => (
          Number(order.id) === id ? { ...order, paid: !isOrderPaid(order), paidAmount: !isOrderPaid(order) ? Number(order.amount || 0) : 0 } : order
        ));
        persistState();
        renderMenu();
      });
    });

    document.querySelectorAll("[data-partial-paid-order]").forEach(button => {
      button.addEventListener("click", event => {
        const id = Number(event.currentTarget.dataset.partialPaidOrder);
        updateOrderPartialPayment(id);
      });
    });

    document.querySelectorAll("[data-toggle-delivered-order]").forEach(button => {
      button.addEventListener("click", event => {
        const id = Number(event.currentTarget.dataset.toggleDeliveredOrder);
        toggleOrderDelivered(id);
      });
    });

    const downloadProduction = document.querySelector("[data-download-production]");
    if (downloadProduction) {
      downloadProduction.addEventListener("click", () => {
        downloadTextFile(`cumbuca-producao-${currentKey}.txt`, productionListText(plan, currentKey), "text/plain;charset=utf-8");
      });
    }

    const downloadDelivery = document.querySelector("[data-download-delivery]");
    if (downloadDelivery) {
      downloadDelivery.addEventListener("click", () => {
        downloadTextFile(`cumbuca-entrega-${currentKey}.txt`, deliveryListText(currentKey), "text/plain;charset=utf-8");
      });
    }

    const cancelOrderEdit = document.querySelector("#cancel-order-edit");
    if (cancelOrderEdit) {
      cancelOrderEdit.addEventListener("click", () => {
        state.editOrderId = null;
        renderMenu();
      });
    }

    document.querySelectorAll("[data-delete-order]").forEach(button => {
      button.addEventListener("click", event => {
        const id = Number(event.currentTarget.dataset.deleteOrder);
        if (!confirm("Excluir este pedido?")) {
          return;
        }
        state.orders = state.orders.filter(order => Number(order.id) !== id);
        if (Number(state.editOrderId) === id) {
          state.editOrderId = null;
        }
        persistState();
        renderMenu();
      });
    });
  }

  document.querySelectorAll("[data-edit-order]").forEach(button => {
    button.addEventListener("click", event => {
      state.editOrderId = Number(event.currentTarget.dataset.editOrder);
      state.orderTab = "form";
      renderMenu();
    });
  });

  document.querySelectorAll("[data-toggle-paid-order]").forEach(button => {
    button.addEventListener("click", event => {
      const id = Number(event.currentTarget.dataset.togglePaidOrder);
      state.orders = state.orders.map(order => (
        Number(order.id) === id ? { ...order, paid: !isOrderPaid(order), paidAmount: !isOrderPaid(order) ? Number(order.amount || 0) : 0 } : order
      ));
      persistState();
      renderMenu();
    });
  });

  document.querySelectorAll("[data-partial-paid-order]").forEach(button => {
    button.addEventListener("click", event => {
      const id = Number(event.currentTarget.dataset.partialPaidOrder);
      updateOrderPartialPayment(id);
    });
  });

  document.querySelectorAll("[data-toggle-delivered-order]").forEach(button => {
    button.addEventListener("click", event => {
      const id = Number(event.currentTarget.dataset.toggleDeliveredOrder);
      toggleOrderDelivered(id);
    });
  });

  const orderFilterForm = document.querySelector("#order-filter-form");
  if (orderFilterForm) {
    orderFilterForm.addEventListener("submit", event => {
      event.preventDefault();
      state.orderFilter = {
        ...state.orderFilter,
        ...readForm(event.currentTarget)
      };
      localStorage.setItem("orderFilter", JSON.stringify(state.orderFilter));
      renderMenu();
    });
  }

  const clearOrderFilters = document.querySelector("#clear-order-filters");
  if (clearOrderFilters) {
    clearOrderFilters.addEventListener("click", () => {
      state.orderFilter = { search: "", payment: "all", delivery: "all" };
      localStorage.setItem("orderFilter", JSON.stringify(state.orderFilter));
      renderMenu();
    });
  }

  const orderSearch = document.querySelector("[data-order-search]");
  if (orderSearch) {
    orderSearch.addEventListener("input", event => {
      state.orderFilter = {
        ...(state.orderFilter || { payment: "all", delivery: "all" }),
        search: event.currentTarget.value
      };
      localStorage.setItem("orderFilter", JSON.stringify(state.orderFilter));
      renderMenu();
    });
  }

  const downloadProductionOutside = document.querySelector("[data-download-production]");
  if (downloadProductionOutside) {
    downloadProductionOutside.addEventListener("click", () => {
      downloadTextFile(`cumbuca-producao-${currentKey}.txt`, productionListText(result.plan, currentKey), "text/plain;charset=utf-8");
    });
  }

  const downloadDeliveryOutside = document.querySelector("[data-download-delivery]");
  if (downloadDeliveryOutside) {
    downloadDeliveryOutside.addEventListener("click", () => {
      downloadTextFile(`cumbuca-entrega-${currentKey}.txt`, deliveryListText(currentKey), "text/plain;charset=utf-8");
    });
  }

  document.querySelectorAll("[data-delete-order]").forEach(button => {
    button.addEventListener("click", event => {
      const id = Number(event.currentTarget.dataset.deleteOrder);
      if (!confirm("Excluir este pedido?")) {
        return;
      }
      state.orders = state.orders.filter(order => Number(order.id) !== id);
      if (Number(state.editOrderId) === id) {
        state.editOrderId = null;
      }
      persistState();
      renderMenu();
    });
  });

  on("#menu-period-form", "submit", event => {
    event.preventDefault();
    const data = readForm(event.currentTarget);
    state.menuPeriod = {
      year: Number(data.year),
      month: Number(data.month)
    };
    persistState();
    history.replaceState(null, "", `/menu-semanal?ano=${state.menuPeriod.year}&mes=${state.menuPeriod.month}&semana=${state.menuWeek}`);
    renderMenu();
  });

  function saveMenuDateRange() {
    const startField = document.querySelector("#menu-start-date");
    const endField = document.querySelector("#menu-end-date");
    if (!startField || !endField) {
      return;
    }

    state.menuDates[currentKey] = {
      start: startField.value,
      end: endField.value
    };
    persistState();
  }

  const startDateField = document.querySelector("#menu-start-date");
  const endDateField = document.querySelector("#menu-end-date");
  if (startDateField && endDateField) {
    startDateField.addEventListener("change", saveMenuDateRange);
    endDateField.addEventListener("change", saveMenuDateRange);
  }

  const menuForm = document.querySelector("#menu-form");
  if (menuForm) {
    document.querySelectorAll("[data-add-ingredient]").forEach(button => {
      button.addEventListener("click", event => {
        const menuIndex = Number(event.currentTarget.dataset.addIngredient);
        const rows = document.querySelector(`[data-ingredient-rows="${menuIndex}"]`);
        const ingredientIndex = rows.querySelectorAll("[data-ingredient-row]").length;
        rows.insertAdjacentHTML("beforeend", planningIngredientRow(menuIndex, ingredientIndex));
      });
    });

    menuForm.addEventListener("click", event => {
      const removeButton = event.target.closest("[data-remove-ingredient]");
      if (!removeButton) {
        return;
      }

      const row = removeButton.closest("[data-ingredient-row]");
      const rows = row.parentElement;
      if (rows.querySelectorAll("[data-ingredient-row]").length === 1) {
        row.querySelectorAll("input").forEach(input => {
          input.value = "";
        });
        return;
      }

      row.remove();
    });

    menuForm.addEventListener("submit", event => {
      event.preventDefault();
      const data = readForm(event.currentTarget);
      state.menus[currentKey] = result.plan.map((item, index) => {
        const ingredients = readPlanningIngredients(event.currentTarget, index);
        const ingredientTotal = planningIngredientTotal(ingredients);
        return {
          slot: index + 1,
          dish: data[`dish-${index}`],
          ingredients,
          cost: (ingredientTotal || parseMoneyInput(data[`cost-${index}`])).toFixed(2),
          status: data[`status-${index}`],
          notes: data[`notes-${index}`]
        };
      });
      persistState();
      renderMenu();
    });

    on("#clear-menu", "click", () => {
      state.menus[currentKey] = [];
      persistState();
      renderMenu();
    });

    const copyPreviousMenu = document.querySelector("#copy-previous-menu");
    if (copyPreviousMenu) {
      copyPreviousMenu.addEventListener("click", () => {
        const previousKey = menuKey(currentWeek - 1);
        const previousMenu = state.menus[previousKey] || [];
        if (!previousMenu.length) {
          showToast("Semana anterior sem menu", "warning");
          return;
        }
        if (!confirm("Duplicar o menu da semana anterior para esta semana?")) {
          return;
        }
        state.menus[currentKey] = previousMenu.map(item => ({
          ...item,
          status: item.status || "planejado"
        }));
        persistState();
        renderMenu();
      });
    }
  }
}

function clientPanel(currentKey) {
  const editing = state.editClientIndex !== null ? state.clients[state.editClientIndex] : null;
  const activeTab = editing ? "form" : state.clientTab;
  const packageForMonth = editing ? clientMonthlyPackage(editing, currentKey) : {};

  return `
    <section class="client-panel">
      <div class="client-panel-header">
        <h2>${editing ? "Editar cliente" : "Cadastro de clientes"}</h2>
        <div class="client-count"><span>Clientes ativos</span><strong>${activeClients().length}</strong></div>
        <button class="secondary" type="button" id="client-back">Voltar</button>
      </div>
      <div class="client-tabs" role="tablist" aria-label="Clientes">
        <button class="${activeTab === "form" ? "active" : ""}" type="button" data-client-tab="form">Cadastro</button>
        <button class="${activeTab === "list" ? "active" : ""}" type="button" data-client-tab="list">Clientes cadastrados</button>
      </div>
      ${activeTab === "list" ? clientList(currentKey) : `
      <form id="client-form" class="client-form">
        <label>Nome
          <input name="name" placeholder="Nome do cliente" value="${editing?.name || ""}" required>
        </label>
        <label class="client-address">Endereço
          <input name="address" placeholder="Rua, número, bairro" value="${editing?.address || ""}" required>
        </label>
        <label>Complemento
          <input name="complement" placeholder="Apto, bloco, referência" value="${editing?.complement || ""}">
        </label>
        <label>Telefone
          <input name="phone" type="tel" placeholder="(00) 00000-0000" value="${editing?.phone || ""}" required>
        </label>
        <label>Plano
          <select name="plan" required>
            <option value="semanal" ${editing?.plan === "semanal" ? "selected" : ""}>Semanal</option>
            <option value="mensalista" ${editing?.plan === "mensalista" ? "selected" : ""}>Mensalista</option>
          </select>
        </label>
        <label class="plan-value-field">
          <span class="value-label weekly-value">Valor padrão</span>
          <span class="value-label monthly-value">Valor mensal do mês</span>
          <input name="planValue" type="text" inputmode="decimal" placeholder="0,00" value="${moneyInputValue(packageForMonth.planValue)}">
        </label>
        <label class="weekly-freight-value">Frete
          <input name="weeklyDeliveryFee" type="text" inputmode="decimal" placeholder="0,00" value="${moneyInputValue(editing?.weeklyDeliveryFee || editing?.deliveryFee)}">
        </label>
        <label class="monthly-quantity">Quantidade do mês
          <input name="monthlyQuantity" type="number" min="0" step="1" placeholder="0" value="${packageForMonth.monthlyQuantity || ""}">
        </label>
        <label class="client-notes">Observação
          <textarea name="notes" placeholder="Preferência, restrição, detalhe de entrega">${editing?.notes || ""}</textarea>
        </label>
        <div class="client-form-actions">
          <button type="submit">${editing ? "Salvar edição" : "Salvar cliente"}</button>
          ${editing ? `<button class="secondary" type="button" id="cancel-client-edit">Cancelar</button>` : ""}
        </div>
      </form>
      `}
    </section>
  `;
}

function clientList(currentKey) {
  if (!state.clients.length) {
    return `<p class="muted">Nenhum cliente cadastrado ainda.</p>`;
  }

  const orderedClients = state.clients
    .map((client, index) => ({ client, index }))
    .filter(({ client }) => {
      const query = String(state.clientSearch || "").trim().toLowerCase();
      if (!query) {
        return true;
      }
      return [client.name, client.phone, client.address, client.complement, client.notes, client.plan]
        .some(value => String(value || "").toLowerCase().includes(query));
    })
    .sort((a, b) => {
      if (Boolean(a.client.inactive) !== Boolean(b.client.inactive)) {
        return a.client.inactive ? 1 : -1;
      }
      if (a.client.plan === b.client.plan) {
        return (a.client.name || "").localeCompare(b.client.name || "", "pt-BR");
      }
      return a.client.plan === "mensalista" ? -1 : 1;
    });

  return `
    <div class="filter-bar">
      <label>Buscar cliente
        <input data-client-search placeholder="Nome, telefone, endereço ou observação" value="${state.clientSearch || ""}">
      </label>
    </div>
    <div class="table-wrap client-table">
      <table>
        <thead><tr><th>Nome</th><th>Endereço</th><th>Complemento</th><th>Telefone</th><th>Plano</th><th>Valor</th><th>Frete / Qtd. restante</th><th>Obs.</th><th></th></tr></thead>
        <tbody>
          ${orderedClients.map(({ client, index }) => `
            <tr>
              <td>${client.name || ""}${client.inactive ? ` <span class="payment-badge pending">Inativo</span>` : ""}</td>
              <td>${client.address || ""}</td>
              <td>${client.complement || ""}</td>
              <td>${client.phone || ""}</td>
              <td>${client.plan === "mensalista" ? "Mensalista" : "Semanal"}</td>
              <td>${client.plan === "mensalista" ? money(clientMonthlyValue(client, currentKey)) : "Variável"}</td>
              <td>
                ${client.plan === "mensalista" ? `${clientRemainingQuantity(client, currentKey)}/${clientMonthlyCapacity(client, currentKey)} ${clientChargedPackageCount(client, currentKey) > 1 ? `<span class="quantity-badge renewed">${clientChargedPackageCount(client, currentKey)} pacotes</span>` : ""} ${clientQuantityStatus(client, currentKey)}` : money(client.weeklyDeliveryFee || client.deliveryFee)}
              </td>
              <td>${client.notes || ""}</td>
              <td>
                <div class="table-actions">
                  <button class="secondary table-action" type="button" data-edit-client="${index}">Editar</button>
                  <button class="secondary table-action" type="button" data-client-history="${client.phone || ""}">Histórico</button>
                  ${client.phone ? `<a class="secondary table-action" href="${client.plan === "mensalista" ? monthlyRenewalWhatsAppUrl(client, currentKey) : clientChargeWhatsAppUrl(client)}" target="_blank" rel="noopener">WhatsApp</a>` : ""}
                  ${client.inactive
                    ? `<button class="secondary table-action" type="button" data-reactivate-client="${index}">Reativar</button>`
                    : `<button class="danger table-action" type="button" data-delete-client="${index}">Inativar</button>`}
                </div>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
    ${state.clientHistoryPhone ? clientHistoryPanel(state.clientHistoryPhone, currentKey) : ""}
  `;
}

function clientByPhone(phone) {
  return state.clients.find(client => client.phone === phone) || {};
}

function activeClients() {
  return state.clients.filter(client => !client.inactive);
}

function clientMonthlyPackage(client, currentKey = menuKey()) {
  const periodKey = menuPeriodKeyFromKey(currentKey);
  return client.monthlyPackages?.[periodKey] || {
    planValue: client.planValue || 0,
    monthlyQuantity: client.monthlyQuantity || client.quantity || client.deliveryFrom || 0
  };
}

function clientMonthlyValue(client, currentKey) {
  return Number(clientMonthlyPackage(client, currentKey).planValue || 0);
}

function clientMonthlyQuantity(client, currentKey) {
  return Number(clientMonthlyPackage(client, currentKey).monthlyQuantity || 0);
}

function clientChargedPackageCount(client, currentKey, ignoredOrderId = null) {
  const packageValue = clientMonthlyValue(client, currentKey);
  if (packageValue <= 0) {
    return 0;
  }

  return monthlyOrders(currentKey)
    .filter(order => order.clientPhone === client.phone)
    .filter(order => Number(order.id) !== Number(ignoredOrderId))
    .reduce((sum, order) => sum + Math.ceil(Number(order.amount || 0) / packageValue), 0);
}

function clientMonthlyCapacity(client, currentKey, ignoredOrderId = null) {
  const packageQuantity = clientMonthlyQuantity(client, currentKey);
  const packageCount = Math.max(1, clientChargedPackageCount(client, currentKey, ignoredOrderId));
  return packageQuantity * packageCount;
}

function clientOrderedQuantity(client, currentKey, ignoredOrderId = null) {
  return monthlyOrders(currentKey)
    .filter(order => order.clientPhone === client.phone)
    .filter(order => Number(order.id) !== Number(ignoredOrderId))
    .reduce((sum, order) => sum + orderQuantity(order), 0);
}

function clientRemainingQuantity(client, currentKey, ignoredOrderId = null) {
  return Math.max(0, clientMonthlyCapacity(client, currentKey, ignoredOrderId) - clientOrderedQuantity(client, currentKey, ignoredOrderId));
}

function monthlyChargeForOrder(client, currentKey, requestedQuantity, ignoredOrderId = null) {
  if (client.plan !== "mensalista") {
    return 0;
  }

  const packageValue = clientMonthlyValue(client, currentKey);
  const packageQuantity = clientMonthlyQuantity(client, currentKey);
  if (packageValue <= 0 || packageQuantity <= 0) {
    return 0;
  }

  const orderedQuantity = clientOrderedQuantity(client, currentKey, ignoredOrderId);
  const chargedPackages = clientChargedPackageCount(client, currentKey, ignoredOrderId);
  const entitledPackages = Math.max(1, chargedPackages);
  const packagesNeeded = Math.max(entitledPackages, Math.ceil((orderedQuantity + requestedQuantity) / packageQuantity));
  const packagesToCharge = chargedPackages === 0
    ? packagesNeeded
    : Math.max(0, packagesNeeded - chargedPackages);

  return packagesToCharge * packageValue;
}

function isLowMonthlyQuantity(client, currentKey) {
  const remaining = clientRemainingQuantity(client, currentKey);
  return client.plan === "mensalista" && remaining > 0 && remaining <= LOW_MONTHLY_QUANTITY;
}

function monthlyQuantityWarningText(client, remaining) {
  if (remaining <= 0) {
    return `O pacote de ${client.name || "mensalista"} acabou. O próximo pedido mensal renova um novo pacote automaticamente.`;
  }

  return `Atenção: ${client.name || "mensalista"} está com apenas ${remaining} cumbuca(s) restante(s) neste mês.`;
}

function clientQuantityStatus(client, currentKey) {
  if (client.plan !== "mensalista") {
    return "";
  }

  const remaining = clientRemainingQuantity(client, currentKey);
  if (remaining <= 0) {
    return `<span class="quantity-badge empty">Pode renovar</span>`;
  }

  if (isLowMonthlyQuantity(client, currentKey)) {
    return `<span class="quantity-badge low">Perto de acabar</span>`;
  }

  return "";
}

function dishName(plan, slot) {
  const item = plan.find(dish => Number(dish.slot) === Number(slot));
  return item?.dish || `Cumbuca ${slot}`;
}

function orderQuantity(order) {
  if (Number(order.totalQuantity || 0) > 0) {
    return Number(order.totalQuantity);
  }

  return (order.dishes || []).reduce((sum, dish) => sum + Number(dish.quantity || 0), 0);
}

function orderDishesText(order, plan) {
  if (!(order.dishes || []).length && Number(order.totalQuantity || 0) > 0) {
    return `${order.totalQuantity} cumbuca(s)`;
  }

  return (order.dishes || [])
    .map(dish => `${dish.quantity}x ${dishName(plan, dish.slot)}`)
    .join(", ");
}

function orderDishQuantity(order, slot) {
  const found = (order.dishes || []).find(dish => Number(dish.slot) === Number(slot));
  return Number(found?.quantity || 0);
}

function weeklyOrders(currentKey) {
  return state.orders.filter(order => order.menuKey === currentKey);
}

function monthlyOrders(currentKey) {
  const periodKey = menuPeriodKeyFromKey(currentKey);
  return state.orders.filter(order => menuPeriodKeyFromKey(order.menuKey) === periodKey);
}

function monthSummaryPanel(currentKey) {
  const periodKey = menuPeriodKeyFromKey(currentKey);
  const orders = monthlyOrders(currentKey);
  const totalQuantity = orders.reduce((sum, order) => sum + orderQuantity(order), 0);
  const totalDeliveryFee = orders.reduce((sum, order) => sum + Number(order.deliveryFee || 0), 0);
  const weeklySummary = [1, 2, 3, 4, 5].map(week => {
    const key = `${periodKey}-semana-${week}`;
    const dishes = state.menus[key] || [];
    const weekOrders = weeklyOrders(key);

    return {
      week,
      dishes: dishes.map(item => item.dish).filter(Boolean).join(", "),
      menuCost: dishes.reduce((sum, item) => sum + Number(item.cost || 0), 0),
      orderAmount: weekOrders.reduce((sum, order) => sum + Number(order.amount || 0), 0),
      orderCount: weekOrders.length
    };
  });

  return `
    <section class="month-summary-panel">
      <div class="summary">
        <div class="metric"><span>Cumbucas vendidas</span><strong>${totalQuantity}</strong></div>
        <div class="metric"><span>Pedidos no mês</span><strong>${orders.length}</strong></div>
        <div class="metric"><span>Frete arrecadado</span><strong>${money(totalDeliveryFee)}</strong></div>
      </div>
      <div class="table-wrap month-summary-table">
        <table>
          <thead><tr><th>Semana</th><th>Prato feito no mês</th><th>Custo total da semana</th><th>Valor total em pedidos da semana</th><th>Pedidos</th></tr></thead>
          <tbody>
            ${weeklySummary.map(item => `
              <tr>
                <td>Semana ${item.week}</td>
                <td>${item.dishes || "Nenhum prato registrado."}</td>
                <td>${money(item.menuCost)}</td>
                <td>${money(item.orderAmount)}</td>
                <td>${item.orderCount}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function orderSummary(plan, currentKey) {
  const orders = weeklyOrders(currentKey);
  const total = orders.reduce((sum, order) => sum + orderQuantity(order), 0);
  const totalAmount = orders.reduce((sum, order) => sum + Number(order.amount || 0), 0);
  const totalDeliveryFee = orders.reduce((sum, order) => sum + Number(order.deliveryFee || 0), 0);
  const byDish = plan.map(item => {
    const quantity = orders.reduce((sum, order) => {
      const found = (order.dishes || []).find(dish => Number(dish.slot) === Number(item.slot));
      return sum + Number(found?.quantity || 0);
    }, 0);

    return {
      slot: item.slot,
      dish: item.dish || `Cumbuca ${item.slot}`,
      quantity
    };
  });

  return `
    <div class="summary order-summary">
      <div class="metric"><span>Pedidos</span><strong>${orders.length}</strong></div>
      <div class="metric"><span>Total de cumbucas</span><strong>${total}</strong></div>
      <div class="metric"><span>Valor em real</span><strong>${money(totalAmount)}</strong></div>
      <div class="metric"><span>Valor em frete</span><strong>${money(totalDeliveryFee)}</strong></div>
    </div>
    <div class="order-dish-summary" aria-label="Resumo por cumbuca">
      ${byDish.map(item => `
        <div class="order-dish-total">
          <span>Cumbuca ${item.slot}</span>
          <strong>${item.quantity}</strong>
          <small>${item.dish}</small>
        </div>
      `).join("")}
    </div>
  `;
}

function orderWhatsAppText(order, plan) {
  const client = clientByPhone(order.clientPhone);
  const items = (order.dishes || [])
    .map(dish => {
      const name = dishNameForSlot(plan, dish.slot);
      return `${dish.quantity}x ${name}`;
    })
    .join(", ");
  const total = Number(order.amount || 0) + Number(order.deliveryFee || 0);
  return [
    `Oi, ${client.name || "tudo bem"}!`,
    `Seu pedido Cumbuca: ${items || `${orderQuantity(order)} cumbuca(s)`}.`,
    total > 0 ? `Total: ${money(total)}.` : "",
    order.notes ? `Obs: ${order.notes}.` : ""
  ].filter(Boolean).join(" ");
}

function orderWhatsAppUrl(order, plan) {
  return whatsappUrl(order.clientPhone, orderWhatsAppText(order, plan));
}

function clientChargeWhatsAppUrl(client, amount = 0) {
  return whatsappUrl(client.phone, [
    `Oi, ${client.name || "tudo bem"}!`,
    "Passando para lembrar da pendência da Cumbuca.",
    Number(amount || 0) > 0 ? `Valor: ${money(amount)}.` : "",
    "Pode me confirmar quando fizer o pagamento?"
  ].filter(Boolean).join(" "));
}

function monthlyRenewalWhatsAppUrl(client, currentKey) {
  const remaining = clientRemainingQuantity(client, currentKey);
  return whatsappUrl(client.phone, [
    `Oi, ${client.name || "tudo bem"}!`,
    remaining <= 0
      ? "Seu pacote mensal da Cumbuca acabou. Quer renovar para este mês?"
      : `Seu pacote mensal está com ${remaining} cumbuca(s) restante(s).`,
    `Pacote atual: ${clientMonthlyCapacity(client, currentKey)} cumbuca(s).`
  ].join(" "));
}

function productionListText(plan, currentKey) {
  const totals = weeklyDishTotals(plan, weeklyOrders(currentKey));
  if (!totals.length) {
    return "Sem pedidos para produção.";
  }

  return [
    `Lista de produção - ${currentKey}`,
    "",
    ...totals.map(item => `${item.quantity}x ${item.dish} (Cumbuca ${item.slot})`)
  ].join("\n");
}

function deliveryListText(currentKey) {
  const rows = weeklyOrders(currentKey)
    .map(order => ({ order, client: clientByPhone(order.clientPhone) }))
    .filter(({ client }) => String(client.address || "").trim());

  if (!rows.length) {
    return "Nenhuma entrega com endereço preenchido.";
  }

  return [
    `Lista de entrega - ${currentKey}`,
    "",
    ...rows.map(({ order, client }) => [
      `${client.name || order.clientPhone} - ${orderQuantity(order)} cumbuca(s)`,
      [client.address, client.complement].filter(Boolean).join(" - "),
      `Contato: ${client.phone || order.clientPhone || ""}`,
      order.notes ? `Obs: ${order.notes}` : ""
    ].filter(Boolean).join("\n"))
  ].join("\n\n");
}

function productionListPanel(plan, currentKey) {
  const orders = weeklyOrders(currentKey);
  const totals = weeklyDishTotals(plan, orders);
  return `
    <section class="order-overview-panel">
      <div class="section-heading">
        <h2>Lista de produção</h2>
        <button class="secondary" type="button" data-download-production>Baixar TXT</button>
      </div>
      ${totals.length ? `
        <div class="recent-list">
          ${totals.map(item => `<span><b>${item.quantity}</b>${item.dish}<small>Cumbuca ${item.slot}</small></span>`).join("")}
        </div>
      ` : `<p class="muted">Sem pedidos para produção ainda.</p>`}
    </section>
  `;
}

function deliveryListPanel(currentKey) {
  const rows = weeklyOrders(currentKey)
    .map(order => ({ order, client: clientByPhone(order.clientPhone) }))
    .filter(({ client }) => String(client.address || "").trim());
  return `
    <section class="order-overview-panel">
      <div class="section-heading">
        <h2>Lista de entrega</h2>
        <button class="secondary" type="button" data-download-delivery>Baixar TXT</button>
      </div>
      ${rows.length ? `
        <div class="recent-list">
          ${rows.map(({ order, client }) => `
            <span><b>${orderQuantity(order)}</b>${client.name || order.clientPhone}<small>${[client.address, client.complement].filter(Boolean).join(" - ")}</small></span>
          `).join("")}
        </div>
      ` : `<p class="muted">Nenhuma entrega com endereço preenchido.</p>`}
    </section>
  `;
}

function orderTabs() {
  const tabs = [
    ["form", state.editOrderId ? "Editar pedido" : "Novo pedido"],
    ["orders", "Pedidos"],
    ["production", "Produção"],
    ["delivery", "Entrega"]
  ];

  return `
    <div class="order-tabs" role="tablist" aria-label="Pedidos">
      ${tabs.map(([tab, label]) => `
        <button class="${state.orderTab === tab ? "active" : ""}" type="button" data-order-tab="${tab}">${label}</button>
      `).join("")}
    </div>
  `;
}

function orderTabContent(plan, currentKey, editing, availableClients) {
  if (state.orderTab === "orders") {
    return `
      ${orderOverviewPanel(plan, currentKey)}
      ${orderList(plan, currentKey)}
    `;
  }

  if (state.orderTab === "production") {
    return productionListPanel(plan, currentKey);
  }

  if (state.orderTab === "delivery") {
    return deliveryListPanel(currentKey);
  }

  return orderFormPanel(plan, currentKey, editing, availableClients);
}

function orderFormPanel(plan, currentKey, editing, availableClients) {
  return `
      <form id="order-form" class="order-form">
        <label>Cliente
          <select name="clientPhone" ${availableClients.length ? "required" : "disabled"}>
            ${availableClients.length
              ? `<option value="">Selecione um cliente</option>${availableClients.map(client => `
                  <option value="${client.phone}" ${editing?.clientPhone === client.phone ? "selected" : ""}>${client.name} - ${client.phone}${client.plan === "mensalista" ? ` - restam ${clientRemainingQuantity(client, currentKey, editing?.id)}/${clientMonthlyCapacity(client, currentKey, editing?.id)}${clientChargedPackageCount(client, currentKey, editing?.id) > 1 ? ` - ${clientChargedPackageCount(client, currentKey, editing?.id)} pacotes` : ""}${isLowMonthlyQuantity(client, currentKey) ? " - perto de acabar" : clientRemainingQuantity(client, currentKey, editing?.id) <= 0 ? " - pode renovar" : ""}` : ""}</option>
                `).join("")}`
              : `<option value="">Cadastre ou reative um cliente primeiro</option>`}
          </select>
        </label>
        <div class="dish-picker">
          ${plan.map(item => `
            <label class="dish-option">
              <div class="dish-option-title">
                <span>Cumbuca ${item.slot}</span>
                <strong>${item.dish || ""}</strong>
              </div>
              <input data-dish-quantity type="number" name="dish-${item.slot}" min="0" step="1" value="${editing ? orderDishQuantity(editing, item.slot) : 0}" aria-label="Quantidade da Cumbuca ${item.slot}">
            </label>
          `).join("")}
        </div>
        <div class="weekly-order-fields" id="weekly-order-fields" hidden>
          <label>Valor em real deste pedido
            <input name="weeklyValue" type="text" inputmode="decimal" placeholder="0,00" value="${moneyInputValue(editing?.amount)}" disabled>
          </label>
          <label>Valor em frete
            <input name="orderDeliveryFee" type="text" inputmode="decimal" placeholder="0,00" value="${moneyInputValue(editing?.deliveryFee)}" disabled>
          </label>
          <label class="checkbox-field">
            <input name="paid" type="checkbox" ${editing?.paid ? "checked" : ""} disabled>
            <span>Pago</span>
          </label>
        </div>
        <label>Observação
          <input name="notes" placeholder="Retirada, entrega, restrição ou detalhe do pedido" value="${editing?.notes || ""}">
        </label>
        <div class="order-total">
          <span>Total de cumbucas</span>
          <strong id="order-total">0</strong>
        </div>
        <div class="actions">
          <button type="submit" ${availableClients.length ? "" : "disabled"}>${editing ? "Salvar edição" : "Salvar pedido"}</button>
          ${editing ? `<button class="secondary" type="button" id="cancel-order-edit">Cancelar</button>` : ""}
        </div>
      </form>
  `;
}

async function renderQuickOrders() {
  state.showOrders = true;
  state.showClients = false;
  state.showPlanning = false;
  if (!["orders", "production", "delivery", "form"].includes(state.orderTab)) {
    state.orderTab = "orders";
  }
  await renderMenu();
  title.textContent = "Pedidos";
  setActive("pedidos");
}

function isOrderPaid(order = {}) {
  const total = Number(order.amount || 0);
  return Boolean(order.paid) || (total > 0 && Number(order.paidAmount || 0) >= total);
}

function paymentBadge(order, client) {
  if (client.plan === "mensalista") {
    return `<span class="payment-badge paid">Mensalista</span>`;
  }
  if (isOrderPaid(order)) {
    return `<span class="payment-badge paid">Pago</span>`;
  }
  if (Number(order.paidAmount || 0) > 0) {
    return `<span class="payment-badge partial">Parcial ${money(order.paidAmount)}</span>`;
  }
  return `<span class="payment-badge pending">Aguardando pagamento</span>`;
}

function deliveryBadge(order) {
  return order.delivered
    ? `<span class="payment-badge paid">Entregue</span>`
    : `<span class="payment-badge pending">Pendente</span>`;
}

function updateOrderPartialPayment(id) {
  const order = state.orders.find(item => Number(item.id) === Number(id));
  if (!order) {
    return;
  }
  const value = prompt("Valor pago até agora:", String(order.paidAmount || ""));
  if (value === null) {
    return;
  }
  const paidAmount = Math.max(0, Number(String(value).replace(",", ".") || 0));
  state.orders = state.orders.map(item => Number(item.id) === Number(id)
    ? { ...item, paidAmount, paid: Number(item.amount || 0) > 0 && paidAmount >= Number(item.amount || 0) }
    : item);
  persistState();
  renderMenu();
}

function toggleOrderDelivered(id) {
  state.orders = state.orders.map(order => Number(order.id) === Number(id)
    ? { ...order, delivered: !order.delivered, deliveredAt: !order.delivered ? new Date().toISOString() : "" }
    : order);
  persistState();
  renderMenu();
}

function orderFilterHtml(filter) {
  return `
    <form id="order-filter-form" class="filter-bar">
      <label>Buscar pedido
        <input name="search" data-order-search placeholder="Cliente, telefone, pagamento ou observação" value="${filter.search || ""}">
      </label>
      <label>Pagamento
        <select name="payment">
          <option value="all" ${filter.payment === "all" ? "selected" : ""}>Todos</option>
          <option value="paid" ${filter.payment === "paid" ? "selected" : ""}>Pagos</option>
          <option value="partial" ${filter.payment === "partial" ? "selected" : ""}>Parciais</option>
          <option value="pending" ${filter.payment === "pending" ? "selected" : ""}>Pendentes</option>
        </select>
      </label>
      <label>Entrega
        <select name="delivery">
          <option value="all" ${filter.delivery === "all" ? "selected" : ""}>Todas</option>
          <option value="delivered" ${filter.delivery === "delivered" ? "selected" : ""}>Entregues</option>
          <option value="pending" ${filter.delivery === "pending" ? "selected" : ""}>Pendentes</option>
        </select>
      </label>
      <button type="submit">Filtrar</button>
      <button class="secondary" type="button" id="clear-order-filters">Limpar</button>
    </form>
  `;
}

function orderCardsHtml(orders, plan) {
  return `
    <div class="order-card-grid">
      ${orders.map(order => {
        const client = clientByPhone(order.clientPhone);
        const address = [client.address, client.complement].filter(Boolean).join(" - ");
        const total = Number(order.amount || 0) + Number(order.deliveryFee || 0);
        return `
          <article class="order-card ${order.delivered ? "is-delivered" : ""}">
            <div class="order-card-head">
              <div>
                <strong>${client.name || "Cliente removido"}</strong>
                <span>${client.phone || order.clientPhone || "Sem telefone"}</span>
              </div>
              <div class="order-card-badges">
                ${paymentBadge(order, client)}
                ${deliveryBadge(order)}
              </div>
            </div>
            <div class="order-card-body">
              <p>${orderDishesText(order, plan) || "Pedido sem itens"}</p>
              <div class="mini-metrics">
                <span><b>${orderQuantity(order)}</b><small>Cumbucas</small></span>
                <span><b>${total > 0 ? money(total) : "-"}</b><small>Total</small></span>
                <span><b>${client.plan === "mensalista" ? "Mensal" : "Semanal"}</b><small>Perfil</small></span>
              </div>
              ${address ? `<small class="muted-inline">${address}</small>` : ""}
              ${order.notes ? `<small class="muted-inline">${order.notes}</small>` : ""}
            </div>
            <div class="order-card-actions">
              <button class="secondary table-action" type="button" data-edit-order="${order.id}">Editar</button>
              ${client.plan === "semanal" ? `<button class="secondary table-action" type="button" data-toggle-paid-order="${order.id}">${isOrderPaid(order) ? "Pendente" : "Pago"}</button>` : ""}
              ${client.plan === "semanal" ? `<button class="secondary table-action" type="button" data-partial-paid-order="${order.id}">Parcial</button>` : ""}
              <button class="secondary table-action" type="button" data-toggle-delivered-order="${order.id}">${order.delivered ? "Desfazer" : "Entregue"}</button>
              <a class="secondary table-action" href="${orderWhatsAppUrl(order, plan)}" target="_blank" rel="noopener">WhatsApp</a>
              <button class="danger table-action" type="button" data-delete-order="${order.id}">Excluir</button>
            </div>
          </article>
        `;
      }).join("")}
    </div>
  `;
}

function orderList(plan, currentKey) {
  const filter = state.orderFilter || { search: "", payment: "all", delivery: "all" };
  const query = String(filter.search || state.orderSearch || "").trim().toLowerCase();
  const orders = weeklyOrders(currentKey).filter(order => {
    const client = clientByPhone(order.clientPhone);
    if (filter.payment === "paid" && !isOrderPaid(order)) {
      return false;
    }
    if (filter.payment === "partial" && !(Number(order.paidAmount || 0) > 0 && !isOrderPaid(order))) {
      return false;
    }
    if (filter.payment === "pending" && (isOrderPaid(order) || client.plan === "mensalista")) {
      return false;
    }
    if (filter.delivery === "delivered" && !order.delivered) {
      return false;
    }
    if (filter.delivery === "pending" && order.delivered) {
      return false;
    }
    if (!query) {
      return true;
    }
    return [
      client.name,
      client.phone || order.clientPhone,
      client.address,
      orderDishesText(order, plan),
      paymentText(order, client),
      order.notes
    ].some(value => String(value || "").toLowerCase().includes(query));
  });

  if (!orders.length) {
    return `
      ${orderFilterHtml(filter)}
      <p class="muted">Nenhum pedido encontrado nesta semana.</p>
    `;
  }

  return `
    ${orderFilterHtml(filter)}
    ${orderCardsHtml(orders, plan)}
    <details class="details-block order-detail-table">
      <summary>Tabela detalhada</summary>
      <div class="table-wrap order-table">
      <table>
        <thead><tr><th>Cliente</th><th>Contato</th><th>Endereço</th><th>Pedido</th><th>Total</th><th>Valor em real</th><th>Valor em frete</th><th>Pagamento</th><th>Entrega</th><th>Obs.</th><th></th></tr></thead>
        <tbody>
          ${orders.map(order => {
            const client = clientByPhone(order.clientPhone);
            return `
              <tr>
                <td>${client.name || "Cliente removido"}</td>
                <td>${client.phone || order.clientPhone || ""}</td>
                <td>${[client.address, client.complement].filter(Boolean).join(" - ")}</td>
                <td>${orderDishesText(order, plan)}</td>
                <td>${orderQuantity(order)}</td>
                <td>${Number(order.amount || 0) > 0 ? money(order.amount) : ""}</td>
                <td>${Number(order.deliveryFee || 0) > 0 ? money(order.deliveryFee) : ""}</td>
                <td>${paymentBadge(order, client)}</td>
                <td>${deliveryBadge(order)}</td>
                <td>${order.notes || ""}</td>
                <td>
                  <div class="table-actions">
                    <button class="secondary table-action" type="button" data-edit-order="${order.id}">Editar</button>
                    ${client.plan === "semanal" ? `<button class="secondary table-action" type="button" data-toggle-paid-order="${order.id}">${isOrderPaid(order) ? "Marcar pendente" : "Marcar pago"}</button>` : ""}
                    ${client.plan === "semanal" ? `<button class="secondary table-action" type="button" data-partial-paid-order="${order.id}">Parcial</button>` : ""}
                    <button class="secondary table-action" type="button" data-toggle-delivered-order="${order.id}">${order.delivered ? "Desfazer entrega" : "Entregue"}</button>
                    <a class="secondary table-action" href="${orderWhatsAppUrl(order, plan)}" target="_blank" rel="noopener">WhatsApp</a>
                    <button class="danger table-action" type="button" data-delete-order="${order.id}">Excluir</button>
                  </div>
                </td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
      </div>
    </details>
  `;
}

function paymentText(order, client) {
  if (client.plan === "mensalista") {
    return "Mensalista";
  }

  if (isOrderPaid(order)) {
    return "Pago";
  }
  if (Number(order.paidAmount || 0) > 0) {
    return `Parcial ${money(order.paidAmount)}`;
  }
  return "Aguardando pagamento";
}

function orderOverviewPanel(plan, currentKey) {
  const orders = weeklyOrders(currentKey);

  if (!orders.length) {
    return `<p class="muted">Nenhum pedido registrado nesta semana.</p>`;
  }

  return `
    <section class="order-overview-panel">
      <h2>Resumo dos pedidos</h2>
      <div class="table-wrap order-overview-table">
        <table>
          <thead>
            <tr>
              <th>Cliente</th>
              ${plan.map(item => `<th>${item.dish || `Cumbuca ${item.slot}`}</th>`).join("")}
              <th>Total</th>
              <th>Valor em real</th>
              <th>Valor em frete</th>
              <th>Endereço</th>
              <th>Pagamento</th>
              <th>Entrega</th>
              <th>Tipo</th>
            </tr>
          </thead>
          <tbody>
            ${orders.map(order => {
              const client = clientByPhone(order.clientPhone);
              return `
                <tr class="${client.plan === "mensalista" ? "monthly-client-row" : ""}">
                  <td>${client.name || "Cliente removido"}</td>
                  ${plan.map(item => `<td class="quantity-cell">${orderDishQuantity(order, item.slot) || ""}</td>`).join("")}
                  <td class="quantity-cell total-cell">${orderQuantity(order)}</td>
                  <td>${Number(order.amount || 0) > 0 ? money(order.amount) : ""}</td>
                  <td>${Number(order.deliveryFee || 0) > 0 ? money(order.deliveryFee) : ""}</td>
                  <td>${[client.address, client.complement].filter(Boolean).join(" - ")}</td>
                  <td>${paymentText(order, client)}</td>
                  <td>${order.delivered ? "Entregue" : "Pendente"}</td>
                  <td>${client.plan === "mensalista" ? "Mensalista" : "Semanal"}</td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function orderPanel(plan, currentKey) {
  const editing = state.editOrderId
    ? state.orders.find(order => Number(order.id) === Number(state.editOrderId))
    : null;
  const availableClients = activeClients();

  return `
    <section class="client-panel">
      <div class="client-panel-header">
        <h2>${editing ? "Editar pedido" : "Pedidos"}</h2>
        <button class="secondary" type="button" id="order-back">Voltar</button>
      </div>
      ${orderSummary(plan, currentKey)}
      ${orderTabs()}
      <div class="order-tab-panel">
        ${orderTabContent(plan, currentKey, editing, availableClients)}
      </div>
    </section>
  `;
}

async function renderPricing() {
  title.textContent = "Precificação";
  setActive("precificacao");
  const savedConfig = state.pricingConfig;
  const result = await postJson("/api/precificacao", {
    ...savedConfig,
    ingredients: state.ingredients
  });

  app.innerHTML = `
    <div class="tool-grid">
      <section class="panel">
        <h2>Ingredientes</h2>
        <form id="ingredient-form" class="form-grid">
          <label>Item
            <input name="name" placeholder="Arroz, frango, embalagem" required>
          </label>
          <label>Quantidade
            <input name="quantity" type="number" min="0" step="0.001" required>
          </label>
          <label>Custo unitário
            <input name="unitCost" type="text" inputmode="decimal" required>
          </label>
          <div class="actions">
            <button type="submit">Adicionar</button>
          </div>
        </form>
        ${ingredientList()}
      </section>
      <section class="panel">
        <h2>Cálculo</h2>
        <form id="pricing-form" class="form-grid">
          <label>Embalagem
            <input name="packaging" type="text" inputmode="decimal" value="${moneyInputValue(savedConfig.packaging)}">
          </label>
          <label>Mão de obra
            <input name="labor" type="text" inputmode="decimal" value="${moneyInputValue(savedConfig.labor)}">
          </label>
          <label>Custos fixos rateados
            <input name="overhead" type="text" inputmode="decimal" value="${moneyInputValue(savedConfig.overhead)}">
          </label>
          <label>Perdas %
            <input name="lossPercent" type="number" min="0" step="0.01" value="${savedConfig.lossPercent || ""}">
          </label>
          <label>Taxas %
            <input name="feePercent" type="number" min="0" step="0.01" value="${savedConfig.feePercent || ""}">
          </label>
          <label>Margem %
            <input name="marginPercent" type="number" min="0" step="0.01" value="${savedConfig.marginPercent || ""}">
          </label>
          <div class="actions">
            <button type="submit">Atualizar</button>
            <button class="secondary" type="button" id="clear-pricing">Limpar</button>
          </div>
        </form>
        <div class="summary">
          <div class="metric"><span>Custo total</span><strong>${money(result.totalCost)}</strong></div>
          <div class="metric"><span>Preço sugerido</span><strong>${money(result.suggestedPrice)}</strong></div>
          <div class="metric"><span>Lucro previsto</span><strong>${money(result.profit)}</strong></div>
        </div>
      </section>
      ${technicalSheetPanel(savedConfig)}
    </div>
  `;

  on("#ingredient-form", "submit", event => {
    event.preventDefault();
    const values = readForm(event.currentTarget);
    state.ingredients.push({
      ...values,
      unitCost: parseMoneyInput(values.unitCost).toFixed(2)
    });
    persistState();
    renderPricing();
  });

  on("#pricing-form", "submit", event => {
    event.preventDefault();
    const values = readForm(event.currentTarget);
    state.pricingConfig = {
      ...values,
      packaging: parseMoneyInput(values.packaging).toFixed(2),
      labor: parseMoneyInput(values.labor).toFixed(2),
      overhead: parseMoneyInput(values.overhead).toFixed(2)
    };
    persistState();
    renderPricing();
  });

  on("#clear-pricing", "click", () => {
    state.ingredients = [];
    state.pricingConfig = {};
    persistState();
    renderPricing();
  });
}

function recipePricing(item, config = {}) {
  const ingredientCost = Number(item.cost || 0) || planningIngredientTotal(item.ingredients || []);
  const packaging = Number(config.packaging || 0);
  const labor = Number(config.labor || 0);
  const overhead = Number(config.overhead || 0);
  const lossPercent = Math.max(0, Number(config.lossPercent || 0));
  const feePercent = Math.max(0, Number(config.feePercent || 0));
  const marginPercent = Math.max(0, Number(config.marginPercent || 0));
  const baseCost = ingredientCost + packaging + labor + overhead;
  const totalCost = baseCost + baseCost * (lossPercent / 100);
  const divisor = 1 - (feePercent + marginPercent) / 100;
  const suggestedPrice = divisor > 0 ? totalCost / divisor : 0;
  const profit = suggestedPrice - totalCost - suggestedPrice * (feePercent / 100);
  return { ingredientCost, totalCost, suggestedPrice, profit };
}

function technicalSheetRows(config = state.pricingConfig) {
  return Object.entries(state.menus || {})
    .flatMap(([key, items]) => (items || []).map(item => ({ key, item })))
    .filter(({ item }) => String(item.dish || "").trim())
    .map(({ key, item }) => ({
      key,
      slot: item.slot,
      dish: item.dish,
      status: item.status || "planejado",
      ingredients: item.ingredients || [],
      ...recipePricing(item, config)
    }))
    .sort((a, b) => String(b.key).localeCompare(String(a.key)) || Number(a.slot || 0) - Number(b.slot || 0));
}

function technicalSheetPanel(config = state.pricingConfig) {
  const rows = technicalSheetRows(config).slice(0, 12);
  return `
    <section class="panel report-section technical-sheet-panel">
      <h2>Ficha técnica por cumbuca</h2>
      ${rows.length ? `
        <div class="table-wrap report-table">
          <table>
            <thead><tr><th>Semana</th><th>Cumbuca</th><th>Ingredientes</th><th>Custo</th><th>Preço sugerido</th><th>Lucro</th></tr></thead>
            <tbody>
              ${rows.map(row => `
                <tr>
                  <td>${row.key}</td>
                  <td>${escapeHtml(row.dish)}<br><small>Cumbuca ${row.slot} - ${row.status}</small></td>
                  <td>${row.ingredients.length ? row.ingredients.map(item => `${escapeHtml(item.name || "")}: ${money(item.value)}`).join("<br>") : "Sem ingredientes"}</td>
                  <td>${money(row.totalCost)}</td>
                  <td>${money(row.suggestedPrice)}</td>
                  <td class="${row.profit < 0 ? "negative" : "positive"}">${money(row.profit)}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      ` : `<p class="muted">Cadastre ingredientes no planejamento do Menu Semanal para gerar a ficha técnica.</p>`}
    </section>
  `;
}

function ingredientList() {
  if (!state.ingredients.length) {
    return `<p class="muted">Adicione ingredientes para calcular o custo.</p>`;
  }

  return `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Item</th><th>Qtd.</th><th>Unit.</th><th>Total</th></tr></thead>
        <tbody>
          ${state.ingredients.map(item => `
            <tr>
              <td>${item.name}</td>
              <td>${item.quantity}</td>
              <td>${money(item.unitCost)}</td>
              <td>${money(Number(item.quantity || 0) * Number(item.unitCost || 0))}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function reportCashEntries(periodKey, weekKey) {
  const type = state.reportPeriod.type || "month";
  const entries = accountingCashEntries(state.cash);
  if (type === "day") {
    return entries.filter(entry => cashAccountingDate(entry) === reportDate());
  }
  if (type !== "week") {
    return entries.filter(entry => cashAccountingDate(entry).startsWith(periodKey));
  }

  const { start, end } = reportWeekRange();

  return entries.filter(entry => {
    const date = cashAccountingDate(entry);
    return date >= start && date <= end;
  });
}

function reportStoreSales(periodKey) {
  const type = state.reportPeriod.type || "month";
  if (type === "day") {
    return state.storeSales.filter(entry => String(entry.date || "") === reportDate());
  }
  if (type !== "week") {
    return state.storeSales.filter(entry => String(entry.date || "").startsWith(periodKey));
  }

  const { start, end } = reportWeekRange();
  return state.storeSales.filter(entry => {
    const date = String(entry.date || "");
    return date >= start && date <= end;
  });
}

function reportChannelReceipts(periodKey) {
  const type = state.reportPeriod.type || "month";
  if (type === "day") {
    return state.channelReceipts.filter(entry => String(entry.date || "") === reportDate());
  }
  if (type !== "week") {
    return state.channelReceipts.filter(entry => String(entry.date || "").startsWith(periodKey));
  }

  const { start, end } = reportWeekRange();
  return state.channelReceipts.filter(entry => {
    const date = String(entry.date || "");
    return date >= start && date <= end;
  });
}

function reportData() {
  const type = state.reportPeriod.type || "month";
  const periodKey = reportPeriodKey();
  const selectedWeek = Number(state.reportPeriod.week || 1);
  const weekKey = reportWeekKey();
  const cashEntries = reportCashEntries(periodKey, weekKey);
  const storeSales = reportStoreSales(periodKey);
  const channelReceipts = reportChannelReceipts(periodKey);
  const orders = type === "day"
    ? state.orders.filter(order => String(order.createdAt || "").startsWith(reportDate()))
    : type === "week"
    ? state.orders.filter(order => order.menuKey === weekKey)
    : state.orders.filter(order => menuPeriodKeyFromKey(order.menuKey) === periodKey);
  const weeks = type === "week" ? [selectedWeek] : type === "day" ? [] : [1, 2, 3, 4, 5];
  const menuWeeks = weeks.map(week => {
    const key = `${periodKey}-semana-${week}`;
    const dishes = state.menus[key] || [];
    const weekOrders = state.orders.filter(order => order.menuKey === key);

    return {
      week,
      key,
      dishes,
      orders: weekOrders,
      menuCost: dishes.reduce((sum, item) => sum + Number(item.cost || 0), 0),
      orderAmount: weekOrders.reduce((sum, order) => sum + Number(order.amount || 0), 0),
      deliveryFee: weekOrders.reduce((sum, order) => sum + Number(order.deliveryFee || 0), 0),
      quantity: weekOrders.reduce((sum, order) => sum + orderQuantity(order), 0)
    };
  });
  const income = cashEntries
    .filter(entry => entry.type !== "expense")
    .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const expenses = cashEntries
    .filter(entry => entry.type === "expense")
    .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const incomeEntries = cashEntries.filter(entry => entry.type !== "expense");
  const expenseEntries = cashEntries.filter(entry => entry.type === "expense");
  const financial = financialSummary(cashEntries);
  const partnerWithdrawalControl = partnerPeriodTotals(withdrawalHistoryGroups(cashEntries));
  const orderRevenue = orders.reduce((sum, order) => sum + Number(order.amount || 0), 0);
  const deliveryRevenue = orders.reduce((sum, order) => sum + Number(order.deliveryFee || 0), 0);
  const totalQuantity = orders.reduce((sum, order) => sum + orderQuantity(order), 0);
  const storeQuantity = storeSales.reduce((sum, entry) => sum + Number(entry.quantity || 0), 0);
  const weeklyCashQuantity = totalQuantity;
  const totalIncome = income;
  const paidOrders = orders.filter(order => {
    const client = clientByPhone(order.clientPhone);
    return client.plan === "mensalista" || isOrderPaid(order);
  }).length;

  return {
    type,
    periodKey,
    weekKey,
    date: reportDate(),
    selectedWeek,
    cashEntries,
    storeSales,
    channelReceipts,
    incomeEntries,
    expenseEntries,
    orders,
    menuWeeks,
    income,
    expenses,
    financial,
    partnerWithdrawalControl,
    savingsBalance: savingsBalance(),
    savingsUpdatedAt: state.financialPlanning?.savingsUpdatedAt || "",
    partnersRecord: partnersRecordForPeriod(periodKey),
    totalIncome,
    balance: totalIncome - expenses,
    orderRevenue,
    deliveryRevenue,
    totalQuantity,
    weeklyCashQuantity,
    storeQuantity,
    totalSoldQuantity: weeklyCashQuantity + storeQuantity,
    averageTicket: orders.length ? orderRevenue / orders.length : 0,
    paidOrders,
    pendingOrders: orders.length - paidOrders,
    menuCost: menuWeeks.reduce((sum, item) => sum + item.menuCost, 0),
    topExpenses: [...expenseEntries]
      .sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0))
      .slice(0, 6),
    weeklyClients: state.clients.filter(client => client.plan !== "mensalista").length,
    monthlyClients: state.clients.filter(client => client.plan === "mensalista").length
  };
}

function sumRowsByLabel(rows, labelFor, amountFor) {
  const totals = rows.reduce((acc, row) => {
    const label = labelFor(row);
    acc[label] = (acc[label] || 0) + Number(amountFor(row) || 0);
    return acc;
  }, {});

  return Object.entries(totals)
    .filter(([, value]) => value > 0)
    .sort(([a], [b]) => a.localeCompare(b, "pt-BR"))
    .map(([label, value]) => [label, money(value)]);
}

function accountIncomeBreakdown(data) {
  return sumRowsByLabel(
    data.incomeEntries,
    entry => categoryName(entry.category),
    entry => entry.amount
  );
}

function weeklyRevenueBreakdown(data) {
  const rows = [
    ["Pedidos semanais pagos", data.orders
      .filter(order => {
        const client = clientByPhone(order.clientPhone);
        return client.plan === "semanal" && isOrderPaid(order);
      })
      .reduce((sum, order) => sum + Number(order.amount || 0), 0)],
    ["Pedidos semanais pendentes", data.orders
      .filter(order => {
        const client = clientByPhone(order.clientPhone);
        return client.plan === "semanal" && !isOrderPaid(order);
      })
      .reduce((sum, order) => sum + Number(order.amount || 0), 0)],
    ["Mensalistas", data.orders
      .filter(order => clientByPhone(order.clientPhone).plan === "mensalista")
      .reduce((sum, order) => sum + Number(order.amount || 0), 0)],
    ["Frete", data.deliveryRevenue]
  ];

  return rows
    .filter(([, value]) => Number(value || 0) > 0)
    .map(([label, value]) => [label, money(value)]);
}

function previousMonthKeyFromPeriod(periodKey) {
  const [year, month] = String(periodKey || currentMonthKey()).split("-").map(Number);
  const date = new Date(year || new Date().getFullYear(), (month || 1) - 2, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function moneyRowsByCategory(entries, type) {
  const rows = entries
    .filter(entry => type === "income" ? entry.type !== "expense" : entry.type === "expense")
    .reduce((acc, entry) => {
      const label = categoryName(entry.category);
      acc[label] = (acc[label] || 0) + Number(entry.amount || 0);
      return acc;
    }, {});

  return Object.entries(rows)
    .sort((a, b) => b[1] - a[1])
    .map(([label, value]) => [label, value]);
}

function reportPdfIncomeChannelRows(data) {
  const cashRows = accountIncomeBreakdown(data).map(([label, value]) => ["Caixa", label, value]);
  const weeklyRows = weeklyRevenueBreakdown(data).map(([label, value]) => ["Semanal", label, value]);
  const cardapioRows = cardapioPaymentDefinitions
    .map(([paymentKey, label]) => [
      "Cardápio Web",
      label,
      data.channelReceipts.reduce((sum, entry) => sum + cardapioPaymentAmount(entry, paymentKey), 0)
    ])
    .filter(([, , value]) => value > 0)
    .map(([group, label, value]) => [group, label, money(value)]);
  const marketplaceRows = channelDefinitions
    .filter(([key]) => key !== "cardapioWeb")
    .map(([key, label]) => [
      "Canal",
      label,
      data.channelReceipts.reduce((sum, entry) => sum + channelReceiptAmount(entry, key, "net"), 0)
    ])
    .filter(([, , value]) => value > 0)
    .map(([group, label, value]) => [group, label, money(value)]);

  return [...cashRows, ...weeklyRows, ...cardapioRows, ...marketplaceRows];
}

function reportPdfExpenseCategoryRows(data) {
  return moneyRowsByCategory(data.expenseEntries, "expense")
    .map(([label, value]) => [label, money(value)]);
}

function reportPdfTopExpenseRows(data) {
  return [...data.expenseEntries]
    .sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0))
    .slice(0, 10)
    .map(entry => [entry.description || categoryName(entry.category), categoryName(entry.category), money(entry.amount)]);
}

function reportPdfNegativeDifferenceRows(data) {
  return comparisonReportRows(data)
    .filter(row => Number(row.delta || 0) < 0)
    .map(row => [
      row.label,
      row.label === "Pedidos" || row.label === "Cumbucas" ? row.current : money(row.current),
      row.label === "Pedidos" || row.label === "Cumbucas" ? row.previous : money(row.previous),
      row.label === "Pedidos" || row.label === "Cumbucas" ? row.delta : `-${money(Math.abs(row.delta))}`
    ]);
}

function reportPdfWithdrawalRows(data) {
  const automaticDifferenceTotal = data.expenseEntries
    .filter(entry => normalizedCategory(entry.category) === "diferenca" || String(entry.description || "").toLowerCase().includes("diferen"))
    .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const partners = data.partnersRecord || {};
  const informedVanessa = Number(partners.vanessa || 0);
  const informedRaquel = Number(partners.raquel || 0);
  const differenceTotal = Number(partners.difference || 0) || automaticDifferenceTotal;
  const rows = [
    ["Cofrinho", money(data.financial.withdrawals.savings)],
    ["Vanessa", money(data.financial.withdrawals.vanessa)],
    ["Raquel", money(data.financial.withdrawals.raquel)],
    ["Diferença Cofrinho", partnerDifferenceLabel(data.partnerWithdrawalControl?.differenceSavings)],
    ["Diferença Vanessa", partnerDifferenceLabel(data.partnerWithdrawalControl?.differenceVanessa)],
  ];

  if (informedVanessa > 0 || informedRaquel > 0) {
    rows.push(["Vanessa informada", money(informedVanessa)]);
    rows.push(["Raquel informada", money(informedRaquel)]);
  }

  if (differenceTotal > 0) {
    rows.push([partners.difference ? "Diferença / antecipado informada" : "Diferença / antecipado", money(differenceTotal)]);
  }

  return rows;
}

function compactMoneyList(rows, emptyText) {
  if (!rows.length) {
    return `<p class="muted">${emptyText}</p>`;
  }

  return `
    <div class="recent-list compact-money-list">
      ${rows.map(([label, value]) => `<span><b>${money(value)}</b>${escapeHtml(label)}</span>`).join("")}
    </div>
  `;
}

function clientHistoryPanel(phone, currentKey) {
  const client = clientByPhone(phone);
  const orders = state.orders
    .filter(order => order.clientPhone === phone)
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  const totalQuantity = orders.reduce((sum, order) => sum + orderQuantity(order), 0);
  const pending = orders.filter(order => client.plan === "semanal" && !isOrderPaid(order));
  return `
    <section class="panel report-section client-history-panel">
      <div class="section-heading">
        <div>
          <h2>Histórico de ${escapeHtml(client.name || phone)}</h2>
          <p class="muted-inline">${orders.length} pedido(s), ${totalQuantity} cumbuca(s), ${pending.length} pagamento(s) pendente(s).</p>
        </div>
        <button class="secondary" type="button" id="close-client-history">Fechar</button>
      </div>
      ${orders.length ? `
        <div class="table-wrap report-table">
          <table>
            <thead><tr><th>Semana</th><th>Quantidade</th><th>Valor</th><th>Pagamento</th><th>Entrega</th><th>Obs.</th></tr></thead>
            <tbody>
              ${orders.slice(0, 20).map(order => `
                <tr>
                  <td>${order.menuKey || ""}</td>
                  <td>${orderQuantity(order)}</td>
                  <td>${Number(order.amount || 0) > 0 ? money(order.amount) : ""}</td>
                  <td>${paymentText(order, client)}</td>
                  <td>${order.delivered ? "Entregue" : "Pendente"}</td>
                  <td>${escapeHtml(order.notes || "")}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      ` : `<p class="muted">Nenhum pedido registrado para este cliente.</p>`}
    </section>
  `;
}

function channelPeriodSummary(entries = []) {
  const totals = channelReceiptTotals(entries);
  const activeDays = new Set(entries.map(entry => entry.date).filter(Boolean)).size || 1;
  return {
    entries,
    totals,
    activeDays,
    averageNet: totals.total / activeDays
  };
}

function channelPaymentTotals(entries = []) {
  return cardapioPaymentDefinitions.reduce((totals, [paymentKey]) => {
    totals[paymentKey] = entries.reduce((sum, entry) => sum + cardapioPaymentAmount(entry, paymentKey), 0);
    return totals;
  }, {});
}

function previousChannelEntries(data) {
  if (data.type === "week") {
    const start = new Date(`${reportWeekRange().start}T00:00:00`);
    const end = new Date(`${reportWeekRange().end}T00:00:00`);
    const days = Math.max(1, Math.round((end - start) / 86400000) + 1);
    start.setDate(start.getDate() - days);
    end.setDate(end.getDate() - days);
    const startKey = isoDate(start);
    const endKey = isoDate(end);
    return state.channelReceipts.filter(entry => {
      const date = String(entry.date || "");
      return date >= startKey && date <= endKey;
    });
  }

  const previousKey = previousMonthKeyFromPeriod(data.periodKey);
  return state.channelReceipts.filter(entry => String(entry.date || "").startsWith(previousKey));
}

function channelReportPanel(data) {
  const current = channelPeriodSummary(data.channelReceipts);
  const previous = channelPeriodSummary(previousChannelEntries(data));
  const delta = current.totals.total - previous.totals.total;
  const paymentTotals = channelPaymentTotals(data.channelReceipts);
  const dailyRows = [...data.channelReceipts]
    .sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")))
    .map(entry => [
      formatIsoDateBr(entry.date),
      ...cardapioPaymentDefinitions.map(([paymentKey]) => money(cardapioPaymentAmount(entry, paymentKey))),
      money(channelReceiptAmount(entry, "ifood", "net")),
      money(channelReceiptAmount(entry, "food99", "net")),
      money(channelReceiptTotal(entry))
    ]);

  return `
    <section class="panel report-section">
      <h2>Relatório de canais ${reportTitleSuffix(data)}</h2>
      <div class="summary">
        <div class="metric"><span>Total informado</span><strong>${money(current.totals.total)}</strong></div>
        <div class="metric"><span>Dias lançados</span><strong>${data.channelReceipts.length}</strong></div>
        <div class="metric"><span>Média diária</span><strong>${money(current.averageNet)}</strong></div>
        <div class="metric"><span>Comparação anterior</span><strong class="${delta < 0 ? "negative" : "positive"}">${delta < 0 ? "-" : "+"}${money(Math.abs(delta))}</strong></div>
      </div>
      <div class="dashboard-lane monthly-breakdown">
        <div class="panel dashboard-panel">
          <h2>Cardápio Web</h2>
          <div class="summary">
            ${cardapioPaymentDefinitions.map(([paymentKey, label]) => `
              <div class="metric"><span>${label}</span><strong>${money(paymentTotals[paymentKey])}</strong></div>
            `).join("")}
          </div>
        </div>
        ${channelDefinitions.filter(([key]) => key !== "cardapioWeb").map(([key, label]) => `
          <div class="panel dashboard-panel">
            <h2>${label}</h2>
            <div class="summary">
              <div class="metric"><span>Valor diário</span><strong>${money(current.totals[`${key}Net`])}</strong></div>
            </div>
          </div>
        `).join("")}
      </div>
      ${dailyRows.length ? `
        <div class="table-wrap">
          <table>
            <thead><tr><th>Dia</th>${cardapioPaymentDefinitions.map(([, label]) => `<th>${label}</th>`).join("")}<th>iFood</th><th>99 Food</th><th>Total</th></tr></thead>
            <tbody>${dailyRows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join("")}</tr>`).join("")}</tbody>
          </table>
        </div>
      ` : `<p class="muted">Nenhum valor de canal lançado no período.</p>`}
    </section>
  `;
}

function monthlyOriginCategoryPanel(data) {
  const incomeRows = moneyRowsByCategory(data.cashEntries, "income");
  const expenseRows = moneyRowsByCategory(data.cashEntries, "expense");
  const channelRows = channelDefinitions
    .map(([key, label]) => [
      label,
      data.channelReceipts.reduce((sum, entry) => sum + channelReceiptAmount(entry, key, "net"), 0)
    ])
    .filter(([, value]) => value > 0);
  const topExpenses = [...data.expenseEntries]
    .sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0))
    .slice(0, 5)
    .map(entry => [entry.description || categoryName(entry.category), Number(entry.amount || 0)]);
  const previousKey = previousMonthKeyFromPeriod(data.periodKey);
  const previousCash = accountingCashEntries(state.cash).filter(entry => cashAccountingDate(entry).startsWith(previousKey));
  const previousTotals = cashTotals(previousCash);
  const incomeDelta = data.income - previousTotals.income;
  const expenseDelta = data.expenses - previousTotals.expenses;
  const balanceDelta = data.balance - previousTotals.balance;

  return `
    <section class="dashboard-lane monthly-breakdown">
      <div class="panel dashboard-panel">
        <h2>Entradas por origem</h2>
        ${compactMoneyList(incomeRows, "Nenhuma entrada no período.")}
      </div>
      <div class="panel dashboard-panel">
        <h2>Canais de venda</h2>
        ${compactMoneyList(channelRows, "Nenhum valor de canal lançado no período.")}
      </div>
    </section>
    <section class="dashboard-lane monthly-breakdown">
      <div class="panel dashboard-panel">
        <h2>Saídas por categoria</h2>
        ${compactMoneyList(expenseRows, "Nenhuma saída no período.")}
      </div>
      <div class="panel dashboard-panel">
        <h2>Maiores despesas</h2>
        ${compactMoneyList(topExpenses, "Nenhuma despesa no período.")}
      </div>
    </section>
    <section class="dashboard-lane monthly-breakdown">
      <div class="panel dashboard-panel">
        <h2>Comparação com ${formatMonthKeyBr(previousKey)}</h2>
        <div class="summary comparison-summary">
          <div class="metric"><span>Entradas</span><strong class="comparison-value ${incomeDelta < 0 ? "negative" : "positive"}"><i>${incomeDelta < 0 ? "-" : "+"}</i>${money(Math.abs(incomeDelta))}</strong></div>
          <div class="metric"><span>Saídas</span><strong class="comparison-value ${expenseDelta > 0 ? "negative" : "positive"}"><i>${expenseDelta < 0 ? "-" : "+"}</i>${money(Math.abs(expenseDelta))}</strong></div>
          <div class="metric"><span>Saldo</span><strong class="comparison-value ${balanceDelta < 0 ? "negative" : "positive"}"><i>${balanceDelta < 0 ? "-" : "+"}</i>${money(Math.abs(balanceDelta))}</strong></div>
        </div>
      </div>
    </section>
  `;
}

function csvValue(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function toCsv(rows) {
  if (!rows.length) {
    return "";
  }

  const headers = Object.keys(rows[0]);
  return [
    headers.map(csvValue).join(","),
    ...rows.map(row => headers.map(header => csvValue(row[header])).join(","))
  ].join("\n");
}

function downloadTextFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function reportCsvRows(kind, data) {
  if (kind === "cash") {
    return data.cashEntries.map(entry => ({
      data: entry.date || "",
      descrição: entry.description || "",
      tipo: entry.type === "expense" ? "saída" : "entrada",
      categoria: categoryName(entry.category),
      valor: Number(entry.amount || 0)
    }));
  }

  if (kind === "financial") {
    const rows = [
      { seção: "resumo", data: "", descrição: "Entradas no caixa", tipo: "entrada", categoria: "", valor: data.financial.income },
      { seção: "resumo", data: "", descrição: "Saídas operacionais", tipo: "saída", categoria: "operacional", valor: data.financial.operationalExpenses },
      { seção: "resumo", data: "", descrição: "Lucro antes das retiradas", tipo: "saldo", categoria: "", valor: data.financial.profitBeforeWithdrawals },
      { seção: "resumo", data: "", descrição: "Retiradas já feitas", tipo: "saída", categoria: "retirada", valor: data.financial.withdrawals.total },
      { seção: "resumo", data: "", descrição: "Disponível para retirada", tipo: "saldo", categoria: "", valor: data.financial.availableForWithdrawal },
      { seção: "resumo", data: data.savingsUpdatedAt || "", descrição: "Valor atual do cofrinho", tipo: "saldo", categoria: "cofrinho", valor: data.savingsBalance },
      { seção: "produção", data: "", descrição: "Cumbucas vendidas na loja", tipo: "quantidade", categoria: "loja", valor: data.storeQuantity },
      { seção: "produção", data: "", descrição: "Total de cumbucas vendidas", tipo: "quantidade", categoria: "total", valor: data.totalSoldQuantity },
      { seção: "retiradas", data: "", descrição: "Cofrinho", tipo: "saída", categoria: "retirada", valor: data.financial.withdrawals.savings },
      { seção: "retiradas", data: "", descrição: "Vanessa", tipo: "saída", categoria: "retirada", valor: data.financial.withdrawals.vanessa },
      { seção: "retiradas", data: "", descrição: "Raquel", tipo: "saída", categoria: "retirada", valor: data.financial.withdrawals.raquel },
      { seção: "sócias", data: "", descrição: "Diferença Cofrinho", tipo: "controle", categoria: "sócias", valor: data.partnerWithdrawalControl?.differenceSavings || 0 },
      { seção: "sócias", data: "", descrição: "Diferença Vanessa", tipo: "controle", categoria: "sócias", valor: data.partnerWithdrawalControl?.differenceVanessa || 0 },
      { seção: "sócias", data: data.partnersRecord?.periodKey || "", descrição: "Vanessa informada", tipo: "controle", categoria: "sócias", valor: data.partnersRecord?.vanessa || 0 },
      { seção: "sócias", data: data.partnersRecord?.periodKey || "", descrição: "Raquel informada", tipo: "controle", categoria: "sócias", valor: data.partnersRecord?.raquel || 0 },
      { seção: "sócias", data: data.partnersRecord?.periodKey || "", descrição: "Diferença / antecipado", tipo: "controle", categoria: "sócias", valor: data.partnersRecord?.difference || 0 }
    ];

    return rows.concat(data.cashEntries.map(entry => ({
      seção: isWithdrawalEntry(entry) ? "lançamento retirada" : "lançamento caixa",
      data: entry.date || "",
      descrição: entry.description || "",
      tipo: entry.type === "expense" ? "saída" : "entrada",
      categoria: categoryName(entry.category),
      valor: Number(entry.amount || 0)
    })));
  }

  if (kind === "orders") {
    return data.orders.map(order => {
      const client = clientByPhone(order.clientPhone);
      return {
        semana: order.menuKey || "",
        cliente: client.name || order.clientPhone || "",
        contato: order.clientPhone || "",
        quantidade: orderQuantity(order),
        valor: Number(order.amount || 0),
        frete: Number(order.deliveryFee || 0),
        pagamento: paymentText(order, client),
        observação: order.notes || ""
      };
    });
  }

  if (kind === "channels") {
    return data.channelReceipts.map(entry => {
      const row = {
        data: entry.date || "",
        observação: entry.notes || "",
        total: channelReceiptTotal(entry)
      };
      channelDefinitions.forEach(([key, label]) => {
        row[`${label} bruto`] = channelReceiptAmount(entry, key, "gross");
        row[`${label} taxa`] = channelReceiptAmount(entry, key, "fee");
        row[`${label} líquido`] = channelReceiptAmount(entry, key, "net");
      });
      return {
        data: entry.date || "",
        observacao: entry.notes || "",
        cardapio_debito: cardapioPaymentAmount(entry, "debit"),
        cardapio_credito: cardapioPaymentAmount(entry, "credit"),
        cardapio_credito_online: cardapioPaymentAmount(entry, "onlineCredit"),
        cardapio_pix: cardapioPaymentAmount(entry, "pix"),
        cardapio_dinheiro: cardapioPaymentAmount(entry, "cash"),
        ifood: channelReceiptAmount(entry, "ifood", "net"),
        food99: channelReceiptAmount(entry, "food99", "net"),
        total: channelReceiptTotal(entry)
      };
    });
  }

  if (kind === "clients") {
    return state.clients.map(client => ({
      nome: client.name || "",
      contato: client.phone || "",
      plano: client.plan === "mensalista" ? "mensalista" : "semanal",
      endereço: [client.address, client.complement].filter(Boolean).join(" - "),
      pacote_mensal: Number(client.monthlyPackage || 0),
      valor_mensal: Number(client.monthlyPrice || 0)
    }));
  }

  return data.menuWeeks.flatMap(week => week.dishes.map(item => ({
    semana: week.week,
    prato: item.dish || "",
    status: item.status || "",
    custo: Number(item.cost || 0),
    ingredientes: (item.ingredients || []).map(ingredient => ingredient.name).filter(Boolean).join("; ")
  })));
}

function pdfRows(headers, rows) {
  if (!rows.length) {
    return `<p class="pdf-empty">Sem dados neste período.</p>`;
  }

  return `
    <table>
      <thead>
        <tr>${headers.map(header => `<th>${escapeHtml(header)}</th>`).join("")}</tr>
      </thead>
      <tbody>
        ${rows.map(row => `
          <tr>${row.map(value => `<td>${escapeHtml(value)}</td>`).join("")}</tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function reportPdfHtml(data) {
  const generatedAt = fullDate.format(new Date());
  const periodLabel = data.type === "week"
    ? reportWeekRangeLabel()
    : formatMonthKeyBr(data.periodKey);
  const unusedLegacySummary = [
    ["Receita de pedidos", money(data.orderRevenue)],
    ["Cumbucas vendidas", data.totalQuantity],
    ["Ticket médio", money(data.averageTicket)],
    ["Frete arrecadado", money(data.deliveryRevenue)],
    ["Entradas no caixa", money(data.income)],
    ["Saídas no caixa", money(data.expenses)],
    ["Saldo do caixa", money(data.balance)],
    ["Pedidos pagos", data.paidOrders],
    ["Pedidos pendentes", data.pendingOrders],
    ["Clientes semanais", data.weeklyClients],
    ["Mensalistas", data.monthlyClients]
  ];
  const summary = [
    ["Total", money(data.balance)],
    ["Entradas", money(data.totalIncome)],
    ["Saídas", money(data.expenses)],
    ["Lucro antes retiradas", money(data.financial.profitBeforeWithdrawals)],
    ["Disponível retirada", money(data.financial.availableForWithdrawal)],
    ["Cofrinho atual", money(data.savingsBalance)],
    ["Cumbucas vendidas", data.totalSoldQuantity],
    ["Semanal", data.weeklyCashQuantity],
    ["Loja", data.storeQuantity],
    ["Receita pedidos", money(data.orderRevenue)],
    ["Entradas caixa", money(data.income)]
  ];
  const orderRows = data.orders.map(order => {
    const client = clientByPhone(order.clientPhone);
    return [
      order.menuKey || "",
      client.name || order.clientPhone || "Cliente removido",
      orderQuantity(order),
      money(order.amount),
      money(order.deliveryFee),
      paymentText(order, client)
    ];
  });
  const cashRows = data.cashEntries.map(entry => [
    entry.date || "",
    entry.description || "",
    entry.type === "expense" ? "Saída" : "Entrada",
    money(entry.amount)
  ]);
  const incomeRows = data.incomeEntries.map(entry => [
    entry.date || "",
    entry.description || "",
    money(entry.amount)
  ]);
  const storeRows = data.storeSales.map(entry => [
    entry.date || "",
    Number(entry.quantity || 0),
    entry.notes || ""
  ]);
  const expenseRows = data.topExpenses.map(entry => [
    entry.date || "",
    entry.description || "",
    money(entry.amount)
  ]);
  return `<!doctype html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8">
        <title>Relatório Financeiro Semanal ${escapeHtml(periodLabel)}</title>
        <style>
          @page { margin: 18mm; }
          * { box-sizing: border-box; }
          body {
            margin: 0;
            color: #121417;
            font-family: Arial, Helvetica, sans-serif;
            font-size: 12px;
            line-height: 1.4;
          }
          header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 24px;
            padding-bottom: 18px;
            border-bottom: 2px solid #573220;
            margin-bottom: 18px;
          }
          h1, h2, p { margin-top: 0; }
          h1 { margin-bottom: 6px; font-size: 28px; line-height: 1; color: #573220; text-transform: uppercase; }
          h2 { margin: 22px 0 10px; font-size: 15px; color: #573220; }
          .meta { color: #69707d; text-align: right; }
          .summary {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 8px;
          }
          .metric {
            min-height: 64px;
            padding: 10px;
            border: 1px solid #e5e7eb;
            border-radius: 6px;
            background: #fafafa;
          }
          .metric span {
            display: block;
            color: #69707d;
            font-size: 9px;
            font-weight: 700;
            text-transform: uppercase;
          }
          .metric strong {
            display: block;
            margin-top: 6px;
            font-size: 15px;
          }
          .metric.total {
            background: #573220;
            color: #ffffff;
            border-color: #573220;
          }
          .metric.total span,
          .metric.total strong {
            color: #ffffff;
          }
          .sold {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 8px;
            margin-top: 8px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            page-break-inside: auto;
          }
          tr { page-break-inside: avoid; page-break-after: auto; }
          th, td {
            padding: 7px 8px;
            border: 1px solid #e5e7eb;
            text-align: left;
            vertical-align: top;
          }
          th {
            background: #f3f4f6;
            color: #374151;
            font-size: 9px;
            text-transform: uppercase;
          }
          .pdf-empty {
            padding: 10px;
            border: 1px dashed #d1d5db;
            color: #69707d;
          }
        </style>
      </head>
      <body>
        <header>
          <div>
            <h1>Relatório Financeiro Semanal</h1>
            <p>${escapeHtml(periodLabel)}</p>
          </div>
          <div class="meta">
            <strong>Gerado em</strong><br>
            ${escapeHtml(generatedAt)}
          </div>
        </header>
        <section class="summary">
          ${summary.map(([label, value], index) => `
            <div class="metric ${index === 0 ? "total" : ""}"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>
          `).join("")}
        </section>
        <h2>Quantidade de cumbucas vendidas</h2>
        <section class="sold">
          <div class="metric"><span>Semanal</span><strong>${escapeHtml(data.weeklyCashQuantity)}</strong></div>
          <div class="metric"><span>Loja</span><strong>${escapeHtml(data.storeQuantity)}</strong></div>
          <div class="metric total"><span>Total</span><strong>${escapeHtml(data.totalSoldQuantity)}</strong></div>
        </section>
        <h2>Resumo de entradas ${escapeHtml(reportTitleSuffix(data))}</h2>
        ${pdfRows(["Grupo", "Origem", "Valor"], [
          ...accountIncomeBreakdown(data).map(([label, value]) => ["Conta", label, value]),
          ...weeklyRevenueBreakdown(data).map(([label, value]) => ["Semanal", label, value]),
          ["Total", "Conta + semanal", money(data.income + data.orderRevenue)]
        ])}
        <h2>Principais saídas (despesas)</h2>
        ${pdfRows(["Data", "Descrição", "Valor"], expenseRows)}
        <h2>Cumbucas vendidas na loja</h2>
        ${pdfRows(["Data", "Quantidade", "Observação"], storeRows)}
      </body>
    </html>`;
}

function oldPrintReportPdfWithPopup() {
  const data = reportData();
  const printWindow = window.open("", "_blank", "noopener,noreferrer");

  if (!printWindow) {
    alert("Permita pop-ups para gerar o PDF do relatório.");
    return;
  }

  printWindow.document.open();
  printWindow.document.write(reportPdfHtml(data));
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

async function downloadReportPdf() {
  const data = reportData();
  const periodLabel = data.type === "week" ? reportWeekRangeLabel() : formatMonthKeyBr(data.periodKey);
  const filename = data.type === "week"
    ? `cumbuca-relatorio-${data.weekKey}.pdf`
    : `cumbuca-relatorio-${data.periodKey}.pdf`;
  const payload = {
    filename,
    periodLabel,
    data: {
      periodKey: data.periodKey,
      balance: data.balance,
      totalIncome: data.totalIncome,
      expenses: data.expenses,
      operationalExpenses: data.financial.operationalExpenses,
      availableForWithdrawal: data.financial.availableForWithdrawal,
      savingsBalance: data.savingsBalance,
      savingsUpdatedAt: data.savingsUpdatedAt,
      withdrawalTotal: data.financial.withdrawals.total,
      withdrawalRows: reportPdfWithdrawalRows(data),
      accountIncome: data.income,
      weeklyRevenue: data.orderRevenue,
      incomeSummaryRows: [
        ...accountIncomeBreakdown(data).map(([label, value]) => ["Conta", label, value]),
        ...weeklyRevenueBreakdown(data).map(([label, value]) => ["Semanal", label, value]),
        ["Total", "Conta + semanal", money(data.income + data.orderRevenue)]
      ],
      incomeChannelRows: reportPdfIncomeChannelRows(data),
      expenseCategoryRows: reportPdfExpenseCategoryRows(data),
      negativeDifferenceRows: reportPdfNegativeDifferenceRows(data),
      totalSoldQuantity: data.totalSoldQuantity,
      weeklyCashQuantity: data.weeklyCashQuantity,
      storeQuantity: data.storeQuantity,
      dishRows: dishRankingRows(data).map((item, index) => [index + 1, item.name, item.quantity]),
      comparisonRows: comparisonReportRows(data).map(row => [
        row.label,
        row.label === "Pedidos" || row.label === "Cumbucas" ? row.current : money(row.current),
        row.label === "Pedidos" || row.label === "Cumbucas" ? row.previous : money(row.previous),
        row.label === "Pedidos" || row.label === "Cumbucas" ? row.delta : money(row.delta)
      ]),
      incomeRows: data.incomeEntries.map(entry => [entry.date || "", entry.description || "", money(entry.amount)]),
      expenseRows: reportPdfTopExpenseRows(data),
      channelRows: data.channelReceipts.map(entry => [
        entry.date || "",
        ...cardapioPaymentDefinitions.map(([paymentKey]) => money(cardapioPaymentAmount(entry, paymentKey))),
        money(channelReceiptAmount(entry, "ifood", "net")),
        money(channelReceiptAmount(entry, "food99", "net")),
        money(channelReceiptTotal(entry))
      ]),
      storeRows: data.storeSales.map(entry => [entry.date || "", Number(entry.quantity || 0), entry.notes || ""]),
      cashRows: data.cashEntries.map(entry => [
        entry.date || "",
        entry.description || "",
        entry.type === "expense" ? "Saída" : "Entrada",
        categoryName(entry.category),
        money(entry.amount)
      ])
    }
  };

  const response = await fetch("/api/report-pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    alert("Não foi possível gerar o PDF agora.");
    return;
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function downloadReportXlsx() {
  const data = reportData();
  const periodLabel = data.type === "week" ? reportWeekRangeLabel() : formatMonthKeyBr(data.periodKey);
  const filename = data.type === "week"
    ? `cumbuca-relatorio-${data.weekKey}.xlsx`
    : `cumbuca-relatorio-${data.periodKey}.xlsx`;
  const payload = {
    filename,
    periodLabel,
    data: {
      periodKey: data.periodKey,
      balance: data.balance,
      totalIncome: data.totalIncome,
      expenses: data.expenses,
      operationalExpenses: data.financial.operationalExpenses,
      availableForWithdrawal: data.financial.availableForWithdrawal,
      savingsBalance: data.savingsBalance,
      savingsUpdatedAt: data.savingsUpdatedAt,
      withdrawalTotal: data.financial.withdrawals.total,
      withdrawalRows: [
        ["Cofrinho", Number(data.financial.withdrawals.savings || 0)],
        ["Vanessa", Number(data.financial.withdrawals.vanessa || 0)],
        ["Raquel", Number(data.financial.withdrawals.raquel || 0)],
        ["Diferença Cofrinho", Number(data.partnerWithdrawalControl?.differenceSavings || 0)],
        ["Diferença Vanessa", Number(data.partnerWithdrawalControl?.differenceVanessa || 0)],
        ["Vanessa informada", Number(data.partnersRecord?.vanessa || 0)],
        ["Raquel informada", Number(data.partnersRecord?.raquel || 0)],
        ["Diferença / antecipado", Number(data.partnersRecord?.difference || 0)]
      ],
      totalSoldQuantity: data.totalSoldQuantity,
      weeklyCashQuantity: data.weeklyCashQuantity,
      storeQuantity: data.storeQuantity,
      dishRows: dishRankingRows(data).map((item, index) => [index + 1, item.name, item.quantity]),
      clientRows: clientReportRows(data).slice(0, 50).map(row => [row.name, row.phone, row.plan, row.orders, row.quantity, Number(row.amount || 0), row.pending]),
      comparisonRows: comparisonReportRows(data).map(row => [row.label, row.current, row.previous, row.delta]),
      incomeRows: data.incomeEntries.map(entry => [entry.date || "", entry.description || "", Number(entry.amount || 0)]),
      expenseRows: data.topExpenses.map(entry => [entry.date || "", entry.description || "", categoryName(entry.category), Number(entry.amount || 0)]),
      channelRows: data.channelReceipts.map(entry => [
        entry.date || "",
        ...cardapioPaymentDefinitions.map(([paymentKey]) => cardapioPaymentAmount(entry, paymentKey)),
        channelReceiptAmount(entry, "ifood", "net"),
        channelReceiptAmount(entry, "food99", "net"),
        channelReceiptTotal(entry)
      ]),
      storeRows: data.storeSales.map(entry => [entry.date || "", Number(entry.quantity || 0), entry.notes || ""]),
      cashRows: data.cashEntries.map(entry => [
        entry.date || "",
        entry.description || "",
        entry.type === "expense" ? "Saída" : "Entrada",
        categoryName(entry.category),
        Number(entry.amount || 0)
      ])
    }
  };

  const response = await fetch("/api/report-xlsx", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    alert("Não foi possível gerar o Excel agora.");
    return;
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function printReportPdf() {
  const data = reportData();
  const frame = document.createElement("iframe");
  frame.title = "Relatório PDF";
  frame.style.position = "fixed";
  frame.style.right = "0";
  frame.style.bottom = "0";
  frame.style.width = "0";
  frame.style.height = "0";
  frame.style.border = "0";
  document.body.appendChild(frame);

  const frameWindow = frame.contentWindow;
  const frameDocument = frame.contentDocument || frameWindow.document;
  frameDocument.open();
  frameDocument.write(reportPdfHtml(data));
  frameDocument.close();

  setTimeout(() => {
    frameWindow.focus();
    frameWindow.print();
    setTimeout(() => frame.remove(), 1000);
  }, 100);
}

function exportReport(kind) {
  if (kind === "pdf") {
    downloadReportPdf();
    return;
  }

  if (kind === "financial-pdf") {
    downloadReportPdf();
    return;
  }

  if (kind === "xlsx") {
    downloadReportXlsx();
    return;
  }

  const data = reportData();
  const baseName = data.type === "day"
    ? `cumbuca-relatorio-${data.date}`
    : data.type === "week"
    ? `cumbuca-relatorio-${data.weekKey}`
    : `cumbuca-relatorio-${data.periodKey}`;

  if (kind === "json") {
    downloadTextFile(`${baseName}.json`, JSON.stringify({
      generatedAt: new Date().toISOString(),
      period: data.periodKey,
      type: data.type,
      week: data.type === "week" ? data.selectedWeek : null,
      summary: {
        income: data.income,
        expenses: data.expenses,
        balance: data.balance,
        totalIncome: data.totalIncome,
        savingsBalance: data.savingsBalance,
        savingsUpdatedAt: data.savingsUpdatedAt,
        weeklyCashQuantity: data.weeklyCashQuantity,
        storeQuantity: data.storeQuantity,
        totalSoldQuantity: data.totalSoldQuantity,
        orderRevenue: data.orderRevenue,
        deliveryRevenue: data.deliveryRevenue,
        totalQuantity: data.totalQuantity,
        averageTicket: data.averageTicket,
        paidOrders: data.paidOrders,
        pendingOrders: data.pendingOrders,
        clients: state.clients.length
      },
      cashEntries: data.cashEntries,
      orders: data.orders,
      clients: state.clients,
      menuWeeks: data.menuWeeks,
      partnersRecord: data.partnersRecord
    }, null, 2), "application/json");
    return;
  }

  downloadTextFile(`${baseName}-${kind}.csv`, toCsv(reportCsvRows(kind, data)), "text/csv;charset=utf-8");
}

function reportOrdersTable(data) {
  if (!data.orders.length) {
    return `<p class="muted">Nenhum pedido neste período.</p>`;
  }

  return `
    <div class="summary">
      <div class="metric report-metric"><span>Receita pedidos</span><strong>${money(data.orderRevenue)}</strong></div>
      <div class="metric report-metric"><span>Frete</span><strong>${money(data.deliveryRevenue)}</strong></div>
      <div class="metric report-metric"><span>Cumbucas semanal</span><strong>${data.weeklyCashQuantity}</strong></div>
      <div class="metric report-metric"><span>Pedidos pagos</span><strong>${data.paidOrders}</strong></div>
      <div class="metric report-metric"><span>Pedidos pendentes</span><strong>${data.pendingOrders}</strong></div>
    </div>
  `;
}

function dishRankingRows(data) {
  const totals = data.orders.reduce((acc, order) => {
    (order.dishes || []).forEach(dish => {
      const key = `${order.menuKey || ""}-${dish.slot}`;
      const name = dishNameForSlot(state.menus[order.menuKey] || [], dish.slot);
      acc[key] = acc[key] || { name: name || `Cumbuca ${dish.slot}`, quantity: 0 };
      acc[key].quantity += Number(dish.quantity || 0);
    });
    return acc;
  }, {});
  return Object.values(totals).sort((a, b) => b.quantity - a.quantity).slice(0, 8);
}

function dishRankingPanel(data) {
  const rows = dishRankingRows(data);
  return `
    <section class="panel report-section">
      <h2>Ranking de cumbucas ${reportTitleSuffix(data)}</h2>
      ${rows.length ? `
        <div class="recent-list">
          ${rows.map((item, index) => `<span><b>${index + 1}. ${item.quantity}</b>${escapeHtml(item.name)}</span>`).join("")}
        </div>
      ` : `<p class="muted">Nenhuma cumbuca vendida no período.</p>`}
    </section>
  `;
}

function clientReportRows(data) {
  const rows = data.orders.reduce((acc, order) => {
    const client = clientByPhone(order.clientPhone);
    const key = client.phone || order.clientPhone || `cliente-${order.id}`;
    acc[key] = acc[key] || {
      name: client.name || order.clientPhone || "Cliente",
      phone: client.phone || order.clientPhone || "",
      plan: client.plan === "mensalista" ? "Mensalista" : "Semanal",
      orders: 0,
      quantity: 0,
      amount: 0,
      pending: 0
    };
    acc[key].orders += 1;
    acc[key].quantity += orderQuantity(order);
    acc[key].amount += Number(order.amount || 0) + Number(order.deliveryFee || 0);
    if (client.plan !== "mensalista" && !isOrderPaid(order)) {
      acc[key].pending += 1;
    }
    return acc;
  }, {});

  return Object.values(rows).sort((a, b) => b.amount - a.amount);
}

function clientReportPanel(data) {
  const rows = clientReportRows(data);
  return `
    <section class="panel report-section">
      <h2>Relatorio de clientes ${reportTitleSuffix(data)}</h2>
      ${rows.length ? `
        <div class="table-wrap report-table">
          <table>
            <thead><tr><th>Cliente</th><th>Perfil</th><th>Pedidos</th><th>Cumbucas</th><th>Total</th><th>Pendências</th></tr></thead>
            <tbody>
              ${rows.slice(0, 20).map(row => `
                <tr>
                  <td>${escapeHtml(row.name)}<br><small>${escapeHtml(row.phone)}</small></td>
                  <td>${row.plan}</td>
                  <td>${row.orders}</td>
                  <td>${row.quantity}</td>
                  <td>${money(row.amount)}</td>
                  <td>${row.pending}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      ` : `<p class="muted">Nenhum pedido de cliente neste período.</p>`}
    </section>
  `;
}

function comparisonReportRows(data) {
  const previousKey = previousMonthKeyFromPeriod(data.periodKey);
  const previousCash = accountingCashEntries(state.cash).filter(entry => cashAccountingDate(entry).startsWith(previousKey));
  const previousOrders = state.orders.filter(order => menuPeriodKeyFromKey(order.menuKey) === previousKey);
  const previousStore = state.storeSales.filter(entry => String(entry.date || "").startsWith(previousKey));
  const previousTotals = cashTotals(previousCash);
  const previousOrderQuantity = previousOrders.reduce((sum, order) => sum + orderQuantity(order), 0);
  const previousStoreQuantity = previousStore.reduce((sum, entry) => sum + Number(entry.quantity || 0), 0);
  return [
    ["Entradas", data.income, previousTotals.income],
    ["Saídas", data.expenses, previousTotals.expenses],
    ["Saldo", data.balance, previousTotals.balance],
    ["Pedidos", data.orders.length, previousOrders.length],
    ["Cumbucas", data.totalSoldQuantity, previousOrderQuantity + previousStoreQuantity]
  ].map(([label, current, previous]) => ({
    label,
    current,
    previous,
    delta: Number(current || 0) - Number(previous || 0)
  }));
}

function comparisonReportPanel(data) {
  const rows = comparisonReportRows(data);
  const previousKey = previousMonthKeyFromPeriod(data.periodKey);
  return `
    <section class="panel report-section">
      <h2>Comparativo com ${formatMonthKeyBr(previousKey)}</h2>
      <div class="summary comparison-summary">
        ${rows.map(row => `
          <div class="metric">
            <span>${row.label}</span>
            <strong class="comparison-value ${row.delta < 0 ? "negative" : "positive"}"><i>${row.delta < 0 ? "-" : "+"}</i>${row.label === "Pedidos" || row.label === "Cumbucas" ? Math.abs(row.delta) : money(Math.abs(row.delta))}</strong>
            <small>Atual: ${row.label === "Pedidos" || row.label === "Cumbucas" ? row.current : money(row.current)} | Anterior: ${row.label === "Pedidos" || row.label === "Cumbucas" ? row.previous : money(row.previous)}</small>
          </div>
        `).join("")}
      </div>
    </section>
  `;
}

function reportCashTable(data) {
  if (!data.cashEntries.length) {
    return `<p class="muted">Nenhum lançamento de caixa neste período.</p>`;
  }

  return `
    <div class="summary">
      <div class="metric report-metric"><span>Entradas</span><strong>${money(data.income)}</strong></div>
      <div class="metric report-metric"><span>Saídas</span><strong>${money(data.expenses)}</strong></div>
      <div class="metric report-metric"><span>Saldo</span><strong class="${data.balance < 0 ? "negative" : "positive"}">${money(data.balance)}</strong></div>
    </div>
  `;
}
function reportIncomeCashTable(data) {
  if (!data.incomeEntries.length) {
    return `<p class="muted">Nenhuma entrada de caixa neste período.</p>`;
  }

  return `
    <div class="summary">
      <div class="metric report-metric">
        <span>Total de entradas no período</span>
        <strong>${money(data.income)}</strong>
      </div>
      ${accountIncomeBreakdown(data).map(([label, value]) => `
        <div class="metric report-metric">
          <span>${label}</span>
          <strong>${value}</strong>
        </div>
      `).join("")}
    </div>
  `;
}

function reportExpenseOutTable(data) {
  const entries = selectedReportExpenseEntries(data);
  const total = entries.reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const topEntries = [...entries]
    .sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0))
    .slice(0, 8);
  const selected = state.reportPeriod.expenseCategory || "all";
  const selectedLabel = selected === "all" ? "Todas as saídas" : categoryName(selected);

  if (!entries.length) {
    return `<p class="muted">Nenhuma saída neste período.</p>`;
  }

  return `
    <div class="summary">
      <div class="metric report-metric"><span>Filtro</span><strong>${selectedLabel}</strong></div>
      <div class="metric report-metric"><span>Total filtrado</span><strong>${money(total)}</strong></div>
      <div class="metric report-metric"><span>Lançamentos</span><strong>${entries.length}</strong></div>
    </div>
    <div class="table-wrap report-table">
      <table>
        <thead><tr><th>Data</th><th>Motivo</th><th>Descrição</th><th>Valor</th></tr></thead>
        <tbody>
          ${topEntries.map(entry => `
            <tr>
              <td>${formatIsoDateBr(entry.date)}</td>
              <td>${categoryName(entry.category)}</td>
              <td>${entry.description || ""}</td>
              <td>${money(entry.amount)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
    ${entries.length > topEntries.length ? `<p class="muted">Mostrando as ${topEntries.length} maiores saídas deste filtro.</p>` : ""}
  `;
}

function reportMenuTable(data) {
  if (!data.menuWeeks.some(week => week.dishes.length || week.orders.length)) {
    return `<p class="muted">Nenhum cardápio ou pedido neste período.</p>`;
  }

  return `
    <div class="table-wrap report-table">
      <table>
        <thead><tr><th>Semana</th><th>Pratos</th><th>Cumbucas</th><th>Pedidos</th><th>Receita</th></tr></thead>
        <tbody>
          ${data.menuWeeks.map(week => `
            <tr>
              <td>Semana ${week.week}</td>
              <td>${week.dishes.map(item => item.dish).filter(Boolean).join(", ") || "Sem pratos"}</td>
              <td>${week.quantity}</td>
              <td>${week.orders.length}</td>
              <td>${money(week.orderAmount)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function storeSalesPanel(data) {
  const defaultDate = reportTypeDefaultDate(data);

  return `
    <section class="panel report-section">
      <h2>Cumbucas vendidas na loja</h2>
      <form id="store-sale-form" class="store-sale-form">
        <label>Data
          <input name="date" type="date" value="${defaultDate}" required>
        </label>
        <label>Quantidade
          <input name="quantity" type="number" min="0" step="1" placeholder="0" required>
        </label>
        <label>Observação
          <input name="notes" placeholder="Opcional">
        </label>
        <button type="submit">Adicionar</button>
      </form>
      ${storeSalesTable(data.storeSales)}
    </section>
  `;
}

function reportTypeDefaultDate(data) {
  if (data.type === "week") {
    return reportWeekRange().end;
  }

  return `${data.periodKey}-01`;
}

function storeSalesTable(entries) {
  if (!entries.length) {
    return `<p class="muted">Nenhuma cumbuca da loja lançada neste período.</p>`;
  }

  return `
    <div class="table-wrap report-table">
      <table>
        <thead><tr><th>Data</th><th>Quantidade</th><th>Observação</th><th></th></tr></thead>
        <tbody>
          ${entries.map(entry => `
            <tr>
              <td>${formatIsoDateBr(entry.date)}</td>
              <td>${Number(entry.quantity || 0)}</td>
              <td>${entry.notes || ""}</td>
              <td>
                <div class="table-actions">
                  <button class="secondary table-action" type="button" data-edit-store-sale="${entry.id}">Editar</button>
                  <button class="danger table-action" type="button" data-delete-store-sale="${entry.id}">Excluir</button>
                </div>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function withdrawalReportTable(data) {
  if (!data.financial.withdrawalEntries.length) {
    return `<p class="muted">Nenhuma retirada neste período.</p>`;
  }

  return `
    <div class="table-wrap report-table">
      <table>
        <thead><tr><th>Data</th><th>Destino</th><th>Descrição</th><th>Valor</th></tr></thead>
        <tbody>
          ${data.financial.withdrawalEntries.map(entry => `
            <tr>
              <td>${formatIsoDateBr(entry.date)}</td>
              <td>${withdrawalTarget(entry) === "savings" ? "Cofrinho" : withdrawalTarget(entry) === "vanessa" ? "Vanessa" : withdrawalTarget(entry) === "raquel" ? "Raquel" : "Outras"}</td>
              <td>${entry.description || ""}</td>
              <td>${money(entry.amount)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function monthlyClosingPayload(data) {
  return {
    id: `${data.periodKey}-${Date.now()}`,
    periodKey: data.periodKey,
    closedAt: new Date().toISOString(),
    income: data.financial.income,
    operationalExpenses: data.financial.operationalExpenses,
    profitBeforeWithdrawals: data.financial.profitBeforeWithdrawals,
    withdrawals: data.financial.withdrawals,
    availableForWithdrawal: data.financial.availableForWithdrawal,
    suggestedWithdrawal: data.financial.suggestedWithdrawal,
    cashEntries: data.cashEntries.length,
    locked: true
  };
}

function monthlyClosingPanel(data) {
  const closing = state.monthlyClosings[data.periodKey];
  const locked = isMonthClosed(`${data.periodKey}-01`);

  return `
    <section class="panel report-section">
      <div class="section-heading">
        <div>
          <h2>Fechamento mensal</h2>
          <p class="muted-inline">Calcula faturamento, custos, retiradas e valor disponível do mês.</p>
        </div>
        <div class="actions">
          <button type="button" id="close-month">${closing ? "Atualizar fechamento" : "Fechar mês"}</button>
          ${closing && isAdminUser() ? `<button class="secondary" type="button" id="unlock-month">${locked ? "Destravar mês" : "Travar mês"}</button>` : ""}
        </div>
      </div>
      <div class="summary">
        <div class="metric"><span>Faturamento</span><strong>${money(data.financial.income)}</strong></div>
        <div class="metric"><span>Custos operacionais</span><strong>${money(data.financial.operationalExpenses)}</strong></div>
        <div class="metric"><span>Lucro antes retiradas</span><strong>${money(data.financial.profitBeforeWithdrawals)}</strong></div>
      </div>
      ${closing ? `
        <div class="closing-record">
          <span><b>Fechado em</b>${new Date(closing.closedAt).toLocaleString("pt-BR")}</span>
          <span><b>Disponível registrado</b>${money(closing.availableForWithdrawal)}</span>
          <span><b>Cofrinho sugerido</b>${money(closing.suggestedWithdrawal?.savings || 0)}</span>
          <span><b>Vanessa sugerido</b>${money(closing.suggestedWithdrawal?.vanessa || 0)}</span>
          <span><b>Raquel sugerido</b>${money(closing.suggestedWithdrawal?.raquel || 0)}</span>
          <span><b>Status</b>${locked ? "Travado" : "Destravado"}</span>
        </div>
      ` : `<p class="muted">Este mês ainda não foi fechado.</p>`}
    </section>
  `;
}

function renderStoreSales() {
  title.textContent = "Loja";
  setActive("loja");
  const today = isoDate(new Date());
  const editing = state.editStoreSaleId !== null
    ? state.storeSales.find(entry => String(entry.id) === String(state.editStoreSaleId))
    : null;
  const monthKey = currentMonthKey();
  const monthEntries = state.storeSales.filter(entry => String(entry.date || "").startsWith(monthKey));
  const todayTotal = state.storeSales
    .filter(entry => entry.date === today)
    .reduce((sum, entry) => sum + Number(entry.quantity || 0), 0);
  const monthTotal = monthEntries.reduce((sum, entry) => sum + Number(entry.quantity || 0), 0);

  app.innerHTML = `
    <div class="tool-grid">
      <section class="panel">
        <h2>${editing ? "Editar venda da loja" : "Lançar venda da loja"}</h2>
        <form id="store-sale-form" class="form-grid single">
          <label>Data
            <input name="date" type="date" value="${editing?.date || today}" required>
          </label>
          <label>Quantidade de cumbucas
            <input name="quantity" type="number" min="0" step="1" placeholder="0" value="${editing?.quantity || ""}" required>
          </label>
          <label>Observação
            <input name="notes" placeholder="Opcional" value="${editing?.notes || ""}">
          </label>
          <div class="actions">
            <button type="submit">${editing ? "Salvar edição" : "Adicionar"}</button>
            ${editing ? `<button class="secondary" type="button" id="cancel-store-sale-edit">Cancelar</button>` : ""}
          </div>
        </form>
      </section>
      <section class="panel report-section">
        <div class="summary">
          <div class="metric"><span>Hoje</span><strong>${todayTotal}</strong></div>
          <div class="metric"><span>Mês atual</span><strong>${monthTotal}</strong></div>
          <div class="metric"><span>Lançamentos</span><strong>${monthEntries.length}</strong></div>
        </div>
        ${storeSalesTable(monthEntries)}
      </section>
    </div>
  `;

  on("#store-sale-form", "submit", event => {
    event.preventDefault();
    const values = readForm(event.currentTarget);
    const quantity = Number(values.quantity || 0);
    if (!values.date || quantity <= 0) {
      showToast("Informe data e quantidade maior que zero.", "error");
      return;
    }
    if (blockClosedMonth(values.date, editing ? "editar venda da loja" : "lançar venda da loja")) {
      return;
    }
    const entry = {
      id: editing?.id || Date.now(),
      date: values.date,
      quantity,
      notes: values.notes || ""
    };
    if (editing) {
      state.storeSales = state.storeSales.map(item => String(item.id) === String(editing.id) ? entry : item);
      state.editStoreSaleId = null;
      recordAudit("Loja editada", `${values.quantity || 0} cumbuca(s) em ${values.date}`);
    } else {
      state.storeSales.push(entry);
      recordAudit("Loja lançada", `${values.quantity || 0} cumbuca(s) em ${values.date}`);
    }
    persistState();
    renderStoreSales();
  });

  const cancelStoreSaleEdit = document.querySelector("#cancel-store-sale-edit");
  if (cancelStoreSaleEdit) {
    cancelStoreSaleEdit.addEventListener("click", () => {
      state.editStoreSaleId = null;
      renderStoreSales();
    });
  }

  document.querySelectorAll("[data-edit-store-sale]").forEach(button => {
    button.addEventListener("click", event => {
      state.editStoreSaleId = event.currentTarget.dataset.editStoreSale;
      renderStoreSales();
    });
  });

  document.querySelectorAll("[data-delete-store-sale]").forEach(button => {
    button.addEventListener("click", event => {
      if (!confirm("Excluir este lançamento da loja?")) {
        return;
      }
      const id = Number(event.currentTarget.dataset.deleteStoreSale);
      const removed = state.storeSales.find(entry => Number(entry.id) === id);
      if (blockClosedMonth(removed?.date, "excluir venda da loja")) {
        return;
      }
      state.storeSales = state.storeSales.filter(entry => Number(entry.id) !== id);
      if (String(state.editStoreSaleId) === String(id)) {
        state.editStoreSaleId = null;
      }
      recordAudit("Loja excluída", `${removed?.quantity || 0} cumbuca(s) em ${removed?.date || ""}`);
      persistState();
      renderStoreSales();
    });
  });
}

function oldReportTitleSuffix(data) {
  return data.type === "week" ? `da semana ${data.selectedWeek}` : "do mês";
}

function reportTitleSuffix(data) {
  if (data.type === "day") {
    return `de ${formatIsoDateBr(data.date)}`;
  }
  if (data.type !== "week") {
    return `de ${formatMonthKeyBr(data.periodKey)}`;
  }

  return `de ${reportWeekRangeLabel()}`;
}

function reportExpenseCategoryOptions(selected = "all") {
  const categories = activeExpenseCategories();
  return [
    `<option value="all" ${selected === "all" ? "selected" : ""}>Todas as saídas</option>`,
    ...categories.map(([value, label]) => `<option value="${value}" ${selected === value ? "selected" : ""}>${label}</option>`)
  ].join("");
}

function selectedReportExpenseEntries(data) {
  const selected = state.reportPeriod.expenseCategory || "all";
  if (selected === "all") {
    return data.expenseEntries;
  }
  return data.expenseEntries.filter(entry => {
    const category = String(entry.category || "");
    return category === selected
      || category.replace(/^supplier:/, "reason:") === selected
      || slugifyCategory(categoryName(category)) === selected;
  });
}

function dueDateDistanceLabel(date) {
  const today = new Date(`${isoDate(new Date())}T00:00:00`);
  const due = new Date(`${date}T00:00:00`);
  const days = Math.round((due - today) / 86400000);

  if (days < 0) {
    return `Venceu há ${Math.abs(days)} dia(s)`;
  }
  if (days === 0) {
    return "Vence hoje";
  }
  return `Vence em ${days} dia(s)`;
}

function upcomingBills(limit = 6, { includeOverdue = true } = {}) {
  const today = isoDate(new Date());
  const end = isoDate(new Date(Date.now() + 30 * 86400000));

  return state.cash
    .filter(isPendingBill)
    .map(entry => ({
      ...entry,
      reminderDate: paymentReminderDate(entry)
    }))
    .filter(entry => entry.reminderDate && entry.reminderDate <= end)
    .filter(entry => includeOverdue || entry.reminderDate >= today)
    .sort((a, b) => String(a.reminderDate).localeCompare(String(b.reminderDate)))
    .slice(0, limit);
}

function upcomingBillsPanel({ title = "Próximas contas", limit = 6, showSummary = false, includeOverdue = true } = {}) {
  const bills = upcomingBills(limit, { includeOverdue });
  const total = bills.reduce((sum, entry) => sum + Number(entry.amount || 0), 0);

  return `
    <section class="panel report-section">
      <h2>${title}</h2>
      ${bills.length ? `
        ${showSummary ? `
          <div class="summary">
            <div class="metric report-metric"><span>Pendentes</span><strong>${bills.length}</strong></div>
            <div class="metric report-metric"><span>Total a pagar</span><strong>${money(total)}</strong></div>
          </div>
        ` : ""}
        <div class="recent-list">
          ${bills.map(entry => `
            <span>
              <b>${money(entry.amount)}</b>
              ${entry.description || categoryName(entry.category)}
              <small>${formatIsoDateBr(entry.reminderDate)} - ${entry.dueDate ? dueDateDistanceLabel(entry.dueDate) : "Despesa programada"}</small>
            </span>
          `).join("")}
        </div>
      ` : `<p class="muted">Nenhuma conta pendente com vencimento nos próximos 30 dias.</p>`}
    </section>
  `;
}

function withdrawalProjection(data) {
  const bounds = reportPeriodBounds(data);
  const today = isoDate(new Date());
  const effectiveEnd = today < bounds.start ? bounds.start : today > bounds.end ? bounds.end : today;
  const elapsedDays = daysBetweenInclusive(bounds.start, effectiveEnd);
  const totalDays = daysBetweenInclusive(bounds.start, bounds.end);
  const remainingDays = Math.max(0, totalDays - elapsedDays);
  const dailyProfit = data.financial.profitBeforeWithdrawals / elapsedDays;
  const projectedProfitBeforeWithdrawals = dailyProfit * totalDays;
  const projectedAvailableForWithdrawal = projectedProfitBeforeWithdrawals - data.financial.withdrawals.total;
  const currentSplit = withdrawalSplit(Math.max(0, data.financial.availableForWithdrawal));
  const projectedSplit = withdrawalSplit(Math.max(0, projectedAvailableForWithdrawal));

  return {
    bounds,
    elapsedDays,
    totalDays,
    remainingDays,
    dailyProfit,
    projectedProfitBeforeWithdrawals,
    projectedAvailableForWithdrawal,
    currentSplit,
    projectedSplit
  };
}

function withdrawalProjectionPanel(data) {
  const projection = withdrawalProjection(data);
  return `
    <section class="panel report-section withdrawal-projection-panel">
      <div class="section-heading">
        <div>
          <h2>Projeção de retirada</h2>
          <p class="muted-inline">Estimativa baseada na média diária do período filtrado, antes de novas despesas ou receitas não lançadas.</p>
        </div>
      </div>
      <div class="summary projection-summary">
        <div class="metric"><span>Período</span><strong>${projection.elapsedDays}/${projection.totalDays} dias</strong></div>
        <div class="metric"><span>Média diária</span><strong class="${projection.dailyProfit < 0 ? "negative" : "positive"}">${money(projection.dailyProfit)}</strong></div>
        <div class="metric"><span>Lucro projetado</span><strong class="${projection.projectedProfitBeforeWithdrawals < 0 ? "negative" : "positive"}">${money(projection.projectedProfitBeforeWithdrawals)}</strong></div>
        <div class="metric"><span>Retirada projetada</span><strong class="${projection.projectedAvailableForWithdrawal < 0 ? "negative" : "positive"}">${money(projection.projectedAvailableForWithdrawal)}</strong></div>
      </div>
      <div class="dashboard-lane projection-lane">
        <div class="panel dashboard-panel">
          <h2>Se retirar hoje</h2>
          <div class="recent-list">
            <span><b>${money(projection.currentSplit.savings)}</b>Cofrinho 10%</span>
            <span><b>${money(projection.currentSplit.vanessa)}</b>Vanessa 70%</span>
            <span><b>${money(projection.currentSplit.raquel)}</b>Raquel 30%</span>
          </div>
        </div>
        <div class="panel dashboard-panel">
          <h2>Projetado até ${formatIsoDateBr(projection.bounds.end)}</h2>
          <div class="recent-list">
            <span><b>${money(projection.projectedSplit.savings)}</b>Cofrinho 10%</span>
            <span><b>${money(projection.projectedSplit.vanessa)}</b>Vanessa 70%</span>
            <span><b>${money(projection.projectedSplit.raquel)}</b>Raquel 30%</span>
          </div>
        </div>
      </div>
      <p class="muted">Faltam ${projection.remainingDays} dia(s) no período. A projeção muda conforme novas entradas, saídas e retiradas forem lançadas.</p>
    </section>
  `;
}

function financialPlanningPanel() {
  const planning = state.financialPlanning || {};

  return `
    <section class="panel report-section">
      <h2>Planejamento</h2>
      <form id="financial-planning-form" class="form-grid">
        <label>Valor guardado
          <input name="savings" type="text" inputmode="decimal" placeholder="0,00" value="${moneyInputValue(planning.savings)}">
        </label>
        <label>Meta de lucro mensal
          <input name="monthlyGoal" type="text" inputmode="decimal" placeholder="0,00" value="${moneyInputValue(planning.monthlyGoal)}">
        </label>
        <label>Próximas melhorias para a loja
          <textarea name="improvements" rows="5" placeholder="Uma melhoria por linha">${planningText(planning.improvements)}</textarea>
        </label>
        <label>Próximos itens para comprar
          <textarea name="purchases" rows="5" placeholder="Um item por linha">${planningText(planning.purchases)}</textarea>
        </label>
        <div class="actions">
          <button type="submit">Salvar planejamento</button>
        </div>
      </form>
      <div class="summary">
        <div class="metric"><span>Guardado</span><strong>${money(planning.savings)}</strong></div>
        <div class="metric"><span>Meta mensal</span><strong>${money(planning.monthlyGoal)}</strong></div>
        <div class="metric"><span>Melhorias</span><strong>${(planning.improvements || []).length}</strong></div>
        <div class="metric"><span>Compras</span><strong>${(planning.purchases || []).length}</strong></div>
      </div>
      <div class="tool-grid">
        <div>
          <h3>Melhorias</h3>
          ${planningItemsHtml(planning.improvements, "Nenhuma melhoria planejada.")}
        </div>
        <div>
          <h3>Itens para comprar</h3>
          ${planningItemsHtml(planning.purchases, "Nenhum item planejado.")}
        </div>
      </div>
    </section>
  `;
}

function bindFinancialPlanning() {
  const form = document.querySelector("#financial-planning-form");
  if (!form) {
    return;
  }

  form.addEventListener("submit", event => {
    event.preventDefault();
    const values = readForm(event.currentTarget);
    state.financialPlanning = {
      savings: parseMoneyInput(values.savings).toFixed(2),
      savingsUpdatedAt: state.financialPlanning?.savingsUpdatedAt || "",
      savingsHistory: savingsHistoryRows(),
      partnersHistory: partnersHistoryRows(),
      monthlyGoal: parseMoneyInput(values.monthlyGoal).toFixed(2),
      improvements: textLines(values.improvements),
      purchases: textLines(values.purchases)
    };
    recordAudit("Planejamento financeiro", `Guardado ${money(state.financialPlanning.savings)}`);
    persistState();
    renderFinance();
  });
}

function financeFilterPanel(reportType, weekRange) {
  return `
    <section class="panel report-panel">
      <form id="report-filter-form" class="period-picker report-filter" data-period="${reportType}">
        <label>Período
          <select name="type" id="report-period-type">
            <option value="month" ${reportType === "month" ? "selected" : ""}>Mês</option>
            <option value="week" ${reportType === "week" ? "selected" : ""}>Semana</option>
            <option value="day" ${reportType === "day" ? "selected" : ""}>Dia</option>
          </select>
        </label>
        <label class="report-day-field">Dia
          <input name="date" type="date" value="${reportDate()}">
        </label>
        <label>Ano
          <input name="year" type="number" min="2020" max="2100" step="1" value="${state.reportPeriod.year}">
        </label>
        <label>Mês
          <select name="month">
            ${monthOptions(state.reportPeriod.month)}
          </select>
        </label>
        <label class="report-week-field">De
          <input name="start" type="date" value="${weekRange.start}">
        </label>
        <label class="report-week-field">Até
          <input name="end" type="date" value="${weekRange.end}">
        </label>
        <label>Saída
          <select name="expenseCategory">
            ${reportExpenseCategoryOptions(state.reportPeriod.expenseCategory || "all")}
          </select>
        </label>
        <button type="submit">Atualizar</button>
      </form>
    </section>
  `;
}

function bindReportPeriodForm(renderFn, path) {
  const reportFilterForm = document.querySelector("#report-filter-form");
  const reportTypeField = document.querySelector("#report-period-type");
  const weekRange = reportWeekRange();

  reportTypeField.addEventListener("change", event => {
    reportFilterForm.dataset.period = event.currentTarget.value;
  });

  reportFilterForm.addEventListener("submit", event => {
    event.preventDefault();
    const values = readForm(event.currentTarget);
    state.reportPeriod = {
      type: values.type || "month",
      year: Number(values.year || new Date().getFullYear()),
      month: Number(values.month || new Date().getMonth() + 1),
      week: Number(state.reportPeriod.week || 1),
      date: values.date || reportDate(),
      start: values.start || weekRange.start,
      end: values.end || weekRange.end,
      expenseCategory: values.expenseCategory || "all"
    };
    localStorage.setItem("reportPeriod", JSON.stringify(state.reportPeriod));
    const weeklyQuery = state.reportPeriod.type === "week" ? `&inicio=${state.reportPeriod.start}&fim=${state.reportPeriod.end}` : "";
    const dayQuery = state.reportPeriod.type === "day" ? `&dia=${state.reportPeriod.date}` : "";
    history.replaceState(null, "", `/${path}?ano=${state.reportPeriod.year}&mes=${state.reportPeriod.month}${weeklyQuery}${dayQuery}`);
    renderFn();
  });
}

function bindMonthlyClosing(data, renderFn) {
  const closeMonthButton = document.querySelector("#close-month");
  if (!closeMonthButton) {
    return;
  }

  closeMonthButton.addEventListener("click", () => {
    if (state.monthlyClosings[data.periodKey] && !isAdminUser()) {
      showToast("Somente admin pode atualizar um mês fechado.", "warning");
      return;
    }
    if (state.monthlyClosings[data.periodKey] && !confirm(`Atualizar o fechamento de ${formatMonthKeyBr(data.periodKey)}?`)) {
      return;
    }

    const closing = monthlyClosingPayload(data);
    state.monthlyClosings = {
      ...state.monthlyClosings,
      [data.periodKey]: closing
    };
    recordAudit("Mês fechado", `${formatMonthKeyBr(data.periodKey)} - disponível ${money(closing.availableForWithdrawal)}`);
    persistState();
    renderFn();
  });

  const unlockMonthButton = document.querySelector("#unlock-month");
  if (unlockMonthButton) {
    unlockMonthButton.addEventListener("click", () => {
      const closing = state.monthlyClosings[data.periodKey];
      if (!closing) {
        return;
      }
      const locked = isMonthClosed(`${data.periodKey}-01`);
      const action = locked ? "destravar" : "travar";
      if (!confirm(`Deseja ${action} ${formatMonthKeyBr(data.periodKey)}?`)) {
        return;
      }
      state.monthlyClosings = {
        ...state.monthlyClosings,
        [data.periodKey]: {
          ...closing,
          locked: !locked,
          lockUpdatedAt: new Date().toISOString()
        }
      };
      recordAudit(locked ? "Mês destravado" : "Mês travado", formatMonthKeyBr(data.periodKey));
      persistState();
      renderFn();
    });
  }
}

function financeDashboardPanel(data) {
  const projection = withdrawalProjection(data);
  const savings = Number(state.financialPlanning?.savings || 0);
  const monthlyGoal = Number(state.financialPlanning?.monthlyGoal || 0);
  const projectedVsGoal = monthlyGoal > 0 ? projection.projectedProfitBeforeWithdrawals - monthlyGoal : 0;
  const goalProgress = monthlyGoal > 0 ? Math.min(999, Math.round((data.financial.profitBeforeWithdrawals / monthlyGoal) * 100)) : 0;
  const availableAfterSavings = data.financial.availableForWithdrawal + savings;
  const dueSoon = state.cash
    .filter(entry => entry.type === "expense" && entry.dueDate && !entry.paidAt)
    .filter(entry => entry.dueDate <= addDays(isoDate(new Date()), 7))
    .sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)));
  const expenseRanking = Object.entries(
    data.expenseEntries.reduce((totals, entry) => {
      const key = categoryName(entry.category);
      totals[key] = (totals[key] || 0) + Number(entry.amount || 0);
      return totals;
    }, {})
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const alerts = [
    data.financial.availableForWithdrawal < 0 ? ["Retirada negativa", "As saídas e retiradas passaram do lucro do período."] : null,
    dueSoon.length ? ["Contas próximas", `${dueSoon.length} conta(s) vencidas ou vencendo em até 7 dias.`] : null,
    projection.dailyProfit < 0 ? ["Média negativa", "O período está fechando com prejuízo médio diário."] : null,
    !expenseRanking.length ? ["Sem custos", "Nenhuma saída operacional no período filtrado."] : null
  ].filter(Boolean);

  return `
    <section class="finance-dashboard">
      <div class="finance-spotlight">
        <span>Dashboard financeiro</span>
        <h2>${money(data.financial.availableForWithdrawal)}</h2>
        <p>Disponível para retirada no período filtrado, depois das retiradas já lançadas.</p>
      </div>
      <div class="finance-dashboard-grid">
        <div class="metric"><span>Lucro antes retiradas</span><strong class="${data.financial.profitBeforeWithdrawals < 0 ? "negative" : "positive"}">${money(data.financial.profitBeforeWithdrawals)}</strong></div>
        <div class="metric"><span>Retirada projetada</span><strong class="${projection.projectedAvailableForWithdrawal < 0 ? "negative" : "positive"}">${money(projection.projectedAvailableForWithdrawal)}</strong></div>
        <div class="metric"><span>Guardado + disponível</span><strong class="${availableAfterSavings < 0 ? "negative" : "positive"}">${money(availableAfterSavings)}</strong></div>
        <div class="metric"><span>Meta mensal</span><strong>${monthlyGoal > 0 ? `${goalProgress}%` : "Sem meta"}</strong></div>
      </div>
      ${monthlyGoal > 0 ? `
        <div class="backup-list-state ${projectedVsGoal >= 0 ? "" : "warning-state"}">
          <strong>Projeção da meta</strong>
          <span>${projectedVsGoal >= 0 ? "Acima da meta" : "Abaixo da meta"} em ${money(Math.abs(projectedVsGoal))}. Meta: ${money(monthlyGoal)}.</span>
        </div>
      ` : ""}
      <div class="dashboard-lane finance-dashboard-lane">
        <div class="panel dashboard-panel">
          <h2>Maiores saídas</h2>
          ${expenseRanking.length ? `
            <div class="recent-list">
              ${expenseRanking.map(([label, total]) => `<span><b>${money(total)}</b>${escapeHtml(label)}<small>${Math.round((total / Math.max(1, data.financial.operationalExpenses)) * 100)}% das saídas operacionais</small></span>`).join("")}
            </div>
          ` : `<p class="muted">Nenhuma saída operacional no período.</p>`}
        </div>
        <div class="panel dashboard-panel">
          <h2>Alertas</h2>
          ${alerts.length ? `
            <div class="alert-list">
              ${alerts.map(([title, detail]) => `<span><b>${title}</b>${detail}</span>`).join("")}
            </div>
          ` : `<p class="muted">Nenhum alerta financeiro para o período.</p>`}
        </div>
      </div>
    </section>
  `;
}

function renderFinance() {
  title.textContent = "Financeiro";
  setActive("financeiro");
  const data = reportData();
  const reportType = state.reportPeriod.type || "month";
  const weekRange = reportWeekRange();

  app.innerHTML = `
    ${financeFilterPanel(reportType, weekRange)}
    ${financeDashboardPanel(data)}
    <section class="report-grid">
      <div class="metric report-metric"><span>Entrou no caixa</span><strong>${money(data.income)}</strong></div>
      <div class="metric report-metric"><span>Entrou com semanal</span><strong>${money(data.orderRevenue)}</strong></div>
      <div class="metric report-metric"><span>Cumbucas loja</span><strong>${data.storeQuantity}</strong></div>
      <div class="metric report-metric"><span>Total cumbucas</span><strong>${data.totalSoldQuantity}</strong></div>
      <div class="metric report-metric"><span>Saiu em saídas</span><strong>${money(data.expenses)}</strong></div>
      <div class="metric report-metric"><span>Saídas operacionais</span><strong>${money(data.financial.operationalExpenses)}</strong></div>
      <div class="metric report-metric"><span>Lucro antes retiradas</span><strong class="${data.financial.profitBeforeWithdrawals < 0 ? "negative" : "positive"}">${money(data.financial.profitBeforeWithdrawals)}</strong></div>
      <div class="metric report-metric"><span>Retiradas feitas</span><strong>${money(data.financial.withdrawals.total)}</strong></div>
      <div class="metric report-metric"><span>Cofrinho atual</span><strong>${money(data.savingsBalance)}</strong></div>
      <div class="metric report-metric"><span>Disponível para retirada</span><strong class="${data.financial.availableForWithdrawal < 0 ? "negative" : "positive"}">${money(data.financial.availableForWithdrawal)}</strong></div>
    </section>
    ${reportType === "month" ? monthlyOriginCategoryPanel(data) : ""}
    ${withdrawalProjectionPanel(data)}
    ${upcomingBillsPanel()}
    ${financialPlanningPanel()}
    <section class="panel report-section">
      <h2>Retiradas ${reportTitleSuffix(data)}</h2>
      <div class="summary">
        <div class="metric"><span>Cofrinho</span><strong>${money(data.financial.withdrawals.savings)}</strong></div>
        <div class="metric"><span>Vanessa</span><strong>${money(data.financial.withdrawals.vanessa)}</strong></div>
        <div class="metric"><span>Raquel</span><strong>${money(data.financial.withdrawals.raquel)}</strong></div>
        <div class="metric"><span>Diferença Cofrinho</span><strong>${partnerDifferenceLabel(data.partnerWithdrawalControl?.differenceSavings)}</strong></div>
        <div class="metric"><span>Diferença Vanessa</span><strong>${partnerDifferenceLabel(data.partnerWithdrawalControl?.differenceVanessa)}</strong></div>
        ${Number(data.partnersRecord?.vanessa || 0) > 0 ? `<div class="metric"><span>Vanessa informada</span><strong>${money(data.partnersRecord.vanessa)}</strong></div>` : ""}
        ${Number(data.partnersRecord?.raquel || 0) > 0 ? `<div class="metric"><span>Raquel informada</span><strong>${money(data.partnersRecord.raquel)}</strong></div>` : ""}
        ${Number(data.partnersRecord?.difference || 0) > 0 ? `<div class="metric"><span>Diferença / antecipado</span><strong>${money(data.partnersRecord.difference)}</strong></div>` : ""}
      </div>
      ${withdrawalReportTable(data)}
    </section>
    ${reportType === "month" ? monthlyClosingPanel(data) : ""}
    <section class="panel report-section">
      <h2>O que entrou no caixa ${reportTitleSuffix(data)}</h2>
      ${reportIncomeCashTable(data)}
    </section>
    <section class="panel report-section">
      <h2>O que entrou com o semanal ${reportTitleSuffix(data)}</h2>
      ${reportOrdersTable(data)}
    </section>
    <section class="panel report-section">
      <h2>O que saiu em saídas ${reportTitleSuffix(data)}</h2>
      ${reportExpenseOutTable(data)}
    </section>
  `;

  bindReportPeriodForm(renderFinance, "financeiro");
  bindMonthlyClosing(data, renderFinance);
  bindFinancialPlanning();
}

function renderReports() {
  title.textContent = "Relatórios";
  setActive("relatorios");
  const data = reportData();
  const reportType = state.reportPeriod.type || "month";
  const weekRange = reportWeekRange();

  app.innerHTML = `
    <section class="panel report-panel">
      <form id="report-filter-form" class="period-picker report-filter" data-period="${reportType}">
        <label>Período
          <select name="type" id="report-period-type">
            <option value="month" ${reportType === "month" ? "selected" : ""}>Mês</option>
            <option value="week" ${reportType === "week" ? "selected" : ""}>Semana</option>
            <option value="day" ${reportType === "day" ? "selected" : ""}>Dia</option>
          </select>
        </label>
        <label class="report-day-field">Dia
          <input name="date" type="date" value="${reportDate()}">
        </label>
        <label>Ano
          <input name="year" type="number" min="2020" max="2100" step="1" value="${state.reportPeriod.year}">
        </label>
        <label>Mês
          <select name="month">
            ${monthOptions(state.reportPeriod.month)}
          </select>
        </label>
        <label class="report-week-field">De
          <input name="start" type="date" value="${weekRange.start}">
        </label>
        <label class="report-week-field">Até
          <input name="end" type="date" value="${weekRange.end}">
        </label>
        <label>Saída
          <select name="expenseCategory">
            ${reportExpenseCategoryOptions(state.reportPeriod.expenseCategory || "all")}
          </select>
        </label>
        <button type="submit">Atualizar</button>
      </form>
      <div class="report-actions">
        <button class="secondary" type="button" data-export-report="orders">Pedidos CSV</button>
        <button class="secondary" type="button" data-export-report="cash">Caixa CSV</button>
        <button class="secondary" type="button" data-export-report="financial">Financeiro CSV</button>
        <button class="secondary" type="button" data-export-report="channels">Canais CSV</button>
        <button class="secondary" type="button" data-export-report="clients">Clientes CSV</button>
        <button class="secondary" type="button" data-export-report="menu">Cardápio CSV</button>
        <button type="button" data-export-report="json">Relatório JSON</button>
        <button type="button" data-export-report="xlsx">Relatório Excel</button>
        <button type="button" data-export-report="pdf">Relatório PDF</button>
      </div>
    </section>

    <section class="report-grid">
      <div class="metric report-metric"><span>Receita de pedidos</span><strong>${money(data.orderRevenue)}</strong></div>
      <div class="metric report-metric"><span>Cumbucas vendidas</span><strong>${data.totalQuantity}</strong></div>
      <div class="metric report-metric"><span>Cumbucas loja</span><strong>${data.storeQuantity}</strong></div>
      <div class="metric report-metric"><span>Total cumbucas</span><strong>${data.totalSoldQuantity}</strong></div>
      <div class="metric report-metric"><span>Frete arrecadado</span><strong>${money(data.deliveryRevenue)}</strong></div>
      <div class="metric report-metric"><span>Entradas no caixa</span><strong>${money(data.income)}</strong></div>
      <div class="metric report-metric"><span>Saídas no caixa</span><strong>${money(data.expenses)}</strong></div>
      <div class="metric report-metric"><span>Saldo do caixa</span><strong class="${data.balance < 0 ? "negative" : "positive"}">${money(data.balance)}</strong></div>
      <div class="metric report-metric"><span>Saídas operacionais</span><strong>${money(data.financial.operationalExpenses)}</strong></div>
      <div class="metric report-metric"><span>Lucro antes retiradas</span><strong class="${data.financial.profitBeforeWithdrawals < 0 ? "negative" : "positive"}">${money(data.financial.profitBeforeWithdrawals)}</strong></div>
      <div class="metric report-metric"><span>Retiradas feitas</span><strong>${money(data.financial.withdrawals.total)}</strong></div>
      <div class="metric report-metric"><span>Cofrinho atual</span><strong>${money(data.savingsBalance)}</strong></div>
      <div class="metric report-metric"><span>Disponível para retirada</span><strong class="${data.financial.availableForWithdrawal < 0 ? "negative" : "positive"}">${money(data.financial.availableForWithdrawal)}</strong></div>
      <div class="metric report-metric"><span>Pedidos pagos</span><strong>${data.paidOrders}</strong></div>
      <div class="metric report-metric"><span>Pedidos pendentes</span><strong>${data.pendingOrders}</strong></div>
      <div class="metric report-metric"><span>Clientes semanais</span><strong>${data.weeklyClients}</strong></div>
      <div class="metric report-metric"><span>Mensalistas</span><strong>${data.monthlyClients}</strong></div>
    </section>
    ${upcomingBillsPanel({ title: "Boletos pendentes", limit: 12, showSummary: true, includeOverdue: false })}
    ${reportType === "month" ? monthlyOriginCategoryPanel(data) : ""}
    ${reportType === "month" ? comparisonReportPanel(data) : ""}
    ${channelReportPanel(data)}
    ${dishRankingPanel(data)}
    ${clientReportPanel(data)}

    <section class="panel report-section">
      <h2>Retiradas ${reportTitleSuffix(data)}</h2>
      <div class="summary">
        <div class="metric"><span>Cofrinho</span><strong>${money(data.financial.withdrawals.savings)}</strong></div>
        <div class="metric"><span>Vanessa</span><strong>${money(data.financial.withdrawals.vanessa)}</strong></div>
        <div class="metric"><span>Raquel</span><strong>${money(data.financial.withdrawals.raquel)}</strong></div>
        <div class="metric"><span>Diferença Cofrinho</span><strong>${partnerDifferenceLabel(data.partnerWithdrawalControl?.differenceSavings)}</strong></div>
        <div class="metric"><span>Diferença Vanessa</span><strong>${partnerDifferenceLabel(data.partnerWithdrawalControl?.differenceVanessa)}</strong></div>
        ${Number(data.partnersRecord?.vanessa || 0) > 0 ? `<div class="metric"><span>Vanessa informada</span><strong>${money(data.partnersRecord.vanessa)}</strong></div>` : ""}
        ${Number(data.partnersRecord?.raquel || 0) > 0 ? `<div class="metric"><span>Raquel informada</span><strong>${money(data.partnersRecord.raquel)}</strong></div>` : ""}
        ${Number(data.partnersRecord?.difference || 0) > 0 ? `<div class="metric"><span>Diferença / antecipado</span><strong>${money(data.partnersRecord.difference)}</strong></div>` : ""}
      </div>
      ${withdrawalReportTable(data)}
    </section>
    ${reportType === "month" ? monthlyClosingPanel(data) : ""}
    <section class="panel report-section">
      <h2>O que entrou no caixa ${reportTitleSuffix(data)}</h2>
      ${reportIncomeCashTable(data)}
    </section>
    <section class="panel report-section">
      <h2>O que entrou com o semanal ${reportTitleSuffix(data)}</h2>
      ${reportOrdersTable(data)}
    </section>
    <section class="panel report-section">
      <h2>O que saiu em saídas ${reportTitleSuffix(data)}</h2>
      ${reportExpenseOutTable(data)}
    </section>
    <section class="panel report-section">
      <h2>Caixa ${reportTitleSuffix(data)}</h2>
      ${reportCashTable(data)}
    </section>
    <section class="panel report-section">
      <h2>Cardápio e produção</h2>
      ${reportMenuTable(data)}
    </section>
  `;

  bindReportPeriodForm(renderReports, "relatorios");

  document.querySelectorAll("[data-export-report]").forEach(button => {
    button.addEventListener("click", event => {
      exportReport(event.currentTarget.dataset.exportReport);
    });
  });
  bindMonthlyClosing(data, renderReports);
}

async function renderBackups() {
  title.textContent = "Manutenção";
  setActive("backups");
  if (!canAccessMaintenanceTab(state.maintenanceTab)) {
    setMaintenanceTab("backup");
  }
  const activeTab = state.maintenanceTab || "backup";
  const years = cleanupYears();
  const selectedYear = years[0] || String(new Date().getFullYear() - 1);
  const preview = cleanupPreview(selectedYear);
  const lastBackupAt = localStorage.getItem("lastManualBackupAt") || "";
  const backupAgeDays = lastBackupAt ? Math.floor((Date.now() - new Date(lastBackupAt).getTime()) / 86400000) : null;
  const backupStatus = lastBackupAt
    ? `${shortDateTime.format(new Date(lastBackupAt))}${backupAgeDays >= 7 ? " - backup antigo" : " - em dia"}`
    : "Nenhum backup manual registrado neste navegador";
  app.innerHTML = `
    <section class="maintenance-hero">
      <div>
        <span>Manutenção</span>
        <h2>Backup, limpeza e conferência do banco</h2>
        <p>Use esta área antes de mudanças grandes, limpeza de dados antigos ou restauração de arquivo JSON.</p>
      </div>
      <div class="maintenance-steps">
        <button type="button" id="hero-backup-download">Baixar backup</button>
        <button class="secondary" type="button" data-maintenance-scroll="cleanup-year-form">Limpar ano</button>
        ${isAdminUser() ? `<button class="danger" type="button" data-maintenance-scroll="reset-all-panel">Limpar tudo</button>` : ""}
        <button class="secondary" type="button" data-maintenance-scroll="real-db-usage">Ver banco</button>
      </div>
    </section>

    <section class="panel maintenance-tabs-panel">
      <div class="maintenance-tabs" role="tablist" aria-label="Manutenção">
        ${[
          ["backup", "Backup"],
          ["database", "Banco"],
          ["users", "Usuários"],
          ["events", "Log"],
          ["reset", "Limpeza"]
        ].filter(([tab]) => canAccessMaintenanceTab(tab)).map(([tab, label]) => `
          <button class="secondary ${activeTab === tab ? "active" : ""}" type="button" data-maintenance-tab="${tab}">${label}</button>
        `).join("")}
      </div>
    </section>

    <section class="maintenance-grid">
      <section class="panel report-section backup-manual-panel maintenance-pane" data-maintenance-pane="backup" ${activeTab === "backup" ? "" : "hidden"}>
        <h2>Backup e recuperação</h2>
        <p class="muted-inline">O backup é salvo no seu computador, não no Supabase. Baixe um JSON antes de mudanças grandes e importe esse arquivo se precisar recuperar os dados.</p>
        <div class="backup-actions">
          <button type="button" id="manual-backup-download">Baixar backup JSON</button>
          <button class="secondary" type="button" id="manual-backup-supabase">Salvar no Supabase</button>
          <button class="secondary" type="button" id="system-check-run">Verificar sistema</button>
          <label class="secondary file-action">
            Importar backup JSON
            <input id="manual-backup-import" type="file" accept="application/json,.json">
          </label>
        </div>
        <div id="system-check-panel" class="system-check-panel">
          <p class="muted">Use a verificacao antes de operar ou depois de publicar mudancas.</p>
        </div>
        <div id="system-issues-panel">
          ${systemIssuesHtml()}
        </div>
        <div class="backup-list-state">
          <strong>Último backup manual</strong>
          <span>${backupStatus}</span>
        </div>
        ${backupAgeDays === null || backupAgeDays >= 7 ? `
          <div class="backup-list-state warning-state">
            <strong>Baixe um backup JSON</strong>
            <span>Recomendado antes de limpar dados ou fazer mudanças grandes.</span>
          </div>
        ` : ""}
        <div id="automatic-backups">
          <p class="muted">Consultando backups automáticos...</p>
        </div>
      </section>
      <section class="panel report-section backup-manual-panel maintenance-pane" data-maintenance-pane="database" ${activeTab === "database" ? "" : "hidden"}>
        <h2>Manutenção do banco</h2>
        <p class="muted-inline">Use para apagar dados antigos depois de baixar um backup JSON. Clientes, precificação, categorias e configurações atuais são preservados.</p>
        <div id="db-usage-status">
          ${databaseUsageHtml(selectedYear)}
        </div>
        <div class="backup-list-state">
          <strong>Tamanho real no Supabase</strong>
          <span>Consulta direta das tabelas cumbuca_app_state e cumbuca_app_backups.</span>
        </div>
        <div id="real-db-usage">
          <p class="muted">Consultando Supabase...</p>
        </div>
        <div class="backup-actions">
          <button class="danger" type="button" id="delete-old-backups">Apagar backups antigos do Supabase</button>
        </div>
        <form id="cleanup-year-form" class="period-picker">
          <label>Ano para limpar
            <select name="year" id="cleanup-year">
              ${years.length
                ? years.map(year => `<option value="${year}" ${year === selectedYear ? "selected" : ""}>${year}</option>`).join("")
                : `<option value="${selectedYear}">${selectedYear}</option>`}
            </select>
          </label>
          <button class="secondary" type="button" id="cleanup-backup-first">Baixar backup antes</button>
          <button class="danger" type="submit">Apagar ano</button>
        </form>
        <div id="cleanup-preview" class="cleanup-preview">
          ${cleanupPreviewHtml(selectedYear, preview)}
        </div>
      </section>
      ${isAdminUser() ? `
        <section class="panel report-section backup-manual-panel maintenance-pane" data-maintenance-pane="users" ${activeTab === "users" ? "" : "hidden"}>
          <h2>Usuários</h2>
          <p class="muted-inline">Adicione, edite, desative ou troque senha sem mexer nas variáveis do Vercel.</p>
          <div id="users-admin">
            <p class="muted">Carregando usuários...</p>
          </div>
        </section>
        <section class="panel report-section backup-manual-panel maintenance-pane" data-maintenance-pane="events" ${activeTab === "events" ? "" : "hidden"}>
          <h2>Log técnico</h2>
          <p class="muted-inline">Registro administrativo escondido do uso diário. Mostra limpezas, restaurações e manutenções críticas.</p>
          <div id="technical-events">
            <p class="muted">Consultando eventos...</p>
          </div>
        </section>
        <section class="panel report-section backup-manual-panel reset-all-panel maintenance-pane" data-maintenance-pane="reset" id="reset-all-panel" ${activeTab === "reset" ? "" : "hidden"}>
          <h2>Limpeza completa</h2>
          <p class="muted-inline">Use somente para recomeçar a operação do zero. A limpeza baixa um JSON no navegador e salva um backup automático no Supabase antes de apagar.</p>
          <div class="backup-list-state warning-state">
            <strong>Apaga dados operacionais</strong>
            <span>Caixa, pedidos, clientes, loja, canais, menus, precificação e planejamento ficam vazios.</span>
          </div>
          <div class="backup-actions">
            <button class="danger" type="button" id="reset-all-data">Baixar backup e limpar tudo</button>
          </div>
        </section>
      ` : ""}
    </section>
  `;

  document.querySelectorAll("[data-maintenance-tab]").forEach(button => {
    button.addEventListener("click", event => {
      setMaintenanceTab(event.currentTarget.dataset.maintenanceTab);
      renderBackups();
    });
  });

  on("#hero-backup-download", "click", downloadBackup);
  document.querySelectorAll("[data-maintenance-scroll]").forEach(button => {
    button.addEventListener("click", event => {
      const target = document.querySelector(`#${event.currentTarget.dataset.maintenanceScroll}`);
      target?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
  on("#manual-backup-download", "click", downloadBackup);
  on("#manual-backup-supabase", "click", saveManualBackupToSupabase);
  on("#system-check-run", "click", runSystemCheck);
  bindSystemIssuesPanel();
  loadRealDatabaseUsage();
  loadAutomaticBackups();
  loadUsersPanel();
  loadTechnicalEvents();
  on("#manual-backup-import", "change", async event => {
    const file = event.currentTarget.files?.[0];
    if (!file) {
      return;
    }
    if (!confirm("Importar este backup? Isso vai substituir os dados atuais.")) {
      event.currentTarget.value = "";
      return;
    }
    try {
      const saved = await importBackupFile(file);
      if (saved) {
        showToast("Backup importado", "success");
        renderBackups();
      }
    } catch (error) {
      showToast("Arquivo de backup inválido", "warning");
    }
  });

  const cleanupYearField = document.querySelector("#cleanup-year");
  const cleanupPreviewBox = document.querySelector("#cleanup-preview");
  cleanupYearField.addEventListener("change", event => {
    const year = event.currentTarget.value;
    cleanupPreviewBox.innerHTML = cleanupPreviewHtml(year, cleanupPreview(year));
    document.querySelector("#db-usage-status").innerHTML = databaseUsageHtml(year);
  });

  on("#cleanup-backup-first", "click", downloadBackup);
  const resetAllButton = document.querySelector("#reset-all-data");
  if (resetAllButton) {
    resetAllButton.addEventListener("click", async () => {
      resetAllButton.disabled = true;
      try {
        if (await resetAllData()) {
          renderBackups();
        }
      } finally {
        resetAllButton.disabled = false;
      }
    });
  }
  on("#delete-old-backups", "click", async () => {
    if (!hasRecentManualBackup()) {
      showToast("Baixe um backup JSON antes de apagar backups antigos.", "warning");
      return;
    }
    if (!confirm("Apagar backups antigos do Supabase mantendo apenas os últimos 30 dias? Baixe um backup JSON antes se tiver dúvida.")) {
      return;
    }
    try {
      const response = await fetch("/api/backups/delete-old", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keepDays: 30 })
      });
      const result = await response.json();
      if (!response.ok || !result.database) {
        showToast("Não foi possível apagar backups antigos", "warning");
        return;
      }
      showToast(`${result.deleted || 0} backup(s) antigo(s) apagado(s)`, "success");
      loadRealDatabaseUsage();
    } catch (error) {
      showToast("Falha ao apagar backups antigos", "warning");
    }
  });
  on("#cleanup-year-form", "submit", async event => {
    event.preventDefault();
    const year = cleanupYearField.value;
    const currentPreview = cleanupPreview(year);
    const total = Object.values(currentPreview).reduce((sum, value) => sum + value, 0);
    if (!total) {
      showToast("Nada para apagar nesse ano", "warning");
      return;
    }
    if (!hasRecentManualBackup()) {
      showToast("Baixe um backup JSON antes de apagar o ano.", "warning");
      return;
    }
    if (!confirm(`Apagar dados de ${year}? Baixe um backup JSON antes de continuar.`)) {
      return;
    }
    const typed = prompt(`Digite ${year} para confirmar a limpeza.`);
    if (typed !== year) {
      showToast("Limpeza cancelada", "warning");
      return;
    }
    const cleaned = await cleanupYear(year);
    if (cleaned) {
      showToast(`Ano ${year} apagado`, "success");
      renderBackups();
    }
  });
}

function hasRecentManualBackup(maxAgeHours = 24) {
  const last = localStorage.getItem("lastManualBackupAt");
  if (!last) {
    return false;
  }
  return Date.now() - new Date(last).getTime() <= maxAgeHours * 60 * 60 * 1000;
}

async function saveManualBackupToSupabase() {
  try {
    const response = await fetch("/api/manual-backup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state: appStatePayload() })
    });
    const result = await response.json();
    if (!response.ok || !result.database || !result.saved) {
      showToast(result.error || "Não foi possível salvar no Supabase.", "error");
      return;
    }
    localStorage.setItem("lastManualBackupAt", new Date().toISOString());
    showToast("Backup salvo no Supabase.", "success");
    showBackupPreviewModal({
      backupDate: isoDate(new Date()),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      preview: result.preview || {}
    });
    loadAutomaticBackups();
  } catch (error) {
    showToast("Falha ao salvar backup no Supabase.", "error");
  }
}

function systemIssuesHtml() {
  const issues = systemIssues();
  return `
    <div class="backup-list-state ${issues.length ? "warning-state" : ""}">
      <strong>Erros recentes</strong>
      <span>${issues.length ? `${issues.length} ocorrencia(s) locais` : "Nenhum erro recente neste navegador"}</span>
      ${issues.length ? `<button class="secondary table-action" type="button" id="clear-system-issues">Limpar erros</button>` : ""}
    </div>
    ${issues.length ? `
      <div class="system-check-list">
        ${issues.slice(0, 8).map(issue => `
          <span class="${issue.type === "error" ? "offline" : "online"}">
            <b>${issue.type === "error" ? "Erro" : "Aviso"}</b>
            ${escapeHtml(issue.message)}
            <small>${new Date(issue.createdAt).toLocaleString("pt-BR")} - ${issue.route}</small>
          </span>
        `).join("")}
      </div>
    ` : ""}
  `;
}

function bindSystemIssuesPanel() {
  const button = document.querySelector("#clear-system-issues");
  if (!button) {
    return;
  }
  button.addEventListener("click", () => {
    suppressIssueLog = true;
    localStorage.setItem("systemIssues", JSON.stringify([]));
    showToast("Erros recentes limpos.", "success");
    suppressIssueLog = false;
    const panel = document.querySelector("#system-issues-panel");
    if (panel) {
      panel.innerHTML = systemIssuesHtml();
    }
  });
}

function reportExportPayload(data = reportData()) {
  const periodLabel = data.type === "week" ? reportWeekRangeLabel() : formatMonthKeyBr(data.periodKey);
  return {
    periodLabel,
    data: {
      periodKey: data.periodKey,
      balance: data.balance,
      totalIncome: data.totalIncome,
      expenses: data.expenses,
      operationalExpenses: data.financial.operationalExpenses,
      availableForWithdrawal: data.financial.availableForWithdrawal,
      savingsBalance: data.savingsBalance,
      savingsUpdatedAt: data.savingsUpdatedAt,
      withdrawalTotal: data.financial.withdrawals.total,
      withdrawalRows: reportPdfWithdrawalRows(data),
      accountIncome: data.income,
      weeklyRevenue: data.orderRevenue,
      incomeSummaryRows: [
        ...accountIncomeBreakdown(data).map(([label, value]) => ["Conta", label, value]),
        ...weeklyRevenueBreakdown(data).map(([label, value]) => ["Semanal", label, value]),
        ["Total", "Conta + semanal", money(data.income + data.orderRevenue)]
      ],
      incomeChannelRows: reportPdfIncomeChannelRows(data),
      expenseCategoryRows: reportPdfExpenseCategoryRows(data),
      negativeDifferenceRows: reportPdfNegativeDifferenceRows(data),
      totalSoldQuantity: data.totalSoldQuantity,
      weeklyCashQuantity: data.weeklyCashQuantity,
      storeQuantity: data.storeQuantity,
      dishRows: dishRankingRows(data).map((item, index) => [index + 1, item.name, item.quantity]),
      comparisonRows: comparisonReportRows(data).map(row => [
        row.label,
        row.label === "Pedidos" || row.label === "Cumbucas" ? row.current : money(row.current),
        row.label === "Pedidos" || row.label === "Cumbucas" ? row.previous : money(row.previous),
        row.label === "Pedidos" || row.label === "Cumbucas" ? row.delta : money(row.delta)
      ]),
      incomeRows: data.incomeEntries.map(entry => [entry.date || "", entry.description || "", money(entry.amount)]),
      expenseRows: reportPdfTopExpenseRows(data),
      channelRows: data.channelReceipts.map(entry => [
        entry.date || "",
        ...cardapioPaymentDefinitions.map(([paymentKey]) => money(cardapioPaymentAmount(entry, paymentKey))),
        money(channelReceiptAmount(entry, "ifood", "net")),
        money(channelReceiptAmount(entry, "food99", "net")),
        money(channelReceiptTotal(entry))
      ]),
      storeRows: data.storeSales.map(entry => [entry.date || "", Number(entry.quantity || 0), entry.notes || ""]),
      cashRows: data.cashEntries.map(entry => [
        entry.date || "",
        entry.description || "",
        entry.type === "expense" ? "Saída" : "Entrada",
        categoryName(entry.category),
        money(entry.amount)
      ])
    }
  };
}

async function checkFetch(label, url, options = {}, validate = response => response.ok) {
  const startedAt = performance.now();
  try {
    const response = await fetch(url, { cache: "no-store", ...options });
    const ok = await validate(response);
    return { label, ok, detail: `${Math.round(performance.now() - startedAt)} ms` };
  } catch (error) {
    return { label, ok: false, detail: "Falhou" };
  }
}

async function runSystemCheck() {
  const panel = document.querySelector("#system-check-panel");
  if (!panel) {
    return;
  }
  panel.innerHTML = `<p class="muted">Verificando...</p>`;
  const payload = reportExportPayload();
  const checks = [
    await checkFetch("Sessão/login", "/api/session"),
    await checkFetch("Servidor e Supabase", "/api/health", {}, async response => {
      const result = await response.json();
      return response.ok && result.status === "online" && Boolean(result.database);
    }),
    await checkFetch("Persistência", "/api/persistence-check", {}, async response => {
      const result = await response.json();
      return response.ok && Boolean(result.database && result.saved);
    }),
    await checkFetch("Backups automáticos", "/api/backups", {}, async response => {
      const result = await response.json();
      return response.ok && Boolean(result.database);
    }),
    await checkFetch("PDF", "/api/report-pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }, response => response.ok && String(response.headers.get("content-type") || "").includes("application/pdf")),
    await checkFetch("Excel", "/api/report-xlsx", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }, response => response.ok && String(response.headers.get("content-type") || "").includes("spreadsheet"))
  ];
  const ok = checks.every(item => item.ok);
  panel.innerHTML = `
    <div class="backup-list-state ${ok ? "" : "warning-state"}">
      <strong>${ok ? "Sistema verificado" : "Sistema com pendências"}</strong>
      <span>${new Date().toLocaleString("pt-BR")}</span>
    </div>
    <div class="system-check-list">
      ${checks.map(item => `
        <span class="${item.ok ? "online" : "offline"}">
          <b>${item.ok ? "OK" : "Falha"}</b>
          ${item.label}
          <small>${item.detail}</small>
        </span>
      `).join("")}
    </div>
  `;
}

function configuredDefaultRoute() {
  const route = state.appConfig?.defaultRoute || defaultAppConfig.defaultRoute;
  return configRouteOptions.some(([value]) => value === route) ? route : defaultAppConfig.defaultRoute;
}

function renderAlerts() {
  title.textContent = "Alertas";
  setActive("alertas");
  const metrics = homeMetricData();
  const weeklyOrders = state.orders.filter(order => order.menuKey === menuKey(state.menuWeek || 1)).length;
  const alerts = dashboardAlerts(metrics, weeklyOrders);
  const notifications = notificationRows(metrics, weeklyOrders);
  const today = todayOperationData();
  const urgent = [
    ...alerts.map(([label, detail]) => ({ label, detail, type: "warning" })),
    ...metrics.pendingPayments.map(order => {
      const client = clientByPhone(order.clientPhone);
      return { label: "Cobrar cliente", detail: `${client.name || order.clientPhone} - ${money(order.amount)}`, type: "danger", href: clientChargeWhatsAppUrl(client, order.amount), action: "WhatsApp" };
    }),
    ...today.billsDue.map(item => ({ label: "Conta para pagar", detail: `${item.description || "Despesa"} - ${money(item.amount)}`, type: "danger" })),
    ...today.pendingDelivery.map(order => {
      const client = clientByPhone(order.clientPhone);
      return { label: "Entrega pendente", detail: client.name || order.clientPhone || "Cliente", type: "warning", href: orderWhatsAppUrl(order, state.menus[order.menuKey] || []), action: "WhatsApp" };
    })
  ];

  app.innerHTML = `
    <section class="dashboard-band alerts-band">
      <div class="dashboard-copy">
        <span>Central</span>
        <h2>Pendências da operação</h2>
        <p>Pagamentos, entregas, contas e cadastros que precisam de atenção.</p>
      </div>
      <div class="dashboard-kpis">
        <div class="metric dashboard-metric is-primary">
          <span>Alertas ativos</span>
          <strong>${urgent.length}</strong>
        </div>
        <div class="metric dashboard-metric">
          <span>Pagamentos pendentes</span>
          <strong>${metrics.pendingPayments.length}</strong>
        </div>
        <div class="metric dashboard-metric">
          <span>Entregas hoje</span>
          <strong>${today.pendingDelivery.length}</strong>
        </div>
      </div>
    </section>
    <section class="panel">
      <h2>Lista de alertas</h2>
      ${urgent.length ? `
        <div class="alert-card-list">
          ${urgent.map(item => `
            <article class="alert-card ${item.type}">
              <strong>${item.label}</strong>
              <span>${item.detail}</span>
              ${item.href ? `<a class="secondary table-action" href="${item.href}" target="_blank" rel="noopener">${item.action || "Abrir"}</a>` : ""}
            </article>
          `).join("")}
        </div>
      ` : `<p class="muted">Nenhuma pendência crítica agora.</p>`}
      ${notifications.length ? `
        <h2>Notificações recentes</h2>
        <div class="alert-list">
          ${notifications.slice(0, 8).map(item => `<span><b>${item.title}</b>${item.detail}<a class="secondary table-action" href="${item.action}">Abrir</a></span>`).join("")}
        </div>
      ` : ""}
      <div class="start-actions">
        <a class="secondary table-action" href="/pedidos" data-route="pedidos">Ver pedidos</a>
        <a class="secondary table-action" href="/financeiro" data-route="financeiro">Ver financeiro</a>
        <a class="secondary table-action" href="/backups" data-route="backups">Ver manutenção</a>
      </div>
    </section>
  `;
}

function renderSettings() {
  title.textContent = "Configurações";
  setActive("configuracoes");
  const config = {
    ...defaultAppConfig,
    ...(state.appConfig || {})
  };
  app.innerHTML = `
    <section class="panel settings-panel">
      <h2>Configurações</h2>
      <form id="settings-form" class="settings-form">
        <label>Nome da loja
          <input name="storeName" value="${config.storeName || ""}" placeholder="Cumbuca">
        </label>
        <label>Tela inicial
          <select name="defaultRoute">
            ${configRouteOptions.map(([value, label]) => `<option value="${value}" ${config.defaultRoute === value ? "selected" : ""}>${label}</option>`).join("")}
          </select>
        </label>
        <label>Reserva (%)
          <input name="splitSavingsPercent" type="number" min="0" max="100" step="1" value="${Number(config.splitSavingsPercent || 0)}">
        </label>
        <label>Vanessa (%)
          <input name="splitVanessaPercent" type="number" min="0" max="100" step="1" value="${Number(config.splitVanessaPercent || 0)}">
        </label>
        <label>Raquel (%)
          <input name="splitRaquelPercent" type="number" min="0" max="100" step="1" value="${Number(config.splitRaquelPercent || 0)}">
        </label>
        <button type="submit">Salvar configurações</button>
      </form>
    </section>
  `;

  on("#settings-form", "submit", async event => {
    event.preventDefault();
    const form = readForm(event.currentTarget);
    state.appConfig = {
      ...defaultAppConfig,
      storeName: String(form.storeName || "Cumbuca").trim() || "Cumbuca",
      defaultRoute: String(form.defaultRoute || defaultAppConfig.defaultRoute),
      splitSavingsPercent: Number(form.splitSavingsPercent || 0),
      splitVanessaPercent: Number(form.splitVanessaPercent || 0),
      splitRaquelPercent: Number(form.splitRaquelPercent || 0)
    };
    await persistState();
    renderSettings();
  });
}

function renderMore() {
  title.textContent = "Mais";
  setActive("mais");
  const links = [
    ["menu-semanal", "Menu", "Cardápio, produção e pedidos"],
    ["loja", "Loja", "Vendas do balcão"],
    ["precificacao", "Preços", "Ingredientes e margem"],
    ["relatorios", "Relatórios", "PDF, Excel e ranking"],
    ["alertas", "Alertas", "Pendências da operação"],
    ["configuracoes", "Config.", "Tela inicial e retiradas"],
    ["backups", "Manutenção", "Backup, usuários e banco"]
  ];
  app.innerHTML = `
    <section class="panel start-panel">
      <h2>Mais ferramentas</h2>
      <div class="quick-actions start-actions">
        ${links.map(([route, label, detail]) => `
          <a href="/${route}" data-route="${route}">
            <b>${label}</b>
            <small>${detail}</small>
          </a>
        `).join("")}
      </div>
    </section>
  `;
}

const routes = {
  home,
  "fluxo-de-caixa": renderCash,
  hoje: renderToday,
  pedidos: renderQuickOrders,
  "menu-semanal": renderMenu,
  loja: renderStoreSales,
  financeiro: renderFinance,
  precificacao: renderPricing,
  relatorios: renderReports,
  alertas: renderAlerts,
  configuracoes: renderSettings,
  mais: renderMore,
  backups: renderBackups,
  "minha-conta": renderAccount
};

function applyRouteParams() {
  const params = new URLSearchParams(location.search);
  const weekParam = params.get("semana");
  if (weekParam && Number(weekParam) >= 1 && Number(weekParam) <= 5) {
    state.menuWeek = Number(weekParam);
    state.showMonthSummary = false;
  }

  if (params.get("resumo") === "mes") {
    state.showMonthSummary = true;
  }

  const yearParam = params.get("ano");
  const monthParam = params.get("mes");
  const startParam = params.get("inicio");
  const endParam = params.get("fim");
  const dayParam = params.get("dia");
  const reportWeekParam = weekParam && Number(weekParam) >= 1 && Number(weekParam) <= 5 ? Number(weekParam) : null;
  if (yearParam && monthParam) {
    state.menuPeriod = {
      year: Number(yearParam),
      month: Number(monthParam)
    };
    if (routeName() === "relatorios" || routeName() === "financeiro") {
      state.reportPeriod = {
        type: startParam && endParam ? "week" : (reportWeekParam ? "week" : (state.reportPeriod.type || "month")),
        year: Number(yearParam),
        month: Number(monthParam),
        week: reportWeekParam || Number(state.reportPeriod.week || 1),
        date: dayParam || state.reportPeriod.date || isoDate(new Date()),
        start: startParam || state.reportPeriod.start || "",
        end: endParam || state.reportPeriod.end || ""
      };
    }
  }

  if (dayParam && (routeName() === "relatorios" || routeName() === "financeiro")) {
    const [year, month] = dayParam.split("-").map(Number);
    state.reportPeriod = {
      ...state.reportPeriod,
      type: "day",
      date: dayParam,
      year: year || state.reportPeriod.year,
      month: month || state.reportPeriod.month
    };
  }
}

function automaticBackupsHtml(result) {
  if (!result?.database) {
    return `<p class="muted">Não foi possível consultar os backups automáticos agora.</p>`;
  }
  if (!result.backups?.length) {
    return `<p class="muted">Nenhum backup automático encontrado ainda.</p>`;
  }
  const latest = result.backups[0];
  return `
    <div class="backup-list-state">
      <strong>Último backup automático</strong>
      <span>${formatIsoDateBr(String(latest.backup_date || "").slice(0, 10))} - atualizado ${new Date(latest.updated_at || latest.created_at).toLocaleString("pt-BR")}</span>
    </div>
    <div class="table-wrap report-table">
      <table>
        <thead><tr><th>Data</th><th>Criado</th><th>Atualizado</th><th></th></tr></thead>
        <tbody>
          ${result.backups.slice(0, 10).map(backup => {
            const date = String(backup.backup_date || "").slice(0, 10);
            return `
              <tr>
                <td>${formatIsoDateBr(date)}</td>
                <td>${new Date(backup.created_at).toLocaleString("pt-BR")}</td>
                <td>${new Date(backup.updated_at).toLocaleString("pt-BR")}</td>
                <td>
                  <div class="table-actions">
                    <a class="secondary table-action" href="/api/backup?date=${date}" target="_blank" rel="noopener">Baixar</a>
                    ${isAdminUser() ? `<button class="secondary table-action" type="button" data-preview-auto-backup="${date}">Prévia</button>` : ""}
                    ${isAdminUser() ? `<button class="danger table-action" type="button" data-restore-auto-backup="${date}">Restaurar</button>` : ""}
                    ${isAdminUser() ? `<button class="danger table-action" type="button" data-delete-auto-backup="${date}">Excluir</button>` : ""}
                  </div>
                </td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;
}

async function loadAutomaticBackups() {
  const target = document.querySelector("#automatic-backups");
  if (!target) {
    return;
  }
  try {
    const response = await fetch("/api/backups", { cache: "no-store" });
    const result = await response.json();
    target.innerHTML = automaticBackupsHtml(result);
    bindRestoreBackupButtons();
    bindDeleteBackupButtons();
  } catch (error) {
    target.innerHTML = `<p class="muted">Não foi possível consultar os backups automáticos agora.</p>`;
  }
}

function bindRestoreBackupButtons() {
  document.querySelectorAll("[data-preview-auto-backup]").forEach(button => {
    button.addEventListener("click", async event => {
      const date = event.currentTarget.dataset.previewAutoBackup;
      const preview = await fetchBackupPreview(date);
      if (preview) {
        showBackupPreviewModal(preview, date);
      }
    });
  });

  document.querySelectorAll("[data-restore-auto-backup]").forEach(button => {
    button.addEventListener("click", async event => {
      const date = event.currentTarget.dataset.restoreAutoBackup;
      if (!confirm(`Restaurar o backup automático de ${formatIsoDateBr(date)}? Os dados atuais serão substituídos.`)) {
        return;
      }
      const typed = prompt(`Digite ${date} para confirmar a restauração.`);
      if (typed !== date) {
        showToast("Restauração cancelada", "warning");
        return;
      }
      const response = await fetch("/api/restore-backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date })
      });
      const result = await response.json();
      if (!response.ok || !result.restored) {
        showToast(result.error || "Não foi possível restaurar o backup.", "error");
        return;
      }
      await hydrateState();
      showToast("Backup restaurado.", "success");
      renderBackups();
    });
  });
}

function bindDeleteBackupButtons() {
  document.querySelectorAll("[data-delete-auto-backup]").forEach(button => {
    button.addEventListener("click", async event => {
      const date = event.currentTarget.dataset.deleteAutoBackup;
      if (!confirm(`Excluir o backup automático de ${formatIsoDateBr(date)}? Esta ação não pode ser desfeita.`)) {
        return;
      }
      const typed = prompt(`Digite ${date} para confirmar a exclusão.`);
      if (typed !== date) {
        showToast("Exclusão cancelada", "warning");
        return;
      }
      const response = await fetch(`/api/backup?date=${encodeURIComponent(date)}`, {
        method: "DELETE"
      });
      const result = await response.json();
      if (!response.ok || !result.deleted) {
        showToast(result.error || "Não foi possível excluir o backup.", "error");
        return;
      }
      showToast("Backup excluído.", "success");
      loadAutomaticBackups();
    });
  });
}

async function fetchBackupPreview(date) {
  try {
    const response = await fetch(`/api/backup-preview?date=${encodeURIComponent(date)}`, { cache: "no-store" });
    const result = await response.json();
    if (!response.ok || !result.preview) {
      showToast(result.error || "Não foi possível consultar a prévia.", "error");
      return null;
    }
    return result;
  } catch (error) {
    showToast("Falha ao consultar a prévia do backup.", "error");
    return null;
  }
}

function closeModal() {
  document.querySelector(".modal-backdrop")?.remove();
}

function showBackupPreviewModal(result, restoreDate = "") {
  const preview = result.preview || {};
  closeModal();
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-label="Prévia do backup">
      <div class="modal-header">
        <div>
          <span class="eyebrow">Backup</span>
          <h2>Prévia de ${formatIsoDateBr(result.backupDate || restoreDate || isoDate(new Date()))}</h2>
        </div>
        <button class="secondary table-action" type="button" data-close-modal>Fechar</button>
      </div>
      <div class="backup-preview-grid">
        <span><b>${preview.clients || 0}</b><small>Clientes</small></span>
        <span><b>${preview.orders || 0}</b><small>Pedidos</small></span>
        <span><b>${preview.cashEntries || 0}</b><small>Caixa</small></span>
        <span><b>${preview.storeSales || 0}</b><small>Loja</small></span>
        <span><b>${preview.menuItems || 0}</b><small>Menu</small></span>
        <span><b>${preview.ingredients || 0}</b><small>Ingredientes</small></span>
      </div>
      <p class="muted">Atualizado: ${result.updatedAt ? new Date(result.updatedAt).toLocaleString("pt-BR") : new Date().toLocaleString("pt-BR")}</p>
      <div class="modal-actions">
        ${restoreDate && isAdminUser() ? `<button class="danger" type="button" data-modal-restore="${restoreDate}">Restaurar este backup</button>` : ""}
        <button class="secondary" type="button" data-close-modal>Fechar</button>
      </div>
    </div>
  `;
  document.body.appendChild(backdrop);
  backdrop.querySelectorAll("[data-close-modal]").forEach(button => {
    button.addEventListener("click", closeModal);
  });
  backdrop.addEventListener("click", event => {
    if (event.target === backdrop) {
      closeModal();
    }
  });
  const restoreButton = backdrop.querySelector("[data-modal-restore]");
  if (restoreButton) {
    restoreButton.addEventListener("click", () => restoreAutomaticBackup(restoreButton.dataset.modalRestore));
  }
}

async function restoreAutomaticBackup(date) {
  if (!confirm(`Restaurar o backup automático de ${formatIsoDateBr(date)}? Os dados atuais serão substituídos.`)) {
    return;
  }
  const typed = prompt(`Digite ${date} para confirmar a restauração.`);
  if (typed !== date) {
    showToast("Restauração cancelada", "warning");
    return;
  }
  const response = await fetch("/api/restore-backup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ date })
  });
  const result = await response.json();
  if (!response.ok || !result.restored) {
    showToast(result.error || "Não foi possível restaurar o backup.", "error");
    return;
  }
  closeModal();
  await hydrateState();
  showToast("Backup restaurado.", "success");
  renderBackups();
}

function backupPreviewText(result) {
  const preview = result.preview || {};
  return [
    `Backup ${formatIsoDateBr(result.backupDate)}`,
    `Atualizado: ${new Date(result.updatedAt || result.createdAt).toLocaleString("pt-BR")}`,
    "",
    `Caixa: ${preview.cash || 0}`,
    `Pedidos: ${preview.orders || 0}`,
    `Clientes: ${preview.clients || 0}`,
    `Menus: ${preview.menus || 0}`,
    `Loja: ${preview.storeSales || 0}`,
    `Canais: ${preview.channelReceipts || 0}`,
    `Fechamentos: ${preview.monthlyClosings || 0}`
  ].join("\n");
}

function technicalEventsHtml(result) {
  if (!result?.database) {
    return `<p class="muted">Log técnico indisponível agora.</p>`;
  }
  if (!result.events?.length) {
    return `<p class="muted">Nenhum evento técnico registrado.</p>`;
  }
  return `
    <div class="recent-list">
      ${result.events.map(event => `
        <span>
          <b>${escapeHtml(event.event_type)}</b>
          ${escapeHtml(event.detail || "")}
          <small>${escapeHtml(event.username || "")} - ${new Date(event.created_at).toLocaleString("pt-BR")}</small>
        </span>
      `).join("")}
    </div>
  `;
}

async function loadTechnicalEvents() {
  const target = document.querySelector("#technical-events");
  if (!target) {
    return;
  }
  try {
    const response = await fetch("/api/events?limit=30", { cache: "no-store" });
    const result = await response.json();
    target.innerHTML = technicalEventsHtml(result);
  } catch (error) {
    target.innerHTML = `<p class="muted">Log técnico indisponível agora.</p>`;
  }
}

function renderAccount() {
  title.textContent = "Minha conta";
  setActive("minha-conta");
  const user = state.currentUser || {};
  app.innerHTML = `
    <section class="panel report-section account-panel">
      <div class="section-heading">
        <div>
          <h2>Minha conta</h2>
          <p class="muted-inline">Troque sua senha sem alterar variáveis do Vercel.</p>
        </div>
        <div class="client-count">
          <span>Perfil</span>
          <strong>${user.role === "admin" ? "Admin" : "Operação"}</strong>
        </div>
      </div>
      <div class="summary">
        <div class="metric"><span>Usuário</span><strong>${escapeHtml(user.username || "")}</strong></div>
        <div class="metric"><span>Nome</span><strong>${escapeHtml(user.name || user.username || "")}</strong></div>
        <div class="metric"><span>Acesso</span><strong>${user.role === "admin" ? "Total" : "Operação"}</strong></div>
      </div>
      <form id="change-password-form" class="form-grid">
        <label>Senha atual
          ${passwordFieldHtml({ name: "currentPassword", autocomplete: "current-password", required: true })}
        </label>
        <label>Nova senha
          ${passwordFieldHtml({ name: "newPassword", autocomplete: "new-password", minlength: 4, required: true })}
        </label>
        <label>Confirmar nova senha
          ${passwordFieldHtml({ name: "confirmPassword", autocomplete: "new-password", minlength: 4, required: true })}
        </label>
        <div class="actions">
          <button type="submit">Alterar senha</button>
        </div>
      </form>
    </section>
  `;

  bindPasswordToggles(app);

  on("#change-password-form", "submit", async event => {
    event.preventDefault();
    const values = readForm(event.currentTarget);
    if (values.newPassword !== values.confirmPassword) {
      showToast("A confirmação não confere.", "warning");
      return;
    }
    const response = await fetch("/api/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values)
    });
    const result = await response.json();
    if (!response.ok || !result.saved) {
      showToast(result.error || "Não foi possível alterar a senha.", "error");
      return;
    }
    event.currentTarget.reset();
    showToast("Senha alterada.", "success");
  });
}

function usersPanelHtml(result) {
  if (!result?.database) {
    return `<p class="muted">Usuários ainda estão vindo das variáveis do Vercel porque o banco não está disponível.</p>`;
  }
  const users = result.users || [];
  const editing = users.find(user => user.username === state.editUserName);
  return `
    <div class="dashboard-lane user-admin-layout">
      <div>
        <h3>${editing ? "Editar usuário" : "Novo usuário"}</h3>
        <form id="user-admin-form" class="form-grid single">
          <label>Usuário
            <input name="username" value="${editing?.username || ""}" placeholder="nomeusuario" ${editing ? "readonly" : ""} required>
          </label>
          <label>Nome
            <input name="name" value="${escapeHtml(editing?.name || "")}" placeholder="Nome completo" required>
          </label>
          <label>Perfil
            <select name="role">
              <option value="admin" ${editing?.role === "admin" ? "selected" : ""}>Admin</option>
              <option value="operator" ${editing?.role === "operator" ? "selected" : ""}>Operação</option>
            </select>
          </label>
          <label>${editing ? "Nova senha" : "Senha"}
            ${passwordFieldHtml({
              name: "password",
              autocomplete: "new-password",
              placeholder: editing ? "Deixe em branco para manter" : "Senha",
              required: !editing
            })}
          </label>
          <div class="actions">
            <button type="submit">${editing ? "Salvar usuário" : "Adicionar usuário"}</button>
            ${editing ? `<button class="secondary" type="button" id="cancel-user-edit">Cancelar</button>` : ""}
          </div>
        </form>
      </div>
      <div>
        <h3>Usuários cadastrados</h3>
        ${users.length ? `
          <div class="table-wrap report-table">
            <table>
              <thead><tr><th>Usuário</th><th>Nome</th><th>Perfil</th><th>Status</th><th></th></tr></thead>
              <tbody>
                ${users.map(user => `
                  <tr>
                    <td>${escapeHtml(user.username)}</td>
                    <td>${escapeHtml(user.name)}</td>
                    <td>${user.role === "admin" ? "Admin" : "Operação"}</td>
                    <td>${user.active ? "Ativo" : "Inativo"}</td>
                    <td>
                      <div class="table-actions">
                        <button class="secondary table-action" type="button" data-edit-user="${escapeHtml(user.username)}">Editar</button>
                        ${user.active
                          ? `<button class="danger table-action" type="button" data-user-active="${escapeHtml(user.username)}" data-active="false">Desativar</button>`
                          : `<button class="secondary table-action" type="button" data-user-active="${escapeHtml(user.username)}" data-active="true">Reativar</button>`}
                      </div>
                    </td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        ` : `<p class="muted">Nenhum usuário cadastrado.</p>`}
      </div>
    </div>
  `;
}

async function loadUsersPanel() {
  const target = document.querySelector("#users-admin");
  if (!target) {
    return;
  }
  try {
    const response = await fetch("/api/users", { cache: "no-store" });
    const result = await response.json();
    target.innerHTML = usersPanelHtml(result);
    bindUsersPanel();
  } catch (error) {
    target.innerHTML = `<p class="muted">Não foi possível carregar usuários agora.</p>`;
  }
}

function bindUsersPanel() {
  const form = document.querySelector("#user-admin-form");
  if (form) {
    bindPasswordToggles(form);
    form.addEventListener("submit", async event => {
      event.preventDefault();
      const values = readForm(event.currentTarget);
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values)
      });
      const result = await response.json();
      if (!response.ok || !result.saved) {
        showToast(result.error || "Não foi possível salvar usuário.", "error");
        return;
      }
      state.editUserName = null;
      showToast("Usuário salvo.", "success");
      loadUsersPanel();
      loadTechnicalEvents();
    });
  }

  const cancel = document.querySelector("#cancel-user-edit");
  if (cancel) {
    cancel.addEventListener("click", () => {
      state.editUserName = null;
      loadUsersPanel();
    });
  }

  document.querySelectorAll("[data-edit-user]").forEach(button => {
    button.addEventListener("click", event => {
      state.editUserName = event.currentTarget.dataset.editUser;
      loadUsersPanel();
    });
  });

  document.querySelectorAll("[data-user-active]").forEach(button => {
    button.addEventListener("click", async event => {
      const username = event.currentTarget.dataset.userActive;
      const active = event.currentTarget.dataset.active === "true";
      if (!confirm(`${active ? "Reativar" : "Desativar"} o usuário ${username}?`)) {
        return;
      }
      const response = await fetch("/api/users/active", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, active })
      });
      const result = await response.json();
      if (!response.ok || !result.saved) {
        showToast(result.error || "Não foi possível alterar usuário.", "error");
        return;
      }
      showToast(active ? "Usuário reativado." : "Usuário desativado.", "success");
      loadUsersPanel();
      loadTechnicalEvents();
    });
  });
}

Promise.all([hydrateSession(), hydrateState()]).then(() => {
  applyRouteParams();
  if (routeName() === "home") {
    const defaultRoute = configuredDefaultRoute();
    if (defaultRoute !== "home" && routes[defaultRoute]) {
      history.replaceState(null, "", `/${defaultRoute}`);
    }
  }
  routes[routeName()] ? routes[routeName()]() : home();
});
