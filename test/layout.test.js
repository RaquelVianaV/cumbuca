const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "public", "app.js"), "utf8");
const css = fs.readFileSync(path.join(root, "public", "styles.css"), "utf8");
const html = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");
const serviceWorker = fs.readFileSync(path.join(root, "public", "sw.js"), "utf8");

test("finance, reports and maintenance expose the expected view tabs", () => {
  assert.match(app, /financeViewTab/);
  assert.match(app, /Fluxo e contas/);
  assert.match(app, /reportViewTab/);
  assert.match(app, /data-maintenance-pane="integrity"/);
});

test("mobile tables receive column labels", () => {
  assert.match(app, /function enhanceResponsiveTables/);
  assert.match(css, /content:\s*attr\(data-label\)/);
});

test("HTML and service worker use the same asset versions", () => {
  const cssVersion = html.match(/styles\.css\?v=([^"]+)/)?.[1];
  const appVersion = html.match(/app\.js\?v=([^"]+)/)?.[1];

  assert.ok(cssVersion);
  assert.ok(appVersion);
  assert.match(serviceWorker, new RegExp(`styles\\.css\\?v=${cssVersion}`));
  assert.match(serviceWorker, new RegExp(`app\\.js\\?v=${appVersion}`));
});
