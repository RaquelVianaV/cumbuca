const app = document.querySelector("#app");
const title = document.querySelector("#page-title");
const todayDate = document.querySelector("#today-date");
const serverStatus = document.querySelector("#server-status");
const databaseStatus = document.querySelector("#database-status");
const saveStatus = document.querySelector("#save-status");
const backupButton = document.querySelector("#backup-button");
const logoutButton = document.querySelector("#logout-button");
const navLinks = [...document.querySelectorAll("[data-route]")];

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
    serverStatus.textContent = "Servidor online";
    serverStatus.classList.add("online");
    serverStatus.classList.remove("offline");
    databaseStatus.textContent = result.database ? "Banco online" : "Banco offline";
    databaseStatus.classList.toggle("online", Boolean(result.database));
    databaseStatus.classList.toggle("offline", !result.database);
  } catch (error) {
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
      setSaveStatus("Salvando só local", "offline");
      return;
    }

    setSaveStatus("Supabase ok - backup manual", "online");
  } catch (error) {
    setSaveStatus("Sem confirmação do Supabase", "offline");
  }
}

if (logoutButton) {
  logoutButton.addEventListener("click", async () => {
    await fetch("/api/logout", { method: "POST" });
    location.href = "/login";
  });
}

const LOW_MONTHLY_QUANTITY = 5;
const incomeCategories = [
  ["venda", "Venda"],
  ["ifood", "iFood"],
  ["99", "99"],
  ["ajuste-conta", "Ajuste da conta"]
];
const expenseCategories = [
  ["supermercado", "Supermercado"],
  ["despesas-gerais", "Despesas gerais"],
  ["boleto", "Boleto"],
  ["funcionarios", "Funcionarios"],
  ["entregador", "Entregador"],
  ["99-uber", "99/Uber"],
  ["adesivos", "Adesivos"],
  ["aluguel", "Aluguel"],
  ["enel", "Enel"],
  ["contador", "Contador"],
  ["impostos", "Impostos"],
  ["nubank-cumbuca", "Nubank Cumbuca"],
  ["bee-delivery", "Bee Delivery"],
  ["gas", "Gas"],
  ["vivo", "Vivo"],
  ["retirada", "Retirada"],
  ["vanessa", "Vanessa"],
  ["raquel", "Raquel"],
  ["cofrinho", "Cofrinho"],
  ["troco", "Troco"],
  ["diferenca", "Diferenca"],
  ["ajuste-conta", "Ajuste da conta"],
  ["outros", "Outros"]
];
const defaultExpenseReasons = [
  "Supermercado",
  "Despesas gerais",
  "Funcionarios",
  "Entregador",
  "99/Uber",
  "Adesivos",
  "Jean Veiculos / MARTINS",
  "Gv Distribuidora / IDEAL",
  "Mab",
  "Praso",
  "Frical",
  "Frigorifico",
  "Sanduiches",
  "Sucos",
  "Semear",
  "Aluguel",
  "Enel",
  "Contador",
  "Impostos",
  "Nubank Cumbuca",
  "Bee Delivery",
  "Gas",
  "Vivo",
  "Vanessa",
  "Raquel",
  "Cofrinho",
  "Troco",
  "Diferenca"
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
  expenseReasons: seededExpenseReasons(),
  archivedExpenseReasons: localValue("archivedExpenseReasons", []),
  auditLog: localValue("auditLog", []),
  auditFilter: localValue("auditFilter", { date: "", action: "all" }),
  monthlyClosings: localValue("monthlyClosings", {}),
  showClients: false,
  showOrders: false,
  showPlanning: false,
  showMonthSummary: false,
  clientTab: "form",
  orderTab: "form",
  clientSearch: "",
  orderSearch: "",
  editClientIndex: null,
  editOrderId: null,
  editCashId: null,
  cashPanelTab: "entry",
  editStoreSaleId: null,
  editExpenseReasonIndex: null,
  ingredients: localValue("pricingIngredients", []),
  pricingConfig: localValue("pricingConfig", {}),
  cashFilter: localValue("cashFilter", { period: "all" }),
  financialPlanning: localValue("financialPlanning", {
    savings: "",
    improvements: [],
    purchases: []
  }),
  reportPeriod: localValue("reportPeriod", {
    type: "month",
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    week: 1,
    start: "",
    end: "",
    expenseCategory: "all"
  }),
  currentUser: null,
  database: false
};

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
    expenseReasons: state.expenseReasons,
    archivedExpenseReasons: state.archivedExpenseReasons,
    auditLog: state.auditLog,
    monthlyClosings: state.monthlyClosings,
    pricingIngredients: state.ingredients,
    pricingConfig: state.pricingConfig,
    cashFilter: state.cashFilter,
    financialPlanning: state.financialPlanning
  };
}

function persistLocal() {
  Object.entries(appStatePayload()).forEach(([key, value]) => {
    localStorage.setItem(key, JSON.stringify(value));
  });
}

function recordAudit(action, detail) {
  state.auditLog.unshift({
    id: Date.now(),
    at: new Date().toISOString(),
    action,
    detail,
    user: state.currentUser?.name || state.currentUser?.username || ""
  });
  state.auditLog = state.auditLog.slice(0, 120);
}

async function persistState() {
  persistLocal();
  setSaveStatus("Salvando...");
  try {
    const response = await fetch("/api/state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state: appStatePayload() })
    });
    const result = await response.json();
    if (response.ok && result.database) {
      const now = shortDateTime.format(new Date());
      setSaveStatus(`Salvo no Supabase ${now}`, "online");
      showToast("Salvo no Supabase", "success");
    } else {
      setSaveStatus("Salvo só neste navegador", "offline");
      showToast("Salvo só neste navegador", "warning");
    }
  } catch (error) {
    setSaveStatus("Salvo só neste navegador", "offline");
    showToast("Sem confirmação do Supabase", "warning");
    // localStorage keeps the app usable if the network is unavailable.
  }
}

async function hydrateState() {
  try {
    const response = await fetch("/api/state", { cache: "no-store" });
    if (!response.ok) {
      return;
    }
    const result = await response.json();
    state.database = Boolean(result.database);
    const saved = result.state || {};
    state.cash = saved.cashEntries || state.cash;
    state.menus = saved.weeklyMenusByPeriod || state.menus;
    state.menuWeek = Number(saved.menuWeek || state.menuWeek);
    state.menuPeriod = saved.menuPeriod || state.menuPeriod;
    state.menuDates = saved.menuDatesByPeriod || state.menuDates;
    state.clients = saved.clients || state.clients;
    state.orders = saved.orders || state.orders;
    state.storeSales = saved.storeSales || state.storeSales;
    state.expenseReasons = Array.isArray(saved.expenseReasons) && saved.expenseReasons.length
      ? saved.expenseReasons
      : (Array.isArray(saved.suppliers) && saved.suppliers.length ? saved.suppliers : state.expenseReasons);
    state.archivedExpenseReasons = saved.archivedExpenseReasons || state.archivedExpenseReasons;
    state.auditLog = saved.auditLog || state.auditLog;
    state.monthlyClosings = saved.monthlyClosings || state.monthlyClosings;
    state.ingredients = saved.pricingIngredients || state.ingredients;
    state.pricingConfig = saved.pricingConfig || state.pricingConfig;
    state.cashFilter = saved.cashFilter || state.cashFilter;
    state.financialPlanning = saved.financialPlanning || state.financialPlanning;
    persistLocal();
  } catch (error) {
    state.database = false;
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
  } catch (error) {
    state.currentUser = null;
  }
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

  state.cash = data.cashEntries || state.cash;
  state.menus = data.weeklyMenusByPeriod || state.menus;
  state.menuWeek = Number(data.menuWeek || state.menuWeek);
  state.menuPeriod = data.menuPeriod || state.menuPeriod;
  state.menuDates = data.menuDatesByPeriod || state.menuDates;
  state.clients = data.clients || state.clients;
  state.orders = data.orders || state.orders;
  state.storeSales = data.storeSales || state.storeSales;
  state.expenseReasons = data.expenseReasons || state.expenseReasons;
  state.archivedExpenseReasons = data.archivedExpenseReasons || state.archivedExpenseReasons;
  state.auditLog = data.auditLog || state.auditLog;
  state.monthlyClosings = data.monthlyClosings || state.monthlyClosings;
  state.ingredients = data.pricingIngredients || state.ingredients;
  state.pricingConfig = data.pricingConfig || state.pricingConfig;
  state.cashFilter = data.cashFilter || state.cashFilter;
  state.financialPlanning = data.financialPlanning || state.financialPlanning;

  recordAudit("backup_importado", file.name || "backup manual");
  await persistState();
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
    pricingIngredients: state.ingredients.length,
    auditLog: state.auditLog.length
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
  state.menus = Object.fromEntries(Object.entries(state.menus || {}).filter(([key]) => yearFromMenuKey(key) !== target));
  state.menuDates = Object.fromEntries(Object.entries(state.menuDates || {}).filter(([key]) => yearFromMenuKey(key) !== target));
  state.monthlyClosings = Object.fromEntries(Object.entries(state.monthlyClosings || {}).filter(([key]) => !String(key || "").startsWith(target)));

  recordAudit("limpeza_ano", `${target}: ${JSON.stringify(preview)}`);
  await persistState();
  return preview;
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

function routeName() {
  return location.pathname.replace("/", "") || "home";
}

function setActive(route) {
  navLinks.forEach(link => {
    link.classList.toggle("active", link.dataset.route === route);
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

function money(value) {
  return brl.format(Number(value || 0));
}

function isoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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

function filterCashEntries(entries) {
  const { period, date, month, year, search, type, category } = state.cashFilter;
  const query = String(search || "").trim().toLowerCase();
  const searchedEntries = query
    ? entries.filter(entry => [
      entry.description,
      entry.category,
      categoryName(entry.category),
      entry.type === "expense" ? "saida" : "entrada"
    ].some(value => String(value || "").toLowerCase().includes(query)))
    : entries;

  const typedEntries = type && type !== "all"
    ? searchedEntries.filter(entry => (type === "expense" ? entry.type === "expense" : entry.type !== "expense"))
    : searchedEntries;

  const categorizedEntries = category && category !== "all"
    ? typedEntries.filter(entry => normalizedCategory(entry.category) === normalizedCategory(category))
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

function categoryName(value) {
  if (String(value || "").startsWith("supplier:")) {
    return String(value).replace(/^supplier:/, "");
  }
  if (String(value || "").startsWith("reason:")) {
    return String(value).replace(/^reason:/, "");
  }
  return [...incomeCategories, ...expenseCategories].find(([key]) => key === value)?.[1] || "Outros";
}

function expenseReasonOptions() {
  return [...new Set((state.expenseReasons || []).map(name => String(name || "").trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "pt-BR"))
    .map(name => [`reason:${name}`, name]);
}

function cashFilterCategoryOptions(selected = "all", type = "all") {
  const normalizedSelected = normalizedCategory(selected || "all");
  let selectedApplied = normalizedSelected === "all";
  const groups = [];

  if (!type || type === "all" || type === "income") {
    groups.push(["Entradas", incomeCategories]);
  }

  if (!type || type === "all" || type === "expense") {
    groups.push(["Saídas", [...expenseCategories, ...expenseReasonOptions()]]);
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

function cashCategoryOptions(type, selected = "") {
  const normalizedSelected = normalizedCategory(selected);
  const options = type === "expense"
    ? [...expenseCategories, ...expenseReasonOptions()]
    : incomeCategories;

  return options.map(([value, label]) => `
    <option value="${value}" ${normalizedSelected === value ? "selected" : ""}>${label}</option>
  `).join("");
}

function isBillCategory(value) {
  const normalized = String(value || "").replace(/^supplier:/, "reason:").toLowerCase();
  return normalized === "boleto" || normalized === "reason:boleto" || normalized.includes("boleto");
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

function expenseReasonsPanel(className = "panel supplier-panel") {
  const editingIndex = state.editExpenseReasonIndex;
  const activeReasons = activeExpenseReasons();
  const archivedReasons = (state.archivedExpenseReasons || []).filter(Boolean);
  const editing = editingIndex !== null ? activeReasons[editingIndex] : "";

  return `
    <section class="${className}">
      <h2>Motivos de saída</h2>
      <form id="expense-reason-form" class="form-grid single">
        <label>${editing ? "Editar motivo" : "Novo motivo"}
          <input name="reason" value="${editing || ""}" placeholder="Ex.: Supermercado, Praso, Frical" required>
        </label>
        <div class="actions">
          <button type="submit">${editing ? "Salvar edição" : "Cadastrar"}</button>
          ${editing ? `<button class="secondary" type="button" id="cancel-expense-reason-edit">Cancelar</button>` : ""}
        </div>
      </form>
      ${activeReasons.length ? `
        <div class="reason-list">
          ${activeReasons.map((reason, index) => `
            <span>
              <b>${reason}</b>
              <button class="secondary table-action" type="button" data-edit-expense-reason="${index}">Editar</button>
              <button class="secondary table-action" type="button" data-archive-expense-reason="${index}">Arquivar</button>
            </span>
          `).join("")}
        </div>
      ` : `<p class="muted">Nenhum motivo cadastrado.</p>`}
      ${archivedReasons.length ? `
        <h3>Arquivados</h3>
        <div class="reason-list archived-reason-list">
          ${archivedReasons.map((reason, index) => `
            <span>
              <b>${reason}</b>
              <button class="secondary table-action" type="button" data-reactivate-expense-reason="${index}">Reativar</button>
            </span>
          `).join("")}
        </div>
      ` : ""}
    </section>
  `;
}
function cashTotals(entries = state.cash) {
  return entries.reduce((totals, entry) => {
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
  const total = Math.max(0, Number(amount || 0));
  const savings = total * 0.10;
  const remaining = total - savings;
  const vanessa = remaining * 0.70;
  const raquel = remaining * 0.30;

  return { total, savings, remaining, vanessa, raquel };
}

function accountBalanceAdjustment(targetBalance, currentBalance) {
  const target = Number(targetBalance || 0);
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
    .filter(entry => entry.category === "ajuste-conta" || String(entry.id || "").startsWith("account-adjustment-"))
    .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")) || String(b.id || "").localeCompare(String(a.id || "")))
    .slice(0, limit);
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
          ${entry.description || "Ajuste da conta"}
          <small>${formatIsoDateBr(entry.date)}</small>
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

  cashEntries.forEach(entry => {
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

function reportWeekRangeLabel() {
  const { start, end } = reportWeekRange();
  return `${formatIsoDateBr(start)} a ${formatIsoDateBr(end)}`;
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
    return client.plan === "semanal" && !order.paid;
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
  const end = isoDate(new Date(Date.now() + 30 * 86400000));

  return state.cash
    .filter(entry => entry.type === "expense")
    .map(entry => ({
      ...entry,
      reminderDate: paymentReminderDate(entry)
    }))
    .filter(entry => entry.reminderDate && entry.reminderDate <= end)
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
  const monthCash = state.cash.filter(entry => String(entry.date || "").startsWith(monthKey));
  const todayKey = isoDate(new Date());
  const todayCash = state.cash.filter(entry => entry.date === todayKey);
  const todayOrders = weekOrders.filter(order => String(order.createdAt || "").slice(0, 10) === todayKey);
  const weekStart = isoDate(startOfWeek(new Date()));
  const weekEnd = isoDate(endOfWeek(new Date()));
  const weekCash = state.cash.filter(entry => {
    const date = String(entry.date || "");
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
  const recentExpenses = [...state.cash]
    .filter(entry => entry.type === "expense")
    .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))
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
    alerts.push(["Cliente sem endereco", `${metrics.clientsWithoutAddress.length} cadastro(s)`]);
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

function home() {
  title.textContent = "Cumbuca";
  setActive("");
  app.innerHTML = `
    <div class="home-grid">
      ${[
        ["fluxo-de-caixa", "Fluxo de Caixa", "Organize entradas, saídas e saldo previsto."],
        ["menu-semanal", "Menu Semanal", "Planeje pratos, custos e status de preparo."],
        ["loja", "Loja", "Lance cumbucas vendidas no balcão por dia."],
        ["financeiro", "Financeiro", "Confira entradas, semanal, saídas, retiradas e fechamento."],
        ["precificacao", "Precificação", "Calcule preço de venda com margem e taxas."],
        ["relatorios", "Relatórios", "Acompanhe vendas, caixa, clientes e cardápio por mês."]
      ].map(([href, heading, text]) => `
        <a class="card" href="/${href}">
          <span class="card-icon" aria-hidden="true"></span>
          <div>
            <h2>${heading}</h2>
            <p>${text}</p>
          </div>
          <strong>Abrir ferramenta</strong>
        </a>
      `).join("")}
    </div>
  `;

  const metrics = homeMetricData();
  const weeklyOrders = state.orders.filter(order => order.menuKey === menuKey(state.menuWeek || 1)).length;
  const alerts = dashboardAlerts(metrics, weeklyOrders);
  const tools = [
    ["fluxo-de-caixa", "Fluxo de Caixa", "Entradas, saídas e saldo", money(metrics.weekBalance), "Saldo da semana"],
    ["menu-semanal", "Menu Semanal", "Pratos, preparo e pedidos", `${metrics.ready}/${metrics.planned || 0}`, "Prontos na semana"],
    ["loja", "Loja", "Vendas do balcão por data", String(metrics.storeToday), "Cumbucas hoje"],
    ["financeiro", "Financeiro", "Conferência financeira", money(metrics.balance), "Saldo do mês"],
    ["precificacao", "Precificação", "Ingredientes, margem e venda", String(state.ingredients.length), "Itens cadastrados"],
    ["relatorios", "Relatórios", "Leituras mensais e exportações", String(metrics.bowls), "Cumbucas no mês"]
  ];

  app.innerHTML = `
    <section class="dashboard-band">
      <div class="dashboard-copy">
        <span>Painel ${metrics.monthKey}</span>
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

    <div class="home-grid">
      ${tools.map(([href, heading, text, value, label]) => `
        <a class="card" href="/${href}">
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
            <strong>Abrir</strong>
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
        <h2>Alertas</h2>
        ${alerts.length ? `
          <div class="alert-list">
            ${alerts.map(([label, detail]) => `<span><b>${label}</b>${detail}</span>`).join("")}
          </div>
        ` : `<p class="muted">Nenhum alerta agora.</p>`}
      </div>
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
          <a href="/menu-semanal">Pedido</a>
          <a href="/financeiro">Financeiro</a>
          <a href="/backups">Backup</a>
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

    <section class="panel dashboard-panel">
      <h2>Despesas recentes</h2>
      ${metrics.recentExpenses.length ? `
          <div class="recent-list">
            ${metrics.recentExpenses.map(entry => `
              <span><b>${money(entry.amount)}</b>${entry.description || "Despesa"}<small>${formatIsoDateBr(entry.date)}</small></span>
            `).join("")}
          </div>
        ` : `<p class="muted">Nenhuma despesa lançada ainda.</p>`}
    </section>
    <section class="panel dashboard-panel">
      <h2>Maiores gastos do mês</h2>
      ${metrics.topMonthExpenses.length ? `
          <div class="recent-list">
            ${metrics.topMonthExpenses.map(entry => `
              <span><b>${money(entry.amount)}</b>${entry.description || categoryName(entry.category)}<small>${categoryName(entry.category)} - ${formatIsoDateBr(entry.date)}</small></span>
            `).join("")}
          </div>
        ` : `<p class="muted">Nenhuma despesa operacional no mês.</p>`}
    </section>
  `;
}

async function renderCash() {
  title.textContent = "Fluxo de Caixa";
  setActive("fluxo-de-caixa");
  ensureCashEntryIds();
  const editing = state.editCashId !== null
    ? state.cash.find(entry => String(entry.id) === String(state.editCashId))
    : null;
  const filteredEntries = filterCashEntries(state.cash);
  const result = await postJson("/api/fluxo-de-caixa", { entries: filteredEntries });
  const today = isoDate(new Date());
  const selectedDate = state.cashFilter.date || today;
  const selectedMonth = state.cashFilter.month || today.slice(0, 7);
  const selectedYear = state.cashFilter.year || today.slice(0, 4);
  const selectedFilterType = state.cashFilter.type || "all";
  const selectedFilterCategory = state.cashFilter.category || "all";
  const totalCash = cashTotals(state.cash);
  const previewWithdrawal = withdrawalSplit(totalCash.balance);
  const activeCashPanel = editing ? "entry" : (state.cashPanelTab || "entry");

  app.innerHTML = `
    <div class="cash-layout">
      <section class="panel cash-command-panel">
        <div class="cash-panel-tabs" role="tablist" aria-label="Ferramentas do caixa">
          ${[
            ["entry", editing ? "Editar" : "Lançamento"],
            ["reconciliation", "Conciliação"],
            ["withdrawals", "Retiradas"],
            ["reasons", "Motivos"]
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
          <label>Valor
            <input name="amount" type="number" min="0" step="0.01" placeholder="0,00" value="${editing?.amount || ""}" required>
          </label>
          <div class="actions">
            <button type="submit">${editing ? "Salvar edição" : "Adicionar"}</button>
            ${editing ? `<button class="secondary" type="button" id="cancel-cash-edit">Cancelar</button>` : ""}
            <button class="secondary" type="button" id="clear-cash">Limpar</button>
          </div>
        </form>
        </div>
        ` : ""}
        ${activeCashPanel === "reconciliation" ? `
        <div class="cash-tab-section account-balance-panel">
        <h2>Conciliação da conta</h2>
        <form id="account-balance-form" class="form-grid single">
          <div class="summary reconciliation-summary">
            <div class="metric"><span>Saldo calculado</span><strong>${money(totalCash.balance)}</strong></div>
            <div class="metric"><span>Saldo real</span><strong id="account-real-preview">${money(Math.max(0, totalCash.balance))}</strong></div>
            <div class="metric"><span>Diferença</span><strong id="account-difference-preview">${money(0)}</strong></div>
          </div>
          <label>Saldo real da conta
            <input name="balance" type="number" min="0" step="0.01" placeholder="0,00" value="${Math.max(0, totalCash.balance).toFixed(2)}" required>
          </label>
          <label>Data do ajuste
            <input name="date" type="date" value="${today}" required>
          </label>
          <button type="submit">Ajustar conta</button>
        </form>
        <h3>Histórico de ajustes</h3>
        ${accountAdjustmentHistoryHtml()}
        </div>
        ` : ""}
        ${activeCashPanel === "withdrawals" ? `
        <div class="cash-tab-section withdrawal-panel">
        <h2>Retiradas</h2>
        <form id="withdrawal-form" class="form-grid single">
          <label>Data
            <input name="date" type="date" value="${today}" required>
          </label>
          <label>Valor a distribuir
            <input name="amount" type="number" min="0" max="${Math.max(0, totalCash.balance)}" step="0.01" value="${Math.max(0, totalCash.balance).toFixed(2)}" required>
          </label>
          <div class="withdrawal-preview" aria-live="polite">
            <span><b>Caixa disponivel</b>${money(totalCash.balance)}</span>
            <span><b>Cofrinho 10%</b>${money(previewWithdrawal.savings)}</span>
            <span><b>Vanessa 70%</b>${money(previewWithdrawal.vanessa)}</span>
            <span><b>Raquel 30%</b>${money(previewWithdrawal.raquel)}</span>
          </div>
          <button type="submit" ${totalCash.balance > 0 ? "" : "disabled"}>Registrar retiradas</button>
        </form>
        </div>
        ` : ""}
        ${activeCashPanel === "reasons" ? expenseReasonsPanel("cash-tab-section supplier-panel") : ""}
      </section>
      <section class="panel cash-ledger-panel">
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
          <div class="metric"><span>Saldo</span><strong class="${result.balance < 0 ? "negative" : "positive"}">${money(result.balance)}</strong></div>
        </div>
        ${cashCategorySummary(result.entries)}
        ${cashTable(result.entries)}
      </section>
    </div>
  `;

  document.querySelectorAll("[data-cash-panel]").forEach(button => {
    button.addEventListener("click", event => {
      state.cashPanelTab = event.currentTarget.dataset.cashPanel;
      if (state.cashPanelTab !== "entry") {
        state.editCashId = null;
      }
      renderCash();
    });
  });

  const cashForm = document.querySelector("#cash-form");
  if (cashForm) {
    cashForm.addEventListener("submit", event => {
    event.preventDefault();
    const values = readForm(event.currentTarget);
    const entry = {
      id: editing?.id || Date.now(),
      ...values
    };

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
  if (cashTypeField && cashCategoryField && cashDueDateField) {
    const updateCashDueDateVisibility = () => {
      const shouldShow = cashTypeField.value === "expense" && isBillCategory(cashCategoryField.value);
      cashDueDateField.hidden = !shouldShow;
      cashDueDateField.querySelector("input").required = shouldShow;
      if (!shouldShow) {
        cashDueDateField.querySelector("input").value = "";
      }
    };
    cashTypeField.addEventListener("change", event => {
      const type = event.currentTarget.value;
      cashCategoryField.innerHTML = cashCategoryOptions(type, type === "expense" ? "outros" : "venda");
      updateCashDueDateVisibility();
    });
    cashCategoryField.addEventListener("change", updateCashDueDateVisibility);
    updateCashDueDateVisibility();
  }

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
      const adjustment = accountBalanceAdjustment(accountBalanceForm.elements.balance.value, cashTotals(state.cash).balance);
      const realPreview = document.querySelector("#account-real-preview");
      const differencePreview = document.querySelector("#account-difference-preview");
      realPreview.textContent = money(adjustment.target);
      differencePreview.textContent = `${adjustment.difference < 0 ? "-" : ""}${money(adjustment.amount)}`;
      differencePreview.classList.toggle("negative", adjustment.difference < 0);
      differencePreview.classList.toggle("positive", adjustment.difference > 0);
    });

    accountBalanceForm.addEventListener("submit", event => {
    event.preventDefault();
    const values = readForm(event.currentTarget);
    const adjustment = accountBalanceAdjustment(values.balance, cashTotals(state.cash).balance);

    if (adjustment.amount <= 0.009) {
      showToast("O saldo informado ja esta igual ao saldo calculado.", "warning");
      return;
    }

    state.cash.push({
      id: `account-adjustment-${Date.now()}`,
      description: adjustment.type === "expense" ? "Ajuste do valor na conta" : "Valor existente na conta",
      date: values.date,
      type: adjustment.type,
      category: "ajuste-conta",
      amount: adjustment.amount.toFixed(2)
    });
    recordAudit("Valor na conta ajustado", `Conta ${money(adjustment.target)} - ajuste ${money(adjustment.amount)}`);
    persistState();
    renderCash();
    });
  }

  const withdrawalForm = document.querySelector("#withdrawal-form");
  if (withdrawalForm) {
    withdrawalForm.addEventListener("input", () => {
    const amount = Number(withdrawalForm.elements.amount.value || 0);
    const split = withdrawalSplit(amount);
    const preview = withdrawalForm.querySelector(".withdrawal-preview");
    preview.innerHTML = `
      <span><b>Caixa disponivel</b>${money(totalCash.balance)}</span>
      <span><b>Cofrinho 10%</b>${money(split.savings)}</span>
      <span><b>Vanessa 70%</b>${money(split.vanessa)}</span>
      <span><b>Raquel 30%</b>${money(split.raquel)}</span>
    `;
    });

    withdrawalForm.addEventListener("submit", event => {
    event.preventDefault();
    const values = readForm(event.currentTarget);
    const available = cashTotals(state.cash).balance;
    const split = withdrawalSplit(values.amount);

    if (split.total <= 0) {
      showToast("Informe um valor maior que zero.", "error");
      return;
    }

    if (split.total > available) {
      showToast("A retirada nao pode ser maior que o caixa disponivel.", "error");
      return;
    }

    const idBase = Date.now();
    state.cash.push(
      {
        id: `withdrawal-${idBase}-savings`,
        description: "Retirada - cofrinho",
        date: values.date,
        type: "expense",
        category: "retirada",
        amount: split.savings.toFixed(2)
      },
      {
        id: `withdrawal-${idBase}-vanessa`,
        description: "Retirada - Vanessa",
        date: values.date,
        type: "expense",
        category: "retirada",
        amount: split.vanessa.toFixed(2)
      },
      {
        id: `withdrawal-${idBase}-raquel`,
        description: "Retirada - Raquel",
        date: values.date,
        type: "expense",
        category: "retirada",
        amount: split.raquel.toFixed(2)
      }
    );
    recordAudit("Retirada registrada", `Total ${money(split.total)} - cofrinho ${money(split.savings)}, Vanessa ${money(split.vanessa)}, Raquel ${money(split.raquel)}`);
    persistState();
    renderCash();
    });
  }

  const filterForm = document.querySelector("#cash-filter-form");
  const periodField = document.querySelector("#cash-period");
  const filterTypeField = document.querySelector("#cash-filter-type");
  const filterCategoryField = document.querySelector("#cash-filter-category");

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
    state.cashFilter = readForm(event.currentTarget);
    persistState();
    renderCash();
  });

  document.querySelector("#clear-cash-filter").addEventListener("click", () => {
    state.cashFilter = { period: "all", date: today, month: today.slice(0, 7), year: today.slice(0, 4), type: "all", category: "all", search: "" };
    persistState();
    renderCash();
  });

  document.querySelectorAll("[data-cash-quick]").forEach(button => {
    button.addEventListener("click", event => {
      const quick = event.currentTarget.dataset.cashQuick;
      if (quick === "today") {
        state.cashFilter = { ...state.cashFilter, period: "day", date: today, month: selectedMonth, year: selectedYear };
      }
      if (quick === "week") {
        state.cashFilter = { ...state.cashFilter, period: "week", date: today, month: selectedMonth, year: selectedYear };
      }
      if (quick === "month") {
        state.cashFilter = { ...state.cashFilter, period: "month", date: today, month: today.slice(0, 7), year: selectedYear };
      }
      if (quick === "last-month") {
        state.cashFilter = { ...state.cashFilter, period: "month", date: today, month: lastMonthKey(), year: selectedYear };
      }
      persistState();
      renderCash();
    });
  });

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
      state.cash = state.cash.filter(item => String(item.id) !== String(id));
      if (String(state.editCashId) === String(id)) {
        state.editCashId = null;
      }
      recordAudit("Caixa excluído", `${removed?.description || "Lançamento"} - ${money(removed?.amount)}`);
      persistState();
      renderCash();
    });
  });
}

function cashTable(entries) {
  if (!entries.length) {
    return `<p class="muted">Nenhum lançamento ainda.</p>`;
  }

  return `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Data</th><th>Descrição</th><th>Tipo</th><th>Categoria</th><th>Vencimento</th><th>Valor</th><th></th></tr></thead>
        <tbody>
          ${entries.map(item => `
            <tr class="cash-row ${item.type === "income" ? "income-row" : "expense-row"}">
              <td>${formatIsoDateBr(item.date)}</td>
              <td>${item.description}</td>
              <td><span class="cash-type-badge ${item.type === "income" ? "income" : "expense"}">${item.type === "income" ? "Entrada" : "Saída"}</span></td>
              <td><span class="cash-category-badge">${categoryName(item.category)}</span></td>
              <td>${item.dueDate ? formatIsoDateBr(item.dueDate) : "-"}</td>
              <td class="${item.type === "income" ? "positive" : "negative"}">${money(item.amount)}</td>
              <td>
                <div class="table-actions">
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
      <input class="ingredient-value" name="ingredient-value-${menuIndex}-${ingredientIndex}" type="number" min="0" step="0.01" value="${ingredient.value || ""}" placeholder="R$">
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
      value: row.querySelector(".ingredient-value")?.value || ""
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
                    <input name="cost-${index}" type="number" min="0" step="0.01" value="${item.cost || ""}" placeholder="Soma dos ingredientes">
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
          planValue: data.planValue,
          monthlyQuantity: data.monthlyQuantity
        };
      }

      const client = {
        ...data,
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
        deliveryFeeField.value = client.weeklyDeliveryFee || client.deliveryFee || "";
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
      const weeklyValue = client.plan === "semanal" ? Number(data.get("weeklyValue") || 0) : 0;
      const deliveryFee = client.plan === "semanal" ? Number(data.get("orderDeliveryFee") || 0) : 0;
      const paid = client.plan === "semanal" && data.get("paid") === "on";

      if (!dishes.length) {
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
          Number(order.id) === id ? { ...order, paid: !order.paid } : order
        ));
        persistState();
        renderMenu();
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
        Number(order.id) === id ? { ...order, paid: !order.paid } : order
      ));
      persistState();
      renderMenu();
    });
  });

  const orderSearch = document.querySelector("[data-order-search]");
  if (orderSearch) {
    orderSearch.addEventListener("input", event => {
      state.orderSearch = event.currentTarget.value;
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

  document.querySelector("#menu-period-form").addEventListener("submit", event => {
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
          cost: ingredientTotal || data[`cost-${index}`],
          status: data[`status-${index}`],
          notes: data[`notes-${index}`]
        };
      });
      persistState();
      renderMenu();
    });

    document.querySelector("#clear-menu").addEventListener("click", () => {
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
          <input name="planValue" type="number" min="0" step="0.01" placeholder="0,00" value="${packageForMonth.planValue || ""}">
        </label>
        <label class="weekly-freight-value">Frete
          <input name="weeklyDeliveryFee" type="number" min="0" step="0.01" placeholder="0,00" value="${editing?.weeklyDeliveryFee || editing?.deliveryFee || ""}">
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
  const phone = String(order.clientPhone || "").replace(/\D/g, "");
  return `https://wa.me/55${phone}?text=${encodeURIComponent(orderWhatsAppText(order, plan))}`;
}

function productionListText(plan, currentKey) {
  const totals = weeklyDishTotals(plan, weeklyOrders(currentKey));
  if (!totals.length) {
    return "Sem pedidos para producao.";
  }

  return [
    `Lista de producao - ${currentKey}`,
    "",
    ...totals.map(item => `${item.quantity}x ${item.dish} (Cumbuca ${item.slot})`)
  ].join("\n");
}

function deliveryListText(currentKey) {
  const rows = weeklyOrders(currentKey)
    .map(order => ({ order, client: clientByPhone(order.clientPhone) }))
    .filter(({ client }) => String(client.address || "").trim());

  if (!rows.length) {
    return "Nenhuma entrega com endereco preenchido.";
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
        <h2>Lista de producao</h2>
        <button class="secondary" type="button" data-download-production>Baixar TXT</button>
      </div>
      ${totals.length ? `
        <div class="recent-list">
          ${totals.map(item => `<span><b>${item.quantity}</b>${item.dish}<small>Cumbuca ${item.slot}</small></span>`).join("")}
        </div>
      ` : `<p class="muted">Sem pedidos para producao ainda.</p>`}
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
      ` : `<p class="muted">Nenhuma entrega com endereco preenchido.</p>`}
    </section>
  `;
}

function orderTabs() {
  const tabs = [
    ["form", state.editOrderId ? "Editar pedido" : "Novo pedido"],
    ["orders", "Pedidos"],
    ["production", "Producao"],
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
            <input name="weeklyValue" type="number" min="0" step="0.01" placeholder="0,00" value="${editing?.amount || ""}" disabled>
          </label>
          <label>Valor em frete
            <input name="orderDeliveryFee" type="number" min="0" step="0.01" placeholder="0,00" value="${editing?.deliveryFee || ""}" disabled>
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

function orderList(plan, currentKey) {
  const query = String(state.orderSearch || "").trim().toLowerCase();
  const orders = weeklyOrders(currentKey).filter(order => {
    if (!query) {
      return true;
    }
    const client = clientByPhone(order.clientPhone);
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
      <div class="filter-bar">
        <label>Buscar pedido
          <input data-order-search placeholder="Cliente, telefone, pagamento ou observação" value="${state.orderSearch || ""}">
        </label>
      </div>
      <p class="muted">Nenhum pedido encontrado nesta semana.</p>
    `;
  }

  return `
    <div class="filter-bar">
      <label>Buscar pedido
        <input data-order-search placeholder="Cliente, telefone, pagamento ou observação" value="${state.orderSearch || ""}">
      </label>
    </div>
    <div class="table-wrap order-table">
      <table>
        <thead><tr><th>Cliente</th><th>Contato</th><th>Endereço</th><th>Pedido</th><th>Total</th><th>Valor em real</th><th>Valor em frete</th><th>Pagamento</th><th>Obs.</th><th></th></tr></thead>
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
                <td>${client.plan === "semanal" ? (order.paid ? `<span class="payment-badge paid">Pago</span>` : `<span class="payment-badge pending">Aguardando pagamento</span>`) : ""}</td>
                <td>${order.notes || ""}</td>
                <td>
                  <div class="table-actions">
                    <button class="secondary table-action" type="button" data-edit-order="${order.id}">Editar</button>
                    ${client.plan === "semanal" ? `<button class="secondary table-action" type="button" data-toggle-paid-order="${order.id}">${order.paid ? "Marcar pendente" : "Marcar pago"}</button>` : ""}
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
  `;
}

function paymentText(order, client) {
  if (client.plan === "mensalista") {
    return "Mensalista";
  }

  return order.paid ? "Pago" : "Aguardando pagamento";
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
      <!--
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
            <input name="weeklyValue" type="number" min="0" step="0.01" placeholder="0,00" value="${editing?.amount || ""}" disabled>
          </label>
          <label>Valor em frete
            <input name="orderDeliveryFee" type="number" min="0" step="0.01" placeholder="0,00" value="${editing?.deliveryFee || ""}" disabled>
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
      ${orderList(plan, currentKey)}
      -->
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
            <input name="unitCost" type="number" min="0" step="0.01" required>
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
            <input name="packaging" type="number" min="0" step="0.01" value="${savedConfig.packaging || ""}">
          </label>
          <label>Mão de obra
            <input name="labor" type="number" min="0" step="0.01" value="${savedConfig.labor || ""}">
          </label>
          <label>Custos fixos rateados
            <input name="overhead" type="number" min="0" step="0.01" value="${savedConfig.overhead || ""}">
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
    </div>
  `;

  document.querySelector("#ingredient-form").addEventListener("submit", event => {
    event.preventDefault();
    state.ingredients.push(readForm(event.currentTarget));
    persistState();
    renderPricing();
  });

  document.querySelector("#pricing-form").addEventListener("submit", event => {
    event.preventDefault();
    state.pricingConfig = readForm(event.currentTarget);
    persistState();
    renderPricing();
  });

  document.querySelector("#clear-pricing").addEventListener("click", () => {
    state.ingredients = [];
    state.pricingConfig = {};
    persistState();
    renderPricing();
  });
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
  if ((state.reportPeriod.type || "month") !== "week") {
    return state.cash.filter(entry => String(entry.date || "").startsWith(periodKey));
  }

  const { start, end } = reportWeekRange();

  return state.cash.filter(entry => {
    const date = String(entry.date || "");
    return date >= start && date <= end;
  });
}

function reportStoreSales(periodKey) {
  if ((state.reportPeriod.type || "month") !== "week") {
    return state.storeSales.filter(entry => String(entry.date || "").startsWith(periodKey));
  }

  const { start, end } = reportWeekRange();
  return state.storeSales.filter(entry => {
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
  const orders = type === "week"
    ? state.orders.filter(order => order.menuKey === weekKey)
    : state.orders.filter(order => menuPeriodKeyFromKey(order.menuKey) === periodKey);
  const weeks = type === "week" ? [selectedWeek] : [1, 2, 3, 4, 5];
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
  const orderRevenue = orders.reduce((sum, order) => sum + Number(order.amount || 0), 0);
  const deliveryRevenue = orders.reduce((sum, order) => sum + Number(order.deliveryFee || 0), 0);
  const totalQuantity = orders.reduce((sum, order) => sum + orderQuantity(order), 0);
  const storeQuantity = storeSales.reduce((sum, entry) => sum + Number(entry.quantity || 0), 0);
  const weeklyCashQuantity = totalQuantity;
  const totalIncome = income;
  const paidOrders = orders.filter(order => {
    const client = clientByPhone(order.clientPhone);
    return client.plan === "mensalista" || order.paid;
  }).length;

  return {
    type,
    periodKey,
    weekKey,
    selectedWeek,
    cashEntries,
    storeSales,
    incomeEntries,
    expenseEntries,
    orders,
    menuWeeks,
    income,
    expenses,
    financial,
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
        return client.plan === "semanal" && order.paid;
      })
      .reduce((sum, order) => sum + Number(order.amount || 0), 0)],
    ["Pedidos semanais pendentes", data.orders
      .filter(order => {
        const client = clientByPhone(order.clientPhone);
        return client.plan === "semanal" && !order.paid;
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

function monthlyOriginCategoryPanel(data) {
  const incomeRows = moneyRowsByCategory(data.cashEntries, "income");
  const expenseRows = moneyRowsByCategory(data.cashEntries, "expense");
  const topExpenses = [...data.expenseEntries]
    .sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0))
    .slice(0, 5)
    .map(entry => [entry.description || categoryName(entry.category), Number(entry.amount || 0)]);
  const previousKey = previousMonthKeyFromPeriod(data.periodKey);
  const previousCash = state.cash.filter(entry => String(entry.date || "").startsWith(previousKey));
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
        <h2>Saídas por categoria</h2>
        ${compactMoneyList(expenseRows, "Nenhuma saída no período.")}
      </div>
    </section>
    <section class="dashboard-lane monthly-breakdown">
      <div class="panel dashboard-panel">
        <h2>Maiores despesas</h2>
        ${compactMoneyList(topExpenses, "Nenhuma despesa no período.")}
      </div>
      <div class="panel dashboard-panel">
        <h2>Comparação com ${previousKey}</h2>
        <div class="summary comparison-summary">
          <div class="metric"><span>Entradas</span><strong class="${incomeDelta < 0 ? "negative" : "positive"}">${incomeDelta < 0 ? "-" : "+"}${money(Math.abs(incomeDelta))}</strong></div>
          <div class="metric"><span>Saídas</span><strong class="${expenseDelta > 0 ? "negative" : "positive"}">${expenseDelta < 0 ? "-" : "+"}${money(Math.abs(expenseDelta))}</strong></div>
          <div class="metric"><span>Saldo</span><strong class="${balanceDelta < 0 ? "negative" : "positive"}">${balanceDelta < 0 ? "-" : "+"}${money(Math.abs(balanceDelta))}</strong></div>
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
      descricao: entry.description || "",
      tipo: entry.type === "expense" ? "saida" : "entrada",
      categoria: categoryName(entry.category),
      valor: Number(entry.amount || 0)
    }));
  }

  if (kind === "financial") {
    const rows = [
      { secao: "resumo", data: "", descricao: "Entradas no caixa", tipo: "entrada", categoria: "", valor: data.financial.income },
      { secao: "resumo", data: "", descricao: "Saídas operacionais", tipo: "saida", categoria: "operacional", valor: data.financial.operationalExpenses },
      { secao: "resumo", data: "", descricao: "Lucro antes das retiradas", tipo: "saldo", categoria: "", valor: data.financial.profitBeforeWithdrawals },
      { secao: "resumo", data: "", descricao: "Retiradas já feitas", tipo: "saida", categoria: "retirada", valor: data.financial.withdrawals.total },
      { secao: "resumo", data: "", descricao: "Disponível para retirada", tipo: "saldo", categoria: "", valor: data.financial.availableForWithdrawal },
      { secao: "retiradas", data: "", descricao: "Cofrinho", tipo: "saida", categoria: "retirada", valor: data.financial.withdrawals.savings },
      { secao: "retiradas", data: "", descricao: "Vanessa", tipo: "saida", categoria: "retirada", valor: data.financial.withdrawals.vanessa },
      { secao: "retiradas", data: "", descricao: "Raquel", tipo: "saida", categoria: "retirada", valor: data.financial.withdrawals.raquel }
    ];

    return rows.concat(data.cashEntries.map(entry => ({
      secao: isWithdrawalEntry(entry) ? "lancamento_retirada" : "lancamento_caixa",
      data: entry.date || "",
      descricao: entry.description || "",
      tipo: entry.type === "expense" ? "saida" : "entrada",
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
        observacao: order.notes || ""
      };
    });
  }

  if (kind === "clients") {
    return state.clients.map(client => ({
      nome: client.name || "",
      contato: client.phone || "",
      plano: client.plan === "mensalista" ? "mensalista" : "semanal",
      endereco: [client.address, client.complement].filter(Boolean).join(" - "),
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
    : data.periodKey;
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
  const periodLabel = data.type === "week" ? reportWeekRangeLabel() : data.periodKey;
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
      withdrawalTotal: data.financial.withdrawals.total,
      withdrawalRows: [
        ["Cofrinho", money(data.financial.withdrawals.savings)],
        ["Vanessa", money(data.financial.withdrawals.vanessa)],
        ["Raquel", money(data.financial.withdrawals.raquel)]
      ],
      accountIncome: data.income,
      weeklyRevenue: data.orderRevenue,
      incomeSummaryRows: [
        ...accountIncomeBreakdown(data).map(([label, value]) => ["Conta", label, value]),
        ...weeklyRevenueBreakdown(data).map(([label, value]) => ["Semanal", label, value]),
        ["Total", "Conta + semanal", money(data.income + data.orderRevenue)]
      ],
      totalSoldQuantity: data.totalSoldQuantity,
      weeklyCashQuantity: data.weeklyCashQuantity,
      storeQuantity: data.storeQuantity,
      incomeRows: data.incomeEntries.map(entry => [entry.date || "", entry.description || "", money(entry.amount)]),
      expenseRows: data.topExpenses.map(entry => [entry.date || "", entry.description || "", categoryName(entry.category), money(entry.amount)]),
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
  const periodLabel = data.type === "week" ? reportWeekRangeLabel() : data.periodKey;
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
      withdrawalTotal: data.financial.withdrawals.total,
      withdrawalRows: [
        ["Cofrinho", Number(data.financial.withdrawals.savings || 0)],
        ["Vanessa", Number(data.financial.withdrawals.vanessa || 0)],
        ["Raquel", Number(data.financial.withdrawals.raquel || 0)]
      ],
      totalSoldQuantity: data.totalSoldQuantity,
      weeklyCashQuantity: data.weeklyCashQuantity,
      storeQuantity: data.storeQuantity,
      incomeRows: data.incomeEntries.map(entry => [entry.date || "", entry.description || "", Number(entry.amount || 0)]),
      expenseRows: data.topExpenses.map(entry => [entry.date || "", entry.description || "", categoryName(entry.category), Number(entry.amount || 0)]),
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
  const baseName = data.type === "week"
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
      menuWeeks: data.menuWeeks
    }, null, 2), "application/json");
    return;
  }

  downloadTextFile(`${baseName}-${kind}.csv`, toCsv(reportCsvRows(kind, data)), "text/csv;charset=utf-8");
}

function reportOrdersTable(data) {
  if (!data.orders.length) {
    return `<p class="muted">Nenhum pedido neste periodo.</p>`;
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
    return `<p class="muted">Nenhuma entrada de caixa neste periodo.</p>`;
  }

  return `
    <div class="summary">
      <div class="metric report-metric">
        <span>Total de entradas no periodo</span>
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
      <div class="metric report-metric"><span>Lancamentos</span><strong>${entries.length}</strong></div>
    </div>
    <div class="table-wrap report-table">
      <table>
        <thead><tr><th>Data</th><th>Motivo</th><th>Descrição</th><th>Valor</th></tr></thead>
        <tbody>
          ${topEntries.map(entry => `
            <tr>
              <td>${entry.date || ""}</td>
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
              <td>${entry.date || ""}</td>
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

function auditPanel() {
  const filter = state.auditFilter || { date: "", action: "all" };
  const actions = [...new Set(state.auditLog.map(item => item.action).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const items = state.auditLog
    .filter(item => !filter.date || String(item.at || "").startsWith(filter.date))
    .filter(item => !filter.action || filter.action === "all" || item.action === filter.action)
    .slice(0, 30);

  return `
    <section class="panel report-section">
      <div class="section-heading">
        <div>
          <h2>Auditoria</h2>
          <p class="muted-inline">Alterações registradas por data, ação e usuário.</p>
        </div>
      </div>
      <form id="audit-filter-form" class="filter-bar audit-filter-bar">
        <label>Data
          <input name="date" type="date" value="${filter.date || ""}">
        </label>
        <label>Ação
          <select name="action">
            <option value="all" ${filter.action === "all" ? "selected" : ""}>Todas</option>
            ${actions.map(action => `<option value="${escapeHtml(action)}" ${filter.action === action ? "selected" : ""}>${escapeHtml(action)}</option>`).join("")}
          </select>
        </label>
        <button type="submit">Filtrar</button>
        <button class="secondary" type="button" id="clear-audit-filter">Limpar</button>
      </form>
      ${items.length ? `
        <div class="audit-list">
          ${items.map(item => `
            <span>
              <b>${escapeHtml(item.action || "Alteração")}</b>
              ${escapeHtml(item.detail || "")}${item.user ? ` - ${escapeHtml(item.user)}` : ""}
              <small>${new Date(item.at).toLocaleString("pt-BR")}</small>
            </span>
          `).join("")}
        </div>
      ` : `<p class="muted">Nenhuma alteração encontrada para este filtro.</p>`}
    </section>
  `;
}

function bindAuditPanel(renderFn) {
  const form = document.querySelector("#audit-filter-form");
  if (!form) {
    return;
  }

  form.addEventListener("submit", event => {
    event.preventDefault();
    state.auditFilter = readForm(event.currentTarget);
    localStorage.setItem("auditFilter", JSON.stringify(state.auditFilter));
    renderFn();
  });

  document.querySelector("#clear-audit-filter").addEventListener("click", () => {
    state.auditFilter = { date: "", action: "all" };
    localStorage.setItem("auditFilter", JSON.stringify(state.auditFilter));
    renderFn();
  });
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
              <td>${entry.date || ""}</td>
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
    cashEntries: data.cashEntries.length
  };
}

function monthlyClosingPanel(data) {
  const closing = state.monthlyClosings[data.periodKey];

  return `
    <section class="panel report-section">
      <div class="section-heading">
        <div>
          <h2>Fechamento mensal</h2>
          <p class="muted-inline">Calcula faturamento, custos, retiradas e valor disponível do mês.</p>
        </div>
        <button type="button" id="close-month">${closing ? "Atualizar fechamento" : "Fechar mês"}</button>
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

  document.querySelector("#store-sale-form").addEventListener("submit", event => {
    event.preventDefault();
    const values = readForm(event.currentTarget);
    const entry = {
      id: editing?.id || Date.now(),
      date: values.date,
      quantity: Number(values.quantity || 0),
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
  if (data.type !== "week") {
    return "do mês";
  }

  return `de ${reportWeekRangeLabel()}`;
}

function reportExpenseCategoryOptions(selected = "all") {
  const categories = [...expenseCategories, ...expenseReasonOptions()];
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
    return category === selected || category.replace(/^supplier:/, "reason:") === selected;
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

function upcomingBills(limit = 6) {
  const end = isoDate(new Date(Date.now() + 30 * 86400000));

  return state.cash
    .filter(entry => entry.type === "expense")
    .map(entry => ({
      ...entry,
      reminderDate: paymentReminderDate(entry)
    }))
    .filter(entry => entry.reminderDate && entry.reminderDate <= end)
    .sort((a, b) => String(a.reminderDate).localeCompare(String(b.reminderDate)))
    .slice(0, limit);
}

function upcomingBillsPanel() {
  const bills = upcomingBills();

  return `
    <section class="panel report-section">
      <h2>Próximas contas</h2>
      ${bills.length ? `
        <div class="recent-list">
          ${bills.map(entry => `
            <span>
              <b>${money(entry.amount)}</b>
              ${entry.description || categoryName(entry.category)}
              <small>${formatIsoDateBr(entry.reminderDate)} - ${entry.dueDate ? dueDateDistanceLabel(entry.dueDate) : "Despesa programada"}</small>
            </span>
          `).join("")}
        </div>
      ` : `<p class="muted">Nenhuma conta com vencimento nos próximos 30 dias.</p>`}
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
          <input name="savings" type="number" min="0" step="0.01" placeholder="0,00" value="${planning.savings || ""}">
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
      savings: values.savings || "",
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
        <label>Periodo
          <select name="type" id="report-period-type">
            <option value="month" ${reportType === "month" ? "selected" : ""}>Mês</option>
            <option value="week" ${reportType === "week" ? "selected" : ""}>Semana</option>
          </select>
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
        <label class="report-week-field">Ate
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
      start: values.start || weekRange.start,
      end: values.end || weekRange.end,
      expenseCategory: values.expenseCategory || "all"
    };
    localStorage.setItem("reportPeriod", JSON.stringify(state.reportPeriod));
    const weeklyQuery = state.reportPeriod.type === "week" ? `&inicio=${state.reportPeriod.start}&fim=${state.reportPeriod.end}` : "";
    history.replaceState(null, "", `/${path}?ano=${state.reportPeriod.year}&mes=${state.reportPeriod.month}${weeklyQuery}`);
    renderFn();
  });
}

function bindMonthlyClosing(data, renderFn) {
  const closeMonthButton = document.querySelector("#close-month");
  if (!closeMonthButton) {
    return;
  }

  closeMonthButton.addEventListener("click", () => {
    if (state.monthlyClosings[data.periodKey] && !confirm(`Atualizar o fechamento de ${data.periodKey}?`)) {
      return;
    }

    const closing = monthlyClosingPayload(data);
    state.monthlyClosings = {
      ...state.monthlyClosings,
      [data.periodKey]: closing
    };
    recordAudit("Mês fechado", `${data.periodKey} - disponível ${money(closing.availableForWithdrawal)}`);
    persistState();
    renderFn();
  });
}

function renderFinance() {
  title.textContent = "Financeiro";
  setActive("financeiro");
  const data = reportData();
  const reportType = state.reportPeriod.type || "month";
  const weekRange = reportWeekRange();

  app.innerHTML = `
    ${financeFilterPanel(reportType, weekRange)}
    <section class="report-grid">
      <div class="metric report-metric"><span>Entrou no caixa</span><strong>${money(data.income)}</strong></div>
      <div class="metric report-metric"><span>Entrou com semanal</span><strong>${money(data.orderRevenue)}</strong></div>
      <div class="metric report-metric"><span>Saiu em saídas</span><strong>${money(data.expenses)}</strong></div>
      <div class="metric report-metric"><span>Saídas operacionais</span><strong>${money(data.financial.operationalExpenses)}</strong></div>
      <div class="metric report-metric"><span>Retiradas feitas</span><strong>${money(data.financial.withdrawals.total)}</strong></div>
      <div class="metric report-metric"><span>Disponível para retirada</span><strong class="${data.financial.availableForWithdrawal < 0 ? "negative" : "positive"}">${money(data.financial.availableForWithdrawal)}</strong></div>
    </section>
    ${reportType === "month" ? monthlyOriginCategoryPanel(data) : ""}
    ${upcomingBillsPanel()}
    ${financialPlanningPanel()}
    <section class="panel report-section">
      <h2>Retiradas ${reportTitleSuffix(data)}</h2>
      <div class="summary">
        <div class="metric"><span>Cofrinho</span><strong>${money(data.financial.withdrawals.savings)}</strong></div>
        <div class="metric"><span>Vanessa</span><strong>${money(data.financial.withdrawals.vanessa)}</strong></div>
        <div class="metric"><span>Raquel</span><strong>${money(data.financial.withdrawals.raquel)}</strong></div>
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
    ${auditPanel()}
  `;

  bindReportPeriodForm(renderFinance, "financeiro");
  bindMonthlyClosing(data, renderFinance);
  bindFinancialPlanning();
  bindAuditPanel(renderFinance);
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
          </select>
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
      <div class="metric report-metric"><span>Retiradas feitas</span><strong>${money(data.financial.withdrawals.total)}</strong></div>
      <div class="metric report-metric"><span>Disponível para retirada</span><strong class="${data.financial.availableForWithdrawal < 0 ? "negative" : "positive"}">${money(data.financial.availableForWithdrawal)}</strong></div>
      <div class="metric report-metric"><span>Pedidos pagos</span><strong>${data.paidOrders}</strong></div>
      <div class="metric report-metric"><span>Pedidos pendentes</span><strong>${data.pendingOrders}</strong></div>
      <div class="metric report-metric"><span>Clientes semanais</span><strong>${data.weeklyClients}</strong></div>
      <div class="metric report-metric"><span>Mensalistas</span><strong>${data.monthlyClients}</strong></div>
    </section>
    ${reportType === "month" ? monthlyOriginCategoryPanel(data) : ""}

    <section class="panel report-section">
      <h2>Retiradas ${reportTitleSuffix(data)}</h2>
      <div class="summary">
        <div class="metric"><span>Cofrinho</span><strong>${money(data.financial.withdrawals.savings)}</strong></div>
        <div class="metric"><span>Vanessa</span><strong>${money(data.financial.withdrawals.vanessa)}</strong></div>
        <div class="metric"><span>Raquel</span><strong>${money(data.financial.withdrawals.raquel)}</strong></div>
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
    ${auditPanel()}
  `;

  const reportFilterForm = document.querySelector("#report-filter-form");
  const reportTypeField = document.querySelector("#report-period-type");

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
      start: values.start || weekRange.start,
      end: values.end || weekRange.end,
      expenseCategory: values.expenseCategory || "all"
    };
    localStorage.setItem("reportPeriod", JSON.stringify(state.reportPeriod));
    const weeklyQuery = state.reportPeriod.type === "week" ? `&inicio=${state.reportPeriod.start}&fim=${state.reportPeriod.end}` : "";
    history.replaceState(null, "", `/relatorios?ano=${state.reportPeriod.year}&mes=${state.reportPeriod.month}${weeklyQuery}`);
    renderReports();
  });

  document.querySelectorAll("[data-export-report]").forEach(button => {
    button.addEventListener("click", event => {
      exportReport(event.currentTarget.dataset.exportReport);
    });
  });
  bindAuditPanel(renderReports);

  const closeMonthButton = document.querySelector("#close-month");
  if (closeMonthButton) {
    closeMonthButton.addEventListener("click", () => {
      if (state.monthlyClosings[data.periodKey] && !confirm(`Atualizar o fechamento de ${data.periodKey}?`)) {
        return;
      }

      const closing = monthlyClosingPayload(data);
      state.monthlyClosings = {
        ...state.monthlyClosings,
        [data.periodKey]: closing
      };
      recordAudit("Mês fechado", `${data.periodKey} - disponível ${money(closing.availableForWithdrawal)}`);
      persistState();
      renderReports();
    });
  }
}

async function renderBackups() {
  title.textContent = "Backups";
  setActive("backups");
  const years = cleanupYears();
  const selectedYear = years[0] || String(new Date().getFullYear() - 1);
  const preview = cleanupPreview(selectedYear);
  app.innerHTML = `
    <section class="panel report-section backup-manual-panel">
      <h2>Backup manual</h2>
      <p class="muted">O backup e salvo no seu computador, nao no Supabase. Baixe um JSON antes de mudancas grandes e importe esse arquivo se precisar recuperar os dados.</p>
      <div class="backup-actions">
        <button type="button" id="manual-backup-download">Baixar backup JSON</button>
        <label class="secondary file-action">
          Importar backup JSON
          <input id="manual-backup-import" type="file" accept="application/json,.json">
        </label>
      </div>
      <div class="backup-list-state">
        <strong>Automatico desligado</strong>
        <span>Nenhum backup novo sera gravado na tabela de backups do Supabase.</span>
      </div>
    </section>
    <section class="panel report-section backup-manual-panel">
      <h2>Manutencao do banco</h2>
      <p class="muted">Use para apagar dados antigos depois de baixar um backup JSON. Clientes, precificacao, categorias e configuracoes atuais sao preservados.</p>
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
  `;

  document.querySelector("#manual-backup-download").addEventListener("click", downloadBackup);
  loadRealDatabaseUsage();
  document.querySelector("#manual-backup-import").addEventListener("change", async event => {
    const file = event.currentTarget.files?.[0];
    if (!file) {
      return;
    }
    if (!confirm("Importar este backup? Isso vai substituir os dados atuais.")) {
      event.currentTarget.value = "";
      return;
    }
    try {
      await importBackupFile(file);
      showToast("Backup importado", "success");
      renderBackups();
    } catch (error) {
      showToast("Arquivo de backup invalido", "warning");
    }
  });

  const cleanupYearField = document.querySelector("#cleanup-year");
  const cleanupPreviewBox = document.querySelector("#cleanup-preview");
  cleanupYearField.addEventListener("change", event => {
    const year = event.currentTarget.value;
    cleanupPreviewBox.innerHTML = cleanupPreviewHtml(year, cleanupPreview(year));
    document.querySelector("#db-usage-status").innerHTML = databaseUsageHtml(year);
  });

  document.querySelector("#cleanup-backup-first").addEventListener("click", downloadBackup);
  document.querySelector("#delete-old-backups").addEventListener("click", async () => {
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
  document.querySelector("#cleanup-year-form").addEventListener("submit", async event => {
    event.preventDefault();
    const year = cleanupYearField.value;
    const currentPreview = cleanupPreview(year);
    const total = Object.values(currentPreview).reduce((sum, value) => sum + value, 0);
    if (!total) {
      showToast("Nada para apagar nesse ano", "warning");
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
    await cleanupYear(year);
    showToast(`Ano ${year} apagado`, "success");
    renderBackups();
  });
}

const routes = {
  home,
  "fluxo-de-caixa": renderCash,
  "menu-semanal": renderMenu,
  loja: renderStoreSales,
  financeiro: renderFinance,
  precificacao: renderPricing,
  relatorios: renderReports,
  backups: renderBackups
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
        start: startParam || state.reportPeriod.start || "",
        end: endParam || state.reportPeriod.end || ""
      };
    }
  }
}

Promise.all([hydrateSession(), hydrateState()]).then(() => {
  applyRouteParams();
  routes[routeName()] ? routes[routeName()]() : home();
});
