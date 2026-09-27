const app = document.getElementById('app');
const mmenuHome = document.getElementById('mmenuHome');
const mmenuDetail = document.getElementById('mmenuDetail');
const categoryTitle = document.getElementById('categoryTitle');
const categorySubtitle = document.getElementById('categorySubtitle');
const categoryIconEl = document.getElementById('categoryIcon');
const categoryBody = document.getElementById('categoryBody');
const closeBtn = document.getElementById('closeBtn');

const playerNameEl = document.getElementById('playerName');
const playerJobEl = document.getElementById('playerJob');
const playerIdEl = document.getElementById('playerId');
const coinAmountEl = document.getElementById('coinAmount');
const topLevelEl = document.getElementById('topLevel');

let currentPlayer = null;
let currentCategory = null; // null = na home gridu, inace kljuc otvorene kategorije
let activeShopTab = 'auta';
let activeSettingsTab = 'opste';
let activeStatTab = 'profil';
let activeAchievementJob = null; // null = prikazuje mrežu kategorija poslova; inače = key posla (npr. 'rudar')
let activeSkillJob = null;       // isto, ali za tab Skillovi
let activeCareerJob = null;      // isto, ali za tab Karijera
let activeNagradeTab = 'kalendar';
let crateList = [];
let crateOpening = false;
let keybindList = [];
let milestoneList = []; // Nagrade -> Pozivni Kod -> traka sa nivoima (Config.ReferralMilestones)
let dailyRewardList = []; // Nagrade -> Dnevne Nagrade -> kalendar 1-30 (Config.DailyRewards)
let playtimeMilestoneList = []; // Nagrade -> Nagrade za Vreme -> pragovi (Config.PlaytimeMilestones)
let levelUpRewardDisplay = 0; // Prikazna vrednost keša za level up (Config.LevelUpRewardDisplay, stvarna isplata je u flamingo_payday)
let moneyPackageList = []; // Prodavnica -> Novac -> paketi za kupovinu (Config.MoneyPackages)
let rebindingId = null;
let activeHeroSlide = 0;
let heroSlideTimer = null;

// Scene/slajdovi za hero baner na Početnoj (3 tačke ispod naslova).
// Trenutno sve koriste istu pozadinsku sliku (img/hero_banner.jpg) - kad
// dobijemo prave slike za svaku scenu (npr. najavu update-a), samo dodaj
// image: 'img/nesto_drugo.jpg' u odgovarajući slajd ispod.
const HOME_HERO_SLIDES = [
  {
    image: 'img/hero_banner.jpg',
    eyebrow: 'Dobrodošli na',
    title: 'Flamingo<br>Roleplay',
    sub: 'Najveća roleplay zajednica na Balkanu. Uživaj u igri kakvu zaslužuješ.'
  },
  {
    image: 'img/hero_banner.jpg',
    eyebrow: 'Novo na serveru',
    title: 'Ažuriranje<br>uskoro stiže',
    sub: 'Pratite najave za sve detalje o narednom ažuriranju servera.'
  },
  {
    image: 'img/hero_banner.jpg',
    eyebrow: 'Aktivna zajednica',
    title: 'Igrači svaki dan<br>na serveru',
    sub: 'Flamingo Roleplay zajednica raste iz dana u dan uz redovne evente i nove sadržaje.'
  }
];

// Podkategorije unutar Prodavnice. Katalog (stavke/cene) namerno nije
// definisan - dodaje se kad se dostave konkretne stavke i cene u Coinima.
const SHOP_TABS = [
  { id: 'auta', label: 'Auta', sub: 'Kupovina vozila za Flamingo Coine', icon: 'fa-car' },
  { id: 'odeca', label: 'Odeća', sub: 'Kupovina odevnih predmeta', icon: 'fa-shirt' },
  { id: 'kutije', label: 'Kutije', sub: 'Nasumične nagrade za Coine', icon: 'fa-box-open' },
  { id: 'novac', label: 'Novac', sub: 'Kupovina novca za Coine', icon: 'fa-sack-dollar' },
  { id: 'ostalo', label: 'Ostalo', sub: 'Razni predmeti i dodaci', icon: 'fa-ellipsis' }
];

const SHOP_EMPTY_TEXT = {
  auta: 'Katalog vozila još nije definisan. Pošalji listu automobila i cenu u Coinima za svaki, pa ih dodajem ovde sa slikama i dugmetom za kupovinu.',
  odeca: 'Katalog odeće još nije definisan. Pošalji listu odevnih predmeta i cenu u Coinima da ih povežem sa shop-om odeće.',
  kutije: 'Sistem kutija (crates) još nije definisan. Reci koje kutije želiš, šta mogu da sadrže i po kojoj ceni u Coinima.',
  novac: 'Katalog novčanih paketa još nije definisan.',
  ostalo: 'Ova kategorija je prazna. Reci šta želiš da prodaješ ovde i dodajem.'
};

// Meta podaci po kategoriji: naslov, podnaslov, render funkcija za detalj ekran.
// Sadrzaj (battle pass progres, lista nagrada, statistika...) NIJE povezan
// ni na jedan sistem - ovo je samo NUI shell koji ceka backend.
const CATEGORY_META = {
  zadaci: {
    title: 'Zadaci',
    subtitle: 'Dnevni i nedeljni zadaci - nagrada je novac',
    icon: 'fa-list-check',
    render: () => { if (typeof renderZadaci === 'function') renderZadaci(); }
  },
  nagrade: {
    title: 'Nagrade',
    subtitle: 'Dnevna nagrada i pozivni kod',
    icon: 'fa-gift',
    render: renderNagrade
  },
  statistika: {
    title: 'Statistika',
    subtitle: 'Profil i napredak na serveru',
    icon: 'fa-chart-simple',
    render: renderStatistika
  },
  prodavnica: {
    title: 'Prodavnica',
    subtitle: 'Automobili, odeća, kutije i novac za Flamingo Coine',
    icon: 'fa-store',
    render: renderProdavnica
  },
  podesavanja: {
    title: 'Podešavanja',
    subtitle: 'Prilagodite svoje iskustvo igranja',
    icon: 'fa-gear',
    render: renderPodesavanja
  },
  pomoc: {
    title: 'Pomoć',
    subtitle: 'Prijavi igrača ili pozovi admina',
    icon: 'fa-headset',
    render: renderPomoc
  }
};

// Podkategorije unutar Statistike, isti stil kao tabovi u Prodavnici.
// Sadrzaj svake se generise u renderStatTabContent() na osnovu currentPlayer +
// placeholder-a za ono sto jos nije povezano na backend.
const STAT_TABS = [
  { id: 'profil', label: 'Moj Profil', sub: 'Osnovni podaci i XP', icon: 'fa-id-badge' },
  { id: 'finansije', label: 'Finansije', sub: 'Gotovina, banka i zarada', icon: 'fa-sack-dollar' },
  { id: 'karijera', label: 'Karijera', sub: 'Posao i napredovanje', icon: 'fa-briefcase' },
  { id: 'zivot', label: 'Život', sub: 'Vozila, imovina i ostalo', icon: 'fa-house-chimney' },
  { id: 'dosije', label: 'Dosije', sub: 'Kazne i krivični dosije', icon: 'fa-scale-balanced' },
  { id: 'dozvole', label: 'Dozvole', sub: 'Vozačka, oružje i licence', icon: 'fa-id-card-clip' },
  { id: 'dostignuca', label: 'Dostignuća', sub: 'Misije i zadaci', icon: 'fa-trophy' }
];

// oxmysql (i razne verzije mysql drajvera) mogu vratiti DATETIME kao obican
// string ("2026-08-29 20:15:32"), ali i kao broj (epoch) ili kao objekat -
// ova funkcija pokusava sve te oblike da pretvori u pravi JS Date, bez pucanja.
function toDateObject(sqlDate) {
  if (sqlDate === null || sqlDate === undefined || sqlDate === '') return null;

  let value = sqlDate;

  if (typeof value === 'number') {
    const d = new Date(value > 1e12 ? value : value * 1000); // ms ili s epoch
    return isNaN(d.getTime()) ? null : d;
  }

  if (typeof value !== 'string') {
    try {
      value = String(value);
    } catch (e) {
      return null;
    }
  }

  const iso = value.includes(' ') ? value.replace(' ', 'T') : value;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

function formatDate(sqlDateString) {
  const d = toDateObject(sqlDateString);
  if (!d) return '—';

  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();

  return `${dd}.${mm}.${yyyy}.`;
}

function daysSince(sqlDateString) {
  const d = toDateObject(sqlDateString);
  if (!d) return '—';

  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const days = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

  return days === 1 ? '1 dan' : `${days} dana`;
}

function formatMoney(amount) {
  if (typeof amount !== 'number') return '—';
  return `$${amount.toLocaleString('sr-RS')}`;
}

function formatCoins(amount) {
  if (typeof amount !== 'number') return '—';
  return `${amount.toLocaleString('sr-RS')} Flamingo Coina`;
}

function getStatItemsFor(tabId, level, xp, xpRequired) {
  const PLACEHOLDER = '—';

  const map = {
    profil: [
      { icon: 'fa-user', label: 'Ime i prezime', desc: 'Tvoje registrovano ime i prezime na serveru.', value: currentPlayer.name },
      { icon: 'fa-hashtag', label: 'ID igrača', desc: 'Jedinstveni identifikacioni broj tvog naloga na serveru.', value: `#${currentPlayer.serverId}` },
      { icon: 'fa-bolt', label: 'XP', desc: 'Trenutno iskustvo i koliko ti je potrebno do sledećeg nivoa.', value: `${xp} / ${xpRequired}` },
      { icon: 'fa-calendar-day', label: 'Datum registracije', desc: 'Datum kada si prvi put kreirao/la karakter na serveru.', value: formatDate(currentPlayer.registeredAt) },
      { icon: 'fa-hourglass-half', label: 'Dana na serveru', desc: 'Broj dana koji su prošli od tvoje registracije.', value: daysSince(currentPlayer.registeredAt) }
    ],
    finansije: [
      { icon: 'fa-money-bill-wave', label: 'Gotovina', desc: 'Novac koji trenutno nosiš kod sebe u kešu.', value: currentPlayer.finance ? formatMoney(currentPlayer.finance.cash) : PLACEHOLDER },
      { icon: 'fa-building-columns', label: 'Novac u banci', desc: 'Ukupna ušteđevina na tvom bankovnom računu.', value: currentPlayer.finance ? formatMoney(currentPlayer.finance.bank) : PLACEHOLDER },
      { icon: 'fa-chart-line', label: 'Dnevna zarada', desc: 'Koliko si zaradio/la u toku današnjeg dana.', value: (currentPlayer.finance && currentPlayer.finance.dailyEarned != null) ? formatMoney(currentPlayer.finance.dailyEarned) : PLACEHOLDER },
      { icon: 'fa-coins', label: 'Ukupna zarada', desc: 'Sav novac koji si ikada zaradio/la na serveru.', value: (currentPlayer.finance && currentPlayer.finance.totalEarned != null) ? formatMoney(currentPlayer.finance.totalEarned) : PLACEHOLDER },
      { icon: 'fa-cart-shopping', label: 'Ukupna potrošnja', desc: 'Sav novac koji si ikada potrošio/la na serveru.', value: (currentPlayer.finance && currentPlayer.finance.totalSpent != null) ? formatMoney(currentPlayer.finance.totalSpent) : PLACEHOLDER },
      { icon: 'coin-img', label: 'Potrošeno Flamingo Coina', desc: 'Broj Flamingo Coina koje si iskoristio/la u prodavnici.', value: (currentPlayer.finance && currentPlayer.finance.coinsSpent != null) ? formatCoins(currentPlayer.finance.coinsSpent) : PLACEHOLDER }
    ],
    karijera: [
      { icon: 'fa-briefcase', label: 'Trenutni posao', desc: 'Posao koji trenutno obavljaš na serveru.', value: currentPlayer.job },
      { icon: 'fa-ranking-star', label: 'Rank na poslu', desc: 'Tvoj trenutni rang napredovanja u okviru posla.', value: PLACEHOLDER },
      { icon: 'fa-business-time', label: 'Ukupno radnih sati', desc: 'Vreme provedeno u obavljanju posla.', value: PLACEHOLDER },
      { icon: 'fa-hand-holding-dollar', label: 'Zarađeno od posla', desc: 'Ukupan novac zarađen isključivo od posla.', value: PLACEHOLDER }
    ],
    zivot: [
      { icon: 'fa-car', label: 'Vozila', desc: 'Broj vozila koja poseduješ u svom vlasništvu.', value: PLACEHOLDER },
      { icon: 'fa-house', label: 'Nekretnine', desc: 'Broj stanova i kuća koje poseduješ.', value: PLACEHOLDER },
      { icon: 'fa-warehouse', label: 'Garažna mjesta', desc: 'Broj garažnih mesta koja si zakupio/la ili kupio/la.', value: PLACEHOLDER }
    ],
    dosije: [
      { icon: 'fa-ticket', label: 'Broj kazni', desc: 'Ukupan broj kazni koje si primio/la od strane policije.', value: PLACEHOLDER },
      { icon: 'fa-handcuffs', label: 'Broj hapšenja', desc: 'Koliko puta si do sada bio/bila uhapšen/a.', value: PLACEHOLDER },
      { icon: 'fa-hourglass-half', label: 'Vrijeme provedeno u zatvoru', desc: 'Ukupno vreme koje si proveo/la iza rešetaka.', value: PLACEHOLDER },
      { icon: 'fa-file-lines', label: 'Krivični dosije', desc: 'Status tvog krivičnog dosijea na serveru.', value: PLACEHOLDER }
    ],
    dozvole: [
      { icon: 'fa-id-card', label: 'Vozačka dozvola', desc: 'Status tvoje vozačke dozvole.', value: PLACEHOLDER },
      { icon: 'fa-gun', label: 'Dozvola za oružje', desc: 'Status dozvole za nošenje i korišćenje oružja.', value: PLACEHOLDER },
      { icon: 'fa-paw', label: 'Lovna dozvola', desc: 'Status tvoje dozvole za lov.', value: PLACEHOLDER },
      { icon: 'fa-certificate', label: 'Ostale licence', desc: 'Broj ostalih licenci koje poseduješ.', value: PLACEHOLDER }
    ],
    dostignuca: [
      { icon: 'fa-flag-checkered', label: 'Broj završenih misija', desc: 'Ukupan broj misija koje si uspešno završio/la.', value: PLACEHOLDER },
      { icon: 'fa-calendar-check', label: 'Dnevni zadaci', desc: 'Napredak u okviru dnevnih zadataka.', value: PLACEHOLDER },
      { icon: 'fa-calendar-week', label: 'Sedmični zadaci', desc: 'Napredak u okviru sedmičnih zadataka.', value: PLACEHOLDER }
    ]
  };

  return map[tabId] || [];
}

function renderStatTabContent() {
  const el = document.getElementById('statMainContent');
  if (!el) return;

  const lvl = currentPlayer.level;
  const level = lvl ? lvl.level : 1;
  const xp = lvl ? lvl.xp : 0;
  const xpRequired = lvl ? lvl.xpRequired : 150;

  let html = '';

  const items = getStatItemsFor(activeStatTab, level, xp, xpRequired);

  html += `
    <div class="fl-stat-grid">
      ${items.map(item => `
        <div class="fl-stat-card">
          <div class="fl-stat-card-header">
            <div class="fl-stat-card-icon">${item.icon === 'coin-img' ? '<img src="img/flamingo_coin.png" alt="Flamingo Coin" class="fl-inline-coin-icon">' : `<i class="fa-solid ${item.icon}"></i>`}</div>
            <span class="fl-stat-card-title">${escapeHtml(item.label)}</span>
          </div>
          ${item.desc ? `<p class="fl-stat-card-desc">${escapeHtml(item.desc)}</p>` : ''}
          <div class="fl-stat-card-footer">
            <span class="fl-stat-card-value">${escapeHtml(String(item.value))}</span>
          </div>
        </div>
      `).join('')}
    </div>
  `;

  el.innerHTML = html;
}

// Podkategorije Statistike se sada prikazuju u levoj traci (rail), ispod
// dugmeta "Statistika", umesto kao poseban sidenav unutar sadrzaja.
function renderStatSubmenu() {
  const wrap = document.getElementById('mmenuRailStatSubmenu');
  if (!wrap) return;

  wrap.innerHTML = STAT_TABS.map(t => `
    <button class="mmenu-rail-sub-item ${activeStatTab === t.id ? 'active' : ''}" data-stat-tab="${t.id}">
      ${escapeHtml(t.label)}
    </button>
  `).join('');

  if (typeof updateSkillDot === 'function') setTimeout(updateSkillDot, 0);

  wrap.querySelectorAll('.mmenu-rail-sub-item[data-stat-tab]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      activeAchievementJob = null;
      activeSkillJob = null;
      activeCareerJob = null;
      activeStatTab = btn.dataset.statTab;
      openCategory('statistika');
    });
  });
}

function renderStatistika() {
  renderStatSubmenu();

  if (!currentPlayer) {
    categoryBody.innerHTML = '';
    return;
  }

  categoryBody.innerHTML = `
    <div class="fl-settings-main-wrap">
      <div class="fl-settings-main" id="statMainContent"></div>
    </div>
  `;

  renderStatTabContent();
}

// Podkategorije Prodavnice su u levoj traci (rail), ispod dugmeta
// "Prodavnica" - isto kao kod Statistike. Sadrzaj ide preko cele sirine.
function renderShopSubmenu() {
  const wrap = document.getElementById('mmenuRailShopSubmenu');
  if (!wrap) return;

  wrap.innerHTML = SHOP_TABS.map(t => `
    <button class="mmenu-rail-sub-item ${activeShopTab === t.id ? 'active' : ''}" data-shop-tab="${t.id}">
      ${escapeHtml(t.label)}
    </button>
  `).join('');

  wrap.querySelectorAll('.mmenu-rail-sub-item[data-shop-tab]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      activeShopTab = btn.dataset.shopTab;
      // klik na "Kutije" iz trake uvek vraca na spisak svih kutija
      if (typeof window.pkResetDetail === 'function') window.pkResetDetail();
      openCategory('prodavnica');
    });
  });
}

function renderProdavnica() {
  renderShopSubmenu();

  const activeTabMeta = SHOP_TABS.find(t => t.id === activeShopTab) || SHOP_TABS[0];
  categoryTitle.textContent = activeTabMeta.label;
  categorySubtitle.textContent = activeTabMeta.sub;
  categoryIconEl.innerHTML = `<i class="fa-solid ${activeTabMeta.icon}"></i>`;

  categoryBody.innerHTML = `
    <div class="fl-settings-main-wrap">
      <div class="fl-settings-main" id="shopTabContent"></div>
    </div>
  `;

  const contentEl = document.getElementById('shopTabContent');

  if (activeShopTab === 'kutije' && typeof window.pkRenderCases === 'function') {
    window.pkRenderCases(contentEl);
  } else if (activeShopTab === 'novac' && moneyPackageList.length > 0) {
    renderMoneyGrid(contentEl);
  } else {
    contentEl.innerHTML = `
      <div class="fl-empty" style="padding-top:24px;">
        <i class="fa-solid ${activeTabMeta.icon}"></i>
        <span>${escapeHtml(SHOP_EMPTY_TEXT[activeShopTab])}</span>
      </div>
    `;
  }
}

function renderCrateGrid(container) {
  container.innerHTML = `
    <div class="fl-grid">
      ${crateList.map(crate => `
        <div class="fl-card fl-crate-card" data-crate-id="${crate.id}">
          <div class="fl-crate-icon"><i class="fa-solid ${crate.icon || 'fa-box-open'}"></i></div>
          <h3>${escapeHtml(crate.name)}</h3>
          <p>Otvori kutiju za šansu da dobiješ oružje ili keš.</p>
          <span class="fl-money-amount"><img src="img/flamingo_coin.png" alt="Flamingo Coin" class="fl-inline-coin-icon"> ${crate.price.toLocaleString('sr-RS')} Flamingo Coina</span>
        </div>
      `).join('')}
    </div>
  `;

  container.querySelectorAll('.fl-crate-card').forEach(card => {
    card.addEventListener('click', () => openCrateDetail(card.dataset.crateId));
  });
}

// Ikonica po tipu nagrade u spisku mogucih nagrada (detalj-ekran kutije).
function crateRewardIcon(type) {
  return type === 'weapon' ? 'fa-gun' : 'fa-sack-dollar';
}

// Tekst dugmeta za otvaranje kutije u detalj-ekranu (koristi se i pri
// prvom iscrtavanju i za vracanje dugmeta u prvobitno stanje posle
// neuspesne kupovine, npr. nedovoljno Coina).
function crateOpenBtnHtml(crate) {
  return `<img src="img/flamingo_coin.png" alt="Flamingo Coin" class="fl-inline-coin-icon"> Otvori za ${crate.price.toLocaleString('sr-RS')} Flamingo Coina`;
}

// Klik na kutiju u gridu otvara ovaj detalj-ekran: spisak SVIH mogucih
// nagrada sa sansama (transparentnost pre kupovine), pa tek onda igrac
// odlucuje da li da klikne "Otvori". Sam roll i dalje radi server (server.lua
// openCrate), ovo je samo prikaz pre toga.
function openCrateDetail(crateId) {
  const crate = crateList.find(c => c.id === crateId);
  if (!crate) return;

  const rewardsHtml = (crate.rewards || []).map(r => `
    <div class="fl-crate-detail-reward-row">
      <div class="fl-crate-detail-reward-icon"><i class="fa-solid ${crateRewardIcon(r.type)}"></i></div>
      <span class="fl-crate-detail-reward-label">${escapeHtml(r.label)}</span>
      <span class="fl-crate-detail-reward-chance">${r.chance}%</span>
    </div>
  `).join('');

  const overlay = document.createElement('div');
  overlay.className = 'fl-crate-overlay';
  overlay.innerHTML = `
    <div class="fl-crate-detail">
      <button class="fl-crate-detail-close" title="Zatvori"><i class="fa-solid fa-xmark"></i></button>

      <div class="fl-crate-detail-visual">
        <div class="fl-crate-detail-icon"><i class="fa-solid ${crate.icon || 'fa-box-open'}"></i></div>
        <h2>${escapeHtml(crate.name)}</h2>
        <p>Otvori kutiju i osvoji jednu od nagrada prikazanih desno.</p>
      </div>

      <div class="fl-crate-detail-rewards">
        <span class="fl-crate-detail-rewards-title">Moguće nagrade</span>
        <div class="fl-crate-detail-reward-list">${rewardsHtml}</div>
        <button class="fl-crate-buy fl-crate-detail-open-btn" data-crate-id="${crate.id}">${crateOpenBtnHtml(crate)}</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  overlay.querySelector('.fl-crate-detail-close').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });

  overlay.querySelector('.fl-crate-detail-open-btn').addEventListener('click', (e) => {
    openCrate(crate.id, e.currentTarget, overlay);
  });
}

// Kratak tekst za dugme kupovine novca (koristi se i pri prvom iscrtavanju
// i za vracanje dugmeta u prvobitno stanje posle kupovine).
function moneyBuyBtnHtml(pkg) {
  return `<img src="img/flamingo_coin.png" alt="Flamingo Coin" class="fl-inline-coin-icon"> ${pkg.price.toLocaleString('sr-RS')} Flamingo Coina`;
}

// Prodavnica -> Novac tab: direktna kupovina odredjene kolicine para (bez
// slucajnosti kao kod kutija - igrac tacno zna sta dobija pre kupovine).
function renderMoneyGrid(container) {
  container.innerHTML = `
    <div class="fl-grid">
      ${moneyPackageList.map(pkg => `
        <div class="fl-card fl-money-card">
          <div class="fl-money-image"><img src="img/money/${pkg.image}" alt="${formatMoney(pkg.amount)}"></div>
          <span class="fl-money-amount">${formatMoney(pkg.amount)}</span>
          <button class="fl-crate-buy" data-package-id="${pkg.id}">${moneyBuyBtnHtml(pkg)}</button>
          <span class="fl-referral-status fl-money-status" id="moneyStatus_${pkg.id}"></span>
        </div>
      `).join('')}
    </div>
  `;

  container.querySelectorAll('.fl-crate-buy[data-package-id]').forEach(btn => {
    btn.addEventListener('click', () => buyMoneyPackage(btn.dataset.packageId, btn));
  });
}

function buyMoneyPackage(packageId, btnEl) {
  if (btnEl.disabled) return;

  btnEl.disabled = true;
  btnEl.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Kupujem...';

  const statusEl = document.getElementById(`moneyStatus_${packageId}`);
  if (statusEl) statusEl.textContent = '';

  fetch(`https://${GetParentResourceName()}/buyMoneyPackage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ packageId })
  }).catch(() => {});
}

let pendingCrateDetailOverlay = null; // detalj-overlay otvoren kad je poceo openCrate, da ga uklonimo/vratimo posle rezultata
let pendingCrateId = null;

function openCrate(crateId, btnEl, detailOverlay) {
  if (crateOpening) return;
  crateOpening = true;

  pendingCrateId = crateId;
  pendingCrateDetailOverlay = detailOverlay || null;

  if (btnEl) {
    btnEl.disabled = true;
    btnEl.classList.add('fl-crate-buy--loading');
    btnEl.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Otvaram...';
  }

  fetch(`https://${GetParentResourceName()}/openCrate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ crateId })
  }).catch(() => {});
}

function showCrateResult(result) {
  crateOpening = false;

  const detailOverlay = pendingCrateDetailOverlay;
  const crateId = pendingCrateId;
  pendingCrateDetailOverlay = null;
  pendingCrateId = null;

  if (!result || !result.success) {
    // Neuspeh (npr. nema dovoljno Coina) - notifikacija vec stize kroz esx
    // notify, ovde samo vratimo dugme u detalj-ekranu da igrac moze ponovo.
    if (detailOverlay) {
      const btn = detailOverlay.querySelector('.fl-crate-detail-open-btn');
      const crate = crateList.find(c => c.id === crateId);
      if (btn && crate) {
        btn.disabled = false;
        btn.classList.remove('fl-crate-buy--loading');
        btn.innerHTML = crateOpenBtnHtml(crate);
      }
    }
    return;
  }

  if (detailOverlay) detailOverlay.remove();

  const crate = crateList.find(c => c.id === crateId);

  if (crate) {
    showCrateRoulette(crate, result);
  } else {
    // Fallback (ne bi trebalo da se desi) - prikazi prosti reveal ako iz nekog
    // razloga ne mozemo da nadjemo podatke o kutiji za rulet animaciju.
    showSimpleCrateReveal(result);
  }
}

// Fallback (ne bi trebalo da se desi) - prikazi prosti reveal ako iz nekog
// razloga ne mozemo da nadjemo podatke o kutiji za rulet animaciju.
function showSimpleCrateReveal(result) {
  const overlay = document.createElement('div');
  overlay.className = 'fl-crate-overlay';
  overlay.innerHTML = `
    <div class="fl-crate-reveal">
      <div class="fl-crate-reveal-icon"><i class="fa-solid ${crateRewardIcon(result.rewardType)}"></i></div>
      <span class="fl-crate-reveal-label">Osvojio si:</span>
      <span class="fl-crate-reveal-value">${escapeHtml(result.label)}</span>
      <button class="fl-crate-reveal-close">U redu</button>
    </div>
  `;

  document.body.appendChild(overlay);

  overlay.querySelector('.fl-crate-reveal-close').addEventListener('click', () => {
    overlay.remove();
  });
}

// Rulet animacija (kao CS:GO case opening): horizontalna traka stavki klizi
// ulevo i usporava dok se ne zaustavi tacno na OSVOJENOJ nagradi (koju je
// server vec odredio - ovo je samo vizuelni prikaz vec gotovog rezultata,
// ne bira nista samo, pa se ne moze "prevariti" gledanjem animacije).
function showCrateRoulette(crate, result) {
  const pool = (crate.rewards && crate.rewards.length) ? crate.rewards : [];

  // Definicija pobednicke nagrade iz configa (za ikonicu u traci) - trazimo
  // je po type+label koje je server vratio, jer server ne salje ceo objekat.
  const winningDef = pool.find(r => r.type === result.rewardType && r.label === result.label)
    || { type: result.rewardType, label: result.label };

  const stripLength = 44;
  const winIndex = stripLength - 5; // ostavlja par "bafer" stavki posle da nema praznine na kraju trake

  const stripItems = [];
  for (let i = 0; i < stripLength; i++) {
    if (i === winIndex) {
      stripItems.push(winningDef);
    } else if (pool.length > 0) {
      stripItems.push(pool[Math.floor(Math.random() * pool.length)]);
    } else {
      stripItems.push(winningDef);
    }
  }

  const itemWidth = 112;
  const viewportWidth = 560;
  const jitter = Math.floor(Math.random() * 50) - 25; // +-25px da centriranje ne bude uvek piksel-savrseno (izgleda prirodnije)
  const finalOffset = Math.round((viewportWidth / 2) - (winIndex * itemWidth + itemWidth / 2) + jitter);

  const overlay = document.createElement('div');
  overlay.className = 'fl-crate-overlay';
  overlay.innerHTML = `
    <div class="fl-crate-roulette">
      <h2 class="fl-crate-roulette-title">${escapeHtml(crate.name)}</h2>

      <div class="fl-crate-roulette-viewport" style="width:${viewportWidth}px;">
        <div class="fl-crate-roulette-marker"></div>
        <div class="fl-crate-roulette-fade fl-crate-roulette-fade--left"></div>
        <div class="fl-crate-roulette-fade fl-crate-roulette-fade--right"></div>
        <div class="fl-crate-roulette-strip" id="crateRouletteStrip">
          ${stripItems.map(it => `
            <div class="fl-crate-roulette-item">
              <div class="fl-crate-roulette-item-icon"><i class="fa-solid ${crateRewardIcon(it.type)}"></i></div>
              <span class="fl-crate-roulette-item-label">${escapeHtml(it.label)}</span>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="fl-crate-roulette-result hidden" id="crateRouletteResult">
        <span class="fl-crate-reveal-label">Osvojio si:</span>
        <span class="fl-crate-reveal-value">${escapeHtml(result.label)}</span>
        <button class="fl-crate-reveal-close" id="crateRouletteCloseBtn">U redu</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const strip = overlay.querySelector('#crateRouletteStrip');

  // Dupli requestAnimationFrame garantuje da je pocetno stanje (translateX(0))
  // stvarno iscrtano PRE nego sto promenimo transform - inace bi browser
  // mogao da "preskoci" animaciju i odmah prikaze krajnje stanje.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      strip.style.transform = `translateX(${finalOffset}px)`;
    });
  });

  strip.addEventListener('transitionend', () => {
    const items = overlay.querySelectorAll('.fl-crate-roulette-item');
    if (items[winIndex]) items[winIndex].classList.add('fl-crate-roulette-item--win');

    const resultEl = overlay.querySelector('#crateRouletteResult');
    resultEl.classList.remove('hidden');

    overlay.querySelector('#crateRouletteCloseBtn').addEventListener('click', () => overlay.remove());
  }, { once: true });
}

// Dostupne teme - boja se koristi kao glavni akcenat kroz ceo meni
// (dugmad, aktivne kartice, xp bar, badge-ovi...). Dodaj novu ovde i
// automatski se pojavljuje u Podesavanja -> Ostalo -> Tema.
const THEMES = [
  { id: 'neutral', name: 'Klasična',     color: '#c9a86a' },
  { id: 'pink',    name: 'Flamingo Pink', color: '#ff4d8d' },
  { id: 'gold',    name: 'Zlatna',        color: '#e8c07d' },
  { id: 'purple',  name: 'Ljubičasta',    color: '#9b5de5' },
  { id: 'blue',    name: 'Plava',         color: '#4d9fff' },
  { id: 'green',   name: 'Zelena',        color: '#3ddc84' },
  { id: 'red',     name: 'Crvena',        color: '#ff4d4d' }
];

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function applyTheme(themeId) {
  const theme = THEMES.find(t => t.id === themeId) || THEMES[0];

  document.documentElement.style.setProperty('--fl-pink', theme.color);
  document.documentElement.style.setProperty('--fl-pink-soft', hexToRgba(theme.color, 0.16));
  document.documentElement.style.setProperty('--fl-pink-glow', hexToRgba(theme.color, 0.35));
}

function updateSetting(key, value) {
  if (!currentPlayer.settings) currentPlayer.settings = {};
  currentPlayer.settings[key] = value;

  fetch(`https://${GetParentResourceName()}/updateSetting`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, value })
  }).catch(() => {});
}

const SETTINGS_NAV = [
  { id: 'opste',    label: 'Podešavanja', sub: 'Interfejs, tema i ostale opcije', icon: 'fa-gear' },
  { id: 'kontrole', label: 'Kontrole',    sub: 'Tasteri i prečice',               icon: 'fa-keyboard' },
  { id: 'igra',     label: 'Igra',        sub: 'Gameplay opcije',                 icon: 'fa-crosshairs' },
  { id: 'grafika',  label: 'Grafika',     sub: 'Izgled sveta i performanse',      icon: 'fa-display' }
];

// Podkategorije unutar Nagrade (levi sidenav, isti stil kao Podešavanja/Statistika).
const NAGRADE_NAV = [
  { id: 'kalendar', label: 'Dnevne Nagrade', sub: 'Loguj se svaki dan, sakupljaj nagrade', icon: 'fa-calendar-days' },
  { id: 'vreme',    label: 'Nagrade za Vreme', sub: 'Igraj i osvoji sezonske nagrade', icon: 'fa-clock' },
  { id: 'referral', label: 'Pozivni Kod',    sub: 'Pozovi drugare, osvoji nagrade', icon: 'fa-user-plus' }
];

// Vrednosti nagrade za pozivni kod - SAMO za prikaz teksta u NUI. Stvarni
// iznos koji igrac dobija se racuna na serveru iz Config.Referral
// (config.lua) - ako menjas iznos, promeni ga na OBA mesta da tekst ostane tacan.
const REFERRAL_REWARD_MONEY = 25000;
const REFERRAL_REWARD_COINS = 5;
const REFERRAL_OWNER_REWARD_MONEY = 10000; // koliko VLASNIK koda dobija po svakom drugu koji unese njegov kod

function settingsSectionHeader(icon, title) {
  return `
    <div class="fl-settings-section-header">
      <span class="fl-settings-accent-bar"></span>
      <div class="fl-settings-section-icon"><i class="fa-solid ${icon}"></i></div>
      <span class="fl-settings-section-title">${escapeHtml(title)}</span>
    </div>
  `;
}

function settingCard(id, icon, title, sub, checked) {
  return `
    <div class="fl-setting-card">
      <div class="fl-setting-card-icon"><i class="fa-solid ${icon}"></i></div>
      <div class="fl-setting-card-text">
        <span class="fl-setting-card-title">${escapeHtml(title)}</span>
        <span class="fl-setting-card-sub">${escapeHtml(sub)}</span>
      </div>
      <label class="fl-switch fl-setting-card-switch">
        <input type="checkbox" id="${id}" ${checked ? 'checked' : ''}>
        <span class="fl-switch-slider"></span>
      </label>
    </div>
  `;
}

// Boje ponudjene kao brzi izbor za crosshair - igrac i dalje moze da izabere
// bilo koju drugu boju preko color pickera pored njih.
const CROSSHAIR_COLORS = ['#ff4d8d', '#ffffff', '#3ddc84', '#4d9fff', '#ffcf4d', '#ff4d4d'];

// Panel za podesavanje crosshair-a (debljina, duzina, razmak, providnost, boja).
// Vrednosti se cuvaju kroz iste Settings kljuceve kao i ostalo (updateSetting),
// a klijent (client.lua) ih prosledjuje spoljnom flamingo_crosshair resursu
// preko 'flamingo_crosshair:setConfig' eventa - taj resurs treba da osluskuje
// taj event i da tim podacima iscrta crosshair.
function renderCrosshairPanel(settings, idSuffix) {
  const thickness = settings.crosshairThickness || 2;
  const size = settings.crosshairSize || 10;
  const gap = settings.crosshairGap != null ? settings.crosshairGap : 4;
  const opacityPct = Math.round((settings.crosshairOpacity != null ? settings.crosshairOpacity : 1) * 100);
  const color = settings.crosshairColor || '#ff4d8d';
  const disabled = settings.crosshairEnabled ? '' : 'fl-crosshair-panel--disabled';

  return `
    <div class="fl-crosshair-panel ${disabled}" id="crosshairPanel${idSuffix}" data-id-suffix="${idSuffix}">
      <div class="fl-crosshair-panel-head">
        <span class="fl-crosshair-panel-title"><i class="fa-solid fa-sliders"></i> Podesi nišan</span>
        <div class="fl-crosshair-preview">
          <span class="fl-crosshair-arm" id="chArmTop${idSuffix}"></span>
          <span class="fl-crosshair-arm" id="chArmBottom${idSuffix}"></span>
          <span class="fl-crosshair-arm" id="chArmLeft${idSuffix}"></span>
          <span class="fl-crosshair-arm" id="chArmRight${idSuffix}"></span>
        </div>
      </div>

      <div class="fl-crosshair-row">
        <span class="fl-crosshair-label">Debljina</span>
        <input type="range" class="fl-crosshair-slider" id="crosshairThickness${idSuffix}" min="1" max="6" step="1" value="${thickness}">
        <span class="fl-crosshair-value" id="crosshairThicknessVal${idSuffix}">${thickness}px</span>
      </div>

      <div class="fl-crosshair-row">
        <span class="fl-crosshair-label">Dužina</span>
        <input type="range" class="fl-crosshair-slider" id="crosshairSize${idSuffix}" min="4" max="24" step="1" value="${size}">
        <span class="fl-crosshair-value" id="crosshairSizeVal${idSuffix}">${size}px</span>
      </div>

      <div class="fl-crosshair-row">
        <span class="fl-crosshair-label">Razmak od centra</span>
        <input type="range" class="fl-crosshair-slider" id="crosshairGap${idSuffix}" min="0" max="12" step="1" value="${gap}">
        <span class="fl-crosshair-value" id="crosshairGapVal${idSuffix}">${gap}px</span>
      </div>

      <div class="fl-crosshair-row">
        <span class="fl-crosshair-label">Providnost</span>
        <input type="range" class="fl-crosshair-slider" id="crosshairOpacity${idSuffix}" min="20" max="100" step="5" value="${opacityPct}">
        <span class="fl-crosshair-value" id="crosshairOpacityVal${idSuffix}">${opacityPct}%</span>
      </div>

      <div class="fl-crosshair-row fl-crosshair-row--colors">
        <span class="fl-crosshair-label">Boja</span>
        <div class="fl-crosshair-colors">
          ${CROSSHAIR_COLORS.map(c => `<button type="button" class="fl-crosshair-color ${c.toLowerCase() === color.toLowerCase() ? 'active' : ''}" data-crosshair-color="${c}" style="background:${c};"></button>`).join('')}
          <label class="fl-crosshair-color fl-crosshair-color--custom" style="background:${color};">
            <input type="color" id="crosshairColorPicker${idSuffix}" value="${color}">
          </label>
        </div>
      </div>
    </div>
  `;
}

function renderKeybindRows() {
  if (!keybindList || keybindList.length === 0) {
    return `<div class="fl-empty" style="padding-top:10px;"><span>Nema prečica za prikaz.</span></div>`;
  }

  return keybindList.map(kb => `
    <div class="fl-keybind-row">
      <div class="fl-setting-info"><i class="fa-solid fa-keyboard"></i><span>${escapeHtml(kb.label)}</span></div>
      <div class="fl-keybind-controls">
        <span class="fl-keybind-key" id="keybindKey_${kb.id}">${escapeHtml(kb.key)}</span>
        <button class="fl-keybind-edit" data-keybind-id="${kb.id}" title="Promeni taster">
          <i class="fa-solid fa-pen"></i>
        </button>
      </div>
    </div>
  `).join('');
}

function renderThemeGrid(settings) {
  return `
    <div class="fl-theme-grid">
      ${THEMES.map(theme => `
        <button class="fl-theme-card ${settings.theme === theme.id ? 'active' : ''}" data-theme="${theme.id}">
          <span class="fl-theme-swatch" style="background:${theme.color};"></span>
          <span class="fl-theme-name">${escapeHtml(theme.name)}</span>
          ${settings.theme === theme.id ? '<i class="fa-solid fa-circle-check fl-theme-check"></i>' : ''}
        </button>
      `).join('')}
    </div>
  `;
}

// ==========================================================
// GRAFIKA - Podesavanja -> Grafika. Sve vrednosti idu kroz updateSetting
// (graphics* kljucevi), a client.lua ih prosledjuje resursu flamingo_graphics.
// ID preseta moraju da se poklapaju sa Config.Presets u flamingo_graphics/config.lua.
// "preview" je samo CSS filter za pregled u meniju - pravi izgled u igri
// dolazi iz timecycle fajla (flamingo_graphics/data/timecycle_mods_flamingo.xml).
// ==========================================================
const GRAPHICS_PRESETS = [
  { id: 'off',      name: 'Isključeno', desc: 'Originalni GTA izgled',              icon: 'fa-power-off',    preview: 'none' },
  { id: 'prirodno', name: 'Prirodno',   desc: 'Življe boje, lepša noćna svetla',     icon: 'fa-leaf',         preview: 'saturate(1.15) contrast(1.03)', badge: 'Preporučeno' },
  { id: 'zivo',     name: 'Živopisno',  desc: 'Jake, sočne boje',                    icon: 'fa-sun',          preview: 'saturate(1.5) contrast(1.06) brightness(1.03)' },
  { id: 'film',     name: 'Filmski',    desc: 'Kontrast, sjaj i vinjeta',            icon: 'fa-film',         preview: 'saturate(1.2) contrast(1.14) brightness(0.97)', vignette: true },
  { id: 'toplo',    name: 'Toplo',      desc: 'Zlatni ton, kao večiti zalazak',      icon: 'fa-fire',         preview: 'sepia(0.28) saturate(1.25) contrast(1.03)' },
  { id: 'hladno',   name: 'Hladno',     desc: 'Plavičasta, moderna slika',           icon: 'fa-snowflake',    preview: 'saturate(0.9) hue-rotate(-12deg) brightness(1.04) contrast(1.04)' },
  { id: 'crnobelo', name: 'Crno-belo',  desc: 'Za slike i snimanje',                 icon: 'fa-camera-retro', preview: 'grayscale(1) contrast(1.15)', vignette: true }
];

// Brzi profili - jednim klikom postavljaju vise opcija odjednom
const GRAPHICS_PROFILES = [
  {
    id: 'slab', name: 'Slabiji PC', icon: 'fa-battery-quarter',
    desc: 'Lepše boje, bez gubitka FPS-a',
    values: { graphicsPreset: 'prirodno', graphicsStrength: 60, graphicsDayNight: true, graphicsLod: 100, graphicsSoftShadows: false, graphicsVehicleLights: false }
  },
  {
    id: 'balans', name: 'Balans', icon: 'fa-scale-balanced',
    desc: 'Najbolji odnos izgleda i brzine',
    values: { graphicsPreset: 'prirodno', graphicsStrength: 80, graphicsDayNight: true, graphicsLod: 115, graphicsSoftShadows: true, graphicsVehicleLights: true }
  },
  {
    id: 'max', name: 'Maksimum', icon: 'fa-gem',
    desc: 'Najlepša slika, za jače računare',
    values: { graphicsPreset: 'film', graphicsStrength: 100, graphicsDayNight: true, graphicsLod: 150, graphicsSoftShadows: true, graphicsVehicleLights: true }
  }
];

const GRAPHICS_TIPS = [
  { icon: 'fa-wand-magic-sparkles', title: 'Post FX: Ultra', text: 'Bez ovoga se sjaj svetla i boje slabije vide.' },
  { icon: 'fa-image',               title: 'Kvalitet tekstura: High / Very High', text: 'Oštriji automobili, odeća i zgrade.' },
  { icon: 'fa-cloud-sun',           title: 'Senke: High + Softer', text: 'Prirodnije senke, posebno uz „Meke senke“ ovde.' },
  { icon: 'fa-road',                title: 'Extended Distance Scaling', text: 'Povećaj koliko FPS dozvoljava.' }
];

let graphicsPreviewNight = false;

function gfxSettings(settings) {
  const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);
  return {
    preset: GRAPHICS_PRESETS.some(p => p.id === settings.graphicsPreset) ? settings.graphicsPreset : 'prirodno',
    strength: num(settings.graphicsStrength, 80),
    dayNight: settings.graphicsDayNight !== false,
    lod: num(settings.graphicsLod, 100),
    softShadows: settings.graphicsSoftShadows === true,
    vehicleLights: settings.graphicsVehicleLights === true
  };
}

// Procena uticaja na FPS - samo informativno, za igraca
function gfxPerformance(g) {
  let score = 0;
  if (g.lod > 100) score += (g.lod - 100) / 25; // 150% = 2
  if (g.softShadows) score += 1;
  if (g.vehicleLights) score += 0.25;
  if (score < 0.75) return { id: 'low', label: 'Mali uticaj na FPS', icon: 'fa-bolt' };
  if (score < 2) return { id: 'mid', label: 'Srednji uticaj na FPS', icon: 'fa-gauge' };
  return { id: 'high', label: 'Veći uticaj na FPS', icon: 'fa-fire-flame-curved' };
}

function gfxActiveProfile(g) {
  return GRAPHICS_PROFILES.find(p =>
    p.values.graphicsPreset === g.preset &&
    p.values.graphicsStrength === g.strength &&
    p.values.graphicsDayNight === g.dayNight &&
    p.values.graphicsLod === g.lod &&
    p.values.graphicsSoftShadows === g.softShadows &&
    p.values.graphicsVehicleLights === g.vehicleLights
  );
}

function renderGraphicsTab(settings) {
  const g = gfxSettings(settings);
  const preset = GRAPHICS_PRESETS.find(p => p.id === g.preset);
  const perf = gfxPerformance(g);
  const activeProfile = gfxActiveProfile(g);
  const disabled = g.preset === 'off' ? 'fl-crosshair-panel--disabled' : '';

  let html = '';

  // ---- Pregled uzivo ----
  html += settingsSectionHeader('fa-eye', 'Pregled uživo');
  html += `
    <div class="fl-gfx-hero ${graphicsPreviewNight ? 'fl-gfx-hero--night' : ''}" id="gfxHero">
      <img src="img/hero_banner.jpg" class="fl-gfx-hero-img" alt="">
      <img src="img/hero_banner.jpg" class="fl-gfx-hero-img fl-gfx-hero-img--fx" id="gfxHeroFx" alt=""
           style="filter:${preset.preview}; opacity:${g.strength / 100};">
      <div class="fl-gfx-hero-vignette" id="gfxHeroVignette" style="opacity:${preset.vignette ? g.strength / 100 : 0};"></div>
      <div class="fl-gfx-hero-night"></div>
      <div class="fl-gfx-hero-shade"></div>

      <div class="fl-gfx-hero-top">
        <div class="fl-gfx-daynight">
          <button type="button" class="fl-gfx-daynight-btn ${graphicsPreviewNight ? '' : 'active'}" data-gfx-preview="day"><i class="fa-solid fa-sun"></i> Dan</button>
          <button type="button" class="fl-gfx-daynight-btn ${graphicsPreviewNight ? 'active' : ''}" data-gfx-preview="night"><i class="fa-solid fa-moon"></i> Noć</button>
        </div>
        <span class="fl-gfx-perf fl-gfx-perf--${perf.id}" id="gfxPerf"><i class="fa-solid ${perf.icon}"></i> ${escapeHtml(perf.label)}</span>
      </div>

      <div class="fl-gfx-hero-info">
        <div class="fl-gfx-hero-icon"><i class="fa-solid ${preset.icon}"></i></div>
        <div class="fl-gfx-hero-text">
          <span class="fl-gfx-hero-label">Aktivni izgled</span>
          <span class="fl-gfx-hero-name">${escapeHtml(preset.name)}</span>
          <span class="fl-gfx-hero-desc">${escapeHtml(preset.desc)}</span>
        </div>
        <span class="fl-gfx-hero-strength" id="gfxHeroStrength">${g.preset === 'off' ? '' : `${g.strength}%`}</span>
      </div>
    </div>
  `;

  // ---- Preseti ----
  html += settingsSectionHeader('fa-palette', 'Izgled sveta');
  html += `<div class="fl-gfx-preset-grid">`;
  html += GRAPHICS_PRESETS.map(p => `
    <button type="button" class="fl-gfx-preset ${p.id === g.preset ? 'active' : ''}" data-gfx-preset="${p.id}" data-sfx="activate">
      <div class="fl-gfx-preset-thumb">
        <img src="img/hero_banner.jpg" alt="" style="filter:${p.preview};">
        ${p.vignette ? '<span class="fl-gfx-preset-vignette"></span>' : ''}
        ${p.badge ? `<span class="fl-gfx-preset-badge">${escapeHtml(p.badge)}</span>` : ''}
        ${p.id === g.preset ? '<span class="fl-gfx-preset-check"><i class="fa-solid fa-check"></i></span>' : ''}
      </div>
      <div class="fl-gfx-preset-body">
        <span class="fl-gfx-preset-name"><i class="fa-solid ${p.icon}"></i> ${escapeHtml(p.name)}</span>
        <span class="fl-gfx-preset-desc">${escapeHtml(p.desc)}</span>
      </div>
    </button>
  `).join('');
  html += `</div>`;

  // ---- Fino podesavanje ----
  html += settingsSectionHeader('fa-sliders', 'Fino podešavanje');
  html += `
    <div class="fl-crosshair-panel fl-gfx-sliders">
      <div class="fl-crosshair-row ${disabled}" id="gfxStrengthRow">
        <span class="fl-crosshair-label"><i class="fa-solid fa-droplet fl-gfx-row-icon"></i> Jačina efekta</span>
        <input type="range" class="fl-crosshair-slider" id="gfxStrength" min="0" max="100" step="5" value="${g.strength}">
        <span class="fl-crosshair-value" id="gfxStrengthVal">${g.strength}%</span>
      </div>
      <div class="fl-crosshair-row">
        <span class="fl-crosshair-label"><i class="fa-solid fa-mountain-sun fl-gfx-row-icon"></i> Daljina detalja</span>
        <input type="range" class="fl-crosshair-slider" id="gfxLod" min="100" max="150" step="5" value="${g.lod}">
        <span class="fl-crosshair-value" id="gfxLodVal">${g.lod}%</span>
      </div>
      <p class="fl-gfx-hint"><i class="fa-solid fa-circle-info"></i> Veća daljina detalja znači da se zgrade, drveće i auta vide oštrije i dalje, ali troši više FPS-a.</p>
    </div>
  `;

  html += `<div class="fl-setting-card-grid">`;
  html += settingCard('gfxDayNight', 'fa-moon', 'Noćni izgled', 'Posebno podešena noć: jači sjaj svetala grada', g.dayNight);
  html += settingCard('gfxSoftShadows', 'fa-cloud-sun', 'Meke senke', 'Prirodnije, glađe ivice senki', g.softShadows);
  html += settingCard('gfxVehicleLights', 'fa-car-side', 'Jača svetla vozila', 'Farovi i stop svetla jače svetle', g.vehicleLights);
  html += `</div>`;

  // ---- Brzi profili ----
  html += settingsSectionHeader('fa-bolt', 'Brzi profili');
  html += `<div class="fl-gfx-profile-grid">`;
  html += GRAPHICS_PROFILES.map(p => `
    <button type="button" class="fl-gfx-profile ${activeProfile && activeProfile.id === p.id ? 'active' : ''}" data-gfx-profile="${p.id}" data-sfx="buy">
      <div class="fl-gfx-profile-icon"><i class="fa-solid ${p.icon}"></i></div>
      <div class="fl-gfx-profile-text">
        <span class="fl-gfx-profile-name">${escapeHtml(p.name)}</span>
        <span class="fl-gfx-profile-desc">${escapeHtml(p.desc)}</span>
      </div>
      ${activeProfile && activeProfile.id === p.id ? '<i class="fa-solid fa-circle-check fl-theme-check"></i>' : ''}
    </button>
  `).join('');
  html += `</div>`;

  // ---- Saveti ----
  html += settingsSectionHeader('fa-lightbulb', 'Saveti za najlepšu sliku');
  html += `
    <div class="fl-gfx-tips">
      <p class="fl-gfx-tips-intro">Rezolucija, teksture i senke se menjaju u <b>ESC → Settings → Graphics</b>. FiveM ne dozvoljava skriptama da ih menjaju, pa ih podesi sam:</p>
      <div class="fl-gfx-tips-grid">
        ${GRAPHICS_TIPS.map(t => `
          <div class="fl-gfx-tip">
            <i class="fa-solid ${t.icon}"></i>
            <div><span class="fl-gfx-tip-title">${escapeHtml(t.title)}</span><span class="fl-gfx-tip-text">${escapeHtml(t.text)}</span></div>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  return html;
}

function attachGraphicsListeners(settings) {
  // Ponovo iscrtava tab, ali zadrzava poziciju skrola (da ne skoci na vrh posle klika)
  const rerender = () => {
    const main = document.getElementById('settingsMainContent');
    const top = main ? main.scrollTop : 0;
    renderSettingsTabContent(currentPlayer.settings || settings);
    if (main) main.scrollTop = top;
  };

  document.querySelectorAll('[data-gfx-preset]').forEach(btn => {
    btn.addEventListener('click', () => {
      updateSetting('graphicsPreset', btn.dataset.gfxPreset);
      rerender();
    });
  });

  document.querySelectorAll('[data-gfx-profile]').forEach(btn => {
    btn.addEventListener('click', () => {
      const profile = GRAPHICS_PROFILES.find(p => p.id === btn.dataset.gfxProfile);
      if (!profile) return;
      Object.entries(profile.values).forEach(([key, value]) => updateSetting(key, value));
      rerender();
    });
  });

  document.querySelectorAll('[data-gfx-preview]').forEach(btn => {
    btn.addEventListener('click', () => {
      graphicsPreviewNight = btn.dataset.gfxPreview === 'night';
      const hero = document.getElementById('gfxHero');
      if (hero) hero.classList.toggle('fl-gfx-hero--night', graphicsPreviewNight);
      document.querySelectorAll('[data-gfx-preview]').forEach(b => b.classList.toggle('active', b === btn));
    });
  });

  const strength = document.getElementById('gfxStrength');
  if (strength) {
    strength.addEventListener('input', () => {
      const v = parseInt(strength.value, 10) || 0;
      const preset = GRAPHICS_PRESETS.find(p => p.id === gfxSettings(currentPlayer.settings || settings).preset);
      document.getElementById('gfxStrengthVal').textContent = `${v}%`;
      const fx = document.getElementById('gfxHeroFx');
      if (fx) fx.style.opacity = v / 100;
      const vig = document.getElementById('gfxHeroVignette');
      if (vig) vig.style.opacity = preset && preset.vignette ? v / 100 : 0;
      const label = document.getElementById('gfxHeroStrength');
      if (label && preset && preset.id !== 'off') label.textContent = `${v}%`;
      if (window.flSound) window.flSound.play('slide');
    });
    strength.addEventListener('change', () => {
      updateSetting('graphicsStrength', parseInt(strength.value, 10) || 0);
      rerender();
    });
  }

  const lod = document.getElementById('gfxLod');
  if (lod) {
    lod.addEventListener('input', () => {
      document.getElementById('gfxLodVal').textContent = `${lod.value}%`;
      if (window.flSound) window.flSound.play('slide');
    });
    lod.addEventListener('change', () => {
      updateSetting('graphicsLod', parseInt(lod.value, 10) || 100);
      rerender();
    });
  }

  const bindToggle = (id, key) => {
    const elx = document.getElementById(id);
    if (!elx) return;
    elx.addEventListener('change', (e) => {
      updateSetting(key, e.target.checked);
      rerender();
    });
  };
  bindToggle('gfxDayNight', 'graphicsDayNight');
  bindToggle('gfxSoftShadows', 'graphicsSoftShadows');
  bindToggle('gfxVehicleLights', 'graphicsVehicleLights');
}

function renderSettingsTabContent(settings) {
  const el = document.getElementById('settingsMainContent');
  if (!el) return;

  let html = '';

  if (activeSettingsTab === 'opste') {
    html += settingsSectionHeader('fa-desktop', 'Interfejs');
    html += `<div class="fl-setting-card-grid">`;
    html += settingCard('setHud', 'fa-desktop', 'Prikaz na ekranu', 'Život, novac, brzina i ostalo', settings.hudEnabled !== false);
    html += settingCard('setChat', 'fa-comments', 'Čet', 'Prikaži prozor za čet', settings.chatEnabled !== false);
    html += settingCard('setId', 'fa-id-badge', 'ID igrača', 'Prikaži ID-ove igrača', settings.idEnabled !== false);
    html += settingCard('setMinimap', 'fa-map', 'Minimapa', 'Prikaži minimapu', settings.minimapEnabled);
    html += `</div>`;

    html += settingsSectionHeader('fa-palette', 'Tema');
    html += renderThemeGrid(settings);

    const menuVolume = Number.isFinite(Number(settings.menuVolume)) ? Number(settings.menuVolume) : 60;
    html += settingsSectionHeader('fa-volume-high', 'Zvuk');
    html += `<div class="fl-setting-card-grid">`;
    html += settingCard('setMenuSounds', 'fa-volume-high', 'Zvukovi menija', 'Klikovi, kutije, nagrade i kupovina', settings.menuSounds !== false);
    html += `</div>`;
    html += `
      <div class="fl-crosshair-panel ${settings.menuSounds === false ? 'fl-crosshair-panel--disabled' : ''}" id="menuVolumePanel">
        <div class="fl-crosshair-row">
          <span class="fl-crosshair-label">Jačina zvuka</span>
          <input type="range" class="fl-crosshair-slider" id="menuVolumeSlider" min="0" max="100" step="5" value="${menuVolume}">
          <span class="fl-crosshair-value" id="menuVolumeVal">${menuVolume}%</span>
          <button class="fl-btn-secondary fl-sound-test" id="menuSoundTest" data-sfx="none"><i class="fa-solid fa-play"></i> Probaj</button>
        </div>
      </div>
    `;
  }

  if (activeSettingsTab === 'kontrole') {
    html += settingsSectionHeader('fa-keyboard', 'Kontrole');
    html += renderKeybindRows();
  }

  if (activeSettingsTab === 'igra') {
    html += settingsSectionHeader('fa-crosshairs', 'Gameplay opcije');
    html += `<div class="fl-setting-card-grid">`;
    html += settingCard('setCrosshair2', 'fa-crosshairs', 'Nišan', 'Prikaži nišan na sredini ekrana', settings.crosshairEnabled);
    html += settingCard('setCinematic2', 'fa-film', 'Filmski režim', 'Crne trake i čist kadar za snimanje', settings.cinematicMode);
    html += `</div>`;
    html += renderCrosshairPanel(settings, '_igra');
  }

  if (activeSettingsTab === 'grafika') {
    html += renderGraphicsTab(settings);
  }

  el.innerHTML = html;
  attachSettingsListeners(settings);
}

function attachSettingsListeners(settings) {
  const bind = (id, key) => {
    const elx = document.getElementById(id);
    if (elx) elx.addEventListener('change', (e) => updateSetting(key, e.target.checked));
  };

  const bindCrosshairToggle = (id) => {
    const elx = document.getElementById(id);
    if (!elx) return;
    elx.addEventListener('change', (e) => {
      updateSetting('crosshairEnabled', e.target.checked);
      document.querySelectorAll('.fl-crosshair-panel').forEach(panel => {
        panel.classList.toggle('fl-crosshair-panel--disabled', !e.target.checked);
      });
    });
  };

  bind('setHud', 'hudEnabled');
  bind('setChat', 'chatEnabled');
  bind('setId', 'idEnabled');
  bind('setMinimap', 'minimapEnabled');
  bindCrosshairToggle('setCrosshair2');
  bind('setCinematic2', 'cinematicMode');

  const soundToggle = document.getElementById('setMenuSounds');
  if (soundToggle) {
    soundToggle.addEventListener('change', (e) => {
      updateSetting('menuSounds', e.target.checked);
      const panel = document.getElementById('menuVolumePanel');
      if (panel) panel.classList.toggle('fl-crosshair-panel--disabled', !e.target.checked);
      if (e.target.checked && window.flSound) window.flSound.play('activate');
    });
  }

  const volSlider = document.getElementById('menuVolumeSlider');
  if (volSlider) {
    volSlider.addEventListener('input', (e) => {
      const v = parseInt(e.target.value, 10) || 0;
      if (!currentPlayer.settings) currentPlayer.settings = {};
      currentPlayer.settings.menuVolume = v;
      const valEl = document.getElementById('menuVolumeVal');
      if (valEl) valEl.textContent = `${v}%`;
      if (window.flSound) window.flSound.play('slide');
    });
    volSlider.addEventListener('change', (e) => {
      updateSetting('menuVolume', parseInt(e.target.value, 10) || 0);
      if (window.flSound) window.flSound.play('buy');
    });
  }

  const soundTest = document.getElementById('menuSoundTest');
  if (soundTest) {
    soundTest.addEventListener('click', () => {
      if (window.flSound) window.flSound.play('win', { tier: 3 });
    });
  }

  attachCrosshairPanelListeners('_igra');
  attachGraphicsListeners(settings);

  document.querySelectorAll('.fl-theme-card').forEach(btn => {
    btn.addEventListener('click', () => {
      updateSetting('theme', btn.dataset.theme);
      applyTheme(btn.dataset.theme);
      renderSettingsTabContent(currentPlayer.settings || settings);
    });
  });

  document.querySelectorAll('.fl-keybind-edit').forEach(btn => {
    btn.addEventListener('click', () => startRebind(btn.dataset.keybindId, btn));
  });
}

// Live preview + cuvanje podesavanja za crosshair panel (debljina/duzina/razmak/
// providnost/boja). idSuffix razlikuje panel u "Podesavanja" tabu od onog u "Igra" tabu.
function updateCrosshairPreview(idSuffix, thickness, size, gap, opacityPct, color) {
  const opacity = opacityPct / 100;

  const arms = {
    top:    { el: document.getElementById(`chArmTop${idSuffix}`),    w: thickness, h: size, top: `calc(50% - ${gap + size}px)`, left: `calc(50% - ${thickness / 2}px)` },
    bottom: { el: document.getElementById(`chArmBottom${idSuffix}`), w: thickness, h: size, top: `calc(50% + ${gap}px)`,        left: `calc(50% - ${thickness / 2}px)` },
    left:   { el: document.getElementById(`chArmLeft${idSuffix}`),   w: size, h: thickness, top: `calc(50% - ${thickness / 2}px)`, left: `calc(50% - ${gap + size}px)` },
    right:  { el: document.getElementById(`chArmRight${idSuffix}`),  w: size, h: thickness, top: `calc(50% - ${thickness / 2}px)`, left: `calc(50% + ${gap}px)` }
  };

  Object.values(arms).forEach(arm => {
    if (!arm.el) return;
    arm.el.style.width = `${arm.w}px`;
    arm.el.style.height = `${arm.h}px`;
    arm.el.style.top = arm.top;
    arm.el.style.left = arm.left;
    arm.el.style.background = color;
    arm.el.style.opacity = opacity;
  });
}

function attachCrosshairPanelListeners(idSuffix) {
  const thicknessInput = document.getElementById(`crosshairThickness${idSuffix}`);
  const sizeInput = document.getElementById(`crosshairSize${idSuffix}`);
  const gapInput = document.getElementById(`crosshairGap${idSuffix}`);
  const opacityInput = document.getElementById(`crosshairOpacity${idSuffix}`);
  const colorPicker = document.getElementById(`crosshairColorPicker${idSuffix}`);

  if (!thicknessInput || !sizeInput || !gapInput || !opacityInput || !colorPicker) return;

  const thicknessVal = document.getElementById(`crosshairThicknessVal${idSuffix}`);
  const sizeVal = document.getElementById(`crosshairSizeVal${idSuffix}`);
  const gapVal = document.getElementById(`crosshairGapVal${idSuffix}`);
  const opacityVal = document.getElementById(`crosshairOpacityVal${idSuffix}`);
  const colorSwatchLabel = document.querySelector(`#crosshairColorPicker${idSuffix}`)?.closest('.fl-crosshair-color--custom');

  const currentColor = () => colorPicker.value;

  const refreshPreview = () => {
    const thickness = parseInt(thicknessInput.value, 10);
    const size = parseInt(sizeInput.value, 10);
    const gap = parseInt(gapInput.value, 10);
    const opacityPct = parseInt(opacityInput.value, 10);

    if (thicknessVal) thicknessVal.textContent = `${thickness}px`;
    if (sizeVal) sizeVal.textContent = `${size}px`;
    if (gapVal) gapVal.textContent = `${gap}px`;
    if (opacityVal) opacityVal.textContent = `${opacityPct}%`;

    updateCrosshairPreview(idSuffix, thickness, size, gap, opacityPct, currentColor());
  };

  refreshPreview();

  thicknessInput.addEventListener('input', refreshPreview);
  sizeInput.addEventListener('input', refreshPreview);
  gapInput.addEventListener('input', refreshPreview);
  opacityInput.addEventListener('input', refreshPreview);

  thicknessInput.addEventListener('change', () => updateSetting('crosshairThickness', parseInt(thicknessInput.value, 10)));
  sizeInput.addEventListener('change', () => updateSetting('crosshairSize', parseInt(sizeInput.value, 10)));
  gapInput.addEventListener('change', () => updateSetting('crosshairGap', parseInt(gapInput.value, 10)));
  opacityInput.addEventListener('change', () => updateSetting('crosshairOpacity', parseInt(opacityInput.value, 10) / 100));

  const setColor = (hex) => {
    colorPicker.value = hex;
    if (colorSwatchLabel) colorSwatchLabel.style.background = hex;
    document.querySelectorAll(`#crosshairPanel${idSuffix} .fl-crosshair-color[data-crosshair-color]`).forEach(btn => {
      btn.classList.toggle('active', btn.dataset.crosshairColor.toLowerCase() === hex.toLowerCase());
    });
    refreshPreview();
    updateSetting('crosshairColor', hex);
  };

  document.querySelectorAll(`#crosshairPanel${idSuffix} .fl-crosshair-color[data-crosshair-color]`).forEach(btn => {
    btn.addEventListener('click', () => setColor(btn.dataset.crosshairColor));
  });

  colorPicker.addEventListener('input', () => {
    if (colorSwatchLabel) colorSwatchLabel.style.background = colorPicker.value;
    refreshPreview();
  });
  colorPicker.addEventListener('change', () => setColor(colorPicker.value));
}

function renderPodesavanja() {
  const settings = currentPlayer.settings || { minimapEnabled: true, cinematicMode: false, theme: 'neutral', hudEnabled: true, chatEnabled: true, idEnabled: true, crosshairEnabled: false, crosshairThickness: 2, crosshairSize: 10, crosshairGap: 4, crosshairOpacity: 1, crosshairColor: '#ff4d8d' };

  const navHtml = SETTINGS_NAV.map(n => `
    <button class="fl-settings-nav-item ${activeSettingsTab === n.id ? 'active' : ''}" data-settings-tab="${n.id}">
      <div class="fl-settings-nav-icon"><i class="fa-solid ${n.icon}"></i></div>
      <div class="fl-settings-nav-text">
        <span class="fl-settings-nav-title">${escapeHtml(n.label)}</span>
        <span class="fl-settings-nav-sub">${escapeHtml(n.sub)}</span>
      </div>
      <i class="fa-solid fa-chevron-right fl-settings-nav-chevron"></i>
    </button>
  `).join('');

  categoryBody.innerHTML = `
    <div class="fl-settings-layout">
      <div class="fl-settings-sidenav">${navHtml}</div>
      <div class="fl-settings-main-wrap">
        <div class="fl-settings-main" id="settingsMainContent"></div>

        <div class="fl-settings-actionbar">
          <button class="fl-btn-secondary" id="resetSettingsBtn"><i class="fa-solid fa-rotate-left"></i> Resetuj podešavanja</button>
          <button class="fl-btn-primary" id="saveSettingsBtn"><i class="fa-solid fa-floppy-disk"></i> Sačuvaj podešavanja</button>
        </div>
      </div>
    </div>
  `;

  categoryBody.querySelectorAll('.fl-settings-nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      activeSettingsTab = btn.dataset.settingsTab;
      renderPodesavanja();
    });
  });

  renderSettingsTabContent(settings);

  document.getElementById('resetSettingsBtn').addEventListener('click', () => {
    fetch(`https://${GetParentResourceName()}/resetSettings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    }).then(r => r.json()).then(newSettings => {
      currentPlayer.settings = newSettings;
      applyTheme(newSettings.theme);
      renderPodesavanja();
    }).catch(() => {});
  });

  document.getElementById('saveSettingsBtn').addEventListener('click', () => {
    fetch(`https://${GetParentResourceName()}/saveSettings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    }).catch(() => {});
  });
}

// Pomoć kategorija - prikazuje koliko je admina trenutno on-duty (uzivo iz
// flamingo_staff, ako je pokrenut) i formu za slanje prijave. Report ide kroz
// isti backend kao /report komanda (flamingo_staff:server:submitReport),
// samo bez slash komande - kao sto je trazeno.
function renderPomoc() {
  categoryBody.innerHTML = `
    <div class="fl-help-wrap">
      <div class="fl-help-status" id="helpDutyStatus">
        <div class="fl-help-status-icon"><i class="fa-solid fa-shield-halved"></i></div>
        <div class="fl-help-status-text">
          <span class="fl-help-status-label">Trenutno na dužnosti</span>
          <span class="fl-help-status-value" id="helpDutyCount">Učitavanje...</span>
        </div>
      </div>

      <div class="fl-help-form">
        <label class="fl-help-form-label">Opiši problem ili razlog prijave</label>
        <textarea id="helpReportText" class="fl-help-textarea" maxlength="255" placeholder="Npr: igrač sa ID 12 me je napao bez razloga (RDM)..."></textarea>
        <div class="fl-help-form-row">
          <span class="fl-help-form-hint">Prijava ide odmah svim online administratorima.</span>
          <button class="fl-btn-primary" id="helpSubmitBtn"><i class="fa-solid fa-paper-plane"></i> Pošalji Prijavu</button>
        </div>
      </div>

      <div class="fl-help-tips">
        <div class="fl-help-tips-title"><i class="fa-solid fa-circle-info"></i> Kada koristiti prijavu?</div>
        <ul>
          <li>Kršenje pravila servera od strane drugog igrača (RDM, VDM, meta-gaming...)</li>
          <li>Bag ili glitch koji ti pravi problem u igri</li>
          <li>Zahtev za pomoć admina oko trenutne situacije</li>
        </ul>
      </div>
    </div>
  `;

  fetch(`https://${GetParentResourceName()}/requestOnDutyCount`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  }).catch(() => {});

  document.getElementById('helpSubmitBtn').addEventListener('click', () => {
    const textEl = document.getElementById('helpReportText');
    const message = textEl.value.trim();
    if (!message) return;

    const btn = document.getElementById('helpSubmitBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-check"></i> Poslato';

    fetch(`https://${GetParentResourceName()}/submitHelpReport`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message })
    }).catch(() => {});

    textEl.value = '';
    setTimeout(() => {
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Pošalji Prijavu';
    }, 2500);
  });
}

function formatDuration(totalSeconds) {
  if (typeof totalSeconds !== 'number' || totalSeconds < 0) return '—';

  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);

  return `${h}h ${String(m).padStart(2, '0')}m`;
}

// Nagrade kategorija - isti sidenav+main layout kao Podešavanja/Statistika
// (fl-settings-layout / fl-settings-sidenav / fl-settings-main), samo sa
// svojim tabovima: Dnevna Nagrada i Pozivni Kod.
function renderNagrade() {
  if (!currentPlayer) {
    categoryBody.innerHTML = '';
    return;
  }

  const navHtml = NAGRADE_NAV.map(n => `
    <button class="fl-settings-nav-item ${activeNagradeTab === n.id ? 'active' : ''}" data-nagrade-tab="${n.id}">
      <div class="fl-settings-nav-icon"><i class="fa-solid ${n.icon}"></i></div>
      <div class="fl-settings-nav-text">
        <span class="fl-settings-nav-title">${escapeHtml(n.label)}</span>
        <span class="fl-settings-nav-sub">${escapeHtml(n.sub)}</span>
      </div>
      <i class="fa-solid fa-chevron-right fl-settings-nav-chevron"></i>
    </button>
  `).join('');

  categoryBody.innerHTML = `
    <div class="fl-settings-layout">
      <div class="fl-settings-sidenav">${navHtml}</div>
      <div class="fl-settings-main-wrap">
        <div class="fl-settings-main" id="nagradeMainContent"></div>
      </div>
    </div>
  `;

  categoryBody.querySelectorAll('.fl-settings-nav-item[data-nagrade-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      activeNagradeTab = btn.dataset.nagradeTab;
      renderNagrade();

      // Svaki put kad igrac udje u "Pozivni Kod" tab, ponovo trazimo svez
      // podatak sa servera (ne oslanjamo se samo na onaj sa otvaranja menija) -
      // sprecava da se prikaze zastareo/prazan prikaz ako je prvi odgovor
      // kasnio (npr. odmah posle relog-a).
      if (activeNagradeTab === 'referral') {
        requestReferralRefresh();
      }

      // Isto tako za "Dnevne Nagrade" - svez podatak (dan/da li je danas
      // vec pokupljeno) svaki put kad igrac udje u taj tab.
      if (activeNagradeTab === 'kalendar') {
        requestDailyRewardRefresh();
      }

      // Isto tako za "Nagrade za Vreme" - svez podatak (odigrano vreme/sta je
      // pokupljeno) svaki put kad igrac udje u taj tab.
      if (activeNagradeTab === 'vreme') {
        requestPlaytimeMilestoneRefresh();
      }
    });
  });

  renderNagradeTabContent();
}

function renderNagradeTabContent() {
  const el = document.getElementById('nagradeMainContent');
  if (!el) return;

  let html = '';

  if (activeNagradeTab === 'kalendar') html += renderDnevneNagradeContent();
  if (activeNagradeTab === 'vreme') html += renderPlaytimeMilestonesContent();
  if (activeNagradeTab === 'referral') html += renderReferralContent();

  el.innerHTML = html;
  attachNagradeListeners();

  if (activeNagradeTab === 'kalendar') scrollDailyCarouselToCurrent();
  if (activeNagradeTab === 'vreme') scrollPlaytimeCarouselToCurrent();
}

// Glavni tekst nagrade za jednu karticu u karuselu (npr. "$10.000") - novac
// je uvek prisutan (Config.DailyRewards ga uvek postavlja), pa je on glavni
// prikaz; ostatak (coini/xp/level) ide u manji podnaslov ispod.
function dailyRewardMainKey(r) {
  if (r.money > 0) return 'money';
  if (r.coins > 0) return 'coins';
  if (r.xp > 0) return 'xp';
  if (r.levels > 0) return 'levels';
  return null;
}

// Glavni (veliki) deo nagrade na kartici: novac, a ako ga nema coini / XP / nivo.
function formatDailyRewardMain(r) {
  switch (dailyRewardMainKey(r)) {
    case 'money': return formatMoney(r.money);
    case 'coins': return `${r.coins} Coina`;
    case 'xp': return `${r.xp.toLocaleString('sr-RS')} XP`;
    case 'levels': return `+${r.levels} ${r.levels > 1 ? 'nivoa' : 'nivo'}`;
    default: return '—';
  }
}

// Manji podnaslov ispod glavnog iznosa - ostatak nagrade (bez onoga sto je
// vec prikazano kao glavni deo), ili prosto "Dan X" ako nema nista vise.
function formatDailyRewardExtra(r) {
  const main = dailyRewardMainKey(r);
  const parts = [];
  if (r.coins > 0 && main !== 'coins') parts.push(`+${r.coins} Coina`);
  if (r.xp > 0 && main !== 'xp') parts.push(`+${r.xp.toLocaleString('sr-RS')} XP`);
  if (r.levels > 0 && main !== 'levels') parts.push(`+${r.levels} ${r.levels > 1 ? 'nivoa' : 'nivo'}`);
  return parts.length ? parts.join(' · ') : `Dan ${r.day}`;
}

// Kalendar dnevnih nagrada (Dan 1 -> Dan 30, pa opet ispocetka) - horizontalni
// karusel kartica sa strelicama za skrolovanje, kao referentni dizajn. `day`
// je SLEDECI dan na redu za pokupljanje (dolazi sa servera - server je
// jedini izvor istine za streak, NUI samo prikazuje). Kartice < day su vec
// pokupljene u ovom nizu, kartica == day je ili spremna (ako claimedToday
// nije true) ili tek pokupljena danas, kartice > day su jos zakljucane.
function renderDnevneNagradeContent() {
  let html = `<div class="fl-day-page">`;
  html += settingsSectionHeader('fa-calendar-days', 'Dnevne Nagrade');

  const dailyReward = currentPlayer ? currentPlayer.dailyReward : undefined;

  if (dailyReward === undefined || dailyReward === null) {
    return html + `
      <div class="fl-empty" style="padding-top:12px;">
        <i class="fa-solid fa-spinner fa-spin"></i>
        <span>Učitavam kalendar nagrada...</span>
      </div>
    </div>`;
  }

  const currentDay = dailyReward.day || 1;
  const claimedToday = !!dailyReward.claimedToday;

  // Koliko je dana ZAREDOM vec pokupljeno u ovom nizu - cisto informativni
  // prikaz (server ne cuva ovo posebno, racuna se iz current_day/claimedToday).
  const streak = Math.max(0, claimedToday ? currentDay : currentDay - 1);

  html += `<p class="fl-day-intro">Uloguj se i pokupi nagradu svakog dana da napreduješ kroz kalendar - ako propustiš dan, kreće se ispočetka od Dana 1. Nova nagrada postaje dostupna za pokupljanje posle ponoći (00:00).</p>`;

  const cardsHtml = dailyRewardList.map(r => {
    const isClaimed = r.day < currentDay || (r.day === currentDay && claimedToday);
    const isReady = r.day === currentDay && !claimedToday;

    let stateClass = 'fl-day-card--locked';
    let topBadgeHtml = `
      <div class="fl-day-card-daynum">
        <span class="fl-day-card-daynum-value">${String(r.day).padStart(2, '0')}</span>
        <span class="fl-day-card-daynum-label">Zaključano</span>
      </div>
    `;

    if (isClaimed) {
      stateClass = 'fl-day-card--claimed';
      topBadgeHtml = `<span class="fl-day-card-pill fl-day-card-pill--claimed"><i class="fa-solid fa-check"></i> Pokupljeno</span>`;
    } else if (isReady) {
      stateClass = 'fl-day-card--ready';
      topBadgeHtml = `<span class="fl-day-card-pill fl-day-card-pill--ready">Spremno</span>`;
    }

    return `
      <div class="fl-day-card ${stateClass}" data-day="${r.day}">
        <div class="fl-day-card-top">${topBadgeHtml}</div>
        <div class="fl-day-card-icon"><img src="img/money_bag.png" alt="Novac"></div>
        <div class="fl-day-card-body">
          <span class="fl-day-card-amount">${escapeHtml(formatDailyRewardMain(r))}</span>
          <span class="fl-day-card-sub">${escapeHtml(isClaimed ? 'Pokupljeno' : formatDailyRewardExtra(r))}</span>
        </div>
        ${isReady ? `<button class="fl-day-claim-btn" id="claimDailyBtn"><i class="fa-solid fa-gift"></i> Pokupi</button>` : ''}
      </div>
    `;
  }).join('');

  html += `
    <div class="fl-day-carousel-wrap">
      <div class="fl-day-streak-row">
        <div class="fl-day-streak-badge"><span class="fl-day-streak-icon"><i class="fa-solid fa-fire"></i></span> Trenutni niz <b>${streak}</b></div>
        <div class="fl-day-carousel-nav">
          <button class="fl-day-nav-btn" id="dayCarouselPrev"><i class="fa-solid fa-chevron-left"></i></button>
          <button class="fl-day-nav-btn" id="dayCarouselNext"><i class="fa-solid fa-chevron-right"></i></button>
        </div>
      </div>

      <div class="fl-day-carousel" id="dayCarousel">${cardsHtml}</div>
      <span class="fl-referral-status" id="dailyRewardStatus"></span>
    </div>
  </div>`;

  return html;
}

// Skroluje karusel tako da trenutno relevantna kartica (spremna za
// pokupljanje, ili poslednja pokupljena ako nista nije spremno) bude vidljiva
// odmah pri otvaranju taba - igrac na Danu 20 ne treba rucno da skroluje od
// Dana 1 da vidi gde je stao.
function scrollDailyCarouselToCurrent() {
  const carousel = document.getElementById('dayCarousel');
  if (!carousel) return;

  const target = carousel.querySelector('.fl-day-card--ready') || carousel.querySelector('.fl-day-card--claimed:last-of-type');
  if (target) {
    target.scrollIntoView({ inline: 'center', block: 'nearest' });
  }
}

// Ponovo trazi svez podatak (dan / da li je danas vec pokupljeno) sa servera -
// isti razlog kao requestReferralRefresh iznad.
function requestDailyRewardRefresh() {
  fetch(`https://${GetParentResourceName()}/requestDailyRewardData`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  }).catch(() => {});
}

// "3h 22m" - koristi se za prikaz ukupnog odigranog vremena u Nagrade za Vreme tabu.
function formatHoursMinutes(totalMinutes) {
  const h = Math.floor((totalMinutes || 0) / 60);
  const m = (totalMinutes || 0) % 60;
  return `${h}h ${m}m`;
}

// Nagrade za Vreme - "sezonski" pragovi po UKUPNOM vremenu na serveru
// (Config.PlaytimeMilestones). Za razliku od Dnevnih Nagrada, ovo se NE
// resetuje - jednom dostignut prag ostaje dostignut zauvek dok sezona traje.
function renderPlaytimeMilestonesContent() {
  let html = `<div class="fl-day-page">`;
  html += settingsSectionHeader('fa-clock', 'Nagrade za Vreme');

  const playtime = currentPlayer ? currentPlayer.playtime : undefined;

  if (playtime === undefined || playtime === null) {
    return html + `
      <div class="fl-empty" style="padding-top:12px;">
        <i class="fa-solid fa-spinner fa-spin"></i>
        <span>Učitavam napredak...</span>
      </div>
    </div>`;
  }

  const minutes = playtime.minutes || 0;
  const claimed = playtime.claimed || [];

  html += `<p class="fl-day-intro">Igraj na serveru da dostigneš pragove ispod i pokupiš sezonske nagrade - jednom dostignut prag ostaje tvoj zauvek, čak i ako se ne pokupi odmah.</p>`;

  const cardsHtml = playtimeMilestoneList.map(m => {
    const requiredMinutes = m.hours * 60;
    const isClaimed = claimed.includes(m.hours);
    const isReady = !isClaimed && minutes >= requiredMinutes;
    const isLocked = !isClaimed && !isReady;

    let stateClass = 'fl-playtime-card--locked';
    let pillHtml = `<span class="fl-playtime-pill fl-playtime-pill--locked">Zaključano</span>`;

    if (isClaimed) {
      stateClass = 'fl-playtime-card--claimed';
      pillHtml = `<span class="fl-playtime-pill fl-playtime-pill--claimed"><i class="fa-solid fa-check"></i> Pokupljeno</span>`;
    } else if (isReady) {
      stateClass = 'fl-playtime-card--ready';
      pillHtml = `<span class="fl-playtime-pill fl-playtime-pill--ready">Spremno</span>`;
    }

    const progressPct = Math.max(0, Math.min(100, (minutes / requiredMinutes) * 100));

    return `
      <div class="fl-playtime-card ${stateClass}" data-hours="${m.hours}">
        <div class="fl-playtime-card-top">${pillHtml}</div>

        <div class="fl-playtime-card-title">
          <span class="fl-playtime-card-hours">${m.hours}h</span>
          <span class="fl-playtime-card-titlesub">igranja</span>
        </div>
        <p class="fl-playtime-card-desc">Dostigni ${m.hours}h ukupnog vremena na serveru.</p>

        <div class="fl-playtime-card-reward">
          <span class="fl-playtime-card-reward-label"><i class="fa-solid fa-gift"></i> Nagrada</span>
          <span class="fl-playtime-card-reward-value">${escapeHtml(formatMilestoneReward(m))}</span>
        </div>

        ${isReady ? `<button class="fl-day-claim-btn fl-playtime-claim-btn" data-hours="${m.hours}"><i class="fa-solid fa-gift"></i> Pokupi</button>` : ''}
        ${isLocked ? `
          <div class="fl-playtime-card-progress">
            <div class="fl-playtime-card-progress-bar"><div class="fl-playtime-card-progress-fill" style="width:${progressPct}%;"></div></div>
            <span class="fl-playtime-card-progress-text">${escapeHtml(formatHoursMinutes(minutes))} / ${m.hours}h</span>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');

  html += `
    <div class="fl-day-carousel-wrap">
      <div class="fl-day-streak-row">
        <div class="fl-playtime-top-stats">
          <div class="fl-day-streak-badge"><span class="fl-day-streak-icon"><i class="fa-solid fa-hourglass-half"></i></span> Odigrano <b>${escapeHtml(formatHoursMinutes(minutes))}</b></div>
          <div class="fl-day-streak-badge"><span class="fl-day-streak-icon"><i class="fa-solid fa-calendar"></i></span> Sezona ističe za <b>${playtime.seasonDaysLeft != null ? playtime.seasonDaysLeft : 0}D</b></div>
        </div>
        <div class="fl-day-carousel-nav">
          <button class="fl-day-nav-btn" id="playtimeCarouselPrev"><i class="fa-solid fa-chevron-left"></i></button>
          <button class="fl-day-nav-btn" id="playtimeCarouselNext"><i class="fa-solid fa-chevron-right"></i></button>
        </div>
      </div>

      <div class="fl-playtime-carousel" id="playtimeCarousel">${cardsHtml}</div>
      <span class="fl-referral-status" id="playtimeStatus"></span>
    </div>
  </div>`;

  return html;
}

function scrollPlaytimeCarouselToCurrent() {
  const carousel = document.getElementById('playtimeCarousel');
  if (!carousel) return;

  const target = carousel.querySelector('.fl-playtime-card--ready') || carousel.querySelector('.fl-playtime-card--locked');
  if (target) {
    target.scrollIntoView({ inline: 'center', block: 'nearest' });
  }
}

// Ponovo trazi svez podatak (odigrano vreme / sta je pokupljeno) sa servera -
// isti razlog kao requestReferralRefresh/requestDailyRewardRefresh iznad.
function requestPlaytimeMilestoneRefresh() {
  fetch(`https://${GetParentResourceName()}/requestPlaytimeMilestoneData`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  }).catch(() => {});
}

function renderDnevnaNagradaContent() {
  const reward = currentPlayer.reward;
  const html = settingsSectionHeader('fa-clock', 'Dnevna Nagrada');

  if (!reward) {
    return html + `
      <div class="fl-empty" style="padding-top:12px;">
        <i class="fa-solid fa-gift"></i>
        <span>Podaci o dnevnoj nagradi se učitavaju... otvori meni ponovo za par sekundi ako se ne pojave.</span>
      </div>
    `;
  }

  const pct = reward.required > 0 ? Math.min(100, Math.round((reward.playtime / reward.required) * 100)) : 0;

  return html + `
    <div class="fl-level-card">
      <div class="fl-level-top">
        <div class="fl-level-badge"><i class="fa-solid fa-clock"></i> Vreme na serveru</div>
        <span class="fl-level-xp">${formatDuration(reward.playtime)} / ${formatDuration(reward.required)}</span>
      </div>
      <div class="fl-xp-bar"><div class="fl-xp-bar-fill" style="width:${pct}%;"></div></div>
    </div>

    <div class="fl-stat-row"><span>Nagrada</span><span>${formatMoney(reward.reward)}</span></div>
    <div class="fl-stat-row"><span>Status</span><span>${reward.claimed ? 'Preuzeto danas ✅' : 'U toku...'}</span></div>
    <div class="fl-stat-row"><span>Reset za</span><span>${formatDuration(reward.resetIn)}</span></div>
  `;
}

// Kratak tekst nagrade za jedan nivo trake (npr. "$30.000 + 2 Flamingo Coina + 100 XP").
function formatMilestoneReward(m) {
  const parts = [];
  if (m.money > 0) parts.push(formatMoney(m.money));
  if (m.coins > 0) parts.push(`${m.coins} Coina`);
  if (m.xp > 0) parts.push(`${m.xp.toLocaleString('sr-RS')} XP`);
  if (m.levels > 0) parts.push(`+${m.levels} ${m.levels > 1 ? 'nivoa' : 'nivo'}`);
  return parts.join(' + ') || '—';
}

// Horizontalna traka sa nivoima (5 / 10 / 30 / 50 iskoriscenja pozivnog koda...).
// `uses` je koliko je LJUDI DO SADA iskoristilo tvoj kod - traka se puni prema
// tome koliko si blizu SLEDECEG neotkljucanog nivoa. Svaki nivo ima 3 stanja:
// zakljucan (jos nisi dostigao broj), spreman za pokupljanje (dostigao si ga,
// dugme "Pokupi" aktivno), ili vec pokupljen (kvacica, dugme nestaje).
function renderMilestoneTrack(referral) {
  if (!milestoneList || milestoneList.length === 0) return '';

  const uses = referral.uses || 0;
  const claimed = referral.milestonesClaimed || [];
  const maxUses = milestoneList[milestoneList.length - 1].uses;
  const fillPct = Math.max(0, Math.min(100, (uses / maxUses) * 100));

  const nodesHtml = milestoneList.map(m => {
    const leftPct = Math.min(100, (m.uses / maxUses) * 100);
    const isClaimed = claimed.includes(m.uses);
    const isReached = uses >= m.uses;

    let stateClass = 'fl-milestone-node--locked';
    let actionHtml = `<div class="fl-milestone-node-lock"><i class="fa-solid fa-lock"></i></div>`;

    if (isClaimed) {
      stateClass = 'fl-milestone-node--claimed';
      actionHtml = `<div class="fl-milestone-node-check"><i class="fa-solid fa-circle-check"></i> Pokupljeno</div>`;
    } else if (isReached) {
      stateClass = 'fl-milestone-node--ready';
      actionHtml = `<button class="fl-milestone-claim-btn" data-milestone="${m.uses}"><i class="fa-solid fa-gift"></i> Pokupi</button>`;
    }

    return `
      <div class="fl-milestone-node ${stateClass}" style="left:${leftPct}%;">
        <div class="fl-milestone-node-dot"><i class="fa-solid ${isClaimed ? 'fa-check' : 'fa-user-group'}"></i></div>
        <div class="fl-milestone-node-card">
          <span class="fl-milestone-node-count">${m.uses} ljudi</span>
          <span class="fl-milestone-node-reward">${escapeHtml(formatMilestoneReward(m))}</span>
          ${actionHtml}
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="fl-card" style="margin-bottom:16px;">
      <h3><i class="fa-solid fa-trophy"></i> Nagrade za pozivanje</h3>
      <p style="margin-bottom:22px;">Pozovi drugare da igraju preko tvog koda - svaki put kad neko iskoristi tvoj kod, napreduješ na traci ispod. Trenutno: <b style="color:var(--fl-text);">${uses}</b> pozvanih.</p>

      <div class="fl-milestone-track">
        <div class="fl-milestone-line">
          <div class="fl-milestone-line-fill" style="width:${fillPct}%;"></div>
        </div>
        <div class="fl-milestone-nodes">
          ${nodesHtml}
        </div>
      </div>

      <span class="fl-referral-status" id="milestoneStatus"></span>
    </div>
  `;
}

// Pozivni kod - deo A (gore): igrac pravi/vidi svoj kod da ga salje drugarima.
// Deo B (dole): igrac unosi kod druga i uzima nagradu (jednom po nalogu).
//
// VAZNO: currentPlayer.referral je `undefined` sve dok server ne odgovori na
// requestReferralData (asinhrono, moze potrajati koju sekundu, narocito odmah
// posle relog-a). Dok cekamo taj odgovor NE SMEMO da prikazemo formu za
// kreiranje kod - to bi izgledalo kao da igrac nema kod iako ga MOZDA ima u
// bazi, pa bi "Kreiraj kod" udario u grešku "Već imaš svoj pozivni kod."
// Zato pravimo razliku: undefined/null = jos se ucitava (prikazi loading),
// objekat (makar i sa code=null) = stvarno stiglo sa servera.
function renderReferralContent() {
  const referral = currentPlayer ? currentPlayer.referral : undefined;

  let html = settingsSectionHeader('fa-user-plus', 'Tvoj Pozivni Kod');

  if (referral === undefined || referral === null) {
    return html + `
      <div class="fl-empty" style="padding-top:12px;">
        <i class="fa-solid fa-spinner fa-spin"></i>
        <span>Učitavam podatke o pozivnom kodu...</span>
      </div>
    `;
  }

  html += renderMilestoneTrack(referral);

  if (referral.code) {
    const pending = referral.pending || 0;

    html += `
      <div class="fl-card" style="margin-bottom:10px;">
        <h3><i class="fa-solid fa-ticket"></i> Tvoj kod</h3>
        <div class="fl-referral-code-row">
          <span class="fl-referral-code-value" id="referralCodeValue">${escapeHtml(referral.code)}</span>
          <button class="fl-btn-secondary" id="copyReferralCodeBtn"><i class="fa-solid fa-copy"></i> Kopiraj</button>
        </div>
        <p style="margin-top:12px;">Pošalji ovaj kod drugarima. Kad neko unese tvoj kod, ${formatMoney(REFERRAL_REWARD_MONEY)} i ${formatCoins(REFERRAL_REWARD_COINS)} idu odmah njemu na dobrodošlicu, a tebi se ${formatMoney(REFERRAL_OWNER_REWARD_MONEY)} nagomilava ovde dole - novac ne stiže automatski, moraš sam da ga pokupiš.</p>
      </div>
      <div class="fl-stat-row"><span>Iskorišćeno</span><span>${referral.uses || 0}x</span></div>
      <div class="fl-stat-row"><span>Ukupno zaradio</span><span>${formatMoney(referral.earned || 0)}</span></div>
      <div class="fl-card" style="margin-top:10px;">
        <h3><i class="fa-solid fa-sack-dollar"></i> Za pokupljanje</h3>
        <p style="margin-bottom:14px;">Novac koji su ti drugari zaradili a još nisi pokupio na keš:</p>
        <div class="fl-referral-code-row">
          <span class="fl-referral-code-value" id="referralPendingValue">${formatMoney(pending)}</span>
          <button class="fl-btn-primary" id="collectReferralBtn" ${pending > 0 ? '' : 'disabled'}><i class="fa-solid fa-hand-holding-dollar"></i> Pokupi Novac</button>
        </div>
        <span class="fl-referral-status" id="collectReferralStatus"></span>
      </div>
    `;
  } else {
    html += `
      <div class="fl-card">
        <h3><i class="fa-solid fa-pen"></i> Napravi svoj kod</h3>
        <p style="margin-bottom:14px;">Smisli svoj pozivni kod (3-15 slova/brojeva, bez razmaka) i podeli ga sa drugarima.</p>
        <div class="fl-referral-input-row">
          <input type="text" class="fl-text-input" id="createReferralInput" maxlength="15" placeholder="npr. OGI2026" autocomplete="off">
          <button class="fl-btn-primary" id="createReferralBtn"><i class="fa-solid fa-check"></i> Kreiraj kod</button>
        </div>
        <span class="fl-referral-status" id="createReferralStatus"></span>
      </div>
    `;
  }

  html += settingsSectionHeader('fa-gift', 'Iskoristi Pozivni Kod');

  if (referral && referral.hasRedeemed) {
    html += `
      <div class="fl-card">
        <h3><i class="fa-solid fa-circle-check"></i> Nagrada preuzeta</h3>
        <p>Već si iskoristio pozivni kod na ovom nalogu - nagrada dobrodošlice se podiže samo jednom.</p>
      </div>
    `;
  } else {
    html += `
      <div class="fl-card">
        <h3><i class="fa-solid fa-gift"></i> Unesi kod druga</h3>
        <p style="margin-bottom:14px;">Unesi pozivni kod druga i dobij ${formatMoney(REFERRAL_REWARD_MONEY)} i ${formatCoins(REFERRAL_REWARD_COINS)} odmah na račun.</p>
        <div class="fl-referral-input-row">
          <input type="text" class="fl-text-input" id="redeemReferralInput" maxlength="15" placeholder="Unesi kod ovde" autocomplete="off">
          <button class="fl-btn-primary" id="redeemReferralBtn"><i class="fa-solid fa-paper-plane"></i> Iskoristi kod</button>
        </div>
        <span class="fl-referral-status" id="redeemReferralStatus"></span>
      </div>
    `;
  }

  return html;
}

function setReferralStatus(id, message, isError) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = message || '';
  el.className = 'fl-referral-status' + (isError ? ' fl-referral-status--error' : ' fl-referral-status--ok');
}

// Ponovo trazi svez referral podatak sa servera - koristi se pri ulasku u tab
// i kao "samo-lek" kad server odbije neku akciju (npr. "Već imaš svoj kod")
// zbog toga sto je prikaz na klijentu bio zastareo/nije stigao na vreme.
function requestReferralRefresh() {
  fetch(`https://${GetParentResourceName()}/requestReferralData`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  }).catch(() => {});
}

function attachNagradeListeners() {
  const carousel = document.getElementById('dayCarousel');
  const prevBtn = document.getElementById('dayCarouselPrev');
  const nextBtn = document.getElementById('dayCarouselNext');
  if (carousel && prevBtn && nextBtn) {
    prevBtn.addEventListener('click', () => carousel.scrollBy({ left: -3 * 172, behavior: 'smooth' }));
    nextBtn.addEventListener('click', () => carousel.scrollBy({ left: 3 * 172, behavior: 'smooth' }));
  }

  const playtimeCarousel = document.getElementById('playtimeCarousel');
  const playtimePrevBtn = document.getElementById('playtimeCarouselPrev');
  const playtimeNextBtn = document.getElementById('playtimeCarouselNext');
  if (playtimeCarousel && playtimePrevBtn && playtimeNextBtn) {
    playtimePrevBtn.addEventListener('click', () => playtimeCarousel.scrollBy({ left: -2 * 240, behavior: 'smooth' }));
    playtimeNextBtn.addEventListener('click', () => playtimeCarousel.scrollBy({ left: 2 * 240, behavior: 'smooth' }));
  }

  document.querySelectorAll('.fl-playtime-claim-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.disabled) return;

      const hours = Number(btn.dataset.hours);
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Pokupljam...';
      setReferralStatus('playtimeStatus', '', false);

      fetch(`https://${GetParentResourceName()}/claimPlaytimeMilestone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hours })
      }).catch(() => {});
    });
  });

  const copyBtn = document.getElementById('copyReferralCodeBtn');
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      const codeEl = document.getElementById('referralCodeValue');
      const text = codeEl ? codeEl.textContent : '';
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).catch(() => {});
      }
      const original = copyBtn.innerHTML;
      copyBtn.innerHTML = '<i class="fa-solid fa-check"></i> Kopirano!';
      setTimeout(() => { copyBtn.innerHTML = original; }, 1500);
    });
  }

  const createBtn = document.getElementById('createReferralBtn');
  const createInput = document.getElementById('createReferralInput');
  if (createBtn && createInput) {
    const submitCreate = () => {
      const code = createInput.value.trim();
      if (!code) return;

      createBtn.disabled = true;
      setReferralStatus('createReferralStatus', 'Šaljem...', false);

      fetch(`https://${GetParentResourceName()}/createReferralCode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code })
      }).catch(() => {}).finally(() => { createBtn.disabled = false; });
    };

    createBtn.addEventListener('click', submitCreate);
    createInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') submitCreate(); });
  }

  const redeemBtn = document.getElementById('redeemReferralBtn');
  const redeemInput = document.getElementById('redeemReferralInput');
  if (redeemBtn && redeemInput) {
    const submitRedeem = () => {
      const code = redeemInput.value.trim();
      if (!code) return;

      redeemBtn.disabled = true;
      setReferralStatus('redeemReferralStatus', 'Šaljem...', false);

      fetch(`https://${GetParentResourceName()}/redeemReferralCode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code })
      }).catch(() => {}).finally(() => { redeemBtn.disabled = false; });
    };

    redeemBtn.addEventListener('click', submitRedeem);
    redeemInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') submitRedeem(); });
  }

  const collectBtn = document.getElementById('collectReferralBtn');
  if (collectBtn) {
    collectBtn.addEventListener('click', () => {
      if (collectBtn.disabled) return;

      collectBtn.disabled = true;
      setReferralStatus('collectReferralStatus', 'Pokupljam...', false);

      fetch(`https://${GetParentResourceName()}/collectReferralEarnings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      }).catch(() => {});
      // dugme se ponovo omogucava/preracunava kad stigne 'referralEarningsCollected'
      // (renderNagradeTabContent ce ga vec iscrtati kao disabled jer je pending 0)
    });
  }

  categoryBody.querySelectorAll('.fl-milestone-claim-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.disabled) return;

      const milestone = Number(btn.dataset.milestone);
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Pokupljam...';
      setReferralStatus('milestoneStatus', '', false);

      fetch(`https://${GetParentResourceName()}/claimReferralMilestone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ milestone })
      }).catch(() => {});
    });
  });

  const claimDailyBtn = document.getElementById('claimDailyBtn');
  if (claimDailyBtn) {
    claimDailyBtn.addEventListener('click', () => {
      if (claimDailyBtn.disabled) return;

      claimDailyBtn.disabled = true;
      claimDailyBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Pokupljam...';
      setReferralStatus('dailyRewardStatus', '', false);

      fetch(`https://${GetParentResourceName()}/claimDailyReward`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      }).catch(() => {});
    });
  }
}

function startRebind(id, btnEl) {
  if (rebindingId) return;
  rebindingId = id;

  const keyEl = document.getElementById(`keybindKey_${id}`);
  if (keyEl) keyEl.textContent = 'Pritisni taster...';
  if (btnEl) btnEl.classList.add('fl-keybind-edit--waiting');

  fetch(`https://${GetParentResourceName()}/startRebind`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id })
  }).catch(() => {});
}

// ============== POSLOVI (UI/UX koncept - mock podaci, bez logike posla) ==============
// Kad se doda prava logika (počev od Rudara), ista struktura polja ostaje -
// samo se MOCK_JOBS zamenjuje podacima koje šalje klijent/server preko NUI poruke.

const MOCK_JOBS = [
  {
    key: 'rudar', label: 'Rudar', icon: 'fa-mound', image: 'img/jobs/rudar.jpg', locked: false,
    progressionKey: 'mining', // isti key kao "category" u flamingo_achievements configu i skill id u flamingo_skills
    earningsMin: 13100, earningsMax: 22800,
    maxRank: 5, rankThresholds: [0, 45, 135, 270, 545], currentRank: 4, currentProgress: 437,
    description: 'Višeslojna rudarska jama, gde je svetlo lampe na kacigi jedina odbrana od mraka. Lift vodi sve dublje pod zemlju, vagoneti uz tresak nose rudu kroz uske tunele. Sa iskustvom raste veština, ugled, i plata za smenu.',
    bonuses: [
      { label: 'Flamingo Premium', value: '+25%' },
      { label: '07:00 - 15:00', value: '+15%' },
      { label: 'Dop. oprema', value: '+100%', info: 'Dodatna oprema kupljena u prodavnici' },
      { label: 'Grupni bonus', value: '+15%', info: 'Radiš u grupi sa još igrača' },
    ]
  },
  {
    key: 'drvoseca', label: 'Drvoseča', icon: 'fa-tree', image: 'img/jobs/drvoseca.jpg', locked: false,
    progressionKey: 'woodcutting',
    earningsMin: 12000, earningsMax: 21000,
    maxRank: 5, rankThresholds: [0, 45, 135, 270, 545], currentRank: 1, currentProgress: 0,
    description: 'Duboko u šumi iznad Paleta, gde se čuje samo sekira i škripa stabala. Seci drveće, skupljaj trupce, hrastovinu i smolu, i postani legenda šume.',
    bonuses: [
      { label: 'Flamingo Premium', value: '+25%' },
      { label: 'Grupni bonus', value: '+15%', info: 'Radiš u grupi sa još igrača' },
    ]
  },
  {
    key: 'elektricar', label: 'Električar', icon: 'fa-bolt', image: 'img/jobs/elektricar.jpg', locked: false,
    progressionKey: 'electrician',
    earningsMin: 18000, earningsMax: 34000,
    maxRank: 5, rankThresholds: [0, 45, 135, 270, 545], currentRank: 1, currentProgress: 0,
    description: 'Popravljaš kvarove po celom gradu - ulične lampe, razvodne ormariće i trafostanice. Hitne intervencije plaćaju duplo.',
    bonuses: [{ label: 'Hitna intervencija', value: '×2' }],
  },
  {
    key: 'smecar', label: 'Smećar', icon: 'fa-trash-can', image: 'img/jobs/smecar.jpg', locked: false,
    progressionKey: 'sanitation',
    earningsMin: 14000, earningsMax: 30000,
    maxRank: 5, rankThresholds: [0, 45, 135, 270, 545], currentRank: 1, currentProgress: 0,
    description: 'Radiš sam ili u ekipi do 4 igrača - pražnjenje kontejnera, pun kamion na deponiju i sortiranje otpada.',
    bonuses: [{ label: 'Grupni bonus', value: 'do +30%', info: 'Ekipa od 2-4 igrača' }],
  },
  {
    key: 'farmer', label: 'Farmer', icon: 'fa-tractor', image: 'img/jobs/farmer.jpg', locked: false,
    progressionKey: 'farming',
    earningsMin: 12000, earningsMax: 26000,
    maxRank: 5, rankThresholds: [0, 45, 135, 270, 545], currentRank: 1, currentProgress: 0,
    description: 'Tvoja parcela na farmi u Grapeseedu - oranje traktorom, sadnja, nega i berba. Dok raste: krave, kokoške i voćnjak pomorandži.',
    bonuses: [{ label: 'Kvalitet ★★★', value: 'bolja cena' }],
  },
  {
    key: 'busvozac', label: 'Vozač autobusa', icon: 'fa-bus', image: 'img/jobs/busvozac.jpg', locked: false,
    progressionKey: 'transport',
    earningsMin: 15000, earningsMax: 32000,
    maxRank: 5, rankThresholds: [0, 45, 135, 270, 545], currentRank: 1, currentProgress: 0,
    description: 'Gradska, noćna, turistička i međugradska linija. Vozi glatko i na vreme - putnici ocenjuju svaku turu zvezdicama.',
    bonuses: [{ label: '5 zvezdica', value: 'do +40%' }],
  },
  {
    key: 'gradjevinar', label: 'Građevinar', icon: 'fa-helmet-safety', image: '', locked: true,
    earningsMin: 15000, earningsMax: 26200,
    maxRank: 5, rankThresholds: [0, 2000, 8000, 16000, 27000], currentRank: 4, currentProgress: 10058,
    description: 'Uskoro dostupno.',
    bonuses: [
      { label: 'Flamingo Premium', value: '+25%' },
      { label: '08-12, 13-17', value: '+15%' },
      { label: 'Grupni bonus', value: '+20%' },
    ]
  },
  {
    key: 'ribar', label: 'Ribar', icon: 'fa-fish', image: 'img/jobs/ribar.jpg', locked: false, tag: 'POLULEGALNO',
    progressionKey: 'fishing',
    earningsMin: 15500, earningsMax: 53000,
    maxRank: 9, rankThresholds: [0, 400, 1000, 1800, 2800, 3900, 4700, 5300, 5920], currentRank: 7, currentProgress: 5621,
    description: 'Uskoro dostupno.',
    bonuses: [
      { label: 'Flamingo Premium', value: '+25%', info: 'Na cenu prodaje' },
      { label: 'Kiša', value: '+10%', info: 'Brzina poklevanja' },
    ]
  },
  {
    key: 'taksista', label: 'Taksista', icon: 'fa-taxi', image: 'img/jobs/taxi.jpg', locked: false,
    progressionKey: 'taxi',
    earningsLabel: 'Po dogovoru', maxRank: null,
    description: 'Pravi igrači te zovu preko telefona. Prihvati poziv, pokupi mušteriju i odvezi je - cena se plaća unapred.',
    bonuses: [
      { label: '07-10, 17-20', value: '+50%' },
    ]
  },
];

let selectedJobKey = 'rudar';

// Dostignuća i Skillovi se organizuju po poslu (kategorija = posao), umesto
// da svi budu u jednoj gomili. Kategorije se generišu direktno iz MOCK_JOBS,
// tako da dodavanje novog posla (sa pravim backendom) znači samo dodavanje
// "progressionKey" polja tom poslu gore - ništa se ne dira ovde ispod.
// =====================================================================
// TEKSTOVI PO POSLU (Karijera, Veštine, "Kako funkcioniše")
// Ključ = progressionKey posla = skill u flamingo_skills.
// Novi posao = novi blok ovde + progressionKey u MOCK_JOBS.
// =====================================================================
const JOB_TEXT = {
  mining: {
    skillName: 'Rudarenje', jobName: 'rudara', icon: 'fa-hammer',
    unitPlural: 'kopanja',           // "~120 kopanja"
    doneLabel: 'Uspešna kopanja',
    doneDesc: 'Broj uspešno završenih kopanja rude.',
    countStat: 'mining_digs', xpStat: 'mining_xp_earned',
    xpLabel: 'Rudarsko iskustvo', xpDesc: 'Ukupno XP zarađeno kroz rudarski posao.',
    totalLabel: 'Ukupno iskopano', totalDesc: 'Svi komadi rude koje si iskopao, svih vrsta.',
    itemsTitle: 'Iskopana ruda', itemWord: 'Ruda', itemAdj: 'iskopano',
    items: [
      { id: 'stone_mined', label: 'Kamen', icon: 'fa-cube' },
      { id: 'coal_mined', label: 'Ugalj', icon: 'fa-fire' },
      { id: 'copper_ore_mined', label: 'Bakarna ruda', icon: 'fa-gem' },
      { id: 'iron_ore_mined', label: 'Gvozdena ruda', icon: 'fa-gem' },
    ],
    careerSub: 'Tvoj učinak, iskopana ruda i rudnici.',
    placesTitle: 'Rudnici', placesGuideTitle: 'Rudnici i ruda',
    normal: { title: 'Početni rudnik', icon: 'fa-mountain', img: 'img/jobs/rudnik_kamenolom.jpg',
      text: 'Ovde počinješ. Posle svakog kopanja dobiješ nasumično sledeće mesto, označeno na GPS-u.' },
    advanced: { title: 'Napredni rudnik', img: 'img/jobs/rudnik_napredni.jpg', perkId: 'master_miner', perkLabel: 'Majstor rudar',
      text: 'Obala jezera sa kamenjem za kopanje. <b>Više i bolje rude</b> - otvara se sposobnošću <b>Majstor rudar</b> (nivo 35), a <b>Legenda rudnika</b> daje još +30%.' },
    guideTitle: 'Kako funkcioniše rudarenje',
    intro: 'Kopaš rudu, dobijaš <b>iskustvo (XP)</b> i penješ se na <b>nivoe</b>.',
    introTail: 'one ti trajno ubrzavaju posao, donose više i bolje rude.',
    xpLines: (xp, j) => [
      `Svako uspešno kopanje daje <b>+${fpNum(xp)} XP</b>.`,
      'XP dobijaš tek kad završiš <b>mini-igru</b> i ruda uđe u inventar.',
      `Kopanje traje <b>${fpNum(j.digSeconds || 15)} s</b>, pauza između dva kopanja je <b>${fpNum(j.cooldownSeconds || 5)} s</b>.`,
      'Sposobnost <b>Efikasan rudar</b> daje više XP po kopanju.',
    ],
    timeNote: 'kopanje + mini-igra + pauza + hodanje',
    effects: {
      dig_duration_pct: 'Trajanje kopanja', reward_max_pct: 'Maks. količina rude', rare_weight_pct: 'Šansa za retku rudu',
      xp_bonus_pct: 'Rudarsko iskustvo', advanced_spots: 'Napredni rudnik', cooldown_sec: 'Pauza',
      double_chance_pct: 'Šansa za duplu rudu', advanced_reward_pct: 'Ruda u naprednom rudniku',
    },
    tips: [
      ['fa-bolt', '<b>Brze ruke</b> (nivo 5) je najbolji prvi poen - svako kopanje odmah traje kraće.'],
      ['fa-bullseye', 'U mini-igri klikni kad prsten postane <b>pink</b> - to je <b>SAVRŠEN</b> udarac i duplo brže vadi rudu.'],
      ['fa-scale-balanced', 'Biraj put: <b>brzina</b> za više kopanja na sat, <b>retka ruda</b> za skuplju rudu, ili <b>majstorstvo</b> za napredni rudnik.'],
      ['fa-trophy', 'Ne zaboravi <b>dostignuća</b> - neka od njih daju dodatne poene.'],
    ],
  },

  woodcutting: {
    skillName: 'Sečenje drva', jobName: 'drvoseču', icon: 'fa-tree',
    unitPlural: 'stabala',
    doneLabel: 'Posečena stabla',
    doneDesc: 'Broj stabala koja si oborio.',
    countStat: 'trees_cut', xpStat: 'woodcutting_xp_earned',
    xpLabel: 'Iskustvo drvoseče', xpDesc: 'Ukupno XP zarađeno sečenjem drveta.',
    totalLabel: 'Ukupno drva', totalDesc: 'Svi trupci, hrastovina i smola koje si skupio.',
    itemsTitle: 'Skupljeno drvo', itemWord: 'Drvo', itemAdj: 'skupljeno',
    items: [
      { id: 'trupac_chopped', label: 'Trupci', icon: 'fa-tree' },
      { id: 'hrastovina_chopped', label: 'Hrastovina', icon: 'fa-gem' },
      { id: 'smola_chopped', label: 'Smola', icon: 'fa-droplet' },
    ],
    careerSub: 'Tvoj učinak, posečeno drvo i šume.',
    placesTitle: 'Šume', placesGuideTitle: 'Šume i drvo',
    normal: { title: 'Početna šuma', icon: 'fa-tree', img: 'img/jobs/suma_pocetna.jpg',
      text: 'Šuma iznad Paleta - ovde počinješ. Posle svakog stabla dobiješ nasumično sledeće, označeno na GPS-u. Posečeno drvo ponovo izraste za par minuta.' },
    advanced: { title: 'Napredna šuma', img: 'img/jobs/suma_napredna.jpg', perkId: 'forest_master', perkLabel: 'Majstor šume',
      text: 'Šuma na istočnoj obali. <b>Više i bolje drvo</b> - otvara se sposobnošću <b>Majstor šume</b> (nivo 35), a <b>Legenda šume</b> daje još +30%.' },
    guideTitle: 'Kako funkcioniše sečenje drva',
    intro: 'Sečeš drveće, dobijaš <b>iskustvo (XP)</b> i penješ se na <b>nivoe</b>.',
    introTail: 'one ti trajno ubrzavaju posao i donose više i bolje drvo.',
    xpLines: (xp, j) => [
      `Svako oboreno stablo daje <b>+${fpNum(xp)} XP</b>.`,
      'XP dobijaš tek kad drvo <b>padne</b> u mini-igri i trupci uđu u inventar.',
      `Sečenje traje <b>${fpNum(j.digSeconds || 15)} s</b>, pauza između dva stabla je <b>${fpNum(j.cooldownSeconds || 5)} s</b>.`,
      'Sposobnost <b>Iskusni drvoseča</b> daje više XP po stablu.',
    ],
    timeNote: 'sečenje + mini-igra + pauza + hodanje',
    effects: {
      dig_duration_pct: 'Trajanje sečenja', reward_max_pct: 'Maks. količina drva', rare_weight_pct: 'Šansa za retko drvo',
      xp_bonus_pct: 'Iskustvo drvoseče', advanced_spots: 'Napredna šuma', cooldown_sec: 'Pauza',
      double_chance_pct: 'Šansa za dupli trupac', advanced_reward_pct: 'Drvo u naprednoj šumi',
    },
    tips: [
      ['fa-bolt', '<b>Oštra sekira</b> (nivo 5) je najbolji prvi poen - svako stablo odmah pada brže.'],
      ['fa-bullseye', 'U mini-igri udari kad je sekira u <b>pink</b> sredini zaseka - <b>SAVRŠEN</b> udarac seče duplo dublje.'],
      ['fa-keyboard', 'Umesto klika možeš da koristiš <b>SPACE</b> - lakše se pogađa ritam.'],
      ['fa-scale-balanced', 'Biraj put: <b>brzina</b>, <b>retko drvo</b> (hrastovina i smola) ili <b>majstorstvo</b> za naprednu šumu.'],
    ],
  },
};

JOB_TEXT.fishing = {
  skillName: 'Ribolov', jobName: 'ribara', icon: 'fa-fish',
  unitPlural: 'riba', spotWord: 'zona',
  doneLabel: 'Upecane ribe', doneDesc: 'Broj riba koje si izvukao iz vode.',
  countStat: 'fish_caught', xpStat: 'fishing_xp_earned',
  xpLabel: 'Iskustvo ribara', xpDesc: 'Ukupno XP zarađeno ribolovom.',
  totalLabel: 'Ukupno kg ribe', totalDesc: 'Zbir težine svih upecanih riba.',
  totalStat: 'fish_kg',
  itemsTitle: 'Ribolov', itemWord: 'Riba', itemAdj: '',
  amountHeader: 'Težina', amountUnit: 'kg',
  items: [
    { id: 'fish_escaped', label: 'Pobegle ribe', icon: 'fa-person-running', desc: 'Ribe koje su pobegle ili je pukla struna.' },
    { id: 'fish_illegal', label: 'Zaštićene vrste', icon: 'fa-triangle-exclamation', desc: 'Moruna i morski pas - nelegalan ulov.' },
  ],
  careerSub: 'Tvoj ulov, album riba i rang lista.',
  placesTitle: 'Vode', placesGuideTitle: 'Vode i ribe',
  normal: { title: 'Reka (obala)', icon: 'fa-water', img: 'img/jobs/ribar_pocetna.jpg',
    text: 'Pecaš bilo gde u označenoj zoni - stani uz vodu i pritisni <b>E</b>. Crvi za obične ribe, varalica za grabljivice. Som izlazi samo noću.' },
  advanced: { title: 'Otvorene vode (čamac)', img: 'img/jobs/ribar_napredna.jpg', perkId: 'sea_master', perkLabel: 'Majstor mora',
    text: 'Sa sposobnošću <b>Majstor mora</b> (nivo 35) dobijaš čamac kod ribara i pecaš iz njega daleko od obale (<b>G</b> u čamcu): tuna, sabljarka i morski pas.' },
  guideTitle: 'Kako funkcioniše ribolov',
  intro: 'Pecaš ribu, dobijaš <b>iskustvo (XP)</b> i penješ se na <b>nivoe</b>.',
  introTail: 'one ti skraćuju čekanje, olakšavaju mini-igru i donose retke i krupne ribe.',
  xpLines: (xp, j) => [
    'Svaka riba daje drugačiji XP: obične <b>40-70</b>, retke <b>90-140</b>, epske <b>150-220 XP</b>.',
    'Kad riba zagrize, izađe <b>!</b> - imaš manje od sekunde da klikneš.',
    'Zatim drži <b>pink zonu</b> preko ribe dok se <b>ULOV</b> ne napuni. Ako je puštaš, <b>STRUNA</b> puca.',
    `Čekanje na zagriz je oko <b>${fpNum(j.digSeconds || 10)} s</b>. <b>Kiša</b> ubrzava zagriz, a <b>zora i sumrak</b> donose više retkih riba.`,
  ],
  timeNote: 'čekanje + mini-igra + pauza',
  effects: {
    wait_pct: 'Čekanje na zagriz', cooldown_sec: 'Pauza', line_strength_pct: 'Jačina strune', zone_size_pct: 'Pink zona',
    rare_weight_pct: 'Šansa za retke ribe', trophy_weight_pct: 'Težina ulova', xp_bonus_pct: 'Iskustvo ribara',
    advanced_spots: 'Otvorene vode', advanced_reward_pct: 'Dupli ulov na otvorenom',
  },
  tips: [
    ['fa-hourglass-half', '<b>Strpljivi ribar</b> (nivo 5) je najbolji prvi poen - riba zagrize brže.'],
    ['fa-worm', '<b>Crvi</b> se troše na svako zabacivanje, a <b>varalica</b> samo kad pukne struna.'],
    ['fa-moon', 'Za <b>soma</b> pecaj noću (21h-5h) sa varalicom.'],
    ['fa-triangle-exclamation', '<b>Moruna</b> i <b>morski pas</b> su zaštićeni - vredni, ali neko može da te prijavi policiji.'],
  ],
  album: true,
};

JOB_TEXT.electrician = {
  skillName: 'Elektrika', jobName: 'električara', icon: 'fa-bolt',
  unitPlural: 'kvarova', spotWord: 'kvartova',
  doneLabel: 'Popravljeni kvarovi', doneDesc: 'Svi kvarovi koje si uspešno popravio.',
  countStat: 'elec_jobs', xpStat: 'electrician_xp_earned',
  xpLabel: 'Iskustvo električara', xpDesc: 'Ukupno XP zarađeno popravkama.',
  totalLabel: 'Zarada ($)', totalDesc: 'Ukupno zarađeno kao električar (sa napojnicama).',
  totalStat: 'elec_earned',
  itemsTitle: 'Popravke', itemWord: 'Kvar', itemAdj: 'popravljeno',
  amountHeader: 'Plata', amountUnit: '$',
  items: [
    { id: 'elec_lamp', label: 'Ulične lampe', icon: 'fa-lightbulb' },
    { id: 'elec_box', label: 'Razvodni ormarići', icon: 'fa-box' },
    { id: 'elec_trafo', label: 'Trafostanice', icon: 'fa-bolt' },
    { id: 'elec_plant', label: 'Elektrana', icon: 'fa-industry' },
    { id: 'elec_emergency', label: 'Hitne intervencije', icon: 'fa-triangle-exclamation', desc: 'Hitni nalozi koje si stigao na vreme.' },
    { id: 'elec_shocks', label: 'Udari struje', icon: 'fa-bolt-lightning', desc: 'Koliko puta te je udarila struja.' },
    { id: 'elec_salvage', label: 'Skinut materijal', icon: 'fa-recycle', desc: 'Bakarna žica, komponente i kalemi sa kvarova.' },
  ],
  careerSub: 'Tvoje popravke, zarada i udari struje.',
  placesTitle: 'Radna mesta', placesGuideTitle: 'Kvarovi i plata',
  normal: { title: 'Grad (10 kvartova)', icon: 'fa-city', img: 'img/jobs/elektricar_grad.jpg',
    text: 'Nalog te vodi u kvart, a kvar (lampa, ormarić ili trafo) se sam pronađe i označi. Trafostanice dobijaš od nivoa 10.' },
  advanced: { title: 'Elektrana', img: 'img/jobs/elektricar_elektrana.jpg', perkId: 'high_voltage', perkLabel: 'Visoki napon',
    text: 'Visoki napon u elektrani Palmer-Taylor: <b>$900 po nalogu</b> i najteža mini-igra. Otvara se sposobnošću <b>Visoki napon</b> (nivo 35).' },
  guideTitle: 'Kako funkcioniše posao električara',
  intro: 'Popravljaš kvarove po gradu, dobijaš <b>platu</b> i <b>iskustvo (XP)</b> i penješ se na <b>nivoe</b>.',
  introTail: 'one ti ubrzavaju posao, štite od struje i povećavaju platu.',
  xpLines: (xp, j) => [
    'Lampa daje <b>40 XP</b>, ormarić <b>60 XP</b>, trafostanica <b>90 XP</b>, elektrana <b>130 XP</b>.',
    '<b>Hitne intervencije</b> daju duplu platu i +50% XP - ali imaš samo 5 minuta.',
    'Tri mini-igre: <b>spoji žice</b> (lampa), <b>zameni osigurače</b> (ormarić) i <b>pusti struju</b> (trafo i elektrana).',
    'Dve greške ili isteklo vreme = <b>udar struje</b>. Nalog ostaje, pokušaj ponovo.',
    ...((j.salvage || []).map(s => `<b>${s.label}</b> - od nivoa ${s.minLevel}, ${s.chance}% šanse (${s.min === s.max ? s.min : s.min + '-' + s.max} kom) na: ${s.where}.`)),
  ],
  timeNote: 'vožnja + popravka + pauza',
  effects: {
    dig_duration_pct: 'Otvaranje instalacije', cooldown_sec: 'Pauza', shock_resist_pct: 'Zaštita od struje',
    minigame_time_pct: 'Vreme u mini-igri', pay_bonus_pct: 'Plata', tip_chance_pct: 'Šansa za napojnicu',
    xp_bonus_pct: 'Iskustvo električara', advanced_spots: 'Elektrana', advanced_reward_pct: 'Plata u elektrani',
  },
  tips: [
    ['fa-mitten', '<b>Izolovane rukavice</b> (nivo 10) - udari struje više nisu strašni.'],
    ['fa-magnifying-glass', 'Kod osigurača prvo <b>izmeri</b> sve sumnjive, pa tek onda menjaj one sa <b>0V</b>.'],
    ['fa-triangle-exclamation', 'Hitne intervencije su crvene na mapi - <b>duplo plaćene</b>, ali požuri.'],
    ['fa-van-shuttle', 'Koristi <b>službeni kombi</b> - kvartovi su po celom gradu.'],
    ['fa-recycle', 'Od <b>nivoa 10</b> skidaš <b>bakarnu žicu</b> sa kvarova - elektrana i hitne intervencije daju veće šanse.'],
  ],
};

JOB_TEXT.sanitation = {
  skillName: 'Komunalac', jobName: 'smećara', icon: 'fa-trash-can',
  unitPlural: 'kesa', spotWord: 'kvartova',
  doneLabel: 'Ubačene kese', doneDesc: 'Sve kese koje si ubacio u kamion.',
  countStat: 'trash_bags', xpStat: 'sanitation_xp_earned',
  xpLabel: 'Iskustvo komunalca', xpDesc: 'Ukupno XP zarađeno kao smećar.',
  totalLabel: 'Zarada ($)', totalDesc: 'Ukupno zarađeno kao smećar (sa grupnim bonusom).',
  totalStat: 'trash_earned',
  itemsTitle: 'Posao', itemWord: 'Stavka', itemAdj: '',
  amountHeader: 'Plata', amountUnit: '$',
  items: [
    { id: 'trash_routes', label: 'Završene rute', icon: 'fa-flag-checkered', desc: 'Rute na kojima su ispražnjeni svi kontejneri.' },
    { id: 'trash_unloads', label: 'Istovari', icon: 'fa-truck', desc: 'Koliko puta si istovario kamion na deponiji.' },
    { id: 'trash_group_bags', label: 'Kese u ekipi', icon: 'fa-users', desc: 'Kese ubačene dok si radio sa ekipom.' },
    { id: 'trash_found', label: 'Pronađeni predmeti', icon: 'fa-gem', desc: 'Telefoni, satovi i novčanici iz kontejnera.' },
    { id: 'trash_recycled', label: 'Reciklaža', icon: 'fa-recycle', desc: 'Plastika, limenke, staklo, metal i e-otpad.' },
    { id: 'trash_rats', label: 'Ujedi pacova', icon: 'fa-triangle-exclamation', desc: 'Koliko puta te je ugrizao pacov.' },
  ],
  careerSub: 'Kese, rute, ekipa i rang lista nedelje.',
  placesTitle: 'Rute', placesGuideTitle: 'Rute i plata',
  normal: { title: 'Grad (8 kvartova)', icon: 'fa-city', img: 'img/jobs/smecar_grad.jpg',
    text: 'Ruta te vodi u kvart sa 8 kontejnera - svaki se sam pronađe i označi. Pun kamion ili završena ruta = deponija.' },
  advanced: { title: 'Industrija i luka', img: 'img/jobs/smecar_industrija.jpg', perkId: 'industrial', perkLabel: 'Industrijska zona',
    text: 'Veliki kontejneri u Cypress Flats i luci - <b>$80 po kesi</b> (duplo). Otvara se sposobnošću <b>Industrijska zona</b> (nivo 35) vođe ekipe.' },
  guideTitle: 'Kako funkcioniše posao smećara',
  intro: 'Pražnjiš kontejnere, puniš kamion i istovaruješ na deponiji - sam ili sa <b>ekipom do 4 igrača</b>.',
  introTail: 'one ti ubrzavaju rad, povećavaju kamion i platu, a vođi otvaraju industrijske rute.',
  xpLines: (xp, j) => [
    'Svaka ubačena kesa daje <b>+10 XP</b>, završena ruta <b>+80 XP</b>, savršeno sortiranje <b>+40 XP</b>.',
    '<b>Ekipa:</b> 2 igrača +10%, 3 igrača +20%, 4 igrača <b>+30%</b> na platu. Svako dobija platu za <b>svoje</b> kese, a bonus rute se deli.',
    'Bacanje kese: klikni kad je pokazivač u <b>zelenoj zoni</b> - inače kesa pukne i ne računa se.',
    'Na deponiji <b>sortiraš otpad</b> u 5 kanti - bolje sortiranje = do <b>+15%</b> plate i više reciklaže.',
    '<b>Pacov</b> može da iskoči iz kontejnera - klikni ga brzo ili te ugrize!',
  ],
  timeNote: 'vožnja + kese + istovar',
  effects: {
    dig_duration_pct: 'Vađenje kese', move_speed_pct: 'Brzina sa kesom', capacity_add: 'Kapacitet kamiona',
    zone_size_pct: 'Zelena zona', pay_bonus_pct: 'Plata', find_chance_pct: 'Šansa za predmete',
    xp_bonus_pct: 'Iskustvo komunalca', advanced_spots: 'Industrijske rute', advanced_reward_pct: 'Grupni bonus',
  },
  tips: [
    ['fa-users', 'Radi u <b>ekipi od 4</b> - jedan vozi, ostali nose kese, a svi dobijaju +30%.'],
    ['fa-recycle', 'Od <b>nivoa 10</b> sortiranje daje <b>reciklažu</b> (plastika, limenke), a kasnije i metal i e-otpad.'],
    ['fa-gem', 'Retko nađeš <b>telefon, sat ili novčanik</b> u kontejneru - <b>Lovac na vrednosti</b> duplira šansu.'],
    ['fa-truck', 'Pazi na kamion - ako ga uništiš, smeće u njemu propada.'],
  ],
  weekly: true,
};

JOB_TEXT.farming = {
  skillName: 'Poljoprivreda', jobName: 'farmera', icon: 'fa-tractor',
  unitPlural: 'berbi', spotWord: 'parcela',
  doneLabel: 'Berbe', doneDesc: 'Sve biljke koje si obrao.',
  countStat: 'farm_harvests', xpStat: 'farming_xp_earned',
  xpLabel: 'Iskustvo farmera', xpDesc: 'Ukupno XP zarađeno na farmi.',
  totalLabel: 'Berbe ★★★', totalDesc: 'Berbe najvišeg kvaliteta.', totalStat: 'farm_quality3',
  itemsTitle: 'Proizvodi', itemWord: 'Kultura', itemAdj: 'obrano',
  amountHeader: 'Prinos', amountUnit: 'kom',
  items: [
    { id: 'farm_krompir', label: '🥔 Krompir', icon: 'fa-seedling' },
    { id: 'farm_psenica', label: '🌾 Pšenica', icon: 'fa-seedling' },
    { id: 'farm_kukuruz', label: '🌽 Kukuruz', icon: 'fa-seedling' },
    { id: 'farm_paradajz', label: '🍅 Paradajz', icon: 'fa-seedling' },
    { id: 'farm_jagoda', label: '🍓 Jagode', icon: 'fa-seedling' },
    { id: 'farm_bundeva', label: '🎃 Bundeve', icon: 'fa-seedling' },
    { id: 'farm_milk', label: '🥛 Mleko', icon: 'fa-cow', desc: 'Pomuženo mleko.' },
    { id: 'farm_eggs', label: '🥚 Jaja', icon: 'fa-egg', desc: 'Skupljena jaja.' },
    { id: 'farm_oranges', label: '🍊 Pomorandže', icon: 'fa-lemon', desc: 'Obrano u voćnjaku.' },
  ],
  careerSub: 'Berbe, kvalitet, životinje i najveća bundeva.',
  placesTitle: 'Farma', placesGuideTitle: 'Kulture i prinos',
  normal: { title: 'Njiva (lične parcele)', icon: 'fa-seedling', img: 'img/jobs/farmer_njiva.jpg',
    text: 'Svako dobija <b>svoju parcelu</b> od 12 mesta - niko drugi ne može da ti obere. Preori traktorom, posadi, neguj i beri.' },
  advanced: { title: 'Voćnjak pomorandži', img: 'img/jobs/farmer_vocnjak.jpg', perkId: 'fruit_grower', perkLabel: 'Voćar',
    text: 'Berba pomorandži sa drveća u voćnjaku - otvara se sposobnošću <b>Voćar</b> (nivo 35). Svako drvo ponovo za 5 minuta.' },
  guideTitle: 'Kako funkcioniše farma',
  intro: 'Sadiš, neguješ i bereš na <b>svojoj parceli</b>, a dok biljke rastu radiš sa <b>životinjama</b>.',
  introTail: 'one ubrzavaju rast, povećavaju prinos i kvalitet, a na kraju otvaraju voćnjak.',
  xpLines: (xp, j) => [
    '<b>1.</b> Traktorom provozaj kroz pink oznake na parceli - to je <b>oranje</b> (preorava prazna mesta).',
    '<b>2.</b> Sa <b>semenom</b> u inventaru priđi mestu i posadi. Biljka raste u <b>3 faze</b> (15-30 min).',
    '<b>3.</b> Plavo = traži <b>vodu</b> 💧, crveno = <b>štetočine</b> 🐛. Ako ih ne rešiš, plod gubi zvezdicu. <b>Kiša</b> sama zaliva.',
    '<b>4.</b> Zeleno = <b>zrelo</b>. Beri samo zrele plodove - svaki plod ima <b>kvalitet ★ do ★★★</b>.',
    'Krave 🥛 i kokoške 🥚 daju na svakih <b>10 minuta</b>.',
  ],
  timeNote: 'rast + nega + berba',
  effects: {
    grow_time_pct: 'Vreme rasta', reward_max_pct: 'Prinos', double_chance_pct: 'Šansa za duplu berbu',
    quality_bonus_pct: 'Šansa za bolji kvalitet', pest_resist_pct: 'Otpornost na štetočine', xp_bonus_pct: 'Iskustvo farmera',
    advanced_spots: 'Voćnjak', advanced_reward_pct: 'Pomorandže po drvetu',
  },
  tips: [
    ['fa-seedling', 'Posadi celu parcelu odjednom, pa dok raste idi na <b>mužnju i jaja</b>.'],
    ['fa-droplet', 'Obilazi parcelu - <b>plavi i crveni</b> markeri znače da biljci nešto treba.'],
    ['fa-star', '<b>★★★</b> plodovi će vredeti više kad se otvori prodaja.'],
    ['fa-trophy', '<b>Bundeva</b> ponekad izraste <b>džinovska</b> (60-120 kg) - uđi na rang listu!'],
  ],
  pumpkins: true,
};

JOB_TEXT.transport = {
  skillName: 'Prevoz', jobName: 'vozača', icon: 'fa-bus',
  unitPlural: 'tura', spotWord: 'kvartova',
  doneLabel: 'Završene ture', doneDesc: 'Sve ture koje si odvezao do kraja.',
  countStat: 'bus_tours', xpStat: 'transport_xp_earned',
  xpLabel: 'Iskustvo vozača', xpDesc: 'Ukupno XP zarađeno vožnjom autobusa.',
  totalLabel: 'Zarada ($)', totalDesc: 'Ukupno zarađeno kao vozač (sa bonusima i napojnicama).', totalStat: 'bus_earned',
  itemsTitle: 'Vožnja', itemWord: 'Linija', itemAdj: '',
  amountHeader: 'Plata po turi', amountUnit: '$',
  items: [
    { id: 'bus_passengers', label: 'Prevezeni putnici', icon: 'fa-users', desc: 'Svi putnici koji su ušli u tvoj autobus.' },
    { id: 'bus_stops', label: 'Stanice', icon: 'fa-location-dot', desc: 'Sve stanice na kojima si stao.' },
    { id: 'bus_5stars', label: 'Ture sa ★★★★★', icon: 'fa-star', desc: 'Savršeno zadovoljni putnici.' },
    { id: 'bus_night', label: 'Noćne ture', icon: 'fa-moon', desc: 'Završene noćne linije.' },
    { id: 'bus_tourist', label: 'Turističke ture', icon: 'fa-camera', desc: 'Ture po znamenitostima.' },
    { id: 'bus_intercity', label: 'Međugradske ture', icon: 'fa-road', desc: 'LS → Sandy → Paleto.' },
    { id: 'bus_found', label: 'Zaboravljene stvari', icon: 'fa-suitcase', desc: 'Torbe, telefoni i novčanici putnika.' },
    { id: 'bus_fines', label: 'Kazne kontrole', icon: 'fa-ticket', desc: 'Koliko puta te je kontrola kaznila zbog švercera.' },
  ],
  careerSub: 'Ture, putnici, zvezdice i rang lista nedelje.',
  placesTitle: 'Linije', placesGuideTitle: 'Linije i plata',
  normal: { title: 'Gradske linije', icon: 'fa-city', img: 'img/jobs/busvozac_grad.jpg',
    text: 'Gradska (nivo 1), noćna (nivo 10) i turistička (nivo 20). Stanice se nalaze same po kvartovima - svaka tura je drugačija.' },
  advanced: { title: 'Međugradska linija', img: 'img/jobs/busvozac_medjugradska.jpg', perkId: 'intercity_line', perkLabel: 'Međugradska linija',
    text: 'Veliki <b>coach</b> autobus: Los Santos → Sandy Shores → Grapeseed → Paleto. Najveća plata - sposobnost <b>Međugradska linija</b> (nivo 35).' },
  guideTitle: 'Kako funkcioniše posao vozača',
  intro: 'Voziš linije, prevoziš putnike i naplaćuješ karte - a putnici ocenjuju vožnju <b>zvezdicama</b>.',
  introTail: 'one ubrzavaju ukrcavanje, blaže kazne za vožnju i povećavaju platu i napojnice.',
  xpLines: (xp, j) => [
    'Na stanici stani u <b>pink krug</b> i pritisni <b>E</b> - vrata se otvaraju, putnici izlaze i ulaze.',
    '<b>Kusur:</b> putnik plati više od karte - vrati tačan kusur brzo i dobiješ <b>napojnicu</b>.',
    '<b>Ocena</b> pada za naglo kočenje, udarce, prebrzu vožnju i loš parking, a raste za savršen parking i tačnost.',
    '<b>Red vožnje:</b> svaka stanica ima vreme - na vreme = bonus, kasniš = minus. 60%+ stanica na vreme = +15% plate.',
    '<b>Švercer</b> i <b>pijan putnik</b>: izbaci ili pusti. Ako pustiš švercera a naleti <b>kontrola</b> - kazna.',
  ],
  timeNote: 'vožnja + stanice',
  effects: {
    board_time_pct: 'Ukrcavanje', schedule_buffer_pct: 'Tolerancija reda vožnje', penalty_resist_pct: 'Blaže kazne',
    parking_bonus_pct: 'Tolerancija parkiranja', pay_bonus_pct: 'Plata', tip_bonus_pct: 'Napojnice',
    xp_bonus_pct: 'Iskustvo vozača', advanced_spots: 'Međugradska linija', advanced_reward_pct: 'Plata na međugradskoj',
  },
  tips: [
    ['fa-feather', 'Koči na vreme - <b>naglo kočenje</b> je najčešći razlog za manje zvezdica.'],
    ['fa-square-parking', 'Stani što bliže stanici - <b>savršen parking</b> diže ocenu.'],
    ['fa-coins', 'Kusur računaj brzo: brz i tačan kusur = <b>napojnica</b> (turisti daju duplo).'],
    ['fa-ticket', 'Ne puštaj švercere - kontrola ume da naleti na kraju ture.'],
  ],
  weekly: true,
  weeklyCols: ['Vozač', 'Putnici', 'Ture'],
  weeklyTitle: 'Najbolji vozači nedelje',
};

JOB_TEXT.taxi = {
  skillName: 'Taxi', jobName: 'taksistu', icon: 'fa-taxi',
  unitPlural: 'vožnji', spotWord: 'grad',
  doneLabel: 'Završene vožnje', doneDesc: 'Sve taxi vožnje koje si završio.',
  countStat: 'taxi_rides', xpStat: 'taxi_xp_earned',
  xpLabel: 'Iskustvo taksiste', xpDesc: 'Ukupno XP zarađeno kao taksista.',
  totalLabel: 'Zarada ($)', totalDesc: 'Sve što si zaradio vožnjama (sa bonusima).', totalStat: 'taxi_earned',
  itemsTitle: 'Vožnje', itemWord: 'Vožnja', itemAdj: '',
  amountHeader: 'Cena', amountUnit: '$',
  items: [
    { id: 'taxi_km', label: 'Pređeni kilometri', icon: 'fa-road', desc: 'Ukupna dužina vožnji sa mušterijama.' },
    { id: 'taxi_vip', label: 'VIP vožnje', icon: 'fa-crown', desc: 'VIP pozivi koje si odvezao.' },
    { id: 'taxi_tips', label: 'Napojnice ($)', icon: 'fa-hand-holding-dollar', desc: 'Napojnice od zadovoljnih mušterija.' },
  ],
  careerSub: 'Vožnje, kilometri, VIP pozivi i zarada.',
  placesTitle: 'Posao', placesGuideTitle: 'Cene',
  normal: { title: 'Gradski taxi', icon: 'fa-taxi', img: 'img/jobs/taxi.jpg',
    text: 'Pozivi stižu od pravih igrača preko telefona (<b>Taxi</b> aplikacija). DUTY i lista poziva su na <b>F5</b>.' },
  advanced: { title: 'VIP limuzina', img: 'img/jobs/taxi_vip.jpg', perkId: 'vip_driver', perkLabel: 'VIP vozač',
    text: 'Sa sposobnošću <b>VIP vozač</b> (nivo 35) voziš limuzinu, a VIP pozivi donose <b>+20%</b> na cenu.' },
  guideTitle: 'Kako funkcioniše taxi',
  intro: 'Prevoziš <b>prave igrače</b> - zovu te preko telefona, a ti zarađuješ vožnjom i penješ se na <b>nivoe</b>.',
  introTail: 'one ti donose bonuse od grada (brz dolazak, noćna smena, duge vožnje, napojnice) i na kraju limuzinu.',
  xpLines: (xp, j) => [
    'Svaka vožnja daje <b>40 XP + 15 XP po km</b> (do 10 km). VIP vožnja daje <b>×1,5</b>.',
    'Mušterija plaća početnu cenu + cenu po km <b>unapred</b> kad označi destinaciju.',
    '<b>Bonusi iz sposobnosti</b> se isplaćuju iz grada - mušterija ne plaća više.',
    'Pritisni <b>F5</b> za DUTY i listu poziva. Duty ne može da se isključi dok voziš mušteriju.',
  ],
  timeNote: 'vožnja',
  effects: {
    pickup_bonus: 'Bonus za brz dolazak ($)', night_bonus_pct: 'Noćni bonus', tip_chance_pct: 'Šansa za napojnicu',
    pay_bonus_pct: 'Bonus na vožnju', long_ride_bonus_pct: 'Bonus za duge vožnje', xp_bonus_pct: 'Iskustvo taksiste',
    advanced_spots: 'VIP vozač', advanced_reward_pct: 'VIP bonus',
  },
  tips: [
    ['fa-stopwatch', 'Prihvataj pozive u blizini - <b>brz dolazak</b> nosi bonus.'],
    ['fa-moon', 'Noću ima manje taksista - a <b>Noćna smena</b> daje +20%.'],
    ['fa-road', 'Duge vožnje (aerodrom, Sandy, Paleto) su najisplativije.'],
  ],
};

function jobText(skillKey) { return JOB_TEXT[skillKey] || JOB_TEXT.mining; }

// Stablo veština po poslu (stiže iz flamingo_mmenu servera)
function getSkillTreeData(skillKey) {
  if (!currentPlayer) return null;
  if (!currentPlayer.skillTrees) currentPlayer.skillTrees = {};
  return currentPlayer.skillTrees[skillKey] || null;
}
function setSkillTreeData(skillKey, data) {
  if (!currentPlayer) return;
  if (!currentPlayer.skillTrees) currentPlayer.skillTrees = {};
  currentPlayer.skillTrees[skillKey] = data;
  if (skillKey === 'mining') currentPlayer.miningSkillTree = data; // stari naziv
}

// Kartice lokacija sa slikom (rudnici / šume) - Karijera i "Kako funkcioniše"
function mineCardsHtml(opts) {
  const o = opts || {};
  const T = jobText(o.skill || 'mining');
  const advUnlocked = !!o.advancedUnlocked;
  const card = (img, icon, title, badgeHtml, meta, text, extraCls, tableHtml) => `
    <div class="fl-mine-card ${extraCls || ''}">
      <div class="fl-mine-card-img" style="background-image:url('${img}'), linear-gradient(135deg, #1d2a20, #2b1c24)">
        ${badgeHtml}
      </div>
      <div class="fl-mine-card-body">
        <div class="fl-mine-card-title"><i class="fa-solid ${icon}"></i> ${title}<small>${meta}</small></div>
        <p>${text}</p>
        ${tableHtml || ''}
      </div>
    </div>`;
  return `
    <div class="fl-mine-grid">
      ${card(T.normal.img, T.normal.icon, T.normal.title,
        '<span class="fl-mine-badge fl-mine-badge--ok"><i class="fa-solid fa-unlock"></i> Dostupno svima</span>',
        o.normalSpots ? `${o.normalSpots} ${T.spotWord || 'mesta'}` : '', T.normal.text, '', o.normalTable)}
      ${card(T.advanced.img, 'fa-crown', T.advanced.title,
        advUnlocked
          ? '<span class="fl-mine-badge fl-mine-badge--ok"><i class="fa-solid fa-unlock"></i> Otključano</span>'
          : `<span class="fl-mine-badge"><i class="fa-solid fa-lock"></i> Treba ${T.advanced.perkLabel}</span>`,
        o.advancedSpots ? `${o.advancedSpots} mesta` : '', T.advanced.text,
        'fl-mine-card--accent' + (advUnlocked ? '' : ' is-locked'), o.advancedTable)}
    </div>`;
}

function fpGetJobCategories() {
  return MOCK_JOBS.map(j => ({
    key: j.key,
    label: j.label,
    icon: j.icon,
    progressionKey: j.progressionKey || null,
    ready: !j.locked && !!j.progressionKey
  }));
}

function renderPoslovi() {
  categoryBody.innerHTML = `<div class="fl-jobs-grid" id="jobsGrid"></div>`;
  const grid = document.getElementById('jobsGrid');

  MOCK_JOBS.forEach((job) => {
    grid.appendChild(buildJobCard(job));
  });
}

function buildJobCard(job) {
  const card = document.createElement('div');
  card.className = 'fl-job-card' + (job.locked ? ' locked' : '');

  const earningsLine = job.earningsLabel
    ? job.earningsLabel
    : `${formatMoney(job.earningsMin)} — ${formatMoney(job.earningsMax)}`;

  const bonusHtml = (job.bonuses || []).map((b) => `
    <div class="fl-job-bonus">
      <div class="fl-job-bonus-label">${escapeHtml(b.label)}${b.info ? ` <i class="fa-solid fa-circle-info" title="${escapeHtml(b.info)}"></i>` : ''}</div>
      <div class="fl-job-bonus-value">${escapeHtml(b.value)}</div>
    </div>
  `).join('');

  let rankHtml = '';
  if (!job.locked && job.maxRank) {
    const total = job.rankThresholds[job.maxRank - 1];
    const pct = Math.min(100, (job.currentProgress / total) * 100);
    const fmtNum = (n) => Math.floor(n || 0).toLocaleString('sr-RS');
    rankHtml = `
      <div class="fl-job-rank-row">
        <span>Rang: <b>${job.currentRank} / ${job.maxRank}</b></span>
        <span class="fl-job-rank-progress">${fmtNum(job.currentProgress)} / ${fmtNum(total)}</span>
      </div>
      <div class="fl-job-rank-bar"><div class="fl-job-rank-bar-inner" style="width:${pct}%"></div></div>
    `;
  }

  card.innerHTML = `
    ${job.image ? `<img class="fl-job-card-img" src="${job.image}" alt="">` : ''}
    <div class="fl-job-card-fade"></div>
    <div class="fl-job-card-pin"><i class="fa-solid fa-location-dot"></i></div>
    ${job.locked ? '<div class="fl-job-card-lock"><i class="fa-solid fa-lock"></i> Uskoro dostupno</div>' : ''}

    <div class="fl-job-card-body">
      <div class="fl-job-card-title-row">
        <div class="fl-job-card-title">${escapeHtml(job.label)}</div>
        ${job.tag ? `<div class="fl-job-card-tag">${escapeHtml(job.tag)}</div>` : ''}
      </div>
      <div class="fl-job-card-earnings">${earningsLine}</div>

      ${!job.locked ? `<div class="fl-job-bonus-row">${bonusHtml}</div>` : ''}

      <div class="fl-job-card-desc">${escapeHtml(job.description)}</div>

      ${rankHtml}
    </div>
  `;

  return card;
}

function renderComingSoon(icon, text) {
  categoryBody.innerHTML = `
    <div class="fl-empty">
      <i class="fa-solid ${icon}"></i>
      <span>${escapeHtml(text)}</span>
    </div>
  `;
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.innerText = str ?? '';
  return d.innerHTML;
}

// ============== POČETNA - dashboard ==============

function formatMoneyOrDash(v) {
  return typeof v === 'number' ? formatMoney(v) : '—';
}

function socialLinkHtml(iconClass, url) {
  const hasUrl = url && url.length > 0;
  const href = hasUrl ? url : '#';
  const extraClass = hasUrl ? '' : 'fl-social-icon--disabled';
  return `<a class="fl-social-icon ${extraClass}" href="${escapeHtml(href)}" target="_blank" rel="noopener"><i class="fa-brands ${iconClass}"></i></a>`;
}

function renderHome() {
  if (!currentPlayer) return;

  const lvl = currentPlayer.level;
  const level = lvl ? lvl.level : 1;
  const xp = lvl ? lvl.xp : 0;
  const xpRequired = lvl ? lvl.xpRequired : 150;
  const pct = xpRequired > 0 ? Math.min(100, Math.round((xp / xpRequired) * 100)) : 0;

  const RING_R = 42;
  const CIRC = 2 * Math.PI * RING_R;
  const ringOffset = CIRC * (1 - pct / 100);

  const social = currentPlayer.social || {};
  const discordHref = social.discord && social.discord.length > 0 ? social.discord : null;

  // Popuni social ikonice u levoj traci (samo one koje su podesene u configu se boje, ostale su zatamnjene)
  const railSocialEl = document.getElementById('mmenuRailSocial');
  if (railSocialEl) {
    railSocialEl.innerHTML = `
      ${socialLinkHtml('fa-discord', social.discord)}
      ${socialLinkHtml('fa-tiktok', social.tiktok)}
    `;
  }

  mmenuHome.innerHTML = `
    <div class="fl-home-row fl-home-row--top">

      <div class="fl-home-hero" id="homeHero"></div>

      <div class="fl-home-side">
        <div class="fl-home-card">
          <div class="fl-home-card-title-row">
            <div class="fl-home-card-title"><i class="fa-solid fa-chart-line"></i> Tvoj napredak</div>
            <span class="fl-profile-level-tag">Nivo<b>${level}</b></span>
          </div>
          <div class="fl-profile-ring-row">
            <div class="fl-profile-ring">
              <svg viewBox="0 0 100 100">
                <circle class="fl-ring-bg" cx="50" cy="50" r="${RING_R}"></circle>
                <circle class="fl-ring-fill" cx="50" cy="50" r="${RING_R}"
                  style="stroke-dasharray:${CIRC};stroke-dashoffset:${ringOffset};"></circle>
              </svg>
              <img src="img/flamingo_logo.png" alt="" class="fl-profile-ring-icon">
            </div>
            <div class="fl-profile-ring-text">
              <span class="fl-profile-xp">${xp} / ${xpRequired} XP</span>
              <div class="fl-xp-bar" style="margin-top:8px;"><div class="fl-xp-bar-fill" style="width:${pct}%;"></div></div>
              <span class="fl-profile-hint">XP dobijaš za svaki sat igre${levelUpRewardDisplay > 0 ? ` · novi nivo = <b>${escapeHtml(formatMoney(levelUpRewardDisplay))}</b>` : ''}</span>
            </div>
          </div>
        </div>

        <div class="fl-home-card">
          <div class="fl-home-card-title"><i class="fa-solid fa-headset"></i> Pomoć</div>
          <p class="fl-help-intro">Problem sa igračem ili ti treba admin? Prijava odmah stiže svim online administratorima, bez komande.</p>
          <button class="fl-btn-primary fl-help-home-btn" data-category="pomoc">
            <i class="fa-solid fa-flag"></i> Prijavi problem adminu
          </button>
        </div>
      </div>
    </div>

    <div class="fl-home-row fl-home-row--bottom fl-home-row--triple">

      <div class="fl-home-card">
        <div class="fl-home-card-title-row">
          <div class="fl-home-card-title"><i class="fa-solid fa-bullhorn"></i> Najnovije vesti</div>
        </div>
        <div class="fl-empty" style="padding-top:16px;">
          <i class="fa-solid fa-newspaper"></i>
          <span>Sistem vesti još nije povezan. Ovde će se prikazivati najnovija dešavanja na serveru.</span>
        </div>
      </div>

      <div class="fl-home-card">
        <div class="fl-home-card-title"><i class="fa-solid fa-calendar-days"></i> Najave</div>
        <div class="fl-empty" style="padding-top:16px;">
          <i class="fa-solid fa-calendar-days"></i>
          <span>Sistem najavljenih događaja još nije povezan. Ovde će se prikazivati predstojeći eventi na serveru.</span>
        </div>
      </div>

    </div>
  `;

  mmenuHome.querySelectorAll('[data-category]').forEach(el => {
    el.addEventListener('click', () => openCategory(el.dataset.category));
  });

  renderHeroSlide(activeHeroSlide, discordHref);
  startHeroRotation(discordHref);
}

// ============== POČETNA - hero baner sa 3 scene (tačke ispod naslova) ==============

function renderHeroSlide(index, discordHref) {
  const heroEl = document.getElementById('homeHero');
  if (!heroEl) return;

  activeHeroSlide = index;
  const slide = HOME_HERO_SLIDES[index];

  const dotsHtml = HOME_HERO_SLIDES.map((s, i) => `<span class="${i === index ? 'active' : ''}" data-hero-dot="${i}"></span>`).join('');

  heroEl.style.backgroundImage = `url('${slide.image}')`;
  heroEl.innerHTML = `
    <img src="img/flamingo_logo.png" alt="" class="fl-home-hero-watermark">
    <div class="fl-home-hero-content">
      <span class="fl-home-hero-eyebrow">${escapeHtml(slide.eyebrow)}</span>
      <h1 class="fl-home-hero-title">${slide.title}</h1>
      <p class="fl-home-hero-sub">${escapeHtml(slide.sub)}</p>
    </div>
    <div class="fl-home-hero-dots">${dotsHtml}</div>
  `;

  heroEl.querySelectorAll('[data-hero-dot]').forEach(dot => {
    dot.addEventListener('click', () => {
      renderHeroSlide(parseInt(dot.dataset.heroDot, 10), discordHref);
      startHeroRotation(discordHref); // resetuj tajmer nakon rucne promene
    });
  });
}

function startHeroRotation(discordHref) {
  if (heroSlideTimer) clearInterval(heroSlideTimer);
  heroSlideTimer = setInterval(() => {
    const next = (activeHeroSlide + 1) % HOME_HERO_SLIDES.length;
    renderHeroSlide(next, discordHref);
  }, 7000);
}

function stopHeroRotation() {
  if (heroSlideTimer) {
    clearInterval(heroSlideTimer);
    heroSlideTimer = null;
  }
}

// ============== NAVIGACIJA: leva ikonska traka (Početna / Prodavnica / ...) ==============

function setActiveNavTab(key) {
  document.querySelectorAll('.mmenu-rail-btn').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.category === key);
  });

  const statGroup = document.getElementById('mmenuRailStatGroup');
  if (statGroup) statGroup.classList.toggle('open', key === 'statistika');

  const shopGroup = document.getElementById('mmenuRailShopGroup');
  if (shopGroup) shopGroup.classList.toggle('open', key === 'prodavnica');

  const taskGroup = document.getElementById('mmenuRailTaskGroup');
  if (taskGroup) taskGroup.classList.toggle('open', key === 'zadaci');
}

function openCategory(key) {
  if (key === 'home') {
    showHome();
    return;
  }

  const meta = CATEGORY_META[key];
  if (!meta) return;

  currentCategory = key;
  mmenuHome.classList.add('hidden');
  mmenuDetail.classList.remove('hidden');
  setActiveNavTab(key);

  categoryTitle.textContent = meta.title;
  categorySubtitle.textContent = meta.subtitle;
  categoryIconEl.innerHTML = `<i class="fa-solid ${meta.icon || 'fa-circle'}"></i>`;
  meta.render();

  if (key === 'zadaci' && typeof requestTaskRefresh === 'function') {
    requestTaskRefresh();
  }

  // Placeholder poziv ka klijentu za svaku kategoriju - trenutno vraca
  // "implemented: false" jer sistemi nisu radjeni, samo NUI.
  fetch(`https://${GetParentResourceName()}/requestCategoryData`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ category: key })
  }).catch(() => {});
}

function showHome() {
  currentCategory = null;
  categoryTitle.textContent = 'Početna';
  categorySubtitle.textContent = currentPlayer ? `Dobro došao nazad, ${currentPlayer.name}` : 'Pregled servera i tvog napretka';
  categoryIconEl.innerHTML = '<i class="fa-solid fa-house"></i>';
  mmenuDetail.classList.add('hidden');
  mmenuHome.classList.remove('hidden');
  setActiveNavTab('home');
  renderHome();
}

document.querySelectorAll('.mmenu-rail-btn[data-category]').forEach(tab => {
  tab.addEventListener('click', () => openCategory(tab.dataset.category));
});

document.getElementById('settingsShortcutBtn').addEventListener('click', () => openCategory('podesavanja'));

renderShopSubmenu();

closeBtn.addEventListener('click', closeMenu);

function closeMenu() {
  fetch(`https://${GetParentResourceName()}/closeMenu`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  }).catch(() => {});
  app.classList.add('hidden');
  stopHeroRotation();
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !app.classList.contains('hidden')) {
    closeMenu();
  }
});

function applyLevelData(levelData) {
  const level = levelData ? levelData.level : 1;
  topLevelEl.textContent = level;

  if (currentCategory === 'statistika') {
    renderStatistika();
  }

  if (currentCategory === null) {
    renderHome();
  }
}

function applyCoinsData(amount) {
  coinAmountEl.textContent = (amount || 0).toLocaleString('sr-RS');

  // ne crtaj ponovo dok se rulet kutije vrti (inače traka skoči na kraj)
  if (currentCategory === 'prodavnica' && !(window.pkIsSpinning && window.pkIsSpinning())) {
    renderProdavnica();
  }
}

window.addEventListener('message', (event) => {
  const data = event.data;

  if (data.action === 'openMenu') {
    currentPlayer = data.player;
    crateList = data.crates || [];
    keybindList = data.keybinds || [];
    milestoneList = data.milestones || [];
    dailyRewardList = data.dailyRewards || [];
    moneyPackageList = data.moneyPackages || [];
    playtimeMilestoneList = data.playtimeMilestones || [];
    levelUpRewardDisplay = data.levelUpReward || 0;

    playerNameEl.textContent = currentPlayer.name;
    playerJobEl.textContent = currentPlayer.job;
    playerIdEl.textContent = `#${currentPlayer.serverId}`;

    applyLevelData(currentPlayer.level);
    applyCoinsData(currentPlayer.coins);
    applyTheme(currentPlayer.settings && currentPlayer.settings.theme);

    app.classList.remove('hidden');
    showHome();
  }

  if (data.action === 'closeMenu') {
    app.classList.add('hidden');
    stopHeroRotation();
  }

  if (data.action === 'onDutyCountResult') {
    const el = document.getElementById('helpDutyCount');
    if (el) {
      if (data.staffInstalled === false) {
        el.textContent = 'Sistem trenutno nedostupan';
      } else if (data.count > 0) {
        el.textContent = `${data.count} ${data.count === 1 ? 'admin' : 'admina'} online`;
      } else {
        el.textContent = 'Trenutno nema admina online - prijava i dalje stiže čim se neko uloguje';
      }
    }
  }

  if (data.action === 'updateLevel') {
    if (currentPlayer) {
      currentPlayer.level = data.level;
      applyLevelData(data.level);
    }
  }

  if (data.action === 'updateCoins') {
    if (currentPlayer) {
      currentPlayer.coins = data.coins;
      applyCoinsData(data.coins);
    }
  }

  if (data.action === 'updateProfile') {
    if (currentPlayer && data.profile) {
      currentPlayer.registeredAt = data.profile.registeredAt;

      if (currentCategory === 'statistika' && activeStatTab === 'profil') {
        renderStatistika();
      }
    }
  }

  if (data.action === 'updateFinance') {
    if (currentPlayer) {
      currentPlayer.finance = data.finance;

      if (currentCategory === 'statistika' && activeStatTab === 'finansije') {
        renderStatistika();
      }
    }
  }

  if (data.action === 'updateReward') {
    if (currentPlayer) {
      currentPlayer.reward = data.reward;

      if (currentCategory === 'nagrade' && activeNagradeTab === 'dnevna') {
        renderNagradeTabContent();
      }
    }
  }

  if (data.action === 'updateReferral') {
    if (currentPlayer) {
      currentPlayer.referral = data.referral;

      if (currentCategory === 'nagrade' && activeNagradeTab === 'referral') {
        renderNagradeTabContent();
      }
    }
  }

  if (data.action === 'posloviData') {
    const rudarLive = data.data && data.data.rudar;
    if (rudarLive) {
      const job = MOCK_JOBS.find((j) => j.key === 'rudar');
      if (job) {
        job.currentRank = rudarLive.rank;
        job.maxRank = rudarLive.maxRank;
        job.currentProgress = rudarLive.points;
        job.rankThresholds = [];
        for (let i = 1; i <= rudarLive.maxRank; i++) {
          job.rankThresholds.push(rudarLive.thresholds[i - 1]);
        }
        job.earningsMin = rudarLive.earningsMin;
        job.earningsMax = rudarLive.earningsMax;
      }
    }

    if (currentCategory === 'poslovi') {
      renderPoslovi();
    }
  }

  if (data.action === 'referralCodeCreated') {
    const result = data.result || {};

    if (result.success) {
      if (currentPlayer) {
        currentPlayer.referral = currentPlayer.referral || {};
        currentPlayer.referral.code = result.code;
        currentPlayer.referral.uses = result.uses || 0;
        currentPlayer.referral.earned = 0;
        currentPlayer.referral.pending = 0;
      }
      if (currentCategory === 'nagrade' && activeNagradeTab === 'referral') {
        renderNagradeTabContent();
      }
    } else {
      setReferralStatus('createReferralStatus', result.message || 'Greška, pokušaj ponovo.', true);
      // Server nas je odbio (npr. "Već imaš svoj kod") - znaci da je nas
      // prikaz zastareo. Osvezimo ga da meni pokaze stvarno stanje umesto
      // da i dalje nudi formu za kreiranje.
      requestReferralRefresh();
    }
  }

  if (data.action === 'referralCodeRedeemed') {
    const result = data.result || {};

    if (result.success) {
      if (currentPlayer) {
        currentPlayer.referral = currentPlayer.referral || {};
        currentPlayer.referral.hasRedeemed = true;
      }
      if (currentCategory === 'nagrade' && activeNagradeTab === 'referral') {
        renderNagradeTabContent();
      }
    } else {
      setReferralStatus('redeemReferralStatus', result.message || 'Greška, pokušaj ponovo.', true);
    }
  }

  if (data.action === 'referralEarningsCollected') {
    const result = data.result || {};

    if (result.success) {
      if (currentPlayer) {
        currentPlayer.referral = currentPlayer.referral || {};
        currentPlayer.referral.pending = 0;
      }
      if (currentCategory === 'nagrade' && activeNagradeTab === 'referral') {
        renderNagradeTabContent();
      }
    } else {
      setReferralStatus('collectReferralStatus', result.message || 'Greška, pokušaj ponovo.', true);
      const collectBtn = document.getElementById('collectReferralBtn');
      const pending = (currentPlayer && currentPlayer.referral && currentPlayer.referral.pending) || 0;
      if (collectBtn) collectBtn.disabled = pending <= 0;
    }
  }

  if (data.action === 'milestoneClaimed') {
    const result = data.result || {};

    if (result.success) {
      if (currentPlayer) {
        currentPlayer.referral = currentPlayer.referral || {};
        currentPlayer.referral.milestonesClaimed = currentPlayer.referral.milestonesClaimed || [];
        currentPlayer.referral.milestonesClaimed.push(result.milestone);
      }
      if (currentCategory === 'nagrade' && activeNagradeTab === 'referral') {
        renderNagradeTabContent();
      }
    } else {
      setReferralStatus('milestoneStatus', result.message || 'Greška, pokušaj ponovo.', true);
      // Server nas je odbio (npr. vec pokupljeno) - osvezimo ceo tab da NUI
      // pokaze stvarno stanje umesto zaglavljenog "Pokupljam..." dugmeta.
      requestReferralRefresh();
    }
  }

  if (data.action === 'updateDailyRewards') {
    if (currentPlayer) {
      currentPlayer.dailyReward = data.dailyReward;

      if (currentCategory === 'nagrade' && activeNagradeTab === 'kalendar') {
        renderNagradeTabContent();
      }
    }
  }

  if (data.action === 'dailyRewardClaimed') {
    const result = data.result || {};

    if (result.success) {
      if (currentPlayer) {
        currentPlayer.dailyReward = currentPlayer.dailyReward || {};
        currentPlayer.dailyReward.day = result.nextDay;
        currentPlayer.dailyReward.claimedToday = true;
      }
      if (currentCategory === 'nagrade' && activeNagradeTab === 'kalendar') {
        renderNagradeTabContent();
      }
    } else {
      setReferralStatus('dailyRewardStatus', result.message || 'Greška, pokušaj ponovo.', true);
      // Server nas je odbio (npr. vec pokupljeno danas) - osvezimo tab da NUI
      // pokaze stvarno stanje umesto zaglavljenog "Pokupljam..." dugmeta.
      requestDailyRewardRefresh();
    }
  }

  if (data.action === 'updatePlaytimeMilestones') {
    if (currentPlayer) {
      currentPlayer.playtime = data.playtime;

      if (currentCategory === 'nagrade' && activeNagradeTab === 'vreme') {
        renderNagradeTabContent();
      }
    }
  }

  if (data.action === 'playtimeMilestoneClaimed') {
    const result = data.result || {};

    if (result.success) {
      if (currentPlayer) {
        currentPlayer.playtime = currentPlayer.playtime || {};
        currentPlayer.playtime.claimed = currentPlayer.playtime.claimed || [];
        currentPlayer.playtime.claimed.push(result.milestone);
      }
      if (currentCategory === 'nagrade' && activeNagradeTab === 'vreme') {
        renderNagradeTabContent();
      }
    } else {
      setReferralStatus('playtimeStatus', result.message || 'Greška, pokušaj ponovo.', true);
      requestPlaytimeMilestoneRefresh();
    }
  }

  if (data.action === 'crateResult') {
    showCrateResult(data.result);
  }

  if (data.action === 'moneyPackagePurchased') {
    const result = data.result || {};
    const btn = document.querySelector(`.fl-crate-buy[data-package-id="${result.packageId}"]`);
    const statusEl = document.getElementById(`moneyStatus_${result.packageId}`);

    if (btn) {
      btn.disabled = false;
      const pkg = moneyPackageList.find(p => p.id === result.packageId);
      if (pkg) btn.innerHTML = moneyBuyBtnHtml(pkg);
    }

    if (statusEl) {
      if (result.success) {
        statusEl.textContent = `Kupljeno! +${formatMoney(result.amount)}`;
        statusEl.className = 'fl-referral-status fl-money-status fl-referral-status--ok';
      } else {
        statusEl.textContent = result.message || 'Greška, pokušaj ponovo.';
        statusEl.className = 'fl-referral-status fl-money-status fl-referral-status--error';
      }
      setTimeout(() => { if (statusEl) statusEl.textContent = ''; }, 3500);
    }
  }

  if (data.action === 'keybindResult') {
    rebindingId = null;
    const keyEl = document.getElementById(`keybindKey_${data.id}`);
    const btnEl = document.querySelector(`.fl-keybind-edit[data-keybind-id="${data.id}"]`);

    if (btnEl) btnEl.classList.remove('fl-keybind-edit--waiting');

    const kb = keybindList.find(k => k.id === data.id);

    if (data.key) {
      if (kb) kb.key = data.key;
      if (keyEl) keyEl.textContent = data.key;
    } else {
      // isteklo vreme bez pritiska - vrati prikaz na prethodni taster
      if (keyEl) keyEl.textContent = kb ? kb.key : '—';
    }
  }
});

// Fallback ako se testira van FiveM klijenta (GetParentResourceName ne postoji u browseru)
if (typeof GetParentResourceName !== 'function') {
  window.GetParentResourceName = () => 'flamingo_mmenu';
}


/* ==========================================================
   FLAMINGO PROGRESSION UI PATCH
   Povezuje postojeći M MENU sa:
   - Mining skill
   - Stats
   - Achievements
   - Daily/Weekly challenges
   - Battle Pass
   Ne pravi novi NUI; koristi postojeći shell i postojeće klase.
   ========================================================== */

(function () {
  function fpNum(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n.toLocaleString('sr-RS') : '0';
  }
  window.fpNum = fpNum; // zdieľané aj s druhým IIFE nižšie v súbore (skill tree UI)

  function fpStatCard(icon, label, value, desc) {
    return `
      <div class="fl-stat-card">
        <div class="fl-stat-card-header">
          <div class="fl-stat-card-icon"><i class="fa-solid ${icon}"></i></div>
          <span class="fl-stat-card-title">${escapeHtml(label)}</span>
        </div>
        ${desc ? `<p class="fl-stat-card-desc">${escapeHtml(desc)}</p>` : ''}
        <div class="fl-stat-card-footer">
          <span class="fl-stat-card-value">${escapeHtml(String(value))}</span>
        </div>
      </div>
    `;
  }
  window.fpStatCard = fpStatCard;

  function fpPct(value, required) {
    const a = Number(value) || 0;
    const b = Number(required) || 1;
    return Math.max(0, Math.min(100, Math.round((a / b) * 100)));
  }

  function fpRewardText(reward) {
    if (!reward) return 'Bez dodatne nagrade';
    const parts = [];
    if (Number(reward.skillPoints) > 0) parts.push(`+${fpNum(reward.skillPoints)} ${Number(reward.skillPoints) === 1 ? 'poen veštine' : 'poena veština'}`);
    if (Number(reward.coins) > 0) parts.push(`+${fpNum(reward.coins)} Flamingo Coina`);
    return parts.length ? parts.join(' • ') : 'Bez dodatne nagrade';
  }

  // Amblem (krug sa brojem) + prsten napretka oko njega
  function fpEmblem(numHtml, label, pct) {
    const R = 47;
    const C = 2 * Math.PI * R;
    const off = C * (1 - Math.max(0, Math.min(100, pct)) / 100);
    return `
      <div class="fl-skill-emblem">
        <svg viewBox="0 0 100 100">
          <circle class="fl-ring-bg" cx="50" cy="50" r="${R}" style="stroke-width:2.5;"></circle>
          <circle class="fl-ring-fill" cx="50" cy="50" r="${R}" style="stroke-width:2.5;stroke-dasharray:${C};stroke-dashoffset:${off};"></circle>
        </svg>
        <span class="fl-skill-emblem-num">${numHtml}</span>
        <span class="fl-skill-emblem-label">${escapeHtml(label)}</span>
      </div>
    `;
  }
  window.fpEmblem = fpEmblem;

  function fpSkillCard(skill, jobLabel) {
    if (!skill) return '';
    const max = !!skill.isMax;
    const required = Number(skill.xpNeeded) || 0;
    const xp = Number(skill.xp) || 0;
    const pct = max ? 100 : fpPct(xp, required);
    const points = Number(skill.skill_points) || 0;
    const level = Number(skill.level) || 1;

    return `
      <div class="fl-skill-hero">
        ${fpEmblem(fpNum(level), 'Nivo', pct)}
        <div class="fl-skill-hero-main">
          <span class="fl-skill-hero-kicker">${escapeHtml(jobLabel || 'Veština')}</span>
          <span class="fl-skill-hero-name">${escapeHtml(skill.label || 'Rudarenje')}</span>
          <span class="fl-skill-hero-sub">${max ? 'Dostigao si maksimalni nivo ove veštine.' : `Još ${fpNum(Math.max(0, required - xp))} XP do nivoa ${level + 1}.`}</span>
          <div class="fl-xp-bar"><div class="fl-xp-bar-fill" style="width:${pct}%;"></div></div>
          <div class="fl-skill-hero-foot">
            <span>${fpNum(xp)} / ${max ? 'MAKS' : fpNum(required)} XP</span>
            <span>${pct}%</span>
          </div>
        </div>
        <div class="fl-skill-points ${points > 0 ? '' : ''}">
          <span class="fl-skill-points-num">${fpNum(points)}</span>
          <span class="fl-skill-points-label">${points === 1 ? 'poen veštine' : 'poena veština'} na raspolaganju</span>
        </div>
      </div>
    `;
  }

  window.fpSkillCard = fpSkillCard;

  function fpRenderCareer(el) {
    if (!activeCareerJob) {
      fpRenderCareerCategories(el);
      return;
    }

    const job = fpGetJobCategories().find(j => j.key === activeCareerJob);
    const key = job && job.progressionKey;
    const T = jobText(key);
    const p = currentPlayer.progression || {};
    const skill = p.skills && key && p.skills[key];
    const stats = p.stats || [];
    const stat = id => {
      const x = stats.find(s => s.id === id);
      return x ? Number(x.value || 0) : 0;
    };
    const total = T.totalStat ? stat(T.totalStat) : T.items.reduce((n, it) => n + stat(it.id), 0);
    const tree = getSkillTreeData(key);
    const advUnlocked = !!(tree && Array.isArray(tree.perks) && tree.perks.some(x => x.id === T.advanced.perkId && x.status === 'unlocked'));
    const ji = (tree && tree.jobInfo) || {};

    el.innerHTML = `
      <button class="fl-job-cat-back" id="fpCareerBackBtn"><i class="fa-solid fa-arrow-left"></i> Nazad na poslove</button>
      ${skill ? fpSkillCard(Object.assign({ label: T.skillName }, skill), job ? job.label : '') : ''}

      <div class="fl-section-title">Učinak na poslu</div>
      <div class="fl-stat-grid">
        ${fpStatCard(T.icon, T.doneLabel, fpNum(stat(T.countStat)), T.doneDesc)}
        ${fpStatCard('fa-cubes', T.totalLabel, fpNum(total), T.totalDesc)}
        ${fpStatCard('fa-star', T.xpLabel, fpNum(stat(T.xpStat)), T.xpDesc)}
      </div>

      <div class="fl-section-title">${T.itemsTitle}</div>
      <div class="fl-stat-grid">
        ${T.items.map(it => fpStatCard(it.icon, it.label, fpNum(stat(it.id)), it.desc || `Ukupno ${T.itemAdj}: ${it.label.toLowerCase()}.`)).join('')}
      </div>

      <div class="fl-section-title">${T.placesTitle}</div>
      ${mineCardsHtml({ skill: key, advancedUnlocked: advUnlocked, normalSpots: ji.normalSpots, advancedSpots: ji.advancedSpots })}
      ${T.album ? fishAlbumHtml(tree && tree.album) : ''}
      ${T.weekly ? weeklyBoardHtml(tree && tree.album, T) : ''}
      ${T.pumpkins ? pumpkinBoardHtml(tree && tree.album) : ''}
    `;

    const back = document.getElementById('fpCareerBackBtn');
    if (back) back.addEventListener('click', () => {
      activeCareerJob = null;
      fpRenderCareer(el);
    });
  }

  // ---------- Najveća bundeva servera (farmer) ----------
  function pumpkinBoardHtml(data) {
    const rows = (data && data.pumpkins) || [];
    const medal = ['🥇', '🥈', '🥉'];
    const kg = (n) => (Number(n) || 0).toLocaleString('sr-RS', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    return `
      <div class="fl-section-title">🎃 Najveća bundeva servera <small>lični rekordi</small></div>
      <div class="fl-guide-card fl-guide-card--table">
        ${rows.length ? `<table class="fl-guide-table"><thead><tr><th>#</th><th>Farmer</th><th>Najveća</th><th>Ukupno bundeva</th></tr></thead><tbody>
          ${rows.map((r, i) => `<tr><td><b>${medal[i] || (i + 1)}</b></td><td><b>${escapeHtml(r.name)}</b></td><td class="fl-board-kg">${kg(r.weight)} kg</td><td>${fpNum(r.count)}</td></tr>`).join('')}
        </tbody></table>` : '<div class="fl-guide-note" style="padding:14px">Još niko nije ubrao bundevu. Od nivoa 30!</div>'}
      </div>`;
  }

  // ---------- Rang lista nedelje (smećar) ----------
  function weeklyBoardHtml(data, T) {
    const rows = (data && data.weekly) || [];
    const medal = ['🥇', '🥈', '🥉'];
    const cols = (T && T.weeklyCols) || ['Komunalac', 'Kese', 'Rute'];
    return `
      <div class="fl-section-title">${(T && T.weeklyTitle) || 'Rang lista nedelje'} <small>ova nedelja</small></div>
      <div class="fl-guide-card fl-guide-card--table">
        ${rows.length ? `<table class="fl-guide-table"><thead><tr><th>#</th><th>${cols[0]}</th><th>${cols[1]}</th><th>${cols[2]}</th></tr></thead><tbody>
          ${rows.map((r, i) => `<tr><td><b>${medal[i] || (i + 1)}</b></td><td><b>${escapeHtml(r.name)}</b></td><td class="fl-board-kg">${fpNum(r.bags)}</td><td>${fpNum(r.routes)}</td></tr>`).join('')}
        </tbody></table>` : '<div class="fl-guide-note" style="padding:14px">Ove nedelje još niko nije radio. Budi prvi na listi!</div>'}
      </div>`;
  }

  // ---------- Album riba + rang lista ----------
  function fishAlbumHtml(album) {
    if (!album || !Array.isArray(album.fish)) {
      return `<div class="fl-section-title">Album riba</div><div class="fl-empty"><i class="fa-solid fa-book-open"></i><span>Album se učitava... (flamingo_ribar mora biti pokrenut)</span></div>`;
    }
    const fish = album.fish.filter(f => f.rarity !== 'junk');
    const found = fish.filter(f => f.caught > 0).length;
    const kg = (n) => (Number(n) || 0).toLocaleString('sr-RS', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const baitLabel = { crv: 'Crvi', varalica: 'Varalica', any: 'Bilo koji' };
    const cards = fish.map(f => {
      const got = f.caught > 0;
      return `
        <div class="fl-fish-card r-${f.rarity} ${got ? '' : 'is-unknown'}">
          <div class="fl-fish-icon"><i class="fa-solid ${got ? 'fa-fish' : 'fa-question'}"></i></div>
          <div class="fl-fish-body">
            <div class="fl-fish-top">
              <span class="fl-fish-name">${got ? escapeHtml(f.label) : '???'}</span>
              <span class="fl-fish-rarity">${escapeHtml(f.rarityLabel || '')}</span>
            </div>
            <div class="fl-fish-desc">${got ? escapeHtml(f.desc || '') : 'Još nisi upecao ovu vrstu.'}</div>
            <div class="fl-fish-meta">
              <span class="fl-chip"><i class="fa-solid ${f.zone === 'open' ? 'fa-sailboat' : 'fa-water'}"></i> ${f.zone === 'open' ? 'Otvorene vode' : 'Obala'}</span>
              <span class="fl-chip"><i class="fa-solid fa-worm"></i> ${baitLabel[f.bait] || f.bait}</span>
              ${f.night ? '<span class="fl-chip"><i class="fa-solid fa-moon"></i> Noću</span>' : ''}
              ${f.illegal ? '<span class="fl-chip fl-chip--bad"><i class="fa-solid fa-triangle-exclamation"></i> Zaštićena</span>' : ''}
            </div>
            ${got ? `<div class="fl-fish-stats"><span>Upecano: <b>${fpNum(f.caught)}</b></span><span>Rekord: <b>${kg(f.best)} kg</b></span></div>` : `<div class="fl-fish-stats"><span>Težina: ${kg(f.kgMin)} - ${kg(f.kgMax)} kg</span></div>`}
          </div>
        </div>`;
    }).join('');

    const board = (album.leaderboard || []).map(b => `
      <tr>
        <td><span class="fl-fish-dot r-${b.rarity}"></span><b>${escapeHtml(b.label)}</b></td>
        <td>${escapeHtml(b.holder || '?')}</td>
        <td class="fl-board-kg">${kg(b.weight)} kg</td>
      </tr>`).join('');

    return `
      <div class="fl-section-title">Album riba <small>${found} / ${fish.length} vrsta</small></div>
      <div class="fl-album-progress"><div class="fl-xp-bar"><div class="fl-xp-bar-fill" style="width:${fish.length ? Math.round(found / fish.length * 100) : 0}%"></div></div></div>
      <div class="fl-fish-grid">${cards}</div>

      <div class="fl-section-title">Rang lista servera <small>najteža riba po vrsti</small></div>
      <div class="fl-guide-card fl-guide-card--table">
        ${board ? `<table class="fl-guide-table"><thead><tr><th>Vrsta</th><th>Rekorder</th><th>Težina</th></tr></thead><tbody>${board}</tbody></table>`
                : '<div class="fl-guide-note" style="padding:14px">Još niko nije upecao ribu. Budi prvi!</div>'}
      </div>`;
  }

  function fpRenderCareerCategories(el) {
    const p = currentPlayer.progression || {};
    const skills = p.skills || {};
    const stats = p.stats || [];
    const statVal = id => Number((stats.find(s => s.id === id) || {}).value || 0);
    const jobs = fpGetJobCategories();
    const jobImg = key => {
      const j = (typeof MOCK_JOBS !== 'undefined') ? MOCK_JOBS.find(m => m.key === key) : null;
      return j && j.image ? j.image : '';
    };

    el.innerHTML = `
      <div class="fl-job-cat-grid">
        ${jobs.map(j => {
          const skill = j.progressionKey ? skills[j.progressionKey] : null;
          const img = jobImg(j.key);
          return `
            <div class="fl-job-cat-card fl-job-cat-card--cover${j.ready ? '' : ' locked'}" ${j.ready ? `data-career-cat="${escapeHtml(j.key)}"` : ''}>
              <div class="fl-job-cat-cover" ${img ? `style="background-image:url('${img}')"` : ''}></div>
              ${!j.ready ? `<span class="fl-job-cat-lock-badge">Uskoro</span>` : ''}
              <div class="fl-job-cat-icon"><i class="fa-solid ${j.icon}"></i></div>
              <div>
                <div class="fl-job-cat-title">${escapeHtml(j.label)}</div>
                <p class="fl-job-cat-sub">${j.ready ? jobText(j.progressionKey).careerSub : 'Karijera za ovaj posao još nije dostupna.'}</p>
              </div>
              ${j.ready ? `
                <div class="fl-job-cat-progress-row"><span>${skill ? `Nivo ${fpNum(skill.level)}` : 'Karijera'}</span><b>${fpNum(statVal(jobText(j.progressionKey).countStat))} ${jobText(j.progressionKey).unitPlural}</b></div>
              ` : ''}
            </div>
          `;
        }).join('')}
      </div>
    `;

    el.querySelectorAll('[data-career-cat]').forEach(card => {
      card.addEventListener('click', () => {
        activeCareerJob = card.dataset.careerCat;
        fpRenderCareer(el);
      });
    });
  }

  function fpRenderAchievementCategories(el) {
    const achievements = Array.isArray(currentPlayer.achievements) ? currentPlayer.achievements : [];
    const jobs = fpGetJobCategories();

    el.innerHTML = `
      <div class="fl-job-cat-grid">
        ${jobs.map(j => {
          const list = j.progressionKey ? achievements.filter(a => a.category === j.progressionKey) : [];
          const done = list.filter(a => a.completed).length;
          const total = list.length;
          const pct = total ? Math.round((done / total) * 100) : 0;
          const clickable = j.ready && total > 0;
          return `
            <div class="fl-job-cat-card${clickable ? '' : ' locked'}" ${clickable ? `data-job-cat="${escapeHtml(j.key)}"` : ''}>
              ${!clickable ? `<span class="fl-job-cat-lock-badge">Uskoro</span>` : ''}
              <div class="fl-job-cat-icon"><i class="fa-solid ${j.icon}"></i></div>
              <div>
                <div class="fl-job-cat-title">${escapeHtml(j.label)}</div>
                <p class="fl-job-cat-sub">${clickable ? 'Dostignuća vezana za ovaj posao.' : 'Dostignuća za ovaj posao još nisu dostupna.'}</p>
              </div>
              ${clickable ? `
                <div class="fl-job-cat-progress-row"><span>Završeno</span><b>${done} / ${total}</b></div>
                <div class="fl-job-cat-progress-bar"><div class="fl-job-cat-progress-bar-inner" style="width:${pct}%;"></div></div>
              ` : ''}
            </div>
          `;
        }).join('')}
      </div>
    `;

    el.querySelectorAll('[data-job-cat]').forEach(card => {
      card.addEventListener('click', () => {
        activeAchievementJob = card.dataset.jobCat;
        fpRenderAchievementsTab();
      });
    });
  }

  function fpRenderAchievements(el) {
    if (!activeAchievementJob) {
      fpRenderAchievementCategories(el);
      return;
    }

    const job = fpGetJobCategories().find(j => j.key === activeAchievementJob);
    const list = (Array.isArray(currentPlayer.achievements) ? currentPlayer.achievements : [])
      .filter(a => job && a.category === job.progressionKey);
    const done = list.filter(a => a.completed).length;
    const total = list.length;
    const pct = total ? Math.round((done / total) * 100) : 0;
    const jobLabel = job ? job.label : '';

    el.innerHTML = `
      <button class="fl-job-cat-back" id="fpAchBackBtn"><i class="fa-solid fa-arrow-left"></i> Nazad na poslove</button>

      <div class="fl-skill-hero">
        ${fpEmblem(`${pct}<small>%</small>`, 'Završeno', pct)}
        <div class="fl-skill-hero-main">
          <span class="fl-skill-hero-kicker">Dostignuća</span>
          <span class="fl-skill-hero-name">${escapeHtml(jobLabel)}</span>
          <span class="fl-skill-hero-sub">${done} od ${total} dostignuća završeno za ovaj posao.</span>
          <div class="fl-xp-bar"><div class="fl-xp-bar-fill" style="width:${pct}%;"></div></div>
        </div>
      </div>

      <div class="fl-section-title">Sva dostignuća <small>${done} / ${total}</small></div>
      ${list.length ? `<div class="fl-ach-grid">${list.map(a => {
        const progress = Number(a.progress) || 0;
        const required = Number(a.required) || 1;
        const ap = a.completed ? 100 : fpPct(progress, required);
        return `
          <div class="fl-ach-card ${a.completed ? 'fl-ach-card--done' : ''}">
            <div class="fl-ach-icon"><i class="fa-solid ${a.completed ? 'fa-trophy' : 'fa-lock'}"></i></div>
            <div class="fl-ach-body">
              <div class="fl-ach-top">
                <span class="fl-ach-name">${escapeHtml(a.label || a.id)}</span>
                ${a.completed ? '<span class="fl-day-card-pill fl-day-card-pill--claimed"><i class="fa-solid fa-check"></i> Završeno</span>' : ''}
              </div>
              <p class="fl-ach-desc">${escapeHtml(a.description || '')}</p>
              <div class="fl-xp-bar"><div class="fl-xp-bar-fill" style="width:${ap}%;"></div></div>
              <div class="fl-ach-foot">
                <span>${fpNum(Math.min(progress, required))} / ${fpNum(required)}</span>
                <span>${escapeHtml(fpRewardText(a.reward))}</span>
              </div>
            </div>
          </div>
        `;
      }).join('')}</div>` : `
        <div class="fl-empty"><i class="fa-solid fa-trophy"></i><span>Dostignuća za ovaj posao još nisu učitana. Proveri da li je flamingo_achievements pokrenut.</span></div>
      `}
    `;

    const backBtn = document.getElementById('fpAchBackBtn');
    if (backBtn) backBtn.addEventListener('click', () => {
      activeAchievementJob = null;
      fpRenderAchievementsTab();
    });
  }

  function fpRenderAchievementsTab() {
    const el = document.getElementById('statMainContent');
    if (el) fpRenderAchievements(el);
  }

  function fpRenderBattlePass() {
    const el = categoryBody;
    const p = currentPlayer && currentPlayer.progression;
    const bp = p && p.battlepass;

    if (!bp) {
      el.innerHTML = `<div class="fl-empty"><i class="fa-solid fa-spinner fa-spin"></i><span>Učitavam sezonsku propusnicu...</span></div>`;
      return;
    }

    const level = Number(bp.level) || 1;
    const maxLevel = Number(bp.maxLevel) || level;
    const levels = bp.levels || {};
    const claimed = bp.claimed || {};
    const currentDef = levels[level];
    const need = currentDef ? Number(currentDef.xp) || 1 : 1;
    const xp = Number(bp.xp) || 0;
    const isMax = level >= maxLevel;
    const pct = isMax ? 100 : fpPct(xp, need);

    const cards = Object.keys(levels).map(k => Number(k)).sort((a, b) => a - b).map(lvl => {
      const def = levels[lvl] || {};
      const unlocked = lvl <= level;
      const isClaimed = !!claimed[lvl] || !!claimed[String(lvl)];
      const ready = unlocked && !isClaimed;
      const state = isClaimed ? 'claimed' : ready ? 'ready' : 'locked';
      return `
        <div class="fl-bp-tier fl-bp-tier--${state} ${lvl === level ? 'fl-bp-tier--current' : ''}">
          <div class="fl-bp-tier-top">
            <span class="fl-bp-tier-num"><small>Nivo</small>${lvl}</span>
            ${isClaimed ? '<span class="fl-day-card-pill fl-day-card-pill--claimed"><i class="fa-solid fa-check"></i> Pokupljeno</span>'
              : ready ? '<span class="fl-day-card-pill fl-day-card-pill--ready">Spremno</span>'
              : '<span class="fl-day-card-pill"><i class="fa-solid fa-lock"></i> Zaključano</span>'}
          </div>
          <div class="fl-bp-tier-reward">${escapeHtml(fpRewardText(def.reward))}</div>
          ${ready ? `<button class="fl-day-claim-btn fp-bp-claim" data-level="${lvl}"><i class="fa-solid fa-gift"></i> Pokupi nagradu</button>` : ''}
        </div>
      `;
    }).join('');

    el.innerHTML = `
      <div class="fl-skill-hero">
        ${fpEmblem(`${level}<small>/${maxLevel}</small>`, 'Nivo', pct)}
        <div class="fl-skill-hero-main">
          <span class="fl-skill-hero-kicker">Sezona ${escapeHtml(String(bp.season))}</span>
          <span class="fl-skill-hero-name">Sezonska propusnica</span>
          <span class="fl-skill-hero-sub">${isMax ? 'Dostigao si maksimalni nivo sezone.' : `${fpNum(xp)} / ${fpNum(need)} XP do sledećeg nivoa.`}</span>
          <div class="fl-xp-bar"><div class="fl-xp-bar-fill" style="width:${pct}%;"></div></div>
        </div>
      </div>

      <div class="fl-section-title">Sezonski nivoi</div>
      <div class="fl-bp-tiers">${cards}</div>
    `;

    document.querySelectorAll('.fp-bp-claim').forEach(btn => {
      btn.addEventListener('click', () => {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Pokupljam...';
        fetch(`https://${GetParentResourceName()}/claimBattlePass`, {
          method:'POST', headers:{'Content-Type':'application/json'},
          body:JSON.stringify({level:Number(btn.dataset.level)})
        }).catch(()=>{});
      });
    });
  }


  /* Battle Pass ostaje "Coming Soon" za sada - ne koristi se jos. */

  /* Statistika: postojeći tabovi ostaju, a Karijera/Dostignuća dobijaju pravi backend. */
  const originalRenderStatTabContent = renderStatTabContent;
  renderStatTabContent = function () {
    const el = document.getElementById('statMainContent');
    if (!el) return;

    if (activeStatTab === 'karijera') {
      fpRenderCareer(el);
      return;
    }

    if (activeStatTab === 'dostignuca') {
      fpRenderAchievements(el);
      return;
    }

    originalRenderStatTabContent();
  };

  /* Svež backend snapshot osvežava otvoren ekran. */
  window.addEventListener('message', function (event) {
    const d = event.data || {};

    if (d.action === 'updateProgression') {
      if (currentPlayer) currentPlayer.progression = d.progression || {};
      if (currentCategory === 'statistika') renderStatistika();
      if (currentCategory === null) renderHome();
    }

    if (d.action === 'updateAchievements') {
      if (currentPlayer) currentPlayer.achievements = d.achievements || [];
      if (currentCategory === 'statistika' && activeStatTab === 'dostignuca') fpRenderAchievementsTab();
    }
  });
})();


(function () {
  if (typeof STAT_TABS !== 'undefined' && !STAT_TABS.some(t => t.id === 'skillovi')) {
    STAT_TABS.splice(STAT_TABS.length - 1, 0, {
      id: 'skillovi',
      label: 'Veštine',
      sub: 'Veštine i sposobnosti po poslovima',
      icon: 'fa-bolt'
    });
  }

  const ERROR_MESSAGES = {
    resource_not_started: 'Sistem veština (flamingo_skills) trenutno nije pokrenut na serveru.',
    export_error: 'Sistem veština je vratio grešku. Proveri server konzolu.',
    no_data: 'Podaci o veštini za tvog lika još nisu učitani. Sačekaj par sekundi i probaj ponovo.',
  };

  let skillTreeFetchAt = 0;
  let skillTreeAttempts = 0;
  let skillGuideOpen = false;   // 'Kako funkcioniše' umesto stabla
  const SKILL_TREE_MAX_ATTEMPTS = 4;
  const SKILL_TREE_MIN_GAP_MS = 1500;

  function fetchSkillTree(skillKey) {
    const now = Date.now();
    if (now - skillTreeFetchAt < SKILL_TREE_MIN_GAP_MS) return;
    skillTreeFetchAt = now;
    skillTreeAttempts += 1;
    fetch(`https://${GetParentResourceName()}/getSkillTree`, {
      method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ skill: skillKey })
    }).catch(()=>{});
  }

  function fpRenderSkillCategories(el) {
    const jobs = fpGetJobCategories();
    const skills = (currentPlayer && currentPlayer.progression && currentPlayer.progression.skills) || {};

    el.innerHTML = `
      <div class="fl-job-cat-grid">
        ${jobs.map(j => {
          const skill = j.progressionKey ? skills[j.progressionKey] : null;
          const clickable = j.ready;
          return `
            <div class="fl-job-cat-card${clickable ? '' : ' locked'}" ${clickable ? `data-skill-cat="${escapeHtml(j.key)}"` : ''}>
              ${!clickable ? `<span class="fl-job-cat-lock-badge">Uskoro</span>` : ''}
              ${clickable && skill && Number(skill.skill_points) > 0 ? `<span class="fl-job-cat-lock-badge fl-job-cat-points"><i class="fa-solid fa-gem"></i> ${fpNum(skill.skill_points)} ${Number(skill.skill_points) === 1 ? 'poen' : 'poena'}</span>` : ''}
              <div class="fl-job-cat-icon"><i class="fa-solid ${j.icon}"></i></div>
              <div>
                <div class="fl-job-cat-title">${escapeHtml(j.label)}</div>
                <p class="fl-job-cat-sub">${clickable ? 'Veštine i sposobnosti vezane za ovaj posao.' : 'Veštine za ovaj posao još nisu dostupne.'}</p>
              </div>
              ${clickable && skill ? `
                <div class="fl-job-cat-progress-row"><span>Trenutni nivo</span><b>Nivo ${fpNum(skill.level)}</b></div>
              ` : ''}
            </div>
          `;
        }).join('')}
      </div>
    `;

    el.querySelectorAll('[data-skill-cat]').forEach(card => {
      card.addEventListener('click', () => {
        activeSkillJob = card.dataset.skillCat;
        skillGuideOpen = false;
        fpRenderSkillsTab(el);
      });
    });
  }

  function fpRenderSkillsTab(el) {
    if (!activeSkillJob) {
      fpRenderSkillCategories(el);
      return;
    }

    // activeSkillJob je "key" posla (npr. 'rudar'), isti kao data-skill-cat
    // atribut na kartici - zato ovde tražimo posao po key-u, pa gledamo
    // NJEGOV progressionKey da znamo koji skill tree da prikažemo.
    const job = fpGetJobCategories().find(j => j.key === activeSkillJob);

    // Za sada je jedini posao sa pravim skill sistemom Rudar (progressionKey: 'mining').
    // Kada se doda skill tree za neki drugi posao, ovde se doda još jedan
    // "if (job && job.progressionKey === '...')" ogranak - fpRenderSkillCategories
    // iznad se ne dira.
    if (job && job.progressionKey && JOB_TEXT[job.progressionKey]) {
      renderSkillTree(el, job.progressionKey);
      return;
    }

    fpRenderSkillCategories(el);
  }

  // =====================================================================
  // "KAKO FUNKCIONIŠE" - sve se čita iz config-a (flamingo_skills + flamingo_miner)
  // =====================================================================
  function renderSkillGuide(tree, perks, branchDefs, effectLabel, xpPerDig, skillKey) {
    const T = jobText(skillKey);
    const g = tree.guide || {};
    const j = tree.jobInfo || {};
    const maxLevel = Number(g.maxLevel) || 50;
    const every = Number(g.pointEvery) || 5;
    const xpTable = g.xpTable || {};
    // Lua niz stiže kao JS niz (indeks 0 = nivo 1), a objekat kao { "1": ... }
    const xpAt = (l) => Number(Array.isArray(xpTable) ? xpTable[l - 1] : xpTable[l]) || 0;
    const level = Number(tree.level) || 1;

    // Dostignuća koja daju poene (iz pravih podataka igrača)
    const bonusAch = (Array.isArray(currentPlayer.achievements) ? currentPlayer.achievements : [])
      .filter(a => a.category === skillKey && a.reward && Number(a.reward.skillPoints) > 0);
    const bonusTotal = bonusAch.reduce((n, a) => n + Number(a.reward.skillPoints), 0);
    const maxPoints = (Number(g.pointsFromLevels) || Math.floor(maxLevel / every)) + bonusTotal;
    const totalCost = Number(g.totalPerkCost) || perks.reduce((n, p) => n + (Number(p.cost) || 0), 0);

    // Tabela nivoa sa poenima
    let cum = 0;
    const cumTo = {};
    for (let l = 1; l < maxLevel; l++) { cum += xpAt(l); cumTo[l + 1] = cum; }
    const milestoneRows = [];
    for (let l = every; l <= maxLevel; l += every) {
      const total = cumTo[l] || 0;
      const digs = Math.ceil(total / xpPerDig);
      const hrs = Math.round(((digs * ((Number(j.digSeconds) || 30) + (Number(j.cooldownSeconds) || 5) + 15)) / 3600) * 10) / 10;
      const reached = level >= l;
      milestoneRows.push(`
        <tr class="${reached ? 'is-done' : (g.nextPointLevel === l ? 'is-next' : '')}">
          <td><b>Nivo ${l}</b></td>
          <td>${fpNum(xpAt(l - 1))} XP</td>
          <td>${fpNum(total)} XP</td>
          <td>~${fpNum(digs)}</td>
          <td>~${hrs} h</td>
          <td>${reached ? '<span class="fl-chip fl-chip--ok"><i class="fa-solid fa-check"></i> Dobijen</span>' : `<span class="fl-chip fl-chip--accent">+1 poen</span>`}</td>
        </tr>`);
    }

    const perkRows = branchDefs.map(b => {
      const list = perks.filter(p => p.branch === b.id).sort((x, y) => (x.order || 0) - (y.order || 0));
      return list.map((p, i) => `
        <tr>
          <td>${i === 0 ? `<span class="fl-guide-branch">${escapeHtml(b.label)}</span>` : ''}</td>
          <td><b>${escapeHtml(p.label)}</b></td>
          <td>Nivo ${fpNum(p.requiredLevel)}</td>
          <td>${fpNum(p.cost)}</td>
          <td>${escapeHtml(p.description || '')}${(p.requires || []).length ? `<div class="fl-guide-sub">Prvo: ${p.requires.map(r => escapeHtml(r.label)).join(', ')}</div>` : ''}</td>
        </tr>`).join('');
    }).join('');

    const rewardTable = (list) => (list || []).map(r => `
      <tr>
        <td><b>${escapeHtml(r.label)}</b>${r.rare ? ' <span class="fl-chip fl-chip--accent">retka</span>' : ''}</td>
        <td>${r.min === r.max ? r.min : `${r.min}-${r.max}`} ${T.amountUnit || 'kom'}</td>
        <td>${r.chance}%</td>
      </tr>`).join('');

    return `
      <div class="fl-guide">

        <div class="fl-guide-intro">
          <div class="fl-guide-intro-icon"><i class="fa-solid fa-book-open"></i></div>
          <div>
            <h2>${T.guideTitle}</h2>
            <p>${T.intro} Na svakih <b>${every} nivoa</b> dobiješ
            <b>poen veštine</b> koji trošiš na <b>sposobnosti</b> - ${T.introTail}
            Poeni su retki, zato dobro razmisli šta prvo uzimaš.</p>
          </div>
        </div>

        <div class="fl-guide-grid">
          <div class="fl-guide-card">
            <div class="fl-guide-card-title"><i class="fa-solid fa-star"></i> Iskustvo (XP)</div>
            <ul class="fl-guide-list">
              ${T.xpLines(xpPerDig, j).map(l => `<li>${l}</li>`).join('')}
              <li>Kad dobiješ XP, iznad lika izađe <b>+XP</b>, a na novom nivou <b>NOVI NIVO</b>.</li>
            </ul>
          </div>

          <div class="fl-guide-card">
            <div class="fl-guide-card-title"><i class="fa-solid fa-gem"></i> Poeni veština</div>
            <ul class="fl-guide-list">
              <li><b>1 poen na svakih ${every} nivoa</b> (${Array.from({ length: Math.min(4, Math.floor(maxLevel / every)) }, (_, i) => (i + 1) * every).join(', ')}...) - ukupno <b>${fpNum(g.pointsFromLevels || Math.floor(maxLevel / every))}</b> do nivoa ${maxLevel}.</li>
              ${bonusAch.length ? `<li>Još <b>${bonusTotal}</b> iz velikih dostignuća: ${bonusAch.map(a => `<b>${escapeHtml(a.label)}</b>`).join(', ')}.</li>` : ''}
              <li>Najviše možeš skupiti <b>${fpNum(maxPoints)} poena</b>, a sve sposobnosti koštaju <b>${fpNum(totalCost)}</b> - ${maxPoints < totalCost ? '<b>niko ne može imati sve</b>, moraš da biraš.' : 'uz trud možeš imati sve.'}</li>
              <li>Poeni važe <b>samo za ${T.jobName}</b>. Svaki posao ima svoje poene.</li>
              <li>Otključana sposobnost je <b>trajna</b> i deluje odmah.</li>
            </ul>
          </div>
        </div>

        <div class="fl-section-title">Nivoi i poeni <small>maksimalni nivo je ${maxLevel}</small></div>
        <div class="fl-guide-card fl-guide-card--table">
          <table class="fl-guide-table">
            <thead><tr><th>Poen na</th><th>XP za taj nivo</th><th>Ukupno XP</th><th>${T.unitPlural.charAt(0).toUpperCase() + T.unitPlural.slice(1)}</th><th>Vreme rada</th><th></th></tr></thead>
            <tbody>${milestoneRows.join('')}</tbody>
          </table>
          <div class="fl-guide-note">Vreme je okvirno (${T.timeNote}). Sa sposobnostima ide brže.</div>
        </div>

        <div class="fl-section-title">Sve sposobnosti <small>${perks.length} sposobnosti · ${fpNum(totalCost)} poena ukupno</small></div>
        <div class="fl-guide-card fl-guide-card--table">
          <table class="fl-guide-table fl-guide-table--perks">
            <thead><tr><th>Grana</th><th>Sposobnost</th><th>Od nivoa</th><th>Poeni</th><th>Šta radi</th></tr></thead>
            <tbody>${perkRows}</tbody>
          </table>
        </div>

        <div class="fl-section-title">${T.placesGuideTitle}</div>
        ${mineCardsHtml({
          skill: skillKey,
          advancedUnlocked: perks.some(p => p.id === T.advanced.perkId && p.status === 'unlocked'),
          normalSpots: j.normalSpots, advancedSpots: j.advancedSpots,
          normalTable: `<table class="fl-guide-table fl-guide-table--small"><thead><tr><th>${T.itemWord}</th><th>${T.amountHeader || 'Količina'}</th><th>Šansa</th></tr></thead><tbody>${rewardTable(j.rewards)}</tbody></table>`,
          advancedTable: `<table class="fl-guide-table fl-guide-table--small"><thead><tr><th>${T.itemWord}</th><th>${T.amountHeader || 'Količina'}</th><th>Šansa</th></tr></thead><tbody>${rewardTable(j.advancedRewards)}</tbody></table>`
        })}

        <div class="fl-section-title">Saveti</div>
        <div class="fl-guide-tips">
          ${T.tips.map(t => `<div><i class="fa-solid ${t[0]}"></i><span>${t[1]}</span></div>`).join('')}
        </div>
      </div>
    `;
  }

  function renderSkillTree(el, skillKey) {
    const SK = skillKey || 'mining';
    const T = jobText(SK);
    const tree = getSkillTreeData(SK);
    const backBtnHtml = `<button class="fl-job-cat-back" id="fpSkillBackBtn"><i class="fa-solid fa-arrow-left"></i> Nazad na poslove</button>`;
    const bindBack = () => {
      const backBtn = document.getElementById('fpSkillBackBtn');
      if (backBtn) backBtn.addEventListener('click', () => {
        activeSkillJob = null;
        fpRenderSkillsTab(el);
      });
    };

    if (tree && tree.error) {
      el.innerHTML = `
        ${backBtnHtml}
        <div class="fl-empty">
          <i class="fa-solid fa-triangle-exclamation"></i>
          <span>${escapeHtml(ERROR_MESSAGES[tree.error] || 'Sistem veština trenutno nije dostupan.')}</span>
        </div>
        <div class="fl-center-row">
          <button class="fl-btn-secondary" id="fpSkillTreeRetryBtn"><i class="fa-solid fa-rotate-right"></i> Pokušaj ponovo</button>
        </div>
      `;
      bindBack();
      const retryBtn = document.getElementById('fpSkillTreeRetryBtn');
      if (retryBtn) retryBtn.addEventListener('click', () => {
        skillTreeAttempts = 0;
        skillTreeFetchAt = 0;
        setSkillTreeData(SK, null);
        renderSkillTree(el, SK);
      });
      return;
    }

    if (!tree || !Array.isArray(tree.perks)) {
      if (skillTreeAttempts >= SKILL_TREE_MAX_ATTEMPTS) {
        el.innerHTML = `
          ${backBtnHtml}
          <div class="fl-empty">
            <i class="fa-solid fa-triangle-exclamation"></i>
            <span>Sistem veština se ne javlja. Proveri da li je flamingo_skills pokrenut na serveru.</span>
          </div>
          <div class="fl-center-row">
            <button class="fl-btn-secondary" id="fpSkillTreeRetryBtn"><i class="fa-solid fa-rotate-right"></i> Pokušaj ponovo</button>
          </div>
        `;
        bindBack();
        const retryBtn = document.getElementById('fpSkillTreeRetryBtn');
        if (retryBtn) retryBtn.addEventListener('click', () => {
          skillTreeAttempts = 0;
          skillTreeFetchAt = 0;
          renderSkillTree(el, SK);
        });
        return;
      }

      el.innerHTML = `${backBtnHtml}<div class="fl-empty"><i class="fa-solid fa-spinner fa-spin"></i><span>Učitavam stablo veština...</span></div>`;
      bindBack();
      fetchSkillTree(SK);
      return;
    }

    skillTreeAttempts = 0;

    const skill = tree;
    const perks = tree.perks || [];
    const job = fpGetJobCategories().find(j => j.key === activeSkillJob);
    const jobLabel = job ? job.label : '';

    const branchDefs = Array.isArray(tree.branches) ? tree.branches.slice() : [];
    // Perkovi bez grane (ili sa granom koja nije u configu) idu u "Ostalo"
    perks.forEach(p => {
      if (!branchDefs.some(b => b.id === p.branch)) {
        if (!branchDefs.some(b => b.id === '__other')) branchDefs.push({ id: '__other', label: 'Ostalo', icon: 'fa-solid fa-star' });
        p.branch = '__other';
      }
    });

    const effectLabel = (k, v) => {
      const names = T.effects;
      const name = names[k] || k;
      if (k.endsWith('_pct')) return `${name} ${v > 0 ? '+' : ''}${v}%`;
      if (k.endsWith('_sec')) return `${name} ${v > 0 ? '+' : ''}${v}s`;
      if (v === 1 || v === true) return `${name}`;
      return `${name} ${v > 0 ? '+' : ''}${v}`;
    };

    const iconClass = (ic, fallback) => {
      if (!ic) return `fa-solid ${fallback}`;
      return ic.indexOf('fa-solid') === -1 && ic.indexOf('fa-regular') === -1 && ic.indexOf('fa-brands') === -1 ? `fa-solid ${ic}` : ic;
    };

    const unlockedCount = perks.filter(p => p.status === 'unlocked').length;

    const guide = tree.guide || {};
    const jobInfo = tree.jobInfo || {};
    const xpPerDig = Number(jobInfo.xpPerDig) || 50;
    const points = Number(skill.skill_points) || 0;
    const digsFor = (xp) => Math.max(1, Math.ceil((Number(xp) || 0) / xpPerDig));

    // Tačno šta fali da bi se sposobnost otključala
    const perkLockText = (p) => {
      const reqs = p.requires || [];
      if (Number(skill.level) < Number(p.requiredLevel || 0)) {
        const xp = Number(p.xpToLevel) || 0;
        return `Otključava se na <b>nivou ${fpNum(p.requiredLevel)}</b>${xp ? ` - još ${fpNum(xp)} XP (~${fpNum(digsFor(xp))} ${T.unitPlural})` : ''}`;
      }
      const missing = reqs.filter(r => !r.unlocked);
      if (missing.length) return `Prvo otključaj <b>${missing.map(r => escapeHtml(r.label)).join(', ')}</b>`;
      const cost = Number(p.cost) || 0;
      if (points < cost) {
        const need = cost - points;
        return `Fali ti <b>${need} ${need === 1 ? 'poen' : 'poena'}</b>${guide.nextPointLevel ? ` - sledeći dobijaš na nivou ${fpNum(guide.nextPointLevel)}` : ''}`;
      }
      return 'Zaključano';
    };

    const perkHtml = (p) => {
      const status = p.status || 'locked';
      const unlocked = status === 'unlocked';
      const available = status === 'available';
      const reqs = p.requires || [];
      const effects = p.effects ? Object.entries(p.effects) : [];
      const levelOk = Number(skill.level) >= Number(p.requiredLevel || 0);
      return `
        <div class="fl-perk fl-perk--${unlocked ? 'unlocked' : available ? 'available' : 'locked'}">
          <div class="fl-perk-node"><i class="fa-solid ${unlocked ? 'fa-check' : available ? 'fa-unlock' : 'fa-lock'}"></i></div>
          <div class="fl-perk-body">
            <div class="fl-perk-top">
              <span class="fl-perk-name"><i class="${iconClass(p.icon, 'fa-star')}"></i>${escapeHtml(p.label || p.id)}</span>
            </div>
            <p class="fl-perk-desc">${escapeHtml(p.description || '')}</p>
            <div class="fl-perk-meta">
              <span class="fl-chip ${unlocked || levelOk ? '' : 'fl-chip--bad'}"><i class="fa-solid fa-signal"></i> Nivo ${fpNum(p.requiredLevel)}</span>
              <span class="fl-chip fl-chip--accent"><i class="fa-solid fa-gem"></i> ${fpNum(p.cost)} ${Number(p.cost) === 1 ? 'poen' : 'poena'}</span>
              ${effects.map(([k, v]) => `<span class="fl-chip ${unlocked ? 'fl-chip--ok' : ''}">${escapeHtml(effectLabel(k, v))}</span>`).join('')}
            </div>
            ${reqs.length && !unlocked ? `<div class="fl-perk-req ${reqs.some(r => !r.unlocked) ? 'is-missing' : ''}">Potrebno: ${reqs.map(r => `<b style="color:${r.unlocked ? 'var(--ok)' : ''}">${escapeHtml(r.label)}</b>`).join(', ')}</div>` : ''}
            ${!unlocked && !available ? `<div class="fl-perk-lock"><i class="fa-solid fa-lock"></i><span>${perkLockText(p)}</span></div>` : ''}
            ${available ? `<button class="fl-day-claim-btn fl-perk-btn fp-perk-unlock" data-perk="${escapeHtml(p.id)}"><i class="fa-solid fa-unlock"></i> Otključaj za ${fpNum(p.cost)} ${Number(p.cost) === 1 ? 'poen' : 'poena'}</button>` : ''}
          </div>
        </div>
      `;
    };

    const branchesHtml = branchDefs.map(b => {
      const list = perks.filter(p => p.branch === b.id).sort((x, y) => (x.order || 0) - (y.order || 0));
      const done = list.filter(p => p.status === 'unlocked').length;
      return `
        <div class="fl-skill-branch">
          <div class="fl-skill-branch-head">
            <div class="fl-skill-branch-icon"><i class="${iconClass(b.icon, 'fa-star')}"></i></div>
            <div>
              <div class="fl-skill-branch-title">${escapeHtml(b.label || b.id)}</div>
              <div class="fl-skill-branch-count">${done} / ${list.length} otključano</div>
            </div>
          </div>
          <div class="fl-skill-branch-list">
            ${list.length ? list.map(perkHtml).join('') : '<div class="fl-skill-branch-empty">Nema sposobnosti u ovoj grani.</div>'}
          </div>
        </div>
      `;
    }).join('');

    const toolbarHtml = `
      <div class="fl-skill-toolbar">
        ${backBtnHtml}
        <button class="fl-btn-secondary fl-guide-btn" id="fpGuideBtn">
          <i class="fa-solid ${skillGuideOpen ? 'fa-diagram-project' : 'fa-circle-question'}"></i>
          ${skillGuideOpen ? 'Nazad na stablo veština' : 'Kako funkcioniše?'}
        </button>
      </div>`;

    const nextPointHtml = points > 0
      ? `<div class="fl-point-strip fl-point-strip--has"><i class="fa-solid fa-gem"></i><span>Imaš <b>${points} ${points === 1 ? 'neiskorišćen poen' : 'neiskorišćena poena'}</b> - izaberi sposobnost ispod i klikni <b>Otključaj</b>!</span></div>`
      : guide.nextPointLevel
        ? `<div class="fl-point-strip"><i class="fa-solid fa-gem"></i><span>Sledeći poen dobijaš na <b>nivou ${fpNum(guide.nextPointLevel)}</b> - još ${fpNum(guide.xpToNextPoint)} XP (~${fpNum(digsFor(guide.xpToNextPoint))} ${T.unitPlural})</span></div>`
        : '';

    if (skillGuideOpen) {
      el.innerHTML = toolbarHtml + renderSkillGuide(tree, perks, branchDefs, effectLabel, xpPerDig, SK);
      bindToolbar();
      return;
    }

    el.innerHTML = `
      ${toolbarHtml}
      ${window.fpSkillCard ? window.fpSkillCard(Object.assign({}, skill, { label: T.skillName }), jobLabel) : ''}
      ${nextPointHtml}
      <div class="fl-section-title">
        Stablo veština <small>${unlockedCount} / ${perks.length} sposobnosti</small>
        <span class="fl-skill-legend"><span class="is-ok">Otključano</span><span class="is-ready">Dostupno</span><span>Zaključano</span></span>
      </div>
      <div class="fl-skill-tree">${branchesHtml}</div>
    `;

    function bindToolbar() {
      const backBtn = document.getElementById('fpSkillBackBtn');
      if (backBtn) backBtn.addEventListener('click', () => {
        activeSkillJob = null;
        skillGuideOpen = false;
        fpRenderSkillsTab(el);
      });
      const guideBtn = document.getElementById('fpGuideBtn');
      if (guideBtn) guideBtn.addEventListener('click', () => {
        skillGuideOpen = !skillGuideOpen;
        renderSkillTree(el, SK);
        if (el.scrollTo) el.scrollTo(0, 0);
        if (categoryBody && categoryBody.scrollTo) categoryBody.scrollTo(0, 0);
      });
    }
    bindToolbar();

    el.querySelectorAll('.fp-perk-unlock').forEach(btn => {
      btn.addEventListener('click', () => {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Otključavam...';
        fetch(`https://${GetParentResourceName()}/unlockSkillPerk`, {
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify({ skill: SK, perkId: btn.dataset.perk })
        }).catch(()=>{});
      });
    });
  }

  // stari naziv
  function renderMiningSkillTree(el) { renderSkillTree(el, 'mining'); }

  const oldStatRendererForSkills = renderStatTabContent;
  renderStatTabContent = function () {
    if (activeStatTab === 'skillovi') {
      const el = document.getElementById('statMainContent');
      if (el) fpRenderSkillsTab(el);
      return;
    }
    oldStatRendererForSkills();
  };

  window.addEventListener('message', function (event) {
    const d = event.data || {};
    if (d.action === 'updateSkillTree' || d.action === 'updateMiningSkillTree') {
      const key = d.skill || 'mining';
      setSkillTreeData(key, d.skillTree || {});
      const job = fpGetJobCategories().find(j => j.key === activeSkillJob);
      if (currentCategory === 'statistika' && activeStatTab === 'skillovi' && job && job.progressionKey === key) {
        const el = document.getElementById('statMainContent');
        if (el) renderSkillTree(el, key);
      }
    }
  });
})();


// =====================================================================
// Pink tačka kad igrač ima neiskorišćen poen veštine
// =====================================================================
function getUnspentSkillPoints() {
  if (!currentPlayer) return 0;
  let total = 0;
  const trees = currentPlayer.skillTrees || {};
  const progSkills = (currentPlayer.progression && currentPlayer.progression.skills) || {};
  const keys = new Set([...Object.keys(trees), ...Object.keys(progSkills)]);
  keys.forEach(k => {
    const t = trees[k];
    if (t && !t.error && t.skill_points !== undefined) total += Number(t.skill_points) || 0;
    else if (progSkills[k]) total += Number(progSkills[k].skill_points) || 0;
  });
  return total;
}
function updateSkillDot() {
  const has = getUnspentSkillPoints() > 0;
  const railBtn = document.querySelector('.mmenu-rail-btn[data-category="statistika"]');
  if (railBtn) railBtn.classList.toggle('has-dot', has);
  const sub = document.querySelector('.mmenu-rail-sub-item[data-stat-tab="skillovi"]');
  if (sub) sub.classList.toggle('has-dot', has);
}
window.addEventListener('message', () => setTimeout(updateSkillDot, 0));
