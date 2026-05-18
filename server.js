const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
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

  return { database: true, saved: entries.map(([key]) => key) };
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
