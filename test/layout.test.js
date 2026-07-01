const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'public', 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'public', 'styles.css'), 'utf8');
const html = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
const serviceWorker = fs.readFileSync(path.join(root, 'public', 'sw.js'), 'utf8');

test('finance, reports and maintenance expose the expected view tabs', () => {
  assert.match(app, /financeViewTab/);
  assert.match(app, /Contas a pagar e receber/);
  assert.match(app, /finance-pending-dashboard/);
  assert.match(app, /reconciliationHistory/);
  assert.match(app, /Parcelar valor total/);
  assert.match(app, /data-reverse-payment/);
  assert.match(app, /financialAccountNotifications/);
  assert.match(app, /Orçamento mensal por categoria/);
  assert.match(app, /Operação e financeiro/);
  assert.match(app, /cashEntryDraft/);
  assert.match(app, /normalizedCashEntryDraft/);
  assert.match(app, /localStorage\.setItem\("cashEntryDraft"/);
  assert.match(app, /Saldo insuficiente na conta para esta sa/);
  assert.match(app, /savingsHistoryDetailHtml/);
  assert.match(app, /dailyClosingChecklistHtml/);
  assert.match(app, /data-daily-closing-action/);
  assert.match(app, /data-focus-cash-entry/);
  assert.match(app, /data-cash-entry-date="today"/);
  assert.match(app, /data-cash-entry-date="yesterday"/);
  assert.match(app, /data-cash-quick="pending"/);
  assert.match(app, /data-cash-quick="savings"/);
  assert.match(app, /data-cash-quick="withdrawals"/);
  assert.match(css, /\.budget-progress/);
  assert.match(css, /\.cash-date-shortcuts/);
  assert.match(css, /\.daily-closing-guide/);
  assert.match(css, /\.closing-check/);
  assert.match(css, /\.linked-action-row/);
  assert.match(app, /reportViewTab/);
  assert.match(app, /data-maintenance-pane="integrity"/);
  assert.match(app, /permission-fieldset/);
  assert.match(app, /integration-status/);
  assert.match(app, /function normalizedCleanupYear/);
  assert.match(app, /numberYear < 2000/);
  assert.match(app, /cleanupYearField && cleanupPreviewBox/);
  assert.match(css, /\.account-row/);
  assert.match(css, /\.pending-grid/);
  assert.match(css, /\.maintenance-grid \.period-picker button/);
});

test('mobile tables receive column labels', () => {
  assert.match(app, /function enhanceResponsiveTables/);
  assert.match(css, /content:\s*attr\(data-label\)/);
});

test('HTML and service worker use the same asset versions', () => {
  const cssVersion = html.match(/styles\.css\?v=([^"]+)/)?.[1];
  const appVersion = html.match(/app\.js\?v=([^"]+)/)?.[1];

  assert.ok(cssVersion);
  assert.ok(appVersion);
  assert.match(serviceWorker, new RegExp(`styles\\.css\\?v=${cssVersion}`));
  assert.match(serviceWorker, new RegExp(`app\\.js\\?v=${appVersion}`));
});
