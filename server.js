const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const PDFDocument = require("pdfkit");
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
const stateKeys = [
  "cashEntries",
  "weeklyMenusByPeriod",
  "menuWeek",
  "menuPeriod",
  "menuDatesByPeriod",
  "clients",
  "orders",
  "storeSales",
  "auditLog",
  "pricingIngredients",
  "pricingConfig",
  "cashFilter"
];
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

function sessionToken() {
  return crypto
    .createHmac("sha256", AUTH_SECRET)
    .update(`${AUTH_USER}:${AUTH_PASSWORD}`)
    .digest("hex");
}

function isAuthenticated(req) {
  return parseCookies(req)[SESSION_COOKIE] === sessionToken();
}

function sessionCookie(value, maxAge) {
  const secure = process.env.VERCEL ? "; Secure" : "";
  return `${SESSION_COOKIE}=${encodeURIComponent(value)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${secure}`;
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
      data: payload
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

async function verifyPersistence() {
  if (!await ensureStateTable() || !await ensureBackupTable()) {
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
  if (saved) {
    const currentState = await readAppState();
    await writeAutomaticBackup(currentState.state || {});
  }
  const backups = await db.query(`
    select backup_date, updated_at, backup_date >= current_date - interval '7 days' as weekly_ok
    from cumbuca_app_backups
    order by backup_date desc
    limit 1
  `);

  return {
    database: true,
    saved,
    checkedAt: marker.checkedAt,
    stateUpdatedAt: readBack.rows[0]?.updated_at || null,
    lastBackup: backups.rows[0] || null,
    backupWeeklyOk: Boolean(backups.rows[0]?.weekly_ok)
  };
}

async function readAppState() {
  if (!await ensureStateTable()) {
    return { database: false, state: {} };
  }

  const result = await db.query("select key, value from cumbuca_app_state");
  return {
    database: true,
    state: Object.fromEntries(result.rows.map(row => [row.key, row.value]))
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

function calculateCashFlow(entries = []) {
  const normalized = entries.map(item => {
    const amount = Math.abs(number(item.amount));
    const type = item.type === "expense" ? "expense" : "income";
    return {
      description: String(item.description || "").trim() || "Lançamento",
      date: String(item.date || ""),
      type,
      amount
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
  const startX = doc.x;
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
  doc.y = y + 10;
}

function buildReportPdf(payload = {}) {
  const data = payload.data || {};
  const doc = new PDFDocument({ size: "A4", margin: 42 });
  const chunks = [];

  doc.on("data", chunk => chunks.push(chunk));

  doc.font("Helvetica-Bold").fontSize(20).fillColor("#573220").text("RELATÓRIO FINANCEIRO SEMANAL");
  doc.font("Helvetica").fontSize(10).fillColor("#69707d").text(payload.periodLabel || data.periodKey || "");
  doc.moveDown(1);

  const summary = [
    ["Total", brl(data.balance)],
    ["Entradas", brl(data.totalIncome)],
    ["Saídas", brl(data.expenses)],
    ["Cumbucas", data.totalSoldQuantity || 0],
    ["Semanal", data.weeklyCashQuantity || 0],
    ["Loja", data.storeQuantity || 0]
  ];

  const boxWidth = 168;
  summary.forEach(([label, value], index) => {
    const col = index % 3;
    const row = Math.floor(index / 3);
    const x = 42 + col * 172;
    const y = 95 + row * 58;
    doc.rect(x, y, boxWidth, 48).fill(index === 0 ? "#573220" : "#f9fafb").stroke("#e5e7eb");
    doc.fillColor(index === 0 ? "#ffffff" : "#69707d").font("Helvetica-Bold").fontSize(8).text(label.toUpperCase(), x + 10, y + 9);
    doc.fillColor(index === 0 ? "#ffffff" : "#121417").fontSize(14).text(pdfText(value), x + 10, y + 24, { width: boxWidth - 20 });
  });

  doc.y = 225;
  doc.fillColor("#573220").font("Helvetica-Bold").fontSize(13).text("Entradas");
  addPdfTable(doc, ["Data", "Descrição", "Valor"], data.incomeRows || [], [82, 320, 110]);

  doc.fillColor("#573220").font("Helvetica-Bold").fontSize(13).text("Principais saídas (despesas)");
  addPdfTable(doc, ["Data", "Descrição", "Valor"], data.expenseRows || [], [82, 320, 110]);

  doc.fillColor("#573220").font("Helvetica-Bold").fontSize(13).text("Cumbucas vendidas na loja");
  addPdfTable(doc, ["Data", "Quantidade", "Observação"], data.storeRows || [], [82, 90, 340]);

  doc.fillColor("#573220").font("Helvetica-Bold").fontSize(13).text("Lançamentos");
  addPdfTable(doc, ["Data", "Descrição", "Tipo", "Valor"], data.cashRows || [], [82, 250, 80, 100]);

  doc.end();

  return new Promise(resolve => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });
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
  const authenticated = isAuthenticated(req);

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

    if (req.method === "GET" && url.pathname === "/api/session") {
      sendJson(res, 200, { authenticated });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/login") {
      const payload = await collectBody(req);
      if (payload.username === AUTH_USER && payload.password === AUTH_PASSWORD) {
        sendJson(res, 200, { ok: true }, {
          "Set-Cookie": sessionCookie(sessionToken(), 60 * 60 * 24 * 30)
        });
        return;
      }

      sendJson(res, 401, { error: "Login ou senha inválidos." });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/logout") {
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

    const publicFiles = ["/styles.css", "/login.js", "/logo-cumbuca.svg"];
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

    if (req.method === "GET" && url.pathname === "/api/backups") {
      sendJson(res, 200, await listBackups());
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
