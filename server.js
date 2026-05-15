const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, "public");
const DATABASE_URL = process.env.DATABASE_URL;
const AUTH_LOGIN = process.env.AUTH_LOGIN || "cumbuca2026";
const AUTH_PASSWORD = process.env.AUTH_PASSWORD || "cumbuca25";
const AUTH_SECRET = process.env.AUTH_SECRET || `${AUTH_LOGIN}:${AUTH_PASSWORD}:cumbuca-local-secret`;
let pool = null;

if (DATABASE_URL) {
  const { Pool } = require("pg");
  pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: process.env.PGSSLMODE === "disable" ? false : { rejectUnauthorized: false }
  });
}

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

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body)
  });
  res.end(body);
}

function signToken(payload) {
  return crypto
    .createHmac("sha256", AUTH_SECRET)
    .update(payload)
    .digest("hex");
}

function createAuthToken() {
  const payload = JSON.stringify({
    login: AUTH_LOGIN,
    expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 30
  });
  const encodedPayload = Buffer.from(payload).toString("base64url");
  return `${encodedPayload}.${signToken(encodedPayload)}`;
}

function isAuthorized(req) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature || signature !== signToken(encodedPayload)) {
    return false;
  }

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
    return payload.login === AUTH_LOGIN && Number(payload.expiresAt || 0) > Date.now();
  } catch (error) {
    return false;
  }
}

function requireAuth(req, res) {
  if (isAuthorized(req)) {
    return true;
  }

  sendJson(res, 401, { error: "Acesso nao autorizado." });
  return false;
}

async function ensureDatabase() {
  if (!pool) {
    return false;
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_state (
      id text PRIMARY KEY,
      payload jsonb NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  return true;
}

async function readAppState() {
  const ready = await ensureDatabase();
  if (!ready) {
    return null;
  }

  const result = await pool.query("SELECT payload, updated_at FROM app_state WHERE id = $1", ["default"]);
  if (!result.rows.length) {
    return null;
  }

  return {
    ...result.rows[0].payload,
    cloudUpdatedAt: result.rows[0].updated_at
  };
}

async function saveAppState(payload) {
  const ready = await ensureDatabase();
  if (!ready) {
    return null;
  }

  await pool.query(
    `
      INSERT INTO app_state (id, payload, updated_at)
      VALUES ($1, $2, now())
      ON CONFLICT (id)
      DO UPDATE SET payload = EXCLUDED.payload, updated_at = now()
    `,
    ["default", payload]
  );

  return readAppState();
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

function calculateCashFlow(entries = []) {
  const normalized = entries.map(item => {
    const amount = Math.abs(number(item.amount));
    const type = item.type === "expense" ? "expense" : "income";
    return {
      id: item.id || "",
      description: String(item.description || "").trim() || "Lancamento",
      date: String(item.date || ""),
      type,
      amount,
      dueDate: String(item.dueDate || ""),
      paid: Boolean(item.paid)
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
  const plan = Array.from({ length: 5 }, (_, index) => {
    const found = meals[index] || {};
    return {
      slot: index + 1,
      dish: String(found.dish || "").trim(),
      cost: number(found.cost),
      status: found.status === "pronto" ? "pronto" : "planejado",
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
          sendJson(res, 404, { error: "Arquivo nao encontrado." });
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

async function requestHandler(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);

  try {
    if (req.method === "GET" && url.pathname === "/api/tools") {
      sendJson(res, 200, { tools });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/login") {
      const payload = await collectBody(req);
      if (payload.login === AUTH_LOGIN && payload.password === AUTH_PASSWORD) {
        sendJson(res, 200, { token: createAuthToken() });
        return;
      }

      sendJson(res, 401, { error: "Login ou senha invalidos." });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/state") {
      if (!requireAuth(req, res)) {
        return;
      }

      sendJson(res, 200, {
        enabled: Boolean(pool),
        state: await readAppState()
      });
      return;
    }

    if (req.method === "PUT" && url.pathname === "/api/state") {
      if (!requireAuth(req, res)) {
        return;
      }

      if (!pool) {
        sendJson(res, 503, { error: "Banco de dados nao configurado." });
        return;
      }

      const payload = await collectBody(req);
      sendJson(res, 200, {
        enabled: true,
        state: await saveAppState(payload)
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/fluxo-de-caixa") {
      if (!requireAuth(req, res)) {
        return;
      }

      const payload = await collectBody(req);
      sendJson(res, 200, calculateCashFlow(payload.entries));
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/menu-semanal") {
      if (!requireAuth(req, res)) {
        return;
      }

      const payload = await collectBody(req);
      sendJson(res, 200, weeklyMenu(payload));
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/precificacao") {
      if (!requireAuth(req, res)) {
        return;
      }

      const payload = await collectBody(req);
      sendJson(res, 200, calculatePricing(payload));
      return;
    }

    if (req.method === "GET") {
      serveStatic(req, res, url.pathname);
      return;
    }

    sendJson(res, 405, { error: "Metodo nao permitido." });
  } catch (error) {
    sendJson(res, 400, { error: error.message || "Requisicao invalida." });
  }
}

const server = http.createServer(requestHandler);

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`Cumbuca Tools rodando em http://localhost:${PORT}`);
  });
}

module.exports = requestHandler;
