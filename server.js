const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const PDFDocument = require("pdfkit");
const JSZip = require("jszip");
let Pool = null;
try {
  ({ Pool } = require("pg"));
} catch (error) {
  Pool = null;
}

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, "public");
const AUTH_USER = process.env.CUMBUCA_USER || "cumbuca";
const AUTH_PASSWORD = process.env.CUMBUCA_PASSWORD || "cumbuca2026";
const AUTH_SECRET = process.env.CUMBUCA_AUTH_SECRET || "cumbuca-local-secret";
const SESSION_COOKIE = "cumbuca_session";
const DATABASE_URL = process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL || process.env.DATABASE_URL;
const loginAttempts = new Map();
const stateKeys = [
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
  "monthlyClosings",
  "pricingIngredients",
  "pricingConfig",
  "cashFilter",
  "financialPlanning",
  "appConfig"
];

const defaultState = {
  cashEntries: [],
  weeklyMenusByPeriod: {},
  menuWeek: 1,
  menuPeriod: {
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1
  },
  menuDatesByPeriod: {},
  clients: [],
  orders: [],
  storeSales: [],
  channelReceipts: [],
  cashCategories: null,
  archivedCashCategories: { income: [], expense: [] },
  suppliers: [],
  expenseReasons: [],
  archivedExpenseReasons: [],
  monthlyClosings: {},
  pricingIngredients: [],
  pricingConfig: {},
  cashFilter: { period: "all" },
  financialPlanning: {
    savings: "",
    monthlyGoal: "",
    improvements: [],
    purchases: []
  },
  appConfig: {
    storeName: "Cumbuca",
    defaultRoute: "hoje",
    splitSavingsPercent: 10,
    splitVanessaPercent: 70,
    splitRaquelPercent: 30
  }
};

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeState(payload = {}) {
  return Object.fromEntries(
    stateKeys.map(key => [
      key,
      Object.prototype.hasOwnProperty.call(payload, key) ? payload[key] : cloneJson(defaultState[key])
    ])
  );
}

function databaseUrl() {
  if (!DATABASE_URL) {
    return "";
  }

  try {
    const url = new URL(DATABASE_URL);
    ["sslmode", "sslcert", "sslkey", "sslrootcert", "channel_binding"].forEach(param => {
      url.searchParams.delete(param);
    });
    return url.toString();
  } catch (error) {
    return DATABASE_URL;
  }
}

const db = DATABASE_URL && Pool
  ? new Pool({
    connectionString: databaseUrl(),
    ssl: process.env.PGSSLMODE === "disable" ? false : { rejectUnauthorized: false }
  })
  : null;

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8",
  ".ico": "image/x-icon"
};

const tools = [
  {
    id: "fluxo-de-caixa",
    title: "Fluxo de Caixa",
    description: "Registre entradas e saídas, veja saldo previsto e acompanhe o mês."
  },
  {
    id: "menu-semanal",
    title: "Menu Semanal",
    description: "Planeje refeições da semana com custos, status e observações."
  },
  {
    id: "precificacao",
    title: "Precificação",
    description: "Calcule preço de venda a partir de custo, perdas, taxas e margem."
  },
  {
    id: "relatorios",
    title: "Relatórios",
    description: "Consolide vendas, caixa, clientes e cardápio por período."
  }
];

function sendJson(res, statusCode, payload, extraHeaders = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    ...extraHeaders
  });
  res.end(body);
}

function redirect(res, location) {
  res.writeHead(302, { Location: location });
  res.end();
}

function parseCookies(req) {
  return String(req.headers.cookie || "")
    .split(";")
    .map(cookie => cookie.trim())
    .filter(Boolean)
    .reduce((cookies, cookie) => {
      const index = cookie.indexOf("=");
      if (index === -1) {
        return cookies;
      }
      cookies[decodeURIComponent(cookie.slice(0, index))] = decodeURIComponent(cookie.slice(index + 1));
      return cookies;
    }, {});
}

function envAuthUsers() {
  const fallback = [{ username: AUTH_USER, password: AUTH_PASSWORD, name: AUTH_USER, role: "admin" }];
  if (!process.env.CUMBUCA_USERS) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(process.env.CUMBUCA_USERS);
    if (!Array.isArray(parsed)) {
      return fallback;
    }
    const users = parsed
      .filter(user => user?.username && user?.password)
      .map(user => ({
        username: String(user.username),
        password: String(user.password),
        name: String(user.name || user.username),
        role: user.role === "admin" ? "admin" : "operator"
      }));
    return users.length ? users : fallback;
  } catch (error) {
    return fallback;
  }
}

function userSessionToken(user) {
  return crypto
    .createHmac("sha256", AUTH_SECRET)
    .update(`${user.username}:${user.sessionSecret || user.password || ""}`)
    .digest("hex");
}

function sessionToken() {
  return userSessionToken({ username: AUTH_USER, sessionSecret: AUTH_PASSWORD });
}

function passwordHash(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(String(password || ""), salt, 120000, 32, "sha256").toString("hex");
  return `pbkdf2$${salt}$${hash}`;
}

function verifyPassword(password, storedHash) {
  const [scheme, salt, hash] = String(storedHash || "").split("$");
  if (scheme !== "pbkdf2" || !salt || !hash) {
    return false;
  }
  const candidate = crypto.pbkdf2Sync(String(password || ""), salt, 120000, 32, "sha256");
  const expected = Buffer.from(hash, "hex");
  return expected.length === candidate.length && crypto.timingSafeEqual(expected, candidate);
}

async function ensureUserTable() {
  if (!db) {
    return false;
  }

  await db.query(`
    create table if not exists cumbuca_app_users (
      username text primary key,
      name text not null,
      role text not null default 'operator',
      password_hash text not null,
      active boolean not null default true,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);

  const count = Number((await db.query("select count(*)::int as count from cumbuca_app_users")).rows[0]?.count || 0);
  if (count === 0) {
    for (const user of envAuthUsers()) {
      await db.query(
        `insert into cumbuca_app_users (username, name, role, password_hash, active, created_at, updated_at)
         values ($1, $2, $3, $4, true, now(), now())
         on conflict (username) do nothing`,
        [user.username, user.name || user.username, user.role === "admin" ? "admin" : "operator", passwordHash(user.password)]
      );
    }
  }
  return true;
}

function publicUser(row) {
  return {
    username: row.username,
    name: row.name,
    role: row.role === "admin" ? "admin" : "operator",
    active: row.active !== false,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null
  };
}

async function findAuthUser(username, password) {
  if (await ensureUserTable()) {
    const result = await db.query(
      "select username, name, role, password_hash, active from cumbuca_app_users where username = $1 and active = true",
      [username]
    );
    const row = result.rows[0];
    if (row && verifyPassword(password, row.password_hash)) {
      return {
        username: row.username,
        name: row.name,
        role: row.role === "admin" ? "admin" : "operator",
        sessionSecret: row.password_hash
      };
    }
    return null;
  }

  const envUser = envAuthUsers().find(user => user.username === username && user.password === password) || null;
  return envUser ? { ...envUser, sessionSecret: envUser.password } : null;
}

async function currentUser(req) {
  const cookieValue = parseCookies(req)[SESSION_COOKIE] || "";
  const [username, token] = cookieValue.split(".");
  if (username && token && await ensureUserTable()) {
    const result = await db.query(
      "select username, name, role, password_hash, active from cumbuca_app_users where username = $1 and active = true",
      [username]
    );
    const row = result.rows[0];
    if (row && token === userSessionToken({ username: row.username, sessionSecret: row.password_hash })) {
      return { username: row.username, name: row.name, role: row.role === "admin" ? "admin" : "operator" };
    }
  }

  const user = envAuthUsers().find(item => item.username === username);
  if (user && token === userSessionToken({ ...user, sessionSecret: user.password })) {
    return { username: user.username, name: user.name, role: user.role || "operator" };
  }

  if (cookieValue === sessionToken()) {
    return { username: AUTH_USER, name: AUTH_USER, role: "admin" };
  }

  return null;
}

function sessionCookie(value, maxAge) {
  const secure = process.env.VERCEL ? "; Secure" : "";
  return `${SESSION_COOKIE}=${encodeURIComponent(value)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${secure}`;
}

function loginAttemptKey(req, username) {
  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return `${forwarded || req.socket.remoteAddress || "local"}:${username || ""}`;
}

function loginBlocked(req, username) {
  const key = loginAttemptKey(req, username);
  const attempt = loginAttempts.get(key);
  if (!attempt || attempt.blockedUntil <= Date.now()) {
    return false;
  }
  return true;
}

function registerLoginFailure(req, username) {
  const key = loginAttemptKey(req, username);
  const current = loginAttempts.get(key) || { count: 0, blockedUntil: 0 };
  const count = current.count + 1;
  loginAttempts.set(key, {
    count,
    blockedUntil: count >= 5 ? Date.now() + 10 * 60 * 1000 : 0
  });
}

function clearLoginFailures(req, username) {
  loginAttempts.delete(loginAttemptKey(req, username));
}

function collectBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => {
      body += chunk;
      if (body.length > 1_000_000) {
        req.destroy();
        reject(new Error("Payload muito grande."));
      }
    });
    req.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    });
  });
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function ensureStateTable() {
  if (!db) {
    return false;
  }

  await db.query(`
    create table if not exists cumbuca_app_state (
      key text primary key,
      value jsonb not null,
      updated_at timestamptz not null default now()
    )
  `);
  return true;
}

async function ensureBackupTable() {
  if (!db) {
    return false;
  }

  await db.query(`
    create table if not exists cumbuca_app_backups (
      backup_date date primary key,
      payload jsonb not null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);
  return true;
}

async function ensureEventTable() {
  if (!db) {
    return false;
  }

  await db.query(`
    create table if not exists cumbuca_app_events (
      id bigserial primary key,
      event_type text not null,
      detail text not null default '',
      username text not null default '',
      created_at timestamptz not null default now()
    )
  `);
  return true;
}

async function writeEvent(eventType, detail = "", user = null) {
  if (!await ensureEventTable()) {
    return false;
  }

  await db.query(
    `insert into cumbuca_app_events (event_type, detail, username, created_at)
     values ($1, $2, $3, now())`,
    [String(eventType || "evento"), String(detail || ""), String(user?.username || user?.name || "sistema")]
  );
  return true;
}

async function listEvents(limit = 40) {
  if (!await ensureEventTable()) {
    return { database: false, events: [] };
  }

  const cappedLimit = Math.max(1, Math.min(100, Number(limit || 40)));
  const result = await db.query(
    `select id, event_type, detail, username, created_at
     from cumbuca_app_events
     order by created_at desc
     limit $1`,
    [cappedLimit]
  );
  return { database: true, events: result.rows };
}

async function listUsers() {
  if (!await ensureUserTable()) {
    return {
      database: false,
      users: envAuthUsers().map(user => ({
        username: user.username,
        name: user.name,
        role: user.role,
        active: true,
        source: "env"
      }))
    };
  }

  const result = await db.query(`
    select username, name, role, active, created_at, updated_at
    from cumbuca_app_users
    order by active desc, name asc, username asc
  `);
  return { database: true, users: result.rows.map(publicUser) };
}

async function upsertUser(payload = {}, actor = null) {
  if (!await ensureUserTable()) {
    return { database: false, saved: false, error: "Banco indisponível." };
  }

  const username = String(payload.username || "").trim().toLowerCase();
  const name = String(payload.name || username).trim();
  const role = payload.role === "admin" ? "admin" : "operator";
  const password = String(payload.password || "");
  if (!/^[a-z0-9._-]{3,40}$/.test(username)) {
    return { database: true, saved: false, error: "Usuário deve ter 3 a 40 caracteres, usando letras, números, ponto, hífen ou underline." };
  }
  if (!name) {
    return { database: true, saved: false, error: "Informe o nome." };
  }

  const existing = await db.query("select username from cumbuca_app_users where username = $1", [username]);
  if (!existing.rows.length && password.length < 4) {
    return { database: true, saved: false, error: "Informe uma senha com pelo menos 4 caracteres." };
  }

  if (existing.rows.length) {
    if (password) {
      await db.query(
        `update cumbuca_app_users
         set name = $2, role = $3, password_hash = $4, active = true, updated_at = now()
         where username = $1`,
        [username, name, role, passwordHash(password)]
      );
      await writeEvent("usuario_atualizado", `Usuário ${username} atualizado com nova senha.`, actor);
    } else {
      await db.query(
        `update cumbuca_app_users
         set name = $2, role = $3, active = true, updated_at = now()
         where username = $1`,
        [username, name, role]
      );
      await writeEvent("usuario_atualizado", `Usuário ${username} atualizado.`, actor);
    }
  } else {
    await db.query(
      `insert into cumbuca_app_users (username, name, role, password_hash, active, created_at, updated_at)
       values ($1, $2, $3, $4, true, now(), now())`,
      [username, name, role, passwordHash(password)]
    );
    await writeEvent("usuario_criado", `Usuário ${username} criado.`, actor);
  }

  return { database: true, saved: true, user: { username, name, role, active: true } };
}

async function setUserActive(username, active, actor = null) {
  if (!await ensureUserTable()) {
    return { database: false, saved: false, error: "Banco indisponível." };
  }

  const normalized = String(username || "").trim().toLowerCase();
  if (actor?.username === normalized && active === false) {
    return { database: true, saved: false, error: "Você não pode desativar seu próprio usuário." };
  }

  const result = await db.query(
    "update cumbuca_app_users set active = $2, updated_at = now() where username = $1",
    [normalized, Boolean(active)]
  );
  if (!result.rowCount) {
    return { database: true, saved: false, error: "Usuário não encontrado." };
  }
  await writeEvent(active ? "usuario_reativado" : "usuario_desativado", `Usuário ${normalized}.`, actor);
  return { database: true, saved: true };
}

async function changeOwnPassword(user, payload = {}) {
  if (!user?.username) {
    return { database: false, saved: false, error: "Sessão inválida." };
  }
  if (!await ensureUserTable()) {
    return { database: false, saved: false, error: "Banco indisponivel." };
  }

  const currentPassword = String(payload.currentPassword || "");
  const newPassword = String(payload.newPassword || "");
  if (newPassword.length < 4) {
    return { database: true, saved: false, error: "A nova senha precisa ter pelo menos 4 caracteres." };
  }

  const result = await db.query(
    "select username, password_hash from cumbuca_app_users where username = $1 and active = true",
    [user.username]
  );
  const row = result.rows[0];
  if (!row || !verifyPassword(currentPassword, row.password_hash)) {
    return { database: true, saved: false, error: "Senha atual incorreta." };
  }

  const nextHash = passwordHash(newPassword);
  await db.query(
    "update cumbuca_app_users set password_hash = $2, updated_at = now() where username = $1",
    [user.username, nextHash]
  );
  await writeEvent("senha_alterada", `Usuário ${user.username} alterou a própria senha.`, user);
  return {
    database: true,
    saved: true,
    session: `${user.username}.${userSessionToken({ username: user.username, sessionSecret: nextHash })}`
  };
}

async function writeAutomaticBackup(payload = {}) {
  if (!await ensureBackupTable()) {
    return false;
  }

  await db.query(
    `insert into cumbuca_app_backups (backup_date, payload, created_at, updated_at)
     values (current_date, $1::jsonb, now(), now())
     on conflict (backup_date)
     do update set payload = excluded.payload, updated_at = now()`,
    [JSON.stringify({
      app: "Cumbuca",
      version: "1.0.0",
      exportedAt: new Date().toISOString(),
      source: "automatic",
      data: normalizeState(payload)
    })]
  );
  return true;
}

async function listBackups() {
  if (!await ensureBackupTable()) {
    return { database: false, backups: [] };
  }

  const result = await db.query(`
    select backup_date, created_at, updated_at
    from cumbuca_app_backups
    order by backup_date desc
    limit 30
  `);
  return { database: true, backups: result.rows };
}

async function databaseUsage() {
  if (!await ensureStateTable() || !await ensureBackupTable()) {
    return { database: false, tables: [] };
  }

  const result = await db.query(`
    select
      table_name,
      pg_total_relation_size(format('%I.%I', table_schema, table_name)::regclass) as total_bytes,
      pg_relation_size(format('%I.%I', table_schema, table_name)::regclass) as table_bytes
    from information_schema.tables
    where table_schema = 'public'
      and table_name = any($1::text[])
    order by table_name
  `, [["cumbuca_app_state", "cumbuca_app_backups"]]);

  const counts = {};
  counts.cumbuca_app_state = Number((await db.query("select count(*)::int as count from cumbuca_app_state")).rows[0]?.count || 0);
  counts.cumbuca_app_backups = Number((await db.query("select count(*)::int as count from cumbuca_app_backups")).rows[0]?.count || 0);

  return {
    database: true,
    tables: result.rows.map(row => ({
      name: row.table_name,
      rows: counts[row.table_name] || 0,
      totalBytes: Number(row.total_bytes || 0),
      tableBytes: Number(row.table_bytes || 0)
    }))
  };
}

async function deleteOldBackups(keepDays = 30) {
  if (!await ensureBackupTable()) {
    return { database: false, deleted: 0 };
  }

  const days = Math.max(0, Math.min(3650, Number(keepDays || 30)));
  const result = await db.query(
    `delete from cumbuca_app_backups
     where backup_date < current_date - ($1::int * interval '1 day')`,
    [days]
  );

  return { database: true, deleted: result.rowCount || 0, keepDays: days };
}

async function readBackup(backupDate) {
  if (!await ensureBackupTable()) {
    return { database: false, backup: null };
  }

  const result = await db.query(
    `select backup_date, payload, created_at, updated_at
     from cumbuca_app_backups
     where backup_date = $1::date`,
    [backupDate]
  );
  return { database: true, backup: result.rows[0] || null };
}

async function deleteBackup(backupDate) {
  if (!await ensureBackupTable()) {
    return { database: false, deleted: 0 };
  }

  const result = await db.query(
    `delete from cumbuca_app_backups
     where backup_date = $1::date`,
    [backupDate]
  );

  return { database: true, deleted: result.rowCount || 0, backupDate };
}

async function restoreBackup(backupDate) {
  const backupResult = await readBackup(backupDate);
  if (!backupResult.database) {
    return { database: false };
  }

  const backup = backupResult.backup;
  if (!backup) {
    return { database: true, restored: false, error: "Backup não encontrado." };
  }

  const payload = backup.payload?.data || backup.payload || {};
  const restoredState = normalizeState(payload);
  const result = await writeAppState(restoredState);
  return {
    database: true,
    restored: true,
    backupDate: backup.backup_date,
    keys: result.saved || []
  };
}

function backupPreview(payload = {}) {
  const data = normalizeState(payload.data || payload);
  return {
    cash: Array.isArray(data.cashEntries) ? data.cashEntries.length : 0,
    orders: Array.isArray(data.orders) ? data.orders.length : 0,
    clients: Array.isArray(data.clients) ? data.clients.length : 0,
    menus: data.weeklyMenusByPeriod && typeof data.weeklyMenusByPeriod === "object" ? Object.keys(data.weeklyMenusByPeriod).length : 0,
    menuDates: data.menuDatesByPeriod && typeof data.menuDatesByPeriod === "object" ? Object.keys(data.menuDatesByPeriod).length : 0,
    storeSales: Array.isArray(data.storeSales) ? data.storeSales.length : 0,
    channelReceipts: Array.isArray(data.channelReceipts) ? data.channelReceipts.length : 0,
    monthlyClosings: data.monthlyClosings && typeof data.monthlyClosings === "object" ? Object.keys(data.monthlyClosings).length : 0
  };
}

async function verifyPersistence() {
  if (!await ensureStateTable()) {
    return { database: false };
  }

  const marker = {
    checkedAt: new Date().toISOString(),
    id: crypto.randomUUID()
  };
  await db.query(
    `insert into cumbuca_app_state (key, value, updated_at)
     values ($1, $2::jsonb, now())
     on conflict (key)
     do update set value = excluded.value, updated_at = now()`,
    ["__healthcheck", JSON.stringify(marker)]
  );
  const readBack = await db.query("select value, updated_at from cumbuca_app_state where key = $1", ["__healthcheck"]);
  const saved = readBack.rows[0]?.value?.id === marker.id;

  return {
    database: true,
    saved,
    checkedAt: marker.checkedAt,
    stateUpdatedAt: readBack.rows[0]?.updated_at || null,
    automaticBackup: false
  };
}

async function readAppState() {
  if (!await ensureStateTable()) {
    return { database: false, state: normalizeState({}) };
  }

  const result = await db.query("select key, value from cumbuca_app_state where key = any($1::text[])", [stateKeys]);
  return {
    database: true,
    state: normalizeState(Object.fromEntries(result.rows.map(row => [row.key, row.value])))
  };
}

async function writeAppState(payload = {}) {
  if (!await ensureStateTable()) {
    return { database: false };
  }

  const entries = Object.entries(payload)
    .filter(([key]) => stateKeys.includes(key));

  for (const [key, value] of entries) {
    await db.query(
      `insert into cumbuca_app_state (key, value, updated_at)
       values ($1, $2::jsonb, now())
       on conflict (key)
       do update set value = excluded.value, updated_at = now()`,
      [key, JSON.stringify(value)]
    );
  }

  await writeAutomaticBackup(payload);
  return { database: true, saved: entries.map(([key]) => key), backup: true };
}

async function resetAppState(user = null) {
  if (!await ensureStateTable()) {
    return { database: false };
  }

  const current = await readAppState();
  await writeAutomaticBackup(current.state);
  await db.query("delete from cumbuca_app_state where key = any($1::text[])", [stateKeys]);
  await writeEvent("limpeza_completa", "Estado do sistema apagado após backup automático.", user);
  return { database: true, reset: true, backup: true, state: normalizeState({}) };
}

function calculateCashFlow(entries = []) {
  const normalized = entries.map(item => {
    const amount = Math.abs(number(item.amount));
    const type = item.type === "expense" ? "expense" : "income";
    return {
      id: item.id || "",
      description: String(item.description || "").trim() || "Lançamento",
      date: String(item.date || ""),
      type,
      amount,
      category: String(item.category || "").trim() || "outros"
    };
  });

  const income = normalized
    .filter(item => item.type === "income")
    .reduce((sum, item) => sum + item.amount, 0);
  const expenses = normalized
    .filter(item => item.type === "expense")
    .reduce((sum, item) => sum + item.amount, 0);

  return {
    income,
    expenses,
    balance: income - expenses,
    entries: normalized.sort((a, b) => a.date.localeCompare(b.date))
  };
}

function calculatePricing(payload = {}) {
  const ingredients = Array.isArray(payload.ingredients) ? payload.ingredients : [];
  const ingredientCost = ingredients.reduce((sum, item) => {
    return sum + number(item.quantity) * number(item.unitCost);
  }, 0);

  const packaging = number(payload.packaging);
  const labor = number(payload.labor);
  const overhead = number(payload.overhead);
  const lossPercent = Math.max(0, number(payload.lossPercent));
  const feePercent = Math.max(0, number(payload.feePercent));
  const marginPercent = Math.max(0, number(payload.marginPercent));

  const baseCost = ingredientCost + packaging + labor + overhead;
  const lossCost = baseCost * (lossPercent / 100);
  const totalCost = baseCost + lossCost;
  const divisor = 1 - (feePercent + marginPercent) / 100;
  const price = divisor > 0 ? totalCost / divisor : 0;

  return {
    ingredientCost,
    baseCost,
    lossCost,
    totalCost,
    suggestedPrice: price,
    profit: price - totalCost - price * (feePercent / 100)
  };
}

function brl(value) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(number(value));
}

function pdfText(value) {
  return String(value ?? "");
}

function addPdfTable(doc, headers, rows, widths) {
  const startX = doc.page.margins.left;
  let y = doc.y;
  const rowHeight = 20;

  function drawRow(values, isHeader = false) {
    const cells = Array.isArray(values) ? values : Object.values(values || {});
    let x = startX;
    doc.font(isHeader ? "Helvetica-Bold" : "Helvetica").fontSize(isHeader ? 8 : 8);
    cells.forEach((value, index) => {
      doc.rect(x, y, widths[index], rowHeight).stroke("#d1d5db");
      doc.text(pdfText(value), x + 4, y + 6, {
        width: widths[index] - 8,
        height: rowHeight - 8,
        ellipsis: true
      });
      x += widths[index];
    });
    y += rowHeight;
    if (y > 730) {
      doc.addPage();
      y = 50;
    }
  }

  drawRow(headers, true);
  rows.forEach(row => drawRow(row));
  doc.x = startX;
  doc.y = y + 10;
}

function addPdfSectionTitle(doc, title) {
  doc.x = doc.page.margins.left;
  doc.fillColor("#573220").font("Helvetica-Bold").fontSize(13).text(title);
  doc.x = doc.page.margins.left;
}

function buildReportPdf(payload = {}) {
  const data = payload.data || {};
  const doc = new PDFDocument({ size: "A4", margin: 42 });
  const chunks = [];

  doc.on("data", chunk => chunks.push(chunk));

  doc.rect(0, 0, 595.28, 841.89).fill("#fffdf8");
  doc.rect(0, 0, 595.28, 150).fill("#087f5b");
  doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(28).text("CUMBUCA", 42, 42);
  doc.font("Helvetica").fontSize(15).text("Relatório financeiro e operacional", 42, 82);
  doc.fillColor("#573220").font("Helvetica-Bold").fontSize(22).text(payload.periodLabel || data.periodKey || "", 42, 205);
  doc.fillColor("#69707d").font("Helvetica").fontSize(11).text(`Gerado em ${new Date().toLocaleString("pt-BR")}`, 42, 238);
  doc.roundedRect(42, 310, 510, 120, 8).stroke("#d1d5db");
  doc.fillColor("#573220").font("Helvetica-Bold").fontSize(12).text("Resumo da capa", 62, 330);
  doc.fillColor("#121417").font("Helvetica").fontSize(11)
    .text(`Saldo: ${brl(data.balance)}`, 62, 358)
    .text(`Entradas: ${brl(data.totalIncome)}`, 62, 382)
    .text(`Saídas: ${brl(data.expenses)}`, 62, 406);
  doc.fillColor("#69707d").fontSize(9).text("Conferir os lançamentos e assinar o fechamento ao final do relatório.", 42, 760, {
    width: 510,
    align: "center"
  });
  doc.addPage();

  doc.rect(0, 0, 595.28, 86).fill("#573220");
  doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(21).text("RELATÓRIO FINANCEIRO", 42, 28);
  doc.font("Helvetica").fontSize(10).text(payload.periodLabel || data.periodKey || "", 42, 55);
  doc.font("Helvetica-Bold").fontSize(9).text(`Gerado em ${new Date().toLocaleDateString("pt-BR")}`, 410, 34, {
    width: 135,
    align: "right"
  });

  const summary = [
    ["Total", brl(data.balance)],
    ["Entradas", brl(data.totalIncome)],
    ["Saídas", brl(data.expenses)],
    ["Disponível retirada", brl(data.availableForWithdrawal)],
    ["Retiradas", brl(data.withdrawalTotal)],
    ["Cumbucas", data.totalSoldQuantity || 0],
    ["Semanal", data.weeklyCashQuantity || 0]
  ];

  const boxWidth = 168;
  summary.forEach(([label, value], index) => {
    const col = index % 3;
    const row = Math.floor(index / 3);
    const x = 42 + col * 172;
    const y = 105 + row * 58;
    doc.roundedRect(x, y, boxWidth, 48, 5).fill(index === 0 ? "#087f5b" : "#f9fafb").stroke("#e5e7eb");
    doc.fillColor(index === 0 ? "#ffffff" : "#69707d").font("Helvetica-Bold").fontSize(8).text(label.toUpperCase(), x + 10, y + 9);
    doc.fillColor(index === 0 ? "#ffffff" : "#121417").fontSize(14).text(pdfText(value), x + 10, y + 24, { width: boxWidth - 20 });
  });

  doc.y = summary.length > 6 ? 300 : 235;
  addPdfSectionTitle(doc, "Resumo de entradas");
  addPdfTable(doc, ["Grupo", "Origem", "Valor"], data.incomeSummaryRows || [
    ["Conta", "Total da conta", brl(data.accountIncome ?? data.totalIncome ?? 0)],
    ["Semanal", "Total semanal", brl(data.weeklyRevenue ?? 0)],
    ["Total", "Conta + semanal", brl(Number(data.accountIncome ?? data.totalIncome ?? 0) + Number(data.weeklyRevenue ?? 0))]
  ], [90, 260, 110]);

  addPdfSectionTitle(doc, "Entradas por canal");
  addPdfTable(doc, ["Grupo", "Canal", "Valor"], data.incomeChannelRows || [], [110, 250, 110]);

  if ((data.negativeDifferenceRows || []).length) {
    addPdfSectionTitle(doc, "Diferenças negativas");
    addPdfTable(doc, ["Indicador", "Atual", "Anterior", "Diferença"], data.negativeDifferenceRows || [], [110, 110, 110, 110]);
  }

  addPdfSectionTitle(doc, "Saídas por categoria");
  addPdfTable(doc, ["Categoria", "Total"], data.expenseCategoryRows || [], [300, 120]);

  addPdfSectionTitle(doc, "Principais despesas");
  addPdfTable(doc, ["Descrição", "Categoria", "Valor"], data.expenseRows || [], [250, 140, 100]);

  addPdfSectionTitle(doc, "Comparativo mensal");
  addPdfTable(doc, ["Indicador", "Atual", "Anterior", "Diferença"], data.comparisonRows || [], [110, 110, 110, 110]);

  addPdfSectionTitle(doc, "Retiradas e diferenças");
  addPdfTable(doc, ["Destino", "Valor"], data.withdrawalRows || [], [250, 140]);

  addPdfSectionTitle(doc, "Cumbucas vendidas na loja");
  addPdfTable(doc, ["Data", "Quantidade", "Observação"], data.storeRows || [], [82, 90, 340]);

  const footerY = 760;
  doc.moveTo(42, footerY).lineTo(245, footerY).stroke("#d1d5db");
  doc.moveTo(295, footerY).lineTo(510, footerY).stroke("#d1d5db");
  doc.fillColor("#69707d").font("Helvetica").fontSize(8).text("Responsável pelo fechamento", 42, footerY + 8);
  doc.text("Conferência financeira", 295, footerY + 8);
  doc.text("Observações: conferir contas, despesas maiores e cumbucas vendidas antes do fechamento.", 300, footerY, {
    width: 240,
    align: "right"
  });

  doc.end();

  return new Promise(resolve => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });
}

async function buildReportXlsx(payload = {}) {
  const data = payload.data || {};
  const zip = new JSZip();
  const summaryRows = [
    ["Período", payload.periodLabel || data.periodKey || ""],
    ["Saldo", data.balance || 0],
    ["Entradas", data.totalIncome || 0],
    ["Saídas", data.expenses || 0],
    ["Saídas operacionais", data.operationalExpenses || 0],
    ["Retiradas", data.withdrawalTotal || 0],
    ["Disponível retirada", data.availableForWithdrawal || 0],
    ["Cumbucas semanal", data.weeklyCashQuantity || 0],
    ["Cumbucas loja", data.storeQuantity || 0],
    ["Cumbucas total", data.totalSoldQuantity || 0]
  ];

  const sheets = [
    ["Resumo", summaryRows],
    ["Entradas", [["Data", "Descrição", "Valor"], ...(data.incomeRows || [])]],
    ["Despesas", [["Data", "Descrição", "Categoria", "Valor"], ...(data.expenseRows || [])]],
    ["Canais", [["Data", "Débito", "Crédito", "Pix", "Dinheiro", "iFood", "99 Food", "Total"], ...(data.channelRows || [])]],
    ["Comparativo", [["Indicador", "Atual", "Anterior", "Diferença"], ...(data.comparisonRows || [])]],
    ["Clientes", [["Cliente", "Telefone", "Perfil", "Pedidos", "Cumbucas", "Total", "Pendências"], ...(data.clientRows || [])]],
    ["Retiradas", [["Destino", "Valor"], ...(data.withdrawalRows || [])]],
    ["Loja", [["Data", "Quantidade", "Observação"], ...(data.storeRows || [])]],
    ["Caixa", [["Data", "Descrição", "Tipo", "Categoria", "Valor"], ...(data.cashRows || [])]]
  ];

  function xml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function columnName(index) {
    let name = "";
    let current = index + 1;
    while (current > 0) {
      const remainder = (current - 1) % 26;
      name = String.fromCharCode(65 + remainder) + name;
      current = Math.floor((current - 1) / 26);
    }
    return name;
  }

  function sheetXml(rows) {
    const body = rows.map((row, rowIndex) => {
      const cells = row.map((value, columnIndex) => {
        const ref = `${columnName(columnIndex)}${rowIndex + 1}`;
        if (typeof value === "number" && Number.isFinite(value)) {
          return `<c r="${ref}"><v>${value}</v></c>`;
        }
        return `<c r="${ref}" t="inlineStr"><is><t>${xml(value)}</t></is></c>`;
      }).join("");
      return `<row r="${rowIndex + 1}">${cells}</row>`;
    }).join("");
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${body}</sheetData></worksheet>`;
  }

  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  ${sheets.map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}
</Types>`);
  zip.folder("_rels").file(".rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`);
  zip.folder("xl").file("workbook.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>${sheets.map(([name], index) => `<sheet name="${xml(name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join("")}</sheets>
</workbook>`);
  zip.folder("xl").folder("_rels").file("workbook.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${sheets.map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join("")}
</Relationships>`);
  const worksheetFolder = zip.folder("xl").folder("worksheets");
  sheets.forEach(([, rows], index) => {
    worksheetFolder.file(`sheet${index + 1}.xml`, sheetXml(rows));
  });

  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

function weeklyMenu(payload = {}) {
  const meals = Array.isArray(payload.meals) ? payload.meals : [];
  const allowedStatuses = ["planejado", "compras", "preparo", "pronto"];
  const plan = Array.from({ length: 5 }, (_, index) => {
    const found = meals[index] || {};
    const status = allowedStatuses.includes(found.status) ? found.status : "planejado";
    const ingredients = Array.isArray(found.ingredients)
      ? found.ingredients
        .map(item => ({
          name: String(item.name || "").trim(),
          value: number(item.value)
        }))
        .filter(item => item.name || item.value > 0)
      : [];
    const ingredientCost = ingredients.reduce((sum, item) => sum + item.value, 0);
    return {
      slot: index + 1,
      dish: String(found.dish || "").trim(),
      ingredients,
      cost: ingredientCost || number(found.cost),
      status,
      notes: String(found.notes || "").trim()
    };
  });

  return {
    totalCost: plan.reduce((sum, item) => sum + item.cost, 0),
    readyCount: plan.filter(item => item.status === "pronto").length,
    plan
  };
}

function serveStatic(req, res, pathname) {
  const requestPath = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.normalize(path.join(PUBLIC_DIR, requestPath));

  if (!filePath.startsWith(PUBLIC_DIR)) {
    sendJson(res, 403, { error: "Acesso negado." });
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      fs.readFile(path.join(PUBLIC_DIR, "index.html"), (fallbackError, fallbackData) => {
        if (fallbackError) {
          sendJson(res, 404, { error: "Arquivo não encontrado." });
          return;
        }
        res.writeHead(200, { "Content-Type": mimeTypes[".html"] });
        res.end(fallbackData);
      });
      return;
    }

    const extension = path.extname(filePath);
    res.writeHead(200, { "Content-Type": mimeTypes[extension] || "application/octet-stream" });
    res.end(data);
  });
}

async function handleRequest(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  let user = null;
  let authenticated = false;

  try {
    if (req.method === "GET" && url.pathname === "/api/health") {
      let database = false;
      try {
        database = await ensureStateTable();
      } catch (error) {
        database = false;
      }
      sendJson(res, 200, {
        status: "online",
        database
      });
      return;
    }

    user = await currentUser(req);
    authenticated = Boolean(user);

    if (req.method === "GET" && url.pathname === "/api/session") {
      sendJson(res, 200, { authenticated, user });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/login") {
      const payload = await collectBody(req);
      const username = String(payload.username || "").trim().toLowerCase();
      if (loginBlocked(req, username)) {
        sendJson(res, 429, { error: "Muitas tentativas. Aguarde alguns minutos e tente novamente." });
        return;
      }
      const authUser = await findAuthUser(username, String(payload.password || ""));
      if (authUser) {
        clearLoginFailures(req, username);
        await writeEvent("login", `Usuário ${authUser.username} entrou no sistema.`, authUser);
        sendJson(res, 200, { ok: true, user: { username: authUser.username, name: authUser.name, role: authUser.role } }, {
          "Set-Cookie": sessionCookie(`${authUser.username}.${userSessionToken(authUser)}`, 60 * 60 * 24 * 30)
        });
        return;
      }
      registerLoginFailure(req, username);
      await writeEvent("login_falhou", `Tentativa invalida para ${username || "usuario vazio"}.`, { username: username || "" });
      sendJson(res, 401, { error: "Login ou senha inválidos." });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/logout") {
      if (user) {
        await writeEvent("logout", `Usuário ${user.username} saiu do sistema.`, user);
      }
      sendJson(res, 200, { ok: true }, {
        "Set-Cookie": sessionCookie("", 0)
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/login") {
      if (authenticated) {
        redirect(res, "/");
        return;
      }
      serveStatic(req, res, "/login.html");
      return;
    }

    const publicFiles = ["/styles.css", "/login.js", "/logo-cumbuca.svg", "/manifest.json", "/sw.js"];
    if (!authenticated) {
      if (req.method === "GET" && publicFiles.includes(url.pathname)) {
        serveStatic(req, res, url.pathname);
        return;
      }

      if (url.pathname.startsWith("/api/")) {
        sendJson(res, 401, { error: "Faça login para continuar." });
        return;
      }

      if (req.method === "GET") {
        redirect(res, "/login");
        return;
      }
    }

    if (req.method === "GET" && url.pathname === "/api/tools") {
      sendJson(res, 200, { tools });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/state") {
      sendJson(res, 200, await readAppState());
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/state") {
      const payload = await collectBody(req);
      sendJson(res, 200, await writeAppState(payload.state || payload));
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/reset-state") {
      if (user?.role !== "admin") {
        sendJson(res, 403, { error: "Acesso restrito ao administrador." });
        return;
      }
      const payload = await collectBody(req);
      if (payload.confirm !== "LIMPAR") {
        sendJson(res, 400, { error: "Confirme com LIMPAR para apagar os dados." });
        return;
      }
      sendJson(res, 200, await resetAppState(user));
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/backups") {
      sendJson(res, 200, await listBackups());
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/manual-backup") {
      const payload = await collectBody(req);
      const statePayload = normalizeState(payload.state || payload);
      const result = await writeAutomaticBackup(statePayload);
      if (result.database && result.saved) {
        await writeEvent("backup_manual_supabase", "Backup manual salvo no Supabase.", user);
      }
      sendJson(res, 200, {
        ...result,
        preview: backupPreview(statePayload)
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/database-usage") {
      sendJson(res, 200, await databaseUsage());
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/backups/delete-old") {
      if (user?.role !== "admin") {
        sendJson(res, 403, { error: "Acesso restrito ao administrador." });
        return;
      }
      const payload = await collectBody(req);
      const result = await deleteOldBackups(payload.keepDays);
      if (result.database) {
        await writeEvent("backups_antigos_apagados", `${result.deleted || 0} backup(s) apagado(s).`, user);
      }
      sendJson(res, 200, result);
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/backup") {
      const backupDate = url.searchParams.get("date");
      if (!backupDate) {
        sendJson(res, 400, { error: "Informe a data do backup." });
        return;
      }
      const result = await readBackup(backupDate);
      if (!result.backup) {
        sendJson(res, 404, { error: "Backup não encontrado." });
        return;
      }
      const body = JSON.stringify(result.backup.payload, null, 2);
      res.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="cumbuca-backup-${backupDate}.json"`,
        "Content-Length": Buffer.byteLength(body)
      });
      res.end(body);
      return;
    }

    if (req.method === "DELETE" && url.pathname === "/api/backup") {
      if (user?.role !== "admin") {
        sendJson(res, 403, { error: "Acesso restrito ao administrador." });
        return;
      }
      const backupDate = url.searchParams.get("date");
      if (!backupDate) {
        sendJson(res, 400, { error: "Informe a data do backup." });
        return;
      }
      const result = await deleteBackup(backupDate);
      if (result.database && result.deleted) {
        await writeEvent("backup_apagado", `Backup ${backupDate} apagado.`, user);
      }
      sendJson(res, result.deleted ? 200 : 404, result.deleted ? result : { ...result, error: "Backup não encontrado." });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/backup-preview") {
      const backupDate = url.searchParams.get("date");
      if (!backupDate) {
        sendJson(res, 400, { error: "Informe a data do backup." });
        return;
      }
      const result = await readBackup(backupDate);
      if (!result.backup) {
        sendJson(res, 404, { error: "Backup não encontrado." });
        return;
      }
      sendJson(res, 200, {
        database: result.database,
        backupDate,
        createdAt: result.backup.created_at,
        updatedAt: result.backup.updated_at,
        preview: backupPreview(result.backup.payload)
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/restore-backup") {
      if (user?.role !== "admin") {
        sendJson(res, 403, { error: "Acesso restrito ao administrador." });
        return;
      }
      const payload = await collectBody(req);
      const result = await restoreBackup(payload.date);
      if (result.database && result.restored) {
        await writeEvent("backup_restaurado", `Backup ${payload.date} restaurado.`, user);
      }
      sendJson(res, 200, result);
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/events") {
      if (user?.role !== "admin") {
        sendJson(res, 403, { error: "Acesso restrito ao administrador." });
        return;
      }
      sendJson(res, 200, await listEvents(url.searchParams.get("limit")));
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/users") {
      if (user?.role !== "admin") {
        sendJson(res, 403, { error: "Acesso restrito ao administrador." });
        return;
      }
      sendJson(res, 200, await listUsers());
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/users") {
      if (user?.role !== "admin") {
        sendJson(res, 403, { error: "Acesso restrito ao administrador." });
        return;
      }
      const payload = await collectBody(req);
      sendJson(res, 200, await upsertUser(payload, user));
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/users/active") {
      if (user?.role !== "admin") {
        sendJson(res, 403, { error: "Acesso restrito ao administrador." });
        return;
      }
      const payload = await collectBody(req);
      sendJson(res, 200, await setUserActive(payload.username, payload.active, user));
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/change-password") {
      const payload = await collectBody(req);
      const result = await changeOwnPassword(user, payload);
      const headers = result.saved && result.session
        ? { "Set-Cookie": sessionCookie(result.session, 60 * 60 * 24 * 30) }
        : {};
      sendJson(res, result.saved ? 200 : 400, result, headers);
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/persistence-check") {
      sendJson(res, 200, await verifyPersistence());
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/report-pdf") {
      const payload = await collectBody(req);
      const pdf = await buildReportPdf(payload);
      res.writeHead(200, {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${payload.filename || "cumbuca-relatorio.pdf"}"`,
        "Content-Length": pdf.length
      });
      res.end(pdf);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/report-xlsx") {
      const payload = await collectBody(req);
      const xlsx = await buildReportXlsx(payload);
      res.writeHead(200, {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${payload.filename || "cumbuca-relatorio.xlsx"}"`,
        "Content-Length": xlsx.length
      });
      res.end(xlsx);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/fluxo-de-caixa") {
      const payload = await collectBody(req);
      sendJson(res, 200, calculateCashFlow(payload.entries));
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/menu-semanal") {
      const payload = await collectBody(req);
      sendJson(res, 200, weeklyMenu(payload));
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/precificacao") {
      const payload = await collectBody(req);
      sendJson(res, 200, calculatePricing(payload));
      return;
    }

    if (req.method === "GET") {
      serveStatic(req, res, url.pathname);
      return;
    }

    sendJson(res, 405, { error: "Método não permitido." });
  } catch (error) {
    sendJson(res, 400, { error: error.message || "Requisição inválida." });
  }
}

const server = http.createServer(handleRequest);

if (!process.env.VERCEL) {
  server.listen(PORT, () => {
    console.log(`Cumbuca Tools rodando em http://localhost:${PORT}`);
  });
}

module.exports = handleRequest;
