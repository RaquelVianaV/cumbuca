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

    const backupDate = result.lastBackup?.backup_date
      ? formatIsoDateBr(String(result.lastBackup.backup_date).slice(0, 10))
      : "";
    const backupText = result.backupWeeklyOk
      ? `backup semanal ok ${backupDate}`
      : "backup semanal pendente";
    setSaveStatus(`Supabase ok · ${backupText}`, "online");
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
const expenseCategories = [
  ["fornecedor", "Fornecedor"],
  ["embalagem", "Embalagem"],
  ["aluguel", "Aluguel"],
  ["delivery", "Delivery"],
  ["taxa", "Taxa"],
  ["outros", "Outros"]
];

function localValue(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
  } catch (error) {
    return fallback;
  }
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
  auditLog: localValue("auditLog", []),
  showClients: false,
  showOrders: false,
  showPlanning: false,
  showMonthSummary: false,
  clientTab: "form",
  editClientIndex: null,
  editOrderId: null,
  editCashId: null,
  editStoreSaleId: null,
  ingredients: localValue("pricingIngredients", []),
  pricingConfig: localValue("pricingConfig", {}),
  cashFilter: localValue("cashFilter", { period: "all" }),
  reportPeriod: localValue("reportPeriod", {
    type: "month",
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    week: 1,
    start: "",
    end: ""
  }),
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
    auditLog: state.auditLog,
    pricingIngredients: state.ingredients,
    pricingConfig: state.pricingConfig,
    cashFilter: state.cashFilter
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
    detail
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
      showToast("Salvo so neste navegador", "warning");
    }
  } catch (error) {
    setSaveStatus("Salvo só neste navegador", "offline");
    showToast("Sem confirmacao do Supabase", "warning");
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
    state.auditLog = saved.auditLog || state.auditLog;
    state.ingredients = saved.pricingIngredients || state.ingredients;
    state.pricingConfig = saved.pricingConfig || state.pricingConfig;
    state.cashFilter = saved.cashFilter || state.cashFilter;
    persistLocal();
  } catch (error) {
    state.database = false;
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

function filterCashEntries(entries) {
  const { period, date, month, year } = state.cashFilter;

  if (!period || period === "all") {
    return entries;
  }

  return entries.filter(entry => {
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
  return expenseCategories.find(([key]) => key === value)?.[1] || "Outros";
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

function homeMetricData() {
  const monthKey = currentMonthKey();
  const currentMenuKey = menuKey(state.menuWeek || 1);
  const monthOrders = state.orders.filter(order => menuPeriodKeyFromKey(order.menuKey) === monthKey);
  const monthCash = state.cash.filter(entry => String(entry.date || "").startsWith(monthKey));
  const todayKey = isoDate(new Date());
  const todayCash = state.cash.filter(entry => entry.date === todayKey);
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
  const menuItems = state.menus[currentMenuKey] || [];
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
    weekStart,
    weekEnd,
    orders: monthOrders.length,
    bowls: monthOrders.reduce((sum, order) => sum + orderQuantity(order), 0),
    clients: state.clients.length,
    planned: menuItems.length,
    ready: menuItems.filter(item => item.status === "pronto").length,
    storeToday,
    recentExpenses,
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
          <span>Saldo da semana</span>
          <strong class="${metrics.weekBalance < 0 ? "negative" : "positive"}">${money(metrics.weekBalance)}</strong>
        </div>
        <div class="metric dashboard-metric">
          <span>Pedidos da semana</span>
          <strong>${weeklyOrders}</strong>
        </div>
        <div class="metric dashboard-metric">
          <span>Cumbucas loja hoje</span>
          <strong>${metrics.storeToday}</strong>
        </div>
        <div class="metric dashboard-metric">
          <span>Semana</span>
          <strong>${formatIsoDateBr(metrics.weekStart)} a ${formatIsoDateBr(metrics.weekEnd)}</strong>
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
        <h2>Semana</h2>
        <div class="focus-list">
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

    <section class="panel dashboard-panel">
      <h2>Despesas recentes</h2>
      ${metrics.recentExpenses.length ? `
          <div class="recent-list">
            ${metrics.recentExpenses.map(entry => `
              <span><b>${money(entry.amount)}</b>${entry.description || "Despesa"}<small>${entry.date || ""}</small></span>
            `).join("")}
          </div>
        ` : `<p class="muted">Nenhuma despesa lançada ainda.</p>`}
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

  app.innerHTML = `
    <div class="tool-grid">
      <section class="panel">
        <h2>${editing ? "Editar lançamento" : "Novo lançamento"}</h2>
        <form id="cash-form" class="form-grid single">
          <label>Descrição
            <input name="description" placeholder="Venda marmitas, aluguel, fornecedor" value="${editing?.description || ""}" required>
          </label>
          <label>Data
            <input name="date" type="date" value="${editing?.date || ""}" required>
          </label>
          <label>Tipo
            <select name="type">
              <option value="income" ${editing?.type === "income" ? "selected" : ""}>Entrada</option>
              <option value="expense" ${editing?.type === "expense" ? "selected" : ""}>Saída</option>
            </select>
          </label>
          <label>Categoria
            <select name="category">
              ${expenseCategories.map(([value, label]) => `
                <option value="${value}" ${(editing?.category || "outros") === value ? "selected" : ""}>${label}</option>
              `).join("")}
            </select>
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
      </section>
      <section class="panel">
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
          <button type="submit">Aplicar</button>
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
        ${cashTable(result.entries)}
      </section>
    </div>
  `;

  document.querySelector("#cash-form").addEventListener("submit", event => {
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

  const cancelCashEdit = document.querySelector("#cancel-cash-edit");
  if (cancelCashEdit) {
    cancelCashEdit.addEventListener("click", () => {
      state.editCashId = null;
      renderCash();
    });
  }

  const filterForm = document.querySelector("#cash-filter-form");
  const periodField = document.querySelector("#cash-period");

  function updateFilterVisibility() {
    const period = periodField.value;
    filterForm.dataset.period = period;
  }

  periodField.addEventListener("change", updateFilterVisibility);
  updateFilterVisibility();

  filterForm.addEventListener("submit", event => {
    event.preventDefault();
    state.cashFilter = readForm(event.currentTarget);
    persistState();
    renderCash();
  });

  document.querySelectorAll("[data-cash-quick]").forEach(button => {
    button.addEventListener("click", event => {
      const quick = event.currentTarget.dataset.cashQuick;
      if (quick === "today") {
        state.cashFilter = { period: "day", date: today, month: selectedMonth, year: selectedYear };
      }
      if (quick === "week") {
        state.cashFilter = { period: "week", date: today, month: selectedMonth, year: selectedYear };
      }
      if (quick === "month") {
        state.cashFilter = { period: "month", date: today, month: today.slice(0, 7), year: selectedYear };
      }
      if (quick === "last-month") {
        state.cashFilter = { period: "month", date: today, month: lastMonthKey(), year: selectedYear };
      }
      persistState();
      renderCash();
    });
  });

  document.querySelector("#clear-cash").addEventListener("click", () => {
    if (!confirm("Limpar todos os lançamentos do fluxo de caixa?")) {
      return;
    }
    state.cash = [];
    state.editCashId = null;
    persistState();
    renderCash();
  });

  document.querySelectorAll("[data-edit-cash]").forEach(button => {
    button.addEventListener("click", event => {
      state.editCashId = event.currentTarget.dataset.editCash;
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
    return `<p class="muted">Nenhum lancamento ainda.</p>`;
  }

  return `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Data</th><th>Descrição</th><th>Tipo</th><th>Categoria</th><th>Valor</th><th></th></tr></thead>
        <tbody>
          ${entries.map(item => `
            <tr>
              <td>${item.date}</td>
              <td>${item.description}</td>
              <td>${item.type === "income" ? "Entrada" : "Saída"}</td>
              <td>${item.type === "expense" ? categoryName(item.category) : "-"}</td>
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
      if (!confirm(`Excluir cadastro de ${client.name}?`)) {
        return;
      }
      state.clients.splice(index, 1);
      state.editClientIndex = null;
      persistState();
      renderMenu();
    });
  });

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

  const orderForm = document.querySelector("#order-form");
  if (orderForm) {
    document.querySelector("#order-back").addEventListener("click", () => {
      state.showOrders = false;
      state.editOrderId = null;
      renderMenu();
    });

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
        <div class="client-count"><span>Clientes cadastrados</span><strong>${state.clients.length}</strong></div>
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
    .sort((a, b) => {
      if (a.client.plan === b.client.plan) {
        return (a.client.name || "").localeCompare(b.client.name || "", "pt-BR");
      }
      return a.client.plan === "mensalista" ? -1 : 1;
    });

  return `
    <div class="table-wrap client-table">
      <table>
        <thead><tr><th>Nome</th><th>Endereço</th><th>Complemento</th><th>Telefone</th><th>Plano</th><th>Valor</th><th>Frete / Qtd. restante</th><th>Obs.</th><th></th></tr></thead>
        <tbody>
          ${orderedClients.map(({ client, index }) => `
            <tr>
              <td>${client.name || ""}</td>
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
                  <button class="danger table-action" type="button" data-delete-client="${index}">Excluir</button>
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

function orderList(plan, currentKey) {
  const orders = weeklyOrders(currentKey);

  if (!orders.length) {
    return `<p class="muted">Nenhum pedido registrado nesta semana.</p>`;
  }

  return `
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

  return `
    <section class="client-panel">
      <div class="client-panel-header">
        <h2>${editing ? "Editar pedido" : "Pedidos"}</h2>
        <button class="secondary" type="button" id="order-back">Voltar</button>
      </div>
      ${orderSummary(plan, currentKey)}
      ${orderOverviewPanel(plan, currentKey)}
      <form id="order-form" class="order-form">
        <label>Cliente
          <select name="clientPhone" ${state.clients.length ? "required" : "disabled"}>
            ${state.clients.length
              ? `<option value="">Selecione um cliente</option>${state.clients.map(client => `
                  <option value="${client.phone}" ${editing?.clientPhone === client.phone ? "selected" : ""}>${client.name} - ${client.phone}${client.plan === "mensalista" ? ` - restam ${clientRemainingQuantity(client, currentKey, editing?.id)}/${clientMonthlyCapacity(client, currentKey, editing?.id)}${clientChargedPackageCount(client, currentKey, editing?.id) > 1 ? ` - ${clientChargedPackageCount(client, currentKey, editing?.id)} pacotes` : ""}${isLowMonthlyQuantity(client, currentKey) ? " - perto de acabar" : clientRemainingQuantity(client, currentKey, editing?.id) <= 0 ? " - pode renovar" : ""}` : ""}</option>
                `).join("")}`
              : `<option value="">Cadastre um cliente primeiro</option>`}
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
          <button type="submit" ${state.clients.length ? "" : "disabled"}>${editing ? "Salvar edição" : "Salvar pedido"}</button>
          ${editing ? `<button class="secondary" type="button" id="cancel-order-edit">Cancelar</button>` : ""}
        </div>
      </form>
      ${orderList(plan, currentKey)}
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
      categoria: entry.type === "expense" ? categoryName(entry.category) : "",
      valor: Number(entry.amount || 0)
    }));
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
    ["Custo planejado", money(data.menuCost)],
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
  const menuRows = data.menuWeeks.map(week => [
    `Semana ${week.week}`,
    week.dishes.map(item => item.dish).filter(Boolean).join(", ") || "Sem pratos",
    money(week.menuCost),
    week.quantity,
    week.orders.length,
    money(week.orderAmount)
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
        <h2>Entradas ${escapeHtml(reportTitleSuffix(data))}</h2>
        ${pdfRows(["Data", "Descrição", "Valor"], incomeRows)}
        <h2>Principais saídas (despesas)</h2>
        ${pdfRows(["Data", "Descrição", "Valor"], expenseRows)}
        <h2>Cumbucas vendidas na loja</h2>
        ${pdfRows(["Data", "Quantidade", "Observação"], storeRows)}
        <h2>Lançamentos ${escapeHtml(reportTitleSuffix(data))}</h2>
        ${pdfRows(["Data", "Descrição", "Tipo", "Valor"], cashRows)}
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
        entry.type === "expense" ? categoryName(entry.category) : "-",
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
        entry.type === "expense" ? categoryName(entry.category) : "-",
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
        menuCost: data.menuCost,
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
    return `<p class="muted">Nenhum pedido neste período.</p>`;
  }

  return `
    <div class="table-wrap report-table">
      <table>
        <thead><tr><th>Semana</th><th>Cliente</th><th>Qtd.</th><th>Valor</th><th>Frete</th><th>Pagamento</th></tr></thead>
        <tbody>
          ${data.orders.map(order => {
            const client = clientByPhone(order.clientPhone);
            return `
              <tr>
                <td>${order.menuKey || ""}</td>
                <td>${client.name || order.clientPhone || "Cliente removido"}</td>
                <td>${orderQuantity(order)}</td>
                <td>${money(order.amount)}</td>
                <td>${money(order.deliveryFee)}</td>
                <td>${paymentText(order, client)}</td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function reportCashTable(data) {
  if (!data.cashEntries.length) {
    return `<p class="muted">Nenhum lançamento de caixa neste período.</p>`;
  }

  return `
    <div class="table-wrap report-table">
      <table>
        <thead><tr><th>Data</th><th>Descrição</th><th>Tipo</th><th>Categoria</th><th>Valor</th></tr></thead>
        <tbody>
          ${data.cashEntries.map(entry => `
            <tr>
              <td>${entry.date || ""}</td>
              <td>${entry.description || ""}</td>
              <td>${entry.type === "expense" ? "Saída" : "Entrada"}</td>
              <td>${entry.type === "expense" ? categoryName(entry.category) : "-"}</td>
              <td>${money(entry.amount)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function reportMenuTable(data) {
  if (!data.menuWeeks.some(week => week.dishes.length || week.orders.length)) {
    return `<p class="muted">Nenhum cardápio ou pedido neste período.</p>`;
  }

  return `
    <div class="table-wrap report-table">
      <table>
        <thead><tr><th>Semana</th><th>Pratos</th><th>Custo</th><th>Cumbucas</th><th>Pedidos</th><th>Receita</th></tr></thead>
        <tbody>
          ${data.menuWeeks.map(week => `
            <tr>
              <td>Semana ${week.week}</td>
              <td>${week.dishes.map(item => item.dish).filter(Boolean).join(", ") || "Sem pratos"}</td>
              <td>${money(week.menuCost)}</td>
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
  const items = state.auditLog.slice(0, 8);

  return `
    <section class="panel report-section">
      <h2>Histórico recente</h2>
      ${items.length ? `
        <div class="audit-list">
          ${items.map(item => `
            <span>
              <b>${item.action}</b>
              ${item.detail || ""}
              <small>${new Date(item.at).toLocaleString("pt-BR")}</small>
            </span>
          `).join("")}
        </div>
      ` : `<p class="muted">Nenhuma alteração registrada ainda.</p>`}
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
        <button type="submit">Atualizar</button>
      </form>
      <div class="report-actions">
        <button class="secondary" type="button" data-export-report="orders">Pedidos CSV</button>
        <button class="secondary" type="button" data-export-report="cash">Caixa CSV</button>
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
      <div class="metric report-metric"><span>Ticket médio</span><strong>${money(data.averageTicket)}</strong></div>
      <div class="metric report-metric"><span>Frete arrecadado</span><strong>${money(data.deliveryRevenue)}</strong></div>
      <div class="metric report-metric"><span>Entradas no caixa</span><strong>${money(data.income)}</strong></div>
      <div class="metric report-metric"><span>Saídas no caixa</span><strong>${money(data.expenses)}</strong></div>
      <div class="metric report-metric"><span>Saldo do caixa</span><strong class="${data.balance < 0 ? "negative" : "positive"}">${money(data.balance)}</strong></div>
      <div class="metric report-metric"><span>Custo planejado</span><strong>${money(data.menuCost)}</strong></div>
      <div class="metric report-metric"><span>Pedidos pagos</span><strong>${data.paidOrders}</strong></div>
      <div class="metric report-metric"><span>Pedidos pendentes</span><strong>${data.pendingOrders}</strong></div>
      <div class="metric report-metric"><span>Clientes semanais</span><strong>${data.weeklyClients}</strong></div>
      <div class="metric report-metric"><span>Mensalistas</span><strong>${data.monthlyClients}</strong></div>
    </section>

    <section class="panel report-section">
      <h2>Pedidos ${reportTitleSuffix(data)}</h2>
      ${reportOrdersTable(data)}
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
      end: values.end || weekRange.end
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
}

async function renderBackups() {
  title.textContent = "Backups";
  setActive("backups");
  app.innerHTML = `
    <section class="panel report-section">
      <h2>Backups salvos no Supabase</h2>
      <p class="muted">Use para baixar uma copia ou restaurar um dia especifico se algo for apagado sem querer.</p>
      <div id="backup-list" class="backup-list-state">Carregando backups...</div>
    </section>
  `;

  try {
    const response = await fetch("/api/backups", { cache: "no-store" });
    const result = await response.json();
    const backups = result.backups || [];
    const list = document.querySelector("#backup-list");
    if (!result.database) {
      list.innerHTML = `<p class="muted">Banco offline agora. Nao foi possivel consultar backups.</p>`;
      return;
    }
    if (!backups.length) {
      list.innerHTML = `<p class="muted">Nenhum backup encontrado ainda.</p>`;
      return;
    }

    list.innerHTML = `
      <div class="table-wrap report-table">
        <table>
          <thead><tr><th>Data do backup</th><th>Atualizado em</th><th>Acoes</th></tr></thead>
          <tbody>
            ${backups.map(backup => {
              const date = String(backup.backup_date || "").slice(0, 10);
              return `
                <tr>
                  <td>${formatIsoDateBr(date)}</td>
                  <td>${backup.updated_at ? new Date(backup.updated_at).toLocaleString("pt-BR") : ""}</td>
                  <td>
                    <div class="table-actions">
                      <button class="secondary table-action" type="button" data-download-backup="${date}">Baixar</button>
                      <button class="danger table-action" type="button" data-restore-backup="${date}">Restaurar</button>
                    </div>
                  </td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      </div>
    `;

    document.querySelectorAll("[data-download-backup]").forEach(button => {
      button.addEventListener("click", event => {
        const date = event.currentTarget.dataset.downloadBackup;
        const link = document.createElement("a");
        link.href = `/api/backup?date=${encodeURIComponent(date)}`;
        link.download = `cumbuca-backup-${date}.json`;
        document.body.appendChild(link);
        link.click();
        link.remove();
      });
    });

    document.querySelectorAll("[data-restore-backup]").forEach(button => {
      button.addEventListener("click", async event => {
        const date = event.currentTarget.dataset.restoreBackup;
        if (!confirm(`Restaurar o backup de ${formatIsoDateBr(date)}? Isso vai substituir os dados atuais.`)) {
          return;
        }
        if (!confirm("Confirma mesmo? Antes de restaurar, baixe um backup atual pelo botao Backup.")) {
          return;
        }

        const restoreResponse = await fetch("/api/restore-backup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date })
        });
        const restoreResult = await restoreResponse.json();
        if (!restoreResponse.ok || !restoreResult.restored) {
          showToast("Nao foi possivel restaurar", "warning");
          return;
        }
        await hydrateState();
        persistLocal();
        showToast("Backup restaurado", "success");
        renderBackups();
      });
    });
  } catch (error) {
    document.querySelector("#backup-list").innerHTML = `<p class="muted">Nao foi possivel carregar os backups agora.</p>`;
  }
}

const routes = {
  home,
  "fluxo-de-caixa": renderCash,
  "menu-semanal": renderMenu,
  loja: renderStoreSales,
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
    if (routeName() === "relatorios") {
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

hydrateState().then(() => {
  applyRouteParams();
  routes[routeName()] ? routes[routeName()]() : home();
});
