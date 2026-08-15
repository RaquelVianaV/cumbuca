const app = document.querySelector('#app');
const title = document.querySelector('#page-title');
const todayDate = document.querySelector('#today-date');
const hero = document.querySelector('.hero');
const heroMotto = document.querySelector('#hero-motto');
const systemStatusSummary = document.querySelector('#system-status-summary');
const serverStatus = document.querySelector('#server-status');
const databaseStatus = document.querySelector('#database-status');
const saveStatus = document.querySelector('#save-status');
const hostingStatus = document.querySelector('#hosting-status');
const backupButton = document.querySelector('#backup-button');
const logoutButton = document.querySelector('#logout-button');
const themeToggleButton = document.querySelector('#theme-toggle-button');
const currentUserBadge = document.querySelector('#current-user');
const globalNewButton = document.querySelector('#global-new-button');
const globalNewDialog = document.querySelector('#global-new-dialog');
const globalNewClose = document.querySelector('#global-new-close');
const partnerAccountRules = window.CumbucaPartnerAccounts;
const accountTransferRules = window.CumbucaAccountTransfers;
const {
  calculateWithdrawalDistribution: calculatePartnerWithdrawalDistribution,
  consolidatedMovementIds: consolidatedPartnerMovementIds,
  defaultPartnerAccounts,
  isPartnerCashEntry,
  movementEffect: partnerMovementEffect,
  normalizePartnerAccounts,
  partnerAccountSummary,
  partnerBalances
} = partnerAccountRules;
const {
  accountLabel: accountTransferAccountLabel,
  accountTransferCashEntries,
  accountTransferSavingsEntry,
  isAccountTransferCashEntry,
  normalizeAccountTransfers,
  normalizedAccount: normalizedAccountTransferAccount,
  normalizedAccountTransfer
} = accountTransferRules;
const navLinks = [...document.querySelectorAll('[data-route]')];
let systemStatus = {
  server: false,
  database: false,
  persistence: false
};
let lastConfirmedPayload = null;
let offlineAlertOpen = false;
let suppressIssueLog = false;
let serverStatusRequest = null;
let persistenceStatusRequest = null;
const STATUS_REQUEST_TIMEOUT_MS = 10000;
const APP_DATA_RESET_VERSION = "2026-05-29-clean-start";
const THEME_STORAGE_KEY = "cumbuca-theme";
const themePreferenceOptions = [
  ["system", "Sistema"],
  ["light", "Claro"],
  ["dark", "Escuro"]
];
const defaultAppConfig = {
  storeName: "Cumbuca",
  defaultRoute: "home",
  homeDashboardVersion: "2026-06-budget",
  splitSavingsPercent: 10,
  splitVanessaPercent: 70,
  splitRaquelPercent: 30,
  defaultPackagingCost: 0,
  defaultFixedFee: 0,
  defaultVariableFeePercent: 0,
  defaultDesiredMarginPercent: 30,
  cardapioWebDebitFeePercent: 0,
  cardapioWebCreditFeePercent: 0,
  cardapioWebOnlineCreditFeePercent: 0,
  cardapioWebPixFeePercent: 0,
  cardapioWebCashFeePercent: 0,
  backupReminderDays: 7
};
const configRouteOptions = [
  ["home", "Painel"],
  ["hoje", "Operação"],
  ["menu-semanal", "Menu"],
  ["fluxo-de-caixa", "Caixa"],
  ["financeiro", "Financeiro"],
  ["alertas", "Alertas"]
];
const localStateKeys = [
  "cashEntries",
  "partnerAccounts",
  "weeklyMenusByPeriod",
  "weeklyMenuSupermarketCostsByPeriod",
  "menuWeek",
  "menuPeriod",
  "globalPeriod",
  "menuDatesByPeriod",
  "clients",
  "orders",
  "storeSales",
  "storeSalesFilter",
  "storeProducts",
  "storeProductQuantities",
  "channelReceipts",
  "cashCategories",
  "archivedCashCategories",
  "suppliers",
  "expenseReasons",
  "archivedExpenseReasons",
  "auditLog",
  "auditFilter",
  "monthlyClosings",
  "weeklyClosings",
  "pricingIngredients",
  "pricingRecipes",
  "pricingConfig",
  "cashFilter",
  "financialPlanning",
  "appConfig",
  "reportPeriod",
  "cashEntryDraft",
  "lastManualBackupAt"
];

if (localStorage.getItem("appDataResetVersion") !== APP_DATA_RESET_VERSION) {
  localStateKeys.forEach(key => localStorage.removeItem(key));
  localStorage.setItem("appDataResetVersion", APP_DATA_RESET_VERSION);
}

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

const monthYear = new Intl.DateTimeFormat("pt-BR", {
  month: "long",
  year: "numeric"
});

const dailyHeroMottos = [
  "Pitada do dia: domingo também combina com organização, mas sem esquecer o café.",
  "Pitada do dia: segunda organizada e metade do drama financeiro já foi embora.",
  "Pitada do dia: cada lançamento certo é um boleto a menos fazendo mistério.",
  "Pitada do dia: respira, confere e lança; o caixa também gosta de carinho.",
  "Pitada do dia: planilha em dia, cabeça leve e cumbuca cheia.",
  "Pitada do dia: sextou melhor quando o caixa também fecha bonito.",
  "Pitada do dia: organização hoje, tranquilidade amanhã e café sempre."
];

const dailyCashMottos = [
  "Pitada do dia: lançar depois é o primo elegante de esquecer.",
  "Pitada do dia: o caixa não julga, mas guarda todos os recibos.",
  "Pitada do dia: saldo certo, café forte e ninguém surta antes do almoço.",
  "Pitada do dia: se não lançou, o dinheiro virou lenda urbana.",
  "Pitada do dia: conciliar é fazer as contas pararem de discutir.",
  "Pitada do dia: boleto pago é quase terapia, só que com comprovante.",
  "Pitada do dia: organização não faz milagre, mas evita vários sustos.",
  "Pitada do dia: o extrato sabe de coisas que a memória esqueceu.",
  "Pitada do dia: conferir duas vezes custa menos que procurar depois.",
  "Pitada do dia: conta sem categoria é meia perdida na lavanderia.",
  "Pitada do dia: dinheiro não aceita 'eu achei que tinha lançado'.",
  "Pitada do dia: hoje tem fechamento; respira e pega o café.",
  "Pitada do dia: planilha arrumada, coração com menos parcelas.",
  "Pitada do dia: o caixa fechou bonito e já pode sextar em paz.",
  "Pitada do dia: toda saída merece destino, até a do cafezinho.",
  "Pitada do dia: não é fofoca financeira, é conciliação.",
  "Pitada do dia: um comprovante por vez e o mistério desaparece.",
  "Pitada do dia: saldo negativo não é personalidade, dá para corrigir.",
  "Pitada do dia: se a conta não bate, ela está pedindo conversa.",
  "Pitada do dia: lançar na hora é carinho com você de amanhã.",
  "Pitada do dia: débito pequeno também cresce quando ganha liberdade.",
  "Pitada do dia: café primeiro, conferência logo depois.",
  "Pitada do dia: dinheiro contado dorme mais tranquilo.",
  "Pitada do dia: o mês vira, mas a pendência tenta ficar.",
  "Pitada do dia: recibo guardado é paz em formato de papel.",
  "Pitada do dia: até o Pix precisa de nome e categoria.",
  "Pitada do dia: não brigue com o saldo; investigue com educação.",
  "Pitada do dia: fechar o caixa também conta como exercício mental.",
  "Pitada do dia: cada lançamento certo é um mini 'ufa'.",
  "Pitada do dia: cumbuca cheia e conta conferida — equilíbrio perfeito."
];

const dailyHeroMessages = [
  {
    text: "No meio do caminho tinha uma pedra, tinha uma pedra no meio do caminho.",
    credit: "Carlos Drummond de Andrade · No meio do caminho"
  },
  {
    text: "E agora, José? A festa acabou, a luz apagou, o povo sumiu, a noite esfriou.",
    credit: "Carlos Drummond de Andrade · José"
  },
  {
    text: "Quando nasci, um anjo torto, desses que vivem na sombra, disse: Vai, Carlos! ser gauche na vida.",
    credit: "Carlos Drummond de Andrade · Poema de sete faces"
  },
  {
    text: "João amava Teresa que amava Raimundo\nque amava Maria que amava Joaquim que amava Lili\nque não amava ninguém.\nJoão foi para os Estados Unidos, Teresa para o convento,\nRaimundo morreu de desastre, Maria ficou para tia,\nJoaquim suicidou-se e Lili casou com J. Pinto Fernandes\nque não tinha entrado na história.",
    credit: "Carlos Drummond de Andrade · Quadrilha"
  },
  {
    text: "Penetra surdamente no reino das palavras. Lá estão os poemas que esperam ser escritos.",
    credit: "Carlos Drummond de Andrade · Procura da poesia"
  },
  {
    text: "Tenho apenas duas mãos e o sentimento do mundo, mas estou cheio de escravos, minhas lembranças escorrem.",
    credit: "Carlos Drummond de Andrade · Sentimento do mundo"
  },
  {
    text: "Amar o perdido deixa confundido este coração. Mas as coisas findas, muito mais que lindas, essas ficarão.",
    credit: "Carlos Drummond de Andrade · Memória"
  },
  {
    text: "A porta da verdade estava aberta, mas só deixava passar meia pessoa de cada vez.",
    credit: "Carlos Drummond de Andrade · Verdade"
  },
  {
    text: "Não serei o poeta de um mundo caduco. Também não cantarei o mundo futuro.",
    credit: "Carlos Drummond de Andrade · Mãos dadas"
  },
  {
    text: "Casas entre bananeiras, mulheres entre laranjeiras, pomar amor cantar. Um homem vai devagar.",
    credit: "Carlos Drummond de Andrade · Cidadezinha qualquer"
  },
  {
    text: "Que não seja imortal, posto que é chama, mas que seja infinito enquanto dure.",
    credit: "Vinicius de Moraes · Soneto de fidelidade"
  },
  {
    text: "É claro que a vida é boa\nE a alegria, a única indizível emoção\nÉ claro que te acho linda\nE em ti bendigo o amor das coisas simples\nÉ claro que te amo\nE tenho tudo para ser feliz\n\nMas acontece que eu sou triste...",
    credit: "Vinicius de Moraes · Dialética",
    compact: true
  },
  {
    text: "Em cada despedida eu vou te amar desesperadamente.",
    credit: "Vinicius de Moraes · Eu sei que vou te amar"
  },
  {
    text: "É melhor ser alegre que ser triste.",
    credit: "Vinicius de Moraes · Samba da bênção"
  },
  {
    text: "A felicidade é como a gota de orvalho numa pétala.",
    credit: "Vinicius de Moraes · A felicidade"
  },
  {
    text: "Onde anda você, em que sol, em que distante manhã?",
    credit: "Vinicius de Moraes · Onde anda você"
  },
  {
    text: "Um velho calção de banho, o dia pra vadiar.",
    credit: "Vinicius de Moraes · Tarde em Itapuã"
  },
  {
    text: "Vai tua vida, teu caminho é de paz e amor.",
    credit: "Vinicius de Moraes · Se todos fossem iguais a você"
  },
  {
    text: "Chega de saudade, a realidade é que sem ela.",
    credit: "Vinicius de Moraes · Chega de saudade"
  },
  {
    text: "Maior amor nem mais estranho existe que o meu, que não sossega a coisa amada.",
    credit: "Vinicius de Moraes · Soneto do maior amor"
  },
  {
    text: "Amanhã há de ser outro dia, eu pergunto a você.",
    credit: "Chico Buarque · Apesar de você"
  },
  {
    text: "Vai passar nessa avenida um samba popular.",
    credit: "Chico Buarque · Vai passar"
  },
  {
    text: "O tempo rodou num instante, nas voltas do meu coração.",
    credit: "Chico Buarque · Roda viva"
  },
  {
    text: "Que a gente vai levando de teimoso e de pirraça.",
    credit: "Chico Buarque · Meu caro amigo"
  },
  {
    text: "Oh, pedaço de mim, oh, metade arrancada de mim.",
    credit: "Chico Buarque · Pedaço de mim"
  },
  {
    text: "A noiva do cowboy era você, além das outras três.",
    credit: "Chico Buarque · João e Maria"
  },
  {
    text: "Todo dia ela faz tudo sempre igual.",
    credit: "Chico Buarque · Cotidiano"
  },
  {
    text: "Corre, Maria, que a vida não espera, é uma primavera.",
    credit: "Chico Buarque · Olha Maria"
  },
  {
    text: "Eu faço samba e amor até mais tarde.",
    credit: "Chico Buarque · Samba e amor"
  },
  {
    text: "Pra ver a banda passar cantando coisas de amor.",
    credit: "Chico Buarque · A banda"
  },
  {
    text: "Pode parecer fraqueza, pois que seja fraqueza então.",
    credit: "Jorge Vercillo · Final feliz"
  },
  {
    text: "Nada vai me fazer desistir do amor.",
    credit: "Jorge Vercillo · Que nem maré"
  },
  {
    text: "Hoje tudo faz sentido, e ainda há tanto a aprender.",
    credit: "Jorge Vercillo · Monalisa"
  },
  {
    text: "Ela une todas as coisas como eu poderia explicar.",
    credit: "Jorge Vercillo · Ela une todas as coisas"
  },
  {
    text: "Hoje o herói aguenta o peso das compras do mês.",
    credit: "Jorge Vercillo · Homem-Aranha"
  },
  {
    text: "Quando a noite faz nascer a luz da escuridão.",
    credit: "Jorge Vercillo · Fênix"
  },
  {
    text: "Nesse abraço se fez um ciclo que não tem fim.",
    credit: "Jorge Vercillo · Ciclo"
  },
  {
    text: "E quando vejo, a vida espera mais de mim.",
    credit: "Jorge Vercillo · Eu e a vida"
  },
  {
    text: "Eu queria não sentir essa saudade.",
    credit: "Jorge Vercillo · Penso em ti"
  },
  {
    text: "Aprendi com a dor nada mais é o amor.",
    credit: "Jorge Vercillo · Encontro das águas"
  },
  {
    text: "Deixa eu brincar de ser feliz.",
    credit: "Los Hermanos · Todo Carnaval Tem Seu Fim"
  },
  {
    text: "Levo a vida devagar pra não faltar amor.",
    credit: "Los Hermanos · O vencedor"
  },
  {
    text: "Quem é mais sentimental que eu?",
    credit: "Los Hermanos · Sentimental"
  },
  {
    text: "Eu encontrei-a quando não quis mais procurar.",
    credit: "Los Hermanos · Último romance"
  },
  {
    text: "É preciso força pra sonhar e perceber.",
    credit: "Los Hermanos · Além do que se vê"
  },
  {
    text: "Deixa o verão pra mais tarde.",
    credit: "Los Hermanos · Deixa o verão"
  },
  {
    text: "Abre a janela agora, deixa que o sol te veja.",
    credit: "Los Hermanos · Conversa de botas batidas"
  },
  {
    text: "Eu que nunca amei a ninguém pude, enfim, amar.",
    credit: "Los Hermanos · A flor"
  },
  {
    text: "Abre essa janela, primavera quer entrar.",
    credit: "Los Hermanos · Casa pré-fabricada"
  },
  {
    text: "Deus vai dar aval, sim, o mal vai ter fim.",
    credit: "Los Hermanos · De onde vem a calma"
  },
  {
    text: "E como ficou chato ser moderno. Agora serei eterno. Eterno! Eterno! O Padre Eterno, a vida eterna, o fogo eterno.",
    credit: "Carlos Drummond de Andrade · Eterno"
  },
  {
    text: "Vamos, não chores. A infância está perdida. A mocidade está perdida. Mas a vida não se perdeu.",
    credit: "Carlos Drummond de Andrade · Consolo na praia"
  },
  {
    text: "Minha vida, nossas vidas formam um só diamante. Aprendi novas palavras e tornei outras mais belas.",
    credit: "Carlos Drummond de Andrade · Canção amiga"
  },
  {
    text: "Carlos, sossegue, o amor é isso que você está vendo: hoje beija, amanhã não beija, depois de amanhã é domingo.",
    credit: "Carlos Drummond de Andrade · Não se mate"
  },
  {
    text: "Lutar com palavras é a luta mais vã. Entanto lutamos mal rompe a manhã. Palavra, palavra, se me desafias, aceito o combate.",
    credit: "Carlos Drummond de Andrade · O lutador"
  },
  {
    text: "O amor pulou o muro, o amor subiu na árvore em tempo de se estrepar. Pronto, o amor se estrepou.",
    credit: "Carlos Drummond de Andrade · O amor bate na aorta"
  },
  {
    text: "Para isso fomos feitos: para lembrar e ser lembrados, para chorar e fazer chorar, para enterrar os nossos mortos.",
    credit: "Vinicius de Moraes · Poema de Natal"
  },
  {
    text: "Eu te peço perdão por te amar de repente, embora o meu amor seja uma velha canção nos teus ouvidos.",
    credit: "Vinicius de Moraes · Ternura"
  },
  {
    text: "De manhã escureço, de dia tardo, de tarde anoiteço, de noite ardo. Eu morro ontem, nasço amanhã. Meu tempo é quando.",
    credit: "Vinicius de Moraes · Poética"
  },
  {
    text: "Enfim, depois de tanto erro passado, tantas retaliações, tanto perigo, eis que ressurge noutro o velho amigo, nunca perdido, sempre reencontrado.",
    credit: "Vinicius de Moraes · Soneto do amigo"
  },
  {
    text: "De repente do riso fez-se o pranto, silencioso e branco como a bruma, e das bocas unidas fez-se a espuma.",
    credit: "Vinicius de Moraes · Soneto de separação"
  },
  {
    text: "Resta, acima de tudo, essa capacidade de ternura, essa intimidade perfeita com o silêncio, essa voz íntima pedindo perdão por tudo.",
    credit: "Vinicius de Moraes · O haver"
  },
  {
    text: "E ali dançaram tanta dança que a vizinhança toda despertou.",
    credit: "Chico Buarque · Valsinha"
  },
  {
    text: "Amou daquela vez como se fosse a última.",
    credit: "Chico Buarque · Construção"
  },
  {
    text: "Mulher, você vai gostar, tô levando uns amigos pra conversar.",
    credit: "Chico Buarque · Feijoada completa"
  },
  {
    text: "Todo sentimento precisa de um passado pra existir.",
    credit: "Chico Buarque · Todo o sentimento"
  },
  {
    text: "Parece que dizes: te amo, Maria. Na fotografia, estamos felizes.",
    credit: "Chico Buarque · Anos dourados"
  },
  {
    text: "O amor não tem pressa, ele pode esperar em silêncio.",
    credit: "Chico Buarque · Futuros amantes"
  },
  {
    text: "Fizemos muita bobagem, é verdade — guerras, filhos demais, sacanagem com os outros, carros com rabo de peixe, Brasília —, mas também fizemos coisas admiráveis.",
    credit: "Luis Fernando Verissimo · Ver!ssimas"
  },
  {
    text: "O cérebro humano é uma coisa tão complexa que nem o cérebro humano é complexo o bastante para entendê-lo.",
    credit: "Luis Fernando Verissimo · Ver!ssimas"
  },
  {
    text: "O Brasil é governado por minoria esmagadora.",
    credit: "Luis Fernando Verissimo · Ver!ssimas"
  },
  {
    text: "A sintaxe é uma questão de uso, não de princípios. Escrever bem é escrever claro, não necessariamente certo.",
    credit: "Luis Fernando Verissimo · Comédias para se ler na escola"
  },
  {
    text: "Vida não interessa: haverá comida e bebida depois da morte?",
    credit: "Luis Fernando Verissimo · Ver!ssimas"
  },
  {
    text: "Eu acho que na cama vale tudo, menos legumes. Já perdi a namorada porque disse que o meu limite era o pepino.",
    credit: "Luis Fernando Verissimo · Ver!ssimas"
  },
  {
    text: "Liberdade é pouco. O que eu desejo ainda não tem nome.",
    credit: "Clarice Lispector · Perto do coração selvagem"
  },
  {
    text: "Minha voz é o modo como vou buscar a realidade; a realidade, antes de minha linguagem, existe como um pensamento que não se pensa.",
    credit: "Clarice Lispector · Água viva"
  },
  {
    text: "Por que escrevo sobre uma jovem que nem pobreza enfeitada tem? Talvez porque nela haja um recolhimento.",
    credit: "Clarice Lispector · A hora da estrela"
  },
  {
    text: "Desde que me conheço, o fato social teve em mim importância maior que qualquer outro.",
    credit: "Clarice Lispector · Literatura e justiça"
  },
  {
    text: "Vamos falar a verdade: isto aqui não é crônica coisa nenhuma. Isto é apenas. Não entra em gênero. Gêneros não me interessam mais.",
    credit: "Clarice Lispector · Todas as crônicas"
  },
  {
    text: "Se eu tivesse que dar um título à minha vida seria: à procura da própria coisa.",
    credit: "Clarice Lispector · Aproximação gradativa"
  }
];

const HOME_HERO_LAST_INDEX_KEY = "cumbuca-last-home-quote";

function dayOfYearIndex(date = new Date()) {
  const currentDay = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const firstDay = Date.UTC(date.getFullYear(), 0, 1);
  return Math.floor((currentDay - firstDay) / 86400000);
}

function cashMottoForDate(date = new Date()) {
  return dailyCashMottos[dayOfYearIndex(date) % dailyCashMottos.length];
}

function randomHeroMessage() {
  let previousIndex = -1;

  try {
    const storedIndex = Number.parseInt(window.sessionStorage.getItem(HOME_HERO_LAST_INDEX_KEY), 10);
    if (Number.isInteger(storedIndex) && storedIndex >= 0 && storedIndex < dailyHeroMessages.length) {
      previousIndex = storedIndex;
    }
  } catch (error) {
    previousIndex = -1;
  }

  const availableCount = dailyHeroMessages.length - (previousIndex >= 0 ? 1 : 0);
  let selectedIndex = Math.floor(Math.random() * availableCount);
  if (previousIndex >= 0 && selectedIndex >= previousIndex) {
    selectedIndex += 1;
  }

  try {
    window.sessionStorage.setItem(HOME_HERO_LAST_INDEX_KEY, String(selectedIndex));
  } catch (error) {
    // A frase continua funcionando mesmo se o navegador bloquear o armazenamento.
  }

  return dailyHeroMessages[selectedIndex];
}

function showStandardHero(pageTitle, date = new Date()) {
  title.textContent = pageTitle;
  hero?.classList.remove("hero-loading");
  hero?.classList.remove("quote-mode", "quote-compact");
  if (heroMotto) {
    heroMotto.textContent = pageTitle === "Fluxo de Caixa"
      ? cashMottoForDate(date)
      : dailyHeroMottos[date.getDay()];
  }
}

function showHomeHero() {
  const message = randomHeroMessage();
  title.textContent = `“${message.text}”`;
  hero?.classList.remove("hero-loading");
  hero?.classList.add("quote-mode");
  hero?.classList.toggle(
    "quote-compact",
    Boolean(message.compact) || message.text.length > 180 || message.text.includes("\n")
  );
  if (heroMotto) {
    heroMotto.textContent = message.credit;
  }
}

if (todayDate) {
  const now = new Date();
  todayDate.dateTime = isoDate(now);
  todayDate.textContent = fullDate.format(now);
  if (heroMotto) {
    heroMotto.textContent = dailyHeroMottos[now.getDay()];
  }
}

function fetchWithTimeout(url, options = {}, timeoutMs = STATUS_REQUEST_TIMEOUT_MS) {
  if (typeof AbortController === "undefined") {
    return fetch(url, options);
  }
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => {
    window.clearTimeout(timeout);
  });
}

async function performServerStatusUpdate() {
  if (!serverStatus || !databaseStatus) {
    return;
  }

  try {
    const response = await fetchWithTimeout("/api/health", { cache: "no-store" });
    if (!response.ok) {
      throw new Error("offline");
    }
    const result = await response.json();
    systemStatus.server = true;
    systemStatus.database = Boolean(result.database);
    state.database = Boolean(result.database);
    updateHostingStatus(Boolean(result.hostingWarning), result.hosting);
    serverStatus.textContent = "Servidor online";
    serverStatus.classList.add("online");
    serverStatus.classList.remove("offline");
    databaseStatus.textContent = result.database ? "Banco online" : "Banco offline";
    databaseStatus.classList.toggle("online", Boolean(result.database));
    databaseStatus.classList.toggle("offline", !result.database);
    updateSystemStatusSummary();
  } catch (error) {
    systemStatus.server = false;
    systemStatus.database = false;
    state.database = false;
    updateHostingStatus(false, "offline");
    serverStatus.textContent = "Servidor offline";
    serverStatus.classList.add("offline");
    serverStatus.classList.remove("online");
    databaseStatus.textContent = "Banco offline";
    databaseStatus.classList.add("offline");
    databaseStatus.classList.remove("online");
    updateSystemStatusSummary();
  }
}

function updateServerStatus() {
  if (!serverStatusRequest) {
    serverStatusRequest = performServerStatusUpdate().finally(() => {
      serverStatusRequest = null;
    });
  }
  return serverStatusRequest;
}

function updateHostingStatus(hostingWarning = false, provider = '') {
  if (!hostingStatus) {
    return;
  }

  const hostname = String(window.location.hostname || '').toLowerCase();
  const isVercelHost = provider === 'Vercel' || hostname === 'vercel.app' || hostname.endsWith('.vercel.app');
  const isOffline = provider === 'offline';
  const isWarning = isVercelHost && hostingWarning;
  hostingStatus.textContent = isOffline
    ? 'Vercel: sem resposta'
    : isWarning
      ? 'Vercel: confira o plano'
      : isVercelHost
        ? 'Vercel: tudo normal'
        : 'Hospedagem: ambiente local';
  hostingStatus.title = isOffline
    ? 'Não foi possível confirmar o estado atual da hospedagem.'
    : isWarning
      ? 'A Vercel sinalizou atenção ao uso ou aos limites do plano. Confira o painel da Vercel.'
      : isVercelHost
        ? 'A aplicação está hospedada na Vercel e não há alerta de uso configurado.'
        : 'Este ambiente está rodando localmente no Node.js; a produção é hospedada na Vercel.';
  hostingStatus.classList.toggle('warning', isWarning);
  hostingStatus.classList.toggle('online', !isWarning && !isOffline);
  hostingStatus.classList.toggle('offline', isOffline);
}

function updateSystemStatusSummary() {
  if (!systemStatusSummary) {
    return;
  }

  const serverOffline = serverStatus?.classList.contains("offline");
  const serverOnline = serverStatus?.classList.contains("online");
  const databaseOffline = databaseStatus?.classList.contains("offline");
  const databaseOnline = databaseStatus?.classList.contains("online");
  const saveOffline = saveStatus?.classList.contains("offline");
  const saveOnline = saveStatus?.classList.contains("online");

  let text = "Verificando sistema";
  let mode = "checking";
  if (serverOffline) {
    text = "Servidor offline";
    mode = "offline";
  } else if (databaseOffline) {
    text = "Banco offline";
    mode = "offline";
  } else if (saveOffline) {
    text = "Salvamento bloqueado";
    mode = "offline";
  } else if (serverOnline && databaseOnline && saveOnline) {
    text = "Online e salvando";
    mode = "online";
  } else if (serverOnline && databaseOnline) {
    text = "Online, conferindo salvamento";
    mode = "checking";
  }

  systemStatusSummary.textContent = text;
  systemStatusSummary.classList.toggle("online", mode === "online");
  systemStatusSummary.classList.toggle("offline", mode === "offline");
  systemStatusSummary.classList.toggle("checking", mode === "checking");
}

function setSaveStatus(text, mode = "checking") {
  if (!saveStatus) {
    return;
  }

  saveStatus.textContent = text;
  saveStatus.classList.toggle("online", mode === "online");
  saveStatus.classList.toggle("offline", mode === "offline");
  updateSystemStatusSummary();
}

function showToast(text, mode = "success") {
  if ((mode === "error" || mode === "warning") && !suppressIssueLog) {
    recordSystemIssue(mode, text);
  }
  let area = document.querySelector(".toast-area");
  if (!area) {
    area = document.createElement("div");
    area.className = "toast-area";
    document.body.appendChild(area);
  }

  [...area.querySelectorAll(".toast")].forEach(item => item.remove());

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

function toggleTheme() {
  const isDark = document.documentElement.classList.contains("dark-mode");
  applyThemePreference(isDark ? "light" : "dark", { persist: true });
}

function storedThemePreference() {
  const preference = localStorage.getItem(THEME_STORAGE_KEY);
  return themePreferenceOptions.some(([value]) => value === preference) ? preference : "system";
}

function systemPrefersDark() {
  return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function applyThemePreference(preference = storedThemePreference(), options = {}) {
  const nextPreference = themePreferenceOptions.some(([value]) => value === preference) ? preference : "system";
  const isDark = nextPreference === "dark" || (nextPreference === "system" && systemPrefersDark());
  const html = document.documentElement;
  html.classList.toggle("dark-mode", isDark);
  if (nextPreference === "system") {
    html.removeAttribute("data-theme-override");
  } else {
    html.setAttribute("data-theme-override", nextPreference);
  }
  if (options.persist) {
    localStorage.setItem(THEME_STORAGE_KEY, nextPreference);
  }
  updateThemeButtonText();
  const themeSelect = document.querySelector("#settings-theme-preference");
  if (themeSelect) {
    themeSelect.value = nextPreference;
  }
}

function updateThemeButtonText() {
  if (themeToggleButton) {
    const isDark = document.documentElement.classList.contains("dark-mode");
    const label = isDark ? "Ativar modo claro" : "Ativar modo escuro";
    const icon = themeToggleButton.querySelector(".theme-toggle-icon");
    const text = themeToggleButton.querySelector(".theme-toggle-label");
    if (icon) {
      icon.textContent = isDark ? "\u2600\uFE0F" : "\uD83C\uDF19";
    }
    if (text) {
      text.textContent = isDark ? "Escuro" : "Claro";
    }
    themeToggleButton.title = label;
    themeToggleButton.setAttribute("aria-label", label);
    themeToggleButton.setAttribute("aria-pressed", String(isDark));
  }
}

function clonePayload(payload) {
  return JSON.parse(JSON.stringify(payload));
}

function alertOfflineSave(reason) {
  const message = reason === "server"
    ? "Alteração não salva: o sistema está offline. Recarregue quando o servidor voltar."
    : "Alteração não salva: o banco está offline. Tente novamente quando o Supabase voltar.";
  setSaveStatus(reason === "server" ? "Servidor offline - nada salvo" : "Banco offline - nada salvo", "offline");
  showToast(message, "error");
  if (!offlineAlertOpen) {
    offlineAlertOpen = true;
    setTimeout(() => {
      alert(message);
      offlineAlertOpen = false;
    }, 20);
  }
}

async function onlineSaveCheck() {
  try {
    const healthResponse = await fetchWithTimeout("/api/health", { cache: "no-store" });
    if (!healthResponse.ok) {
      return { ok: false, reason: "server" };
    }
    const health = await healthResponse.json();
    systemStatus.server = true;
    systemStatus.database = Boolean(health.database);
    state.database = Boolean(health.database);
    if (!health.database) {
      return { ok: false, reason: "database" };
    }

    const persistenceResponse = await fetchWithTimeout("/api/persistence-check", { cache: "no-store" });
    if (!persistenceResponse.ok) {
      return { ok: false, reason: "database" };
    }
    const persistence = await persistenceResponse.json();
    systemStatus.persistence = Boolean(persistence.database && persistence.saved);
    if (!systemStatus.persistence) {
      return { ok: false, reason: "database" };
    }

    return { ok: true };
  } catch (error) {
    systemStatus.server = false;
    systemStatus.database = false;
    systemStatus.persistence = false;
    return { ok: false, reason: "server" };
  }
}

async function performPersistenceStatusUpdate() {
  if (!saveStatus) {
    return;
  }

  setSaveStatus("Salvamento verificando");
  try {
    const response = await fetchWithTimeout("/api/persistence-check", { cache: "no-store" });
    if (!response.ok) {
      throw new Error("persistence check failed");
    }
    const result = await response.json();
    if (!result.database || !result.saved) {
      systemStatus.persistence = false;
      setSaveStatus("Banco offline - salvamento bloqueado", "offline");
      return;
    }

    systemStatus.persistence = true;
    setSaveStatus("Supabase ok - backup manual", "online");
  } catch (error) {
    systemStatus.persistence = false;
    setSaveStatus("Sem confirmação - salvamento bloqueado", "offline");
  }
}

if (logoutButton) {
  logoutButton.addEventListener("click", async () => {
    await fetch("/api/logout", { method: "POST" });
    location.href = "/login";
  });
}

if (themeToggleButton) {
  themeToggleButton.addEventListener("click", toggleTheme);
  applyThemePreference(storedThemePreference());
  updateThemeButtonText();
}

if (window.matchMedia) {
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (storedThemePreference() === "system") {
      applyThemePreference("system");
    }
  });
}

const LOW_MONTHLY_QUANTITY = 5;
const defaultIncomeCategories = [
  ["venda", "Venda"],
  ["cardapio-web", "Cardápio Web"],
  ["ifood", "iFood"],
  ["99-food", "99 Food"],
  ["vanessa", "Vanessa"],
  ["raquel", "Raquel"],
  ["cofrinho", "Cofrinho"],
  ["diferenca", "Diferença"],
  ["conta-socia", "Conta-corrente de sócia"],
  ["aporte-socia", "Aporte de sócia"],
  ["ajuste-conta", "Ajuste da conta"]
];
const channelDefinitions = [
  ["cardapioWeb", "Cardápio Web"],
  ["ifood", "iFood"],
  ["food99", "99 Food"]
];
const cardapioPaymentDefinitions = [
  ["debit", "Débito", "cardapioWebDebitFeePercent"],
  ["credit", "Crédito", "cardapioWebCreditFeePercent"],
  ["onlineCredit", "Cartão de crédito online", "cardapioWebOnlineCreditFeePercent"],
  ["pix", "Pix", "cardapioWebPixFeePercent"],
  ["cash", "Dinheiro", "cardapioWebCashFeePercent"]
];
const defaultExpenseCategories = [
  ["supermercado", "Supermercado"],
  ["despesas-gerais", "Despesas gerais"],
  ["boleto", "Boleto"],
  ["conta", "Conta"],
  ["funcionarios", "Funcionários"],
  ["entregador", "Entregador"],
  ["99-uber", "99/Uber"],
  ["adesivos", "Adesivos"],
  ["aluguel", "Aluguel"],
  ["enel", "Enel"],
  ["contador", "Contador"],
  ["impostos", "Impostos"],
  ["nubank-cumbuca", "Nubank Cumbuca"],
  ["bee-delivery", "Bee Delivery"],
  ["gas", "Gás"],
  ["vivo", "Vivo"],
  ["retirada", "Retirada"],
  ["conta-socia", "Conta-corrente de sócia"],
  ["vanessa", "Vanessa"],
  ["raquel", "Raquel"],
  ["cofrinho", "Cofrinho"],
  ["troco", "Troco"],
  ["diferenca", "Diferença"],
  ["ajuste-conta", "Ajuste da conta"],
  ["outros", "Outros"]
];
const legacyCategoryLabels = [
  ["99", "99 Food"],
  ["transferencia-contas", "Transferência entre contas"]
];
const defaultExpenseReasons = [
  "Supermercado",
  "Despesas gerais",
  "Funcionários",
  "Entregador",
  "99/Uber",
  "Adesivos",
  "Jean Veículos / MARTINS",
  "Gv Distribuidora / IDEAL",
  "Mab",
  "Praso",
  "Frical",
  "Frigorífico",
  "Sanduiches",
  "Sucos",
  "Semear",
  "Aluguel",
  "Enel",
  "Contador",
  "Impostos",
  "Nubank Cumbuca",
  "Bee Delivery",
  "Gás",
  "Vivo",
  "Vanessa",
  "Raquel",
  "Cofrinho",
  "Troco",
  "Diferença"
];

function localValue(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
  } catch (error) {
    return fallback;
  }
}

function updatePersistenceStatus() {
  if (!persistenceStatusRequest) {
    persistenceStatusRequest = performPersistenceStatusUpdate().finally(() => {
      persistenceStatusRequest = null;
    });
  }
  return persistenceStatusRequest;
}

function normalizedCashEntryDraft(saved = localValue("cashEntryDraft", null)) {
  const type = saved?.type === "expense" ? "expense" : "income";
  const fallbackCategory = type === "expense" ? "outros" : "venda";
  return {
    date: /^\d{4}-\d{2}-\d{2}$/.test(saved?.date || "") ? saved.date : "",
    type,
    category: typeof saved?.category === "string" && saved.category ? saved.category : fallbackCategory,
    cashAccount: normalizedCashAccount(saved?.cashAccount)
  };
}

const cashAccountOptions = [
  ["pf", "PF"],
  ["pj", "PJ"]
];

const savingsCashAccountOption = ["savings", "Conta Cofrinho"];

function selectableCashAccountOptions() {
  return [...cashAccountOptions, savingsCashAccountOption];
}

function normalizedCashAccount(value, fallback = "pf") {
  return selectableCashAccountOptions(true).some(([key]) => key === value) ? value : fallback;
}

function cashAccountLabel(value) {
  const normalized = normalizedCashAccount(value, "");
  if (!normalized) {
    return "Sem conta informada";
  }
  if (normalized === "savings") {
    return savingsCashAccountOption[1];
  }
  const suffix = normalized.toUpperCase();
  return `Conta ${suffix}`;
}

function cashAccountOptionsHtml(selected = "pf", type = "income", includeAll = false, emptyLabel = "", includeSavings = false) {
  const normalized = includeAll
    ? String(selected || "all")
    : normalizedCashAccount(selected, emptyLabel ? "" : "pf");
  const options = selectableCashAccountOptions(includeSavings);
  return `
    ${includeAll ? `<option value="all" ${normalized === "all" ? "selected" : ""}>${includeSavings ? "Todas as contas" : "Unificado PF + PJ"}</option>` : ""}
    ${includeAll ? `<option value="unassigned" ${normalized === "unassigned" ? "selected" : ""}>Lançamentos sem conta</option>` : ""}
    ${emptyLabel ? `<option value="" ${normalized ? "" : "selected"}>${escapeHtml(emptyLabel)}</option>` : ""}
    ${options.map(([value]) => `
      <option value="${value}" ${normalized === value ? "selected" : ""}>${cashAccountLabel(value, type)}</option>
    `).join("")}
  `;
}

function reconciliationCashAccount(value) {
  return value === "all" ? "all" : normalizedCashAccount(value, "all");
}

function reconciliationAccountLabel(value) {
  const normalized = reconciliationCashAccount(value);
  return normalized === "all" ? "Unificado PF + PJ" : cashAccountLabel(normalized, "expense");
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

function slugifyCategory(value) {
  const slug = String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || `categoria-${Date.now()}`;
}

function uniqueCategories(categories = []) {
  const seen = new Set();
  return categories
    .map(item => Array.isArray(item)
      ? [String(item[0] || slugifyCategory(item[1])), String(item[1] || item[0] || "").trim()]
      : [String(item?.key || slugifyCategory(item?.label)), String(item?.label || item?.key || "").trim()])
    .filter(([, label]) => Boolean(label))
    .filter(([key]) => {
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
}

function seededCashCategories(saved = localValue("cashCategories", null)) {
  const savedIncome = Array.isArray(saved?.income) ? saved.income : [];
  const savedExpense = Array.isArray(saved?.expense) ? saved.expense : [];
  const reasonCategories = seededExpenseReasons().map(reason => [slugifyCategory(reason), reason]);

  return {
    income: uniqueCategories([...defaultIncomeCategories, ...savedIncome]),
    expense: uniqueCategories([...defaultExpenseCategories, ...reasonCategories, ...savedExpense])
  };
}

const state = {
  cash: localValue("cashEntries", []),
  partnerAccounts: normalizePartnerAccounts(localValue("partnerAccounts", defaultPartnerAccounts())),
  menus: localValue("weeklyMenusByPeriod", {}),
  menuSupermarketCosts: localValue("weeklyMenuSupermarketCostsByPeriod", {}),
  menuWeek: Number(localStorage.getItem("menuWeek") || "1"),
  menuPeriod: localValue("menuPeriod", {
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1
  }),
  globalPeriod: localValue("globalPeriod", null),
  menuDates: localValue("menuDatesByPeriod", {}),
  clients: localValue("clients", []),
  orders: localValue("orders", []),
  storeSales: localValue("storeSales", []),
  storeSalesFilter: localValue("storeSalesFilter", { period: "month" }),
  storeProducts: localValue("storeProducts", []),
  storeProductQuantities: localValue("storeProductQuantities", []),
  channelReceipts: localValue("channelReceipts", []),
  cashCategories: seededCashCategories(),
  archivedCashCategories: localValue("archivedCashCategories", { income: [], expense: [] }),
  expenseReasons: seededExpenseReasons(),
  archivedExpenseReasons: localValue("archivedExpenseReasons", []),
  auditLog: localValue("auditLog", []),
  monthlyClosings: localValue("monthlyClosings", {}),
  weeklyClosings: localValue("weeklyClosings", {}),
  showClients: false,
  showOrders: false,
  showPlanning: false,
  showMonthSummary: false,
  showMenuCatalog: false,
  menuCatalogFilter: {
    search: "",
    week: "all",
    cost: "all"
  },
  clientTab: "form",
  orderTab: "form",
  clientSearch: "",
  clientHistoryPhone: "",
  renewClientIndex: null,
  orderSearch: "",
  editClientIndex: null,
  editOrderId: null,
  editCashId: null,
  editReconciliationId: null,
  editSavingsEntryId: null,
  editAccountTransferId: null,
  accountTransferDraft: { origin: "pj", destination: "pf" },
  cashSort: { key: "date", direction: "desc" },
  editWithdrawalGroup: null,
  editPartnerMovementId: null,
  partnerMovementDraft: null,
  partnerAccountFocus: localValue("partnerAccountFocus", "vanessa"),
  partnerAccountFilter: localValue("partnerAccountFilter", { start: "", end: "" }),
  editChannelReceiptId: null,
  editCashCategory: null,
  cashPanelTab: "entry",
  cashEntryDraft: normalizedCashEntryDraft(),
  channelFilter: localValue("channelFilter", { period: "month" }),
  editStoreSaleId: null,
  editExpenseReasonIndex: null,
  editUserName: null,
  ingredients: localValue("pricingIngredients", []),
  pricingRecipes: localValue("pricingRecipes", []),
  pricingConfig: localValue("pricingConfig", {}),
  pricingViewTab: localValue("pricingViewTab", "dashboard"),
  editPricingIngredientId: null,
  editPricingRecipeId: null,
  editFinancialEmployeeId: null,
  cashFilter: localValue("cashFilter", { period: "month" }),
  financialPlanning: localValue("financialPlanning", {
    savings: "",
    savingsUpdatedAt: "",
    savingsHistory: [],
    accountTransfers: [],
    partnersHistory: [],
    monthlyGoal: "",
    improvements: [],
    purchases: [],
    cycleStartDate: "",
    openingBalance: "",
    openingSavings: "",
    cycleNote: "",
    accounts: [],
    employees: [],
    reconciliationHistory: [],
    dailyClosings: {},
    monthlyBudgets: {}
  }),
  appConfig: localValue("appConfig", defaultAppConfig),
  reportPeriod: localValue("reportPeriod", {
    type: "month",
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    week: 1,
    date: isoDate(new Date()),
    start: "",
    end: "",
    expenseCategory: "all"
  }),
  orderFilter: localValue("orderFilter", {
    search: "",
    payment: "all",
    delivery: "all"
  }),
  maintenanceTab: localValue("maintenanceTab", "backup"),
  financeViewTab: localValue("financeViewTab", "summary"),
  reportViewTab: localValue("reportViewTab", "summary"),
  storeViewTab: localValue("storeViewTab", "sales"),
  storeProductMonth: localValue("storeProductMonth", isoDate(new Date()).slice(0, 7)),
  editStoreProductId: null,
  currentUser: null,
  database: false
};

if (localStorage.getItem("cashFilterDefaultMonthVersion") !== "2026-06") {
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const day = `${month}-${String(now.getDate()).padStart(2, "0")}`;
  if (!state.cashFilter || state.cashFilter.period === "all") {
    state.cashFilter = { period: "month", date: day, month, year: String(now.getFullYear()), type: "all", category: "all", cashAccount: "all", search: "" };
  }
  localStorage.setItem("cashFilterDefaultMonthVersion", "2026-06");
}

function appStatePayload() {
  return {
    cashEntries: state.cash,
    partnerAccounts: state.partnerAccounts,
    weeklyMenusByPeriod: state.menus,
    weeklyMenuSupermarketCostsByPeriod: state.menuSupermarketCosts,
    menuWeek: state.menuWeek,
    menuPeriod: state.menuPeriod,
    menuDatesByPeriod: state.menuDates,
    clients: state.clients,
    orders: state.orders,
    storeSales: state.storeSales,
    storeProducts: state.storeProducts,
    storeProductQuantities: state.storeProductQuantities,
    channelReceipts: state.channelReceipts,
    cashCategories: state.cashCategories,
    archivedCashCategories: state.archivedCashCategories,
    expenseReasons: state.expenseReasons,
    archivedExpenseReasons: state.archivedExpenseReasons,
    auditLog: state.auditLog,
    monthlyClosings: state.monthlyClosings,
    weeklyClosings: state.weeklyClosings,
    pricingIngredients: state.ingredients,
    pricingRecipes: state.pricingRecipes,
    pricingConfig: state.pricingConfig,
    cashFilter: state.cashFilter,
    financialPlanning: state.financialPlanning,
    appConfig: state.appConfig
  };
}

function systemIssues() {
  return localValue("systemIssues", []);
}

function recordSystemIssue(type, message, detail = "") {
  const issue = {
    id: Date.now(),
    type,
    message: String(message || ""),
    detail: String(detail || ""),
    route: routeName(),
    createdAt: new Date().toISOString()
  };
  const issues = [issue, ...systemIssues()].slice(0, 40);
  localStorage.setItem("systemIssues", JSON.stringify(issues));
}

function applyPayloadToState(saved = {}) {
  state.cash = saved.cashEntries || [];
  state.partnerAccounts = normalizePartnerAccounts(saved.partnerAccounts || defaultPartnerAccounts());
  state.menus = saved.weeklyMenusByPeriod || {};
  state.menuSupermarketCosts = saved.weeklyMenuSupermarketCostsByPeriod || {};
  state.menuWeek = Number(saved.menuWeek || 1);
  state.menuPeriod = saved.menuPeriod || {
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1
  };
  state.menuDates = saved.menuDatesByPeriod || {};
  state.clients = saved.clients || [];
  state.orders = saved.orders || [];
  state.storeSales = saved.storeSales || [];
  state.storeProducts = saved.storeProducts || [];
  state.storeProductQuantities = saved.storeProductQuantities || [];
  state.channelReceipts = saved.channelReceipts || [];
  state.cashCategories = seededCashCategories(saved.cashCategories);
  state.archivedCashCategories = saved.archivedCashCategories || { income: [], expense: [] };
  state.expenseReasons = Array.isArray(saved.expenseReasons) && saved.expenseReasons.length
    ? saved.expenseReasons
    : seededExpenseReasons();
  state.archivedExpenseReasons = saved.archivedExpenseReasons || [];
  state.auditLog = Array.isArray(saved.auditLog) ? saved.auditLog : [];
  state.monthlyClosings = saved.monthlyClosings || {};
  state.weeklyClosings = saved.weeklyClosings || {};
  state.ingredients = saved.pricingIngredients || [];
  state.pricingRecipes = saved.pricingRecipes || [];
  state.pricingConfig = saved.pricingConfig || {};
  state.cashFilter = saved.cashFilter || { period: "month" };
  state.financialPlanning = {
    savings: "",
    savingsUpdatedAt: "",
    savingsHistory: [],
    accountTransfers: [],
    partnersHistory: [],
    monthlyGoal: "",
    improvements: [],
    purchases: [],
    cycleStartDate: "",
    openingBalance: "",
    openingSavings: "",
    cycleNote: "",
    accounts: [],
    employees: [],
    reconciliationHistory: [],
    dailyClosings: {},
    monthlyBudgets: {},
    ...(saved.financialPlanning || {})
  };
  state.financialPlanning.accountTransfers = normalizeAccountTransfers(
    state.financialPlanning.accountTransfers
  );
  const savedAppConfig = saved.appConfig || {};
  state.appConfig = {
    ...defaultAppConfig,
    ...savedAppConfig
  };
  if (state.appConfig.defaultRoute === "pedidos") {
    state.appConfig.defaultRoute = "menu-semanal";
  }
  if (savedAppConfig.homeDashboardVersion !== defaultAppConfig.homeDashboardVersion) {
    state.appConfig.defaultRoute = "home";
    state.appConfig.homeDashboardVersion = defaultAppConfig.homeDashboardVersion;
  }
}

function rollbackUnsavedChange() {
  if (!lastConfirmedPayload) {
    return;
  }
  applyPayloadToState(clonePayload(lastConfirmedPayload));
  persistLocal();
  setTimeout(renderCurrentRoute, 0);
}

function persistLocal() {
  Object.entries(appStatePayload()).forEach(([key, value]) => {
    localStorage.setItem(key, JSON.stringify(value));
  });
}

function recordAudit(action, detail, metadata = {}) {
  const entry = {
    id: `audit-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    action: String(action || "Alteração"),
    detail: String(detail || ""),
    user: state.currentUser?.name || state.currentUser?.username || "Sistema",
    username: state.currentUser?.username || "",
    route: routeName(),
    createdAt: new Date().toISOString(),
    ...metadata
  };
  state.auditLog = [entry, ...(state.auditLog || [])].slice(0, 1000);
  return entry;
}

async function persistState() {
  syncSavingsHistoryWithCashEntries();
  setSaveStatus("Conferindo conexão...");
  const online = await onlineSaveCheck();
  if (!online.ok) {
    rollbackUnsavedChange();
    alertOfflineSave(online.reason);
    updateServerStatus();
    return false;
  }

  setSaveStatus("Salvando...");
  try {
    const response = await fetch("/api/state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state: appStatePayload() })
    });
    const result = await response.json();
    if (response.ok && result.database) {
      persistLocal();
      lastConfirmedPayload = clonePayload(appStatePayload());
      const now = shortDateTime.format(new Date());
      setSaveStatus(`Salvo no Supabase ${now}`, "online");
      showToast("Salvo no Supabase", "success");
      return true;
    } else {
      rollbackUnsavedChange();
      if (result.error) {
        setSaveStatus("Alteração bloqueada", "offline");
        showToast(result.error, "warning");
      } else {
        alertOfflineSave("database");
      }
      return false;
    }
  } catch (error) {
    rollbackUnsavedChange();
    alertOfflineSave("server");
    return false;
  }
}

async function hydrateState() {
  try {
    const response = await fetch("/api/state", { cache: "no-store" });
    if (!response.ok) {
      lastConfirmedPayload = clonePayload(appStatePayload());
      return;
    }
    const result = await response.json();
    state.database = Boolean(result.database);
    systemStatus.database = Boolean(result.database);
    const saved = result.state || {};
    if (result.database) {
      applyPayloadToState(saved);
      persistLocal();
      lastConfirmedPayload = clonePayload(appStatePayload());
    } else {
      lastConfirmedPayload = clonePayload(appStatePayload());
    }
  } catch (error) {
    state.database = false;
    systemStatus.database = false;
    lastConfirmedPayload = clonePayload(appStatePayload());
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
    if (currentUserBadge && state.currentUser) {
      currentUserBadge.textContent = `${state.currentUser.name || state.currentUser.username}${state.currentUser.role === "admin" ? " - admin" : ""}`;
    }
  } catch (error) {
    state.currentUser = null;
    if (currentUserBadge) {
      currentUserBadge.textContent = "";
    }
  }
}

function isAdminUser() {
  return state.currentUser?.role === "admin";
}

function canUser(permission) {
  return Boolean(isAdminUser() || state.currentUser?.permissions?.[permission]);
}

function canAccessMaintenanceTab(tab) {
  if (["users", "events"].includes(tab)) {
    return isAdminUser();
  }
  if (tab === "reset") {
    return canUser("clearData");
  }
  return true;
}

function setMaintenanceTab(tab) {
  state.maintenanceTab = canAccessMaintenanceTab(tab) ? tab : "backup";
  localStorage.setItem("maintenanceTab", JSON.stringify(state.maintenanceTab));
}

function updateMaintenanceTabRoute(tab) {
  const nextTab = canAccessMaintenanceTab(tab) ? tab : "backup";
  const url = new URL(location.href);
  url.searchParams.set("tab", nextTab);
  history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
}

function maintenanceTabForTarget(targetId) {
  return {
    "cleanup-year-form": "database",
    "real-db-usage": "database",
    "reset-all-panel": "reset",
    "reset-database-zone": "reset"
  }[targetId] || state.maintenanceTab || "backup";
}

function scrollMaintenanceTarget(targetId) {
  const targetTab = maintenanceTabForTarget(targetId);
  if (targetTab && targetTab !== state.maintenanceTab) {
    setMaintenanceTab(targetTab);
    updateMaintenanceTabRoute(state.maintenanceTab);
    renderBackups();
  }
  setTimeout(() => {
    document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, 0);
}

function bindViewTabs(storageKey, renderFn) {
  document.querySelectorAll(`[data-view-tab-group="${storageKey}"] [data-view-tab]`).forEach(button => {
    button.addEventListener("click", async event => {
      const tab = event.currentTarget.dataset.viewTab;
      state[storageKey] = tab;
      localStorage.setItem(storageKey, JSON.stringify(tab));
      renderFn();
    });
  });
}

function viewTabsHtml(storageKey, activeTab, tabs) {
  return `
    <section class="panel view-tabs-panel">
      <div class="view-tabs" role="tablist" aria-label="Visualizações" data-view-tab-group="${storageKey}">
        ${tabs.map(([key, label]) => `
          <button class="secondary ${activeTab === key ? "active" : ""}" type="button" data-view-tab="${key}">${label}</button>
        `).join("")}
      </div>
    </section>
  `;
}

function viewPaneHtml(tab, activeTab, content) {
  return `<div class="view-pane" data-view-pane="${tab}" ${activeTab === tab ? "" : "hidden"}>${content}</div>`;
}

function enhanceResponsiveTables(container = document) {
  container.querySelectorAll(".table-wrap table").forEach(table => {
    const labels = [...table.querySelectorAll("thead th")].map(cell => cell.textContent.trim());
    if (!labels.length) {
      return;
    }
    table.querySelectorAll("tbody tr").forEach(row => {
      [...row.children].forEach((cell, index) => {
        if (!cell.dataset.label && labels[index]) {
          cell.dataset.label = labels[index];
        }
      });
    });
  });
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

  applyPayloadToState({
    ...appStatePayload(),
    ...data
  });
  recordAudit("backup_importado", file.name || "backup manual");
  return persistState();
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
    localStorage.setItem("lastManualBackupAt", new Date().toISOString());
    showToast("Backup JSON baixado.", "success");
  } finally {
    backupButton.disabled = false;
    backupButton.textContent = originalText;
  }
}

function emptyCleanupPreview() {
  return {
    cash: 0,
    orders: 0,
    menus: 0,
    menuSupermarketCosts: 0,
    menuDates: 0,
    storeSales: 0,
    storeProductQuantities: 0,
    channelReceipts: 0,
    auditLog: 0,
    monthlyClosings: 0,
    weeklyClosings: 0
  };
}

function normalizedCleanupYear(year, { allowCurrent = false } = {}) {
  const target = String(year || "").trim();
  const currentYear = new Date().getFullYear();
  const numberYear = Number(target);

  if (!/^\d{4}$/.test(target) || numberYear < 2000 || numberYear > currentYear || (!allowCurrent && numberYear === currentYear)) {
    return "";
  }

  return target;
}

function yearFromDateKey(value, options = {}) {
  const text = String(value || "").trim();
  if (!/^\d{4}(?:-\d{2}(?:-\d{2})?|T|$)/.test(text)) {
    return "";
  }
  return normalizedCleanupYear(text.slice(0, 4), options);
}

function yearFromMenuKey(key, options = {}) {
  const text = String(key || "").trim();
  if (!/^\d{4}-\d{2}(?:-|$)/.test(text)) {
    return "";
  }
  return normalizedCleanupYear(text.slice(0, 4), options);
}

function cleanupPreview(year) {
  const target = normalizedCleanupYear(year);
  if (!target) {
    return emptyCleanupPreview();
  }

  return {
    cash: state.cash.filter(entry => String(entry.date || "").startsWith(target)).length,
    orders: state.orders.filter(order => yearFromMenuKey(order.menuKey) === target).length,
    menus: Object.keys(state.menus || {}).filter(key => yearFromMenuKey(key) === target).length,
    menuSupermarketCosts: Object.keys(state.menuSupermarketCosts || {}).filter(key => yearFromMenuKey(key) === target).length,
    menuDates: Object.keys(state.menuDates || {}).filter(key => yearFromMenuKey(key) === target).length,
    storeSales: state.storeSales.filter(entry => String(entry.date || "").startsWith(target)).length,
    storeProductQuantities: state.storeProductQuantities.filter(entry => String(entry.month || "").startsWith(target)).length,
    channelReceipts: state.channelReceipts.filter(entry => String(entry.date || "").startsWith(target)).length,
    auditLog: (state.auditLog || []).filter(entry => String(entry.createdAt || "").startsWith(target)).length,
    monthlyClosings: Object.keys(state.monthlyClosings || {}).filter(key => String(key || "").startsWith(target)).length,
    weeklyClosings: Object.keys(state.weeklyClosings || {}).filter(key => String(key || "").startsWith(target)).length
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
    menuSupermarketCosts: Object.keys(state.menuSupermarketCosts || {}).length,
    menuDates: Object.keys(state.menuDates || {}).length,
    storeSales: state.storeSales.length,
    storeProducts: state.storeProducts.length,
    storeProductQuantities: state.storeProductQuantities.length,
    monthlyClosings: Object.keys(state.monthlyClosings || {}).length,
    weeklyClosings: Object.keys(state.weeklyClosings || {}).length,
    auditLog: (state.auditLog || []).length,
    clients: state.clients.length,
    channelReceipts: state.channelReceipts.length,
    pricingIngredients: state.ingredients.length,
    pricingRecipes: state.pricingRecipes.length
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
  const target = normalizedCleanupYear(year);
  if (!target) {
    return 0;
  }

  const scopedPayload = {
    cashEntries: state.cash.filter(entry => String(entry.date || "").startsWith(target)),
    orders: state.orders.filter(order => yearFromMenuKey(order.menuKey) === target),
    weeklyMenusByPeriod: Object.fromEntries(Object.entries(state.menus || {}).filter(([key]) => yearFromMenuKey(key) === target)),
    weeklyMenuSupermarketCostsByPeriod: Object.fromEntries(Object.entries(state.menuSupermarketCosts || {}).filter(([key]) => yearFromMenuKey(key) === target)),
    menuDatesByPeriod: Object.fromEntries(Object.entries(state.menuDates || {}).filter(([key]) => yearFromMenuKey(key) === target)),
    storeSales: state.storeSales.filter(entry => String(entry.date || "").startsWith(target)),
    storeProductQuantities: state.storeProductQuantities.filter(entry => String(entry.month || "").startsWith(target)),
    channelReceipts: state.channelReceipts.filter(entry => String(entry.date || "").startsWith(target)),
    auditLog: (state.auditLog || []).filter(entry => String(entry.createdAt || "").startsWith(target)),
    monthlyClosings: Object.fromEntries(Object.entries(state.monthlyClosings || {}).filter(([key]) => String(key || "").startsWith(target))),
    weeklyClosings: Object.fromEntries(Object.entries(state.weeklyClosings || {}).filter(([key]) => String(key || "").startsWith(target)))
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
        <strong>${escapeHtml(usage.label)}</strong>
        <p>${escapeHtml(usage.message)}</p>
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
              <td>${escapeHtml(table.name)}</td>
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
  const addYear = year => {
    const normalized = normalizedCleanupYear(year);
    if (normalized) {
      years.add(normalized);
    }
  };

  state.cash.forEach(entry => {
    addYear(yearFromDateKey(entry.date));
  });
  state.orders.forEach(order => {
    addYear(yearFromMenuKey(order.menuKey));
  });
  state.storeSales.forEach(entry => {
    addYear(yearFromDateKey(entry.date));
  });
  state.storeProductQuantities.forEach(entry => {
    addYear(yearFromDateKey(entry.month));
  });
  state.channelReceipts.forEach(entry => {
    addYear(yearFromDateKey(entry.date));
  });
  (state.auditLog || []).forEach(entry => {
    addYear(yearFromDateKey(entry.createdAt));
  });
  Object.keys(state.menus || {}).forEach(key => addYear(yearFromMenuKey(key)));
  Object.keys(state.menuSupermarketCosts || {}).forEach(key => addYear(yearFromMenuKey(key)));
  Object.keys(state.monthlyClosings || {}).forEach(key => addYear(yearFromDateKey(key)));
  Object.keys(state.weeklyClosings || {}).forEach(key => addYear(yearFromDateKey(key)));

  return [...years]
    .sort((a, b) => b.localeCompare(a));
}

async function cleanupYear(year) {
  const target = normalizedCleanupYear(year);
  if (!target) {
    showToast("Ano invalido para limpeza.", "warning");
    return null;
  }

  const preview = cleanupPreview(target);

  state.cash = state.cash.filter(entry => !String(entry.date || "").startsWith(target));
  state.orders = state.orders.filter(order => yearFromMenuKey(order.menuKey) !== target);
  state.storeSales = state.storeSales.filter(entry => !String(entry.date || "").startsWith(target));
  state.storeProductQuantities = state.storeProductQuantities.filter(entry => !String(entry.month || "").startsWith(target));
  state.channelReceipts = state.channelReceipts.filter(entry => !String(entry.date || "").startsWith(target));
  state.auditLog = (state.auditLog || []).filter(entry => !String(entry.createdAt || "").startsWith(target));
  state.menus = Object.fromEntries(Object.entries(state.menus || {}).filter(([key]) => yearFromMenuKey(key) !== target));
  state.menuSupermarketCosts = Object.fromEntries(Object.entries(state.menuSupermarketCosts || {}).filter(([key]) => yearFromMenuKey(key) !== target));
  state.menuDates = Object.fromEntries(Object.entries(state.menuDates || {}).filter(([key]) => yearFromMenuKey(key) !== target));
  state.monthlyClosings = Object.fromEntries(Object.entries(state.monthlyClosings || {}).filter(([key]) => !String(key || "").startsWith(target)));
  state.weeklyClosings = Object.fromEntries(Object.entries(state.weeklyClosings || {}).filter(([key]) => !String(key || "").startsWith(target)));

  recordAudit("limpeza_ano", `${target}: ${JSON.stringify(preview)}`);
  const saved = await persistState();
  return saved ? preview : null;
}

function clearLocalStateCache() {
  localStateKeys.forEach(key => localStorage.removeItem(key));
  localStorage.setItem("appDataResetVersion", APP_DATA_RESET_VERSION);
}

async function resetAllData() {
  await downloadBackup();
  if (!confirm("Limpar todo o banco de dados do sistema? Todos os dados do aplicativo serão apagados. Os usuários de acesso e o backup de recuperação serão preservados.")) {
    return false;
  }
  const typed = prompt('Digite "LIMPAR TODO O BANCO" para confirmar.');
  if (typed !== "LIMPAR TODO O BANCO") {
    showToast("Limpeza cancelada", "warning");
    return false;
  }

  const response = await fetch("/api/reset-state", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ confirm: "LIMPAR TODO O BANCO" })
  });
  const result = await response.json();
  if (!response.ok || !result.database || !result.reset) {
    showToast(result.error || "Não foi possível limpar o banco.", "error");
    return false;
  }

  applyPayloadToState(result.state || {});
  clearLocalStateCache();
  persistLocal();
  lastConfirmedPayload = clonePayload(appStatePayload());
  showToast("Banco do sistema limpo. Usuários e backup de recuperação foram preservados.", "success");
  return true;
}

async function resetFinancialData(confirmationText = "") {
  try {
    if (String(confirmationText || "").trim().toUpperCase() !== "REINICIAR FINANCEIRO") {
      showToast('Digite "REINICIAR FINANCEIRO" para confirmar.', "warning");
      return false;
    }
    if (!confirm("Reiniciar somente os dados financeiros? Clientes, pedidos, cardápios, categorias, produtos da loja, motivos e configurações serão preservados.")) {
      return false;
    }
    await downloadBackup();

    const response = await fetch("/api/reset-financial-state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: "REINICIAR FINANCEIRO" })
    });
    const result = await response.json();
    if (!response.ok || !result.database || !result.reset) {
      showToast(result.error || "Não foi possível reiniciar os dados financeiros.", "error");
      return false;
    }

    applyPayloadToState(result.state || {});
    persistLocal();
    lastConfirmedPayload = clonePayload(appStatePayload());
    showToast("Financeiro reiniciado. Cadastros e configurações foram preservados.", "success");
    return true;
  } catch (error) {
    showToast("Falha de conexão ao reiniciar o financeiro. Nenhum dado foi apagado.", "error");
    return false;
  }
}

function cleanupPreviewHtml(year, preview) {
  const target = normalizedCleanupYear(year) || String(year || "").trim();
  const total = Object.values(preview).reduce((sum, value) => sum + value, 0);
  return `
    <div class="summary">
      <div class="metric"><span>Caixa</span><strong>${preview.cash}</strong></div>
      <div class="metric"><span>Pedidos</span><strong>${preview.orders}</strong></div>
      <div class="metric"><span>Menus</span><strong>${preview.menus}</strong></div>
      <div class="metric"><span>Supermercado semanal</span><strong>${preview.menuSupermarketCosts}</strong></div>
      <div class="metric"><span>Datas menu</span><strong>${preview.menuDates}</strong></div>
      <div class="metric"><span>Loja</span><strong>${preview.storeSales}</strong></div>
      <div class="metric"><span>Produtos da loja</span><strong>${preview.storeProductQuantities}</strong></div>
      <div class="metric"><span>Canais</span><strong>${preview.channelReceipts}</strong></div>
      <div class="metric"><span>Auditoria</span><strong>${preview.auditLog}</strong></div>
      <div class="metric"><span>Fechamentos mensais</span><strong>${preview.monthlyClosings}</strong></div>
      <div class="metric"><span>Fechamentos semanais</span><strong>${preview.weeklyClosings}</strong></div>
    </div>
    <p class="muted">${total ? `A limpeza de ${target} removerá ${total} grupo(s)/registro(s) antigos.` : `Não há dados de ${target} para apagar.`}</p>
  `;
}

if (backupButton) {
  backupButton.addEventListener("click", downloadBackup);
}

if (globalNewButton && globalNewDialog) {
  globalNewButton.addEventListener("click", () => globalNewDialog.showModal());
  globalNewClose?.addEventListener("click", () => globalNewDialog.close());
  globalNewDialog.addEventListener("click", event => {
    if (event.target === globalNewDialog) {
      globalNewDialog.close();
    }
  });
}

updateHostingStatus();
updateServerStatus();
updatePersistenceStatus();
setInterval(updateServerStatus, 30000);
setInterval(updatePersistenceStatus, 120000);

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").catch(() => {});
}

function routeName() {
  return location.pathname.replace("/", "") || "home";
}

function setActive(route) {
  const moreRoutes = new Set(["menu-semanal"]);
  navLinks.forEach(link => {
    link.classList.toggle("active", link.dataset.route === route || (link.dataset.route === "mais" && moreRoutes.has(route)));
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

function lockFormSubmission(form, pendingLabel = "Salvando...") {
  if (!form || form.dataset.submitting === "true") {
    return null;
  }
  form.dataset.submitting = "true";
  form.setAttribute("aria-busy", "true");
  const controls = [...form.querySelectorAll('button[type="submit"], input[type="submit"]')]
    .map(control => ({
      control,
      disabled: control.disabled,
      label: control.tagName === "INPUT" ? control.value : control.textContent
    }));
  controls.forEach(({ control }) => {
    control.disabled = true;
    if (control.tagName === "INPUT") {
      control.value = pendingLabel;
    } else {
      control.textContent = pendingLabel;
    }
  });
  return () => {
    delete form.dataset.submitting;
    form.removeAttribute("aria-busy");
    controls.forEach(({ control, disabled, label }) => {
      control.disabled = disabled;
      if (control.tagName === "INPUT") {
        control.value = label;
      } else {
        control.textContent = label;
      }
    });
  };
}

function on(selector, eventName, handler, root = document) {
  const element = root.querySelector(selector);
  if (element) {
    element.addEventListener(eventName, handler);
  }
  return element;
}

function money(value) {
  return brl.format(Number(value || 0));
}

function parseMoneyInput(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  const raw = String(value || "").trim();
  if (!raw) {
    return 0;
  }
  const clean = raw.replace(/[^\d,.-]/g, "");
  const negative = clean.startsWith("-");
  const unsigned = clean.replace(/-/g, "");
  let normalized = unsigned;

  if (unsigned.includes(",")) {
    normalized = unsigned.replace(/\./g, "").replace(",", ".");
  } else {
    const parts = unsigned.split(".");
    if (parts.length === 2) {
      const [whole, fraction] = parts;
      if (fraction.length === 3) {
        normalized = `${whole}${fraction}`;
      } else if (fraction.length > 3) {
        const digits = `${whole}${fraction}`;
        normalized = `${digits.slice(0, -2)}.${digits.slice(-2)}`;
      }
    } else if (parts.length > 2) {
      const last = parts.at(-1);
      normalized = last.length === 2
        ? `${parts.slice(0, -1).join("")}.${last}`
        : parts.join("");
    }
  }

  const parsed = Number(normalized || 0);
  return negative ? -parsed : parsed;
}

function moneyInputValue(value) {
  const amount = Number(value || 0);
  return amount ? money(amount).replace("R$", "").trim() : "";
}

function passwordFieldHtml({ name, autocomplete, placeholder = "", required = false, minlength = "" }) {
  return `
    <div class="password-field">
      <input
        name="${name}"
        type="password"
        autocomplete="${autocomplete}"
        placeholder="${escapeHtml(placeholder)}"
        ${required ? "required" : ""}
        ${minlength ? `minlength="${minlength}"` : ""}
      >
      <button class="secondary password-toggle" type="button" data-password-toggle aria-label="Mostrar senha" title="Mostrar senha">Mostrar</button>
    </div>
  `;
}

function bindPasswordToggles(container = document) {
  container.querySelectorAll("[data-password-toggle]").forEach(button => {
    button.addEventListener("click", () => {
      const input = button.closest(".password-field")?.querySelector("input");
      if (!input) {
        return;
      }
      const showing = input.type === "text";
      input.type = showing ? "password" : "text";
      button.textContent = showing ? "Mostrar" : "Ocultar";
      button.setAttribute("aria-label", showing ? "Mostrar senha" : "Ocultar senha");
      button.title = showing ? "Mostrar senha" : "Ocultar senha";
    });
  });
}

function whatsappUrl(phone, text) {
  const cleanPhone = String(phone || "").replace(/\D/g, "");
  if (!cleanPhone) {
    return "#";
  }
  return `https://wa.me/55${cleanPhone}?text=${encodeURIComponent(text)}`;
}

function isoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function monthKeyFromDate(dateKey) {
  return String(dateKey || "").slice(0, 7);
}

function isMonthClosed(dateKey) {
  const key = monthKeyFromDate(dateKey);
  return Boolean(key && state.monthlyClosings?.[key]?.locked !== false && state.monthlyClosings?.[key]);
}

function weekClosingForDate(dateKey) {
  if (!dateKey) {
    return null;
  }
  const range = weekRangeForDate(dateKey);
  const key = weeklyClosingKey(range.start, range.end);
  return state.weeklyClosings?.[key] || null;
}

function isWeekClosed(dateKey) {
  const closing = weekClosingForDate(dateKey);
  return Boolean(closing && closing.locked !== false);
}

function dailyClosings() {
  if (!state.financialPlanning || typeof state.financialPlanning !== "object") {
    state.financialPlanning = {};
  }
  if (!state.financialPlanning.dailyClosings || typeof state.financialPlanning.dailyClosings !== "object") {
    state.financialPlanning.dailyClosings = {};
  }
  return state.financialPlanning.dailyClosings;
}

function dayClosingForDate(dateKey) {
  return dailyClosings()[String(dateKey || "").slice(0, 10)] || null;
}

function isDayClosed(dateKey) {
  const closing = dayClosingForDate(dateKey);
  return Boolean(closing && closing.locked !== false);
}

function blockClosedPeriod(dateKey, action = "alterar") {
  const key = monthKeyFromDate(dateKey);
  if (isMonthClosed(dateKey)) {
    showToast(`Mês ${formatMonthKeyBr(key)} fechado. Destrave o fechamento antes de ${action}.`, "warning");
    return true;
  }
  if (isWeekClosed(dateKey)) {
    const range = weekRangeForDate(dateKey);
    showToast(`Semana de ${formatIsoDateBr(range.start)} a ${formatIsoDateBr(range.end)} fechada. Destrave antes de ${action}.`, "warning");
    return true;
  }
  if (isDayClosed(dateKey)) {
    showToast(`Dia ${formatIsoDateBr(dateKey)} fechado. Reabra o fechamento do dia antes de ${action}.`, "warning");
    return true;
  }
  return false;
}

function addDays(dateKey, days) {
  const date = new Date(`${dateKey}T00:00:00`);
  date.setDate(date.getDate() + Number(days || 0));
  return isoDate(date);
}

function addMonthsClamped(dateKey, months) {
  const source = new Date(`${dateKey}T12:00:00`);
  const day = source.getDate();
  const target = new Date(source.getFullYear(), source.getMonth() + Number(months || 0), 1, 12);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0, 12).getDate();
  target.setDate(Math.min(day, lastDay));
  return isoDate(target);
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

function archivedCategoryKeys(type) {
  return new Set((state.archivedCashCategories?.[type] || []).map(String));
}

function activeIncomeCategories() {
  const archived = archivedCategoryKeys("income");
  return uniqueCategories([
    ...(state.cashCategories?.income || []),
    ...defaultIncomeCategories
  ])
    .filter(([key]) => !archived.has(key));
}

function activeExpenseCategories() {
  const archived = archivedCategoryKeys("expense");
  return uniqueCategories([
    ...(state.cashCategories?.expense || []),
    ...defaultExpenseCategories
  ])
    .filter(([key]) => !archived.has(key));
}

function allCashCategories() {
  return uniqueCategories([
    ...activeIncomeCategories(),
    ...activeExpenseCategories(),
    ...(state.cashCategories?.income || []),
    ...(state.cashCategories?.expense || []),
    ...defaultIncomeCategories,
    ...defaultExpenseCategories,
    ...legacyCategoryLabels
  ]);
}

function getCashFilter() {
  const today = isoDate(new Date());
  const filter = {
    period: "month",
    date: today,
    month: today.slice(0, 7),
    year: today.slice(0, 4),
    type: "all",
    category: "all",
    cashAccount: "all",
    quick: "",
    search: "",
    ...(state.cashFilter || {})
  };

  if (filter.period === "week" && filter.month) {
    const periodYearMonth = filter.month;
    if (!filter.date.startsWith(periodYearMonth)) {
      filter.date = `${periodYearMonth}-01`;
    }
  }

  if (filter.period === "month" && filter.month) {
    if (!filter.date.startsWith(filter.month)) {
      filter.date = `${filter.month}-01`;
    }
  }

  if (filter.period === "year" && filter.year) {
    if (!filter.date.startsWith(filter.year)) {
      filter.date = `${filter.year}-01-01`;
    }
  }

  return filter;
}

function filterCashEntries(entries, filterOverrides = {}) {
  const currentFilter = { ...getCashFilter(), ...filterOverrides };
  const { period, date, month, year, search, type, category, cashAccount, quick } = currentFilter;
  const query = String(search || "").trim().toLowerCase();
  const searchedEntries = query
    ? entries.filter(entry => [
      entry.description,
      entry.category,
      categoryName(entry.category),
      cashDisplayCategory(entry),
      cashDisplayCategoryName(entry),
      cashAccountLabel(entry.cashAccount, entry.type),
      entry.type === "expense" ? "saída" : "entrada"
    ].some(value => String(value || "").toLowerCase().includes(query)))
    : entries;

  const typedEntries = type && type !== "all"
    ? searchedEntries.filter(entry => (type === "expense" ? entry.type === "expense" : entry.type !== "expense"))
    : searchedEntries;

  const categorizedEntries = category && category !== "all"
    ? typedEntries.filter(entry => {
      const displayCategory = cashDisplayCategory(entry);
      return normalizedCategory(entry.category) === normalizedCategory(category)
        || normalizedCategory(displayCategory) === normalizedCategory(category)
        || slugifyCategory(categoryName(entry.category)) === category
        || slugifyCategory(cashDisplayCategoryName(entry)) === category;
    })
    : typedEntries;

  const accountEntries = cashAccount && cashAccount !== "all"
    ? categorizedEntries.filter(entry => cashAccount === "unassigned"
      ? !normalizedCashAccount(entry.cashAccount, "")
      : normalizedCashAccount(entry.cashAccount, "") === cashAccount)
    : categorizedEntries;

  const quickEntries = quick
    ? accountEntries.filter(entry => {
      if (quick === "pending") {
        return isPendingBill(entry);
      }
      if (quick === "savings") {
        return normalizedCashAccount(entry.cashAccount, "") === "savings"
          || normalizedCategory(entry.category) === "cofrinho"
          || isCashSavingsCoverageEntry(entry)
          || entry.automaticSavingsCoverageReversal
          || String(entry.description || "").toLowerCase().includes("cofrinho");
      }
      if (quick === "withdrawals") {
        return isWithdrawalEntry(entry);
      }
      return true;
    })
    : accountEntries;

  if (!period || period === "all") {
    return quickEntries;
  }

  return quickEntries.filter(entry => {
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

function cashEntriesForSelectedPeriod(entries = state.cash, { includeNonCash = false } = {}) {
  const currentFilter = getCashFilter();
  const { period, date, month, year } = currentFilter;
  const accountedEntries = includeNonCash ? entries : accountingCashEntries(entries);

  if (!period || period === "all") {
    return accountedEntries;
  }

  return accountedEntries.filter(entry => {
    const entryDateKey = cashAccountingDate(entry);
    if (!entryDateKey) {
      return false;
    }
    if (period === "day") {
      return entryDateKey === date;
    }
    if (period === "week") {
      const selected = date ? new Date(`${date}T00:00:00`) : new Date();
      const entryDate = new Date(`${entryDateKey}T00:00:00`);
      return entryDate >= startOfWeek(selected) && entryDate <= endOfWeek(selected);
    }
    if (period === "month") {
      return entryDateKey.startsWith(month || "");
    }
    if (period === "year") {
      return entryDateKey.startsWith(String(year || ""));
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
  return allCashCategories().find(([key]) => key === value)?.[1] || "Outros";
}

function activeExpenseReasons() {
  const archived = new Set((state.archivedExpenseReasons || [])
    .map(name => String(name || "").trim())
    .filter(Boolean));

  return [...new Set((state.expenseReasons || [])
    .map(name => String(name || "").trim())
    .filter(Boolean))]
    .filter(name => !archived.has(name))
    .sort((a, b) => a.localeCompare(b, "pt-BR"));
}

function cashFilterCategoryOptions(selected = "all", type = "all") {
  const normalizedSelected = normalizedCategory(selected || "all");
  let selectedApplied = normalizedSelected === "all";
  const groups = [];

  if (!type || type === "all" || type === "income") {
    groups.push(["Entradas", activeIncomeCategories()]);
  }

  if (!type || type === "all" || type === "expense") {
    groups.push(["Saídas", activeExpenseCategories()]);
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

function cashCategorySummary(entries = [], selectedCategory = "all") {
  const rows = Object.entries(entries.reduce((acc, entry) => {
    const displayCategory = cashDisplayCategory(entry);
    const key = normalizedCategory(displayCategory) || "outros";
    if (!acc[key]) {
      acc[key] = {
        key: displayCategory || "outros",
        label: cashDisplayCategoryName(entry),
        income: 0,
        expenses: 0,
        count: 0
      };
    }

    const amount = Number(entry.amount || 0);
    acc[key].count += 1;
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
    <div class="category-summary" aria-label="Filtrar extrato por categoria">
      ${rows.map(row => {
        const active = normalizedCategory(selectedCategory) === normalizedCategory(row.key);
        const transactionLabel = `${row.count} ${row.count === 1 ? "transação" : "transações"}`;
        return `
        <button
          class="cash-category-summary-card ${active ? "active" : ""}"
          type="button"
          data-cash-summary-category="${escapeHtml(row.key)}"
          aria-pressed="${active}"
          aria-label="${active ? "Remover filtro" : "Ver todas as transações"} de ${escapeHtml(row.label)} (${transactionLabel})"
        >
          <b>${escapeHtml(row.label)}</b>
          <small>Entradas ${money(row.income)} - Saídas ${money(row.expenses)}</small>
          <strong class="${row.balance < 0 ? "negative" : "positive"}">${money(row.balance)}</strong>
          <span class="cash-category-summary-action">${active ? "Mostrando transações" : "Ver transações"}<i aria-hidden="true">→</i></span>
        </button>
      `; }).join("")}
    </div>
  `;
}

function channelReceiptTotal(entry = {}) {
  return channelDefinitions.reduce((sum, [key]) => sum + channelReceiptAmount(entry, key, "net"), 0);
}

function channelReceiptAmount(entry = {}, key, kind = "net") {
  if (key === "cardapioWeb") {
    if (hasCardapioPaymentBreakdown(entry)) {
      if (kind === "gross") {
        return cardapioPaymentGrossTotal(entry);
      }
      if (kind === "fee") {
        return cardapioPaymentFeeTotal(entry);
      }
      return cardapioPaymentNetTotal(entry);
    }
  }
  if (kind === "gross") {
    return Number(entry[`${key}Gross`] ?? entry[key] ?? 0);
  }
  if (kind === "fee") {
    return Number(entry[`${key}Fee`] ?? 0);
  }
  return Number(entry[`${key}Net`] ?? entry[key] ?? 0);
}

function capitalize(value) {
  const text = String(value || "");
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "";
}

function cardapioPaymentDefinition(paymentKey) {
  return cardapioPaymentDefinitions.find(([key]) => key === paymentKey) || null;
}

function cardapioPaymentFeeConfigKey(paymentKey) {
  return cardapioPaymentDefinition(paymentKey)?.[2] || "";
}

function cardapioPaymentFeePercent(paymentKey, config = state.appConfig) {
  const configKey = cardapioPaymentFeeConfigKey(paymentKey);
  const value = Number(config?.[configKey] ?? defaultAppConfig[configKey] ?? 0);
  return Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0;
}

function cardapioPaymentField(paymentKey) {
  return `cardapioWeb${capitalize(paymentKey)}`;
}

function cardapioPaymentGrossAmount(entry = {}, paymentKey) {
  const field = cardapioPaymentField(paymentKey);
  return Number(entry[`${field}Gross`] ?? entry[field] ?? 0);
}

function cardapioPaymentFeeAmount(entry = {}, paymentKey) {
  const field = cardapioPaymentField(paymentKey);
  return Number(entry[`${field}Fee`] ?? 0);
}

function cardapioPaymentNetAmount(entry = {}, paymentKey) {
  const field = cardapioPaymentField(paymentKey);
  return Number(entry[`${field}Net`] ?? entry[field] ?? 0);
}

function cardapioPaymentGrossTotal(entry = {}) {
  return cardapioPaymentDefinitions.reduce((sum, [paymentKey]) => {
    return sum + cardapioPaymentGrossAmount(entry, paymentKey);
  }, 0);
}

function cardapioPaymentFeeTotal(entry = {}) {
  return cardapioPaymentDefinitions.reduce((sum, [paymentKey]) => {
    return sum + cardapioPaymentFeeAmount(entry, paymentKey);
  }, 0);
}

function cardapioPaymentNetTotal(entry = {}) {
  return cardapioPaymentDefinitions.reduce((sum, [paymentKey]) => {
    return sum + cardapioPaymentNetAmount(entry, paymentKey);
  }, 0);
}

function hasCardapioPaymentBreakdown(entry = {}) {
  return cardapioPaymentDefinitions.some(([paymentKey]) => {
    const field = cardapioPaymentField(paymentKey);
    return [field, `${field}Gross`, `${field}Net`].some(property =>
      Object.prototype.hasOwnProperty.call(entry, property)
    );
  });
}

function cardapioPaymentAmount(entry = {}, paymentKey) {
  if (hasCardapioPaymentBreakdown(entry)) {
    return cardapioPaymentNetAmount(entry, paymentKey);
  }
  return paymentKey === "pix" ? channelReceiptAmount(entry, "cardapioWeb", "net") : 0;
}

function cardapioDeliveryFeeAmount(entry = {}) {
  const amount = Number(entry.cardapioWebDeliveryFee || 0);
  return Number.isFinite(amount) ? amount : 0;
}

function cardapioDeliveryFeeTotal(entries = []) {
  return entries.reduce((sum, entry) => sum + cardapioDeliveryFeeAmount(entry), 0);
}

function channelReceiptTotals(entries = []) {
  return entries.reduce((totals, entry) => {
    channelDefinitions.forEach(([key]) => {
      totals[`${key}Gross`] = (totals[`${key}Gross`] || 0) + channelReceiptAmount(entry, key, "gross");
      totals[`${key}Fee`] = (totals[`${key}Fee`] || 0) + channelReceiptAmount(entry, key, "fee");
      totals[`${key}Net`] = (totals[`${key}Net`] || 0) + channelReceiptAmount(entry, key, "net");
    });
    totals.total += channelReceiptTotal(entry);
    return totals;
  }, { total: 0 });
}

function channelFilterDefaults() {
  const today = isoDate(new Date());
  const savedFilter = state.channelFilter || {};
  return {
    period: savedFilter.period || "month",
    date: savedFilter.date || today,
    month: savedFilter.month || today.slice(0, 7)
  };
}

function channelReceiptFilteredEntries() {
  const filter = channelFilterDefaults();
  return [...(state.channelReceipts || [])]
    .filter(entry => {
      const date = String(entry.date || "");
      if (filter.period === "day") {
        return date === filter.date;
      }
      if (filter.period === "week") {
        const start = isoDate(startOfWeek(new Date(`${filter.date}T00:00:00`)));
        const end = isoDate(endOfWeek(new Date(`${filter.date}T00:00:00`)));
        return date >= start && date <= end;
      }
      return date.startsWith(filter.month);
    })
    .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
}

function channelFilterTitle(filter = channelFilterDefaults()) {
  if (filter.period === "day") {
    return formatIsoDateBr(filter.date);
  }
  if (filter.period === "week") {
    const start = isoDate(startOfWeek(new Date(`${filter.date}T00:00:00`)));
    const end = isoDate(endOfWeek(new Date(`${filter.date}T00:00:00`)));
    return `${formatIsoDateBr(start)} a ${formatIsoDateBr(end)}`;
  }
  return formatMonthKeyBr(filter.month);
}

function channelReceiptTable(entries = []) {
  if (!entries.length) {
    return `<p class="muted">Nenhum valor de canal lançado neste período.</p>`;
  }

  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Data</th>
            ${cardapioPaymentDefinitions.map(([, label]) => `<th>${label} (liquido)</th>`).join("")}
            <th>Taxas de entrega</th>
            <th>iFood</th>
            <th>99 Food</th>
            <th>Total</th>
            <th>Observação</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${entries.map(item => `
            <tr>
              <td>${formatIsoDateBr(item.date)}</td>
              ${cardapioPaymentDefinitions.map(([paymentKey]) => `<td>${money(cardapioPaymentAmount(item, paymentKey))}</td>`).join("")}
              <td>${money(cardapioDeliveryFeeAmount(item))}</td>
              <td>${money(channelReceiptAmount(item, "ifood", "net"))}</td>
              <td>${money(channelReceiptAmount(item, "food99", "net"))}</td>
              <td><strong>${money(channelReceiptTotal(item))}</strong></td>
              <td>${escapeHtml(item.notes || "-")}</td>
              <td>
                <div class="table-actions">
                  <button class="secondary table-action" type="button" data-edit-channel-receipt="${item.id || ""}">Editar</button>
                  <button class="danger table-action" type="button" data-delete-channel-receipt="${item.id || ""}">Excluir</button>
                </div>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function channelReceiptsPanel(editing = null) {
  const channelFilter = channelFilterDefaults();
  const filteredEntries = channelReceiptFilteredEntries();
  const totals = channelReceiptTotals(filteredEntries);
  const dateValue = editing?.date || isoDate(new Date());

  return `
    <div class="cash-tab-section channel-receipts-panel">
      <div>
        <h2>Entradas por canal</h2>
        <p class="muted-inline">Controle separado do saldo da conta. Use para acompanhar quanto entrou em cada plataforma por dia.</p>
      </div>
      <form id="channel-receipt-form" class="form-grid single">
        <label>Data
          <input name="date" type="date" value="${dateValue}" required>
        </label>
        <div class="channel-fieldset">
          <strong>Cardápio Web</strong>
          <div class="channel-payment-grid">
            ${cardapioPaymentDefinitions.map(([paymentKey, label]) => `
              <label>${label} (${cardapioPaymentFeePercent(paymentKey)}% taxa)
                <input name="cardapioWeb${capitalize(paymentKey)}" type="text" inputmode="decimal" placeholder="0,00" value="${editing ? moneyInputValue(cardapioPaymentGrossAmount(editing, paymentKey)) : ""}">
                <small>Informe o bruto; a taxa será descontada do valor líquido.</small>
              </label>
            `).join("")}
            <label>Taxas de entrega arrecadadas
              <input name="cardapioWebDeliveryFee" type="text" inputmode="decimal" placeholder="0,00" value="${editing ? moneyInputValue(cardapioDeliveryFeeAmount(editing)) : ""}">
              <small>Somente para registro e conferência. Não entra no Caixa nem no total das vendas.</small>
            </label>
          </div>
        </div>
        ${channelDefinitions.filter(([key]) => key !== "cardapioWeb").map(([key, label]) => `
          <div class="channel-fieldset">
            <strong>${label}</strong>
            <label>Valor diário
              <input name="${key}Net" type="text" inputmode="decimal" placeholder="0,00" value="${editing ? moneyInputValue(channelReceiptAmount(editing, key, "net")) : ""}">
            </label>
          </div>
        `).join("")}
        <label>Observação
          <input name="notes" placeholder="Ex.: repasse, fechamento, conferência" value="${escapeHtml(editing?.notes || "")}">
        </label>
        <div class="actions">
          <button type="submit">${editing ? "Salvar edição" : "Salvar dia"}</button>
          ${editing ? `<button class="secondary" type="button" id="cancel-channel-receipt-edit">Cancelar</button>` : ""}
        </div>
      </form>
      <form id="channel-filter-form" class="filter-bar">
        <label>Filtro
          <select name="period" id="channel-filter-period">
            <option value="day" ${channelFilter.period === "day" ? "selected" : ""}>Dia</option>
            <option value="week" ${channelFilter.period === "week" ? "selected" : ""}>Semana</option>
            <option value="month" ${channelFilter.period === "month" ? "selected" : ""}>Mês</option>
          </select>
        </label>
        <label class="channel-filter-date">Data / semana
          <input name="date" type="date" value="${channelFilter.date}">
        </label>
        <label class="channel-filter-month">Mês
          <input name="month" type="month" value="${channelFilter.month}">
        </label>
        <button type="submit">Aplicar</button>
      </form>
      <div class="summary channel-summary">
        ${channelDefinitions.map(([key, label]) => `
          <div class="metric"><span>${key === "cardapioWeb" ? `${label} líquido` : label}</span><strong>${money(totals[`${key}Net`])}</strong></div>
        `).join("")}
        <div class="metric"><span>Cardápio Web bruto</span><strong>${money(totals.cardapioWebGross)}</strong></div>
        <div class="metric"><span>Taxas de pagamento</span><strong>${money(totals.cardapioWebFee)}</strong></div>
        <div class="metric"><span>Taxas de entrega (conferência)</span><strong>${money(cardapioDeliveryFeeTotal(filteredEntries))}</strong></div>
        <div class="metric"><span>Total</span><strong>${money(totals.total)}</strong></div>
      </div>
      <h3>${channelFilterTitle(channelFilter)}</h3>
      ${channelReceiptTable(filteredEntries)}
    </div>
  `;
}

function bindChannelReceipts(renderFn, editingChannelReceipt = null) {
  const channelReceiptForm = document.querySelector("#channel-receipt-form");
  if (channelReceiptForm) {
    channelReceiptForm.addEventListener("submit", event => {
      event.preventDefault();
      const values = readForm(event.currentTarget);
      const receipt = {
        id: editingChannelReceipt?.id || Date.now(),
        date: values.date,
        notes: String(values.notes || "").trim()
      };
      if (blockClosedPeriod(receipt.date, editingChannelReceipt ? "editar canais" : "lançar canais")) {
        return;
      }
      if (editingChannelReceipt && editingChannelReceipt.date !== receipt.date && blockClosedPeriod(editingChannelReceipt.date, "mover lançamentos de canais")) {
        return;
      }
      const cardapioTotals = cardapioPaymentDefinitions.reduce((totals, [paymentKey]) => {
        const field = `cardapioWeb${capitalize(paymentKey)}`;
        const gross = parseMoneyInput(values[field]);
        const fee = gross * cardapioPaymentFeePercent(paymentKey) / 100;
        const net = gross - fee;
        receipt[field] = net.toFixed(2);
        receipt[`${field}Gross`] = gross.toFixed(2);
        receipt[`${field}Fee`] = fee.toFixed(2);
        receipt[`${field}Net`] = net.toFixed(2);
        totals.gross += gross;
        totals.fee += fee;
        totals.net += net;
        return totals;
      }, { gross: 0, fee: 0, net: 0 });
      receipt.cardapioWebGross = cardapioTotals.gross.toFixed(2);
      receipt.cardapioWebFee = cardapioTotals.fee.toFixed(2);
      receipt.cardapioWebNet = cardapioTotals.net.toFixed(2);
      const cardapioDeliveryFee = parseMoneyInput(values.cardapioWebDeliveryFee);
      receipt.cardapioWebDeliveryFee = cardapioDeliveryFee.toFixed(2);
      ["ifood", "food99"].forEach(key => {
        const amount = parseMoneyInput(values[`${key}Net`]);
        receipt[`${key}Gross`] = amount.toFixed(2);
        receipt[`${key}Fee`] = "0.00";
        receipt[`${key}Net`] = amount.toFixed(2);
      });

      const total = channelReceiptTotal(receipt);
      if (total <= 0 && cardapioDeliveryFee <= 0) {
        showToast("Informe pelo menos um valor de canal.", "error");
        return;
      }

      if (editingChannelReceipt) {
        state.channelReceipts = state.channelReceipts.map(item => String(item.id) === String(editingChannelReceipt.id) ? receipt : item);
        state.editChannelReceiptId = null;
        recordAudit("Canais editados", `${formatIsoDateBr(receipt.date)} - ${money(total)}`);
      } else {
        const existing = state.channelReceipts.find(item => item.date === receipt.date);
        if (existing) {
          receipt.id = existing.id;
          state.channelReceipts = state.channelReceipts.map(item => item.date === receipt.date ? receipt : item);
          recordAudit("Canais atualizados", `${formatIsoDateBr(receipt.date)} - ${money(total)}`);
        } else {
          state.channelReceipts.push(receipt);
          recordAudit("Canais lançados", `${formatIsoDateBr(receipt.date)} - ${money(total)}`);
        }
      }
      persistState();
      renderFn();
    });
  }

  const channelFilterForm = document.querySelector("#channel-filter-form");
  const channelFilterPeriod = document.querySelector("#channel-filter-period");
  if (channelFilterForm && channelFilterPeriod) {
    const updateChannelFilterVisibility = () => {
      channelFilterForm.dataset.period = channelFilterPeriod.value;
    };
    channelFilterPeriod.addEventListener("change", updateChannelFilterVisibility);
    updateChannelFilterVisibility();
    channelFilterForm.addEventListener("submit", event => {
      event.preventDefault();
      state.channelFilter = readForm(event.currentTarget);
      localStorage.setItem("channelFilter", JSON.stringify(state.channelFilter));
      renderFn();
    });
  }

  const cancelChannelReceiptEdit = document.querySelector("#cancel-channel-receipt-edit");
  if (cancelChannelReceiptEdit) {
    cancelChannelReceiptEdit.addEventListener("click", () => {
      state.editChannelReceiptId = null;
      renderFn();
    });
  }

  document.querySelectorAll("[data-edit-channel-receipt]").forEach(button => {
    button.addEventListener("click", event => {
      state.editChannelReceiptId = event.currentTarget.dataset.editChannelReceipt;
      state.storeViewTab = "channels";
      renderFn();
    });
  });

  document.querySelectorAll("[data-delete-channel-receipt]").forEach(button => {
    button.addEventListener("click", event => {
      const id = event.currentTarget.dataset.deleteChannelReceipt;
      const removed = state.channelReceipts.find(item => String(item.id) === String(id));
      if (!removed || !confirm(`Excluir os valores dos canais de ${formatIsoDateBr(removed.date)}?`)) {
        return;
      }
      if (blockClosedPeriod(removed.date, "excluir canais")) {
        return;
      }
      state.channelReceipts = state.channelReceipts.filter(item => String(item.id) !== String(id));
      if (String(state.editChannelReceiptId) === String(id)) {
        state.editChannelReceiptId = null;
      }
      recordAudit("Canais excluídos", `${formatIsoDateBr(removed.date)} - ${money(channelReceiptTotal(removed))}`);
      persistState();
      renderFn();
    });
  });
}

function cashCategoryOptions(type, selected = "") {
  const normalizedSelected = normalizedCategory(selected);
  const options = type === "expense"
    ? activeExpenseCategories()
    : activeIncomeCategories();

  return options.map(([value, label]) => `
    <option value="${value}" ${normalizedSelected === value ? "selected" : ""}>${label}</option>
  `).join("");
}

function isBillCategory(value) {
  const normalized = String(value || "").replace(/^supplier:/, "reason:").toLowerCase();
  if (["ajuste-conta", "conta-socia"].includes(normalized)) {
    return false;
  }
  return normalized === "boleto"
    || normalized === "reason:boleto"
    || normalized === "conta"
    || normalized === "contas"
    || normalized === "reason:conta"
    || normalized === "reason:contas"
    || normalized.includes("boleto")
    || normalized.startsWith("conta-")
    || normalized.startsWith("reason:conta-");
}

function isBillEntry(entry = {}) {
  return entry.type === "expense" && (entry.dueDate || isBillCategory(entry.category));
}

function isPendingBill(entry = {}) {
  return isBillEntry(entry) && !entry.paidAt;
}

function cashAccountingDate(entry = {}) {
  return String(entry.date || "");
}

function accountingCashEntries(entries = state.cash) {
  return entries.filter(entry => entry.cashImpact !== false && !isPendingBill(entry));
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

function cashCategoriesPanel(className = "panel supplier-panel") {
  const editing = state.editCashCategory;
  const editList = editing ? uniqueCategories(state.cashCategories?.[editing.type] || []) : [];
  const editingLabel = editing ? editList.find(([key]) => key === editing.key)?.[1] || "" : "";
  const archivedIncome = uniqueCategories(state.cashCategories?.income || []).filter(([key]) => archivedCategoryKeys("income").has(key));
  const archivedExpense = uniqueCategories(state.cashCategories?.expense || []).filter(([key]) => archivedCategoryKeys("expense").has(key));

  return `
    <section class="${className}">
      <h2>Categorias</h2>
      <p class="muted-inline">Adicione ou remova categorias usadas nos lançamentos. O histórico antigo continua preservado.</p>
      <form id="cash-category-admin-form" class="form-grid single">
        <label>Tipo
          <select name="type" ${editing ? "disabled" : ""}>
            <option value="income" ${editing?.type === "income" ? "selected" : ""}>Entrada</option>
            <option value="expense" ${editing?.type === "expense" ? "selected" : ""}>Saída</option>
          </select>
        </label>
        <label>Nome da categoria
          <input name="label" placeholder="Ex.: Cardápio Web, Mercado, Praso" value="${escapeHtml(editingLabel)}" required>
        </label>
        <div class="actions">
          <button type="submit">${editing ? "Salvar edição" : "Adicionar categoria"}</button>
          ${editing ? `<button class="secondary" type="button" id="cancel-cash-category-edit">Cancelar</button>` : ""}
        </div>
      </form>
      <h3>Entradas</h3>
      <div class="reason-list">
        ${activeIncomeCategories().map(([key, label]) => `
          <span>
            <b>${escapeHtml(label)}</b>
            <button class="secondary table-action" type="button" data-edit-cash-category-type="income" data-edit-cash-category="${key}">Editar</button>
            <button class="danger table-action" type="button" data-delete-cash-category-type="income" data-delete-cash-category="${key}">Excluir</button>
          </span>
        `).join("")}
      </div>
      <h3>Saídas</h3>
      ${activeExpenseCategories().length ? `
        <div class="reason-list">
          ${activeExpenseCategories().map(([key, label]) => `
            <span>
              <b>${escapeHtml(label)}</b>
              <button class="secondary table-action" type="button" data-edit-cash-category-type="expense" data-edit-cash-category="${key}">Editar</button>
              <button class="danger table-action" type="button" data-delete-cash-category-type="expense" data-delete-cash-category="${key}">Excluir</button>
            </span>
          `).join("")}
        </div>
      ` : `<p class="muted">Nenhuma categoria de saída cadastrada.</p>`}
      ${archivedIncome.length || archivedExpense.length ? `
        <h3>Excluídas</h3>
        <div class="reason-list archived-reason-list">
          ${[
            ...archivedIncome.map(([key, label]) => ["income", key, label]),
            ...archivedExpense.map(([key, label]) => ["expense", key, label])
          ].map(([type, key, label]) => `
            <span>
              <b>${escapeHtml(label)}</b>
              <small>${type === "income" ? "Entrada" : "Saída"}</small>
              <button class="secondary table-action" type="button" data-reactivate-cash-category-type="${type}" data-reactivate-cash-category="${key}">Reativar</button>
            </span>
          `).join("")}
        </div>
      ` : ""}
    </section>
  `;
}
function cashTotals(entries = state.cash) {
  return accountingCashEntries(entries).reduce((totals, entry) => {
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

function isAccountAdjustmentEntry(entry = {}) {
  return normalizedCategory(entry.category) === "ajuste-conta"
    || String(entry.id || "").startsWith("account-zero-");
}

function accountAdjustmentEntries(entries = state.cash) {
  return accountingCashEntries(entries).filter(isAccountAdjustmentEntry);
}

function accountAdjustmentTotals(entries = state.cash) {
  return cashTotals(accountAdjustmentEntries(entries));
}

function isPartnerCapitalContributionEntry(entry = {}) {
  return normalizedCategory(entry.category) === "aporte-socia"
    || entry.nonOperationalPartnerContribution === true;
}

function businessCashEntries(entries = state.cash) {
  return accountingCashEntries(entries).filter(
    entry => !isAccountAdjustmentEntry(entry)
      && !isPartnerCashEntry(entry)
      && !isAccountTransferCashEntry(entry)
      && !isPartnerCapitalContributionEntry(entry)
  );
}

function withdrawalSplit(amount) {
  const total = Math.max(0, parseMoneyInput(amount));
  const config = {
    ...defaultAppConfig,
    ...(state.appConfig || {})
  };
  const calculation = calculatePartnerWithdrawalDistribution({
    physicalBalance: total,
    savingsPercent: Number(config.splitSavingsPercent || 0),
    partners: [
      { id: "vanessa", share: Number(config.splitVanessaPercent || 0) },
      { id: "raquel", share: Number(config.splitRaquelPercent || 0) }
    ]
  });
  return {
    total,
    savings: calculation.expectedSavings,
    remaining: calculation.partnerPool,
    vanessa: Number(calculation.partners.find(partner => partner.id === "vanessa")?.expectedRight || 0),
    raquel: Number(calculation.partners.find(partner => partner.id === "raquel")?.expectedRight || 0)
  };
}

function roundedMoneyValue(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function withdrawalDistributionCalculation(
  accountBalance,
  debtVanessa = 0,
  debtRaquel = 0,
  options = {}
) {
  const config = { ...defaultAppConfig, ...(state.appConfig || {}) };
  const openingVanessa = Math.max(0, roundedMoneyValue(parseMoneyInput(debtVanessa)));
  const openingRaquel = Math.max(0, roundedMoneyValue(parseMoneyInput(debtRaquel)));
  const realPaymentVanessa = Math.max(
    0,
    roundedMoneyValue(parseMoneyInput(options.realPaymentVanessa || 0))
  );
  const realPaymentRaquel = Math.max(
    0,
    roundedMoneyValue(parseMoneyInput(options.realPaymentRaquel || 0))
  );
  const result = calculatePartnerWithdrawalDistribution({
    physicalBalance: Math.max(0, roundedMoneyValue(parseMoneyInput(accountBalance))),
    savingsPercent: Number(config.splitSavingsPercent || 0),
    partners: [
      {
        id: "vanessa",
        name: "Vanessa",
        share: Number(config.splitVanessaPercent || 0),
        openingDebt: openingVanessa,
        realPayment: realPaymentVanessa,
        compensation: options.compensationVanessa === undefined
          ? 0
          : Math.max(0, parseMoneyInput(options.compensationVanessa)),
        cashPaid: options.cashPaidVanessa === undefined
          ? null
          : Math.max(0, parseMoneyInput(options.cashPaidVanessa))
      },
      {
        id: "raquel",
        name: "Raquel",
        share: Number(config.splitRaquelPercent || 0),
        openingDebt: openingRaquel,
        realPayment: realPaymentRaquel,
        compensation: options.compensationRaquel === undefined
          ? 0
          : Math.max(0, parseMoneyInput(options.compensationRaquel)),
        cashPaid: options.cashPaidRaquel === undefined
          ? null
          : Math.max(0, parseMoneyInput(options.cashPaidRaquel))
      }
    ]
  });
  const vanessa = result.partners.find(partner => partner.id === "vanessa") || {};
  const raquel = result.partners.find(partner => partner.id === "raquel") || {};
  return {
    physicalBalance: result.physicalBalance,
    cashAvailable: result.cashAvailable,
    distributionBase: result.distributionBase,
    expectedTotal: result.expectedTotal,
    expectedSavings: result.expectedSavings,
    expectedVanessa: Number(vanessa.expectedRight || 0),
    expectedRaquel: Number(raquel.expectedRight || 0),
    debtVanessa: openingVanessa,
    debtRaquel: openingRaquel,
    priorVanessa: openingVanessa,
    priorRaquel: openingRaquel,
    realPaymentVanessa: Number(vanessa.realPayment || 0),
    realPaymentRaquel: Number(raquel.realPayment || 0),
    paidToCashVanessa: Number(vanessa.compensation || 0),
    paidToCashRaquel: Number(raquel.compensation || 0),
    remainingDebtVanessa: Number(vanessa.remainingDebt || 0),
    remainingDebtRaquel: Number(raquel.remainingDebt || 0),
    pendingVanessa: Number(vanessa.pendingDistribution || 0),
    pendingRaquel: Number(raquel.pendingDistribution || 0),
    savings: result.savingsPaid,
    vanessa: Number(vanessa.cashPaid || 0),
    raquel: Number(raquel.cashPaid || 0),
    total: result.cashPaidTotal,
    accountAfterWithdrawal: result.accountAfterWithdrawal,
    partnerCalculation: result
  };
}

function withdrawalSplitFromRaquel(raquelAmount) {
  const raquel = Math.max(0, parseMoneyInput(raquelAmount));
  const config = {
    ...defaultAppConfig,
    ...(state.appConfig || {})
  };
  const savingsPercent = Math.max(0, Number(config.splitSavingsPercent || 0));
  const vanessaPercent = Math.max(0, Number(config.splitVanessaPercent || 0));
  const raquelPercent = Math.max(0, Number(config.splitRaquelPercent || 0));
  const partnersTotal = vanessaPercent + raquelPercent || 100;
  const partnerPoolRate = Math.max(0, 1 - (savingsPercent / 100));

  if (!raquelPercent || !partnerPoolRate) {
    const total = raquel;
    return { total, savings: 0, remaining: total, vanessa: 0, raquel };
  }

  const partnerShareRate = raquelPercent / partnersTotal;
  const total = raquel / (partnerPoolRate * partnerShareRate);
  return withdrawalSplit(total);
}

function accountBalanceUntilDate(dateKey, excludeIds = [], cashAccount = "all") {
  const date = String(dateKey || isoDate(new Date())).slice(0, 10);
  if (cashAccount === "savings") {
    return savingsBalanceUntilDate(date);
  }
  const cycleStart = String(state.financialPlanning?.cycleStartDate || "");
  const ignoredIds = new Set((excludeIds || []).map(id => String(id)));
  const selectedAccount = reconciliationCashAccount(cashAccount);
  const entries = accountingCashEntries(state.cash)
    .filter(entry => !ignoredIds.has(String(entry.id || "")))
    .filter(entry => {
      const entryAccount = normalizedCashAccount(entry.cashAccount, "");
      return selectedAccount === "all" ? entryAccount !== "savings" : entryAccount === selectedAccount;
    })
    .filter(entry => {
      const entryDate = cashAccountingDate(entry);
      return entryDate <= date && (!cycleStart || entryDate >= cycleStart);
    });
  return cashTotals(entries).balance;
}

function accountBalanceBreakdownUntilDate(dateKey, excludeIds = []) {
  const unified = accountBalanceUntilDate(dateKey, excludeIds);
  const pf = accountBalanceUntilDate(dateKey, excludeIds, "pf");
  const pj = accountBalanceUntilDate(dateKey, excludeIds, "pj");
  return {
    unified,
    pf,
    pj,
    unassigned: unified - pf - pj
  };
}

function latestCashEntryForAccount(cashAccount, dateKey) {
  const selectedAccount = normalizedCashAccount(cashAccount, "");
  const date = String(dateKey || isoDate(new Date())).slice(0, 10);
  const cycleStart = String(state.financialPlanning?.cycleStartDate || "");
  return accountingCashEntries(state.cash)
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => normalizedCashAccount(entry.cashAccount, "") === selectedAccount)
    .filter(({ entry }) => {
      const entryDate = cashAccountingDate(entry);
      return entryDate <= date && (!cycleStart || entryDate >= cycleStart);
    })
    .sort((left, right) => (
      cashAccountingDate(right.entry).localeCompare(cashAccountingDate(left.entry))
      || right.index - left.index
    ))[0]?.entry || null;
}

function latestSavingsEntryUntilDate(dateKey) {
  const date = String(dateKey || isoDate(new Date())).slice(0, 10);
  return savingsHistoryRows()
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => String(entry.date || "") <= date)
    .sort((left, right) => (
      String(right.entry.date || "").localeCompare(String(left.entry.date || ""))
      || right.index - left.index
    ))[0]?.entry || null;
}

async function zeroAccountBalanceAtDate(dateKey, cashAccount = "pf") {
  const date = String(dateKey || isoDate(new Date())).slice(0, 10);
  const selectedCashAccount = normalizedCashAccount(cashAccount);
  const balance = Number(accountBalanceUntilDate(date, [], selectedCashAccount) || 0);
  if (Math.abs(balance) < 0.01) {
    showToast("A conta já está zerada.", "success");
    return false;
  }
  if (blockClosedPeriod(date, "zerar conta")) {
    return false;
  }
  const adjustmentType = balance > 0 ? "expense" : "income";
  const adjustmentAmount = Math.abs(balance);
  const actionLabel = adjustmentType === "expense" ? "saída" : "entrada";
  if (!confirm(`Lançar ${actionLabel} de ajuste no valor de ${money(adjustmentAmount)} para zerar a conta?`)) {
    return false;
  }

  state.cash.push({
    id: `account-zero-${Date.now()}`,
    description: "Ajuste para zerar conta",
    date,
    type: adjustmentType,
    category: "ajuste-conta",
    cashAccount: selectedCashAccount,
    amount: adjustmentAmount.toFixed(2)
  });
  state.cashFilter = {
    ...state.cashFilter,
    period: "month",
    date,
    month: date.slice(0, 7),
    year: date.slice(0, 4),
    type: "all",
    category: "all",
    cashAccount: "all",
    search: "",
    manualAll: false
  };
  recordAudit("Conta zerada", `${cashAccountLabel(selectedCashAccount)} - ${actionLabel} ${money(adjustmentAmount)} em ${formatIsoDateBr(date)}`);
  if (!await persistState()) {
    return false;
  }
  showToast("Ajuste lançado. Conta zerada.", "success");
  return true;
}

function reconciliationCalculatedBalance(dateKey, reconciliation = null, cashAccount = reconciliation?.cashAccount || "all") {
  return accountBalanceUntilDate(
    dateKey,
    reconciliation?.adjustmentId ? [reconciliation.adjustmentId] : [],
    reconciliationCashAccount(cashAccount)
  );
}

function dailyClosingPendingItems(dateKey) {
  const date = String(dateKey || isoDate(new Date())).slice(0, 10);
  const cashBills = state.cash
    .filter(isPendingBill)
    .map(entry => ({
      id: entry.id,
      description: entry.description || "Conta do caixa",
      amount: Number(entry.amount || 0),
      dueDate: paymentReminderDate(entry),
      source: "cash"
    }))
    .filter(entry => entry.dueDate && entry.dueDate <= date);
  const plannedAccounts = financialAccounts()
    .filter(account => accountOpenAmount(account) >= 0.01)
    .map(account => ({
      id: account.id,
      description: account.description || "Conta planejada",
      amount: accountOpenAmount(account),
      dueDate: account.dueDate || "",
      source: "account"
    }))
    .filter(entry => entry.dueDate && entry.dueDate <= date);

  return [...cashBills, ...plannedAccounts]
    .sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)));
}

function dailyClosingMetrics(dateKey, realBalanceValue = null) {
  const date = String(dateKey || isoDate(new Date())).slice(0, 10);
  const entries = accountingCashEntries(state.cash)
    .filter(entry => cashAccountingDate(entry) === date);
  const totals = cashTotals(entries);
  const calculatedBalance = accountBalanceUntilDate(date);
  const realBalance = realBalanceValue === null || realBalanceValue === undefined
    ? calculatedBalance
    : Number(realBalanceValue || 0);
  const pendingItems = dailyClosingPendingItems(date);
  const savingsCoverage = entries
    .filter(entry => isCashSavingsCoverageEntry(entry) || entry.automaticSavingsCoverageReversal)
    .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);

  return {
    date,
    entries,
    income: totals.income,
    expenses: totals.expenses,
    periodBalance: totals.balance,
    calculatedBalance,
    realBalance,
    difference: realBalance - calculatedBalance,
    savingsCoverage,
    pendingItems,
    pendingCount: pendingItems.length,
    pendingTotal: pendingItems.reduce((sum, item) => sum + Number(item.amount || 0), 0)
  };
}

function dailyClosingPayload(dateKey, realBalanceValue, notes = "") {
  const metrics = dailyClosingMetrics(dateKey, realBalanceValue);
  return {
    locked: true,
    date: metrics.date,
    closedAt: new Date().toISOString(),
    closedBy: state.currentUser?.name || state.currentUser?.username || "Usuário",
    realBalance: Number(metrics.realBalance || 0).toFixed(2),
    calculatedBalance: Number(metrics.calculatedBalance || 0).toFixed(2),
    difference: Number(metrics.difference || 0).toFixed(2),
    income: Number(metrics.income || 0).toFixed(2),
    expenses: Number(metrics.expenses || 0).toFixed(2),
    periodBalance: Number(metrics.periodBalance || 0).toFixed(2),
    savingsCoverage: Number(metrics.savingsCoverage || 0).toFixed(2),
    pendingCount: metrics.pendingCount,
    pendingTotal: Number(metrics.pendingTotal || 0).toFixed(2),
    cashEntries: metrics.entries.length,
    notes: String(notes || "").trim()
  };
}

function dailyClosingChecklist(metrics, closing = null) {
  const locked = Boolean(closing && closing.locked !== false);
  const backupAt = localStorage.getItem("lastManualBackupAt") || "";
  const backupAgeHours = backupAt
    ? Math.max(0, (Date.now() - new Date(backupAt).getTime()) / 3600000)
    : null;
  const backupOk = backupAgeHours !== null && backupAgeHours <= 26;
  const differenceOk = Math.abs(metrics.difference || 0) < 0.01;
  const savingsDebt = savingsDebtAmount();
  return [
    {
      id: "real-balance",
      label: "Saldo real conferido",
      status: differenceOk ? "ok" : "warning",
      detail: differenceOk
        ? "Saldo real informado bate com o saldo calculado."
        : `Diferença de ${money(metrics.difference)} para ajustar ou justificar.`,
      actionLabel: differenceOk ? "" : "Ajustar na conferência",
      action: "reconciliation"
    },
    {
      id: "savings",
      label: "Cofrinho conferido",
      status: savingsDebt <= 0.009 ? "ok" : "warning",
      detail: savingsDebt <= 0.009
        ? `Cofrinho em dia. Usado hoje: ${money(metrics.savingsCoverage)}.`
        : `Devemos ${money(savingsDebt)} ao cofrinho. Confira antes de fechar.`,
      actionLabel: savingsDebt <= 0.009 ? "" : "Ver cofrinho",
      action: "savings"
    },
    {
      id: "pending",
      label: "Contas e pendências",
      status: metrics.pendingCount ? "warning" : "ok",
      detail: metrics.pendingCount
        ? `${metrics.pendingCount} pendência(s) até o dia, total ${money(metrics.pendingTotal)}.`
        : "Nenhuma conta vencida ou do dia ficou aberta.",
      actionLabel: metrics.pendingCount ? "Ver contas" : "",
      action: "accounts"
    },
    {
      id: "backup",
      label: "Backup recente",
      status: backupOk ? "ok" : "warning",
      detail: backupOk
        ? `Último backup há ${Math.round(backupAgeHours)} hora(s).`
        : "Baixe ou salve um backup antes de encerrar o dia.",
      actionLabel: backupOk ? "" : "Ir para backup",
      action: "backup"
    },
    {
      id: "closing",
      label: "Dia bloqueado para edição",
      status: locked ? "ok" : "warning",
      detail: locked ? "Dia fechado e protegido contra alterações." : "Feche o dia para bloquear mudanças nessa data.",
      actionLabel: "",
      action: ""
    }
  ];
}

function dailyClosingChecklistHtml(metrics, closing = null) {
  const items = dailyClosingChecklist(metrics, closing);
  const readyCount = items.filter(item => item.status === "ok").length;
  const ready = readyCount === items.length;
  return `
    <section class="daily-closing-guide ${ready ? "ready" : "attention"}">
      <div class="daily-closing-guide-head">
        <div>
          <span>Checklist do fechamento</span>
          <h3>${ready ? "Dia pronto" : `${items.length - readyCount} ponto(s) para conferir`}</h3>
        </div>
        <strong>${readyCount}/${items.length}</strong>
      </div>
      <div class="closing-check-list">
        ${items.map(item => `
          <article class="closing-check ${item.status}">
            <span>${item.status === "ok" ? "OK" : "!"}</span>
            <div>
              <b>${escapeHtml(item.label)}</b>
              <small>${escapeHtml(item.detail)}</small>
            </div>
            ${item.actionLabel ? `<button class="secondary table-action" type="button" data-daily-closing-action="${escapeHtml(item.action)}">${escapeHtml(item.actionLabel)}</button>` : ""}
          </article>
        `).join("")}
      </div>
    </section>
  `;
}

function cashAccountSummary(entries = []) {
  const totals = entries.reduce((acc, entry) => {
    const key = normalizedCashAccount(entry.cashAccount, "");
    if (!key) {
      acc.unassigned = acc.unassigned || { label: "Sem conta informada", income: 0, expenses: 0 };
      const target = acc.unassigned;
      if (entry.type === "expense") {
        target.expenses += Number(entry.amount || 0);
      } else {
        target.income += Number(entry.amount || 0);
      }
      return acc;
    }
    acc[key] = acc[key] || { label: key.toUpperCase(), income: 0, expenses: 0 };
    if (entry.type === "expense") {
      acc[key].expenses += Number(entry.amount || 0);
    } else {
      acc[key].income += Number(entry.amount || 0);
    }
    return acc;
  }, {});
  const combined = ["pf", "pj"].reduce((total, key) => {
    const row = totals[key] || {};
    total.income += Number(row.income || 0);
    total.expenses += Number(row.expenses || 0);
    return total;
  }, { label: "Unificado PF + PJ", income: 0, expenses: 0 });
  const rows = [
    combined.income > 0 || combined.expenses > 0 ? combined : null,
    ...["pf", "pj", "unassigned"]
    .map(key => totals[key])
    .filter(Boolean)
    .filter(row => row.income > 0 || row.expenses > 0)
  ].filter(Boolean);

  if (!rows.length) {
    return "";
  }

  return `
    <div class="cash-account-summary">
      ${rows.map(row => `
        <span>
          <small>${escapeHtml(row.label)}</small>
          <b>${money(row.income - row.expenses)}</b>
          <em>Entrou ${money(row.income)} / saiu ${money(row.expenses)}</em>
        </span>
      `).join("")}
    </div>
  `;
}

function dailyClosingPanelHtml(metrics, closing = null) {
  const locked = Boolean(closing && closing.locked !== false);
  const differenceClass = metrics.difference < 0 ? "negative" : "positive";
  const closeButtonLabel = closing && !locked ? "Fechar novamente" : "Fechar dia";

  return `
    <div class="cash-tab-section daily-closing-panel">
      <div class="section-heading">
        <div>
          <h2>Fechamento do dia</h2>
          <p class="muted-inline">Confira entradas, saídas, saldo real, cofrinho e pendências antes de encerrar o dia.</p>
        </div>
      </div>
      ${dailyClosingChecklistHtml(metrics, closing)}
      <form id="daily-closing-form" class="form-grid">
        <label>Data do fechamento
          <input name="date" type="date" value="${metrics.date}" required>
        </label>
        <label>Saldo real da conta
          <input name="realBalance" type="text" inputmode="decimal" placeholder="0,00" value="${moneyInputValue(metrics.realBalance)}" required ${locked ? "readonly" : ""}>
        </label>
        <label>Observação
          <input name="notes" placeholder="Ex.: conferido no banco, caixa ok" value="${escapeHtml(closing?.notes || "")}" ${locked ? "readonly" : ""}>
        </label>
        <div class="actions">
          ${!locked ? `<button type="submit" ${canUser("manageClosings") ? "" : "disabled"}>${closeButtonLabel}</button>` : ""}
          ${locked && canUser("manageClosings") ? `<button class="secondary" type="button" id="reopen-day-closing">Reabrir dia</button>` : ""}
          ${Math.abs(metrics.difference) >= 0.01 ? `<button class="secondary" type="button" id="open-reconciliation-from-closing">Ajustar na conferência</button>` : ""}
        </div>
      </form>
      <div class="summary compact-summary">
        <div class="metric"><span>Entrou hoje</span><strong>${money(metrics.income)}</strong></div>
        <div class="metric"><span>Saiu hoje</span><strong>${money(metrics.expenses)}</strong></div>
        <div class="metric"><span>Saldo calculado</span><strong class="${metrics.calculatedBalance < 0 ? "negative" : "positive"}">${money(metrics.calculatedBalance)}</strong></div>
        <div class="metric"><span>Saldo real informado</span><strong id="day-closing-real">${money(metrics.realBalance)}</strong></div>
        <div class="metric"><span>Diferença</span><strong id="day-closing-difference" class="${differenceClass}">${money(metrics.difference)}</strong></div>
        <div class="metric"><span>Cofrinho usado</span><strong>${money(metrics.savingsCoverage)}</strong></div>
        <div class="metric"><span>Pendências</span><strong>${metrics.pendingCount}</strong><small>${money(metrics.pendingTotal)}</small></div>
        <div class="metric"><span>Lançamentos</span><strong>${metrics.entries.length}</strong></div>
      </div>
      ${metrics.pendingItems.length ? `
        <h3>Pendências até o dia</h3>
        <div class="recent-list compact">
          ${metrics.pendingItems.slice(0, 8).map(item => `
            <span>
              <b>${escapeHtml(item.description)}</b>
              <small>${formatIsoDateBr(item.dueDate)} - ${money(item.amount)}</small>
            </span>
          `).join("")}
        </div>
      ` : `<p class="muted">Nenhuma pendência vencida ou do dia.</p>`}
      ${closing ? `
        <h3>Registro do fechamento</h3>
        <div class="closing-record">
          <span><b>Fechado em</b>${new Date(closing.closedAt).toLocaleString("pt-BR")}</span>
          <span><b>Responsável</b>${escapeHtml(closing.closedBy || "Sistema")}</span>
          <span><b>Status</b>${locked ? "Fechado" : "Reaberto"}</span>
          <span><b>Saldo real</b>${money(closing.realBalance)}</span>
          <span><b>Diferença</b>${money(closing.difference)}</span>
          ${closing.reopenReason ? `<span><b>Motivo da reabertura</b>${escapeHtml(closing.reopenReason)}</span>` : ""}
        </div>
      ` : ""}
    </div>
  `;
}

function weekRangeForDate(dateKey = isoDate(new Date())) {
  const selected = new Date(`${dateKey}T00:00:00`);
  return {
    start: isoDate(startOfWeek(selected)),
    end: isoDate(endOfWeek(selected))
  };
}

function weeklyClosingKey(start, end) {
  return `${start}_${end}`;
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

function cashDisplayCategory(entry = {}) {
  if (isWithdrawalEntry(entry)) {
    const target = withdrawalTarget(entry);
    if (target === "savings") {
      return "cofrinho";
    }
    if (target === "vanessa" || target === "raquel") {
      return target;
    }
  }
  return entry.category;
}

function cashDisplayCategoryName(entry = {}) {
  return categoryName(cashDisplayCategory(entry));
}

function withdrawalGroupKey(entry = {}) {
  const match = String(entry.id || "").match(/^withdrawal-(.+)-(savings|vanessa|raquel)$/);
  if (match) return `withdrawal-${match[1]}`;
  if (entry.withdrawalGroup) return String(entry.withdrawalGroup);
  if (entry.partnerWithdrawalSnapshotId) {
    return `withdrawal-${entry.partnerWithdrawalSnapshotId}`;
  }
  const account = normalizedCashAccount(entry.cashAccount, "unassigned");
  return `legacy-withdrawal-${String(entry.date || "sem-data")}-${account}`;
}

function withdrawalSavingsLoanId(groupKey = "") {
  return `${String(groupKey || "")}-savings-loan`;
}

function withdrawalSavingsLoanEntry(group = {}) {
  const loanId = withdrawalSavingsLoanId(group.key || "");
  return accountingCashEntries(state.cash).find(entry => String(entry.id || "") === loanId) || null;
}

function withdrawalBalanceAdjustmentId(groupKey = "") {
  return `${String(groupKey || "")}-balance-adjustment`;
}

function withdrawalBalanceAdjustmentEntry(group = {}) {
  const adjustmentId = withdrawalBalanceAdjustmentId(group.key || "");
  return accountingCashEntries(state.cash).find(
    entry => String(entry.id || "") === adjustmentId
  ) || null;
}

function cashSavingsCoverageHistoryId(entryId = "") {
  return `savings-coverage-${String(entryId || "")}`;
}

function cashSavingsCoverageReversalHistoryId(entryId = "") {
  return `savings-coverage-reversal-${String(entryId || "")}`;
}

function isCashSavingsCoverageEntry(entry = {}) {
  return Boolean(entry.automaticSavingsCoverage && entry.savingsCoverageFor);
}

function cashSavingsCoverageEntry(entryId = "") {
  return state.cash.find(entry =>
    isCashSavingsCoverageEntry(entry)
    && String(entry.savingsCoverageFor || "") === String(entryId || "")
  ) || null;
}

function removeCashSavingsCoverage(entryId = "") {
  const id = String(entryId || "");
  const historyId = cashSavingsCoverageHistoryId(id);
  const previousCoverage = cashSavingsCoverageEntry(id);
  state.cash = state.cash.filter(entry =>
    !(isCashSavingsCoverageEntry(entry) && String(entry.savingsCoverageFor || "") === id)
  );
  if (previousCoverage || savingsHistoryRows().some(entry => String(entry.id || "") === historyId)) {
    applySavingsHistory(savingsHistoryRows().filter(entry => String(entry.id || "") !== historyId));
  }
  return previousCoverage;
}

function savingsCoverageSourceEntry(historyEntry = {}) {
  const sourceId = String(historyEntry.id || "").replace(/^savings-coverage-/, "");
  if (!sourceId || sourceId === String(historyEntry.id || "")) {
    return null;
  }
  return state.cash.find(entry => String(entry.id || "") === sourceId) || null;
}

function savingsCashAccountSourceEntry(historyEntry = {}) {
  const sourceId = String(historyEntry.cashEntryId || "");
  return sourceId
    ? state.cash.find(entry => String(entry.id || "") === sourceId) || null
    : null;
}

function savingsHistoryDetailHtml(entry = {}) {
  const directCashSource = savingsCashAccountSourceEntry(entry);
  if (directCashSource) {
    return `
      <small>${formatIsoDateBr(entry.date)} - saldo ${money(entry.balance)} - Movimento vinculado ao extrato "${escapeHtml(directCashSource.description || "lançamento")}"</small>
      <span class="linked-action-row">
        <button class="secondary table-action" type="button" data-focus-cash-entry="${escapeHtml(directCashSource.id)}">Ver lançamento</button>
      </span>
    `;
  }
  const source = savingsCoverageSourceEntry(entry);
  if (!source) {
    return `<small>${formatIsoDateBr(entry.date)} - saldo ${money(entry.balance)}${entry.description ? ` - ${escapeHtml(entry.description)}` : ""}</small>`;
  }
  return `
    <small>${formatIsoDateBr(entry.date)} - saldo ${money(entry.balance)} - Cobriu ${money(entry.amount)} da saída "${escapeHtml(source.description || "lançamento")}"</small>
    <span class="linked-action-row">
      <button class="secondary table-action" type="button" data-focus-cash-entry="${escapeHtml(source.id)}">Ver lançamento</button>
    </span>
  `;
}

function savingsMovementKind(entry = {}) {
  const description = String(entry.description || "");
  const search = description.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const source = savingsCoverageSourceEntry(entry);
  const directCashSource = savingsCashAccountSourceEntry(entry);
  if (directCashSource) {
    return {
      title: entry.type === "withdrawal" ? "Saída da reserva" : "Entrada na reserva",
      detail: directCashSource.description || "Lançamento do extrato",
      tone: entry.type === "withdrawal" ? "out" : "in",
      sign: entry.type === "withdrawal" ? "-" : "+",
      group: "cash-account"
    };
  }
  if (source) {
    return {
      title: "Cobertura automática",
      detail: `Cobriu saída: ${source.description || "lançamento"}`,
      tone: "out",
      sign: "-",
      group: "coverage"
    };
  }
  if (search.includes("emprestimo do cofrinho")) {
    return {
      title: "Empréstimo para retirada",
      detail: description || "Cofrinho usado para completar retirada",
      tone: "out",
      sign: "-",
      group: "loan"
    };
  }
  if (search.includes("devolucao")) {
    return {
      title: "Devolução ao cofrinho",
      detail: description,
      tone: "in",
      sign: "+",
      group: "adjustment"
    };
  }
  if (search.includes("ajuste")) {
    return {
      title: "Ajuste do cofrinho",
      detail: description,
      tone: entry.type === "withdrawal" ? "out" : "in",
      sign: entry.type === "withdrawal" ? "-" : "+",
      group: "adjustment"
    };
  }
  if (entry.type === "set") {
    return {
      title: "Saldo informado",
      detail: description || "Conferência manual do saldo",
      tone: "set",
      sign: "",
      group: "set"
    };
  }
  if (entry.type === "withdrawal") {
    return {
      title: "Retirada do cofrinho",
      detail: description || "Saída registrada no cofrinho",
      tone: "out",
      sign: "-",
      group: "withdrawal"
    };
  }
  if (search.includes("retirada - cofrinho")) {
    return {
      title: "Entrada da retirada",
      detail: "Parte da retirada destinada ao cofrinho",
      tone: "in",
      sign: "+",
      group: "deposit"
    };
  }
  return {
    title: "Entrada no cofrinho",
    detail: description || "Entrada registrada no cofrinho",
    tone: "in",
    sign: "+",
    group: "deposit"
  };
}

function savingsTracePanelHtml(rows = [], { current = 0, expected = 0, debt = 0 } = {}) {
  const totals = rows.reduce((summary, entry) => {
    const kind = savingsMovementKind(entry);
    const amount = Number(entry.amount || 0);
    if (kind.group === "coverage") {
      summary.coverage += amount;
    } else if (kind.group === "loan") {
      summary.loans += amount;
    } else if (kind.group === "adjustment" || kind.group === "set") {
      summary.adjustments += amount;
    } else if (entry.type === "withdrawal") {
      summary.withdrawals += amount;
    } else {
      summary.deposits += amount;
    }
    return summary;
  }, { deposits: 0, withdrawals: 0, coverage: 0, loans: 0, adjustments: 0 });
  const timeline = rows.slice(0, 10);
  return `
    <section class="savings-trace-panel">
      <div class="section-heading">
        <div>
          <h3>Extrato inteligente do cofrinho</h3>
          <p class="muted-inline">Mostra de onde veio cada movimento e quanto ficou no saldo depois.</p>
        </div>
      </div>
      <div class="savings-trace-grid">
        <div class="metric"><span>Saldo atual</span><strong>${money(current)}</strong></div>
        <div class="metric"><span>Deveria ter</span><strong>${money(expected)}</strong></div>
        <div class="metric"><span>Devemos ao cofrinho</span><strong class="${debt > 0 ? "negative" : "positive"}">${money(debt)}</strong></div>
        <div class="metric"><span>Entradas normais</span><strong class="positive">${money(totals.deposits)}</strong></div>
        <div class="metric"><span>Cobriu despesas</span><strong class="${totals.coverage > 0 ? "negative" : ""}">${money(totals.coverage)}</strong></div>
        <div class="metric"><span>Empréstimo em retiradas</span><strong class="${totals.loans > 0 ? "negative" : ""}">${money(totals.loans)}</strong></div>
        <div class="metric"><span>Outras retiradas</span><strong class="${totals.withdrawals > 0 ? "negative" : ""}">${money(totals.withdrawals)}</strong></div>
        <div class="metric"><span>Ajustes e devoluções</span><strong>${money(totals.adjustments)}</strong></div>
      </div>
      ${timeline.length ? `
        <div class="savings-timeline">
          ${timeline.map(entry => {
            const kind = savingsMovementKind(entry);
            const source = savingsCoverageSourceEntry(entry);
            return `
              <div class="savings-timeline-row ${kind.tone}">
                <div class="savings-flow-mark">${kind.sign || "="}</div>
                <div class="savings-flow-copy">
                  <strong>${escapeHtml(kind.title)}</strong>
                  <small>${formatIsoDateBr(entry.date)} - ${escapeHtml(kind.detail || "Movimento do cofrinho")}</small>
                  ${source ? `
                    <button class="secondary table-action" type="button" data-focus-cash-entry="${escapeHtml(source.id)}">Ver lançamento</button>
                  ` : ""}
                </div>
                <div class="savings-flow-value">
                  <b class="${kind.tone === "out" ? "negative" : kind.tone === "in" ? "positive" : ""}">${kind.sign}${money(entry.amount)}</b>
                  <small>Saldo ${money(entry.balance)}</small>
                </div>
              </div>
            `;
          }).join("")}
        </div>
      ` : `<p class="muted">Nenhum movimento no cofrinho ainda.</p>`}
    </section>
  `;
}

function withdrawalHistoryGroups(entries = cashEntriesForSelectedPeriod(state.cash, { includeNonCash: true })) {
  const groups = new Map();
  entries.filter(isWithdrawalEntry).forEach(entry => {
    const key = withdrawalGroupKey(entry);
    const group = groups.get(key) || {
      key,
      date: entry.date || "",
      savings: 0,
      vanessa: 0,
      raquel: 0,
      other: 0,
      total: 0,
      distributionBase: 0,
      expectedSavings: 0,
      expectedVanessa: 0,
      expectedRaquel: 0,
      hasExpectedSavings: false,
      hasExpectedVanessa: false,
      hasExpectedRaquel: false,
      accountBalanceBefore: 0,
      hasAccountBalanceBefore: false,
      priorVanessa: 0,
      priorRaquel: 0,
      paidToCashVanessa: 0,
      paidToCashRaquel: 0,
      realPaymentVanessa: 0,
      realPaymentRaquel: 0,
      storedRemainingDebtVanessa: 0,
      storedRemainingDebtRaquel: 0,
      hasPriorVanessa: false,
      hasPriorRaquel: false,
      hasPaidToCashVanessa: false,
      hasPaidToCashRaquel: false,
      hasStoredRemainingDebtVanessa: false,
      hasStoredRemainingDebtRaquel: false,
      partnerWithdrawalSnapshotId: "",
      cashAccount: "",
      mixedCashAccounts: false,
      entries: []
    };
    const entryCashAccount = normalizedCashAccount(entry.cashAccount, "");
    if (entryCashAccount) {
      group.mixedCashAccounts = group.mixedCashAccounts
        || Boolean(group.cashAccount && group.cashAccount !== entryCashAccount);
      group.cashAccount = group.cashAccount || entryCashAccount;
    }
    const target = withdrawalTarget(entry);
    group.partnerWithdrawalSnapshotId = group.partnerWithdrawalSnapshotId
      || String(entry.partnerWithdrawalSnapshotId || "");
    group[target] += Number(entry.amount || 0);
    group.total += Number(entry.amount || 0);
    group.distributionBase = Math.max(group.distributionBase, Number(entry.distributionBase || 0));
    const accountBalanceBefore = Number(entry.accountBalanceBefore);
    if (Number.isFinite(accountBalanceBefore)) {
      group.accountBalanceBefore = Math.max(group.accountBalanceBefore, accountBalanceBefore);
      group.hasAccountBalanceBefore = true;
    }
    const expectedAmount = Number(entry.expectedAmount);
    if (Number.isFinite(expectedAmount) && ["savings", "vanessa", "raquel"].includes(target)) {
      const expectedKey = `expected${target[0].toUpperCase()}${target.slice(1)}`;
      const expectedFlag = `hasExpected${target[0].toUpperCase()}${target.slice(1)}`;
      group[expectedKey] += expectedAmount;
      group[expectedFlag] = true;
    }
    const cashDebtAmount = Number(entry.cashDebtAmount ?? entry.priorWithdrawalAmount);
    if (Number.isFinite(cashDebtAmount) && ["vanessa", "raquel"].includes(target)) {
      const priorKey = `prior${target[0].toUpperCase()}${target.slice(1)}`;
      const priorFlag = `hasPrior${target[0].toUpperCase()}${target.slice(1)}`;
      group[priorKey] += cashDebtAmount;
      group[priorFlag] = true;
    }
    const paidToCashAmount = Number(entry.paidToCashAmount);
    if (Number.isFinite(paidToCashAmount) && ["vanessa", "raquel"].includes(target)) {
      const suffix = `${target[0].toUpperCase()}${target.slice(1)}`;
      group[`paidToCash${suffix}`] += paidToCashAmount;
      group[`hasPaidToCash${suffix}`] = true;
    }
    const realPaymentAmount = Number(entry.realPaymentAmount);
    if (Number.isFinite(realPaymentAmount) && ["vanessa", "raquel"].includes(target)) {
      const suffix = `${target[0].toUpperCase()}${target.slice(1)}`;
      group[`realPayment${suffix}`] += realPaymentAmount;
    }
    const remainingDebtAmount = Number(entry.remainingDebtAmount);
    if (Number.isFinite(remainingDebtAmount) && ["vanessa", "raquel"].includes(target)) {
      const suffix = `${target[0].toUpperCase()}${target.slice(1)}`;
      group[`storedRemainingDebt${suffix}`] += remainingDebtAmount;
      group[`hasStoredRemainingDebt${suffix}`] = true;
    }
    group.entries.push(entry);
    groups.set(key, group);
  });
  return [...groups.values()].map(group => {
    const legacyExpected = withdrawalSplitFromRaquel(group.raquel);
    const expectedSavings = group.hasExpectedSavings ? group.expectedSavings : legacyExpected.savings;
    const expectedVanessa = group.hasExpectedVanessa ? group.expectedVanessa : legacyExpected.vanessa;
    const expectedRaquel = group.hasExpectedRaquel ? group.expectedRaquel : legacyExpected.raquel;
    const expectedTotal = expectedSavings + expectedVanessa + expectedRaquel;
    const inferredPriorVanessa = Math.max(0, expectedVanessa - group.vanessa);
    const inferredPriorRaquel = Math.max(0, expectedRaquel - group.raquel);
    const priorVanessa = group.hasPriorVanessa ? group.priorVanessa : inferredPriorVanessa;
    const priorRaquel = group.hasPriorRaquel ? group.priorRaquel : inferredPriorRaquel;
    const paidToCashVanessa = group.hasPaidToCashVanessa
      ? group.paidToCashVanessa
      : 0;
    const paidToCashRaquel = group.hasPaidToCashRaquel ? group.paidToCashRaquel : 0;
    const netDueVanessa = Math.max(0, expectedVanessa - paidToCashVanessa);
    const netDueRaquel = Math.max(0, expectedRaquel - paidToCashRaquel);
    const pendingVanessa = Math.max(0, netDueVanessa - group.vanessa);
    const pendingRaquel = Math.max(0, netDueRaquel - group.raquel);
    const extraVanessa = Math.max(0, group.vanessa - netDueVanessa);
    const extraRaquel = Math.max(0, group.raquel - netDueRaquel);
    const remainingDebtVanessa = group.hasStoredRemainingDebtVanessa
      ? group.storedRemainingDebtVanessa
      : Math.max(0, priorVanessa - paidToCashVanessa);
    const remainingDebtRaquel = group.hasStoredRemainingDebtRaquel
      ? group.storedRemainingDebtRaquel
      : Math.max(0, priorRaquel - paidToCashRaquel);
    const distributionBase = expectedTotal || group.distributionBase || group.total;
    const accountBalanceBefore = group.hasAccountBalanceBefore
      ? group.accountBalanceBefore
      : Math.max(0, distributionBase - priorVanessa - priorRaquel);
    return {
      ...group,
      distributionBase,
      accountBalanceBefore,
      expectedTotal,
      expectedSavings,
      expectedVanessa,
      expectedRaquel,
      priorVanessa,
      priorRaquel,
      paidToCashVanessa,
      paidToCashRaquel,
      netDueVanessa,
      netDueRaquel,
      pendingVanessa,
      pendingRaquel,
      extraVanessa,
      extraRaquel,
      remainingDebtVanessa,
      remainingDebtRaquel,
      differenceVanessa: paidToCashVanessa,
      differenceRaquel: paidToCashRaquel
    };
  }).sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

function withdrawalEntriesForMonth(monthKey = currentMonthKey()) {
  const month = String(monthKey || currentMonthKey()).slice(0, 7);
  return state.cash.filter(entry => {
    return isWithdrawalEntry(entry) && cashAccountingDate(entry).startsWith(month);
  });
}

function partnerPendingLabel(value) {
  const amount = Math.max(0, Number(value || 0));
  if (amount < 0.01) {
    return "Quitado";
  }
  return `Ainda não retirou ${money(amount)}`;
}

function partnerCashOffsetLabel(value) {
  const amount = Math.max(0, Number(value || 0));
  if (amount < 0.01) {
    return "Sem compensação";
  }
  return `Compensado na retirada ${money(amount)}`;
}

function withdrawalGroupsBetween(start, end) {
  return withdrawalHistoryGroups(state.cash).filter(group => group.date >= start && group.date <= end);
}

function partnerPeriodTotals(groups = []) {
  return groups.reduce((totals, group) => {
    totals.savings += Number(group.savings || 0);
    totals.vanessa += Number(group.vanessa || 0);
    totals.raquel += Number(group.raquel || 0);
    totals.expectedSavings += Number(group.expectedSavings || 0);
    totals.expectedVanessa += Number(group.expectedVanessa || 0);
    totals.expectedRaquel += Number(group.expectedRaquel || 0);
    totals.expectedTotal += Number(group.expectedTotal || 0);
    totals.paidNowTotal += Number(group.total || 0);
    totals.distributionTotal += Number(group.savings || 0)
      + Number(group.vanessa || 0)
      + Number(group.paidToCashVanessa || 0)
      + Number(group.raquel || 0)
      + Number(group.paidToCashRaquel || 0);
    totals.priorVanessa += Number(group.priorVanessa || 0);
    totals.priorRaquel += Number(group.priorRaquel || 0);
    totals.paidToCashVanessa += Number(group.paidToCashVanessa || 0);
    totals.paidToCashRaquel += Number(group.paidToCashRaquel || 0);
    totals.pendingVanessa += Number(group.pendingVanessa || 0);
    totals.pendingRaquel += Number(group.pendingRaquel || 0);
    totals.remainingDebtVanessa += Number(group.remainingDebtVanessa || 0);
    totals.remainingDebtRaquel += Number(group.remainingDebtRaquel || 0);
    totals.differenceVanessa = totals.paidToCashVanessa;
    totals.differenceRaquel = totals.paidToCashRaquel;
    return totals;
  }, {
    savings: 0,
    vanessa: 0,
    raquel: 0,
    expectedSavings: 0,
    expectedVanessa: 0,
    expectedRaquel: 0,
    expectedTotal: 0,
    paidNowTotal: 0,
    distributionTotal: 0,
    priorVanessa: 0,
    priorRaquel: 0,
    paidToCashVanessa: 0,
    paidToCashRaquel: 0,
    pendingVanessa: 0,
    pendingRaquel: 0,
    remainingDebtVanessa: 0,
    remainingDebtRaquel: 0,
    differenceVanessa: 0,
    differenceRaquel: 0
  });
}

function partnerDashboard(referenceDate, monthKey) {
  const selected = new Date(`${referenceDate}T00:00:00`);
  const weekStart = isoDate(startOfWeek(selected));
  const weekEnd = isoDate(endOfWeek(selected));
  const [year, month] = String(monthKey).split("-").map(Number);
  const monthStart = `${monthKey}-01`;
  const monthEnd = isoDate(new Date(year, month, 0));
  const week = partnerPeriodTotals(withdrawalGroupsBetween(weekStart, weekEnd));
  const monthTotals = partnerPeriodTotals(withdrawalGroupsBetween(monthStart, monthEnd));
  const monthEntries = accountingCashEntries(state.cash).filter(entry => {
    const date = cashAccountingDate(entry);
    return date >= monthStart && date <= monthEnd;
  });
  const financial = financialSummary(monthEntries);
  const accumulated = partnerPeriodTotals(withdrawalHistoryGroups(state.cash));
  const today = isoDate(new Date());
  const projectionEnd = today < monthStart ? monthStart : today > monthEnd ? monthEnd : today;
  const elapsedDays = Math.max(1, daysBetweenInclusive(monthStart, projectionEnd));
  const totalDays = daysBetweenInclusive(monthStart, monthEnd);
  const projectedProfit = (financial.profitBeforeWithdrawals / elapsedDays) * totalDays;
  const projectedAvailable = projectedProfit - Number(financial.withdrawals.total || 0);

  return {
    weekStart,
    weekEnd,
    monthStart,
    monthEnd,
    week,
    month: monthTotals,
    monthOperationalProfit: financial.profitBeforeWithdrawals,
    accumulated,
    projection: withdrawalSplit(Math.max(0, projectedAvailable))
  };
}

function withdrawalHistoryHtml(monthKey = currentMonthKey()) {
  const groups = withdrawalHistoryGroups(withdrawalEntriesForMonth(monthKey));
  if (!groups.length) {
    return `<p class="muted">Nenhuma retirada registrada neste mês.</p>`;
  }
  const legacyGroups = groups.filter(group => !group.partnerWithdrawalSnapshotId);
  return `
    ${legacyGroups.length ? `
      <div class="backup-list-state warning-state">
        <strong>${legacyGroups.length} retirada(s) antiga(s) precisam de revisão</strong>
        <span>Esses registros não têm o fechamento detalhado. Use Editar para conferir a base, os direitos e os valores pagos.</span>
      </div>
    ` : ""}
    <div class="withdrawal-history-list">
      ${groups.map(group => `
        <article class="withdrawal-history-card">
          <header>
            <div>
              <strong>${formatIsoDateBr(group.date)}</strong>
              <small>${group.mixedCashAccounts ? "Mais de uma conta" : cashAccountLabel(group.cashAccount)}</small>
            </div>
            <div class="withdrawal-history-cash-total">
              <small>Saiu da conta</small>
              <strong>${money(group.total)}</strong>
            </div>
          </header>
          <div class="withdrawal-history-overview">
            <span><small>Base da divisão</small><strong>${money(group.distributionBase || group.accountBalanceBefore)}</strong></span>
            <span><small>Saldo real usado</small><strong>${money(group.accountBalanceBefore)}</strong></span>
            <span><small>Cofrinho</small><strong>${money(group.savings)}</strong><small>Direito ${money(group.expectedSavings)}</small></span>
          </div>
          <div class="withdrawal-partner-cards">
            ${[["Vanessa", group.expectedVanessa, group.vanessa, group.paidToCashVanessa, group.pendingVanessa], ["Raquel", group.expectedRaquel, group.raquel, group.paidToCashRaquel, group.pendingRaquel]].map(([name, expected, received, compensated, pending]) => `
              <section class="withdrawal-partner-card">
                <h4>${name}</h4>
                <span><small>Direito na divisão</small><strong>${money(expected)}</strong></span>
                <span><small>Recebeu da conta</small><strong>${money(received)}</strong></span>
                <span><small>Dívida compensada</small><strong>${money(compensated)}</strong></span>
                <span><small>Situação</small><strong>${partnerPendingLabel(pending)}</strong></span>
              </section>
            `).join("")}
          </div>
          <footer>
            <small>Conferência: recebido + dívida compensada = direito reconhecido.</small>
            ${group.partnerWithdrawalSnapshotId
              ? `<span class="status-pill">Fechamento salvo</span>`
              : `<button class="secondary table-action" type="button" data-edit-withdrawal="${escapeHtml(group.key)}">Revisar e editar</button>`}
          </footer>
        </article>
      `).join("")}
    </div>
  `;
}

function savingsBalance() {
  return Number(state.financialPlanning?.savings || 0);
}

function savingsExpectedBalance() {
  const saved = state.financialPlanning?.savingsExpectedBalance;
  if (saved !== undefined && saved !== null && String(saved) !== "") {
    return Number(saved || 0);
  }
  return 3995.40;
}

function savingsDebtAmount() {
  return Math.max(0, savingsExpectedBalance() - savingsBalance());
}

function setSavingsExpectedBalance(amount, date = isoDate(new Date())) {
  state.financialPlanning = {
    ...(state.financialPlanning || {}),
    savingsExpectedBalance: Math.max(0, Number(amount || 0)).toFixed(2),
    savingsExpectedUpdatedAt: date || isoDate(new Date())
  };
}

function savingsHistoryRows() {
  return Array.isArray(state.financialPlanning?.savingsHistory)
    ? state.financialPlanning.savingsHistory
    : [];
}

function savingsHistoryId() {
  return `savings-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function recalculateSavingsHistory(rows = savingsHistoryRows()) {
  const normalized = rows
    .filter(Boolean)
    .map((entry, index) => ({
      ...entry,
      id: entry.id || savingsHistoryId(),
      type: ["set", "deposit", "withdrawal"].includes(entry.type) ? entry.type : "deposit",
      __index: index
    }));
  const chronological = [...normalized].sort((left, right) => {
    const dateCompare = String(left.date || "").localeCompare(String(right.date || ""));
    const dayOrderCompare = Number(left.dayOrder || 0) - Number(right.dayOrder || 0);
    return dateCompare || dayOrderCompare || (right.__index - left.__index);
  });
  let balance = 0;
  const recalculated = new Map();
  chronological.forEach(entry => {
    const amount = Math.max(0, Number(entry.amount || 0));
    if (entry.type === "set") {
      balance = amount;
    } else if (entry.type === "withdrawal") {
      balance -= amount;
    } else {
      balance += amount;
    }
    recalculated.set(String(entry.id), {
      ...entry,
      amount: amount.toFixed(2),
      balance: balance.toFixed(2)
    });
  });
  return [...recalculated.values()]
    .sort((left, right) => {
      const dateCompare = String(right.date || "").localeCompare(String(left.date || ""));
      const dayOrderCompare = Number(right.dayOrder || 0) - Number(left.dayOrder || 0);
      return dateCompare || dayOrderCompare || (left.__index - right.__index);
    })
    .map(entry => {
      const cleaned = { ...entry };
      delete cleaned.__index;
      return cleaned;
    });
}

function applySavingsHistory(rows = savingsHistoryRows()) {
  const history = recalculateSavingsHistory(rows);
  const latest = history[0] || null;
  state.financialPlanning = {
    ...(state.financialPlanning || {}),
    savings: latest ? String(latest.balance || "0.00") : "0.00",
    savingsUpdatedAt: latest?.date || "",
    savingsHistory: history
  };
  return Number(state.financialPlanning.savings || 0);
}

function updateSavingsBalance({ amount, date, type, description, id, dayOrder = 0 }) {
  const numericAmount = Number(amount || 0);
  return applySavingsHistory([
    {
      id: id || savingsHistoryId(),
      date: date || isoDate(new Date()),
      type,
      amount: numericAmount.toFixed(2),
      balance: "0.00",
      description: description || "",
      dayOrder
    },
    ...savingsHistoryRows()
  ]);
}

function cashSavingsAccountHistoryId(entryId = "") {
  return `cash-savings-${String(entryId || "")}`;
}

function cashEntryUsesSavingsAccount(entry = {}) {
  return normalizedCashAccount(entry.cashAccount, "") === "savings" && !isPendingBill(entry);
}

function prospectiveSavingsHistoryForCashEntry(entry = {}, replacedEntryId = "") {
  const ignoredIds = new Set([
    cashSavingsAccountHistoryId(replacedEntryId),
    cashSavingsAccountHistoryId(entry.id),
    cashSavingsCoverageHistoryId(replacedEntryId)
  ]);
  const remaining = savingsHistoryRows().filter(row => !ignoredIds.has(String(row.id || "")));
  if (!cashEntryUsesSavingsAccount(entry)) {
    return remaining;
  }
  return [
    {
      id: cashSavingsAccountHistoryId(entry.id),
      cashEntryId: String(entry.id || ""),
      cashAccountMovement: true,
      date: cashAccountingDate(entry),
      type: entry.type === "expense" ? "withdrawal" : "deposit",
      amount: Math.max(0, Number(entry.amount || 0)).toFixed(2),
      balance: "0.00",
      description: `${entry.type === "expense" ? "Saída" : "Entrada"} registrada no extrato: ${entry.description || "lançamento"}`
    },
    ...remaining
  ];
}

function syncSavingsHistoryWithCashEntries() {
  const manualHistory = savingsHistoryRows().filter(entry => !entry.cashAccountMovement);
  const cashHistory = accountingCashEntries(state.cash)
    .filter(cashEntryUsesSavingsAccount)
    .map(entry => ({
      id: cashSavingsAccountHistoryId(entry.id),
      cashEntryId: String(entry.id || ""),
      cashAccountMovement: true,
      date: cashAccountingDate(entry),
      type: entry.type === "expense" ? "withdrawal" : "deposit",
      amount: Math.max(0, Number(entry.amount || 0)).toFixed(2),
      balance: "0.00",
      description: `${entry.type === "expense" ? "Saída" : "Entrada"} registrada no extrato: ${entry.description || "lançamento"}`
    }));
  return applySavingsHistory([...cashHistory, ...manualHistory]);
}

function savingsHistoryLedgerEntries() {
  return savingsHistoryRows()
    .filter(entry => !entry.cashAccountMovement)
    .map(entry => ({
      id: `savings-ledger-${String(entry.id || "")}`,
      savingsHistoryId: String(entry.id || ""),
      savingsLedgerEntry: true,
      date: String(entry.date || ""),
      description: entry.description || (entry.type === "set" ? "Saldo informado do Cofrinho" : "Movimento do Cofrinho"),
      type: entry.type === "withdrawal" ? "expense" : "income",
      category: "cofrinho",
      cashAccount: "savings",
      amount: Number(entry.amount || 0).toFixed(2),
      accountTransferId: String(entry.accountTransferId || entry.transferId || ""),
      transferId: String(entry.transferId || entry.accountTransferId || "")
    }));
}

function partnersHistoryRows() {
  return Array.isArray(state.financialPlanning?.partnersHistory)
    ? state.financialPlanning.partnersHistory
    : [];
}

function partnersRecordForPeriod(periodKey = currentMonthKey()) {
  return partnersHistoryRows().find(entry => entry.periodKey === periodKey) || {
    periodKey,
    vanessa: "",
    raquel: "",
    difference: "",
    notes: "",
    updatedAt: ""
  };
}

function upsertPartnersRecord(record) {
  const rows = partnersHistoryRows().filter(entry => entry.periodKey !== record.periodKey);
  state.financialPlanning = {
    ...(state.financialPlanning || {}),
    partnersHistory: [
      {
        ...record,
        updatedAt: new Date().toISOString()
      },
      ...rows
    ].slice(0, 48)
  };
}

function partnerAccountPartners() {
  return normalizePartnerAccounts(state.partnerAccounts).partners;
}

function partnerAccountMovements() {
  return normalizePartnerAccounts(state.partnerAccounts).movements;
}

function partnerWithdrawalSnapshots() {
  return normalizePartnerAccounts(state.partnerAccounts).withdrawalSnapshots;
}

function partnerAccountName(partnerId) {
  return partnerAccountPartners().find(partner => partner.id === partnerId)?.name || partnerId;
}

function partnerMovementTypeLabel(type) {
  return {
    debit: "Débito",
    payment: "Pagamento recebido",
    withdrawal_compensation: "Compensação na distribuição",
    manual_adjustment: "Ajuste manual"
  }[type] || "Movimentação";
}

function partnerOriginLabel(origin) {
  return {
    pj: "Conta PJ",
    pf: "Conta PF da empresa",
    card: "Cartão da empresa",
    cash: "Dinheiro",
    pix: "Pix/transferência",
    other: "Outro"
  }[origin] || origin || "Não informada";
}

function partnerAccountBalance(partnerId, throughDate = "") {
  return Number(partnerBalances(state.partnerAccounts, throughDate)[partnerId] || 0);
}

function partnerMovementIsConsolidated(movementId) {
  return consolidatedPartnerMovementIds(state.partnerAccounts).has(String(movementId || ""));
}

function partnerAccountCashEntry(movement = {}) {
  return state.cash.find(entry => String(entry.id || "") === String(movement.cashEntryId || ""));
}

function partnerCashCandidateOptions(type, selectedId = "") {
  const expectedType = type === "payment" ? "income" : "expense";
  const rows = accountingCashEntries(state.cash)
    .filter(entry => entry.type === expectedType)
    .filter(entry => !isWithdrawalEntry(entry) && !isAccountAdjustmentEntry(entry))
    .filter(entry => !isAccountTransferCashEntry(entry) && !isPartnerCapitalContributionEntry(entry))
    .filter(entry => !entry.partnerMovementId || String(entry.id) === String(selectedId))
    .sort((left, right) => String(right.date || "").localeCompare(String(left.date || "")));
  return [
    `<option value="">Selecione um lançamento</option>`,
    ...rows.map(entry => `<option value="${escapeHtml(entry.id)}" ${String(entry.id) === String(selectedId) ? "selected" : ""}>${formatIsoDateBr(entry.date)} · ${escapeHtml(entry.description || cashDisplayCategoryName(entry))} · ${money(entry.amount)}</option>`)
  ].join("");
}

function partnerMovementFormHtml(partnerId) {
  const editing = state.editPartnerMovementId
    ? partnerAccountMovements().find(movement => String(movement.id) === String(state.editPartnerMovementId))
    : null;
  const draft = state.partnerMovementDraft || {};
  const selectedPartner = editing?.partnerId || draft.partnerId || partnerId;
  const type = editing?.type || draft.type || "debit";
  const linkedCash = editing ? partnerAccountCashEntry(editing) : null;
  const cashMode = linkedCash
    ? linkedCash.partnerAccountGenerated ? "create" : "link"
    : type === "manual_adjustment" ? "none" : "create";
  const cashAccount = normalizedCashAccount(linkedCash?.cashAccount || "pj");
  const canAdjust = canUser("managePartnerAdjustments");
  return `
    <section class="panel partner-movement-form-panel" id="partner-movement-form-panel">
      <div class="section-heading">
        <div>
          <h2>${editing ? "Editar movimentação" : "Nova movimentação"}</h2>
          <p class="muted-inline">Valores são sempre positivos. O tipo define se o saldo devedor aumenta ou diminui.</p>
        </div>
      </div>
      <form id="partner-movement-form" class="form-grid partner-movement-form">
        <label>Sócia
          <select name="partnerId" required>
            ${partnerAccountPartners().filter(partner => partner.active || partner.id === selectedPartner).map(partner => `<option value="${partner.id}" ${partner.id === selectedPartner ? "selected" : ""}>${escapeHtml(partner.name)}</option>`).join("")}
          </select>
        </label>
        <label>Data
          <input name="date" type="date" value="${editing?.date || isoDate(new Date())}" required>
        </label>
        <label>Tipo
          <select name="type" required>
            <option value="debit" ${type === "debit" ? "selected" : ""}>Débito pessoal</option>
            <option value="payment" ${type === "payment" ? "selected" : ""}>Pagamento recebido</option>
            ${canAdjust ? `<option value="manual_adjustment" ${type === "manual_adjustment" ? "selected" : ""}>Ajuste manual</option>` : ""}
          </select>
        </label>
        <label>Descrição da movimentação
          <input name="description" value="${escapeHtml(editing?.description || "")}" placeholder="Ex.: Uber pessoal ou pagamento via Pix" required>
        </label>
        <label>Valor
          <input name="amount" type="text" inputmode="decimal" value="${moneyInputValue(editing?.amount)}" placeholder="0,00" required>
        </label>
        <label data-partner-origin>Origem
          <select name="origin">
            ${[
              ["pj", "Conta PJ"],
              ["pf", "Conta PF da empresa"],
              ["card", "Cartão da empresa"],
              ["cash", "Dinheiro"],
              ["pix", "Pix/transferência"],
              ["other", "Outro"]
            ].map(([key, label]) => `<option value="${key}" ${key === (editing?.origin || (type === "payment" ? "pix" : "pj")) ? "selected" : ""}>${label}</option>`).join("")}
          </select>
        </label>
        <label data-partner-adjustment-direction>Direção do ajuste
          <select name="direction">
            <option value="increase" ${editing?.direction !== "decrease" ? "selected" : ""}>Aumentar saldo devedor</option>
            <option value="decrease" ${editing?.direction === "decrease" ? "selected" : ""}>Reduzir saldo devedor</option>
          </select>
        </label>
        <label data-partner-cash-mode>Tratamento no fluxo de caixa
          <select name="cashMode">
            <option value="create" ${cashMode === "create" ? "selected" : ""}>Criar lançamento real no caixa</option>
            <option value="link" ${cashMode === "link" ? "selected" : ""}>Vincular lançamento existente</option>
            <option value="none" ${cashMode === "none" ? "selected" : ""}>Sem saída de caixa neste momento</option>
          </select>
        </label>
        <label data-partner-cash-link>Lançamento existente
          <select name="existingCashEntryId">
            ${partnerCashCandidateOptions(type, cashMode === "link" ? editing?.cashEntryId : "")}
          </select>
        </label>
        <label data-partner-cash-account>Conta movimentada
          <select name="cashAccount">${cashAccountOptionsHtml(cashAccount, type === "payment" ? "income" : "expense")}</select>
        </label>
        <label class="wide">Observação
          <textarea name="observation" placeholder="Obrigatória para ajustes manuais">${escapeHtml(editing?.observation || "")}</textarea>
        </label>
        <p class="muted-inline wide partner-cash-explanation">Débito pessoal não vira despesa operacional. Pagamento recebido é entrada real de caixa, mas não é receita.</p>
        <div class="actions wide">
          <button type="submit">${editing ? "Salvar movimentação" : "Registrar movimentação"}</button>
          ${(editing || state.partnerMovementDraft) ? `<button class="secondary" type="button" id="cancel-partner-movement">Cancelar</button>` : ""}
        </div>
      </form>
    </section>
  `;
}

function partnerAccountsPanel() {
  const partners = partnerAccountPartners();
  const balances = partnerBalances(state.partnerAccounts);
  const selectedId = partners.some(partner => partner.id === state.partnerAccountFocus)
    ? state.partnerAccountFocus
    : partners[0]?.id || "";
  state.partnerAccountFocus = selectedId;
  const filter = state.partnerAccountFilter || { start: "", end: "" };
  const selectedPartner = partners.find(partner => partner.id === selectedId);
  const summary = partnerAccountSummary(state.partnerAccounts, selectedId, filter);
  const rows = partnerAccountMovements()
    .filter(movement => movement.partnerId === selectedId)
    .filter(movement => !filter.start || movement.date >= filter.start)
    .filter(movement => !filter.end || movement.date <= filter.end)
    .sort((left, right) => String(right.date || "").localeCompare(String(left.date || "")) || String(right.createdAt || "").localeCompare(String(left.createdAt || "")));
  return `
    <section class="partner-current-accounts" data-partner-current-accounts>
      <div class="section-heading partner-account-heading">
        <div>
          <span class="executive-eyebrow">Financeiro · Sócias</span>
          <h2>Conta-corrente das sócias</h2>
          <p class="muted-inline">Créditos da empresa contra as sócias, separados do resultado operacional e do saldo bancário.</p>
        </div>
      </div>
      <div class="partner-account-cards">
        ${partners.map(partner => `
          <article class="partner-account-card ${partner.id === selectedId ? "active" : ""}">
            <span>Valor a receber</span>
            <h3>${escapeHtml(partner.name)}</h3>
            <strong>${money(balances[partner.id] || 0)}</strong>
            <small>Saldo devedor à empresa</small>
            <div class="actions">
              <button class="secondary table-action" type="button" data-partner-focus="${partner.id}">Ver histórico</button>
              <button class="secondary table-action" type="button" data-new-partner-debit="${partner.id}">+ Novo débito</button>
              <button class="secondary table-action" type="button" data-new-partner-payment="${partner.id}">Registrar pagamento</button>
            </div>
          </article>
        `).join("")}
      </div>
      ${partnerMovementFormHtml(selectedId)}
      <section class="panel partner-history-panel" id="partner-history-panel">
        <div class="section-heading">
          <div>
            <h2>Conta-corrente — ${escapeHtml(selectedPartner?.name || selectedId)}</h2>
            <p class="muted-inline">Histórico individual, com cada débito e crédito preservado.</p>
          </div>
        </div>
        <form id="partner-account-filter" class="filter-bar partner-account-filter">
          <label>De <input name="start" type="date" value="${filter.start || ""}"></label>
          <label>Até <input name="end" type="date" value="${filter.end || ""}"></label>
          <button type="submit" class="secondary">Filtrar</button>
          <button type="button" class="secondary" id="clear-partner-account-filter">Limpar</button>
        </form>
        <div class="summary partner-account-summary">
          <div class="metric"><span>Débitos pessoais acumulados</span><strong>${money(summary.debits)}</strong></div>
          <div class="metric"><span>Pagamentos reais</span><strong>${money(summary.payments)}</strong></div>
          <div class="metric"><span>Compensações em retirada</span><strong>${money(summary.compensations)}</strong></div>
          <div class="metric"><span>Ajustes</span><strong>${money(summary.adjustments)}</strong></div>
          <div class="metric"><span>Saldo atual</span><strong>${money(summary.currentBalance)}</strong></div>
        </div>
        ${rows.length ? `
          <div class="table-wrap report-table">
            <table>
              <thead><tr><th>Data</th><th>Tipo</th><th>Descrição</th><th>Origem</th><th>Valor</th><th>Observação</th><th>Ações</th></tr></thead>
              <tbody>
                ${rows.map(movement => {
                  const effect = partnerMovementEffect(movement);
                  const consolidated = partnerMovementIsConsolidated(movement.id);
                  return `<tr>
                    <td>${formatIsoDateBr(movement.date)}</td>
                    <td>${partnerMovementTypeLabel(movement.type)}</td>
                    <td><strong>${escapeHtml(movement.description)}</strong>${movement.cashEntryId ? `<br><small>Caixa vinculado uma única vez</small>` : movement.type === "withdrawal_compensation" ? `<br><small>Sem entrada bancária</small>` : ""}</td>
                    <td>${escapeHtml(partnerOriginLabel(movement.origin))}</td>
                    <td><strong class="${effect > 0 ? "negative" : "positive"}">${effect > 0 ? "+" : "−"} ${money(Math.abs(effect))}</strong></td>
                    <td>${escapeHtml(movement.observation || "—")}</td>
                    <td>${consolidated
                      ? `<span class="status-pill">Consolidado</span>${canUser("managePartnerAdjustments") ? `<button class="secondary table-action" type="button" data-reverse-partner-movement="${escapeHtml(movement.id)}">Estornar</button>` : ""}`
                      : `<button class="secondary table-action" type="button" data-edit-partner-movement="${escapeHtml(movement.id)}">Editar</button><button class="danger table-action" type="button" data-delete-partner-movement="${escapeHtml(movement.id)}">Excluir</button>`}</td>
                  </tr>`;
                }).join("")}
              </tbody>
            </table>
          </div>
        ` : `<p class="muted">Nenhuma movimentação encontrada neste período.</p>`}
      </section>
      <section class="panel partner-snapshot-panel">
        <h2>Quebras consolidadas</h2>
        <p class="muted-inline">Snapshots preservam caixa real, valores a receber, direitos, compensações e pagamentos usados no fechamento.</p>
        ${partnerWithdrawalSnapshots().length ? `
          <div class="recent-list">
            ${[...partnerWithdrawalSnapshots()].sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 12).map(snapshot => `
              <span><b>${formatIsoDateBr(snapshot.date)} · base ajustada ${money(snapshot.adjustedBase)}</b><small>Caixa real ${money(snapshot.physicalCash)} · reserva ${money(snapshot.companyReserve)} · fechado por ${escapeHtml(snapshot.closedBy || "Sistema")}</small></span>
            `).join("")}
          </div>
        ` : `<p class="muted">Nenhuma quebra nova consolidada neste módulo.</p>`}
      </section>
    </section>
  `;
}

function detachPartnerCashEntry(movement = {}) {
  if (!movement.cashEntryId) return;
  const index = state.cash.findIndex(entry => String(entry.id) === String(movement.cashEntryId));
  if (index < 0) return;
  const entry = state.cash[index];
  if (entry.partnerAccountGenerated) {
    state.cash.splice(index, 1);
    return;
  }
  const original = entry.partnerAccountOriginal || {};
  const restored = { ...entry, ...original };
  delete restored.partnerMovementId;
  delete restored.nonOperationalPartnerAccount;
  delete restored.partnerAccountOriginal;
  delete restored.partnerAccountGenerated;
  state.cash[index] = restored;
}

function partnerCashEntryFromMovement(movement, values, existingEntry = null) {
  const type = movement.type === "payment" ? "income" : "expense";
  const original = existingEntry && !existingEntry.partnerAccountGenerated
    ? existingEntry.partnerAccountOriginal || {
        type: existingEntry.type,
        amount: existingEntry.amount,
        date: existingEntry.date,
        category: existingEntry.category,
        description: existingEntry.description,
        cashAccount: existingEntry.cashAccount
      }
    : undefined;
  return {
    ...(existingEntry || {}),
    id: existingEntry?.id || `partner-cash-${movement.id}`,
    date: movement.date,
    type,
    category: "conta-socia",
    description: `${movement.type === "payment" ? "Pagamento recebido" : "Uso pessoal"} - ${partnerAccountName(movement.partnerId)} - ${movement.description}`,
    amount: Number(movement.amount).toFixed(2),
    cashAccount: normalizedCashAccount(values.cashAccount || existingEntry?.cashAccount || "pj"),
    partnerMovementId: movement.id,
    nonOperationalPartnerAccount: true,
    partnerAccountGenerated: !existingEntry || Boolean(existingEntry.partnerAccountGenerated),
    ...(original ? { partnerAccountOriginal: original } : {})
  };
}

function updatePartnerMovementFormVisibility(form) {
  if (!form) return;
  const type = form.elements.type.value;
  const cashMode = form.elements.cashMode.value;
  const isAdjustment = type === "manual_adjustment";
  form.querySelector("[data-partner-adjustment-direction]").hidden = !isAdjustment;
  form.querySelector("[data-partner-origin]").hidden = isAdjustment;
  form.querySelector("[data-partner-cash-mode]").hidden = isAdjustment;
  form.querySelector("[data-partner-cash-link]").hidden = isAdjustment || cashMode !== "link";
  form.querySelector("[data-partner-cash-account]").hidden = isAdjustment || cashMode !== "create";
  const noCashOption = form.elements.cashMode.querySelector('option[value="none"]');
  noCashOption.disabled = type === "payment";
  if (type === "payment" && cashMode === "none") {
    form.elements.cashMode.value = "create";
    updatePartnerMovementFormVisibility(form);
  }
  form.elements.existingCashEntryId.innerHTML = partnerCashCandidateOptions(
    type,
    form.elements.existingCashEntryId.value
  );
}

function bindPartnerAccounts() {
  document.querySelectorAll("[data-partner-focus]").forEach(button => {
    button.addEventListener("click", event => {
      state.partnerAccountFocus = event.currentTarget.dataset.partnerFocus;
      localStorage.setItem("partnerAccountFocus", JSON.stringify(state.partnerAccountFocus));
      renderFinance();
      setTimeout(() => document.querySelector("#partner-history-panel")?.scrollIntoView({ behavior: "smooth" }), 0);
    });
  });
  const beginDraft = (partnerId, type) => {
    state.partnerAccountFocus = partnerId;
    state.editPartnerMovementId = null;
    state.partnerMovementDraft = { partnerId, type };
    renderFinance();
    setTimeout(() => document.querySelector("#partner-movement-form-panel")?.scrollIntoView({ behavior: "smooth" }), 0);
  };
  document.querySelectorAll("[data-new-partner-debit]").forEach(button => {
    button.addEventListener("click", event => beginDraft(event.currentTarget.dataset.newPartnerDebit, "debit"));
  });
  document.querySelectorAll("[data-new-partner-payment]").forEach(button => {
    button.addEventListener("click", event => beginDraft(event.currentTarget.dataset.newPartnerPayment, "payment"));
  });
  document.querySelectorAll("[data-edit-partner-movement]").forEach(button => {
    button.addEventListener("click", event => {
      state.editPartnerMovementId = event.currentTarget.dataset.editPartnerMovement;
      state.partnerMovementDraft = null;
      renderFinance();
      setTimeout(() => document.querySelector("#partner-movement-form-panel")?.scrollIntoView({ behavior: "smooth" }), 0);
    });
  });
  const form = document.querySelector("#partner-movement-form");
  if (form) {
    updatePartnerMovementFormVisibility(form);
    form.elements.type.addEventListener("change", () => updatePartnerMovementFormVisibility(form));
    form.elements.cashMode.addEventListener("change", () => updatePartnerMovementFormVisibility(form));
    form.addEventListener("submit", async event => {
      event.preventDefault();
      const values = readForm(event.currentTarget);
      const existing = state.editPartnerMovementId
        ? partnerAccountMovements().find(movement => String(movement.id) === String(state.editPartnerMovementId))
        : null;
      if (existing && partnerMovementIsConsolidated(existing.id)) {
        showToast("Movimentação consolidada deve ser estornada.", "error");
        return;
      }
      const amount = Math.max(0, parseMoneyInput(values.amount));
      if (amount <= 0) {
        showToast("Informe um valor maior que zero.", "error");
        return;
      }
      if (values.type === "manual_adjustment" && (!canUser("managePartnerAdjustments") || !String(values.observation || "").trim())) {
        showToast("Ajuste manual exige autorização e observação.", "error");
        return;
      }
      if (values.type === "debit" && !values.origin) {
        showToast("Informe a origem do débito.", "error");
        return;
      }
      if (values.type === "payment" && values.cashMode === "none") {
        showToast("Pagamento recebido precisa de entrada real no caixa.", "error");
        return;
      }
      if (blockClosedPeriod(values.date, existing ? "editar movimentação da sócia" : "registrar movimentação da sócia")) return;
      if (existing && existing.date !== values.date && blockClosedPeriod(existing.date, "editar movimentação da sócia")) return;
      const movement = {
        id: existing?.id || `partner-movement-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        partnerId: values.partnerId,
        date: values.date,
        type: values.type,
        description: String(values.description || "").trim(),
        amount: amount.toFixed(2),
        origin: values.type === "manual_adjustment" ? "" : values.origin,
        observation: String(values.observation || "").trim(),
        direction: values.type === "manual_adjustment" ? values.direction : "",
        cashImpact: values.type === "payment" || (values.type === "debit" && values.cashMode !== "none"),
        createdAt: existing?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: existing?.createdBy || state.currentUser?.name || state.currentUser?.username || "Sistema"
      };
      const projectedBalance = roundedMoneyValue(
        partnerAccountBalance(movement.partnerId)
        - (existing?.partnerId === movement.partnerId ? partnerMovementEffect(existing) : 0)
        + partnerMovementEffect(movement)
      );
      if (projectedBalance < -0.009) {
        showToast("O pagamento ou ajuste não pode deixar o saldo devedor negativo.", "error");
        return;
      }
      if (existing?.cashEntryId) detachPartnerCashEntry(existing);
      if (movement.cashImpact) {
        let cashEntry = null;
        if (values.cashMode === "link") {
          cashEntry = state.cash.find(entry => String(entry.id) === String(values.existingCashEntryId));
          if (!cashEntry) {
            showToast("Selecione o lançamento de caixa existente.", "error");
            return;
          }
        }
        const nextCashEntry = partnerCashEntryFromMovement(movement, values, cashEntry);
        const cashIndex = state.cash.findIndex(entry => String(entry.id) === String(nextCashEntry.id));
        if (cashIndex >= 0) state.cash[cashIndex] = nextCashEntry;
        else state.cash.push(nextCashEntry);
        movement.cashEntryId = nextCashEntry.id;
      } else {
        movement.cashEntryId = "";
      }
      const rows = partnerAccountMovements().filter(row => String(row.id) !== String(movement.id));
      state.partnerAccounts = {
        ...normalizePartnerAccounts(state.partnerAccounts),
        movements: [movement, ...rows]
      };
      recordAudit(existing ? "Movimentação de sócia editada" : "Movimentação de sócia registrada", `${partnerAccountName(movement.partnerId)} · ${partnerMovementTypeLabel(movement.type)} · ${money(amount)} · ${movement.description}`);
      state.partnerAccountFocus = movement.partnerId;
      state.editPartnerMovementId = null;
      state.partnerMovementDraft = null;
      if (await persistState()) {
        showToast("Conta-corrente atualizada.", "success");
        renderFinance();
      }
    });
  }
  document.querySelector("#cancel-partner-movement")?.addEventListener("click", () => {
    state.editPartnerMovementId = null;
    state.partnerMovementDraft = null;
    renderFinance();
  });
  document.querySelectorAll("[data-delete-partner-movement]").forEach(button => {
    button.addEventListener("click", async event => {
      const movement = partnerAccountMovements().find(row => String(row.id) === event.currentTarget.dataset.deletePartnerMovement);
      if (!movement || partnerMovementIsConsolidated(movement.id)) {
        showToast("Movimentação consolidada deve ser estornada.", "error");
        return;
      }
      if (!confirm(`Excluir ${partnerMovementTypeLabel(movement.type).toLowerCase()} de ${money(movement.amount)}?`)) return;
      if (blockClosedPeriod(movement.date, "excluir movimentação da sócia")) return;
      detachPartnerCashEntry(movement);
      state.partnerAccounts = {
        ...normalizePartnerAccounts(state.partnerAccounts),
        movements: partnerAccountMovements().filter(row => String(row.id) !== String(movement.id))
      };
      recordAudit("Movimentação de sócia excluída", `${partnerAccountName(movement.partnerId)} · ${partnerMovementTypeLabel(movement.type)} · ${money(movement.amount)}`);
      if (await persistState()) renderFinance();
    });
  });
  document.querySelectorAll("[data-reverse-partner-movement]").forEach(button => {
    button.addEventListener("click", async event => {
      if (!canUser("managePartnerAdjustments")) return;
      const original = partnerAccountMovements().find(row => String(row.id) === event.currentTarget.dataset.reversePartnerMovement);
      if (!original) return;
      const reason = prompt("Motivo obrigatório do estorno:");
      if (!String(reason || "").trim()) return;
      const date = isoDate(new Date());
      if (blockClosedPeriod(date, "estornar movimentação consolidada")) return;
      const effect = partnerMovementEffect(original);
      const reversal = {
        id: `partner-reversal-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        partnerId: original.partnerId,
        date,
        type: "manual_adjustment",
        direction: effect > 0 ? "decrease" : "increase",
        description: `Estorno de ${original.description}`,
        amount: Math.abs(effect).toFixed(2),
        origin: "",
        observation: String(reason).trim(),
        cashImpact: false,
        reversalOf: original.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: state.currentUser?.name || state.currentUser?.username || "Sistema"
      };
      state.partnerAccounts = {
        ...normalizePartnerAccounts(state.partnerAccounts),
        movements: [reversal, ...partnerAccountMovements()]
      };
      recordAudit("Movimentação de sócia estornada", `${partnerAccountName(original.partnerId)} · ${money(original.amount)} · ${reason}`);
      if (await persistState()) renderFinance();
    });
  });
  document.querySelector("#partner-account-filter")?.addEventListener("submit", event => {
    event.preventDefault();
    state.partnerAccountFilter = readForm(event.currentTarget);
    localStorage.setItem("partnerAccountFilter", JSON.stringify(state.partnerAccountFilter));
    renderFinance();
  });
  document.querySelector("#clear-partner-account-filter")?.addEventListener("click", () => {
    state.partnerAccountFilter = { start: "", end: "" };
    localStorage.setItem("partnerAccountFilter", JSON.stringify(state.partnerAccountFilter));
    renderFinance();
  });
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
    accountAdjustments: {
      income: 0,
      expenses: 0,
      balance: 0,
      entries: []
    },
    withdrawalEntries: []
  };

  accountingCashEntries(cashEntries).forEach(entry => {
    const amount = Number(entry.amount || 0);
    if (isPartnerCashEntry(entry) || isAccountTransferCashEntry(entry) || isPartnerCapitalContributionEntry(entry)) {
      return;
    }
    if (isAccountAdjustmentEntry(entry)) {
      if (entry.type === "expense") {
        summary.accountAdjustments.expenses += amount;
      } else {
        summary.accountAdjustments.income += amount;
      }
      summary.accountAdjustments.balance = summary.accountAdjustments.income - summary.accountAdjustments.expenses;
      summary.accountAdjustments.entries.push(entry);
      return;
    }

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

function withdrawalBreakdownAmounts(withdrawals = {}, control = {}) {
  const receivedNowVanessa = Number(withdrawals.vanessa || 0);
  const receivedNowRaquel = Number(withdrawals.raquel || 0);
  const savings = Number(withdrawals.savings || 0);
  const paidToCashVanessa = Number(control?.paidToCashVanessa ?? control?.differenceVanessa ?? 0);
  const paidToCashRaquel = Number(control?.paidToCashRaquel ?? control?.differenceRaquel ?? 0);
  const vanessa = receivedNowVanessa + paidToCashVanessa;
  const raquel = receivedNowRaquel + paidToCashRaquel;
  return {
    vanessa,
    savings,
    raquel,
    total: vanessa + savings + raquel,
    receivedNowVanessa,
    receivedNowRaquel,
    paidToCashVanessa,
    paidToCashRaquel,
    pendingVanessa: Number(control?.pendingVanessa ?? control?.differenceVanessa ?? 0),
    pendingRaquel: Number(control?.pendingRaquel ?? control?.differenceRaquel ?? 0)
  };
}

function operationalProfitForReport(data = {}) {
  return Number(data.financial?.profitBeforeWithdrawals || 0);
}

function cashWithdrawalsForReport(data = {}) {
  return Number(data.financial?.withdrawals?.total || 0);
}

function debtCompensationForReport(data = {}) {
  return Number(data.partnerWithdrawalControl?.paidToCashVanessa || 0)
    + Number(data.partnerWithdrawalControl?.paidToCashRaquel || 0);
}

function profitDistributionForReport(data = {}) {
  return withdrawalBreakdownAmounts(
    data.financial?.withdrawals || {},
    data.partnerWithdrawalControl
  ).total;
}

function operationalResultForReport(data = {}) {
  return operationalProfitForReport(data) - cashWithdrawalsForReport(data);
}

function withdrawalBreakdownMetrics(withdrawals = {}, className = "metric", control = {}) {
  const amounts = withdrawalBreakdownAmounts(withdrawals, control);
  return `
    <div class="${className}"><span>Vanessa - recebeu da conta</span><strong>${money(amounts.receivedNowVanessa)}</strong></div>
    <div class="${className}"><span>Cofrinho transferido</span><strong>${money(amounts.savings)}</strong></div>
    <div class="${className}"><span>Raquel - recebeu da conta</span><strong>${money(amounts.receivedNowRaquel)}</strong></div>
    ${amounts.paidToCashVanessa > 0 ? `<div class="${className}"><span>Vanessa - dívida compensada</span><strong>${money(amounts.paidToCashVanessa)}</strong></div>` : ""}
    ${amounts.paidToCashRaquel > 0 ? `<div class="${className}"><span>Raquel - dívida compensada</span><strong>${money(amounts.paidToCashRaquel)}</strong></div>` : ""}
  `;
}

function withdrawalBreakdownStatement(withdrawals = {}, control = {}) {
  const amounts = withdrawalBreakdownAmounts(withdrawals, control);
  const cashTotal = Number(withdrawals.total || 0);
  const debtCompensation = Number(amounts.paidToCashVanessa || 0)
    + Number(amounts.paidToCashRaquel || 0);
  return `
    <div class="statement-line"><span>(-) Vanessa recebeu da conta</span><strong>${money(amounts.receivedNowVanessa)}</strong></div>
    <div class="statement-line"><span>(-) Cofrinho transferido</span><strong>${money(amounts.savings)}</strong></div>
    <div class="statement-line"><span>(-) Raquel recebeu da conta</span><strong>${money(amounts.receivedNowRaquel)}</strong></div>
    <div class="statement-line statement-note"><span>Dinheiro que saiu da conta</span><strong>${money(cashTotal)}</strong></div>
    ${debtCompensation > 0 ? `<div class="statement-line statement-note"><span>Dívida compensada (sem saída de caixa)</span><strong>${money(debtCompensation)}</strong></div>` : ""}
  `;
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

function ensureValidReportPeriod() {
  const now = new Date();
  const saved = state.reportPeriod && typeof state.reportPeriod === "object"
    ? state.reportPeriod
    : {};
  const year = Number(saved.year);
  const month = Number(saved.month);
  const week = Number(saved.week);
  state.reportPeriod = {
    ...saved,
    type: ["month", "week", "day"].includes(saved.type) ? saved.type : "month",
    year: Number.isInteger(year) && year >= 2020 && year <= 2100 ? year : now.getFullYear(),
    month: Number.isInteger(month) && month >= 1 && month <= 12 ? month : now.getMonth() + 1,
    week: Number.isInteger(week) && week >= 1 && week <= 5 ? week : 1,
    date: /^\d{4}-\d{2}-\d{2}$/.test(String(saved.date || "")) ? saved.date : isoDate(now),
    start: /^\d{4}-\d{2}-\d{2}$/.test(String(saved.start || "")) ? saved.start : "",
    end: /^\d{4}-\d{2}-\d{2}$/.test(String(saved.end || "")) ? saved.end : "",
    expenseCategory: String(saved.expenseCategory || "all")
  };
  if (state.reportPeriod.type === "week" && (!state.reportPeriod.start || !state.reportPeriod.end)) {
    const fallback = defaultReportWeekRange();
    state.reportPeriod.start = state.reportPeriod.start || fallback.start;
    state.reportPeriod.end = state.reportPeriod.end || fallback.end;
  }
  return state.reportPeriod;
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
  const savedRange = state.menuDates?.[reportWeekKey()] || {};
  const useSelectedRange = state.reportPeriod.type === "week";
  return {
    start: (useSelectedRange ? state.reportPeriod.start : "") || savedRange.start || fallback.start,
    end: (useSelectedRange ? state.reportPeriod.end : "") || savedRange.end || fallback.end
  };
}

function formatIsoDateBr(date) {
  const [year, month, day] = String(date || "").split("-");
  if (!year || !month || !day) {
    return date || "";
  }

  return `${day}/${month}/${year}`;
}

function formatMonthKeyBr(key) {
  const [year, month] = String(key || "").split("-").map(Number);
  if (!year || !month) {
    return key || "";
  }
  return monthYear.format(new Date(year, month - 1, 1));
}

function formatDateTimeBr(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Sem data";
  }
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function relativeHoursLabel(value) {
  const hours = Number(value || 0);
  const rounded = Math.round(Math.max(0, hours));
  if (rounded <= 0) {
    return "há menos de 1 hora";
  }
  return rounded === 1 ? "há 1 hora" : `há ${rounded} horas`;
}

function formatBytesLabel(bytes) {
  const value = Number(bytes || 0);
  const formatter = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
  if (value >= 1024 * 1024) {
    return `${formatter.format(value / (1024 * 1024))} MB`;
  }
  if (value >= 1024) {
    return `${formatter.format(value / 1024)} KB`;
  }
  return `${formatter.format(value)} bytes`;
}

function reportWeekRangeLabel() {
  const { start, end } = reportWeekRange();
  return `${formatIsoDateBr(start)} a ${formatIsoDateBr(end)}`;
}

function reportDate() {
  return state.reportPeriod.date || isoDate(new Date());
}

function reportPeriodBounds(data = reportData()) {
  if (data.type === "day") {
    return { start: data.date, end: data.date };
  }
  if (data.type === "week") {
    return reportWeekRange();
  }
  const [year, month] = String(data.periodKey || currentMonthKey()).split("-").map(Number);
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate = new Date(year, month, 0);
  return { start, end: isoDate(endDate) };
}

function daysBetweenInclusive(start, end) {
  const startDate = new Date(`${start}T00:00:00`);
  const endDate = new Date(`${end}T00:00:00`);
  return Math.max(1, Math.round((endDate - startDate) / 86400000) + 1);
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

function weekOptions(selectedWeek) {
  return [1, 2, 3, 4, 5]
    .map(week => `<option value="${week}" ${week === Number(selectedWeek || 1) ? "selected" : ""}>Semana ${week}</option>`)
    .join("");
}

function currentMonthKey() {
  const period = normalizedGlobalPeriod(state.globalPeriod || state.menuPeriod);
  return `${period.year}-${String(period.month).padStart(2, "0")}`;
}

function normalizedGlobalPeriod(value = {}) {
  const now = new Date();
  const year = Number(value?.year);
  const month = Number(value?.month);
  return {
    year: Number.isInteger(year) && year >= 2020 && year <= 2100 ? year : now.getFullYear(),
    month: Number.isInteger(month) && month >= 1 && month <= 12 ? month : now.getMonth() + 1
  };
}

function applyGlobalPeriodToViews(value, { remember = true, syncReportPeriod = true } = {}) {
  const period = normalizedGlobalPeriod(value);
  const periodKey = `${period.year}-${String(period.month).padStart(2, "0")}`;
  const periodDate = `${periodKey}-01`;

  state.globalPeriod = period;
  state.menuPeriod = { ...period };
  if (syncReportPeriod) {
    state.reportPeriod = {
      ...(state.reportPeriod || {}),
      type: "month",
      year: period.year,
      month: period.month,
      date: periodDate,
      start: "",
      end: ""
    };
  }
  state.cashFilter = {
    ...(state.cashFilter || {}),
    period: "month",
    date: periodDate,
    month: periodKey,
    year: String(period.year),
    quick: "",
    manualAll: false
  };
  state.storeSalesFilter = {
    ...(state.storeSalesFilter || {}),
    period: "month",
    date: periodDate,
    month: periodKey
  };
  state.channelFilter = {
    ...(state.channelFilter || {}),
    period: "month",
    date: periodDate,
    month: periodKey
  };
  state.storeProductMonth = periodKey;

  if (remember) {
    localStorage.setItem("globalPeriod", JSON.stringify(state.globalPeriod));
    localStorage.setItem("menuPeriod", JSON.stringify(state.menuPeriod));
    if (syncReportPeriod) {
      localStorage.setItem("reportPeriod", JSON.stringify(state.reportPeriod));
    }
    localStorage.setItem("cashFilter", JSON.stringify(state.cashFilter));
    localStorage.setItem("storeSalesFilter", JSON.stringify(state.storeSalesFilter));
    localStorage.setItem("channelFilter", JSON.stringify(state.channelFilter));
    localStorage.setItem("storeProductMonth", JSON.stringify(state.storeProductMonth));
  }

  return period;
}

function currentMonthEndDate() {
  const now = new Date();
  return isoDate(new Date(now.getFullYear(), now.getMonth() + 1, 0));
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
    return client.plan === "semanal" && !isOrderPaid(order);
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
  const monthEnd = currentMonthEndDate();

  return state.cash
    .filter(isPendingBill)
    .map(entry => ({
      ...entry,
      reminderDate: paymentReminderDate(entry)
    }))
    .filter(entry => entry.reminderDate && entry.reminderDate <= monthEnd)
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
  const supermarket = monthlySupermarketAllocation(currentMenuPeriodKey());
  if (supermarket.supermarketTotal > 0 && supermarket.totalQuantity > 0) {
    return [];
  }
  return menuItems.filter(item => String(item.dish || "").trim());
}

function homeMetricData() {
  const monthKey = currentMonthKey();
  const currentMenuKey = menuKey(state.menuWeek || 1);
  const menuItems = state.menus[currentMenuKey] || [];
  const weekOrders = state.orders.filter(order => order.menuKey === currentMenuKey);
  const monthOrders = state.orders.filter(order => menuPeriodKeyFromKey(order.menuKey) === monthKey);
  const monthCash = accountingCashEntries(state.cash).filter(entry => cashAccountingDate(entry).startsWith(monthKey));
  const todayKey = isoDate(new Date());
  const todayCash = accountingCashEntries(state.cash).filter(entry => cashAccountingDate(entry) === todayKey);
  const todayOrders = weekOrders.filter(order => String(order.createdAt || "").slice(0, 10) === todayKey);
  const weekStart = isoDate(startOfWeek(new Date()));
  const weekEnd = isoDate(endOfWeek(new Date()));
  const weekCash = accountingCashEntries(state.cash).filter(entry => {
    const date = cashAccountingDate(entry);
    return date >= weekStart && date <= weekEnd;
  });
  const monthBusinessCash = businessCashEntries(monthCash);
  const todayBusinessCash = businessCashEntries(todayCash);
  const weekBusinessCash = businessCashEntries(weekCash);
  const income = monthBusinessCash
    .filter(entry => entry.type !== "expense")
    .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const expenses = monthBusinessCash
    .filter(entry => entry.type === "expense")
    .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const todayIncome = todayBusinessCash
    .filter(entry => entry.type !== "expense")
    .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const todayExpenses = todayBusinessCash
    .filter(entry => entry.type === "expense")
    .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const weekIncome = weekBusinessCash
    .filter(entry => entry.type !== "expense")
    .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const weekExpenses = weekBusinessCash
    .filter(entry => entry.type === "expense")
    .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const recentExpenses = businessCashEntries(state.cash)
    .filter(entry => entry.type === "expense")
    .sort((a, b) => cashAccountingDate(b).localeCompare(cashAccountingDate(a)))
    .slice(0, 3);
  const topMonthExpenses = [...monthBusinessCash]
    .filter(entry => entry.type === "expense" && !isWithdrawalEntry(entry))
    .sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0))
    .slice(0, 5);
  const monthFinancial = financialSummary(monthCash);
  const storeToday = state.storeSales
    .filter(entry => entry.date === todayKey)
    .reduce((sum, entry) => sum + storeSaleUnitQuantity(entry), 0);
  const accountBalances = {
    ...accountBalanceBreakdownUntilDate(todayKey),
    savings: savingsBalanceUntilDate(todayKey)
  };
  const accountBalance = accountBalances.unified;
  const consolidatedBalance = roundedMoneyValue(accountBalance + accountBalances.savings);
  const forecastEnd = addDays(todayKey, 30);
  const accountForecast = financialAccounts()
    .filter(account => accountOpenAmount(account) >= 0.01)
    .filter(account => String(account.dueDate || "") <= forecastEnd)
    .reduce((totals, account) => {
      const kind = account.kind === "receivable" ? "receivable" : "payable";
      const amount = accountOpenAmount(account);
      const cashAccount = normalizedCashAccount(account.cashAccount, "");
      totals.unified[kind] += amount;
      if (totals[cashAccount]) {
        totals[cashAccount][kind] += amount;
      } else {
        totals.unassigned[kind] += amount;
      }
      return totals;
    }, {
      unified: { payable: 0, receivable: 0 },
      pf: { payable: 0, receivable: 0 },
      pj: { payable: 0, receivable: 0 },
      unassigned: { payable: 0, receivable: 0 }
    });
  const projectedBalances30 = Object.fromEntries(
    ["unified", "pf", "pj", "unassigned"].map(cashAccount => [
      cashAccount,
      accountBalances[cashAccount] + accountForecast[cashAccount].receivable - accountForecast[cashAccount].payable
    ])
  );
  projectedBalances30.savings = accountBalances.savings;
  projectedBalances30.consolidated = roundedMoneyValue(
    projectedBalances30.unified + projectedBalances30.savings
  );
  const accountNotifications = financialAccountNotifications(7);
  const budget = budgetSummary(monthKey);

  return {
    balance: income - expenses,
    accountBalance,
    consolidatedBalance,
    accountBalances,
    projectedBalance30: projectedBalances30.consolidated,
    projectedBalances30,
    accountForecast30: accountForecast,
    payable30: accountForecast.unified.payable,
    receivable30: accountForecast.unified.receivable,
    accountNotifications,
    budget,
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

function monthlyBudgets() {
  const value = state.financialPlanning?.monthlyBudgets;
  return value && typeof value === "object" ? value : {};
}

function budgetStatus(monthKey = currentMonthKey()) {
  const budgets = monthlyBudgets()[monthKey] || {};
  const expenses = businessCashEntries(accountingCashEntries(state.cash))
    .filter(entry => entry.type === "expense" && !isWithdrawalEntry(entry))
    .filter(entry => cashAccountingDate(entry).startsWith(monthKey));
  return Object.entries(budgets)
    .map(([category, limit]) => {
      const spent = expenses
        .filter(entry => normalizedCategory(entry.category) === normalizedCategory(category))
        .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
      const numericLimit = Number(limit || 0);
      return {
        category,
        label: categoryName(category),
        limit: numericLimit,
        spent,
        remaining: numericLimit - spent,
        percent: numericLimit > 0 ? (spent / numericLimit) * 100 : 0
      };
    })
    .filter(item => item.limit > 0)
    .sort((a, b) => b.percent - a.percent);
}

function budgetSummary(monthKey = currentMonthKey()) {
  const rows = budgetStatus(monthKey);
  return {
    rows,
    limit: rows.reduce((sum, item) => sum + item.limit, 0),
    spent: rows.reduce((sum, item) => sum + item.spent, 0),
    exceeded: rows.filter(item => item.percent >= 100).length,
    warning: rows.filter(item => item.percent >= 80 && item.percent < 100).length
  };
}

function configuredBackupReminderDays() {
  const days = Number(state.appConfig?.backupReminderDays || defaultAppConfig.backupReminderDays);
  return Number.isFinite(days) ? Math.min(30, Math.max(1, Math.round(days))) : 7;
}

function backupAgeDays(backupAt) {
  if (!backupAt) {
    return null;
  }
  const timestamp = new Date(backupAt).getTime();
  return Number.isFinite(timestamp) ? Math.max(0, Math.floor((Date.now() - timestamp) / 86400000)) : null;
}

function dashboardAccountBreakdown(values = {}) {
  const rows = [
    ["Conta PF", Number(values.pf || 0)],
    ["Conta PJ", Number(values.pj || 0)]
  ];
  if (Object.prototype.hasOwnProperty.call(values, "savings")) {
    rows.push(["Conta Cofrinho", Number(values.savings || 0)]);
  }
  if (Math.abs(Number(values.unassigned || 0)) >= 0.005) {
    rows.push(["Sem conta", Number(values.unassigned || 0)]);
  }
  return `
    <div class="dashboard-account-breakdown">
      ${rows.map(([label, value]) => `
        <span>
          <em>${label}</em>
          <b class="${value < 0 ? "negative" : "positive"}">${money(value)}</b>
        </span>
      `).join("")}
    </div>
  `;
}

function home() {
  showHomeHero();
  setActive("home");
  document.body.classList.add("home-route");
  const globalPeriod = normalizedGlobalPeriod(state.globalPeriod || state.menuPeriod);
  const periodKey = `${globalPeriod.year}-${String(globalPeriod.month).padStart(2, "0")}`;
  const previousKey = previousMonthKeyFromPeriod(periodKey);
  const current = managementDreData(periodKey);
  const previous = managementPeriodMetrics(previousKey);
  const average = managementMovingAverage(periodKey, 3);
  const comparisonRows = managementComparisonRows(periodKey);
  const attentionItems = managementAttentionItems(current, previous, average);
  const comparePrevious = localStorage.getItem("managementComparePrevious") !== "false";
  const comparison = (value, previousValue, options = {}) => comparePrevious
    ? managementDeltaHtml(value, previousValue, options)
    : "";
  const averageLabel = (label, value, kind = "money") => average.monthsUsed
    ? `<small class="management-average">Média ${average.monthsUsed} mês(es): ${managementValueLabel(value, kind)}</small>`
    : `<small class="management-average">Sem histórico para média</small>`;

  app.innerHTML = `
    <div class="executive-home">
      <section class="home-command-grid executive-toolbar" aria-labelledby="global-period-title">
        <div>
          <span class="executive-eyebrow">Visão geral</span>
          <h2 id="global-period-title">Situação da empresa</h2>
          <p>${formatMonthKeyBr(periodKey)}${comparePrevious ? ` comparado com ${formatMonthKeyBr(previousKey)}` : ""}</p>
        </div>
        <form id="global-period-form" class="global-period-form executive-period-form">
          <button class="secondary executive-period-shift" type="button" data-home-period-shift="-1" aria-label="Mês anterior">‹</button>
          <label>
            <span>Período</span>
            <input name="period" type="month" value="${periodKey}" required>
          </label>
          <button class="secondary executive-period-shift" type="button" data-home-period-shift="1" aria-label="Próximo mês">›</button>
          <label class="management-compare-toggle">
            <input name="comparePrevious" type="checkbox" ${comparePrevious ? "checked" : ""}>
            <span>Comparar com mês anterior</span>
          </label>
          <button type="submit">Aplicar <span class="sr-only">em todo o sistema</span></button>
        </form>
      </section>

      <section class="home-overview-band executive-kpi-grid home-dashboard-kpis" aria-label="Indicadores principais">
        <a class="executive-kpi" href="/financeiro" data-home-projection>
          <span>Vendas</span>
          <strong>${money(current.sales)}</strong>
          <small>Lançamentos de venda no Caixa</small>
          ${comparison(current.sales, previous.sales)}
          ${averageLabel("Vendas", average.sales)}
        </a>
        <a class="executive-kpi" href="/financeiro" data-home-budget>
          <span>Compras de insumos</span>
          <strong>${money(current.purchasesProduction)}</strong>
          <small>${current.purchasesSalesPercent.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% das vendas</small>
          ${comparison(current.purchasesProduction, previous.purchasesProduction, { lowerIsBetter: true })}
          ${averageLabel("Compras", average.purchasesProduction)}
        </a>
        <div class="executive-kpi">
          <span>Compras / Vendas</span>
          <strong>${current.purchasesSalesPercent.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%</strong>
          <small>${money(current.purchasesProduction)} em compras</small>
          ${comparison(current.purchasesSalesPercent, previous.purchasesSalesPercent, { lowerIsBetter: true, kind: "percent" })}
          ${averageLabel("Compras / Vendas", average.purchasesSalesPercent, "percent")}
        </div>
        <a class="executive-kpi" href="/menu-semanal?resumo=mes" data-home-volume>
          <span>Cumbucas vendidas</span>
          <strong>${current.bowls.toLocaleString("pt-BR")}</strong>
          <small>Menu ${current.menuBowls} + Loja ${current.storeBowls}</small>
          ${comparison(current.bowls, previous.bowls)}
          ${averageLabel("Cumbucas", average.bowls, "count")}
        </a>
        <a class="executive-kpi" href="/financeiro" data-home-cost-per-bowl>
          <span>Compras por cumbuca</span>
          <strong>${money(current.purchasesPerBowl)}</strong>
          <small title="Compras de insumos do período divididas pelas cumbucas vendidas. Não representa CMV contábil porque não considera estoque inicial e final.">Compras de insumos ÷ cumbucas</small>
          ${comparison(current.purchasesPerBowl, previous.purchasesPerBowl, { lowerIsBetter: true })}
          ${averageLabel("Compras por cumbuca", average.purchasesPerBowl)}
        </a>
        <a class="executive-kpi" href="/relatorios" data-home-priorities>
          <span>Lucro operacional</span>
          <strong class="${current.operationalProfit < 0 ? "negative" : "positive"}">${money(current.operationalProfit)}</strong>
          <small>Entradas operacionais − despesas operacionais</small>
          ${comparison(current.operationalProfit, previous.operationalProfit)}
        </a>
      </section>

      <section class="panel executive-attention" data-home-priorities>
        <div class="executive-card-heading">
          <div>
            <span class="executive-eyebrow">Leitura automática</span>
            <h2>O que precisa da sua atenção</h2>
          </div>
          <a href="/alertas">Ver todos os alertas</a>
        </div>
        <div class="executive-attention-grid">
          ${attentionItems.length ? attentionItems.map(item => `
            <article class="${item.tone === "positive" ? "good" : "warning"}">
              <span>${item.tone === "positive" ? "Melhoria" : "Atenção"}</span>
              <strong>${escapeHtml(item.title)}</strong>
              <small>${escapeHtml(item.value)} · ${escapeHtml(item.reference)}</small>
              <p>${escapeHtml(item.detail)}</p>
            </article>
          `).join("") : `
            <article class="good management-all-clear">
              <span>Leitura do período</span>
              <strong>Nenhuma variação relevante encontrada</strong>
              <small>Comparação com ${formatMonthKeyBr(previousKey)} e média disponível.</small>
              <p>Continue acompanhando vendas, compras e produção.</p>
            </article>
          `}
        </div>
      </section>

      <section class="panel executive-result-card">
        ${managementStatementHtml(current, { includeHeading: true })}
      </section>

      <section class="panel executive-production management-comparison-panel">
        <div class="executive-card-heading">
          <div>
            <span class="executive-eyebrow">Evolução mensal</span>
            <h2>Comparação com mês anterior</h2>
          </div>
          <span>${formatMonthKeyBr(periodKey)} × ${formatMonthKeyBr(previousKey)}</span>
        </div>
        <div class="management-comparison-grid">
          ${comparisonRows.map(row => {
            const improved = row.lowerIsBetter ? row.delta < 0 : row.delta > 0;
            const tone = Math.abs(row.delta) < 0.005 ? "neutral" : improved ? "positive" : "warning";
            return `
              <article class="${tone}">
                <span>${row.label}</span>
                <strong>${managementComparisonValue(row, row.current)}</strong>
                <small>Anterior: ${managementComparisonValue(row, row.previous)}</small>
                <b>${managementComparisonDelta(row)}${row.kind !== "percent" && Math.abs(row.previous) >= 0.005 ? ` · ${row.variationPercent > 0 ? "+" : ""}${row.variationPercent.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%` : ""}</b>
              </article>
            `;
          }).join("")}
        </div>
      </section>
    </div>
  `;

  on("#global-period-form", "submit", event => {
    event.preventDefault();
    const values = readForm(event.currentTarget);
    const [year, month] = String(values.period || periodKey).split("-").map(Number);
    localStorage.setItem("managementComparePrevious", values.comparePrevious === "on" ? "true" : "false");
    const selected = applyGlobalPeriodToViews({ year, month });
    history.replaceState(null, "", "/home");
    const selectedKey = `${selected.year}-${String(selected.month).padStart(2, "0")}`;
    showToast(`${formatMonthKeyBr(selectedKey)} aplicado em todo o sistema.`, "success");
    home();
  });

  document.querySelectorAll("[data-home-period-shift]").forEach(button => {
    button.addEventListener("click", event => {
      const shift = Number(event.currentTarget.dataset.homePeriodShift || 0);
      const [year, month] = periodKey.split("-").map(Number);
      const target = new Date(year, month - 1 + shift, 1);
      applyGlobalPeriodToViews({ year: target.getFullYear(), month: target.getMonth() + 1 });
      history.replaceState(null, "", "/home");
      home();
    });
  });
}

function todayOperationData() {
  const today = isoDate(new Date());
  const monthEnd = currentMonthEndDate();
  const currentKey = menuKey(state.menuWeek || 1);
  const todayCash = accountingCashEntries(state.cash).filter(entry => cashAccountingDate(entry) === today);
  const todayBusinessCash = businessCashEntries(todayCash);
  const todayStoreSales = state.storeSales.filter(entry => entry.date === today);
  const weekOrders = weeklyOrders(currentKey);
  const pendingPayments = weekOrders.filter(order => {
    const client = clientByPhone(order.clientPhone);
    return client.plan === "semanal" && !isOrderPaid(order);
  });
  const pendingDelivery = weekOrders.filter(order => !isMonthlyRenewalRecord(order) && !order.delivered);
  const billsDue = state.cash
    .filter(isPendingBill)
    .filter(entry => {
      const date = String(entry.dueDate || entry.date || "");
      return date && date <= monthEnd;
    })
    .sort((a, b) => String(a.dueDate || a.date || "").localeCompare(String(b.dueDate || b.date || "")));

  return {
    today,
    currentKey,
    todayCash,
    todayStoreSales,
    weekOrders,
    pendingPayments,
    pendingDelivery,
    billsDue,
    income: todayBusinessCash.filter(entry => entry.type !== "expense").reduce((sum, entry) => sum + Number(entry.amount || 0), 0),
    expenses: todayBusinessCash.filter(entry => entry.type === "expense").reduce((sum, entry) => sum + Number(entry.amount || 0), 0),
    storeQuantity: todayStoreSales.reduce((sum, entry) => sum + storeSaleUnitQuantity(entry), 0)
  };
}

function operationAgendaItems(data = todayOperationData()) {
  const currentMenu = state.menus[data.currentKey] || [];
  const supermarket = monthlySupermarketAllocation(menuPeriodKeyFromKey(data.currentKey));
  const menuWithoutSupermarketRate = supermarket.supermarketTotal > 0 && supermarket.totalQuantity > 0
    ? []
    : currentMenu.filter(item => String(item.dish || "").trim());
  const incompleteRecipes = (state.pricingRecipes || []).filter(recipe => !pricingRecipeIsComplete(recipe));
  const backupAt = localStorage.getItem("lastManualBackupAt") || "";
  const backupDays = backupAgeDays(backupAt);
  const reminderDays = configuredBackupReminderDays();
  const dayClosing = dayClosingForDate(data.today);
  return [
    data.pendingPayments.length ? {
      type: "danger",
      category: "Pedidos",
      title: `${data.pendingPayments.length} pagamento(s) pendente(s)`,
      detail: "Revise os pedidos semanais e registre os recebimentos.",
      href: "/pedidos",
      action: "Abrir pedidos"
    } : null,
    data.pendingDelivery.length ? {
      type: "warning",
      category: "Entregas",
      title: `${data.pendingDelivery.length} entrega(s) pendente(s)`,
      detail: "Confira a lista de entrega antes de encerrar a operação.",
      href: "/pedidos",
      action: "Ver entregas"
    } : null,
    data.billsDue.length ? {
      type: "danger",
      category: "Financeiro",
      title: `${data.billsDue.length} conta(s) aguardando pagamento`,
      detail: "Existem contas vencidas ou com vencimento dentro do mês.",
      href: "/financeiro?view=accounts",
      action: "Ver contas"
    } : null,
    menuWithoutSupermarketRate.length ? {
      type: "warning",
      category: "Menu",
      title: "Supermercado ainda sem rateio",
      detail: supermarket.supermarketTotal > 0
        ? "Registre as cumbucas vendidas para dividir o valor de Supermercado do Caixa."
        : "Lance as movimentações na categoria Supermercado do Caixa para calcular o custo.",
      href: "/fluxo-de-caixa",
      action: "Abrir Caixa"
    } : null,
    incompleteRecipes.length ? {
      type: "warning",
      category: "Preços",
      title: `${incompleteRecipes.length} prato(s) sem custo de supermercado`,
      detail: "Informe o custo de supermercado de uma unidade para liberar os cálculos.",
      href: "/precificacao?view=recipes",
      action: "Completar pratos"
    } : null,
    data.todayCash.length && !dayClosing ? {
      type: "warning",
      category: "Caixa",
      title: "Fechamento do dia pendente",
      detail: "Há movimentações lançadas hoje e o fechamento ainda não foi concluído.",
      href: "/fluxo-de-caixa?panel=day-closing",
      action: "Fechar o dia"
    } : null,
    backupDays === null || backupDays >= reminderDays ? {
      type: "warning",
      category: "Segurança",
      title: backupDays === null ? "Nenhum backup manual recente" : `Backup manual há ${backupDays} dia(s)`,
      detail: `A configuração recomenda uma cópia a cada ${reminderDays} dia(s).`,
      href: "/backups?tab=backup",
      action: "Ver backups"
    } : null
  ].filter(Boolean);
}

function renderToday() {
  showStandardHero("Operação");
  setActive("hoje");
  ensureCashEntryIds();
  const data = todayOperationData();
  const agenda = operationAgendaItems(data);
  const quickCashAccount = normalizedCashAccount(state.cashEntryDraft.cashAccount);

  app.innerHTML = `
    <section class="dashboard-band today-band">
      <div class="dashboard-copy">
        <span>${formatIsoDateBr(data.today)}</span>
        <h2>Central de operações</h2>
        <p>Agenda, vendas, caixa, pedidos, contas e decisões importantes em uma única tela.</p>
      </div>
      <div class="dashboard-kpis">
        <div class="metric dashboard-metric is-primary"><span>Loja hoje</span><strong>${data.storeQuantity}</strong></div>
        <div class="metric dashboard-metric"><span>Entradas hoje</span><strong>${money(data.income)}</strong></div>
        <div class="metric dashboard-metric"><span>Saídas hoje</span><strong>${money(data.expenses)}</strong></div>
        <div class="metric dashboard-metric"><span>Prioridades</span><strong class="${agenda.length ? "negative" : "positive"}">${agenda.length}</strong></div>
      </div>
    </section>

    <section class="panel operation-agenda">
      <div class="section-heading">
        <div>
          <h2>Agenda da operação</h2>
          <p class="muted-inline">Pendências reunidas de pedidos, financeiro, menu, preços, caixa e segurança.</p>
        </div>
        <a class="secondary table-action" href="/alertas">Ver central de alertas</a>
      </div>
      ${agenda.length ? `
        <div class="operation-priority-list">
          ${agenda.map(item => `
            <article class="operation-priority-card ${item.type}">
              <span>${escapeHtml(item.category)}</span>
              <strong>${escapeHtml(item.title)}</strong>
              <small>${escapeHtml(item.detail)}</small>
              <a class="secondary table-action" href="${escapeHtml(item.href)}">${escapeHtml(item.action)}</a>
            </article>
          `).join("")}
        </div>
      ` : `
        <div class="operation-all-clear">
          <strong>Operação em dia</strong>
          <span>Nenhuma prioridade automática encontrada agora.</span>
        </div>
      `}
    </section>

    <section class="dashboard-lane">
      <div class="panel dashboard-panel">
        <h2>Entrada rápida</h2>
        <form id="today-income-form" class="form-grid single">
          <label>Data
            <input name="date" type="date" value="${data.today}" required>
          </label>
          <label>Descrição
            <input name="description" placeholder="Venda, pix, ajuste" required>
          </label>
          <label>Conta
            <select name="cashAccount">
              ${cashAccountOptionsHtml(quickCashAccount, "income")}
            </select>
          </label>
          <label>Valor
            <input name="amount" type="text" inputmode="decimal" placeholder="0,00" required>
          </label>
          <button type="submit">Salvar entrada</button>
        </form>
      </div>
      <div class="panel dashboard-panel">
        <h2>Saída rápida</h2>
        <form id="today-expense-form" class="form-grid today-expense-details">
          <label class="span-2">Descrição
            <input name="description" placeholder="Mercado, boleto, entregador" required>
          </label>
          <label>Data
            <input name="date" type="date" value="${data.today}" required>
          </label>
          <label>Categoria
            <select name="category" id="today-expense-category">
              ${cashCategoryOptions("expense", "outros")}
            </select>
          </label>
          <label id="today-expense-employee-field">
            Funcionário
            <select name="employeeId" id="today-expense-employee">
              ${financialEmployeeOptionsHtml()}
            </select>
          </label>
          <label id="today-expense-cash-account-field">Conta corrente
            <select name="cashAccount" id="today-expense-cash-account">
              ${cashAccountOptionsHtml(quickCashAccount, "expense", false, "Definir quando pagar")}
            </select>
            <small id="today-expense-cash-account-help">Em boleto pendente, deixe para definir no pagamento.</small>
          </label>
          <label id="today-expense-due-date-field">Vencimento
            <input name="dueDate" type="date">
          </label>
          <label id="today-expense-paid-field">
            <input name="paid" type="checkbox" value="yes">
            Já está pago
          </label>
          <label id="today-expense-paid-date-field">Pago em
            <input name="paidDate" type="date" value="${data.today}">
          </label>
          <label>Valor
            <input name="amount" type="text" inputmode="decimal" placeholder="0,00" required>
          </label>
          <div class="actions span-2">
            <button type="submit">Salvar saída</button>
          </div>
        </form>
      </div>
    </section>

    <section class="dashboard-lane">
      <div class="panel dashboard-panel">
        <h2>Venda da loja</h2>
        <form id="today-store-form" class="form-grid single">
          <label>Data
            <input name="date" type="date" value="${data.today}" required>
          </label>
          <label>Quantidade de cumbucas
            <input name="quantity" type="number" min="1" step="1" placeholder="0" required>
          </label>
          <label>Observação
            <input name="notes" placeholder="Opcional">
          </label>
          <button type="submit">Salvar venda</button>
        </form>
      </div>
      <div class="panel dashboard-panel">
        <h2>Pedidos da semana</h2>
        ${data.weekOrders.length ? `
          <div class="recent-list">
            ${data.weekOrders.slice(0, 8).map(order => {
              const client = clientByPhone(order.clientPhone);
              return `
                <span class="today-order-item">
                  <b>${orderQuantity(order)}</b>
                  ${escapeHtml(client.name || order.clientPhone)}
                  <small>${isOrderPaid(order) ? "Pago" : "Pagamento pendente"} - ${order.delivered ? "Entregue" : "Entrega pendente"}</small>
                  <span class="today-order-actions">
                    ${client.plan === "semanal" && !isOrderPaid(order) ? `<button class="secondary table-action" type="button" data-today-paid-order="${order.id}">Pago</button>` : ""}
                    ${!order.delivered ? `<button class="secondary table-action" type="button" data-today-delivered-order="${order.id}">Entregue</button>` : ""}
                  </span>
                </span>
              `;
            }).join("")}
          </div>
        ` : `<p class="muted">Nenhum pedido na semana aberta.</p>`}
      </div>
    </section>

    <section class="dashboard-lane">
      <div class="panel dashboard-panel">
        <h2>Contas a pagar do mês</h2>
        ${data.billsDue.length ? `
          <div class="recent-list">
            ${data.billsDue.slice(0, 8).map(entry => `
              <span class="today-order-item">
                <b>${money(entry.amount)}</b>
                ${escapeHtml(entry.description || categoryName(entry.category))}
                <small>${entry.dueDate ? dueDateDistanceLabel(entry.dueDate) : formatIsoDateBr(entry.date)}</small>
                <span class="today-order-actions">
                  ${entry.id ? `<a class="secondary table-action" href="/fluxo-de-caixa?edit=${encodeURIComponent(entry.id)}">Editar</a>` : ""}
                  <button class="secondary table-action" type="button" data-pay-bill="${entry.id || ""}">Marcar pago</button>
                </span>
              </span>
            `).join("")}
          </div>
        ` : `<p class="muted">Nenhuma conta a pagar até o fim deste mês.</p>`}
      </div>
      <div class="panel dashboard-panel">
        <h2>Resumo operacional</h2>
        <div class="alert-list">
          <span><b>Pedidos da semana</b>${data.weekOrders.length}</span>
          <span><b>Pagamentos pendentes</b>${data.pendingPayments.length}</span>
          <span><b>Entregas pendentes</b>${data.pendingDelivery.length}</span>
          <span><b>Contas aguardando pagamento</b>${data.billsDue.length}</span>
        </div>
      </div>
    </section>
  `;

  bindTodayForms();
  bindTodayOrderActions();
  bindBillPaymentButtons(renderToday);
}

function bindTodayOrderActions() {
  document.querySelectorAll("[data-today-paid-order]").forEach(button => {
    button.addEventListener("click", async event => {
      const id = Number(event.currentTarget.dataset.todayPaidOrder);
      state.orders = state.orders.map(order => Number(order.id) === id
        ? { ...order, paid: true, paidAmount: Number(order.amount || 0), paidAt: new Date().toISOString() }
        : order);
      if (await persistState()) {
        showToast("Pedido marcado como pago.", "success");
        renderToday();
      }
    });
  });

  document.querySelectorAll("[data-today-delivered-order]").forEach(button => {
    button.addEventListener("click", async event => {
      const id = Number(event.currentTarget.dataset.todayDeliveredOrder);
      state.orders = state.orders.map(order => Number(order.id) === id
        ? { ...order, delivered: true, deliveredAt: new Date().toISOString() }
        : order);
      if (await persistState()) {
        showToast("Pedido marcado como entregue.", "success");
        renderToday();
      }
    });
  });
}

function bindBillPaymentButtons(afterPay = renderCurrentRoute) {
  document.querySelectorAll("[data-pay-bill]").forEach(button => {
    button.addEventListener("click", async event => {
      const id = event.currentTarget.dataset.payBill;
      const bill = state.cash.find(entry => String(entry.id) === String(id));
      if (!bill) {
        return;
      }

      const paidDate = prompt("Data em que o boleto foi pago:", isoDate(new Date()));
      if (paidDate === null) {
        return;
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(paidDate)) {
        showToast("Informe a data no formato AAAA-MM-DD.", "error");
        return;
      }
      if (blockClosedPeriod(paidDate, "pagar conta")) {
        return;
      }
      const informedAccount = prompt(
        "Conta usada no pagamento (digite PF, PJ ou COFRINHO):",
        normalizedCashAccount(bill.cashAccount, "") === "savings"
          ? "COFRINHO"
          : normalizedCashAccount(bill.cashAccount, "").toUpperCase()
      );
      if (informedAccount === null) {
        return;
      }
      const informedAccountKey = String(informedAccount).trim().toLowerCase();
      const cashAccount = normalizedCashAccount(
        ["cofrinho", "reserva"].includes(informedAccountKey) ? "savings" : informedAccountKey,
        ""
      );
      if (!cashAccount) {
        showToast("Informe PF, PJ ou Cofrinho para registrar a saída.", "error");
        return;
      }
      if (!confirm(`Marcar ${bill.description || categoryName(bill.category)} como pago em ${formatIsoDateBr(paidDate)} pela ${cashAccountLabel(cashAccount)}?`)) {
        return;
      }

      const paidBill = { ...bill, date: paidDate, cashAccount, paidAt: `${paidDate}T12:00:00.000Z` };
      const prospectiveSavingsHistory = prospectiveSavingsHistoryForCashEntry(paidBill, bill.id);

      state.cash = state.cash.map(entry => String(entry.id) === String(id)
        ? paidBill
        : entry);
      applySavingsHistory(prospectiveSavingsHistory);
      recordAudit("Conta paga", `${bill.description || categoryName(bill.category)} - ${money(bill.amount)} - ${formatIsoDateBr(paidDate)} - ${cashAccountLabel(cashAccount)}`);
      if (await persistState()) {
        showToast("Conta marcada como paga.", "success");
        afterPay();
      }
    });
  });
}

function bindTodayForms() {
  const quickCashAccount = normalizedCashAccount(state.cashEntryDraft.cashAccount);
  on("#today-income-form", "submit", async event => {
    event.preventDefault();
    const releaseSubmission = lockFormSubmission(event.currentTarget);
    if (!releaseSubmission) {
      return;
    }
    try {
      const values = readForm(event.currentTarget);
      const amount = parseMoneyInput(values.amount);
      if (!values.date || amount <= 0) {
        showToast("Informe data e valor maior que zero.", "error");
        return;
      }
      if (blockClosedPeriod(values.date, "lançar entrada rápida")) {
        return;
      }

      state.cash.push({
        id: Date.now(),
        date: values.date,
        type: "income",
        category: "venda",
        description: values.description,
        cashAccount: normalizedCashAccount(values.cashAccount),
        amount: amount.toFixed(2)
      });
      if (await persistState()) {
        renderToday();
      }
    } finally {
      releaseSubmission();
    }
  });

  on("#today-expense-form", "submit", async event => {
    event.preventDefault();
    const releaseSubmission = lockFormSubmission(event.currentTarget);
    if (!releaseSubmission) {
      return;
    }
    try {
      const values = readForm(event.currentTarget);
      const amount = parseMoneyInput(values.amount);
      if (amount <= 0) {
        showToast("Informe valor maior que zero.", "error");
        return;
      }
      if (!values.date) {
        showToast("Informe a data da saída.", "error");
        return;
      }
      if (blockClosedPeriod(values.date, "lançar saída rápida")) {
        return;
      }
      const isEmployeeExpense = isFinancialEmployeeCategory(values.category);
      if (isEmployeeExpense && financialEmployees().some(employee => employee.active) && !values.employeeId) {
        showToast("Selecione o funcionário que recebeu esse pagamento.", "error");
        return;
      }
      const shouldTrackBillPayment = isBillCategory(values.category);
      const billIsPaid = shouldTrackBillPayment && values.paid === "yes";
      const paidDate = billIsPaid ? (values.paidDate || values.date) : "";
      const cashAccount = normalizedCashAccount(values.cashAccount, "");
      if (!cashAccount && (!shouldTrackBillPayment || billIsPaid)) {
        showToast("Selecione a conta usada na saída.", "error");
        return;
      }
      const entry = {
        id: Date.now(),
        date: paidDate || values.date,
        type: "expense",
        category: values.category || "outros",
        description: values.description,
        cashAccount,
        amount: amount.toFixed(2)
      };
      if (isEmployeeExpense) {
        entry.employeeId = String(values.employeeId || "");
      }
      if (shouldTrackBillPayment) {
        entry.dueDate = values.dueDate || values.date;
        if (billIsPaid) {
          if (blockClosedPeriod(paidDate, "pagar boleto")) {
            return;
          }
          entry.paidAt = `${paidDate}T12:00:00.000Z`;
        }
      }
      state.cash.push(entry);
      if (await persistState()) {
        renderToday();
      }
    } finally {
      releaseSubmission();
    }
  });

  const todayExpenseCategory = document.querySelector("#today-expense-category");
  const todayExpenseDueDateField = document.querySelector("#today-expense-due-date-field");
  const todayExpensePaidField = document.querySelector("#today-expense-paid-field");
  const todayExpensePaidDateField = document.querySelector("#today-expense-paid-date-field");
  const todayExpensePaidCheckbox = todayExpensePaidField?.querySelector("input");
  const todayExpenseCashAccountField = document.querySelector("#today-expense-cash-account-field");
  const todayExpenseCashAccountSelect = document.querySelector("#today-expense-cash-account");
  const todayExpenseEmployeeField = document.querySelector("#today-expense-employee-field");
  const todayExpenseEmployeeSelect = document.querySelector("#today-expense-employee");
  if (todayExpenseCategory && todayExpenseDueDateField && todayExpensePaidField && todayExpensePaidDateField && todayExpensePaidCheckbox) {
    const updateTodayExpenseBillFields = () => {
      const shouldShowBill = isBillCategory(todayExpenseCategory.value);
      const shouldShowPaidDate = shouldShowBill && todayExpensePaidCheckbox.checked;
      todayExpenseDueDateField.hidden = !shouldShowBill;
      todayExpenseDueDateField.querySelector("input").required = shouldShowBill;
      todayExpensePaidField.hidden = !shouldShowBill;
      todayExpensePaidDateField.hidden = !shouldShowPaidDate;
      todayExpensePaidDateField.querySelector("input").required = shouldShowPaidDate;
      if (todayExpenseCashAccountField && todayExpenseCashAccountSelect) {
        todayExpenseCashAccountField.hidden = false;
        todayExpenseCashAccountSelect.required = !shouldShowBill || shouldShowPaidDate;
        if (shouldShowBill && !shouldShowPaidDate) {
          todayExpenseCashAccountSelect.value = "";
        } else if (!todayExpenseCashAccountSelect.value) {
          todayExpenseCashAccountSelect.value = normalizedCashAccount(quickCashAccount);
        }
      }
      if (!shouldShowBill) {
        todayExpenseDueDateField.querySelector("input").value = "";
        todayExpensePaidCheckbox.checked = false;
      }
      if (todayExpenseEmployeeField && todayExpenseEmployeeSelect) {
        const shouldShowEmployee = isFinancialEmployeeCategory(todayExpenseCategory.value);
        todayExpenseEmployeeField.hidden = !shouldShowEmployee;
        todayExpenseEmployeeSelect.required = shouldShowEmployee
          && financialEmployees().some(employee => employee.active);
        if (!shouldShowEmployee) {
          todayExpenseEmployeeSelect.value = "";
        }
      }
    };
    todayExpenseCategory.addEventListener("change", updateTodayExpenseBillFields);
    todayExpensePaidCheckbox.addEventListener("change", updateTodayExpenseBillFields);
    todayExpenseEmployeeSelect?.addEventListener("change", event => {
      const employee = financialEmployeeById(event.currentTarget.value);
      const description = document.querySelector("#today-expense-form [name='description']");
      if (employee && description && !description.value.trim()) {
        description.value = `Pagamento - ${employee.name}`;
      }
    });
    updateTodayExpenseBillFields();
  }

  on("#today-store-form", "submit", async event => {
    event.preventDefault();
    const values = readForm(event.currentTarget);
    const quantity = Number(values.quantity || 0);
    if (!values.date || quantity <= 0) {
      showToast("Informe data e quantidade maior que zero.", "error");
      return;
    }
    if (blockClosedPeriod(values.date, "lançar venda da loja")) {
      return;
    }
    state.storeSales.push({
      id: Date.now(),
      date: values.date,
      quantity,
      notes: values.notes || ""
    });
    if (await persistState()) {
      renderToday();
    }
  });
}

async function renderCash() {
  const isExpensesRoute = routeName() === "despesas";
  showStandardHero(isExpensesRoute ? "Despesas" : "Fluxo de Caixa");
  setActive(isExpensesRoute ? "despesas" : "fluxo-de-caixa");
  const cashParams = new URLSearchParams(location.search);
  const requestedCashPanel = cashParams.get("panel");
  const requestedQuickEntry = cashParams.get("novo");
  const quickEntryDrafts = {
    despesa: { type: "expense", category: "outros", description: "" },
    insumos: { type: "expense", category: "supermercado", description: "Compra de insumos" },
    desperdicio: { type: "expense", category: "outros", description: "Perda/desperdício" }
  };
  const requestedQuickDraft = quickEntryDrafts[requestedQuickEntry] || null;
  const requestedEmployeeId = cashParams.get("employee");
  const requestedEmployee = financialEmployeeById(requestedEmployeeId);
  if (requestedCashPanel === "channels") {
    state.storeViewTab = "channels";
    location.replace("/loja?view=channels");
    return;
  }
  if (requestedQuickDraft) {
    state.editCashId = null;
    state.cashPanelTab = "entry";
  }
  const requestedEditCashId = cashParams.get("edit");
  ensureCashEntryIds();
  const requestedEditCashEntry = requestedEditCashId
    ? state.cash.find(entry => String(entry.id) === String(requestedEditCashId))
    : null;
  const today = isoDate(new Date());
  const yesterdayDate = (() => {
    const date = new Date();
    date.setDate(date.getDate() - 1);
    return isoDate(date);
  })();
  if (state.cashFilter?.period === "all" && !state.cashFilter.manualAll) {
    state.cashFilter = { period: "month", date: today, month: today.slice(0, 7), year: today.slice(0, 4), type: "all", category: "all", cashAccount: "all", search: "" };
  }
  if (requestedEditCashEntry && isAccountTransferCashEntry(requestedEditCashEntry)) {
    state.editCashId = null;
    state.cashPanelTab = "transfers";
    state.editAccountTransferId = requestedEditCashEntry.accountTransferId || requestedEditCashEntry.transferId;
  } else if (requestedEditCashId && state.cash.some(entry => String(entry.id) === String(requestedEditCashId))) {
    state.editCashId = requestedEditCashId;
    state.cashPanelTab = "entry";
  } else if (requestedEmployee) {
    state.editCashId = null;
    state.cashPanelTab = "entry";
  }
  const editing = state.editCashId !== null
    ? state.cash.find(entry => String(entry.id) === String(state.editCashId))
    : null;
  const cashEntryDate = editing?.date || state.cashEntryDraft.date || today;
  const cashEntryType = editing?.type
    || (requestedEmployee ? "expense" : "")
    || (isExpensesRoute ? "expense" : "")
    || requestedQuickDraft?.type
    || state.cashEntryDraft.type
    || "income";
  const cashEntryCategory = editing?.category
    || (requestedEmployee ? "funcionarios" : "")
    || (isExpensesRoute ? "outros" : "")
    || requestedQuickDraft?.category
    || state.cashEntryDraft.category
    || (cashEntryType === "expense" ? "outros" : "venda");
  const cashEntryEmployeeId = String(editing?.employeeId || requestedEmployee?.id || "");
  const cashEntryDescription = editing?.description
    || (requestedEmployee ? `Pagamento - ${requestedEmployee.name}` : "")
    || requestedQuickDraft?.description
    || "";
  const cashEntryIsPendingBill = cashEntryType === "expense"
    && isBillCategory(cashEntryCategory)
    && !editing?.paidAt;
  const cashEntryAccount = cashEntryIsPendingBill
    ? normalizedCashAccount(editing?.cashAccount, "")
    : normalizedCashAccount(editing?.cashAccount || state.cashEntryDraft.cashAccount);
  const editingWithdrawal = state.editWithdrawalGroup
    ? withdrawalHistoryGroups(state.cash).find(group => group.key === state.editWithdrawalGroup)
    : null;
  const routeCashEntries = isExpensesRoute
    ? state.cash.filter(entry => entry.type === "expense" && !isWithdrawalEntry(entry) && !isAccountAdjustmentEntry(entry) && !isPartnerCashEntry(entry))
    : state.cash;
  const ledgerEntries = isExpensesRoute
    ? routeCashEntries
    : [...routeCashEntries, ...savingsHistoryLedgerEntries()];
  const routeFilterOverrides = isExpensesRoute ? { type: "expense", quick: "" } : {};
  const filteredEntries = filterCashEntries(routeCashEntries, routeFilterOverrides);
  const filteredLedgerEntries = filterCashEntries(ledgerEntries, routeFilterOverrides);
  const categoryMenuEntries = filterCashEntries(routeCashEntries, {
    search: "",
    type: isExpensesRoute ? "expense" : "all",
    category: "all",
    quick: "",
    cashAccount: "all"
  });
  const accountedEntries = accountingCashEntries(filteredEntries);
  const categoryMenuAccountedEntries = accountingCashEntries(categoryMenuEntries);
  const filteredTotals = cashTotals(accountedEntries);
  const operationalTotals = cashTotals(businessCashEntries(accountedEntries));
  const currentCashFilter = getCashFilter();
  const selectedDate = currentCashFilter.date || today;
  const selectedMonth = currentCashFilter.month || today.slice(0, 7);
  const selectedYear = currentCashFilter.year || today.slice(0, 4);
  const dailyClosingRecord = dayClosingForDate(selectedDate);
  const dailyClosingData = dailyClosingMetrics(selectedDate, dailyClosingRecord?.realBalance ?? null);
  const reconciliationHistory = state.financialPlanning?.reconciliationHistory || [];
  const editingReconciliation = state.editReconciliationId
    ? reconciliationHistory.find(item => String(item.id) === String(state.editReconciliationId))
    : null;
  const reconciliationAccount = normalizedCashAccount(
    editingReconciliation?.cashAccount
      || (["pf", "pj"].includes(currentCashFilter.cashAccount) ? currentCashFilter.cashAccount : "")
      || state.cashEntryDraft.cashAccount
  );
  const selectedFilterType = isExpensesRoute ? "expense" : (currentCashFilter.type || "all");
  const selectedFilterCategory = currentCashFilter.category || "all";
  const selectedFilterAccount = currentCashFilter.cashAccount || "all";
  const selectedQuickFilter = currentCashFilter.quick || "";
  const advancedCashFilterActive = selectedFilterType !== "all"
    || selectedFilterCategory !== "all"
    || selectedFilterAccount !== "all"
    || Boolean(String(currentCashFilter.search || "").trim());
  const periodAdjustmentTotals = accountAdjustmentTotals(cashEntriesForSelectedPeriod());
  const filteredAdjustmentTotals = accountAdjustmentTotals(accountedEntries);
  const reconciliationDate = editingReconciliation?.date || selectedDate;
  const dailyAccountBalance = reconciliationCalculatedBalance(reconciliationDate, editingReconciliation, reconciliationAccount);
  const reconciliationRealBalance = editingReconciliation
    ? Number(editingReconciliation.realBalance || 0)
    : dailyAccountBalance;
  const reconciliationDifference = reconciliationRealBalance - dailyAccountBalance;
  const adjustmentLabel = periodAdjustmentTotals.balance === 0
    ? "Sem ajuste no período"
    : `${periodAdjustmentTotals.balance > 0 ? "Ajuste entrou" : "Ajuste saiu"} ${money(Math.abs(periodAdjustmentTotals.balance))}`;
  const selectedMonthEnd = (() => {
    const [year, month] = selectedMonth.split("-").map(Number);
    return isoDate(new Date(year, month, 0));
  })();
  const accountBalanceDate = currentCashFilter.period === "day"
    ? selectedDate
    : currentCashFilter.period === "week"
      ? weekRangeForDate(selectedDate).end
      : currentCashFilter.period === "month"
        ? (selectedMonth === today.slice(0, 7) ? today : selectedMonthEnd)
        : today;
  const displayedCashBalance = accountBalanceUntilDate(accountBalanceDate);
  const cashAccountBalances = accountBalanceBreakdownUntilDate(accountBalanceDate);
  const savingsAccountBalance = savingsBalanceUntilDate(accountBalanceDate);
  const consolidatedAccountBalance = roundedMoneyValue(
    displayedCashBalance + savingsAccountBalance
  );
  const latestPfCashEntry = latestCashEntryForAccount("pf", accountBalanceDate);
  const latestPjCashEntry = latestCashEntryForAccount("pj", accountBalanceDate);
  const latestSavingsEntry = latestSavingsEntryUntilDate(accountBalanceDate);
  const latestUnassignedCashEntry = latestCashEntryForAccount("", accountBalanceDate);
  const balanceLabel = "Caixa PF + PJ";
  const editingWithdrawalLoan = editingWithdrawal ? withdrawalSavingsLoanEntry(editingWithdrawal) : null;
  const editingWithdrawalAdjustment = editingWithdrawal
    ? withdrawalBalanceAdjustmentEntry(editingWithdrawal)
    : null;
  const withdrawalCashAccount = normalizedCashAccount(
    editingWithdrawal?.cashAccount || state.cashEntryDraft.cashAccount
  );
  const withdrawalDate = editingWithdrawal?.date || today;
  const editingWithdrawalIds = editingWithdrawal
    ? [
      ...editingWithdrawal.entries.map(entry => String(entry.id)),
      editingWithdrawalLoan?.id,
      editingWithdrawalAdjustment?.id
    ].filter(Boolean)
    : [];
  const calculatedWithdrawalAccountBalance = accountBalanceUntilDate(
    withdrawalDate,
    editingWithdrawalIds,
    withdrawalCashAccount
  );
  const withdrawalAccountBalance = editingWithdrawal
    ? Number(editingWithdrawal.accountBalanceBefore || calculatedWithdrawalAccountBalance)
    : calculatedWithdrawalAccountBalance;
  const withdrawalBalanceDifference = roundedMoneyValue(
    withdrawalAccountBalance - calculatedWithdrawalAccountBalance
  );
  const withdrawalDebtBalances = partnerBalances(state.partnerAccounts, withdrawalDate);
  const withdrawalDebtVanessa = editingWithdrawal
    ? Number(editingWithdrawal.priorVanessa || 0)
    : Number(withdrawalDebtBalances.vanessa || 0);
  const withdrawalDebtRaquel = editingWithdrawal
    ? Number(editingWithdrawal.priorRaquel || 0)
    : Number(withdrawalDebtBalances.raquel || 0);
  const automaticWithdrawal = withdrawalDistributionCalculation(
    withdrawalAccountBalance,
    withdrawalDebtVanessa,
    withdrawalDebtRaquel,
    editingWithdrawal
      ? {
          compensationVanessa: editingWithdrawal.paidToCashVanessa || 0,
          compensationRaquel: editingWithdrawal.paidToCashRaquel || 0,
          realPaymentVanessa: editingWithdrawal.realPaymentVanessa || 0,
          realPaymentRaquel: editingWithdrawal.realPaymentRaquel || 0
        }
      : undefined
  );
  const withdrawalFormValues = editingWithdrawal || automaticWithdrawal;
  const previewAccountAfterWithdrawal = roundedMoneyValue(
    Math.max(0, withdrawalAccountBalance - Number(withdrawalFormValues.total || 0))
  );
  const savingsPlanning = state.financialPlanning || {};
  const savingsCurrent = savingsBalance();
  const savingsExpected = savingsExpectedBalance();
  const savingsDebt = savingsDebtAmount();
  const savingsRows = savingsHistoryRows();
  const editingSavingsEntry = state.editSavingsEntryId
    ? savingsRows.find(entry => String(entry.id) === String(state.editSavingsEntryId))
    : null;
  const partnersPeriod = state.cashFilter?.month || today.slice(0, 7);
  const partnersRecord = partnersRecordForPeriod(partnersPeriod);
  const partnersDashboard = partnerDashboard(selectedDate, partnersPeriod);
  const cashPanelTabs = isExpensesRoute
    ? [
      ["entry", editing ? "Editar despesa" : "Nova despesa"],
      ["ledger", "Despesas lançadas"]
    ]
    : [
      ["entry", editing ? "Editar" : "Lançamento"],
      ["ledger", "Extrato"],
      ["reconciliation", "Conferência"],
      ["day-closing", "Fechamento"],
      ["transfers", "Transferências"],
      ["savings", "Cofrinho"],
      ["withdrawals", "Retiradas"],
      ["categories", "Categorias"]
    ];
  if (state.cashPanelTab === "partners") {
    state.cashPanelTab = "withdrawals";
  }
  if (requestedCashPanel && cashPanelTabs.some(([tab]) => tab === requestedCashPanel)) {
    state.cashPanelTab = requestedCashPanel;
  }
  if (!cashPanelTabs.some(([tab]) => tab === state.cashPanelTab)) {
    state.cashPanelTab = "entry";
  }
  const activeCashPanel = editing ? "entry" : (state.cashPanelTab || "entry");
  const showCashEmployeeField = cashEntryType === "expense"
    && isFinancialEmployeeCategory(cashEntryCategory);

  app.innerHTML = `
    <section class="cash-hero">
      <div>
        <span>${isExpensesRoute ? "Despesas operacionais do período" : "Saldo consolidado das contas"}</span>
        <h2>${money(isExpensesRoute ? filteredTotals.expenses : consolidatedAccountBalance)}</h2>
      </div>
      <div class="cash-hero-metrics">
        <span data-cash-filter-income><b>${money(filteredTotals.income)}</b>Entradas do filtro<small>Lançamentos contabilizados</small></span>
        <span data-cash-filter-expenses><b>${money(filteredTotals.expenses)}</b>Saídas do filtro<small>Lançamentos contabilizados</small></span>
        <span data-cash-accumulated-balance><b>${money(displayedCashBalance)}</b>${balanceLabel}<small>Inclui ajustes e lançamentos sem conta</small></span>
        <span data-cash-filter-result>
          <b class="${filteredTotals.balance < 0 ? "negative" : "positive"}">${money(filteredTotals.balance)}</b>
          Resultado do filtro
          <small>Entradas - saídas exibidas</small>
        </span>
        <div class="cash-account-grid" aria-label="Detalhamento do saldo acumulado por conta">
          <span class="cash-account-metric" data-cash-account-summary="pf">
            <b class="${cashAccountBalances.pf < 0 ? "negative" : "positive"}">${money(cashAccountBalances.pf)}</b>
            Conta PF
            <small>${latestPfCashEntry ? `Último lançamento em ${formatIsoDateBr(cashAccountingDate(latestPfCashEntry))}` : "Nenhum lançamento registrado"}</small>
          </span>
          <span class="cash-account-metric" data-cash-account-summary="pj">
            <b class="${cashAccountBalances.pj < 0 ? "negative" : "positive"}">${money(cashAccountBalances.pj)}</b>
            Conta PJ
            <small>${latestPjCashEntry ? `Último lançamento em ${formatIsoDateBr(cashAccountingDate(latestPjCashEntry))}` : "Nenhum lançamento registrado"}</small>
          </span>
          <span class="cash-account-metric is-savings" data-cash-account-summary="savings">
            <b class="${savingsAccountBalance < 0 ? "negative" : "positive"}">${money(savingsAccountBalance)}</b>
            Conta Cofrinho
            <small>${latestSavingsEntry ? `Último movimento em ${formatIsoDateBr(latestSavingsEntry.date)}` : "Nenhum movimento registrado"}</small>
          </span>
          <span class="cash-account-metric is-unassigned" data-cash-account-summary="unassigned">
            <b class="${cashAccountBalances.unassigned < 0 ? "negative" : "positive"}">${money(cashAccountBalances.unassigned)}</b>
            Lançamentos sem conta
            <small>${latestUnassignedCashEntry ? `Último lançamento em ${formatIsoDateBr(cashAccountingDate(latestUnassignedCashEntry))}` : "Nenhum lançamento sem conta"}</small>
            ${latestUnassignedCashEntry ? `<button class="secondary table-action" type="button" data-review-unassigned-cash>Revisar lançamentos</button>` : ""}
          </span>
        </div>
      </div>
    </section>
    ${isExpensesRoute ? "" : `<section class="account-check-card">
      <div>
        <span>Conferência PF + PJ</span>
        <strong class="${displayedCashBalance < 0 ? "negative" : "positive"}">${money(displayedCashBalance)}</strong>
        <small>${adjustmentLabel}</small>
      </div>
    </section>`}
    <div class="cash-layout">
      <section class="panel cash-command-panel">
        <div class="cash-panel-tabs" role="tablist" aria-label="Ferramentas do caixa">
          ${cashPanelTabs.map(([tab, label]) => `
            <button class="${activeCashPanel === tab ? "active" : ""}" type="button" data-cash-panel="${tab}">${label}</button>
          `).join("")}
        </div>
        ${activeCashPanel === "entry" ? `
        <div class="cash-tab-section">
          <h2>${isExpensesRoute ? (editing ? "Editar despesa" : "Nova despesa") : (editing ? "Editar lançamento" : "Novo lançamento")}</h2>
        <form id="cash-form" class="form-grid single">
          <label>Descrição
            <input name="description" placeholder="Venda, iFood, supermercado, entregador" value="${escapeHtml(cashEntryDescription)}" required>
          </label>
          <div class="cash-date-control">
            <label>Data
              <input id="cash-entry-date" name="date" type="date" value="${cashEntryDate}" required>
            </label>
            ${editing ? "" : `
              <div class="cash-date-shortcuts" aria-label="Atalhos de data">
                <button class="secondary ${cashEntryDate === today ? "active" : ""}" type="button" data-cash-entry-date="today" aria-pressed="${cashEntryDate === today}">Hoje</button>
                <button class="secondary ${cashEntryDate === yesterdayDate ? "active" : ""}" type="button" data-cash-entry-date="yesterday" aria-pressed="${cashEntryDate === yesterdayDate}">Ontem</button>
              </div>
            `}
          </div>
          ${isExpensesRoute ? `<input id="cash-type" name="type" type="hidden" value="expense">` : `<label>Tipo
            <select name="type" id="cash-type">
              <option value="income" ${cashEntryType === "income" ? "selected" : ""}>Entrada</option>
              <option value="expense" ${cashEntryType === "expense" ? "selected" : ""}>Saída</option>
            </select>
          </label>`}
          <label>Origem / categoria
            <select name="category" id="cash-category">
              ${cashCategoryOptions(cashEntryType, cashEntryCategory)}
            </select>
          </label>
          <p class="muted-inline wide" id="cash-capital-contribution-hint" hidden>Aporte de sócia aumenta o saldo da empresa, mas não entra em vendas, faturamento ou lucro operacional.</p>
          <label id="cash-employee-field" ${showCashEmployeeField ? "" : "hidden"}>
            Funcionário
            <select name="employeeId" id="cash-employee">
              ${financialEmployeeOptionsHtml(cashEntryEmployeeId)}
            </select>
            <small>O pagamento será somado automaticamente na ficha do funcionário.</small>
          </label>
          <label id="cash-account-field">Conta corrente
            <select name="cashAccount" id="cash-account">
              ${cashAccountOptionsHtml(cashEntryAccount, cashEntryType, false, "Definir quando pagar", true)}
            </select>
            <small>Em boleto pendente, deixe para definir no pagamento.</small>
          </label>
          <label id="cash-due-date-field">Vencimento
            <input name="dueDate" type="date" value="${editing?.dueDate || ""}">
          </label>
          <label id="cash-paid-field">
            <input name="paid" type="checkbox" value="yes" ${editing?.paidAt ? "checked" : ""}>
            Já está pago
          </label>
          <label>Valor
            <input name="amount" type="text" inputmode="decimal" placeholder="0,00" value="${editing ? moneyInputValue(editing.amount) : ""}" required>
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
        <div class="cash-tab-section daily-reconciliation-panel">
          <div class="section-heading">
            <div>
              <h2>Conferência diária</h2>
              <p class="muted-inline">Informe o saldo real da conta no dia e lance só a diferença.</p>
            </div>
          </div>
          <form id="daily-reconciliation-form" class="form-grid">
            <input name="reconciliationId" type="hidden" value="${escapeHtml(editingReconciliation?.id || "")}">
            <label>Data da conferência
              <input name="date" type="date" value="${reconciliationDate}" required>
            </label>
            <label>Conta conferida
              <select name="cashAccount" id="daily-reconciliation-account">
                ${cashAccountOptionsHtml(reconciliationAccount, "expense")}
              </select>
            </label>
            <label>Saldo real da conta
              <input name="realBalance" type="text" inputmode="decimal" placeholder="0,00" value="${moneyInputValue(reconciliationRealBalance)}" required>
            </label>
            <label>Motivo
              <input name="reason" placeholder="Ex.: conta bancária zerada, diferença real do caixa" value="${escapeHtml(editingReconciliation?.reason || "Conta conferida")}" required>
            </label>
            <label>Responsável
              <input value="${escapeHtml(editingReconciliation?.authorizedBy || state.currentUser?.name || state.currentUser?.username || "Usuário")}" readonly>
            </label>
            <div class="actions">
              <button type="submit" ${canUser("editFinancial") ? "" : "disabled"}>${editingReconciliation ? "Revisar e salvar conciliação" : "Revisar e confirmar ajuste"}</button>
              ${editingReconciliation ? `<button class="secondary" type="button" id="cancel-reconciliation-edit">Cancelar</button>` : ""}
            </div>
          </form>
          <div class="summary">
            <div class="metric"><span>Conta conferida</span><strong id="reconciliation-account-label">${reconciliationAccountLabel(reconciliationAccount)}</strong></div>
            <div class="metric"><span>Saldo calculado até o dia</span><strong id="reconciliation-calculated" class="${dailyAccountBalance < 0 ? "negative" : "positive"}">${money(dailyAccountBalance)}</strong></div>
            <div class="metric"><span>Saldo real informado</span><strong id="reconciliation-real">${money(reconciliationRealBalance)}</strong></div>
            <div class="metric"><span>Diferença a ajustar</span><strong id="reconciliation-difference" class="${reconciliationDifference < 0 ? "negative" : "positive"}">${money(reconciliationDifference)}</strong></div>
          </div>
          <p class="muted">A conferência nunca altera lançamentos anteriores. Depois da prévia e da sua confirmação, somente a diferença vira um novo Ajuste da conta, identificado no histórico e na auditoria.</p>
          ${(state.financialPlanning?.reconciliationHistory || []).length ? `
            <h3>Últimas conciliações</h3>
            <div class="recent-list">
              ${(state.financialPlanning.reconciliationHistory || []).slice(0, 8).map(item => `
                <span>
                  <b>${formatIsoDateBr(item.date)} · ${money(item.realBalance)}</b>
                  ${reconciliationAccountLabel(item.cashAccount || "all")} - Ajuste ${money(item.difference)}
                  <small>${escapeHtml(item.authorizedBy || "Sistema")} · ${escapeHtml(item.reason || "Conta conferida")}</small>
                  ${canUser("editFinancial") ? `
                    <div class="table-actions">
                      <button class="secondary table-action" type="button" data-edit-reconciliation="${escapeHtml(item.id)}">Editar</button>
                      <button class="danger table-action" type="button" data-delete-reconciliation="${escapeHtml(item.id)}">Excluir</button>
                    </div>
                  ` : ""}
                </span>
              `).join("")}
            </div>
          ` : ""}
        </div>
        ` : ""}
        ${activeCashPanel === "day-closing" ? dailyClosingPanelHtml(dailyClosingData, dailyClosingRecord) : ""}
        ${activeCashPanel === "transfers" ? accountTransferPanelHtml(today) : ""}
        ${activeCashPanel === "savings" ? `
        <div class="cash-tab-section savings-panel">
        <h2>${editingSavingsEntry ? "Editar registro do cofrinho" : "Cofrinho"}</h2>
        <div class="inline-callout savings-transfer-callout">
          <div>
            <strong>Vai mover dinheiro entre o Cofrinho e PF/PJ?</strong>
            <small>Use uma transferência vinculada para não duplicar receita ou despesa.</small>
          </div>
          <button class="secondary" type="button" id="open-savings-transfer">Transferir saldo</button>
        </div>
        <form id="savings-form" class="form-grid single">
          <input name="savingsEntryId" type="hidden" value="${escapeHtml(editingSavingsEntry?.id || "")}">
          <div class="summary compact-summary">
            <div class="metric"><span>Valor atual</span><strong>${money(savingsCurrent)}</strong></div>
            <div class="metric"><span>Deveria ter hoje</span><strong>${money(savingsExpected)}</strong></div>
            <div class="metric"><span>Devemos ao cofrinho</span><strong class="${savingsDebt > 0 ? "negative" : "positive"}">${money(savingsDebt)}</strong></div>
            <div class="metric"><span>Atualizado em</span><strong>${savingsPlanning.savingsUpdatedAt ? formatIsoDateBr(savingsPlanning.savingsUpdatedAt) : "Sem data"}</strong></div>
            <div class="metric"><span>Últimos registros</span><strong>${savingsRows.length}</strong></div>
          </div>
          ${editingSavingsEntry ? `
          <label>Data do registro
            <input name="date" type="date" value="${escapeHtml(editingSavingsEntry.date || today)}" required>
          </label>
          <label>Tipo de registro
            <select name="type">
              <option value="set" ${editingSavingsEntry.type === "set" ? "selected" : ""}>Saldo informado</option>
              <option value="deposit" ${editingSavingsEntry.type === "deposit" ? "selected" : ""}>Entrada no cofrinho</option>
              <option value="withdrawal" ${editingSavingsEntry.type === "withdrawal" ? "selected" : ""}>Retirada do cofrinho</option>
            </select>
          </label>
          <label>Valor
            <input name="amount" type="text" inputmode="decimal" placeholder="0,00" value="${moneyInputValue(editingSavingsEntry.amount)}" required>
          </label>
          <label>Observação
            <input name="description" placeholder="Ex.: tirei para compra, conferência do caixa" value="${escapeHtml(editingSavingsEntry.description || "")}">
          </label>
          <div class="actions">
            <button type="submit">Salvar registro</button>
            <button class="secondary" type="button" id="cancel-savings-edit">Cancelar</button>
          </div>
          ` : `
          <label>Data do registro
            <input name="date" type="date" value="${today}" required>
          </label>
          <label>Valor que tenho no cofrinho hoje
            <input name="balance" type="text" inputmode="decimal" placeholder="0,00" value="${moneyInputValue(savingsCurrent)}" required>
          </label>
          <label>Valor que deveria ter hoje
            <input name="expectedBalance" type="text" inputmode="decimal" placeholder="0,00" value="${moneyInputValue(savingsExpected)}" required>
          </label>
          <label>Retirada feita do cofrinho
            <input name="withdrawal" type="text" inputmode="decimal" placeholder="0,00">
          </label>
          <label>Observação
            <input name="description" placeholder="Ex.: tirei para compra, conferência do caixa">
          </label>
          <button type="submit">Salvar cofrinho</button>
          `}
        </form>
        ${savingsTracePanelHtml(savingsRows, {
          current: savingsCurrent,
          expected: savingsExpected,
          debt: savingsDebt
        })}
        <h3>Histórico do cofrinho</h3>
        ${savingsRows.length ? `
          <div class="recent-list">
            ${savingsRows.slice(0, 8).map(entry => `
              <span>
                <b>${entry.type === "withdrawal" ? "-" : entry.type === "deposit" ? "+" : ""}${money(entry.amount)}</b>
                ${entry.type === "withdrawal" ? "Retirada" : entry.type === "deposit" ? "Entrada" : "Saldo informado"}
                ${savingsHistoryDetailHtml(entry)}
                ${canUser("editFinancial") && !entry.cashAccountMovement && !savingsCoverageSourceEntry(entry) ? `
                  <span class="today-order-actions">
                    <button class="secondary table-action" type="button" data-edit-savings-entry="${escapeHtml(entry.id)}">Editar</button>
                    <button class="danger table-action" type="button" data-delete-savings-entry="${escapeHtml(entry.id)}">Excluir</button>
                  </span>
                ` : ""}
              </span>
            `).join("")}
          </div>
        ` : `<p class="muted">Nenhum registro do cofrinho ainda.</p>`}
        </div>
        ` : ""}
        ${activeCashPanel === "withdrawals" ? `
        <div class="cash-tab-section withdrawal-panel">
        <h2>${editingWithdrawal ? "Editar retirada" : "Retiradas"}</h2>
        <p class="muted-inline">O saldo real mostra somente o dinheiro que existe na conta. Os valores a receber das sócias vêm da conta-corrente e nunca criam entrada bancária fictícia.</p>
        <div class="partners-dashboard">
          <section>
            <h3>Valores compensados ao caixa · ${formatMonthKeyBr(partnersPeriod)}</h3>
            <div class="summary">
              <div class="metric"><span>Vanessa</span><strong>${partnerCashOffsetLabel(partnersDashboard.month.paidToCashVanessa)}</strong></div>
              <div class="metric"><span>Raquel</span><strong>${partnerCashOffsetLabel(partnersDashboard.month.paidToCashRaquel)}</strong></div>
            </div>
          </section>
          <section>
            <h3>Semana de ${formatIsoDateBr(partnersDashboard.weekStart)} a ${formatIsoDateBr(partnersDashboard.weekEnd)}</h3>
            <div class="summary">
              <div class="metric"><span>Vanessa - recebeu da conta</span><strong>${money(partnersDashboard.week.vanessa)}</strong></div>
              <div class="metric"><span>Raquel - distribuição</span><strong>${money(partnersDashboard.week.raquel + partnersDashboard.week.paidToCashRaquel)}</strong></div>
              <div class="metric"><span>Cofrinho transferido</span><strong>${money(partnersDashboard.week.savings)}</strong></div>
            </div>
          </section>
          <section>
            <h3>${formatMonthKeyBr(partnersPeriod)}</h3>
            <div class="summary">
              <div class="metric"><span>Lucro operacional</span><strong>${money(partnersDashboard.monthOperationalProfit)}</strong></div>
              <div class="metric"><span>Vanessa - recebeu da conta</span><strong>${money(partnersDashboard.month.vanessa)}</strong></div>
              <div class="metric"><span>Raquel - distribuição</span><strong>${money(partnersDashboard.month.raquel + partnersDashboard.month.paidToCashRaquel)}</strong></div>
              <div class="metric"><span>Cofrinho no mês</span><strong>${money(partnersDashboard.month.expectedSavings)}</strong></div>
            </div>
          </section>
        </div>
        <h3>${editingWithdrawal ? "Editar registro de retirada" : "Registrar retirada"}</h3>
        <form id="withdrawal-form" class="form-grid single">
          <label>Data
            <input name="date" type="date" value="${editingWithdrawal?.date || today}" required>
          </label>
          <label>Conta de onde saiu o dinheiro
            <select name="cashAccount" required>
              ${cashAccountOptionsHtml(withdrawalCashAccount, "expense")}
            </select>
          </label>
          <div class="withdrawal-value-group">
            <strong>1. Caixa real e valores a receber</strong>
            <p class="muted-inline">Confira o saldo real antes de qualquer pagamento registrado nesta quebra. As dívidas abaixo são calculadas pelo histórico individual das sócias.</p>
            <div class="withdrawal-fields">
              <label>Caixa real disponível
                <input name="accountBalanceBefore" type="text" inputmode="decimal" value="${moneyInputValue(withdrawalAccountBalance)}">
              </label>
              <div class="partner-debt-readonly" data-withdrawal-debt="vanessa"><span>Valor a receber de Vanessa</span><strong>${money(withdrawalDebtVanessa)}</strong><small>Não está no banco</small></div>
              <div class="partner-debt-readonly" data-withdrawal-debt="raquel"><span>Valor a receber de Raquel</span><strong>${money(withdrawalDebtRaquel)}</strong><small>Não está no banco</small></div>
              <input name="priorVanessa" type="hidden" value="${withdrawalDebtVanessa}">
              <input name="priorRaquel" type="hidden" value="${withdrawalDebtRaquel}">
            </div>
          </div>
          <div class="withdrawal-value-group">
            <strong>2. Divisão automática</strong>
            <p class="muted-inline">Base ajustada = caixa real + valores a receber. O sistema usa a configuração central: ${Number(state.appConfig.splitSavingsPercent || 0)}% para o cofrinho e, no restante, ${Number(state.appConfig.splitVanessaPercent || 0)}% para Vanessa / ${Number(state.appConfig.splitRaquelPercent || 0)}% para Raquel.</p>
            <div class="withdrawal-fields">
              <label>Cofrinho - direito
                <input name="expectedSavings" type="text" inputmode="decimal" value="${moneyInputValue(withdrawalFormValues.expectedSavings)}" readonly>
              </label>
              <label>Vanessa - direito
                <input name="expectedVanessa" type="text" inputmode="decimal" value="${moneyInputValue(withdrawalFormValues.expectedVanessa)}" readonly>
              </label>
              <label>Raquel - direito
                <input name="expectedRaquel" type="text" inputmode="decimal" value="${moneyInputValue(withdrawalFormValues.expectedRaquel)}" readonly>
              </label>
            </div>
          </div>
          <div class="withdrawal-value-group">
            <strong>3. O que fazer com a dívida nesta retirada</strong>
            <p class="muted-inline">A dívida só será reduzida se você escolher pagar ou compensar. Se escolher não compensar, ela permanece em Sócias.</p>
            <div class="withdrawal-fields partner-settlement-fields">
              <label>Vanessa
                <select name="partnerActionVanessa">
                  <option value="discount">Compensar toda a dívida possível</option>
                  <option value="partial">Compensar parcialmente</option>
                  <option value="pay">Pagar agora</option>
                  <option value="keep" selected>Não compensar nesta retirada</option>
                </select>
              </label>
              <label data-partner-settlement-amount="vanessa">Valor Vanessa
                <input name="partnerSettlementVanessa" type="text" inputmode="decimal" value="${moneyInputValue(withdrawalDebtVanessa)}">
              </label>
              <label>Raquel
                <select name="partnerActionRaquel">
                  <option value="discount">Compensar toda a dívida possível</option>
                  <option value="partial">Compensar parcialmente</option>
                  <option value="pay">Pagar agora</option>
                  <option value="keep" selected>Não compensar nesta retirada</option>
                </select>
              </label>
              <label data-partner-settlement-amount="raquel">Valor Raquel
                <input name="partnerSettlementRaquel" type="text" inputmode="decimal" value="${moneyInputValue(withdrawalDebtRaquel)}">
              </label>
            </div>
          </div>
          <div class="withdrawal-value-group">
            <strong>4. Quanto realmente sairá da conta agora</strong>
            <p class="muted-inline">O total abaixo considera somente dinheiro físico transferido. Compensações não aparecem como entrada bancária.</p>
            <div class="withdrawal-fields">
              <label>Cofrinho agora
                <input name="savings" type="text" inputmode="decimal" value="${moneyInputValue(withdrawalFormValues.savings)}">
              </label>
              <label>Vanessa agora
                <input name="vanessa" type="text" inputmode="decimal" value="${moneyInputValue(withdrawalFormValues.vanessa)}">
              </label>
              <label>Raquel agora
                <input name="raquel" type="text" inputmode="decimal" value="${moneyInputValue(withdrawalFormValues.raquel)}">
              </label>
            </div>
          </div>
          <div class="withdrawal-preview" aria-live="polite">
            <span><b>Saldo calculado pelo sistema</b>${money(calculatedWithdrawalAccountBalance)}</span>
            <span><b>Saldo real da conta</b>${money(withdrawalAccountBalance)}</span>
            <span><b>Ajuste para igualar ao banco</b>${money(withdrawalBalanceDifference)}</span>
            <span><b>Valores a receber das sócias</b>${money(withdrawalDebtVanessa + withdrawalDebtRaquel)}<small>Não estão no banco</small></span>
            <span><b>Base ajustada para a quebra</b>${money(withdrawalFormValues.distributionBase)}</span>
            <span><b>Total que sai agora</b>${money(withdrawalFormValues.total)}</span>
            <span><b>Saldo da conta depois</b>${money(previewAccountAfterWithdrawal)}</span>
            <span><b>Vanessa - recebe da conta</b>${money(withdrawalFormValues.vanessa)}</span>
            <span><b>Raquel - recebe da conta</b>${money(withdrawalFormValues.raquel)}</span>
            ${Number(withdrawalFormValues.paidToCashVanessa || 0) > 0 ? `<span><b>Vanessa - dívida compensada</b>${money(withdrawalFormValues.paidToCashVanessa)}<small>Não movimenta a conta</small></span>` : ""}
            ${Number(withdrawalFormValues.paidToCashRaquel || 0) > 0 ? `<span><b>Raquel - dívida compensada</b>${money(withdrawalFormValues.paidToCashRaquel)}<small>Não movimenta a conta</small></span>` : ""}
          </div>
          <div class="actions">
            <button type="submit">${editingWithdrawal ? "Salvar retirada" : "Registrar retiradas"}</button>
            ${editingWithdrawal ? `<button class="secondary" type="button" id="cancel-withdrawal-edit">Cancelar</button>` : ""}
          </div>
        </form>
        <h3>Histórico de retiradas do mês</h3>
        ${withdrawalHistoryHtml(selectedMonth)}
        <details class="partners-manual-adjustment">
          <summary>Registro manual antigo do mês</summary>
          <p class="muted-inline">Use somente para consultar ou corrigir controles antigos. Nas novas retiradas, valores já retirados e valores compensados ao caixa ficam separados.</p>
          <form id="partners-form" class="form-grid single">
            <label>Mês do registro
              <input name="periodKey" type="month" value="${partnersRecord.periodKey}" required>
            </label>
            <label>Vanessa - valor informado
              <input name="vanessa" type="text" inputmode="decimal" placeholder="0,00" value="${moneyInputValue(partnersRecord.vanessa)}">
            </label>
            <label>Raquel - valor informado
              <input name="raquel" type="text" inputmode="decimal" placeholder="0,00" value="${moneyInputValue(partnersRecord.raquel)}">
            </label>
            <label>Compensação antiga informada
              <input name="difference" type="text" inputmode="decimal" placeholder="0,00" value="${moneyInputValue(partnersRecord.difference)}">
            </label>
            <label>Observação
              <input name="notes" placeholder="Ex.: antecipação de período anterior" value="${escapeHtml(partnersRecord.notes || "")}">
            </label>
            <button type="submit">Salvar registro antigo</button>
          </form>
        </details>
        <h3>Histórico de ajustes manuais</h3>
        ${partnersHistoryRows().length ? `
          <div class="recent-list">
            ${partnersHistoryRows().slice(0, 8).map(entry => `
              <span>
                <b>${formatMonthKeyBr(entry.periodKey)}</b>
                Vanessa ${money(entry.vanessa)} / Raquel ${money(entry.raquel)}
                <small>Compensação informada ${money(entry.difference)}${entry.notes ? ` - ${escapeHtml(entry.notes)}` : ""}</small>
              </span>
            `).join("")}
          </div>
        ` : `<p class="muted">Nenhum registro manual antigo.</p>`}
        </div>
        ` : ""}
        ${activeCashPanel === "categories" ? cashCategoriesPanel("cash-tab-section supplier-panel") : ""}
        ${activeCashPanel === "ledger" ? `
        <div class="cash-tab-section cash-ledger-panel">
        <div class="cash-ledger-header">
          <div>
            <h2>${isExpensesRoute ? "Despesas lançadas" : "Extrato"}</h2>
            <p class="muted-inline">${isExpensesRoute ? "Consulte e edite somente as despesas operacionais." : "Filtre, confira categorias e edite lançamentos."}</p>
          </div>
        </div>
        <details class="cash-filter-disclosure" ${advancedCashFilterActive ? "open" : ""}>
          <summary>
            <span>
              <b>Filtros avançados</b>
              <small>Período, tipo, categoria, conta e busca</small>
            </span>
            <span class="cash-filter-disclosure-state" aria-hidden="true">${advancedCashFilterActive ? "Filtros ativos" : "Mostrar filtros"}</span>
          </summary>
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
          ${isExpensesRoute ? `<input name="type" type="hidden" value="expense">` : `<label>Tipo
            <select name="type" id="cash-filter-type">
              <option value="all" ${selectedFilterType === "all" ? "selected" : ""}>Entradas e saídas</option>
              <option value="income" ${selectedFilterType === "income" ? "selected" : ""}>Entradas</option>
              <option value="expense" ${selectedFilterType === "expense" ? "selected" : ""}>Saídas</option>
            </select>
          </label>`}
          <label>Origem / categoria
            <select name="category" id="cash-filter-category">
              ${cashFilterCategoryOptions(selectedFilterCategory, selectedFilterType)}
            </select>
          </label>
          <label>Conta
            <select name="cashAccount" id="cash-filter-account">
            ${cashAccountOptionsHtml(selectedFilterAccount, selectedFilterType === "expense" ? "expense" : "income", true, "", true)}
            </select>
          </label>
          <label>Buscar
            <input name="search" placeholder="Nome, motivo ou origem" value="${state.cashFilter.search || ""}">
          </label>
          <div class="cash-filter-actions">
            <button class="secondary" type="button" id="clear-cash-filter">Limpar filtros</button>
            <button type="submit">Aplicar</button>
          </div>
        </form>
        </details>
        <div class="quick-filter-bar">
          <button class="secondary ${currentCashFilter.period === "day" && selectedDate === today && !selectedQuickFilter ? "active" : ""}" type="button" data-cash-quick="today">Hoje</button>
          <button class="secondary ${currentCashFilter.period === "day" && selectedDate === yesterdayDate && !selectedQuickFilter ? "active" : ""}" type="button" data-cash-quick="yesterday">Ontem</button>
          <button class="secondary ${currentCashFilter.period === "week" && !selectedQuickFilter ? "active" : ""}" type="button" data-cash-quick="week">Esta semana</button>
          <button class="secondary ${currentCashFilter.period === "month" && selectedMonth === today.slice(0, 7) && !selectedQuickFilter ? "active" : ""}" type="button" data-cash-quick="month">Este mês</button>
          <button class="secondary ${selectedQuickFilter === "pending" ? "active" : ""}" type="button" data-cash-quick="pending">Pendentes</button>
          <button class="secondary ${selectedQuickFilter === "savings" ? "active" : ""}" type="button" data-cash-quick="savings">Cofrinho</button>
          <button class="secondary ${selectedQuickFilter === "withdrawals" ? "active" : ""}" type="button" data-cash-quick="withdrawals">Retiradas</button>
        </div>
        <div class="summary">
          <div class="metric"><span>Entradas operacionais</span><strong>${money(operationalTotals.income)}</strong></div>
          <div class="metric"><span>Saídas operacionais</span><strong>${money(operationalTotals.expenses)}</strong></div>
          <div class="metric"><span>Ajustes da conta</span><strong class="${filteredAdjustmentTotals.balance < 0 ? "negative" : "positive"}">${money(filteredAdjustmentTotals.balance)}</strong></div>
          <div class="metric"><span>${balanceLabel}</span><strong class="${displayedCashBalance < 0 ? "negative" : "positive"}">${money(displayedCashBalance)}</strong></div>
        </div>
        ${cashAccountSummary(businessCashEntries(accountedEntries))}
        ${cashCategorySummary(businessCashEntries(categoryMenuAccountedEntries), selectedFilterCategory)}
        ${cashTable(filteredLedgerEntries)}
        </div>
        ` : ""}
      </section>
    </div>
  `;

  on("[data-review-unassigned-cash]", "click", () => {
    state.cashPanelTab = "ledger";
    state.cashFilter = {
      period: "all",
      date: today,
      month: today.slice(0, 7),
      year: today.slice(0, 4),
      type: "all",
      category: "all",
      cashAccount: "unassigned",
      quick: "",
      search: "",
      manualAll: true
    };
    persistState();
    renderCash();
  });

  document.querySelectorAll("[data-cash-summary-category]").forEach(button => {
    button.addEventListener("click", event => {
      const category = event.currentTarget.dataset.cashSummaryCategory;
      const currentFilter = getCashFilter();
      const active = normalizedCategory(currentFilter.category) === normalizedCategory(category);
      state.cashFilter = {
        ...currentFilter,
        type: "all",
        category: active ? "all" : category,
        quick: "",
        search: "",
        manualAll: currentFilter.period === "all"
      };
      state.cashSort = { key: "date", direction: "desc" };
      persistState();
      renderCash();
      requestAnimationFrame(() => {
        document.querySelector("[data-cash-ledger-results]")?.scrollIntoView({ block: "start" });
      });
    });
  });

  document.querySelectorAll("[data-cash-panel]").forEach(button => {
    button.addEventListener("click", event => {
      state.cashPanelTab = event.currentTarget.dataset.cashPanel;
      if (state.cashPanelTab !== "entry") {
        state.editCashId = null;
      }
      if (state.cashPanelTab !== "withdrawals") {
        state.editWithdrawalGroup = null;
      }
      if (state.cashPanelTab !== "savings") {
        state.editSavingsEntryId = null;
      }
      if (state.cashPanelTab !== "transfers") {
        state.editAccountTransferId = null;
      }
      if (state.cashPanelTab !== "reconciliation") {
        state.editReconciliationId = null;
      }
      if (state.cashPanelTab !== "categories") {
        state.editCashCategory = null;
      }
      renderCash();
    });
  });

  const dailyReconciliationForm = document.querySelector("#daily-reconciliation-form");
  if (dailyReconciliationForm) {
    const updateReconciliationPreview = () => {
      const date = dailyReconciliationForm.elements.date.value || today;
      const realBalance = parseMoneyInput(dailyReconciliationForm.elements.realBalance.value);
      const cashAccount = reconciliationCashAccount(dailyReconciliationForm.elements.cashAccount?.value || "all");
      const reconciliationId = dailyReconciliationForm.elements.reconciliationId?.value || "";
      const currentReconciliation = (state.financialPlanning?.reconciliationHistory || [])
        .find(item => String(item.id) === String(reconciliationId));
      const calculatedBalance = reconciliationCalculatedBalance(date, currentReconciliation, cashAccount);
      const difference = realBalance - calculatedBalance;
      const accountElement = document.querySelector("#reconciliation-account-label");
      const calculatedElement = document.querySelector("#reconciliation-calculated");
      const realElement = document.querySelector("#reconciliation-real");
      const differenceElement = document.querySelector("#reconciliation-difference");
      if (accountElement) {
        accountElement.textContent = reconciliationAccountLabel(cashAccount);
      }
      calculatedElement.textContent = money(calculatedBalance);
      calculatedElement.className = calculatedBalance < 0 ? "negative" : "positive";
      realElement.textContent = money(realBalance);
      differenceElement.textContent = money(difference);
      differenceElement.className = difference < 0 ? "negative" : "positive";
    };
    dailyReconciliationForm.addEventListener("input", updateReconciliationPreview);

    on("#cancel-reconciliation-edit", "click", () => {
      state.editReconciliationId = null;
      renderCash();
    });

    document.querySelectorAll("[data-edit-reconciliation]").forEach(button => {
      button.addEventListener("click", event => {
        state.editReconciliationId = event.currentTarget.dataset.editReconciliation;
        state.cashPanelTab = "reconciliation";
        renderCash();
      });
    });

    document.querySelectorAll("[data-delete-reconciliation]").forEach(button => {
      button.addEventListener("click", async event => {
        const reconciliationId = event.currentTarget.dataset.deleteReconciliation;
        const history = state.financialPlanning?.reconciliationHistory || [];
        const reconciliation = history.find(item => String(item.id) === String(reconciliationId));
        if (!reconciliation) {
          showToast("Conciliação não encontrada.", "warning");
          return;
        }
        if (!canUser("editFinancial")) {
          showToast("Seu usuário não pode apagar conciliações financeiras.", "error");
          return;
        }
        if (blockClosedPeriod(reconciliation.date, "apagar conciliação")) {
          return;
        }
        if (reconciliation.adjustmentId) {
          const adjustmentEntry = state.cash.find(entry => String(entry.id) === String(reconciliation.adjustmentId));
          if (adjustmentEntry?.date && blockClosedPeriod(adjustmentEntry.date, "apagar ajuste de conciliação")) {
            return;
          }
        }
        const deleteMessage = reconciliation.adjustmentId
          ? `Apagar a conciliação de ${formatIsoDateBr(reconciliation.date)}? O ajuste de caixa vinculado também será removido.`
          : `Apagar a conciliação de ${formatIsoDateBr(reconciliation.date)}?`;
        if (!confirm(deleteMessage)) {
          return;
        }
        state.cash = state.cash.filter(entry => String(entry.id) !== String(reconciliation.adjustmentId || ""));
        state.financialPlanning = {
          ...(state.financialPlanning || {}),
          reconciliationHistory: history.filter(item => String(item.id) !== String(reconciliation.id))
        };
        if (String(state.editReconciliationId || "") === String(reconciliation.id)) {
          state.editReconciliationId = null;
        }
        recordAudit("Conciliação apagada", `${formatIsoDateBr(reconciliation.date)} - saldo real ${money(reconciliation.realBalance)} - ajuste ${money(reconciliation.difference)}`, {
          entityId: reconciliation.adjustmentId || reconciliation.id,
          reconciliationId: reconciliation.id,
          adjustmentId: reconciliation.adjustmentId || ""
        });
        if (await persistState()) {
          showToast("Conciliação apagada.", "success");
          renderCash();
        }
      });
    });

    dailyReconciliationForm.addEventListener("submit", async event => {
      event.preventDefault();
      const values = readForm(event.currentTarget);
      const reconciliationId = values.reconciliationId || "";
      const history = state.financialPlanning?.reconciliationHistory || [];
      const date = values.date || today;
      const cashAccount = normalizedCashAccount(values.cashAccount);
      const previousReconciliation = history.find(item => String(item.id) === String(reconciliationId))
        || (!reconciliationId ? history.find(item =>
          String(item.date) === String(date)
          && reconciliationCashAccount(item.cashAccount || "all") === cashAccount
        ) : null);
      const realBalance = parseMoneyInput(values.realBalance);
      const calculatedBalance = reconciliationCalculatedBalance(date, previousReconciliation, cashAccount);
      const difference = realBalance - calculatedBalance;
      const reason = String(values.reason || "Conta conferida").trim();
      const authorizedBy = state.currentUser?.name || state.currentUser?.username || "Sistema";
      if (!canUser("editFinancial")) {
        showToast("Seu usuário não pode autorizar ajustes financeiros.", "error");
        return;
      }
      if (previousReconciliation?.date && previousReconciliation.date !== date
        && blockClosedPeriod(previousReconciliation.date, "editar conciliação")) {
        return;
      }
      if (previousReconciliation?.adjustmentId) {
        const previousAdjustment = state.cash.find(entry => String(entry.id) === String(previousReconciliation.adjustmentId));
        if (previousAdjustment?.date && blockClosedPeriod(previousAdjustment.date, "editar ajuste de conciliação")) {
          return;
        }
      }
      if (Math.abs(difference) < 0.01) {
        if (previousReconciliation?.adjustmentId) {
          state.cash = state.cash.filter(entry => String(entry.id) !== String(previousReconciliation.adjustmentId));
        }
        const nextReconciliation = {
          id: previousReconciliation?.id || `reconciliation-${Date.now()}`,
          date,
          calculatedBalance: calculatedBalance.toFixed(2),
          realBalance: realBalance.toFixed(2),
          difference: "0.00",
          cashAccount,
          reason,
          authorizedBy,
          username: state.currentUser?.username || previousReconciliation?.username || "",
          createdAt: previousReconciliation?.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          status: "matched"
        };
        state.financialPlanning = {
          ...(state.financialPlanning || {}),
          reconciliationHistory: previousReconciliation
            ? history.map(item => String(item.id) === String(previousReconciliation.id) ? nextReconciliation : item)
            : [nextReconciliation, ...history].slice(0, 250)
        };
        state.editReconciliationId = null;
        recordAudit(previousReconciliation ? "Conciliação editada" : "Conciliação da conta", `${formatIsoDateBr(date)} - ${reconciliationAccountLabel(cashAccount)} - sem diferença - autorizado por ${authorizedBy}`, {
          cashAccount
        });
        if (await persistState()) {
          showToast(previousReconciliation ? "Conciliação atualizada." : "Conciliação registrada sem diferença.", "success");
          renderCash();
        }
        return;
      }
      if (blockClosedPeriod(date, "lançar ajuste de conferência")) {
        return;
      }
      const adjustmentType = difference > 0 ? "income" : "expense";
      const adjustmentAmount = Math.abs(difference);
      const actionLabel = adjustmentType === "expense" ? "saída" : "entrada";
      const confirmation = [
        `${previousReconciliation ? "Salvar alteração da conciliação" : "Confirmar novo ajuste de conciliação"}?`,
        "",
        `Conta: ${reconciliationAccountLabel(cashAccount)}`,
        `Data: ${formatIsoDateBr(date)}`,
        `Saldo calculado: ${money(calculatedBalance)}`,
        `Saldo real informado: ${money(realBalance)}`,
        `${actionLabel === "saída" ? "Saída" : "Entrada"} de ajuste: ${money(adjustmentAmount)}`,
        `Motivo: ${reason}`,
        "",
        "Nenhum lançamento anterior será alterado."
      ].join("\n");
      if (!confirm(confirmation)) {
        return;
      }
      const adjustmentId = previousReconciliation?.adjustmentId || `account-check-${Date.now()}`;
      const adjustmentEntry = {
        id: adjustmentId,
        description: `Ajuste de conferência ${reconciliationAccountLabel(cashAccount)} - ${reason}`,
        date,
        type: adjustmentType,
        category: "ajuste-conta",
        cashAccount,
        amount: adjustmentAmount.toFixed(2),
        reconciliation: true,
        authorizedBy,
        authorizedUsername: state.currentUser?.username || "",
        calculatedBalance: calculatedBalance.toFixed(2),
        realBalance: realBalance.toFixed(2)
      };
      if (previousReconciliation?.adjustmentId && state.cash.some(entry => String(entry.id) === String(adjustmentId))) {
        state.cash = state.cash.map(entry => String(entry.id) === String(adjustmentId) ? adjustmentEntry : entry);
      } else {
        state.cash.push(adjustmentEntry);
      }
      const nextReconciliation = {
        id: previousReconciliation?.id || `reconciliation-${Date.now()}`,
        adjustmentId,
        date,
        calculatedBalance: calculatedBalance.toFixed(2),
        realBalance: realBalance.toFixed(2),
        difference: difference.toFixed(2),
        cashAccount,
        reason,
        authorizedBy,
        username: state.currentUser?.username || previousReconciliation?.username || "",
        createdAt: previousReconciliation?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: "adjusted"
      };
      state.financialPlanning = {
        ...(state.financialPlanning || {}),
        reconciliationHistory: previousReconciliation
          ? history.map(item => String(item.id) === String(previousReconciliation.id) ? nextReconciliation : item)
          : [nextReconciliation, ...history].slice(0, 250)
      };
      state.editReconciliationId = null;
      state.cashFilter = {
        ...state.cashFilter,
        period: "day",
        date,
        month: date.slice(0, 7),
        year: date.slice(0, 4),
        type: "all",
        category: "ajuste-conta",
        cashAccount,
        search: "",
        manualAll: false
      };
      recordAudit(previousReconciliation ? "Conciliação editada" : "Conciliação da conta", `${formatIsoDateBr(date)} - ${reconciliationAccountLabel(cashAccount)} - saldo real ${money(realBalance)} - ajuste ${money(difference)} - autorizado por ${authorizedBy}`, {
        entityId: adjustmentId,
        calculatedBalance: calculatedBalance.toFixed(2),
        realBalance: realBalance.toFixed(2),
        difference: difference.toFixed(2),
        cashAccount
      });
      if (await persistState()) {
        showToast(previousReconciliation ? "Conciliação atualizada." : "Ajuste de conferência lançado.", "success");
        renderCash();
      }
    });
  }

  const dailyClosingForm = document.querySelector("#daily-closing-form");
  if (dailyClosingForm) {
    const updateDailyClosingPreview = () => {
      const date = dailyClosingForm.elements.date.value || today;
      const realBalance = parseMoneyInput(dailyClosingForm.elements.realBalance.value);
      const metrics = dailyClosingMetrics(date, realBalance);
      const realElement = document.querySelector("#day-closing-real");
      const differenceElement = document.querySelector("#day-closing-difference");
      if (realElement) {
        realElement.textContent = money(metrics.realBalance);
      }
      if (differenceElement) {
        differenceElement.textContent = money(metrics.difference);
        differenceElement.className = metrics.difference < 0 ? "negative" : "positive";
      }
    };
    dailyClosingForm.addEventListener("input", updateDailyClosingPreview);

    dailyClosingForm.addEventListener("submit", async event => {
      event.preventDefault();
      const values = readForm(event.currentTarget);
      const date = String(values.date || today).slice(0, 10);
      const realBalance = parseMoneyInput(values.realBalance);
      if (!canUser("manageClosings")) {
        showToast("Seu usuário não pode fechar períodos.", "error");
        return;
      }
      if (!date) {
        showToast("Informe a data do fechamento.", "error");
        return;
      }
      if (blockClosedPeriod(date, "fechar o dia")) {
        return;
      }
      if (!confirm(`Fechar o dia ${formatIsoDateBr(date)} com saldo real ${money(realBalance)}?`)) {
        return;
      }
      state.financialPlanning = {
        ...(state.financialPlanning || {}),
        dailyClosings: {
          ...dailyClosings(),
          [date]: dailyClosingPayload(date, realBalance, values.notes)
        }
      };
      recordAudit("Dia fechado", `${formatIsoDateBr(date)} - saldo real ${money(realBalance)}`);
      if (await persistState()) {
        showToast("Dia fechado.", "success");
        renderCash();
      }
    });

    on("#reopen-day-closing", "click", async () => {
      const date = String(dailyClosingForm.elements.date.value || today).slice(0, 10);
      const closing = dayClosingForDate(date);
      if (!canUser("manageClosings")) {
        showToast("Seu usuário não pode reabrir períodos.", "error");
        return;
      }
      if (!closing) {
        showToast("Fechamento do dia não encontrado.", "warning");
        return;
      }
      const reason = prompt(`Informe o motivo para reabrir o dia ${formatIsoDateBr(date)}.`);
      if (!reason || reason.trim().length < 5) {
        showToast("Informe o motivo da reabertura.", "warning");
        return;
      }
      state.financialPlanning = {
        ...(state.financialPlanning || {}),
        dailyClosings: {
          ...dailyClosings(),
          [date]: {
            ...closing,
            locked: false,
            reopenedAt: new Date().toISOString(),
            reopenedBy: state.currentUser?.name || state.currentUser?.username || "Usuário",
            reopenedByUsername: state.currentUser?.username || "",
            reopenReason: reason.trim()
          }
        }
      };
      recordAudit("Dia reaberto", `${formatIsoDateBr(date)} - ${reason.trim()}`);
      if (await persistState()) {
        showToast("Dia reaberto. Alterações estão liberadas.", "success");
        renderCash();
      }
    });

    on("#open-reconciliation-from-closing", "click", () => {
      const date = String(dailyClosingForm.elements.date.value || today).slice(0, 10);
      state.cashFilter = {
        ...state.cashFilter,
        period: "day",
        date,
        month: date.slice(0, 7),
        year: date.slice(0, 4),
        type: "all",
        category: "all",
        search: "",
        manualAll: false
      };
      state.cashPanelTab = "reconciliation";
      state.editReconciliationId = null;
      renderCash();
    });

    document.querySelectorAll("[data-daily-closing-action]").forEach(button => {
      button.addEventListener("click", event => {
        const action = event.currentTarget.dataset.dailyClosingAction;
        const date = String(dailyClosingForm.elements.date.value || today).slice(0, 10);
        if (action === "reconciliation") {
          state.cashFilter = {
            ...state.cashFilter,
            period: "day",
            date,
            month: date.slice(0, 7),
            year: date.slice(0, 4),
            type: "all",
            category: "all",
            search: "",
            manualAll: false
          };
          state.cashPanelTab = "reconciliation";
          state.editReconciliationId = null;
          renderCash();
          return;
        }
        if (action === "savings") {
          state.cashPanelTab = "savings";
          renderCash();
          return;
        }
        if (action === "accounts") {
          state.financeViewTab = "accounts";
          history.pushState(null, "", "/financeiro?view=accounts");
          renderFinance();
          return;
        }
        if (action === "backup") {
          history.pushState(null, "", "/backups?tab=backup");
          renderBackups();
        }
      });
    });
  }

  const cashForm = document.querySelector("#cash-form");
  if (cashForm) {
    cashForm.addEventListener("submit", async event => {
      event.preventDefault();
      const releaseSubmission = lockFormSubmission(event.currentTarget);
      if (!releaseSubmission) {
        return;
      }
      try {
        const values = readForm(event.currentTarget);
        const amount = parseMoneyInput(values.amount);
        if (!values.date || amount <= 0) {
          showToast("Informe data e valor maior que zero.", "error");
          return;
        }
        if (blockClosedPeriod(values.date, editing ? "editar lançamentos" : "lançar no caixa")) {
          return;
        }
        if (editing && editing.date !== values.date && blockClosedPeriod(editing.date, "mover lançamentos")) {
          return;
        }
        const isEmployeeExpense = values.type === "expense"
          && isFinancialEmployeeCategory(values.category);
        if (isEmployeeExpense && financialEmployees().some(employee => employee.active) && !values.employeeId) {
          showToast("Selecione o funcionário que recebeu esse pagamento.", "error");
          return;
        }
        const isDuplicate = !editing && state.cash.some(item =>
          String(item.date || "") === String(values.date || "")
          && String(item.type || "") === String(values.type || "")
          && normalizedCategory(item.category) === normalizedCategory(values.category)
          && String(item.employeeId || "") === String(isEmployeeExpense ? values.employeeId || "" : "")
          && String(item.description || "").trim().toLowerCase() === String(values.description || "").trim().toLowerCase()
          && Number(item.amount || 0) === amount
        );
        if (isDuplicate && !confirm("Já existe um lançamento igual. Salvar mesmo assim?")) {
          return;
        }
        const shouldTrackBillPayment = values.type === "expense" && isBillCategory(values.category);
        const billIsPaid = shouldTrackBillPayment && values.paid === "yes";
        const cashAccount = normalizedCashAccount(values.cashAccount, "");
        if (!cashAccount && (!shouldTrackBillPayment || billIsPaid)) {
          showToast("Selecione a conta usada no lançamento.", "error");
          return;
        }
        const entryId = editing?.id || Date.now();
        const entry = {
          id: entryId,
          ...values,
          cashAccount,
          amount: amount.toFixed(2)
        };
        if (values.type === "income" && normalizedCategory(values.category) === "aporte-socia") {
          entry.nonOperationalPartnerContribution = true;
        } else {
          delete entry.nonOperationalPartnerContribution;
        }
        if (isEmployeeExpense) {
          entry.employeeId = String(values.employeeId || "");
        } else {
          delete entry.employeeId;
        }
        delete entry.paid;
        if (billIsPaid) {
          entry.paidAt = editing?.paidAt || `${values.date}T12:00:00.000Z`;
        } else {
          delete entry.paidAt;
        }

        const prospectiveSavingsHistory = prospectiveSavingsHistoryForCashEntry(entry, editing?.id || "");

        const previousCoverage = editing ? cashSavingsCoverageEntry(editing.id) : null;

        if (editing) {
          state.cash = state.cash.map(item => String(item.id) === String(editing.id) ? entry : item);
          state.editCashId = null;
          recordAudit("Caixa editado", `${entry.description || "Lançamento"} - ${money(entry.amount)}`, {
            entityId: String(entry.id || ""),
            before: editing,
            after: entry
          });
        } else {
          state.cash.push(entry);
          recordAudit("Caixa criado", `${entry.description || "Lançamento"} - ${money(entry.amount)}`);
        }
        if (previousCoverage) {
          removeCashSavingsCoverage(editing.id);
        }
        applySavingsHistory(prospectiveSavingsHistory);
        state.cashFilter = {
          period: "day",
          date: entry.date || today,
          month: String(entry.date || today).slice(0, 7),
          year: String(entry.date || today).slice(0, 4),
          type: "all",
          category: "all",
          cashAccount: entry.cashAccount || "all",
          quick: "",
          search: "",
          manualAll: false
        };

        if (await persistState()) {
          if (!editing) {
            const savedCashEntryDraft = {
              date: values.date || today,
              type: values.type || "income",
              category: values.category || (values.type === "expense" ? "outros" : "venda"),
              cashAccount: normalizedCashAccount(values.cashAccount, "")
            };
            state.cashEntryDraft = savedCashEntryDraft;
            localStorage.setItem("cashEntryDraft", JSON.stringify(savedCashEntryDraft));
          }
          renderCash();
        }
      } finally {
        releaseSubmission();
      }
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
  const cashEmployeeField = document.querySelector("#cash-employee-field");
  const cashEmployeeSelect = document.querySelector("#cash-employee");
  const cashAccountFieldContainer = document.querySelector("#cash-account-field");
  const cashAccountField = document.querySelector("#cash-account");
  const cashEntryDateField = document.querySelector("#cash-entry-date");
  const cashDueDateField = document.querySelector("#cash-due-date-field");
  const cashPaidField = document.querySelector("#cash-paid-field");
  const cashCapitalContributionHint = document.querySelector("#cash-capital-contribution-hint");
  if (cashTypeField && cashCategoryField && cashDueDateField && cashPaidField) {
    const updateCashBillFieldsVisibility = () => {
      const shouldShow = cashTypeField.value === "expense" && isBillCategory(cashCategoryField.value);
      cashDueDateField.hidden = !shouldShow;
      cashDueDateField.querySelector("input").required = shouldShow;
      cashPaidField.hidden = !shouldShow;
      if (cashAccountFieldContainer && cashAccountField) {
        const billIsPaid = shouldShow && cashPaidField.querySelector("input").checked;
        cashAccountFieldContainer.hidden = false;
        cashAccountField.required = !shouldShow || billIsPaid;
        if (!shouldShow && !cashAccountField.value) {
          cashAccountField.value = normalizedCashAccount(state.cashEntryDraft.cashAccount);
        }
      }
      if (!shouldShow) {
        cashDueDateField.querySelector("input").value = "";
        cashPaidField.querySelector("input").checked = false;
      }
    };
    const updateCashEmployeeFieldVisibility = () => {
      if (!cashEmployeeField || !cashEmployeeSelect) {
        return;
      }
      const shouldShow = cashTypeField.value === "expense"
        && isFinancialEmployeeCategory(cashCategoryField.value);
      cashEmployeeField.hidden = !shouldShow;
      cashEmployeeSelect.required = shouldShow && financialEmployees().some(employee => employee.active);
      if (!shouldShow) {
        cashEmployeeSelect.value = "";
      }
    };
    const updateCapitalContributionHint = () => {
      if (!cashCapitalContributionHint) return;
      cashCapitalContributionHint.hidden = !(
        cashTypeField.value === "income" && normalizedCategory(cashCategoryField.value) === "aporte-socia"
      );
    };
    cashTypeField.addEventListener("change", event => {
      const type = event.currentTarget.value;
      cashCategoryField.innerHTML = cashCategoryOptions(type, type === "expense" ? "outros" : "venda");
      if (cashAccountField) {
        cashAccountField.innerHTML = cashAccountOptionsHtml(
          cashAccountField.value,
          type,
          false,
          "Definir quando pagar",
          true
        );
      }
      if (!editing) {
        state.cashEntryDraft.type = type;
        state.cashEntryDraft.category = cashCategoryField.value;
      }
      updateCashBillFieldsVisibility();
      updateCashEmployeeFieldVisibility();
      updateCapitalContributionHint();
    });
    cashAccountField?.addEventListener("change", () => {
      if (!editing) {
        state.cashEntryDraft.cashAccount = normalizedCashAccount(cashAccountField.value);
      }
    });
    cashCategoryField.addEventListener("change", () => {
      if (!editing) {
        state.cashEntryDraft.category = cashCategoryField.value;
      }
      if (cashAccountField && cashTypeField.value === "expense" && isBillCategory(cashCategoryField.value)) {
        cashAccountField.value = "";
      }
      updateCashBillFieldsVisibility();
      updateCashEmployeeFieldVisibility();
      updateCapitalContributionHint();
    });
    cashPaidField.querySelector("input").addEventListener("change", event => {
      if (!event.currentTarget.checked && cashAccountField) {
        cashAccountField.value = "";
      }
      updateCashBillFieldsVisibility();
    });
    cashEmployeeSelect?.addEventListener("change", event => {
      const employee = financialEmployeeById(event.currentTarget.value);
      const description = cashForm?.elements?.description;
      if (employee && description && !description.value.trim()) {
        description.value = `Pagamento - ${employee.name}`;
      }
    });
    updateCashBillFieldsVisibility();
    updateCashEmployeeFieldVisibility();
    updateCapitalContributionHint();
  }

  if (!editing && cashEntryDateField) {
    const updateCashEntryDate = date => {
      cashEntryDateField.value = date;
      state.cashEntryDraft.date = date;
      document.querySelectorAll("[data-cash-entry-date]").forEach(button => {
        const buttonDate = button.dataset.cashEntryDate === "yesterday" ? yesterdayDate : today;
        const active = buttonDate === date;
        button.classList.toggle("active", active);
        button.setAttribute("aria-pressed", String(active));
      });
    };
    cashEntryDateField.addEventListener("change", event => {
      updateCashEntryDate(event.currentTarget.value || today);
    });
    document.querySelectorAll("[data-cash-entry-date]").forEach(button => {
      button.addEventListener("click", event => {
        const date = event.currentTarget.dataset.cashEntryDate === "yesterday" ? yesterdayDate : today;
        updateCashEntryDate(date);
      });
    });
  }

  const cashCategoryAdminForm = document.querySelector("#cash-category-admin-form");
  if (cashCategoryAdminForm) {
    cashCategoryAdminForm.addEventListener("submit", event => {
      event.preventDefault();
      const values = readForm(event.currentTarget);
      const type = state.editCashCategory?.type || (values.type === "expense" ? "expense" : "income");
      const label = String(values.label || "").trim();
      if (!label) {
        return;
      }

      const categoryList = uniqueCategories(state.cashCategories?.[type] || []);
      const existingLabels = new Set(categoryList
        .filter(([key]) => key !== state.editCashCategory?.key)
        .map(([, itemLabel]) => itemLabel.toLowerCase()));
      if (existingLabels.has(label.toLowerCase())) {
        showToast("Essa categoria já existe.", "warning");
        return;
      }

      if (state.editCashCategory) {
        const oldLabel = categoryList.find(([key]) => key === state.editCashCategory.key)?.[1] || "";
        state.cashCategories = {
          ...state.cashCategories,
          [type]: categoryList.map(item => item[0] === state.editCashCategory.key ? [item[0], label] : item)
        };
        recordAudit("Categoria editada", `${type === "income" ? "Entrada" : "Saída"} - ${oldLabel} -> ${label}`);
        state.editCashCategory = null;
      } else {
        const existingKeys = new Set(categoryList.map(([key]) => key));
        let key = slugifyCategory(label);
        let suffix = 2;
        while (existingKeys.has(key)) {
          key = `${slugifyCategory(label)}-${suffix}`;
          suffix += 1;
        }

        state.cashCategories = {
          ...state.cashCategories,
          [type]: uniqueCategories([...categoryList, [key, label]])
        };
        state.archivedCashCategories = {
          income: state.archivedCashCategories?.income || [],
          expense: state.archivedCashCategories?.expense || [],
          [type]: (state.archivedCashCategories?.[type] || []).filter(item => item !== key)
        };
        recordAudit("Categoria criada", `${type === "income" ? "Entrada" : "Saída"} - ${label}`);
      }
      persistState();
      renderCash();
    });
  }

  const cancelCashCategoryEdit = document.querySelector("#cancel-cash-category-edit");
  if (cancelCashCategoryEdit) {
    cancelCashCategoryEdit.addEventListener("click", () => {
      state.editCashCategory = null;
      renderCash();
    });
  }

  document.querySelectorAll("[data-edit-cash-category]").forEach(button => {
    button.addEventListener("click", event => {
      state.editCashCategory = {
        type: event.currentTarget.dataset.editCashCategoryType === "expense" ? "expense" : "income",
        key: event.currentTarget.dataset.editCashCategory
      };
      renderCash();
    });
  });

  document.querySelectorAll("[data-delete-cash-category]").forEach(button => {
    button.addEventListener("click", event => {
      const key = event.currentTarget.dataset.deleteCashCategory;
      const type = event.currentTarget.dataset.deleteCashCategoryType === "expense" ? "expense" : "income";
      const label = (state.cashCategories?.[type] || []).find(([itemKey]) => itemKey === key)?.[1] || categoryName(key);
      if (!confirm(`Excluir a categoria "${label}" da lista? Lançamentos antigos continuam com essa categoria no histórico.`)) {
        return;
      }

      state.archivedCashCategories = {
        income: state.archivedCashCategories?.income || [],
        expense: state.archivedCashCategories?.expense || [],
        [type]: [...new Set([...(state.archivedCashCategories?.[type] || []), key])]
      };
      if (normalizedCategory(state.cashFilter.category) === normalizedCategory(key)) {
        state.cashFilter.category = "all";
      }
      recordAudit("Categoria excluída", `${type === "income" ? "Entrada" : "Saída"} - ${label}`);
      persistState();
      renderCash();
    });
  });

  document.querySelectorAll("[data-reactivate-cash-category]").forEach(button => {
    button.addEventListener("click", event => {
      const key = event.currentTarget.dataset.reactivateCashCategory;
      const type = event.currentTarget.dataset.reactivateCashCategoryType === "expense" ? "expense" : "income";
      const label = (state.cashCategories?.[type] || []).find(([itemKey]) => itemKey === key)?.[1] || categoryName(key);
      state.archivedCashCategories = {
        income: state.archivedCashCategories?.income || [],
        expense: state.archivedCashCategories?.expense || [],
        [type]: (state.archivedCashCategories?.[type] || []).filter(item => item !== key)
      };
      recordAudit("Categoria reativada", `${type === "income" ? "Entrada" : "Saída"} - ${label}`);
      persistState();
      renderCash();
    });
  });

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

  const accountTransferForm = document.querySelector("#account-transfer-form");
  if (accountTransferForm) {
    const originField = accountTransferForm.elements.origin;
    const destinationField = accountTransferForm.elements.destination;
    const rememberTransferDraft = () => {
      state.accountTransferDraft = {
        origin: normalizedAccountTransferAccount(originField.value, "pj"),
        destination: normalizedAccountTransferAccount(destinationField.value, "pf")
      };
    };
    const keepAccountsDifferent = changedField => {
      if (originField.value !== destinationField.value) {
        rememberTransferDraft();
        return;
      }
      const replacement = ["pf", "pj", "savings"].find(account => account !== changedField.value);
      if (changedField === originField) {
        destinationField.value = replacement;
      } else {
        originField.value = replacement;
      }
      rememberTransferDraft();
    };
    originField.addEventListener("change", () => keepAccountsDifferent(originField));
    destinationField.addEventListener("change", () => keepAccountsDifferent(destinationField));

    on("#cancel-account-transfer-edit", "click", () => {
      state.editAccountTransferId = null;
      renderCash();
    });

    accountTransferForm.addEventListener("submit", async event => {
      event.preventDefault();
      const releaseSubmission = lockFormSubmission(event.currentTarget);
      if (!releaseSubmission) return;
      try {
        if (!canUser("editFinancial")) {
          showToast("Seu usuário não tem permissão para transferir valores.", "warning");
          return;
        }
        const values = readForm(event.currentTarget);
        const existing = values.transferId
          ? accountTransferRows().find(transfer => String(transfer.id) === String(values.transferId))
          : null;
        const amount = parseMoneyInput(values.amount);
        const origin = normalizedAccountTransferAccount(values.origin);
        const destination = normalizedAccountTransferAccount(values.destination);
        if (!values.date || amount <= 0) {
          showToast("Informe data e valor maior que zero.", "error");
          return;
        }
        if (!origin || !destination || origin === destination) {
          showToast("Escolha contas de origem e destino diferentes.", "error");
          return;
        }
        if (existing && (existing.reversalOf || accountTransferRows().some(
          transfer => String(transfer.reversalOf || "") === String(existing.id)
        ))) {
          showToast("Transferências estornadas não podem ser editadas.", "warning");
          return;
        }
        if (blockClosedPeriod(values.date, existing ? "editar transferência" : "registrar transferência")) return;
        if (existing && existing.date !== values.date && blockClosedPeriod(existing.date, "mover transferência")) return;
        const duplicate = !existing && accountTransferRows().some(transfer => (
          !transfer.reversalOf &&
          transfer.date === values.date &&
          transfer.origin === origin &&
          transfer.destination === destination &&
          Number(transfer.amount || 0) === amount
        ));
        if (duplicate && !confirm("Já existe uma transferência igual nesta data. Confirmar outra operação?")) {
          return;
        }
        const now = new Date().toISOString();
        const transfer = normalizedAccountTransfer({
          ...(existing || {}),
          id: existing?.id || accountTransferId(),
          date: values.date,
          origin,
          destination,
          amount,
          description: values.description || "Transferência interna",
          createdAt: existing?.createdAt || now,
          updatedAt: now,
          createdBy: existing?.createdBy || state.currentUser?.name || state.currentUser?.username || "Sistema",
          createdByUsername: existing?.createdByUsername || state.currentUser?.username || ""
        });
        const applied = applyAccountTransferToState(transfer, existing?.id || "");
        if (!applied.ok) {
          showToast(applied.error, "error");
          return;
        }
        state.editAccountTransferId = null;
        state.accountTransferDraft = { origin: destination, destination: origin };
        recordAudit(existing ? "Transferência editada" : "Transferência criada", `${accountTransferAccountLabel(origin)} → ${accountTransferAccountLabel(destination)} - ${money(amount)}`, {
          entityId: transfer.id,
          before: existing || null,
          after: transfer
        });
        if (await persistState()) {
          showToast(existing ? "Transferência atualizada." : "Transferência concluída sem alterar o resultado operacional.", "success");
          renderCash();
        }
      } finally {
        releaseSubmission();
      }
    });

    document.querySelectorAll("[data-edit-account-transfer]").forEach(button => {
      button.addEventListener("click", event => {
        state.editAccountTransferId = event.currentTarget.dataset.editAccountTransfer;
        state.cashPanelTab = "transfers";
        renderCash();
        requestAnimationFrame(() => {
          const dateField = document.querySelector('#account-transfer-form input[name="date"]');
          dateField?.scrollIntoView({ behavior: "smooth", block: "center" });
          dateField?.focus({ preventScroll: true });
        });
      });
    });

    document.querySelectorAll("[data-reverse-account-transfer]").forEach(button => {
      button.addEventListener("click", async event => {
        const originalId = event.currentTarget.dataset.reverseAccountTransfer;
        const transfers = accountTransferRows();
        const original = transfers.find(transfer => String(transfer.id) === String(originalId));
        if (!original || original.reversalOf || transfers.some(
          transfer => String(transfer.reversalOf || "") === String(original.id)
        )) return;
        const reversalDate = isoDate(new Date());
        if (blockClosedPeriod(reversalDate, "estornar transferência")) return;
        if (!confirm(`Estornar a transferência de ${money(original.amount)} de ${accountTransferAccountLabel(original.origin)} para ${accountTransferAccountLabel(original.destination)}?`)) {
          return;
        }
        const now = new Date().toISOString();
        const reversal = normalizedAccountTransfer({
          id: accountTransferId(),
          date: reversalDate,
          origin: original.destination,
          destination: original.origin,
          amount: original.amount,
          description: `Estorno da transferência de ${formatIsoDateBr(original.date)}`,
          reversalOf: original.id,
          createdAt: now,
          updatedAt: now,
          createdBy: state.currentUser?.name || state.currentUser?.username || "Sistema",
          createdByUsername: state.currentUser?.username || ""
        });
        const applied = applyAccountTransferToState(reversal);
        if (!applied.ok) {
          showToast(applied.error, "error");
          return;
        }
        recordAudit("Transferência estornada", `${accountTransferAccountLabel(original.destination)} → ${accountTransferAccountLabel(original.origin)} - ${money(original.amount)}`, {
          entityId: original.id,
          before: original,
          after: reversal
        });
        if (await persistState()) {
          showToast("Estorno concluído e vinculado à transferência original.", "success");
          renderCash();
        }
      });
    });
  }

  on("#open-savings-transfer", "click", () => {
    state.accountTransferDraft = { origin: "savings", destination: "pj" };
    state.cashPanelTab = "transfers";
    state.editSavingsEntryId = null;
    renderCash();
  });

  const savingsForm = document.querySelector("#savings-form");
  if (savingsForm) {
    on("#cancel-savings-edit", "click", () => {
      state.editSavingsEntryId = null;
      renderCash();
    });

    document.querySelectorAll("[data-edit-savings-entry]").forEach(button => {
      button.addEventListener("click", event => {
        state.editSavingsEntryId = event.currentTarget.dataset.editSavingsEntry;
        state.cashPanelTab = "savings";
        renderCash();
      });
    });

    document.querySelectorAll("[data-focus-cash-entry]").forEach(button => {
      button.addEventListener("click", event => {
        const entryId = event.currentTarget.dataset.focusCashEntry;
        const original = state.cash.find(entry => String(entry.id || "") === String(entryId || ""));
        if (!original) {
          showToast("Lançamento original não encontrado no extrato.", "warning");
          return;
        }
        state.cashPanelTab = "ledger";
        state.cashFilter = {
          period: "day",
          date: original.date || today,
          month: String(original.date || today).slice(0, 7),
          year: String(original.date || today).slice(0, 4),
          type: "all",
          category: "all",
          cashAccount: "all",
          quick: "",
          search: String(original.description || "").trim()
        };
        persistState();
        renderCash();
      });
    });

    document.querySelectorAll("[data-delete-savings-entry]").forEach(button => {
      button.addEventListener("click", async event => {
        const savingsEntryId = event.currentTarget.dataset.deleteSavingsEntry;
        const rows = savingsHistoryRows();
        const removed = rows.find(entry => String(entry.id) === String(savingsEntryId));
        if (!removed) {
          showToast("Registro do cofrinho não encontrado.", "warning");
          return;
        }
        if (!confirm(`Excluir este registro do cofrinho no valor de ${money(removed.amount)}?`)) {
          return;
        }
        if (blockClosedPeriod(removed.date, "excluir registro do cofrinho")) {
          return;
        }
        const nextBalance = applySavingsHistory(rows.filter(entry => String(entry.id) !== String(savingsEntryId)));
        if (String(state.editSavingsEntryId || "") === String(savingsEntryId)) {
          state.editSavingsEntryId = null;
        }
        recordAudit("Cofrinho excluído", `${formatIsoDateBr(removed.date)} - ${money(removed.amount)} - saldo ${money(nextBalance)}`, {
          entityId: String(removed.id || ""),
          before: removed,
          after: null
        });
        if (await persistState()) {
          showToast("Registro do cofrinho excluído.", "success");
          renderCash();
        }
      });
    });

    savingsForm.addEventListener("submit", async event => {
      event.preventDefault();
      const values = readForm(event.currentTarget);
      const savingsEntryId = values.savingsEntryId || "";
      if (savingsEntryId) {
        const amount = parseMoneyInput(values.amount);
        const date = values.date || today;
        const type = ["set", "deposit", "withdrawal"].includes(values.type) ? values.type : "deposit";
        if (amount < 0) {
          showToast("Informe um valor válido para o cofrinho.", "error");
          return;
        }
        const rows = savingsHistoryRows();
        const original = rows.find(entry => String(entry.id) === String(savingsEntryId));
        if (!original) {
          showToast("Registro do cofrinho não encontrado.", "warning");
          state.editSavingsEntryId = null;
          renderCash();
          return;
        }
        const nextBalance = applySavingsHistory(rows.map(entry => String(entry.id) === String(savingsEntryId)
          ? {
            ...entry,
            date,
            type,
            amount: amount.toFixed(2),
            description: values.description || ""
          }
          : entry));
        state.editSavingsEntryId = null;
        recordAudit("Cofrinho editado", `${formatIsoDateBr(date)} - ${type === "withdrawal" ? "retirada" : type === "set" ? "saldo informado" : "entrada"} ${money(amount)} - saldo ${money(nextBalance)}`);
        if (await persistState()) {
          showToast("Registro do cofrinho atualizado.", "success");
          renderCash();
        }
        return;
      }

      const balance = parseMoneyInput(values.balance);
      const expectedBalance = parseMoneyInput(values.expectedBalance);
      const withdrawal = parseMoneyInput(values.withdrawal);
      const date = values.date || today;

      if (balance < 0 || expectedBalance < 0 || withdrawal < 0) {
        showToast("Informe valores válidos para o cofrinho.", "error");
        return;
      }

      setSavingsExpectedBalance(expectedBalance, date);
      const description = values.description || "Saldo informado no caixa";
      let nextBalance = updateSavingsBalance({
        amount: balance,
        date,
        type: "set",
        description,
        dayOrder: 100
      });

      if (withdrawal > 0) {
        nextBalance = updateSavingsBalance({
          amount: withdrawal,
          date,
          type: "withdrawal",
          description: values.description || "Retirada registrada no cofrinho",
          dayOrder: 101
        });
      }

      recordAudit("Cofrinho atualizado", `Saldo ${money(nextBalance)}${withdrawal > 0 ? ` - retirada ${money(withdrawal)}` : ""}`);
      if (await persistState()) {
        renderCash();
      }
    });
  }

  const partnersForm = document.querySelector("#partners-form");
  if (partnersForm) {
    partnersForm.addEventListener("submit", event => {
      event.preventDefault();
      const values = readForm(event.currentTarget);
      const periodKey = values.periodKey || today.slice(0, 7);
      const record = {
        periodKey,
        vanessa: parseMoneyInput(values.vanessa).toFixed(2),
        raquel: parseMoneyInput(values.raquel).toFixed(2),
        difference: parseMoneyInput(values.difference).toFixed(2),
        notes: values.notes || ""
      };

      upsertPartnersRecord(record);
      recordAudit("Registro manual de retirada atualizado", `${formatMonthKeyBr(periodKey)} - Vanessa ${money(record.vanessa)}, Raquel ${money(record.raquel)}, compensação antiga ${money(record.difference)}`);
      persistState();
      renderCash();
    });
  }

  const withdrawalForm = document.querySelector("#withdrawal-form");
  if (withdrawalForm) {
    const withdrawalCalculatedBalanceForForm = () => {
      const date = withdrawalForm.elements.date.value || today;
      const cashAccount = normalizedCashAccount(withdrawalForm.elements.cashAccount.value);
      return accountBalanceUntilDate(date, editingWithdrawalIds, cashAccount);
    };

    const withdrawalSettlementOptions = () => {
      const options = {};
      ["Vanessa", "Raquel"].forEach(name => {
        const key = name.toLowerCase();
        const action = withdrawalForm.elements[`partnerAction${name}`].value;
        const amount = Math.max(
          0,
          parseMoneyInput(withdrawalForm.elements[`partnerSettlement${name}`].value)
        );
        options[`realPayment${name}`] = action === "pay" ? amount : 0;
        options[`compensation${name}`] = action === "discount"
          ? parseMoneyInput(withdrawalForm.elements[`prior${name}`].value)
          : action === "partial" ? amount : 0;
        const amountLabel = withdrawalForm.querySelector(`[data-partner-settlement-amount="${key}"]`);
        if (amountLabel) amountLabel.hidden = !["partial", "pay"].includes(action);
      });
      return options;
    };

    const syncWithdrawalDebtBalances = () => {
      if (editingWithdrawal) return;
      const balances = partnerBalances(
        state.partnerAccounts,
        withdrawalForm.elements.date.value || today
      );
      [["Vanessa", "vanessa"], ["Raquel", "raquel"]].forEach(([name, key]) => {
        const amount = Number(balances[key] || 0);
        withdrawalForm.elements[`prior${name}`].value = String(amount);
        const target = withdrawalForm.querySelector(`[data-withdrawal-debt="${key}"] strong`);
        if (target) target.textContent = money(amount);
        const action = withdrawalForm.elements[`partnerAction${name}`].value;
        if (["discount", "keep"].includes(action)) {
          withdrawalForm.elements[`partnerSettlement${name}`].value = moneyInputValue(amount);
        }
      });
    };

    let lastAutomaticValues = withdrawalDistributionCalculation(
      withdrawalForm.elements.accountBalanceBefore.value,
      withdrawalForm.elements.priorVanessa.value,
      withdrawalForm.elements.priorRaquel.value,
      withdrawalSettlementOptions()
    );

    const automaticWithdrawalValues = (
      forceActualValues = false,
      syncPhysicalBalance = false
    ) => {
      const previousSuggested = lastAutomaticValues;
      if (syncPhysicalBalance) {
        withdrawalForm.elements.accountBalanceBefore.value = moneyInputValue(
          withdrawalCalculatedBalanceForForm()
        );
      }
      const calculation = withdrawalDistributionCalculation(
        withdrawalForm.elements.accountBalanceBefore.value,
        withdrawalForm.elements.priorVanessa.value,
        withdrawalForm.elements.priorRaquel.value,
        withdrawalSettlementOptions()
      );
      withdrawalForm.elements.expectedSavings.value = moneyInputValue(calculation.expectedSavings);
      withdrawalForm.elements.expectedVanessa.value = moneyInputValue(calculation.expectedVanessa);
      withdrawalForm.elements.expectedRaquel.value = moneyInputValue(calculation.expectedRaquel);
      [
        ["savings", "savings"],
        ["vanessa", "vanessa"],
        ["raquel", "raquel"]
      ].forEach(([fieldName, valueKey]) => {
        const field = withdrawalForm.elements[fieldName];
        const keptSuggestedValue = Math.abs(
          parseMoneyInput(field.value) - Number(previousSuggested[valueKey] || 0)
        ) < 0.01;
        if (forceActualValues || keptSuggestedValue) {
          field.value = moneyInputValue(calculation[valueKey]);
        }
      });
      lastAutomaticValues = calculation;
      return calculation;
    };

    const updateWithdrawalPreview = () => {
      automaticWithdrawalValues(false);
      const calculatedBalance = withdrawalCalculatedBalanceForForm();
      const actual = {
        savings: Math.max(0, parseMoneyInput(withdrawalForm.elements.savings.value)),
        vanessa: Math.max(0, parseMoneyInput(withdrawalForm.elements.vanessa.value)),
        raquel: Math.max(0, parseMoneyInput(withdrawalForm.elements.raquel.value))
      };
      const calculation = withdrawalDistributionCalculation(
        withdrawalForm.elements.accountBalanceBefore.value,
        withdrawalForm.elements.priorVanessa.value,
        withdrawalForm.elements.priorRaquel.value,
        {
          ...withdrawalSettlementOptions(),
          cashPaidVanessa: actual.vanessa,
          cashPaidRaquel: actual.raquel
        }
      );
      const balanceDifference = roundedMoneyValue(
        calculation.physicalBalance - calculatedBalance
      );
      actual.total = roundedMoneyValue(actual.savings + actual.vanessa + actual.raquel);
      const accountAfterWithdrawal = roundedMoneyValue(
        Math.max(0, calculation.cashAvailable - actual.total)
      );
      const excess = roundedMoneyValue(Math.max(0, actual.total - calculation.cashAvailable));
      const pendingVanessa = calculation.pendingVanessa;
      const pendingRaquel = calculation.pendingRaquel;
      const referenceMonth = String(withdrawalForm.elements.date.value || today).slice(0, 7);
      const monthFinancial = financialSummary(
        accountingCashEntries(state.cash).filter(entry => {
          return String(cashAccountingDate(entry) || "").startsWith(referenceMonth)
            && !editingWithdrawalIds.includes(String(entry.id));
        })
      );
      const distributionVsProfit = roundedMoneyValue(
        calculation.distributionBase - monthFinancial.profitBeforeWithdrawals
      );
      const preview = withdrawalForm.querySelector(".withdrawal-preview");
      preview.innerHTML = `
        <span><b>Lucro operacional do mês</b>${money(monthFinancial.profitBeforeWithdrawals)}<small>Receitas menos custos; não é o saldo bancário</small></span>
        <span><b>Saldo calculado pelo sistema</b>${money(calculatedBalance)}</span>
        <span><b>Saldo real da conta</b>${money(calculation.physicalBalance)}</span>
        <span><b>Ajuste para igualar ao banco</b>${money(balanceDifference)}</span>
        <span><b>Valores a receber das sócias</b>${money(calculation.debtVanessa + calculation.debtRaquel)}<small>Não estão no banco</small></span>
        ${calculation.realPaymentVanessa + calculation.realPaymentRaquel > 0 ? `<span><b>Pagamento real recebido</b>${money(calculation.realPaymentVanessa + calculation.realPaymentRaquel)}<small>Aumenta o caixa, mas não é receita</small></span>` : ""}
        ${calculation.paidToCashVanessa + calculation.paidToCashRaquel > 0 ? `<span><b>Dívida compensada</b>${money(calculation.paidToCashVanessa + calculation.paidToCashRaquel)}<small>Não movimenta a conta</small></span>` : ""}
        <span><b>Base ajustada para a quebra</b>${money(calculation.distributionBase)}</span>
        <span><b>Diferença entre base e lucro do mês</b>${money(distributionVsProfit)}<small>Pode vir de saldo anterior, ajustes ou ocorrer em outro período</small></span>
        <span><b>Total que sai agora</b>${money(actual.total)}<small>${excess > 0 ? `Excede o saldo em ${money(excess)}` : "Dentro do saldo disponível"}</small></span>
        <span><b>Saldo da conta depois</b>${money(accountAfterWithdrawal)}</span>
        <span><b>Vanessa - recebe da conta</b>${money(actual.vanessa)}<small>${partnerPendingLabel(pendingVanessa)}</small></span>
        <span><b>Raquel - recebe da conta</b>${money(actual.raquel)}<small>${partnerPendingLabel(pendingRaquel)}</small></span>
        ${calculation.remainingDebtVanessa > 0 || calculation.remainingDebtRaquel > 0
          ? `<span><b>Dívida que continua pendente</b>Vanessa ${money(calculation.remainingDebtVanessa)} · Raquel ${money(calculation.remainingDebtRaquel)}</span>`
          : ""}
      `;
    };

    withdrawalForm.addEventListener("input", event => {
      const fieldName = event.target.name;
      if (["date", "cashAccount"].includes(fieldName)) {
        if (fieldName === "date") syncWithdrawalDebtBalances();
        automaticWithdrawalValues(true, true);
      } else if (["accountBalanceBefore", "partnerActionVanessa", "partnerActionRaquel", "partnerSettlementVanessa", "partnerSettlementRaquel"].includes(fieldName)) {
        automaticWithdrawalValues(true, false);
      }
      updateWithdrawalPreview();
    });

    withdrawalSettlementOptions();

    withdrawalForm.addEventListener("submit", async event => {
    event.preventDefault();
    const values = readForm(event.currentTarget);
    const previousWithdrawal = state.editWithdrawalGroup
      ? withdrawalHistoryGroups(state.cash).find(group => group.key === state.editWithdrawalGroup)
      : null;
    const previousSavingsLoan = previousWithdrawal ? withdrawalSavingsLoanEntry(previousWithdrawal) : null;
    const previousBalanceAdjustment = previousWithdrawal
      ? withdrawalBalanceAdjustmentEntry(previousWithdrawal)
      : null;
    const previousSavingsLoanAmount = Number(previousSavingsLoan?.amount || 0);
    const cashAccount = normalizedCashAccount(values.cashAccount);
    const calculatedBalanceBefore = withdrawalCalculatedBalanceForForm();
    const initialCalculation = withdrawalDistributionCalculation(
      values.accountBalanceBefore,
      values.priorVanessa,
      values.priorRaquel,
      withdrawalSettlementOptions()
    );
    const expected = {
      savings: initialCalculation.expectedSavings,
      vanessa: initialCalculation.expectedVanessa,
      raquel: initialCalculation.expectedRaquel
    };
    expected.total = initialCalculation.expectedTotal;
    const split = {
      distributionBase: initialCalculation.distributionBase,
      savings: Math.max(0, parseMoneyInput(values.savings)),
      vanessa: Math.max(0, parseMoneyInput(values.vanessa)),
      raquel: Math.max(0, parseMoneyInput(values.raquel))
    };
    split.total = roundedMoneyValue(split.savings + split.vanessa + split.raquel);
    const calculation = withdrawalDistributionCalculation(
      values.accountBalanceBefore,
      values.priorVanessa,
      values.priorRaquel,
      {
        ...withdrawalSettlementOptions(),
        cashPaidVanessa: split.vanessa,
        cashPaidRaquel: split.raquel
      }
    );
    const physicalBalance = calculation.physicalBalance;
    const available = calculation.cashAvailable;
    const balanceDifference = roundedMoneyValue(physicalBalance - calculatedBalanceBefore);
    const prior = {
      vanessa: calculation.debtVanessa,
      raquel: calculation.debtRaquel
    };
    if (expected.total <= 0) {
      showToast("Não há saldo ou retirada anterior para formar a base da divisão.", "error");
      return;
    }

    if (split.total > available + 0.009) {
      showToast("A retirada não pode ultrapassar o valor disponível na conta.", "error");
      return;
    }
    if (Math.abs(split.savings - expected.savings) > 0.009) {
      showToast(
        `O Cofrinho deve receber exatamente ${Number(state.appConfig.splitSavingsPercent || 0)}% da base da divisão.`,
        "error"
      );
      return;
    }
    if (split.vanessa > expected.vanessa + 0.009 || split.raquel > expected.raquel + 0.009) {
      showToast("Uma sócia não pode retirar mais do que o direito dela na divisão.", "error");
      return;
    }
    const savingsLoan = 0;

    if (blockClosedPeriod(values.date, "registrar retiradas")) {
      return;
    }
    if (previousWithdrawal && previousWithdrawal.date !== values.date
      && blockClosedPeriod(previousWithdrawal.date, "editar retiradas")) {
      return;
    }

    const duplicateWithdrawal = withdrawalHistoryGroups(state.cash).find(group => {
      return group.key !== previousWithdrawal?.key
        && group.date === values.date
        && !group.mixedCashAccounts
        && normalizedCashAccount(group.cashAccount) === cashAccount;
    });
    if (duplicateWithdrawal) {
      showToast(`Já existe uma retirada em ${formatIsoDateBr(values.date)} para ${cashAccountLabel(cashAccount)}. Edite o registro existente.`, "error");
      return;
    }

    const recognizedVanessa = roundedMoneyValue(split.vanessa + calculation.paidToCashVanessa);
    const recognizedRaquel = roundedMoneyValue(split.raquel + calculation.paidToCashRaquel);
    const recognizedTotal = roundedMoneyValue(split.savings + recognizedVanessa + recognizedRaquel);
    const confirmation = [
      `Confirmar a retirada de ${formatIsoDateBr(values.date)}?`,
      "",
      `Saldo real da conta: ${money(physicalBalance)}`,
      `Valores a receber das sócias: ${money(calculation.debtVanessa + calculation.debtRaquel)}`,
      `Base usada na divisão: ${money(calculation.distributionBase)}`,
      "",
      `Cofrinho: ${money(split.savings)}`,
      `Vanessa: recebeu ${money(split.vanessa)} + compensou ${money(calculation.paidToCashVanessa)} = ${money(recognizedVanessa)}`,
      `Raquel: recebeu ${money(split.raquel)} + compensou ${money(calculation.paidToCashRaquel)} = ${money(recognizedRaquel)}`,
      `Total reconhecido na divisão: ${money(recognizedTotal)}`,
      `Total que sai da conta: ${money(split.total)}`
    ].join("\n");
    if (!confirm(confirmation)) {
      return;
    }

    const idBase = previousWithdrawal
      ? previousWithdrawal.key.replace(/^withdrawal-/, "")
      : Date.now();
    const partnerSnapshotId = String(
      previousWithdrawal?.partnerWithdrawalSnapshotId || `partner-withdrawal-snapshot-${idBase}`
    );
    const openingPartnerMovements = partnerAccountMovements().filter(
      movement => String(movement.date || "") <= values.date
    );
    const settlementMovements = [];
    const buildSettlementMovement = (partnerId, type, amount) => {
      if (Number(amount || 0) <= 0.009) return null;
      const movement = {
        id: `partner-${type}-${idBase}-${partnerId}`,
        partnerId,
        date: values.date,
        type,
        description: type === "payment"
          ? `Pagamento recebido na quebra de ${formatIsoDateBr(values.date)}`
          : `Compensação na distribuição de ${formatIsoDateBr(values.date)}`,
        amount: Number(amount).toFixed(2),
        origin: type === "payment" ? "pix" : "withdrawal",
        observation: type === "payment"
          ? "Pagamento real registrado junto com a quebra semanal."
          : "Compensação contábil sem entrada de caixa.",
        direction: "",
        cashImpact: type === "payment",
        withdrawalSnapshotId: partnerSnapshotId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: state.currentUser?.name || state.currentUser?.username || "Sistema"
      };
      if (type === "payment") {
        const cashEntry = partnerCashEntryFromMovement(movement, { cashAccount });
        state.cash.push(cashEntry);
        movement.cashEntryId = cashEntry.id;
      } else {
        movement.cashEntryId = "";
      }
      settlementMovements.push(movement);
      return movement;
    };
    const paymentVanessaMovement = previousWithdrawal
      ? null
      : buildSettlementMovement("vanessa", "payment", calculation.realPaymentVanessa);
    const paymentRaquelMovement = previousWithdrawal
      ? null
      : buildSettlementMovement("raquel", "payment", calculation.realPaymentRaquel);
    const compensationVanessaMovement = previousWithdrawal
      ? null
      : buildSettlementMovement(
          "vanessa",
          "withdrawal_compensation",
          calculation.paidToCashVanessa
        );
    const compensationRaquelMovement = previousWithdrawal
      ? null
      : buildSettlementMovement(
          "raquel",
          "withdrawal_compensation",
          calculation.paidToCashRaquel
        );
    const balanceAdjustmentEntry = Math.abs(balanceDifference) > 0.009
      ? {
        id: `withdrawal-${idBase}-balance-adjustment`,
        description: "Ajuste do saldo real antes da divisão",
        date: values.date,
        type: balanceDifference > 0 ? "income" : "expense",
        category: "ajuste-conta",
        cashAccount,
        amount: Math.abs(balanceDifference).toFixed(2),
        withdrawalBalanceAdjustment: true,
        withdrawalGroup: `withdrawal-${idBase}`
      }
      : null;
    const savingsLoanEntry = savingsLoan > 0.009
      ? {
        id: `withdrawal-${idBase}-savings-loan`,
        description: "Empréstimo do cofrinho para retirada",
        date: values.date,
        type: "income",
        category: "ajuste-conta",
        cashAccount,
        amount: savingsLoan.toFixed(2),
        withdrawalGroup: `withdrawal-${idBase}`
      }
      : null;
    const withdrawalEntries = [
      balanceAdjustmentEntry,
      savingsLoanEntry,
      {
        id: `withdrawal-${idBase}-savings`,
        description: "Retirada - cofrinho",
        date: values.date,
        type: "expense",
        category: "retirada",
        cashAccount,
        amount: split.savings.toFixed(2),
        distributionBase: split.distributionBase.toFixed(2),
        accountBalanceBefore: physicalBalance.toFixed(2),
        grossWithdrawalAmount: expected.total.toFixed(2),
        expectedAmount: expected.savings.toFixed(2),
        partnerWithdrawalSnapshotId: partnerSnapshotId
      },
      {
        id: `withdrawal-${idBase}-vanessa`,
        description: "Retirada - Vanessa",
        date: values.date,
        type: "expense",
        category: "retirada",
        cashAccount,
        amount: split.vanessa.toFixed(2),
        distributionBase: split.distributionBase.toFixed(2),
        accountBalanceBefore: physicalBalance.toFixed(2),
        grossWithdrawalAmount: expected.total.toFixed(2),
        cashDebtAmount: prior.vanessa.toFixed(2),
        priorWithdrawalAmount: prior.vanessa.toFixed(2),
        paidToCashAmount: calculation.paidToCashVanessa.toFixed(2),
        realPaymentAmount: calculation.realPaymentVanessa.toFixed(2),
        remainingDebtAmount: calculation.remainingDebtVanessa.toFixed(2),
        expectedAmount: expected.vanessa.toFixed(2),
        partnerWithdrawalSnapshotId: partnerSnapshotId
      },
      {
        id: `withdrawal-${idBase}-raquel`,
        description: "Retirada - Raquel",
        date: values.date,
        type: "expense",
        category: "retirada",
        cashAccount,
        amount: split.raquel.toFixed(2),
        distributionBase: split.distributionBase.toFixed(2),
        accountBalanceBefore: physicalBalance.toFixed(2),
        grossWithdrawalAmount: expected.total.toFixed(2),
        cashDebtAmount: prior.raquel.toFixed(2),
        priorWithdrawalAmount: prior.raquel.toFixed(2),
        paidToCashAmount: calculation.paidToCashRaquel.toFixed(2),
        realPaymentAmount: calculation.realPaymentRaquel.toFixed(2),
        remainingDebtAmount: calculation.remainingDebtRaquel.toFixed(2),
        expectedAmount: expected.raquel.toFixed(2),
        partnerWithdrawalSnapshotId: partnerSnapshotId
      }
    ].filter(entry => entry && (Number(entry.amount || 0) > 0 || Number(entry.expectedAmount || 0) > 0));
    if (previousWithdrawal) {
      const previousIds = new Set([
        ...previousWithdrawal.entries.map(entry => String(entry.id)),
        previousSavingsLoan?.id,
        previousBalanceAdjustment?.id
      ].filter(Boolean).map(String));
      state.cash = state.cash.filter(entry => !previousIds.has(String(entry.id)));
    }
    state.cash.push(...withdrawalEntries);
    if (!previousWithdrawal || !previousWithdrawal.partnerWithdrawalSnapshotId) {
      const rangeDate = new Date(`${values.date}T00:00:00`);
      const snapshot = {
        id: partnerSnapshotId,
        date: values.date,
        period: {
          start: isoDate(startOfWeek(rangeDate)),
          end: isoDate(endOfWeek(rangeDate))
        },
        cashAccount,
        physicalCash: physicalBalance.toFixed(2),
        receivablesTotal: roundedMoneyValue(prior.vanessa + prior.raquel).toFixed(2),
        adjustedBase: calculation.distributionBase.toFixed(2),
        companyReserve: expected.savings.toFixed(2),
        companyReservePaid: split.savings.toFixed(2),
        cashAvailableAfterPayments: calculation.cashAvailable.toFixed(2),
        cashPaidTotal: split.total.toFixed(2),
        accountAfterWithdrawal: roundedMoneyValue(calculation.cashAvailable - split.total).toFixed(2),
        partners: [
          {
            partnerId: "vanessa",
            openingDebt: prior.vanessa.toFixed(2),
            openingMovementIds: openingPartnerMovements
              .filter(movement => movement.partnerId === "vanessa")
              .map(movement => movement.id),
            distributionRight: expected.vanessa.toFixed(2),
            realPayment: calculation.realPaymentVanessa.toFixed(2),
            paymentMovementId: paymentVanessaMovement?.id || "",
            compensation: calculation.paidToCashVanessa.toFixed(2),
            compensationMovementId: compensationVanessaMovement?.id || "",
            cashPaid: split.vanessa.toFixed(2),
            pendingDistribution: calculation.pendingVanessa.toFixed(2),
            remainingDebt: calculation.remainingDebtVanessa.toFixed(2)
          },
          {
            partnerId: "raquel",
            openingDebt: prior.raquel.toFixed(2),
            openingMovementIds: openingPartnerMovements
              .filter(movement => movement.partnerId === "raquel")
              .map(movement => movement.id),
            distributionRight: expected.raquel.toFixed(2),
            realPayment: calculation.realPaymentRaquel.toFixed(2),
            paymentMovementId: paymentRaquelMovement?.id || "",
            compensation: calculation.paidToCashRaquel.toFixed(2),
            compensationMovementId: compensationRaquelMovement?.id || "",
            cashPaid: split.raquel.toFixed(2),
            pendingDistribution: calculation.pendingRaquel.toFixed(2),
            remainingDebt: calculation.remainingDebtRaquel.toFixed(2)
          }
        ],
        withdrawalEntryIds: withdrawalEntries.map(entry => entry.id),
        closedAt: new Date().toISOString(),
        closedBy: state.currentUser?.name || state.currentUser?.username || "Sistema",
        closedByUsername: state.currentUser?.username || ""
      };
      state.partnerAccounts = {
        ...normalizePartnerAccounts(state.partnerAccounts),
        movements: [...settlementMovements, ...partnerAccountMovements()],
        withdrawalSnapshots: [snapshot, ...partnerWithdrawalSnapshots()]
      };
    }
    const savingsDifference = split.savings - Number(previousWithdrawal?.savings || 0);
    if (Math.abs(savingsDifference) > 0.009) {
      updateSavingsBalance({
        amount: Math.abs(savingsDifference),
        date: values.date,
        type: savingsDifference > 0 ? "deposit" : "withdrawal",
        description: previousWithdrawal ? "Ajuste da retirada - cofrinho" : "Retirada - cofrinho"
      });
    }
    const savingsLoanDifference = savingsLoan - previousSavingsLoanAmount;
    if (Math.abs(savingsLoanDifference) > 0.009) {
      updateSavingsBalance({
        amount: Math.abs(savingsLoanDifference),
        date: values.date,
        type: savingsLoanDifference > 0 ? "withdrawal" : "deposit",
        description: savingsLoanDifference > 0
          ? "Empréstimo do cofrinho para cobrir retirada"
          : "Devolução ao cofrinho por ajuste de retirada"
      });
    }
    const auditDetail = `${cashAccountLabel(cashAccount)} - saldo calculado ${money(calculatedBalanceBefore)} - caixa real ${money(physicalBalance)}${Math.abs(balanceDifference) > 0.009 ? ` - ajuste da conta ${money(balanceDifference)}` : ""} - valores a receber Vanessa/Raquel ${money(prior.vanessa)} / ${money(prior.raquel)} - base ajustada ${money(expected.total)} - pagamentos reais ${money(calculation.realPaymentVanessa + calculation.realPaymentRaquel)} - compensações sem caixa ${money(calculation.paidToCashVanessa + calculation.paidToCashRaquel)} - saiu da conta ${money(split.total)} - cofrinho ${money(split.savings)}, Vanessa direito/recebe ${money(expected.vanessa)} / ${money(split.vanessa)}, Raquel direito/recebe ${money(expected.raquel)} / ${money(split.raquel)}`;
    recordAudit(previousWithdrawal ? "Retirada editada" : "Retirada registrada", auditDetail);
    state.editWithdrawalGroup = null;
    if (await persistState()) {
      showToast(previousWithdrawal ? "Retirada atualizada." : "Retirada registrada.", "success");
      renderCash();
    }
    });
  }

  const cancelWithdrawalEdit = document.querySelector("#cancel-withdrawal-edit");
  if (cancelWithdrawalEdit) {
    cancelWithdrawalEdit.addEventListener("click", () => {
      state.editWithdrawalGroup = null;
      renderCash();
    });
  }

  document.querySelectorAll("[data-edit-withdrawal]").forEach(button => {
    button.addEventListener("click", event => {
      state.editWithdrawalGroup = event.currentTarget.dataset.editWithdrawal;
      state.cashPanelTab = "withdrawals";
      renderCash();
    });
  });

  const filterForm = document.querySelector("#cash-filter-form");
  const periodField = document.querySelector("#cash-period");
  const filterTypeField = document.querySelector("#cash-filter-type");
  const filterCategoryField = document.querySelector("#cash-filter-category");
  const filterAccountField = document.querySelector("#cash-filter-account");

  if (filterForm && periodField && filterTypeField && filterCategoryField && filterAccountField) {
    function updateFilterVisibility() {
      const period = periodField.value;
      filterForm.dataset.period = period;
    }

    periodField.addEventListener("change", updateFilterVisibility);
    filterTypeField.addEventListener("change", event => {
      filterCategoryField.innerHTML = cashFilterCategoryOptions("all", event.currentTarget.value);
      filterAccountField.innerHTML = cashAccountOptionsHtml(
        filterAccountField.value,
        event.currentTarget.value === "expense" ? "expense" : "income",
        true,
        "",
        true
      );
    });
    updateFilterVisibility();

    filterForm.addEventListener("submit", event => {
      event.preventDefault();
      const values = readForm(event.currentTarget);
      
      // Se está em modo semana e o mês foi alterado, ajusta a data para estar dentro do novo mês
      if (values.period === "week" && values.month && values.month !== state.cashFilter?.month) {
        const newDate = new Date(`${values.month}-01T00:00:00`);
        values.date = isoDate(newDate);
      }
      
      state.cashFilter = { ...values, manualAll: values.period === "all" };
      state.cashSort = { key: "date", direction: "desc" };
      persistState();
      renderCash();
    });

    document.querySelector("#clear-cash-filter")?.addEventListener("click", () => {
      state.cashFilter = { period: "month", date: today, month: today.slice(0, 7), year: today.slice(0, 4), type: "all", category: "all", cashAccount: "all", quick: "", search: "" };
      state.cashSort = { key: "date", direction: "desc" };
      persistState();
      renderCash();
    });

    document.querySelectorAll("[data-cash-quick]").forEach(button => {
      button.addEventListener("click", event => {
        const quick = event.currentTarget.dataset.cashQuick;
        const baseFilter = { type: "all", category: "all", cashAccount: "all", quick: "", search: "" };
        if (quick === "today") {
          state.cashFilter = { ...state.cashFilter, ...baseFilter, period: "day", date: today, month: today.slice(0, 7), year: today.slice(0, 4), manualAll: false };
        }
        if (quick === "yesterday") {
          state.cashFilter = { ...state.cashFilter, ...baseFilter, period: "day", date: yesterdayDate, month: yesterdayDate.slice(0, 7), year: yesterdayDate.slice(0, 4), manualAll: false };
        }
        if (quick === "week") {
          state.cashFilter = { ...state.cashFilter, ...baseFilter, period: "week", date: today, month: today.slice(0, 7), year: today.slice(0, 4), manualAll: false };
        }
        if (quick === "month") {
          state.cashFilter = { ...state.cashFilter, ...baseFilter, period: "month", date: today, month: today.slice(0, 7), year: today.slice(0, 4), manualAll: false };
        }
        if (quick === "pending") {
          state.cashFilter = { ...state.cashFilter, ...baseFilter, period: "all", date: today, month: today.slice(0, 7), year: today.slice(0, 4), quick: "pending", manualAll: true };
        }
        if (quick === "savings") {
          state.cashFilter = { ...state.cashFilter, ...baseFilter, period: "all", date: today, month: today.slice(0, 7), year: today.slice(0, 4), quick: "savings", manualAll: true };
        }
        if (quick === "withdrawals") {
          state.cashFilter = { ...state.cashFilter, ...baseFilter, period: "all", date: today, month: today.slice(0, 7), year: today.slice(0, 4), quick: "withdrawals", manualAll: true };
        }
        state.cashSort = { key: "date", direction: "desc" };
        persistState();
        renderCash();
      });
    });
  }

  const clearCashButton = document.querySelector("#clear-cash");
  if (clearCashButton) {
    clearCashButton.addEventListener("click", async () => {
    const hasLockedPeriods = Object.values(state.monthlyClosings || {}).some(closing => closing?.locked !== false)
      || Object.values(state.weeklyClosings || {}).some(closing => closing?.locked !== false);
    if (hasLockedPeriods) {
      showToast("Existem períodos fechados. Destrave os fechamentos antes de limpar o caixa.", "warning");
      return;
    }
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

  document.querySelectorAll("[data-open-account-transfer]").forEach(button => {
    button.addEventListener("click", event => {
      state.editAccountTransferId = event.currentTarget.dataset.openAccountTransfer;
      state.cashPanelTab = "transfers";
      renderCash();
    });
  });

  document.querySelectorAll("[data-reverse-cash]").forEach(button => {
    button.addEventListener("click", async event => {
      const id = event.currentTarget.dataset.reverseCash;
      const original = state.cash.find(item => String(item.id) === String(id));
      if (!original || original.reversedBy || original.reversalOf) {
        return;
      }
      const reversalDate = isoDate(new Date());
      if (blockClosedPeriod(reversalDate, "estornar lançamentos")) {
        return;
      }
      if (!confirm(`Estornar ${original.description || "este lançamento"} no valor de ${money(original.amount)}? O original continuará no histórico.`)) {
        return;
      }
      const coverage = cashSavingsCoverageEntry(original.id);
      const reversalId = `reversal-${Date.now()}`;
      const coverageReversalId = coverage ? `reversal-${coverage.id}` : "";
      const reversalEntry = {
        id: reversalId,
        description: `Estorno - ${original.description || "Lançamento"}`,
        date: reversalDate,
        type: original.type === "expense" ? "income" : "expense",
        category: original.category,
        employeeId: String(original.employeeId || ""),
        cashAccount: normalizedCashAccount(original.cashAccount),
        amount: Number(original.amount || 0).toFixed(2),
        reversalOf: original.id
      };
      const prospectiveSavingsHistory = prospectiveSavingsHistoryForCashEntry(reversalEntry);
      state.cash = state.cash.map(item => String(item.id) === String(id)
        ? { ...item, reversedBy: reversalId, reversedAt: new Date().toISOString() }
        : coverage && String(item.id) === String(coverage.id)
          ? { ...item, reversedBy: coverageReversalId, reversedAt: new Date().toISOString() }
        : item);
      state.cash.push(reversalEntry);
      applySavingsHistory(prospectiveSavingsHistory);
      if (coverage) {
        state.cash.push({
          id: coverageReversalId,
          description: `Estorno - ${coverage.description || "Cobertura do cofrinho"}`,
          date: reversalDate,
          type: "expense",
          category: "ajuste-conta",
          cashAccount: normalizedCashAccount(coverage.cashAccount || original.cashAccount),
          amount: Number(coverage.amount || 0).toFixed(2),
          reversalOf: coverage.id,
          automaticSavingsCoverageReversal: true,
          savingsCoverageFor: original.id
        });
        updateSavingsBalance({
          id: cashSavingsCoverageReversalHistoryId(original.id),
          amount: Number(coverage.amount || 0),
          date: reversalDate,
          type: "deposit",
          description: `Devolução ao cofrinho por estorno: ${original.description || "lançamento"}`
        });
      }
      recordAudit("Lançamento estornado", `${original.description || "Lançamento"} - ${money(original.amount)}`, {
        entityId: String(original.id || ""),
        before: original,
        after: { reversalId, coverageReversalId }
      });
      if (await persistState()) {
        showToast("Estorno registrado sem apagar o lançamento original.", "success");
        renderCash();
      }
    });
  });

  document.querySelectorAll("[data-delete-cash]").forEach(button => {
    button.addEventListener("click", async event => {
      if (!confirm("Excluir este lançamento?")) {
        return;
      }

      const id = event.currentTarget.dataset.deleteCash;
      const removed = state.cash.find(item => String(item.id) === String(id));
      if (blockClosedPeriod(removed?.date, "excluir lançamentos")) {
        return;
      }
      const coverage = cashSavingsCoverageEntry(id);
      if (coverage?.date && blockClosedPeriod(coverage.date, "excluir cobertura do cofrinho")) {
        return;
      }
      const prospectiveSavingsHistory = prospectiveSavingsHistoryForCashEntry({}, removed?.id || "");
      removeCashSavingsCoverage(id);
      applySavingsHistory(prospectiveSavingsHistory);
      state.cash = state.cash.filter(item => String(item.id) !== String(id));
      if (String(state.editCashId) === String(id)) {
        state.editCashId = null;
      }
      recordAudit("Caixa excluído", `${removed?.description || "Lançamento"} - ${money(removed?.amount)}`, {
        entityId: String(removed?.id || ""),
        before: removed || null,
        after: null
      });
      if (await persistState()) {
        renderCash();
      }
    });
  });

  document.querySelectorAll("[data-sort-cash]").forEach(button => {
    button.addEventListener("click", event => {
      const key = event.currentTarget.dataset.sortCash;
      state.cashSort = {
        key,
        direction: state.cashSort?.key === key && state.cashSort.direction === "desc" ? "asc" : "desc"
      };
      renderCash();
    });
  });

  bindBillPaymentButtons(renderCash);
}

function sortedCashEntries(entries = []) {
  const key = state.cashSort?.key || "date";
  const direction = state.cashSort.direction === "asc" ? 1 : -1;
  const valueFor = entry => {
    if (key === "amount") {
      return Number(entry.amount || 0);
    }
    if (key === "type") {
      return entry.type === "expense" ? "Saída" : "Entrada";
    }
    if (key === "category") {
      return categoryName(entry.category);
    }
    if (key === "dueDate") {
      return String(entry.dueDate || "");
    }
    return String(entry[key] || "");
  };
  return entries.map((entry, index) => ({ entry, index })).sort((a, b) => {
    const left = valueFor(a.entry);
    const right = valueFor(b.entry);
    if (typeof left === "number" && typeof right === "number") {
      const comparison = (left - right) * direction;
      return comparison || (a.index - b.index) * direction;
    }
    const comparison = String(left).localeCompare(String(right), "pt-BR", { numeric: true, sensitivity: "base" }) * direction;
    return comparison || (a.index - b.index) * direction;
  }).map(item => item.entry);
}

function cashSortHeader(key, label) {
  const active = state.cashSort?.key === key;
  const arrow = active ? (state.cashSort.direction === "asc" ? "↑" : "↓") : "↕";
  return `<button class="table-sort-button ${active ? "active" : ""}" type="button" data-sort-cash="${key}" title="Ordenar por ${label}">${label}<span aria-hidden="true">${arrow}</span></button>`;
}

function cashTable(entries) {
  if (!entries.length) {
    return `<p class="muted" data-cash-ledger-results>Nenhum lançamento ainda.</p>`;
  }
  const sortedEntries = sortedCashEntries(entries);

  return `
    <div class="table-wrap cash-ledger-table" data-cash-ledger-results>
      <table>
        <thead><tr><th>${cashSortHeader("date", "Data")}</th><th>${cashSortHeader("description", "Descrição")}</th><th>${cashSortHeader("type", "Tipo")}</th><th>${cashSortHeader("category", "Categoria")}</th><th>Conta</th><th>${cashSortHeader("dueDate", "Vencimento")}</th><th>${cashSortHeader("amount", "Valor")}</th><th></th></tr></thead>
        <tbody>
          ${sortedEntries.map(item => {
            const accountAdjustment = isAccountAdjustmentEntry(item);
            const automaticCoverage = isCashSavingsCoverageEntry(item) || item.automaticSavingsCoverageReversal;
            const internalTransfer = isAccountTransferCashEntry(item);
            const savingsLedgerEntry = item.savingsLedgerEntry === true;
            const employee = financialEmployeeForEntry(item);
            return `
            <tr class="cash-row ${item.type === "income" ? "income-row" : "expense-row"} ${accountAdjustment ? "account-adjustment-row" : ""}">
              <td>${formatIsoDateBr(item.date)}</td>
              <td>
                ${escapeHtml(item.description)}
                ${employee ? `<br><small>Funcionário: ${escapeHtml(employee.name)}</small>` : ""}
                ${internalTransfer ? `<br><small>Operação vinculada · ${escapeHtml(item.accountTransferId || item.transferId || "")}</small>` : ""}
              </td>
              <td><span class="cash-type-badge ${item.type === "income" ? "income" : "expense"}">${item.type === "income" ? "Entrada" : "Saída"}</span></td>
              <td><span class="cash-category-badge ${accountAdjustment ? "account-adjustment" : ""}">${cashDisplayCategoryName(item)}</span></td>
              <td>${isPendingBill(item) ? "Definir ao pagar" : cashAccountLabel(item.cashAccount)}</td>
              <td>
                ${item.dueDate ? formatIsoDateBr(item.dueDate) : "-"}
                ${isBillEntry(item) ? `<br><small>${item.paidAt ? `Pago em ${formatIsoDateBr(String(item.paidAt).slice(0, 10))}` : "A pagar"}</small>` : ""}
              </td>
              <td class="${item.type === "income" ? "positive" : "negative"}">${money(item.amount)}</td>
              <td>
                <div class="table-actions">
                  ${internalTransfer ? `<button class="secondary table-action" type="button" data-open-account-transfer="${escapeHtml(item.accountTransferId || item.transferId || "")}">Ver transferência</button>` : savingsLedgerEntry ? `<a class="secondary table-action" href="/fluxo-de-caixa?panel=savings">Ver Cofrinho</a>` : automaticCoverage ? `<small>Cobertura automática</small>` : `
                    ${isPendingBill(item) ? `<button class="secondary table-action" type="button" data-pay-bill="${item.id || ""}">Marcar pago</button>` : ""}
                    <button class="secondary table-action" type="button" data-edit-cash="${item.id || ""}">Editar</button>
                    ${!item.reversedBy && !item.reversalOf ? `<button class="secondary table-action" type="button" data-reverse-cash="${item.id || ""}">Estornar</button>` : ""}
                    ${isAdminUser() ? `<button class="danger table-action" type="button" data-delete-cash="${item.id || ""}">Excluir</button>` : ""}
                  `}
                </div>
              </td>
            </tr>
          `; }).join("")}
        </tbody>
      </table>
    </div>
  `;
}

const MENU_DEFAULT_PACKAGING_COST = 1.6;
const MENU_DEFAULT_PROFIT_PERCENT = 30;
const WEEKLY_PROFITABILITY_UNIT_PRICE = 19.5;

function menuItemHasPlanningContent(item = {}) {
  return Boolean(
    String(item.dish || "").trim()
    || (item.ingredients || []).some(ingredient => {
      return String(ingredient.name || "").trim() || Number(ingredient.value || 0) > 0;
    })
  );
}

function menuItemManualDishCost(item = {}) {
  return menuItemHasPlanningContent(item)
    ? Math.max(0, Number(item.dishCost || 0))
    : 0;
}

function weeklyMenuSupermarketTotal(currentKey = menuKey(state.menuWeek || 1)) {
  return Math.max(0, Number(state.menuSupermarketCosts?.[currentKey] || 0));
}

function weeklyMenuProductionQuantity(currentKey = menuKey(state.menuWeek || 1)) {
  return productionOrders(weeklyOrders(currentKey))
    .reduce((sum, order) => sum + orderQuantity(order), 0);
}

function weeklyMenuSupermarketAllocation(
  currentKey = menuKey(state.menuWeek || 1),
  supermarketTotal = null
) {
  const total = supermarketTotal === null || supermarketTotal === undefined
    ? weeklyMenuSupermarketTotal(currentKey)
    : Math.max(0, Number(supermarketTotal || 0));
  const totalQuantity = weeklyMenuProductionQuantity(currentKey);
  return {
    supermarketTotal: total,
    totalQuantity,
    costPerUnit: totalQuantity > 0 ? total / totalQuantity : 0
  };
}

function menuItemPackagingCost(item = {}) {
  if (!menuItemHasPlanningContent(item)) {
    return 0;
  }
  return Object.prototype.hasOwnProperty.call(item, "packagingCost")
    ? Math.max(0, Number(item.packagingCost || 0))
    : MENU_DEFAULT_PACKAGING_COST;
}

function menuItemProfitPercent(item = {}) {
  return Object.prototype.hasOwnProperty.call(item, "profitPercent")
    ? Math.max(0, Number(item.profitPercent || 0))
    : MENU_DEFAULT_PROFIT_PERCENT;
}

function menuPlanningCosts(
  item = {},
  sharedPerUnit = pricingSharedCosts().totalPerUnit,
  supermarketPerUnit = monthlySupermarketAllocation(currentMenuPeriodKey()).costPerUnit
) {
  const supermarketCost = menuItemHasPlanningContent(item) ? Math.max(0, supermarketPerUnit) : 0;
  const sharedCost = menuItemHasPlanningContent(item) ? Math.max(0, sharedPerUnit) : 0;
  const packagingCost = menuItemPackagingCost(item);
  const profitPercent = menuItemProfitPercent(item);
  const totalCost = supermarketCost + sharedCost + packagingCost;
  const profit = totalCost * (profitPercent / 100);
  return {
    supermarketCost,
    sharedCost,
    packagingCost,
    profitPercent,
    totalCost,
    profit,
    suggestedPrice: totalCost + profit
  };
}

function weeklyMenuPlanningCosts(
  item = {},
  currentKey = menuKey(state.menuWeek || 1),
  supermarketTotal = null,
  sharedPerUnit = pricingSharedCosts().totalPerUnit
) {
  const supermarket = weeklyMenuSupermarketAllocation(currentKey, supermarketTotal);
  const sharedCosts = menuPlanningCosts(item, sharedPerUnit, supermarket.costPerUnit);
  const dishCost = menuItemManualDishCost(item);
  const totalCost = dishCost + sharedCosts.totalCost;
  const profit = totalCost * (sharedCosts.profitPercent / 100);
  return {
    ...sharedCosts,
    dishCost,
    totalCost,
    profit,
    suggestedPrice: totalCost + profit
  };
}

function menuCatalogRecordedCosts(item = {}, keyOrPeriod = menuKey(state.menuWeek || 1)) {
  const supermarket = String(keyOrPeriod || "").includes("-semana-")
    ? weeklyMenuSupermarketAllocation(keyOrPeriod)
    : monthlySupermarketAllocation(keyOrPeriod);
  const costs = menuPlanningCosts(
    item,
    pricingSharedCosts().totalPerUnit,
    supermarket.costPerUnit
  );
  return {
    ...costs,
    costConfigured: menuItemHasPlanningContent(item)
      && supermarket.supermarketTotal > 0
      && supermarket.totalQuantity > 0
  };
}

function menuCatalogStatusLabel(status = "") {
  return status === "pronto"
    ? "Pronto"
    : status === "preparo"
      ? "Em preparo"
      : status === "compras"
        ? "Lista de compras"
        : "Planejado";
}

function menuCatalogRows() {
  return [1, 2, 3, 4, 5].flatMap(week => {
    const currentKey = menuKey(week);
    return (state.menus[currentKey] || [])
      .filter(menuItemHasPlanningContent)
      .map(item => ({
        week,
        item,
        costs: menuCatalogRecordedCosts(item, currentKey),
        ingredients: (item.ingredients || [])
          .map(ingredient => String(ingredient.name || "").trim())
          .filter(Boolean)
      }));
  });
}

function filteredMenuCatalogRows(rows = menuCatalogRows()) {
  const filter = state.menuCatalogFilter || {};
  const query = String(filter.search || "").trim().toLowerCase();
  return rows.filter(row => {
    if (filter.week !== "all" && Number(filter.week) !== row.week) {
      return false;
    }
    if (filter.cost === "configured" && !row.costs.costConfigured) {
      return false;
    }
    if (filter.cost === "missing" && row.costs.costConfigured) {
      return false;
    }
    if (!query) {
      return true;
    }
    return [row.item.dish, row.item.notes, ...row.ingredients]
      .some(value => String(value || "").toLowerCase().includes(query));
  });
}

function menuCatalogPanel() {
  const allRows = menuCatalogRows();
  const rows = filteredMenuCatalogRows(allRows);
  const filter = state.menuCatalogFilter || {};
  const uniqueDishes = new Set(
    rows.map(row => String(row.item.dish || "").trim().toLowerCase()).filter(Boolean)
  ).size;
  const configuredRows = rows.filter(row => row.costs.costConfigured);
  const averageCost = configuredRows.length
    ? configuredRows.reduce((sum, row) => sum + row.costs.totalCost, 0) / configuredRows.length
    : 0;
  const averageProfit = configuredRows.length
    ? configuredRows.reduce((sum, row) => sum + row.costs.profit, 0) / configuredRows.length
    : 0;
  const periodLabel = formatMonthKeyBr(currentMenuPeriodKey());

  return `
    <section class="menu-catalog-panel" data-menu-catalog>
      <div class="section-heading">
        <div>
          <h2>Cumbucas disponibilizadas em ${periodLabel}</h2>
          <p class="muted-inline">Confira tudo o que entrou no cardápio do mês, o custo completo e o lucro calculado por prato.</p>
        </div>
        <a class="secondary table-action" href="/menu-semanal?ano=${state.menuPeriod.year}&mes=${state.menuPeriod.month}&semana=${state.menuWeek}">Cadastrar no Planejamento</a>
      </div>
      <form id="menu-catalog-filter" class="filter-bar menu-catalog-filter">
        <label>Buscar cumbuca
          <input name="search" placeholder="Nome do prato" value="${escapeHtml(filter.search || "")}">
        </label>
        <label>Semana
          <select name="week">
            <option value="all" ${filter.week === "all" ? "selected" : ""}>Todas</option>
            ${[1, 2, 3, 4, 5].map(week => `<option value="${week}" ${Number(filter.week) === week ? "selected" : ""}>Semana ${week}</option>`).join("")}
          </select>
        </label>
        <label>Custo
          <select name="cost">
            <option value="all" ${filter.cost === "all" ? "selected" : ""}>Todos</option>
            <option value="configured" ${filter.cost === "configured" ? "selected" : ""}>Com custo</option>
            <option value="missing" ${filter.cost === "missing" ? "selected" : ""}>Sem custo</option>
          </select>
        </label>
        <button type="submit">Filtrar</button>
        <button class="secondary" type="button" id="clear-menu-catalog-filter">Limpar</button>
      </form>
      <div class="summary menu-catalog-summary">
        <div class="metric"><span>Disponibilizações</span><strong>${rows.length}</strong></div>
        <div class="metric"><span>Cumbucas diferentes</span><strong>${uniqueDishes}</strong></div>
        <div class="metric"><span>Custo médio</span><strong>${money(averageCost)}</strong></div>
        <div class="metric"><span>Lucro médio por prato</span><strong>${money(averageProfit)}</strong></div>
      </div>
      ${rows.length ? `
        <div class="menu-catalog-grid">
          ${rows.map(row => `
            <article class="menu-catalog-card" data-menu-catalog-card data-catalog-week="${row.week}">
              <div class="menu-catalog-card-head">
                <span>Semana ${row.week}</span>
                <span class="pricing-status ${row.costs.costConfigured ? "profitable" : "pending"}">${row.costs.costConfigured ? menuCatalogStatusLabel(row.item.status) : "Custo pendente"}</span>
              </div>
              <h3>${escapeHtml(row.item.dish || `Cumbuca ${row.item.slot || ""}`)}</h3>
              <p>Supermercado registrado na semana dividido pelas cumbucas vendidas na mesma semana.</p>
              <div class="menu-cost-breakdown">
                <span><small>Supermercado por cumbuca</small><strong>${money(row.costs.supermarketCost)}</strong></span>
                <span><small>Outros custos rateados</small><strong>${money(row.costs.sharedCost)}</strong></span>
                <span><small>Embalagem</small><strong>${money(row.costs.packagingCost)}</strong></span>
                <span class="total"><small>Custo por cumbuca</small><strong>${row.costs.costConfigured ? money(row.costs.totalCost) : "Pendente"}</strong></span>
                <span class="profit"><small>Lucro (${row.costs.profitPercent.toLocaleString("pt-BR")}%)</small><strong>${row.costs.costConfigured ? money(row.costs.profit) : "Pendente"}</strong></span>
                <span class="suggested-price"><small>Preço sugerido</small><strong>${row.costs.costConfigured ? money(row.costs.suggestedPrice) : "Pendente"}</strong></span>
              </div>
              <a class="secondary table-action" href="/menu-semanal?ano=${state.menuPeriod.year}&mes=${state.menuPeriod.month}&semana=${row.week}">Abrir semana ${row.week}</a>
            </article>
          `).join("")}
        </div>
      ` : `<p class="muted menu-catalog-empty">Nenhuma cumbuca encontrada para os filtros deste mês.</p>`}
    </section>
  `;

}

async function renderMenu() {
  const currentMenuRoute = routeName();
  const requestedMenuView = new URLSearchParams(location.search).get("view");
  const isLegacyMenuOverview = currentMenuRoute === "menu-semanal" && !requestedMenuView;
  const activeMenuRoute = currentMenuRoute === "pedidos" || ["form", "orders", "delivery"].includes(requestedMenuView)
    ? "pedidos"
    : requestedMenuView === "production"
      ? "producao"
      : "cardapio";
  const menuPageTitle = isLegacyMenuOverview
    ? "Menu Semanal"
    : activeMenuRoute === "pedidos"
    ? "Semanal"
    : activeMenuRoute === "producao"
      ? "Produção"
      : "Cardápio";
  showStandardHero(menuPageTitle);
  setActive(isLegacyMenuOverview ? "menu-semanal" : activeMenuRoute);
  const currentWeek = state.menuWeek || 1;
  const currentKey = menuKey(currentWeek);
  const savedMenu = state.menus[currentKey] || [];
  const result = await postJson("/api/menu-semanal", { meals: savedMenu });
  const sharedCosts = pricingSharedCosts();
  const supermarketAllocation = weeklyMenuSupermarketAllocation(currentKey);
  result.plan = result.plan.map((item, index) => {
    const savedItem = savedMenu[index] || item;
    const normalizedItem = {
      slot: item.slot,
      dish: item.dish,
      dishCost: Math.max(0, Number(savedItem.dishCost || 0)),
      status: item.status,
      notes: item.notes,
      packagingCost: Object.prototype.hasOwnProperty.call(savedItem, "packagingCost")
        ? Math.max(0, Number(savedItem.packagingCost || 0))
        : MENU_DEFAULT_PACKAGING_COST,
      profitPercent: menuItemProfitPercent(savedItem)
    };
    const costs = weeklyMenuPlanningCosts(
      normalizedItem,
      currentKey,
      supermarketAllocation.supermarketTotal,
      sharedCosts.totalPerUnit
    );
    return {
      ...normalizedItem,
      sharedCost: costs.sharedCost,
      cost: costs.totalCost,
      profit: costs.profit,
      suggestedPrice: costs.suggestedPrice
    };
  });
  result.totalCost = weeklyMenuProductionCost(
    result.plan,
    weeklyOrders(currentKey),
    item => Number(item.cost || 0)
  );
  const weeklyOrderedQuantity = supermarketAllocation.totalQuantity;
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
            <a href="/menu-semanal?ano=${state.menuPeriod.year}&mes=${state.menuPeriod.month}&semana=${week}" class="${week === currentWeek && !state.showMonthSummary && !state.showMenuCatalog ? "active" : ""}" data-week="${week}">Semana ${week}</a>
          `).join("")}
          <a href="/menu-semanal?ano=${state.menuPeriod.year}&mes=${state.menuPeriod.month}&resumo=mes" class="${state.showMonthSummary ? "active" : ""}" data-month-summary>Resumo do mês</a>
          <a href="/menu-semanal?ano=${state.menuPeriod.year}&mes=${state.menuPeriod.month}&catalogo=cumbucas" class="${state.showMenuCatalog ? "active" : ""}" data-menu-catalog-link>Cumbucas do mês</a>
        </div>
      </div>
      ${state.showMenuCatalog ? menuCatalogPanel() : state.showMonthSummary ? monthSummaryPanel(currentKey) : `
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
          <div class="pricing-workflow-context menu-pricing-source">
            <div>
              <strong>Cadastre os custos do menu diretamente no Planejamento</strong>
              <span>Informe o custo de cada prato e o gasto total de supermercado desta semana. O supermercado será dividido somente pelas ${supermarketAllocation.totalQuantity} cumbuca(s) pedida(s) neste menu${supermarketAllocation.totalQuantity > 0 ? `, ficando ${money(supermarketAllocation.costPerUnit)} por unidade` : ""}, e entrará no Resumo do mês do Menu Semanal.</span>
            </div>
            <a class="secondary table-action" href="/precificacao?view=costs">Configurar outros custos rateados</a>
          </div>
          <div class="summary planning-summary">
            <div class="metric"><span>Custo total da semana</span><strong data-menu-weekly-cost>${money(result.totalCost)}</strong><small data-menu-weekly-quantity>${weeklyOrderedQuantity} cumbuca(s) pedida(s)</small></div>
            <div class="metric"><span>Lista de compras</span><strong>${planningStats.shopping}</strong></div>
            <div class="metric"><span>Em preparo</span><strong>${planningStats.prep}</strong></div>
            <div class="metric"><span>Pratos prontos</span><strong>${planningStats.ready}/5</strong></div>
          </div>
          <form id="menu-form">
            <div class="menu-weekly-supermarket-entry">
              <label>Gasto total de supermercado desta semana
                <input name="weekly-supermarket-total" data-menu-weekly-supermarket-total type="text" inputmode="decimal" value="${moneyInputValue(supermarketAllocation.supermarketTotal)}" placeholder="Ex.: 1.500,00">
                <small>Valor manual usado somente neste menu semanal.</small>
              </label>
              <div class="menu-weekly-supermarket-result">
                <span>Dividido por <strong data-menu-supermarket-quantity>${supermarketAllocation.totalQuantity}</strong> cumbuca(s)</span>
                <span>Supermercado por unidade <strong data-menu-supermarket-unit>${money(supermarketAllocation.costPerUnit)}</strong></span>
              </div>
            </div>
            <div class="planning-board">
              ${result.plan.map((item, index) => {
                const costs = weeklyMenuPlanningCosts(
                  item,
                  currentKey,
                  supermarketAllocation.supermarketTotal,
                  sharedCosts.totalPerUnit
                );
                return `
                <article class="planning-card" data-status="${item.status}">
                  <div class="planning-card-top">
                    <span>Cumbuca ${item.slot}</span>
                    <strong>${item.status === "pronto" ? "Pronto" : item.status === "preparo" ? "Preparo" : item.status === "compras" ? "Compras" : "Planejado"}</strong>
                  </div>
                  <label>Nome da cumbuca
                    <input name="dish-${index}" data-menu-dish="${index}" value="${escapeHtml(item.dish || "")}" placeholder="Ex.: Frango cremoso com arroz">
                    <small>O prato desta semana é cadastrado e editado aqui.</small>
                  </label>
                  <label>Custo manual do prato por unidade
                    <input name="dish-cost-${index}" data-menu-dish-cost="${index}" type="text" inputmode="decimal" value="${moneyInputValue(item.dishCost)}" placeholder="Ex.: 8,50">
                    <small>Informe manualmente quanto custa produzir uma unidade deste prato.</small>
                  </label>
                  <div class="menu-profit-controls">
                    <label>Valor da embalagem
                      <input name="packaging-${index}" data-menu-packaging="${index}" type="text" inputmode="decimal" value="${moneyInputValue(item.packagingCost)}" placeholder="R$ 1,60">
                    </label>
                    <label>Porcentagem de lucro
                      <div class="percentage-input">
                        <input name="profit-percent-${index}" data-menu-profit-percent="${index}" type="text" inputmode="decimal" value="${moneyInputValue(item.profitPercent)}" placeholder="30">
                        <span>%</span>
                      </div>
                      <small>Aplicada sobre o custo total da cumbuca.</small>
                    </label>
                  </div>
                  <div class="menu-cost-breakdown" data-menu-cost-breakdown="${index}">
                    <span><small>Custo manual do prato</small><strong data-menu-dish-cost-value>${money(costs.dishCost)}</strong></span>
                    <span><small>Supermercado semanal rateado</small><strong data-menu-supermarket-rate>${money(costs.supermarketCost)}</strong></span>
                    <span><small>Outros custos rateados</small><strong data-menu-shared-cost>${money(costs.sharedCost)}</strong></span>
                    <span><small>Embalagem</small><strong data-menu-packaging-cost>${money(costs.packagingCost)}</strong></span>
                    <span class="total"><small>Custo total por cumbuca</small><strong data-menu-total-cost>${money(costs.totalCost)}</strong></span>
                    <span class="profit"><small data-menu-profit-label>Lucro (${costs.profitPercent.toLocaleString("pt-BR")}%)</small><strong data-menu-profit>${money(costs.profit)}</strong></span>
                    <span class="suggested-price"><small>Preço sugerido</small><strong data-menu-suggested-price>${money(costs.suggestedPrice)}</strong></span>
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
                    <textarea name="notes-${index}" placeholder="Compra, preparo, entrega">${escapeHtml(item.notes || "")}</textarea>
                  </label>
                </article>
              `; }).join("")}
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

  enhanceResponsiveTables(app);

  document.querySelectorAll("[data-week]").forEach(link => {
    link.addEventListener("click", event => {
      event.preventDefault();
      state.menuWeek = Number(event.currentTarget.dataset.week);
      state.showMonthSummary = false;
      state.showMenuCatalog = false;
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
      state.showMenuCatalog = false;
      state.showClients = false;
      state.showOrders = false;
      state.showPlanning = false;
      history.replaceState(null, "", `/menu-semanal?ano=${state.menuPeriod.year}&mes=${state.menuPeriod.month}&resumo=mes`);
      renderMenu();
    });
  }

  const menuCatalogLink = document.querySelector("[data-menu-catalog-link]");
  if (menuCatalogLink) {
    menuCatalogLink.addEventListener("click", event => {
      event.preventDefault();
      state.showMenuCatalog = true;
      state.showMonthSummary = false;
      state.showClients = false;
      state.showOrders = false;
      state.showPlanning = false;
      history.replaceState(null, "", `/menu-semanal?ano=${state.menuPeriod.year}&mes=${state.menuPeriod.month}&catalogo=cumbucas`);
      renderMenu();
    });
  }

  on("#menu-catalog-filter", "submit", event => {
    event.preventDefault();
    const data = readForm(event.currentTarget);
    state.menuCatalogFilter = {
      search: String(data.search || "").trim(),
      week: String(data.week || "all"),
      cost: String(data.cost || "all")
    };
    renderMenu();
  });

  on("#clear-menu-catalog-filter", "click", () => {
    state.menuCatalogFilter = { search: "", week: "all", cost: "all" };
    renderMenu();
  });

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
      state.renewClientIndex = null;
      renderMenu();
    });
  }

  document.querySelectorAll("[data-client-tab]").forEach(button => {
    button.addEventListener("click", event => {
      state.clientTab = event.currentTarget.dataset.clientTab;
      if (state.clientTab === "list") {
        state.editClientIndex = null;
      }
      state.renewClientIndex = null;
      renderMenu();
    });
  });

  document.querySelectorAll("[data-edit-client]").forEach(button => {
    button.addEventListener("click", event => {
      state.editClientIndex = Number(event.currentTarget.dataset.editClient);
      state.renewClientIndex = null;
      state.clientTab = "form";
      renderMenu();
    });
  });

  document.querySelectorAll("[data-client-history]").forEach(button => {
    button.addEventListener("click", event => {
      state.clientHistoryPhone = event.currentTarget.dataset.clientHistory;
      state.renewClientIndex = null;
      state.clientTab = "list";
      renderMenu();
    });
  });

  const closeClientHistory = document.querySelector("#close-client-history");
  if (closeClientHistory) {
    closeClientHistory.addEventListener("click", () => {
      state.clientHistoryPhone = "";
      renderMenu();
    });
  }

  bindMonthlyRenewalControls(currentKey);

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
    const monthlyQuantityField = clientForm.querySelector("[name='monthlyQuantity']");
    function updateDeliveryVisibility() {
      clientForm.dataset.plan = planField.value;
      const isMonthly = planField.value === "mensalista";
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
          ...(monthlyPackages[periodKey] || {}),
          monthlyQuantity: data.monthlyQuantity
        };
      }

      const client = {
        ...data,
        weeklyDeliveryFee: parseMoneyInput(data.weeklyDeliveryFee).toFixed(2),
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
      const nextTab = event.currentTarget.dataset.orderTab;
      if (state.orderTab === nextTab) {
        return;
      }
      state.orderTab = nextTab;
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
    const orderValueFields = document.querySelector("#order-value-fields");
    const orderValueField = orderForm.querySelector("[name='orderValue']");
    const orderValueLabel = document.querySelector("#order-value-label");
    const orderValueHint = document.querySelector("#order-value-hint");
    const deliveryFeeFieldContainer = document.querySelector("#order-delivery-fee-field");
    const paidFieldContainer = document.querySelector("#order-paid-field");
    const deliveryFeeField = orderForm.querySelector("[name='orderDeliveryFee']");
    const paidField = orderForm.querySelector("[name='paid']");
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

    function updateOrderValueFields() {
      const client = selectedOrderClient();
      const hasClient = Boolean(client.phone);
      const isWeekly = client.plan === "semanal";
      const isMonthly = client.plan === "mensalista";
      orderValueFields.hidden = !hasClient;
      orderValueField.disabled = !hasClient;
      orderValueField.required = isWeekly;
      orderValueLabel.textContent = isMonthly ? "Mensalidade recebida" : "Valor em real deste pedido";
      orderValueHint.hidden = !isMonthly;
      deliveryFeeFieldContainer.hidden = !isWeekly;
      paidFieldContainer.hidden = !isWeekly;
      deliveryFeeField.disabled = !isWeekly;
      paidField.disabled = !isWeekly;
      if (isWeekly && deliveryFeeField && !state.editOrderId) {
        deliveryFeeField.value = moneyInputValue(client.weeklyDeliveryFee || client.deliveryFee);
      }
      updateOrderTotal();
    }

    clientField.addEventListener("change", updateOrderValueFields);
    quantityFields.forEach(field => {
      field.addEventListener("input", updateOrderTotal);
    });
    orderForm.querySelectorAll(".dish-option input").forEach(field => {
      field.addEventListener("input", updateOrderTotal);
    });
    updateOrderTotal();

    orderForm.addEventListener("submit", async event => {
      event.preventDefault();
      const releaseSubmission = lockFormSubmission(event.currentTarget);
      if (!releaseSubmission) {
        return;
      }
      try {
      const data = new FormData(event.currentTarget);
      const dishes = [1, 2, 3, 4, 5]
        .map(slot => ({
          slot,
          quantity: Number(data.get(`dish-${slot}`) || 0)
        }))
        .filter(item => item.quantity > 0);
      const clientPhone = data.get("clientPhone");
      const client = clientByPhone(clientPhone);
      const orderValue = parseMoneyInput(data.get("orderValue"));
      const deliveryFee = client.plan === "semanal" ? parseMoneyInput(data.get("orderDeliveryFee")) : 0;
      const paid = client.plan === "semanal" && data.get("paid") === "on";

      if (!dishes.length) {
        showToast("Informe pelo menos uma cumbuca no pedido.", "error");
        return;
      }
      if (!clientPhone) {
        showToast("Selecione um cliente para o pedido.", "error");
        return;
      }
      if (client.plan === "semanal" && orderValue <= 0) {
        showToast("Informe o valor deste pedido.", "error");
        return;
      }
      const editingOrder = state.editOrderId
        ? state.orders.find(order => Number(order.id) === Number(state.editOrderId))
        : null;

      let remainingAfterOrder = null;
      if (client.plan === "mensalista") {
        const requested = dishes.reduce((sum, dish) => sum + Number(dish.quantity || 0), 0);
        const packageQuantity = clientMonthlyQuantity(client, currentKey);
        if (packageQuantity <= 0) {
          alert("Informe a quantidade do pacote mensal no cadastro deste cliente.");
          return;
        }
        const orderedBefore = clientOrderedQuantity(client, currentKey, state.editOrderId);
        const capacityWithoutEditedOrder = clientMonthlyCapacity(client, currentKey, state.editOrderId);
        const preservedLegacyCapacity = Math.max(
          0,
          clientMonthlyCapacity(client, currentKey) - capacityWithoutEditedOrder
        );
        const available = Math.max(
          0,
          capacityWithoutEditedOrder + preservedLegacyCapacity - orderedBefore
        );
        if (requested > available) {
          alert(`Saldo insuficiente para ${client.name || "este mensalista"}. Restam ${available} cumbuca(s). Abra Cadastro de clientes > Clientes cadastrados > Renovar quantidade.`);
          return;
        }
        remainingAfterOrder = available - requested;
      }

      const duplicateOrder = !state.editOrderId && state.orders.some(order =>
        !isMonthlyRenewalRecord(order)
        &&
        order.menuKey === currentKey
        && String(order.clientPhone || "") === String(clientPhone || "")
      );
      if (duplicateOrder && !confirm("Este cliente já tem pedido nesta semana. Criar outro pedido mesmo assim?")) {
        return;
      }

      const savedOrder = {
        id: state.editOrderId || Date.now(),
        menuKey: currentKey,
        clientPhone,
        dishes,
        amount: orderValue,
        deliveryFee,
        paid: client.plan === "mensalista" ? orderValue > 0 : paid,
        paidAmount: client.plan === "mensalista"
          ? orderValue
          : editingOrder?.paidAmount || (paid ? orderValue : 0),
        monthlyPackageCount: client.plan === "mensalista"
          ? editingOrder?.monthlyPackageCount
          : undefined,
        delivered: editingOrder?.delivered || false,
        deliveredAt: editingOrder?.deliveredAt || "",
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
      if (!await persistState()) {
        return;
      }
      state.editOrderId = null;
      state.orderTab = "orders";
      if (remainingAfterOrder !== null && remainingAfterOrder <= LOW_MONTHLY_QUANTITY) {
        alert(monthlyQuantityWarningText(client, remainingAfterOrder));
      }
      await renderMenu();
      } finally {
        releaseSubmission();
      }
    });
    updateOrderValueFields();

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
          Number(order.id) === id ? { ...order, paid: !isOrderPaid(order), paidAmount: !isOrderPaid(order) ? Number(order.amount || 0) : 0 } : order
        ));
        persistState();
        renderMenu();
      });
    });

    document.querySelectorAll("[data-partial-paid-order]").forEach(button => {
      button.addEventListener("click", event => {
        const id = Number(event.currentTarget.dataset.partialPaidOrder);
        updateOrderPartialPayment(id);
      });
    });

    document.querySelectorAll("[data-toggle-delivered-order]").forEach(button => {
      button.addEventListener("click", event => {
        const id = Number(event.currentTarget.dataset.toggleDeliveredOrder);
        toggleOrderDelivered(id);
      });
    });

    const downloadProduction = document.querySelector("[data-download-production]");
    if (downloadProduction) {
      downloadProduction.addEventListener("click", () => {
        downloadTextFile(`cumbuca-producao-${currentKey}.txt`, productionListText(result.plan, currentKey), "text/plain;charset=utf-8");
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
        const order = state.orders.find(item => Number(item.id) === id);
        const message = isMonthlyRenewalRecord(order)
          ? "Excluir esta renovação? A quantidade liberada e o valor lançado serão removidos."
          : "Excluir este pedido?";
        if (!confirm(message)) {
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
        Number(order.id) === id ? { ...order, paid: !isOrderPaid(order), paidAmount: !isOrderPaid(order) ? Number(order.amount || 0) : 0 } : order
      ));
      persistState();
      renderMenu();
    });
  });

  document.querySelectorAll("[data-partial-paid-order]").forEach(button => {
    button.addEventListener("click", event => {
      const id = Number(event.currentTarget.dataset.partialPaidOrder);
      updateOrderPartialPayment(id);
    });
  });

  document.querySelectorAll("[data-toggle-delivered-order]").forEach(button => {
    button.addEventListener("click", event => {
      const id = Number(event.currentTarget.dataset.toggleDeliveredOrder);
      toggleOrderDelivered(id);
    });
  });

  const orderFilterForm = document.querySelector("#order-filter-form");
  if (orderFilterForm) {
    orderFilterForm.addEventListener("submit", event => {
      event.preventDefault();
      state.orderFilter = {
        ...state.orderFilter,
        ...readForm(event.currentTarget)
      };
      localStorage.setItem("orderFilter", JSON.stringify(state.orderFilter));
      renderMenu();
    });
  }

  const clearOrderFilters = document.querySelector("#clear-order-filters");
  if (clearOrderFilters) {
    clearOrderFilters.addEventListener("click", () => {
      state.orderFilter = { search: "", payment: "all", delivery: "all" };
      localStorage.setItem("orderFilter", JSON.stringify(state.orderFilter));
      renderMenu();
    });
  }

  const orderSearch = document.querySelector("[data-order-search]");
  if (orderSearch) {
    orderSearch.addEventListener("input", event => {
      state.orderFilter = {
        ...(state.orderFilter || { payment: "all", delivery: "all" }),
        search: event.currentTarget.value
      };
      localStorage.setItem("orderFilter", JSON.stringify(state.orderFilter));
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
      const order = state.orders.find(item => Number(item.id) === id);
      const message = isMonthlyRenewalRecord(order)
        ? "Excluir esta renovação? A quantidade liberada e o valor lançado serão removidos."
        : "Excluir este pedido?";
      if (!confirm(message)) {
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

  on("#menu-period-form", "submit", event => {
    event.preventDefault();
    const data = readForm(event.currentTarget);
    state.menuPeriod = {
      year: Number(data.year),
      month: Number(data.month)
    };
    persistState();
    const selectedView = state.showMenuCatalog
      ? "&catalogo=cumbucas"
      : state.showMonthSummary
        ? "&resumo=mes"
        : `&semana=${state.menuWeek}`;
    history.replaceState(null, "", `/menu-semanal?ano=${state.menuPeriod.year}&mes=${state.menuPeriod.month}${selectedView}`);
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
    function currentWeeklySupermarketTotal() {
      return Math.max(
        0,
        parseMoneyInput(menuForm.querySelector("[data-menu-weekly-supermarket-total]")?.value)
      );
    }

    function updateMenuCostPreview(menuIndex) {
      const dish = menuForm.querySelector(`[data-menu-dish="${menuIndex}"]`)?.value || "";
      const dishCost = Math.max(
        0,
        parseMoneyInput(menuForm.querySelector(`[data-menu-dish-cost="${menuIndex}"]`)?.value)
      );
      const packagingCost = Math.max(
        0,
        parseMoneyInput(menuForm.querySelector(`[data-menu-packaging="${menuIndex}"]`)?.value)
      );
      const profitPercent = Math.max(
        0,
        parseMoneyInput(menuForm.querySelector(`[data-menu-profit-percent="${menuIndex}"]`)?.value)
      );
      const costs = weeklyMenuPlanningCosts(
        {
          dish,
          dishCost,
          packagingCost,
          profitPercent
        },
        currentKey,
        currentWeeklySupermarketTotal(),
        sharedCosts.totalPerUnit
      );
      const breakdown = menuForm.querySelector(`[data-menu-cost-breakdown="${menuIndex}"]`);
      if (breakdown) {
        breakdown.querySelector("[data-menu-dish-cost-value]").textContent = money(costs.dishCost);
        breakdown.querySelector("[data-menu-supermarket-rate]").textContent = money(costs.supermarketCost);
        breakdown.querySelector("[data-menu-shared-cost]").textContent = money(costs.sharedCost);
        breakdown.querySelector("[data-menu-packaging-cost]").textContent = money(costs.packagingCost);
        breakdown.querySelector("[data-menu-total-cost]").textContent = money(costs.totalCost);
        breakdown.querySelector("[data-menu-profit-label]").textContent = `Lucro (${costs.profitPercent.toLocaleString("pt-BR")}%)`;
        breakdown.querySelector("[data-menu-profit]").textContent = money(costs.profit);
        breakdown.querySelector("[data-menu-suggested-price]").textContent = money(costs.suggestedPrice);
      }
      return costs.totalCost;
    }

    function updateMenuWeeklyCostPreview() {
      const allocation = weeklyMenuSupermarketAllocation(
        currentKey,
        currentWeeklySupermarketTotal()
      );
      const supermarketQuantity = menuForm.querySelector("[data-menu-supermarket-quantity]");
      const supermarketUnit = menuForm.querySelector("[data-menu-supermarket-unit]");
      if (supermarketQuantity) {
        supermarketQuantity.textContent = String(allocation.totalQuantity);
      }
      if (supermarketUnit) {
        supermarketUnit.textContent = money(allocation.costPerUnit);
      }
      const unitCosts = result.plan.map((item, index) => updateMenuCostPreview(index));
      const total = weeklyMenuProductionCost(
        result.plan,
        weeklyOrders(currentKey),
        (item, index) => unitCosts[index]
      );
      const weeklyCost = menuForm
        .closest(".planning-panel")
        ?.querySelector("[data-menu-weekly-cost]");
      if (weeklyCost) {
        weeklyCost.textContent = money(total);
      }
    }

    menuForm.addEventListener("input", event => {
      const menuIndex = event.target.dataset.menuDishCost
        ?? event.target.dataset.menuDish
        ?? event.target.dataset.menuPackaging
        ?? event.target.dataset.menuProfitPercent;
      if (menuIndex !== undefined || event.target.dataset.menuWeeklySupermarketTotal !== undefined) {
        updateMenuWeeklyCostPreview();
      }
    });

    menuForm.addEventListener("submit", event => {
      event.preventDefault();
      const data = readForm(event.currentTarget);
      const supermarketTotal = Math.max(0, parseMoneyInput(data["weekly-supermarket-total"]));
      state.menuSupermarketCosts[currentKey] = supermarketTotal.toFixed(2);
      state.menus[currentKey] = result.plan.map((item, index) => {
        const dish = String(data[`dish-${index}`] || "").trim();
        const dishCost = Math.max(0, parseMoneyInput(data[`dish-cost-${index}`]));
        const packagingCost = Math.max(0, parseMoneyInput(data[`packaging-${index}`]));
        const profitPercent = Math.max(0, parseMoneyInput(data[`profit-percent-${index}`]));
        const costs = weeklyMenuPlanningCosts(
          { dish, dishCost, packagingCost, profitPercent },
          currentKey,
          supermarketTotal,
          sharedCosts.totalPerUnit
        );
        return {
          slot: index + 1,
          dish,
          dishCost: dishCost.toFixed(2),
          sharedCost: costs.sharedCost.toFixed(2),
          packagingCost: packagingCost.toFixed(2),
          profitPercent: profitPercent.toFixed(2),
          cost: costs.totalCost.toFixed(2),
          profit: costs.profit.toFixed(2),
          suggestedPrice: costs.suggestedPrice.toFixed(2),
          status: data[`status-${index}`],
          notes: data[`notes-${index}`]
        };
      });
      persistState();
      renderMenu();
    });

    on("#clear-menu", "click", () => {
      state.menus[currentKey] = [];
      delete state.menuSupermarketCosts[currentKey];
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
          <input name="name" placeholder="Nome do cliente" value="${escapeHtml(editing?.name || "")}" required>
        </label>
        <label class="client-address">Endereço
          <input name="address" placeholder="Rua, número, bairro" value="${escapeHtml(editing?.address || "")}" required>
        </label>
        <label>Complemento
          <input name="complement" placeholder="Apto, bloco, referência" value="${escapeHtml(editing?.complement || "")}">
        </label>
        <label>Telefone
          <input name="phone" type="tel" placeholder="(00) 00000-0000" value="${escapeHtml(editing?.phone || "")}" required>
        </label>
        <label>Plano
          <select name="plan" required>
            <option value="semanal" ${editing?.plan === "semanal" ? "selected" : ""}>Semanal</option>
            <option value="mensalista" ${editing?.plan === "mensalista" ? "selected" : ""}>Mensalista</option>
          </select>
        </label>
        <label class="weekly-freight-value">Frete
          <input name="weeklyDeliveryFee" type="text" inputmode="decimal" placeholder="0,00" value="${moneyInputValue(editing?.weeklyDeliveryFee || editing?.deliveryFee)}">
        </label>
        <label class="monthly-quantity">Quantidade do mês
          <input name="monthlyQuantity" type="number" min="0" step="1" placeholder="0" value="${packageForMonth.monthlyQuantity || ""}">
          <small>Esta é a quantidade inicial. Quando acabar, use Renovar quantidade na lista de clientes.</small>
        </label>
        <label class="client-notes">Observação
          <textarea name="notes" placeholder="Preferência, restrição, detalhe de entrega">${escapeHtml(editing?.notes || "")}</textarea>
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

function bindMonthlyRenewalControls(currentKey) {
  document.querySelectorAll("[data-renew-client]").forEach(button => {
    button.addEventListener("click", event => {
      state.renewClientIndex = Number(event.currentTarget.dataset.renewClient);
      state.clientHistoryPhone = "";
      state.clientTab = "list";
      renderMenu();
    });
  });

  const cancelMonthlyRenewal = document.querySelector("#cancel-monthly-renewal");
  if (cancelMonthlyRenewal) {
    cancelMonthlyRenewal.addEventListener("click", () => {
      state.renewClientIndex = null;
      renderMenu();
    });
  }

  const monthlyRenewalForm = document.querySelector("#monthly-renewal-form");
  if (monthlyRenewalForm) {
    const paymentToggle = monthlyRenewalForm.querySelector("[data-renewal-payment-toggle]");
    const valueField = monthlyRenewalForm.querySelector("[data-renewal-value-field]");
    const amountField = monthlyRenewalForm.elements.monthlyFeeAmount;
    function updateMonthlyRenewalPaymentVisibility() {
      const launchValue = paymentToggle.checked;
      valueField.hidden = !launchValue;
      amountField.disabled = !launchValue;
      amountField.required = launchValue;
      if (!launchValue) {
        amountField.value = "";
      }
    }
    paymentToggle.addEventListener("change", updateMonthlyRenewalPaymentVisibility);
    updateMonthlyRenewalPaymentVisibility();

    monthlyRenewalForm.addEventListener("submit", async event => {
      event.preventDefault();
      const releaseSubmission = lockFormSubmission(event.currentTarget);
      if (!releaseSubmission) {
        return;
      }
      try {
        const clientIndex = Number(event.currentTarget.dataset.clientIndex);
        const client = state.clients[clientIndex];
        const quantity = Math.max(0, Math.floor(Number(event.currentTarget.elements.renewalQuantity.value || 0)));
        const launchValue = paymentToggle.checked;
        const amount = launchValue ? Math.max(0, parseMoneyInput(amountField.value)) : 0;
        if (!client || client.plan !== "mensalista") {
          showToast("Mensalista não encontrado.", "error");
          return;
        }
        if (quantity <= 0) {
          showToast("Informe a nova quantidade de cumbucas.", "error");
          return;
        }
        if (launchValue && amount <= 0) {
          showToast("Informe o valor recebido da mensalidade.", "error");
          return;
        }

        const now = new Date().toISOString();
        state.orders.push({
          id: Date.now(),
          menuKey: currentKey,
          clientPhone: client.phone,
          dishes: [],
          amount,
          deliveryFee: 0,
          paid: amount > 0,
          paidAmount: amount,
          monthlyRenewal: true,
          renewalQuantity: quantity,
          delivered: true,
          deliveredAt: now,
          notes: launchValue
            ? `Renovação de ${quantity} cumbuca(s) com mensalidade lançada.`
            : `Renovação de ${quantity} cumbuca(s) sem lançamento da mensalidade.`,
          createdAt: now
        });
        recordAudit(
          "Quantidade mensal renovada",
          `${client.name || client.phone}: +${quantity} cumbuca(s)${amount > 0 ? `, mensalidade ${money(amount)}` : ", sem valor financeiro"}`
        );
        if (!await persistState()) {
          return;
        }
        state.renewClientIndex = null;
        await renderMenu();
        showToast(
          amount > 0
            ? `Quantidade renovada e mensalidade de ${money(amount)} lançada.`
            : "Quantidade renovada sem lançamento financeiro.",
          "success"
        );
      } finally {
        releaseSubmission();
      }
    });
  }
}

function monthlyRenewalPanel(client, clientIndex, currentKey) {
  if (!client || client.plan !== "mensalista") {
    return "";
  }

  const remaining = clientRemainingQuantity(client, currentKey);
  const capacity = clientMonthlyCapacity(client, currentKey);
  const defaultQuantity = clientMonthlyQuantity(client, currentKey);
  const recordedValue = clientMonthlyRecordedValue(client, currentKey);
  return `
    <section class="monthly-renewal-panel" data-monthly-renewal-panel>
      <div class="section-heading">
        <div>
          <h3>Renovar quantidade de ${escapeHtml(client.name || client.phone)}</h3>
          <p class="muted-inline">A nova quantidade é somada ao saldo. Você decide se quer lançar o valor da mensalidade agora.</p>
        </div>
        <button class="secondary" type="button" id="cancel-monthly-renewal">Cancelar</button>
      </div>
      <div class="summary monthly-renewal-summary">
        <div class="metric"><span>Saldo atual</span><strong>${remaining}</strong><small>de ${capacity} liberadas no mês</small></div>
        <div class="metric"><span>Quantidade sugerida</span><strong>${defaultQuantity}</strong><small>igual ao pacote inicial</small></div>
        <div class="metric"><span>Mensalidade lançada</span><strong>${money(recordedValue)}</strong><small>somente valores informados</small></div>
      </div>
      <form id="monthly-renewal-form" class="monthly-renewal-form" data-client-index="${clientIndex}">
        <label>Nova quantidade de cumbucas
          <input name="renewalQuantity" type="number" min="1" step="1" value="${defaultQuantity || ""}" required>
          <small>Essa quantidade será acrescentada ao saldo disponível.</small>
        </label>
        <label class="checkbox-field monthly-renewal-payment-toggle">
          <input name="launchMonthlyFee" type="checkbox" data-renewal-payment-toggle>
          <span>Lançar o valor da mensalidade agora</span>
        </label>
        <label data-renewal-value-field hidden>Valor da mensalidade recebida
          <input name="monthlyFeeAmount" type="text" inputmode="decimal" placeholder="0,00" disabled>
          <small>Se não marcar a opção acima, nenhum valor será lançado.</small>
        </label>
        <div class="actions">
          <button type="submit">Confirmar renovação</button>
        </div>
      </form>
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
        <input data-client-search placeholder="Nome, telefone, endereço ou observação" value="${escapeHtml(state.clientSearch || "")}">
      </label>
    </div>
    <div class="table-wrap client-table">
      <table>
        <thead><tr><th>Nome</th><th>Endereço</th><th>Complemento</th><th>Telefone</th><th>Plano</th><th>Valor</th><th>Frete / Qtd. restante</th><th>Obs.</th><th></th></tr></thead>
        <tbody>
          ${orderedClients.map(({ client, index }) => `
            <tr data-client-row="${index}">
              <td>${escapeHtml(client.name || "")}${client.inactive ? ` <span class="payment-badge pending">Inativo</span>` : ""}</td>
              <td>${escapeHtml(client.address || "")}</td>
              <td>${escapeHtml(client.complement || "")}</td>
              <td>${escapeHtml(client.phone || "")}</td>
              <td>${client.plan === "mensalista" ? "Mensalista" : "Semanal"}</td>
              <td>${client.plan === "mensalista" ? "Manual ao renovar ou no pedido" : "Variável"}</td>
              <td>
                ${client.plan === "mensalista" ? `<span class="monthly-quantity-balance"><strong>${clientRemainingQuantity(client, currentKey)} restantes</strong><small>${clientMonthlyCapacity(client, currentKey)} liberadas no mês</small></span> ${clientChargedPackageCount(client, currentKey) > 1 ? `<span class="quantity-badge renewed">${clientChargedPackageCount(client, currentKey)} pacotes</span>` : ""} ${clientQuantityStatus(client, currentKey)}` : money(client.weeklyDeliveryFee || client.deliveryFee)}
              </td>
              <td>${escapeHtml(client.notes || "")}</td>
              <td>
                <div class="table-actions">
                  <button class="secondary table-action" type="button" data-edit-client="${index}">Editar</button>
                  ${client.plan === "mensalista" && !client.inactive ? `<button class="secondary table-action" type="button" data-renew-client="${index}">Renovar quantidade</button>` : ""}
                  <button class="secondary table-action" type="button" data-client-history="${client.phone || ""}">Histórico</button>
                  ${client.phone ? `<a class="secondary table-action" href="${client.plan === "mensalista" ? monthlyRenewalWhatsAppUrl(client, currentKey) : clientChargeWhatsAppUrl(client)}" target="_blank" rel="noopener">WhatsApp</a>` : ""}
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
    ${state.renewClientIndex !== null ? monthlyRenewalPanel(state.clients[state.renewClientIndex], state.renewClientIndex, currentKey) : ""}
    ${state.clientHistoryPhone ? clientHistoryPanel(state.clientHistoryPhone) : ""}
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

function clientMonthlyQuantity(client, currentKey) {
  return Number(clientMonthlyPackage(client, currentKey).monthlyQuantity || 0);
}

function clientMonthlyRecordedValue(client, currentKey) {
  return monthlyOrders(currentKey)
    .filter(order => order.clientPhone === client.phone)
    .reduce((sum, order) => sum + Number(order.amount || 0), 0);
}

function isMonthlyRenewalRecord(order = {}) {
  return order.monthlyRenewal === true;
}

function productionOrders(orders = []) {
  return orders.filter(order => !isMonthlyRenewalRecord(order));
}

function clientMonthlyRenewals(client, currentKey, ignoredOrderId = null) {
  return monthlyOrders(currentKey)
    .filter(order => order.clientPhone === client.phone)
    .filter(order => Number(order.id) !== Number(ignoredOrderId))
    .filter(isMonthlyRenewalRecord);
}

function clientLegacyPackageCount(client, currentKey, ignoredOrderId = null) {
  return monthlyOrders(currentKey)
    .filter(order => order.clientPhone === client.phone)
    .filter(order => Number(order.id) !== Number(ignoredOrderId))
    .filter(order => !isMonthlyRenewalRecord(order))
    .reduce((sum, order) => sum + Math.max(0, Number(order.monthlyPackageCount || 0)), 0);
}

function clientChargedPackageCount(client, currentKey, ignoredOrderId = null) {
  const legacyPackages = clientLegacyPackageCount(client, currentKey, ignoredOrderId);
  return Math.max(1, legacyPackages) + clientMonthlyRenewals(client, currentKey, ignoredOrderId).length;
}

function clientMonthlyCapacity(client, currentKey, ignoredOrderId = null) {
  const packageQuantity = clientMonthlyQuantity(client, currentKey);
  const legacyPackages = clientLegacyPackageCount(client, currentKey, ignoredOrderId);
  const legacyAdditionalQuantity = Math.max(0, legacyPackages - 1) * packageQuantity;
  const renewedQuantity = clientMonthlyRenewals(client, currentKey, ignoredOrderId)
    .reduce((sum, order) => sum + Math.max(0, Number(order.renewalQuantity || 0)), 0);
  return packageQuantity + legacyAdditionalQuantity + renewedQuantity;
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

function clientPaidMonthlyCapacity(client, currentKey) {
  const orders = monthlyOrders(currentKey).filter(order => order.clientPhone === client.phone);
  const basePackagePaid = orders.some(order => (
    !isMonthlyRenewalRecord(order) && Number(order.amount || 0) > 0
  ));
  const paidRenewals = orders
    .filter(isMonthlyRenewalRecord)
    .filter(order => Number(order.amount || 0) > 0)
    .reduce((sum, order) => sum + Math.max(0, Number(order.renewalQuantity || 0)), 0);
  return (basePackagePaid ? clientMonthlyQuantity(client, currentKey) : 0) + paidRenewals;
}

function monthlyOrderHasPaidPackage(order, client) {
  if (isMonthlyRenewalRecord(order)) {
    return Number(order.amount || 0) > 0;
  }
  const currentKey = order.menuKey || menuKey();
  const paidCapacity = clientPaidMonthlyCapacity(client, currentKey);
  const orderedThroughThisOrder = productionOrders(monthlyOrders(currentKey))
    .filter(item => item.clientPhone === client.phone)
    .sort((left, right) => (
      String(left.createdAt || "").localeCompare(String(right.createdAt || "")) ||
      Number(left.id || 0) - Number(right.id || 0)
    ))
    .reduce((result, item) => {
      if (result.finished) return result;
      result.quantity += orderQuantity(item);
      if (String(item.id) === String(order.id)) result.finished = true;
      return result;
    }, { quantity: 0, finished: false }).quantity;
  return orderedThroughThisOrder > 0 && orderedThroughThisOrder <= paidCapacity;
}

function isLowMonthlyQuantity(client, currentKey) {
  const remaining = clientRemainingQuantity(client, currentKey);
  return client.plan === "mensalista" && remaining > 0 && remaining <= LOW_MONTHLY_QUANTITY;
}

function monthlyQuantityWarningText(client, remaining) {
  if (remaining <= 0) {
    return `A quantidade de ${client.name || "mensalista"} acabou. Use Clientes cadastrados > Renovar quantidade antes de lançar um novo pedido.`;
  }

  return `Atenção: restam ${remaining} cumbuca(s) para ${client.name || "este mensalista"}. Renove em Clientes cadastrados > Renovar quantidade.`;
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
    return `<span class="quantity-badge low">Renovar em breve</span>`;
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
  if (isMonthlyRenewalRecord(order)) {
    return `Renovação mensalista: +${Number(order.renewalQuantity || 0)} cumbuca(s)`;
  }
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

function weeklyMenuProductionCost(
  dishes = [],
  orders = [],
  unitCostFor = null,
  periodKey = currentMenuPeriodKey()
) {
  const unitCosts = dishes.map((item, index) => {
    const recordedCosts = menuCatalogRecordedCosts(item, periodKey);
    const defaultUnitCost = recordedCosts.costConfigured ? recordedCosts.totalCost : 0;
    return {
      slot: Number(item.slot || index + 1),
      unitCost: Math.max(
        0,
        Number(unitCostFor ? unitCostFor(item, index) : defaultUnitCost) || 0
      )
    };
  });
  const costBySlot = new Map(unitCosts.map(item => [item.slot, item.unitCost]));
  const configuredCosts = unitCosts.filter(item => item.unitCost > 0);
  const averageUnitCost = configuredCosts.length
    ? configuredCosts.reduce((sum, item) => sum + item.unitCost, 0) / configuredCosts.length
    : 0;

  return orders.reduce((sum, order) => {
    if ((order.dishes || []).length) {
      return sum + order.dishes.reduce((orderCost, dish) => {
        const unitCost = costBySlot.get(Number(dish.slot)) || 0;
        return orderCost + unitCost * Number(dish.quantity || 0);
      }, 0);
    }
    return sum + averageUnitCost * orderQuantity(order);
  }, 0);
}

function monthlyOrders(currentKey) {
  const periodKey = menuPeriodKeyFromKey(currentKey);
  return state.orders.filter(order => menuPeriodKeyFromKey(order.menuKey) === periodKey);
}

function monthSummaryPanel(currentKey) {
  const periodKey = menuPeriodKeyFromKey(currentKey);
  const orders = monthlyOrders(currentKey);
  const mealOrders = productionOrders(orders);
  const totalQuantity = mealOrders.reduce((sum, order) => sum + orderQuantity(order), 0);
  const totalDeliveryFee = mealOrders.reduce((sum, order) => sum + Number(order.deliveryFee || 0), 0);
  const weeklySummary = [1, 2, 3, 4, 5].map(week => {
    const key = `${periodKey}-semana-${week}`;
    const dishes = state.menus[key] || [];
    const weekOrders = weeklyOrders(key);
    const supermarketCost = weeklyMenuSupermarketTotal(key);
    const orderAmount = weekOrders.reduce((sum, order) => sum + Number(order.amount || 0), 0);

    return {
      week,
      dishes: dishes.map(item => item.dish).filter(Boolean).join(", "),
      quantity: weekOrders.reduce((sum, order) => sum + orderQuantity(order), 0),
      supermarketCost,
      orderAmount,
      result: orderAmount - supermarketCost
    };
  });

  return `
    <section class="month-summary-panel">
      <div class="summary">
        <div class="metric"><span>Cumbucas vendidas</span><strong>${totalQuantity}</strong></div>
        <div class="metric"><span>Pedidos no mês</span><strong>${mealOrders.length}</strong></div>
        <div class="metric"><span>Frete arrecadado</span><strong>${money(totalDeliveryFee)}</strong></div>
      </div>
      <div class="table-wrap month-summary-table">
        <p class="muted-inline month-summary-note">O custo considera somente o gasto total de supermercado informado em cada semana. O valor que sobra é o total dos pedidos menos esse gasto de supermercado.</p>
        <table>
          <thead><tr><th>Semana</th><th>Prato feito no mês</th><th>Cumbucas pedidas</th><th>Supermercado registrado na semana</th><th>Valor total dos pedidos</th><th>Valor que sobra na semana</th></tr></thead>
          <tbody>
            ${weeklySummary.map(item => `
              <tr data-week-summary="${item.week}">
                <td>Semana ${item.week}</td>
                <td>${escapeHtml(item.dishes || "Nenhum prato registrado.")}</td>
                <td>${item.quantity}</td>
                <td>${money(item.supermarketCost)}</td>
                <td>${money(item.orderAmount)}</td>
                <td class="${item.result < 0 ? "negative" : "positive"}">${money(item.result)}</td>
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
  const mealOrders = productionOrders(orders);
  const total = mealOrders.reduce((sum, order) => sum + orderQuantity(order), 0);
  const totalAmount = orders.reduce((sum, order) => sum + Number(order.amount || 0), 0);
  const totalDeliveryFee = mealOrders.reduce((sum, order) => sum + Number(order.deliveryFee || 0), 0);
  const byDish = plan.map(item => {
    const quantity = mealOrders.reduce((sum, order) => {
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
      <div class="metric"><span>Pedidos</span><strong>${mealOrders.length}</strong></div>
      <div class="metric"><span>Total de cumbucas</span><strong>${total}</strong></div>
      <div class="metric"><span>Valor em real</span><strong>${money(totalAmount)}</strong></div>
      <div class="metric"><span>Valor em frete</span><strong>${money(totalDeliveryFee)}</strong></div>
    </div>
    <div class="order-dish-summary" aria-label="Resumo por cumbuca">
      ${byDish.map(item => `
        <div class="order-dish-total">
          <span>Cumbuca ${item.slot}</span>
          <strong>${item.quantity}</strong>
          <small>${escapeHtml(item.dish)}</small>
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
  return whatsappUrl(order.clientPhone, orderWhatsAppText(order, plan));
}

function clientChargeWhatsAppUrl(client, amount = 0) {
  return whatsappUrl(client.phone, [
    `Oi, ${client.name || "tudo bem"}!`,
    "Passando para lembrar da pendência da Cumbuca.",
    Number(amount || 0) > 0 ? `Valor: ${money(amount)}.` : "",
    "Pode me confirmar quando fizer o pagamento?"
  ].filter(Boolean).join(" "));
}

function monthlyRenewalWhatsAppUrl(client, currentKey) {
  const remaining = clientRemainingQuantity(client, currentKey);
  return whatsappUrl(client.phone, [
    `Oi, ${client.name || "tudo bem"}!`,
    remaining <= 0
      ? "Seu pacote mensal da Cumbuca acabou. Quer renovar para este mês?"
      : `Seu pacote mensal está com ${remaining} cumbuca(s) restante(s).`,
    `Pacote atual: ${clientMonthlyCapacity(client, currentKey)} cumbuca(s).`
  ].join(" "));
}

function productionListText(plan, currentKey) {
  const totals = weeklyDishTotals(plan, productionOrders(weeklyOrders(currentKey)));
  if (!totals.length) {
    return "Sem pedidos para produção.";
  }

  return [
    `Lista de produção - ${currentKey}`,
    "",
    ...totals.map(item => `${item.quantity}x ${item.dish} (Cumbuca ${item.slot})`)
  ].join("\n");
}

function deliveryListText(currentKey) {
  const rows = productionOrders(weeklyOrders(currentKey))
    .map(order => ({ order, client: clientByPhone(order.clientPhone) }))
    .filter(({ client }) => String(client.address || "").trim());

  if (!rows.length) {
    return "Nenhuma entrega com endereço preenchido.";
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
  const orders = productionOrders(weeklyOrders(currentKey));
  const totals = weeklyDishTotals(plan, orders);
  return `
    <section class="order-overview-panel">
      <div class="section-heading">
        <h2>Lista de produção</h2>
        <button class="secondary" type="button" data-download-production>Baixar TXT</button>
      </div>
      ${totals.length ? `
        <div class="recent-list">
          ${totals.map(item => `<span><b>${item.quantity}</b>${escapeHtml(item.dish)}<small>Cumbuca ${item.slot}</small></span>`).join("")}
        </div>
      ` : `<p class="muted">Sem pedidos para produção ainda.</p>`}
    </section>
  `;
}

function deliveryListPanel(currentKey) {
  const rows = productionOrders(weeklyOrders(currentKey))
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
            <span><b>${orderQuantity(order)}</b>${escapeHtml(client.name || order.clientPhone)}<small>${escapeHtml([client.address, client.complement].filter(Boolean).join(" - "))}</small></span>
          `).join("")}
        </div>
      ` : `<p class="muted">Nenhuma entrega com endereço preenchido.</p>`}
    </section>
  `;
}

function orderTabs() {
  const tabs = [
    ["form", state.editOrderId ? "Editar pedido" : "Novo pedido"],
    ["orders", "Pedidos"],
    ["production", "Produção"],
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
                  <option value="${escapeHtml(client.phone)}" ${editing?.clientPhone === client.phone ? "selected" : ""}>${escapeHtml(client.name)} - ${escapeHtml(client.phone)}${client.plan === "mensalista" ? ` - restam ${clientRemainingQuantity(client, currentKey)}${clientChargedPackageCount(client, currentKey) > 1 ? ` - ${clientChargedPackageCount(client, currentKey)} pacotes` : ""}${isLowMonthlyQuantity(client, currentKey) ? " - perto de acabar" : clientRemainingQuantity(client, currentKey) <= 0 ? " - renovar quantidade" : ""}` : ""}</option>
                `).join("")}`
              : `<option value="">Cadastre ou reative um cliente primeiro</option>`}
          </select>
        </label>
        <div class="dish-picker">
          ${plan.map(item => `
            <label class="dish-option">
              <div class="dish-option-title">
                <span>Cumbuca ${item.slot}</span>
                <strong>${escapeHtml(item.dish || "")}</strong>
              </div>
              <input data-dish-quantity type="number" name="dish-${item.slot}" min="0" step="1" value="${editing ? orderDishQuantity(editing, item.slot) : 0}" aria-label="Quantidade da Cumbuca ${item.slot}">
            </label>
          `).join("")}
        </div>
        <div class="weekly-order-fields" id="order-value-fields" hidden>
          <label><span id="order-value-label">Valor em real deste pedido</span>
            <input name="orderValue" type="text" inputmode="decimal" placeholder="0,00" value="${moneyInputValue(editing?.amount)}" disabled>
            <small id="order-value-hint" hidden>Opcional. Só entra na contabilidade quando você informar o valor recebido. Para acrescentar saldo, use Renovar quantidade no cadastro do cliente.</small>
          </label>
          <label id="order-delivery-fee-field">Valor em frete
            <input name="orderDeliveryFee" type="text" inputmode="decimal" placeholder="0,00" value="${moneyInputValue(editing?.deliveryFee)}" disabled>
          </label>
          <label class="checkbox-field" id="order-paid-field">
            <input name="paid" type="checkbox" ${editing?.paid ? "checked" : ""} disabled>
            <span>Pago</span>
          </label>
        </div>
        <label>Observação
          <input name="notes" placeholder="Retirada, entrega, restrição ou detalhe do pedido" value="${escapeHtml(editing?.notes || "")}">
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

async function renderQuickOrders() {
  state.showOrders = true;
  state.showClients = false;
  state.showPlanning = false;
  state.showMonthSummary = false;
  state.showMenuCatalog = false;
  state.orderTab = "orders";
  await renderMenu();
}

async function renderProduction() {
  state.showOrders = true;
  state.showClients = false;
  state.showPlanning = false;
  state.showMonthSummary = false;
  state.showMenuCatalog = false;
  state.orderTab = "production";
  await renderMenu();
}

async function renderLegacyMenuRoute() {
  const requestedView = new URLSearchParams(location.search).get("view");
  if (requestedView === "production") {
    await renderProduction();
    return;
  }
  if (["form", "orders", "delivery"].includes(requestedView)) {
    state.showOrders = true;
    state.showClients = false;
    state.showPlanning = false;
    state.showMonthSummary = false;
    state.showMenuCatalog = false;
    state.orderTab = requestedView;
    await renderMenu();
    return;
  }
  await renderMenu();
}

function isOrderPaid(order = {}) {
  const total = Number(order.amount || 0);
  return Boolean(order.paid) || (total > 0 && Number(order.paidAmount || 0) >= total);
}

function paymentBadge(order, client) {
  if (client.plan === "mensalista") {
    return monthlyOrderHasPaidPackage(order, client)
      ? `<span class="payment-badge paid">Mensalidade paga</span>`
      : `<span class="payment-badge pending">Mensalidade não paga</span>`;
  }
  if (isOrderPaid(order)) {
    return `<span class="payment-badge paid">Pago</span>`;
  }
  if (Number(order.paidAmount || 0) > 0) {
    return `<span class="payment-badge partial">Parcial ${money(order.paidAmount)}</span>`;
  }
  return `<span class="payment-badge pending">Aguardando pagamento</span>`;
}

function deliveryBadge(order) {
  if (isMonthlyRenewalRecord(order)) {
    return `<span class="payment-badge">Sem entrega</span>`;
  }
  return order.delivered
    ? `<span class="payment-badge paid">Entregue</span>`
    : `<span class="payment-badge pending">Pendente</span>`;
}

function updateOrderPartialPayment(id) {
  const order = state.orders.find(item => Number(item.id) === Number(id));
  if (!order) {
    return;
  }
  const value = prompt("Valor pago até agora:", String(order.paidAmount || ""));
  if (value === null) {
    return;
  }
  const paidAmount = Math.max(0, Number(String(value).replace(",", ".") || 0));
  state.orders = state.orders.map(item => Number(item.id) === Number(id)
    ? { ...item, paidAmount, paid: Number(item.amount || 0) > 0 && paidAmount >= Number(item.amount || 0) }
    : item);
  persistState();
  renderMenu();
}

function toggleOrderDelivered(id) {
  state.orders = state.orders.map(order => Number(order.id) === Number(id)
    ? { ...order, delivered: !order.delivered, deliveredAt: !order.delivered ? new Date().toISOString() : "" }
    : order);
  persistState();
  renderMenu();
}

function orderFilterHtml(filter) {
  return `
    <form id="order-filter-form" class="filter-bar">
      <label>Buscar pedido
        <input name="search" data-order-search placeholder="Cliente, telefone, pagamento ou observação" value="${filter.search || ""}">
      </label>
      <label>Pagamento
        <select name="payment">
          <option value="all" ${filter.payment === "all" ? "selected" : ""}>Todos</option>
          <option value="paid" ${filter.payment === "paid" ? "selected" : ""}>Pagos</option>
          <option value="partial" ${filter.payment === "partial" ? "selected" : ""}>Parciais</option>
          <option value="pending" ${filter.payment === "pending" ? "selected" : ""}>Pendentes</option>
        </select>
      </label>
      <label>Entrega
        <select name="delivery">
          <option value="all" ${filter.delivery === "all" ? "selected" : ""}>Todas</option>
          <option value="delivered" ${filter.delivery === "delivered" ? "selected" : ""}>Entregues</option>
          <option value="pending" ${filter.delivery === "pending" ? "selected" : ""}>Pendentes</option>
        </select>
      </label>
      <button type="submit">Filtrar</button>
      <button class="secondary" type="button" id="clear-order-filters">Limpar</button>
    </form>
  `;
}

function orderCardsHtml(orders, plan) {
  return `
    <div class="order-card-grid">
      ${orders.map(order => {
        const client = clientByPhone(order.clientPhone);
        const renewal = isMonthlyRenewalRecord(order);
        const address = [client.address, client.complement].filter(Boolean).join(" - ");
        const total = Number(order.amount || 0) + Number(order.deliveryFee || 0);
        return `
          <article class="order-card ${renewal ? "monthly-renewal-order" : order.delivered ? "is-delivered" : ""}">
            <div class="order-card-head">
              <div>
                <strong>${escapeHtml(client.name || "Cliente removido")}</strong>
                <span>${escapeHtml(client.phone || order.clientPhone || "Sem telefone")}</span>
              </div>
              <div class="order-card-badges">
                ${paymentBadge(order, client)}
                ${renewal ? "" : deliveryBadge(order)}
              </div>
            </div>
            <div class="order-card-body">
              <p>${escapeHtml(orderDishesText(order, plan) || "Pedido sem itens")}</p>
              <div class="mini-metrics">
                <span><b>${renewal ? `+${Number(order.renewalQuantity || 0)}` : orderQuantity(order)}</b><small>${renewal ? "Nova quantidade" : "Cumbucas"}</small></span>
                <span><b>${total > 0 ? money(total) : "-"}</b><small>Total</small></span>
                <span><b>${renewal ? "Renovação" : client.plan === "mensalista" ? "Mensal" : "Semanal"}</b><small>Perfil</small></span>
              </div>
              ${address ? `<small class="muted-inline">${escapeHtml(address)}</small>` : ""}
              ${order.notes ? `<small class="muted-inline">${escapeHtml(order.notes)}</small>` : ""}
            </div>
            <div class="order-card-actions">
              ${renewal ? "" : `<button class="secondary table-action" type="button" data-edit-order="${order.id}">Editar</button>`}
              ${!renewal && client.plan === "semanal" ? `<button class="secondary table-action" type="button" data-toggle-paid-order="${order.id}">${isOrderPaid(order) ? "Pendente" : "Pago"}</button>` : ""}
              ${!renewal && client.plan === "semanal" ? `<button class="secondary table-action" type="button" data-partial-paid-order="${order.id}">Parcial</button>` : ""}
              ${renewal ? "" : `<button class="secondary table-action" type="button" data-toggle-delivered-order="${order.id}">${order.delivered ? "Desfazer" : "Entregue"}</button>`}
              ${renewal ? "" : `<a class="secondary table-action" href="${orderWhatsAppUrl(order, plan)}" target="_blank" rel="noopener">WhatsApp</a>`}
              <button class="danger table-action" type="button" data-delete-order="${order.id}">Excluir</button>
            </div>
          </article>
        `;
      }).join("")}
    </div>
  `;
}

function orderList(plan, currentKey) {
  const filter = state.orderFilter || { search: "", payment: "all", delivery: "all" };
  const query = String(filter.search || state.orderSearch || "").trim().toLowerCase();
  const orders = weeklyOrders(currentKey).filter(order => {
    const client = clientByPhone(order.clientPhone);
    if (isMonthlyRenewalRecord(order) && filter.delivery !== "all") {
      return false;
    }
    if (filter.payment === "partial" && !(Number(order.paidAmount || 0) > 0 && !isOrderPaid(order))) {
      return false;
    }
    const paymentRecorded = client.plan === "mensalista"
      ? monthlyOrderHasPaidPackage(order, client)
      : isOrderPaid(order);
    if (filter.payment === "paid" && !paymentRecorded) {
      return false;
    }
    if (filter.payment === "pending" && paymentRecorded) {
      return false;
    }
    if (filter.delivery === "delivered" && !order.delivered) {
      return false;
    }
    if (filter.delivery === "pending" && order.delivered) {
      return false;
    }
    if (!query) {
      return true;
    }
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
      ${orderFilterHtml(filter)}
      <p class="muted">Nenhum pedido encontrado nesta semana.</p>
    `;
  }

  return `
    ${orderFilterHtml(filter)}
    ${orderCardsHtml(orders, plan)}
    <details class="details-block order-detail-table">
      <summary>Tabela detalhada</summary>
      <div class="table-wrap order-table">
      <table>
        <thead><tr><th>Cliente</th><th>Contato</th><th>Endereço</th><th>Pedido</th><th>Total</th><th>Valor em real</th><th>Valor em frete</th><th>Pagamento</th><th>Entrega</th><th>Obs.</th><th></th></tr></thead>
        <tbody>
          ${orders.map(order => {
            const client = clientByPhone(order.clientPhone);
            const renewal = isMonthlyRenewalRecord(order);
            return `
              <tr>
                <td>${escapeHtml(client.name || "Cliente removido")}</td>
                <td>${escapeHtml(client.phone || order.clientPhone || "")}</td>
                <td>${escapeHtml([client.address, client.complement].filter(Boolean).join(" - "))}</td>
                <td>${escapeHtml(orderDishesText(order, plan))}</td>
                <td>${orderQuantity(order)}</td>
                <td>${Number(order.amount || 0) > 0 ? money(order.amount) : ""}</td>
                <td>${Number(order.deliveryFee || 0) > 0 ? money(order.deliveryFee) : ""}</td>
                <td>${paymentBadge(order, client)}</td>
                <td>${renewal ? "Sem entrega" : deliveryBadge(order)}</td>
                <td>${escapeHtml(order.notes || "")}</td>
                <td>
                  <div class="table-actions">
                    ${renewal ? "" : `<button class="secondary table-action" type="button" data-edit-order="${order.id}">Editar</button>`}
                    ${!renewal && client.plan === "semanal" ? `<button class="secondary table-action" type="button" data-toggle-paid-order="${order.id}">${isOrderPaid(order) ? "Marcar pendente" : "Marcar pago"}</button>` : ""}
                    ${!renewal && client.plan === "semanal" ? `<button class="secondary table-action" type="button" data-partial-paid-order="${order.id}">Parcial</button>` : ""}
                    ${renewal ? "" : `<button class="secondary table-action" type="button" data-toggle-delivered-order="${order.id}">${order.delivered ? "Desfazer entrega" : "Entregue"}</button>`}
                    ${renewal ? "" : `<a class="secondary table-action" href="${orderWhatsAppUrl(order, plan)}" target="_blank" rel="noopener">WhatsApp</a>`}
                    <button class="danger table-action" type="button" data-delete-order="${order.id}">Excluir</button>
                  </div>
                </td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
      </div>
    </details>
  `;
}

function paymentText(order, client) {
  if (client.plan === "mensalista") {
    return monthlyOrderHasPaidPackage(order, client) ? "Mensalidade paga" : "Mensalidade não paga";
  }

  if (isOrderPaid(order)) {
    return "Pago";
  }
  if (Number(order.paidAmount || 0) > 0) {
    return `Parcial ${money(order.paidAmount)}`;
  }
  return "Aguardando pagamento";
}

function orderOverviewPanel(plan, currentKey) {
  const orders = productionOrders(weeklyOrders(currentKey));

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
              ${plan.map(item => `<th>${escapeHtml(item.dish || `Cumbuca ${item.slot}`)}</th>`).join("")}
              <th>Total</th>
              <th>Valor em real</th>
              <th>Valor em frete</th>
              <th>Endereço</th>
              <th>Pagamento</th>
              <th>Entrega</th>
              <th>Tipo</th>
            </tr>
          </thead>
          <tbody>
            ${orders.map(order => {
              const client = clientByPhone(order.clientPhone);
              return `
                <tr class="${client.plan === "mensalista" ? "monthly-client-row" : ""}">
                  <td>${escapeHtml(client.name || "Cliente removido")}</td>
                  ${plan.map(item => `<td class="quantity-cell">${orderDishQuantity(order, item.slot) || ""}</td>`).join("")}
                  <td class="quantity-cell total-cell">${orderQuantity(order)}</td>
                  <td>${Number(order.amount || 0) > 0 ? money(order.amount) : ""}</td>
                  <td>${Number(order.deliveryFee || 0) > 0 ? money(order.deliveryFee) : ""}</td>
                  <td>${escapeHtml([client.address, client.complement].filter(Boolean).join(" - "))}</td>
                  <td>${paymentText(order, client)}</td>
                  <td>${order.delivered ? "Entregue" : "Pendente"}</td>
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
    </section>
  `;
}

function pricingSafeNumber(value) {
  return Math.max(0, Number(parseMoneyInput(value) || 0));
}

function pricingDecimalNumber(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? Math.max(0, value) : 0;
  }
  const parsed = Number(String(value || "").trim().replace(",", "."));
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

const PRICING_RECIPE_BATCH_SIZE = 50;

function pricingRecipeIngredientBatchSize(recipe = {}) {
  return pricingDecimalNumber(recipe?.ingredientBatchSize) || 1;
}

function pricingPercent(value) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }
  const amount = Number(value);
  return Number.isFinite(amount)
    ? `${amount.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
    : "—";
}

function pricingUnitCostMoney(value) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4
  }).format(Number(value || 0));
}

function pricingIngredientId(ingredient, index = 0) {
  return String(ingredient?.id || `pricing-ingredient-${slugifyCategory(ingredient?.name || "item")}-${index}`);
}

function normalizedPricingIngredients() {
  return (state.ingredients || []).map((ingredient, index) => {
    const legacyQuantity = pricingDecimalNumber(ingredient.quantity);
    const legacyUnitCost = pricingSafeNumber(ingredient.unitCost);
    const purchaseQuantity = pricingDecimalNumber(ingredient.purchaseQuantity) || legacyQuantity;
    const purchaseCost = pricingSafeNumber(ingredient.purchaseCost)
      || (legacyQuantity * legacyUnitCost);
    const unit = ["kg", "unit", "box", "g", "ml"].includes(ingredient.unit)
      ? ingredient.unit
      : "g";
    return {
      ...ingredient,
      id: pricingIngredientId(ingredient, index),
      name: String(ingredient.name || "").trim(),
      unit,
      purchaseQuantity,
      purchaseCost
    };
  });
}

function pricingIngredientUnitCost(ingredient) {
  const quantity = pricingDecimalNumber(ingredient?.purchaseQuantity)
    || pricingDecimalNumber(ingredient?.quantity);
  const cost = pricingSafeNumber(ingredient?.purchaseCost)
    || (pricingSafeNumber(ingredient?.quantity) * pricingSafeNumber(ingredient?.unitCost));
  return quantity > 0 ? cost / quantity : 0;
}

function pricingStaffMembers(config = state.pricingConfig) {
  const shared = config?.sharedCosts || config || {};
  if (Array.isArray(shared.staff)) {
    return shared.staff
      .map((member, index) => ({
        id: String(member?.id || `pricing-staff-${index}`),
        name: String(member?.name || "").trim(),
        salary: pricingSafeNumber(member?.salary)
      }))
      .filter(member => member.name && member.salary > 0);
  }
  const legacyLabor = pricingSafeNumber(shared.labor);
  return legacyLabor > 0
    ? [{
        id: "pricing-staff-legacy",
        name: "Mão de obra cadastrada anteriormente",
        salary: legacyLabor
      }]
    : [];
}

function pricingSharedCosts(config = state.pricingConfig) {
  const shared = config?.sharedCosts || config || {};
  const averageMonthlyUnits = pricingDecimalNumber(shared.averageMonthlyUnits);
  const gas = pricingSafeNumber(shared.gas);
  const energy = pricingSafeNumber(shared.energy);
  const staff = pricingStaffMembers(shared);
  const labor = staff.reduce((sum, member) => sum + member.salary, 0);
  const rent = pricingSafeNumber(shared.rent);
  const accountant = pricingSafeNumber(shared.accountant);
  const telephony = pricingSafeNumber(shared.telephony);
  const marketing = pricingSafeNumber(shared.marketing);
  const extraordinary = pricingSafeNumber(shared.extraordinary);
  const productionMonthly = gas + energy;
  const otherMonthly = rent + accountant + telephony + marketing + extraordinary;
  const monthlyTotal = productionMonthly + labor + otherMonthly;
  const divisor = averageMonthlyUnits > 0 ? averageMonthlyUnits : 0;
  return {
    averageMonthlyUnits,
    gas,
    energy,
    staff,
    labor,
    rent,
    accountant,
    telephony,
    marketing,
    extraordinary,
    productionMonthly,
    otherMonthly,
    monthlyTotal,
    productionPerUnit: divisor ? productionMonthly / divisor : 0,
    laborPerUnit: divisor ? labor / divisor : 0,
    otherPerUnit: divisor ? otherMonthly / divisor : 0,
    totalPerUnit: divisor ? monthlyTotal / divisor : 0
  };
}

function pricingRecipeLegacyIngredientCost(recipe = {}) {
  const ingredientMap = new Map(
    normalizedPricingIngredients().map(ingredient => [String(ingredient.id), ingredient])
  );
  const ingredientBatchSize = pricingRecipeIngredientBatchSize(recipe);
  return (recipe?.ingredients || []).reduce((sum, item) => {
    const ingredient = ingredientMap.get(String(item.ingredientId));
    const quantityPerPlate = pricingDecimalNumber(item.quantity) / ingredientBatchSize;
    return sum + quantityPerPlate * pricingIngredientUnitCost(ingredient);
  }, 0);
}

function pricingRecipeSupermarketUnitCost(recipe = {}) {
  if (!recipe) {
    return 0;
  }
  if (Object.prototype.hasOwnProperty.call(recipe, "supermarketUnitCost")) {
    return pricingSafeNumber(recipe.supermarketUnitCost);
  }
  return pricingRecipeLegacyIngredientCost(recipe);
}

function storeAverageMonthlyUnits() {
  const monthly = new Map();
  (state.storeProductQuantities || []).forEach(entry => {
    const month = normalizedStoreProductMonth(entry.month);
    if (!month) {
      return;
    }
    monthly.set(month, (monthly.get(month) || 0) + pricingDecimalNumber(entry.quantity));
  });
  const totals = [...monthly.values()].filter(total => total > 0);
  if (!totals.length) {
    return 0;
  }
  return Math.round(totals.reduce((sum, total) => sum + total, 0) / totals.length);
}

function pricingRecipeMetrics(recipe, config = state.pricingConfig) {
  const supermarketUnitCost = pricingRecipeSupermarketUnitCost(recipe);
  const packagingCost = pricingSafeNumber(recipe?.packagingCost);
  const fixedFee = pricingSafeNumber(recipe?.fixedFee);
  const variableFeePercent = pricingDecimalNumber(recipe?.variableFeePercent);
  const desiredMarginPercent = pricingDecimalNumber(recipe?.desiredMarginPercent);
  const practicedPrice = pricingSafeNumber(recipe?.practicedPrice);
  const shared = pricingSharedCosts(config);
  const baseCost = supermarketUnitCost
    + packagingCost
    + shared.productionPerUnit
    + shared.laborPerUnit
    + shared.otherPerUnit
    + fixedFee;
  const divisor = 1 - ((variableFeePercent + desiredMarginPercent) / 100);
  const suggestedPrice = divisor > 0 ? baseCost / divisor : 0;
  const suggestedVariableFee = suggestedPrice * (variableFeePercent / 100);
  const totalCost = baseCost + suggestedVariableFee;
  const suggestedProfit = suggestedPrice - totalCost;
  const realVariableFee = practicedPrice * (variableFeePercent / 100);
  const realTotalCost = baseCost + realVariableFee;
  const realProfit = practicedPrice - realTotalCost;
  const realMarginPercent = practicedPrice > 0 ? (realProfit / practicedPrice) * 100 : null;
  const markup = practicedPrice > 0 && realTotalCost > 0
    ? practicedPrice / realTotalCost
    : totalCost > 0
      ? suggestedPrice / totalCost
      : 0;
  const status = !pricingRecipeIsComplete(recipe)
    ? "Custo de supermercado pendente"
    : practicedPrice <= 0 || realMarginPercent === null
      ? "Atenção"
      : realProfit < 0
        ? "Prejuízo"
        : realMarginPercent + 0.0001 >= desiredMarginPercent
          ? "Lucrativa"
          : "Atenção";
  return {
    supermarketUnitCost,
    ingredientCost: supermarketUnitCost,
    packagingCost,
    productionCost: shared.productionPerUnit,
    laborCost: shared.laborPerUnit,
    otherCost: shared.otherPerUnit,
    fixedFee,
    variableFeePercent,
    desiredMarginPercent,
    practicedPrice,
    baseCost,
    suggestedVariableFee,
    totalCost,
    suggestedPrice,
    suggestedProfit,
    realVariableFee,
    realTotalCost,
    realProfit,
    realMarginPercent,
    markup,
    status
  };
}

function pricingStatusPill(status) {
  const className = status === "Lucrativa"
    ? "profitable"
    : status === "Prejuízo"
      ? "loss"
      : status === "Custo de supermercado pendente" || status === "Ingredientes pendentes"
        ? "pending"
      : "attention";
  return `<span class="pricing-status ${className}">${status}</span>`;
}

function pricingRecipeById(recipeId) {
  return (state.pricingRecipes || []).find(recipe => String(recipe.id) === String(recipeId));
}

function pricingRecipeIsComplete(recipe) {
  return pricingRecipeSupermarketUnitCost(recipe) > 0;
}

function pricingProjectionRecipe() {
  const configured = pricingRecipeById(state.pricingConfig?.projectionRecipeId);
  if (configured && pricingRecipeIsComplete(configured)) {
    return configured;
  }
  return (state.pricingRecipes || []).find(pricingRecipeIsComplete) || null;
}

function pricingFlowHtml() {
  return `
    <section class="pricing-flow" aria-label="Etapas da precificação">
      <span><b>1</b><small>Prato</small><strong>Cadastre os dados da cumbuca</strong></span>
      <span><b>2</b><small>Supermercado</small><strong>Informe o gasto de uma unidade</strong></span>
      <span><b>3</b><small>Preço</small><strong>Confira custo, margem e sugestão</strong></span>
    </section>
  `;
}

function pricingDashboardPanel() {
  const rows = (state.pricingRecipes || []).map(recipe => ({
    recipe,
    metrics: pricingRecipeMetrics(recipe)
  }));
  const completeRows = rows.filter(row => pricingRecipeIsComplete(row.recipe));
  const pendingRows = rows.filter(row => !pricingRecipeIsComplete(row.recipe));
  const realRows = completeRows.filter(row => row.metrics.practicedPrice > 0);
  const averageCost = completeRows.length
    ? completeRows.reduce((sum, row) => sum + row.metrics.totalCost, 0) / completeRows.length
    : 0;
  const averageMargin = realRows.length
    ? realRows.reduce((sum, row) => sum + row.metrics.realMarginPercent, 0) / realRows.length
    : null;
  const averagePackaging = completeRows.length
    ? completeRows.reduce((sum, row) => sum + row.metrics.packagingCost, 0) / completeRows.length
    : 0;
  const profitRows = realRows.length ? realRows : completeRows;
  const mostProfitable = profitRows.reduce((best, row) => {
    const profit = row.metrics.practicedPrice > 0
      ? row.metrics.realProfit
      : row.metrics.suggestedProfit;
    const bestProfit = best
      ? (best.metrics.practicedPrice > 0 ? best.metrics.realProfit : best.metrics.suggestedProfit)
      : -Infinity;
    return profit > bestProfit ? row : best;
  }, null);
  const lowestMargin = realRows.reduce((lowest, row) => {
    return !lowest || row.metrics.realMarginPercent < lowest.metrics.realMarginPercent ? row : lowest;
  }, null);
  const shared = pricingSharedCosts();
  const projectionRecipe = pricingProjectionRecipe();
  const projection = projectionRecipe ? pricingRecipeMetrics(projectionRecipe) : null;
  const projectedProfit = projection
    ? (projection.practicedPrice > 0 ? projection.realProfit : projection.suggestedProfit)
    : 0;
  const projectionPriceKind = projection?.practicedPrice > 0 ? "preço praticado" : "preço sugerido";
  const taxForBreakdown = projection
    ? projection.fixedFee + (projection.practicedPrice > 0
      ? projection.realVariableFee
      : projection.suggestedVariableFee)
    : 0;
  const totalForBreakdown = projection
    ? (projection.practicedPrice > 0 ? projection.realTotalCost : projection.totalCost)
    : 0;

  return `
    ${pricingFlowHtml()}
    ${shared.averageMonthlyUnits > 0 ? "" : `
      <div class="pricing-warning">
        <strong>Configure a média mensal de cumbucas</strong>
        <span>Sem essa quantidade, produção, mão de obra, aluguel, marketing e custos extraordinários ainda não entram no custo unitário.</span>
        <button class="secondary" type="button" data-pricing-open-view="costs">Configurar custos rateados</button>
      </div>
    `}
    ${pendingRows.length ? `
      <div class="pricing-warning">
        <strong>${pendingRows.length} receita(s) sem custo de supermercado</strong>
        <span>Informe quanto é gasto no supermercado para produzir uma unidade de cada prato.</span>
        <button class="secondary" type="button" data-pricing-edit-pending-recipe="${escapeHtml(pendingRows[0].recipe.id)}">Continuar cadastro</button>
      </div>
    ` : ""}
    <section class="pricing-dashboard-grid">
      <article class="panel pricing-kpi">
        <span>Custo médio por cumbuca</span>
        <strong>${money(averageCost)}</strong>
        <small>${completeRows.length} prato(s) com custo informado</small>
      </article>
      <article class="panel pricing-kpi">
        <span>Margem média real</span>
        <strong>${pricingPercent(averageMargin)}</strong>
        <small>${realRows.length ? `${realRows.length} preço(s) praticado(s)` : "Informe os preços praticados"}</small>
      </article>
      <article class="panel pricing-kpi">
        <span>Cumbuca mais lucrativa</span>
        <strong>${escapeHtml(mostProfitable?.recipe?.name || "—")}</strong>
        <small>${mostProfitable ? money(mostProfitable.metrics.practicedPrice > 0 ? mostProfitable.metrics.realProfit : mostProfitable.metrics.suggestedProfit) : "Cadastre um prato"}</small>
      </article>
      <article class="panel pricing-kpi">
        <span>Menor margem real</span>
        <strong>${escapeHtml(lowestMargin?.recipe?.name || "—")}</strong>
        <small>${lowestMargin ? pricingPercent(lowestMargin.metrics.realMarginPercent) : "Informe os preços praticados"}</small>
      </article>
      <article class="panel pricing-kpi">
        <span>Embalagem por refeição</span>
        <strong>${money(averagePackaging)}</strong>
        <small>Média dos pratos</small>
      </article>
      <article class="panel pricing-kpi">
        <span>Custos rateados por unidade</span>
        <strong>${money(shared.totalPerUnit)}</strong>
        <small>${shared.averageMonthlyUnits ? `${shared.averageMonthlyUnits} cumbucas/mês` : "Média mensal pendente"}</small>
      </article>
    </section>

    <section class="panel report-section">
      <div class="section-heading">
        <div>
          <h2>Painel de precificação</h2>
          <p class="muted-inline">O custo total inclui supermercado por unidade, embalagem, produção, mão de obra, demais custos rateados e taxas.</p>
        </div>
        <button type="button" data-pricing-open-view="recipes">Cadastrar prato</button>
      </div>
      ${rows.length ? `
        <div class="table-wrap report-table pricing-table">
          <table>
            <thead>
              <tr>
                <th>Cumbuca</th>
                <th>Categoria</th>
                <th>Peso</th>
                <th>Custo total</th>
                <th>Margem desejada</th>
                <th>Preço sugerido</th>
                <th>Preço praticado</th>
                <th>Lucro real</th>
                <th>Margem real</th>
                <th>Markup</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map(({ recipe, metrics }) => `
                <tr>
                  <td><strong>${escapeHtml(recipe.name || "")}</strong></td>
                  <td>${escapeHtml(recipe.category || "Sem categoria")}</td>
                  <td>${pricingDecimalNumber(recipe.weightGrams) || "—"}${pricingDecimalNumber(recipe.weightGrams) ? " g" : ""}</td>
                  <td>${pricingRecipeIsComplete(recipe) ? money(metrics.practicedPrice > 0 ? metrics.realTotalCost : metrics.totalCost) : "—"}</td>
                  <td>${pricingPercent(metrics.desiredMarginPercent)}</td>
                  <td><strong>${pricingRecipeIsComplete(recipe) ? money(metrics.suggestedPrice) : "—"}</strong></td>
                  <td>${pricingRecipeIsComplete(recipe) && metrics.practicedPrice > 0 ? money(metrics.practicedPrice) : "—"}</td>
                  <td class="${metrics.practicedPrice > 0 && metrics.realProfit < 0 ? "negative" : "positive"}">${pricingRecipeIsComplete(recipe) && metrics.practicedPrice > 0 ? money(metrics.realProfit) : "—"}</td>
                  <td>${pricingRecipeIsComplete(recipe) ? pricingPercent(metrics.realMarginPercent) : "—"}</td>
                  <td>${pricingRecipeIsComplete(recipe) && metrics.markup ? `${metrics.markup.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}x` : "—"}</td>
                  <td>${pricingStatusPill(pricingRecipeIsComplete(recipe) ? metrics.status : "Custo de supermercado pendente")}</td>
                  <td>
                    <div class="table-actions">
                      <button class="secondary table-action" type="button" data-edit-pricing-recipe="${escapeHtml(recipe.id)}">${pricingRecipeIsComplete(recipe) ? "Editar" : "Informar custo"}</button>
                      <button class="danger table-action" type="button" data-delete-pricing-recipe="${escapeHtml(recipe.id)}">Excluir</button>
                    </div>
                  </td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      ` : `<p class="muted">Cadastre o prato e informe o custo de supermercado de uma unidade.</p>`}
    </section>

    ${projectionRecipe && projection ? `
      <div class="pricing-detail-grid">
        <section class="panel report-section">
          <div class="section-heading">
            <div>
              <h2>Composição do custo</h2>
              <p class="muted-inline">${escapeHtml(projectionRecipe.name)} · cálculo pelo ${projectionPriceKind}</p>
            </div>
            <label class="pricing-projection-select">Cumbuca
              <select id="pricing-projection-recipe">
                ${(state.pricingRecipes || []).map(recipe => `
                  <option value="${escapeHtml(recipe.id)}" ${String(recipe.id) === String(projectionRecipe.id) ? "selected" : ""}>${escapeHtml(recipe.name)}</option>
                `).join("")}
              </select>
            </label>
          </div>
          <div class="pricing-cost-breakdown">
            <span><small>Supermercado por unidade</small><strong>${money(projection.supermarketUnitCost)}</strong></span>
            <span><small>Embalagem</small><strong>${money(projection.packagingCost)}</strong></span>
            <span><small>Produção</small><strong>${money(projection.productionCost)}</strong></span>
            <span><small>Mão de obra</small><strong>${money(projection.laborCost)}</strong></span>
            <span><small>Demais custos mensais</small><strong>${money(projection.otherCost)}</strong></span>
            <span><small>Taxas</small><strong>${money(taxForBreakdown)}</strong></span>
            <span class="total"><small>Custo total</small><strong>${money(totalForBreakdown)}</strong></span>
          </div>
        </section>
        <section class="panel report-section">
          <h2>Lucro estimado por lote</h2>
          <p class="muted-inline">${escapeHtml(projectionRecipe.name)} · ${projectionPriceKind}</p>
          <div class="pricing-lot-grid">
            ${[10, 20, 50, 100].map(quantity => `
              <span><small>${quantity} unidades</small><strong class="${projectedProfit < 0 ? "negative" : "positive"}">${money(projectedProfit * quantity)}</strong></span>
            `).join("")}
          </div>
        </section>
      </div>
    ` : ""}
  `;
}

function pricingRecipesPanel(editingRecipe = null) {
  const shared = pricingSharedCosts();
  const preview = pricingRecipeMetrics(editingRecipe || {});
  const recipeDefaults = {
    ...defaultAppConfig,
    ...(state.appConfig || {})
  };
  return `
    ${pricingFlowHtml()}
    <div class="pricing-recipe-layout">
      <section class="panel">
        <h2>${editingRecipe ? "Editar prato" : "Cadastrar prato"}</h2>
        <p class="muted-inline">Informe apenas o valor de supermercado gasto para produzir uma unidade. Não é necessário cadastrar ingredientes.</p>
        <form id="pricing-recipe-form" class="form-grid">
          <input name="recipeId" type="hidden" value="${escapeHtml(editingRecipe?.id || "")}">
          <label>Nome da cumbuca
            <input name="name" placeholder="Ex.: Frango Fit" value="${escapeHtml(editingRecipe?.name || "")}" required>
          </label>
          <label>Categoria
            <input name="category" placeholder="Ex.: Frango" value="${escapeHtml(editingRecipe?.category || "")}" required>
          </label>
          <label>Peso final (g)
            <input name="weightGrams" type="number" min="1" step="1" placeholder="Ex.: 500" value="${pricingDecimalNumber(editingRecipe?.weightGrams) || ""}" required>
          </label>
          <label>Custo de supermercado por unidade
            <input name="supermarketUnitCost" type="text" inputmode="decimal" placeholder="Ex.: 12,50" value="${moneyInputValue(editingRecipe ? pricingRecipeSupermarketUnitCost(editingRecipe) : "")}" required>
            <small>Digite o total gasto no supermercado para fazer uma unidade deste prato.</small>
          </label>
          <label>Custo da embalagem
            <input name="packagingCost" type="text" inputmode="decimal" placeholder="Cumbuca, tampa, talheres..." value="${moneyInputValue(editingRecipe ? editingRecipe.packagingCost : recipeDefaults.defaultPackagingCost)}">
            <small>Informe o custo variável de uma unidade, incluindo embalagem e etiqueta.</small>
          </label>
          <label>Taxa fixa por unidade
            <input name="fixedFee" type="text" inputmode="decimal" placeholder="Ex.: 0,50" value="${moneyInputValue(editingRecipe ? editingRecipe.fixedFee : recipeDefaults.defaultFixedFee)}">
          </label>
          <label>Taxa variável (%)
            <input name="variableFeePercent" type="number" min="0" max="99" step="0.01" placeholder="iFood, cartão, Pix" value="${editingRecipe ? (pricingDecimalNumber(editingRecipe.variableFeePercent) || "") : pricingDecimalNumber(recipeDefaults.defaultVariableFeePercent)}">
          </label>
          <label>Margem desejada (%)
            <input name="desiredMarginPercent" type="number" min="0" max="99" step="0.01" placeholder="Ex.: 40" value="${editingRecipe ? (pricingDecimalNumber(editingRecipe.desiredMarginPercent) || "") : pricingDecimalNumber(recipeDefaults.defaultDesiredMarginPercent)}" required>
          </label>
          <label>Preço praticado
            <input name="practicedPrice" type="text" inputmode="decimal" placeholder="Valor realmente vendido" value="${moneyInputValue(editingRecipe?.practicedPrice)}">
          </label>
          <div class="actions">
            <button type="submit">${editingRecipe ? "Salvar prato" : "Cadastrar prato"}</button>
            ${editingRecipe ? `<button class="secondary" type="button" id="cancel-pricing-recipe-edit">Cancelar</button>` : ""}
          </div>
        </form>
      </section>
      <aside class="panel pricing-recipe-preview" aria-live="polite">
        <h2>Prévia automática</h2>
        <div class="pricing-cost-breakdown compact">
          <span><small>Supermercado por unidade</small><strong data-pricing-preview="supermarket">${money(preview.supermarketUnitCost)}</strong></span>
          <span><small>Embalagem</small><strong data-pricing-preview="packaging">${money(preview.packagingCost)}</strong></span>
          <span><small>Produção rateada</small><strong data-pricing-preview="production">${money(shared.productionPerUnit)}</strong></span>
          <span><small>Mão de obra rateada</small><strong data-pricing-preview="labor">${money(shared.laborPerUnit)}</strong></span>
          <span><small>Demais custos rateados</small><strong data-pricing-preview="other">${money(shared.otherPerUnit)}</strong></span>
          <span><small>Taxas estimadas</small><strong data-pricing-preview="fees">${money(preview.fixedFee + (preview.practicedPrice > 0 ? preview.realVariableFee : preview.suggestedVariableFee))}</strong></span>
          <span class="total"><small>Custo total</small><strong data-pricing-preview="total">${money(preview.practicedPrice > 0 ? preview.realTotalCost : preview.totalCost)}</strong></span>
        </div>
        <div class="pricing-preview-result">
          <span><small>Preço sugerido</small><strong data-pricing-preview="suggested">${money(preview.suggestedPrice)}</strong></span>
          <span><small>Lucro por unidade</small><strong data-pricing-preview="profit">${money(preview.practicedPrice > 0 ? preview.realProfit : preview.suggestedProfit)}</strong></span>
          <span><small>Margem real</small><strong data-pricing-preview="margin">${pricingPercent(preview.realMarginPercent)}</strong></span>
          <span><small>Status</small><strong data-pricing-preview="status">${pricingStatusPill(preview.status)}</strong></span>
        </div>
        <p class="pricing-formula">Preço sugerido = custo base ÷ (1 − margem desejada − taxa variável).</p>
      </aside>
    </div>
    <section class="panel report-section">
      <div class="section-heading">
        <div>
          <h2>Pratos cadastrados</h2>
          <p class="muted-inline">${(state.pricingRecipes || []).length} prato(s)</p>
        </div>
      </div>
      ${(state.pricingRecipes || []).length ? `
        <div class="table-wrap report-table">
          <table>
            <thead><tr><th>Cumbuca</th><th>Categoria</th><th>Peso</th><th>Supermercado por unidade</th><th>Preço sugerido</th><th>Status</th><th>Ações</th></tr></thead>
            <tbody>
              ${(state.pricingRecipes || []).map(recipe => {
                const metrics = pricingRecipeMetrics(recipe);
                return `
                  <tr>
                    <td><strong>${escapeHtml(recipe.name)}</strong></td>
                    <td>${escapeHtml(recipe.category || "Sem categoria")}</td>
                    <td>${pricingDecimalNumber(recipe.weightGrams)} g</td>
                    <td>${pricingRecipeIsComplete(recipe) ? money(metrics.supermarketUnitCost) : "—"}</td>
                    <td>${pricingRecipeIsComplete(recipe) ? money(metrics.suggestedPrice) : "—"}</td>
                    <td>${pricingStatusPill(pricingRecipeIsComplete(recipe) ? metrics.status : "Custo de supermercado pendente")}</td>
                    <td>
                      <div class="table-actions">
                        <button class="secondary table-action" type="button" data-edit-pricing-recipe="${escapeHtml(recipe.id)}">${pricingRecipeIsComplete(recipe) ? "Editar" : "Informar custo"}</button>
                        <button class="danger table-action" type="button" data-delete-pricing-recipe="${escapeHtml(recipe.id)}">Excluir</button>
                      </div>
                    </td>
                  </tr>
                `;
              }).join("")}
            </tbody>
          </table>
        </div>
      ` : `<p class="muted">Nenhum prato cadastrado ainda.</p>`}
    </section>
  `;
}

function pricingCostsPanel() {
  const shared = pricingSharedCosts();
  const staff = shared.staff;
  const observedAverage = storeAverageMonthlyUnits();
  return `
    ${pricingFlowHtml()}
    <div class="pricing-cost-settings-grid">
      <section class="panel">
        <h2>Custos mensais rateados</h2>
        <p class="muted-inline">Esses valores são divididos pela média mensal de cumbucas e entram automaticamente no custo de todas as receitas.</p>
        <form id="pricing-shared-cost-form" class="form-grid">
          <label class="pricing-average-field">Média de cumbucas vendidas por mês
            <input name="averageMonthlyUnits" type="number" min="1" step="1" value="${shared.averageMonthlyUnits || ""}" required>
            <small>${observedAverage ? `Média observada nos lançamentos de Loja: ${observedAverage} unidades/mês.` : "Você também pode lançar quantidades em Loja > Produtos."}</small>
          </label>
          ${observedAverage ? `<div class="actions pricing-use-store-average"><button class="secondary" type="button" id="use-store-average">Usar média da Loja (${observedAverage})</button></div>` : ""}
          <fieldset class="pricing-cost-group">
            <legend>Produção mensal</legend>
            <label>Gás
              <input name="gas" type="text" inputmode="decimal" value="${moneyInputValue(shared.gas)}">
            </label>
            <label>Energia
              <input name="energy" type="text" inputmode="decimal" value="${moneyInputValue(shared.energy)}">
            </label>
          </fieldset>
          <fieldset class="pricing-cost-group pricing-team-group">
            <legend>Equipe</legend>
            <p class="muted-inline">Cadastre cada funcionário e o salário mensal. A soma entra automaticamente no custo de mão de obra.</p>
            <div class="pricing-staff-editor">
              <input name="staffId" type="hidden" value="">
              <label>Nome do funcionário
                <input name="staffName" placeholder="Ex.: Maria" autocomplete="off">
              </label>
              <label>Salário mensal
                <input name="staffSalary" type="text" inputmode="decimal" placeholder="Ex.: 1.800,00" autocomplete="off">
              </label>
              <div class="actions">
                <button type="button" id="save-pricing-staff">Adicionar funcionário</button>
                <button class="secondary" type="button" id="cancel-pricing-staff-edit" hidden>Cancelar edição</button>
              </div>
            </div>
            ${staff.length ? `
              <div class="table-wrap report-table pricing-staff-table">
                <table>
                  <thead><tr><th>Funcionário</th><th>Salário mensal</th><th>Ações</th></tr></thead>
                  <tbody>
                    ${staff.map(member => `
                      <tr
                        data-pricing-staff-member
                        data-staff-id="${escapeHtml(member.id)}"
                        data-staff-name="${escapeHtml(member.name)}"
                        data-staff-salary="${member.salary}"
                      >
                        <td><strong>${escapeHtml(member.name)}</strong></td>
                        <td>${money(member.salary)}</td>
                        <td>
                          <div class="table-actions">
                            <button class="secondary table-action" type="button" data-edit-pricing-staff="${escapeHtml(member.id)}">Editar</button>
                            <button class="danger table-action" type="button" data-delete-pricing-staff="${escapeHtml(member.id)}">Excluir</button>
                          </div>
                        </td>
                      </tr>
                    `).join("")}
                  </tbody>
                </table>
              </div>
            ` : `<p class="muted">Nenhum funcionário cadastrado.</p>`}
            <div class="pricing-staff-total">
              <span>Total mensal da equipe</span>
              <strong data-pricing-staff-total>${money(shared.labor)}</strong>
            </div>
          </fieldset>
          <fieldset class="pricing-cost-group">
            <legend>Demais custos mensais</legend>
            <p class="muted-inline pricing-cost-group-note">Embalagens e etiquetas não entram aqui. Cadastre o valor por unidade em Receitas &gt; Custo da embalagem.</p>
            <label>Aluguel
              <input name="rent" type="text" inputmode="decimal" value="${moneyInputValue(shared.rent)}">
            </label>
            <label>Contador
              <input name="accountant" type="text" inputmode="decimal" value="${moneyInputValue(shared.accountant)}">
            </label>
            <label>Telefonia
              <input name="telephony" type="text" inputmode="decimal" value="${moneyInputValue(shared.telephony)}">
            </label>
            <label>Marketing
              <input name="marketing" type="text" inputmode="decimal" value="${moneyInputValue(shared.marketing)}">
            </label>
            <label>Custos extraordinários
              <input name="extraordinary" type="text" inputmode="decimal" value="${moneyInputValue(shared.extraordinary)}">
            </label>
          </fieldset>
          <div class="actions">
            <button type="submit">Salvar custos rateados</button>
          </div>
        </form>
      </section>
      <aside class="panel pricing-shared-preview" aria-live="polite">
        <h2>Rateio automático</h2>
        <div class="pricing-rate-summary">
          <span><small>Custo mensal informado</small><strong data-pricing-shared-preview="monthly">${money(shared.monthlyTotal)}</strong></span>
          <span><small>Produção por cumbuca</small><strong data-pricing-shared-preview="production">${money(shared.productionPerUnit)}</strong></span>
          <span><small>Mão de obra por cumbuca</small><strong data-pricing-shared-preview="labor">${money(shared.laborPerUnit)}</strong></span>
          <span><small>Demais custos mensais</small><strong data-pricing-shared-preview="other">${money(shared.otherPerUnit)}</strong></span>
          <span class="total"><small>Total rateado por cumbuca</small><strong data-pricing-shared-preview="total">${money(shared.totalPerUnit)}</strong></span>
        </div>
        <p class="pricing-formula">Rateio por unidade = custo mensal ÷ média mensal de cumbucas.</p>
      </aside>
    </div>
  `;
}

function pricingStaffMembersFromForm(form) {
  return [...form.querySelectorAll("[data-pricing-staff-member]")].map(row => ({
    id: row.dataset.staffId,
    name: row.dataset.staffName,
    salary: pricingSafeNumber(row.dataset.staffSalary)
  }));
}

function pricingSharedCostsFromForm(form, staffOverride = null) {
  const values = readForm(form);
  const staff = pricingStaffMembers({
    staff: Array.isArray(staffOverride) ? staffOverride : pricingStaffMembersFromForm(form)
  });
  const labor = staff.reduce((sum, member) => sum + member.salary, 0);
  return {
    averageMonthlyUnits: pricingDecimalNumber(values.averageMonthlyUnits),
    gas: pricingSafeNumber(values.gas),
    energy: pricingSafeNumber(values.energy),
    staff,
    labor,
    rent: pricingSafeNumber(values.rent),
    accountant: pricingSafeNumber(values.accountant),
    telephony: pricingSafeNumber(values.telephony),
    marketing: pricingSafeNumber(values.marketing),
    extraordinary: pricingSafeNumber(values.extraordinary),
    updatedAt: new Date().toISOString()
  };
}

function pricingRecipeDraftFromForm(form) {
  const values = readForm(form);
  const savedRecipe = pricingRecipeById(values.recipeId);
  return {
    id: values.recipeId || "",
    name: String(values.name || "").trim(),
    category: String(values.category || "").trim(),
    weightGrams: pricingDecimalNumber(values.weightGrams),
    supermarketUnitCost: pricingSafeNumber(values.supermarketUnitCost),
    packagingCost: pricingSafeNumber(values.packagingCost),
    fixedFee: pricingSafeNumber(values.fixedFee),
    variableFeePercent: pricingDecimalNumber(values.variableFeePercent),
    desiredMarginPercent: pricingDecimalNumber(values.desiredMarginPercent),
    practicedPrice: pricingSafeNumber(values.practicedPrice),
    ingredientBatchSize: savedRecipe?.ingredientBatchSize || PRICING_RECIPE_BATCH_SIZE,
    ingredients: savedRecipe?.ingredients || []
  };
}

function updatePricingRecipePreview(form) {
  const metrics = pricingRecipeMetrics(pricingRecipeDraftFromForm(form));
  const totalCost = metrics.practicedPrice > 0 ? metrics.realTotalCost : metrics.totalCost;
  const variableFee = metrics.practicedPrice > 0
    ? metrics.realVariableFee
    : metrics.suggestedVariableFee;
  const profit = metrics.practicedPrice > 0 ? metrics.realProfit : metrics.suggestedProfit;
  const values = {
    supermarket: money(metrics.supermarketUnitCost),
    packaging: money(metrics.packagingCost),
    production: money(metrics.productionCost),
    labor: money(metrics.laborCost),
    other: money(metrics.otherCost),
    fees: money(metrics.fixedFee + variableFee),
    total: money(totalCost),
    suggested: money(metrics.suggestedPrice),
    profit: money(profit),
    margin: pricingPercent(metrics.realMarginPercent)
  };
  Object.entries(values).forEach(([key, value]) => {
    const target = document.querySelector(`[data-pricing-preview="${key}"]`);
    if (target) {
      target.textContent = value;
    }
  });
  const status = document.querySelector('[data-pricing-preview="status"]');
  if (status) {
    status.innerHTML = pricingStatusPill(metrics.status);
  }
}

function updatePricingSharedCostPreview(form) {
  const shared = pricingSharedCosts(pricingSharedCostsFromForm(form));
  const values = {
    monthly: money(shared.monthlyTotal),
    production: money(shared.productionPerUnit),
    labor: money(shared.laborPerUnit),
    other: money(shared.otherPerUnit),
    total: money(shared.totalPerUnit)
  };
  Object.entries(values).forEach(([key, value]) => {
    const target = document.querySelector(`[data-pricing-shared-preview="${key}"]`);
    if (target) {
      target.textContent = value;
    }
  });
}

async function renderPricing() {
  showStandardHero("Precificação");
  setActive("precificacao");
  const pricingTabs = [
    ["dashboard", "Visão geral"],
    ["recipes", "Pratos"],
    ["costs", "Custos rateados"]
  ];
  const requestedView = new URLSearchParams(location.search).get("view");
  if (pricingTabs.some(([key]) => key === requestedView)) {
    state.pricingViewTab = requestedView;
  }
  if (!pricingTabs.some(([key]) => key === state.pricingViewTab)) {
    state.pricingViewTab = "dashboard";
  }
  const activeView = state.pricingViewTab;
  const editingRecipe = pricingRecipeById(state.editPricingRecipeId) || null;

  app.innerHTML = `
    ${viewTabsHtml("pricingViewTab", activeView, pricingTabs)}
    ${viewPaneHtml("dashboard", activeView, pricingDashboardPanel())}
    ${viewPaneHtml("recipes", activeView, pricingRecipesPanel(editingRecipe))}
    ${viewPaneHtml("costs", activeView, pricingCostsPanel())}
  `;
  enhanceResponsiveTables(app);

  const openPricingView = view => {
    state.pricingViewTab = view;
    localStorage.setItem("pricingViewTab", JSON.stringify(view));
    history.replaceState(null, "", `/precificacao?view=${view}`);
    renderPricing();
  };

  document.querySelectorAll('[data-view-tab-group="pricingViewTab"] [data-view-tab]').forEach(button => {
    button.addEventListener("click", event => {
      openPricingView(event.currentTarget.dataset.viewTab);
    });
  });

  document.querySelectorAll("[data-pricing-open-view]").forEach(button => {
    button.addEventListener("click", event => {
      openPricingView(event.currentTarget.dataset.pricingOpenView);
    });
  });

  document.querySelectorAll("[data-pricing-add-ingredient-for-recipe]").forEach(button => {
    button.addEventListener("click", event => {
      state.pricingReturnRecipeId = event.currentTarget.dataset.pricingAddIngredientForRecipe;
      state.editPricingIngredientId = null;
      openPricingView("ingredients");
    });
  });

  document.querySelectorAll("[data-return-to-pricing-recipe]").forEach(button => {
    button.addEventListener("click", event => {
      state.editPricingRecipeId = event.currentTarget.dataset.returnToPricingRecipe;
      state.pricingReturnRecipeId = null;
      openPricingView("recipes");
    });
  });

  document.querySelectorAll("[data-pricing-edit-pending-recipe]").forEach(button => {
    button.addEventListener("click", event => {
      state.editPricingRecipeId = event.currentTarget.dataset.pricingEditPendingRecipe;
      openPricingView("recipes");
    });
  });

  const ingredientForm = document.querySelector("#pricing-ingredient-form");
  if (ingredientForm) {
    const updateUnitCost = () => {
      const values = readForm(ingredientForm);
      const unitCost = pricingDecimalNumber(values.purchaseQuantity) > 0
        ? pricingSafeNumber(values.purchaseCost) / pricingDecimalNumber(values.purchaseQuantity)
        : 0;
      const target = document.querySelector("[data-pricing-ingredient-unit-cost]");
      if (target) {
        target.textContent = pricingUnitCostMoney(unitCost);
      }
    };
    ingredientForm.addEventListener("input", updateUnitCost);
    ingredientForm.addEventListener("submit", async event => {
      event.preventDefault();
      const values = readForm(event.currentTarget);
      const name = String(values.name || "").trim();
      const purchaseQuantity = pricingDecimalNumber(values.purchaseQuantity);
      const purchaseCost = pricingSafeNumber(values.purchaseCost);
      const editingId = values.ingredientId || "";
      if (!name || purchaseQuantity <= 0 || purchaseCost <= 0) {
        showToast("Informe ingrediente, quantidade comprada e custo maior que zero.", "warning");
        return;
      }
      const duplicate = normalizedPricingIngredients().find(ingredient => {
        return ingredient.name.toLocaleLowerCase("pt-BR") === name.toLocaleLowerCase("pt-BR")
          && String(ingredient.id) !== String(editingId);
      });
      if (duplicate) {
        showToast("Já existe um ingrediente com esse nome.", "warning");
        return;
      }
      const ingredient = {
        id: editingId || `pricing-ingredient-${Date.now()}`,
        name,
        unit: ["kg", "unit", "box", "g", "ml"].includes(values.unit) ? values.unit : "kg",
        purchaseQuantity,
        purchaseCost,
        updatedAt: new Date().toISOString()
      };
      if (editingId) {
        state.ingredients = normalizedPricingIngredients().map(item => {
          return String(item.id) === String(editingId) ? ingredient : item;
        });
        recordAudit("Ingrediente de precificação editado", name);
      } else {
        state.ingredients = [...normalizedPricingIngredients(), ingredient];
        recordAudit("Ingrediente de precificação cadastrado", name);
      }
      if (await persistState()) {
        const returnRecipeId = state.pricingReturnRecipeId;
        state.editPricingIngredientId = null;
        if (returnRecipeId && pricingRecipeById(returnRecipeId)) {
          state.editPricingRecipeId = returnRecipeId;
          state.pricingReturnRecipeId = null;
          showToast(`Ingrediente cadastrado. Informe agora a quantidade usada em ${PRICING_RECIPE_BATCH_SIZE} pratos.`, "success");
          openPricingView("recipes");
        } else {
          renderPricing();
        }
      }
    });
  }

  on("#cancel-pricing-ingredient-edit", "click", () => {
    state.editPricingIngredientId = null;
    renderPricing();
  });

  document.querySelectorAll("[data-edit-pricing-ingredient]").forEach(button => {
    button.addEventListener("click", event => {
      state.editPricingIngredientId = event.currentTarget.dataset.editPricingIngredient;
      openPricingView("ingredients");
    });
  });

  document.querySelectorAll("[data-delete-pricing-ingredient]").forEach(button => {
    button.addEventListener("click", async event => {
      const ingredientId = event.currentTarget.dataset.deletePricingIngredient;
      const ingredient = normalizedPricingIngredients().find(item => {
        return String(item.id) === String(ingredientId);
      });
      if (!ingredient) {
        return;
      }
      const usedBy = (state.pricingRecipes || []).filter(recipe => {
        return (recipe.ingredients || []).some(item => {
          return String(item.ingredientId) === String(ingredientId);
        });
      });
      if (usedBy.length) {
        showToast(`Ingrediente usado em ${usedBy.length} receita(s). Remova-o das receitas antes de excluir.`, "warning");
        return;
      }
      if (!confirm(`Excluir o ingrediente "${ingredient.name}"?`)) {
        return;
      }
      state.ingredients = normalizedPricingIngredients().filter(item => {
        return String(item.id) !== String(ingredientId);
      });
      recordAudit("Ingrediente de precificação excluído", ingredient.name);
      if (await persistState()) {
        state.editPricingIngredientId = null;
        renderPricing();
      }
    });
  });

  const recipeForm = document.querySelector("#pricing-recipe-form");
  if (recipeForm) {
    recipeForm.addEventListener("input", () => updatePricingRecipePreview(recipeForm));
    recipeForm.addEventListener("submit", async event => {
      event.preventDefault();
      const recipe = pricingRecipeDraftFromForm(event.currentTarget);
      const creatingRecipe = !recipe.id;
      if (!recipe.name || !recipe.category || recipe.weightGrams <= 0) {
        showToast("Informe nome, categoria e peso final da cumbuca.", "warning");
        return;
      }
      if (recipe.supermarketUnitCost <= 0) {
        showToast("Informe o custo de supermercado de uma unidade.", "warning");
        return;
      }
      if (recipe.desiredMarginPercent + recipe.variableFeePercent >= 100) {
        showToast("A soma da margem desejada com a taxa variável deve ser menor que 100%.", "warning");
        return;
      }
      const duplicate = (state.pricingRecipes || []).find(item => {
        return String(item.name || "").toLocaleLowerCase("pt-BR")
            === recipe.name.toLocaleLowerCase("pt-BR")
          && String(item.id) !== String(recipe.id);
      });
      if (duplicate) {
        showToast("Já existe um prato com esse nome.", "warning");
        return;
      }
      const savedRecipe = {
        ...recipe,
        id: recipe.id || `pricing-recipe-${Date.now()}`,
        updatedAt: new Date().toISOString()
      };
      if (recipe.id) {
        state.pricingRecipes = (state.pricingRecipes || []).map(item => {
          return String(item.id) === String(recipe.id) ? savedRecipe : item;
        });
        recordAudit("Prato de precificação editado", recipe.name);
      } else {
        state.pricingRecipes = [...(state.pricingRecipes || []), savedRecipe];
        recordAudit("Prato de precificação cadastrado", recipe.name);
      }
      state.pricingConfig = {
        ...(state.pricingConfig || {}),
        projectionRecipeId: state.pricingConfig?.projectionRecipeId || savedRecipe.id
      };
      if (await persistState()) {
        state.editPricingRecipeId = null;
        showToast(creatingRecipe ? "Prato cadastrado com o custo unitário de supermercado." : "Prato atualizado.", "success");
        openPricingView("dashboard");
      }
    });
  }

  on("#cancel-pricing-recipe-edit", "click", () => {
    state.editPricingRecipeId = null;
    renderPricing();
  });

  document.querySelectorAll("[data-edit-pricing-recipe]").forEach(button => {
    button.addEventListener("click", event => {
      state.editPricingRecipeId = event.currentTarget.dataset.editPricingRecipe;
      openPricingView("recipes");
    });
  });

  document.querySelectorAll("[data-delete-pricing-recipe]").forEach(button => {
    button.addEventListener("click", async event => {
      const recipeId = event.currentTarget.dataset.deletePricingRecipe;
      const recipe = pricingRecipeById(recipeId);
      if (!recipe || !confirm(`Excluir o prato "${recipe.name}"?`)) {
        return;
      }
      state.pricingRecipes = (state.pricingRecipes || []).filter(item => {
        return String(item.id) !== String(recipeId);
      });
      if (String(state.pricingConfig?.projectionRecipeId) === String(recipeId)) {
        state.pricingConfig = {
          ...(state.pricingConfig || {}),
          projectionRecipeId: state.pricingRecipes[0]?.id || ""
        };
      }
      recordAudit("Receita de precificação excluída", recipe.name);
      if (await persistState()) {
        state.editPricingRecipeId = null;
        renderPricing();
      }
    });
  });

  const sharedCostForm = document.querySelector("#pricing-shared-cost-form");
  if (sharedCostForm) {
    const staffIdField = sharedCostForm.elements.staffId;
    const staffNameField = sharedCostForm.elements.staffName;
    const staffSalaryField = sharedCostForm.elements.staffSalary;
    const saveStaffButton = document.querySelector("#save-pricing-staff");
    const cancelStaffEditButton = document.querySelector("#cancel-pricing-staff-edit");
    const resetStaffEditor = () => {
      staffIdField.value = "";
      staffNameField.value = "";
      staffSalaryField.value = "";
      saveStaffButton.textContent = "Adicionar funcionário";
      cancelStaffEditButton.hidden = true;
    };

    sharedCostForm.addEventListener("input", () => {
      updatePricingSharedCostPreview(sharedCostForm);
    });

    [staffNameField, staffSalaryField].forEach(field => {
      field.addEventListener("keydown", event => {
        if (event.key === "Enter") {
          event.preventDefault();
          saveStaffButton.click();
        }
      });
    });

    saveStaffButton.addEventListener("click", async () => {
      const editingId = String(staffIdField.value || "");
      const name = String(staffNameField.value || "").trim();
      const salary = pricingSafeNumber(staffSalaryField.value);
      if (!name || salary <= 0) {
        showToast("Informe o nome do funcionário e um salário maior que zero.", "warning");
        return;
      }
      const currentStaff = pricingStaffMembersFromForm(sharedCostForm);
      const duplicate = currentStaff.find(member => {
        return member.name.toLocaleLowerCase("pt-BR") === name.toLocaleLowerCase("pt-BR")
          && String(member.id) !== editingId;
      });
      if (duplicate) {
        showToast("Já existe um funcionário com esse nome.", "warning");
        return;
      }
      const member = {
        id: editingId || `pricing-staff-${Date.now()}`,
        name,
        salary
      };
      const staff = editingId
        ? currentStaff.map(item => String(item.id) === editingId ? member : item)
        : [...currentStaff, member];
      const sharedCosts = pricingSharedCostsFromForm(sharedCostForm, staff);
      state.pricingConfig = {
        ...(state.pricingConfig || {}),
        sharedCosts
      };
      recordAudit(
        editingId ? "Funcionário da precificação editado" : "Funcionário da precificação cadastrado",
        `${name} - ${money(salary)}`
      );
      saveStaffButton.disabled = true;
      if (await persistState()) {
        renderPricing();
      } else {
        saveStaffButton.disabled = false;
      }
    });

    cancelStaffEditButton.addEventListener("click", resetStaffEditor);

    document.querySelectorAll("[data-edit-pricing-staff]").forEach(button => {
      button.addEventListener("click", event => {
        const memberId = event.currentTarget.dataset.editPricingStaff;
        const member = pricingStaffMembersFromForm(sharedCostForm).find(item => {
          return String(item.id) === String(memberId);
        });
        if (!member) {
          return;
        }
        staffIdField.value = member.id;
        staffNameField.value = member.name;
        staffSalaryField.value = moneyInputValue(member.salary);
        saveStaffButton.textContent = "Salvar funcionário";
        cancelStaffEditButton.hidden = false;
        staffNameField.focus();
      });
    });

    document.querySelectorAll("[data-delete-pricing-staff]").forEach(button => {
      button.addEventListener("click", async event => {
        const memberId = event.currentTarget.dataset.deletePricingStaff;
        const currentStaff = pricingStaffMembersFromForm(sharedCostForm);
        const member = currentStaff.find(item => String(item.id) === String(memberId));
        if (!member || !confirm(`Excluir o funcionário "${member.name}" da equipe?`)) {
          return;
        }
        const staff = currentStaff.filter(item => String(item.id) !== String(memberId));
        const sharedCosts = pricingSharedCostsFromForm(sharedCostForm, staff);
        state.pricingConfig = {
          ...(state.pricingConfig || {}),
          sharedCosts
        };
        recordAudit("Funcionário da precificação excluído", `${member.name} - ${money(member.salary)}`);
        event.currentTarget.disabled = true;
        if (await persistState()) {
          renderPricing();
        } else {
          event.currentTarget.disabled = false;
        }
      });
    });

    sharedCostForm.addEventListener("submit", async event => {
      event.preventDefault();
      const sharedCosts = pricingSharedCostsFromForm(event.currentTarget);
      if (sharedCosts.averageMonthlyUnits <= 0) {
        showToast("Informe uma média mensal maior que zero.", "warning");
        return;
      }
      state.pricingConfig = {
        ...(state.pricingConfig || {}),
        sharedCosts
      };
      recordAudit(
        "Custos rateados de precificação atualizados",
        `${sharedCosts.averageMonthlyUnits} cumbucas/mês`
      );
      if (await persistState()) {
        renderPricing();
      }
    });
  }

  on("#use-store-average", "click", () => {
    if (!sharedCostForm) {
      return;
    }
    const averageField = sharedCostForm.elements.averageMonthlyUnits;
    averageField.value = storeAverageMonthlyUnits();
    updatePricingSharedCostPreview(sharedCostForm);
  });

  const projectionSelect = document.querySelector("#pricing-projection-recipe");
  if (projectionSelect) {
    projectionSelect.addEventListener("change", async event => {
      state.pricingConfig = {
        ...(state.pricingConfig || {}),
        projectionRecipeId: event.currentTarget.value
      };
      if (await persistState()) {
        renderPricing();
      }
    });
  }
}

function reportCashEntries(periodKey) {
  const type = state.reportPeriod.type || "month";
  const entries = accountingCashEntries(state.cash);
  if (type === "day") {
    return entries.filter(entry => cashAccountingDate(entry) === reportDate());
  }
  if (type !== "week") {
    return entries.filter(entry => cashAccountingDate(entry).startsWith(periodKey));
  }

  const { start, end } = reportWeekRange();

  return entries.filter(entry => {
    const date = cashAccountingDate(entry);
    return date >= start && date <= end;
  });
}

function reportStoreSales(periodKey) {
  const type = state.reportPeriod.type || "month";
  if (type === "day") {
    return state.storeSales.filter(entry => String(entry.date || "") === reportDate());
  }
  if (type !== "week") {
    return state.storeSales.filter(entry => String(entry.date || "").startsWith(periodKey));
  }

  const { start, end } = reportWeekRange();
  return state.storeSales.filter(entry => {
    const date = String(entry.date || "");
    return date >= start && date <= end;
  });
}

function reportChannelReceipts(periodKey) {
  const type = state.reportPeriod.type || "month";
  if (type === "day") {
    return state.channelReceipts.filter(entry => String(entry.date || "") === reportDate());
  }
  if (type !== "week") {
    return state.channelReceipts.filter(entry => String(entry.date || "").startsWith(periodKey));
  }

  const { start, end } = reportWeekRange();
  return state.channelReceipts.filter(entry => {
    const date = String(entry.date || "");
    return date >= start && date <= end;
  });
}

function reportData() {
  const type = state.reportPeriod.type || "month";
  const today = isoDate(new Date());
  const periodKey = reportPeriodKey();
  const selectedWeek = Number(state.reportPeriod.week || 1);
  const weekKey = reportWeekKey();
  const cashEntries = reportCashEntries(periodKey);
  const storeSales = reportStoreSales(periodKey);
  const channelReceipts = reportChannelReceipts(periodKey);
  const orders = type === "day"
    ? state.orders.filter(order => String(order.createdAt || "").startsWith(reportDate()))
    : type === "week"
    ? state.orders.filter(order => order.menuKey === weekKey)
    : state.orders.filter(order => menuPeriodKeyFromKey(order.menuKey) === periodKey);
  const weeks = type === "week" ? [selectedWeek] : type === "day" ? [] : [1, 2, 3, 4, 5];
  const menuWeeks = weeks.map(week => {
    const key = `${periodKey}-semana-${week}`;
    const dishes = state.menus[key] || [];
    const weekOrders = state.orders.filter(order => order.menuKey === key);
    const weekProductionOrders = productionOrders(weekOrders);

    return {
      week,
      key,
      dishes,
      orders: weekProductionOrders,
      menuCost: weeklyMenuProductionCost(dishes, weekProductionOrders, null, periodKey),
      orderAmount: weekOrders.reduce((sum, order) => sum + Number(order.amount || 0), 0),
      deliveryFee: weekProductionOrders.reduce((sum, order) => sum + Number(order.deliveryFee || 0), 0),
      quantity: weekProductionOrders.reduce((sum, order) => sum + orderQuantity(order), 0)
    };
  });
  const accountAdjustmentEntries = cashEntries.filter(isAccountAdjustmentEntry);
  const businessEntries = businessCashEntries(cashEntries);
  const incomeEntries = businessEntries.filter(entry => entry.type !== "expense");
  const expenseEntries = businessEntries.filter(entry => entry.type === "expense");
  const income = incomeEntries
    .filter(entry => entry.type !== "expense")
    .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const expenses = expenseEntries
    .filter(entry => entry.type === "expense")
    .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const financial = financialSummary(cashEntries);
  const accountAdjustmentTotals = cashTotals(accountAdjustmentEntries);
  const accountBalanceDate = type === "day"
    ? reportDate()
    : type === "week"
      ? reportWeekRange().end
      : (() => {
          const [year, month] = periodKey.split("-").map(Number);
          const monthEnd = isoDate(new Date(year, month, 0));
          return periodKey === today.slice(0, 7) ? today : monthEnd;
        })();
  const accountBalances = accountBalanceBreakdownUntilDate(accountBalanceDate);
  const accountBalance = accountBalances.unified;
  const reportSavingsBalance = savingsBalanceUntilDate(accountBalanceDate);
  const reportSavingsExpectedBalance = savingsExpectedBalance();
  const savingsDifference = roundedMoneyValue(reportSavingsBalance - reportSavingsExpectedBalance);
  const consolidatedBalance = roundedMoneyValue(accountBalance + reportSavingsBalance);
  const accountTransfers = accountTransfersForCashEntries(cashEntries);
  const capitalContributionEntries = cashEntries.filter(isPartnerCapitalContributionEntry);
  const capitalContributionTotal = capitalContributionEntries.reduce(
    (sum, entry) => sum + Number(entry.amount || 0),
    0
  );
  const withdrawalHistoryControl = partnerPeriodTotals(withdrawalHistoryGroups(cashEntries));
  const periodBounds = type === "day"
    ? { start: reportDate(), end: reportDate() }
    : type === "week"
      ? reportWeekRange()
      : { start: `${periodKey}-01`, end: accountBalanceDate };
  const vanessaPartnerSummary = partnerAccountSummary(state.partnerAccounts, "vanessa", periodBounds);
  const partnerDebtBalances = partnerBalances(state.partnerAccounts, accountBalanceDate);
  const partnerDebtVanessa = Math.max(0, Number(partnerDebtBalances.vanessa || 0));
  const partnerDebtRaquel = Math.max(0, Number(partnerDebtBalances.raquel || 0));
  const partnerWithdrawalControl = {
    ...withdrawalHistoryControl,
    priorVanessa: partnerDebtVanessa,
    priorRaquel: partnerDebtRaquel,
    remainingDebtVanessa: partnerDebtVanessa,
    remainingDebtRaquel: partnerDebtRaquel
  };
  const orderRevenue = orders.reduce((sum, order) => sum + Number(order.amount || 0), 0);
  const soldOrders = productionOrders(orders);
  const deliveryRevenue = soldOrders.reduce((sum, order) => sum + Number(order.deliveryFee || 0), 0);
  const totalQuantity = soldOrders.reduce((sum, order) => sum + orderQuantity(order), 0);
  const storeQuantity = storeSales.reduce((sum, entry) => sum + storeSaleUnitQuantity(entry), 0);
  const weeklyCashQuantity = totalQuantity;
  const totalIncome = income;
  const paidOrders = soldOrders.filter(order => {
    const client = clientByPhone(order.clientPhone);
    return client.plan === "mensalista" ? Number(order.amount || 0) > 0 : isOrderPaid(order);
  }).length;

  return {
    type,
    periodKey,
    weekKey,
    date: reportDate(),
    selectedWeek,
    cashEntries,
    businessEntries,
    accountAdjustmentEntries,
    accountAdjustmentTotals,
    accountBalance,
    accountBalances,
    consolidatedBalance,
    accountTransfers,
    capitalContributionEntries,
    capitalContributionTotal,
    storeSales,
    channelReceipts,
    incomeEntries,
    expenseEntries,
    orders,
    menuWeeks,
    income,
    expenses,
    financial,
    partnerWithdrawalControl,
    vanessaFinancial: {
      received: Number(withdrawalHistoryControl.vanessa || 0),
      paid: Number(vanessaPartnerSummary.payments || 0),
      debt: partnerDebtVanessa
    },
    savingsBalance: reportSavingsBalance,
    savingsExpectedBalance: reportSavingsExpectedBalance,
    savingsDifference,
    accountBalanceDate,
    savingsUpdatedAt: state.financialPlanning?.savingsUpdatedAt || "",
    partnersRecord: partnersRecordForPeriod(periodKey),
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
    pendingOrders: soldOrders.length - paidOrders,
    menuCost: menuWeeks.reduce((sum, item) => sum + item.menuCost, 0),
    topExpenses: [...expenseEntries]
      .sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0))
      .slice(0, 6),
    weeklyClients: state.clients.filter(client => client.plan !== "mensalista").length,
    monthlyClients: state.clients.filter(client => client.plan === "mensalista").length
  };
}

function supermarketExpenseEntry(entry = {}) {
  return slugifyCategory(categoryName(entry.category)) === "supermercado";
}

function foodInputExpenseCategory(entry = {}) {
  return ["supermercado", "frigorifico", "boleto"]
    .includes(slugifyCategory(categoryName(entry.category)));
}

const managementSalesCategorySlugs = new Set([
  "venda",
  "vendas",
  "cardapio-web",
  "ifood",
  "99-food"
]);

function salesIncomeEntry(entry = {}) {
  if (entry.type === "expense" || isAccountAdjustmentEntry(entry) || isWithdrawalEntry(entry)) {
    return false;
  }
  const rawCategory = slugifyCategory(entry.category);
  const namedCategory = slugifyCategory(categoryName(entry.category));
  return managementSalesCategorySlugs.has(rawCategory)
    || managementSalesCategorySlugs.has(namedCategory);
}

function salesRevenueForPeriod(periodKey = reportPeriodKey()) {
  const cashSales = accountingCashEntries(state.cash)
    .filter(entry => String(cashAccountingDate(entry)).startsWith(periodKey))
    .filter(salesIncomeEntry)
    .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  return {
    periodKey,
    cashSales,
    total: cashSales
  };
}

function monthlySoldQuantities(periodKey = reportPeriodKey()) {
  const menuQuantity = productionOrders(state.orders.filter(order => {
    return menuPeriodKeyFromKey(order.menuKey) === periodKey;
  })).reduce((sum, order) => sum + orderQuantity(order), 0);
  const storeQuantity = state.storeSales
    .filter(entry => String(entry.date || "").startsWith(periodKey))
    .reduce((sum, entry) => sum + storeSaleUnitQuantity(entry), 0);
  return {
    menuQuantity,
    storeQuantity,
    totalQuantity: menuQuantity + storeQuantity
  };
}

function monthlySupermarketCashTotals(periodKey = reportPeriodKey()) {
  const entries = accountingCashEntries(state.cash).filter(entry => {
    return String(cashAccountingDate(entry)).startsWith(periodKey)
      && !isAccountAdjustmentEntry(entry)
      && supermarketExpenseEntry(entry);
  });
  const income = entries
    .filter(entry => entry.type !== "expense")
    .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const expenses = entries
    .filter(entry => entry.type === "expense")
    .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  return {
    income,
    expenses,
    balance: income - expenses,
    supermarketTotal: Math.max(0, expenses - income)
  };
}

function monthlySupermarketAllocation(periodKey = reportPeriodKey()) {
  const cash = monthlySupermarketCashTotals(periodKey);
  const quantities = monthlySoldQuantities(periodKey);
  return {
    periodKey,
    ...cash,
    ...quantities,
    costPerUnit: quantities.totalQuantity > 0
      ? cash.supermarketTotal / quantities.totalQuantity
      : 0
  };
}

function productionPurchasesForPeriod(periodKey = reportPeriodKey()) {
  const quantities = monthlySoldQuantities(periodKey);
  const sales = salesRevenueForPeriod(periodKey);
  const inputEntries = accountingCashEntries(state.cash).filter(entry => {
    return entry.type === "expense"
      && String(cashAccountingDate(entry)).startsWith(periodKey)
      && !isAccountAdjustmentEntry(entry)
      && foodInputExpenseCategory(entry);
  });
  const totalForCategory = category => inputEntries
    .filter(entry => slugifyCategory(categoryName(entry.category)) === category)
    .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const supermarketTotal = totalForCategory("supermercado");
  const butcherTotal = totalForCategory("frigorifico");
  const billsTotal = totalForCategory("boleto");
  const combinedTotal = supermarketTotal + butcherTotal + billsTotal;

  return {
    periodKey,
    ...quantities,
    salesRevenue: sales.total,
    cashSalesRevenue: sales.cashSales,
    supermarketTotal,
    butcherTotal,
    billsTotal,
    combinedTotal,
    purchasesProduction: combinedTotal,
    costPerPlate: quantities.totalQuantity > 0
      ? combinedTotal / quantities.totalQuantity
      : 0,
    purchasesPerBowl: quantities.totalQuantity > 0
      ? combinedTotal / quantities.totalQuantity
      : 0,
    purchasesSalesPercent: sales.total > 0
      ? (combinedTotal / sales.total) * 100
      : 0
  };
}

function monthlyFoodAndBillsCost(periodKey = reportPeriodKey()) {
  return productionPurchasesForPeriod(periodKey);
}

window.monthlyFoodAndBillsCost = monthlyFoodAndBillsCost;

function managementMonthKeys(periodKey, count = 3) {
  const keys = [];
  let currentKey = periodKey;
  for (let index = 0; index < count; index += 1) {
    keys.push(currentKey);
    currentKey = previousMonthKeyFromPeriod(currentKey);
  }
  return keys;
}

function managementPeriodHasData(periodKey) {
  return accountingCashEntries(state.cash)
    .some(entry => String(cashAccountingDate(entry)).startsWith(periodKey))
    || state.orders.some(order => menuPeriodKeyFromKey(order.menuKey) === periodKey)
    || state.storeSales.some(entry => String(entry.date || "").startsWith(periodKey));
}

function managementPeriodMetrics(periodKey = reportPeriodKey()) {
  const periodEntries = accountingCashEntries(state.cash).filter(entry => {
    return String(cashAccountingDate(entry)).startsWith(periodKey);
  });
  const financial = financialSummary(periodEntries);
  const partnerWithdrawalControl = partnerPeriodTotals(withdrawalHistoryGroups(periodEntries));
  const purchases = productionPurchasesForPeriod(periodKey);
  const accountAdjustmentTotals = cashTotals(periodEntries.filter(isAccountAdjustmentEntry));
  const accountTransferTotals = cashTotals(periodEntries.filter(isAccountTransferCashEntry));
  const cashTotalsForPeriod = cashTotals(periodEntries.filter(
    entry => !isAccountAdjustmentEntry(entry) && !isAccountTransferCashEntry(entry)
  ));
  const capitalContributionTotal = periodEntries
    .filter(isPartnerCapitalContributionEntry)
    .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const [year, month] = periodKey.split("-").map(Number);
  const periodOpeningDate = isoDate(new Date(year, month - 1, 0));
  const periodEnd = isoDate(new Date(year, month, 0));

  return {
    periodKey,
    hasData: managementPeriodHasData(periodKey),
    entries: periodEntries,
    financial,
    partnerWithdrawalControl,
    purchases,
    sales: purchases.salesRevenue,
    purchasesProduction: purchases.combinedTotal,
    purchasesPerBowl: purchases.purchasesPerBowl,
    purchasesSalesPercent: purchases.purchasesSalesPercent,
    bowls: purchases.totalQuantity,
    menuBowls: purchases.menuQuantity,
    storeBowls: purchases.storeQuantity,
    operationalProfit: operationalProfitForReport({ financial, partnerWithdrawalControl }),
    distribution: profitDistributionForReport({ financial, partnerWithdrawalControl }),
    cashWithdrawals: cashWithdrawalsForReport({ financial, partnerWithdrawalControl }),
    debtCompensation: debtCompensationForReport({ financial, partnerWithdrawalControl }),
    cashIncome: cashTotalsForPeriod.income,
    cashExpenses: cashTotalsForPeriod.expenses,
    accountTransferCashNet: accountTransferTotals.balance,
    capitalContributionTotal,
    accountAdjustmentTotals,
    openingCashBalance: accountBalanceUntilDate(periodOpeningDate),
    finalCashBalance: accountBalanceUntilDate(periodEnd),
    openingSavingsBalance: savingsBalanceUntilDate(periodOpeningDate),
    finalSavingsBalance: savingsBalanceUntilDate(periodEnd),
    openingConsolidatedBalance: consolidatedBalanceUntilDate(periodOpeningDate),
    finalConsolidatedBalance: consolidatedBalanceUntilDate(periodEnd)
  };
}

function managementMovingAverage(periodKey = reportPeriodKey(), count = 3) {
  const months = managementMonthKeys(periodKey, count)
    .filter(managementPeriodHasData)
    .map(managementPeriodMetrics);
  const average = key => months.length
    ? months.reduce((sum, item) => sum + Number(item[key] || 0), 0) / months.length
    : 0;
  return {
    periodKey,
    monthKeys: months.map(item => item.periodKey),
    monthsUsed: months.length,
    sales: average("sales"),
    purchasesProduction: average("purchasesProduction"),
    purchasesPerBowl: average("purchasesPerBowl"),
    purchasesSalesPercent: average("purchasesSalesPercent"),
    bowls: average("bowls")
  };
}

function managementVariation(current, previous) {
  const currentValue = Number(current || 0);
  const previousValue = Number(previous || 0);
  return {
    absolute: currentValue - previousValue,
    percent: Math.abs(previousValue) > 0.005
      ? ((currentValue - previousValue) / Math.abs(previousValue)) * 100
      : 0
  };
}

function managementComparisonRows(periodKey = reportPeriodKey()) {
  const current = managementPeriodMetrics(periodKey);
  const previous = managementPeriodMetrics(previousMonthKeyFromPeriod(periodKey));
  const row = (label, key, kind = "money", lowerIsBetter = false) => {
    const variation = managementVariation(current[key], previous[key]);
    return {
      label,
      key,
      kind,
      lowerIsBetter,
      current: current[key],
      previous: previous[key],
      delta: variation.absolute,
      variationPercent: variation.percent,
      percentagePointDelta: kind === "percent" ? variation.absolute : null
    };
  };
  return [
    row("Vendas", "sales"),
    row("Compras de insumos", "purchasesProduction", "money", true),
    row("Compras por cumbuca", "purchasesPerBowl", "money", true),
    row("Compras / Vendas", "purchasesSalesPercent", "percent", true),
    row("Cumbucas vendidas", "bowls", "count"),
    row("Lucro operacional", "operationalProfit")
  ];
}

function managementAttentionItems(current, previous, average) {
  const items = [];
  const change = (value, reference) => managementVariation(value, reference);
  const perBowlPrevious = change(current.purchasesPerBowl, previous.purchasesPerBowl);
  const perBowlAverage = change(current.purchasesPerBowl, average.purchasesPerBowl);
  const purchasesChange = change(current.purchasesProduction, previous.purchasesProduction);
  const bowlsChange = change(current.bowls, previous.bowls);
  const salesChange = change(current.sales, previous.sales);
  const ratioPointDifference = current.purchasesSalesPercent - previous.purchasesSalesPercent;

  if (current.purchasesPerBowl > 0 && (
    (previous.purchasesPerBowl > 0 && perBowlPrevious.percent >= 5)
    || (average.purchasesPerBowl > 0 && perBowlAverage.percent >= 5)
  )) {
    const reference = previous.purchasesPerBowl > 0 ? previous.purchasesPerBowl : average.purchasesPerBowl;
    const variation = change(current.purchasesPerBowl, reference);
    items.push({
      tone: "warning",
      title: "Compras por cumbuca aumentaram",
      value: money(current.purchasesPerBowl),
      reference: `Referência ${money(reference)}`,
      detail: `Alta de ${Math.abs(variation.percent).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`
    });
  }

  if (previous.purchasesSalesPercent > 0 && ratioPointDifference > 0.05) {
    items.push({
      tone: "warning",
      title: "Compras estão consumindo uma parcela maior das vendas",
      value: `${current.purchasesSalesPercent.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`,
      reference: `Anterior ${previous.purchasesSalesPercent.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`,
      detail: `+${ratioPointDifference.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} p.p.`
    });
  }

  if (purchasesChange.absolute > 0.005 && bowlsChange.absolute < -0.005) {
    items.push({
      tone: "warning",
      title: "Compras aumentaram enquanto as cumbucas vendidas caíram",
      value: `${money(purchasesChange.absolute)} a mais em compras`,
      reference: `${Math.abs(bowlsChange.absolute).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} cumbuca(s) a menos`,
      detail: "Pode indicar estoque, compra antecipada, desperdício ou redução de eficiência; confira a operação."
    });
  }

  if (previous.purchasesPerBowl > 0 && perBowlPrevious.percent <= -5) {
    items.push({
      tone: "positive",
      title: `Compras por cumbuca caíram ${Math.abs(perBowlPrevious.percent).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`,
      value: money(current.purchasesPerBowl),
      reference: `Anterior ${money(previous.purchasesPerBowl)}`,
      detail: "Melhora no valor de compras distribuído por cumbuca."
    });
  }

  if (salesChange.absolute > 0.005 && purchasesChange.absolute < -0.005) {
    items.push({
      tone: "positive",
      title: "Vendas cresceram enquanto as compras caíram",
      value: `${money(salesChange.absolute)} a mais em vendas`,
      reference: `${money(Math.abs(purchasesChange.absolute))} a menos em compras`,
      detail: "Movimento positivo no período; acompanhe para confirmar a tendência."
    });
  }

  return items;
}

function managementExpenseGroups(metrics) {
  const groups = metrics.entries
    .filter(entry => entry.type === "expense")
    .filter(entry => !isWithdrawalEntry(entry))
    .filter(entry => !isAccountAdjustmentEntry(entry))
    .filter(entry => !isPartnerCashEntry(entry))
    .filter(entry => !isAccountTransferCashEntry(entry))
    .filter(entry => !isPartnerCapitalContributionEntry(entry))
    .filter(entry => !foodInputExpenseCategory(entry))
    .reduce((result, entry) => {
      const label = categoryName(entry.category);
      result.set(label, Number(result.get(label) || 0) + Number(entry.amount || 0));
      return result;
    }, new Map());
  return [...groups.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}

function managementDreData(periodKey = reportPeriodKey()) {
  const metrics = managementPeriodMetrics(periodKey);
  const withdrawalAmounts = withdrawalBreakdownAmounts(
    metrics.financial.withdrawals,
    metrics.partnerWithdrawalControl
  );
  return {
    ...metrics,
    marginAfterPurchases: metrics.sales - metrics.purchasesProduction,
    financialIncomeReconciliation: metrics.financial.income - metrics.sales,
    otherOperationalExpenses: Math.max(
      0,
      metrics.financial.operationalExpenses - metrics.purchasesProduction
    ),
    otherExpenseGroups: managementExpenseGroups(metrics),
    withdrawalAmounts
  };
}

function managementValueLabel(value, kind = "money") {
  if (kind === "count") {
    return Number(value || 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 });
  }
  if (kind === "percent") {
    return `${Number(value || 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
  }
  return money(value);
}

function managementDeltaHtml(current, previous, options = {}) {
  const { lowerIsBetter = false, kind = "money" } = options;
  const variation = managementVariation(current, previous);
  const hasPrevious = Math.abs(Number(previous || 0)) >= 0.005;
  if (!hasPrevious) {
    return `<small class="executive-delta neutral">Sem base anterior</small>`;
  }
  const improved = lowerIsBetter ? variation.absolute < 0 : variation.absolute > 0;
  const tone = Math.abs(variation.absolute) < 0.005
    ? "neutral"
    : improved
      ? "positive"
      : "negative";
  const direction = variation.absolute > 0 ? "↑" : variation.absolute < 0 ? "↓" : "";
  const detail = kind === "percent"
    ? `${variation.absolute > 0 ? "+" : ""}${variation.absolute.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} p.p.`
    : `${direction} ${Math.abs(variation.percent).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
  return `<small class="executive-delta ${tone}">${detail} <span>vs. mês anterior</span></small>`;
}

function managementComparisonValue(row, value) {
  return managementValueLabel(value, row.kind);
}

function managementComparisonDelta(row) {
  if (row.kind === "percent") {
    return `${row.delta > 0 ? "+" : ""}${row.delta.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} p.p.`;
  }
  if (row.kind === "count") {
    return `${row.delta > 0 ? "+" : ""}${Number(row.delta || 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}`;
  }
  return `${row.delta > 0 ? "+" : row.delta < 0 ? "−" : ""}${money(Math.abs(row.delta))}`;
}

function managementStatementHtml(data, { includeHeading = false } = {}) {
  const visibleExpenses = data.otherExpenseGroups.slice(0, 7);
  const visibleExpenseTotal = visibleExpenses.reduce((sum, item) => sum + item.value, 0);
  const remainingExpenses = Math.max(0, data.otherOperationalExpenses - visibleExpenseTotal);
  const adjustments = data.accountAdjustmentTotals.balance;
  const savingsPercent = Math.max(0, Number(state.appConfig.splitSavingsPercent || 0));
  const partnerPoolPercent = Math.max(0, 100 - savingsPercent);
  const savingsExpectedFromPartners = partnerPoolPercent > 0
    ? roundedMoneyValue(
        (
          Number(data.partnerWithdrawalControl.expectedVanessa || 0)
          + Number(data.withdrawalAmounts.receivedNowRaquel || 0)
        ) * savingsPercent / partnerPoolPercent
      )
    : 0;
  return `
    ${includeHeading ? `
      <div class="executive-card-heading">
        <div>
          <span class="executive-eyebrow">Resultado do mês</span>
          <h2>DRE gerencial simplificada</h2>
        </div>
        <a href="/relatorios">Ver relatório</a>
      </div>
    ` : ""}
    <div class="executive-statement management-statement" data-management-dre>
      <div class="statement-section-label"><span>Vendas</span></div>
      <div><span>Receita de vendas</span><strong>${money(data.sales)}</strong></div>
      <div class="statement-section-label"><span>(−) Compras para produção</span></div>
      <div class="expense statement-detail"><span>Boleto</span><strong>− ${money(data.purchases.billsTotal)}</strong></div>
      <div class="expense statement-detail"><span>Supermercado</span><strong>− ${money(data.purchases.supermarketTotal)}</strong></div>
      <div class="expense statement-detail"><span>Frigorífico</span><strong>− ${money(data.purchases.butcherTotal)}</strong></div>
      <div class="subtotal"><span>Margem após compras</span><strong>${money(data.marginAfterPurchases)}</strong></div>
      <div class="statement-section-label"><span>(−) Outras despesas operacionais</span></div>
      ${visibleExpenses.map(item => `
        <div class="expense statement-detail"><span>${escapeHtml(item.label)}</span><strong>− ${money(item.value)}</strong></div>
      `).join("")}
      ${remainingExpenses >= 0.005 ? `
        <div class="expense statement-detail"><span>Demais despesas operacionais</span><strong>− ${money(remainingExpenses)}</strong></div>
      ` : ""}
      ${Math.abs(data.financialIncomeReconciliation) >= 0.005 ? `
        <div class="statement-detail management-reconciliation">
          <span>Conciliação com entradas do Financeiro<small>Entradas operacionais do Caixa não classificadas como venda.</small></span>
          <strong class="${data.financialIncomeReconciliation < 0 ? "negative" : "positive"}">${data.financialIncomeReconciliation > 0 ? "+ " : "− "}${money(Math.abs(data.financialIncomeReconciliation))}</strong>
        </div>
      ` : ""}
      <div class="total"><span>Lucro operacional</span><strong class="${data.operationalProfit < 0 ? "negative" : "positive"}">${money(data.operationalProfit)}</strong></div>
      <p class="management-statement-note">O lucro operacional preserva a fonte do Financeiro: entradas operacionais menos despesas operacionais. Retiradas não alteram esse valor.</p>
      <div class="statement-section-label separated"><span>Retiradas das sócias</span></div>
      <div class="statement-detail"><span>Vanessa — recebeu da conta</span><strong>${money(data.withdrawalAmounts.receivedNowVanessa)}</strong></div>
      <div class="statement-detail"><span>Vanessa — dívida compensada<small>Direito reconhecido que não saiu da conta.</small></span><strong>${money(data.withdrawalAmounts.paidToCashVanessa)}</strong></div>
      <div class="subtotal"><span>Vanessa — direito reconhecido<small>Recebido da conta + dívida compensada; não é a retirada bancária.</small></span><strong>${money(data.withdrawalAmounts.vanessa)}</strong></div>
      <div class="statement-detail"><span>Raquel — recebeu da conta</span><strong>${money(data.withdrawalAmounts.receivedNowRaquel)}</strong></div>
      <div class="statement-detail"><span>Raquel — dívida compensada<small>Direito reconhecido que não saiu da conta.</small></span><strong>${money(data.withdrawalAmounts.paidToCashRaquel)}</strong></div>
      <div class="subtotal"><span>Raquel — distribuição reconhecida</span><strong>${money(data.withdrawalAmounts.raquel)}</strong></div>
      <div class="statement-detail"><span>Cofrinho — deveria ter recebido<small>Calculado sobre o direito da Vanessa + o valor recebido pela Raquel.</small></span><strong>${money(savingsExpectedFromPartners)}</strong></div>
      <div class="subtotal"><span>Cofrinho — recebeu da conta</span><strong>${money(data.withdrawalAmounts.savings)}</strong></div>
      <div class="statement-section-label separated"><span>Movimentação de caixa</span></div>
      <div class="statement-detail"><span>Saldo inicial PF + PJ</span><strong>${money(data.openingCashBalance)}</strong></div>
      <div class="statement-detail"><span>Cofrinho inicial</span><strong>${money(data.openingSavingsBalance)}</strong></div>
      <div class="statement-detail"><span>Saldo consolidado inicial</span><strong>${money(data.openingConsolidatedBalance)}</strong></div>
      <div class="statement-detail"><span>Entradas</span><strong>${money(data.cashIncome)}</strong></div>
      <div class="statement-detail"><span>Saídas</span><strong>− ${money(data.cashExpenses)}</strong></div>
      ${Math.abs(data.accountTransferCashNet) >= 0.005 ? `<div class="statement-detail"><span>Transferências internas — efeito líquido em PF + PJ</span><strong class="${data.accountTransferCashNet < 0 ? "negative" : "positive"}">${data.accountTransferCashNet > 0 ? "+ " : "− "}${money(Math.abs(data.accountTransferCashNet))}</strong></div>` : ""}
      ${data.capitalContributionTotal >= 0.005 ? `<div class="statement-detail"><span>Aportes de sócias<small>Entrada de caixa não operacional; não compõe vendas nem lucro.</small></span><strong>${money(data.capitalContributionTotal)}</strong></div>` : ""}
      <div class="statement-detail"><span>Ajustes</span><strong class="${adjustments < 0 ? "negative" : ""}">${money(adjustments)}</strong></div>
      <div class="statement-detail"><span>Saldo final PF + PJ</span><strong class="${data.finalCashBalance < 0 ? "negative" : "positive"}">${money(data.finalCashBalance)}</strong></div>
      <div class="statement-detail"><span>Cofrinho final</span><strong>${money(data.finalSavingsBalance)}</strong></div>
      <div class="total"><span>Saldo consolidado final<small>PF + PJ + Cofrinho</small></span><strong class="${data.finalConsolidatedBalance < 0 ? "negative" : "positive"}">${money(data.finalConsolidatedBalance)}</strong></div>
    </div>
  `;
}

function financeFoodAndBillsCostPanel(periodKey = reportPeriodKey()) {
  const costs = productionPurchasesForPeriod(periodKey);
  return `
    <section class="panel report-section finance-food-cost" data-finance-food-cost>
      <div class="section-heading">
        <div>
          <h2>Compras de insumos</h2>
          <p class="muted-inline">${formatMonthKeyBr(periodKey)} · Boleto + Supermercado + Frigorífico pagos no período.</p>
        </div>
      </div>
      <div class="summary">
        <div class="metric report-metric"><span>Supermercado</span><strong data-finance-supermarket-total>${money(costs.supermarketTotal)}</strong></div>
        <div class="metric report-metric"><span>Frigorífico</span><strong data-finance-butcher-total>${money(costs.butcherTotal)}</strong></div>
        <div class="metric report-metric"><span>Boleto</span><strong data-finance-bills-total>${money(costs.billsTotal)}</strong><small>Somente lançamentos na categoria Boleto</small></div>
        <div class="metric report-metric"><span>Compras para produção</span><strong data-finance-input-total>${money(costs.combinedTotal)}</strong><small>${costs.purchasesSalesPercent.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% das vendas</small></div>
        <div class="metric report-metric"><span>Total de cumbucas vendidas</span><strong data-finance-sold-plates>${costs.totalQuantity}</strong><small>Menu ${costs.menuQuantity} + Loja ${costs.storeQuantity}</small></div>
        <div class="metric report-metric total"><span>Compras por cumbuca</span><strong data-finance-cost-per-plate>${money(costs.purchasesPerBowl)}</strong><small title="Compras de insumos do período divididas pelas cumbucas vendidas. Não representa CMV contábil porque não considera estoque inicial e final.">${money(costs.combinedTotal)} ÷ ${costs.totalQuantity || 0}</small></div>
      </div>
      <p class="muted">Compras de insumos do período divididas pelas cumbucas vendidas. Não representa CMV contábil porque não considera estoque inicial e final.</p>
      ${costs.combinedTotal > 0 && costs.totalQuantity === 0 ? `
        <p class="form-hint warning-text">Existem compras de insumos no Caixa, mas ainda não há cumbucas vendidas neste mês para fazer o rateio.</p>
      ` : ""}
    </section>
  `;
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
        return client.plan === "semanal" && isOrderPaid(order);
      })
      .reduce((sum, order) => sum + Number(order.amount || 0), 0)],
    ["Pedidos semanais pendentes", data.orders
      .filter(order => {
        const client = clientByPhone(order.clientPhone);
        return client.plan === "semanal" && !isOrderPaid(order);
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
    .filter(entry => !isAccountAdjustmentEntry(entry))
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

function reportPdfIncomeChannelRows(data) {
  const cashRows = accountIncomeBreakdown(data).map(([label, value]) => ["Caixa", label, value]);
  const weeklyRows = weeklyRevenueBreakdown(data).map(([label, value]) => ["Semanal", label, value]);
  const cardapioRows = cardapioPaymentDefinitions
    .map(([paymentKey, label]) => [
      "Cardápio Web",
      label,
      data.channelReceipts.reduce((sum, entry) => sum + cardapioPaymentAmount(entry, paymentKey), 0)
    ])
    .filter(([, , value]) => value > 0)
    .map(([group, label, value]) => [group, label, money(value)]);
  const marketplaceRows = channelDefinitions
    .filter(([key]) => key !== "cardapioWeb")
    .map(([key, label]) => [
      "Canal",
      label,
      data.channelReceipts.reduce((sum, entry) => sum + channelReceiptAmount(entry, key, "net"), 0)
    ])
    .filter(([, , value]) => value > 0)
    .map(([group, label, value]) => [group, label, money(value)]);

  return [...cashRows, ...weeklyRows, ...cardapioRows, ...marketplaceRows];
}

function reportPdfExpenseCategoryRows(data) {
  return moneyRowsByCategory(data.expenseEntries, "expense")
    .map(([label, value]) => [label, money(value)]);
}

function reportPdfTopExpenseRows(data) {
  return [...data.expenseEntries]
    .sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0))
    .slice(0, 10)
    .map(entry => [entry.description || categoryName(entry.category), categoryName(entry.category), money(entry.amount)]);
}

function reportPdfNegativeDifferenceRows(data) {
  return comparisonReportRows(data)
    .filter(row => Number(row.delta || 0) < 0)
    .map(row => [
      row.label,
      managementComparisonValue(row, row.current),
      managementComparisonValue(row, row.previous),
      managementComparisonDelta(row)
    ]);
}

function reportPdfWithdrawalRows(data) {
  const automaticDifferenceTotal = data.expenseEntries
    .filter(entry => normalizedCategory(entry.category) === "diferenca" || String(entry.description || "").toLowerCase().includes("diferen"))
    .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const partners = data.partnersRecord || {};
  const informedVanessa = Number(partners.vanessa || 0);
  const informedRaquel = Number(partners.raquel || 0);
  const differenceTotal = Number(partners.difference || 0) || automaticDifferenceTotal;
  const compensationVanessa = Number(data.partnerWithdrawalControl?.paidToCashVanessa || 0);
  const compensationRaquel = Number(data.partnerWithdrawalControl?.paidToCashRaquel || 0);
  const receivedVanessa = Number(data.vanessaFinancial?.received || 0);
  const receivedRaquel = Number(data.financial.withdrawals.raquel || 0);
  const rows = [
    ["Lucro operacional", money(operationalProfitForReport(data))],
    ["Total que saiu da conta", money(data.partnerWithdrawalControl?.paidNowTotal)],
    ["Cofrinho - deveria ter", money(data.savingsExpectedBalance)],
    ["Cofrinho - transferido agora", money(data.financial.withdrawals.savings)],
    ["Vanessa - direito na divisão", money(data.partnerWithdrawalControl?.expectedVanessa)],
    ["Vanessa - recebeu da conta", money(receivedVanessa)],
    ["Vanessa - pagou em Sócias", money(data.vanessaFinancial?.paid)],
    ["Vanessa - ainda não retirou", money(data.partnerWithdrawalControl?.pendingVanessa)],
    ["Vanessa - saldo devedor em Sócias", money(data.vanessaFinancial?.debt)],
    ["Raquel - direito na divisão", money(data.partnerWithdrawalControl?.expectedRaquel)],
    ["Raquel - recebeu da conta", money(receivedRaquel)],
    ["Raquel - ainda não retirou", money(data.partnerWithdrawalControl?.pendingRaquel)],
    ["Raquel - saldo devedor em Sócias", money(data.partnerWithdrawalControl?.priorRaquel)],
  ];

  if (compensationVanessa > 0) {
    rows.push(["Vanessa - dívida compensada", money(compensationVanessa)]);
    rows.push(["Vanessa - total recebido + compensado", money(receivedVanessa + compensationVanessa)]);
  }
  if (compensationRaquel > 0) {
    rows.push(["Raquel - dívida compensada", money(compensationRaquel)]);
    rows.push(["Raquel - total recebido + compensado", money(receivedRaquel + compensationRaquel)]);
  }

  if (informedVanessa > 0 || informedRaquel > 0) {
    rows.push(["Vanessa informada", money(informedVanessa)]);
    rows.push(["Raquel informada", money(informedRaquel)]);
  }

  if (differenceTotal > 0) {
    rows.push([partners.difference ? "Compensação manual informada" : "Compensação manual", money(differenceTotal)]);
  }

  return rows;
}

function reportAccountPackageEntries(data, cashAccount = "all") {
  const requested = String(cashAccount || "all").trim().toLowerCase();
  const selected = requested === "unassigned"
    ? "unassigned"
    : reconciliationCashAccount(requested);
  const entries = accountingCashEntries(data.cashEntries || []);
  if (selected === "all") {
    return entries
      .filter(entry => ["pf", "pj"].includes(normalizedCashAccount(entry.cashAccount, "")))
      .filter(entry => !isAccountTransferCashEntry(entry));
  }
  if (selected === "unassigned") {
    return entries.filter(entry => !normalizedCashAccount(entry.cashAccount, ""));
  }
  return entries.filter(entry => normalizedCashAccount(entry.cashAccount, "") === selected);
}

function reportAccountPackageSummaryRows(data) {
  return [
    ["all", "Unificado PF + PJ"],
    ["pf", "Conta PF"],
    ["pj", "Conta PJ"],
    ["savings", "Conta Cofrinho"],
    ["unassigned", "Sem conta informada"]
  ].map(([key, label]) => {
    const entries = reportAccountPackageEntries(data, key);
    const actualEntries = key === "all"
      ? accountingCashEntries(data.cashEntries || []).filter(entry => ["pf", "pj"].includes(normalizedCashAccount(entry.cashAccount, "")))
      : entries;
    const businessEntries = businessCashEntries(entries);
    const adjustmentEntries = entries.filter(isAccountAdjustmentEntry);
    const income = businessEntries
      .filter(entry => entry.type !== "expense")
      .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
    const expenses = businessEntries
      .filter(entry => entry.type === "expense")
      .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
    const adjustments = cashTotals(adjustmentEntries).balance;
    const actualBalance = key === "savings"
      ? Number(data.savingsBalance || 0)
      : cashTotals(actualEntries).balance;
    return [
      label,
      money(income),
      money(expenses),
      money(adjustments),
      money(actualBalance),
      actualEntries.length
    ];
  }).filter(([label, , , , balance, count]) => {
    return count > 0 || (label === "Conta Cofrinho" && Math.abs(parseMoneyInput(balance)) > 0.005);
  });
}

function reportAccountPackageSummaryNumericRows(data) {
  return reportAccountPackageSummaryRows(data).map(([label, income, expenses, adjustments, balance, count]) => [
    label,
    parseMoneyInput(income),
    parseMoneyInput(expenses),
    parseMoneyInput(adjustments),
    parseMoneyInput(balance),
    count
  ]);
}

function accountTransferRows() {
  return normalizeAccountTransfers(state.financialPlanning?.accountTransfers);
}

function accountTransferId() {
  return `account-transfer-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function accountTransferOptionsHtml(selected = "") {
  const normalized = normalizedAccountTransferAccount(selected, "");
  return ["pf", "pj", "savings"].map(account => `
    <option value="${account}" ${normalized === account ? "selected" : ""}>${accountTransferAccountLabel(account)}</option>
  `).join("");
}

function savingsHistoryBalanceValidation(rows = []) {
  const normalized = rows
    .filter(Boolean)
    .map((entry, index) => ({ ...entry, __index: index }))
    .sort((left, right) => {
      const dateCompare = String(left.date || "").localeCompare(String(right.date || ""));
      const dayOrderCompare = Number(left.dayOrder || 0) - Number(right.dayOrder || 0);
      return dateCompare || dayOrderCompare || (right.__index - left.__index);
  });
  let balance = 0;
  let firstNegative = null;
  for (const entry of normalized) {
    const amount = Math.max(0, Number(entry.amount || 0));
    if (entry.type === "set") {
      balance = amount;
    } else if (entry.type === "withdrawal") {
      balance = roundedMoneyValue(balance - amount);
    } else {
      balance = roundedMoneyValue(balance + amount);
    }
    if (balance < -0.009 && !firstNegative) {
      firstNegative = entry;
    }
  }
  return {
    valid: balance >= -0.009,
    balance: roundedMoneyValue(balance),
    date: String(firstNegative?.date || ""),
    entry: firstNegative
  };
}

function savingsBalanceUntilDate(dateKey = isoDate(new Date())) {
  const end = String(dateKey || "").slice(0, 10);
  const allRows = savingsHistoryRows();
  if (!allRows.length) return savingsBalance();
  const rows = allRows.filter(entry => !end || String(entry.date || "") <= end);
  if (!rows.length) return Number(state.financialPlanning?.openingSavings || 0);
  return savingsHistoryBalanceValidation(rows).balance;
}

function consolidatedBalanceUntilDate(dateKey = isoDate(new Date())) {
  return roundedMoneyValue(accountBalanceUntilDate(dateKey) + savingsBalanceUntilDate(dateKey));
}

function accountTransfersForCashEntries(entries = []) {
  const ids = new Set(entries
    .filter(isAccountTransferCashEntry)
    .map(entry => String(entry.accountTransferId || entry.transferId || ""))
    .filter(Boolean));
  return accountTransferRows().filter(transfer => ids.has(String(transfer.id)));
}

function accountTransferReportRows(transfers = [], numeric = false) {
  return transfers.map(transfer => [
    transfer.date || "",
    accountTransferAccountLabel(transfer.origin),
    accountTransferAccountLabel(transfer.destination),
    numeric ? Number(transfer.amount || 0) : money(transfer.amount),
    transfer.reversalOf ? "Estorno" : "Transferência interna",
    transfer.description || ""
  ]);
}

function internalTransfersReportPanel(data) {
  const transfers = data.accountTransfers || [];
  const transferTotal = transfers.reduce((sum, transfer) => sum + Number(transfer.amount || 0), 0);
  return `
    <section class="panel report-section internal-transfers-report" data-internal-transfers-report>
      <div class="section-heading">
        <div>
          <h2>Transferências internas e aportes</h2>
          <p class="muted-inline">Movimentos informativos, excluídos de faturamento, receita operacional, despesas e lucro.</p>
        </div>
        <a class="secondary" href="/fluxo-de-caixa?panel=transfers">Transferir entre contas</a>
      </div>
      <div class="summary">
        <div class="metric"><span>Transferências internas</span><strong>${money(transferTotal)}</strong><small>${transfers.length} operação(ões)</small></div>
        <div class="metric"><span>Aportes de sócias</span><strong>${money(data.capitalContributionTotal)}</strong><small>Entrada de caixa não operacional</small></div>
        <div class="metric total"><span>Saldo consolidado</span><strong>${money(data.consolidatedBalance)}</strong><small>PF + PJ + Cofrinho</small></div>
      </div>
      ${transfers.length ? `
        <div class="table-wrap report-table">
          <table>
            <thead><tr><th>Data</th><th>Origem</th><th>Destino</th><th>Valor</th><th>Tipo</th><th>Observação</th></tr></thead>
            <tbody>${accountTransferReportRows(transfers).map(row => `<tr>${row.map(value => `<td>${escapeHtml(value)}</td>`).join("")}</tr>`).join("")}</tbody>
          </table>
        </div>
      ` : `<p class="muted">Nenhuma transferência interna no período.</p>`}
    </section>
  `;
}

function prospectiveSavingsHistoryForTransfer(transfer, replacedTransferId = "") {
  const previousId = String(replacedTransferId || "");
  let remaining = savingsHistoryRows().filter(
    entry => !previousId || String(entry.accountTransferId || entry.transferId || "") !== previousId
  );
  const savingsEntry = accountTransferSavingsEntry(transfer);
  if (savingsEntry && !remaining.length && savingsBalance() > 0) {
    remaining = [{
      id: "savings-opening-preserved-for-transfers",
      date: transfer.date || isoDate(new Date()),
      type: "set",
      amount: savingsBalance().toFixed(2),
      balance: savingsBalance().toFixed(2),
      description: "Saldo anterior preservado ao iniciar transferências"
    }];
  }
  return savingsEntry ? [savingsEntry, ...remaining] : remaining;
}

function applyAccountTransferToState(transfer, replacedTransferId = "") {
  const normalized = normalizedAccountTransfer(transfer);
  const previousId = String(replacedTransferId || "");
  const prospectiveSavings = prospectiveSavingsHistoryForTransfer(normalized, previousId);
  state.cash = state.cash.filter(
    entry => !previousId || String(entry.accountTransferId || entry.transferId || "") !== previousId
  );
  state.cash.push(...accountTransferCashEntries(normalized));
  applySavingsHistory(prospectiveSavings);
  const previousRows = accountTransferRows();
  const nextRows = previousId
    ? previousRows.map(row => String(row.id) === previousId ? normalized : row)
    : [normalized, ...previousRows];
  state.financialPlanning = {
    ...(state.financialPlanning || {}),
    accountTransfers: normalizeAccountTransfers(nextRows)
  };
  return { ok: true, transfer: normalized };
}

function accountTransferPanelHtml(today = isoDate(new Date())) {
  const transfers = accountTransferRows();
  const editing = state.editAccountTransferId
    ? transfers.find(transfer => String(transfer.id) === String(state.editAccountTransferId))
    : null;
  const draft = editing || state.accountTransferDraft || { origin: "pj", destination: "pf" };
  const origin = normalizedAccountTransferAccount(draft.origin, "pj");
  let destination = normalizedAccountTransferAccount(draft.destination, origin === "pj" ? "pf" : "pj");
  if (destination === origin) destination = origin === "pj" ? "pf" : "pj";
  const rows = [...transfers].sort((left, right) => (
    String(right.date || "").localeCompare(String(left.date || "")) ||
    String(right.createdAt || "").localeCompare(String(left.createdAt || ""))
  ));
  return `
    <div class="cash-tab-section account-transfer-panel" data-account-transfer-panel>
      <div class="section-heading account-transfer-heading">
        <div>
          <span class="executive-eyebrow">Movimentação interna</span>
          <h2>${editing ? "Editar transferência" : "Transferência entre contas"}</h2>
          <p class="muted-inline">Move dinheiro entre PF, PJ e Cofrinho sem criar receita, despesa ou lucro.</p>
        </div>
      </div>
      <div class="summary account-transfer-balances">
        <div class="metric"><span>Conta PF</span><strong>${money(accountBalanceUntilDate(today, [], "pf"))}</strong></div>
        <div class="metric"><span>Conta PJ</span><strong>${money(accountBalanceUntilDate(today, [], "pj"))}</strong></div>
        <div class="metric"><span>Conta Cofrinho</span><strong>${money(savingsBalance())}</strong></div>
        <div class="metric"><span>Caixa PF + PJ</span><strong>${money(accountBalanceUntilDate(today))}</strong></div>
        <div class="metric total"><span>Saldo consolidado</span><strong>${money(accountBalanceUntilDate(today) + savingsBalance())}</strong><small>PF + PJ + Cofrinho</small></div>
      </div>
      <form id="account-transfer-form" class="form-grid account-transfer-form">
        <input name="transferId" type="hidden" value="${escapeHtml(editing?.id || "")}">
        <label>Data
          <input name="date" type="date" value="${escapeHtml(editing?.date || today)}" required>
        </label>
        <label>Conta de origem
          <select name="origin" required>${accountTransferOptionsHtml(origin)}</select>
        </label>
        <div class="account-transfer-arrow" aria-hidden="true">→</div>
        <label>Conta de destino
          <select name="destination" required>${accountTransferOptionsHtml(destination)}</select>
        </label>
        <label>Valor
          <input name="amount" type="text" inputmode="decimal" placeholder="0,00" value="${moneyInputValue(editing?.amount)}" required>
        </label>
        <label class="wide">Descrição ou observação
          <input name="description" placeholder="Ex.: transferência para despesas da Conta PJ" value="${escapeHtml(editing?.description || "")}">
        </label>
        <p class="muted-inline wide account-transfer-explanation">A origem diminui e o destino aumenta pelo mesmo valor. Transferências internas ficam fora da DRE e do lucro operacional.</p>
        <div class="actions wide">
          <button type="submit" ${canUser("editFinancial") ? "" : "disabled"}>${editing ? "Salvar transferência" : "Transferir"}</button>
          ${editing ? `<button class="secondary" type="button" id="cancel-account-transfer-edit">Cancelar</button>` : ""}
        </div>
      </form>
      <section class="account-transfer-history">
        <div class="section-heading">
          <div>
            <h3>Histórico de transferências</h3>
            <p class="muted-inline">Cada registro mantém os dois lados vinculados. Estornos preservam o histórico original.</p>
          </div>
        </div>
        ${rows.length ? `
          <div class="table-wrap report-table">
            <table>
              <thead><tr><th>Data</th><th>Movimento</th><th>Valor</th><th>Observação</th><th>Status</th><th>Ações</th></tr></thead>
              <tbody>
                ${rows.map(transfer => {
                  const reversal = rows.find(row => String(row.reversalOf || "") === String(transfer.id));
                  const reversed = Boolean(transfer.reversedBy || reversal);
                  return `
                  <tr class="${transfer.reversalOf ? "account-transfer-reversal" : ""}">
                    <td>${formatIsoDateBr(transfer.date)}</td>
                    <td><strong>${accountTransferAccountLabel(transfer.origin)} → ${accountTransferAccountLabel(transfer.destination)}</strong></td>
                    <td><strong>${money(transfer.amount)}</strong></td>
                    <td>${escapeHtml(transfer.description || "—")}</td>
                    <td>${transfer.reversalOf
                      ? `<span class="status-pill">Estorno</span>`
                      : reversed
                        ? `<span class="status-pill">Estornada</span>`
                        : `<span class="status-pill status-ready">Concluída</span>`}</td>
                    <td>
                      <div class="table-actions">
                        ${canUser("editFinancial") && !transfer.reversalOf && !reversed ? `
                          <button class="secondary table-action" type="button" data-edit-account-transfer="${escapeHtml(transfer.id)}">Editar data</button>
                          <button class="secondary table-action" type="button" data-reverse-account-transfer="${escapeHtml(transfer.id)}">Estornar</button>
                        ` : `<small>Histórico preservado</small>`}
                      </div>
                    </td>
                  </tr>
                `; }).join("")}
              </tbody>
            </table>
          </div>
        ` : `<p class="muted">Nenhuma transferência registrada.</p>`}
      </section>
    </div>
  `;
}

function reportAccountPackageCashRows(data, cashAccount = "all", numeric = false) {
  return reportAccountPackageEntries(data, cashAccount)
    .sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")))
    .map(entry => [
      entry.date || "",
      entry.description || "",
      entry.type === "expense" ? "Saída" : "Entrada",
      cashAccountLabel(entry.cashAccount, entry.type),
      categoryName(entry.category),
      numeric ? Number(entry.amount || 0) : money(entry.amount)
    ]);
}

function reportAccountReconciliationRows(data, numeric = false) {
  const bounds = reportPeriodBounds(data);
  return (state.financialPlanning?.reconciliationHistory || [])
    .filter(item => String(item.date || "") >= bounds.start && String(item.date || "") <= bounds.end)
    .sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")))
    .map(item => [
      item.date || "",
      reconciliationAccountLabel(item.cashAccount || "all"),
      numeric ? Number(item.calculatedBalance || 0) : money(item.calculatedBalance),
      numeric ? Number(item.realBalance || 0) : money(item.realBalance),
      numeric ? Number(item.difference || 0) : money(item.difference),
      item.authorizedBy || "Sistema",
      item.reason || ""
    ]);
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

function clientHistoryPanel(phone) {
  const client = clientByPhone(phone);
  const orders = state.orders
    .filter(order => order.clientPhone === phone)
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  const mealOrders = productionOrders(orders);
  const renewals = orders.filter(isMonthlyRenewalRecord);
  const totalQuantity = mealOrders.reduce((sum, order) => sum + orderQuantity(order), 0);
  const pending = mealOrders.filter(order => client.plan === "semanal" && !isOrderPaid(order));
  return `
    <section class="panel report-section client-history-panel">
      <div class="section-heading">
        <div>
          <h2>Histórico de ${escapeHtml(client.name || phone)}</h2>
          <p class="muted-inline">${mealOrders.length} pedido(s), ${totalQuantity} cumbuca(s), ${renewals.length} renovação(ões), ${pending.length} pagamento(s) pendente(s).</p>
        </div>
        <button class="secondary" type="button" id="close-client-history">Fechar</button>
      </div>
      ${orders.length ? `
        <div class="table-wrap report-table">
          <table>
            <thead><tr><th>Semana</th><th>Registro</th><th>Quantidade</th><th>Valor</th><th>Pagamento</th><th>Entrega</th><th>Obs.</th></tr></thead>
            <tbody>
              ${orders.slice(0, 20).map(order => `
                <tr>
                  <td>${order.menuKey || ""}</td>
                  <td>${isMonthlyRenewalRecord(order) ? "Renovação" : "Pedido"}</td>
                  <td>${isMonthlyRenewalRecord(order) ? `+${Number(order.renewalQuantity || 0)}` : orderQuantity(order)}</td>
                  <td>${Number(order.amount || 0) > 0 ? money(order.amount) : ""}</td>
                  <td>${paymentText(order, client)}</td>
                  <td>${isMonthlyRenewalRecord(order) ? "Sem entrega" : order.delivered ? "Entregue" : "Pendente"}</td>
                  <td>${escapeHtml(order.notes || "")}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      ` : `<p class="muted">Nenhum pedido registrado para este cliente.</p>`}
    </section>
  `;
}

function channelPeriodSummary(entries = []) {
  const totals = channelReceiptTotals(entries);
  const activeDays = new Set(entries.map(entry => entry.date).filter(Boolean)).size || 1;
  return {
    entries,
    totals,
    activeDays,
    averageNet: totals.total / activeDays
  };
}

function channelPaymentTotals(entries = []) {
  return cardapioPaymentDefinitions.reduce((totals, [paymentKey]) => {
    totals[paymentKey] = entries.reduce((sum, entry) => sum + cardapioPaymentAmount(entry, paymentKey), 0);
    return totals;
  }, {});
}

function previousChannelEntries(data) {
  if (data.type === "week") {
    const { start: startKey, end: endKey } = previousComparablePeriod(data);
    return state.channelReceipts.filter(entry => {
      const date = String(entry.date || "");
      return date >= startKey && date <= endKey;
    });
  }

  const previousKey = previousMonthKeyFromPeriod(data.periodKey);
  return state.channelReceipts.filter(entry => String(entry.date || "").startsWith(previousKey));
}

function previousComparablePeriod(data) {
  if (data.type === "week") {
    const { start, end } = reportPeriodBounds(data);
    const startDate = new Date(`${start}T00:00:00`);
    const endDate = new Date(`${end}T00:00:00`);
    const days = Math.max(1, Math.round((endDate - startDate) / 86400000) + 1);
    startDate.setDate(startDate.getDate() - days);
    endDate.setDate(endDate.getDate() - days);
    return {
      start: isoDate(startDate),
      end: isoDate(endDate),
      label: `${formatIsoDateBr(isoDate(startDate))} a ${formatIsoDateBr(isoDate(endDate))}`
    };
  }

  const previousKey = previousMonthKeyFromPeriod(data.periodKey);
  return {
    start: `${previousKey}-01`,
    end: isoDate(new Date(Number(previousKey.slice(0, 4)), Number(previousKey.slice(5, 7)), 0)),
    label: formatMonthKeyBr(previousKey),
    periodKey: previousKey
  };
}

function entriesBetweenDates(entries, dateFor, start, end) {
  return entries.filter(entry => {
    const date = dateFor(entry);
    return date >= start && date <= end;
  });
}

function previousReportCashEntries(data) {
  const previous = previousComparablePeriod(data);
  return accountingCashEntries(state.cash).filter(entry => {
    const date = cashAccountingDate(entry);
    return date >= previous.start && date <= previous.end;
  });
}

function previousReportOrders(data) {
  if (data.type === "week") {
    const week = Number(data.selectedWeek || 1);
    const previousMenuKey = week > 1
      ? `${data.periodKey}-semana-${week - 1}`
      : `${previousMonthKeyFromPeriod(data.periodKey)}-semana-5`;
    return state.orders.filter(order => order.menuKey === previousMenuKey);
  }

  const previousKey = previousMonthKeyFromPeriod(data.periodKey);
  return state.orders.filter(order => menuPeriodKeyFromKey(order.menuKey) === previousKey);
}

function previousReportStoreSales(data) {
  if (data.type === "week") {
    const previous = previousComparablePeriod(data);
    return entriesBetweenDates(state.storeSales, entry => String(entry.date || ""), previous.start, previous.end);
  }

  const previousKey = previousMonthKeyFromPeriod(data.periodKey);
  return state.storeSales.filter(entry => String(entry.date || "").startsWith(previousKey));
}

function channelReportPanel(data) {
  const current = channelPeriodSummary(data.channelReceipts);
  const previous = channelPeriodSummary(previousChannelEntries(data));
  const delta = current.totals.total - previous.totals.total;
  const paymentTotals = channelPaymentTotals(data.channelReceipts);
  const deliveryFeeTotal = cardapioDeliveryFeeTotal(data.channelReceipts);
  const dailyRows = [...data.channelReceipts]
    .sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")))
    .map(entry => [
      formatIsoDateBr(entry.date),
      ...cardapioPaymentDefinitions.map(([paymentKey]) => money(cardapioPaymentAmount(entry, paymentKey))),
      money(cardapioDeliveryFeeAmount(entry)),
      money(channelReceiptAmount(entry, "ifood", "net")),
      money(channelReceiptAmount(entry, "food99", "net")),
      money(channelReceiptTotal(entry))
    ]);

  return `
    <section class="panel report-section">
      <h2>Relatório de canais ${reportTitleSuffix(data)}</h2>
      <div class="summary">
        <div class="metric"><span>Total informado</span><strong>${money(current.totals.total)}</strong></div>
        <div class="metric"><span>Dias lançados</span><strong>${data.channelReceipts.length}</strong></div>
        <div class="metric"><span>Média diária</span><strong>${money(current.averageNet)}</strong></div>
        <div class="metric"><span>Comparação anterior</span><strong class="${delta < 0 ? "negative" : "positive"}">${delta < 0 ? "-" : "+"}${money(Math.abs(delta))}</strong></div>
      </div>
      <div class="dashboard-lane monthly-breakdown">
        <div class="panel dashboard-panel">
          <h2>Cardápio Web</h2>
          <div class="summary">
            ${cardapioPaymentDefinitions.map(([paymentKey, label]) => `
              <div class="metric"><span>${label}</span><strong>${money(paymentTotals[paymentKey])}</strong></div>
            `).join("")}
            <div class="metric"><span>Taxas de entrega (conferência)</span><strong>${money(deliveryFeeTotal)}</strong></div>
          </div>
        </div>
        ${channelDefinitions.filter(([key]) => key !== "cardapioWeb").map(([key, label]) => `
          <div class="panel dashboard-panel">
            <h2>${label}</h2>
            <div class="summary">
              <div class="metric"><span>Valor diário</span><strong>${money(current.totals[`${key}Net`])}</strong></div>
            </div>
          </div>
        `).join("")}
      </div>
      ${dailyRows.length ? `
        <div class="table-wrap">
          <table>
            <thead><tr><th>Dia</th>${cardapioPaymentDefinitions.map(([, label]) => `<th>${label}</th>`).join("")}<th>Taxas de entrega</th><th>iFood</th><th>99 Food</th><th>Total</th></tr></thead>
            <tbody>${dailyRows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join("")}</tr>`).join("")}</tbody>
          </table>
        </div>
      ` : `<p class="muted">Nenhum valor de canal lançado no período.</p>`}
    </section>
  `;
}

function monthlyOriginCategoryPanel(data) {
  const incomeRows = moneyRowsByCategory(data.incomeEntries, "income");
  const expenseRows = moneyRowsByCategory(data.expenseEntries, "expense");
  const channelRows = channelDefinitions
    .map(([key, label]) => [
      label,
      data.channelReceipts.reduce((sum, entry) => sum + channelReceiptAmount(entry, key, "net"), 0)
    ])
    .filter(([, value]) => value > 0);
  const topExpenses = [...data.expenseEntries]
    .sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0))
    .slice(0, 5)
    .map(entry => [entry.description || categoryName(entry.category), Number(entry.amount || 0)]);
  const previous = previousComparablePeriod(data);
  const previousCash = businessCashEntries(previousReportCashEntries(data));
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
        <h2>Canais de venda</h2>
        ${compactMoneyList(channelRows, "Nenhum valor de canal lançado no período.")}
      </div>
    </section>
    <section class="dashboard-lane monthly-breakdown">
      <div class="panel dashboard-panel">
        <h2>Saídas por categoria</h2>
        ${compactMoneyList(expenseRows, "Nenhuma saída no período.")}
      </div>
      <div class="panel dashboard-panel">
        <h2>Maiores despesas</h2>
        ${compactMoneyList(topExpenses, "Nenhuma despesa no período.")}
      </div>
    </section>
    <section class="dashboard-lane monthly-breakdown">
      <div class="panel dashboard-panel">
        <h2>Comparação com ${previous.label}</h2>
        <div class="summary comparison-summary">
          <div class="metric"><span>Entradas</span><strong class="comparison-value ${incomeDelta < 0 ? "negative" : "positive"}"><i>${incomeDelta < 0 ? "-" : "+"}</i>${money(Math.abs(incomeDelta))}</strong></div>
          <div class="metric"><span>Saídas</span><strong class="comparison-value ${expenseDelta > 0 ? "negative" : "positive"}"><i>${expenseDelta < 0 ? "-" : "+"}</i>${money(Math.abs(expenseDelta))}</strong></div>
          <div class="metric"><span>Saldo</span><strong class="comparison-value ${balanceDelta < 0 ? "negative" : "positive"}"><i>${balanceDelta < 0 ? "-" : "+"}</i>${money(Math.abs(balanceDelta))}</strong></div>
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
      descrição: entry.description || "",
      tipo: entry.type === "expense" ? "saída" : "entrada",
      conta: cashAccountLabel(entry.cashAccount, entry.type),
      categoria: categoryName(entry.category),
      valor: Number(entry.amount || 0)
    }));
  }

  if (kind === "financial") {
    const withdrawalAmounts = withdrawalBreakdownAmounts(data.financial.withdrawals, data.partnerWithdrawalControl);
    const rows = [
      { seção: "resumo", data: "", descrição: "Entradas operacionais no caixa", tipo: "entrada", categoria: "", valor: data.financial.income },
      { seção: "resumo", data: "", descrição: "Saídas operacionais", tipo: "saída", categoria: "operacional", valor: data.financial.operationalExpenses },
      { seção: "resumo", data: "", descrição: "Lucro operacional", tipo: "saldo", categoria: "", valor: operationalProfitForReport(data) },
      { seção: "resumo", data: "", descrição: "Vanessa - recebeu da conta", tipo: "retirada", categoria: "retirada", valor: data.vanessaFinancial.received },
      { seção: "resumo", data: "", descrição: "Cofrinho transferido", tipo: "saída", categoria: "retirada", valor: withdrawalAmounts.savings },
      { seção: "resumo", data: "", descrição: "Raquel - distribuição total", tipo: "distribuição", categoria: "retirada", valor: withdrawalAmounts.raquel },
      { seção: "resumo", data: "", descrição: "Dinheiro que saiu da conta", tipo: "saída", categoria: "retirada", valor: cashWithdrawalsForReport(data) },
      { seção: "resumo", data: "", descrição: "Compensação de dívida sem saída de caixa", tipo: "compensação", categoria: "retirada", valor: debtCompensationForReport(data) },
      { seção: "resumo", data: "", descrição: "Resultado após retiradas", tipo: "saldo", categoria: "", valor: operationalResultForReport(data) },
      { seção: "ajustes da conta", data: "", descrição: "Entradas de ajuste", tipo: "entrada", categoria: "ajuste da conta", valor: data.accountAdjustmentTotals.income },
      { seção: "ajustes da conta", data: "", descrição: "Saídas de ajuste", tipo: "saída", categoria: "ajuste da conta", valor: data.accountAdjustmentTotals.expenses },
      { seção: "ajustes da conta", data: "", descrição: "Saldo dos ajustes", tipo: "saldo", categoria: "ajuste da conta", valor: data.accountAdjustmentTotals.balance },
      { seção: "ajustes da conta", data: "", descrição: "Saldo da conta no período", tipo: "saldo", categoria: "conta", valor: data.accountBalance },
      { seção: "resumo", data: data.savingsUpdatedAt || "", descrição: "Valor atual do cofrinho", tipo: "saldo", categoria: "cofrinho", valor: data.savingsBalance },
      { seção: "resumo", data: "", descrição: "Valor que deveria ter no cofrinho", tipo: "controle", categoria: "cofrinho", valor: data.savingsExpectedBalance },
      { seção: "resumo", data: "", descrição: "Saldo consolidado PF + PJ + Cofrinho", tipo: "saldo", categoria: "consolidado", valor: data.consolidatedBalance },
      { seção: "aportes", data: "", descrição: "Aportes de sócias", tipo: "entrada não operacional", categoria: "aporte de sócia", valor: data.capitalContributionTotal },
      { seção: "produção", data: "", descrição: "Cumbucas vendidas na loja", tipo: "quantidade", categoria: "loja", valor: data.storeQuantity },
      { seção: "produção", data: "", descrição: "Total de cumbucas vendidas", tipo: "quantidade", categoria: "total", valor: data.totalSoldQuantity },
      { seção: "retiradas", data: "", descrição: "Lucro operacional", tipo: "controle", categoria: "retirada", valor: operationalProfitForReport(data) },
      { seção: "retiradas", data: "", descrição: "Total que saiu da conta", tipo: "saída", categoria: "retirada", valor: data.partnerWithdrawalControl?.paidNowTotal || 0 },
      { seção: "retiradas", data: "", descrição: `Cofrinho - direito de ${Number(state.appConfig.splitSavingsPercent || 0)}%`, tipo: "controle", categoria: "retirada", valor: data.partnerWithdrawalControl?.expectedSavings || 0 },
      { seção: "retiradas", data: "", descrição: "Cofrinho - transferido agora", tipo: "saída", categoria: "retirada", valor: data.financial.withdrawals.savings },
      { seção: "retiradas", data: "", descrição: "Vanessa - recebeu agora", tipo: "saída", categoria: "retirada", valor: data.vanessaFinancial.received },
      { seção: "sócias", data: "", descrição: "Vanessa - pagou", tipo: "pagamento", categoria: "conta de sócia", valor: data.vanessaFinancial.paid },
      { seção: "sócias", data: "", descrição: "Vanessa - deve", tipo: "saldo", categoria: "conta de sócia", valor: data.vanessaFinancial.debt },
      { seção: "retiradas", data: "", descrição: "Vanessa - direito reconhecido (recebido + compensado)", tipo: "controle", categoria: "retirada", valor: withdrawalAmounts.vanessa },
      { seção: "retiradas", data: "", descrição: "Raquel - recebeu agora", tipo: "saída", categoria: "retirada", valor: data.financial.withdrawals.raquel },
      { seção: "retiradas", data: "", descrição: "Raquel - distribuição total", tipo: "controle", categoria: "retirada", valor: withdrawalAmounts.raquel },
      { seção: "retiradas", data: "", descrição: "Vanessa - direito na divisão", tipo: "controle", categoria: "retirada", valor: data.partnerWithdrawalControl?.expectedVanessa || 0 },
      { seção: "retiradas", data: "", descrição: "Vanessa - dívida informada", tipo: "controle", categoria: "retirada", valor: data.vanessaFinancial.debt },
      { seção: "retiradas", data: "", descrição: "Vanessa - dívida compensada", tipo: "controle", categoria: "retirada", valor: data.partnerWithdrawalControl?.paidToCashVanessa || 0 },
      { seção: "retiradas", data: "", descrição: "Vanessa - dívida restante", tipo: "controle", categoria: "retirada", valor: data.partnerWithdrawalControl?.remainingDebtVanessa || 0 },
      { seção: "retiradas", data: "", descrição: "Vanessa - ainda não retirou", tipo: "controle", categoria: "retirada", valor: data.partnerWithdrawalControl?.pendingVanessa || 0 },
      { seção: "retiradas", data: "", descrição: "Raquel - direito na divisão", tipo: "controle", categoria: "retirada", valor: data.partnerWithdrawalControl?.expectedRaquel || 0 },
      { seção: "retiradas", data: "", descrição: "Raquel - dívida informada", tipo: "controle", categoria: "retirada", valor: data.partnerWithdrawalControl?.priorRaquel || 0 },
      { seção: "retiradas", data: "", descrição: "Raquel - dívida compensada", tipo: "controle", categoria: "retirada", valor: data.partnerWithdrawalControl?.paidToCashRaquel || 0 },
      { seção: "retiradas", data: "", descrição: "Raquel - dívida restante", tipo: "controle", categoria: "retirada", valor: data.partnerWithdrawalControl?.remainingDebtRaquel || 0 },
      { seção: "retiradas", data: "", descrição: "Raquel - ainda não retirou", tipo: "controle", categoria: "retirada", valor: data.partnerWithdrawalControl?.pendingRaquel || 0 },
      { seção: "retiradas", data: data.partnersRecord?.periodKey || "", descrição: "Vanessa informada", tipo: "controle", categoria: "retirada", valor: data.partnersRecord?.vanessa || 0 },
      { seção: "retiradas", data: data.partnersRecord?.periodKey || "", descrição: "Raquel informada", tipo: "controle", categoria: "retirada", valor: data.partnersRecord?.raquel || 0 },
      { seção: "retiradas", data: data.partnersRecord?.periodKey || "", descrição: "Compensação manual antiga", tipo: "controle", categoria: "retirada", valor: data.partnersRecord?.difference || 0 }
    ];

    const transferRows = (data.accountTransfers || []).map(transfer => ({
      seção: "transferências internas",
      data: transfer.date || "",
      descrição: `${accountTransferAccountLabel(transfer.origin)} → ${accountTransferAccountLabel(transfer.destination)}${transfer.description ? ` - ${transfer.description}` : ""}`,
      tipo: transfer.reversalOf ? "estorno" : "transferência interna",
      conta: "Consolidado",
      categoria: "Transferência entre contas",
      valor: Number(transfer.amount || 0)
    }));

    return rows.concat(transferRows, data.cashEntries.map(entry => ({
      seção: isAccountTransferCashEntry(entry) ? "ponta vinculada de transferência" : isAccountAdjustmentEntry(entry) ? "lançamento ajuste da conta" : isWithdrawalEntry(entry) ? "lançamento retirada" : "lançamento caixa",
      data: entry.date || "",
      descrição: entry.description || "",
      tipo: entry.type === "expense" ? "saída" : "entrada",
      conta: cashAccountLabel(entry.cashAccount, entry.type),
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
        observação: order.notes || ""
      };
    });
  }

  if (kind === "channels") {
    return data.channelReceipts.map(entry => {
      const row = {
        data: entry.date || "",
        observação: entry.notes || "",
        total: channelReceiptTotal(entry)
      };
      channelDefinitions.forEach(([key, label]) => {
        row[`${label} bruto`] = channelReceiptAmount(entry, key, "gross");
        row[`${label} taxa`] = channelReceiptAmount(entry, key, "fee");
        row[`${label} líquido`] = channelReceiptAmount(entry, key, "net");
      });
      return {
        data: entry.date || "",
        observacao: entry.notes || "",
        cardapio_debito: cardapioPaymentAmount(entry, "debit"),
        cardapio_credito: cardapioPaymentAmount(entry, "credit"),
        cardapio_credito_online: cardapioPaymentAmount(entry, "onlineCredit"),
        cardapio_pix: cardapioPaymentAmount(entry, "pix"),
        cardapio_dinheiro: cardapioPaymentAmount(entry, "cash"),
        cardapio_taxas_entrega: cardapioDeliveryFeeAmount(entry),
        ifood: channelReceiptAmount(entry, "ifood", "net"),
        food99: channelReceiptAmount(entry, "food99", "net"),
        total: channelReceiptTotal(entry)
      };
    });
  }

  if (kind === "clients") {
    return state.clients.map(client => ({
      nome: client.name || "",
      contato: client.phone || "",
      plano: client.plan === "mensalista" ? "mensalista" : "semanal",
      endereço: [client.address, client.complement].filter(Boolean).join(" - "),
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

function reportFinancialPayloadMetrics(data) {
  const productionEntries = data.expenseEntries.filter(foodInputExpenseCategory);
  const totalForCategory = category => productionEntries
    .filter(entry => slugifyCategory(categoryName(entry.category)) === category)
    .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const supermarketTotal = totalForCategory("supermercado");
  const butcherTotal = totalForCategory("frigorifico");
  const billsTotal = totalForCategory("boleto");
  const productionPurchases = supermarketTotal + butcherTotal + billsTotal;
  const salesRevenue = data.incomeEntries
    .filter(salesIncomeEntry)
    .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const purchasesPerBowl = data.totalSoldQuantity > 0
    ? productionPurchases / data.totalSoldQuantity
    : 0;
  const purchasesSalesPercent = salesRevenue > 0
    ? (productionPurchases / salesRevenue) * 100
    : 0;
  return {
    profitBeforeWithdrawals: operationalProfitForReport(data),
    availableForWithdrawal: operationalResultForReport(data),
    withdrawalTotal: cashWithdrawalsForReport(data),
    withdrawalGrossTotal: profitDistributionForReport(data),
    withdrawalDebtCompensation: debtCompensationForReport(data),
    salesRevenue,
    productionPurchases,
    productionPurchasesBills: billsTotal,
    productionPurchasesSupermarket: supermarketTotal,
    productionPurchasesButcher: butcherTotal,
    purchasesPerBowl,
    purchasesSalesPercent
  };
}

function reportPeriodLabel(data) {
  if (data.type === "day") {
    return formatIsoDateBr(data.date);
  }
  if (data.type === "week") {
    return reportWeekRangeLabel();
  }
  return formatMonthKeyBr(data.periodKey);
}

function reportPeriodStatusLabel(data) {
  if (data.type === "day") return `Dia ${formatIsoDateBr(data.date)}`;
  if (data.type === "week") return `Semana selecionada: ${reportWeekRangeLabel()}`;
  const today = isoDate(new Date());
  return data.periodKey === today.slice(0, 7)
    ? `Parcial até ${formatIsoDateBr(today)}`
    : "Mês concluído";
}

async function downloadReportPdf(options = {}) {
  const data = reportData();
  const accountantPackage = Boolean(options.accountantPackage);
  const withdrawalAmounts = withdrawalBreakdownAmounts(data.financial.withdrawals, data.partnerWithdrawalControl);
  const periodLabel = reportPeriodLabel(data);
  const filename = accountantPackage
    ? `cumbuca-pacote-contador-${data.type === "week" ? data.weekKey : data.type === "day" ? data.date : data.periodKey}.pdf`
    : data.type === "week"
      ? `cumbuca-relatorio-${data.weekKey}.pdf`
      : `cumbuca-relatorio-${data.periodKey}.pdf`;
  const payload = {
    filename,
    periodLabel: accountantPackage ? `${periodLabel} - Pacote contador por conta` : periodLabel,
    statusLabel: reportPeriodStatusLabel(data),
    data: {
      periodType: data.type,
      periodStart: reportPeriodBounds(data).start,
      periodEnd: reportPeriodBounds(data).end,
      periodKey: data.periodKey,
      balance: data.balance,
      totalIncome: data.totalIncome,
      expenses: data.expenses,
      operationalExpenses: data.financial.operationalExpenses,
      ...reportFinancialPayloadMetrics(data),
      accountAdjustmentIncome: data.accountAdjustmentTotals.income,
      accountAdjustmentExpenses: data.accountAdjustmentTotals.expenses,
      accountAdjustmentBalance: data.accountAdjustmentTotals.balance,
      accountBalance: data.accountBalance,
      savingsBalance: data.savingsBalance,
      savingsExpectedBalance: data.savingsExpectedBalance,
      consolidatedBalance: data.consolidatedBalance,
      capitalContributionTotal: data.capitalContributionTotal,
      transferRows: accountTransferReportRows(data.accountTransfers),
      capitalContributionRows: data.capitalContributionEntries.map(entry => [
        entry.date || "",
        entry.description || "Aporte de sócia",
        cashAccountLabel(entry.cashAccount),
        money(entry.amount)
      ]),
      savingsUpdatedAt: data.savingsUpdatedAt,
      withdrawalVanessa: data.vanessaFinancial.received,
      withdrawalSavings: withdrawalAmounts.savings,
      withdrawalRaquel: withdrawalAmounts.raquel,
      withdrawalRows: reportPdfWithdrawalRows(data),
      accountIncome: data.income,
      weeklyRevenue: data.orderRevenue,
      incomeSummaryRows: [
        ...accountIncomeBreakdown(data).map(([label, value]) => ["Receita contabilizada", label, value])
      ],
      incomeChannelRows: reportPdfIncomeChannelRows(data),
      expenseCategoryRows: reportPdfExpenseCategoryRows(data),
      negativeDifferenceRows: reportPdfNegativeDifferenceRows(data),
      accountPackageSummaryRows: reportAccountPackageSummaryRows(data),
      accountPackageReconciliationRows: reportAccountReconciliationRows(data),
      totalSoldQuantity: data.totalSoldQuantity,
      weeklyCashQuantity: data.weeklyCashQuantity,
      storeQuantity: data.storeQuantity,
      dishRows: dishRankingRows(data).map((item, index) => [index + 1, item.name, item.quantity]),
      comparisonRows: comparisonReportRows(data).map(row => [
        row.label,
        managementComparisonValue(row, row.current),
        managementComparisonValue(row, row.previous),
        managementComparisonDelta(row)
      ]),
      incomeRows: data.incomeEntries.map(entry => [entry.date || "", entry.description || "", money(entry.amount)]),
      expenseRows: reportPdfTopExpenseRows(data),
      channelRows: data.channelReceipts.map(entry => [
        entry.date || "",
        ...cardapioPaymentDefinitions.map(([paymentKey]) => money(cardapioPaymentAmount(entry, paymentKey))),
        money(cardapioDeliveryFeeAmount(entry)),
        money(channelReceiptAmount(entry, "ifood", "net")),
        money(channelReceiptAmount(entry, "food99", "net")),
        money(channelReceiptTotal(entry))
      ]),
      storeRows: data.storeSales.map(storeSaleReportRow),
      cashRows: data.cashEntries.map(entry => [
        entry.date || "",
        entry.description || "",
        entry.type === "expense" ? "Saída" : "Entrada",
        cashAccountLabel(entry.cashAccount, entry.type),
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

async function downloadReportXlsx(options = {}) {
  const data = reportData();
  const accountantPackage = Boolean(options.accountantPackage);
  const withdrawalAmounts = withdrawalBreakdownAmounts(data.financial.withdrawals, data.partnerWithdrawalControl);
  const periodLabel = reportPeriodLabel(data);
  const filename = accountantPackage
    ? `cumbuca-pacote-contador-${data.type === "week" ? data.weekKey : data.type === "day" ? data.date : data.periodKey}.xlsx`
    : data.type === "week"
      ? `cumbuca-relatorio-${data.weekKey}.xlsx`
      : `cumbuca-relatorio-${data.periodKey}.xlsx`;
  const payload = {
    filename,
    periodLabel: accountantPackage ? `${periodLabel} - Pacote contador por conta` : periodLabel,
    data: {
      periodType: data.type,
      periodStart: reportPeriodBounds(data).start,
      periodEnd: reportPeriodBounds(data).end,
      periodKey: data.periodKey,
      balance: data.balance,
      totalIncome: data.totalIncome,
      expenses: data.expenses,
      operationalExpenses: data.financial.operationalExpenses,
      ...reportFinancialPayloadMetrics(data),
      accountAdjustmentIncome: data.accountAdjustmentTotals.income,
      accountAdjustmentExpenses: data.accountAdjustmentTotals.expenses,
      accountAdjustmentBalance: data.accountAdjustmentTotals.balance,
      accountBalance: data.accountBalance,
      savingsBalance: data.savingsBalance,
      savingsExpectedBalance: data.savingsExpectedBalance,
      consolidatedBalance: data.consolidatedBalance,
      capitalContributionTotal: data.capitalContributionTotal,
      transferRows: accountTransferReportRows(data.accountTransfers, true),
      capitalContributionRows: data.capitalContributionEntries.map(entry => [
        entry.date || "",
        entry.description || "Aporte de sócia",
        cashAccountLabel(entry.cashAccount),
        Number(entry.amount || 0)
      ]),
      savingsUpdatedAt: data.savingsUpdatedAt,
      withdrawalVanessa: data.vanessaFinancial.received,
      withdrawalSavings: withdrawalAmounts.savings,
      withdrawalRaquel: withdrawalAmounts.raquel,
      withdrawalRows: [
        ["Cofrinho recebeu", Number(data.financial.withdrawals.savings || 0)],
        ["Cofrinho - deveria ter", Number(data.savingsExpectedBalance || 0)],
        ["Vanessa - direito na divisão", Number(data.partnerWithdrawalControl?.expectedVanessa || 0)],
        ["Vanessa - recebeu da conta", Number(data.vanessaFinancial?.received || 0)],
        ["Vanessa - pagou em Sócias", Number(data.vanessaFinancial?.paid || 0)],
        ["Vanessa - ainda não retirou", Number(data.partnerWithdrawalControl?.pendingVanessa || 0)],
        ["Vanessa - saldo devedor em Sócias", Number(data.vanessaFinancial?.debt || 0)],
        ...(Number(data.partnerWithdrawalControl?.paidToCashVanessa || 0) > 0 ? [
          ["Vanessa - dívida compensada", Number(data.partnerWithdrawalControl.paidToCashVanessa)],
          ["Vanessa - total recebido + compensado", Number(withdrawalAmounts.vanessa || 0)]
        ] : []),
        ["Raquel - direito na divisão", Number(data.partnerWithdrawalControl?.expectedRaquel || 0)],
        ["Raquel - recebeu da conta", Number(data.financial.withdrawals.raquel || 0)],
        ["Raquel - ainda não retirou", Number(data.partnerWithdrawalControl?.pendingRaquel || 0)],
        ["Raquel - saldo devedor em Sócias", Number(data.partnerWithdrawalControl?.priorRaquel || 0)],
        ...(Number(data.partnerWithdrawalControl?.paidToCashRaquel || 0) > 0 ? [
          ["Raquel - dívida compensada", Number(data.partnerWithdrawalControl.paidToCashRaquel)],
          ["Raquel - total recebido + compensado", Number(withdrawalAmounts.raquel || 0)]
        ] : []),
        ["Vanessa informada", Number(data.partnersRecord?.vanessa || 0)],
        ["Raquel informada", Number(data.partnersRecord?.raquel || 0)],
        ["Compensação manual antiga", Number(data.partnersRecord?.difference || 0)]
      ],
      totalSoldQuantity: data.totalSoldQuantity,
      weeklyCashQuantity: data.weeklyCashQuantity,
      storeQuantity: data.storeQuantity,
      dishRows: dishRankingRows(data).map((item, index) => [index + 1, item.name, item.quantity]),
      clientRows: clientReportRows(data).slice(0, 50).map(row => [row.name, row.phone, row.plan, row.orders, row.quantity, Number(row.amount || 0), row.pending]),
      comparisonRows: comparisonReportRows(data).map(row => [row.label, row.current, row.previous, row.delta]),
      accountPackageSummaryRows: reportAccountPackageSummaryNumericRows(data),
      accountPackageReconciliationRows: reportAccountReconciliationRows(data, true),
      accountPackageUnifiedRows: reportAccountPackageCashRows(data, "all", true),
      accountPackagePfRows: reportAccountPackageCashRows(data, "pf", true),
      accountPackagePjRows: reportAccountPackageCashRows(data, "pj", true),
      accountPackageUnassignedRows: reportAccountPackageCashRows(data, "unassigned", true),
      incomeRows: data.incomeEntries.map(entry => [entry.date || "", entry.description || "", Number(entry.amount || 0)]),
      expenseRows: data.topExpenses.map(entry => [entry.date || "", entry.description || "", categoryName(entry.category), Number(entry.amount || 0)]),
      channelRows: data.channelReceipts.map(entry => [
        entry.date || "",
        ...cardapioPaymentDefinitions.map(([paymentKey]) => cardapioPaymentAmount(entry, paymentKey)),
        cardapioDeliveryFeeAmount(entry),
        channelReceiptAmount(entry, "ifood", "net"),
        channelReceiptAmount(entry, "food99", "net"),
        channelReceiptTotal(entry)
      ]),
      storeRows: data.storeSales.map(storeSaleReportRow),
      cashRows: data.cashEntries.map(entry => [
        entry.date || "",
        entry.description || "",
        entry.type === "expense" ? "Saída" : "Entrada",
        cashAccountLabel(entry.cashAccount, entry.type),
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

async function downloadAccountantPackage() {
  await downloadReportPdf({ accountantPackage: true });
  await downloadReportXlsx({ accountantPackage: true });
}

function exportReport(kind) {
  if (kind === "accountant-package") {
    downloadAccountantPackage();
    return;
  }

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
  const baseName = data.type === "day"
    ? `cumbuca-relatorio-${data.date}`
    : data.type === "week"
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
        operationalProfit: operationalProfitForReport(data),
        resultAfterWithdrawals: operationalResultForReport(data),
        withdrawalGrossTotal: withdrawalBreakdownAmounts(
          data.financial.withdrawals,
          data.partnerWithdrawalControl
        ).total,
        accountAdjustmentIncome: data.accountAdjustmentTotals.income,
        accountAdjustmentExpenses: data.accountAdjustmentTotals.expenses,
        accountAdjustmentBalance: data.accountAdjustmentTotals.balance,
        accountBalance: data.accountBalance,
        totalIncome: data.totalIncome,
        savingsBalance: data.savingsBalance,
        consolidatedBalance: data.consolidatedBalance,
        capitalContributionTotal: data.capitalContributionTotal,
        savingsUpdatedAt: data.savingsUpdatedAt,
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
      accountTransfers: data.accountTransfers,
      capitalContributionEntries: data.capitalContributionEntries,
      orders: data.orders,
      clients: state.clients,
      menuWeeks: data.menuWeeks,
      partnersRecord: data.partnersRecord
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
    <div class="summary">
      <div class="metric report-metric"><span>Receita pedidos</span><strong>${money(data.orderRevenue)}</strong></div>
      <div class="metric report-metric"><span>Frete</span><strong>${money(data.deliveryRevenue)}</strong></div>
      <div class="metric report-metric"><span>Cumbucas semanal</span><strong>${data.weeklyCashQuantity}</strong></div>
      <div class="metric report-metric"><span>Pedidos pagos</span><strong>${data.paidOrders}</strong></div>
      <div class="metric report-metric"><span>Pedidos pendentes</span><strong>${data.pendingOrders}</strong></div>
    </div>
  `;
}

function dishRankingRows(data) {
  const totals = data.orders.reduce((acc, order) => {
    (order.dishes || []).forEach(dish => {
      const key = `${order.menuKey || ""}-${dish.slot}`;
      const name = dishNameForSlot(state.menus[order.menuKey] || [], dish.slot);
      acc[key] = acc[key] || { name: name || `Cumbuca ${dish.slot}`, quantity: 0 };
      acc[key].quantity += Number(dish.quantity || 0);
    });
    return acc;
  }, {});
  return Object.values(totals).sort((a, b) => b.quantity - a.quantity).slice(0, 8);
}

function dishRankingPanel(data) {
  const rows = dishRankingRows(data);
  return `
    <section class="panel report-section">
      <h2>Ranking de cumbucas ${reportTitleSuffix(data)}</h2>
      ${rows.length ? `
        <div class="recent-list">
          ${rows.map((item, index) => `<span><b>${index + 1}. ${item.quantity}</b>${escapeHtml(item.name)}</span>`).join("")}
        </div>
      ` : `<p class="muted">Nenhuma cumbuca vendida no período.</p>`}
    </section>
  `;
}

function storeProductPerformanceRows(data) {
  const rows = new Map();
  sortedStoreProducts().forEach(product => {
    rows.set(String(product.id), {
      key: String(product.id),
      product,
      name: product.name || "Produto sem nome",
      recipe: storeProductRecipe(product),
      launches: 0,
      combos: 0,
      units: 0
    });
  });

  (data.storeSales || []).forEach(entry => {
    const product = storeProductById(entry.productId);
    const key = product
      ? String(product.id)
      : entry.productId
        ? `removed:${entry.productId}`
        : "unassigned";
    if (!rows.has(key)) {
      rows.set(key, {
        key,
        product: null,
        name: storeSaleProductName(entry),
        recipe: null,
        launches: 0,
        combos: 0,
        units: 0
      });
    }
    const row = rows.get(key);
    row.launches += 1;
    row.units += storeSaleUnitQuantity(entry);
    if (normalizedStoreSaleType(entry) === "combo") {
      row.combos += Number(entry.quantity || 0);
    }
  });

  return [...rows.values()].map(row => {
    const metrics = row.recipe ? pricingRecipeMetrics(row.recipe) : null;
    const practiced = Boolean(metrics?.practicedPrice > 0);
    const referencePrice = metrics
      ? practiced
        ? metrics.practicedPrice
        : metrics.suggestedPrice
      : 0;
    const unitProfit = metrics
      ? practiced
        ? metrics.realProfit
        : metrics.suggestedProfit
      : 0;
    const estimatedRevenue = row.units * referencePrice;
    const estimatedProfit = row.units * unitProfit;
    const estimatedMargin = estimatedRevenue > 0
      ? (estimatedProfit / estimatedRevenue) * 100
      : null;
    return {
      ...row,
      metrics,
      practiced,
      referencePrice,
      unitProfit,
      estimatedRevenue,
      estimatedProfit,
      estimatedMargin
    };
  }).sort((a, b) => {
    return b.units - a.units
      || b.estimatedProfit - a.estimatedProfit
      || a.name.localeCompare(b.name, "pt-BR");
  });
}

function storeProductPerformancePanel(data) {
  const rows = storeProductPerformanceRows(data);
  const productRows = rows.filter(row => row.product);
  const soldProductRows = productRows.filter(row => row.units > 0);
  const linkedSoldRows = soldProductRows.filter(row => row.recipe);
  const mostSold = soldProductRows[0] || null;
  const mostProfitable = [...linkedSoldRows].sort((a, b) => {
    return b.estimatedProfit - a.estimatedProfit;
  })[0] || null;
  const totalUnits = (data.storeSales || []).reduce((sum, entry) => {
    return sum + storeSaleUnitQuantity(entry);
  }, 0);
  const linkedUnits = rows.filter(row => row.recipe).reduce((sum, row) => sum + row.units, 0);
  const estimatedRevenue = rows.reduce((sum, row) => sum + row.estimatedRevenue, 0);
  const estimatedProfit = rows.reduce((sum, row) => sum + row.estimatedProfit, 0);
  const lowMarginRows = linkedSoldRows.filter(row => {
    return row.estimatedMargin !== null
      && row.estimatedMargin + 0.0001 < Number(row.metrics?.desiredMarginPercent || 0);
  });
  const noOutputRows = productRows.filter(row => row.units === 0);

  return `
    <section class="panel report-section store-product-performance" data-store-product-performance>
      <div class="section-heading">
        <div>
          <h2>Vendas e lucro por produto ${reportTitleSuffix(data)}</h2>
          <p class="muted-inline">As quantidades vêm de Loja &gt; Vendas. Receita e lucro são estimativas calculadas com os valores atuais da receita vinculada.</p>
        </div>
      </div>
      <div class="summary">
        <div class="metric report-metric" data-product-performance-units><span>Unidades vendidas</span><strong>${totalUnits}</strong></div>
        <div class="metric report-metric"><span>Produtos com saída</span><strong>${soldProductRows.length}</strong></div>
        <div class="metric report-metric"><span>Receita estimada</span><strong>${money(estimatedRevenue)}</strong></div>
        <div class="metric report-metric" data-product-performance-profit><span>Lucro estimado</span><strong class="${estimatedProfit < 0 ? "negative" : "positive"}">${money(estimatedProfit)}</strong></div>
        <div class="metric report-metric"><span>Mais vendido</span><strong>${mostSold ? escapeHtml(mostSold.name) : "—"}</strong><small>${mostSold ? `${mostSold.units} unidade(s)` : "Sem vendas"}</small></div>
        <div class="metric report-metric"><span>Maior lucro estimado</span><strong>${mostProfitable ? escapeHtml(mostProfitable.name) : "—"}</strong><small>${mostProfitable ? money(mostProfitable.estimatedProfit) : "Vincule uma receita"}</small></div>
      </div>
      ${totalUnits > linkedUnits ? `
        <p class="form-hint warning-text">
          ${totalUnits - linkedUnits} unidade(s) ainda não entram no cálculo de lucro porque estão sem produto ou sem receita vinculada.
        </p>
      ` : ""}
      ${rows.length ? `
        <div class="table-wrap report-table">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Produto</th>
                <th>Receita</th>
                <th>Quantidade</th>
                <th>Lançamentos</th>
                <th>Preço ref.</th>
                <th>Lucro/un.</th>
                <th>Lucro estimado</th>
                <th>Margem</th>
                <th>Situação</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map((row, index) => `
                <tr data-product-performance-row="${escapeHtml(row.key)}">
                  <td>${index + 1}</td>
                  <td><strong>${escapeHtml(row.name)}</strong></td>
                  <td>${row.recipe ? escapeHtml(row.recipe.name || "Receita sem nome") : "Sem vínculo"}</td>
                  <td><strong>${row.units}</strong>${row.combos ? `<br><small>${row.combos} combo(s)</small>` : ""}</td>
                  <td>${row.launches}</td>
                  <td>${row.recipe ? money(row.referencePrice) : "—"}${row.recipe ? `<br><small>${row.practiced ? "Praticado" : "Sugerido"}</small>` : ""}</td>
                  <td class="${row.unitProfit < 0 ? "negative" : row.recipe ? "positive" : ""}">${row.recipe ? money(row.unitProfit) : "—"}</td>
                  <td class="${row.estimatedProfit < 0 ? "negative" : row.recipe ? "positive" : ""}">${row.recipe ? money(row.estimatedProfit) : "—"}</td>
                  <td>${row.recipe ? pricingPercent(row.estimatedMargin) : "—"}</td>
                  <td>
                    ${row.units === 0
                      ? `<span class="pricing-status attention">Sem saída</span>`
                      : row.recipe
                        ? pricingStatusPill(row.metrics.status)
                        : `<span class="pricing-status attention">Sem receita</span>`}
                  </td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      ` : `<p class="muted">Cadastre produtos em Loja &gt; Produtos e informe o produto ao lançar cada venda.</p>`}
    </section>
    ${lowMarginRows.length ? `
      <section class="panel report-section">
        <h2>Produtos com saída e margem abaixo da meta</h2>
        <div class="recent-list">
          ${lowMarginRows.map(row => `
            <span><b>${escapeHtml(row.name)}</b>${row.units} unidade(s) · ${pricingPercent(row.estimatedMargin)} de margem · meta ${pricingPercent(row.metrics.desiredMarginPercent)}</span>
          `).join("")}
        </div>
      </section>
    ` : ""}
    ${noOutputRows.length ? `
      <section class="panel report-section">
        <h2>Produtos sem saída ${reportTitleSuffix(data)}</h2>
        <div class="recent-list">
          ${noOutputRows.map(row => `<span><b>${escapeHtml(row.name)}</b>0 unidade</span>`).join("")}
        </div>
      </section>
    ` : ""}
  `;
}

function weeklyRecipeProfitabilityRows(data) {
  const rows = new Map();
  let unallocatedUnits = 0;

  productionOrders(data.orders || []).forEach(order => {
    const totalOrderQuantity = orderQuantity(order);
    if (!(order.dishes || []).length) {
      unallocatedUnits += totalOrderQuantity;
      return;
    }
    const fallbackUnitRevenue = totalOrderQuantity > 0 ? WEEKLY_PROFITABILITY_UNIT_PRICE : 0;
    (order.dishes || []).forEach(dish => {
      const quantity = Number(dish.quantity || 0);
      if (quantity <= 0) {
        return;
      }
      const menuItem = (state.menus[order.menuKey] || []).find(item => Number(item.slot) === Number(dish.slot)) || {};
      const supermarket = weeklyMenuSupermarketAllocation(order.menuKey);
      const referencePrice = fallbackUnitRevenue;
      const unitCost = weeklyMenuPlanningCosts(menuItem, order.menuKey).totalCost;
      const costConfigured = menuItemHasPlanningContent(menuItem)
        && supermarket.supermarketTotal > 0
        && supermarket.totalQuantity > 0;
      const key = `menu:${order.menuKey || "sem-menu"}:${dish.slot}`;
      if (!rows.has(key)) {
        rows.set(key, {
          key,
          recipe: null,
          name: menuItem.dish || `Cumbuca ${dish.slot}`,
          quantity: 0,
          revenue: 0,
          cost: 0,
          referencePrice,
          desiredMargin: menuItemProfitPercent(menuItem),
          costConfigured,
          supermarketUnitCost: supermarket.costPerUnit,
          costSource: "Supermercado da semana + custos por unidade"
        });
      }
      const row = rows.get(key);
      row.quantity += quantity;
      row.revenue += referencePrice * quantity;
      row.cost += unitCost * quantity;
    });
  });

  return {
    rows: [...rows.values()].map(row => {
      const profit = row.revenue - row.cost;
      return {
        ...row,
        profit,
        margin: row.revenue > 0 ? (profit / row.revenue) * 100 : null
      };
    }).sort((a, b) => b.quantity - a.quantity || b.profit - a.profit),
    unallocatedUnits
  };
}

function businessProfitabilityPanel(data) {
  const weekly = weeklyRecipeProfitabilityRows(data);
  const storeRows = storeProductPerformanceRows(data);
  const productionReportOrders = productionOrders(data.orders);
  const weeklyRevenue = weekly.rows.reduce((sum, row) => sum + row.revenue, 0);
  const weeklyCost = weekly.rows.reduce((sum, row) => sum + row.cost, 0);
  const weeklyProfit = weeklyRevenue - weeklyCost;
  const selectedWeekKeys = [...new Set(productionReportOrders.map(order => String(order.menuKey || "")).filter(Boolean))];
  const weeklySupermarketCost = selectedWeekKeys.reduce(
    (sum, key) => sum + weeklyMenuSupermarketTotal(key),
    0
  );
  const weeklyUnits = productionReportOrders.reduce((sum, order) => sum + orderQuantity(order), 0);
  const supermarketPerUnit = weeklyUnits > 0 ? weeklySupermarketCost / weeklyUnits : 0;
  const afterSupermarket = weeklyRevenue - weeklySupermarketCost;
  const storeRevenue = storeRows.reduce((sum, row) => sum + row.estimatedRevenue, 0);
  const storeProfit = storeRows.reduce((sum, row) => sum + row.estimatedProfit, 0);
  const totalRevenue = weeklyRevenue + storeRevenue;
  const totalProfit = weeklyProfit + storeProfit;
  const unconfiguredRows = weekly.rows.filter(row => !row.costConfigured);
  const lowMarginRows = weekly.rows.filter(row => {
    return row.recipe && row.margin !== null && row.margin + 0.0001 < row.desiredMargin;
  });

  return `
    <section class="panel report-section profitability-panel" data-profitability-panel>
      <div class="section-heading">
        <div>
          <h2>Rentabilidade por prato ${reportTitleSuffix(data)}</h2>
          <p class="muted-inline">Cada cumbuca semanal considera o valor unitário fixo de ${money(WEEKLY_PROFITABILITY_UNIT_PRICE)}. O supermercado informado na semana é dividido por todas as cumbucas pedidas e aplicado à quantidade de cada prato.</p>
        </div>
        <a class="secondary table-action" href="/precificacao?view=costs">Abrir custos rateados</a>
      </div>
      <div class="summary">
        <div class="metric report-metric"><span>Supermercado informado</span><strong>${money(weeklySupermarketCost)}</strong><small>Total da(s) semana(s) selecionada(s)</small></div>
        <div class="metric report-metric"><span>Cumbucas consideradas</span><strong>${weeklyUnits}</strong></div>
        <div class="metric report-metric"><span>Supermercado por cumbuca</span><strong>${money(supermarketPerUnit)}</strong><small>Supermercado ÷ cumbucas</small></div>
        <div class="metric report-metric"><span>Sobra após supermercado</span><strong class="${afterSupermarket < 0 ? "negative" : "positive"}">${money(afterSupermarket)}</strong><small>Receita dos pedidos − supermercado</small></div>
        <div class="metric report-metric"><span>Receita considerada</span><strong>${money(totalRevenue)}</strong></div>
        <div class="metric report-metric"><span>Custo estimado</span><strong>${money(weeklyCost + (storeRevenue - storeProfit))}</strong></div>
        <div class="metric report-metric"><span>Lucro estimado</span><strong class="${totalProfit < 0 ? "negative" : "positive"}">${money(totalProfit)}</strong></div>
        <div class="metric report-metric"><span>Margem estimada</span><strong>${pricingPercent(totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : null)}</strong></div>
        <div class="metric report-metric"><span>Lucro dos pedidos</span><strong class="${weeklyProfit < 0 ? "negative" : "positive"}">${money(weeklyProfit)}</strong></div>
        <div class="metric report-metric"><span>Lucro da loja</span><strong class="${storeProfit < 0 ? "negative" : "positive"}">${money(storeProfit)}</strong></div>
      </div>
      ${unconfiguredRows.length || weekly.unallocatedUnits ? `
        <p class="form-hint warning-text">
          ${unconfiguredRows.reduce((sum, row) => sum + row.quantity, 0) + weekly.unallocatedUnits} unidade(s) de pedidos ainda não têm custo identificado e não entram no cálculo completo.
        </p>
      ` : ""}
      ${weekly.rows.length ? `
        <div class="table-wrap report-table">
          <table>
            <thead>
              <tr>
                <th>Prato</th>
                <th>Origem do custo</th>
                <th>Quantidade</th>
                <th>Valor unitário</th>
                <th>Receita calculada</th>
                <th>Custo estimado</th>
                <th>Lucro estimado</th>
                <th>Margem</th>
                <th>Situação</th>
              </tr>
            </thead>
            <tbody>
              ${weekly.rows.map(row => `
                <tr>
                  <td><strong>${escapeHtml(row.name)}</strong></td>
                  <td>${row.costSource}</td>
                  <td>${row.quantity}</td>
                  <td>${money(row.referencePrice)}</td>
                  <td>${money(row.revenue)}</td>
                  <td>${row.costConfigured ? money(row.cost) : "—"}</td>
                  <td class="${row.profit < 0 ? "negative" : row.costConfigured ? "positive" : ""}">${row.costConfigured ? money(row.profit) : "—"}</td>
                  <td>${row.costConfigured ? pricingPercent(row.margin) : "—"}</td>
                  <td>${!row.costConfigured
                    ? `<span class="pricing-status pending">Preencher custos</span>`
                    : row.profit < 0
                      ? `<span class="pricing-status loss">Prejuízo</span>`
                      : row.recipe && row.margin !== null && row.margin + 0.0001 < row.desiredMargin
                        ? `<span class="pricing-status attention">Abaixo da meta</span>`
                        : `<span class="pricing-status profitable">Saudável</span>`}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      ` : `<p class="muted">Nenhum pedido com pratos detalhados no período.</p>`}
    </section>
    ${lowMarginRows.length ? `
      <section class="panel report-section">
        <h2>Pratos abaixo da margem desejada</h2>
        <div class="recent-list">
          ${lowMarginRows.map(row => `
            <span><b>${escapeHtml(row.name)}</b>${pricingPercent(row.margin)} realizado · meta ${pricingPercent(row.desiredMargin)}</span>
          `).join("")}
        </div>
      </section>
    ` : ""}
    <section class="panel report-section">
      <div class="section-heading">
        <div>
          <h2>Detalhamento da loja</h2>
          <p class="muted-inline">${storeRows.reduce((sum, row) => sum + row.units, 0)} unidade(s) · lucro estimado ${money(storeProfit)}.</p>
        </div>
        <button class="secondary table-action" type="button" data-open-report-products>Ver produtos</button>
      </div>
    </section>
  `;
}

function clientReportRows(data) {
  const rows = data.orders.reduce((acc, order) => {
    const client = clientByPhone(order.clientPhone);
    const key = client.phone || order.clientPhone || `cliente-${order.id}`;
    acc[key] = acc[key] || {
      name: client.name || order.clientPhone || "Cliente",
      phone: client.phone || order.clientPhone || "",
      plan: client.plan === "mensalista" ? "Mensalista" : "Semanal",
      orders: 0,
      quantity: 0,
      amount: 0,
      pending: 0
    };
    acc[key].orders += 1;
    acc[key].quantity += orderQuantity(order);
    acc[key].amount += Number(order.amount || 0) + Number(order.deliveryFee || 0);
    if (client.plan !== "mensalista" && !isOrderPaid(order)) {
      acc[key].pending += 1;
    }
    return acc;
  }, {});

  return Object.values(rows).sort((a, b) => b.amount - a.amount);
}

function clientReportPanel(data) {
  const rows = clientReportRows(data);
  return `
    <section class="panel report-section">
      <h2>Relatorio de clientes ${reportTitleSuffix(data)}</h2>
      ${rows.length ? `
        <div class="table-wrap report-table">
          <table>
            <thead><tr><th>Cliente</th><th>Perfil</th><th>Pedidos</th><th>Cumbucas</th><th>Total</th><th>Pendências</th></tr></thead>
            <tbody>
              ${rows.slice(0, 20).map(row => `
                <tr>
                  <td>${escapeHtml(row.name)}<br><small>${escapeHtml(row.phone)}</small></td>
                  <td>${row.plan}</td>
                  <td>${row.orders}</td>
                  <td>${row.quantity}</td>
                  <td>${money(row.amount)}</td>
                  <td>${row.pending}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      ` : `<p class="muted">Nenhum pedido de cliente neste período.</p>`}
    </section>
  `;
}

function comparisonReportRows(data) {
  if (data.type === "month") {
    return managementComparisonRows(data.periodKey);
  }
  const previousCash = businessCashEntries(previousReportCashEntries(data));
  const previousOrders = previousReportOrders(data);
  const previousStore = previousReportStoreSales(data);
  const previousTotals = cashTotals(previousCash);
  const previousFinancial = financialSummary(previousCash);
  const previousWithdrawalControl = partnerPeriodTotals(withdrawalHistoryGroups(previousCash));
  const previousWithdrawalAmounts = withdrawalBreakdownAmounts(previousFinancial.withdrawals, previousWithdrawalControl);
  const currentWithdrawalAmounts = withdrawalBreakdownAmounts(data.financial.withdrawals, data.partnerWithdrawalControl);
  const previousOrderQuantity = productionOrders(previousOrders)
    .reduce((sum, order) => sum + orderQuantity(order), 0);
  const previousStoreQuantity = previousStore.reduce((sum, entry) => sum + storeSaleUnitQuantity(entry), 0);
  const previousOrderRevenue = previousOrders.reduce((sum, order) => sum + Number(order.amount || 0), 0);
  const previousAverageTicket = previousOrders.length ? previousOrderRevenue / previousOrders.length : 0;
  return [
    ["Entradas", data.income, previousTotals.income],
    ["Saídas", data.expenses, previousTotals.expenses],
    ["Lucro operacional", operationalProfitForReport(data), operationalProfitForReport({ financial: previousFinancial, partnerWithdrawalControl: previousWithdrawalControl })],
    ["Vanessa - recebeu da conta", currentWithdrawalAmounts.receivedNowVanessa, previousWithdrawalAmounts.receivedNowVanessa],
    ["Cofrinho", currentWithdrawalAmounts.savings, previousWithdrawalAmounts.savings],
    ["Raquel - recebeu da conta", currentWithdrawalAmounts.receivedNowRaquel, previousWithdrawalAmounts.receivedNowRaquel],
    ["Pedidos", data.orders.length, previousOrders.length],
    ["Cumbucas", data.totalSoldQuantity, previousOrderQuantity + previousStoreQuantity],
    ["Ticket médio", data.averageTicket, previousAverageTicket]
  ].map(([label, current, previous]) => ({
    label,
    kind: label === "Pedidos" || label === "Cumbucas" ? "count" : "money",
    lowerIsBetter: label === "Saídas",
    current,
    previous,
    delta: Number(current || 0) - Number(previous || 0),
    variationPercent: Math.abs(Number(previous || 0)) >= 0.005
      ? ((Number(current || 0) - Number(previous || 0)) / Math.abs(Number(previous || 0))) * 100
      : 0,
    percentagePointDelta: null
  }));
}

function comparisonReportPanel(data) {
  const rows = comparisonReportRows(data);
  const previous = previousComparablePeriod(data);
  return `
    <section class="panel report-section">
      <h2>Comparativo com ${previous.label}</h2>
      <div class="summary comparison-summary">
        ${rows.map(row => `
          <div class="metric">
            <span>${row.label}</span>
            <strong class="comparison-value ${row.delta < 0 ? "negative" : "positive"}">${managementComparisonDelta(row)}</strong>
            <small>Atual: ${managementComparisonValue(row, row.current)} | Anterior: ${managementComparisonValue(row, row.previous)}</small>
          </div>
        `).join("")}
      </div>
    </section>
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
    ${cashAccountSummary(businessCashEntries(data.cashEntries))}
  `;
}
function reportIncomeCashTable(data) {
  if (!data.incomeEntries.length) {
    return `<p class="muted">Nenhuma entrada de caixa neste período.</p>`;
  }

  return `
    <div class="summary">
      <div class="metric report-metric">
        <span>Total de entradas no período</span>
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
  const sortedEntries = [...entries]
    .sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0));
  const selected = state.reportPeriod.expenseCategory || "all";
  const selectedLabel = selected === "all" ? "Todas as saídas" : categoryName(selected);

  if (!entries.length) {
    return `<p class="muted">Nenhuma saída neste período.</p>`;
  }

  return `
    <div class="summary">
      <div class="metric report-metric"><span>Filtro</span><strong>${selectedLabel}</strong></div>
      <div class="metric report-metric"><span>Total filtrado</span><strong>${money(total)}</strong></div>
      <div class="metric report-metric"><span>Lançamentos</span><strong>${entries.length}</strong></div>
    </div>
    <div class="table-wrap report-table">
      <table>
        <thead><tr><th>Data</th><th>Motivo</th><th>Descrição</th><th>Valor</th></tr></thead>
        <tbody>
          ${sortedEntries.map(entry => `
            <tr>
              <td>${formatIsoDateBr(entry.date)}</td>
              <td>${escapeHtml(categoryName(entry.category))}</td>
              <td>${escapeHtml(entry.description || "")}</td>
              <td>${money(entry.amount)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function expenseCategoryReportPanel(data) {
  const grouped = data.expenseEntries.reduce((summary, entry) => {
    const label = categoryName(entry.category);
    const key = slugifyCategory(label) || "outros";
    const current = summary.get(key) || { key, label, total: 0, count: 0 };
    current.total += Number(entry.amount || 0);
    current.count += 1;
    summary.set(key, current);
    return summary;
  }, new Map());
  const rows = [...grouped.values()].sort((a, b) => b.total - a.total);
  const total = rows.reduce((sum, row) => sum + row.total, 0);
  return `
    <section class="panel report-section">
      <div class="section-heading">
        <div>
          <h2>Custos separados por categoria ${reportTitleSuffix(data)}</h2>
          <p class="muted-inline">Supermercado, frigorífico, boletos, Uber/99 e demais custos do período selecionado.</p>
        </div>
      </div>
      ${rows.length ? `
        <div class="summary expense-category-summary">
          ${rows.map(row => `
            <div class="metric report-metric">
              <span>${escapeHtml(row.label)}</span>
              <strong>${money(row.total)}</strong>
              <small>${row.count} lançamento(s) · ${total > 0 ? Math.round((row.total / total) * 100) : 0}% do total</small>
            </div>
          `).join("")}
        </div>
      ` : `<p class="muted">Nenhum custo lançado neste período.</p>`}
    </section>
  `;
}

function reportFinancialPositionPanel(data) {
  const differenceLabel = data.savingsDifference < -0.005
    ? "Falta guardar"
    : data.savingsDifference > 0.005
      ? "Acima do previsto"
      : "Cofrinho conferido";
  return `
    <section class="panel report-section">
      <div class="section-heading">
        <div>
          <h2>Posição financeira ${reportTitleSuffix(data)}</h2>
          <p class="muted-inline">Saldos acumulados até ${formatIsoDateBr(data.accountBalanceDate)}.</p>
        </div>
      </div>
      <div class="summary account-balance-summary">
        <div class="metric report-metric"><span>Vanessa recebeu</span><strong>${money(data.vanessaFinancial.received)}</strong><small>Informado em Retiradas no período</small></div>
        <div class="metric report-metric"><span>Vanessa pagou</span><strong>${money(data.vanessaFinancial.paid)}</strong><small>Informado em Sócias no período</small></div>
        <div class="metric report-metric"><span>Vanessa deve</span><strong>${money(data.vanessaFinancial.debt)}</strong><small>Saldo devedor em Sócias</small></div>
        <div class="metric report-metric"><span>Conta PF</span><strong class="${data.accountBalances.pf < 0 ? "negative" : "positive"}">${money(data.accountBalances.pf)}</strong></div>
        <div class="metric report-metric"><span>Conta PJ</span><strong class="${data.accountBalances.pj < 0 ? "negative" : "positive"}">${money(data.accountBalances.pj)}</strong></div>
        ${Math.abs(Number(data.accountBalances.unassigned || 0)) >= 0.005 ? `<div class="metric report-metric"><span>Sem conta definida</span><strong>${money(data.accountBalances.unassigned)}</strong></div>` : ""}
        <div class="metric report-metric"><span>Saldo das contas</span><strong class="${data.accountBalance < 0 ? "negative" : "positive"}">${money(data.accountBalance)}</strong><small>PF + PJ</small></div>
        <div class="metric report-metric"><span>Tem no cofrinho</span><strong>${money(data.savingsBalance)}</strong></div>
        <div class="metric report-metric"><span>Deveria ter no cofrinho</span><strong>${money(data.savingsExpectedBalance)}</strong></div>
        <div class="metric report-metric"><span>${differenceLabel}</span><strong class="${data.savingsDifference < 0 ? "negative" : "positive"}">${money(Math.abs(data.savingsDifference))}</strong></div>
        <div class="metric report-metric total"><span>Saldo unificado</span><strong class="${data.consolidatedBalance < 0 ? "negative" : "positive"}">${money(data.consolidatedBalance)}</strong><small>PF + PJ + Cofrinho</small></div>
      </div>
    </section>
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
              <td>${escapeHtml(week.dishes.map(item => item.dish).filter(Boolean).join(", ") || "Sem pratos")}</td>
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

function normalizedStoreSaleType(entry = {}) {
  return entry?.saleType === "combo" ? "combo" : "unit";
}

function storeSaleUnitsPerCombo(entry = {}) {
  if (normalizedStoreSaleType(entry) !== "combo") {
    return 1;
  }
  return Math.max(1, Number(entry?.unitsPerCombo || 1));
}

function storeSaleUnitQuantity(entry = {}) {
  const quantity = Math.max(0, Number(entry?.quantity || 0));
  return normalizedStoreSaleType(entry) === "combo"
    ? quantity * storeSaleUnitsPerCombo(entry)
    : quantity;
}

function storeSaleTypeLabel(entry = {}) {
  return normalizedStoreSaleType(entry) === "combo" ? "Combo" : "Unidade";
}

function normalizedStoreSalesTypeFilter(value) {
  return ["combo", "unit"].includes(value) ? value : "all";
}

function normalizedStoreSalesProductFilter(value) {
  const selected = String(value || "all");
  if (selected === "unassigned") {
    return selected;
  }
  return state.storeProducts.some(product => String(product.id) === selected)
    ? selected
    : "all";
}

function storeSaleMatchesTypeFilter(entry = {}, saleType = "all") {
  const normalizedFilter = normalizedStoreSalesTypeFilter(saleType);
  return normalizedFilter === "all" || normalizedStoreSaleType(entry) === normalizedFilter;
}

function storeSaleMatchesProductFilter(entry = {}, productId = "all") {
  const selected = normalizedStoreSalesProductFilter(productId);
  if (selected === "all") {
    return true;
  }
  if (selected === "unassigned") {
    return !entry.productId;
  }
  return String(entry.productId || "") === selected;
}

function storeSalesProductFilterOptions(selectedProductId = "all") {
  const selected = normalizedStoreSalesProductFilter(selectedProductId);
  return `
    <option value="all" ${selected === "all" ? "selected" : ""}>Todos os produtos</option>
    <option value="unassigned" ${selected === "unassigned" ? "selected" : ""}>Sem produto informado</option>
    ${sortedStoreProducts().map(product => `
      <option value="${escapeHtml(product.id)}" ${String(product.id) === selected ? "selected" : ""}>
        ${escapeHtml(product.name || "Produto sem nome")}
      </option>
    `).join("")}
  `;
}

function storeSalesFilteredQuantity(entry = {}, saleType = "all") {
  return normalizedStoreSalesTypeFilter(saleType) === "combo"
    ? Math.max(0, Number(entry?.quantity || 0))
    : storeSaleUnitQuantity(entry);
}

function storeSalesComparisonTitle(saleType = "all") {
  const normalizedFilter = normalizedStoreSalesTypeFilter(saleType);
  if (normalizedFilter === "combo") {
    return "Comparação de combos com o mês anterior";
  }
  if (normalizedFilter === "unit") {
    return "Comparação de unidades avulsas com o mês anterior";
  }
  return "Comparação com o mês anterior";
}

function storeSalesSummary(entries = []) {
  const byDay = new Map();
  const summary = entries.reduce((totals, entry) => {
    const combo = normalizedStoreSaleType(entry) === "combo";
    const quantity = Math.max(0, Number(entry.quantity || 0));
    const units = storeSaleUnitQuantity(entry);
    if (combo) {
      totals.combos += quantity;
      totals.comboUnits += units;
    } else {
      totals.standaloneUnits += units;
    }
    totals.totalUnits += units;

    const date = String(entry.date || "");
    if (date) {
      const day = byDay.get(date) || {
        date,
        combos: 0,
        comboUnits: 0,
        standaloneUnits: 0,
        totalUnits: 0
      };
      if (combo) {
        day.combos += quantity;
        day.comboUnits += units;
      } else {
        day.standaloneUnits += units;
      }
      day.totalUnits += units;
      byDay.set(date, day);
    }
    return totals;
  }, {
    combos: 0,
    comboUnits: 0,
    standaloneUnits: 0,
    totalUnits: 0
  });

  summary.days = [...byDay.values()].sort((a, b) => {
    return b.totalUnits - a.totalUnits
      || b.combos - a.combos
      || String(b.date).localeCompare(String(a.date));
  });
  summary.bestDay = summary.days[0] || null;
  return summary;
}

function storeSaleReportRow(entry = {}) {
  const combo = normalizedStoreSaleType(entry) === "combo";
  return [
    entry.date || "",
    storeSaleProductName(entry),
    storeSaleTypeLabel(entry),
    Number(entry.quantity || 0),
    combo ? storeSaleUnitsPerCombo(entry) : "-",
    storeSaleUnitQuantity(entry),
    entry?.notes || ""
  ];
}

function storeSaleAuditDetail(entry = {}) {
  const quantity = Number(entry?.quantity || 0);
  const totalUnits = storeSaleUnitQuantity(entry);
  const productName = storeSaleProductName(entry);
  if (normalizedStoreSaleType(entry) === "combo") {
    return `${productName}: ${quantity} combo(s) de ${storeSaleUnitsPerCombo(entry)} unidade(s), total ${totalUnits}, em ${entry?.date || ""}`;
  }
  return `${productName}: ${totalUnits} unidade(s) em ${entry?.date || ""}`;
}

function storeSalesTable(entries) {
  if (!entries.length) {
    return `<p class="muted">Nenhuma cumbuca da loja lançada neste período.</p>`;
  }

  return `
    <div class="table-wrap report-table">
      <table>
        <thead><tr><th>Data</th><th>Produto</th><th>Tipo</th><th>Quantidade</th><th>Unid. por combo</th><th>Total de unidades</th><th>Observação</th><th>Ações</th></tr></thead>
        <tbody>
          ${entries.map(entry => `
            <tr>
              <td>${formatIsoDateBr(entry.date)}</td>
              <td><strong>${escapeHtml(storeSaleProductName(entry))}</strong></td>
              <td>${storeSaleTypeLabel(entry)}</td>
              <td>${Number(entry.quantity || 0)}</td>
              <td>${normalizedStoreSaleType(entry) === "combo" ? storeSaleUnitsPerCombo(entry) : "-"}</td>
              <td><strong>${storeSaleUnitQuantity(entry)}</strong></td>
              <td>${escapeHtml(entry.notes || "")}</td>
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

function withdrawalPersonRows(data) {
  const weekRange = data.type === "day"
    ? weekRangeForDate(data.date || isoDate(new Date()))
    : reportWeekRange();
  const [year, month] = String(data.periodKey).split("-").map(Number);
  const monthStart = `${data.periodKey}-01`;
  const monthEnd = isoDate(new Date(year, month, 0));
  const weekTotals = partnerPeriodTotals(withdrawalGroupsBetween(weekRange.start, weekRange.end));
  const monthTotals = partnerPeriodTotals(withdrawalGroupsBetween(monthStart, monthEnd));
  return [
    {
      key: "savings",
      label: "Cofrinho",
      expectedWeek: weekTotals.expectedSavings,
      receivedWeek: weekTotals.savings,
      paidToCashWeek: 0,
      totalWeek: weekTotals.savings,
      pendingWeek: 0,
      expectedMonth: monthTotals.expectedSavings,
      receivedMonth: monthTotals.savings,
      paidToCashMonth: 0,
      totalMonth: monthTotals.savings,
      pendingMonth: 0
    },
    {
      key: "vanessa",
      label: "Vanessa",
      expectedWeek: weekTotals.expectedVanessa,
      receivedWeek: weekTotals.vanessa,
      paidToCashWeek: weekTotals.paidToCashVanessa,
      totalWeek: weekTotals.vanessa + weekTotals.paidToCashVanessa,
      pendingWeek: weekTotals.pendingVanessa,
      expectedMonth: monthTotals.expectedVanessa,
      receivedMonth: monthTotals.vanessa,
      paidToCashMonth: monthTotals.paidToCashVanessa,
      totalMonth: monthTotals.vanessa + monthTotals.paidToCashVanessa,
      pendingMonth: monthTotals.pendingVanessa
    },
    {
      key: "raquel",
      label: "Raquel",
      expectedWeek: weekTotals.expectedRaquel,
      receivedWeek: weekTotals.raquel,
      paidToCashWeek: weekTotals.paidToCashRaquel,
      totalWeek: weekTotals.raquel + weekTotals.paidToCashRaquel,
      pendingWeek: weekTotals.pendingRaquel,
      expectedMonth: monthTotals.expectedRaquel,
      receivedMonth: monthTotals.raquel,
      paidToCashMonth: monthTotals.paidToCashRaquel,
      totalMonth: monthTotals.raquel + monthTotals.paidToCashRaquel,
      pendingMonth: monthTotals.pendingRaquel
    }
  ];
}

function withdrawalPersonReportPanel(data) {
  const rows = withdrawalPersonRows(data);
  const groups = withdrawalHistoryGroups(data.financial.withdrawalEntries);
  const periodTotals = partnerPeriodTotals(groups);
  return `
    <section class="panel report-section withdrawal-person-panel">
      <div class="section-heading">
        <h2>Retiradas por pessoa ${reportTitleSuffix(data)}</h2>
        <button class="secondary" type="button" data-export-withdrawals>Exportar CSV</button>
      </div>
      <div class="summary withdrawal-report-summary">
        <div class="metric"><span>Lucro operacional</span><strong>${money(operationalProfitForReport(data))}</strong></div>
        <div class="metric"><span>Cofrinho (${Number(state.appConfig.splitSavingsPercent || 0)}%)</span><strong>${money(periodTotals.savings)}</strong></div>
        <div class="metric"><span>Vanessa recebeu</span><strong>${money(data.vanessaFinancial.received)}</strong><small>Histórico de Retiradas</small></div>
        <div class="metric"><span>Vanessa pagou</span><strong>${money(data.vanessaFinancial.paid)}</strong><small>Histórico de Sócias</small></div>
        <div class="metric"><span>Raquel - recebeu da conta</span><strong>${money(periodTotals.raquel)}</strong></div>
        ${periodTotals.paidToCashVanessa + periodTotals.paidToCashRaquel > 0 ? `<div class="metric"><span>Dívidas compensadas</span><strong>${money(periodTotals.paidToCashVanessa + periodTotals.paidToCashRaquel)}</strong></div>` : ""}
        <div class="metric"><span>Vanessa deve em Sócias</span><strong>${money(data.vanessaFinancial.debt)}</strong></div>
        <div class="metric"><span>Saldo devedor Raquel em Sócias</span><strong>${money(data.partnerWithdrawalControl?.priorRaquel)}</strong></div>
        <div class="metric"><span>Total que saiu da conta</span><strong>${money(periodTotals.paidNowTotal)}</strong></div>
      </div>
      <div class="table-wrap report-table">
        <table>
          <thead><tr><th>Destino</th><th>Direito na semana</th><th>Recebeu da conta</th><th>Dívida compensada</th><th>Pendente</th><th>Direito no mês</th><th>Recebeu da conta no mês</th><th>Dívida compensada no mês</th><th>Pendente no mês</th></tr></thead>
          <tbody>
            ${rows.map(row => `
              <tr>
                <td><strong>${escapeHtml(row.label)}</strong></td>
                <td>${money(row.expectedWeek)}</td>
                <td>${money(row.receivedWeek)}</td>
                <td>${row.key === "savings" ? "-" : money(row.paidToCashWeek)}</td>
                <td>${row.key === "savings" ? "-" : partnerPendingLabel(row.pendingWeek)}</td>
                <td>${money(row.expectedMonth)}</td>
                <td>${money(row.receivedMonth)}</td>
                <td>${row.key === "savings" ? "-" : money(row.paidToCashMonth)}</td>
                <td>${row.key === "savings" ? "-" : partnerPendingLabel(row.pendingMonth)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
      <h3>Histórico do período</h3>
      ${groups.length ? `
        <div class="table-wrap report-table">
          <table>
            <thead><tr><th>Data</th><th>Saldo disponível</th><th>Cofrinho</th><th>Vanessa</th><th>Raquel</th><th>Dívidas compensadas</th><th>Saiu da conta</th></tr></thead>
            <tbody>
              ${groups.map(group => `
                <tr>
                  <td>${formatIsoDateBr(group.date)}</td>
                  <td>${money(group.accountBalanceBefore)}</td>
                  <td>${money(group.savings)}<br><small>Direito ${money(group.expectedSavings)}</small></td>
                  <td><strong>Recebeu ${money(group.vanessa)}</strong><br><small>Direito ${money(group.expectedVanessa)} · ${partnerPendingLabel(group.pendingVanessa)}</small></td>
                  <td><strong>Recebeu ${money(group.raquel)}</strong><br><small>Direito ${money(group.expectedRaquel)} · ${partnerPendingLabel(group.pendingRaquel)}</small></td>
                  <td><small>Vanessa ${money(group.paidToCashVanessa)}</small><br><small>Raquel ${money(group.paidToCashRaquel)}</small></td>
                  <td><strong>${money(group.total)}</strong></td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      ` : `<p class="muted">Nenhuma retirada neste período.</p>`}
    </section>
  `;
}

function exportWithdrawalReport(data = reportData()) {
  const rows = withdrawalHistoryGroups(data.financial.withdrawalEntries).map(group => ({
    data: group.date,
    conta: group.cashAccount,
    saldo_real_usado: group.accountBalanceBefore,
    base_da_divisao: group.distributionBase,
    cofrinho_deveria: group.expectedSavings,
    cofrinho_retirado_agora: group.savings,
    vanessa_direito: group.expectedVanessa,
    vanessa_divida_informada: group.priorVanessa,
    vanessa_divida_compensada: group.paidToCashVanessa,
    vanessa_recebeu_agora: group.vanessa,
    vanessa_total_retirado: group.vanessa + group.paidToCashVanessa,
    vanessa_divida_restante: group.remainingDebtVanessa,
    vanessa_ainda_nao_retirou: group.pendingVanessa,
    raquel_direito: group.expectedRaquel,
    raquel_divida_informada: group.priorRaquel,
    raquel_divida_compensada: group.paidToCashRaquel,
    raquel_recebeu_agora: group.raquel,
    raquel_total_retirado: group.raquel + group.paidToCashRaquel,
    raquel_divida_restante: group.remainingDebtRaquel,
    raquel_ainda_nao_retirou: group.pendingRaquel,
    distribuicao_societaria: group.savings + group.vanessa + group.paidToCashVanessa + group.raquel + group.paidToCashRaquel,
    total_que_saiu_da_conta: group.total
  }));
  const suffix = data.type === "day" ? data.date : data.type === "week" ? data.weekKey : data.periodKey;
  downloadTextFile(`cumbuca-retiradas-${suffix}.csv`, toCsv(rows), "text/csv;charset=utf-8");
}

function weeklyClosingPayload(data) {
  const range = reportWeekRange();
  return {
    id: `${weeklyClosingKey(range.start, range.end)}-${Date.now()}`,
    periodKey: data.periodKey,
    weekKey: data.weekKey,
    week: data.selectedWeek,
    start: range.start,
    end: range.end,
    closedAt: new Date().toISOString(),
    income: data.financial.income,
    operationalExpenses: data.financial.operationalExpenses,
    profitBeforeWithdrawals: operationalProfitForReport(data),
    withdrawals: data.financial.withdrawals,
    availableForWithdrawal: operationalResultForReport(data),
    accountAdjustmentBalance: data.accountAdjustmentTotals.balance,
    accountBalance: data.accountBalance,
    cashEntries: data.cashEntries.length,
    locked: true
  };
}

function weeklyClosingPanel(data) {
  if (data.type !== "week") {
    return "";
  }
  const range = reportWeekRange();
  const key = weeklyClosingKey(range.start, range.end);
  const closing = state.weeklyClosings?.[key];
  const locked = Boolean(closing && closing.locked !== false);
  return `
    <section class="panel report-section">
      <div class="section-heading">
        <div>
          <h2>Fechamento semanal</h2>
          <p class="muted-inline">${formatIsoDateBr(range.start)} a ${formatIsoDateBr(range.end)}.</p>
        </div>
        <div class="actions">
          ${(!closing || !locked) && canUser("manageClosings") ? `<button type="button" id="close-week">${closing ? "Fechar novamente" : "Fechar semana"}</button>` : ""}
          ${closing && locked && canUser("manageClosings") ? `<button class="secondary" type="button" id="unlock-week">Reabrir semana</button>` : ""}
        </div>
      </div>
      <div class="summary">
        <div class="metric"><span>Entradas operacionais</span><strong>${money(data.financial.income)}</strong></div>
        <div class="metric"><span>Saídas operacionais</span><strong>${money(data.financial.operationalExpenses)}</strong></div>
        <div class="metric"><span>Lucro operacional</span><strong>${money(operationalProfitForReport(data))}</strong></div>
        ${withdrawalBreakdownMetrics(data.financial.withdrawals, "metric", data.partnerWithdrawalControl)}
        <div class="metric"><span>Resultado após retiradas</span><strong class="${operationalResultForReport(data) < 0 ? "negative" : "positive"}">${money(operationalResultForReport(data))}</strong></div>
        <div class="metric"><span>Ajustes da conta</span><strong class="${data.accountAdjustmentTotals.balance < 0 ? "negative" : "positive"}">${money(data.accountAdjustmentTotals.balance)}</strong></div>
      </div>
      ${closing ? `
        <div class="closing-record">
          <span><b>Fechado em</b>${new Date(closing.closedAt).toLocaleString("pt-BR")}</span>
          <span><b>Resultado registrado</b>${money(closing.availableForWithdrawal)}</span>
          <span><b>Saldo da conta</b>${money(closing.accountBalance)}</span>
          <span><b>Lançamentos</b>${closing.cashEntries}</span>
          <span><b>Status</b>${locked ? "Travada" : "Destravada"}</span>
          ${closing.reopenReason ? `<span><b>Motivo da reabertura</b>${escapeHtml(closing.reopenReason)}</span>` : ""}
        </div>
      ` : `<p class="muted">Esta semana ainda não foi fechada.</p>`}
    </section>
  `;
}

function monthlyClosingPayload(data) {
  const recognizedDistribution = Number(data.partnerWithdrawalControl?.distributionTotal || 0);
  const cashWithdrawals = Number(data.partnerWithdrawalControl?.paidNowTotal || 0);
  const debtCompensation = Number(data.partnerWithdrawalControl?.paidToCashVanessa || 0)
    + Number(data.partnerWithdrawalControl?.paidToCashRaquel || 0);
  return {
    id: `${data.periodKey}-${Date.now()}`,
    periodKey: data.periodKey,
    closedAt: new Date().toISOString(),
    income: data.financial.income,
    operationalExpenses: data.financial.operationalExpenses,
    profitBeforeWithdrawals: operationalProfitForReport(data),
    withdrawals: data.financial.withdrawals,
    availableForWithdrawal: operationalResultForReport(data),
    suggestedWithdrawal: data.financial.suggestedWithdrawal,
    accountBalance: data.accountBalance,
    savingsBalance: data.savingsBalance,
    consolidatedBalance: data.consolidatedBalance,
    cashWithdrawals,
    debtCompensation,
    recognizedDistribution,
    distributionDifferenceFromProfit: roundedMoneyValue(
      recognizedDistribution - operationalProfitForReport(data)
    ),
    cashEntries: data.cashEntries.length,
    locked: true
  };
}

function monthlyClosingChecklist(data) {
  const withdrawalGroups = withdrawalHistoryGroups(data.cashEntries || []);
  const legacyWithdrawals = withdrawalGroups.filter(group => !group.partnerWithdrawalSnapshotId);
  const entriesWithoutAccount = (data.cashEntries || []).filter(entry => {
    return !isAccountTransferCashEntry(entry)
      && !String(entry.cashAccount || "").trim()
      && Math.abs(Number(entry.amount || 0)) >= 0.01;
  });
  const pendingPartners = roundedMoneyValue(
    Number(data.partnerWithdrawalControl?.pendingVanessa || 0)
      + Number(data.partnerWithdrawalControl?.pendingRaquel || 0)
  );
  const negativeAccounts = Object.entries(data.accountBalances || {})
    .filter(([key, value]) => key !== "unified" && Number(value || 0) < -0.009)
    .map(([key]) => cashAccountLabel(key));
  return [
    {
      id: "legacy-withdrawals",
      level: legacyWithdrawals.length ? "warning" : "ok",
      label: "Retiradas com fechamento detalhado",
      detail: legacyWithdrawals.length
        ? `${legacyWithdrawals.length} retirada(s) antiga(s) ainda precisam de revisão.`
        : "Todas as retiradas do mês têm conferência salva."
    },
    {
      id: "entries-without-account",
      level: entriesWithoutAccount.length ? "warning" : "ok",
      label: "Lançamentos vinculados a uma conta",
      detail: entriesWithoutAccount.length
        ? `${entriesWithoutAccount.length} lançamento(s) estão sem PF, PJ ou Cofrinho.`
        : "Todos os lançamentos do mês informam a conta."
    },
    {
      id: "pending-distribution",
      level: pendingPartners > 0.009 ? "warning" : "ok",
      label: "Distribuições pendentes das sócias",
      detail: pendingPartners > 0.009
        ? `${money(pendingPartners)} de direitos ainda não foram pagos nem compensados.`
        : "Não há distribuição pendente registrada no mês."
    },
    {
      id: "negative-accounts",
      level: negativeAccounts.length ? "warning" : "ok",
      label: "Saldos das contas",
      detail: negativeAccounts.length
        ? `${negativeAccounts.join(" e ")} com saldo negativo; confirme se o banco está conciliado.`
        : "PF e PJ estão sem saldo negativo no fim do período."
    }
  ];
}

function monthlyClosingPanel(data) {
  const closing = state.monthlyClosings[data.periodKey];
  const locked = isMonthClosed(`${data.periodKey}-01`);
  const canReopen = Boolean(closing && locked && canUser("manageClosings"));
  const operationalProfit = operationalProfitForReport(data);
  const cashWithdrawals = Number(data.partnerWithdrawalControl?.paidNowTotal || 0);
  const debtCompensation = Number(data.partnerWithdrawalControl?.paidToCashVanessa || 0)
    + Number(data.partnerWithdrawalControl?.paidToCashRaquel || 0);
  const recognizedDistribution = Number(data.partnerWithdrawalControl?.distributionTotal || 0);
  const distributionDifference = roundedMoneyValue(recognizedDistribution - operationalProfit);
  const closingChecklist = monthlyClosingChecklist(data);
  const closingWarnings = closingChecklist.filter(item => item.level !== "ok");

  return `
    <section class="panel report-section">
      <div class="section-heading">
        <div>
          <h2>Fechamento mensal</h2>
          <p class="muted-inline">Calcula faturamento, custos, retiradas e valor disponível do mês.</p>
        </div>
        <div class="actions">
          ${(!closing || !locked) && canUser("manageClosings") ? `<button type="button" id="close-month">${closing ? "Fechar novamente" : "Fechar mês"}</button>` : ""}
          ${canReopen ? `<button class="secondary" type="button" id="unlock-month" aria-controls="reopen-month-form" aria-expanded="false">Reabrir mês</button>` : ""}
        </div>
      </div>
      <h3>1. Resultado do negócio</h3>
      <p class="muted">Mostra somente receitas e custos operacionais do mês.</p>
      <div class="summary">
        <div class="metric"><span>Faturamento</span><strong>${money(data.financial.income)}</strong></div>
        <div class="metric"><span>Custos operacionais</span><strong>${money(data.financial.operationalExpenses)}</strong></div>
        <div class="metric"><span>Lucro operacional</span><strong>${money(operationalProfit)}</strong></div>
      </div>
      <h3>2. Caixa no fim do período</h3>
      <p class="muted">É o dinheiro real nas contas; pode incluir saldo anterior, ajustes e outros movimentos.</p>
      <div class="summary">
        <div class="metric"><span>Conta PF + PJ</span><strong>${money(data.accountBalance)}</strong></div>
        <div class="metric"><span>Cofrinho</span><strong>${money(data.savingsBalance)}</strong></div>
        <div class="metric"><span>Caixa consolidado</span><strong>${money(data.consolidatedBalance)}</strong></div>
        <div class="metric"><span>Saiu da conta em retiradas</span><strong>${money(cashWithdrawals)}</strong></div>
      </div>
      <h3>3. Distribuição das sócias</h3>
      <p class="muted">Recebido da conta e dívida compensada são separados. A compensação não movimenta o caixa.</p>
      <div class="summary">
        ${withdrawalBreakdownMetrics(data.financial.withdrawals, "metric", data.partnerWithdrawalControl)}
        <div class="metric"><span>Dívidas compensadas</span><strong>${money(debtCompensation)}</strong></div>
        <div class="metric"><span>Total reconhecido na distribuição</span><strong>${money(recognizedDistribution)}</strong></div>
        <div class="metric"><span>Diferença para o lucro operacional</span><strong class="${Math.abs(distributionDifference) >= 0.01 ? "negative" : "positive"}">${money(distributionDifference)}</strong><small>Não precisa ser zero: retiradas podem usar saldo anterior ou ocorrer em outro período.</small></div>
      </div>
      <h3>4. Conferência antes de fechar</h3>
      <p class="muted">Itens de atenção não alteram valores automaticamente. Revise-os e decida conscientemente se o mês pode ser fechado.</p>
      <div class="integrity-check-list monthly-closing-checklist">
        ${closingChecklist.map(item => `
          <article class="integrity-check ${item.level}">
            <span>${item.level === "ok" ? "OK" : "Revisar"}</span>
            <div><b>${escapeHtml(item.label)}</b><small>${escapeHtml(item.detail)}</small></div>
          </article>
        `).join("")}
      </div>
      ${closingWarnings.length ? `<p class="backup-list-state warning-state"><strong>${closingWarnings.length} ponto(s) de atenção</strong><span>O fechamento continuará permitido, mas as pendências ficarão visíveis para conferência.</span></p>` : ""}
      ${canReopen ? `
        <form id="reopen-month-form" class="closing-reopen-form" hidden>
          <label>Motivo da reabertura
            <input name="reason" minlength="5" placeholder="Ex.: corrigir lançamento do mês" required>
            <small>O motivo ficará registrado na auditoria.</small>
          </label>
          <div class="actions">
            <button type="submit">Confirmar reabertura</button>
            <button class="secondary" type="button" id="cancel-reopen-month">Cancelar</button>
          </div>
        </form>
      ` : ""}
      ${closing ? `
        <div class="closing-record">
          <span><b>Fechado em</b>${new Date(closing.closedAt).toLocaleString("pt-BR")}</span>
          <span><b>Resultado registrado</b>${money(closing.availableForWithdrawal)}</span>
          <span><b>Caixa consolidado</b>${money(closing.consolidatedBalance ?? data.consolidatedBalance)}</span>
          <span><b>Saiu da conta</b>${money(closing.cashWithdrawals ?? cashWithdrawals)}</span>
          <span><b>Distribuição reconhecida</b>${money(closing.recognizedDistribution ?? recognizedDistribution)}</span>
          <span><b>Compensação sem caixa</b>${money(closing.debtCompensation ?? debtCompensation)}</span>
          <span><b>Cofrinho sugerido</b>${money(closing.suggestedWithdrawal?.savings || 0)}</span>
          <span><b>Vanessa sugerido</b>${money(closing.suggestedWithdrawal?.vanessa || 0)}</span>
          <span><b>Raquel sugerido</b>${money(closing.suggestedWithdrawal?.raquel || 0)}</span>
          <span><b>Status</b>${locked ? "Travado" : "Destravado"}</span>
          ${closing.reopenReason ? `<span><b>Motivo da reabertura</b>${escapeHtml(closing.reopenReason)}</span>` : ""}
        </div>
      ` : `<p class="muted">Este mês ainda não foi fechado.</p>`}
    </section>
  `;
}

function storeSalesFilterDefaults() {
  const today = isoDate(new Date());
  const saved = state.storeSalesFilter || {};
  const period = ["day", "week", "month"].includes(saved.period) ? saved.period : "month";
  return {
    period,
    saleType: normalizedStoreSalesTypeFilter(saved.saleType),
    productId: normalizedStoreSalesProductFilter(saved.productId),
    date: saved.date || today,
    month: saved.month || today.slice(0, 7)
  };
}

function filteredStoreSales(filter = storeSalesFilterDefaults()) {
  return [...state.storeSales]
    .filter(entry => {
      if (!storeSaleMatchesTypeFilter(entry, filter.saleType)) {
        return false;
      }
      if (!storeSaleMatchesProductFilter(entry, filter.productId)) {
        return false;
      }
      const date = String(entry.date || "");
      if (filter.period === "day") {
        return date === filter.date;
      }
      if (filter.period === "week") {
        const range = weekRangeForDate(filter.date);
        return date >= range.start && date <= range.end;
      }
      return date.startsWith(filter.month);
    })
    .sort((a, b) => {
      const dateOrder = String(b.date || "").localeCompare(String(a.date || ""));
      return dateOrder || Number(b.id || 0) - Number(a.id || 0);
    });
}

function storeSalesFilterTitle(filter = storeSalesFilterDefaults()) {
  if (filter.period === "day") {
    return formatIsoDateBr(filter.date);
  }
  if (filter.period === "week") {
    const range = weekRangeForDate(filter.date);
    return `${formatIsoDateBr(range.start)} a ${formatIsoDateBr(range.end)}`;
  }
  return formatMonthKeyBr(filter.month);
}

function storeSalesMonthComparison(filter = storeSalesFilterDefaults()) {
  const currentMonth = filter.period === "month"
    ? filter.month
    : String(filter.date || isoDate(new Date())).slice(0, 7);
  const previousMonth = previousMonthKeyFromPeriod(currentMonth);
  const totalForMonth = month => state.storeSales
    .filter(entry => {
      return String(entry.date || "").startsWith(month)
        && storeSaleMatchesTypeFilter(entry, filter.saleType)
        && storeSaleMatchesProductFilter(entry, filter.productId);
    })
    .reduce((sum, entry) => sum + storeSalesFilteredQuantity(entry, filter.saleType), 0);
  const currentTotal = totalForMonth(currentMonth);
  const previousTotal = totalForMonth(previousMonth);
  const difference = currentTotal - previousTotal;
  const percentage = previousTotal > 0 ? (difference / previousTotal) * 100 : 0;
  const variation = previousTotal > 0
    ? `${difference >= 0 ? "+" : ""}${percentage.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`
    : currentTotal > 0
      ? "Sem base anterior"
      : "0%";
  return {
    currentMonth,
    previousMonth,
    currentTotal,
    previousTotal,
    difference,
    variation
  };
}

function normalizedStoreProductMonth(value) {
  const month = String(value || "").trim();
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return "";
  }
  const monthNumber = Number(month.slice(5, 7));
  return monthNumber >= 1 && monthNumber <= 12 ? month : "";
}

function sortedStoreProducts() {
  return [...(state.storeProducts || [])].sort((a, b) => {
    return String(a.name || "").localeCompare(String(b.name || ""), "pt-BR");
  });
}

function storeProductById(productId) {
  if (!productId) {
    return null;
  }
  return (state.storeProducts || []).find(product => String(product.id) === String(productId)) || null;
}

function storeSaleProductName(entry = {}) {
  const product = storeProductById(entry.productId);
  return product?.name || entry.productName || "Sem produto informado";
}

function storeProductRecipe(product = {}) {
  return pricingRecipeById(product.pricingRecipeId) || null;
}

function storeProductRecipeName(product = {}) {
  return storeProductRecipe(product)?.name || "Sem receita vinculada";
}

function storeProductRecipeOptions(selectedRecipeId = "") {
  const recipes = [...(state.pricingRecipes || [])].sort((a, b) => {
    return String(a.name || "").localeCompare(String(b.name || ""), "pt-BR");
  });
  return `
    <option value="">Sem receita vinculada</option>
    ${recipes.map(recipe => `
      <option value="${escapeHtml(recipe.id)}" ${String(recipe.id) === String(selectedRecipeId) ? "selected" : ""}>
        ${escapeHtml(recipe.name || "Receita sem nome")}
      </option>
    `).join("")}
  `;
}

function storeSaleProductOptions(selectedProductId = "") {
  const products = sortedStoreProducts();
  return `
    <option value="">Sem produto informado</option>
    ${products.map(product => `
      <option value="${escapeHtml(product.id)}" ${String(product.id) === String(selectedProductId) ? "selected" : ""}>
        ${escapeHtml(product.name || "Produto sem nome")}
      </option>
    `).join("")}
  `;
}

function storeProductQuantityForMonth(productId, month) {
  const entry = (state.storeProductQuantities || []).find(item => {
    return String(item.productId) === String(productId) && item.month === month;
  });
  return Number(entry?.quantity || 0);
}

function storeProductMonthTotal(month) {
  return (state.storeProductQuantities || [])
    .filter(entry => entry.month === month)
    .reduce((sum, entry) => sum + Number(entry.quantity || 0), 0);
}

function storeProductMonthlyHistory() {
  const grouped = new Map();
  (state.storeProductQuantities || []).forEach(entry => {
    const month = normalizedStoreProductMonth(entry.month);
    if (!month) {
      return;
    }
    const current = grouped.get(month) || { month, quantity: 0, products: 0 };
    current.quantity += Number(entry.quantity || 0);
    if (Number(entry.quantity || 0) > 0) {
      current.products += 1;
    }
    grouped.set(month, current);
  });
  return [...grouped.values()].sort((a, b) => b.month.localeCompare(a.month)).slice(0, 12);
}

function storeProductsPanel(month, editingProduct = null) {
  const selectedMonth = normalizedStoreProductMonth(month) || isoDate(new Date()).slice(0, 7);
  const products = sortedStoreProducts();
  const monthTotal = storeProductMonthTotal(selectedMonth);
  const productsWithQuantity = products.filter(product => {
    return storeProductQuantityForMonth(product.id, selectedMonth) > 0;
  }).length;
  const previousMonth = previousMonthKeyFromPeriod(selectedMonth);
  const previousTotal = storeProductMonthTotal(previousMonth);
  const history = storeProductMonthlyHistory();

  return `
    <div class="tool-grid store-products-layout">
      <section class="panel store-product-catalog">
        <h2>${editingProduct ? "Editar produto" : "Cadastrar produto"}</h2>
        <form id="store-product-form" class="form-grid single">
          <input name="productId" type="hidden" value="${escapeHtml(editingProduct?.id || "")}">
          <label>Nome do produto
            <input name="name" placeholder="Ex.: Cumbuca 500 ml" value="${escapeHtml(editingProduct?.name || "")}" required>
          </label>
          <label>Receita vinculada
            <select name="pricingRecipeId">
              ${storeProductRecipeOptions(editingProduct?.pricingRecipeId)}
            </select>
            <small>O vínculo permite calcular receita e lucro estimados por produto nos relatórios.</small>
          </label>
          <div class="actions">
            <button type="submit">${editingProduct ? "Salvar produto" : "Cadastrar produto"}</button>
            ${editingProduct ? `<button class="secondary" type="button" id="cancel-store-product-edit">Cancelar</button>` : ""}
          </div>
        </form>
        <div class="section-heading store-product-heading">
          <div>
            <h3>Produtos cadastrados</h3>
            <p class="muted-inline">${products.length} produto(s)</p>
          </div>
        </div>
        ${products.length ? `
          <div class="table-wrap report-table store-product-table">
            <table>
              <thead><tr><th>Produto</th><th>Receita vinculada</th><th>${formatMonthKeyBr(selectedMonth)}</th><th>Ações</th></tr></thead>
              <tbody>
                ${products.map(product => `
                  <tr>
                    <td><strong>${escapeHtml(product.name || "")}</strong></td>
                    <td>${escapeHtml(storeProductRecipeName(product))}</td>
                    <td>${storeProductQuantityForMonth(product.id, selectedMonth)}</td>
                    <td>
                      <div class="table-actions">
                        <button class="secondary table-action" type="button" data-edit-store-product="${escapeHtml(product.id)}">Editar</button>
                        <button class="danger table-action" type="button" data-delete-store-product="${escapeHtml(product.id)}">Excluir</button>
                      </div>
                    </td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        ` : `<p class="muted">Cadastre o primeiro produto para lançar quantidades mensais.</p>`}
      </section>

      <section class="panel report-section store-product-monthly">
        <div class="section-heading">
          <div>
            <h2>Quantidades por produto</h2>
            <p class="muted-inline">Controle detalhado do mês. Estes valores não alteram os totais da aba Vendas.</p>
          </div>
        </div>
        <form id="store-product-month-form" class="period-picker store-product-month-picker">
          <label>Mês
            <input name="month" type="month" value="${selectedMonth}" required>
          </label>
          <button type="submit">Abrir mês</button>
        </form>
        <div class="summary">
          <div class="metric" data-store-product-month-total><span>Unidades no mês</span><strong>${monthTotal}</strong></div>
          <div class="metric"><span>Produtos com quantidade</span><strong>${productsWithQuantity}</strong></div>
          <div class="metric"><span>${formatMonthKeyBr(previousMonth)}</span><strong>${previousTotal}</strong></div>
        </div>
        ${products.length ? `
          <form id="store-product-quantities-form" class="store-product-quantities-form">
            <input name="month" type="hidden" value="${selectedMonth}">
            <div class="store-product-quantity-list">
              ${products.map(product => `
                <label class="store-product-quantity-row">
                  <span>
                    <b>${escapeHtml(product.name || "")}</b>
                    <small>Quantidade em ${formatMonthKeyBr(selectedMonth)}</small>
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    inputmode="numeric"
                    value="${storeProductQuantityForMonth(product.id, selectedMonth) || ""}"
                    placeholder="0"
                    data-store-product-quantity="${escapeHtml(product.id)}"
                    aria-label="Quantidade de ${escapeHtml(product.name || "")}"
                  >
                </label>
              `).join("")}
            </div>
            <div class="actions">
              <button type="submit">Salvar quantidades do mês</button>
            </div>
          </form>
        ` : ""}
      </section>
    </div>
    <section class="panel report-section store-product-history">
      <div class="section-heading">
        <div>
          <h2>Histórico mensal</h2>
          <p class="muted-inline">Últimos 12 meses com quantidades lançadas por produto.</p>
        </div>
      </div>
      ${history.length ? `
        <div class="table-wrap report-table">
          <table>
            <thead><tr><th>Mês</th><th>Produtos</th><th>Total de unidades</th></tr></thead>
            <tbody>
              ${history.map(row => `
                <tr>
                  <td>${formatMonthKeyBr(row.month)}</td>
                  <td>${row.products}</td>
                  <td><strong>${row.quantity}</strong></td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      ` : `<p class="muted">Nenhuma quantidade mensal lançada ainda.</p>`}
    </section>
  `;
}

function renderStoreSales() {
  showStandardHero("Loja");
  setActive("loja");
  const today = isoDate(new Date());
  const storeTabs = [
    ["sales", "Vendas"],
    ["products", "Produtos"],
    ["channels", "Canais"]
  ];
  const requestedStoreView = new URLSearchParams(location.search).get("view");
  const requestedStoreProductMonth = normalizedStoreProductMonth(new URLSearchParams(location.search).get("month"));
  if (storeTabs.some(([tab]) => tab === requestedStoreView)) {
    state.storeViewTab = requestedStoreView;
  }
  if (requestedStoreProductMonth) {
    state.storeProductMonth = requestedStoreProductMonth;
  }
  if (!storeTabs.some(([tab]) => tab === state.storeViewTab)) {
    state.storeViewTab = "sales";
  }
  const activeStoreView = state.storeViewTab;
  const editing = state.editStoreSaleId !== null
    ? state.storeSales.find(entry => String(entry.id) === String(state.editStoreSaleId))
    : null;
  const editingSaleType = normalizedStoreSaleType(editing);
  const editingUnitsPerCombo = storeSaleUnitsPerCombo(editing);
  const editingChannelReceipt = state.editChannelReceiptId !== null
    ? state.channelReceipts.find(entry => String(entry.id) === String(state.editChannelReceiptId))
    : null;
  const editingStoreProduct = state.editStoreProductId !== null
    ? state.storeProducts.find(product => String(product.id) === String(state.editStoreProductId))
    : null;
  const filter = storeSalesFilterDefaults();
  const filteredEntries = filteredStoreSales(filter);
  const salesSummary = storeSalesSummary(filteredEntries);
  const comparison = storeSalesMonthComparison(filter);

  app.innerHTML = `
    ${viewTabsHtml("storeViewTab", activeStoreView, storeTabs)}
    ${viewPaneHtml("sales", activeStoreView, `
    <div class="tool-grid">
      <section class="panel">
        <h2>${editing ? "Editar venda da loja" : "Lançar venda da loja"}</h2>
        <form id="store-sale-form" class="form-grid single">
          <label>Data
            <input name="date" type="date" value="${editing?.date || today}" required>
          </label>
          <label>Produto vendido
            <select name="productId">
              ${storeSaleProductOptions(editing?.productId)}
            </select>
            <small>Cadastre produtos e vincule receitas em Loja &gt; Produtos para acompanhar o lucro.</small>
          </label>
          <fieldset class="store-sale-type">
            <legend>Tipo da venda</legend>
            <div class="store-sale-type-options">
              <label>
                <input name="saleType" type="radio" value="unit" ${editingSaleType === "unit" ? "checked" : ""}>
                <span><b>Unidade</b><small>Venda avulsa</small></span>
              </label>
              <label>
                <input name="saleType" type="radio" value="combo" ${editingSaleType === "combo" ? "checked" : ""}>
                <span><b>Combo</b><small>Mais de uma unidade</small></span>
              </label>
            </div>
          </fieldset>
          <label>
            <span data-store-sale-quantity-label>${editingSaleType === "combo" ? "Quantidade de combos" : "Quantidade de unidades"}</span>
            <input name="quantity" type="number" min="0" step="1" placeholder="0" value="${editing?.quantity || ""}" required>
          </label>
          <label id="store-combo-units-field" ${editingSaleType === "combo" ? "" : "hidden"}>
            Unidades em cada combo
            <input name="unitsPerCombo" type="number" min="1" step="1" placeholder="Ex.: 5" value="${editingSaleType === "combo" ? editingUnitsPerCombo : ""}">
          </label>
          <div class="store-sale-total" data-store-sale-total ${editingSaleType === "combo" ? "" : "hidden"} aria-live="polite">
            <span>Total deste lançamento</span>
            <strong data-store-sale-total-value>${editing ? storeSaleUnitQuantity(editing) : 0} unidades</strong>
          </div>
          <label>Observação
            <input name="notes" placeholder="Opcional" value="${escapeHtml(editing?.notes || "")}">
          </label>
          <div class="actions">
            <button type="submit">${editing ? "Salvar edição" : "Adicionar"}</button>
            ${editing ? `<button class="secondary" type="button" id="cancel-store-sale-edit">Cancelar</button>` : ""}
          </div>
        </form>
      </section>
      <section class="panel report-section store-sales-results">
        <form id="store-sales-filter-form" class="period-picker store-sales-filter" data-period="${filter.period}">
          <label>Período
            <select name="period" id="store-sales-filter-period">
              <option value="day" ${filter.period === "day" ? "selected" : ""}>Dia</option>
              <option value="week" ${filter.period === "week" ? "selected" : ""}>Semana</option>
              <option value="month" ${filter.period === "month" ? "selected" : ""}>Mês</option>
            </select>
          </label>
          <label>Tipo de venda
            <select name="saleType" id="store-sales-filter-type">
              <option value="all" ${filter.saleType === "all" ? "selected" : ""}>Todos</option>
              <option value="combo" ${filter.saleType === "combo" ? "selected" : ""}>Combos</option>
              <option value="unit" ${filter.saleType === "unit" ? "selected" : ""}>Unidades</option>
            </select>
          </label>
          <label>Produto
            <select name="productId" id="store-sales-filter-product">
              ${storeSalesProductFilterOptions(filter.productId)}
            </select>
          </label>
          <label class="store-sales-filter-date">Data / semana
            <input name="date" type="date" value="${filter.date}">
          </label>
          <label class="store-sales-filter-month">Mês
            <input name="month" type="month" value="${filter.month}">
          </label>
          <div class="store-sales-filter-actions">
            <button type="submit">Aplicar</button>
            <button class="secondary" type="button" id="clear-store-sales-filter">Limpar</button>
          </div>
        </form>
        <h2>${storeSalesFilterTitle(filter)}</h2>
        <div class="summary store-sales-summary" data-store-sales-summary>
          <div class="metric" data-store-sales-filter-combos><span>Combos vendidos</span><strong>${salesSummary.combos}</strong></div>
          <div class="metric" data-store-sales-filter-standalone-units><span>Unidades avulsas</span><strong>${salesSummary.standaloneUnits}</strong></div>
          <div class="metric" data-store-sales-filter-combo-units><span>Unidades nos combos</span><strong>${salesSummary.comboUnits}</strong></div>
          <div class="metric" data-store-sales-filter-total><span>Total de unidades</span><strong>${salesSummary.totalUnits}</strong></div>
          <div class="metric" data-store-sales-filter-best-day>
            <span>Melhor dia</span>
            <strong>${salesSummary.bestDay ? formatIsoDateBr(salesSummary.bestDay.date) : "—"}</strong>
            <small>${salesSummary.bestDay ? `${salesSummary.bestDay.totalUnits} unidade(s)` : "Sem vendas no filtro"}</small>
          </div>
          <div class="metric" data-store-sales-filter-launches><span>Lançamentos</span><strong>${filteredEntries.length}</strong></div>
        </div>
        ${salesSummary.days.length ? `
          <div class="store-sales-day-ranking" data-store-sales-day-ranking>
            <div>
              <h3>Vendas por dia</h3>
              <small>Ordenado pelo maior total de unidades vendidas.</small>
            </div>
            <div class="store-sales-day-list">
              ${salesSummary.days.slice(0, 5).map((day, index) => `
                <span class="${index === 0 ? "is-best" : ""}">
                  <b>${index === 0 ? "Mais vendeu" : formatIsoDateBr(day.date)}</b>
                  <small>${index === 0 ? `${formatIsoDateBr(day.date)} · ` : ""}${day.combos} combo(s) · ${day.standaloneUnits} avulsa(s)</small>
                  <strong>${day.totalUnits} un.</strong>
                </span>
              `).join("")}
            </div>
          </div>
        ` : ""}
        ${storeSalesTable(filteredEntries)}
        <div class="store-sales-comparison" data-store-sales-comparison>
          <h2>${storeSalesComparisonTitle(filter.saleType)}</h2>
          <div class="summary">
            <div class="metric"><span>${formatMonthKeyBr(comparison.currentMonth)}</span><strong>${comparison.currentTotal}</strong></div>
            <div class="metric"><span>${formatMonthKeyBr(comparison.previousMonth)}</span><strong>${comparison.previousTotal}</strong></div>
            <div class="metric"><span>Diferença</span><strong class="${comparison.difference < 0 ? "negative" : "positive"}">${comparison.difference >= 0 ? "+" : ""}${comparison.difference}</strong></div>
            <div class="metric"><span>Variação</span><strong>${comparison.variation}</strong></div>
          </div>
        </div>
      </section>
    </div>
    `)}
    ${viewPaneHtml("products", activeStoreView, storeProductsPanel(state.storeProductMonth, editingStoreProduct))}
    ${viewPaneHtml("channels", activeStoreView, `
      <section class="panel store-channels-panel">
        ${channelReceiptsPanel(editingChannelReceipt)}
      </section>
    `)}
  `;
  enhanceResponsiveTables(app);

  document.querySelectorAll('[data-view-tab-group="storeViewTab"] [data-view-tab]').forEach(button => {
    button.addEventListener("click", event => {
      const tab = event.currentTarget.dataset.viewTab;
      state.storeViewTab = tab;
      localStorage.setItem("storeViewTab", JSON.stringify(tab));
      history.replaceState(null, "", `/loja?view=${tab}`);
      renderStoreSales();
    });
  });

  const storeSaleForm = document.querySelector("#store-sale-form");
  const storeSaleQuantity = storeSaleForm?.querySelector('input[name="quantity"]');
  const storeComboUnits = storeSaleForm?.querySelector('input[name="unitsPerCombo"]');
  const storeComboUnitsField = document.querySelector("#store-combo-units-field");
  const storeSaleQuantityLabel = document.querySelector("[data-store-sale-quantity-label]");
  const storeSaleTotal = document.querySelector("[data-store-sale-total]");
  const storeSaleTotalValue = document.querySelector("[data-store-sale-total-value]");
  if (storeSaleForm && storeSaleQuantity && storeComboUnits && storeComboUnitsField && storeSaleQuantityLabel && storeSaleTotal && storeSaleTotalValue) {
    const updateStoreSaleType = () => {
      const saleType = storeSaleForm.querySelector('input[name="saleType"]:checked')?.value || "unit";
      const combo = saleType === "combo";
      storeComboUnitsField.hidden = !combo;
      storeComboUnits.required = combo;
      storeSaleQuantityLabel.textContent = combo ? "Quantidade de combos" : "Quantidade de unidades";
      storeSaleTotal.hidden = !combo;
      if (combo) {
        const total = Number(storeSaleQuantity.value || 0) * Number(storeComboUnits.value || 0);
        storeSaleTotalValue.textContent = `${total} unidade(s)`;
      }
    };
    storeSaleForm.querySelectorAll('input[name="saleType"]').forEach(field => {
      field.addEventListener("change", updateStoreSaleType);
    });
    storeSaleQuantity.addEventListener("input", updateStoreSaleType);
    storeComboUnits.addEventListener("input", updateStoreSaleType);
    updateStoreSaleType();
  }

  const storeProductForm = document.querySelector("#store-product-form");
  if (storeProductForm) {
    storeProductForm.addEventListener("submit", async event => {
      event.preventDefault();
      const values = readForm(event.currentTarget);
      const name = String(values.name || "").trim();
      if (!name) {
        showToast("Informe o nome do produto.", "error");
        return;
      }
      const duplicate = state.storeProducts.find(product => {
        return String(product.name || "").trim().toLocaleLowerCase("pt-BR") === name.toLocaleLowerCase("pt-BR")
          && String(product.id) !== String(editingStoreProduct?.id || "");
      });
      if (duplicate) {
        showToast("Já existe um produto com esse nome.", "warning");
        return;
      }
      const product = {
        id: editingStoreProduct?.id || `store-product-${Date.now()}`,
        name,
        pricingRecipeId: pricingRecipeById(values.pricingRecipeId)?.id || "",
        createdAt: editingStoreProduct?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      if (editingStoreProduct) {
        state.storeProducts = state.storeProducts.map(item => {
          return String(item.id) === String(editingStoreProduct.id) ? product : item;
        });
        recordAudit("Produto da loja editado", name);
      } else {
        state.storeProducts.push(product);
        recordAudit("Produto da loja cadastrado", name);
      }
      if (await persistState()) {
        state.editStoreProductId = null;
        renderStoreSales();
      }
    });
  }

  const cancelStoreProductEdit = document.querySelector("#cancel-store-product-edit");
  if (cancelStoreProductEdit) {
    cancelStoreProductEdit.addEventListener("click", () => {
      state.editStoreProductId = null;
      renderStoreSales();
    });
  }

  document.querySelectorAll("[data-edit-store-product]").forEach(button => {
    button.addEventListener("click", event => {
      state.editStoreProductId = event.currentTarget.dataset.editStoreProduct;
      state.storeViewTab = "products";
      renderStoreSales();
    });
  });

  document.querySelectorAll("[data-delete-store-product]").forEach(button => {
    button.addEventListener("click", async event => {
      const productId = event.currentTarget.dataset.deleteStoreProduct;
      const product = state.storeProducts.find(item => String(item.id) === String(productId));
      if (!product) {
        return;
      }
      const quantities = state.storeProductQuantities.filter(entry => {
        return String(entry.productId) === String(productId);
      });
      const linkedSales = state.storeSales.filter(entry => {
        return String(entry.productId) === String(productId);
      });
      if (linkedSales.length) {
        showToast(`Este produto possui ${linkedSales.length} venda(s). Edite o nome ou o vínculo em vez de excluí-lo.`, "warning");
        return;
      }
      const lockedQuantity = quantities.find(entry => isMonthClosed(`${entry.month}-01`));
      if (lockedQuantity) {
        showToast(`O mês ${formatMonthKeyBr(lockedQuantity.month)} está fechado. Reabra antes de excluir o produto.`, "warning");
        return;
      }
      const detail = quantities.length
        ? ` e ${quantities.length} lançamento(s) mensal(is)`
        : "";
      if (!confirm(`Excluir o produto ${product.name}${detail}?`)) {
        return;
      }
      state.storeProducts = state.storeProducts.filter(item => String(item.id) !== String(productId));
      state.storeProductQuantities = state.storeProductQuantities.filter(entry => {
        return String(entry.productId) !== String(productId);
      });
      if (String(state.editStoreProductId) === String(productId)) {
        state.editStoreProductId = null;
      }
      recordAudit("Produto da loja excluído", `${product.name}${detail}`);
      if (await persistState()) {
        renderStoreSales();
      }
    });
  });

  const storeProductMonthForm = document.querySelector("#store-product-month-form");
  if (storeProductMonthForm) {
    storeProductMonthForm.addEventListener("submit", event => {
      event.preventDefault();
      const month = normalizedStoreProductMonth(readForm(event.currentTarget).month);
      if (!month) {
        showToast("Informe um mês válido.", "error");
        return;
      }
      state.storeProductMonth = month;
      localStorage.setItem("storeProductMonth", JSON.stringify(month));
      history.replaceState(null, "", `/loja?view=products&month=${month}`);
      renderStoreSales();
    });
  }

  const storeProductQuantitiesForm = document.querySelector("#store-product-quantities-form");
  if (storeProductQuantitiesForm) {
    storeProductQuantitiesForm.addEventListener("submit", async event => {
      event.preventDefault();
      const month = normalizedStoreProductMonth(readForm(event.currentTarget).month);
      if (!month) {
        showToast("Informe um mês válido.", "error");
        return;
      }
      if (isMonthClosed(`${month}-01`)) {
        showToast(`O mês ${formatMonthKeyBr(month)} está fechado. Reabra antes de alterar quantidades.`, "warning");
        return;
      }
      const fields = [...event.currentTarget.querySelectorAll("[data-store-product-quantity]")];
      const values = fields.map(field => ({
        productId: field.dataset.storeProductQuantity,
        quantity: Number(field.value || 0)
      }));
      if (values.some(item => !Number.isInteger(item.quantity) || item.quantity < 0)) {
        showToast("Use somente quantidades inteiras iguais ou maiores que zero.", "error");
        return;
      }
      const currentEntries = state.storeProductQuantities.filter(entry => entry.month === month);
      const nextEntries = values
        .filter(item => item.quantity > 0)
        .map(item => {
          const existing = currentEntries.find(entry => {
            return String(entry.productId) === String(item.productId);
          });
          return {
            id: existing?.id || `store-product-quantity-${month}-${item.productId}`,
            productId: item.productId,
            month,
            quantity: item.quantity,
            updatedAt: new Date().toISOString()
          };
        });
      state.storeProductQuantities = [
        ...state.storeProductQuantities.filter(entry => entry.month !== month),
        ...nextEntries
      ];
      recordAudit("Quantidades mensais da loja salvas", `${formatMonthKeyBr(month)} - ${nextEntries.length} produto(s) - ${nextEntries.reduce((sum, entry) => sum + entry.quantity, 0)} unidade(s)`);
      if (await persistState()) {
        renderStoreSales();
      }
    });
  }

  const filterForm = document.querySelector("#store-sales-filter-form");
  const filterPeriod = document.querySelector("#store-sales-filter-period");
  if (filterForm && filterPeriod) {
    const updateFilterVisibility = () => {
      filterForm.dataset.period = filterPeriod.value;
    };
    filterPeriod.addEventListener("change", updateFilterVisibility);
    updateFilterVisibility();
    filterForm.addEventListener("submit", event => {
      event.preventDefault();
      const values = readForm(event.currentTarget);
      const selectedDate = values.date || today;
      state.storeSalesFilter = {
        period: values.period || "month",
        saleType: normalizedStoreSalesTypeFilter(values.saleType),
        productId: normalizedStoreSalesProductFilter(values.productId),
        date: selectedDate,
        month: values.period === "month"
          ? (values.month || today.slice(0, 7))
          : selectedDate.slice(0, 7)
      };
      localStorage.setItem("storeSalesFilter", JSON.stringify(state.storeSalesFilter));
      renderStoreSales();
    });
  }

  on("#clear-store-sales-filter", "click", () => {
    state.storeSalesFilter = {
      period: "month",
      saleType: "all",
      productId: "all",
      date: today,
      month: today.slice(0, 7)
    };
    localStorage.setItem("storeSalesFilter", JSON.stringify(state.storeSalesFilter));
    renderStoreSales();
  });

  on("#store-sale-form", "submit", event => {
    event.preventDefault();
    const values = readForm(event.currentTarget);
    const saleType = values.saleType === "combo" ? "combo" : "unit";
    const quantity = Number(values.quantity || 0);
    const unitsPerCombo = saleType === "combo" ? Number(values.unitsPerCombo || 0) : 1;
    const selectedProduct = storeProductById(values.productId);
    if (values.productId && !selectedProduct) {
      showToast("Selecione um produto cadastrado.", "error");
      return;
    }
    if (!values.date || !Number.isInteger(quantity) || quantity <= 0) {
      showToast("Informe data e uma quantidade inteira maior que zero.", "error");
      return;
    }
    if (saleType === "combo" && (!Number.isInteger(unitsPerCombo) || unitsPerCombo <= 0)) {
      showToast("Informe quantas unidades inteiras existem em cada combo.", "error");
      return;
    }
    if (blockClosedPeriod(values.date, editing ? "editar venda da loja" : "lançar venda da loja")) {
      return;
    }
    if (editing && editing.date !== values.date && blockClosedPeriod(editing.date, "mover venda da loja")) {
      return;
    }
    const entry = {
      id: editing?.id || Date.now(),
      date: values.date,
      productId: selectedProduct?.id || "",
      productName: selectedProduct?.name || "",
      saleType,
      quantity,
      unitsPerCombo,
      notes: values.notes || ""
    };
    if (editing) {
      state.storeSales = state.storeSales.map(item => String(item.id) === String(editing.id) ? entry : item);
      state.editStoreSaleId = null;
      recordAudit("Loja editada", storeSaleAuditDetail(entry));
    } else {
      state.storeSales.push(entry);
      recordAudit("Loja lançada", storeSaleAuditDetail(entry));
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
      state.storeViewTab = "sales";
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
      if (blockClosedPeriod(removed?.date, "excluir venda da loja")) {
        return;
      }
      state.storeSales = state.storeSales.filter(entry => Number(entry.id) !== id);
      if (String(state.editStoreSaleId) === String(id)) {
        state.editStoreSaleId = null;
      }
      recordAudit("Loja excluída", storeSaleAuditDetail(removed));
      persistState();
      renderStoreSales();
    });
  });

  bindChannelReceipts(renderStoreSales, editingChannelReceipt);
}

function reportTitleSuffix(data) {
  if (data.type === "day") {
    return `de ${formatIsoDateBr(data.date)}`;
  }
  if (data.type !== "week") {
    return `de ${formatMonthKeyBr(data.periodKey)}`;
  }

  return `de ${reportWeekRangeLabel()}`;
}

function reportExpenseCategoryOptions(selected = "all") {
  const categories = activeExpenseCategories();
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
    return category === selected
      || category.replace(/^supplier:/, "reason:") === selected
      || slugifyCategory(categoryName(category)) === selected;
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

function upcomingBills(limit = 6, { includeOverdue = true } = {}) {
  const today = isoDate(new Date());
  const end = isoDate(new Date(Date.now() + 30 * 86400000));

  const legacy = state.cash
    .filter(isPendingBill)
    .map(entry => ({
      ...entry,
      reminderDate: paymentReminderDate(entry)
    }));
  const planned = financialAccounts()
    .filter(account => accountOpenAmount(account) >= 0.01)
    .map(account => ({
      ...account,
      amount: accountOpenAmount(account),
      reminderDate: account.dueDate,
      plannedAccount: true
    }));

  return [...legacy, ...planned]
    .filter(entry => entry.reminderDate && entry.reminderDate <= end)
    .filter(entry => includeOverdue || entry.reminderDate >= today)
    .sort((a, b) => String(a.reminderDate).localeCompare(String(b.reminderDate)))
    .slice(0, limit);
}

function upcomingBillSourceLabel(entry = {}) {
  if (!entry.plannedAccount) {
    return "Boleto do Fluxo de Caixa";
  }
  return entry.kind === "receivable" ? "Conta a receber" : "Conta a pagar";
}

function upcomingBillHref(entry = {}) {
  if (entry.plannedAccount) {
    return `/financeiro?view=accounts&account=${encodeURIComponent(entry.id || "")}`;
  }
  return `/fluxo-de-caixa?edit=${encodeURIComponent(entry.id || "")}`;
}

function financialEmployees() {
  const employees = state.financialPlanning?.employees;
  return Array.isArray(employees)
    ? employees.map(employee => ({
      ...employee,
      id: String(employee.id || ""),
      name: String(employee.name || "").trim(),
      role: String(employee.role || "").trim(),
      monthlySalary: Math.max(0, Number(employee.monthlySalary || 0)).toFixed(2),
      startDate: String(employee.startDate || ""),
      active: employee.active !== false,
      notes: String(employee.notes || "").trim()
    })).filter(employee => employee.id && employee.name)
    : [];
}

function financialEmployeeById(id) {
  return financialEmployees().find(employee => String(employee.id) === String(id || "")) || null;
}

function normalizedEmployeeSearch(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function isFinancialEmployeeCategory(value) {
  return slugifyCategory(value) === "funcionarios"
    || slugifyCategory(categoryName(value)) === "funcionarios";
}

function financialEmployeeForEntry(entry = {}) {
  const explicit = financialEmployeeById(entry.employeeId);
  if (explicit) {
    return explicit;
  }
  if (!isFinancialEmployeeCategory(entry.category)) {
    return null;
  }
  const description = normalizedEmployeeSearch(entry.description);
  return [...financialEmployees()]
    .sort((a, b) => b.name.length - a.name.length)
    .find(employee => description.includes(normalizedEmployeeSearch(employee.name))) || null;
}

function isEmployeeExpenseEntry(entry = {}) {
  return entry.type === "expense"
    && isFinancialEmployeeCategory(entry.category)
    && !entry.reversedBy
    && !entry.reversalOf;
}

function employeeExpenseEntries(entries = state.cash) {
  return accountingCashEntries(entries).filter(isEmployeeExpenseEntry);
}

function financialEmployeeOptionsHtml(selectedId = "", { includeBlank = true } = {}) {
  const selected = String(selectedId || "");
  const employees = financialEmployees()
    .filter(employee => employee.active || employee.id === selected)
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  return `
    ${includeBlank ? `<option value="">Selecione o funcionário</option>` : ""}
    ${employees.map(employee => `
      <option value="${escapeHtml(employee.id)}" ${employee.id === selected ? "selected" : ""}>
        ${escapeHtml(employee.name)}${employee.active ? "" : " (inativo)"}
      </option>
    `).join("")}
  `;
}

function financialEmployeePaymentSummary(employee, entries = state.cash) {
  const linkedEntries = employeeExpenseEntries(entries).filter(entry => {
    return String(financialEmployeeForEntry(entry)?.id || "") === String(employee.id);
  });
  return {
    entries: linkedEntries,
    paid: linkedEntries.reduce((sum, entry) => sum + Number(entry.amount || 0), 0),
    last: [...linkedEntries].sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))[0] || null
  };
}

function financialAccounts() {
  return Array.isArray(state.financialPlanning?.accounts)
    ? state.financialPlanning.accounts
    : [];
}

const financialAccountCategories = [
  ["boleto", "Boleto"],
  ["conta", "Conta fixa"]
];

function normalizedFinancialAccountCategory(value) {
  return String(value || "").trim().toLowerCase() === "boleto" ? "boleto" : "conta";
}

function financialAccountCategoryLabel(value) {
  return financialAccountCategories.find(([key]) => key === normalizedFinancialAccountCategory(value))?.[1]
    || "Conta fixa";
}

function financialAccountCategoryOptionsHtml(selected = "") {
  const normalized = normalizedFinancialAccountCategory(selected);
  return financialAccountCategories.map(([value, label]) => `
    <option value="${value}" ${normalized === value ? "selected" : ""}>${label}</option>
  `).join("");
}

function normalizedFinancialAccountPaymentTiming(value) {
  return String(value || "").trim().toLowerCase() === "now" ? "now" : "future";
}

function financialAccountPaymentTimingLabel(value) {
  return normalizedFinancialAccountPaymentTiming(value) === "now"
    ? "Pagamento sinalizado para agora"
    : "Pagamento sinalizado para depois";
}

function accountPaidTotal(account = {}) {
  return (Array.isArray(account.payments) ? account.payments : [])
    .filter(payment => !payment.reversedAt)
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
}

function splitMoneyAcrossInstallments(total, count) {
  const safeCount = Math.max(1, Math.min(36, Number(count || 1)));
  const totalCents = Math.round(Number(total || 0) * 100);
  const base = Math.floor(totalCents / safeCount);
  const remainder = totalCents - (base * safeCount);
  return Array.from({ length: safeCount }, (_, index) => ((base + (index < remainder ? 1 : 0)) / 100).toFixed(2));
}

function accountSeriesFromValues(values = {}) {
  const mode = ["installments", "monthly"].includes(values.scheduleMode) ? values.scheduleMode : "single";
  const count = mode === "single" ? 1 : Math.max(2, Math.min(36, Number(values.scheduleCount || 2)));
  const amount = parseMoneyInput(values.amount);
  const kind = values.kind === "receivable" ? "receivable" : "payable";
  const amounts = mode === "installments"
    ? splitMoneyAcrossInstallments(amount, count)
    : Array.from({ length: count }, () => amount.toFixed(2));
  const seriesId = `account-series-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return amounts.map((scheduledAmount, index) => ({
    id: `account-${Date.now()}-${index}-${Math.random().toString(16).slice(2)}`,
    seriesId: count > 1 ? seriesId : "",
    seriesType: mode,
    seriesNumber: index + 1,
    seriesCount: count,
    kind,
    description: String(values.description || "").trim(),
    dueDate: addMonthsClamped(values.dueDate, index),
    amount: scheduledAmount,
    category: normalizedFinancialAccountCategory(values.category),
    paymentTiming: normalizedFinancialAccountPaymentTiming(values.paymentTiming),
    employeeId: "",
    cashAccount: normalizedCashAccount(values.cashAccount, ""),
    notes: String(values.notes || "").trim(),
    payments: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }));
}

function accountOpenAmount(account = {}) {
  return Math.max(0, Number(account.amount || 0) - accountPaidTotal(account));
}

function accountStatus(account = {}, today = isoDate(new Date())) {
  const open = accountOpenAmount(account);
  if (open < 0.01) {
    return "paid";
  }
  return String(account.dueDate || "") < today ? "overdue" : "pending";
}

function accountsSummary() {
  const today = isoDate(new Date());
  return financialAccounts().reduce((summary, account) => {
    const open = accountOpenAmount(account);
    const status = accountStatus(account, today);
    if (account.kind === "receivable") {
      summary.receivable += open;
    } else {
      summary.payable += open;
    }
    if (status === "overdue") {
      summary.overdue += 1;
      summary.overdueAmount += open;
    }
    return summary;
  }, { payable: 0, receivable: 0, overdue: 0, overdueAmount: 0 });
}

function financialAccountNotifications(days = 7) {
  const today = isoDate(new Date());
  const end = addDays(today, days);
  return financialAccounts()
    .filter(account => accountOpenAmount(account) >= 0.01)
    .filter(account => String(account.dueDate || "") <= end)
    .sort((a, b) => String(a.dueDate || "").localeCompare(String(b.dueDate || "")))
    .map(account => {
      const overdue = String(account.dueDate || "") < today;
      return {
        type: overdue ? "danger" : "warning",
        title: overdue
          ? `${account.kind === "receivable" ? "Recebimento" : "Conta"} em atraso`
          : `${account.kind === "receivable" ? "Recebimento" : "Conta"} vence em breve`,
        detail: `${account.description} - ${money(accountOpenAmount(account))} - ${dueDateDistanceLabel(account.dueDate)}`,
        action: `/financeiro?view=accounts&account=${encodeURIComponent(account.id)}`,
        accountId: account.id
      };
    });
}

function financialAccountFilterState() {
  const defaults = { search: "", kind: "all", status: "all" };
  state.financialAccountFilter = {
    ...defaults,
    ...(state.financialAccountFilter || {})
  };
  return state.financialAccountFilter;
}

function normalizeAccountSearch(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function accountMatchesFinancialFilter(account, filter = financialAccountFilterState()) {
  const status = accountStatus(account);
  const open = accountOpenAmount(account);
  if (filter.kind !== "all" && account.kind !== filter.kind) {
    return false;
  }
  if (filter.status === "open" && open < 0.01) {
    return false;
  }
  if (["pending", "overdue", "paid"].includes(filter.status) && status !== filter.status) {
    return false;
  }
  const query = normalizeAccountSearch(filter.search);
  if (!query) {
    return true;
  }
  return [
    account.description,
    account.category,
    financialEmployeeById(account.employeeId)?.name,
    cashAccountLabel(account.cashAccount, account.kind === "receivable" ? "income" : "expense"),
    account.notes,
    account.dueDate,
    account.kind === "receivable" ? "receber recebimento cliente" : "pagar pagamento fornecedor"
  ].some(value => normalizeAccountSearch(value).includes(query));
}

function financialEmployeesPanel(data = reportData()) {
  const editing = financialEmployeeById(state.editFinancialEmployeeId);
  const employees = financialEmployees()
    .sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name, "pt-BR"));
  const monthKey = data.periodKey || currentMonthKey();
  const monthEntries = employeeExpenseEntries(state.cash)
    .filter(entry => cashAccountingDate(entry).startsWith(monthKey));
  const unassignedEntries = monthEntries.filter(entry => !financialEmployeeForEntry(entry));
  const activeEmployees = employees.filter(employee => employee.active);
  const totalSalary = activeEmployees.reduce(
    (sum, employee) => sum + Number(employee.monthlySalary || 0),
    0
  );
  const totalPaid = monthEntries.reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const linkedPaid = monthEntries
    .filter(entry => financialEmployeeForEntry(entry))
    .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const remaining = Math.max(0, totalSalary - linkedPaid);

  return `
    <section class="panel report-section employees-panel">
      <div class="section-heading">
        <div>
          <h2>${editing ? "Editar funcionário" : "Funcionários da Cumbuca"}</h2>
          <p class="muted-inline">Cadastre salário e função. Saídas do caixa na categoria Funcionários são contabilizadas automaticamente aqui.</p>
        </div>
      </div>
      <div class="summary">
        <div class="metric"><span>Funcionários ativos</span><strong>${activeEmployees.length}</strong></div>
        <div class="metric"><span>Salários mensais</span><strong>${money(totalSalary)}</strong></div>
        <div class="metric"><span>Pago em ${formatMonthKeyBr(monthKey)}</span><strong>${money(totalPaid)}</strong></div>
        <div class="metric"><span>Falta pagar no mês</span><strong class="${remaining > 0 ? "negative" : "positive"}">${money(remaining)}</strong></div>
      </div>
      <form id="financial-employee-form" class="form-grid">
        <input name="id" type="hidden" value="${escapeHtml(editing?.id || "")}">
        <label>Nome do funcionário
          <input name="name" value="${escapeHtml(editing?.name || "")}" placeholder="Nome completo" required>
        </label>
        <label>Função
          <input name="role" value="${escapeHtml(editing?.role || "")}" placeholder="Ex.: cozinheira, auxiliar">
        </label>
        <label>Salário mensal
          <input name="monthlySalary" type="text" inputmode="decimal" value="${editing ? moneyInputValue(editing.monthlySalary) : ""}" placeholder="0,00" required>
        </label>
        <label>Data de admissão
          <input name="startDate" type="date" value="${editing?.startDate || isoDate(new Date())}">
        </label>
        <label>Status
          <select name="active">
            <option value="yes" ${editing?.active !== false ? "selected" : ""}>Ativo</option>
            <option value="no" ${editing?.active === false ? "selected" : ""}>Inativo</option>
          </select>
        </label>
        <label>Observação
          <input name="notes" value="${escapeHtml(editing?.notes || "")}" placeholder="Ex.: forma de pagamento, jornada">
        </label>
        <div class="actions">
          <button type="submit" ${canUser("editFinancial") ? "" : "disabled"}>${editing ? "Salvar funcionário" : "Cadastrar funcionário"}</button>
          ${editing ? `<button class="secondary" type="button" id="cancel-financial-employee-edit">Cancelar</button>` : ""}
        </div>
      </form>
    </section>
    <section class="panel report-section">
      <div class="section-heading">
        <div>
          <h2>Folha de ${formatMonthKeyBr(monthKey)}</h2>
          <p class="muted-inline">O pago considera somente saídas efetivas e não estornadas na categoria Funcionários.</p>
        </div>
      </div>
      ${employees.length ? `
        <div class="employee-grid">
          ${employees.map(employee => {
            const summary = financialEmployeePaymentSummary(employee, monthEntries);
            const salary = Number(employee.monthlySalary || 0);
            const balance = salary - summary.paid;
            return `
              <article class="employee-card ${employee.active ? "" : "inactive"}">
                <div class="employee-card-heading">
                  <div>
                    <span>${employee.active ? "Ativo" : "Inativo"}</span>
                    <strong>${escapeHtml(employee.name)}</strong>
                    <small>${escapeHtml(employee.role || "Função não informada")}</small>
                  </div>
                  <a class="secondary table-action" href="/fluxo-de-caixa?panel=entry&employee=${encodeURIComponent(employee.id)}">Lançar pagamento</a>
                </div>
                <div class="employee-card-values">
                  <span>Salário mensal<b>${money(salary)}</b></span>
                  <span>Pago no mês<b>${money(summary.paid)}</b></span>
                  <span>${balance >= 0 ? "Falta pagar" : "Pago a mais"}<b class="${balance > 0 ? "negative" : "positive"}">${money(Math.abs(balance))}</b></span>
                  <span>Último pagamento<b>${summary.last ? `${formatIsoDateBr(summary.last.date)} · ${money(summary.last.amount)}` : "Nenhum"}</b></span>
                </div>
                <div class="actions">
                  <button class="secondary table-action" type="button" data-edit-financial-employee="${escapeHtml(employee.id)}">Editar</button>
                  <button class="secondary table-action" type="button" data-toggle-financial-employee="${escapeHtml(employee.id)}">${employee.active ? "Inativar" : "Ativar"}</button>
                </div>
              </article>
            `;
          }).join("")}
        </div>
      ` : `<p class="muted">Nenhum funcionário cadastrado.</p>`}
      ${unassignedEntries.length ? `
        <div class="employee-unassigned">
          <h3>Pagamentos sem funcionário informado</h3>
          <p class="muted-inline">Esses valores entram no total da categoria, mas precisam ser vinculados para aparecer na ficha individual.</p>
          <div class="recent-list">
            ${unassignedEntries.map(entry => `
              <span>
                <b>${money(entry.amount)}</b>
                ${escapeHtml(entry.description || "Pagamento de funcionário")}
                <small>${formatIsoDateBr(entry.date)} · ${cashAccountLabel(entry.cashAccount, "expense")}</small>
                <span class="today-order-actions">
                  <a class="secondary table-action" href="/fluxo-de-caixa?edit=${encodeURIComponent(entry.id)}">Vincular funcionário</a>
                </span>
              </span>
            `).join("")}
          </div>
        </div>
      ` : ""}
    </section>
    <section class="panel report-section">
      <h2>Pagamentos de funcionários no mês</h2>
      ${monthEntries.length ? `
        <div class="table-wrap report-table">
          <table>
            <thead><tr><th>Data</th><th>Funcionário</th><th>Descrição</th><th>Conta</th><th>Valor</th><th></th></tr></thead>
            <tbody>
              ${[...monthEntries].sort((a, b) => String(b.date).localeCompare(String(a.date))).map(entry => {
                const employee = financialEmployeeForEntry(entry);
                return `
                  <tr>
                    <td>${formatIsoDateBr(entry.date)}</td>
                    <td>${employee ? escapeHtml(employee.name) : "Sem funcionário informado"}</td>
                    <td>${escapeHtml(entry.description || "")}</td>
                    <td>${cashAccountLabel(entry.cashAccount, "expense")}</td>
                    <td><strong>${money(entry.amount)}</strong></td>
                    <td><a class="secondary table-action" href="/fluxo-de-caixa?edit=${encodeURIComponent(entry.id)}">Editar</a></td>
                  </tr>
                `;
              }).join("")}
            </tbody>
          </table>
        </div>
      ` : `<p class="muted">Nenhum pagamento de funcionário lançado em ${formatMonthKeyBr(monthKey)}.</p>`}
    </section>
  `;
}

function accountsManagementPanel() {
  const editingId = state.editFinancialAccountId;
  const editing = financialAccounts().find(account => String(account.id) === String(editingId));
  const filter = financialAccountFilterState();
  const allAccounts = [...financialAccounts()].sort((a, b) => {
    const dueDateOrder = String(a.dueDate || "").localeCompare(String(b.dueDate || ""));
    if (dueDateOrder) {
      return dueDateOrder;
    }
    return String(a.description || "").localeCompare(String(b.description || ""), "pt-BR");
  });
  const accounts = allAccounts.filter(account => String(account.id) === String(editingId) || accountMatchesFinancialFilter(account, filter));
  const summary = accountsSummary();
  const accountFormCashType = editing?.kind === "receivable" ? "income" : "expense";
  return `
    <section class="panel report-section accounts-panel">
      <div class="section-heading">
        <div>
          <h2>${editing ? "Editar conta registrada" : "Contas a pagar e receber"}</h2>
          <p class="muted-inline">O compromisso não altera o saldo. Somente pagamentos e recebimentos registrados entram no caixa.</p>
        </div>
        <div class="actions">
          <a class="secondary" href="/fluxo-de-caixa?panel=transfers">Transferir entre contas</a>
        </div>
      </div>
      <div class="summary">
        <div class="metric"><span>A pagar</span><strong>${money(summary.payable)}</strong></div>
        <div class="metric"><span>A receber</span><strong>${money(summary.receivable)}</strong></div>
        <div class="metric"><span>Em atraso</span><strong class="${summary.overdue ? "negative" : "positive"}">${summary.overdue}</strong><small>${money(summary.overdueAmount)}</small></div>
      </div>
      <form id="financial-account-filter-form" class="account-toolbar">
        <label>Buscar conta
          <input name="search" value="${escapeHtml(filter.search || "")}" placeholder="Fornecedor, cliente, categoria ou vencimento">
        </label>
        <label>Tipo
          <select name="kind">
            <option value="all" ${filter.kind === "all" ? "selected" : ""}>Todas</option>
            <option value="payable" ${filter.kind === "payable" ? "selected" : ""}>A pagar</option>
            <option value="receivable" ${filter.kind === "receivable" ? "selected" : ""}>A receber</option>
          </select>
        </label>
        <label>Status
          <select name="status">
            <option value="all" ${filter.status === "all" ? "selected" : ""}>Todos</option>
            <option value="open" ${filter.status === "open" ? "selected" : ""}>Em aberto</option>
            <option value="overdue" ${filter.status === "overdue" ? "selected" : ""}>Atrasadas</option>
            <option value="pending" ${filter.status === "pending" ? "selected" : ""}>Pendentes</option>
            <option value="paid" ${filter.status === "paid" ? "selected" : ""}>Quitadas</option>
          </select>
        </label>
        <div class="account-toolbar-actions">
          <button class="secondary" type="submit">Filtrar</button>
          <button class="secondary" type="button" id="clear-financial-account-filter">Limpar</button>
          <button type="button" id="new-financial-account">Nova conta</button>
        </div>
      </form>
      <form id="financial-account-form" class="form-grid">
        <input name="id" type="hidden" value="${escapeHtml(editing?.id || "")}">
        <label>Tipo
          <select name="kind" id="financial-account-kind">
            <option value="payable" ${editing?.kind !== "receivable" ? "selected" : ""}>Conta a pagar</option>
            <option value="receivable" ${editing?.kind === "receivable" ? "selected" : ""}>Conta a receber</option>
          </select>
        </label>
        <label>Descrição
          <input name="description" id="financial-account-description" value="${escapeHtml(editing?.description || "")}" placeholder="Fornecedor, cliente ou compromisso" required>
        </label>
        <label>Vencimento
          <input name="dueDate" type="date" value="${editing?.dueDate || isoDate(new Date())}" required>
        </label>
        <label>Valor total
          <input name="amount" type="text" inputmode="decimal" value="${editing ? moneyInputValue(editing.amount) : ""}" placeholder="0,00" required>
        </label>
        <label>Categoria
          <select name="category" id="financial-account-category">
            ${financialAccountCategoryOptionsHtml(editing?.category)}
          </select>
          <small>Boleto fica ligado ao Caixa quando a baixa for registrada; conta fixa permanece no planejamento.</small>
        </label>
        <label>Pagamento
          <select name="paymentTiming" id="financial-account-payment-timing">
            <option value="now" ${normalizedFinancialAccountPaymentTiming(editing?.paymentTiming) === "now" ? "selected" : ""}>Pagar agora</option>
            <option value="future" ${normalizedFinancialAccountPaymentTiming(editing?.paymentTiming) !== "now" ? "selected" : ""}>Pagar futuramente</option>
          </select>
          <small id="financial-account-payment-timing-help">Sinaliza a intenção; o Caixa só muda ao registrar o pagamento.</small>
        </label>
        <label id="financial-account-cash-account-field">
          <span id="financial-account-cash-account-label">${editing?.kind === "receivable" ? "Conta prevista para recebimento" : "Conta corrente (opcional)"}</span>
          <select name="cashAccount" id="financial-account-cash-account">
            ${cashAccountOptionsHtml(
              normalizedCashAccount(editing?.cashAccount, editing?.kind === "receivable" ? "pf" : ""),
              accountFormCashType,
              false,
              editing?.kind === "receivable" ? "" : "Definir quando pagar"
            )}
          </select>
          <small id="financial-account-cash-account-help">${editing?.kind === "receivable" ? "Conta em que o valor deve entrar." : "Deixe em branco e escolha a conta somente ao registrar o pagamento."}</small>
        </label>
        <label>Observação
          <input name="notes" value="${escapeHtml(editing?.notes || "")}" placeholder="Parcela, referência ou contato">
        </label>
        <label>Geração
          <select name="scheduleMode" id="financial-account-schedule" ${editing ? "disabled" : ""}>
            <option value="single">Conta única</option>
            <option value="installments">Parcelar valor total</option>
            <option value="monthly">Repetir valor mensal</option>
          </select>
        </label>
        <label id="financial-account-count-field" ${editing ? "hidden" : ""}>Quantidade
          <input name="scheduleCount" type="number" min="2" max="36" step="1" value="2">
        </label>
        <div class="actions">
          <button type="submit">${editing ? "Salvar conta" : "Adicionar conta"}</button>
          ${editing ? `<button class="secondary" type="button" id="cancel-financial-account-edit">Cancelar</button>` : ""}
        </div>
      </form>
      ${accounts.length ? `
        <div class="account-list-heading">
          <strong>${accounts.length} de ${allAccounts.length} conta(s)</strong>
          <small>Ordenadas por vencimento. Use busca e filtros para achar contas antigas rapidamente.</small>
        </div>
        <div class="account-list">
          ${accounts.map(account => {
            const open = accountOpenAmount(account);
            const status = accountStatus(account);
            const paid = accountPaidTotal(account);
            const isEditing = String(account.id) === String(editingId);
            return `
              <article class="account-row ${status} ${isEditing ? "editing" : ""}">
                <div class="account-main">
                  <span class="status-label">${account.kind === "receivable" ? "A receber" : "A pagar"} · ${status === "paid" ? "Quitada" : status === "overdue" ? "Atrasada" : "Pendente"}</span>
                  <strong>${escapeHtml(account.description || "Conta")}</strong>
                  <small>Vencimento ${formatIsoDateBr(account.dueDate)}${account.seriesCount > 1 ? ` · ${account.seriesNumber}/${account.seriesCount}` : ""} · ${financialAccountCategoryLabel(account.category)} · ${financialAccountPaymentTimingLabel(account.paymentTiming)}${financialEmployeeById(account.employeeId) ? ` · ${escapeHtml(financialEmployeeById(account.employeeId).name)}` : ""} · ${account.kind === "payable" ? (account.cashAccount ? `${cashAccountLabel(account.cashAccount)} prevista` : "Definir conta no pagamento") : cashAccountLabel(account.cashAccount)}</small>
                </div>
                <div class="account-values">
                  <span>Total <b>${money(account.amount)}</b></span>
                  <span>Baixado <b>${money(paid)}</b></span>
                  <span>Em aberto <b class="${status === "overdue" ? "negative" : ""}">${money(open)}</b></span>
                </div>
                ${open >= 0.01 ? `
                  <form class="account-settlement-form" data-account-settlement="${escapeHtml(account.id)}">
                    <label>Data<input name="date" type="date" value="${account.dueDate || isoDate(new Date())}" required></label>
                    <label>Conta<select name="cashAccount" required>${cashAccountOptionsHtml(normalizedCashAccount(account.cashAccount, ""), account.kind === "receivable" ? "income" : "expense", false, account.kind === "receivable" ? "Escolha a conta do recebimento" : "Escolha a conta do pagamento")}</select></label>
                    <label>${account.kind === "receivable" ? "Valor recebido" : "Valor pago"}<input name="amount" type="text" inputmode="decimal" value="${moneyInputValue(open)}" required></label>
                    <button type="submit">${account.kind === "receivable" ? "Registrar recebimento" : "Registrar pagamento"}</button>
                  </form>
                ` : ""}
                ${(account.payments || []).length ? `
                  <details class="account-payment-history">
                    <summary>Histórico de baixas (${account.payments.length})</summary>
                    <div class="settlement-list">
                      ${account.payments.map(payment => `
                        <span class="${payment.reversedAt ? "reversed" : ""}">
                          <b>${money(payment.amount)}</b>
                          ${payment.reversedAt ? "Estornado" : account.kind === "receivable" ? "Recebido" : "Pago"} em ${formatIsoDateBr(payment.date)}
                          <small>${escapeHtml(payment.user || "Sistema")} · ${cashAccountLabel(payment.cashAccount)}${payment.reversedAt ? ` · estorno em ${formatIsoDateBr(payment.reversalDate)} · ${escapeHtml(payment.reversalReason || "")}` : ""}</small>
                          ${payment.reversedAt ? "" : `<button class="danger table-action" type="button" data-reverse-account="${escapeHtml(account.id)}" data-reverse-payment="${escapeHtml(payment.id)}">Estornar</button>`}
                        </span>
                      `).join("")}
                    </div>
                  </details>
                ` : ""}
                <div class="actions">
                  <button class="secondary table-action" type="button" data-edit-financial-account="${escapeHtml(account.id)}">${isEditing ? "Editando" : "Editar"}</button>
                  <button class="danger table-action" type="button" data-delete-financial-account="${escapeHtml(account.id)}">Excluir</button>
                </div>
              </article>
            `;
          }).join("")}
        </div>
      ` : `<p class="muted">Nenhuma conta cadastrada.</p>`}
    </section>
  `;
}

function upcomingBillsPanel({ title = "Próximos vencimentos", limit = 6, showSummary = false, includeOverdue = true } = {}) {
  const bills = upcomingBills(limit, { includeOverdue });
  const total = bills.reduce((sum, entry) => sum + Number(entry.amount || 0), 0);

  return `
    <section class="panel report-section">
      <h2>${title}</h2>
      ${bills.length ? `
        ${showSummary ? `
          <div class="summary">
            <div class="metric report-metric"><span>Pendentes</span><strong>${bills.length}</strong></div>
            <div class="metric report-metric"><span>Total a pagar</span><strong>${money(total)}</strong></div>
          </div>
        ` : ""}
        <div class="recent-list">
          ${bills.map(entry => `
            <span>
              <b>${money(entry.amount)}</b>
              ${escapeHtml(entry.description || categoryName(entry.category))}
              <small>${formatIsoDateBr(entry.reminderDate)} - ${upcomingBillSourceLabel(entry)} - ${dueDateDistanceLabel(entry.reminderDate)}</small>
              ${entry.id ? `<span class="today-order-actions"><a class="secondary table-action" href="${upcomingBillHref(entry)}">Abrir</a></span>` : ""}
            </span>
          `).join("")}
        </div>
      ` : `<p class="muted">Nenhuma conta pendente com vencimento nos próximos 30 dias.</p>`}
    </section>
  `;
}

function billsStatusPanel() {
  const today = isoDate(new Date());
  const bills = state.cash.filter(isBillEntry);
  const paid = bills.filter(entry => entry.paidAt);
  const pending = bills.filter(entry => !entry.paidAt && String(entry.dueDate || entry.date || "") >= today);
  const overdue = bills.filter(entry => !entry.paidAt && String(entry.dueDate || entry.date || "") < today);
  const plannedPaid = financialAccounts().filter(account => accountStatus(account, today) === "paid");
  const plannedPending = financialAccounts().filter(account => accountStatus(account, today) === "pending");
  const plannedOverdue = financialAccounts().filter(account => accountStatus(account, today) === "overdue");
  const total = entries => entries.reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const plannedTotal = entries => entries.reduce((sum, account) => sum + accountOpenAmount(account), 0);
  return `
    <section class="panel report-section">
      <h2>Contas por situação</h2>
      <div class="summary">
        <div class="metric"><span>Pagas</span><strong>${paid.length + plannedPaid.length}</strong><small>${money(total(paid) + plannedPaid.reduce((sum, account) => sum + Number(account.amount || 0), 0))}</small></div>
        <div class="metric"><span>Pendentes</span><strong>${pending.length + plannedPending.length}</strong><small>${money(total(pending) + plannedTotal(plannedPending))}</small></div>
        <div class="metric"><span>Vencidas</span><strong class="${overdue.length || plannedOverdue.length ? "negative" : "positive"}">${overdue.length + plannedOverdue.length}</strong><small>${money(total(overdue) + plannedTotal(plannedOverdue))}</small></div>
      </div>
    </section>
  `;
}

function cashForecastPanel(data) {
  const today = isoDate(new Date());
  const projection = withdrawalProjection(data);
  const averageDivisor = data.type === "month"
    ? Math.max(1, Number(today.slice(8, 10)))
    : Math.max(1, projection.elapsedDays);
  const dailyAverage = data.type === "month"
    ? data.financial.profitBeforeWithdrawals / averageDivisor
    : projection.dailyProfit;
  const accountBalances = accountBalanceBreakdownUntilDate(today);
  const savingsAccountBalance = savingsBalanceUntilDate(today);
  const accountDailyAverages = {
    unified: dailyAverage,
    pf: financialSummary(data.cashEntries.filter(entry => normalizedCashAccount(entry.cashAccount, "") === "pf")).profitBeforeWithdrawals / averageDivisor,
    pj: financialSummary(data.cashEntries.filter(entry => normalizedCashAccount(entry.cashAccount, "") === "pj")).profitBeforeWithdrawals / averageDivisor
  };
  accountDailyAverages.unassigned = accountDailyAverages.unified - accountDailyAverages.pf - accountDailyAverages.pj;
  const horizons = [7, 15, 30].map(days => {
    const end = addDays(today, days);
    const legacyBills = state.cash
      .filter(isPendingBill)
      .filter(entry => {
        const due = String(entry.dueDate || entry.date || "");
        return due >= today && due <= end;
      })
      .reduce((totals, entry) => {
        const amount = Number(entry.amount || 0);
        const cashAccount = normalizedCashAccount(entry.cashAccount, "");
        totals.unified += amount;
        totals[cashAccount || "unassigned"] += amount;
        return totals;
      }, { unified: 0, pf: 0, pj: 0, unassigned: 0 });
    const planned = financialAccounts()
      .filter(account => accountOpenAmount(account) >= 0.01)
      .filter(account => String(account.dueDate || "") >= today && String(account.dueDate || "") <= end)
      .reduce((totals, account) => {
        const kind = account.kind === "receivable" ? "receivable" : "payable";
        const amount = accountOpenAmount(account);
        const cashAccount = normalizedCashAccount(account.cashAccount, "") || "unassigned";
        totals.unified[kind] += amount;
        totals[cashAccount][kind] += amount;
        return totals;
      }, {
        unified: { payable: 0, receivable: 0 },
        pf: { payable: 0, receivable: 0 },
        pj: { payable: 0, receivable: 0 },
        unassigned: { payable: 0, receivable: 0 }
      });
    const forecasts = Object.fromEntries(
      ["unified", "pf", "pj", "unassigned"].map(cashAccount => {
        const bills = legacyBills[cashAccount] + planned[cashAccount].payable;
        const receivable = planned[cashAccount].receivable;
        return [cashAccount, {
          bills,
          receivable,
          projected: accountBalances[cashAccount] + (accountDailyAverages[cashAccount] * days) + receivable - bills
        }];
      })
    );
    const projectedCashBalances = Object.fromEntries(
      Object.entries(forecasts).map(([cashAccount, forecast]) => [cashAccount, forecast.projected])
    );
    const projectedConsolidated = roundedMoneyValue(
      projectedCashBalances.unified + savingsAccountBalance
    );
    return {
      days,
      bills: forecasts.unified.bills,
      receivable: forecasts.unified.receivable,
      projected: projectedConsolidated,
      projectedBalances: {
        ...projectedCashBalances,
        savings: savingsAccountBalance,
        consolidated: projectedConsolidated
      }
    };
  });
  return `
    <section class="panel report-section">
      <h2>Fluxo de caixa futuro</h2>
      <p class="muted-inline">Projeção pelo saldo atual, média operacional diária e contas já cadastradas.</p>
      <div class="summary">
        ${horizons.map(item => `
          <div class="metric cash-forecast-metric has-account-breakdown">
            <span>Próximos ${item.days} dias</span>
            <strong class="${item.projected < 0 ? "negative" : "positive"}">${money(item.projected)}</strong>
            <p class="dashboard-unified-label">PF + PJ + Cofrinho</p>
            ${dashboardAccountBreakdown(item.projectedBalances)}
            <small class="dashboard-forecast-detail">A pagar ${money(item.bills)} · a receber ${money(item.receivable)}</small>
          </div>
        `).join("")}
      </div>
    </section>
  `;
}

function accountAdjustmentsReportPanel(data) {
  const adjustments = [...data.accountAdjustmentEntries].sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const totals = cashTotals(adjustments);
  return `
    <section class="panel report-section">
      <h2>Ajustes da conta ${reportTitleSuffix(data)}</h2>
      <div class="summary">
        <div class="metric"><span>Quantidade</span><strong>${adjustments.length}</strong></div>
        <div class="metric"><span>Ajustes de entrada</span><strong>${money(totals.income)}</strong></div>
        <div class="metric"><span>Ajustes de saída</span><strong>${money(totals.expenses)}</strong></div>
        <div class="metric"><span>Saldo dos ajustes</span><strong class="${totals.balance < 0 ? "negative" : "positive"}">${money(totals.balance)}</strong></div>
      </div>
      ${adjustments.length ? `
        <div class="table-wrap report-table">
          <table>
            <thead><tr><th>Data</th><th>Motivo</th><th>Tipo</th><th>Valor</th></tr></thead>
            <tbody>
              ${adjustments.map(entry => `
                <tr>
                  <td>${formatIsoDateBr(entry.date)}</td>
                  <td>${escapeHtml(entry.description || "Ajuste da conta")}</td>
                  <td>${entry.type === "expense" ? "Saída" : "Entrada"}</td>
                  <td class="${entry.type === "expense" ? "negative" : "positive"}">${money(entry.amount)}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      ` : `<p class="muted">Nenhum ajuste no período.</p>`}
    </section>
  `;
}

function simplifiedStatementPanel(data) {
  if (data.type === "month") {
    const managementData = managementDreData(data.periodKey);
    return `
      <section class="panel report-section simplified-statement">
        <h2>DRE gerencial simplificada</h2>
        ${managementStatementHtml(managementData)}
      </section>
    `;
  }
  const operationalProfit = operationalProfitForReport(data);
  const finalResult = operationalResultForReport(data);
  return `
    <section class="panel report-section simplified-statement">
      <h2>Demonstrativo financeiro</h2>
      <div class="statement-line"><span>Receitas operacionais</span><strong>${money(data.financial.income)}</strong></div>
      <div class="statement-line"><span>(-) Custos operacionais</span><strong>${money(data.financial.operationalExpenses)}</strong></div>
      <div class="statement-line"><span>(=) Lucro operacional</span><strong>${money(operationalProfit)}</strong></div>
      ${withdrawalBreakdownStatement(data.financial.withdrawals, data.partnerWithdrawalControl)}
      <div class="statement-line statement-total"><span>(=) Resultado após retiradas</span><strong class="${finalResult < 0 ? "negative" : "positive"}">${money(finalResult)}</strong></div>
    </section>
  `;
}

function financialAuditPanel() {
  const rows = (state.auditLog || []).slice(0, 20);
  return `
    <section class="panel report-section">
      <h2>Histórico de alterações</h2>
      ${rows.length ? `
        <div class="recent-list audit-list">
          ${rows.map(entry => `
            <span>
              <b>${escapeHtml(entry.action)}</b>
              ${escapeHtml(entry.detail)}
              <small>${escapeHtml(entry.user || "Sistema")} - ${new Date(entry.createdAt).toLocaleString("pt-BR")}</small>
            </span>
          `).join("")}
        </div>
      ` : `<p class="muted">Nenhuma alteração registrada ainda.</p>`}
    </section>
  `;
}

function withdrawalProjection(data) {
  const bounds = reportPeriodBounds(data);
  const today = isoDate(new Date());
  const effectiveEnd = today < bounds.start ? bounds.start : today > bounds.end ? bounds.end : today;
  const elapsedDays = daysBetweenInclusive(bounds.start, effectiveEnd);
  const totalDays = daysBetweenInclusive(bounds.start, bounds.end);
  const remainingDays = Math.max(0, totalDays - elapsedDays);
  const dailyProfit = data.financial.profitBeforeWithdrawals / elapsedDays;
  const projectedProfitBeforeWithdrawals = dailyProfit * totalDays;
  const withdrawnTotal = cashWithdrawalsForReport(data);
  const projectedAvailableForWithdrawal = projectedProfitBeforeWithdrawals - withdrawnTotal;
  const currentAccountBalance = accountBalanceUntilDate(today);
  const currentSplit = withdrawalSplit(Math.max(0, currentAccountBalance));
  const projectedSplit = withdrawalSplit(Math.max(0, projectedAvailableForWithdrawal));

  return {
    bounds,
    elapsedDays,
    totalDays,
    remainingDays,
    dailyProfit,
    projectedProfitBeforeWithdrawals,
    projectedAvailableForWithdrawal,
    currentAccountBalance,
    currentSplit,
    projectedSplit
  };
}

function withdrawalProjectionPanel(data) {
  const projection = withdrawalProjection(data);
  return `
    <section class="panel report-section withdrawal-projection-panel">
      <div class="section-heading">
        <div>
          <h2>Projeção de retirada</h2>
          <p class="muted-inline">Estimativa baseada na média diária do período filtrado, antes de novas despesas ou receitas não lançadas.</p>
        </div>
      </div>
      <div class="summary projection-summary">
        <div class="metric"><span>Período</span><strong>${projection.elapsedDays}/${projection.totalDays} dias</strong></div>
        <div class="metric"><span>Média diária</span><strong class="${projection.dailyProfit < 0 ? "negative" : "positive"}">${money(projection.dailyProfit)}</strong></div>
        <div class="metric"><span>Lucro projetado</span><strong class="${projection.projectedProfitBeforeWithdrawals < 0 ? "negative" : "positive"}">${money(projection.projectedProfitBeforeWithdrawals)}</strong></div>
        <div class="metric"><span>Retirada projetada</span><strong class="${projection.projectedAvailableForWithdrawal < 0 ? "negative" : "positive"}">${money(projection.projectedAvailableForWithdrawal)}</strong></div>
      </div>
      <div class="dashboard-lane projection-lane">
        <div class="panel dashboard-panel">
          <h2>Se retirar hoje</h2>
          <div class="recent-list">
            <span><b>${money(projection.currentSplit.savings)}</b>Cofrinho ${Number(state.appConfig.splitSavingsPercent || 0)}%</span>
            <span><b>${money(projection.currentSplit.vanessa)}</b>Vanessa ${Number(state.appConfig.splitVanessaPercent || 0)}%</span>
            <span><b>${money(projection.currentSplit.raquel)}</b>Raquel ${Number(state.appConfig.splitRaquelPercent || 0)}%</span>
          </div>
        </div>
        <div class="panel dashboard-panel">
          <h2>Projetado até ${formatIsoDateBr(projection.bounds.end)}</h2>
          <div class="recent-list">
            <span><b>${money(projection.projectedSplit.savings)}</b>Cofrinho ${Number(state.appConfig.splitSavingsPercent || 0)}%</span>
            <span><b>${money(projection.projectedSplit.vanessa)}</b>Vanessa ${Number(state.appConfig.splitVanessaPercent || 0)}%</span>
            <span><b>${money(projection.projectedSplit.raquel)}</b>Raquel ${Number(state.appConfig.splitRaquelPercent || 0)}%</span>
          </div>
        </div>
      </div>
      <p class="muted">Faltam ${projection.remainingDays} dia(s) no período. A projeção muda conforme novas entradas, saídas e retiradas forem lançadas.</p>
    </section>
  `;
}

function financialCyclePanel() {
  const planning = state.financialPlanning || {};
  const hasCycle = Boolean(planning.cycleStartDate);
  const openingEntry = state.cash.find(entry => entry.category === "ajuste-conta" && entry.cycleOpening);
  const openingCashAccount = normalizedCashAccount(
    planning.openingCashAccount || openingEntry?.cashAccount || state.cashEntryDraft.cashAccount
  );
  return `
    <section class="panel report-section financial-cycle-panel">
      <div class="section-heading">
        <div>
          <h2>Ciclo financeiro</h2>
          <p class="muted-inline">Define o ponto inicial do saldo bancário e do cofrinho sem alterar o resultado operacional.</p>
        </div>
      </div>
      ${hasCycle ? `
        <div class="summary">
          <div class="metric"><span>Início do ciclo</span><strong>${formatIsoDateBr(planning.cycleStartDate)}</strong></div>
          <div class="metric"><span>Saldo inicial da conta</span><strong>${money(planning.openingBalance)}</strong><small>${cashAccountLabel(openingCashAccount)}</small></div>
          <div class="metric"><span>Cofrinho inicial</span><strong>${money(planning.openingSavings)}</strong></div>
          <div class="metric"><span>Observação</span><strong>${escapeHtml(planning.cycleNote || "Sem observação")}</strong></div>
        </div>
      ` : `<p class="muted">Nenhum ciclo financeiro definido.</p>`}
      <details>
        <summary>${hasCycle ? "Atualizar dados do ciclo" : "Definir saldo inicial"}</summary>
        <form id="financial-cycle-form" class="form-grid">
          <label>Data inicial
            <input name="date" type="date" value="${planning.cycleStartDate || isoDate(new Date())}" required>
          </label>
          <label>Saldo inicial da conta
            <input name="openingBalance" type="text" inputmode="decimal" value="${moneyInputValue(planning.openingBalance)}" required>
          </label>
          <label>Conta do saldo inicial
            <select name="openingCashAccount" required>
              ${cashAccountOptionsHtml(openingCashAccount, "income")}
            </select>
          </label>
          <label>Saldo inicial do cofrinho
            <input name="openingSavings" type="text" inputmode="decimal" value="${moneyInputValue(planning.openingSavings)}" required>
          </label>
          <label>Observação
            <input name="note" value="${escapeHtml(planning.cycleNote || "")}" placeholder="Ex.: início após conferência bancária">
          </label>
          <button type="submit">Salvar ciclo</button>
        </form>
      </details>
    </section>
  `;
}

function monthlyBudgetPanel() {
  const monthKey = reportPeriodKey();
  const rows = budgetStatus(monthKey);
  const summary = budgetSummary(monthKey);
  const configured = monthlyBudgets()[monthKey] || {};
  return `
    <section class="panel report-section budget-panel">
      <div class="section-heading">
        <div>
          <h2>Orçamento mensal por categoria</h2>
          <p class="muted-inline">Limites de ${formatMonthKeyBr(monthKey)} comparados apenas com saídas operacionais realizadas.</p>
        </div>
      </div>
      <div class="summary">
        <div class="metric"><span>Orçado</span><strong>${money(summary.limit)}</strong></div>
        <div class="metric"><span>Gasto</span><strong>${money(summary.spent)}</strong></div>
        <div class="metric"><span>Em alerta</span><strong class="${summary.warning ? "warning-text" : "positive"}">${summary.warning}</strong></div>
        <div class="metric"><span>Excedidos</span><strong class="${summary.exceeded ? "negative" : "positive"}">${summary.exceeded}</strong></div>
      </div>
      <form id="monthly-budget-form" class="form-grid budget-form">
        <input name="month" type="hidden" value="${monthKey}">
        <label>Categoria
          <select name="category">
            ${activeExpenseCategories()
              .filter(([key]) => !["retirada", "vanessa", "raquel", "cofrinho", "ajuste-conta"].includes(key))
              .map(([key, label]) => `<option value="${key}">${escapeHtml(label)}</option>`).join("")}
          </select>
        </label>
        <label>Limite mensal
          <input name="limit" type="text" inputmode="decimal" placeholder="0,00" required>
        </label>
        <button type="submit">Salvar limite</button>
      </form>
      ${rows.length ? `
        <div class="budget-list">
          ${rows.map(item => `
            <article class="budget-row ${item.percent >= 100 ? "exceeded" : item.percent >= 80 ? "warning" : ""}">
              <div>
                <strong>${escapeHtml(item.label)}</strong>
                <small>${money(item.spent)} de ${money(item.limit)}</small>
              </div>
              <div class="budget-progress" aria-label="${Math.round(item.percent)}% utilizado">
                <span style="width:${Math.min(100, item.percent)}%"></span>
              </div>
              <b class="${item.remaining < 0 ? "negative" : "positive"}">${item.remaining < 0 ? "Excedeu " : "Restam "}${money(Math.abs(item.remaining))}</b>
              <button class="danger table-action" type="button" data-delete-budget="${escapeHtml(item.category)}" data-budget-month="${monthKey}">Excluir</button>
            </article>
          `).join("")}
        </div>
      ` : `<p class="muted">Nenhum limite cadastrado para este mês.</p>`}
      ${Object.keys(configured).length && !rows.length ? `<p class="muted">Os limites deste mês estão zerados.</p>` : ""}
    </section>
  `;
}

function financialPlanVsActualPanel(data) {
  const budget = budgetSummary(data.periodKey);
  const budgetRows = budgetStatus(data.periodKey);
  const goal = Number(state.financialPlanning?.monthlyGoal || 0);
  const actualProfit = Number(data.financial?.profitBeforeWithdrawals || 0);
  const projection = withdrawalProjection(data);
  const projectedProfit = Number(projection.projectedProfitBeforeWithdrawals || 0);
  const goalDifference = goal > 0 ? projectedProfit - goal : 0;
  const expenseDifference = budget.limit > 0
    ? budget.limit - Number(data.financial?.operationalExpenses || 0)
    : 0;
  const goalProgress = goal > 0 ? Math.max(0, (actualProfit / goal) * 100) : 0;
  const budgetProgress = budget.limit > 0
    ? Math.max(0, (Number(data.financial?.operationalExpenses || 0) / budget.limit) * 100)
    : 0;

  return `
    <section class="panel report-section plan-vs-actual-panel">
      <div class="section-heading">
        <div>
          <h2>Planejado x realizado ${reportTitleSuffix(data)}</h2>
          <p class="muted-inline">Compara meta de lucro, projeção do período e limites de despesas com os valores já lançados.</p>
        </div>
        <a class="secondary table-action" href="/financeiro?view=planning">Ajustar planejamento</a>
      </div>
      <div class="plan-vs-actual-grid">
        <article>
          <span>Meta de lucro</span>
          <strong>${goal > 0 ? money(goal) : "Não definida"}</strong>
          <small>Realizado: ${money(actualProfit)}</small>
          <div class="budget-progress" aria-label="${Math.round(goalProgress)}% da meta">
            <span style="width:${Math.min(100, goalProgress)}%"></span>
          </div>
        </article>
        <article>
          <span>Projeção de lucro</span>
          <strong class="${projectedProfit < 0 ? "negative" : "positive"}">${money(projectedProfit)}</strong>
          <small>${goal > 0 ? `${goalDifference >= 0 ? "Acima" : "Abaixo"} da meta em ${money(Math.abs(goalDifference))}` : "Defina a meta no Planejamento"}</small>
        </article>
        <article>
          <span>Despesas planejadas</span>
          <strong>${budget.limit > 0 ? money(budget.limit) : "Sem limites"}</strong>
          <small>Realizado: ${money(data.financial?.operationalExpenses || 0)}</small>
          <div class="budget-progress ${budgetProgress >= 100 ? "is-danger" : budgetProgress >= 80 ? "is-warning" : ""}" aria-label="${Math.round(budgetProgress)}% do orçamento">
            <span style="width:${Math.min(100, budgetProgress)}%"></span>
          </div>
        </article>
        <article>
          <span>Saldo do orçamento</span>
          <strong class="${expenseDifference < 0 ? "negative" : "positive"}">${budget.limit > 0 ? money(expenseDifference) : "—"}</strong>
          <small>${budget.limit > 0 ? (expenseDifference >= 0 ? "Ainda disponível" : "Acima do planejado") : "Cadastre limites por categoria"}</small>
        </article>
      </div>
      ${budgetRows.length ? `
        <div class="budget-mini-list plan-category-list">
          ${budgetRows.slice(0, 6).map(item => `
            <span class="${item.percent >= 100 ? "negative" : item.percent >= 80 ? "warning-text" : ""}">
              <b>${Math.round(item.percent)}%</b>${escapeHtml(item.label)}
              <small>${money(item.spent)} realizado de ${money(item.limit)} planejado</small>
            </span>
          `).join("")}
        </div>
      ` : `<p class="muted">Cadastre limites em Financeiro &gt; Planejamento para completar esta comparação.</p>`}
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
          <input name="savings" type="text" inputmode="decimal" placeholder="0,00" value="${moneyInputValue(planning.savings)}">
        </label>
        <label>Meta de lucro mensal
          <input name="monthlyGoal" type="text" inputmode="decimal" placeholder="0,00" value="${moneyInputValue(planning.monthlyGoal)}">
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
        <div class="metric"><span>Meta mensal</span><strong>${money(planning.monthlyGoal)}</strong></div>
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

function bindFinancialEmployees() {
  const form = document.querySelector("#financial-employee-form");
  if (form) {
    form.addEventListener("submit", async event => {
      event.preventDefault();
      const values = readForm(event.currentTarget);
      const name = String(values.name || "").trim();
      const monthlySalary = parseMoneyInput(values.monthlySalary);
      if (!name || monthlySalary <= 0) {
        showToast("Informe o nome e um salário mensal maior que zero.", "error");
        return;
      }
      const employees = financialEmployees();
      const current = employees.find(employee => String(employee.id) === String(values.id));
      const duplicate = employees.find(employee =>
        String(employee.id) !== String(values.id)
        && normalizedEmployeeSearch(employee.name) === normalizedEmployeeSearch(name)
      );
      if (duplicate) {
        showToast("Já existe um funcionário com esse nome.", "warning");
        return;
      }
      const employee = {
        id: current?.id || `employee-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        name,
        role: String(values.role || "").trim(),
        monthlySalary: monthlySalary.toFixed(2),
        startDate: values.startDate || "",
        active: values.active !== "no",
        notes: String(values.notes || "").trim(),
        createdAt: current?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      state.financialPlanning = {
        ...(state.financialPlanning || {}),
        employees: current
          ? employees.map(item => String(item.id) === String(current.id) ? employee : item)
          : [employee, ...employees]
      };
      state.editFinancialEmployeeId = null;
      recordAudit(
        current ? "Funcionário atualizado" : "Funcionário cadastrado",
        `${employee.name} - ${employee.role || "sem função"} - salário ${money(employee.monthlySalary)}`,
        { entityId: employee.id, before: current || null, after: employee }
      );
      if (await persistState()) {
        showToast(current ? "Funcionário atualizado." : "Funcionário cadastrado.", "success");
        renderFinance();
      }
    });
  }

  document.querySelectorAll("[data-edit-financial-employee]").forEach(button => {
    button.addEventListener("click", () => {
      state.editFinancialEmployeeId = button.dataset.editFinancialEmployee;
      renderFinance();
    });
  });

  on("#cancel-financial-employee-edit", "click", () => {
    state.editFinancialEmployeeId = null;
    renderFinance();
  });

  document.querySelectorAll("[data-toggle-financial-employee]").forEach(button => {
    button.addEventListener("click", async () => {
      const id = button.dataset.toggleFinancialEmployee;
      const employee = financialEmployeeById(id);
      if (!employee) {
        return;
      }
      const nextActive = !employee.active;
      if (!confirm(`${nextActive ? "Ativar" : "Inativar"} ${employee.name}? O histórico de pagamentos será preservado.`)) {
        return;
      }
      const updated = {
        ...employee,
        active: nextActive,
        updatedAt: new Date().toISOString()
      };
      state.financialPlanning = {
        ...(state.financialPlanning || {}),
        employees: financialEmployees().map(item => String(item.id) === String(id) ? updated : item)
      };
      recordAudit(
        nextActive ? "Funcionário ativado" : "Funcionário inativado",
        employee.name,
        { entityId: employee.id, before: employee, after: updated }
      );
      if (await persistState()) {
        renderFinance();
      }
    });
  });
}

function bindFinancialAccounts() {
  const filterForm = document.querySelector("#financial-account-filter-form");
  if (filterForm) {
    filterForm.addEventListener("submit", event => {
      event.preventDefault();
      const values = readForm(filterForm);
      state.financialAccountFilter = {
        search: String(values.search || "").trim(),
        kind: ["payable", "receivable"].includes(values.kind) ? values.kind : "all",
        status: ["open", "overdue", "pending", "paid"].includes(values.status) ? values.status : "all"
      };
      renderFinance();
    });
    filterForm.querySelectorAll("select").forEach(select => {
      select.addEventListener("change", () => {
        filterForm.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      });
    });
  }

  on("#clear-financial-account-filter", "click", () => {
    state.financialAccountFilter = { search: "", kind: "all", status: "all" };
    renderFinance();
  });

  on("#new-financial-account", "click", () => {
    state.editFinancialAccountId = null;
    renderFinance();
  });

  const form = document.querySelector("#financial-account-form");
  if (form) {
    form.addEventListener("submit", async event => {
      event.preventDefault();
      const values = readForm(event.currentTarget);
      const amount = parseMoneyInput(values.amount);
      if (!values.description || !values.dueDate || amount <= 0) {
        showToast("Informe descrição, vencimento e valor maior que zero.", "error");
        return;
      }
      const accounts = financialAccounts();
      const current = accounts.find(account => String(account.id) === String(values.id));
      if (current && amount + 0.009 < accountPaidTotal(current)) {
        showToast(`O valor total não pode ser menor que o já baixado: ${money(accountPaidTotal(current))}.`, "error");
        return;
      }
      const series = current ? [] : accountSeriesFromValues(values);
      const kind = values.kind === "receivable" ? "receivable" : "payable";
      const account = current ? {
        ...current,
        kind,
        description: String(values.description || "").trim(),
        dueDate: values.dueDate,
        amount: amount.toFixed(2),
        category: normalizedFinancialAccountCategory(values.category),
        paymentTiming: normalizedFinancialAccountPaymentTiming(values.paymentTiming),
        employeeId: String(current.employeeId || ""),
        cashAccount: normalizedCashAccount(values.cashAccount, ""),
        notes: String(values.notes || "").trim(),
        updatedAt: new Date().toISOString()
      } : series[0];
      state.financialPlanning = {
        ...(state.financialPlanning || {}),
        accounts: current
          ? accounts.map(item => String(item.id) === String(current.id) ? account : item)
          : [...series, ...accounts]
      };
      state.editFinancialAccountId = null;
      const generationDetail = current || series.length === 1
        ? ""
        : ` - ${series.length} ${values.scheduleMode === "installments" ? "parcela(s)" : "competência(s)"}`;
      recordAudit(current ? "Conta atualizada" : "Conta cadastrada", `${account.description} - ${money(amount)}${generationDetail} - inicia ${formatIsoDateBr(account.dueDate)}`, {
        entityId: account.id,
        before: current || null,
        after: current ? account : series
      });
      if (await persistState()) {
        renderFinance();
      }
    });
  }

  const scheduleField = document.querySelector("#financial-account-schedule");
  const scheduleCountField = document.querySelector("#financial-account-count-field");
  const accountKindField = document.querySelector("#financial-account-kind");
  const accountCashAccountField = document.querySelector("#financial-account-cash-account");
  const accountCashAccountLabel = document.querySelector("#financial-account-cash-account-label");
  const accountCashAccountHelp = document.querySelector("#financial-account-cash-account-help");
  const accountCategoryField = document.querySelector("#financial-account-category");
  const accountPaymentTimingField = document.querySelector("#financial-account-payment-timing");
  const accountPaymentTimingHelp = document.querySelector("#financial-account-payment-timing-help");
  if (scheduleField && scheduleCountField) {
    const updateScheduleFields = () => {
      scheduleCountField.hidden = scheduleField.value === "single";
    };
    scheduleField.addEventListener("change", updateScheduleFields);
    updateScheduleFields();
  }
  if (accountKindField && accountCashAccountField) {
    const updateAccountFields = () => {
      const shouldShow = accountKindField.value === "payable";
      if (accountCashAccountLabel) {
        accountCashAccountLabel.textContent = shouldShow
          ? "Conta ligada ao Caixa (opcional)"
          : "Conta prevista para recebimento";
      }
      if (accountCashAccountHelp) {
        accountCashAccountHelp.textContent = shouldShow
          ? "Para pagamento futuro, deixe em branco; ao pagar, escolha PF, PJ ou Cofrinho."
          : "Conta em que o valor deve entrar.";
      }
      if (accountPaymentTimingHelp) {
        accountPaymentTimingHelp.textContent = normalizedFinancialAccountPaymentTiming(accountPaymentTimingField?.value) === "now"
          ? "Sinaliza pagamento agora; o Caixa só muda ao registrar a baixa."
          : "Sinaliza pagamento futuro; a conta fica pendente até a baixa.";
      }
    };
    accountKindField.addEventListener("change", () => {
      const isPayable = accountKindField.value === "payable";
      accountCashAccountField.innerHTML = cashAccountOptionsHtml(
        isPayable ? "" : normalizedCashAccount(accountCashAccountField.value),
        isPayable ? "expense" : "income",
        false,
        isPayable ? "Definir quando pagar" : ""
      );
      updateAccountFields();
    });
    accountCategoryField?.addEventListener("change", updateAccountFields);
    accountPaymentTimingField?.addEventListener("change", updateAccountFields);
    updateAccountFields();
  }

  document.querySelectorAll("[data-edit-financial-account]").forEach(button => {
    button.addEventListener("click", () => {
      state.editFinancialAccountId = button.dataset.editFinancialAccount;
      renderFinance();
    });
  });

  on("#cancel-financial-account-edit", "click", () => {
    state.editFinancialAccountId = null;
    renderFinance();
  });

  document.querySelectorAll("[data-delete-financial-account]").forEach(button => {
    button.addEventListener("click", async () => {
      const id = button.dataset.deleteFinancialAccount;
      const account = financialAccounts().find(item => String(item.id) === String(id));
      if (!account || !confirm(`Excluir a conta "${account.description}"? Os lançamentos já realizados continuarão no histórico.`)) {
        return;
      }
      state.financialPlanning = {
        ...(state.financialPlanning || {}),
        accounts: financialAccounts().filter(item => String(item.id) !== String(id))
      };
      recordAudit("Conta excluída", `${account.description} - ${money(account.amount)}`, { entityId: id, before: account });
      if (await persistState()) {
        showToast("Conta excluída.", "success");
        renderFinance();
      } else {
        showToast("Não foi possível excluir a conta.", "error");
      }
    });
  });

  document.querySelectorAll("[data-account-settlement]").forEach(settlementForm => {
    settlementForm.addEventListener("submit", async event => {
      event.preventDefault();
      const id = settlementForm.dataset.accountSettlement;
      const account = financialAccounts().find(item => String(item.id) === String(id));
      const values = readForm(settlementForm);
      const amount = parseMoneyInput(values.amount);
      if (!account || !values.date || amount <= 0) {
        showToast("Informe data e valor maior que zero.", "error");
        return;
      }
      const cashAccount = normalizedCashAccount(values.cashAccount, "");
      if (!cashAccount) {
        showToast(account.kind === "receivable" ? "Selecione a conta do recebimento." : "Selecione a conta usada no pagamento.", "error");
        return;
      }
      if (blockClosedPeriod(values.date, account.kind === "receivable" ? "registrar recebimento" : "registrar pagamento")) {
        return;
      }
      const payment = {
        id: `settlement-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        date: values.date,
        amount: amount.toFixed(2),
        cashAccount,
        user: state.currentUser?.name || state.currentUser?.username || "Sistema",
          createdAt: new Date().toISOString()
      };
      const paidAfterSettlement = accountPaidTotal(account) + amount;
      const adjustedAmount = Math.max(Number(account.amount || 0), paidAfterSettlement);
      const updated = {
        ...account,
        amount: adjustedAmount.toFixed(2),
        payments: [...(account.payments || []), payment],
        updatedAt: new Date().toISOString()
      };
      state.financialPlanning = {
        ...(state.financialPlanning || {}),
        accounts: financialAccounts().map(item => String(item.id) === String(id) ? updated : item)
      };
      state.cash.push({
        id: `account-settlement-${payment.id}`,
        description: `${account.kind === "receivable" ? "Recebimento" : "Pagamento"} - ${account.description}`,
        date: values.date,
        type: account.kind === "receivable" ? "income" : "expense",
        category: account.category || (account.kind === "receivable" ? "outros" : "reason:outros"),
        employeeId: account.kind === "payable" ? String(account.employeeId || "") : "",
        cashAccount: payment.cashAccount,
        amount: amount.toFixed(2),
        financialAccountId: account.id,
        financialAccountSettlementId: payment.id
      });
      const adjustmentDetail = adjustedAmount > Number(account.amount || 0) + 0.009
        ? ` - valor reajustado para ${money(adjustedAmount)}`
        : "";
      recordAudit(account.kind === "receivable" ? "Recebimento registrado" : "Pagamento registrado", `${account.description} - ${money(amount)} - restante ${money(Math.max(0, adjustedAmount - paidAfterSettlement))}${adjustmentDetail}`, {
        entityId: account.id,
        settlement: payment
      });
      if (await persistState()) {
        showToast(account.kind === "receivable" ? "Recebimento registrado." : "Pagamento registrado.", "success");
        renderFinance();
      }
    });
  });

  document.querySelectorAll("[data-reverse-payment]").forEach(button => {
    button.addEventListener("click", async () => {
      const accountId = button.dataset.reverseAccount;
      const paymentId = button.dataset.reversePayment;
      const account = financialAccounts().find(item => String(item.id) === String(accountId));
      const payment = account?.payments?.find(item => String(item.id) === String(paymentId));
      if (!account || !payment || payment.reversedAt) {
        showToast("Esta baixa não está disponível para estorno.", "error");
        return;
      }
      const reversalDate = prompt("Data do estorno (AAAA-MM-DD):", isoDate(new Date()));
      if (!reversalDate || !/^\d{4}-\d{2}-\d{2}$/.test(reversalDate)) {
        return;
      }
      const reason = prompt("Informe o motivo do estorno:");
      if (!reason?.trim()) {
        showToast("O motivo do estorno é obrigatório.", "error");
        return;
      }
      if (blockClosedPeriod(reversalDate, "estornar a baixa")) {
        return;
      }
      if (!confirm(`Estornar ${money(payment.amount)} de "${account.description}"? O lançamento original será preservado.`)) {
        return;
      }
      const reversalCashEntryId = `account-reversal-${payment.id}-${Date.now()}`;
      const updatedPayment = {
        ...payment,
        reversedAt: new Date().toISOString(),
        reversalDate,
        reversalReason: reason.trim(),
        reversedBy: state.currentUser?.name || state.currentUser?.username || "Sistema",
        reversalCashEntryId
      };
      const updatedAccount = {
        ...account,
        payments: account.payments.map(item => String(item.id) === String(payment.id) ? updatedPayment : item),
        updatedAt: new Date().toISOString()
      };
      state.financialPlanning = {
        ...(state.financialPlanning || {}),
        accounts: financialAccounts().map(item => String(item.id) === String(account.id) ? updatedAccount : item)
      };
      state.cash.push({
        id: reversalCashEntryId,
        description: `Estorno - ${account.description}`,
        date: reversalDate,
        type: account.kind === "receivable" ? "expense" : "income",
        category: account.category || (account.kind === "receivable" ? "reason:outros" : "outros"),
        employeeId: account.kind === "payable" ? String(account.employeeId || "") : "",
        cashAccount: normalizedCashAccount(payment.cashAccount || account.cashAccount),
        amount: Number(payment.amount || 0).toFixed(2),
        financialAccountId: account.id,
        financialAccountSettlementId: payment.id,
        reversal: true,
        reversalReason: reason.trim()
      });
      recordAudit("Baixa estornada", `${account.description} - ${money(payment.amount)} - ${reason.trim()}`, {
        entityId: account.id,
        settlementId: payment.id,
        reversalCashEntryId
      });
      if (await persistState()) {
        showToast("Baixa estornada e saldo da conta reaberto.", "success");
        renderFinance();
      }
    });
  });
}

function bindFinancialPlanning() {
  const cycleForm = document.querySelector("#financial-cycle-form");
  if (cycleForm) {
    cycleForm.addEventListener("submit", async event => {
      event.preventDefault();
      const values = readForm(event.currentTarget);
      const date = values.date || isoDate(new Date());
      const openingBalance = parseMoneyInput(values.openingBalance);
      const openingSavings = parseMoneyInput(values.openingSavings);
      const openingCashAccount = normalizedCashAccount(values.openingCashAccount);
      const existingOpeningEntry = state.cash.find(entry => entry.category === "ajuste-conta" && entry.cycleOpening);
      if (blockClosedPeriod(date, "definir saldo inicial")) {
        return;
      }
      if (existingOpeningEntry && existingOpeningEntry.date !== date && blockClosedPeriod(existingOpeningEntry.date, "mover saldo inicial")) {
        return;
      }
      if (state.cash.length && !existingOpeningEntry && !confirm("Já existem movimentações. Deseja registrar este saldo inicial mesmo assim?")) {
        return;
      }
      state.cash = state.cash.filter(entry => !entry.cycleOpening);
      if (Math.abs(openingBalance) >= 0.01) {
        state.cash.push({
          id: `cycle-opening-${Date.now()}`,
          description: "Saldo inicial do ciclo financeiro",
          date,
          type: openingBalance >= 0 ? "income" : "expense",
          category: "ajuste-conta",
          cashAccount: openingCashAccount,
          amount: Math.abs(openingBalance).toFixed(2),
          cycleOpening: true
        });
      }
      state.financialPlanning = {
        ...(state.financialPlanning || {}),
        cycleStartDate: date,
        openingBalance: openingBalance.toFixed(2),
        openingCashAccount,
        openingSavings: openingSavings.toFixed(2),
        cycleNote: String(values.note || "").trim(),
        savings: openingSavings.toFixed(2),
        savingsUpdatedAt: date
      };
      recordAudit("Ciclo financeiro definido", `${formatIsoDateBr(date)} - ${cashAccountLabel(openingCashAccount)} ${money(openingBalance)} - cofrinho ${money(openingSavings)}`);
      if (await persistState()) {
        renderFinance();
      }
    });
  }

  const form = document.querySelector("#financial-planning-form");
  if (!form) {
    return;
  }

  form.addEventListener("submit", event => {
    event.preventDefault();
    const values = readForm(event.currentTarget);
    state.financialPlanning = {
      savings: parseMoneyInput(values.savings).toFixed(2),
      savingsUpdatedAt: state.financialPlanning?.savingsUpdatedAt || "",
      savingsHistory: savingsHistoryRows(),
      savingsExpectedBalance: state.financialPlanning?.savingsExpectedBalance || savingsExpectedBalance().toFixed(2),
      savingsExpectedUpdatedAt: state.financialPlanning?.savingsExpectedUpdatedAt || "",
      partnersHistory: partnersHistoryRows(),
      monthlyGoal: parseMoneyInput(values.monthlyGoal).toFixed(2),
      improvements: textLines(values.improvements),
      purchases: textLines(values.purchases),
      cycleStartDate: state.financialPlanning?.cycleStartDate || "",
      openingBalance: state.financialPlanning?.openingBalance || "",
      openingCashAccount: state.financialPlanning?.openingCashAccount || "",
      openingSavings: state.financialPlanning?.openingSavings || "",
      cycleNote: state.financialPlanning?.cycleNote || "",
      accounts: financialAccounts(),
      reconciliationHistory: state.financialPlanning?.reconciliationHistory || [],
      monthlyBudgets: monthlyBudgets()
    };
    recordAudit("Planejamento financeiro", `Guardado ${money(state.financialPlanning.savings)}`);
    persistState();
    renderFinance();
  });
}

function bindMonthlyBudget() {
  on("#monthly-budget-form", "submit", async event => {
    event.preventDefault();
    const values = readForm(event.currentTarget);
    const limit = parseMoneyInput(values.limit);
    if (!values.category || limit <= 0) {
      showToast("Informe categoria e limite maior que zero.", "error");
      return;
    }
    state.financialPlanning = {
      ...(state.financialPlanning || {}),
      monthlyBudgets: {
        ...monthlyBudgets(),
        [values.month]: {
          ...(monthlyBudgets()[values.month] || {}),
          [values.category]: limit.toFixed(2)
        }
      }
    };
    recordAudit("Orçamento mensal atualizado", `${formatMonthKeyBr(values.month)} - ${categoryName(values.category)} - ${money(limit)}`);
    if (await persistState()) {
      renderFinance();
    }
  });

  document.querySelectorAll("[data-delete-budget]").forEach(button => {
    button.addEventListener("click", async () => {
      const month = button.dataset.budgetMonth;
      const category = button.dataset.deleteBudget;
      if (!confirm(`Excluir o limite de ${categoryName(category)} em ${formatMonthKeyBr(month)}?`)) {
        return;
      }
      const monthBudgets = { ...(monthlyBudgets()[month] || {}) };
      delete monthBudgets[category];
      state.financialPlanning = {
        ...(state.financialPlanning || {}),
        monthlyBudgets: { ...monthlyBudgets(), [month]: monthBudgets }
      };
      recordAudit("Orçamento mensal excluído", `${formatMonthKeyBr(month)} - ${categoryName(category)}`);
      if (await persistState()) {
        renderFinance();
      }
    });
  });
}

function financeMonthPendingItems(data, locked) {
  const withdrawalAmounts = withdrawalBreakdownAmounts(data.financial.withdrawals, data.partnerWithdrawalControl);
  const operationalResult = operationalResultForReport(data);
  const daysWithEntries = [...new Set(
    data.cashEntries
      .map(entry => cashAccountingDate(entry))
      .filter(date => String(date || "").startsWith(data.periodKey))
  )].sort();
  const openDays = daysWithEntries.filter(date => {
    const closing = dayClosingForDate(date);
    return !closing || closing.locked === false;
  });
  const items = [];

  if (data.type !== "month") {
    items.push({
      level: "warning",
      title: "Filtro fora do mensal",
      detail: "O fechamento mensal usa o período de mês.",
      action: "period-month",
      actionLabel: "corrigir"
    });
  }

  if (operationalResult < -0.009) {
    items.push({
      level: "danger",
      title: "Resultado negativo",
      detail: `Resultado após retiradas em ${money(operationalResult)}.`,
      action: "view-cash",
      actionLabel: "ver lançamento"
    });
  }

  if (data.accountBalance < -0.009) {
    items.push({
      level: "danger",
      title: "Saldo da conta negativo",
      detail: `Saldo acumulado em ${money(data.accountBalance)}.`,
      action: "view-cash",
      actionLabel: "corrigir"
    });
  }

  if (cashWithdrawalsForReport(data) > operationalProfitForReport(data) + 0.009) {
    items.push({
      level: "warning",
      title: "Retiradas acima do lucro",
      detail: `${money(cashWithdrawalsForReport(data))} saiu da conta para ${money(operationalProfitForReport(data))} de lucro.`,
      action: "view-withdrawals",
      actionLabel: "corrigir"
    });
  }

  if (Math.abs(data.accountAdjustmentTotals.balance || 0) >= 0.01) {
    items.push({
      level: "warning",
      title: "Ajustes de conta no mês",
      detail: `Ajustes somam ${money(data.accountAdjustmentTotals.balance)}.`,
      action: "view-cash",
      actionLabel: "ver lançamento"
    });
  }

  if (withdrawalAmounts.savings < -0.009) {
    items.push({
      level: "warning",
      title: "Cofrinho para revisar",
      detail: `Saldo do cofrinho no período ficou em ${money(withdrawalAmounts.savings)}.`,
      action: "view-withdrawals",
      actionLabel: "corrigir"
    });
  }

  if (!locked && openDays.length) {
    items.push({
      level: "warning",
      title: "Dias sem fechamento",
      detail: `${openDays.length} dia(s) com lançamento ainda aberto(s).`,
      action: "view-closing",
      actionLabel: "ver lançamento"
    });
  }

  return items;
}

function financeMonthCommandPanel(data, reportType, weekRange, { showClosing = true } = {}) {
  const closing = state.monthlyClosings?.[data.periodKey];
  const locked = Boolean(closing && closing.locked !== false);
  const pendingItems = financeMonthPendingItems(data, locked);
  const statusClass = locked ? "closed" : pendingItems.length ? "pending" : "open";
  const statusLabel = locked ? "Conferido" : pendingItems.length ? "Com pendências" : "Aberto";
  const statusDetail = locked
    ? `Fechado em ${formatDateTimeBr(closing.closedAt)}.`
    : pendingItems.length
      ? `${pendingItems.length} item(ns) para revisar antes de fechar.`
      : "Sem pendências locais para o período selecionado.";
  const withdrawalAmounts = withdrawalBreakdownAmounts(data.financial.withdrawals, data.partnerWithdrawalControl);
  const actionItems = pendingItems.length
    ? pendingItems.slice(0, 4)
    : [{
        level: "ok",
        title: locked ? "Mês já conferido" : "Pronto para fechar",
        detail: locked ? "O fechamento está travado para edição." : "Revise os números finais e feche o mês.",
        action: locked ? "view-closing" : "close-month",
        actionLabel: locked ? "ver lançamento" : "fechar mês"
      }];

  return `
    <section class="panel finance-month-command ${showClosing ? statusClass : "period-only"}">
      ${showClosing ? `
        <div class="finance-month-command-head">
          <div>
            <span>Fechamento do mês</span>
            <h2>${formatMonthKeyBr(data.periodKey)}</h2>
            <p>${statusDetail}</p>
          </div>
          <strong class="month-status-pill ${statusClass}">${statusLabel}</strong>
        </div>
      ` : ""}
      <form id="report-filter-form" class="finance-month-picker period-picker report-filter" data-period="${reportType}">
        <label class="finance-month-primary">Mês
          <select name="month">
            ${monthOptions(state.reportPeriod.month)}
          </select>
        </label>
        <label class="finance-month-year">Ano
          <input name="year" type="number" min="2020" max="2100" step="1" value="${state.reportPeriod.year}">
        </label>
        <label>Visualizar
          <select name="type" id="report-period-type">
            <option value="month" ${reportType === "month" ? "selected" : ""}>Mês</option>
            <option value="week" ${reportType === "week" ? "selected" : ""}>Semana</option>
            <option value="day" ${reportType === "day" ? "selected" : ""}>Dia</option>
          </select>
        </label>
        <label class="report-day-field">Dia
          <input name="date" type="date" value="${reportDate()}">
        </label>
        <label class="report-week-field">De
          <input name="start" type="date" value="${weekRange.start}">
        </label>
        <label class="report-week-field">Até
          <input name="end" type="date" value="${weekRange.end}">
        </label>
        <label class="report-week-field">Semana do cardápio
          <select name="week">
            ${weekOptions(state.reportPeriod.week)}
          </select>
        </label>
        <label>Saída
          <select name="expenseCategory">
            ${reportExpenseCategoryOptions(state.reportPeriod.expenseCategory || "all")}
          </select>
        </label>
        <button type="submit">Atualizar</button>
      </form>
      ${showClosing ? `
        <div class="finance-month-summary">
          <span><small>Entradas</small><b>${money(data.financial.income)}</b></span>
          <span><small>Saídas</small><b>${money(data.financial.operationalExpenses)}</b></span>
          <span><small>Retiradas</small><b>${money(data.financial.withdrawals.total)}</b></span>
          <span><small>Cofrinho</small><b>${money(withdrawalAmounts.savings)}</b></span>
          <span><small>Saldo</small><b class="${data.accountBalance < 0 ? "negative" : "positive"}">${money(data.accountBalance)}</b></span>
        </div>
        <div class="finance-month-pending-list">
          ${actionItems.map(item => `
            <article class="finance-month-pending ${item.level}">
              <div>
                <strong>${escapeHtml(item.title)}</strong>
                <span>${escapeHtml(item.detail)}</span>
              </div>
              <button class="secondary table-action" type="button" data-finance-month-action="${escapeHtml(item.action)}">${escapeHtml(item.actionLabel)}</button>
            </article>
          `).join("")}
        </div>
      ` : ""}
    </section>
  `;
}

function bindReportPeriodForm(renderFn, path) {
  const reportFilterForm = document.querySelector("#report-filter-form");
  const reportTypeField = document.querySelector("#report-period-type");
  if (!reportFilterForm || !reportTypeField) {
    return;
  }
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
      week: Number(values.week || state.reportPeriod.week || 1),
      date: values.date || reportDate(),
      start: values.start || weekRange.start,
      end: values.end || weekRange.end,
      expenseCategory: values.expenseCategory || "all"
    };
    localStorage.setItem("reportPeriod", JSON.stringify(state.reportPeriod));
    const weeklyQuery = state.reportPeriod.type === "week" ? `&semana=${state.reportPeriod.week}&inicio=${state.reportPeriod.start}&fim=${state.reportPeriod.end}` : "";
    const dayQuery = state.reportPeriod.type === "day" ? `&dia=${state.reportPeriod.date}` : "";
    history.replaceState(null, "", `/${path}?periodo=${state.reportPeriod.type}&ano=${state.reportPeriod.year}&mes=${state.reportPeriod.month}${weeklyQuery}${dayQuery}`);
    renderFn();
  });
}

function bindFinanceMonthCommand(renderFn) {
  document.querySelectorAll("[data-finance-month-action]").forEach(button => {
    button.addEventListener("click", () => {
      const action = button.dataset.financeMonthAction;
      if (action === "close-month") {
        const closeButton = document.querySelector("#close-month");
        if (closeButton) {
          closeButton.click();
          return;
        }
        state.financeViewTab = "closing";
        renderFn();
        return;
      }
      if (action === "period-month") {
        state.reportPeriod = {
          ...state.reportPeriod,
          type: "month"
        };
        localStorage.setItem("reportPeriod", JSON.stringify(state.reportPeriod));
        history.replaceState(null, "", `/financeiro?ano=${state.reportPeriod.year}&mes=${state.reportPeriod.month}`);
        renderFn();
        return;
      }
      if (action === "view-cash") {
        state.financeViewTab = "cash";
      } else if (action === "view-withdrawals") {
        state.financeViewTab = "withdrawals";
      } else if (action === "view-closing") {
        state.financeViewTab = "closing";
      } else if (action === "view-accounts") {
        state.financeViewTab = "accounts";
      }
      renderFn();
    });
  });
}

function bindMonthlyClosing(data, renderFn) {
  async function saveClosing(type, key, closing) {
    const response = await fetch("/api/closings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, key, closing })
    });
    const result = await response.json();
    if (!response.ok || !result.saved) {
      showToast(result.error || "Não foi possível fechar o período.", "error");
      return false;
    }
    await hydrateState();
    showToast("Período fechado.", "success");
    renderFn();
    return true;
  }

  async function reopenClosing(type, key, reason) {
    const normalizedReason = String(reason || "").trim();
    if (normalizedReason.length < 5) {
      showToast("Informe um motivo com pelo menos 5 caracteres.", "error");
      return false;
    }
    let response;
    let result;
    try {
      response = await fetch("/api/closings/reopen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, key, reason: normalizedReason })
      });
      result = await response.json();
    } catch {
      showToast("Não foi possível acessar o servidor para reabrir o período.", "error");
      return false;
    }
    if (!response.ok || !result.saved) {
      showToast(result.error || "Não foi possível reabrir o período.", "error");
      return false;
    }
    const stateKey = type === "week" ? "weeklyClosings" : "monthlyClosings";
    state[stateKey] = {
      ...(state[stateKey] || {}),
      [key]: result.closing
    };
    showToast("Período reaberto. Alterações estão liberadas.", "success");
    renderFn();
    return true;
  }

  const closeWeekButton = document.querySelector("#close-week");
  if (closeWeekButton) {
    closeWeekButton.addEventListener("click", async () => {
      const closing = weeklyClosingPayload(data);
      const key = weeklyClosingKey(closing.start, closing.end);
      if (!confirm(`Fechar a semana de ${formatIsoDateBr(closing.start)} a ${formatIsoDateBr(closing.end)}?`)) {
        return;
      }
      await saveClosing("week", key, closing);
    });
  }

  const unlockWeekButton = document.querySelector("#unlock-week");
  if (unlockWeekButton) {
    unlockWeekButton.addEventListener("click", async () => {
      const range = reportWeekRange();
      const key = weeklyClosingKey(range.start, range.end);
      const reason = prompt(`Informe o motivo para reabrir a semana de ${formatIsoDateBr(range.start)} a ${formatIsoDateBr(range.end)}.`);
      if (reason !== null) {
        await reopenClosing("week", key, reason);
      }
    });
  }

  const closeMonthButton = document.querySelector("#close-month");
  if (closeMonthButton) {
    closeMonthButton.addEventListener("click", async () => {
      const closing = monthlyClosingPayload(data);
      const checklistWarnings = monthlyClosingChecklist(data).filter(item => item.level !== "ok");
      const message = [
        `Fechar ${formatMonthKeyBr(data.periodKey)}?`,
        "",
        `Lucro operacional: ${money(closing.profitBeforeWithdrawals)}`,
        `Caixa consolidado: ${money(closing.consolidatedBalance)}`,
        `Saiu da conta em retiradas: ${money(closing.cashWithdrawals)}`,
        `Dívidas compensadas: ${money(closing.debtCompensation)}`,
        `Distribuição reconhecida: ${money(closing.recognizedDistribution)}`,
        `Diferença entre distribuição e lucro: ${money(closing.distributionDifferenceFromProfit)}`,
        checklistWarnings.length ? "" : null,
        checklistWarnings.length ? `ATENÇÃO: ${checklistWarnings.length} item(ns) precisam de revisão:` : null,
        ...checklistWarnings.map(item => `- ${item.label}: ${item.detail}`)
      ].filter(value => value !== null).join("\n");
      if (!confirm(message)) {
        return;
      }
      await saveClosing("month", data.periodKey, closing);
    });
  }

  const unlockMonthButton = document.querySelector("#unlock-month");
  const reopenMonthForm = document.querySelector("#reopen-month-form");
  if (unlockMonthButton && reopenMonthForm) {
    unlockMonthButton.addEventListener("click", () => {
      reopenMonthForm.hidden = false;
      unlockMonthButton.hidden = true;
      unlockMonthButton.setAttribute("aria-expanded", "true");
      reopenMonthForm.querySelector('input[name="reason"]')?.focus();
    });
    on("#cancel-reopen-month", "click", () => {
      reopenMonthForm.reset();
      reopenMonthForm.hidden = true;
      unlockMonthButton.hidden = false;
      unlockMonthButton.setAttribute("aria-expanded", "false");
      unlockMonthButton.focus();
    });
    reopenMonthForm.addEventListener("submit", async event => {
      event.preventDefault();
      const releaseSubmission = lockFormSubmission(event.currentTarget, "Reabrindo...");
      if (!releaseSubmission) {
        return;
      }
      try {
        const values = readForm(event.currentTarget);
        await reopenClosing("month", data.periodKey, values.reason);
      } finally {
        releaseSubmission();
      }
    });
  }
}

function financialIntegrityHtml(result) {
  if (!result?.database) {
    return `<div class="backup-list-state warning-state"><strong>Integridade indisponível</strong><span>Não foi possível consultar o banco agora.</span></div>`;
  }
  const statusLabels = {
    ok: "Tudo conferido",
    warning: "Atenção necessária",
    danger: "Correção necessária"
  };
  const statusText = statusLabels[result.status] || "Conferência financeira";
  const checkedAt = formatDateTimeBr(result.checkedAt);
  const reopenedCount = (result.closings?.unlockedMonths?.length || 0) + (result.closings?.unlockedWeeks?.length || 0);
  const backupLabel = result.backup?.updatedAt ? formatDateTimeBr(result.backup.updatedAt) : "Ausente";
  return `
    <div class="integrity-status ${result.status || "ok"}">
      <div>
        <strong>${statusText}</strong>
        <span>Verificado em ${checkedAt}</span>
      </div>
      <small>${result.status === "ok" ? "Sem pendências críticas" : "Revise os itens marcados abaixo"}</small>
    </div>
    <div class="integrity-metrics">
      <div class="integrity-metric"><span>Saldo PF + PJ</span><strong class="${result.totals?.balance < 0 ? "negative" : "positive"}">${money(result.totals?.balance || 0)}</strong></div>
      <div class="integrity-metric"><span>Saldo consolidado</span><strong class="${result.totals?.consolidatedBalance < 0 ? "negative" : "positive"}">${money(result.totals?.consolidatedBalance || 0)}</strong></div>
      <div class="integrity-metric"><span>Último backup</span><strong>${backupLabel}</strong></div>
      <div class="integrity-metric"><span>Períodos reabertos</span><strong>${reopenedCount}</strong></div>
    </div>
    <div class="integrity-check-list">
      ${(result.checks || []).map(check => `
        <article class="integrity-check ${check.level || "ok"}">
          <span>${check.level === "danger" ? "Corrigir" : check.level === "warning" ? "Revisar" : "OK"}</span>
          <div>
            <b>${escapeHtml(check.label)}</b>
            <small>${escapeHtml(integrityCheckDetail(check, result))}</small>
          </div>
        </article>
      `).join("")}
    </div>
    ${(result.recentTechnicalErrors || []).length ? `
      <div class="technical-error-list">
        <h3>Erros técnicos pendentes</h3>
        ${(result.recentTechnicalErrors || []).map(event => `
          <article class="integrity-check danger">
            <div>
              <b>${escapeHtml(event.event_type === "erro_api" ? "Erro da API" : "Falha no teste de restauração")}</b>
              <small>${escapeHtml(event.detail || "Sem detalhes")} · ${formatDateTimeBr(event.created_at)}</small>
            </div>
            <button class="secondary table-action" type="button" data-resolve-technical-error="${escapeHtml(String(event.id))}">Marcar como resolvido</button>
          </article>
        `).join("")}
      </div>
    ` : ""}
    ${(result.recentResolvedTechnicalErrors || []).length ? `
      <details class="technical-error-history">
        <summary>Erros técnicos resolvidos recentemente (${result.recentResolvedTechnicalErrors.length})</summary>
        <div class="integrity-check-list">
          ${result.recentResolvedTechnicalErrors.map(event => `
            <article class="integrity-check ok">
              <span>Resolvido</span>
              <div>
                <b>${escapeHtml(event.username || "Administradora")}</b>
                <small>${escapeHtml(event.detail || "Erro conferido.")} · ${formatDateTimeBr(event.created_at)}</small>
              </div>
            </article>
          `).join("")}
        </div>
      </details>
    ` : ""}
  `;
}

function integrityCheckDetail(check, result) {
  if (!check) {
    return "";
  }
  if (check.id === "account-balance") {
    const balance = Number(result.totals?.balance || 0);
    return balance < 0 ? `Saldo negativo de ${money(Math.abs(balance))}.` : `Saldo ${money(balance)}.`;
  }
  if (check.id === "backup") {
    if (!result.backup?.updatedAt) {
      return "Nenhum backup encontrado.";
    }
    const age = Math.max(0, (Date.now() - new Date(result.backup.updatedAt).getTime()) / 3600000);
    return `Último backup ${relativeHoursLabel(age)}.`;
  }
  if (check.id === "previous-month") {
    const month = formatMonthKeyBr(result.closings?.previousMonth);
    return result.closings?.previousMonthClosed ? `${month} está fechado.` : `${month} ainda está aberto.`;
  }
  if (check.id === "reopened-periods") {
    const months = result.closings?.unlockedMonths?.length || 0;
    const weeks = result.closings?.unlockedWeeks?.length || 0;
    if (!months && !weeks) {
      return "Nenhum período reaberto.";
    }
    return `${months === 1 ? "1 mês" : `${months} meses`} e ${weeks === 1 ? "1 semana" : `${weeks} semanas`} reabertos.`;
  }
  if (check.id === "backup-restorable" && result.restoreValidation?.valid) {
    return `Backup legível e completo (${formatBytesLabel(result.restoreValidation.bytes)}).`;
  }
  if (check.id === "technical-errors") {
    const count = result.recentTechnicalErrors?.length || 0;
    return count ? `${count} erro(s) registrado(s). Consulte o log técnico.` : "Nenhum erro técnico recente.";
  }
  return check.detail || "";
}

async function loadFinancialIntegrity(targetId = "financial-integrity-panel") {
  const target = document.querySelector(`#${targetId}`);
  if (!target) {
    return null;
  }
  try {
    const response = await fetch("/api/financial-integrity", { cache: "no-store" });
    const result = await response.json();
    target.innerHTML = financialIntegrityHtml(result);
    target.querySelectorAll("[data-resolve-technical-error]").forEach(button => {
      button.addEventListener("click", async () => {
        const note = prompt("Como este erro foi resolvido?", "Conferido e corrigido.");
        if (note === null) return;
        button.disabled = true;
        try {
          const resolveResponse = await fetch("/api/events/resolve", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: button.dataset.resolveTechnicalError, note })
          });
          const resolveResult = await resolveResponse.json();
          if (!resolveResponse.ok) throw new Error(resolveResult.error || "Não foi possível resolver o erro.");
          showToast("Erro técnico marcado como resolvido.", "success");
          await loadFinancialIntegrity(targetId);
        } catch (error) {
          button.disabled = false;
          showToast(error.message || "Não foi possível resolver o erro.", "error");
        }
      });
    });
    return result;
  } catch (error) {
    target.innerHTML = financialIntegrityHtml(null);
    return null;
  }
}

function pendingDashboardHtml(integrity) {
  const today = isoDate(new Date());
  const accountSummary = accountsSummary();
  const reconciliations = state.financialPlanning?.reconciliationHistory || [];
  const missingAdjustments = reconciliations.filter(item =>
    item.status === "adjusted"
    && item.adjustmentId
    && !state.cash.some(entry => String(entry.id) === String(item.adjustmentId))
  );
  const recentDifferences = reconciliations.filter(item => Math.abs(Number(item.difference || 0)) >= 0.01);
  const balance = integrity?.totals?.balance ?? accountBalanceUntilDate(today);
  const openPeriods = (integrity?.closings?.unlockedMonths?.length || 0) + (integrity?.closings?.unlockedWeeks?.length || 0);
  const backupMissing = !integrity?.backup?.updatedAt;
  const backupAge = integrity?.backup?.updatedAt
    ? Math.max(0, (Date.now() - new Date(integrity.backup.updatedAt).getTime()) / 3600000)
    : null;
  const items = [
    {
      level: balance < 0 ? "danger" : "ok",
      title: "Saldo da conta",
      detail: balance < 0 ? `Saldo negativo de ${money(Math.abs(balance))}.` : `Saldo atual ${money(balance)}.`,
      action: "/fluxo-de-caixa?panel=reconciliation"
    },
    {
      level: accountSummary.overdue ? "danger" : "ok",
      title: "Contas vencidas",
      detail: accountSummary.overdue ? `${accountSummary.overdue} conta(s), total ${money(accountSummary.overdueAmount)}.` : "Nenhuma conta vencida.",
      action: "/financeiro?view=accounts"
    },
    {
      level: openPeriods ? "warning" : "ok",
      title: "Períodos reabertos",
      detail: openPeriods ? `${openPeriods} período(s) permitem novas alterações.` : "Nenhum período reaberto.",
      action: "/financeiro?view=closing"
    },
    {
      level: missingAdjustments.length ? "danger" : recentDifferences.length ? "warning" : "ok",
      title: "Diferenças da conciliação",
      detail: missingAdjustments.length
        ? `${missingAdjustments.length} conciliação(ões) sem o ajuste correspondente.`
        : recentDifferences.length ? `${recentDifferences.length} diferença(s) conciliada(s) no histórico.` : "Nenhuma diferença registrada.",
      action: "/fluxo-de-caixa?panel=reconciliation"
    },
    {
      level: backupMissing || backupAge > 26 ? "danger" : "ok",
      title: "Backup",
      detail: backupMissing ? "Nenhum backup encontrado." : `Último backup há ${Math.round(backupAge)} hora(s).`,
      action: "/backups?tab=backup"
    }
  ];
  const pendingCount = items.filter(item => item.level !== "ok").length;
  const firstPendingAction = items.find(item => item.level !== "ok")?.action || "/financeiro?view=pending";
  return `
    <div class="pending-overview ${pendingCount ? "has-pending" : ""}">
      <a class="pending-summary" href="${firstPendingAction}">
        <span>Pendências financeiras</span>
        <strong>${pendingCount}</strong>
        <small>${pendingCount ? "item(ns) para revisar" : "Tudo em ordem"}</small>
      </a>
      <div class="pending-grid">
        ${items.map(item => `
          <a class="pending-item ${item.level}" href="${item.action}" aria-label="${escapeHtml(`${item.title}: ${item.detail}`)}">
            <span>${item.level === "danger" ? "Corrigir" : item.level === "warning" ? "Revisar" : "OK"}</span>
            <strong>${escapeHtml(item.title)}</strong>
            <small>${escapeHtml(item.detail)}</small>
          </a>
        `).join("")}
      </div>
    </div>
  `;
}

async function loadPendingDashboard() {
  const target = document.querySelector("#finance-pending-dashboard");
  if (!target) {
    return;
  }
  try {
    const response = await fetch("/api/financial-integrity?repair=1", { cache: "no-store" });
    const result = await response.json();
    target.innerHTML = pendingDashboardHtml(result);
  } catch (error) {
    target.innerHTML = pendingDashboardHtml(null);
  }
}

async function runBackupRestoreCheck() {
  const status = document.querySelector("#backup-restore-check-status");
  if (status) {
    status.textContent = "Validando o backup mais recente...";
  }
  try {
    const response = await fetch("/api/backup-restore-check", { method: "POST" });
    const result = await response.json();
    if (!response.ok || !result.valid) {
      showToast(result.error || "O backup não passou no teste.", "error");
      if (status) {
        status.textContent = result.error || "Falha na validação.";
      }
      return;
    }
    showToast("Backup validado sem alterar os dados.", "success");
    if (status) {
      status.textContent = `Backup ${result.backupDate || ""} validado: ${result.bytes || 0} bytes e todas as áreas reconhecidas.`;
    }
    loadTechnicalEvents();
  } catch (error) {
    showToast("Falha ao testar o backup.", "error");
    if (status) {
      status.textContent = "Não foi possível concluir o teste.";
    }
  }
}

function integrationStatusHtml(result) {
  if (!result) {
    return `<p class="muted">Não foi possível consultar as integrações.</p>`;
  }
  return `
    <div class="integration-status-grid">
      <div class="backup-list-state ${result.alerts?.configured ? "" : "warning-state"}">
        <strong>Alertas externos</strong>
        <span>${result.alerts?.configured ? "Webhook configurado." : "Não configurado no Vercel."}</span>
        ${result.alerts?.configured && isAdminUser() ? `<button class="secondary table-action" type="button" id="test-external-alert">Enviar teste</button>` : ""}
      </div>
      <div class="backup-list-state ${result.externalBackup?.configured ? "" : "warning-state"}">
        <strong>Backup externo</strong>
        <span>${result.externalBackup?.configured ? "Cópia automática configurada." : "Não configurado no Vercel."}</span>
        ${result.externalBackup?.configured && canUser("restoreBackup") ? `<button class="secondary table-action" type="button" id="test-external-backup">Enviar teste</button>` : ""}
      </div>
    </div>
  `;
}

async function testIntegration(path, successMessage) {
  try {
    const response = await fetch(path, { method: "POST" });
    const result = await response.json();
    if (!response.ok || !result.sent) {
      showToast(result.error || "A integração não respondeu.", "error");
      return;
    }
    showToast(successMessage, "success");
    loadTechnicalEvents();
  } catch (error) {
    showToast("Falha ao testar integração.", "error");
  }
}

async function loadIntegrationStatus() {
  const target = document.querySelector("#integration-status");
  if (!target) {
    return;
  }
  try {
    const response = await fetch("/api/integrations", { cache: "no-store" });
    const result = await response.json();
    target.innerHTML = integrationStatusHtml(result);
    on("#test-external-alert", "click", () => testIntegration("/api/integrations/test-alert", "Alerta externo enviado."));
    on("#test-external-backup", "click", () => testIntegration("/api/integrations/test-backup", "Backup externo de teste enviado."));
  } catch (error) {
    target.innerHTML = integrationStatusHtml(null);
  }
}

function financeDashboardPanel(data) {
  const projection = withdrawalProjection(data);
  const savings = Number(state.financialPlanning?.savings || 0);
  const monthlyGoal = Number(state.financialPlanning?.monthlyGoal || 0);
  const projectedVsGoal = monthlyGoal > 0 ? projection.projectedProfitBeforeWithdrawals - monthlyGoal : 0;
  const goalProgress = monthlyGoal > 0 ? Math.min(999, Math.round((data.financial.profitBeforeWithdrawals / monthlyGoal) * 100)) : 0;
  const resultAfterWithdrawals = operationalResultForReport(data);
  const availableAfterSavings = resultAfterWithdrawals + savings;
  const dueSoon = state.cash
    .filter(entry => entry.type === "expense" && entry.dueDate && !entry.paidAt)
    .filter(entry => entry.dueDate <= addDays(isoDate(new Date()), 7))
    .sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)));
  const expenseRanking = Object.entries(
    data.expenseEntries.reduce((totals, entry) => {
      const key = categoryName(entry.category);
      totals[key] = (totals[key] || 0) + Number(entry.amount || 0);
      return totals;
    }, {})
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const alerts = [
    resultAfterWithdrawals < 0 ? ["Retirada negativa", "As saídas e retiradas passaram do lucro do período."] : null,
    Math.abs(data.accountAdjustmentTotals.balance || 0) >= 0.01 ? ["Conta ajustada", `Ajustes da conta no período: ${money(data.accountAdjustmentTotals.balance)}.`] : null,
    dueSoon.length ? ["Contas próximas", `${dueSoon.length} conta(s) vencidas ou vencendo em até 7 dias.`] : null,
    projection.dailyProfit < 0 ? ["Média negativa", "O período está fechando com prejuízo médio diário."] : null
  ].filter(Boolean);

  return `
    <section class="finance-dashboard">
      <div class="finance-spotlight">
        <span>Dashboard financeiro</span>
        <h2>${money(operationalResultForReport(data))}</h2>
        <p>Resultado do lucro do período depois das retiradas já lançadas.</p>
      </div>
      <div class="finance-dashboard-grid">
        <div class="metric"><span>Lucro operacional</span><strong class="${operationalProfitForReport(data) < 0 ? "negative" : "positive"}">${money(operationalProfitForReport(data))}</strong></div>
        ${withdrawalBreakdownMetrics(data.financial.withdrawals, "metric", data.partnerWithdrawalControl)}
        <div class="metric"><span>Retirada projetada</span><strong class="${projection.projectedAvailableForWithdrawal < 0 ? "negative" : "positive"}">${money(projection.projectedAvailableForWithdrawal)}</strong></div>
        <div class="metric"><span>Guardado + disponível</span><strong class="${availableAfterSavings < 0 ? "negative" : "positive"}">${money(availableAfterSavings)}</strong></div>
        <div class="metric"><span>Meta mensal</span><strong>${monthlyGoal > 0 ? `${goalProgress}%` : "Sem meta"}</strong></div>
      </div>
      ${monthlyGoal > 0 ? `
        <div class="backup-list-state ${projectedVsGoal >= 0 ? "" : "warning-state"}">
          <strong>Projeção da meta</strong>
          <span>${projectedVsGoal >= 0 ? "Acima da meta" : "Abaixo da meta"} em ${money(Math.abs(projectedVsGoal))}. Meta: ${money(monthlyGoal)}.</span>
        </div>
      ` : ""}
      <div class="dashboard-lane finance-dashboard-lane">
        <div class="panel dashboard-panel">
          <h2>Maiores saídas</h2>
          ${expenseRanking.length ? `
            <div class="recent-list">
              ${expenseRanking.map(([label, total]) => `<span><b>${money(total)}</b>${escapeHtml(label)}<small>${Math.round((total / Math.max(1, data.financial.operationalExpenses)) * 100)}% das saídas operacionais</small></span>`).join("")}
            </div>
          ` : `<p class="muted">Nenhuma saída operacional no período.</p>`}
        </div>
        <div class="panel dashboard-panel">
          <h2>Alertas</h2>
          ${alerts.length ? `
            <div class="alert-list">
              ${alerts.map(([title, detail]) => `<span><b>${escapeHtml(title)}</b>${escapeHtml(detail)}</span>`).join("")}
            </div>
          ` : `<p class="muted">Nenhum alerta financeiro para o período.</p>`}
        </div>
      </div>
    </section>
  `;
}

function renderFinance() {
  ensureValidReportPeriod();
  const data = reportData();
  const reportType = state.reportPeriod.type || "month";
  const weekRange = reportWeekRange();
  const tabs = [
    ["summary", "Resumo"],
    ["pending", "Pendências"],
    ["accounts", "Contas"],
    ["employees", "Funcionários"],
    ["cash", "Fluxo"],
    ["planning", "Planejamento"],
    ["partners", "Sócias"],
    ["withdrawals", "Retiradas"],
    ["audit", "Auditoria"],
    ["closing", "Fechamento"]
  ];
  const financeParams = new URLSearchParams(location.search);
  const requestedTab = financeParams.get("view");
  const requestedAccountId = financeParams.get("account");
  if (tabs.some(([key]) => key === requestedTab)) {
    state.financeViewTab = requestedTab;
  }
  if (requestedAccountId && financialAccounts().some(account => String(account.id) === String(requestedAccountId))) {
    state.financeViewTab = "accounts";
    state.editFinancialAccountId = requestedAccountId;
  }
  const activeTab = tabs.some(([key]) => key === state.financeViewTab) ? state.financeViewTab : "summary";
  showStandardHero(activeTab === "planning" ? "Planejamento financeiro" : "Financeiro");
  setActive(activeTab === "employees" ? "funcionarios" : "financeiro");
  const activePane = (() => {
    if (activeTab === "summary") {
      return `
        ${financeDashboardPanel(data)}
        <section class="panel report-section">
          <div class="section-heading">
            <div>
              <h2>Integridade financeira</h2>
              <p class="muted-inline">Saldo acumulado, backup, fechamentos e ajustes conferidos diretamente no servidor.</p>
            </div>
          </div>
          <div id="financial-integrity-panel"><p class="muted">Conferindo valores...</p></div>
        </section>
        <section class="report-grid">
          <div class="metric report-metric"><span>Entradas operacionais</span><strong>${money(data.financial.income)}</strong></div>
          <div class="metric report-metric"><span>Saídas operacionais</span><strong>${money(data.financial.operationalExpenses)}</strong></div>
          <div class="metric report-metric"><span>Lucro operacional</span><strong class="${operationalProfitForReport(data) < 0 ? "negative" : "positive"}">${money(operationalProfitForReport(data))}</strong></div>
          ${withdrawalBreakdownMetrics(data.financial.withdrawals, "metric report-metric", data.partnerWithdrawalControl)}
          <div class="metric report-metric"><span>Resultado após retiradas</span><strong class="${operationalResultForReport(data) < 0 ? "negative" : "positive"}">${money(operationalResultForReport(data))}</strong></div>
          <div class="metric report-metric account-balance-metric has-account-breakdown">
            <span>Saldo consolidado</span>
            <strong class="${data.consolidatedBalance < 0 ? "negative" : "positive"}">${money(data.consolidatedBalance)}</strong>
            <p class="dashboard-unified-label">PF + PJ + Cofrinho</p>
            ${dashboardAccountBreakdown({ ...data.accountBalances, savings: data.savingsBalance })}
          </div>
          <div class="metric report-metric"><span>Ajustes</span><strong class="${data.accountAdjustmentTotals.balance < 0 ? "negative" : "positive"}">${money(data.accountAdjustmentTotals.balance)}</strong></div>
        </section>
        ${financeFoodAndBillsCostPanel(data.periodKey)}
        ${financialPlanVsActualPanel(data)}
        ${["month", "week"].includes(reportType) ? monthlyOriginCategoryPanel(data) : ""}
        ${simplifiedStatementPanel(data)}
        ${withdrawalProjectionPanel(data)}
      `;
    }
    if (activeTab === "pending") {
      return `
        <section class="panel report-section">
          <div class="section-heading">
            <div>
              <h2>Painel de pendências</h2>
              <p class="muted-inline">Saldo negativo, contas vencidas, períodos abertos, diferenças e backup em uma única conferência.</p>
            </div>
          </div>
          <div id="finance-pending-dashboard"><p class="muted">Conferindo pendências...</p></div>
        </section>
      `;
    }
    if (activeTab === "accounts") {
      return `
        <section class="report-grid account-balance-summary">
          <div class="metric report-metric account-balance-metric has-account-breakdown">
            <span>Saldo consolidado</span>
            <strong class="${data.consolidatedBalance < 0 ? "negative" : "positive"}">${money(data.consolidatedBalance)}</strong>
            <p class="dashboard-unified-label">PF + PJ + Cofrinho</p>
            ${dashboardAccountBreakdown({ ...data.accountBalances, savings: data.savingsBalance })}
          </div>
        </section>
        ${cashForecastPanel(data)}
        ${accountsManagementPanel()}
        ${billsStatusPanel()}
        ${upcomingBillsPanel()}
      `;
    }
    if (activeTab === "employees") {
      return financialEmployeesPanel(data);
    }
    if (activeTab === "cash") {
      return `
        ${cashForecastPanel(data)}
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
      `;
    }
    if (activeTab === "planning") {
      return `
        ${financialCyclePanel()}
        ${monthlyBudgetPanel()}
        ${financialPlanningPanel()}
      `;
    }
    if (activeTab === "partners") {
      return partnerAccountsPanel();
    }
    if (activeTab === "withdrawals") {
      return `
        ${withdrawalPersonReportPanel(data)}
        ${accountAdjustmentsReportPanel(data)}
      `;
    }
    if (activeTab === "audit") {
      return financialAuditPanel();
    }
    return `
      ${weeklyClosingPanel(data)}
      ${reportType === "month" ? monthlyClosingPanel(data) : ""}
    `;
  })();

  app.innerHTML = `
    ${viewTabsHtml("financeViewTab", activeTab, tabs)}
    ${["summary", "pending", "cash", "withdrawals", "audit", "closing"].includes(activeTab)
      ? financeMonthCommandPanel(data, reportType, weekRange, { showClosing: activeTab === "closing" })
      : ""}
    <div class="view-pane" data-view-pane="${activeTab}">${activePane}</div>
  `;

  bindReportPeriodForm(renderFinance, "financeiro");
  bindViewTabs("financeViewTab", renderFinance);
  bindFinanceMonthCommand(renderFinance);
  if (activeTab === "summary") {
    loadFinancialIntegrity();
  }
  if (activeTab === "pending") {
    loadPendingDashboard();
  }
  if (activeTab === "closing") {
    bindMonthlyClosing(data, renderFinance);
  }
  if (activeTab === "employees") {
    bindFinancialEmployees();
  }
  if (activeTab === "accounts") {
    bindFinancialAccounts();
  }
  if (activeTab === "planning") {
    bindFinancialPlanning();
    bindMonthlyBudget();
  }
  if (activeTab === "partners") {
    bindPartnerAccounts();
  }
  enhanceResponsiveTables(app);
  document.querySelectorAll("[data-export-withdrawals]").forEach(button => {
    button.addEventListener("click", () => exportWithdrawalReport(data));
  });
}

function renderReports() {
  ensureValidReportPeriod();
  showStandardHero("Relatórios");
  setActive("relatorios");
  const data = reportData();
  const reportType = state.reportPeriod.type || "month";
  const weekRange = reportWeekRange();
  const tabs = [
    ["summary", "Resumo"],
    ["financial", "Financeiro e sócias"],
    ["profitability", "Rentabilidade"],
    ["products", "Produtos"],
    ["income", "Entradas"],
    ["expenses", "Saídas"],
    ["withdrawals", "Retiradas"],
    ["closing", "Fechamento"]
  ];
  const activeTab = tabs.some(([key]) => key === state.reportViewTab) ? state.reportViewTab : "summary";

  app.innerHTML = `
    <section class="panel report-panel report-toolbar">
      <form id="report-filter-form" class="period-picker report-filter" data-period="${reportType}">
        <label>Período
          <select name="type" id="report-period-type">
            <option value="month" ${reportType === "month" ? "selected" : ""}>Mês</option>
            <option value="week" ${reportType === "week" ? "selected" : ""}>Semana</option>
            <option value="day" ${reportType === "day" ? "selected" : ""}>Dia</option>
          </select>
        </label>
        <label class="report-day-field">Dia
          <input name="date" type="date" value="${reportDate()}">
        </label>
        <label class="report-month-field">Ano
          <input name="year" type="number" min="2020" max="2100" step="1" value="${state.reportPeriod.year}">
        </label>
        <label class="report-month-field">Mês
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
        <label class="report-week-field">Semana do cardápio
          <select name="week">
            ${weekOptions(state.reportPeriod.week)}
          </select>
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
        <button class="secondary" type="button" data-export-report="channels">Canais CSV</button>
        <button class="secondary" type="button" data-export-report="clients">Clientes CSV</button>
        <button class="secondary" type="button" data-export-report="menu">Cardápio CSV</button>
        <button type="button" data-export-report="json">Relatório JSON</button>
        <button type="button" data-export-report="accountant-package">Pacote contador</button>
        <button type="button" data-export-report="xlsx">Relatório Excel</button>
        <button type="button" data-export-report="pdf">Relatório PDF</button>
      </div>
    </section>

    <section class="report-grid">
      <div class="metric report-metric"><span>Receita de pedidos</span><strong>${money(data.orderRevenue)}</strong></div>
      <div class="metric report-metric"><span>Total cumbucas</span><strong>${data.totalSoldQuantity}</strong></div>
      <div class="metric report-metric"><span>Entradas operacionais no caixa</span><strong>${money(data.income)}</strong></div>
      <div class="metric report-metric"><span>Saídas operacionais</span><strong>${money(data.financial.operationalExpenses)}</strong></div>
      <div class="metric report-metric"><span>Saldo da conta</span><strong class="${data.accountBalance < 0 ? "negative" : "positive"}">${money(data.accountBalance)}</strong></div>
      <div class="metric report-metric"><span>Vanessa recebeu</span><strong>${money(data.vanessaFinancial.received)}</strong><small>Retiradas no período</small></div>
      <div class="metric report-metric"><span>Vanessa pagou</span><strong>${money(data.vanessaFinancial.paid)}</strong><small>Pagamentos em Sócias</small></div>
      <div class="metric report-metric"><span>Vanessa deve</span><strong>${money(data.vanessaFinancial.debt)}</strong><small>Saldo devedor em Sócias</small></div>
      <div class="metric report-metric"><span>Tem no cofrinho</span><strong>${money(data.savingsBalance)}</strong></div>
      <div class="metric report-metric"><span>Deveria ter no cofrinho</span><strong>${money(data.savingsExpectedBalance)}</strong></div>
      <div class="metric report-metric total"><span>Saldo consolidado</span><strong class="${data.consolidatedBalance < 0 ? "negative" : "positive"}">${money(data.consolidatedBalance)}</strong><small>PF + PJ + Cofrinho</small></div>
      <div class="metric report-metric"><span>Lucro operacional</span><strong class="${operationalProfitForReport(data) < 0 ? "negative" : "positive"}">${money(operationalProfitForReport(data))}</strong></div>
      ${withdrawalBreakdownMetrics(data.financial.withdrawals, "metric report-metric", data.partnerWithdrawalControl)}
      <div class="metric report-metric"><span>Resultado após retiradas</span><strong class="${operationalResultForReport(data) < 0 ? "negative" : "positive"}">${money(operationalResultForReport(data))}</strong></div>
    </section>
    ${viewTabsHtml("reportViewTab", activeTab, tabs)}
    ${viewPaneHtml("summary", activeTab, `
      ${reportFinancialPositionPanel(data)}
      ${internalTransfersReportPanel(data)}
      ${cashForecastPanel(data)}
      ${["month", "week"].includes(reportType) ? monthlyOriginCategoryPanel(data) : ""}
      ${["month", "week"].includes(reportType) ? comparisonReportPanel(data) : ""}
      ${simplifiedStatementPanel(data)}
      ${dishRankingPanel(data)}
      ${clientReportPanel(data)}
      <section class="panel report-section">
        <h2>Cardápio e produção</h2>
        ${reportMenuTable(data)}
      </section>
    `)}
    ${viewPaneHtml("financial", activeTab, `
      ${reportFinancialPositionPanel(data)}
      ${withdrawalPersonReportPanel(data)}
      ${accountAdjustmentsReportPanel(data)}
    `)}
    ${viewPaneHtml("profitability", activeTab, businessProfitabilityPanel(data))}
    ${viewPaneHtml("products", activeTab, storeProductPerformancePanel(data))}
    ${viewPaneHtml("income", activeTab, `
      ${channelReportPanel(data)}
      <section class="panel report-section">
        <h2>O que entrou no caixa ${reportTitleSuffix(data)}</h2>
        ${reportIncomeCashTable(data)}
      </section>
      <section class="panel report-section">
        <h2>O que entrou com o semanal ${reportTitleSuffix(data)}</h2>
        ${reportOrdersTable(data)}
      </section>
    `)}
    ${viewPaneHtml("expenses", activeTab, `
      ${expenseCategoryReportPanel(data)}
      ${upcomingBillsPanel({ title: "Boletos e contas pendentes", limit: 12, showSummary: true, includeOverdue: false })}
      ${billsStatusPanel()}
      <section class="panel report-section">
        <h2>O que saiu em saídas ${reportTitleSuffix(data)}</h2>
        ${reportExpenseOutTable(data)}
      </section>
      <section class="panel report-section">
        <h2>Caixa ${reportTitleSuffix(data)}</h2>
        ${reportCashTable(data)}
      </section>
    `)}
    ${viewPaneHtml("withdrawals", activeTab, `
      ${withdrawalPersonReportPanel(data)}
      ${accountAdjustmentsReportPanel(data)}
    `)}
    ${viewPaneHtml("closing", activeTab, `
      ${weeklyClosingPanel(data)}
      ${reportType === "month" ? monthlyClosingPanel(data) : ""}
    `)}
  `;

  bindReportPeriodForm(renderReports, "relatorios");
  bindViewTabs("reportViewTab", renderReports);
  on("[data-open-report-products]", "click", () => {
    state.reportViewTab = "products";
    renderReports();
  });

  document.querySelectorAll("[data-export-report]").forEach(button => {
    button.addEventListener("click", event => {
      exportReport(event.currentTarget.dataset.exportReport);
    });
  });
  document.querySelectorAll("[data-export-withdrawals]").forEach(button => {
    button.addEventListener("click", () => exportWithdrawalReport(data));
  });
  bindMonthlyClosing(data, renderReports);
  enhanceResponsiveTables(app);
}

async function renderBackups() {
  showStandardHero("Manutenção");
  setActive("backups");
  const requestedTab = new URLSearchParams(location.search).get("tab");
  if (requestedTab && canAccessMaintenanceTab(requestedTab)) {
    setMaintenanceTab(requestedTab);
  }
  if (!canAccessMaintenanceTab(state.maintenanceTab)) {
    setMaintenanceTab("backup");
  }
  const activeTab = state.maintenanceTab || "backup";
  const years = cleanupYears();
  const selectedYear = years[0] || String(new Date().getFullYear() - 1);
  const preview = cleanupPreview(selectedYear);
  const lastBackupAt = localStorage.getItem("lastManualBackupAt") || "";
  const manualBackupAgeDays = backupAgeDays(lastBackupAt);
  const reminderDays = configuredBackupReminderDays();
  const backupStatus = lastBackupAt
    ? `${shortDateTime.format(new Date(lastBackupAt))}${manualBackupAgeDays >= reminderDays ? " - precisa renovar" : " - em dia"}`
    : "Nenhum backup manual registrado neste navegador";
  const maintenanceAccountDate = isoDate(new Date());
  const maintenanceAccountBalances = accountBalanceBreakdownUntilDate(maintenanceAccountDate);
  const maintenanceDefaultCashAccount = normalizedCashAccount(state.cashEntryDraft.cashAccount);
  const maintenanceAccountBalance = maintenanceAccountBalances[maintenanceDefaultCashAccount];
  const canZeroMaintenanceAccount = Math.abs(maintenanceAccountBalance) >= 0.01;
  app.innerHTML = `
    <section class="maintenance-hero">
      <div>
        <span>Manutenção</span>
        <h2>Backup, limpeza e conferência do banco</h2>
        <p>Use esta área antes de mudanças grandes, limpeza de dados antigos ou restauração de arquivo JSON.</p>
      </div>
      <div class="maintenance-steps">
        <button type="button" id="hero-backup-download">Baixar backup</button>
        ${canUser("clearData") ? `
          <button class="secondary" type="button" data-maintenance-scroll="cleanup-year-form">Limpar ano</button>
          <button class="danger" type="button" data-maintenance-scroll="reset-all-panel">Reiniciar financeiro</button>
          <button class="danger" type="button" data-maintenance-scroll="reset-database-zone">Limpar todo o banco</button>
        ` : ""}
        <button class="secondary" type="button" data-maintenance-scroll="real-db-usage">Ver banco</button>
      </div>
    </section>

    <section class="panel maintenance-health-overview">
      <div class="section-heading">
        <div>
          <h2>Proteção dos dados</h2>
          <p class="muted-inline">Situação dos backups manuais e automáticos antes de qualquer manutenção.</p>
        </div>
        <a class="secondary table-action" href="/configuracoes">Alterar lembrete</a>
      </div>
      <div class="maintenance-health-grid">
        <div class="backup-list-state ${manualBackupAgeDays === null || manualBackupAgeDays >= reminderDays ? "warning-state" : ""}">
          <strong>Backup manual</strong>
          <span>${backupStatus}</span>
        </div>
        <div class="backup-list-state">
          <strong>Frequência recomendada</strong>
          <span>A cada ${reminderDays} dia(s), configurável em Configurações.</span>
        </div>
        <div id="maintenance-backup-health" class="backup-list-state">
          <strong>Backup automático</strong>
          <span>Consultando o Supabase...</span>
        </div>
      </div>
    </section>

    <section class="panel maintenance-tabs-panel">
      <div class="maintenance-tabs" role="tablist" aria-label="Manutenção">
        ${[
          ["backup", "Backup"],
          ["integrity", "Integridade"],
          ["database", "Banco"],
          ["users", "Usuários"],
          ["events", "Log"],
          ["reset", "Limpeza"]
        ].filter(([tab]) => canAccessMaintenanceTab(tab)).map(([tab, label]) => `
          <button class="secondary ${activeTab === tab ? "active" : ""}" type="button" data-maintenance-tab="${tab}">${label}</button>
        `).join("")}
      </div>
    </section>

    <section class="maintenance-grid">
      <section class="panel report-section backup-manual-panel maintenance-pane" data-maintenance-pane="backup" ${activeTab === "backup" ? "" : "hidden"}>
        <h2>Backup e recuperação</h2>
        <p class="muted-inline">O backup é salvo no seu computador, não no Supabase. Baixe um JSON antes de mudanças grandes e importe esse arquivo se precisar recuperar os dados.</p>
        <div class="backup-actions">
          <button type="button" id="manual-backup-download">Baixar backup JSON</button>
          <button class="secondary" type="button" id="manual-backup-supabase">Salvar no Supabase</button>
          <label class="secondary file-action">
            Importar backup JSON
            <input id="manual-backup-import" type="file" accept="application/json,.json">
          </label>
        </div>
        <div class="backup-list-state">
          <strong>Último backup manual</strong>
          <span>${backupStatus}</span>
        </div>
        ${manualBackupAgeDays === null || manualBackupAgeDays >= reminderDays ? `
          <div class="backup-list-state warning-state">
            <strong>Faça um novo backup</strong>
            <span>O lembrete está configurado para ${reminderDays} dia(s). Faça uma cópia antes de limpar dados ou realizar mudanças grandes.</span>
          </div>
        ` : ""}
        <div id="automatic-backups">
          <p class="muted">Consultando backups automáticos...</p>
        </div>
      </section>
      <section class="panel report-section backup-manual-panel maintenance-pane" data-maintenance-pane="integrity" ${activeTab === "integrity" ? "" : "hidden"}>
        <div class="section-heading">
          <div>
            <h2>Integridade do sistema</h2>
            <p class="muted-inline">Conferência de conexão, persistência, relatórios, saldo, fechamentos e capacidade de restauração.</p>
          </div>
        </div>
        <div class="backup-actions">
          <button type="button" id="system-check-run">Verificar sistema</button>
          ${canUser("restoreBackup") ? `<button class="secondary" type="button" id="backup-restore-check-run">Testar restauração</button>` : ""}
        </div>
        <div id="system-check-panel" class="system-check-panel">
          <p class="muted">Execute a verificação depois de publicações ou antes de operações críticas.</p>
        </div>
        <div id="maintenance-financial-integrity">
          <p class="muted">Conferindo integridade financeira...</p>
        </div>
        <div>
          <h3>Integrações externas</h3>
          <div id="integration-status"><p class="muted">Consultando configurações protegidas...</p></div>
        </div>
        ${canUser("restoreBackup") ? `<p class="muted" id="backup-restore-check-status">O teste lê e normaliza o backup mais recente sem substituir os dados atuais.</p>` : ""}
        <div id="system-issues-panel">
          ${systemIssuesHtml()}
        </div>
      </section>
      <section class="panel report-section backup-manual-panel maintenance-pane" data-maintenance-pane="database" ${activeTab === "database" ? "" : "hidden"}>
        <h2>Manutenção do banco</h2>
        <p class="muted-inline">Use para apagar dados antigos depois de baixar um backup JSON. Clientes, precificação, categorias e configurações atuais são preservados.</p>
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
        ${canUser("clearData") ? `
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
        ` : ""}
        <div id="cleanup-preview" class="cleanup-preview">
          ${cleanupPreviewHtml(selectedYear, preview)}
        </div>
      </section>
      ${isAdminUser() ? `
        <section class="panel report-section backup-manual-panel maintenance-pane" data-maintenance-pane="users" ${activeTab === "users" ? "" : "hidden"}>
          <h2>Usuários</h2>
          <p class="muted-inline">Adicione, edite, desative ou troque senha sem mexer nas variáveis do Vercel.</p>
          <div id="users-admin">
            <p class="muted">Carregando usuários...</p>
          </div>
        </section>
        <section class="panel report-section backup-manual-panel maintenance-pane" data-maintenance-pane="events" ${activeTab === "events" ? "" : "hidden"}>
          <h2>Log técnico</h2>
          <p class="muted-inline">Registro administrativo escondido do uso diário. Mostra limpezas, restaurações e manutenções críticas.</p>
          <div id="technical-events">
            <p class="muted">Consultando eventos...</p>
          </div>
        </section>
      ` : ""}
      ${canUser("clearData") ? `
        <section class="panel report-section backup-manual-panel reset-all-panel maintenance-pane" data-maintenance-pane="reset" id="reset-all-panel" ${activeTab === "reset" ? "" : "hidden"}>
          <section class="database-danger-zone" id="maintenance-zero-account-panel">
            <h3>Zerar saldo da conta</h3>
            <p>Cria um lançamento de ajuste na conta escolhida. Os lançamentos anteriores permanecem no histórico.</p>
            <label>Conta a zerar
              <select id="maintenance-zero-account-target">
                ${["pf", "pj"].map(cashAccount => `
                  <option value="${cashAccount}" data-balance="${maintenanceAccountBalances[cashAccount]}" ${cashAccount === maintenanceDefaultCashAccount ? "selected" : ""}>
                    ${cashAccountLabel(cashAccount)} · ${money(maintenanceAccountBalances[cashAccount])}
                  </option>
                `).join("")}
              </select>
            </label>
            <div class="backup-list-state warning-state">
              <strong>Saldo da conta em ${formatIsoDateBr(maintenanceAccountDate)}</strong>
              <span id="maintenance-zero-account-balance">${money(maintenanceAccountBalance)}</span>
            </div>
            <div class="backup-actions">
              <button class="danger" type="button" id="maintenance-zero-account" ${canZeroMaintenanceAccount ? "" : "disabled"}>Zerar conta</button>
            </div>
          </section>
          <h2>Reiniciar financeiro</h2>
          <p class="muted-inline">Use para começar os valores novamente sem perder os cadastros e a configuração da operação.</p>
          <div class="backup-list-state warning-state">
            <strong>Apaga somente movimentações</strong>
            <span>Caixa, vendas da loja, quantidades mensais dos produtos, recebimentos por canais e fechamentos ficam vazios. Clientes, pedidos, cardápios, categorias, produtos da loja, motivos, precificação, planejamento e configurações permanecem.</span>
          </div>
          <div class="reset-confirmation">
            <label>Confirmação
              <input id="reset-financial-confirmation" type="text" autocomplete="off" placeholder="Digite REINICIAR FINANCEIRO">
            </label>
            <button class="danger" type="button" id="reset-financial-data" disabled>Baixar backup e reiniciar financeiro</button>
            <small id="reset-financial-status">Digite a frase acima para liberar o botão.</small>
          </div>
          <section class="database-danger-zone" id="reset-database-zone">
            <h3>Limpar todo o banco</h3>
            <p>Apaga caixa, retiradas, clientes, pedidos, cardápios, categorias, motivos, precificação, planejamento, configurações e histórico de auditoria.</p>
            <div class="backup-list-state warning-state">
              <strong>Usuários e recuperação permanecem</strong>
              <span>Os usuários administrativos, eventos técnicos e o backup protegido não são apagados, para manter o acesso e permitir restauração.</span>
            </div>
            <button class="danger" type="button" id="reset-all-data">Baixar backup e limpar todo o banco</button>
          </section>
        </section>
      ` : ""}
    </section>
  `;

  document.querySelectorAll("[data-maintenance-tab]").forEach(button => {
    button.addEventListener("click", event => {
      setMaintenanceTab(event.currentTarget.dataset.maintenanceTab);
      updateMaintenanceTabRoute(state.maintenanceTab);
      renderBackups();
    });
  });

  on("#hero-backup-download", "click", downloadBackup);
  document.querySelectorAll("[data-maintenance-scroll]").forEach(button => {
    button.addEventListener("click", event => {
      scrollMaintenanceTarget(event.currentTarget.dataset.maintenanceScroll);
    });
  });
  on("#manual-backup-download", "click", downloadBackup);
  on("#manual-backup-supabase", "click", saveManualBackupToSupabase);
  on("#system-check-run", "click", runSystemCheck);
  on("#backup-restore-check-run", "click", runBackupRestoreCheck);
  bindSystemIssuesPanel();
  loadFinancialIntegrity("maintenance-financial-integrity");
  loadIntegrationStatus();
  loadRealDatabaseUsage();
  loadAutomaticBackups();
  loadUsersPanel();
  loadTechnicalEvents();
  enhanceResponsiveTables(app);
  on("#manual-backup-import", "change", async event => {
    const file = event.currentTarget.files?.[0];
    if (!file) {
      return;
    }
    if (!confirm("Importar este backup? Isso vai substituir os dados atuais.")) {
      event.currentTarget.value = "";
      return;
    }
    try {
      const saved = await importBackupFile(file);
      if (saved) {
        showToast("Backup importado", "success");
        renderBackups();
      }
    } catch (error) {
      showToast("Arquivo de backup inválido", "warning");
    }
  });

  const cleanupYearField = document.querySelector("#cleanup-year");
  const cleanupPreviewBox = document.querySelector("#cleanup-preview");
  if (cleanupYearField && cleanupPreviewBox) {
    cleanupYearField.addEventListener("change", event => {
      const year = event.currentTarget.value;
      cleanupPreviewBox.innerHTML = cleanupPreviewHtml(year, cleanupPreview(year));
      document.querySelector("#db-usage-status").innerHTML = databaseUsageHtml(year);
    });
  }

  on("#cleanup-backup-first", "click", downloadBackup);
  const maintenanceZeroAccountTarget = document.querySelector("#maintenance-zero-account-target");
  const maintenanceZeroAccountBalance = document.querySelector("#maintenance-zero-account-balance");
  const maintenanceZeroAccountButton = document.querySelector("#maintenance-zero-account");
  maintenanceZeroAccountTarget?.addEventListener("change", event => {
    const selectedOption = event.currentTarget.selectedOptions[0];
    const balance = Number(selectedOption?.dataset.balance || 0);
    if (maintenanceZeroAccountBalance) {
      maintenanceZeroAccountBalance.textContent = money(balance);
    }
    if (maintenanceZeroAccountButton) {
      maintenanceZeroAccountButton.disabled = Math.abs(balance) < 0.01;
    }
  });
  on("#maintenance-zero-account", "click", async event => {
    const button = event.currentTarget;
    const cashAccount = normalizedCashAccount(maintenanceZeroAccountTarget?.value);
    button.disabled = true;
    if (await zeroAccountBalanceAtDate(maintenanceAccountDate, cashAccount)) {
      renderBackups();
      return;
    }
    const balance = Number(maintenanceZeroAccountTarget?.selectedOptions[0]?.dataset.balance || 0);
    button.disabled = Math.abs(balance) < 0.01;
  });
  const resetFinancialConfirmation = document.querySelector("#reset-financial-confirmation");
  const resetFinancialButton = document.querySelector("#reset-financial-data");
  const resetFinancialStatus = document.querySelector("#reset-financial-status");
  if (resetFinancialButton && resetFinancialConfirmation) {
    resetFinancialConfirmation.addEventListener("input", event => {
      const confirmed = event.currentTarget.value.trim().toUpperCase() === "REINICIAR FINANCEIRO";
      resetFinancialButton.disabled = !confirmed;
      if (resetFinancialStatus) {
        resetFinancialStatus.textContent = confirmed
          ? "Confirmação válida. O backup será baixado antes do reinício."
          : "Digite a frase acima para liberar o botão.";
      }
    });
    resetFinancialButton.addEventListener("click", async () => {
      resetFinancialButton.disabled = true;
      if (resetFinancialStatus) {
        resetFinancialStatus.textContent = "Gerando backup e reiniciando...";
      }
      try {
        if (await resetFinancialData(resetFinancialConfirmation.value)) {
          renderBackups();
        } else if (resetFinancialStatus) {
          resetFinancialStatus.textContent = "Reinício não concluído. Confira a confirmação e tente novamente.";
        }
      } finally {
        const confirmed = resetFinancialConfirmation.value.trim().toUpperCase() === "REINICIAR FINANCEIRO";
        resetFinancialButton.disabled = !confirmed;
      }
    });
  }
  const resetAllButton = document.querySelector("#reset-all-data");
  if (resetAllButton) {
    resetAllButton.addEventListener("click", async () => {
      resetAllButton.disabled = true;
      try {
        if (await resetAllData()) {
          renderBackups();
        }
      } finally {
        resetAllButton.disabled = false;
      }
    });
  }
  on("#delete-old-backups", "click", async () => {
    if (!hasRecentManualBackup()) {
      showToast("Baixe um backup JSON antes de apagar backups antigos.", "warning");
      return;
    }
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
  on("#cleanup-year-form", "submit", async event => {
    event.preventDefault();
    const year = normalizedCleanupYear(cleanupYearField?.value);
    if (!year) {
      showToast("Selecione um ano valido para limpar.", "warning");
      return;
    }

    const currentPreview = cleanupPreview(year);
    const total = Object.values(currentPreview).reduce((sum, value) => sum + value, 0);
    if (!total) {
      showToast("Nada para apagar nesse ano", "warning");
      return;
    }
    if (!hasRecentManualBackup()) {
      showToast("Baixe um backup JSON antes de apagar o ano.", "warning");
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
    const cleaned = await cleanupYear(year);
    if (cleaned) {
      showToast(`Ano ${year} apagado`, "success");
      renderBackups();
    }
  });
}

function hasRecentManualBackup(maxAgeHours = 24) {
  const last = localStorage.getItem("lastManualBackupAt");
  if (!last) {
    return false;
  }
  return Date.now() - new Date(last).getTime() <= maxAgeHours * 60 * 60 * 1000;
}

async function saveManualBackupToSupabase() {
  try {
    const response = await fetch("/api/manual-backup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state: appStatePayload() })
    });
    const result = await response.json();
    if (!response.ok || !result.database || !result.saved) {
      showToast(result.error || "Não foi possível salvar no Supabase.", "error");
      return;
    }
    localStorage.setItem("lastManualBackupAt", new Date().toISOString());
    showToast("Backup salvo no Supabase.", "success");
    showBackupPreviewModal({
      backupDate: isoDate(new Date()),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      preview: result.preview || {}
    });
    loadAutomaticBackups();
  } catch (error) {
    showToast("Falha ao salvar backup no Supabase.", "error");
  }
}

function systemIssuesHtml() {
  const issues = systemIssues();
  return `
    <div class="backup-list-state ${issues.length ? "warning-state" : ""}">
      <strong>Erros recentes</strong>
      <span>${issues.length ? `${issues.length} ocorrencia(s) locais` : "Nenhum erro recente neste navegador"}</span>
      ${issues.length ? `<button class="secondary table-action" type="button" id="clear-system-issues">Limpar erros</button>` : ""}
    </div>
    ${issues.length ? `
      <div class="system-check-list">
        ${issues.slice(0, 8).map(issue => `
          <span class="${issue.type === "error" ? "offline" : "online"}">
            <b>${issue.type === "error" ? "Erro" : "Aviso"}</b>
            ${escapeHtml(issue.message)}
            <small>${new Date(issue.createdAt).toLocaleString("pt-BR")} - ${issue.route}</small>
          </span>
        `).join("")}
      </div>
    ` : ""}
  `;
}

function bindSystemIssuesPanel() {
  const button = document.querySelector("#clear-system-issues");
  if (!button) {
    return;
  }
  button.addEventListener("click", () => {
    suppressIssueLog = true;
    localStorage.setItem("systemIssues", JSON.stringify([]));
    showToast("Erros recentes limpos.", "success");
    suppressIssueLog = false;
    const panel = document.querySelector("#system-issues-panel");
    if (panel) {
      panel.innerHTML = systemIssuesHtml();
    }
  });
}

function reportExportPayload(data = reportData()) {
  const periodLabel = reportPeriodLabel(data);
  const withdrawalAmounts = withdrawalBreakdownAmounts(data.financial.withdrawals, data.partnerWithdrawalControl);
  return {
    periodLabel,
    statusLabel: reportPeriodStatusLabel(data),
    data: {
      periodType: data.type,
      periodStart: reportPeriodBounds(data).start,
      periodEnd: reportPeriodBounds(data).end,
      periodKey: data.periodKey,
      balance: data.balance,
      totalIncome: data.totalIncome,
      expenses: data.expenses,
      operationalExpenses: data.financial.operationalExpenses,
      ...reportFinancialPayloadMetrics(data),
      accountAdjustmentIncome: data.accountAdjustmentTotals.income,
      accountAdjustmentExpenses: data.accountAdjustmentTotals.expenses,
      accountAdjustmentBalance: data.accountAdjustmentTotals.balance,
      accountBalance: data.accountBalance,
      savingsBalance: data.savingsBalance,
      savingsExpectedBalance: data.savingsExpectedBalance,
      consolidatedBalance: data.consolidatedBalance,
      capitalContributionTotal: data.capitalContributionTotal,
      transferRows: accountTransferReportRows(data.accountTransfers),
      capitalContributionRows: data.capitalContributionEntries.map(entry => [
        entry.date || "",
        entry.description || "Aporte de sócia",
        cashAccountLabel(entry.cashAccount),
        money(entry.amount)
      ]),
      savingsUpdatedAt: data.savingsUpdatedAt,
      withdrawalVanessa: data.vanessaFinancial.received,
      withdrawalSavings: withdrawalAmounts.savings,
      withdrawalRaquel: withdrawalAmounts.raquel,
      withdrawalRows: reportPdfWithdrawalRows(data),
      accountIncome: data.income,
      weeklyRevenue: data.orderRevenue,
      incomeSummaryRows: [
        ...accountIncomeBreakdown(data).map(([label, value]) => ["Receita contabilizada", label, value])
      ],
      incomeChannelRows: reportPdfIncomeChannelRows(data),
      expenseCategoryRows: reportPdfExpenseCategoryRows(data),
      negativeDifferenceRows: reportPdfNegativeDifferenceRows(data),
      accountPackageSummaryRows: reportAccountPackageSummaryRows(data),
      accountPackageReconciliationRows: reportAccountReconciliationRows(data),
      accountPackageUnifiedRows: reportAccountPackageCashRows(data, "all", true),
      accountPackagePfRows: reportAccountPackageCashRows(data, "pf", true),
      accountPackagePjRows: reportAccountPackageCashRows(data, "pj", true),
      accountPackageUnassignedRows: reportAccountPackageCashRows(data, "unassigned", true),
      totalSoldQuantity: data.totalSoldQuantity,
      weeklyCashQuantity: data.weeklyCashQuantity,
      storeQuantity: data.storeQuantity,
      dishRows: dishRankingRows(data).map((item, index) => [index + 1, item.name, item.quantity]),
      comparisonRows: comparisonReportRows(data).map(row => [
        row.label,
        managementComparisonValue(row, row.current),
        managementComparisonValue(row, row.previous),
        managementComparisonDelta(row)
      ]),
      incomeRows: data.incomeEntries.map(entry => [entry.date || "", entry.description || "", money(entry.amount)]),
      expenseRows: reportPdfTopExpenseRows(data),
      channelRows: data.channelReceipts.map(entry => [
        entry.date || "",
        ...cardapioPaymentDefinitions.map(([paymentKey]) => money(cardapioPaymentAmount(entry, paymentKey))),
        money(cardapioDeliveryFeeAmount(entry)),
        money(channelReceiptAmount(entry, "ifood", "net")),
        money(channelReceiptAmount(entry, "food99", "net")),
        money(channelReceiptTotal(entry))
      ]),
      storeRows: data.storeSales.map(storeSaleReportRow),
      cashRows: data.cashEntries.map(entry => [
        entry.date || "",
        entry.description || "",
        entry.type === "expense" ? "Saída" : "Entrada",
        cashAccountLabel(entry.cashAccount, entry.type),
        categoryName(entry.category),
        money(entry.amount)
      ])
    }
  };
}

async function checkFetch(label, url, options = {}, validate = response => response.ok) {
  const startedAt = performance.now();
  try {
    const response = await fetch(url, { cache: "no-store", ...options });
    const ok = await validate(response);
    return { label, ok, detail: `${Math.round(performance.now() - startedAt)} ms` };
  } catch (error) {
    return { label, ok: false, detail: "Falhou" };
  }
}

async function runSystemCheck() {
  const panel = document.querySelector("#system-check-panel");
  if (!panel) {
    return;
  }
  panel.innerHTML = `<p class="muted">Verificando...</p>`;
  const payload = reportExportPayload();
  const checks = [
    await checkFetch("Sessão/login", "/api/session"),
    await checkFetch("Servidor e Supabase", "/api/health", {}, async response => {
      const result = await response.json();
      return response.ok && result.status === "online" && Boolean(result.database);
    }),
    await checkFetch("Persistência", "/api/persistence-check", {}, async response => {
      const result = await response.json();
      return response.ok && Boolean(result.database && result.saved);
    }),
    await checkFetch("Backups automáticos", "/api/backups", {}, async response => {
      const result = await response.json();
      return response.ok && Boolean(result.database);
    }),
    await checkFetch("Integridade financeira", "/api/financial-integrity", {}, async response => {
      const result = await response.json();
      return response.ok && Boolean(result.database) && result.status !== "danger";
    }),
    await checkFetch("PDF", "/api/report-pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }, response => response.ok && String(response.headers.get("content-type") || "").includes("application/pdf")),
    await checkFetch("Excel", "/api/report-xlsx", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }, response => response.ok && String(response.headers.get("content-type") || "").includes("spreadsheet"))
  ];
  const ok = checks.every(item => item.ok);
  panel.innerHTML = `
    <div class="backup-list-state ${ok ? "" : "warning-state"}">
      <strong>${ok ? "Sistema verificado" : "Sistema com pendências"}</strong>
      <span>${new Date().toLocaleString("pt-BR")}</span>
    </div>
    <div class="system-check-list">
      ${checks.map(item => `
        <span class="${item.ok ? "online" : "offline"}">
          <b>${item.ok ? "OK" : "Falha"}</b>
          ${escapeHtml(item.label)}
          <small>${escapeHtml(item.detail)}</small>
        </span>
      `).join("")}
    </div>
  `;
}

function configuredDefaultRoute() {
  const route = state.appConfig?.defaultRoute || defaultAppConfig.defaultRoute;
  return configRouteOptions.some(([value]) => value === route) ? route : defaultAppConfig.defaultRoute;
}

function actionableManagementAlerts(metrics = homeMetricData(), today = todayOperationData()) {
  const priceAlerts = (state.pricingRecipes || []).flatMap(recipe => {
    if (!pricingRecipeIsComplete(recipe)) {
      return [{
        category: "Preços",
        label: "Prato sem custo de supermercado",
        detail: `${recipe.name || "Prato sem nome"} precisa do custo de supermercado por unidade.`,
        type: "warning",
        href: "/precificacao?view=recipes",
        action: "Completar"
      }];
    }
    const recipeMetrics = pricingRecipeMetrics(recipe);
    if (recipeMetrics.practicedPrice > 0 && recipeMetrics.realProfit < 0) {
      return [{
        category: "Preços",
        label: "Preço abaixo do custo",
        detail: `${recipe.name}: prejuízo de ${money(Math.abs(recipeMetrics.realProfit))} por unidade.`,
        type: "danger",
        href: "/precificacao?view=recipes",
        action: "Corrigir preço"
      }];
    }
    if (
      recipeMetrics.practicedPrice > 0
      && recipeMetrics.realMarginPercent !== null
      && recipeMetrics.realMarginPercent + 0.0001 < recipeMetrics.desiredMarginPercent
    ) {
      return [{
        category: "Preços",
        label: "Margem abaixo da meta",
        detail: `${recipe.name}: ${pricingPercent(recipeMetrics.realMarginPercent)} de margem para meta de ${pricingPercent(recipeMetrics.desiredMarginPercent)}.`,
        type: "warning",
        href: "/precificacao?view=recipes",
        action: "Revisar"
      }];
    }
    return [];
  });
  const supermarket = monthlySupermarketAllocation(menuPeriodKeyFromKey(today.currentKey));
  const menuAlerts = (state.menus[today.currentKey] || []).some(item => String(item.dish || "").trim())
    && !(supermarket.supermarketTotal > 0 && supermarket.totalQuantity > 0)
    ? [{
        category: "Menu",
        label: "Supermercado ainda sem rateio",
        detail: supermarket.supermarketTotal > 0
          ? "Registre as cumbucas vendidas para dividir o valor de Supermercado do Caixa."
          : "Lance as movimentações na categoria Supermercado do Caixa para calcular o custo.",
        type: "warning",
        href: "/fluxo-de-caixa",
        action: "Abrir Caixa"
      }]
    : [];
  const backupAt = localStorage.getItem("lastManualBackupAt") || "";
  const backupDays = backupAgeDays(backupAt);
  const reminderDays = configuredBackupReminderDays();

  return [
    ...financialAccountNotifications(7).map(item => ({
      category: "Financeiro",
      label: item.title,
      detail: item.detail,
      type: item.type,
      href: item.action,
      action: "Ver conta"
    })),
    ...metrics.pendingPayments.map(order => {
      const client = clientByPhone(order.clientPhone);
      return {
        category: "Pedidos",
        label: "Cobrar cliente",
        detail: `${client.name || order.clientPhone} - ${money(order.amount)}`,
        type: "danger",
        href: clientChargeWhatsAppUrl(client, order.amount),
        action: "WhatsApp",
        external: true
      };
    }),
    ...today.billsDue.map(item => ({
      category: "Financeiro",
      label: "Conta para pagar",
      detail: `${item.description || "Despesa"} - ${money(item.amount)}`,
      type: "danger",
      href: item.id ? `/fluxo-de-caixa?edit=${encodeURIComponent(item.id)}` : "/financeiro?view=accounts",
      action: "Abrir"
    })),
    ...today.pendingDelivery.map(order => {
      const client = clientByPhone(order.clientPhone);
      return {
        category: "Entregas",
        label: "Entrega pendente",
        detail: client.name || order.clientPhone || "Cliente",
        type: "warning",
        href: orderWhatsAppUrl(order, state.menus[order.menuKey] || []),
        action: "WhatsApp",
        external: true
      };
    }),
    ...menuAlerts,
    ...priceAlerts,
    backupDays === null || backupDays >= reminderDays ? {
      category: "Segurança",
      label: "Backup precisa de atenção",
      detail: backupDays === null
        ? `Nenhum backup manual registrado. Frequência recomendada: ${reminderDays} dia(s).`
        : `Último backup manual há ${backupDays} dia(s).`,
      type: "warning",
      href: "/backups?tab=backup",
      action: "Ver backups"
    } : null
  ].filter(Boolean);
}

function renderAlerts() {
  showStandardHero("Alertas");
  setActive("alertas");
  const metrics = homeMetricData();
  const today = todayOperationData();
  const urgent = actionableManagementAlerts(metrics, today);
  const criticalCount = urgent.filter(item => item.type === "danger").length;
  const pricingCount = urgent.filter(item => item.category === "Preços" || item.category === "Menu").length;
  const systemNotifications = systemIssues().slice(0, 8);

  app.innerHTML = `
    <section class="dashboard-band alerts-band">
      <div class="dashboard-copy">
        <span>Central</span>
        <h2>Pendências da operação</h2>
        <p>Pagamentos, entregas, contas e cadastros que precisam de atenção.</p>
      </div>
      <div class="dashboard-kpis">
        <div class="metric dashboard-metric is-primary">
          <span>Alertas ativos</span>
          <strong>${urgent.length}</strong>
        </div>
        <div class="metric dashboard-metric">
          <span>Críticos</span>
          <strong class="${criticalCount ? "negative" : "positive"}">${criticalCount}</strong>
        </div>
        <div class="metric dashboard-metric">
          <span>Menu e preços</span>
          <strong>${pricingCount}</strong>
        </div>
      </div>
    </section>
    <section class="panel">
      <h2>Alertas financeiros automáticos</h2>
      <div id="alerts-financial-integrity"><p class="muted">Conferindo saldo, backups e fechamentos...</p></div>
    </section>
    <section class="panel">
      <h2>Lista de alertas</h2>
      ${urgent.length ? `
        <div class="alert-card-list">
          ${urgent.map(item => `
            <article class="alert-card ${item.type}" data-alert-category="${escapeHtml(item.category)}">
              <small class="alert-category">${escapeHtml(item.category)}</small>
              <strong>${escapeHtml(item.label)}</strong>
              <span>${escapeHtml(item.detail)}</span>
              ${item.href ? `<a class="secondary table-action" href="${escapeHtml(item.href)}" ${item.external ? `target="_blank" rel="noopener"` : ""}>${escapeHtml(item.action || "Abrir")}</a>` : ""}
            </article>
          `).join("")}
        </div>
      ` : `<p class="muted">Nenhuma pendência crítica agora.</p>`}
      ${systemNotifications.length ? `
        <h2>Ocorrências do sistema</h2>
        <div class="alert-list">
          ${systemNotifications.map(item => `<span><b>${escapeHtml(item.message)}</b>${new Date(item.createdAt).toLocaleString("pt-BR")}<a class="secondary table-action" href="/backups?tab=integrity">Ver integridade</a></span>`).join("")}
        </div>
      ` : ""}
      <div class="start-actions">
        <a class="secondary table-action" href="/pedidos" data-route="pedidos">Ver pedidos</a>
        <a class="secondary table-action" href="/financeiro" data-route="financeiro">Ver financeiro</a>
        <a class="secondary table-action" href="/backups" data-route="backups">Ver manutenção</a>
      </div>
    </section>
  `;
  loadFinancialIntegrity("alerts-financial-integrity");
}

function renderSettings() {
  showStandardHero("Configurações");
  setActive("configuracoes");
  const config = {
    ...defaultAppConfig,
    ...(state.appConfig || {})
  };
  app.innerHTML = `
    <section class="panel settings-panel">
      <h2>Configurações</h2>
      <form id="settings-form" class="settings-form">
        <div class="settings-section-title">
          <strong>Geral</strong>
          <span>Identidade, tela inicial e aparência.</span>
        </div>
        <label>Nome da loja
          <input name="storeName" value="${escapeHtml(config.storeName || "")}" placeholder="Cumbuca">
        </label>
        <label>Tela inicial
          <select name="defaultRoute">
            ${configRouteOptions.map(([value, label]) => `<option value="${value}" ${config.defaultRoute === value ? "selected" : ""}>${label}</option>`).join("")}
          </select>
        </label>
        <label>Tema
          <select id="settings-theme-preference" name="themePreference">
            ${themePreferenceOptions.map(([value, label]) => `<option value="${value}" ${storedThemePreference() === value ? "selected" : ""}>${label}</option>`).join("")}
          </select>
        </label>
        <div class="settings-section-title">
          <strong>Taxas do Cardápio Web</strong>
          <span>Informe o percentual descontado pela forma de pagamento. O valor registrado em Canais será considerado bruto.</span>
        </div>
        ${cardapioPaymentDefinitions.map(([paymentKey, label, feeConfigKey]) => `
          <label>${label} (%)
            <input name="${feeConfigKey}" type="number" min="0" max="100" step="0.01" value="${Number(config[feeConfigKey] || 0)}" ${paymentKey === "cash" ? "readonly" : ""}>
            ${paymentKey === "cash" ? "<small>Dinheiro não tem taxa automática.</small>" : ""}
          </label>
        `).join("")}
        <div class="settings-section-title">
          <strong>Padrões de novas receitas</strong>
          <span>Esses valores serão preenchidos automaticamente ao cadastrar uma receita.</span>
        </div>
        <div class="settings-fixed-rule">
          <b>Lote padrão protegido</b>
          <span>Ingredientes sempre calculados para 50 pratos.</span>
        </div>
        <label>Embalagem padrão
          <input name="defaultPackagingCost" type="text" inputmode="decimal" value="${moneyInputValue(config.defaultPackagingCost)}" placeholder="0,00">
        </label>
        <label>Taxa fixa padrão
          <input name="defaultFixedFee" type="text" inputmode="decimal" value="${moneyInputValue(config.defaultFixedFee)}" placeholder="0,00">
        </label>
        <label>Taxa variável padrão (%)
          <input name="defaultVariableFeePercent" type="number" min="0" max="99" step="0.01" value="${Number(config.defaultVariableFeePercent || 0)}">
        </label>
        <label>Margem desejada padrão (%)
          <input name="defaultDesiredMarginPercent" type="number" min="0" max="99" step="0.01" value="${Number(config.defaultDesiredMarginPercent || 0)}">
        </label>
        <div class="settings-section-title">
          <strong>Distribuição financeira</strong>
          <span>Percentuais usados nas retiradas e na reserva.</span>
        </div>
        <label>Reserva (%)
          <input name="splitSavingsPercent" type="number" min="0" max="100" step="1" value="${Number(config.splitSavingsPercent || 0)}">
        </label>
        <label>Vanessa (%)
          <input name="splitVanessaPercent" type="number" min="0" max="100" step="1" value="${Number(config.splitVanessaPercent || 0)}">
        </label>
        <label>Raquel (%)
          <input name="splitRaquelPercent" type="number" min="0" max="100" step="1" value="${Number(config.splitRaquelPercent || 0)}">
        </label>
        <div class="settings-section-title">
          <strong>Segurança dos dados</strong>
          <span>Defina quando o sistema deve lembrar de fazer uma nova cópia.</span>
        </div>
        <label>Lembrar backup após
          <input name="backupReminderDays" aria-label="Lembrar backup após" type="number" min="1" max="30" step="1" value="${configuredBackupReminderDays()}">
          <small>Dias desde o último backup manual.</small>
        </label>
        <button type="submit">Salvar configurações</button>
      </form>
    </section>
  `;

  on("#settings-theme-preference", "change", event => {
    applyThemePreference(event.currentTarget.value, { persist: true });
  });

  on("#settings-form", "submit", async event => {
    event.preventDefault();
    const form = readForm(event.currentTarget);
    applyThemePreference(String(form.themePreference || "system"), { persist: true });
    state.appConfig = {
      ...defaultAppConfig,
      storeName: String(form.storeName || "Cumbuca").trim() || "Cumbuca",
      defaultRoute: String(form.defaultRoute || defaultAppConfig.defaultRoute),
      splitSavingsPercent: Number(form.splitSavingsPercent || 0),
      splitVanessaPercent: Number(form.splitVanessaPercent || 0),
      splitRaquelPercent: Number(form.splitRaquelPercent || 0),
      defaultPackagingCost: pricingSafeNumber(form.defaultPackagingCost),
      defaultFixedFee: pricingSafeNumber(form.defaultFixedFee),
      defaultVariableFeePercent: pricingDecimalNumber(form.defaultVariableFeePercent),
      defaultDesiredMarginPercent: pricingDecimalNumber(form.defaultDesiredMarginPercent),
      ...Object.fromEntries(cardapioPaymentDefinitions.map(([, , feeConfigKey]) => [
        feeConfigKey,
        pricingDecimalNumber(form[feeConfigKey])
      ])),
      backupReminderDays: Math.min(30, Math.max(1, Number(form.backupReminderDays || 7)))
    };
    await persistState();
    renderSettings();
  });
}

function renderMore() {
  showStandardHero("Mais");
  setActive("mais");
  const links = [
    ["menu-semanal", "Menu", "Cardápio, produção e pedidos"],
    ["loja", "Loja", "Vendas do balcão"],
    ["precificacao", "Preços", "Ingredientes e margem"],
    ["fluxo-de-caixa", "Caixa", "Lançamentos e conciliação"],
    ["financeiro", "Financeiro", "Contas, planejamento e sócias"],
    ["despesas", "Despesas", "Saídas operacionais"],
    ["relatorios", "Relatórios", "PDF, Excel e ranking"],
    ["alertas", "Alertas", "Pendências da operação"],
    ["financeiro?view=employees", "Funcionários", "Cadastro e despesas da equipe"],
    ["configuracoes", "Config.", "Tela inicial e retiradas"],
    ["backups", "Manutenção", "Backup, usuários e banco"]
  ];
  app.innerHTML = `
    <section class="panel start-panel">
      <h2>Mais ferramentas</h2>
      <div class="quick-actions start-actions">
        ${links.map(([route, label, detail]) => `
          <a href="/${route}" data-route="${route}">
            <b>${label}</b>
            <small>${detail}</small>
          </a>
        `).join("")}
      </div>
    </section>
  `;
}

async function renderExpenses() {
  const requestedView = new URLSearchParams(location.search).get("view");
  state.cashPanelTab = requestedView === "list" ? "ledger" : "entry";
  await renderCash();
}

const routes = {
  home,
  "fluxo-de-caixa": renderCash,
  despesas: renderExpenses,
  hoje: renderToday,
  pedidos: renderQuickOrders,
  "menu-semanal": renderLegacyMenuRoute,
  loja: renderStoreSales,
  financeiro: renderFinance,
  precificacao: renderPricing,
  relatorios: renderReports,
  alertas: renderAlerts,
  configuracoes: renderSettings,
  mais: renderMore,
  backups: renderBackups,
  "minha-conta": renderAccount
};

let routeRenderPromise = Promise.resolve();

function renderCurrentRoute({ scrollToTop = false } = {}) {
  const requestedUrl = location.href;
  routeRenderPromise = routeRenderPromise
    .catch(() => {})
    .then(async () => {
      if (location.href !== requestedUrl) {
        return;
      }
      applyRouteParams();
      app.setAttribute("aria-busy", "true");
      try {
        const renderRoute = routes[routeName()] || home;
        await renderRoute();
        if (scrollToTop) {
          window.scrollTo({ top: 0, behavior: "auto" });
        }
      } finally {
        app.removeAttribute("aria-busy");
      }
    });
  return routeRenderPromise;
}

function internalAppUrl(anchor) {
  if (!anchor || anchor.target || anchor.hasAttribute("download")) {
    return null;
  }
  const url = new URL(anchor.href, location.href);
  if (url.origin !== location.origin || !["http:", "https:"].includes(url.protocol)) {
    return null;
  }
  const route = url.pathname.replace(/^\/+|\/+$/g, "") || "home";
  if (!routes[route] || url.pathname.startsWith("/api/")) {
    return null;
  }
  return url;
}

document.addEventListener("click", event => {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return;
  }
  const anchor = event.target.closest("a[href]");
  const url = internalAppUrl(anchor);
  if (!url) {
    return;
  }
  event.preventDefault();
  history.pushState(null, "", `${url.pathname}${url.search}${url.hash}`);
  if (globalNewDialog?.open) {
    globalNewDialog.close();
  }
  renderCurrentRoute({ scrollToTop: true });
});

window.addEventListener("popstate", () => {
  renderCurrentRoute({ scrollToTop: true });
});

function applyRouteParams() {
  ensureValidReportPeriod();
  const params = new URLSearchParams(location.search);
  const requestedReportType = params.get("periodo");
  const requestedMenuView = params.get("view");
  if (routeName() === "menu-semanal" && ["form", "orders", "production", "delivery"].includes(requestedMenuView)) {
    state.orderTab = requestedMenuView;
  }
  const weekParam = params.get("semana");
  if (weekParam && Number(weekParam) >= 1 && Number(weekParam) <= 5) {
    state.menuWeek = Number(weekParam);
    state.showMonthSummary = false;
    state.showMenuCatalog = false;
  }

  if (params.get("resumo") === "mes") {
    state.showMonthSummary = true;
    state.showMenuCatalog = false;
  }

  if (params.get("catalogo") === "cumbucas") {
    state.showMenuCatalog = true;
    state.showMonthSummary = false;
  }

  const yearParam = params.get("ano");
  const monthParam = params.get("mes");
  const startParam = params.get("inicio");
  const endParam = params.get("fim");
  const dayParam = params.get("dia");
  const reportWeekParam = weekParam && Number(weekParam) >= 1 && Number(weekParam) <= 5 ? Number(weekParam) : null;
  if (routeName() === "relatorios" && !yearParam && !monthParam && !dayParam) {
    const range = defaultReportWeekRange();
    const [rangeYear, rangeMonth] = range.start.split("-").map(Number);
    state.reportPeriod = {
      ...state.reportPeriod,
      type: "week",
      year: rangeYear,
      month: rangeMonth,
      start: range.start,
      end: range.end
    };
  }
  if (yearParam && monthParam) {
    state.menuPeriod = {
      year: Number(yearParam),
      month: Number(monthParam)
    };
    if (routeName() === "relatorios" || routeName() === "financeiro") {
      state.reportPeriod = {
        type: ["month", "week", "day"].includes(requestedReportType)
          ? requestedReportType
          : startParam && endParam
            ? "week"
            : reportWeekParam
              ? "week"
              : state.reportPeriod.type || "month",
        year: Number(yearParam),
        month: Number(monthParam),
        week: reportWeekParam || Number(state.reportPeriod.week || 1),
        date: dayParam || state.reportPeriod.date || isoDate(new Date()),
        start: startParam || state.reportPeriod.start || "",
        end: endParam || state.reportPeriod.end || ""
      };
    }
  }

  if (dayParam && (routeName() === "relatorios" || routeName() === "financeiro")) {
    const [year, month] = dayParam.split("-").map(Number);
    state.reportPeriod = {
      ...state.reportPeriod,
      type: "day",
      date: dayParam,
      year: year || state.reportPeriod.year,
      month: month || state.reportPeriod.month
    };
  }
}

function automaticBackupHealthHtml(result) {
  if (!result?.database) {
    return `<strong>Backup automático</strong><span>Não foi possível confirmar o Supabase agora.</span>`;
  }
  if (!result.backups?.length) {
    return `<strong>Backup automático</strong><span>Nenhuma cópia automática encontrada.</span>`;
  }
  const latest = result.backups[0];
  const updatedAt = latest.updated_at || latest.created_at;
  const ageDays = backupAgeDays(updatedAt);
  return `
    <strong>Último backup automático válido</strong>
    <span>${new Date(updatedAt).toLocaleString("pt-BR")} · ${ageDays === 0 ? "feito hoje" : `há ${ageDays} dia(s)`}</span>
  `;
}

function automaticBackupsHtml(result) {
  if (!result?.database) {
    return `<p class="muted">Não foi possível consultar os backups automáticos agora.</p>`;
  }
  if (!result.backups?.length) {
    return `<p class="muted">Nenhum backup automático encontrado ainda.</p>`;
  }
  const latest = result.backups[0];
  const latestUpdatedAt = latest.updated_at || latest.created_at;
  const latestAgeDays = backupAgeDays(latestUpdatedAt);
  return `
    <div class="backup-list-state ${latestAgeDays !== null && latestAgeDays > 2 ? "warning-state" : ""}">
      <strong>Último backup automático ${latestAgeDays !== null && latestAgeDays <= 2 ? "válido e recente" : "precisa ser conferido"}</strong>
      <span>${formatIsoDateBr(String(latest.backup_date || "").slice(0, 10))} - salvo ${new Date(latestUpdatedAt).toLocaleString("pt-BR")}</span>
    </div>
    <div class="table-wrap report-table">
      <table>
        <thead><tr><th>Data e hora</th><th>Tipo</th><th>Identificador</th><th></th></tr></thead>
        <tbody>
          ${result.backups.slice(0, 10).map(backup => {
            const date = String(backup.backup_date || "").slice(0, 10);
            const reference = String(backup.backup_id || backup.backup_date || "");
            const sourceLabels = {
              automatic: "Automático",
              manual: "Manual",
              "pre-reset": "Antes da limpeza",
              legacy: "Anterior"
            };
            const sourceLabel = sourceLabels[backup.source] || "Automático";
            return `
              <tr>
                <td>${new Date(backup.updated_at || backup.created_at).toLocaleString("pt-BR")}</td>
                <td>${sourceLabel}</td>
                <td><code>${escapeHtml(reference)}</code></td>
                <td>
                  <div class="table-actions">
                    <a class="secondary table-action" href="/api/backup?id=${encodeURIComponent(reference)}" target="_blank" rel="noopener">Baixar</a>
                    ${canUser("restoreBackup") ? `<button class="secondary table-action" type="button" data-backup-date="${date}" data-preview-auto-backup="${escapeHtml(reference)}">Prévia</button>` : ""}
                    ${canUser("restoreBackup") ? `<button class="danger table-action" type="button" data-backup-date="${date}" data-restore-auto-backup="${escapeHtml(reference)}">Restaurar</button>` : ""}
                    ${canUser("clearData") ? `<button class="danger table-action" type="button" data-backup-date="${date}" data-delete-auto-backup="${escapeHtml(reference)}">Excluir</button>` : ""}
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

async function loadAutomaticBackups() {
  const target = document.querySelector("#automatic-backups");
  const healthTarget = document.querySelector("#maintenance-backup-health");
  if (!target) {
    return;
  }
  try {
    const response = await fetch("/api/backups", { cache: "no-store" });
    const result = await response.json();
    target.innerHTML = automaticBackupsHtml(result);
    if (healthTarget) {
      const latestTimestamp = result.backups?.[0]?.updated_at || result.backups?.[0]?.created_at || "";
      const latestAgeDays = backupAgeDays(latestTimestamp);
      healthTarget.innerHTML = automaticBackupHealthHtml(result);
      healthTarget.classList.toggle(
        "warning-state",
        !result?.database || !result.backups?.length || latestAgeDays === null || latestAgeDays > 2
      );
    }
    enhanceResponsiveTables(target);
    bindRestoreBackupButtons();
    bindDeleteBackupButtons();
  } catch (error) {
    target.innerHTML = `<p class="muted">Não foi possível consultar os backups automáticos agora.</p>`;
    if (healthTarget) {
      healthTarget.innerHTML = automaticBackupHealthHtml(null);
      healthTarget.classList.add("warning-state");
    }
  }
}

function bindRestoreBackupButtons() {
  document.querySelectorAll("[data-preview-auto-backup]").forEach(button => {
    button.addEventListener("click", async event => {
      const reference = event.currentTarget.dataset.previewAutoBackup;
      const date = event.currentTarget.dataset.backupDate;
      const preview = await fetchBackupPreview(reference);
      if (preview) {
        showBackupPreviewModal(preview, reference, date);
      }
    });
  });

  document.querySelectorAll("[data-restore-auto-backup]").forEach(button => {
    button.addEventListener("click", async event => {
      const reference = event.currentTarget.dataset.restoreAutoBackup;
      const date = event.currentTarget.dataset.backupDate;
      if (!confirm(`Restaurar o backup automático de ${formatIsoDateBr(date)}? Os dados atuais serão substituídos.`)) {
        return;
      }
      const typed = prompt(`Digite ${date} para confirmar a restauração.`);
      if (typed !== date) {
        showToast("Restauração cancelada", "warning");
        return;
      }
      const response = await fetch("/api/restore-backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: reference })
      });
      const result = await response.json();
      if (!response.ok || !result.restored) {
        showToast(result.error || "Não foi possível restaurar o backup.", "error");
        return;
      }
      await hydrateState();
      showToast("Backup restaurado.", "success");
      renderBackups();
    });
  });
}

function bindDeleteBackupButtons() {
  document.querySelectorAll("[data-delete-auto-backup]").forEach(button => {
    button.addEventListener("click", async event => {
      const reference = event.currentTarget.dataset.deleteAutoBackup;
      const date = event.currentTarget.dataset.backupDate;
      if (!confirm(`Excluir o backup automático de ${formatIsoDateBr(date)}? Esta ação não pode ser desfeita.`)) {
        return;
      }
      const typed = prompt(`Digite ${date} para confirmar a exclusão.`);
      if (typed !== date) {
        showToast("Exclusão cancelada", "warning");
        return;
      }
      const response = await fetch(`/api/backup?id=${encodeURIComponent(reference)}`, {
        method: "DELETE"
      });
      const result = await response.json();
      if (!response.ok || !result.deleted) {
        showToast(result.error || "Não foi possível excluir o backup.", "error");
        return;
      }
      showToast("Backup excluído.", "success");
      loadAutomaticBackups();
    });
  });
}

async function fetchBackupPreview(reference) {
  try {
    const response = await fetch(`/api/backup-preview?id=${encodeURIComponent(reference)}`, { cache: "no-store" });
    const result = await response.json();
    if (!response.ok || !result.preview) {
      showToast(result.error || "Não foi possível consultar a prévia.", "error");
      return null;
    }
    return result;
  } catch (error) {
    showToast("Falha ao consultar a prévia do backup.", "error");
    return null;
  }
}

function closeModal() {
  document.querySelector(".modal-backdrop")?.remove();
}

function showBackupPreviewModal(result, restoreReference = "", restoreDate = "") {
  const preview = result.preview || {};
  closeModal();
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-label="Prévia do backup">
      <div class="modal-header">
        <div>
          <span class="eyebrow">Backup</span>
          <h2>Prévia de ${formatIsoDateBr(result.backupDate || restoreDate || isoDate(new Date()))}</h2>
        </div>
        <button class="secondary table-action" type="button" data-close-modal>Fechar</button>
      </div>
      <div class="backup-preview-grid">
        <span><b>${preview.clients || 0}</b><small>Clientes</small></span>
        <span><b>${preview.orders || 0}</b><small>Pedidos</small></span>
        <span><b>${preview.cashEntries || 0}</b><small>Caixa</small></span>
        <span><b>${preview.storeSales || 0}</b><small>Loja</small></span>
        <span><b>${preview.storeProducts || 0}</b><small>Produtos loja</small></span>
        <span><b>${preview.storeProductQuantities || 0}</b><small>Quantidades mensais</small></span>
        <span><b>${preview.menuItems || 0}</b><small>Menu</small></span>
        <span><b>${preview.pricingIngredients || preview.ingredients || 0}</b><small>Ingredientes</small></span>
        <span><b>${preview.pricingRecipes || 0}</b><small>Receitas</small></span>
      </div>
      <p class="muted">Atualizado: ${result.updatedAt ? new Date(result.updatedAt).toLocaleString("pt-BR") : new Date().toLocaleString("pt-BR")}</p>
      <div class="modal-actions">
        ${restoreReference && canUser("restoreBackup") ? `<button class="danger" type="button" data-backup-date="${restoreDate}" data-modal-restore="${escapeHtml(restoreReference)}">Restaurar este backup</button>` : ""}
        <button class="secondary" type="button" data-close-modal>Fechar</button>
      </div>
    </div>
  `;
  document.body.appendChild(backdrop);
  backdrop.querySelectorAll("[data-close-modal]").forEach(button => {
    button.addEventListener("click", closeModal);
  });
  backdrop.addEventListener("click", event => {
    if (event.target === backdrop) {
      closeModal();
    }
  });
  const restoreButton = backdrop.querySelector("[data-modal-restore]");
  if (restoreButton) {
    restoreButton.addEventListener("click", () => restoreAutomaticBackup(
      restoreButton.dataset.modalRestore,
      restoreButton.dataset.backupDate
    ));
  }
}

async function restoreAutomaticBackup(reference, date) {
  if (!confirm(`Restaurar o backup automático de ${formatIsoDateBr(date)}? Os dados atuais serão substituídos.`)) {
    return;
  }
  const typed = prompt(`Digite ${date} para confirmar a restauração.`);
  if (typed !== date) {
    showToast("Restauração cancelada", "warning");
    return;
  }
  const response = await fetch("/api/restore-backup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: reference })
  });
  const result = await response.json();
  if (!response.ok || !result.restored) {
    showToast(result.error || "Não foi possível restaurar o backup.", "error");
    return;
  }
  closeModal();
  await hydrateState();
  showToast("Backup restaurado.", "success");
  renderBackups();
}

function technicalEventsHtml(result) {
  if (!result?.database) {
    return `<p class="muted">Log técnico indisponível agora.</p>`;
  }
  if (!result.events?.length) {
    return `<p class="muted">Nenhum evento técnico registrado.</p>`;
  }
  return `
    <div class="recent-list">
      ${result.events.map(event => `
        <span>
          <b>${escapeHtml(event.event_type)}</b>
          ${escapeHtml(event.detail || "")}
          <small>${escapeHtml(event.username || "")} - ${new Date(event.created_at).toLocaleString("pt-BR")}</small>
        </span>
      `).join("")}
    </div>
  `;
}

async function loadTechnicalEvents() {
  const target = document.querySelector("#technical-events");
  if (!target) {
    return;
  }
  try {
    const response = await fetch("/api/events?limit=30", { cache: "no-store" });
    const result = await response.json();
    target.innerHTML = technicalEventsHtml(result);
  } catch (error) {
    target.innerHTML = `<p class="muted">Log técnico indisponível agora.</p>`;
  }
}

function renderAccount() {
  showStandardHero("Minha conta");
  setActive("minha-conta");
  const user = state.currentUser || {};
  app.innerHTML = `
    <section class="panel report-section account-panel">
      <div class="section-heading">
        <div>
          <h2>Minha conta</h2>
          <p class="muted-inline">Troque sua senha sem alterar variáveis do Vercel.</p>
        </div>
        <div class="client-count">
          <span>Perfil</span>
          <strong>${user.role === "admin" ? "Admin" : "Operação"}</strong>
        </div>
      </div>
      <div class="summary">
        <div class="metric"><span>Usuário</span><strong>${escapeHtml(user.username || "")}</strong></div>
        <div class="metric"><span>Nome</span><strong>${escapeHtml(user.name || user.username || "")}</strong></div>
        <div class="metric"><span>Acesso</span><strong>${user.role === "admin" ? "Total" : "Operação"}</strong></div>
      </div>
      <div class="permission-summary">
        ${[
          ["editFinancial", "Editar financeiro"],
          ["managePartnerAdjustments", "Ajustar conta-corrente de sócias"],
          ["manageClosings", "Fechar períodos"],
          ["restoreBackup", "Restaurar backups"],
          ["clearData", "Limpar dados"]
        ].map(([key, label]) => `<span class="${canUser(key) ? "allowed" : "blocked"}"><b>${canUser(key) ? "Permitido" : "Bloqueado"}</b>${label}</span>`).join("")}
      </div>
      <form id="change-password-form" class="form-grid">
        <label>Senha atual
          ${passwordFieldHtml({ name: "currentPassword", autocomplete: "current-password", required: true })}
        </label>
        <label>Nova senha
          ${passwordFieldHtml({ name: "newPassword", autocomplete: "new-password", minlength: 12, required: true })}
        </label>
        <label>Confirmar nova senha
          ${passwordFieldHtml({ name: "confirmPassword", autocomplete: "new-password", minlength: 12, required: true })}
        </label>
        <div class="actions">
          <button type="submit">Alterar senha</button>
        </div>
      </form>
    </section>
  `;

  bindPasswordToggles(app);

  on("#change-password-form", "submit", async event => {
    event.preventDefault();
    const values = readForm(event.currentTarget);
    if (values.newPassword !== values.confirmPassword) {
      showToast("A confirmação não confere.", "warning");
      return;
    }
    const response = await fetch("/api/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values)
    });
    const result = await response.json();
    if (!response.ok || !result.saved) {
      showToast(result.error || "Não foi possível alterar a senha.", "error");
      return;
    }
    event.currentTarget.reset();
    showToast("Senha alterada.", "success");
  });
}

function usersPanelHtml(result) {
  if (!result?.database) {
    return `<p class="muted">Usuários ainda estão vindo das variáveis do Vercel porque o banco não está disponível.</p>`;
  }
  const users = result.users || [];
  const editing = users.find(user => user.username === state.editUserName);
  return `
    <div class="dashboard-lane user-admin-layout">
      <div>
        <h3>${editing ? "Editar usuário" : "Novo usuário"}</h3>
        <form id="user-admin-form" class="form-grid single">
          <label>Usuário
            <input name="username" value="${escapeHtml(editing?.username || "")}" placeholder="nomeusuario" ${editing ? "readonly" : ""} required>
          </label>
          <label>Nome
            <input name="name" value="${escapeHtml(editing?.name || "")}" placeholder="Nome completo" required>
          </label>
          <label>Perfil
            <select name="role">
              <option value="admin" ${editing?.role === "admin" ? "selected" : ""}>Admin</option>
              <option value="operator" ${editing?.role === "operator" ? "selected" : ""}>Operação</option>
            </select>
          </label>
          <fieldset class="permission-fieldset">
            <legend>Permissões</legend>
            ${[
              ["editFinancial", "Editar valores financeiros"],
              ["managePartnerAdjustments", "Ajustar e estornar conta-corrente de sócias"],
              ["manageClosings", "Fechar e reabrir períodos"],
              ["restoreBackup", "Testar e restaurar backups"],
              ["clearData", "Reiniciar, limpar e excluir dados"]
            ].map(([key, label]) => `
              <label class="check-row">
                <input type="checkbox" name="permission_${key}" ${(editing?.role === "admin" || editing?.permissions?.[key]) ? "checked" : ""}>
                <span>${label}</span>
              </label>
            `).join("")}
            <small>Administradores sempre mantêm todas as permissões.</small>
          </fieldset>
          <label>${editing ? "Nova senha" : "Senha"}
            ${passwordFieldHtml({
              name: "password",
              autocomplete: "new-password",
              placeholder: editing ? "Deixe em branco para manter" : "Senha",
              required: !editing
            })}
          </label>
          <div class="actions">
            <button type="submit">${editing ? "Salvar usuário" : "Adicionar usuário"}</button>
            ${editing ? `<button class="secondary" type="button" id="cancel-user-edit">Cancelar</button>` : ""}
          </div>
        </form>
      </div>
      <div>
        <h3>Usuários cadastrados</h3>
        ${users.length ? `
          <div class="table-wrap report-table">
            <table>
              <thead><tr><th>Usuário</th><th>Nome</th><th>Perfil</th><th>Permissões</th><th>Status</th><th></th></tr></thead>
              <tbody>
                ${users.map(user => `
                  <tr>
                    <td>${escapeHtml(user.username)}</td>
                    <td>${escapeHtml(user.name)}</td>
                    <td>${user.role === "admin" ? "Admin" : "Operação"}</td>
                    <td>${user.role === "admin" ? "Todas" : Object.values(user.permissions || {}).filter(Boolean).length}</td>
                    <td>${user.active ? "Ativo" : "Inativo"}</td>
                    <td>
                      <div class="table-actions">
                        <button class="secondary table-action" type="button" data-edit-user="${escapeHtml(user.username)}">Editar</button>
                        ${user.active
                          ? `<button class="danger table-action" type="button" data-user-active="${escapeHtml(user.username)}" data-active="false">Desativar</button>`
                          : `<button class="secondary table-action" type="button" data-user-active="${escapeHtml(user.username)}" data-active="true">Reativar</button>`}
                      </div>
                    </td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        ` : `<p class="muted">Nenhum usuário cadastrado.</p>`}
      </div>
    </div>
  `;
}

async function loadUsersPanel() {
  const target = document.querySelector("#users-admin");
  if (!target) {
    return;
  }
  try {
    const response = await fetch("/api/users", { cache: "no-store" });
    const result = await response.json();
    target.innerHTML = usersPanelHtml(result);
    bindUsersPanel();
  } catch (error) {
    target.innerHTML = `<p class="muted">Não foi possível carregar usuários agora.</p>`;
  }
}

function bindUsersPanel() {
  const form = document.querySelector("#user-admin-form");
  if (form) {
    bindPasswordToggles(form);
    form.addEventListener("submit", async event => {
      event.preventDefault();
      const values = readForm(event.currentTarget);
      values.permissions = Object.fromEntries(
        ["editFinancial", "managePartnerAdjustments", "manageClosings", "restoreBackup", "clearData"]
          .map(key => [key, values[`permission_${key}`] === "on"])
      );
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values)
      });
      const result = await response.json();
      if (!response.ok || !result.saved) {
        showToast(result.error || "Não foi possível salvar usuário.", "error");
        return;
      }
      state.editUserName = null;
      showToast("Usuário salvo.", "success");
      loadUsersPanel();
      loadTechnicalEvents();
    });
  }

  const cancel = document.querySelector("#cancel-user-edit");
  if (cancel) {
    cancel.addEventListener("click", () => {
      state.editUserName = null;
      loadUsersPanel();
    });
  }

  document.querySelectorAll("[data-edit-user]").forEach(button => {
    button.addEventListener("click", event => {
      state.editUserName = event.currentTarget.dataset.editUser;
      loadUsersPanel();
    });
  });

  document.querySelectorAll("[data-user-active]").forEach(button => {
    button.addEventListener("click", async event => {
      const username = event.currentTarget.dataset.userActive;
      const active = event.currentTarget.dataset.active === "true";
      if (!confirm(`${active ? "Reativar" : "Desativar"} o usuário ${username}?`)) {
        return;
      }
      const response = await fetch("/api/users/active", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, active })
      });
      const result = await response.json();
      if (!response.ok || !result.saved) {
        showToast(result.error || "Não foi possível alterar usuário.", "error");
        return;
      }
      showToast(active ? "Usuário reativado." : "Usuário desativado.", "success");
      loadUsersPanel();
      loadTechnicalEvents();
    });
  });
}

Promise.all([hydrateSession(), hydrateState()]).then(() => {
  const currentDate = new Date();
  applyGlobalPeriodToViews(state.globalPeriod || {
    year: currentDate.getFullYear(),
    month: currentDate.getMonth() + 1
  }, {
    remember: Boolean(state.globalPeriod),
    syncReportPeriod: false
  });
  if (routeName() === "home") {
    const defaultRoute = configuredDefaultRoute();
    if (defaultRoute !== "home" && routes[defaultRoute]) {
      history.replaceState(null, "", `/${defaultRoute}`);
    }
  }
  renderCurrentRoute();
});
