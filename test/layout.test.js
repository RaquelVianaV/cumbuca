const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'public', 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'public', 'styles.css'), 'utf8');
const html = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
const serviceWorker = fs.readFileSync(path.join(root, 'public', 'sw.js'), 'utf8');
const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');

test('narrow browser windows keep horizontal page scrolling available', () => {
  assert.match(css, /html \{\s*overflow-x: auto;/);
  assert.match(css, /body \{[\s\S]*?overflow-x: visible;/);
  assert.doesNotMatch(css, /html \{\s*overflow-x: hidden;/);
  assert.match(css, /@media \(min-width: 561px\) and \(max-width: 1100px\)/);
  assert.match(css, /grid-template-columns: repeat\(5, minmax\(0, 1fr\)\)/);
  assert.match(app, /cash-filter-disclosure/);
  assert.doesNotMatch(app, /Ajustes acumulados/);
  assert.match(app, /advancedCashFilterActive/);
  assert.match(app, /cash-filter-actions/);
  assert.match(css, /#cash-filter-form > label > select/);
  assert.match(css, /grid-template-columns: 0\.8fr 1\.05fr 1\.05fr 1\.1fr 1\.2fr 1\.4fr/);
  assert.match(css, /cash-ledger-panel > \.summary/);
  assert.match(html, /id="hero-motto"/);
  assert.match(html, /class="hero quote-mode hero-loading"/);
  assert.match(html, /<h1 id="page-title"><\/h1>/);
  assert.match(html, /<span id="hero-motto"><\/span>/);
  assert.match(html, /id="hosting-status"[^>]*>Vercel: tudo normal<\/span>/);
  assert.match(app, /function updateHostingStatus/);
  assert.doesNotMatch(app, /title\.textContent = "Visão Geral"/);
  assert.match(app, /dailyHeroMottos/);
  assert.match(app, /dailyHeroMessages/);
  assert.match(app, /showHomeHero/);
  assert.match(app, /quote-compact/);
  assert.match(app, /Boolean\(message\.compact\)/);
  assert.match(app, /message\.text\.length > 180 \|\| message\.text\.includes/);
  assert.match(app, /showStandardHero/);
  assert.match(app, /dailyCashMottos/);
  assert.match(app, /cashMottoForDate/);
  assert.match(app, /pageTitle === "Fluxo de Caixa"/);
  assert.match(app, /HOME_HERO_LAST_INDEX_KEY/);
  assert.match(app, /Math\.random\(\)/);
  assert.match(app, /window\.sessionStorage\.setItem/);
  assert.match(app, /Carlos Drummond de Andrade/);
  assert.match(app, /Vinicius de Moraes/);
  assert.match(app, /Chico Buarque/);
  assert.match(app, /Jorge Vercillo/);
  assert.match(app, /Los Hermanos/);
  assert.match(app, /Luis Fernando Verissimo/);
  assert.match(app, /Clarice Lispector/);
  assert.doesNotMatch(app, /ANAVITÓRIA/);
  const heroMessages = app.match(
    /const dailyHeroMessages = \[([\s\S]*?)\n\];\n\nconst HOME_HERO_LAST_INDEX_KEY/
  );
  assert.ok(heroMessages);
  assert.equal((heroMessages[1].match(/credit:/g) || []).length, 80);
  assert.equal((heroMessages[1].match(/credit: "Carlos Drummond de Andrade/g) || []).length, 16);
  assert.equal((heroMessages[1].match(/credit: "Vinicius de Moraes/g) || []).length, 16);
  assert.equal((heroMessages[1].match(/credit: "Chico Buarque/g) || []).length, 16);
  assert.equal((heroMessages[1].match(/credit: "Jorge Vercillo/g) || []).length, 10);
  assert.equal((heroMessages[1].match(/credit: "Los Hermanos/g) || []).length, 10);
  assert.equal((heroMessages[1].match(/credit: "Luis Fernando Verissimo/g) || []).length, 6);
  assert.equal((heroMessages[1].match(/credit: "Clarice Lispector/g) || []).length, 6);
  assert.match(
    heroMessages[1],
    /text: "E agora, José\?[\s\S]*?a noite esfriou\."[\s\S]*?Carlos Drummond de Andrade · José/
  );
  assert.match(
    heroMessages[1],
    /João amava Teresa[\s\S]*?J\. Pinto Fernandes\\nque não tinha entrado na história\./
  );
  assert.match(
    heroMessages[1],
    /text: "É claro que a vida é boa[\s\S]*?Mas acontece que eu sou triste\.\.\."[\s\S]*?Vinicius de Moraes · Dialética/
  );
  assert.match(heroMessages[1], /Vinicius de Moraes · Dialética",[\s\S]*?compact: true/);
  const cashMottos = app.match(
    /const dailyCashMottos = \[([\s\S]*?)\n\];\n\nconst dailyHeroMessages/
  );
  assert.ok(cashMottos);
  assert.equal((cashMottos[1].match(/"Pitada do dia:/g) || []).length, 30);
  assert.match(css, /\.hero-motto/);
  assert.match(css, /\.hero\.quote-mode h1/);
  assert.match(css, /\.hero\.hero-loading h1/);
  assert.match(html, /class="hero-logo hero-map"/);
  assert.match(html, /class="hero-brand-art"/);
  assert.match(html, /class="hero-bowl-logo"/);
  assert.match(html, /class="brand-copy"/);
  assert.match(html, /class="brand-mark"[\s\S]*?<img src="\/logo-cumbuca-original\.png"/);
  assert.equal(fs.existsSync(path.join(root, 'public', 'logo-cumbuca-original.png')), true);
  assert.match(html, /src="\/mapa-cumbuca\.png"/);
  assert.match(serviceWorker, /\/mapa-cumbuca\.png/);
  assert.equal(fs.existsSync(path.join(root, 'public', 'mapa-cumbuca.png')), true);
});

test('navigation, finance, reports and maintenance expose the expected views', () => {
  const mainNavigation = html.match(/<nav class="nav">([\s\S]*?)<\/nav>/)?.[1] || '';
  assert.match(mainNavigation, /href="\/home"[^>]*>[\s\S]*?Visão geral<\/a>/);
  assert.match(mainNavigation, /href="\/hoje"[^>]*>[\s\S]*?Hoje<\/a>/);
  assert.match(mainNavigation, /href="\/pedidos"[^>]*>[\s\S]*?Semanal<\/a>/);
  assert.match(mainNavigation, /href="\/loja\?view=sales"[^>]*>[\s\S]*?Loja<\/a>/);
  assert.match(mainNavigation, /href="\/precificacao"[^>]*>[\s\S]*?Precificação<\/a>/);
  assert.doesNotMatch(mainNavigation, /href="\/producao"/);
  assert.doesNotMatch(mainNavigation, /href="\/cardapio"/);
  assert.match(mainNavigation, /href="\/financeiro"[^>]*>[\s\S]*?Financeiro<\/a>/);
  assert.match(mainNavigation, /href="\/despesas"[^>]*>[\s\S]*?Despesas<\/a>/);
  assert.match(mainNavigation, /href="\/alertas"[^>]*>[\s\S]*?Alertas<\/a>/);
  assert.match(mainNavigation, /href="\/backups"[^>]*>[\s\S]*?Manutenção<\/a>/);
  assert.match(mainNavigation, /nav-section-label">Financeiro/);
  assert.match(mainNavigation, /nav-section-label">Gestão/);
  assert.equal((mainNavigation.match(/href="\/fluxo-de-caixa\?novo=despesa"/g) || []).length, 0);
  assert.match(app, /const editingOrder = state\.editOrderId/);
  assert.doesNotMatch(app, /paidAmount: editing\?\.paidAmount/);
  assert.match(app, /const orderValue = parseMoneyInput\(data\.get\("orderValue"\)\)/);
  assert.match(app, /amount: orderValue/);
  assert.match(app, /monthlyPackageCount/);
  assert.match(app, /orderValueField\.required = isWeekly/);
  assert.match(app, /Mensalidade recebida/);
  assert.match(app, /Só entra na contabilidade quando você informar o valor recebido/);
  assert.doesNotMatch(app, /planValueField\.required = isMonthly/);
  assert.doesNotMatch(app, /amount: client\.plan === "mensalista"/);
  assert.match(app, /const activeMenuRoute = currentMenuRoute === "pedidos"/);
  assert.match(app, /despesas: renderExpenses/);
  assert.match(app, /"menu-semanal": renderLegacyMenuRoute/);
  assert.match(app, /function renderCurrentRoute/);
  assert.match(app, /function internalAppUrl/);
  assert.match(app, /window\.addEventListener\("popstate"/);
  assert.doesNotMatch(
    app,
    /history\.replaceState\(null, "", `\/menu-semanal\$\{location\.search\}`\)/
  );
  assert.match(app, /Cadastre os custos do menu diretamente no Planejamento/);
  assert.match(app, /Gasto total de supermercado desta semana/);
  assert.match(app, /será dividido somente pelas/);
  assert.doesNotMatch(app, /O supermercado vem automaticamente do Caixa/);
  assert.match(app, /href="\/precificacao\?view=costs">Configurar outros custos rateados/);
  assert.match(app, /id="global-period-form"/);
  assert.match(
    app,
    /<button type="submit">Aplicar <span class="sr-only">em todo o sistema<\/span><\/button>/
  );
  assert.match(app, /function applyGlobalPeriodToViews/);
  assert.match(app, /localStorage\.setItem\("globalPeriod"/);
  assert.match(app, /state\.reportPeriod = \{[\s\S]*?type: "month"/);
  assert.match(app, /state\.cashFilter = \{[\s\S]*?period: "month"/);
  assert.match(app, /state\.storeSalesFilter = \{[\s\S]*?period: "month"/);
  assert.match(app, /state\.channelFilter = \{[\s\S]*?period: "month"/);
  assert.match(app, /partnersDashboard\.month\.paidToCashVanessa/);
  assert.match(app, /partnersDashboard\.month\.paidToCashRaquel/);
  assert.match(
    app,
    /Vanessa - recebeu da conta<\/span><strong>\$\{money\(partnersDashboard\.week\.vanessa\)\}/
  );
  assert.match(
    app,
    /Vanessa - recebeu da conta<\/span><strong>\$\{money\(partnersDashboard\.month\.vanessa\)\}/
  );
  assert.doesNotMatch(
    app,
    /money\(partnersDashboard\.(?:week|month)\.vanessa \+ partnersDashboard\.(?:week|month)\.paidToCashVanessa\)/
  );
  assert.doesNotMatch(app, /partnerCashOffsetLabel\(partnersDashboard\.accumulated\.paidToCash/);
  assert.match(app, /function pricingRecipeMetrics/);
  assert.match(
    app,
    /O supermercado informado em cada semana é dividido por todas as cumbucas pedidas/
  );
  assert.match(app, /href="\/precificacao\?view=costs">Abrir custos rateados/);
  assert.match(css, /\.menu-cost-breakdown/);
  assert.match(css, /\.global-period-form/);
  assert.match(app, /function upcomingBillSourceLabel/);
  assert.match(app, /function upcomingBillHref/);
  assert.match(app, /financeViewTab/);
  assert.match(app, /Contas a pagar e receber/);
  assert.match(app, /Funcionários da Cumbuca/);
  assert.match(app, /financialEmployeesPanel/);
  assert.match(app, /if \(activeTab === "employees"\)/);
  assert.match(
    app,
    /financeMonthCommandPanel\(data, reportType, weekRange, \{ showClosing: activeTab === "closing" \}\)/
  );
  assert.match(app, /financialEmployeeForEntry/);
  assert.match(app, /financial-employee-form/);
  assert.match(app, /cash-employee-field/);
  assert.match(app, /<input id="cash-type" name="type" type="hidden" value="expense">/);
  assert.match(app, /today-expense-employee-field/);
  assert.doesNotMatch(app, /financial-account-employee/);
  assert.match(app, /financial-account-payment-timing/);
  assert.match(app, /Pagar futuramente/);
  assert.match(app, /Conta fixa/);
  assert.match(app, /financial-account-cash-account-field/);
  assert.match(app, /Definir conta no pagamento/);
  assert.doesNotMatch(app, /cashAccount: kind === "payable" \? ""/);
  assert.match(app, /Definir quando pagar/);
  assert.match(app, /today-expense-cash-account-field/);
  assert.match(app, /cash-account-field/);
  assert.match(app, /Definir ao pagar/);
  assert.match(app, /Conta usada no pagamento \(digite PF, PJ ou COFRINHO\)/);
  assert.match(
    app,
    /cashAccountOptionsHtml\(cashEntryAccount, cashEntryType, false, "Definir quando pagar", true\)/
  );
  assert.match(app, /cashEntryUsesSavingsAccount/);
  assert.match(app, /employeeId/);
  assert.match(server, /employees: \[\]/);
  assert.match(app, /finance-pending-dashboard/);
  assert.match(app, /financeMonthCommandPanel/);
  assert.match(
    app,
    /function renderFinance\(\)[\s\S]*?app\.innerHTML = `\s*\$\{viewTabsHtml\("financeViewTab", activeTab, tabs\)\}[\s\S]*?financeMonthCommandPanel/
  );
  assert.match(app, /financialPlanVsActualPanel/);
  assert.match(app, /plan-vs-actual-panel/);
  assert.match(app, /finance-month-command/);
  assert.match(app, /data-finance-month-action/);
  assert.match(app, /reconciliationHistory/);
  assert.match(app, /Parcelar valor total/);
  assert.match(app, /data-reverse-payment/);
  assert.match(app, /financialAccountNotifications/);
  assert.match(app, /id="reopen-month-form"/);
  assert.match(app, /Confirmar reabertura/);
  assert.match(css, /\.closing-reopen-form/);
  assert.match(app, /Orçamento mensal por categoria/);
  assert.match(app, /Saldo consolidado das contas/);
  assert.match(app, /home-command-grid/);
  assert.match(app, /home-overview-band/);
  assert.match(app, /data-home-projection/);
  assert.match(app, /data-home-priorities/);
  assert.match(app, /data-home-budget/);
  assert.match(app, /data-home-volume/);
  assert.match(app, /dashboardAccountBreakdown/);
  assert.match(app, /accountBalanceBreakdownUntilDate/);
  assert.match(app, /latestCashEntryForAccount/);
  assert.match(app, /latestSavingsEntryUntilDate/);
  assert.match(app, /data-cash-account-summary="pf"/);
  assert.match(app, /data-cash-account-summary="pj"/);
  assert.match(app, /data-cash-account-summary="savings"/);
  assert.match(app, /data-cash-account-summary="unassigned"/);
  assert.match(app, /Conta Cofrinho/);
  assert.match(app, /Resultado do filtro/);
  assert.match(app, /Entradas - saídas exibidas/);
  assert.doesNotMatch(app, /id="zero-account-balance/);
  assert.match(app, /id="maintenance-zero-account"/);
  assert.match(app, /zeroAccountBalanceAtDate/);
  assert.match(app, /projectedBalances30/);
  assert.match(app, /cash-forecast-metric/);
  assert.match(app, /cashEntryDraft/);
  assert.match(app, /normalizedCashEntryDraft/);
  assert.match(app, /lockFormSubmission/);
  assert.match(app, /dataset\.submitting/);
  assert.match(app, /cashSort: \{ key: "date", direction: "desc" \}/);
  assert.match(app, /return comparison \|\| \(a\.index - b\.index\) \* direction/);
  assert.match(app, /cashAccountOptionsHtml/);
  assert.match(app, /reconciliationCashAccount/);
  assert.match(app, /cash-account-summary/);
  assert.match(app, /Unificado PF \+ PJ/);
  assert.doesNotMatch(app, /Entrada PF|Entrada PJ/);
  assert.match(app, /daily-reconciliation-account/);
  assert.match(app, /data-export-report="accountant-package"/);
  assert.match(app, /downloadAccountantPackage/);
  assert.match(app, /accountPackageSummaryRows/);
  assert.match(app, /accountPackagePfRows/);
  assert.match(app, /accountPackagePjRows/);
  assert.match(app, /financial-account-cash-account/);
  assert.match(app, /localStorage\.setItem\("cashEntryDraft"/);
  assert.doesNotMatch(app, /Saldo insuficiente na conta para esta sa/);
  assert.doesNotMatch(app, /Cofrinho cobriu/);
  assert.match(app, /savingsHistoryDetailHtml/);
  assert.match(app, /dailyClosingChecklistHtml/);
  assert.match(app, /data-daily-closing-action/);
  assert.match(app, /data-focus-cash-entry/);
  assert.match(app, /data-cash-entry-date="today"/);
  assert.match(app, /data-cash-entry-date="yesterday"/);
  assert.match(app, /data-cash-quick="pending"/);
  assert.match(app, /data-cash-quick="savings"/);
  assert.match(app, /data-cash-quick="withdrawals"/);
  assert.match(app, /storeSalesFilterDefaults/);
  assert.match(app, /storeSalesMonthComparison/);
  assert.match(app, /id="store-sales-filter-form"/);
  assert.match(app, /id="store-sales-filter-type"/);
  assert.match(app, /id="store-sales-filter-product"/);
  assert.match(app, /storeSalesSummary/);
  assert.match(app, /data-store-sales-filter-combos/);
  assert.match(app, /data-store-sales-filter-standalone-units/);
  assert.match(app, /data-store-sales-filter-combo-units/);
  assert.match(app, /data-store-sales-filter-best-day/);
  assert.match(app, /data-store-sales-day-ranking/);
  assert.match(app, /Combos vendidos/);
  assert.match(app, /Unidades nos combos/);
  assert.match(app, /data-store-sales-comparison/);
  assert.match(app, /name="saleType"/);
  assert.match(app, /name="unitsPerCombo"/);
  assert.match(app, /data-store-sale-total/);
  assert.doesNotMatch(app, /name="labels"/);
  assert.match(app, /name="telephony"/);
  assert.match(app, /Embalagens e etiquetas não entram aqui/);
  assert.match(app, /function storeSaleUnitQuantity/);
  assert.match(app, /data\.storeSales\.map\(storeSaleReportRow\)/);
  assert.match(css, /\.store-sale-type-options/);
  assert.match(css, /\.store-sale-total/);
  assert.match(css, /\.table-wrap table \{\s*width: 100%;\s*min-width: 0;/);
  assert.match(
    server,
    /\[\s*'Data',\s*'Produto',\s*'Tipo',\s*'Quantidade',\s*'Unidades por combo',\s*'Total de unidades'/
  );
  const cashTabs = app.match(
    /const cashPanelTabs = isExpensesRoute[\s\S]*?\n\s{4}: \[([\s\S]*?)\n\s{4}\];/
  );
  const storeTabs = app.match(/const storeTabs = \[([\s\S]*?)\];/);
  assert.ok(cashTabs);
  assert.ok(storeTabs);
  assert.doesNotMatch(cashTabs[1], /\["channels", "Canais"\]/);
  assert.match(storeTabs[1], /\["channels", "Canais"\]/);
  assert.match(storeTabs[1], /\["products", "Produtos"\]/);
  assert.match(app, /\/loja\?view=channels/);
  assert.match(app, /bindChannelReceipts\(renderStoreSales/);
  assert.match(app, /id="store-product-form"/);
  assert.match(app, /name="pricingRecipeId"/);
  assert.match(app, /name="productId"/);
  assert.match(app, /id="store-product-quantities-form"/);
  assert.match(app, /data-store-product-quantity/);
  assert.match(app, /function storeProductMonthlyHistory/);
  assert.match(app, /storeProductQuantities: state\.storeProductQuantities/);
  assert.match(app, /storeProductQuantities: state\.storeProductQuantities\.filter/);
  assert.match(server, /'storeProducts'/);
  assert.match(server, /'storeProductQuantities'/);
  assert.match(css, /\.store-product-quantity-row/);
  assert.match(app, /\["dashboard", "Visão geral"\]/);
  assert.doesNotMatch(app, /\["ingredients", "Ingredientes"\]/);
  assert.match(app, /\["recipes", "Pratos"\]/);
  assert.match(app, /\["costs", "Custos rateados"\]/);
  assert.match(app, /id="pricing-recipe-form"/);
  assert.match(app, /name="supermarketUnitCost"/);
  assert.match(app, /Custo de supermercado por unidade/);
  assert.match(app, /id="pricing-shared-cost-form"/);
  assert.match(app, /id="save-pricing-staff"/);
  assert.match(app, /data-pricing-staff-member/);
  assert.match(app, /function pricingStaffMembers/);
  assert.match(app, /function pricingStaffMembersFromForm/);
  assert.match(app, /Mão de obra cadastrada anteriormente/);
  assert.match(app, /function pricingRecipeIsComplete/);
  assert.match(app, /data-menu-cost-breakdown/);
  assert.match(app, /data-menu-supermarket-rate/);
  assert.match(app, /data-menu-weekly-supermarket-total/);
  assert.match(app, /data-menu-supermarket-unit/);
  assert.match(app, /data-menu-dish-cost/);
  assert.match(app, /data-menu-dish-cost-value/);
  assert.doesNotMatch(app, /data-menu-supermarket-cost/);
  assert.match(app, /data-menu-shared-cost/);
  assert.match(app, /data-menu-packaging/);
  assert.match(app, /data-menu-packaging-cost/);
  assert.match(app, /data-menu-profit-percent/);
  assert.match(app, /data-menu-profit/);
  assert.match(app, /data-menu-suggested-price/);
  assert.match(app, /data-menu-total-cost/);
  assert.match(app, /MENU_DEFAULT_PACKAGING_COST = 1\.6/);
  assert.match(app, /MENU_DEFAULT_PROFIT_PERCENT = 30/);
  assert.match(app, /function monthlySupermarketCashTotals/);
  assert.match(app, /function monthlySupermarketAllocation/);
  assert.match(app, /function menuItemPackagingCost/);
  assert.match(app, /function menuItemProfitPercent/);
  assert.match(app, /function menuPlanningCosts/);
  assert.match(app, /function weeklyMenuPlanningCosts/);
  assert.match(app, /function weeklyMenuSupermarketAllocation/);
  assert.match(app, /weeklyMenuSupermarketCostsByPeriod/);
  assert.match(app, /function weeklyMenuProductionCost/);
  assert.match(app, /function productionPurchasesForPeriod/);
  assert.match(app, /function managementPeriodMetrics/);
  assert.match(app, /function managementMovingAverage/);
  assert.match(app, /function managementAttentionItems/);
  assert.match(app, /function managementDreData/);
  assert.match(app, /function financeFoodAndBillsCostPanel/);
  assert.match(app, /function foodInputExpenseCategory/);
  assert.match(app, /Compras de insumos/);
  assert.match(app, /Boleto \+ Supermercado \+ Frigorífico pagos/);
  assert.match(app, /Compras por cumbuca/);
  assert.match(app, /Não representa CMV contábil/);
  assert.match(app, /Somente lançamentos na categoria Boleto/);
  assert.match(app, /data-menu-weekly-quantity/);
  assert.match(app, /data-week-summary/);
  assert.match(app, /Supermercado registrado na semana/);
  assert.match(app, /somente o gasto total de supermercado informado em cada semana/);
  assert.match(app, /Valor que sobra na semana/);
  assert.match(app, /function menuCatalogRows/);
  assert.match(app, /function filteredMenuCatalogRows/);
  assert.match(app, /function menuCatalogRecordedCosts/);
  assert.match(
    app,
    /Supermercado registrado na semana dividido pelas cumbucas vendidas na mesma semana/
  );
  assert.match(app, /Supermercado por cumbuca/);
  assert.match(app, /Cumbucas do mês/);
  assert.match(app, /catalogo=cumbucas/);
  assert.match(app, /Buscar cumbuca/);
  assert.match(css, /\.menu-catalog-grid/);
  assert.match(css, /\.menu-catalog-card/);
  assert.match(css, /\.menu-profit-controls/);
  assert.match(css, /\.menu-weekly-supermarket-entry/);
  assert.match(css, /\.percentage-input/);
  assert.match(css, /\.month-summary-note/);
  assert.match(app, /function isMonthlyRenewalRecord/);
  assert.match(app, /function clientMonthlyRenewals/);
  assert.match(app, /function clientLegacyPackageCount/);
  assert.match(app, /id="monthly-renewal-form"/);
  assert.match(app, /data-renew-client/);
  assert.match(app, /data-renewal-payment-toggle/);
  assert.match(app, /Lançar o valor da mensalidade agora/);
  assert.match(app, /Saldo insuficiente/);
  assert.match(app, /const LOW_MONTHLY_QUANTITY = 5/);
  assert.match(app, /Renovar em breve/);
  assert.match(app, /Renove em Clientes cadastrados > Renovar quantidade/);
  assert.doesNotMatch(app, /clientRemainingQuantity\(client, currentKey, editing\?\.id\)/);
  assert.doesNotMatch(app, /function monthlyPackageCountForOrder/);
  assert.match(css, /\.monthly-renewal-panel/);
  assert.match(css, /\.monthly-renewal-form/);
  assert.match(server, /recipeId: String\(found\.recipeId/);
  assert.match(app, /function pricingRecipeSupermarketUnitCost/);
  assert.match(app, /Custo de supermercado pendente/);
  assert.match(app, /function storeProductPerformanceRows/);
  assert.match(app, /function storeProductPerformancePanel/);
  assert.match(app, /function weeklyRecipeProfitabilityRows/);
  assert.match(app, /function businessProfitabilityPanel/);
  assert.match(app, /\["profitability", "Rentabilidade"\]/);
  assert.match(app, /data-profitability-panel/);
  assert.match(app, /data-store-product-performance/);
  assert.match(app, /\["products", "Produtos"\]/);
  assert.match(app, /function pricingSharedCosts/);
  assert.match(app, /function pricingDecimalNumber/);
  assert.match(app, /function pricingUnitCostMoney/);
  assert.match(app, /function storeAverageMonthlyUnits/);
  assert.match(app, /pricingRecipes: state\.pricingRecipes/);
  assert.match(app, /Custos extraordinários/);
  assert.match(app, /Lucro estimado por lote/);
  assert.match(app, /Cumbuca mais lucrativa/);
  assert.match(server, /'pricingRecipes'/);
  assert.match(server, /function calculatePricing/);
  assert.match(server, /supermarketUnitCost/);
  assert.match(server, /Custo de supermercado pendente/);
  assert.match(css, /\.pricing-dashboard-grid/);
  assert.match(css, /\.pricing-staff-editor/);
  assert.match(css, /\.pricing-staff-total/);
  assert.match(css, /\.pricing-recipe-layout/);
  assert.match(css, /\.pricing-workflow-context/);
  assert.match(css, /\.pricing-status\.pending/);
  assert.match(css, /\.pricing-status\.profitable/);
  assert.match(app, /name="priorVanessa"/);
  assert.match(app, /group\.hasPaidToCashVanessa\s*\?\s*group\.paidToCashVanessa\s*:\s*0/);
  assert.match(app, /group\.hasPaidToCashRaquel\s*\?\s*group\.paidToCashRaquel\s*:\s*0/);
  assert.match(app, /Vanessa — dívida compensada/);
  assert.match(app, /Vanessa — distribuição reconhecida/);
  assert.match(app, /Cofrinho — deveria ter recebido/);
  assert.match(app, /Cofrinho — recebeu da conta/);
  assert.match(
    app,
    /expectedVanessa[\s\S]*receivedNowRaquel[\s\S]*savingsPercent \/ partnerPoolPercent/
  );
  assert.match(app, /partnerBalances\(state\.partnerAccounts, accountBalanceDate\)/);
  assert.match(app, /Vanessa - saldo devedor em Sócias/);
  assert.match(app, /name="priorRaquel"/);
  assert.match(app, /name="expectedVanessa"/);
  assert.match(app, /name="expectedRaquel"/);
  assert.match(app, /Conta de onde saiu o dinheiro/);
  assert.match(app, /value="unassigned"/);
  assert.match(app, /Caixa real disponível/);
  assert.match(app, /Divisão automática/);
  assert.match(app, /O que fazer com a dívida nesta retirada/);
  assert.match(app, /Quanto realmente sairá da conta agora/);
  assert.match(app, /Conta-corrente das sócias/);
  assert.match(app, /partnerAccountsPanel/);
  assert.match(app, /nonOperationalPartnerAccount/);
  assert.match(app, /partnerWithdrawalSnapshotId/);
  assert.match(server, /validatePartnerAccountState/);
  assert.match(css, /\.partner-account-cards/);
  assert.match(app, /Lucro operacional/);
  assert.match(app, /Total que sai agora/);
  assert.match(app, /Vanessa - distribuição total/);
  assert.match(app, /Raquel - distribuição total/);
  assert.match(app, /vanessa_total_retirado/);
  assert.match(app, /raquel_total_retirado/);
  assert.match(app, /partnerCashOffsetLabel/);
  assert.match(app, /partnerPendingLabel/);
  assert.doesNotMatch(app, /Antecipado|Acima do calculado/);
  assert.match(css, /\.budget-progress/);
  assert.match(css, /\.cash-date-shortcuts/);
  assert.match(css, /\.cash-account-summary/);
  assert.match(app, /data-cash-summary-category/);
  assert.match(app, /aria-pressed="\$\{active\}"/);
  assert.match(app, /data-cash-ledger-results/);
  assert.match(css, /\.cash-category-summary-card\.active/);
  assert.match(css, /\.cash-category-summary-card:focus-visible/);
  assert.match(css, /\.cash-account-metric/);
  assert.match(css, /\.dashboard-account-breakdown/);
  assert.match(css, /\.home-command-grid/);
  assert.match(css, /\.home-overview-band/);
  assert.match(css, /\.home-dashboard-kpis/);
  assert.match(css, /\.account-balance-metric/);
  assert.match(css, /\.cash-forecast-metric/);
  assert.match(css, /\.store-sales-filter/);
  assert.match(css, /\.store-sales-summary/);
  assert.match(css, /\.store-sales-day-ranking/);
  assert.match(css, /\.store-sales-comparison/);
  assert.match(css, /\.daily-closing-guide/);
  assert.match(css, /\.closing-check/);
  assert.match(css, /\.linked-action-row/);
  assert.match(css, /\.withdrawal-value-group/);
  assert.match(app, /reportViewTab/);
  assert.match(app, /\["financial", "Financeiro e sócias"\]/);
  assert.match(app, /function expenseCategoryReportPanel/);
  assert.match(app, /Custos separados por categoria/);
  assert.match(app, /function reportFinancialPositionPanel/);
  assert.match(app, /Deveria ter no cofrinho/);
  assert.match(app, /Vanessa recebeu/);
  assert.match(app, /Vanessa pagou/);
  assert.match(app, /Vanessa deve/);
  assert.match(app, /Saldo unificado/);
  assert.match(app, /savingsExpectedBalance/);
  assert.match(html, /nav-section-label">Operação/);
  assert.match(app, /function operationAgendaItems/);
  assert.match(app, /function actionableManagementAlerts/);
  assert.match(app, /data-alert-category/);
  assert.match(app, /name="defaultPackagingCost"/);
  assert.match(app, /name="defaultDesiredMarginPercent"/);
  assert.match(app, /name="backupReminderDays"/);
  assert.match(app, /id="maintenance-backup-health"/);
  assert.match(app, /function automaticBackupHealthHtml/);
  assert.match(app, /data-maintenance-pane="integrity"/);
  assert.match(app, /updateMaintenanceTabRoute/);
  assert.match(app, /maintenanceTabForTarget/);
  assert.match(app, /scrollMaintenanceTarget/);
  assert.match(app, /permission-fieldset/);
  assert.match(app, /integration-status/);
  assert.match(app, /function normalizedCleanupYear/);
  assert.match(app, /numberYear < 2000/);
  assert.match(app, /cleanupYearField && cleanupPreviewBox/);
  assert.match(css, /\.account-row/);
  assert.match(css, /\.pending-grid/);
  assert.match(css, /\.finance-month-summary/);
  assert.match(css, /\.month-status-pill/);
  assert.match(css, /\.maintenance-grid \.period-picker button/);
  assert.match(css, /\.operation-priority-list/);
  assert.match(css, /\.plan-vs-actual-grid/);
  assert.match(css, /\.maintenance-health-grid/);
});

test('desktop navigation has its own vertical scroll area', () => {
  assert.match(
    css,
    /@media \(min-width: 1101px\)[\s\S]*?\.nav \{[\s\S]*?max-height: calc\(100vh - 116px\)/
  );
  assert.match(css, /@media \(min-width: 1101px\)[\s\S]*?overflow-y: auto/);
  assert.match(css, /@media \(min-width: 1101px\)[\s\S]*?overscroll-behavior: contain/);
  assert.match(css, /@media \(min-width: 1101px\)[\s\S]*?scrollbar-gutter: stable/);
});

test('Cardápio Web delivery fees stay outside channel sales totals and cash', () => {
  assert.match(app, /function cardapioDeliveryFeeAmount/);
  assert.match(app, /name="cardapioWebDeliveryFee"/);
  assert.match(app, /function cardapioPaymentFeePercent/);
  assert.match(app, /cardapioWebDebitFeePercent/);
  assert.match(app, /cardapioPaymentGrossAmount/);
  assert.match(
    app,
    /Somente para registro e conferência\. Não entra no Caixa nem no total das vendas\./
  );
  const channelTotal =
    app.match(/function channelReceiptTotal\(entry = \{\}\) \{[\s\S]*?\n\}/)?.[0] || '';
  assert.doesNotMatch(channelTotal, /cardapioDeliveryFee/);
  assert.match(app, /if \(total <= 0 && cardapioDeliveryFee <= 0\)/);
});

test('mobile tables receive column labels', () => {
  assert.match(app, /function enhanceResponsiveTables/);
  assert.match(css, /content:\s*attr\(data-label\)/);
});

test('HTML and service worker use the same asset versions', () => {
  const cssVersion = html.match(/styles\.css\?v=([^"]+)/)?.[1];
  const appVersion = html.match(/app\.js\?v=([^"]+)/)?.[1];
  const partnerAccountsVersion = html.match(/partner-accounts\.js\?v=([^"]+)/)?.[1];
  const accountTransfersVersion = html.match(/account-transfers\.js\?v=([^"]+)/)?.[1];

  assert.ok(cssVersion);
  assert.ok(appVersion);
  assert.ok(partnerAccountsVersion);
  assert.ok(accountTransfersVersion);
  assert.match(serviceWorker, new RegExp(`styles\\.css\\?v=${cssVersion}`));
  assert.match(serviceWorker, new RegExp(`app\\.js\\?v=${appVersion}`));
  assert.match(serviceWorker, new RegExp(`partner-accounts\\.js\\?v=${partnerAccountsVersion}`));
  assert.match(serviceWorker, new RegExp(`account-transfers\\.js\\?v=${accountTransfersVersion}`));
});

test('account transfers stay linked and outside operational results', () => {
  assert.match(app, /Transferência entre contas/);
  assert.match(app, /data-account-transfer-panel/);
  assert.match(app, /accountTransferCashEntries/);
  assert.match(app, /isAccountTransferCashEntry/);
  assert.match(app, /Saldo consolidado/);
  assert.match(app, /Aporte de sócia/);
  assert.match(app, /isPartnerCapitalContributionEntry/);
  assert.match(server, /validateAccountTransferState/);
  assert.doesNotMatch(app, /possui .* disponível nessa data/);
  assert.doesNotMatch(app, /Cofrinho não possui saldo suficiente .* concluir a transferência/);
  assert.doesNotMatch(app, /Cofrinho não possui saldo suficiente .* registrar essa saída/);
  assert.doesNotMatch(app, /Cofrinho não possui saldo suficiente .* registrar esse pagamento/);
  assert.match(app, /function selectableCashAccountOptions\(\) \{[\s\S]*savingsCashAccountOption/);
  assert.match(app, /function syncSavingsHistoryWithCashEntries/);
  assert.match(app, /function savingsHistoryLedgerEntries/);
  assert.match(app, /cashAccount: entry\.cashAccount \|\| "all"/);
  assert.match(app, /dayOrder: 100/);
  assert.match(app, /function monthlyOrderHasPaidPackage/);
  assert.match(app, /compensation: options\.compensationVanessa === undefined\s*\? 0/);
  assert.match(app, /Não compensar nesta retirada/);
  assert.match(css, /\.account-transfer-form/);
  assert.match(
    css,
    /@media \(max-width: 820px\)[\s\S]*?\.account-transfer-form \{[\s\S]*?grid-template-columns: 1fr/
  );
});
