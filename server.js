const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const PDFDocument = require('pdfkit');
const JSZip = require('jszip');
const partnerAccountRules = require('./public/partner-accounts');
const { normalizePartnerAccounts, validatePartnerAccountState } = partnerAccountRules;
const accountTransferRules = require('./public/account-transfers');
const { normalizeAccountTransfers, validateAccountTransferState } = accountTransferRules;
let Pool = null;
try {
  ({ Pool } = require('pg'));
} catch (error) {
  Pool = null;
}

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const AUTH_USER = process.env.CUMBUCA_USER || 'cumbuca';
const AUTH_PASSWORD = process.env.CUMBUCA_PASSWORD || 'cumbuca2026';
const AUTH_SECRET = process.env.CUMBUCA_AUTH_SECRET || 'cumbuca-local-secret';
const SESSION_COOKIE = 'cumbuca_session';
const DATABASE_URL =
  process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL || process.env.DATABASE_URL;
const ALERT_WEBHOOK_URL = process.env.CUMBUCA_ALERT_WEBHOOK_URL || '';
const EXTERNAL_BACKUP_URL = process.env.CUMBUCA_EXTERNAL_BACKUP_URL || '';
const INTEGRATION_TOKEN = process.env.CUMBUCA_INTEGRATION_TOKEN || '';
const RESET_TOKEN = process.env.CUMBUCA_RESET_TOKEN || '';
const loginAttempts = new Map();
const permissionKeys = [
  'editFinancial',
  'managePartnerAdjustments',
  'manageClosings',
  'restoreBackup',
  'clearData',
];
const stateKeys = [
  'cashEntries',
  'partnerAccounts',
  'weeklyMenusByPeriod',
  'weeklyMenuSupermarketCostsByPeriod',
  'menuWeek',
  'menuPeriod',
  'menuDatesByPeriod',
  'clients',
  'orders',
  'storeSales',
  'storeProducts',
  'storeProductQuantities',
  'channelReceipts',
  'cashCategories',
  'archivedCashCategories',
  'suppliers',
  'expenseReasons',
  'archivedExpenseReasons',
  'auditLog',
  'monthlyClosings',
  'weeklyClosings',
  'pricingIngredients',
  'pricingRecipes',
  'pricingConfig',
  'cashFilter',
  'financialPlanning',
  'appConfig',
];

const financialResetKeys = [
  'cashEntries',
  'partnerAccounts',
  'storeSales',
  'storeProductQuantities',
  'channelReceipts',
  'monthlyClosings',
  'weeklyClosings',
];

const defaultState = {
  cashEntries: [],
  partnerAccounts: partnerAccountRules.defaultPartnerAccounts(),
  weeklyMenusByPeriod: {},
  weeklyMenuSupermarketCostsByPeriod: {},
  menuWeek: 1,
  menuPeriod: {
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
  },
  menuDatesByPeriod: {},
  clients: [],
  orders: [],
  storeSales: [],
  storeProducts: [],
  storeProductQuantities: [],
  channelReceipts: [],
  cashCategories: null,
  archivedCashCategories: { income: [], expense: [] },
  suppliers: [],
  expenseReasons: [],
  archivedExpenseReasons: [],
  auditLog: [],
  monthlyClosings: {},
  weeklyClosings: {},
  pricingIngredients: [],
  pricingRecipes: [],
  pricingConfig: {},
  cashFilter: { period: 'all' },
  financialPlanning: {
    savings: '',
    savingsUpdatedAt: '',
    savingsHistory: [],
    accountTransfers: [],
    partnersHistory: [],
    monthlyGoal: '',
    improvements: [],
    purchases: [],
    cycleStartDate: '',
    openingBalance: '',
    openingSavings: '',
    cycleNote: '',
    accounts: [],
    employees: [],
    reconciliationHistory: [],
    dailyClosings: {},
    monthlyBudgets: {},
  },
  appConfig: {
    storeName: 'Cumbuca',
    defaultRoute: 'home',
    homeDashboardVersion: '2026-06-budget',
    splitSavingsPercent: 10,
    splitVanessaPercent: 70,
    splitRaquelPercent: 30,
    defaultPackagingCost: 0,
    defaultFixedFee: 0,
    defaultVariableFeePercent: 0,
    defaultDesiredMarginPercent: 30,
    backupReminderDays: 7,
  },
};

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeState(payload = {}) {
  const state = Object.fromEntries(
    stateKeys.map((key) => [
      key,
      Object.prototype.hasOwnProperty.call(payload, key)
        ? payload[key]
        : cloneJson(defaultState[key]),
    ])
  );
  state.partnerAccounts = normalizePartnerAccounts(state.partnerAccounts);
  state.financialPlanning =
    state.financialPlanning && typeof state.financialPlanning === 'object'
      ? state.financialPlanning
      : cloneJson(defaultState.financialPlanning);
  state.financialPlanning.accountTransfers = normalizeAccountTransfers(
    state.financialPlanning.accountTransfers
  );
  return state;
}

function normalizedPermissions(value = {}, role = 'operator') {
  const source = value && typeof value === 'object' ? value : {};
  const defaults =
    role === 'admin'
      ? Object.fromEntries(permissionKeys.map((key) => [key, true]))
      : {
          editFinancial: true,
          managePartnerAdjustments: false,
          manageClosings: false,
          restoreBackup: false,
          clearData: false,
        };
  return Object.fromEntries(
    permissionKeys.map((key) => [
      key,
      Object.prototype.hasOwnProperty.call(source, key) ? Boolean(source[key]) : defaults[key],
    ])
  );
}

function userCan(user, permission) {
  return Boolean(user && (user.role === 'admin' || user.permissions?.[permission]));
}

function jsonEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function monthKeyFromDate(dateKey) {
  return String(dateKey || '').slice(0, 7);
}

function weekRangeFromDate(dateKey) {
  const date = new Date(`${String(dateKey || '').slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  const day = date.getUTCDay() || 7;
  const start = new Date(date);
  start.setUTCDate(start.getUTCDate() - day + 1);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

function weeklyClosingKey(start, end) {
  return `${start}_${end}`;
}

function lockedClosingForDate(state, dateKey) {
  const date = String(dateKey || '').slice(0, 10);
  if (!date) {
    return null;
  }
  const monthKey = monthKeyFromDate(date);
  const monthClosing = state.monthlyClosings?.[monthKey];
  if (monthClosing && monthClosing.locked !== false) {
    return { type: 'month', key: monthKey, closing: monthClosing };
  }
  const range = weekRangeFromDate(date);
  const weekKey = range ? weeklyClosingKey(range.start, range.end) : '';
  const weekClosing = weekKey ? state.weeklyClosings?.[weekKey] : null;
  if (weekClosing && weekClosing.locked !== false) {
    return { type: 'week', key: weekKey, closing: weekClosing };
  }
  const dayClosing = state.financialPlanning?.dailyClosings?.[date];
  return dayClosing && dayClosing.locked !== false
    ? { type: 'day', key: date, closing: dayClosing }
    : null;
}

function recordIdentity(record = {}, index = 0) {
  return String(record.id || record.orderId || record.saleId || `${record.date || ''}:${index}`);
}

function changedRecordDates(previous = [], next = []) {
  const before = new Map(previous.map((record, index) => [recordIdentity(record, index), record]));
  const after = new Map(next.map((record, index) => [recordIdentity(record, index), record]));
  const dates = new Set();
  new Set([...before.keys(), ...after.keys()]).forEach((key) => {
    const oldRecord = before.get(key);
    const newRecord = after.get(key);
    if (!jsonEqual(oldRecord, newRecord)) {
      [oldRecord, newRecord].filter(Boolean).forEach((record) => {
        const date = String(
          record.date ||
            (record.month ? `${record.month}-01` : '') ||
            record.paidAt ||
            record.createdAt ||
            ''
        ).slice(0, 10);
        if (date) {
          dates.add(date);
        }
      });
    }
  });
  return [...dates];
}

function changedRecordMonths(previous = [], next = []) {
  const before = new Map(previous.map((record, index) => [recordIdentity(record, index), record]));
  const after = new Map(next.map((record, index) => [recordIdentity(record, index), record]));
  const months = new Set();
  new Set([...before.keys(), ...after.keys()]).forEach((key) => {
    const oldRecord = before.get(key);
    const newRecord = after.get(key);
    if (!jsonEqual(oldRecord, newRecord)) {
      [oldRecord, newRecord].filter(Boolean).forEach((record) => {
        const month = String(record.month || '').slice(0, 7);
        if (/^\d{4}-\d{2}$/.test(month)) {
          months.add(month);
        }
      });
    }
  });
  return [...months];
}

function partnerAccountDatedRecords(value = {}) {
  const account = normalizePartnerAccounts(value);
  return [...account.movements, ...account.withdrawalSnapshots];
}

function partnerManualAdjustmentsChanged(previous = {}, next = {}) {
  const manualRows = (value) =>
    normalizePartnerAccounts(value).movements.filter(
      (movement) => movement.type === 'manual_adjustment'
    );
  return !jsonEqual(manualRows(previous), manualRows(next));
}

function stateWriteViolation(
  currentState,
  payload = {},
  { allowClosings = false, bypassLocks = false } = {}
) {
  if (!allowClosings) {
    for (const key of ['monthlyClosings', 'weeklyClosings']) {
      if (
        Object.prototype.hasOwnProperty.call(payload, key) &&
        !jsonEqual(payload[key], currentState[key])
      ) {
        return {
          statusCode: 403,
          message: 'Fechamentos devem ser alterados pelos controles de fechamento.',
        };
      }
    }
  }
  if (bypassLocks) {
    return null;
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'financialPlanning')) {
    const previousTransfers = normalizeAccountTransfers(
      currentState.financialPlanning?.accountTransfers
    );
    const nextTransfers = normalizeAccountTransfers(payload.financialPlanning?.accountTransfers);
    const transferDates = changedRecordDates(previousTransfers, nextTransfers);
    for (const date of transferDates) {
      const locked = lockedClosingForDate(currentState, date);
      if (locked) {
        const period =
          locked.type === 'month'
            ? locked.key
            : locked.type === 'week'
            ? locked.key.replace('_', ' a ')
            : locked.key;
        return {
          statusCode: 409,
          message: `O período ${period} está fechado. Reabra o período antes de alterar transferências.`,
        };
      }
    }
  }
  for (const key of [
    'cashEntries',
    'partnerAccounts',
    'storeSales',
    'storeProductQuantities',
    'channelReceipts',
    'orders',
  ]) {
    if (!Object.prototype.hasOwnProperty.call(payload, key)) {
      continue;
    }
    if (key === 'storeProductQuantities') {
      const months = changedRecordMonths(currentState[key] || [], payload[key] || []);
      for (const month of months) {
        const closing = currentState.monthlyClosings?.[month];
        if (closing && closing.locked !== false) {
          return {
            statusCode: 409,
            message: `O período ${month} está fechado. Reabra o período antes de alterar valores.`,
          };
        }
      }
      continue;
    }
    const previousRecords =
      key === 'partnerAccounts'
        ? partnerAccountDatedRecords(currentState[key])
        : currentState[key] || [];
    const nextRecords =
      key === 'partnerAccounts' ? partnerAccountDatedRecords(payload[key]) : payload[key] || [];
    const dates = changedRecordDates(previousRecords, nextRecords);
    for (const date of dates) {
      const locked = lockedClosingForDate(currentState, date);
      if (locked) {
        const period =
          locked.type === 'month'
            ? locked.key
            : locked.type === 'week'
            ? locked.key.replace('_', ' a ')
            : locked.key;
        return {
          statusCode: 409,
          message: `O período ${period} está fechado. Reabra o período antes de alterar valores.`,
        };
      }
    }
  }
  return null;
}

function financialPayloadChanged(currentState, payload = {}) {
  return [
    'cashEntries',
    'partnerAccounts',
    'storeSales',
    'storeProducts',
    'storeProductQuantities',
    'channelReceipts',
    'orders',
    'financialPlanning',
  ].some(
    (key) =>
      Object.prototype.hasOwnProperty.call(payload, key) &&
      !jsonEqual(payload[key], currentState[key])
  );
}

function bulkFinancialClearRequested(currentState, payload = {}) {
  const keys = ['cashEntries', 'storeSales', 'storeProductQuantities', 'channelReceipts', 'orders'];
  let populatedCollectionsCleared = 0;
  let recordsBefore = 0;
  let recordsAfter = 0;

  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(payload, key)) {
      continue;
    }
    const before = Array.isArray(currentState[key]) ? currentState[key] : [];
    const after = Array.isArray(payload[key]) ? payload[key] : [];
    recordsBefore += before.length;
    recordsAfter += after.length;
    if (before.length > 0 && after.length === 0) {
      populatedCollectionsCleared += 1;
    }
  }

  const largeReduction = recordsBefore >= 20 && recordsAfter <= Math.floor(recordsBefore * 0.2);
  return populatedCollectionsCleared >= 2 || largeReduction;
}

function databaseUrl() {
  if (!DATABASE_URL) {
    return '';
  }

  try {
    const url = new URL(DATABASE_URL);
    ['sslmode', 'sslcert', 'sslkey', 'sslrootcert', 'channel_binding'].forEach((param) => {
      url.searchParams.delete(param);
    });
    return url.toString();
  } catch (error) {
    return DATABASE_URL;
  }
}

const db =
  DATABASE_URL && Pool
    ? new Pool({
        connectionString: databaseUrl(),
        ssl: process.env.PGSSLMODE === 'disable' ? false : { rejectUnauthorized: false },
      })
    : null;

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.ico': 'image/x-icon',
};

const tools = [
  {
    id: 'fluxo-de-caixa',
    title: 'Fluxo de Caixa',
    description: 'Registre entradas e saídas, veja saldo previsto e acompanhe o mês.',
  },
  {
    id: 'menu-semanal',
    title: 'Menu Semanal',
    description: 'Planeje refeições da semana com custos, status e observações.',
  },
  {
    id: 'precificacao',
    title: 'Precificação',
    description: 'Calcule preço de venda a partir de custo, perdas, taxas e margem.',
  },
  {
    id: 'relatorios',
    title: 'Relatórios',
    description: 'Consolide vendas, caixa, clientes e cardápio por período.',
  },
];

const securityHeaders = {
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; block-all-mixed-content",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=(), payment=()',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'X-XSS-Protection': '0',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
};

// Environment security checks and flags
const PRODUCTION = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
if (PRODUCTION) {
  if (!process.env.CUMBUCA_AUTH_SECRET || AUTH_SECRET === 'cumbuca-local-secret') {
    console.warn('SECURITY WARNING: configure CUMBUCA_AUTH_SECRET in production.');
  }
  if (!process.env.CUMBUCA_PASSWORD || AUTH_PASSWORD === 'cumbuca2026') {
    console.warn('SECURITY WARNING: configure a private CUMBUCA_PASSWORD in production.');
  }
}

function mergeHeaders(headers = {}) {
  return { ...securityHeaders, ...headers };
}

function sendJson(res, statusCode, payload, extraHeaders = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(
    statusCode,
    mergeHeaders({
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': Buffer.byteLength(body),
      ...extraHeaders,
    })
  );
  res.end(body);
}

function redirect(res, location) {
  res.writeHead(302, mergeHeaders({ Location: location }));
  res.end();
}

function parseCookies(req) {
  return String(req.headers.cookie || '')
    .split(';')
    .map((cookie) => cookie.trim())
    .filter(Boolean)
    .reduce((cookies, cookie) => {
      const index = cookie.indexOf('=');
      if (index === -1) {
        return cookies;
      }
      cookies[decodeURIComponent(cookie.slice(0, index))] = decodeURIComponent(
        cookie.slice(index + 1)
      );
      return cookies;
    }, {});
}

function envAuthUsers() {
  const fallback = [
    { username: AUTH_USER, password: AUTH_PASSWORD, name: AUTH_USER, role: 'admin' },
  ];
  if (!process.env.CUMBUCA_USERS) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(process.env.CUMBUCA_USERS);
    if (!Array.isArray(parsed)) {
      return fallback;
    }
    const users = parsed
      .filter((user) => user?.username && user?.password)
      .map((user) => ({
        username: String(user.username),
        password: String(user.password),
        name: String(user.name || user.username),
        role: user.role === 'admin' ? 'admin' : 'operator',
        permissions: normalizedPermissions(
          user.permissions,
          user.role === 'admin' ? 'admin' : 'operator'
        ),
      }));
    return users.length ? users : fallback;
  } catch (error) {
    return fallback;
  }
}

function userSessionToken(user) {
  return crypto
    .createHmac('sha256', AUTH_SECRET)
    .update(`${user.username}:${user.sessionSecret || user.password || ''}`)
    .digest('hex');
}

function sessionToken() {
  return userSessionToken({ username: AUTH_USER, sessionSecret: AUTH_PASSWORD });
}

function passwordHash(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto
    .pbkdf2Sync(String(password || ''), salt, 120000, 32, 'sha256')
    .toString('hex');
  return `pbkdf2$${salt}$${hash}`;
}

function verifyPassword(password, storedHash) {
  const [scheme, salt, hash] = String(storedHash || '').split('$');
  if (scheme !== 'pbkdf2' || !salt || !hash) {
    return false;
  }
  const candidate = crypto.pbkdf2Sync(String(password || ''), salt, 120000, 32, 'sha256');
  const expected = Buffer.from(hash, 'hex');
  return expected.length === candidate.length && crypto.timingSafeEqual(expected, candidate);
}

function secureTokenMatches(expectedValue, candidateValue) {
  const expected = Buffer.from(String(expectedValue || ''));
  const candidate = Buffer.from(String(candidateValue || ''));
  return (
    expected.length > 0 &&
    expected.length === candidate.length &&
    crypto.timingSafeEqual(expected, candidate)
  );
}

function maintenanceResetTokenAuthorized(req) {
  return secureTokenMatches(RESET_TOKEN, req.headers['x-cumbuca-reset-token']);
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
      permissions jsonb not null default '{}'::jsonb,
      password_hash text not null,
      active boolean not null default true,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);
  await db.query(`
    alter table cumbuca_app_users
    add column if not exists permissions jsonb not null default '{}'::jsonb
  `);

  const count = Number(
    (await db.query('select count(*)::int as count from cumbuca_app_users')).rows[0]?.count || 0
  );
  if (count === 0) {
    for (const user of envAuthUsers()) {
      await db.query(
        `insert into cumbuca_app_users (username, name, role, permissions, password_hash, active, created_at, updated_at)
         values ($1, $2, $3, $4::jsonb, $5, true, now(), now())
         on conflict (username) do nothing`,
        [
          user.username,
          user.name || user.username,
          user.role === 'admin' ? 'admin' : 'operator',
          JSON.stringify(normalizedPermissions(user.permissions, user.role)),
          passwordHash(user.password),
        ]
      );
    }
  }
  return true;
}

function publicUser(row) {
  return {
    username: row.username,
    name: row.name,
    role: row.role === 'admin' ? 'admin' : 'operator',
    permissions: normalizedPermissions(row.permissions, row.role),
    active: row.active !== false,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

async function findAuthUser(username, password) {
  if (await ensureUserTable()) {
    const result = await db.query(
      'select username, name, role, permissions, password_hash, active from cumbuca_app_users where username = $1 and active = true',
      [username]
    );
    const row = result.rows[0];
    if (row && verifyPassword(password, row.password_hash)) {
      return {
        username: row.username,
        name: row.name,
        role: row.role === 'admin' ? 'admin' : 'operator',
        permissions: normalizedPermissions(row.permissions, row.role),
        sessionSecret: row.password_hash,
      };
    }
    return null;
  }

  const envUser =
    envAuthUsers().find((user) => user.username === username && user.password === password) || null;
  return envUser ? { ...envUser, sessionSecret: envUser.password } : null;
}

async function currentUser(req) {
  const cookieValue = parseCookies(req)[SESSION_COOKIE] || '';
  const [username, token] = cookieValue.split('.');
  if (username && token && (await ensureUserTable())) {
    const result = await db.query(
      'select username, name, role, permissions, password_hash, active from cumbuca_app_users where username = $1 and active = true',
      [username]
    );
    const row = result.rows[0];
    if (
      row &&
      token === userSessionToken({ username: row.username, sessionSecret: row.password_hash })
    ) {
      return {
        username: row.username,
        name: row.name,
        role: row.role === 'admin' ? 'admin' : 'operator',
        permissions: normalizedPermissions(row.permissions, row.role),
      };
    }
  }

  const user = envAuthUsers().find((item) => item.username === username);
  if (user && token === userSessionToken({ ...user, sessionSecret: user.password })) {
    return {
      username: user.username,
      name: user.name,
      role: user.role || 'operator',
      permissions: normalizedPermissions(user.permissions, user.role),
    };
  }

  if (cookieValue === sessionToken()) {
    return {
      username: AUTH_USER,
      name: AUTH_USER,
      role: 'admin',
      permissions: normalizedPermissions({}, 'admin'),
    };
  }

  return null;
}

function sessionCookie(value, maxAge) {
  const secureFlag =
    process.env.FORCE_SECURE_COOKIE === 'true' ||
    process.env.VERCEL === '1' ||
    process.env.NODE_ENV === 'production';
  const secure = secureFlag ? '; Secure' : '';
  return `${SESSION_COOKIE}=${encodeURIComponent(
    value
  )}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${secure}`;
}

function loginAttemptKey(req, username) {
  const forwarded = String(req.headers['x-forwarded-for'] || '')
    .split(',')[0]
    .trim();
  return `${forwarded || req.socket.remoteAddress || 'local'}:${username || ''}`;
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
    blockedUntil: count >= 5 ? Date.now() + 10 * 60 * 1000 : 0,
  });
}

function clearLoginFailures(req, username) {
  loginAttempts.delete(loginAttemptKey(req, username));
}

function collectBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        req.destroy();
        reject(new Error('Payload muito grande.'));
      }
    });
    req.on('end', () => {
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
  await db.query(`
    alter table cumbuca_app_users
    add column if not exists permissions jsonb not null default '{}'::jsonb
  `);
  await db.query(`
    create table if not exists cumbuca_app_backup_versions (
      backup_id text primary key,
      backup_date date not null,
      backup_at timestamptz not null default now(),
      source text not null default 'automatic',
      payload jsonb not null
    )
  `);
  await db.query(`
    create index if not exists cumbuca_app_backup_versions_date_idx
    on cumbuca_app_backup_versions (backup_date desc, backup_at desc)
  `);
  await db.query(`
    insert into cumbuca_app_backup_versions (backup_id, backup_date, backup_at, source, payload)
    select
      'legacy-' || backup_date::text,
      backup_date,
      coalesce(updated_at, created_at, now()),
      coalesce(payload->>'source', 'legacy'),
      payload
    from cumbuca_app_backups
    on conflict (backup_id) do nothing
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

async function writeEvent(eventType, detail = '', user = null) {
  if (!(await ensureEventTable())) {
    return false;
  }

  await db.query(
    `insert into cumbuca_app_events (event_type, detail, username, created_at)
     values ($1, $2, $3, now())`,
    [
      String(eventType || 'evento'),
      String(detail || ''),
      String(user?.username || user?.name || 'sistema'),
    ]
  );
  return true;
}

async function postIntegration(url, payload) {
  if (!url) {
    return { configured: false, sent: false };
  }
  const headers = { 'Content-Type': 'application/json' };
  if (INTEGRATION_TOKEN) {
    headers.Authorization = `Bearer ${INTEGRATION_TOKEN}`;
  }
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) {
    throw new Error(`Integração respondeu HTTP ${response.status}.`);
  }
  return { configured: true, sent: true, status: response.status };
}

async function sendExternalAlert(payload, user = null) {
  try {
    const result = await postIntegration(ALERT_WEBHOOK_URL, {
      app: 'Cumbuca',
      type: 'alert',
      sentAt: new Date().toISOString(),
      ...payload,
    });
    if (result.sent) {
      try {
        await writeEvent(
          'alerta_externo_enviado',
          String(payload.message || payload.title || 'Alerta enviado.'),
          user
        );
      } catch (eventError) {
        console.error('Falha ao registrar envio de alerta externo.', eventError);
      }
    }
    return result;
  } catch (error) {
    try {
      await writeEvent('alerta_externo_falhou', error.message, user);
    } catch (eventError) {
      console.error('Falha ao registrar erro do alerta externo.', eventError);
    }
    return { configured: true, sent: false, error: error.message };
  }
}

async function sendExternalBackup(backupPayload, backupId, user = null) {
  try {
    const result = await postIntegration(EXTERNAL_BACKUP_URL, {
      app: 'Cumbuca',
      type: 'backup',
      backupId,
      sentAt: new Date().toISOString(),
      backup: backupPayload,
    });
    if (result.sent) {
      try {
        await writeEvent(
          'backup_externo_enviado',
          `Backup ${backupId} enviado para cópia externa.`,
          user
        );
      } catch (eventError) {
        console.error('Falha ao registrar envio do backup externo.', eventError);
      }
    }
    return result;
  } catch (error) {
    try {
      await writeEvent('backup_externo_falhou', `Backup ${backupId}: ${error.message}`, user);
    } catch (eventError) {
      console.error('Falha ao registrar erro do backup externo.', eventError);
    }
    return { configured: true, sent: false, error: error.message };
  }
}

function integrationStatus() {
  return {
    alerts: { configured: Boolean(ALERT_WEBHOOK_URL) },
    externalBackup: { configured: Boolean(EXTERNAL_BACKUP_URL) },
    tokenConfigured: Boolean(INTEGRATION_TOKEN),
  };
}

async function maybeSendIntegrityAlert(result) {
  if (!ALERT_WEBHOOK_URL || result.status !== 'danger' || !db) {
    return { configured: Boolean(ALERT_WEBHOOK_URL), sent: false };
  }
  const recent = await db.query(`
    select id
    from cumbuca_app_events
    where event_type = 'alerta_externo_enviado'
      and created_at >= now() - interval '6 hours'
    limit 1
  `);
  if (recent.rows.length) {
    return { configured: true, sent: false, cooldown: true };
  }
  const problems = (result.checks || [])
    .filter((check) => check.level === 'danger')
    .map((check) => `${check.label}: ${check.detail}`);
  return sendExternalAlert({
    title: 'Cumbuca requer atenção',
    message: problems.join(' | '),
    severity: 'danger',
    checks: result.checks,
  });
}

async function listEvents(limit = 40) {
  if (!(await ensureEventTable())) {
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
  if (!(await ensureUserTable())) {
    return {
      database: false,
      users: envAuthUsers().map((user) => ({
        username: user.username,
        name: user.name,
        role: user.role,
        active: true,
        source: 'env',
      })),
    };
  }

  const result = await db.query(`
    select username, name, role, permissions, active, created_at, updated_at
    from cumbuca_app_users
    order by active desc, name asc, username asc
  `);
  return { database: true, users: result.rows.map(publicUser) };
}

async function upsertUser(payload = {}, actor = null) {
  if (!(await ensureUserTable())) {
    return { database: false, saved: false, error: 'Banco indisponível.' };
  }

  const username = String(payload.username || '')
    .trim()
    .toLowerCase();
  const name = String(payload.name || username).trim();
  const role = payload.role === 'admin' ? 'admin' : 'operator';
  const permissions = normalizedPermissions(payload.permissions, role);
  const password = String(payload.password || '');
  if (!/^[a-z0-9._-]{3,40}$/.test(username)) {
    return {
      database: true,
      saved: false,
      error:
        'Usuário deve ter 3 a 40 caracteres, usando letras, números, ponto, hífen ou underline.',
    };
  }
  if (!name) {
    return { database: true, saved: false, error: 'Informe o nome.' };
  }

  const existing = await db.query('select username from cumbuca_app_users where username = $1', [
    username,
  ]);
  if (!existing.rows.length && password.length < 4) {
    return {
      database: true,
      saved: false,
      error: 'Informe uma senha com pelo menos 4 caracteres.',
    };
  }

  if (existing.rows.length) {
    if (password) {
      await db.query(
        `update cumbuca_app_users
         set name = $2, role = $3, permissions = $4::jsonb, password_hash = $5, active = true, updated_at = now()
         where username = $1`,
        [username, name, role, JSON.stringify(permissions), passwordHash(password)]
      );
      await writeEvent(
        'usuario_atualizado',
        `Usuário ${username} atualizado com nova senha.`,
        actor
      );
    } else {
      await db.query(
        `update cumbuca_app_users
         set name = $2, role = $3, permissions = $4::jsonb, active = true, updated_at = now()
         where username = $1`,
        [username, name, role, JSON.stringify(permissions)]
      );
      await writeEvent('usuario_atualizado', `Usuário ${username} atualizado.`, actor);
    }
  } else {
    await db.query(
      `insert into cumbuca_app_users (username, name, role, permissions, password_hash, active, created_at, updated_at)
       values ($1, $2, $3, $4::jsonb, $5, true, now(), now())`,
      [username, name, role, JSON.stringify(permissions), passwordHash(password)]
    );
    await writeEvent('usuario_criado', `Usuário ${username} criado.`, actor);
  }

  return { database: true, saved: true, user: { username, name, role, permissions, active: true } };
}

async function setUserActive(username, active, actor = null) {
  if (!(await ensureUserTable())) {
    return { database: false, saved: false, error: 'Banco indisponível.' };
  }

  const normalized = String(username || '')
    .trim()
    .toLowerCase();
  if (actor?.username === normalized && active === false) {
    return { database: true, saved: false, error: 'Você não pode desativar seu próprio usuário.' };
  }

  const result = await db.query(
    'update cumbuca_app_users set active = $2, updated_at = now() where username = $1',
    [normalized, Boolean(active)]
  );
  if (!result.rowCount) {
    return { database: true, saved: false, error: 'Usuário não encontrado.' };
  }
  await writeEvent(
    active ? 'usuario_reativado' : 'usuario_desativado',
    `Usuário ${normalized}.`,
    actor
  );
  return { database: true, saved: true };
}

async function changeOwnPassword(user, payload = {}) {
  if (!user?.username) {
    return { database: false, saved: false, error: 'Sessão inválida.' };
  }
  if (!(await ensureUserTable())) {
    return { database: false, saved: false, error: 'Banco indisponivel.' };
  }

  const currentPassword = String(payload.currentPassword || '');
  const newPassword = String(payload.newPassword || '');
  if (newPassword.length < 4) {
    return {
      database: true,
      saved: false,
      error: 'A nova senha precisa ter pelo menos 4 caracteres.',
    };
  }

  const result = await db.query(
    'select username, password_hash from cumbuca_app_users where username = $1 and active = true',
    [user.username]
  );
  const row = result.rows[0];
  if (!row || !verifyPassword(currentPassword, row.password_hash)) {
    return { database: true, saved: false, error: 'Senha atual incorreta.' };
  }

  const nextHash = passwordHash(newPassword);
  await db.query(
    'update cumbuca_app_users set password_hash = $2, updated_at = now() where username = $1',
    [user.username, nextHash]
  );
  await writeEvent('senha_alterada', `Usuário ${user.username} alterou a própria senha.`, user);
  return {
    database: true,
    saved: true,
    session: `${user.username}.${userSessionToken({
      username: user.username,
      sessionSecret: nextHash,
    })}`,
  };
}

function backupVersionId(source = 'automatic', date = new Date()) {
  const timestamp = date.toISOString();
  const normalizedSource =
    String(source || 'automatic')
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'automatic';
  if (normalizedSource === 'automatic') {
    return `${timestamp.slice(0, 13)}:00:00.000Z-automatic`;
  }
  return `${timestamp.replace(/[-:.TZ]/g, '')}-${normalizedSource}-${crypto
    .randomBytes(4)
    .toString('hex')}`;
}

function legacyBackupDate(backupReference) {
  const reference = String(backupReference || '');
  const date = reference.startsWith('legacy-') ? reference.slice(7) : reference;
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : '';
}

async function writeAutomaticBackup(payload = {}, { source = 'automatic', protect = false } = {}) {
  if (!(await ensureBackupTable())) {
    return { database: false, saved: false };
  }

  const backupSource = protect ? 'pre-reset' : source;
  const now = new Date();
  const backupId = backupVersionId(backupSource, now);
  const backupPayload = {
    app: 'Cumbuca',
    version: '1.0.0',
    exportedAt: now.toISOString(),
    source: backupSource,
    data: normalizeState(payload),
  };
  const result = await db.query(
    `insert into cumbuca_app_backup_versions (backup_id, backup_date, backup_at, source, payload)
     values ($1, $2::date, $3::timestamptz, $4, $5::jsonb)
     on conflict (backup_id)
     do update set backup_at = excluded.backup_at, source = excluded.source, payload = excluded.payload
     returning (xmax = 0) as inserted`,
    [
      backupId,
      now.toISOString().slice(0, 10),
      now.toISOString(),
      backupSource,
      JSON.stringify(backupPayload),
    ]
  );
  const shouldSendExternal = result.rows[0]?.inserted === true || backupSource !== 'automatic';
  const externalBackup = shouldSendExternal
    ? await sendExternalBackup(backupPayload, backupId)
    : { configured: Boolean(EXTERNAL_BACKUP_URL), sent: false, reusedHour: true };
  return {
    database: true,
    saved: result.rowCount > 0,
    protected: protect,
    reused: false,
    backupId,
    externalBackup,
  };
}

async function listBackups() {
  if (!(await ensureBackupTable())) {
    return { database: false, backups: [] };
  }

  const result = await db.query(`
    select
      backup_id,
      backup_date,
      backup_at as created_at,
      backup_at as updated_at,
      source
    from cumbuca_app_backup_versions
    order by backup_at desc
    limit 72
  `);
  return { database: true, backups: result.rows };
}

async function databaseUsage() {
  if (!(await ensureStateTable()) || !(await ensureBackupTable())) {
    return { database: false, tables: [] };
  }

  const result = await db.query(
    `
    select
      table_name,
      pg_total_relation_size(format('%I.%I', table_schema, table_name)::regclass) as total_bytes,
      pg_relation_size(format('%I.%I', table_schema, table_name)::regclass) as table_bytes
    from information_schema.tables
    where table_schema = 'public'
      and table_name = any($1::text[])
    order by table_name
  `,
    [['cumbuca_app_state', 'cumbuca_app_backups', 'cumbuca_app_backup_versions']]
  );

  const counts = {};
  counts.cumbuca_app_state = Number(
    (await db.query('select count(*)::int as count from cumbuca_app_state')).rows[0]?.count || 0
  );
  counts.cumbuca_app_backups = Number(
    (await db.query('select count(*)::int as count from cumbuca_app_backups')).rows[0]?.count || 0
  );
  counts.cumbuca_app_backup_versions = Number(
    (await db.query('select count(*)::int as count from cumbuca_app_backup_versions')).rows[0]
      ?.count || 0
  );

  return {
    database: true,
    tables: result.rows.map((row) => ({
      name: row.table_name,
      rows: counts[row.table_name] || 0,
      totalBytes: Number(row.total_bytes || 0),
      tableBytes: Number(row.table_bytes || 0),
    })),
  };
}

async function deleteOldBackups(keepDays = 30) {
  if (!(await ensureBackupTable())) {
    return { database: false, deleted: 0 };
  }

  const days = Math.max(0, Math.min(3650, Number(keepDays || 30)));
  const versionResult = await db.query(
    `delete from cumbuca_app_backup_versions
     where backup_date < current_date - ($1::int * interval '1 day')`,
    [days]
  );
  const legacyResult = await db.query(
    `delete from cumbuca_app_backups
     where backup_date < current_date - ($1::int * interval '1 day')`,
    [days]
  );

  return {
    database: true,
    deleted: (versionResult.rowCount || 0) + (legacyResult.rowCount || 0),
    keepDays: days,
  };
}

async function readBackup(backupReference) {
  if (!(await ensureBackupTable())) {
    return { database: false, backup: null };
  }

  const reference = String(backupReference || '');
  const legacyDate = legacyBackupDate(reference);
  const isLegacyDate = Boolean(legacyDate);
  const result = isLegacyDate
    ? await db.query(
        `select backup_id, backup_date, payload, backup_at as created_at, backup_at as updated_at, source
       from cumbuca_app_backup_versions
       where backup_id = $1 or backup_id = $2
       order by backup_at desc
       limit 1`,
        [reference, `legacy-${legacyDate}`]
      )
    : await db.query(
        `select backup_id, backup_date, payload, backup_at as created_at, backup_at as updated_at, source
       from cumbuca_app_backup_versions
       where backup_id = $1
       limit 1`,
        [reference]
      );
  return { database: true, backup: result.rows[0] || null };
}

async function deleteBackup(backupReference) {
  if (!(await ensureBackupTable())) {
    return { database: false, deleted: 0 };
  }

  const reference = String(backupReference || '');
  const legacyDate = legacyBackupDate(reference);
  const result = await db.query(
    `delete from cumbuca_app_backup_versions
     where backup_id = $1`,
    [legacyDate ? `legacy-${legacyDate}` : reference]
  );
  let legacyDeleted = 0;
  if (legacyDate) {
    const legacyResult = await db.query(
      `delete from cumbuca_app_backups
       where backup_date = $1::date`,
      [legacyDate]
    );
    legacyDeleted = legacyResult.rowCount || 0;
  }

  return {
    database: true,
    deleted: (result.rowCount || 0) + legacyDeleted,
    backupReference: reference,
  };
}

async function restoreBackup(backupReference) {
  const backupResult = await readBackup(backupReference);
  if (!backupResult.database) {
    return { database: false };
  }

  const backup = backupResult.backup;
  if (!backup) {
    return { database: true, restored: false, error: 'Backup não encontrado.' };
  }

  const payload = backup.payload?.data || backup.payload || {};
  const restoredState = normalizeState(payload);
  const result = await writeAppState(restoredState, null, {
    allowClosings: true,
    bypassLocks: true,
    bypassPermissions: true,
  });
  return {
    database: true,
    restored: true,
    backupId: backup.backup_id || '',
    backupDate: backup.backup_date,
    keys: result.saved || [],
  };
}

function backupPreview(payload = {}) {
  const data = normalizeState(payload.data || payload);
  return {
    cash: Array.isArray(data.cashEntries) ? data.cashEntries.length : 0,
    orders: Array.isArray(data.orders) ? data.orders.length : 0,
    clients: Array.isArray(data.clients) ? data.clients.length : 0,
    menus:
      data.weeklyMenusByPeriod && typeof data.weeklyMenusByPeriod === 'object'
        ? Object.keys(data.weeklyMenusByPeriod).length
        : 0,
    menuSupermarketCosts:
      data.weeklyMenuSupermarketCostsByPeriod &&
      typeof data.weeklyMenuSupermarketCostsByPeriod === 'object'
        ? Object.keys(data.weeklyMenuSupermarketCostsByPeriod).length
        : 0,
    menuDates:
      data.menuDatesByPeriod && typeof data.menuDatesByPeriod === 'object'
        ? Object.keys(data.menuDatesByPeriod).length
        : 0,
    storeSales: Array.isArray(data.storeSales) ? data.storeSales.length : 0,
    storeProducts: Array.isArray(data.storeProducts) ? data.storeProducts.length : 0,
    storeProductQuantities: Array.isArray(data.storeProductQuantities)
      ? data.storeProductQuantities.length
      : 0,
    pricingIngredients: Array.isArray(data.pricingIngredients) ? data.pricingIngredients.length : 0,
    pricingRecipes: Array.isArray(data.pricingRecipes) ? data.pricingRecipes.length : 0,
    channelReceipts: Array.isArray(data.channelReceipts) ? data.channelReceipts.length : 0,
    auditLog: Array.isArray(data.auditLog) ? data.auditLog.length : 0,
    monthlyClosings:
      data.monthlyClosings && typeof data.monthlyClosings === 'object'
        ? Object.keys(data.monthlyClosings).length
        : 0,
    weeklyClosings:
      data.weeklyClosings && typeof data.weeklyClosings === 'object'
        ? Object.keys(data.weeklyClosings).length
        : 0,
  };
}

async function verifyPersistence() {
  if (!(await ensureStateTable())) {
    return { database: false };
  }

  const marker = {
    checkedAt: new Date().toISOString(),
    id: crypto.randomUUID(),
  };
  await db.query(
    `insert into cumbuca_app_state (key, value, updated_at)
     values ($1, $2::jsonb, now())
     on conflict (key)
     do update set value = excluded.value, updated_at = now()`,
    ['__healthcheck', JSON.stringify(marker)]
  );
  const readBack = await db.query(
    'select value, updated_at from cumbuca_app_state where key = $1',
    ['__healthcheck']
  );
  const saved = readBack.rows[0]?.value?.id === marker.id;

  return {
    database: true,
    saved,
    checkedAt: marker.checkedAt,
    stateUpdatedAt: readBack.rows[0]?.updated_at || null,
    automaticBackup: false,
  };
}

function cashEntryIncluded(entry = {}) {
  return !(entry.type === 'expense' && entry.dueDate && !entry.paidAt);
}

function financialIntegritySummary(state, backup = null) {
  const cashEntries = Array.isArray(state.cashEntries)
    ? state.cashEntries.filter(cashEntryIncluded)
    : [];
  const totals = cashEntries.reduce(
    (result, entry) => {
      const amount = Math.abs(number(entry.amount));
      if (entry.type === 'expense') {
        result.expenses += amount;
      } else {
        result.income += amount;
      }
      if (String(entry.category || '').replace(/^supplier:/, 'reason:') === 'ajuste-conta') {
        result.adjustments += entry.type === 'expense' ? -amount : amount;
      }
      result.balance = result.income - result.expenses;
      return result;
    },
    { income: 0, expenses: 0, adjustments: 0, balance: 0 }
  );
  totals.savings = Math.max(0, number(state.financialPlanning?.savings));
  totals.consolidatedBalance = totals.balance + totals.savings;
  const unlockedMonths = Object.entries(state.monthlyClosings || {})
    .filter(([, closing]) => closing?.locked === false)
    .map(([key]) => key);
  const unlockedWeeks = Object.entries(state.weeklyClosings || {})
    .filter(([, closing]) => closing?.locked === false)
    .map(([key]) => key);
  const now = new Date();
  const previousMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))
    .toISOString()
    .slice(0, 7);
  const previousMonthClosed = Boolean(
    state.monthlyClosings?.[previousMonth]?.locked !== false &&
      state.monthlyClosings?.[previousMonth]
  );
  const backupAt = backup?.updated_at || backup?.created_at || null;
  const backupAgeHours = backupAt
    ? Math.max(0, (Date.now() - new Date(backupAt).getTime()) / 3600000)
    : null;
  const checks = [
    {
      id: 'account-balance',
      level: totals.balance < 0 ? 'danger' : 'ok',
      label: 'Saldo acumulado',
      detail:
        totals.balance < 0
          ? `Saldo negativo de ${brl(Math.abs(totals.balance))}.`
          : `Saldo ${brl(totals.balance)}.`,
    },
    {
      id: 'backup',
      level: backupAgeHours === null || backupAgeHours > 26 ? 'danger' : 'ok',
      label: 'Backup automático',
      detail:
        backupAgeHours === null
          ? 'Nenhum backup encontrado.'
          : `Ultimo backup ${relativeHoursPtBr(backupAgeHours)}.`,
    },
    {
      id: 'previous-month',
      level: previousMonthClosed ? 'ok' : 'warning',
      label: 'Fechamento mensal',
      detail: previousMonthClosed
        ? `${formatMonthKeyPtBr(previousMonth)} esta fechado.`
        : `${formatMonthKeyPtBr(previousMonth)} ainda esta aberto.`,
    },
    {
      id: 'reopened-periods',
      level: unlockedMonths.length || unlockedWeeks.length ? 'warning' : 'ok',
      label: 'Períodos reabertos',
      detail: reopenedPeriodsText(unlockedMonths.length, unlockedWeeks.length),
    },
  ];
  const status = checks.some((check) => check.level === 'danger')
    ? 'danger'
    : checks.some((check) => check.level === 'warning')
    ? 'warning'
    : 'ok';
  return {
    status,
    checkedAt: new Date().toISOString(),
    totals,
    backup: backup
      ? {
          id: backup.backup_id || '',
          date: backup.backup_date,
          updatedAt: backupAt,
          source: backup.source || '',
        }
      : null,
    closings: {
      previousMonth,
      previousMonthClosed,
      unlockedMonths,
      unlockedWeeks,
    },
    checks,
  };
}

function formatMonthKeyPtBr(key) {
  const [year, month] = String(key || '')
    .split('-')
    .map(Number);
  if (!year || !month) {
    return key || '';
  }
  return new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

function relativeHoursPtBr(hours) {
  const rounded = Math.round(Math.max(0, Number(hours || 0)));
  if (rounded <= 0) {
    return 'ha menos de 1 hora';
  }
  return rounded === 1 ? 'ha 1 hora' : `ha ${rounded} horas`;
}

function reopenedPeriodsText(months, weeks) {
  const monthCount = Number(months || 0);
  const weekCount = Number(weeks || 0);
  if (!monthCount && !weekCount) {
    return 'Nenhum periodo reaberto.';
  }
  const monthText = monthCount === 1 ? '1 mes' : `${monthCount} meses`;
  const weekText = weekCount === 1 ? '1 semana' : `${weekCount} semanas`;
  return `${monthText} e ${weekText} reabertos.`;
}

function formatBytesPtBr(bytes) {
  const value = Number(bytes || 0);
  const formatter = new Intl.NumberFormat('pt-BR', {
    maximumFractionDigits: 1,
  });
  if (value >= 1024 * 1024) {
    return `${formatter.format(value / (1024 * 1024))} MB`;
  }
  if (value >= 1024) {
    return `${formatter.format(value / 1024)} KB`;
  }
  return `${formatter.format(value)} bytes`;
}

function validateBackupPayload(backup) {
  if (!backup) {
    return { valid: false, error: 'Nenhum backup encontrado.' };
  }
  const raw = backup.payload?.data || backup.payload;
  if (!raw || typeof raw !== 'object') {
    return { valid: false, error: 'Conteúdo do backup inválido.' };
  }
  const normalized = normalizeState(raw);
  const missingKeys = stateKeys.filter(
    (key) => !Object.prototype.hasOwnProperty.call(normalized, key)
  );
  const serialized = JSON.stringify(normalized);
  const roundTrip = JSON.parse(serialized);
  return {
    valid: missingKeys.length === 0 && jsonEqual(normalized, roundTrip),
    missingKeys,
    bytes: Buffer.byteLength(serialized),
    preview: backupPreview(normalized),
  };
}

async function latestBackup() {
  if (!(await ensureBackupTable())) {
    return null;
  }
  const result = await db.query(`
    select backup_id, backup_date, backup_at as created_at, backup_at as updated_at, source, payload
    from cumbuca_app_backup_versions
    order by backup_at desc
    limit 1
  `);
  return result.rows[0] || null;
}

function missingReconciliationAdjustments(state = {}) {
  const cashEntries = Array.isArray(state.cashEntries) ? state.cashEntries : [];
  const history = Array.isArray(state.financialPlanning?.reconciliationHistory)
    ? state.financialPlanning.reconciliationHistory
    : [];
  return history.filter(
    (item) =>
      item?.status === 'adjusted' &&
      item.adjustmentId &&
      Math.abs(number(item.difference)) >= 0.01 &&
      !cashEntries.some((entry) => String(entry.id) === String(item.adjustmentId))
  );
}

function reconciliationAdjustmentEntry(item = {}) {
  const difference = number(item.difference);
  return {
    id: String(item.adjustmentId),
    description: `Ajuste de conferência - ${item.reason || 'Conta conferida'}`,
    date: String(item.date || '').slice(0, 10),
    type: difference > 0 ? 'income' : 'expense',
    category: 'ajuste-conta',
    amount: Math.abs(difference).toFixed(2),
    reconciliation: true,
    authorizedBy: item.authorizedBy || 'Sistema',
    authorizedUsername: item.username || '',
    calculatedBalance: String(item.calculatedBalance || '0.00'),
    realBalance: String(item.realBalance || '0.00'),
  };
}

async function repairFinancialIntegrity(user = null) {
  if (!userCan(user, 'editFinancial')) {
    return {
      repaired: false,
      statusCode: 403,
      error: 'Seu usuário não pode corrigir pendências financeiras.',
    };
  }
  const current = await readAppState();
  if (!current.database) {
    return { repaired: false, database: false };
  }

  const backup = await writeAutomaticBackup(current.state, {
    source: 'integrity-repair-preflight',
  });
  const missing = missingReconciliationAdjustments(current.state);
  const restoredEntries = missing
    .map(reconciliationAdjustmentEntry)
    .filter((entry) => entry.id && entry.date && number(entry.amount) > 0);

  if (!restoredEntries.length) {
    return {
      database: true,
      repaired: false,
      backup: Boolean(backup.saved || backup.database),
      restoredAdjustments: [],
    };
  }

  const nextCashEntries = [
    ...(Array.isArray(current.state.cashEntries) ? current.state.cashEntries : []),
    ...restoredEntries,
  ];
  await writeAppState(
    {
      cashEntries: nextCashEntries,
      auditLog: [
        {
          id: `audit-${Date.now()}`,
          action: 'Conciliação corrigida',
          detail: `${restoredEntries.length} ajuste(s) de conciliação recriado(s) pela conferência financeira.`,
          metadata: {
            adjustmentIds: restoredEntries.map((entry) => entry.id),
            backupId: backup.backupId || '',
          },
          user: user?.name || user?.username || 'Sistema',
          username: user?.username || '',
          createdAt: new Date().toISOString(),
        },
        ...(Array.isArray(current.state.auditLog) ? current.state.auditLog : []),
      ].slice(0, 500),
    },
    user,
    { bypassLocks: true }
  );
  await writeEvent(
    'integridade_financeira_corrigida',
    `${restoredEntries.length} ajuste(s) de conciliação recriado(s).`,
    user
  );
  return {
    database: true,
    repaired: true,
    backup: true,
    restoredAdjustments: restoredEntries.map((entry) => ({
      id: entry.id,
      date: entry.date,
      type: entry.type,
      amount: entry.amount,
    })),
  };
}

async function financialIntegrity(options = {}) {
  const repair = options.repair ? await repairFinancialIntegrity(options.user) : null;
  const current = await readAppState();
  if (!current.database) {
    return { database: false, status: 'danger', checks: [] };
  }
  const backup = await latestBackup();
  const result = financialIntegritySummary(current.state, backup);
  const restoreValidation = validateBackupPayload(backup);
  const eventsResult = await listEvents(100);
  const recentTechnicalErrors = (eventsResult.events || []).filter((event) => {
    const recent = Date.now() - new Date(event.created_at).getTime() <= 24 * 3600000;
    return recent && ['erro_api', 'teste_restauracao_falhou'].includes(event.event_type);
  });
  result.checks.push({
    id: 'backup-restorable',
    level: restoreValidation.valid ? 'ok' : 'danger',
    label: 'Teste de restauração',
    detail: restoreValidation.valid
      ? `Backup legivel e completo (${formatBytesPtBr(restoreValidation.bytes)}).`
      : restoreValidation.error || 'Backup inválido.',
  });
  result.checks.push({
    id: 'technical-errors',
    level: recentTechnicalErrors.length ? 'danger' : 'ok',
    label: 'Erros técnicos em 24h',
    detail: recentTechnicalErrors.length
      ? `${recentTechnicalErrors.length} erro(s) registrado(s). Consulte o log técnico.`
      : 'Nenhum erro técnico recente.',
  });
  if (!restoreValidation.valid) {
    result.status = 'danger';
  }
  if (recentTechnicalErrors.length) {
    result.status = 'danger';
  }
  const externalAlert = await maybeSendIntegrityAlert(result);
  return {
    database: true,
    ...result,
    repair,
    restoreValidation,
    recentTechnicalErrors: recentTechnicalErrors.slice(0, 10),
    externalAlert,
  };
}

async function backupRestoreCheck(user = null) {
  const backup = await latestBackup();
  const validation = validateBackupPayload(backup);
  if (validation.valid) {
    await writeEvent(
      'teste_restauracao',
      `Backup ${backup.backup_id} validado sem alterar os dados (${validation.bytes} bytes).`,
      user
    );
  } else {
    await writeEvent('teste_restauracao_falhou', validation.error || 'Backup inválido.', user);
  }
  return {
    database: Boolean(db),
    checkedAt: new Date().toISOString(),
    backupId: backup?.backup_id || '',
    backupDate: backup?.backup_date || null,
    ...validation,
  };
}

async function readAppState() {
  if (!(await ensureStateTable())) {
    return { database: false, state: normalizeState({}) };
  }

  const result = await db.query(
    'select key, value from cumbuca_app_state where key = any($1::text[])',
    [stateKeys]
  );
  return {
    database: true,
    state: normalizeState(Object.fromEntries(result.rows.map((row) => [row.key, row.value]))),
  };
}

async function writeAppState(payload = {}, user = null, options = {}) {
  if (!(await ensureStateTable())) {
    return { database: false };
  }

  const currentBeforeWrite = await readAppState();
  if (
    !options.bypassPermissions &&
    financialPayloadChanged(currentBeforeWrite.state, payload) &&
    !userCan(user, 'editFinancial')
  ) {
    const error = new Error('Seu usuário não tem permissão para editar valores financeiros.');
    error.statusCode = 403;
    throw error;
  }
  if (
    !options.bypassPermissions &&
    Object.prototype.hasOwnProperty.call(payload, 'partnerAccounts') &&
    partnerManualAdjustmentsChanged(
      currentBeforeWrite.state.partnerAccounts,
      payload.partnerAccounts
    ) &&
    !userCan(user, 'managePartnerAdjustments')
  ) {
    const error = new Error('Somente usuários autorizados podem registrar ajustes de sócias.');
    error.statusCode = 403;
    throw error;
  }
  if (
    !options.bypassPermissions &&
    bulkFinancialClearRequested(currentBeforeWrite.state, payload) &&
    !userCan(user, 'clearData')
  ) {
    const error = new Error(
      'Seu usuário não tem permissão para limpar valores financeiros em massa.'
    );
    error.statusCode = 403;
    throw error;
  }
  const violation = stateWriteViolation(currentBeforeWrite.state, payload, options);
  if (violation) {
    const error = new Error(violation.message);
    error.statusCode = violation.statusCode;
    throw error;
  }
  if (
    Object.prototype.hasOwnProperty.call(payload, 'partnerAccounts') ||
    Object.prototype.hasOwnProperty.call(payload, 'cashEntries')
  ) {
    const nextState = normalizeState({ ...currentBeforeWrite.state, ...payload });
    const validation = validatePartnerAccountState(
      nextState.partnerAccounts,
      nextState.cashEntries,
      options.bypassLocks ? null : currentBeforeWrite.state.partnerAccounts
    );
    if (!validation.valid) {
      const error = new Error(validation.errors[0] || 'Conta-corrente das sócias inconsistente.');
      error.statusCode = 409;
      throw error;
    }
  }
  if (
    Object.prototype.hasOwnProperty.call(payload, 'financialPlanning') ||
    Object.prototype.hasOwnProperty.call(payload, 'cashEntries')
  ) {
    const nextState = normalizeState({ ...currentBeforeWrite.state, ...payload });
    const validation = validateAccountTransferState(
      nextState.financialPlanning?.accountTransfers,
      nextState.cashEntries,
      nextState.financialPlanning?.savingsHistory
    );
    if (!validation.valid) {
      const error = new Error(
        validation.errors[0] || 'Transferências entre contas inconsistentes.'
      );
      error.statusCode = 409;
      throw error;
    }
  }
  const entries = Object.entries(payload).filter(([key]) => stateKeys.includes(key));

  for (const [key, value] of entries) {
    await db.query(
      `insert into cumbuca_app_state (key, value, updated_at)
       values ($1, $2::jsonb, now())
       on conflict (key)
       do update set value = excluded.value, updated_at = now()`,
      [key, JSON.stringify(value)]
    );
  }

  const current = await readAppState();
  const backup = await writeAutomaticBackup(current.state);
  return {
    database: true,
    saved: entries.map(([key]) => key),
    backup: Boolean(backup.saved || backup.database),
  };
}

async function saveClosing(payload = {}, user = null) {
  if (!(await ensureStateTable())) {
    return { database: false };
  }
  if (!userCan(user, 'manageClosings')) {
    return {
      database: true,
      saved: false,
      statusCode: 403,
      error: 'Seu usuário não pode fechar períodos.',
    };
  }
  const type = payload.type === 'week' ? 'week' : 'month';
  const stateKey = type === 'week' ? 'weeklyClosings' : 'monthlyClosings';
  const key = String(payload.key || '');
  const closing = payload.closing && typeof payload.closing === 'object' ? payload.closing : {};
  if (!key) {
    return { database: true, saved: false, error: 'Período inválido.' };
  }
  const current = await readAppState();
  const existing = current.state[stateKey]?.[key];
  if (existing && existing.locked !== false) {
    return {
      database: true,
      saved: false,
      error: 'O período já está fechado. Reabra antes de atualizar.',
    };
  }
  if (existing && !userCan(user, 'manageClosings')) {
    return {
      database: true,
      saved: false,
      statusCode: 403,
      error: 'Seu usuário não pode fechar novamente este período.',
    };
  }
  const savedClosing = {
    ...closing,
    locked: true,
    closedAt: new Date().toISOString(),
    closedBy: user?.name || user?.username || 'Sistema',
    closedByUsername: user?.username || '',
  };
  const nextClosings = {
    ...(current.state[stateKey] || {}),
    [key]: savedClosing,
  };
  const auditEntry = {
    id: `audit-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
    action: type === 'week' ? 'Semana fechada' : 'Mês fechado',
    detail: `Período ${key} fechado.`,
    user: user?.name || user?.username || 'Sistema',
    username: user?.username || '',
    route: 'financeiro',
    createdAt: new Date().toISOString(),
  };
  await writeAppState(
    {
      [stateKey]: nextClosings,
      auditLog: [auditEntry, ...(current.state.auditLog || [])].slice(0, 1000),
    },
    user,
    { allowClosings: true, bypassLocks: true }
  );
  await writeEvent(
    type === 'week' ? 'semana_fechada' : 'mes_fechado',
    `Período ${key} fechado.`,
    user
  );
  return { database: true, saved: true, key, closing: savedClosing };
}

async function reopenClosing(payload = {}, user = null) {
  if (!userCan(user, 'manageClosings')) {
    return {
      database: true,
      saved: false,
      statusCode: 403,
      error: 'Seu usuário não pode reabrir períodos.',
    };
  }
  const reason = String(payload.reason || '').trim();
  if (reason.length < 5) {
    return {
      database: true,
      saved: false,
      statusCode: 400,
      error: 'Informe o motivo da reabertura.',
    };
  }
  const type = payload.type === 'week' ? 'week' : 'month';
  const stateKey = type === 'week' ? 'weeklyClosings' : 'monthlyClosings';
  const key = String(payload.key || '');
  const current = await readAppState();
  const existing = current.state[stateKey]?.[key];
  if (!existing) {
    return { database: true, saved: false, statusCode: 404, error: 'Fechamento não encontrado.' };
  }
  const nextClosing = {
    ...existing,
    locked: false,
    reopenedAt: new Date().toISOString(),
    reopenedBy: user.name || user.username,
    reopenedByUsername: user.username,
    reopenReason: reason,
  };
  const auditEntry = {
    id: `audit-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
    action: type === 'week' ? 'Semana reaberta' : 'Mês reaberto',
    detail: `Período ${key}: ${reason}`,
    user: user.name || user.username,
    username: user.username,
    route: 'financeiro',
    createdAt: new Date().toISOString(),
  };
  await writeAppState(
    {
      [stateKey]: {
        ...(current.state[stateKey] || {}),
        [key]: nextClosing,
      },
      auditLog: [auditEntry, ...(current.state.auditLog || [])].slice(0, 1000),
    },
    user,
    { allowClosings: true, bypassLocks: true }
  );
  await writeEvent(
    type === 'week' ? 'semana_reaberta' : 'mes_reaberto',
    `Período ${key}: ${reason}`,
    user
  );
  return { database: true, saved: true, key, closing: nextClosing };
}

async function resetAppState(user = null) {
  if (!(await ensureStateTable())) {
    return { database: false };
  }

  const current = await readAppState();
  const backupSaved = await writeAutomaticBackup(current.state, { protect: true });
  if (!backupSaved.saved) {
    return {
      database: true,
      reset: false,
      backup: false,
      error: 'O backup de segurança falhou. Nenhum dado foi apagado.',
    };
  }
  await db.query('delete from cumbuca_app_state where key = any($1::text[])', [stateKeys]);
  await writeEvent('limpeza_completa', 'Estado do sistema apagado após backup automático.', user);
  return { database: true, reset: true, backup: true, state: normalizeState({}) };
}

async function resetFinancialState(user = null) {
  if (!(await ensureStateTable())) {
    return { database: false };
  }

  const current = await readAppState();
  const backupSaved = await writeAutomaticBackup(current.state, { protect: true });
  if (!backupSaved.saved) {
    return {
      database: true,
      reset: false,
      backup: false,
      error: 'O backup de segurança falhou. Nenhum dado foi apagado.',
    };
  }
  const nextState = normalizeState(current.state);
  nextState.financialPlanning = {
    ...(nextState.financialPlanning || {}),
    savings: '',
    savingsUpdatedAt: '',
    savingsHistory: [],
    accountTransfers: [],
    partnersHistory: [],
    cycleStartDate: '',
    openingBalance: '',
    openingSavings: '',
    cycleNote: '',
  };
  const client = await db.connect();
  try {
    await client.query('begin');
    for (const key of financialResetKeys) {
      nextState[key] = cloneJson(defaultState[key]);
      await client.query(
        `insert into cumbuca_app_state (key, value, updated_at)
         values ($1, $2::jsonb, now())
         on conflict (key)
         do update set value = excluded.value, updated_at = now()`,
        [key, JSON.stringify(nextState[key])]
      );
    }
    await client.query(
      `insert into cumbuca_app_state (key, value, updated_at)
       values ('financialPlanning', $1::jsonb, now())
       on conflict (key)
       do update set value = excluded.value, updated_at = now()`,
      [JSON.stringify(nextState.financialPlanning)]
    );
    await client.query('commit');
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
  await writeEvent(
    'reinicio_financeiro',
    'Movimentações financeiras apagadas; cadastros e configurações preservados.',
    user
  );
  return {
    database: true,
    reset: true,
    backup: true,
    resetKeys: [...financialResetKeys, 'financialPlanning'],
    state: nextState,
  };
}

function calculateCashFlow(entries = []) {
  const normalized = entries.map((item) => {
    const amount = Math.abs(number(item.amount));
    const type = item.type === 'expense' ? 'expense' : 'income';
    return {
      id: item.id || '',
      description: String(item.description || '').trim() || 'Lançamento',
      date: String(item.date || ''),
      type,
      amount,
      category: String(item.category || '').trim() || 'outros',
      cashAccount: String(item.cashAccount || ''),
      accountTransferSide: String(item.accountTransferSide || ''),
      transferId: String(item.transferId || item.accountTransferId || ''),
      accountTransferId: String(item.accountTransferId || item.transferId || ''),
      nonOperationalAccountTransfer: item.nonOperationalAccountTransfer === true,
      nonOperationalPartnerContribution: item.nonOperationalPartnerContribution === true,
    };
  });

  const operational = normalized.filter(
    (item) =>
      !accountTransferRules.isAccountTransferCashEntry(item) &&
      item.category !== 'aporte-socia' &&
      !item.nonOperationalPartnerContribution
  );
  const income = operational
    .filter((item) => item.type === 'income')
    .reduce((sum, item) => sum + item.amount, 0);
  const expenses = operational
    .filter((item) => item.type === 'expense')
    .reduce((sum, item) => sum + item.amount, 0);
  const cashIncome = normalized
    .filter((item) => item.type === 'income')
    .reduce((sum, item) => sum + item.amount, 0);
  const cashExpenses = normalized
    .filter((item) => item.type === 'expense')
    .reduce((sum, item) => sum + item.amount, 0);

  return {
    income,
    expenses,
    operationalIncome: income,
    operationalExpenses: expenses,
    cashIncome,
    cashExpenses,
    balance: cashIncome - cashExpenses,
    entries: normalized.sort((a, b) => a.date.localeCompare(b.date)),
  };
}

function calculatePricing(payload = {}) {
  if (payload.recipe || payload.sharedCosts || payload.catalog) {
    const recipe = payload.recipe || payload;
    const ingredients = Array.isArray(payload.catalog)
      ? payload.catalog
      : Array.isArray(payload.ingredients)
      ? payload.ingredients
      : [];
    const ingredientMap = new Map(
      ingredients.map((ingredient, index) => [
        String(ingredient.id || `ingredient-${index}`),
        ingredient,
      ])
    );
    const recipeIngredients = Array.isArray(recipe.ingredients) ? recipe.ingredients : [];
    const ingredientBatchSize = Math.max(1, number(recipe.ingredientBatchSize) || 1);
    const legacyIngredientCost = recipeIngredients.reduce((sum, item) => {
      const ingredient = ingredientMap.get(String(item.ingredientId));
      if (!ingredient) {
        return sum;
      }
      const purchaseQuantity = Math.max(
        0,
        number(ingredient.purchaseQuantity) || number(ingredient.quantity)
      );
      const purchaseCost = Math.max(
        0,
        number(ingredient.purchaseCost) || number(ingredient.quantity) * number(ingredient.unitCost)
      );
      const unitCost = purchaseQuantity > 0 ? purchaseCost / purchaseQuantity : 0;
      return sum + (Math.max(0, number(item.quantity)) / ingredientBatchSize) * unitCost;
    }, 0);
    const supermarketUnitCost = Object.prototype.hasOwnProperty.call(recipe, 'supermarketUnitCost')
      ? Math.max(0, number(recipe.supermarketUnitCost))
      : legacyIngredientCost;
    const shared = payload.sharedCosts || {};
    const averageMonthlyUnits = Math.max(0, number(shared.averageMonthlyUnits));
    const productionMonthly = Math.max(0, number(shared.gas)) + Math.max(0, number(shared.energy));
    const laborMonthly = Array.isArray(shared.staff)
      ? shared.staff.reduce((sum, member) => sum + Math.max(0, number(member?.salary)), 0)
      : Math.max(0, number(shared.labor));
    const otherMonthly =
      Math.max(0, number(shared.rent)) +
      Math.max(0, number(shared.accountant)) +
      Math.max(0, number(shared.telephony)) +
      Math.max(0, number(shared.marketing)) +
      Math.max(0, number(shared.extraordinary));
    const productionCost = averageMonthlyUnits ? productionMonthly / averageMonthlyUnits : 0;
    const laborCost = averageMonthlyUnits ? laborMonthly / averageMonthlyUnits : 0;
    const otherCost = averageMonthlyUnits ? otherMonthly / averageMonthlyUnits : 0;
    const packagingCost = Math.max(0, number(recipe.packagingCost));
    const fixedFee = Math.max(0, number(recipe.fixedFee));
    const variableFeePercent = Math.max(0, number(recipe.variableFeePercent));
    const desiredMarginPercent = Math.max(0, number(recipe.desiredMarginPercent));
    const practicedPrice = Math.max(0, number(recipe.practicedPrice));
    const baseCost =
      supermarketUnitCost + packagingCost + productionCost + laborCost + otherCost + fixedFee;
    const divisor = 1 - (variableFeePercent + desiredMarginPercent) / 100;
    const suggestedPrice = divisor > 0 ? baseCost / divisor : 0;
    const suggestedVariableFee = suggestedPrice * (variableFeePercent / 100);
    const totalCost = baseCost + suggestedVariableFee;
    const profit = suggestedPrice - totalCost;
    const realVariableFee = practicedPrice * (variableFeePercent / 100);
    const realTotalCost = baseCost + realVariableFee;
    const realProfit = practicedPrice - realTotalCost;
    const realMarginPercent = practicedPrice > 0 ? (realProfit / practicedPrice) * 100 : null;
    const markup =
      practicedPrice > 0 && realTotalCost > 0
        ? practicedPrice / realTotalCost
        : totalCost > 0
        ? suggestedPrice / totalCost
        : 0;
    const status =
      supermarketUnitCost <= 0
        ? 'Custo de supermercado pendente'
        : practicedPrice <= 0 || realMarginPercent === null
        ? 'Atenção'
        : realProfit < 0
        ? 'Prejuízo'
        : realMarginPercent + 0.0001 >= desiredMarginPercent
        ? 'Lucrativa'
        : 'Atenção';

    return {
      supermarketUnitCost,
      ingredientCost: supermarketUnitCost,
      packagingCost,
      productionCost,
      laborCost,
      otherCost,
      fixedFee,
      variableFeePercent,
      desiredMarginPercent,
      baseCost,
      totalCost,
      suggestedPrice,
      profit,
      practicedPrice,
      realTotalCost,
      realProfit,
      realMarginPercent,
      markup,
      status,
    };
  }

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
    profit: price - totalCost - price * (feePercent / 100),
  };
}

function brl(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(number(value));
}

function pdfText(value) {
  return String(value ?? '');
}

function addPdfTable(doc, headers, rows, widths) {
  const startX = doc.page.margins.left;
  let y = doc.y;
  const rowHeight = 20;

  function drawRow(values, isHeader = false) {
    const cells = Array.isArray(values) ? values : Object.values(values || {});
    let x = startX;
    doc.font(isHeader ? 'Helvetica-Bold' : 'Helvetica').fontSize(isHeader ? 8 : 8);
    cells.forEach((value, index) => {
      doc.rect(x, y, widths[index], rowHeight).stroke('#d1d5db');
      doc.text(pdfText(value), x + 4, y + 6, {
        width: widths[index] - 8,
        height: rowHeight - 8,
        ellipsis: true,
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
  rows.forEach((row) => drawRow(row));
  doc.x = startX;
  doc.y = y + 10;
}

function addPdfSectionTitle(doc, title) {
  doc.x = doc.page.margins.left;
  doc.fillColor('#573220').font('Helvetica-Bold').fontSize(13).text(title);
  doc.x = doc.page.margins.left;
}

function buildReportPdf(payload = {}) {
  const data = payload.data || {};
  const doc = new PDFDocument({ size: 'A4', margin: 42 });
  const chunks = [];

  doc.on('data', (chunk) => chunks.push(chunk));

  doc.rect(0, 0, 595.28, 841.89).fill('#fffdf8');
  doc.rect(0, 0, 595.28, 150).fill('#087f5b');
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(28).text('CUMBUCA', 42, 42);
  doc.font('Helvetica').fontSize(15).text('Relatório financeiro e operacional', 42, 82);
  doc
    .fillColor('#573220')
    .font('Helvetica-Bold')
    .fontSize(22)
    .text(payload.periodLabel || data.periodKey || '', 42, 205);
  doc
    .fillColor('#69707d')
    .font('Helvetica')
    .fontSize(11)
    .text(`Gerado em ${new Date().toLocaleString('pt-BR')}`, 42, 238);
  doc.roundedRect(42, 310, 510, 120, 8).stroke('#d1d5db');
  doc.fillColor('#573220').font('Helvetica-Bold').fontSize(12).text('Resumo da capa', 62, 330);
  doc
    .fillColor('#121417')
    .font('Helvetica')
    .fontSize(11)
    .text(`Lucro operacional: ${brl(data.profitBeforeWithdrawals)}`, 62, 358)
    .text(`Distribuição societária: ${brl(data.withdrawalGrossTotal)}`, 62, 382)
    .text(`Dinheiro que saiu da conta: ${brl(data.withdrawalTotal)}`, 62, 406)
    .text(`Compensação sem saída de caixa: ${brl(data.withdrawalDebtCompensation)}`, 62, 430);
  doc
    .fillColor('#69707d')
    .fontSize(9)
    .text('Conferir os lançamentos e assinar o fechamento ao final do relatório.', 42, 760, {
      width: 510,
      align: 'center',
    });
  doc.addPage();

  doc.rect(0, 0, 595.28, 86).fill('#573220');
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(21).text('RELATÓRIO FINANCEIRO', 42, 28);
  doc
    .font('Helvetica')
    .fontSize(10)
    .text(payload.periodLabel || data.periodKey || '', 42, 55);
  doc
    .font('Helvetica-Bold')
    .fontSize(9)
    .text(`Gerado em ${new Date().toLocaleDateString('pt-BR')}`, 410, 34, {
      width: 135,
      align: 'right',
    });

  const managementSummary =
    data.productionPurchases == null
      ? []
      : [
          ['Vendas registradas no Caixa', brl(data.salesRevenue)],
          ['Compras de insumos', brl(data.productionPurchases)],
          [
            'Compras / Vendas',
            `${Number(data.purchasesSalesPercent || 0).toLocaleString('pt-BR', {
              maximumFractionDigits: 1,
            })}%`,
          ],
          ['Compras por cumbuca', brl(data.purchasesPerBowl)],
        ];
  const summary = [
    ['Entradas operacionais', brl(data.totalIncome)],
    ['Saídas operacionais', brl(data.operationalExpenses)],
    ['Lucro operacional', brl(data.profitBeforeWithdrawals)],
    ...managementSummary,
    ['Vanessa - distribuição', brl(data.withdrawalVanessa)],
    ['Cofrinho transferido', brl(data.withdrawalSavings)],
    ['Raquel - distribuição', brl(data.withdrawalRaquel)],
    ['Saiu da conta', brl(data.withdrawalTotal)],
    ['Compensação sem caixa', brl(data.withdrawalDebtCompensation)],
    ['Resultado após retiradas', brl(data.availableForWithdrawal)],
    ['Saldo da conta', brl(data.accountBalance)],
    ['Ajustes da conta', brl(data.accountAdjustmentBalance)],
    ['Cofrinho atual', brl(data.savingsBalance)],
    ['Saldo consolidado', brl(data.consolidatedBalance)],
    ['Aportes de sócias', brl(data.capitalContributionTotal)],
    ['Cumbucas', data.totalSoldQuantity || 0],
    ['Semanal', data.weeklyCashQuantity || 0],
    ['Loja', data.storeQuantity || 0],
  ];

  const boxWidth = 168;
  summary.forEach(([label, value], index) => {
    const col = index % 3;
    const row = Math.floor(index / 3);
    const x = 42 + col * 172;
    const y = 105 + row * 58;
    doc
      .roundedRect(x, y, boxWidth, 48, 5)
      .fill(index === 0 ? '#087f5b' : '#f9fafb')
      .stroke('#e5e7eb');
    doc
      .fillColor(index === 0 ? '#ffffff' : '#69707d')
      .font('Helvetica-Bold')
      .fontSize(8)
      .text(label.toUpperCase(), x + 10, y + 9);
    doc
      .fillColor(index === 0 ? '#ffffff' : '#121417')
      .fontSize(14)
      .text(pdfText(value), x + 10, y + 24, { width: boxWidth - 20 });
  });

  doc.y = 105 + Math.ceil(summary.length / 3) * 58 + 20;
  addPdfSectionTitle(doc, 'Resumo de entradas');
  addPdfTable(
    doc,
    ['Grupo', 'Origem', 'Valor'],
    data.incomeSummaryRows || [
      ['Conta', 'Total da conta', brl(data.accountIncome ?? data.totalIncome ?? 0)],
      ['Semanal', 'Total semanal', brl(data.weeklyRevenue ?? 0)],
      [
        'Total',
        'Conta + semanal',
        brl(Number(data.accountIncome ?? data.totalIncome ?? 0) + Number(data.weeklyRevenue ?? 0)),
      ],
    ],
    [90, 260, 110]
  );

  addPdfSectionTitle(doc, 'Entradas por canal');
  addPdfTable(doc, ['Grupo', 'Canal', 'Valor'], data.incomeChannelRows || [], [110, 250, 110]);

  if ((data.negativeDifferenceRows || []).length) {
    addPdfSectionTitle(doc, 'Diferenças negativas');
    addPdfTable(
      doc,
      ['Indicador', 'Atual', 'Anterior', 'Diferença'],
      data.negativeDifferenceRows || [],
      [110, 110, 110, 110]
    );
  }

  if ((data.accountPackageSummaryRows || []).length) {
    addPdfSectionTitle(doc, 'Pacote contador por conta');
    addPdfTable(
      doc,
      ['Conta', 'Entradas oper.', 'Saídas oper.', 'Ajustes', 'Saldo real', 'Lançamentos'],
      data.accountPackageSummaryRows || [],
      [112, 72, 72, 72, 72, 76]
    );
  }

  if ((data.transferRows || []).length) {
    addPdfSectionTitle(doc, 'Transferências internas');
    addPdfTable(
      doc,
      ['Data', 'Origem', 'Destino', 'Valor', 'Tipo', 'Observação'],
      data.transferRows || [],
      [58, 78, 78, 70, 82, 120]
    );
  }

  if ((data.capitalContributionRows || []).length) {
    addPdfSectionTitle(doc, 'Aportes de sócias');
    addPdfTable(
      doc,
      ['Data', 'Descrição', 'Conta', 'Valor'],
      data.capitalContributionRows || [],
      [72, 220, 90, 90]
    );
  }

  if ((data.accountPackageReconciliationRows || []).length) {
    addPdfSectionTitle(doc, 'Conferências por conta');
    addPdfTable(
      doc,
      ['Data', 'Conta', 'Calculado', 'Real', 'Diferença'],
      (data.accountPackageReconciliationRows || []).map((row) => row.slice(0, 5)),
      [72, 118, 88, 88, 88]
    );
  }

  addPdfSectionTitle(doc, 'Saídas por categoria');
  addPdfTable(doc, ['Categoria', 'Total'], data.expenseCategoryRows || [], [300, 120]);

  addPdfSectionTitle(doc, 'Principais despesas');
  addPdfTable(doc, ['Descrição', 'Categoria', 'Valor'], data.expenseRows || [], [250, 140, 100]);

  addPdfSectionTitle(doc, 'Comparativo mensal');
  addPdfTable(
    doc,
    ['Indicador', 'Atual', 'Anterior', 'Diferença'],
    data.comparisonRows || [],
    [110, 110, 110, 110]
  );

  addPdfSectionTitle(doc, 'Retiradas e diferenças');
  addPdfTable(doc, ['Destino', 'Valor'], data.withdrawalRows || [], [250, 140]);

  addPdfSectionTitle(doc, 'Cumbucas vendidas na loja');
  addPdfTable(
    doc,
    ['Data', 'Produto', 'Tipo', 'Qtd.', 'Unid./combo', 'Total unid.', 'Observação'],
    data.storeRows || [],
    [54, 88, 48, 42, 58, 62, 160]
  );

  const footerY = 760;
  doc.moveTo(42, footerY).lineTo(245, footerY).stroke('#d1d5db');
  doc.moveTo(295, footerY).lineTo(510, footerY).stroke('#d1d5db');
  doc
    .fillColor('#69707d')
    .font('Helvetica')
    .fontSize(8)
    .text('Responsável pelo fechamento', 42, footerY + 8);
  doc.text('Conferência financeira', 295, footerY + 8);
  doc.text(
    'Observações: conferir contas, despesas maiores e cumbucas vendidas antes do fechamento.',
    300,
    footerY,
    {
      width: 240,
      align: 'right',
    }
  );

  doc.end();

  return new Promise((resolve) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

async function buildReportXlsx(payload = {}) {
  const data = payload.data || {};
  const zip = new JSZip();
  const managementSummaryRows =
    data.productionPurchases == null
      ? []
      : [
          ['Vendas registradas no Caixa', data.salesRevenue || 0],
          ['Compras de insumos', data.productionPurchases || 0],
          ['Boleto para produção', data.productionPurchasesBills || 0],
          ['Supermercado para produção', data.productionPurchasesSupermarket || 0],
          ['Frigorífico para produção', data.productionPurchasesButcher || 0],
          ['Compras / Vendas (%)', data.purchasesSalesPercent || 0],
          ['Compras por cumbuca', data.purchasesPerBowl || 0],
        ];
  const summaryRows = [
    ['Período', payload.periodLabel || data.periodKey || ''],
    ['Entradas operacionais', data.totalIncome || 0],
    ['Saídas operacionais', data.operationalExpenses || 0],
    ['Lucro operacional', data.profitBeforeWithdrawals || 0],
    ...managementSummaryRows,
    ['Vanessa - distribuição total', data.withdrawalVanessa || 0],
    ['Cofrinho transferido', data.withdrawalSavings || 0],
    ['Raquel - distribuição total', data.withdrawalRaquel || 0],
    ['Dinheiro que saiu da conta', data.withdrawalTotal || 0],
    ['Compensação sem saída de caixa', data.withdrawalDebtCompensation || 0],
    ['Resultado após retiradas', data.availableForWithdrawal || 0],
    ['Saldo da conta', data.accountBalance || 0],
    ['Ajustes da conta', data.accountAdjustmentBalance || 0],
    ['Cofrinho atual', data.savingsBalance || 0],
    ['Saldo consolidado PF + PJ + Cofrinho', data.consolidatedBalance || 0],
    ['Aportes de sócias (não operacional)', data.capitalContributionTotal || 0],
    ['Atualização cofrinho', data.savingsUpdatedAt || ''],
    ['Cumbucas semanal', data.weeklyCashQuantity || 0],
    ['Cumbucas loja', data.storeQuantity || 0],
    ['Cumbucas total', data.totalSoldQuantity || 0],
  ];

  const sheets = [
    ['Resumo', summaryRows],
    ['Entradas', [['Data', 'Descrição', 'Valor'], ...(data.incomeRows || [])]],
    ['Despesas', [['Data', 'Descrição', 'Categoria', 'Valor'], ...(data.expenseRows || [])]],
    [
      'Canais',
      [
        [
          'Data',
          'Débito',
          'Crédito',
          'Cartão de crédito online',
          'Pix',
          'Dinheiro',
          'Taxas de entrega (conferência)',
          'iFood',
          '99 Food',
          'Total',
        ],
        ...(data.channelRows || []),
      ],
    ],
    [
      'Comparativo',
      [['Indicador', 'Atual', 'Anterior', 'Diferença'], ...(data.comparisonRows || [])],
    ],
    [
      'Clientes',
      [
        ['Cliente', 'Telefone', 'Perfil', 'Pedidos', 'Cumbucas', 'Total', 'Pendências'],
        ...(data.clientRows || []),
      ],
    ],
    ['Retiradas', [['Destino', 'Valor'], ...(data.withdrawalRows || [])]],
    [
      'Transferencias',
      [['Data', 'Origem', 'Destino', 'Valor', 'Tipo', 'Observação'], ...(data.transferRows || [])],
    ],
    [
      'Aportes socias',
      [['Data', 'Descrição', 'Conta', 'Valor'], ...(data.capitalContributionRows || [])],
    ],
    [
      'Loja',
      [
        [
          'Data',
          'Produto',
          'Tipo',
          'Quantidade',
          'Unidades por combo',
          'Total de unidades',
          'Observação',
        ],
        ...(data.storeRows || []),
      ],
    ],
    [
      'Contas resumo',
      [
        [
          'Conta',
          'Entradas operacionais',
          'Saídas operacionais',
          'Ajustes',
          'Saldo real',
          'Lançamentos',
        ],
        ...(data.accountPackageSummaryRows || []),
      ],
    ],
    [
      'Conferencias conta',
      [
        ['Data', 'Conta', 'Saldo calculado', 'Saldo real', 'Diferença', 'Responsável', 'Motivo'],
        ...(data.accountPackageReconciliationRows || []),
      ],
    ],
    [
      'Conta unificada',
      [
        ['Data', 'Descrição', 'Tipo', 'Conta', 'Categoria', 'Valor'],
        ...(data.accountPackageUnifiedRows || []),
      ],
    ],
    [
      'Conta PF',
      [
        ['Data', 'Descrição', 'Tipo', 'Conta', 'Categoria', 'Valor'],
        ...(data.accountPackagePfRows || []),
      ],
    ],
    [
      'Conta PJ',
      [
        ['Data', 'Descrição', 'Tipo', 'Conta', 'Categoria', 'Valor'],
        ...(data.accountPackagePjRows || []),
      ],
    ],
    [
      'Sem conta',
      [
        ['Data', 'Descrição', 'Tipo', 'Conta', 'Categoria', 'Valor'],
        ...(data.accountPackageUnassignedRows || []),
      ],
    ],
    [
      'Caixa',
      [['Data', 'Descrição', 'Tipo', 'Conta', 'Categoria', 'Valor'], ...(data.cashRows || [])],
    ],
  ];

  function xml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function columnName(index) {
    let name = '';
    let current = index + 1;
    while (current > 0) {
      const remainder = (current - 1) % 26;
      name = String.fromCharCode(65 + remainder) + name;
      current = Math.floor((current - 1) / 26);
    }
    return name;
  }

  function sheetXml(rows) {
    const body = rows
      .map((row, rowIndex) => {
        const cells = row
          .map((value, columnIndex) => {
            const ref = `${columnName(columnIndex)}${rowIndex + 1}`;
            if (typeof value === 'number' && Number.isFinite(value)) {
              return `<c r="${ref}"><v>${value}</v></c>`;
            }
            return `<c r="${ref}" t="inlineStr"><is><t>${xml(value)}</t></is></c>`;
          })
          .join('');
        return `<row r="${rowIndex + 1}">${cells}</row>`;
      })
      .join('');
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${body}</sheetData></worksheet>`;
  }

  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  ${sheets
    .map(
      (_, index) =>
        `<Override PartName="/xl/worksheets/sheet${
          index + 1
        }.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
    )
    .join('')}
</Types>`
  );
  zip.folder('_rels').file(
    '.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`
  );
  zip.folder('xl').file(
    'workbook.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>${sheets
    .map(
      ([name], index) =>
        `<sheet name="${xml(name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`
    )
    .join('')}</sheets>
</workbook>`
  );
  zip
    .folder('xl')
    .folder('_rels')
    .file(
      'workbook.xml.rels',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${sheets
    .map(
      (_, index) =>
        `<Relationship Id="rId${
          index + 1
        }" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${
          index + 1
        }.xml"/>`
    )
    .join('')}
</Relationships>`
    );
  const worksheetFolder = zip.folder('xl').folder('worksheets');
  sheets.forEach(([, rows], index) => {
    worksheetFolder.file(`sheet${index + 1}.xml`, sheetXml(rows));
  });

  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

function weeklyMenu(payload = {}) {
  const meals = Array.isArray(payload.meals) ? payload.meals : [];
  const allowedStatuses = ['planejado', 'compras', 'preparo', 'pronto'];
  const plan = Array.from({ length: 5 }, (_, index) => {
    const found = meals[index] || {};
    const status = allowedStatuses.includes(found.status) ? found.status : 'planejado';
    const ingredients = Array.isArray(found.ingredients)
      ? found.ingredients
          .map((item) => ({
            name: String(item.name || '').trim(),
            value: number(item.value),
          }))
          .filter((item) => item.name || item.value > 0)
      : [];
    const legacyIngredientCost = ingredients.reduce((sum, item) => sum + item.value, 0);
    const ingredientCost = Object.prototype.hasOwnProperty.call(found, 'ingredientCost')
      ? Math.max(0, number(found.ingredientCost))
      : legacyIngredientCost;
    return {
      slot: index + 1,
      recipeId: String(found.recipeId || '').trim(),
      dish: String(found.dish || '').trim(),
      dishCost: Math.max(0, number(found.dishCost)),
      ingredients,
      ingredientCost,
      cost: ingredientCost || number(found.cost),
      status,
      notes: String(found.notes || '').trim(),
    };
  });

  return {
    totalCost: plan.reduce((sum, item) => sum + item.cost, 0),
    readyCount: plan.filter((item) => item.status === 'pronto').length,
    plan,
  };
}

function serveStatic(req, res, pathname) {
  const requestPath = pathname === '/' ? '/index.html' : pathname;
  const filePath = path.normalize(path.join(PUBLIC_DIR, requestPath));

  if (!filePath.startsWith(PUBLIC_DIR)) {
    sendJson(res, 403, { error: 'Acesso negado.' });
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      fs.readFile(path.join(PUBLIC_DIR, 'index.html'), (fallbackError, fallbackData) => {
        if (fallbackError) {
          sendJson(res, 404, { error: 'Arquivo não encontrado.' });
          return;
        }
        res.writeHead(
          200,
          mergeHeaders({
            'Content-Type': mimeTypes['.html'],
            'Cache-Control': 'no-cache',
          })
        );
        res.end(fallbackData);
      });
      return;
    }

    const extension = path.extname(filePath);
    const headers = {
      'Content-Type': mimeTypes[extension] || 'application/octet-stream',
    };
    const requestUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const versionedAsset = requestUrl.searchParams.has('v') && ['.js', '.css'].includes(extension);
    if (versionedAsset) {
      headers['Cache-Control'] = 'public, max-age=31536000, immutable';
    } else if (['.html', '.js', '.css'].includes(extension)) {
      headers['Cache-Control'] = 'no-cache';
    }
    res.writeHead(200, mergeHeaders(headers));
    res.end(data);
  });
}

async function handleRequest(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  // Enforce HTTPS when behind a proxy in production
  const forwardedProto = String(req.headers['x-forwarded-proto'] || '').toLowerCase();
  if (
    (process.env.NODE_ENV === 'production' || process.env.FORCE_HTTPS === 'true') &&
    forwardedProto === 'http'
  ) {
    const host = req.headers.host || '';
    redirect(res, `https://${host}${url.pathname}${url.search}`);
    return;
  }
  let user = null;
  let authenticated = false;

  try {
    if (req.method === 'GET' && url.pathname === '/api/health') {
      let database = false;
      try {
        database = await ensureStateTable();
      } catch (error) {
        database = false;
      }
      sendJson(res, 200, {
        status: 'online',
        database,
      });
      return;
    }

    if (url.pathname === '/api/maintenance/reset-state') {
      if (!RESET_TOKEN) {
        sendJson(res, 404, { error: 'Endpoint indisponivel.' });
        return;
      }
      if (req.method !== 'POST') {
        sendJson(res, 405, { error: 'MÃ©todo nÃ£o permitido.' });
        return;
      }
      if (!maintenanceResetTokenAuthorized(req)) {
        sendJson(res, 403, { error: 'Token de manutenÃ§Ã£o invÃ¡lido.' });
        return;
      }
      const payload = await collectBody(req);
      if (payload.confirm !== 'LIMPAR TODO O BANCO') {
        sendJson(res, 400, { error: 'Confirme com LIMPAR TODO O BANCO para apagar os dados.' });
        return;
      }
      sendJson(
        res,
        200,
        await resetAppState({
          username: 'maintenance-token',
          name: 'Maintenance Token',
          role: 'admin',
          permissions: normalizedPermissions({ clearData: true }, 'admin'),
        })
      );
      return;
    }

    user = await currentUser(req);
    authenticated = Boolean(user);

    if (req.method === 'GET' && url.pathname === '/api/session') {
      sendJson(res, 200, { authenticated, user });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/login') {
      const payload = await collectBody(req);
      const username = String(payload.username || '')
        .trim()
        .toLowerCase();
      if (loginBlocked(req, username)) {
        sendJson(res, 429, {
          error: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
        });
        return;
      }
      const authUser = await findAuthUser(username, String(payload.password || ''));
      if (authUser) {
        clearLoginFailures(req, username);
        await writeEvent('login', `Usuário ${authUser.username} entrou no sistema.`, authUser);
        sendJson(
          res,
          200,
          {
            ok: true,
            user: {
              username: authUser.username,
              name: authUser.name,
              role: authUser.role,
              permissions: normalizedPermissions(authUser.permissions, authUser.role),
            },
          },
          {
            'Set-Cookie': sessionCookie(
              `${authUser.username}.${userSessionToken(authUser)}`,
              60 * 60 * 24 * 30
            ),
          }
        );
        return;
      }
      registerLoginFailure(req, username);
      await writeEvent('login_falhou', `Tentativa invalida para ${username || 'usuario vazio'}.`, {
        username: username || '',
      });
      sendJson(res, 401, { error: 'Login ou senha inválidos.' });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/logout') {
      if (user) {
        await writeEvent('logout', `Usuário ${user.username} saiu do sistema.`, user);
      }
      sendJson(
        res,
        200,
        { ok: true },
        {
          'Set-Cookie': sessionCookie('', 0),
        }
      );
      return;
    }

    if (req.method === 'GET' && url.pathname === '/login') {
      if (authenticated) {
        redirect(res, '/');
        return;
      }
      serveStatic(req, res, '/login.html');
      return;
    }

    const publicFiles = [
      '/styles.css',
      '/login.js',
      '/logo-cumbuca-original.png',
      '/manifest.json',
      '/sw.js',
    ];
    if (!authenticated) {
      if (req.method === 'GET' && publicFiles.includes(url.pathname)) {
        serveStatic(req, res, url.pathname);
        return;
      }

      if (url.pathname.startsWith('/api/')) {
        sendJson(res, 401, { error: 'Faça login para continuar.' });
        return;
      }

      if (req.method === 'GET') {
        redirect(res, '/login');
        return;
      }
    }

    if (req.method === 'GET' && url.pathname === '/api/tools') {
      sendJson(res, 200, { tools });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/state') {
      sendJson(res, 200, await readAppState());
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/state') {
      const payload = await collectBody(req);
      sendJson(res, 200, await writeAppState(payload.state || payload, user));
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/closings') {
      const payload = await collectBody(req);
      const result = await saveClosing(payload, user);
      sendJson(res, result.saved ? 200 : result.statusCode || 409, result);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/closings/reopen') {
      const payload = await collectBody(req);
      const result = await reopenClosing(payload, user);
      sendJson(res, result.saved ? 200 : result.statusCode || 400, result);
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/financial-integrity') {
      sendJson(
        res,
        200,
        await financialIntegrity({
          repair: url.searchParams.get('repair') === '1',
          user,
        })
      );
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/integrations') {
      sendJson(res, 200, integrationStatus());
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/integrations/test-alert') {
      if (user?.role !== 'admin') {
        sendJson(res, 403, { error: 'Acesso restrito ao administrador.' });
        return;
      }
      const result = await sendExternalAlert(
        {
          title: 'Teste Cumbuca',
          message: 'Alerta externo configurado e funcionando.',
          severity: 'test',
        },
        user
      );
      sendJson(res, result.sent ? 200 : 400, result);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/integrations/test-backup') {
      if (!userCan(user, 'restoreBackup')) {
        sendJson(res, 403, { error: 'Seu usuário não pode testar backups externos.' });
        return;
      }
      const current = await readAppState();
      const result = await sendExternalBackup(
        {
          app: 'Cumbuca',
          version: '1.0.0',
          exportedAt: new Date().toISOString(),
          source: 'integration-test',
          data: current.state,
        },
        `test-${Date.now()}`,
        user
      );
      sendJson(res, result.sent ? 200 : 400, result);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/backup-restore-check') {
      if (!userCan(user, 'restoreBackup')) {
        sendJson(res, 403, { error: 'Seu usuário não pode testar restaurações.' });
        return;
      }
      sendJson(res, 200, await backupRestoreCheck(user));
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/reset-state') {
      if (!userCan(user, 'clearData')) {
        sendJson(res, 403, { error: 'Seu usuário não pode limpar dados.' });
        return;
      }
      const payload = await collectBody(req);
      if (payload.confirm !== 'LIMPAR TODO O BANCO') {
        sendJson(res, 400, { error: 'Confirme com LIMPAR TODO O BANCO para apagar os dados.' });
        return;
      }
      sendJson(res, 200, await resetAppState(user));
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/backups') {
      sendJson(res, 200, await listBackups());
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/reset-financial-state') {
      if (!userCan(user, 'clearData')) {
        sendJson(res, 403, { error: 'Seu usuário não pode reiniciar o financeiro.' });
        return;
      }
      const payload = await collectBody(req);
      if (payload.confirm !== 'REINICIAR FINANCEIRO') {
        sendJson(res, 400, {
          error: 'Confirme com REINICIAR FINANCEIRO para apagar as movimentações.',
        });
        return;
      }
      sendJson(res, 200, await resetFinancialState(user));
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/manual-backup') {
      const payload = await collectBody(req);
      const statePayload = normalizeState(payload.state || payload);
      const result = await writeAutomaticBackup(statePayload, { source: 'manual' });
      if (result.database && result.saved) {
        await writeEvent('backup_manual_supabase', 'Backup manual salvo no Supabase.', user);
      }
      sendJson(res, 200, {
        ...result,
        preview: backupPreview(statePayload),
      });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/database-usage') {
      sendJson(res, 200, await databaseUsage());
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/backups/delete-old') {
      if (!userCan(user, 'clearData')) {
        sendJson(res, 403, { error: 'Seu usuário não pode apagar backups.' });
        return;
      }
      const payload = await collectBody(req);
      const result = await deleteOldBackups(payload.keepDays);
      if (result.database) {
        await writeEvent(
          'backups_antigos_apagados',
          `${result.deleted || 0} backup(s) apagado(s).`,
          user
        );
      }
      sendJson(res, 200, result);
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/backup') {
      const backupReference = url.searchParams.get('id') || url.searchParams.get('date');
      if (!backupReference) {
        sendJson(res, 400, { error: 'Informe a data do backup.' });
        return;
      }
      const result = await readBackup(backupReference);
      if (!result.backup) {
        sendJson(res, 404, { error: 'Backup não encontrado.' });
        return;
      }
      const body = JSON.stringify(result.backup.payload, null, 2);
      const filenameReference = String(
        result.backup.backup_id || result.backup.backup_date || 'backup'
      ).replace(/[^a-zA-Z0-9-]+/g, '-');
      res.writeHead(
        200,
        mergeHeaders({
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Disposition': `attachment; filename="cumbuca-backup-${filenameReference}.json"`,
          'Content-Length': Buffer.byteLength(body),
        })
      );
      res.end(body);
      return;
    }

    if (req.method === 'DELETE' && url.pathname === '/api/backup') {
      if (!userCan(user, 'clearData')) {
        sendJson(res, 403, { error: 'Seu usuário não pode excluir backups.' });
        return;
      }
      const backupReference = url.searchParams.get('id') || url.searchParams.get('date');
      if (!backupReference) {
        sendJson(res, 400, { error: 'Informe a data do backup.' });
        return;
      }
      const result = await deleteBackup(backupReference);
      if (result.database && result.deleted) {
        await writeEvent('backup_apagado', `Backup ${backupReference} apagado.`, user);
      }
      sendJson(
        res,
        result.deleted ? 200 : 404,
        result.deleted ? result : { ...result, error: 'Backup não encontrado.' }
      );
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/backup-preview') {
      const backupReference = url.searchParams.get('id') || url.searchParams.get('date');
      if (!backupReference) {
        sendJson(res, 400, { error: 'Informe a data do backup.' });
        return;
      }
      const result = await readBackup(backupReference);
      if (!result.backup) {
        sendJson(res, 404, { error: 'Backup não encontrado.' });
        return;
      }
      sendJson(res, 200, {
        database: result.database,
        backupId: result.backup.backup_id || backupReference,
        backupDate: result.backup.backup_date,
        createdAt: result.backup.created_at,
        updatedAt: result.backup.updated_at,
        preview: backupPreview(result.backup.payload),
      });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/restore-backup') {
      if (!userCan(user, 'restoreBackup')) {
        sendJson(res, 403, { error: 'Seu usuário não pode restaurar backups.' });
        return;
      }
      const payload = await collectBody(req);
      const backupReference = payload.id || payload.date;
      const result = await restoreBackup(backupReference);
      if (result.database && result.restored) {
        await writeEvent('backup_restaurado', `Backup ${backupReference} restaurado.`, user);
      }
      sendJson(res, 200, result);
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/events') {
      if (user?.role !== 'admin') {
        sendJson(res, 403, { error: 'Acesso restrito ao administrador.' });
        return;
      }
      sendJson(res, 200, await listEvents(url.searchParams.get('limit')));
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/users') {
      if (user?.role !== 'admin') {
        sendJson(res, 403, { error: 'Acesso restrito ao administrador.' });
        return;
      }
      sendJson(res, 200, await listUsers());
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/users') {
      if (user?.role !== 'admin') {
        sendJson(res, 403, { error: 'Acesso restrito ao administrador.' });
        return;
      }
      const payload = await collectBody(req);
      sendJson(res, 200, await upsertUser(payload, user));
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/users/active') {
      if (user?.role !== 'admin') {
        sendJson(res, 403, { error: 'Acesso restrito ao administrador.' });
        return;
      }
      const payload = await collectBody(req);
      sendJson(res, 200, await setUserActive(payload.username, payload.active, user));
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/change-password') {
      const payload = await collectBody(req);
      const result = await changeOwnPassword(user, payload);
      const headers =
        result.saved && result.session
          ? { 'Set-Cookie': sessionCookie(result.session, 60 * 60 * 24 * 30) }
          : {};
      sendJson(res, result.saved ? 200 : 400, result, headers);
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/persistence-check') {
      sendJson(res, 200, await verifyPersistence());
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/report-pdf') {
      const payload = await collectBody(req);
      const pdf = await buildReportPdf(payload);
      res.writeHead(
        200,
        mergeHeaders({
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${
            payload.filename || 'cumbuca-relatorio.pdf'
          }"`,
          'Content-Length': pdf.length,
        })
      );
      res.end(pdf);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/report-xlsx') {
      const payload = await collectBody(req);
      const xlsx = await buildReportXlsx(payload);
      res.writeHead(
        200,
        mergeHeaders({
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${
            payload.filename || 'cumbuca-relatorio.xlsx'
          }"`,
          'Content-Length': xlsx.length,
        })
      );
      res.end(xlsx);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/fluxo-de-caixa') {
      const payload = await collectBody(req);
      sendJson(res, 200, calculateCashFlow(payload.entries));
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/menu-semanal') {
      const payload = await collectBody(req);
      sendJson(res, 200, weeklyMenu(payload));
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/precificacao') {
      const payload = await collectBody(req);
      sendJson(res, 200, calculatePricing(payload));
      return;
    }

    if (req.method === 'GET') {
      serveStatic(req, res, url.pathname);
      return;
    }

    sendJson(res, 405, { error: 'Método não permitido.' });
  } catch (error) {
    console.error(`[${new Date().toISOString()}] ${req.method} ${req.url}`, error);
    try {
      await writeEvent(
        'erro_api',
        `${req.method} ${String(req.url || '').slice(0, 160)}: ${String(
          error.message || error
        ).slice(0, 300)}`
      );
    } catch (eventError) {
      console.error('Falha ao registrar erro da API.', eventError);
    }
    sendJson(res, error.statusCode || 400, { error: error.message || 'Requisição inválida.' });
  }
}

const server = http.createServer(handleRequest);

if (!process.env.VERCEL) {
  server.listen(PORT, () => {
    console.log(`Cumbuca Tools rodando em http://localhost:${PORT}`);
  });
}

handleRequest._test = {
  backupVersionId,
  bulkFinancialClearRequested,
  calculateCashFlow,
  calculatePricing,
  changedRecordDates,
  financialPayloadChanged,
  financialIntegritySummary,
  integrationStatus,
  lockedClosingForDate,
  legacyBackupDate,
  normalizeState,
  normalizedPermissions,
  accountTransferRules,
  partnerAccountDatedRecords,
  partnerAccountRules,
  partnerManualAdjustmentsChanged,
  stateWriteViolation,
  userCan,
  validateBackupPayload,
  weekRangeFromDate,
};

module.exports = handleRequest;
