const tabletWrapper = document.getElementById('tablet-wrapper');
const lockScreen = document.getElementById('lock-screen');
const lockClockEl = document.getElementById('lock-clock');
const lockDateEl = document.getElementById('lock-date');

const appBolnicaIcon = document.getElementById('app-bolnica');
const bolnicaBadge = document.getElementById('bolnica-badge');
const homeDock = document.getElementById('home-dock');
const dockOrganizacijaBtn = document.getElementById('dock-organizacija');
const dockBolnicaBtn = document.getElementById('dock-bolnica');
const homeScreen = document.getElementById('home-screen');
const appScreenBolnica = document.getElementById('app-screen-bolnica');
const callsListEl = document.getElementById('calls-list');
const callsEmptyEl = document.getElementById('calls-empty');
const callsCountPillEl = document.getElementById('calls-count-pill');
const bolnicaBackBtn = document.getElementById('bolnica-back');
const dutyStatusBarEl = document.getElementById('duty-status-bar');
const dutyStatusTextEl = document.getElementById('duty-status-text');

const appSupplyIcon = document.getElementById('app-supply');
const supplyBadge = document.getElementById('supply-badge');
const appScreenSupply = document.getElementById('app-screen-supply');
const supplyContentEl = document.getElementById('supply-content');
const supplyBackBtn = document.getElementById('supply-back');

// FLAMINGO_LIFEINVADER: aplikacija je sada ugradjena unutar tableta
const appLifeinvaderIcon = document.getElementById('app-lifeinvader');
const appScreenLifeinvader = document.getElementById('app-screen-lifeinvader');
const lifeinvaderBackBtn = document.getElementById('lifeinvader-back');
const liRankLabelEl = document.getElementById('li-rank-label');

const liTabFeedBtn = document.getElementById('li-tab-feed');
const liTabStaffBtn = document.getElementById('li-tab-staff');
const liStaffBadgeEl = document.getElementById('li-staff-badge');

const liPaneFeed = document.getElementById('li-pane-feed');
const liPaneStaff = document.getElementById('li-pane-staff');

const liChipRowEl = document.getElementById('li-chip-row');
const liFeedBodyEl = document.getElementById('li-feed-body');

const liStaffBodyEl = document.getElementById('li-staff-body');

const homeQuickstats = document.getElementById('home-quickstats');
const quickstatCallsEl = document.getElementById('quickstat-calls');
const quickstatMedkitsEl = document.getElementById('quickstat-medkits');

const toastStackEl = document.getElementById('toast-stack');

let unreadCalls = 0;
let currentJob = null;
let supplyStockData = null;
let supplyDeliveryData = null;
let supplyLogsData = null;

function post(name, data) {
  fetch(`https://${GetParentResourceName()}/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=UTF-8' },
    body: JSON.stringify(data || {})
  });
}

// Ista fetch() metoda kao post(), ali ceka i vraca odgovor iz cb() na Lua
// strani - koristi je Lifeinvader panel za direktan request/response (npr.
// "daj mi listu oglasa i vrati mi je odmah"), za razliku od post() koji je
// samo "posalji i zaboravi" (odgovor stize kasnije preko window message-a).
function postAsync(name, payload) {
  return fetch(`https://${GetParentResourceName()}/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=UTF-8' },
    body: JSON.stringify({ payload })
  }).then(r => r.json()).catch(() => null);
}

/* ===================== TOAST OBAVEŠTENJA ===================== */
function showToast(message, type) {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type || 'info'}`;

  const icons = {
    success: 'fa-circle-check',
    error: 'fa-circle-exclamation',
    info: 'fa-circle-info'
  };

  toast.innerHTML = `
    <span class="toast-icon"><i class="fa-solid ${icons[type] || icons.info}"></i></span>
    <span class="toast-text">${message}</span>
  `;

  toastStackEl.appendChild(toast);

  setTimeout(() => toast.classList.add('leaving'), 4200);
  setTimeout(() => toast.remove(), 4600);
}

function formatCoordsLabel(coords) {
  if (!coords) return 'Nepoznata lokacija';
  return `X: ${coords.x.toFixed(1)}  Y: ${coords.y.toFixed(1)}`;
}

/* ===================== POZIVI (Bolnica app) ===================== */
function renderCall(call, isFresh) {
  const el = document.createElement('div');
  el.className = 'call-item' + (isFresh ? ' new' : '');
  if (call.id) el.dataset.callId = call.id;

  const reasonHtml = call.reason
    ? `<div class="call-reason"><i class="fa-solid fa-comment-medical"></i><span>${call.reason}</span></div>`
    : '';

  el.innerHTML = `
    <div class="call-item-head">
      <div class="call-icon"><i class="fa-solid fa-truck-medical"></i></div>
      <div class="call-info">
        <div class="call-info-top">
          <span class="call-name">${call.name || 'Nepoznat igrač'}</span>
          <span class="call-time-chip"><i class="fa-solid fa-clock"></i> ${call.time || ''}</span>
        </div>
        <span class="call-location"><i class="fa-solid fa-location-dot"></i> ${formatCoordsLabel(call.coords)}</span>
      </div>
      ${isFresh ? '<span class="call-new-badge">NOVO</span>' : ''}
    </div>
    ${reasonHtml}
    <div class="call-actions">
      <button class="call-nav-btn" type="button"><i class="fa-solid fa-location-arrow"></i> Navigacija</button>
      <button class="call-claim-btn" type="button"><i class="fa-solid fa-hand-holding-medical"></i> Preuzmi poziv</button>
    </div>
  `;

  el.querySelector('.call-nav-btn').addEventListener('click', () => {
    if (call.coords) {
      post('setWaypoint', { x: call.coords.x, y: call.coords.y });
      showToast('Navigacija je postavljena na lokaciju poziva.', 'info');
    }
  });

  const claimBtn = el.querySelector('.call-claim-btn');
  claimBtn.addEventListener('click', () => {
    if (!call.id || claimBtn.disabled) return;
    claimBtn.disabled = true;
    claimBtn.classList.add('loading');
    claimBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Preuzimanje...';
    post('preuzmiPoziv', { id: call.id });
  });

  if (isFresh) {
    setTimeout(() => {
      el.classList.remove('new');
      const badge = el.querySelector('.call-new-badge');
      if (badge) badge.remove();
    }, 12000);
  }

  return el;
}

function updateCallsCount() {
  const count = callsListEl.querySelectorAll('.call-item').length;
  if (callsCountPillEl) callsCountPillEl.textContent = count;
  if (quickstatCallsEl) quickstatCallsEl.textContent = count;
}

function removeCallElement(callId) {
  const el = callsListEl.querySelector(`.call-item[data-call-id="${callId}"]`);
  if (!el) return false;

  el.classList.add('removing');
  setTimeout(() => {
    el.remove();
    if (callsListEl.querySelectorAll('.call-item').length === 0) {
      callsEmptyEl.classList.remove('hidden');
    }
    updateCallsCount();
  }, 260);

  return true;
}

function renderCallsList(calls) {
  callsListEl.querySelectorAll('.call-item').forEach(el => el.remove());

  if (!calls || calls.length === 0) {
    callsEmptyEl.classList.remove('hidden');
    updateCallsCount();
    return;
  }

  callsEmptyEl.classList.add('hidden');
  calls.forEach(call => callsListEl.appendChild(renderCall(call)));
  updateCallsCount();
}

function updateBadge() {
  if (unreadCalls > 0) {
    bolnicaBadge.textContent = unreadCalls > 9 ? '9+' : unreadCalls;
    bolnicaBadge.classList.remove('hidden');
  } else {
    bolnicaBadge.classList.add('hidden');
  }
}

function renderDutyStatus(available, onDuty) {
  if (!available) {
    dutyStatusBarEl.className = 'duty-status-bar offline';
    dutyStatusTextEl.textContent = 'Servis trenutno nije dostupan.';
    return;
  }

  if (onDuty > 0) {
    dutyStatusBarEl.className = 'duty-status-bar online';
    dutyStatusTextEl.textContent = `${onDuty} ${onDuty === 1 ? 'doktor je' : 'doktora je'} trenutno na dužnosti`;
  } else {
    dutyStatusBarEl.className = 'duty-status-bar offline';
    dutyStatusTextEl.textContent = 'Trenutno nema doktora na dužnosti.';
  }
}

function openBolnicaApp() {
  homeScreen.classList.add('hidden');
  appScreenBolnica.classList.remove('hidden');
  unreadCalls = 0;
  updateBadge();

  dutyStatusBarEl.className = 'duty-status-bar';
  dutyStatusTextEl.textContent = 'Proveravam dežurne doktore...';
  post('bolnicaGetDutyStatus');
}

function closeBolnicaApp() {
  appScreenBolnica.classList.add('hidden');
  homeScreen.classList.remove('hidden');
}

appBolnicaIcon.addEventListener('click', openBolnicaApp);
dockBolnicaBtn.addEventListener('click', openBolnicaApp);
bolnicaBackBtn.addEventListener('click', closeBolnicaApp);

/* ===================== SNABDEVANJE (MedKit supply) ===================== */
function openSupplyApp() {
  homeScreen.classList.add('hidden');
  appScreenSupply.classList.remove('hidden');
  supplyStockData = null;
  supplyDeliveryData = null;
  supplyLogsData = null;
  renderSupplyContent();
  post('supplyGetStock');
  post('supplyGetDeliveryStatus');
  post('supplyGetLogs');
}

function closeSupplyApp() {
  appScreenSupply.classList.add('hidden');
  homeScreen.classList.remove('hidden');
}

appSupplyIcon.addEventListener('click', openSupplyApp);
supplyBackBtn.addEventListener('click', closeSupplyApp);

/* ===================== LIFEINVADER =====================
   Ugradjeno kao obicna app-screen unutar tableta - vise ne otvara poseban
   NUI prozor iz drugog resursa. client.lua samo prosledjuje pozive ka
   flamingo_lifeinvader server-side callback-ovima/eventima.

   Dva taba:
   - "feed"    : svi vide odobrene oglase, mogu da filtriraju po kategoriji
   - "staff"   : samo zaposleni u drzavnoj sluzbi (Config.Job) - odobravanje
   Objavljivanje novog oglasa (nekad tab "compose") vise ne postoji ovde -
   igraci salju oglas iskljucivo preko telefona (flamingo_telefon). */

// Fallback dok server ne odgovori (ista podela kao Config.AdCategories) -
// server je uvek "izvor istine", ovo je samo da UI ne bude prazan pre toga.
window.__liCats = [
  { id: 'nekretnine', label: 'Nekretnine', icon: 'fa-house',                color: '#37d67a' },
  { id: 'vozila',     label: 'Vozila',     icon: 'fa-car',                  color: '#4fa4ff' },
  { id: 'biznisi',    label: 'Biznisi',    icon: 'fa-store',                color: '#ffb85c' },
  { id: 'posao',      label: 'Posao',      icon: 'fa-briefcase',            color: '#9b7bff' },
  { id: 'usluge',     label: 'Usluge',     icon: 'fa-screwdriver-wrench',   color: '#5fd4d0' },
  { id: 'ostalo',     label: 'Ostalo',     icon: 'fa-ellipsis',             color: '#9198b0' },
];

let liIsEmployee = false;
let liActiveFilter = 'all';
let liFeedCache = [];

function liCatInfo(id) {
  return window.__liCats.find(c => c.id === id) || window.__liCats[window.__liCats.length - 1];
}

function liEsc(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function liFmtDate(str) {
  if (str === null || str === undefined || str === '') return '-';
  // Neki DB drajveri vracaju DATETIME kolone kao Date objekat ili broj,
  // ne kao string - podrzavamo sva tri slucaja da izbegnemo pad.
  let d;
  if (str instanceof Date) d = str;
  else if (typeof str === 'number') d = new Date(str);
  else d = new Date(String(str).replace(' ', 'T'));
  if (isNaN(d.getTime())) return String(str);
  return d.toLocaleDateString('sr-RS') + ' ' + d.toLocaleTimeString('sr-RS', { hour: '2-digit', minute: '2-digit' });
}

// Racuna rgba() od hex boje kategorije - koristimo obican CSS custom
// property umesto color-mix() (noviji CSS koji stariji CEF/NUI build
// FiveM-a moze da ne podrzi), da bi "meki" obojeni pozadinski tonovi
// (chip/badge/tile) sigurno radili na svim verzijama.
function liAccentStyle(hex, alpha) {
  const h = String(hex || '#9198b0').replace('#', '');
  const r = parseInt(h.substring(0, 2), 16) || 0;
  const g = parseInt(h.substring(2, 4), 16) || 0;
  const b = parseInt(h.substring(4, 6), 16) || 0;
  return `--li-accent:${hex};--li-accent-soft:rgba(${r},${g},${b},${alpha});`;
}

function liInitials(name) {
  if (!name) return '?';
  const parts = String(name).trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || '?';
}

// ---------- otvaranje / zatvaranje / tabovi ----------

function openLifeinvaderApp() {
  homeScreen.classList.add('hidden');
  appScreenLifeinvader.classList.remove('hidden');
  liRankLabelEl.textContent = '';

  postAsync('li:getMyPermissions', {}).then(perms => {
    liIsEmployee = !!(perms && perms.isEmployee);
    if (perms && perms.categories && perms.categories.length) {
      // server salje "faIcon" (bez fa- prefiksa, npr. "house") - ovde ga
      // pretvaramo u puno ime FontAwesome klase koje UI ocekuje ("fa-house").
      window.__liCats = perms.categories.map(c => ({ id: c.id, label: c.label, color: c.color, icon: 'fa-' + c.faIcon }));
    }
    liTabStaffBtn.classList.toggle('hidden', !liIsEmployee);
    if (liIsEmployee) {
      liRankLabelEl.textContent = [perms.rankLabel, perms.name].filter(Boolean).join(' · ');
      loadLifeinvaderStaffAds(true /* silent, samo za badge */);
    }
    renderLiChipRow();
  });

  liSwitchTab('feed');
  loadLifeinvaderFeed();
}

function closeLifeinvaderApp() {
  appScreenLifeinvader.classList.add('hidden');
  homeScreen.classList.remove('hidden');
}

function liSwitchTab(tab) {
  liTabFeedBtn.classList.toggle('active', tab === 'feed');
  liTabStaffBtn.classList.toggle('active', tab === 'staff');

  liPaneFeed.classList.toggle('hidden', tab !== 'feed');
  liPaneStaff.classList.toggle('hidden', tab !== 'staff');

  if (tab === 'staff') loadLifeinvaderStaffAds();
}

liTabFeedBtn.addEventListener('click', () => liSwitchTab('feed'));
liTabStaffBtn.addEventListener('click', () => liSwitchTab('staff'));

// ---------- TAB: FEED ----------

function renderLiChipRow() {
  const chips = [{ id: 'all', label: 'Sve', icon: null, color: null }, ...window.__liCats];
  liChipRowEl.innerHTML = chips.map(c => `
    <button class="li-chip ${liActiveFilter === c.id ? 'active' : ''}" data-li-filter="${c.id}" style="${c.color ? liAccentStyle(c.color, 0.22) : ''}">
      ${c.icon ? `<i class="fa-solid ${c.icon}"></i>` : '<i class="fa-solid fa-border-all"></i>'}
      <span>${liEsc(c.label)}</span>
    </button>`).join('');

  liChipRowEl.querySelectorAll('[data-li-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      liActiveFilter = btn.dataset.liFilter;
      renderLiChipRow();
      renderLiFeed();
    });
  });
}

function loadLifeinvaderFeed() {
  liFeedBodyEl.innerHTML = '<div class="li-empty"><i class="fa-solid fa-spinner fa-spin"></i><span>Učitavanje oglasa...</span></div>';
  postAsync('li:getApprovedAds', {}).then(rows => {
    liFeedCache = rows || [];
    renderLiFeed();
  });
}

function renderLiFeed() {
  const rows = liActiveFilter === 'all' ? liFeedCache : liFeedCache.filter(ad => ad.category === liActiveFilter);
  if (!rows.length) {
    liFeedBodyEl.innerHTML = `
      <div class="li-empty">
        <i class="fa-solid fa-inbox"></i>
        <span>${liActiveFilter === 'all' ? 'Trenutno nema objavljenih oglasa.' : 'Nema oglasa u ovoj kategoriji.'}</span>
      </div>`;
    return;
  }
  liFeedBodyEl.innerHTML = rows.map(liRenderAdCardHtml).join('');
}

function liRenderAdCardHtml(ad) {
  const cat = liCatInfo(ad.category);
  return `
    <div class="li-ad-card" style="${liAccentStyle(cat.color, 0.35)}">
      <div class="li-ad-avatar">${liEsc(liInitials(ad.author_name))}</div>
      <div class="li-ad-main">
        <div class="li-ad-top">
          <span class="li-ad-author">${liEsc(ad.author_name)}</span>
          <span class="li-ad-cat-badge" style="${liAccentStyle(cat.color, 0.25)}"><i class="fa-solid ${cat.icon}"></i>${liEsc(cat.label)}</span>
        </div>
        <div class="li-ad-content">${liEsc(ad.content)}</div>
        <div class="li-ad-bottom">
          <span class="li-ad-meta">${ad.contact_number ? `<i class="fa-solid fa-phone"></i> ${liEsc(ad.contact_number)}` : ''}</span>
          <span class="li-ad-meta">${liFmtDate(ad.created_at)}</span>
        </div>
      </div>
    </div>`;
}

// ---------- TAB: ZAHTEVI (staff) ----------

function loadLifeinvaderStaffAds(silent) {
  if (!liIsEmployee) return;
  if (!silent) liStaffBodyEl.innerHTML = '<div class="li-empty"><i class="fa-solid fa-spinner fa-spin"></i><span>Učitavanje...</span></div>';

  postAsync('li:getPendingAds', {}).then(rows => {
    rows = rows || [];

    if (liStaffBadgeEl) {
      liStaffBadgeEl.textContent = rows.length;
      liStaffBadgeEl.classList.toggle('hidden', rows.length === 0);
    }
    if (silent) return;

    if (!rows.length) {
      liStaffBodyEl.innerHTML = '<div class="li-empty"><i class="fa-solid fa-inbox"></i><span>Nema oglasa koji čekaju odobrenje.</span></div>';
      return;
    }
    liStaffBodyEl.innerHTML = rows.map(ad => `
      <div class="li-panel-card">
        <div class="li-pending-top">
          <span class="li-pending-meta">#${ad.id} · ${liEsc(ad.author_name)} · ${liEsc(ad.contact_number || 'nepoznat broj')}</span>
          <span class="li-pending-meta">${liFmtDate(ad.created_at)}</span>
        </div>
        <div class="li-pending-content">${liEsc(ad.content)}</div>
        <textarea class="li-pending-edit" id="li-edit-${ad.id}" placeholder="(opciono) izmeni tekst pre objave...">${liEsc(ad.content)}</textarea>
        <div class="li-row-actions">
          <div class="li-pending-cat-row" id="li-cat-${ad.id}" data-selected="${ad.category}">
            ${window.__liCats.map(c => `
              <button type="button" class="li-chip li-pending-chip ${ad.category === c.id ? 'active' : ''}" data-cat="${c.id}" style="${liAccentStyle(c.color, 0.22)}">
                <i class="fa-solid ${c.icon}"></i><span>${liEsc(c.label)}</span>
              </button>`).join('')}
          </div>
          <div class="li-pending-actions">
            <button class="li-btn li-btn-green" data-ad-id="${ad.id}" data-li-action="approve">Prihvati</button>
            <button class="li-btn li-btn-red" data-ad-id="${ad.id}" data-li-action="reject">Odbij</button>
          </div>
        </div>
      </div>`).join('');

    liStaffBodyEl.querySelectorAll('.li-pending-cat-row').forEach(row => {
      row.querySelectorAll('.li-pending-chip').forEach(chip => {
        chip.addEventListener('click', () => {
          row.dataset.selected = chip.dataset.cat;
          row.querySelectorAll('.li-pending-chip').forEach(c => c.classList.toggle('active', c === chip));
        });
      });
    });

    liStaffBodyEl.querySelectorAll('[data-li-action="approve"]').forEach(btn => {
      btn.addEventListener('click', () => liApproveAd(btn.dataset.adId));
    });
    liStaffBodyEl.querySelectorAll('[data-li-action="reject"]').forEach(btn => {
      btn.addEventListener('click', () => liRejectAd(btn.dataset.adId));
    });
  });
}

function liApproveAd(adId) {
  const content = document.getElementById(`li-edit-${adId}`).value.trim();
  const category = document.getElementById(`li-cat-${adId}`).dataset.selected;
  postAsync('li:moderateAd', { adId, action: 'approve', category, content }).then(() => {
    loadLifeinvaderStaffAds();
    showToast('Oglas objavljen.', 'success');
  });
}

function liRejectAd(adId) {
  const reason = prompt('Razlog odbijanja:', 'Oglas odbijen.');
  if (reason === null) return;
  postAsync('li:moderateAd', { adId, action: 'reject', reason }).then(() => {
    loadLifeinvaderStaffAds();
    showToast('Oglas odbijen.', 'info');
  });
}

if (appLifeinvaderIcon) {
  appLifeinvaderIcon.addEventListener('click', openLifeinvaderApp);
}
if (lifeinvaderBackBtn) {
  lifeinvaderBackBtn.addEventListener('click', closeLifeinvaderApp);
}

function updateSupplyBadgeAndQuickstat(s) {
  if (!s) return;

  if (supplyBadge) {
    supplyBadge.textContent = s.quantity;
    supplyBadge.classList.remove('hidden');
    supplyBadge.classList.remove('badge-good', 'badge-low', 'badge-critical');
    if (s.statusKey === 'critical' || s.statusKey === 'none') {
      supplyBadge.classList.add('badge-critical');
    } else if (s.statusKey === 'low') {
      supplyBadge.classList.add('badge-low');
    } else {
      supplyBadge.classList.add('badge-good');
    }
  }

  if (quickstatMedkitsEl) quickstatMedkitsEl.textContent = s.quantity;
}

const SUPPLY_LOG_LABELS = {
  safe_take: 'Uzeto iz sefa',
  safe_deposit: 'Vraćeno u sef',
  npc_buy: 'Kupljeno kod NPC-a',
  offer_sell: 'Prodato preko radiala',
  delivery_complete: 'Dostava završena',
  delivery_pickup: 'Preuzeto iz dostave'
};

const SUPPLY_LOG_ICONS = {
  safe_take: 'fa-arrow-up-from-bracket',
  safe_deposit: 'fa-arrow-down-to-bracket',
  npc_buy: 'fa-cart-shopping',
  offer_sell: 'fa-hand-holding-dollar',
  delivery_complete: 'fa-truck-ramp-box',
  delivery_pickup: 'fa-box-open'
};

const SUPPLY_LOG_POSITIVE = ['delivery_complete', 'delivery_pickup', 'safe_deposit'];

function renderSupplyContent() {
  if (supplyStockData === null) {
    supplyContentEl.innerHTML = `<div class="supply-loading"><i class="fa-solid fa-spinner fa-spin"></i> Učitavanje...</div>`;
    return;
  }

  const s = supplyStockData;
  const d = supplyDeliveryData;

  // Procenat napunjenosti trake - referentna "puna" vrednost je 1.5x prag
  // za "dovoljno zaliha", da traka realno prikazuje stanje u odnosu na normalu.
  const fullRef = (s.goodThreshold || 50) * 1.5;
  const fillPct = Math.max(0, Math.min(100, Math.round((s.quantity / fullRef) * 100)));
  const fillClass = s.statusKey === 'critical' || s.statusKey === 'none' ? 'critical' : (s.statusKey === 'low' ? 'low' : '');

  let deliveryHtml = '';
  if (d) {
    if (d.carriedBy) {
      deliveryHtml = `
        <div class="supply-delivery-card transit">
          <div class="supply-delivery-title"><i class="fa-solid fa-person-carry-box"></i> Paket se nosi do kombija</div>
          <div class="supply-delivery-sub">Nosi ${d.carriedByName || '—'}</div>
          <div class="supply-delivery-status"><i class="fa-solid fa-box"></i> Ostalo ${d.remaining}/${d.total} za preuzeti</div>
          ${renderSupplyStepper(true, true)}
        </div>
      `;
    } else {
      deliveryHtml = `
        <div class="supply-delivery-card pending">
          <div class="supply-delivery-title"><i class="fa-solid fa-truck-ramp-box"></i> Dostava spremna za preuzimanje</div>
          <div class="supply-delivery-sub">Naručio ${d.orderedBy || '—'}</div>
          <div class="supply-delivery-status"><i class="fa-solid fa-box"></i> Ostalo ${d.remaining}/${d.total} za preuzeti</div>
          ${renderSupplyStepper(true, false)}
          <button class="supply-mark-btn" id="supply-mark-btn"><i class="fa-solid fa-location-crosshairs"></i> Označi lokaciju na mapi</button>
        </div>
      `;
    }
  }

  const orderDisabled = !!d;

  const logsHtml = (supplyLogsData || []).map(l => {
    const positive = SUPPLY_LOG_POSITIVE.includes(l.action);
    const icon = SUPPLY_LOG_ICONS[l.action] || 'fa-circle-info';
    return `
    <div class="supply-log-row ${positive ? 'positive' : 'negative'}">
      <span class="supply-log-icon"><i class="fa-solid ${icon}"></i></span>
      <div class="supply-log-text">
        <span class="supply-log-action">${SUPPLY_LOG_LABELS[l.action] || l.action}</span>
        <span class="supply-log-detail">${l.actor_name || '?'} · ${l.before_qty} → ${l.after_qty}</span>
      </div>
      <span class="supply-log-amount">${positive ? '+' : '-'}${l.amount}</span>
    </div>
  `;
  }).join('') || `<div class="supply-empty">Još nema promena.</div>`;

  supplyContentEl.innerHTML = `
    <div class="supply-stock-card">
      <div class="supply-stock-header"><i class="fa-solid fa-hospital"></i> FLAMINGO BOLNICA</div>
      <div class="supply-stock-row">
        <span class="supply-stock-icon"><i class="fa-solid fa-suitcase-medical"></i></span>
        <div class="supply-stock-info">
          <span class="supply-stock-label">MedKit u centralnoj zalihi</span>
          <span class="supply-stock-num">${s.quantity} <small>kom.</small></span>
        </div>
      </div>
      <div class="supply-stock-status supply-status-${s.statusKey}">${s.statusLabel}</div>
      <div class="supply-stock-track"><div class="supply-stock-fill ${fillClass}" style="width:${fillPct}%"></div></div>
    </div>

    ${deliveryHtml}

    <button class="supply-order-btn" id="supply-order-btn" ${orderDisabled ? 'disabled' : ''}>
      <i class="fa-solid fa-truck-fast"></i> ${orderDisabled ? 'Dostava već u toku' : `Naruči dostavu (${'100x $50.000'})`}
    </button>

    <div class="supply-section-title">Poslednje promene</div>
    <div class="supply-log-list">${logsHtml}</div>
  `;

  const orderBtn = document.getElementById('supply-order-btn');
  if (orderBtn && !orderDisabled) {
    orderBtn.addEventListener('click', () => {
      post('supplyOrderDelivery');
    });
  }

  const markBtn = document.getElementById('supply-mark-btn');
  if (markBtn) {
    markBtn.addEventListener('click', () => {
      post('supplyMarkLocation');
    });
  }
}

function renderSupplyStepper(ordered, carried) {
  return `
    <div class="supply-stepper">
      <div class="supply-step done">
        <span class="supply-step-dot"></span>
        <span class="supply-step-label">Naručeno</span>
      </div>
      <div class="supply-step-line ${carried ? 'done' : ''}"></div>
      <div class="supply-step ${carried ? 'done' : (ordered ? 'active' : '')}">
        <span class="supply-step-dot"></span>
        <span class="supply-step-label">U transportu</span>
      </div>
      <div class="supply-step-line"></div>
      <div class="supply-step ${carried ? 'active' : ''}">
        <span class="supply-step-dot"></span>
        <span class="supply-step-label">Preuzimanje</span>
      </div>
    </div>
  `;
}

function openTabletUI(data) {
  tabletWrapper.classList.remove('hidden');
  currentJob = data.job;

  // Home screen se uvek priprema u pozadini, ali korisnik prvo vidi
  // lock screen (kao pravi tablet/telefon) - aplikacije se ne vide dok
  // se ekran ne otključa.
  appScreenBolnica.classList.add('hidden');
  appScreenSupply.classList.add('hidden');
  appScreenLifeinvader.classList.add('hidden');
  appScreenOrganizacija.classList.add('hidden');
  homeScreen.classList.remove('hidden');
  homeScreen.classList.add('behind-lock');

  const isAmbulance = data.job === 'ambulance';
  appBolnicaIcon.classList.toggle('hidden', !isAmbulance);
  appSupplyIcon.classList.toggle('hidden', !isAmbulance);
  homeQuickstats.classList.toggle('hidden', !isAmbulance);
  dockBolnicaBtn.classList.toggle('hidden', !isAmbulance);

  // FLAMINGO_LIFEINVADER: ikonica je uvek vidljiva - stvarna provera da li
  // je igrac zaposlen u drzavnoj sluzbi (i koji rank ima) radi se server-side
  // u flamingo_lifeinvader kad klikne na nju (vidi client.lua ispod).
  if (appLifeinvaderIcon) appLifeinvaderIcon.classList.remove('hidden');

  orgIsHospitalBoss = !!data.isHospitalBoss;
  orgIsMember = !!data.isOrgMember;
  orgType = data.orgType || null;
  currentPlayer = data.orgPlayer || null;
  appOrganizacijaIcon.classList.toggle('hidden', !orgIsHospitalBoss && !orgIsMember);
  dockOrganizacijaBtn.classList.toggle('hidden', !orgIsHospitalBoss && !orgIsMember);
  homeDock.classList.toggle('hidden', !isAmbulance && !orgIsHospitalBoss && !orgIsMember);

  // Ikonica/dock menjaju boju i glif zavisno od toga koja je organizacija
  // trenutno u pitanju - isti ekran, drugo "ruho".
  const orgIconEl = document.getElementById('app-organizacija-icon');
  const orgGlyphEl = document.getElementById('app-organizacija-glyph');
  const dockIconEl = document.getElementById('dock-organizacija-icon');
  if (orgIconEl && orgGlyphEl && dockIconEl) {
    const isLi = orgType === 'lifeinvader';
    const isVlada = orgType === 'vlada';
    const isPd = orgType === 'policija';
    const isFibOrg = orgType === 'fib';
    const isSheriff = orgType === 'sheriff';
    const glyphIcon = isSheriff ? 'fa-star' : isFibOrg ? 'fa-user-secret' : (isPd ? 'fa-shield-halved' : (isLi ? 'fa-building' : (isVlada ? 'fa-landmark' : 'fa-hospital')));
    orgIconEl.className = `fa-solid ${glyphIcon}`;
    dockIconEl.className = `fa-solid ${glyphIcon}`;
    orgGlyphEl.classList.toggle('organizacija--lifeinvader', isLi);
    orgGlyphEl.classList.toggle('organizacija--vlada', isVlada);
    dockOrganizacijaBtn.classList.toggle('dock-organizacija--lifeinvader', isLi);
    dockOrganizacijaBtn.classList.toggle('dock-organizacija--vlada', isVlada);
    orgGlyphEl.classList.toggle('organizacija--policija', isPd);
    dockOrganizacijaBtn.classList.toggle('dock-organizacija--policija', isPd);
    orgGlyphEl.classList.toggle('organizacija--fib', isFibOrg);
    dockOrganizacijaBtn.classList.toggle('dock-organizacija--fib', isFibOrg);
    orgGlyphEl.classList.toggle('organizacija--sheriff', isSheriff);
    dockOrganizacijaBtn.classList.toggle('dock-organizacija--sheriff', isSheriff);
  }

  const orgTopbarIconEl = document.getElementById('app-icon-mini-organizacija-icon');
  if (orgTopbarIconEl) {
    orgTopbarIconEl.className = `fa-solid ${orgType === 'sheriff' ? 'fa-star' : orgType === 'fib' ? 'fa-user-secret' : orgType === 'policija' ? 'fa-shield-halved' : (orgType === 'lifeinvader' ? 'fa-building' : (orgType === 'vlada' ? 'fa-landmark' : 'fa-hospital'))}`;
  }

  renderCallsList(data.emsCalls || []);
  unreadCalls = 0;
  updateBadge();

  // Uvek prikazi lock screen prilikom otvaranja tableta (svaki put,
  // ne samo prvi put) - tek klikom/dodirom se otključava.
  lockScreen.classList.remove('unlocking');
  lockScreen.classList.remove('hidden');
  updateLockClock();
}

function unlockTabletUI() {
  if (!lockScreen || lockScreen.classList.contains('hidden')) return;
  lockScreen.classList.add('unlocking');
  homeScreen.classList.remove('behind-lock');
  setTimeout(() => {
    lockScreen.classList.add('hidden');
  }, 400);
}

function closeTabletUI() {
  tabletWrapper.classList.add('hidden');
  post('closeTablet');
}

// ================== OTVARANJE / ZATVARANJE ==================
window.addEventListener('message', (event) => {
  const data = event.data;

  if (data.action === 'openTablet') openTabletUI(data);
  if (data.action === 'closeTablet') closeTabletUI();

  if (data.action === 'newEmsCall') {
    const el = renderCall(data.call, true);
    callsEmptyEl.classList.add('hidden');
    callsListEl.insertBefore(el, callsListEl.firstChild);
    updateCallsCount();

    if (appScreenBolnica.classList.contains('hidden')) {
      unreadCalls += 1;
      updateBadge();
      showToast(`Novi poziv: ${data.call.name || 'nepoznat igrač'}`, 'info');
    }
  }

  if (data.action === 'callTaken') {
    const removed = removeCallElement(data.id);
    if (removed) {
      if (data.byMe) {
        showToast('Preuzeo/la si poziv. Kreni prema lokaciji.', 'success');
      } else {
        showToast(`Poziv je preuzeo/la ${data.takenBy || 'drugi doktor'}.`, 'info');
      }
    }
  }

  if (data.action === 'claimFailed') {
    const el = callsListEl.querySelector(`.call-item[data-call-id="${data.id}"]`);
    if (el) {
      const claimBtn = el.querySelector('.call-claim-btn');
      if (claimBtn) {
        claimBtn.disabled = false;
        claimBtn.classList.remove('loading');
        claimBtn.innerHTML = '<i class="fa-solid fa-hand-holding-medical"></i> Preuzmi poziv';
      }
    }
    showToast(data.reason || 'Nije moguće preuzeti poziv.', 'error');
  }

  if (data.action === 'bolnicaDutyStatusResult') {
    renderDutyStatus(data.available, data.onDuty);
  }

  if (data.action === 'supplyStockResult') {
    supplyStockData = data.data;
    updateSupplyBadgeAndQuickstat(data.data);
    if (!appScreenSupply.classList.contains('hidden')) renderSupplyContent();
  }

  if (data.action === 'supplyDeliveryResult') {
    supplyDeliveryData = data.delivery;
    if (!appScreenSupply.classList.contains('hidden')) renderSupplyContent();
  }

  if (data.action === 'supplyLogsResult') {
    supplyLogsData = data.logs;
    if (!appScreenSupply.classList.contains('hidden')) renderSupplyContent();
  }

  // Neko drugi je upravo objavio (odobren) oglas - ubaci ga u feed uzivo,
  // bez potrebe da igrac zatvori i ponovo otvori Lifeinvader aplikaciju.
  if (data.action === 'liNewAd' && data.ad) {
    liFeedCache.unshift(data.ad);
    if (!appScreenLifeinvader.classList.contains('hidden') && !liPaneFeed.classList.contains('hidden')) {
      renderLiFeed();
    }
  }
});

// ================== STATUSNA TRAKA: SAT / DATUM ==================
const statusbarClockEl = document.getElementById('statusbar-clock');
const statusbarDateEl = document.getElementById('statusbar-date');
const DAYS_SR = ['Ned', 'Pon', 'Uto', 'Sre', 'Čet', 'Pet', 'Sub'];
const DAYS_SR_FULL = ['Nedelja', 'Ponedeljak', 'Utorak', 'Sreda', 'Četvrtak', 'Petak', 'Subota'];
const MONTHS_SR_FULL = ['januar', 'februar', 'mart', 'april', 'maj', 'jun', 'jul', 'avgust', 'septembar', 'oktobar', 'novembar', 'decembar'];

function updateStatusbarClock() {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  statusbarClockEl.textContent = `${hh}:${mm}`;
  statusbarDateEl.textContent = `${DAYS_SR[now.getDay()]} ${String(now.getDate()).padStart(2, '0')}.${String(now.getMonth() + 1).padStart(2, '0')}.`;
}
updateStatusbarClock();
setInterval(updateStatusbarClock, 1000 * 15);

// ================== LOCK SCREEN: VELIKI SAT / DATUM ==================
function updateLockClock() {
  if (!lockClockEl) return;
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  lockClockEl.textContent = `${hh}:${mm}`;
  lockDateEl.textContent = `${DAYS_SR_FULL[now.getDay()]}, ${now.getDate()}. ${MONTHS_SR_FULL[now.getMonth()]}`;
}
updateLockClock();
setInterval(updateLockClock, 1000 * 15);

// Dodir/klik bilo gde na lock screen-u otključava tablet (kao pravi uređaj)
lockScreen.addEventListener('click', unlockTabletUI);

document.querySelector('.home-indicator').addEventListener('click', closeTabletUI);

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeTabletUI();
});

/* ============================================================
   ORGANIZACIJA (Lider Organizacije + Organizacija za obicne clanove) -
   preseljeno iz flamingo_mmenu (html/js/script.js). Ispod je tanak sloj
   koji premoscuje razlike u nazivima izmedju mmenu "detail" ekrana i
   tableta "app-screen" ekrana, pre nego sto krene kopirani kod bez izmena.
   ============================================================ */

// mmenu je za render u glavni sadrzaj koristio globalni "categoryBody"
// (div u koji se ubacuje innerHTML) - na tabletu je to #orgCategoryBody.
const categoryBody = document.getElementById('orgCategoryBody');

// mmenu je za NUI pozive iz org panela koristio sopstvenu orgPost() -
// identicna je funkciji post() koju tablet vec ima, pa je samo aliasiramo.
const orgPost = post;

// mmenu je imao globalnu escapeHtml() koju org kod koristi na dosta mesta -
// tablet je do sada nije imao (nije mu trebala za Bolnicu/Snabdevanje).
function escapeHtml(str) {
  const d = document.createElement('div');
  d.innerText = str ?? '';
  return d.innerHTML;
}

// mmenu je imao globalni "currentPlayer" (ime, posao...) za prikaz u
// org panelima (npr. da li si TI clan sa kojim baratas u listi) -
// popunjava se pri svakom otvaranju tableta (vidi openTabletUI ispod).
let currentPlayer = null;

// mmenu je pratio koji je "detail" ekran trenutno otvoren preko globalnog
// "currentCategory" ('organizacija' = Lider panel, 'orgmembers' = panel za
// obicne clanove) - koristi ga u rezultatima sa servera da zna da li treba
// osvezi prikaz. Tablet nema taj generalni sistem kategorija (ima odvojene
// app-screen-ove), pa ga ovde simuliramo kroz orgActiveMode ispod.
let currentCategory = null;

const appOrganizacijaIcon = document.getElementById('app-organizacija');
const appScreenOrganizacija = document.getElementById('app-screen-organizacija');
const organizacijaBackBtn = document.getElementById('organizacija-back');
const organizacijaTitleEl = document.getElementById('organizacija-title');
const orgModeSwitchEl = document.getElementById('org-mode-switch');
const orgModeLiderBtn = document.getElementById('org-mode-lider');
const orgModeClanBtn = document.getElementById('org-mode-clan');

let orgIsHospitalBoss = false; // ime ostalo isto, sad znaci "jesi li boss TRENUTNE organizacije" (bolnica ILI Lifeinvader, vidi orgType)
let orgIsMember = false;
let orgType = null; // 'hospital' | 'lifeinvader' | null - koji resurs napaja panel, postavlja se u openTabletUI
let orgActiveMode = 'lider'; // 'lider' (Uprava, boss-only) ili 'clan' (Moja Organizacija, svi clanovi)

// Resetuje sve keširane org podatke - poziva se na svako novo otvaranje
// tableta, isto kao sto je mmenu radio pri svakom 'openMenu'.
function resetOrgCache() {
  orgMembersList = null;
  orgRanksList = null;
  orgSafeData = null;
  orgSettingsData = null;
  orgLogsList = null;
  orgAnnouncementsList = null;
  orgMyProfileData = null;
  orgDutyStatsData = null;
  orgLeaderboardList = null;
  orgEventsList = null;
  orgActivitiesList = null;
  reqResetState();
}

function renderOrgActiveMode() {
  if (orgActiveMode === 'lider' && orgIsHospitalBoss) {
    organizacijaTitleEl.textContent = 'Lider Organizacije';
    currentCategory = 'organizacija';
    renderOrganizacija();
  } else {
    organizacijaTitleEl.textContent = 'Organizacija';
    currentCategory = 'orgmembers';
    renderOrgMemberHub();
  }

  orgModeLiderBtn.classList.toggle('active', orgActiveMode === 'lider');
  orgModeClanBtn.classList.toggle('active', orgActiveMode === 'clan');
}

function openOrganizacijaApp() {
  homeScreen.classList.add('hidden');
  appScreenOrganizacija.classList.remove('hidden');

  resetOrgCache();

  // Boss vidi i "Uprava" i "Moja Organizacija" (isto kao sto je u mmenu
  // imao DVA odvojena dugmeta u levoj traci) - obican clan vidi samo
  // "Moja Organizacija", bez prekidaca.
  const showSwitch = orgIsHospitalBoss && orgIsMember;
  orgModeSwitchEl.classList.toggle('hidden', !showSwitch);
  orgActiveMode = orgIsHospitalBoss ? 'lider' : 'clan';

  renderOrgActiveMode();

  if (['policija', 'fib', 'sheriff'].includes(orgType) && orgIsHospitalBoss) {
    postAsync('pd', { route: 'orgProfile', payload: {} }).then((res) => {
      if (!res || !res.ok) return;
      pdOrgPerms = res.profile.perms || [];
      if (!getOrgTabs().some(t => t.id === activeOrgTab)) activeOrgTab = 'clanovi';
      if (currentCategory === 'organizacija') renderOrganizacija();
    });
  }
}

function closeOrganizacijaApp() {
  appScreenOrganizacija.classList.add('hidden');
  homeScreen.classList.remove('hidden');
  currentCategory = null;
}

appOrganizacijaIcon.addEventListener('click', openOrganizacijaApp);
dockOrganizacijaBtn.addEventListener('click', openOrganizacijaApp);
organizacijaBackBtn.addEventListener('click', closeOrganizacijaApp);
orgModeLiderBtn.addEventListener('click', () => {
  if (orgActiveMode === 'lider') return;
  orgActiveMode = 'lider';
  renderOrgActiveMode();
});
orgModeClanBtn.addEventListener('click', () => {
  if (orgActiveMode === 'clan') return;
  orgActiveMode = 'clan';
  renderOrgActiveMode();
});
// ============================================================
// LIDER ORGANIZACIJE - panel za boss čin 'ambulance' posla. Sve akcije idu
// preko flamingo_hospital resursa (vidi client.lua ForwardToHospital).
// Isti vizuelni obrazac kao Podešavanja (fl-settings-layout sidenav).
// ============================================================

const ORG_TABS = [
  { id: 'clanovi', label: 'Upravljaj članovima', sub: 'Pregled svih članova organizacije', icon: 'fa-users' },
  { id: 'rankovi', label: 'Upravljaj rankovima', sub: 'Naziv i permisije po rangu', icon: 'fa-ranking-star' },
  { id: 'plate', label: 'Plate', sub: 'Plata po rangu, uključi/isključi', icon: 'fa-money-bill-wave' },
  { id: 'sef', label: 'Organizacijski sef', sub: 'Uplata, podizanje, istorija', icon: 'fa-vault' },
  { id: 'postavke', label: 'Postavke organizacije', sub: 'Naziv, opis i pravila', icon: 'fa-gear' },
  { id: 'logovi', label: 'Logovi', sub: 'Istorija svih akcija lidera', icon: 'fa-clipboard-list' },
  { id: 'obavestenje', label: 'Obaveštenje', sub: 'Poruka svim online članovima', icon: 'fa-bullhorn' }
];

// Lifeinvader nema svoj sistem rankova/plata po rangu (grade dolazi direktno
// iz ESX job_grades, plata je fiksna preko flamingo_payday) - taj tab se
// ovde jednostavno izostavlja, ne postoji njegov renderer.
const ORG_TABS_LIFEINVADER = ORG_TABS.filter(t => t.id !== 'rankovi' && t.id !== 'plate');

// Policija: tabovi lidera zavise od dozvola čina (server svejedno proverava sve)
let pdOrgPerms = null;
const PD_TAB_PERMS = { rankovi: 'boss.ranks', plate: 'boss.salary', postavke: 'boss.menu', obavestenje: 'boss.announce' };

function getOrgTabs() {
  if (['policija', 'fib', 'sheriff'].includes(orgType)) {
    if (!pdOrgPerms) return ORG_TABS;
    const has = (p) => pdOrgPerms.includes('*') || pdOrgPerms.includes(p);
    return ORG_TABS.filter(t => !PD_TAB_PERMS[t.id] || has(PD_TAB_PERMS[t.id]));
  }
  const tabs = orgType === 'lifeinvader' ? ORG_TABS_LIFEINVADER : ORG_TABS;
  // Tab "Zahtevi" postoji za Vladu (pregled/odobravanje) i za Ambulantu
  // (podnošenje) - odmah posle "Članovi". Ko šta sme da radi u tabu se i
  // dalje odlučuje na serveru (flamingo_vlada/requests).
  if (orgType !== 'vlada' && orgType !== 'hospital') return tabs;
  const withRequests = tabs.slice();
  withRequests.splice(1, 0, ORG_TAB_ZAHTEVI);
  return withRequests;
}

const ORG_LOG_LABELS = {
  invite: 'Pozvao člana',
  kick: 'Izbacio člana',
  rank_up: 'Unapredio',
  rank_down: 'Degradirao',
  safe_deposit: 'Uplatio u sef',
  safe_withdraw: 'Podigao iz sefa',
  vehicle_spawn: 'Spawnovao vozilo',
  announcement: 'Poslao obaveštenje',
  license_issue: 'Izdao dozvolu',
  idcard_issue: 'Izdao ličnu kartu',
  license_renew: 'Obnovio dozvolu',
  idcard_renew: 'Obnovio ličnu kartu',
  post: 'Poslao oglas',
  approve: 'Odobrio oglas',
  reject: 'Odbio oglas',
  request_create: 'Podneo zahtev',
  request_approve: 'Odobrio zahtev',
  request_reject: 'Odbio zahtev',
  request_cancel: 'Otkazao zahtev',
  mdt_search: 'Pretražio građane (MDT)',
  mdt_view: 'Otvorio profil građanina (MDT)',
  mdt_note_add: 'Dodao belešku (MDT)',
  mdt_note_delete: 'Obrisao belešku (MDT)',
  boss_hire: 'Zaposlio',
  boss_fire: 'Otpustio',
  boss_promote: 'Unapredio',
  boss_demote: 'Degradirao',
  boss_salary: 'Promenio platu',
  rank_edit: 'Izmenio čin',
  settings_edit: 'Izmenio postavke'
};

let activeOrgTab = 'clanovi';
let orgMembersList = null;
let orgRanksList = null;
let orgSafeData = null;
let orgSettingsData = null;
let orgLogsList = null;
let orgMemberSearchQuery = '';
let orgMemberOnlineFilter = false;

function renderOrganizacija() {
  const navHtml = getOrgTabs().map(t => `
    <button class="fl-settings-nav-item ${activeOrgTab === t.id ? 'active' : ''}" data-org-tab="${t.id}">
      <div class="fl-settings-nav-icon"><i class="fa-solid ${t.icon}"></i></div>
      <div class="fl-settings-nav-text">
        <span class="fl-settings-nav-title">${escapeHtml(t.label.toUpperCase())}</span>
        <span class="fl-settings-nav-sub">${escapeHtml(t.sub)}</span>
      </div>
      <i class="fa-solid fa-chevron-right fl-settings-nav-chevron"></i>
    </button>
  `).join('');

  categoryBody.innerHTML = `
    <div class="fl-org-page-grid">
      <div class="fl-settings-sidenav">${navHtml}</div>
      <div class="fl-settings-main-wrap">
        <div class="fl-settings-main" id="orgMainContent"></div>
      </div>
      <aside class="fl-org-info-panel" id="orgInfoPanel"></aside>
    </div>
  `;

  categoryBody.querySelectorAll('[data-org-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      activeOrgTab = btn.dataset.orgTab;
      renderOrganizacija();
    });
  });

  renderOrgTabContent();
  renderOrgInfoPanel(true);
}

// ---- Desni panel sa opštim info. o organizaciji (uvek vidljiv, bez obzira na aktivni tab) ----
// canEdit = true samo za lidera (dugme "Uredi organizaciju"); obicni clanovi vide isti panel bez tog dugmeta.
function renderOrgInfoPanel(canEdit) {
  const el = document.getElementById('orgInfoPanel');
  if (!el) return;

  if (orgSettingsData === null) orgPost('orgGetSettings');
  if (orgMembersList === null) orgPost('orgGetMembers');

  const jobShort = ((currentPlayer && currentPlayer.job) ? currentPlayer.job : 'ORG').toUpperCase();
  const orgName = (orgSettingsData && orgSettingsData.org_name) ? orgSettingsData.org_name : ((currentPlayer && currentPlayer.job) ? currentPlayer.job : 'Organizacija');
  const description = (orgSettingsData && orgSettingsData.description) ? orgSettingsData.description : '';
  const rules = (orgSettingsData && orgSettingsData.rules) ? orgSettingsData.rules : '';
  const memberCount = orgMembersList ? orgMembersList.length : '—';
  const onlineCount = orgMembersList ? orgMembersList.filter(m => m.online).length : null;
  const directorMember = (orgMembersList && orgMembersList.length)
    ? orgMembersList.reduce((top, m) => (!top || m.grade > top.grade) ? m : top, null)
    : null;
  const directorName = directorMember ? directorMember.name : '—';
  const tagline = description
    ? ('„' + description.slice(0, 70) + (description.length > 70 ? '…' : '') + '“')
    : 'Organizacija na Flamingo Roleplay serveru.';

  el.innerHTML = `
    <div class="fl-org-info-banner">
      <img class="fl-org-info-banner-img" src="img/hospital_org_banner.jpg" alt="${escapeHtml(orgName)}">
      <div class="fl-org-info-banner-fade"></div>
      <div class="fl-org-info-badge">
        <i class="fa-solid fa-crown"></i>
        <span>${escapeHtml(jobShort)}</span>
      </div>
    </div>
    <div class="fl-org-info-body">
      <i class="fa-solid fa-building-columns fl-org-info-watermark"></i>
      <div class="fl-org-info-name">${escapeHtml(orgName)}</div>
      <div class="fl-org-info-tagline">${escapeHtml(tagline)}</div>

      <div class="fl-org-info-row">
        <i class="fa-solid fa-building"></i>
        <div class="fl-org-info-row-text">
          <span class="fl-org-info-row-label">Naziv organizacije</span>
          <span class="fl-org-info-row-value">${escapeHtml(orgName)}</span>
        </div>
      </div>
      <div class="fl-org-info-row">
        <i class="fa-solid fa-users"></i>
        <div class="fl-org-info-row-text">
          <span class="fl-org-info-row-label">Br. članova</span>
          <span class="fl-org-info-row-value">${memberCount}${onlineCount !== null ? ` <span class="fl-org-info-online-tag"><span class="fl-org-color-dot fl-org-color-dot--online"></span>${onlineCount} online</span>` : ''}</span>
        </div>
      </div>
      <div class="fl-org-info-row">
        <i class="fa-solid fa-crown"></i>
        <div class="fl-org-info-row-text">
          <span class="fl-org-info-row-label">${orgType === 'sheriff' ? 'Šerif' : orgType === 'fib' ? 'Direktor FIB-a' : orgType === 'policija' ? 'Načelnik policije' : (orgType === 'lifeinvader' ? 'Vlasnik firme' : (orgType === 'vlada' ? 'Šef vlade' : 'Direktor bolnice'))}</span>
          <span class="fl-org-info-row-value">${escapeHtml(directorName)}</span>
        </div>
      </div>
      <div class="fl-org-info-row">
        <i class="fa-solid fa-align-left"></i>
        <div class="fl-org-info-row-text">
          <span class="fl-org-info-row-label">Opis</span>
          <span class="fl-org-info-row-value${description ? '' : ' fl-org-info-row-value--muted'}">${description ? escapeHtml(description) : 'Opis organizacije još nije podešen.'}</span>
        </div>
      </div>
      <div class="fl-org-info-row">
        <i class="fa-solid fa-scroll"></i>
        <div class="fl-org-info-row-text">
          <span class="fl-org-info-row-label">Pravila</span>
          <span class="fl-org-info-row-value${rules ? '' : ' fl-org-info-row-value--muted'}">${rules ? escapeHtml(rules).replace(/\n/g, '<br>') : 'Pravila organizacije još nisu podešena.'}</span>
        </div>
      </div>
    </div>
    ${canEdit ? `
    <div class="fl-org-info-footer">
      <button class="fl-btn-primary fl-org-info-edit-btn" id="orgInfoEditBtn"><i class="fa-solid fa-pen"></i> Uredi organizaciju</button>
    </div>` : ''}
  `;

  const editBtn = document.getElementById('orgInfoEditBtn');
  if (editBtn) {
    editBtn.addEventListener('click', () => {
      activeOrgTab = 'postavke';
      renderOrganizacija();
    });
  }
}

function renderOrgTabContent() {
  const el = document.getElementById('orgMainContent');
  if (!el) return;

  switch (activeOrgTab) {
    case 'clanovi': renderOrgMembers(el); break;
    case 'rankovi': renderOrgRanks(el); break;
    case 'plate': renderOrgSalaries(el); break;
    case 'sef': renderOrgSafe(el); break;
    case 'postavke': renderOrgSettings(el); break;
    case 'logovi': renderOrgLogs(el); break;
    case 'obavestenje': renderOrgAnnounce(el); break;
    case 'zahtevi': renderOrgRequests(el); break;
  }
}

// ---- 1) ČLANOVI ----
function renderOrgMembers(el) {
  if (orgMembersList === null) {
    el.innerHTML = `<div class="fl-org-loading"><i class="fa-solid fa-spinner fa-spin"></i> Učitavanje članova...</div>`;
    orgPost('orgGetMembers');
    return;
  }

  el.innerHTML = `
    <h2 class="fl-org-section-title"><i class="fa-solid fa-users"></i> Članovi organizacije (${orgMembersList.length})</h2>
    <div class="fl-org-members-toolbar">
      <div class="fl-org-members-search">
        <i class="fa-solid fa-magnifying-glass"></i>
        <input type="text" id="orgMemberSearchInput" placeholder="Pretraži članove..." value="${escapeHtml(orgMemberSearchQuery)}">
      </div>
      <button class="fl-org-members-filter-btn ${orgMemberOnlineFilter ? 'active' : ''}" id="orgMemberFilterBtn" title="Prikaži samo online članove">
        <i class="fa-solid fa-filter"></i>
      </button>
    </div>
    <div class="fl-org-member-list" id="orgMemberListRows"></div>
  `;

  renderOrgMemberRows();

  const searchInput = document.getElementById('orgMemberSearchInput');
  searchInput.addEventListener('input', () => {
    orgMemberSearchQuery = searchInput.value;
    renderOrgMemberRows();
  });

  document.getElementById('orgMemberFilterBtn').addEventListener('click', (e) => {
    orgMemberOnlineFilter = !orgMemberOnlineFilter;
    e.currentTarget.classList.toggle('active', orgMemberOnlineFilter);
    renderOrgMemberRows();
  });
}

// Renderuje samo listu redova (bez toolbar-a) da pretraga ne gubi fokus input polja.
function renderOrgMemberRows() {
  const rowsEl = document.getElementById('orgMemberListRows');
  if (!rowsEl || orgMembersList === null) return;

  const maxGrade = orgMembersList.length ? Math.max(...orgMembersList.map(m => m.grade || 0)) : 0;

  let list = orgMembersList;
  if (orgMemberOnlineFilter) list = list.filter(m => m.online);
  if (orgMemberSearchQuery.trim()) {
    const q = orgMemberSearchQuery.trim().toLowerCase();
    list = list.filter(m => (m.name || '').toLowerCase().includes(q));
  }

  rowsEl.innerHTML = list.map(m => {
    const isLeader = maxGrade > 0 && (m.grade || 0) === maxGrade;
    return `
      <div class="fl-org-member-row" data-member-name="${escapeHtml(m.name)}">
        <div class="fl-org-member-avatar ${isLeader ? 'lider' : ''}">
          ${escapeHtml((m.name || '?').trim().charAt(0).toUpperCase())}
          <div class="fl-org-member-status ${m.online ? 'online' : 'offline'}"></div>
        </div>
        <div class="fl-org-member-info">
          <span class="fl-org-member-name">${escapeHtml(m.name)}</span>
          <span class="fl-org-member-sub">${escapeHtml(m.gradeLabel || ('Rank ' + m.grade))}${m.onDuty ? ' · <b class="fl-org-green">na dužnosti</b>' : ''}</span>
        </div>
        <span class="fl-org-member-role ${isLeader ? 'lider' : 'clan'}">
          <i class="fa-solid ${isLeader ? 'fa-crown' : 'fa-user'}"></i> ${isLeader ? 'LIDER' : 'ČLAN'}
        </span>
        <i class="fa-solid fa-chevron-right fl-org-member-chevron"></i>
      </div>
    `;
  }).join('') || `<div class="fl-org-empty">Nema članova koji odgovaraju pretrazi.</div>`;

  rowsEl.querySelectorAll('.fl-org-member-row').forEach(row => {
    row.addEventListener('click', () => {
      const member = list.find(x => x.name === row.dataset.memberName);
      if (member) openOrgMemberPanel(member, maxGrade);
    });
  });
}

// ---- Panel za pojedinačnog člana (kick / promeni rank) - otvara se klikom na red ----
let orgMemberPanelOverlay = null;
let orgMemberPanelMember = null;

function openOrgMemberPanel(member, maxGrade) {
  const isSelf = currentPlayer && member.name === currentPlayer.name;
  const isTargetLeader = maxGrade > 0 && (member.grade || 0) === maxGrade;
  const locked = isSelf || isTargetLeader;

  const overlay = document.createElement('div');
  overlay.className = 'fl-crate-overlay fl-org-member-overlay';
  overlay.innerHTML = `
    <div class="fl-org-member-panel">
      <button class="fl-crate-detail-close fl-org-member-panel-close"><i class="fa-solid fa-xmark"></i></button>
      <div class="fl-org-member-panel-head">
        <div class="fl-org-member-panel-avatar">${escapeHtml((member.name || '?').trim().charAt(0).toUpperCase())}</div>
        <div class="fl-org-member-panel-headtext">
          <h3>${escapeHtml(member.name)}</h3>
          <span class="fl-org-member-role ${isTargetLeader ? 'lider' : 'clan'}">
            <i class="fa-solid ${isTargetLeader ? 'fa-crown' : 'fa-user'}"></i> ${escapeHtml(member.gradeLabel || ('Rank ' + member.grade))}
          </span>
        </div>
      </div>
      <div class="fl-org-member-panel-body" id="orgMemberPanelBody">
        ${locked ? `
          <p class="fl-org-member-panel-note">${isSelf ? 'Ne možeš menjati sopstveni rank ili se izbaciti.' : 'Ne možeš menjati rank lidera niti ga izbaciti odavde.'}</p>
        ` : `
          <span class="fl-org-member-panel-label">Promeni rank</span>
          <div class="fl-select disabled" id="orgMemberGradeSelect">
            <div class="fl-select-trigger">
              <span class="fl-select-value">Učitavanje rankova...</span>
              <i class="fa-solid fa-chevron-down"></i>
            </div>
            <div class="fl-select-menu"></div>
          </div>
          <button class="fl-btn-secondary" id="orgMemberSaveGradeBtn"><i class="fa-solid fa-floppy-disk"></i> Sačuvaj rank</button>
          <div class="fl-org-member-panel-divider"></div>
          <button class="fl-btn-danger" id="orgMemberKickBtn"><i class="fa-solid fa-user-slash"></i> Izbaci iz organizacije</button>
        `}
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  let removeGradeSelectOutsideClick = null;
  const closeOverlay = () => {
    overlay.remove();
    if (removeGradeSelectOutsideClick) removeGradeSelectOutsideClick();
    if (orgMemberPanelOverlay === overlay) { orgMemberPanelOverlay = null; orgMemberPanelMember = null; }
  };

  overlay.querySelector('.fl-org-member-panel-close').addEventListener('click', closeOverlay);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeOverlay(); });

  if (!locked) {
    orgMemberPanelOverlay = overlay;
    orgMemberPanelMember = member;

    const gradeSelect = overlay.querySelector('#orgMemberGradeSelect');
    const gradeTrigger = gradeSelect.querySelector('.fl-select-trigger');
    const onOutsideClick = (e) => { if (!gradeSelect.contains(e.target)) gradeSelect.classList.remove('open'); };
    document.addEventListener('click', onOutsideClick);
    removeGradeSelectOutsideClick = () => document.removeEventListener('click', onOutsideClick);
    gradeTrigger.addEventListener('click', () => {
      if (gradeSelect.classList.contains('disabled')) return;
      gradeSelect.classList.toggle('open');
    });

    populateOrgMemberGradeSelect(overlay, member);
    if (orgRanksList === null) orgPost('orgGetRanks');

    overlay.querySelector('#orgMemberSaveGradeBtn').addEventListener('click', () => {
      const select = overlay.querySelector('#orgMemberGradeSelect');
      const grade = parseInt(select.dataset.value, 10);
      if (Number.isNaN(grade) || grade === member.grade) return;
      orgPost('orgSetMemberGrade', { name: member.name, grade, identifier: member.identifier });
      closeOverlay();
      setTimeout(() => { if (activeOrgTab === 'clanovi') orgPost('orgGetMembers'); }, 400);
    });

    const kickBtn = overlay.querySelector('#orgMemberKickBtn');
    let kickConfirming = false;
    kickBtn.addEventListener('click', () => {
      if (!kickConfirming) {
        kickConfirming = true;
        kickBtn.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Potvrdi izbacivanje?';
        kickBtn.classList.add('confirming');
        return;
      }
      orgPost('orgKickMember', { name: member.name, identifier: member.identifier });
      closeOverlay();
      setTimeout(() => { if (activeOrgTab === 'clanovi') orgPost('orgGetMembers'); }, 400);
    });
  }
}

function populateOrgMemberGradeSelect(overlay, member) {
  const wrap = overlay.querySelector('#orgMemberGradeSelect');
  if (!wrap) return;
  const valueEl = wrap.querySelector('.fl-select-value');
  const menu = wrap.querySelector('.fl-select-menu');

  if (orgRanksList === null) {
    wrap.classList.add('disabled');
    wrap.classList.remove('open');
    wrap.dataset.value = '';
    valueEl.textContent = 'Učitavanje rankova...';
    menu.innerHTML = '';
    return;
  }

  const currentMaxGrade = orgMembersList && orgMembersList.length ? Math.max(...orgMembersList.map(m => m.grade || 0)) : -1;
  const options = orgRanksList.filter(r => r.grade !== currentMaxGrade);
  const list = options.length ? options : [{ grade: member.grade, label: member.gradeLabel || ('Rank ' + member.grade) }];
  const selected = list.find(r => r.grade === member.grade) || list[0];

  wrap.classList.remove('disabled');
  wrap.dataset.value = String(selected.grade);
  valueEl.textContent = selected.label;

  menu.innerHTML = list
    .map(r => `<div class="fl-select-option ${r.grade === selected.grade ? 'selected' : ''}" data-grade="${r.grade}">${escapeHtml(r.label)}</div>`)
    .join('');

  menu.querySelectorAll('.fl-select-option').forEach((opt) => {
    opt.addEventListener('click', () => {
      const grade = parseInt(opt.dataset.grade, 10);
      wrap.dataset.value = String(grade);
      valueEl.textContent = opt.textContent;
      menu.querySelectorAll('.fl-select-option').forEach((o) => o.classList.remove('selected'));
      opt.classList.add('selected');
      wrap.classList.remove('open');
    });
  });
}

// ---- 2) RANKOVI ----
function renderOrgRanks(el) {
  if (orgRanksList === null) {
    el.innerHTML = `<div class="fl-org-loading"><i class="fa-solid fa-spinner fa-spin"></i> Učitavanje rankova...</div>`;
    orgPost('orgGetRanks');
    return;
  }

  // Bolnica ima svoj set (medicinske permisije), Vlada ima generički set
  // permisija za državnu službu - isti obrazac kao ORG_TABS_LIFEINVADER,
  // samo što ovde ne gasimo ceo tab nego samo menjamo koje se permisije nude.
  const PERM_LABELS_HOSPITAL = [
    ['can_invite', 'Može pozivati'],
    ['can_kick', 'Može izbacivati'],
    ['can_use_safe', 'Može koristiti sef'],
    ['can_revive', 'Može oživljavati'],
    ['can_heal', 'Može lečiti'],
    ['can_medkit', 'Može davati medkite'],
    ['can_medcert', 'Može izdavati lekarsko'],
    ['can_manage_ranks', 'Može spuštati/dizati rankove'],
    ['can_manage_salaries', 'Može menjati plate'],
    ['can_delivery', 'Može naručivati/preuzimati MedKit dostavu']
  ];

  const PERM_LABELS_VLADA = [
    ['can_invite', 'Može pozivati'],
    ['can_kick', 'Može izbacivati'],
    ['can_use_safe', 'Može koristiti sef'],
    ['can_manage_ranks', 'Može spuštati/dizati rankove'],
    ['can_manage_salaries', 'Može menjati plate'],
    ['can_manage_database', 'Može pristupati bazi podataka građana'],
    ['can_manage_documents', 'Može izdavati zvanična dokumenta'],
    ['can_view_requests', 'Može pregledati zahteve'],
    ['can_manage_requests', 'Može odobravati/odbijati zahteve']
  ];

  // Policija: sve dozvole iz flamingo_policija (server proverava svaku akciju)
  const PERM_LABELS_POLICIJA = [
    ['mdt', 'MDT (tablet)'], ['ids', 'Legitimisanje i dozvole'], ['restrain', 'Lisice i vezivanje'], ['search', 'Pretres'],
    ['escort', 'Eskort'], ['vehicle.inout', 'Stavljanje/vađenje iz vozila'], ['ticket', 'Pisanje kazni'], ['dispatch', 'Dispatch pozivi'],
    ['panic', 'PANIC dugme'], ['dosije.view', 'Pregled dosijea'], ['vehicle.check', 'Provera vozila'], ['wanted.view', 'Pregled wanted liste'],
    ['armory.basic', 'Oružarnica - osnovno'], ['garage.basic', 'Garaža - patrolna vozila'],
    ['seize', 'Zaplena predmeta'], ['detain', 'Privođenje / puštanje'], ['wanted.set', 'Postavljanje wanted-a'], ['case.create', 'Otvaranje predmeta'],
    ['dosije.note', 'Upis u dosije'], ['vehicle.stolen', 'Prijava ukradenog vozila'], ['evidence.view', 'Magacin dokaza (pregled)'],
    ['arrest', 'Hapšenje (zatvor)'], ['vehicle.impound', 'Zaplena vozila (impound)'], ['armory.patrol', 'Oružarnica - sačmara'],
    ['ticket.void', 'Poništavanje kazni'], ['case.edit', 'Izmena učesnika predmeta'], ['garage.special', 'Garaža - specijalna vozila'],
    ['wanted.clear', 'Skidanje wanted-a'], ['warrant.create', 'Izdavanje poternica'], ['case.manage', 'Status predmeta / DOJ'],
    ['officers.view', 'Pregled svih policajaca'], ['license.manage', 'Suspenzija/oduzimanje dozvola'], ['evidence.return', 'Vraćanje dokaza'],
    ['vehicle.clearstolen', 'Skidanje oznake "ukradeno"'], ['prison.release', 'Prevremeno puštanje iz zatvora'],
    ['warrant.cancel', 'Otkazivanje poternica'], ['logs.view', 'Pregled logova'], ['armory.tactical', 'Oružarnica - taktičko oružje'],
    ['dispatch.manage', 'Upravljanje dispatch-om'], ['garage.command', 'Garaža - komandna vozila i heli'], ['evidence.destroy', 'Uništavanje dokaza'],
    ['boss.hire', 'Zapošljavanje'], ['boss.fire', 'Otpuštanje'], ['boss.promote', 'Unapređenje / degradiranje'],
    ['boss.salary', 'Menjanje plata'], ['boss.menu', 'Postavke organizacije'], ['boss.safe', 'Podizanje iz sefa'],
    ['boss.announce', 'Slanje obaveštenja'], ['boss.ranks', 'Upravljanje rankovima i dozvolama'],
    ['roadblock', 'Blokade puta (spike trake, barijere)'], ['radar', 'Radar za brzinu'],
    ['prison.transport', 'Prevoz zatvorenika (predaja zatvoru)'], ['garage.boat', 'Čamci']
  ];

  const PERM_LABELS_FIB = PERM_LABELS_POLICIJA.filter(([k]) => k !== 'ticket').concat([
    ['fib.ops', 'FIB operacije'], ['clearance.1', 'Tajnost: Poverljivo'], ['clearance.2', 'Tajnost: Tajno'], ['clearance.3', 'Tajnost: Strogo poverljivo'],
    ['fib.takeover', 'Preuzimanje PD predmeta'], ['fib.lab', 'Laboratorija'], ['fib.undercover', 'Undercover režim'],
    ['fib.surveillance.request', 'Zahtev za nalog / GPS tracker'], ['fib.surveillance.approve', 'Odobravanje naloga'],
    ['fib.informants', 'Informanti'], ['fib.informants.identity', 'Prava imena informanata'], ['fib.informants.pay', 'Isplate informantima'],
    ['fib.ia', 'Unutrašnja kontrola'], ['fib.ia.suspend', 'Suspenzija službenika']
  ]);

  const PERM_LABELS_ALL = orgType === 'fib' ? PERM_LABELS_FIB : (orgType === 'policija' || orgType === 'sheriff') ? PERM_LABELS_POLICIJA : (orgType === 'vlada' ? PERM_LABELS_VLADA : PERM_LABELS_HOSPITAL);
  // Policija/FIB/Sheriff: prikazuju se samo dozvole koje ta agencija stvarno koristi
  const isAgencyOrg = ['policija', 'fib', 'sheriff'].includes(orgType);
  const PERM_LABELS = isAgencyOrg && orgRanksList.length ? PERM_LABELS_ALL.filter(([k]) => k in orgRanksList[0]) : PERM_LABELS_ALL;

  const rows = orgRanksList.map(r => `
    <div class="fl-org-rank-card">
      <div class="fl-org-rank-head">
        <input type="text" class="fl-input fl-org-rank-label" value="${escapeHtml(r.label)}" data-grade="${r.grade}">${r.locked ? '<span class="fl-org-hint" style="margin:0 8px;white-space:nowrap"><i class="fa-solid fa-lock"></i> sve dozvole</span>' : ''}
        <button class="fl-btn-secondary fl-org-rank-save-label" data-grade="${r.grade}"><i class="fa-solid fa-floppy-disk"></i></button>
      </div>
      <div class="fl-org-rank-perms">
        ${PERM_LABELS.map(([key, label]) => `
          <label class="fl-org-check"><input type="checkbox" class="fl-org-perm" data-perm="${key}" data-grade="${r.grade}" ${r[key] ? 'checked' : ''} ${r.locked ? 'disabled' : ''}> ${label}</label>
        `).join('')}
      </div>
    </div>
  `).join('');

  el.innerHTML = `
    <h2 class="fl-org-section-title"><i class="fa-solid fa-ranking-star"></i> Rankovi i permisije</h2>
    <div class="fl-org-rank-list">${rows}</div>
  `;

  el.querySelectorAll('.fl-org-rank-save-label').forEach(btn => {
    btn.addEventListener('click', () => {
      const grade = parseInt(btn.dataset.grade, 10);
      const input = el.querySelector(`.fl-org-rank-label[data-grade="${grade}"]`);
      orgPost('orgSetRankLabel', { grade, label: input.value });
      const rank = orgRanksList.find(r => r.grade === grade);
      if (rank) rank.label = input.value;
    });
  });

  el.querySelectorAll('.fl-org-perm').forEach(cb => {
    cb.addEventListener('change', () => {
      const grade = parseInt(cb.dataset.grade, 10);
      const rank = orgRanksList.find(r => r.grade === grade);
      if (!rank) return;
      rank[cb.dataset.perm] = cb.checked;
      const perms = {};
      PERM_LABELS.forEach(([key]) => { perms[key] = !!rank[key]; });
      orgPost('orgSetRankPermissions', { grade, perms });
    });
  });
}

// ---- 3) PLATE ----
function renderOrgSalaries(el) {
  if (orgRanksList === null) {
    el.innerHTML = `<div class="fl-org-loading"><i class="fa-solid fa-spinner fa-spin"></i> Učitavanje...</div>`;
    orgPost('orgGetRanks');
    return;
  }
  if (orgSettingsData === null) {
    orgPost('orgGetSettings');
  }

  const rows = orgRanksList.map(r => `
    <div class="fl-org-salary-row">
      <span class="fl-org-salary-label">${escapeHtml(r.label)}</span>
      <div class="fl-org-salary-input-wrap">$ <input type="number" min="0" class="fl-input fl-org-salary-input" value="${r.salary}" data-grade="${r.grade}"></div>
      <button class="fl-btn-secondary fl-org-salary-save" data-grade="${r.grade}"><i class="fa-solid fa-floppy-disk"></i></button>
    </div>
  `).join('');

  el.innerHTML = `
    <h2 class="fl-org-section-title"><i class="fa-solid fa-money-bill-wave"></i> Plate po rangu</h2>
    <label class="fl-org-toggle-row">
      <span>Plate uključene</span>
      <input type="checkbox" id="orgSalariesToggle" ${orgSettingsData && orgSettingsData.salaries_enabled ? 'checked' : ''}>
    </label>
    <div class="fl-org-salary-list">${rows}</div>
  `;

  const toggle = document.getElementById('orgSalariesToggle');
  toggle.addEventListener('change', () => {
    orgPost('orgToggleSalaries', { enabled: toggle.checked });
    if (orgSettingsData) orgSettingsData.salaries_enabled = toggle.checked ? 1 : 0;
  });

  el.querySelectorAll('.fl-org-salary-save').forEach(btn => {
    btn.addEventListener('click', () => {
      const grade = parseInt(btn.dataset.grade, 10);
      const input = el.querySelector(`.fl-org-salary-input[data-grade="${grade}"]`);
      const salary = parseInt(input.value, 10) || 0;
      orgPost('orgSetSalary', { grade, salary });
      const rank = orgRanksList.find(r => r.grade === grade);
      if (rank) rank.salary = salary;
    });
  });
}

// ---- 4) SEF ----
function renderOrgSafe(el) {
  if (orgSafeData === null) {
    el.innerHTML = `<div class="fl-org-loading"><i class="fa-solid fa-spinner fa-spin"></i> Učitavanje sefa...</div>`;
    orgPost('orgGetSafe');
    return;
  }

  const logsHtml = (orgSafeData.logs || []).map(l => `
    <div class="fl-org-log-row">
      <i class="fa-solid ${l.action === 'safe_deposit' ? 'fa-arrow-down fl-org-green' : 'fa-arrow-up fl-org-red'}"></i>
      <span>${escapeHtml(l.actor_name || '?')} - ${l.action === 'safe_deposit' ? 'uplatio' : 'podigao'} ${escapeHtml(l.detail || '')}</span>
      <span class="fl-org-log-time">${escapeHtml(l.created_at || '')}</span>
    </div>
  `).join('') || `<div class="fl-org-empty">Nema transakcija.</div>`;

  el.innerHTML = `
    <h2 class="fl-org-section-title"><i class="fa-solid fa-vault"></i> Organizacijski sef</h2>
    <div class="fl-org-safe-balance">$${(orgSafeData.balance || 0).toLocaleString('sr-RS')}</div>
    <div class="fl-org-safe-actions">
      <input type="number" min="1" class="fl-input" id="orgSafeAmount" placeholder="Iznos">
      <button class="fl-btn-primary" id="orgSafeDepositBtn"><i class="fa-solid fa-plus"></i> Uplati</button>
      <button class="fl-btn-secondary" id="orgSafeWithdrawBtn"><i class="fa-solid fa-minus"></i> Podigni</button>
    </div>
    <h3 class="fl-org-subtitle">Poslednje transakcije</h3>
    <div class="fl-org-log-list">${logsHtml}</div>
  `;

  document.getElementById('orgSafeDepositBtn').addEventListener('click', () => {
    const amount = parseInt(document.getElementById('orgSafeAmount').value, 10);
    if (!amount || amount < 1) return;
    orgPost('orgSafeDeposit', { amount });
    orgSafeData = null;
    setTimeout(() => { if (activeOrgTab === 'sef') orgPost('orgGetSafe'); }, 400);
    renderOrgSafe(el);
  });

  document.getElementById('orgSafeWithdrawBtn').addEventListener('click', () => {
    const amount = parseInt(document.getElementById('orgSafeAmount').value, 10);
    if (!amount || amount < 1) return;
    orgPost('orgSafeWithdraw', { amount });
    orgSafeData = null;
    setTimeout(() => { if (activeOrgTab === 'sef') orgPost('orgGetSafe'); }, 400);
    renderOrgSafe(el);
  });
}

// ---- 6) POSTAVKE ----
function renderOrgSettings(el) {
  if (orgSettingsData === null) {
    el.innerHTML = `<div class="fl-org-loading"><i class="fa-solid fa-spinner fa-spin"></i> Učitavanje postavki...</div>`;
    orgPost('orgGetSettings');
    return;
  }

  el.innerHTML = `
    <h2 class="fl-org-section-title"><i class="fa-solid fa-gear"></i> Postavke organizacije</h2>
    <label class="fl-org-field-label">Naziv organizacije</label>
    <input type="text" class="fl-input" id="orgNameInput" value="${escapeHtml(orgSettingsData.org_name || '')}">
    <label class="fl-org-field-label">Kratak opis (vidljiv svim članovima u "Informacije")</label>
    <textarea class="fl-input fl-org-announce-textarea" id="orgDescInput" maxlength="500">${escapeHtml(orgSettingsData.description || '')}</textarea>
    <label class="fl-org-field-label">Pravila organizacije</label>
    <textarea class="fl-input fl-org-announce-textarea" id="orgRulesInput">${escapeHtml(orgSettingsData.rules || '')}</textarea>
    <button class="fl-btn-primary" id="orgSaveSettingsBtn"><i class="fa-solid fa-floppy-disk"></i> Sačuvaj postavke</button>
  `;

  document.getElementById('orgSaveSettingsBtn').addEventListener('click', () => {
    const payload = {
      org_name: document.getElementById('orgNameInput').value,
      description: document.getElementById('orgDescInput').value,
      rules: document.getElementById('orgRulesInput').value
    };
    orgPost('orgSetSettings', payload);
    Object.assign(orgSettingsData, payload);
  });
}

// ---- 7) LOGOVI ----
function renderOrgLogs(el) {
  if (orgLogsList === null) {
    el.innerHTML = `<div class="fl-org-loading"><i class="fa-solid fa-spinner fa-spin"></i> Učitavanje logova...</div>`;
    orgPost('orgGetLogs');
    return;
  }

  const rows = orgLogsList.map(l => `
    <div class="fl-org-log-row">
      <i class="fa-solid fa-clock-rotate-left"></i>
      <span><b>${escapeHtml(l.actor_name || '?')}</b> - ${escapeHtml(ORG_LOG_LABELS[l.action] || l.action)}${l.target_name ? ' - ' + escapeHtml(l.target_name) : ''}${l.detail ? ' (' + escapeHtml(l.detail) + ')' : ''}</span>
      <span class="fl-org-log-time">${escapeHtml(l.created_at || '')}</span>
    </div>
  `).join('') || `<div class="fl-org-empty">Nema logova.</div>`;

  el.innerHTML = `
    <h2 class="fl-org-section-title"><i class="fa-solid fa-clipboard-list"></i> Logovi organizacije</h2>
    <div class="fl-org-log-list">${rows}</div>
  `;
}

// ---- 8) OBAVEŠTENJE ----
function renderOrgAnnounce(el) {
  el.innerHTML = `
    <h2 class="fl-org-section-title"><i class="fa-solid fa-bullhorn"></i> Obaveštenje organizaciji</h2>
    <p class="fl-org-hint">Poruka stiže odmah svim online članovima i ostaje trajno vidljiva u njihovom tabu "Obaveštenja".</p>
    <label class="fl-org-field-label">Naslov</label>
    <input type="text" class="fl-input" id="orgAnnounceTitle" maxlength="100" placeholder="Sastanak organizacije">
    <label class="fl-org-field-label">Tekst</label>
    <textarea class="fl-input fl-org-announce-textarea" id="orgAnnounceText" maxlength="500" placeholder="Večeras u 22:00 sastanak svih članova."></textarea>
    <button class="fl-btn-primary" id="orgAnnounceSendBtn"><i class="fa-solid fa-paper-plane"></i> Pošalji obaveštenje</button>
  `;

  document.getElementById('orgAnnounceSendBtn').addEventListener('click', () => {
    const title = document.getElementById('orgAnnounceTitle').value.trim();
    const text = document.getElementById('orgAnnounceText').value.trim();
    if (!text) return;
    orgPost('orgAnnounce', { title, message: text });
    document.getElementById('orgAnnounceTitle').value = '';
    document.getElementById('orgAnnounceText').value = '';
  });
}

// ============================================================
// ZAHTEVI (Vlada + Ambulanta) - tab u aplikaciji Organizacija (Lider + Članovi)
//
// Sav sadržaj dolazi sa servera (flamingo_vlada/requests/server.lua).
// Tablet samo prikazuje i šalje ono što korisnik unese (id, tekst, razlog,
// iznos). Prava, status, podnosioca i organizaciju određuje ISKLJUČIVO
// server - dugmad koja se ovde sakriju/prikažu služe samo za prikaz.
// ============================================================

const ORG_TAB_ZAHTEVI = { id: 'zahtevi', label: 'Zahtevi', sub: 'Zahtevi upućeni Vladi', icon: 'fa-file-signature' };

const REQ_STATUS_META = {
  pending:   { label: 'Na čekanju', icon: 'fa-hourglass-half', cls: 'pending' },
  approved:  { label: 'Odobreno',   icon: 'fa-circle-check',   cls: 'approved' },
  rejected:  { label: 'Odbijeno',   icon: 'fa-circle-xmark',   cls: 'rejected' },
  cancelled: { label: 'Otkazano',   icon: 'fa-ban',            cls: 'cancelled' }
};

const REQ_FILTERS = ['pending', 'approved', 'rejected', 'cancelled', 'all'];

const REQ_HISTORY_META = {
  created:   { label: 'Zahtev kreiran',   icon: 'fa-file-circle-plus', cls: 'created' },
  reviewed:  { label: 'Zahtev pregledan', icon: 'fa-eye',              cls: 'reviewed' },
  approved:  { label: 'Zahtev odobren',   icon: 'fa-circle-check',     cls: 'approved' },
  rejected:  { label: 'Zahtev odbijen',   icon: 'fa-circle-xmark',     cls: 'rejected' },
  cancelled: { label: 'Zahtev otkazan',   icon: 'fa-ban',              cls: 'cancelled' }
};

const reqState = { filter: 'pending', scope: null, data: null, token: 0, busy: false };

function reqResetState() {
  reqState.filter = 'pending';
  reqState.scope = null;
  reqState.data = null;
  reqState.token++;
  reqState.busy = false;
}

// Escape koji pokriva i navodnike (koristi se i u atributima).
function reqEsc(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function reqMoney(n) {
  return '$' + Number(n || 0).toLocaleString('en-US');
}

function reqIsActiveTab() {
  return (currentCategory === 'organizacija' && activeOrgTab === 'zahtevi')
    || (currentCategory === 'orgmembers' && activeOrgMemberTab === 'zahtevi');
}

function reqContentEl() {
  return document.getElementById(currentCategory === 'organizacija' ? 'orgMainContent' : 'orgmMainContent');
}

// Učitava listu sa servera (filter + opseg), pa ponovo iscrtava tab ako je i dalje otvoren.
function reqLoad() {
  const token = ++reqState.token;

  postAsync('req:list', { filter: reqState.filter, scope: reqState.scope }).then(res => {
    if (token !== reqState.token) return; // stigao je noviji zahtev, ovaj odgovor se ignoriše

    if (res && res.ok) {
      reqState.data = res;
      reqState.scope = res.scope;
      reqState.filter = res.filter;
    } else {
      reqState.data = { ok: false, error: (res && res.error) || 'Greška pri učitavanju zahteva.' };
    }

    if (reqIsActiveTab()) reqRender();
  });
}

function renderOrgRequests(el) {
  if (reqState.data === null) {
    el.innerHTML = `<div class="fl-org-loading"><i class="fa-solid fa-spinner fa-spin"></i> Učitavanje zahteva...</div>`;
    reqLoad();
    return;
  }
  reqRender();
}

function reqRender() {
  const el = reqContentEl();
  if (!el) return;

  const d = reqState.data;

  if (!d || !d.ok) {
    el.innerHTML = `
      <h2 class="fl-org-section-title"><i class="fa-solid fa-file-signature"></i> Zahtevi</h2>
      <div class="fl-org-empty">${reqEsc((d && d.error) || 'Zahtevi trenutno nisu dostupni.')}</div>
    `;
    return;
  }

  const counts = d.counts || {};
  const total = Object.values(counts).reduce((sum, n) => sum + (Number(n) || 0), 0);
  const canView = !!(d.access && d.access.canView);
  const canSubmit = (d.types || []).length > 0;

  const chips = REQ_FILTERS.map(f => {
    const label = f === 'all' ? 'Sve' : REQ_STATUS_META[f].label;
    const n = f === 'all' ? total : (Number(counts[f]) || 0);
    return `<button class="fl-req-chip ${reqState.filter === f ? 'active' : ''}" data-req-filter="${f}">${label} <span>${n}</span></button>`;
  }).join('');

  const scopeHtml = canView ? `
    <div class="fl-req-scope">
      <button class="fl-req-chip ${d.scope === 'all' ? 'active' : ''}" data-req-scope="all"><i class="fa-solid fa-landmark"></i> Svi zahtevi</button>
      <button class="fl-req-chip ${d.scope === 'mine' ? 'active' : ''}" data-req-scope="mine"><i class="fa-solid fa-user"></i> Moji zahtevi</button>
    </div>
  ` : '';

  const rows = (d.requests || []).map(r => {
    const meta = REQ_STATUS_META[r.status] || REQ_STATUS_META.pending;
    return `
      <div class="fl-req-row" data-req-id="${Number(r.id)}">
        <div class="fl-req-row-icon ${meta.cls}"><i class="fa-solid ${meta.icon}"></i></div>
        <div class="fl-req-row-info">
          <span class="fl-req-row-title">${reqEsc(r.title)}</span>
          <span class="fl-req-row-sub">#${Number(r.id)} · ${reqEsc(r.typeLabel)} · ${reqEsc(r.submitterName)} · ${reqEsc(r.createdAt)}</span>
        </div>
        <div class="fl-req-row-right">
          ${Number(r.amount) > 0 ? `<span class="fl-req-amount">${reqMoney(r.amount)}</span>` : ''}
          <span class="fl-req-badge ${meta.cls}">${meta.label}</span>
        </div>
        <i class="fa-solid fa-chevron-right fl-org-member-chevron"></i>
      </div>
    `;
  }).join('') || `<div class="fl-org-empty">Nema zahteva u ovoj kategoriji.</div>`;

  el.innerHTML = `
    <div class="fl-req-head">
      <h2 class="fl-org-section-title"><i class="fa-solid fa-file-signature"></i> Zahtevi</h2>
      ${canSubmit ? `<button class="fl-btn-primary fl-req-new" id="reqNewBtn"><i class="fa-solid fa-plus"></i> Novi zahtev</button>` : ''}
    </div>
    ${scopeHtml}
    <div class="fl-req-chips">${chips}</div>
    <div class="fl-req-list">${rows}</div>
  `;

  el.querySelectorAll('[data-req-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      reqState.filter = btn.dataset.reqFilter;
      reqLoad();
    });
  });

  el.querySelectorAll('[data-req-scope]').forEach(btn => {
    btn.addEventListener('click', () => {
      reqState.scope = btn.dataset.reqScope;
      reqLoad();
    });
  });

  el.querySelectorAll('.fl-req-row').forEach(row => {
    row.addEventListener('click', () => reqOpenDetail(parseInt(row.dataset.reqId, 10)));
  });

  const newBtn = document.getElementById('reqNewBtn');
  if (newBtn) newBtn.addEventListener('click', reqOpenCreate);
}

// ---- Overlay pomoćne funkcije ----
let reqOverlay = null;

function reqCloseOverlay() {
  if (reqOverlay) reqOverlay.remove();
  reqOverlay = null;
}

function reqMakeOverlay(innerHtml) {
  reqCloseOverlay();

  const overlay = document.createElement('div');
  overlay.className = 'fl-crate-overlay fl-org-member-overlay';
  overlay.innerHTML = `
    <div class="fl-org-member-panel fl-req-panel">
      <button class="fl-crate-detail-close fl-org-member-panel-close"><i class="fa-solid fa-xmark"></i></button>
      ${innerHtml}
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.querySelector('.fl-org-member-panel-close').addEventListener('click', reqCloseOverlay);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) reqCloseOverlay(); });

  reqOverlay = overlay;
  return overlay;
}

// Dvostepna potvrda na dugmetu (prvi klik = "Potvrdi?", drugi klik = izvrši).
function reqConfirmButton(btn, confirmHtml, onConfirm) {
  const originalHtml = btn.innerHTML;
  let confirming = false;
  let timer = null;

  btn.addEventListener('click', () => {
    if (!confirming) {
      confirming = true;
      btn.innerHTML = confirmHtml;
      btn.classList.add('confirming');
      timer = setTimeout(() => {
        confirming = false;
        btn.innerHTML = originalHtml;
        btn.classList.remove('confirming');
      }, 4000);
      return;
    }
    clearTimeout(timer);
    onConfirm();
  });
}

// Šalje akciju serveru; server odlučuje da li je dozvoljena.
function reqRunAction(route, payload, successMessage) {
  if (reqState.busy) return;
  reqState.busy = true;

  postAsync(route, payload).then(res => {
    reqState.busy = false;

    if (res && res.ok) {
      showToast(reqEsc(successMessage), 'success');
      reqCloseOverlay();
    } else {
      showToast(reqEsc((res && res.error) || 'Akcija nije uspela.'), 'error');
    }

    reqLoad();
  });
}

// ---- Detalji zahteva ----
function reqOpenDetail(id) {
  if (!id) return;

  postAsync('req:get', { id }).then(res => {
    if (!res || !res.ok) {
      showToast(reqEsc((res && res.error) || 'Zahtev nije dostupan.'), 'error');
      reqLoad();
      return;
    }
    reqShowDetail(res);
  });
}

function reqShowDetail(res) {
  const r = res.request;
  const meta = REQ_STATUS_META[r.status] || REQ_STATUS_META.pending;
  const resolverLabel = { approved: 'Odobrio', rejected: 'Odbio', cancelled: 'Otkazao' }[r.status];
  const limits = (reqState.data && reqState.data.limits) || {};

  const fields = [
    ['ID zahteva', '#' + Number(r.id)],
    ['Tip', r.typeLabel],
    ['Podnosilac', r.submitterName],
    ['Organizacija', r.submitterOrg],
    ['Podnet', r.createdAt]
  ];
  if (Number(r.amount) > 0) fields.push(['Iznos', reqMoney(r.amount)]);
  if (resolverLabel && r.resolvedByName) {
    fields.push([resolverLabel, r.resolvedByName]);
    if (r.resolvedAt) fields.push(['Datum obrade', r.resolvedAt]);
  }

  const fieldsHtml = fields.map(([label, value]) => `
    <div class="fl-req-field">
      <span class="fl-req-field-label">${reqEsc(label)}</span>
      <span class="fl-req-field-value">${reqEsc(value)}</span>
    </div>
  `).join('');

  const rejectHtml = r.rejectReason ? `
    <div class="fl-req-reason">
      <span class="fl-org-member-panel-label">Razlog odbijanja</span>
      <p>${reqEsc(r.rejectReason).replace(/\n/g, '<br>')}</p>
    </div>
  ` : '';

  const historyHtml = (res.history || []).map(h => {
    const hm = REQ_HISTORY_META[h.action] || { label: h.action, icon: 'fa-clock-rotate-left', cls: 'reviewed' };
    return `
      <div class="fl-req-tl-item ${hm.cls}">
        <div class="fl-req-tl-dot"><i class="fa-solid ${hm.icon}"></i></div>
        <div class="fl-req-tl-text">
          <span class="fl-req-tl-title">${reqEsc(hm.label)}</span>
          <span class="fl-req-tl-sub">${reqEsc(h.actorName)}${h.actorJob ? ' · ' + reqEsc(h.actorJob) : ''} · ${reqEsc(h.at)}</span>
          ${h.note ? `<span class="fl-req-tl-note">${reqEsc(h.note)}</span>` : ''}
        </div>
      </div>
    `;
  }).join('');

  const canDecide = !!(res.canApprove && res.canReject);

  const actionsHtml = `
    ${canDecide ? `
      <div class="fl-req-actions">
        <button class="fl-btn-primary" id="reqApproveBtn"><i class="fa-solid fa-circle-check"></i> Odobri</button>
        <button class="fl-btn-danger" id="reqRejectToggleBtn"><i class="fa-solid fa-circle-xmark"></i> Odbij</button>
      </div>
      <div class="fl-req-reject-box hidden" id="reqRejectBox">
        <label class="fl-org-field-label">Razlog odbijanja</label>
        <textarea class="fl-input fl-org-announce-textarea" id="reqRejectReason" maxlength="${Number(limits.reasonMax) || 300}" placeholder="Zašto se zahtev odbija?"></textarea>
        <button class="fl-btn-danger" id="reqRejectConfirmBtn"><i class="fa-solid fa-paper-plane"></i> Potvrdi odbijanje</button>
      </div>
    ` : ''}
    ${res.canCancel ? `
      <div class="fl-req-actions">
        <button class="fl-btn-danger" id="reqCancelBtn"><i class="fa-solid fa-ban"></i> Otkaži zahtev</button>
      </div>
    ` : ''}
  `;

  const overlay = reqMakeOverlay(`
    <div class="fl-req-detail-head">
      <h3>${reqEsc(r.title)}</h3>
      <span class="fl-req-badge ${meta.cls}"><i class="fa-solid ${meta.icon}"></i> ${meta.label}</span>
    </div>
    <div class="fl-req-fields">${fieldsHtml}</div>
    <div class="fl-req-desc">
      <span class="fl-org-member-panel-label">Opis / obrazloženje</span>
      <p>${reqEsc(r.description).replace(/\n/g, '<br>')}</p>
    </div>
    ${rejectHtml}
    <div class="fl-req-history">
      <span class="fl-org-member-panel-label">Istorija</span>
      <div class="fl-req-timeline">${historyHtml || '<div class="fl-org-empty">Nema zapisa.</div>'}</div>
    </div>
    ${actionsHtml}
  `);

  const id = Number(r.id);

  const approveBtn = overlay.querySelector('#reqApproveBtn');
  if (approveBtn) {
    reqConfirmButton(approveBtn, '<i class="fa-solid fa-triangle-exclamation"></i> Potvrdi odobravanje?', () => {
      reqRunAction('req:approve', { id }, 'Zahtev je odobren.');
    });
  }

  const rejectToggle = overlay.querySelector('#reqRejectToggleBtn');
  const rejectBox = overlay.querySelector('#reqRejectBox');
  if (rejectToggle && rejectBox) {
    rejectToggle.addEventListener('click', () => {
      rejectBox.classList.toggle('hidden');
      if (!rejectBox.classList.contains('hidden')) overlay.querySelector('#reqRejectReason').focus();
    });

    overlay.querySelector('#reqRejectConfirmBtn').addEventListener('click', () => {
      const reason = overlay.querySelector('#reqRejectReason').value.trim();
      const minLen = Number(limits.reasonMin) || 5;
      if (reason.length < minLen) {
        showToast(`Razlog odbijanja mora imati najmanje ${minLen} karaktera.`, 'error');
        return;
      }
      reqRunAction('req:reject', { id, reason }, 'Zahtev je odbijen.');
    });
  }

  const cancelBtn = overlay.querySelector('#reqCancelBtn');
  if (cancelBtn) {
    reqConfirmButton(cancelBtn, '<i class="fa-solid fa-triangle-exclamation"></i> Potvrdi otkazivanje?', () => {
      reqRunAction('req:cancel', { id }, 'Zahtev je otkazan.');
    });
  }
}

// ---- Novi zahtev ----
function reqOpenCreate() {
  const d = reqState.data;
  if (!d || !d.ok || !(d.types || []).length) {
    showToast('Nemaš pravo da podneseš zahtev.', 'error');
    return;
  }

  const limits = d.limits || {};
  const typeOptions = d.types.map(t => `<option value="${reqEsc(t.name)}">${reqEsc(t.label)}</option>`).join('');

  const overlay = reqMakeOverlay(`
    <div class="fl-req-detail-head">
      <h3>Novi zahtev</h3>
    </div>
    <div class="fl-org-member-panel-body">
      <label class="fl-org-field-label">Tip zahteva</label>
      <select class="fl-input" id="reqCreateType">${typeOptions}</select>
      <p class="fl-org-hint" id="reqCreateTypeHint"></p>

      <label class="fl-org-field-label">Naslov</label>
      <input type="text" class="fl-input" id="reqCreateTitle" maxlength="${Number(limits.titleMax) || 100}" placeholder="Kratak naslov zahteva">

      <label class="fl-org-field-label">Opis / obrazloženje</label>
      <textarea class="fl-input fl-org-announce-textarea" id="reqCreateDesc" maxlength="${Number(limits.descriptionMax) || 1000}" placeholder="Objasni šta tražiš i zašto."></textarea>

      <div id="reqCreateAmountWrap">
        <label class="fl-org-field-label">Iznos ($)</label>
        <input type="text" inputmode="numeric" class="fl-input" id="reqCreateAmount" placeholder="0">
      </div>

      <button class="fl-btn-primary" id="reqCreateSendBtn"><i class="fa-solid fa-paper-plane"></i> Pošalji zahtev</button>
    </div>
  `);

  const typeSelect = overlay.querySelector('#reqCreateType');
  const hintEl = overlay.querySelector('#reqCreateTypeHint');
  const amountWrap = overlay.querySelector('#reqCreateAmountWrap');
  const amountInput = overlay.querySelector('#reqCreateAmount');

  const applyType = () => {
    const t = d.types.find(x => x.name === typeSelect.value);
    hintEl.textContent = (t && t.description) || '';
    amountWrap.classList.toggle('hidden', !(t && t.amountEnabled));
    if (!(t && t.amountEnabled)) amountInput.value = '';
  };
  typeSelect.addEventListener('change', applyType);
  applyType();

  amountInput.addEventListener('input', () => {
    amountInput.value = amountInput.value.replace(/[^0-9]/g, '');
  });

  overlay.querySelector('#reqCreateSendBtn').addEventListener('click', () => {
    const title = overlay.querySelector('#reqCreateTitle').value.trim();
    const description = overlay.querySelector('#reqCreateDesc').value.trim();

    if (!title || !description) {
      showToast('Popuni naslov i opis zahteva.', 'error');
      return;
    }

    reqRunAction('req:create', {
      type: typeSelect.value,
      title,
      description,
      amount: amountInput.value
    }, 'Zahtev je poslat Vladi.');
  });
}

// Server javlja da se nešto promenilo (novi zahtev, obrada) - osveži listu ako je tab otvoren.
window.addEventListener('message', (event) => {
  const data = event.data;
  if (data && data.action === 'requestsChanged' && reqIsActiveTab() && !reqOverlay) reqLoad();
});

// ---- Rezultati sa servera (flamingo_hospital preko flamingo_mmenu client.lua) ----
window.addEventListener('message', (event) => {
  const data = event.data;

  if (data.action === 'orgMembersResult') {
    orgMembersList = data.members || [];
    if (currentCategory === 'organizacija' && activeOrgTab === 'clanovi') renderOrgTabContent();
    if (currentCategory === 'orgmembers' && activeOrgMemberTab === 'clanovi') renderOrgMemberTabContent();
    if (currentCategory === 'organizacija') renderOrgInfoPanel(true);
    if (currentCategory === 'orgmembers') renderOrgInfoPanel(false);
  }

  if (data.action === 'orgRanksResult') {
    orgRanksList = data.ranks || [];
    if (currentCategory === 'organizacija' && (activeOrgTab === 'rankovi' || activeOrgTab === 'plate')) renderOrgTabContent();
    if (orgMemberPanelOverlay && document.body.contains(orgMemberPanelOverlay) && orgMemberPanelMember) {
      populateOrgMemberGradeSelect(orgMemberPanelOverlay, orgMemberPanelMember);
    }
  }

  if (data.action === 'orgSafeResult') {
    orgSafeData = { balance: data.balance, logs: data.logs };
    if (currentCategory === 'organizacija' && activeOrgTab === 'sef') renderOrgTabContent();
  }

  if (data.action === 'orgSettingsResult') {
    orgSettingsData = data.settings || {};
    if (currentCategory === 'organizacija' && (activeOrgTab === 'postavke' || activeOrgTab === 'plate')) renderOrgTabContent();
    if (currentCategory === 'organizacija') renderOrgInfoPanel(true);
    if (currentCategory === 'orgmembers') renderOrgInfoPanel(false);
  }

  if (data.action === 'orgLogsResult') {
    orgLogsList = data.logs || [];
    if (currentCategory === 'organizacija' && activeOrgTab === 'logovi') renderOrgTabContent();
  }

  if (data.action === 'orgLiStatsResult') {
    orgLiStatsData = data.data || {};
    if (currentCategory === 'orgmembers' && activeOrgMemberTab === 'statistika') renderOrgMemberTabContent();
  }
});

// ============================================================
// ORGANIZACIJA (svi članovi bolnice, bez obzira na čin) - odvojeno od
// boss-only "Lider Organizacije" panela iznad. Isti sidenav vizuelni stil.
// ============================================================

const ORGMEMBER_TABS = [
  { id: 'clanovi',      label: 'Članovi',      sub: 'Ko je u organizaciji i ko je online',    icon: 'fa-users' },
  { id: 'obavestenja',  label: 'Obaveštenja',  sub: 'Poruke lidera i uprave',                 icon: 'fa-bell' },
  { id: 'eventi',       label: 'Eventi',       sub: 'Aktivni i nadolazeći server eventi',      icon: 'fa-calendar-check' },
  { id: 'aktivnosti',   label: 'Aktivnosti',   sub: 'Organizacijske aktivnosti',               icon: 'fa-list-check' },
  { id: 'ranglista',    label: 'Rang Lista',   sub: 'Najaktivniji članovi',                     icon: 'fa-trophy' },
  { id: 'mojprofil',    label: 'Moj Profil',   sub: 'Tvoji podaci i statistika',                icon: 'fa-id-card' }
];
// Napomena: "Informacije" tab je uklonjen jer se sada isti podaci (naziv, br. clanova,
// direktor, opis, pravila) uvek prikazuju u desnom fl-org-info-panel, kao kod lidera.

// Lifeinvader nema evente/aktivnosti/rang listu/profil sistem kao bolnica -
// umesto toga dobija sopstveni "Statistika" tab (koliko je LICNO oglasa
// odobrio + top lista firme, vidi renderOrgMemberStatistika ispod).
const ORGMEMBER_TABS_LIFEINVADER = [
  { id: 'clanovi',     label: 'Članovi',     sub: 'Ko je u organizaciji i ko je online', icon: 'fa-users' },
  { id: 'statistika',  label: 'Statistika',  sub: 'Tvoji oglasi i top zaposleni',         icon: 'fa-chart-line' },
  { id: 'obavestenja', label: 'Obaveštenja', sub: 'Poruke lidera i uprave',               icon: 'fa-bell' }
];

// Policija: bez bolničkih eventa/aktivnosti - rang lista i profil su policijski
const ORGMEMBER_TABS_POLICIJA = [
  { id: 'clanovi',     label: 'Članovi',     sub: 'Ko je u policiji i ko je na dužnosti', icon: 'fa-users' },
  { id: 'obavestenja', label: 'Obaveštenja', sub: 'Poruke komande',                      icon: 'fa-bell' },
  { id: 'ranglista',   label: 'Rang Lista',  sub: 'Najaktivniji u poslednjih 7 dana',    icon: 'fa-trophy' },
  { id: 'mojprofil',   label: 'Moj Profil',  sub: 'Tvoj čin, sati i statistika',         icon: 'fa-id-card' }
];

function getOrgMemberTabs() {
  if (['policija', 'fib', 'sheriff'].includes(orgType)) return ORGMEMBER_TABS_POLICIJA;
  const tabs = orgType === 'lifeinvader' ? ORGMEMBER_TABS_LIFEINVADER : ORGMEMBER_TABS;
  // Tab "Zahtevi" postoji za Vladu (pregled/odobravanje) i za Ambulantu
  // (podnošenje) - odmah posle "Članovi". Ko šta sme da radi u tabu se i
  // dalje odlučuje na serveru (flamingo_vlada/requests).
  if (orgType !== 'vlada' && orgType !== 'hospital') return tabs;
  const withRequests = tabs.slice();
  withRequests.splice(1, 0, ORG_TAB_ZAHTEVI);
  return withRequests;
}

let activeOrgMemberTab = 'clanovi';
let orgAnnouncementsList = null;
let orgMyProfileData = null;
let orgDutyStatsData = null;
let orgLeaderboardList = null;
let orgEventsList = null;
let orgActivitiesList = null;
let orgLiStatsData = null;

function renderOrgMemberHub() {
  const navHtml = getOrgMemberTabs().map(t => `
    <button class="fl-settings-nav-item ${activeOrgMemberTab === t.id ? 'active' : ''}" data-orgm-tab="${t.id}">
      <div class="fl-settings-nav-icon"><i class="fa-solid ${t.icon}"></i></div>
      <div class="fl-settings-nav-text">
        <span class="fl-settings-nav-title">${escapeHtml(t.label.toUpperCase())}</span>
        <span class="fl-settings-nav-sub">${escapeHtml(t.sub)}</span>
      </div>
      <i class="fa-solid fa-chevron-right fl-settings-nav-chevron"></i>
    </button>
  `).join('');

  categoryBody.innerHTML = `
    <div class="fl-org-page-grid">
      <div class="fl-settings-sidenav">${navHtml}</div>
      <div class="fl-settings-main-wrap">
        <div class="fl-settings-main" id="orgmMainContent"></div>
      </div>
      <aside class="fl-org-info-panel" id="orgInfoPanel"></aside>
    </div>
  `;

  categoryBody.querySelectorAll('[data-orgm-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      activeOrgMemberTab = btn.dataset.orgmTab;
      renderOrgMemberHub();
    });
  });

  renderOrgMemberTabContent();
  renderOrgInfoPanel(false);
}

function renderOrgMemberTabContent() {
  const el = document.getElementById('orgmMainContent');
  if (!el) return;

  switch (activeOrgMemberTab) {
    case 'clanovi': renderOrgMemberList(el); break;
    case 'obavestenja': renderOrgMemberAnnouncements(el); break;
    case 'eventi': renderOrgMemberEvents(el); break;
    case 'aktivnosti': renderOrgMemberActivities(el); break;
    case 'ranglista': renderOrgMemberLeaderboard(el); break;
    case 'mojprofil': renderOrgMemberProfile(el); break;
    case 'statistika': renderOrgMemberLiStats(el); break;
    case 'zahtevi': renderOrgRequests(el); break;
  }
}

// ---- STATISTIKA (samo Lifeinvader) - lična statistika odobravanja
// oglasa + top 5 zaposlenih firme. Vidljivo svim zaposlenima, ne samo šefu. ----
function renderOrgMemberLiStats(el) {
  if (orgLiStatsData === null) {
    el.innerHTML = `<div class="fl-org-loading"><i class="fa-solid fa-spinner fa-spin"></i> Učitavanje statistike...</div>`;
    post('orgGetMyStats');
    return;
  }

  const d = orgLiStatsData;
  const price = d.adPrice || {};
  const rows = (d.leaderboard || []).map((m, i) => `
    <div class="fl-orgm-rank-row">
      <span class="fl-orgm-rank-pos ${i < 3 ? 'top' : ''}">#${i + 1}</span>
      <span class="fl-orgm-rank-name">${escapeHtml(m.name || 'Nepoznato')}</span>
      <span class="fl-orgm-rank-total">${m.total} oglasa</span>
    </div>
  `).join('') || `<div class="fl-org-empty">Još uvek nema odobrenih oglasa.</div>`;

  el.innerHTML = `
    <h2 class="fl-org-section-title"><i class="fa-solid fa-chart-line"></i> Tvoja statistika</h2>
    <div class="fl-orgm-stats-row">
      <div class="fl-orgm-stat-box"><span class="fl-orgm-stat-num fl-org-green">${d.myApprovedCount}</span><span class="fl-orgm-stat-label">Ti si odobrio/la</span></div>
      <div class="fl-orgm-stat-box"><span class="fl-orgm-stat-num">${d.orgApprovedTotal}</span><span class="fl-orgm-stat-label">Ukupno objavljeno</span></div>
      <div class="fl-orgm-stat-box"><span class="fl-orgm-stat-num">${d.orgPendingTotal}</span><span class="fl-orgm-stat-label">Čeka odobrenje</span></div>
    </div>
    ${price.total ? `<p class="fl-org-hint"><i class="fa-solid fa-circle-info"></i> Građanin plati ${(price.total).toLocaleString('sr-RS')}$ po oglasu · ${(price.safeCut).toLocaleString('sr-RS')}$ ide u sef · zaposleni koji odobri dobija ${(price.staffBonus).toLocaleString('sr-RS')}$ na sledeću platu.</p>` : ''}
    <h3 class="fl-org-subtitle">Top 5 zaposlenih (po odobrenim oglasima)</h3>
    <div class="fl-orgm-rank-list">${rows}</div>
  `;
}

// ---- 1) ČLANOVI (isti podaci kao boss tab, ali samo za pregled) ----
function renderOrgMemberList(el) {
  if (orgMembersList === null) {
    el.innerHTML = `<div class="fl-org-loading"><i class="fa-solid fa-spinner fa-spin"></i> Učitavanje članova...</div>`;
    orgPost('orgGetMembers');
    return;
  }

  const total = orgMembersList.length;
  const onlineCount = orgMembersList.filter(m => m.online).length;

  const rows = orgMembersList.map(m => `
    <div class="fl-org-member-row">
      <div class="fl-org-member-avatar">
        ${escapeHtml((m.name || '?').trim().charAt(0).toUpperCase())}
        <div class="fl-org-member-status ${m.online ? 'online' : 'offline'}"></div>
      </div>
      <div class="fl-org-member-info">
        <span class="fl-org-member-name">${escapeHtml(m.name)}</span>
        <span class="fl-org-member-sub">${escapeHtml(m.gradeLabel || ('Rank ' + m.grade))}</span>
      </div>
      <span class="fl-org-member-badge ${m.online ? 'online' : 'offline'}">${m.online ? 'Online' : 'Offline'}</span>
    </div>
  `).join('') || `<div class="fl-org-empty">Nema članova.</div>`;

  el.innerHTML = `
    <h2 class="fl-org-section-title"><i class="fa-solid fa-users"></i> Članovi organizacije</h2>
    <div class="fl-orgm-stats-row">
      <div class="fl-orgm-stat-box"><span class="fl-orgm-stat-num">${total}</span><span class="fl-orgm-stat-label">Ukupno članova</span></div>
      <div class="fl-orgm-stat-box"><span class="fl-orgm-stat-num fl-org-green">${onlineCount}</span><span class="fl-orgm-stat-label">Trenutno online</span></div>
    </div>
    <div class="fl-org-member-list">${rows}</div>
  `;
}

// ---- 2) OBAVEŠTENJA ----
function renderOrgMemberAnnouncements(el) {
  if (orgAnnouncementsList === null) {
    el.innerHTML = `<div class="fl-org-loading"><i class="fa-solid fa-spinner fa-spin"></i> Učitavanje obaveštenja...</div>`;
    orgPost('orgGetAnnouncements');
    return;
  }

  const lastRead = orgAnnouncementsList.lastRead ? new Date(orgAnnouncementsList.lastRead).getTime() : 0;
  const items = orgAnnouncementsList.list || [];

  const rows = items.map(a => {
    const isNew = a.created_at && new Date(a.created_at).getTime() > lastRead;
    return `
      <div class="fl-orgm-announce-card ${isNew ? 'new' : ''}">
        ${isNew ? '<span class="fl-orgm-new-badge">NOVO</span>' : ''}
        <div class="fl-orgm-announce-title">${escapeHtml(a.title)}</div>
        <div class="fl-orgm-announce-text">${escapeHtml(a.message)}</div>
        <div class="fl-orgm-announce-meta">${escapeHtml(a.author_name || '')} · ${escapeHtml(a.created_at || '')}</div>
      </div>
    `;
  }).join('') || `<div class="fl-org-empty">Trenutno nema obaveštenja.</div>`;

  el.innerHTML = `
    <h2 class="fl-org-section-title"><i class="fa-solid fa-bell"></i> Obaveštenja organizacije</h2>
    <div class="fl-orgm-announce-list">${rows}</div>
  `;

  // Označi kao pročitano čim uđe u tab
  orgPost('orgMarkAnnouncementsRead');
}

// ---- 3) EVENTI ----
function renderOrgMemberEvents(el) {
  if (orgEventsList === null) {
    el.innerHTML = `<div class="fl-org-loading"><i class="fa-solid fa-spinner fa-spin"></i> Učitavanje eventa...</div>`;
    orgPost('orgGetEvents');
    return;
  }

  if (orgEventsList.length === 0) {
    el.innerHTML = `
      <h2 class="fl-org-section-title"><i class="fa-solid fa-calendar-check"></i> Eventi</h2>
      <div class="fl-org-empty">Trenutno nema aktivnih ili nadolazećih eventa.</div>
    `;
    return;
  }

  const rows = orgEventsList.map(ev => `
    <div class="fl-orgm-event-card">
      <div class="fl-orgm-event-head">
        <span class="fl-orgm-event-title">${escapeHtml(ev.title)}</span>
        <span class="fl-orgm-event-status fl-orgm-status-${escapeHtml(ev.status || 'upcoming')}">${escapeHtml(ev.status === 'active' ? 'Aktivan' : 'Nadolazeći')}</span>
      </div>
      ${ev.description ? `<p class="fl-orgm-event-desc">${escapeHtml(ev.description)}</p>` : ''}
      <div class="fl-orgm-event-meta">
        <span><i class="fa-solid fa-clock"></i> ${escapeHtml(ev.start_at || '')}</span>
        ${ev.location ? `<span><i class="fa-solid fa-location-dot"></i> ${escapeHtml(ev.location)}</span>` : ''}
        ${ev.reward ? `<span><i class="fa-solid fa-gift"></i> ${escapeHtml(ev.reward)}</span>` : ''}
      </div>
      ${ev.signup_enabled ? `
        <div class="fl-orgm-event-footer">
          <span class="fl-orgm-event-count">${ev.signupCount || 0}${ev.capacity ? ' / ' + ev.capacity : ''} prijavljeno</span>
          ${ev.isSignedUp
            ? `<button class="fl-btn-secondary fl-orgm-event-cancel" data-id="${ev.id}"><i class="fa-solid fa-xmark"></i> Odjavi se</button>`
            : `<button class="fl-btn-primary fl-orgm-event-signup" data-id="${ev.id}"><i class="fa-solid fa-check"></i> Prijavi se</button>`}
        </div>
      ` : ''}
    </div>
  `).join('');

  el.innerHTML = `
    <h2 class="fl-org-section-title"><i class="fa-solid fa-calendar-check"></i> Eventi</h2>
    <div class="fl-orgm-event-list">${rows}</div>
  `;

  el.querySelectorAll('.fl-orgm-event-signup').forEach(btn => {
    btn.addEventListener('click', () => {
      orgPost('orgSignupEvent', { eventId: parseInt(btn.dataset.id, 10) });
      orgEventsList = null;
      setTimeout(() => { if (activeOrgMemberTab === 'eventi') orgPost('orgGetEvents'); }, 400);
      renderOrgMemberEvents(el);
    });
  });

  el.querySelectorAll('.fl-orgm-event-cancel').forEach(btn => {
    btn.addEventListener('click', () => {
      orgPost('orgCancelEventSignup', { eventId: parseInt(btn.dataset.id, 10) });
      orgEventsList = null;
      setTimeout(() => { if (activeOrgMemberTab === 'eventi') orgPost('orgGetEvents'); }, 400);
      renderOrgMemberEvents(el);
    });
  });
}

// ---- 4) AKTIVNOSTI ----
function renderOrgMemberActivities(el) {
  if (orgActivitiesList === null) {
    el.innerHTML = `<div class="fl-org-loading"><i class="fa-solid fa-spinner fa-spin"></i> Učitavanje aktivnosti...</div>`;
    orgPost('orgGetActivities');
    return;
  }

  if (orgActivitiesList.length === 0) {
    el.innerHTML = `
      <h2 class="fl-org-section-title"><i class="fa-solid fa-list-check"></i> Aktivnosti</h2>
      <div class="fl-org-empty">Trenutno nema aktivnih ili nadolazećih aktivnosti.</div>
    `;
    return;
  }

  const rows = orgActivitiesList.map(act => `
    <div class="fl-orgm-event-card">
      <div class="fl-orgm-event-head">
        <span class="fl-orgm-event-title">${escapeHtml(act.title)}</span>
        <span class="fl-orgm-event-status fl-orgm-status-${escapeHtml(act.status || 'upcoming')}">${escapeHtml(act.status === 'active' ? 'Aktivna' : 'Nadolazeća')}</span>
      </div>
      ${act.description ? `<p class="fl-orgm-event-desc">${escapeHtml(act.description)}</p>` : ''}
      <div class="fl-orgm-event-meta">
        <span><i class="fa-solid fa-clock"></i> ${escapeHtml(act.start_at || '')}</span>
        ${act.location ? `<span><i class="fa-solid fa-location-dot"></i> ${escapeHtml(act.location)}</span>` : ''}
      </div>
      ${act.signup_enabled ? `
        <div class="fl-orgm-event-footer">
          ${act.isSignedUp
            ? `<span class="fl-orgm-event-count"><i class="fa-solid fa-check fl-org-green"></i> Prijavljen si</span>`
            : `<button class="fl-btn-primary fl-orgm-activity-signup" data-id="${act.id}"><i class="fa-solid fa-check"></i> Prijavi se</button>`}
        </div>
      ` : ''}
    </div>
  `).join('');

  el.innerHTML = `
    <h2 class="fl-org-section-title"><i class="fa-solid fa-list-check"></i> Aktivnosti</h2>
    <div class="fl-orgm-event-list">${rows}</div>
  `;

  el.querySelectorAll('.fl-orgm-activity-signup').forEach(btn => {
    btn.addEventListener('click', () => {
      orgPost('orgSignupActivity', { activityId: parseInt(btn.dataset.id, 10) });
      orgActivitiesList = null;
      setTimeout(() => { if (activeOrgMemberTab === 'aktivnosti') orgPost('orgGetActivities'); }, 400);
      renderOrgMemberActivities(el);
    });
  });
}

// ---- 5) RANG LISTA ----
function renderPdLeaderboard(el) {
  el.innerHTML = `<div class="fl-org-loading"><i class="fa-solid fa-spinner fa-spin"></i> Učitavanje rang liste...</div>`;
  postAsync('pd', { route: 'orgLeaderboard', payload: {} }).then((res) => {
    if (!(currentCategory === 'orgmembers' && activeOrgMemberTab === 'ranglista')) return;
    const list = (res && res.ok && res.list) || [];
    const hrs = (s) => formatDutyDuration(s);
    el.innerHTML = `
      <h2 class="fl-org-section-title"><i class="fa-solid fa-trophy"></i> Rang Lista - poslednjih 7 dana</h2>
      <p class="fl-org-hint">Rangirano po vremenu na dužnosti. Prikazana su i hapšenja i izdate kazne.</p>
      <div class="fl-orgm-rank-list">${list.map((m, i) => `
        <div class="fl-orgm-rank-row">
          <span class="fl-orgm-rank-pos ${i < 3 ? 'top' : ''}">#${i + 1}</span>
          <span class="fl-orgm-rank-name">${m.callsign ? '[' + escapeHtml(m.callsign) + '] ' : ''}${escapeHtml(m.name || '')}</span>
          <span class="fl-orgm-rank-stats">
            <span title="Hapšenja"><i class="fa-solid fa-building-shield"></i> ${m.arrests}</span>
            <span title="Kazne"><i class="fa-solid fa-file-invoice-dollar"></i> ${m.tickets}</span>
          </span>
          <span class="fl-orgm-rank-total">${hrs(m.week)}</span>
        </div>`).join('') || '<div class="fl-org-empty">Još uvek nema statistike.</div>'}</div>`;
  });
}

function renderPdProfile(el) {
  el.innerHTML = `<div class="fl-org-loading"><i class="fa-solid fa-spinner fa-spin"></i> Učitavanje profila...</div>`;
  postAsync('pd', { route: 'orgProfile', payload: {} }).then((res) => {
    if (!(currentCategory === 'orgmembers' && activeOrgMemberTab === 'mojprofil')) return;
    if (!res || !res.ok) { el.innerHTML = `<div class="fl-org-empty">${escapeHtml((res && res.error) || 'Profil nije dostupan.')}</div>`; return; }
    const p = res.profile;
    let joined = 'Nepoznato';
    if (p.joinedAt) { const d = new Date(String(p.joinedAt).replace(' ', 'T')); if (!isNaN(d.getTime())) joined = d.toLocaleDateString('sr-RS'); }
    el.innerHTML = `
      <h2 class="fl-org-section-title"><i class="fa-solid fa-id-card"></i> Moj Profil</h2>
      <div class="fl-orgm-profile-card">
        <div class="fl-orgm-profile-row"><span>Ime i prezime</span><b>${escapeHtml(p.name || '')}</b></div>
        <div class="fl-orgm-profile-row"><span>Čin</span><b>${escapeHtml(p.rank || '')}</b></div>
        <div class="fl-orgm-profile-row"><span>Pozivni znak</span><b>${escapeHtml(p.callsign || 'nije postavljen')}</b></div>
        <div class="fl-orgm-profile-row"><span>U policiji od</span><b>${escapeHtml(joined)}</b></div>
        <div class="fl-orgm-profile-row"><span>Status</span><b class="${p.onDuty ? 'fl-org-green' : ''}">${p.onDuty ? 'Na dužnosti (' + formatDutyDuration(p.session) + ')' : 'Van dužnosti'}</b></div>
      </div>
      <div class="fl-orgm-stats-row">
        <div class="fl-orgm-stat-box"><span class="fl-orgm-stat-num">${formatDutyDuration(p.today)}</span><span class="fl-orgm-stat-label">Danas</span></div>
        <div class="fl-orgm-stat-box"><span class="fl-orgm-stat-num">${formatDutyDuration(p.week)}</span><span class="fl-orgm-stat-label">7 dana</span></div>
        <div class="fl-orgm-stat-box"><span class="fl-orgm-stat-num">${formatDutyDuration(p.total)}</span><span class="fl-orgm-stat-label">Ukupno</span></div>
      </div>
      <div class="fl-orgm-stats-row">
        <div class="fl-orgm-stat-box"><span class="fl-orgm-stat-num">${p.arrests}</span><span class="fl-orgm-stat-label">Hapšenja</span></div>
        <div class="fl-orgm-stat-box"><span class="fl-orgm-stat-num">${p.detains}</span><span class="fl-orgm-stat-label">Privođenja</span></div>
        <div class="fl-orgm-stat-box"><span class="fl-orgm-stat-num">${p.tickets}</span><span class="fl-orgm-stat-label">Kazne</span></div>
        <div class="fl-orgm-stat-box"><span class="fl-orgm-stat-num">${p.seizures}</span><span class="fl-orgm-stat-label">Zaplene</span></div>
      </div>`;
  });
}

function renderOrgMemberLeaderboard(el) {
  if (['policija', 'fib', 'sheriff'].includes(orgType)) return renderPdLeaderboard(el);
  if (orgLeaderboardList === null) {
    el.innerHTML = `<div class="fl-org-loading"><i class="fa-solid fa-spinner fa-spin"></i> Učitavanje rang liste...</div>`;
    orgPost('orgGetLeaderboard');
    return;
  }

  const rows = orgLeaderboardList.map((m, i) => `
    <div class="fl-orgm-rank-row">
      <span class="fl-orgm-rank-pos ${i < 3 ? 'top' : ''}">#${i + 1}</span>
      <span class="fl-orgm-rank-name">${escapeHtml((m.firstname + ' ' + m.lastname).trim() || m.identifier)}</span>
      <span class="fl-orgm-rank-stats">
        <span title="Oživljavanja"><i class="fa-solid fa-kit-medical"></i> ${m.revives_done}</span>
        <span title="Lečenja"><i class="fa-solid fa-briefcase-medical"></i> ${m.heals_done}</span>
        <span title="Prodati medkiti"><i class="fa-solid fa-suitcase-medical"></i> ${m.medkits_sold}</span>
      </span>
      <span class="fl-orgm-rank-total">${m.total}</span>
    </div>
  `).join('') || `<div class="fl-org-empty">Još uvek nema statistike.</div>`;

  el.innerHTML = `
    <h2 class="fl-org-section-title"><i class="fa-solid fa-trophy"></i> Rang Lista - Najaktivniji Članovi</h2>
    <p class="fl-org-hint">Rangirano po ukupnom broju odrađenih oživljavanja, lečenja i prodatih medkita.</p>
    <div class="fl-orgm-rank-list">${rows}</div>
  `;
}

// ---- 6) MOJ PROFIL ----
function renderOrgMemberProfile(el) {
  if (['policija', 'fib', 'sheriff'].includes(orgType)) return renderPdProfile(el);
  if (orgMyProfileData === null) {
    el.innerHTML = `<div class="fl-org-loading"><i class="fa-solid fa-spinner fa-spin"></i> Učitavanje profila...</div>`;
    orgPost('orgGetMyProfile');
    return;
  }

  const p = orgMyProfileData;
  // oxmysql ume da vrati DATETIME kao string ("GGGG-MM-DD SS:MM:SS", bez 'T'),
  // ali i kao broj (unix timestamp) ili već-parsirani objekat, zavisno od
  // verzije/drajvera - zato se ovde bezbedno parsira za SVAKI mogući tip,
  // umesto da se slepo pretpostavi da je string (to je pucalo pre).
  let joinedDate = null;
  try {
    if (p.joinedAt) {
      if (typeof p.joinedAt === 'string') {
        joinedDate = new Date(p.joinedAt.replace(' ', 'T'));
      } else if (typeof p.joinedAt === 'number') {
        // sekunde ili milisekunde - ako je premalo za milisekunde od 2020+, pretpostavi sekunde
        joinedDate = new Date(p.joinedAt < 10000000000 ? p.joinedAt * 1000 : p.joinedAt);
      } else {
        joinedDate = new Date(p.joinedAt);
      }
    }
  } catch (e) {
    joinedDate = null;
  }
  const validJoinedDate = joinedDate && !isNaN(joinedDate.getTime()) ? joinedDate : null;
  const daysInOrg = validJoinedDate ? Math.max(0, Math.floor((Date.now() - validJoinedDate.getTime()) / 86400000)) : null;
  const joinedDisplay = validJoinedDate
    ? validJoinedDate.toLocaleDateString('sr-RS', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : 'Nepoznato';

  el.innerHTML = `
    <h2 class="fl-org-section-title"><i class="fa-solid fa-id-card"></i> Moj Profil</h2>
    <div class="fl-orgm-profile-card">
      <div class="fl-orgm-profile-row"><span>Ime i prezime</span><b>${escapeHtml(p.name || '')}</b></div>
      <div class="fl-orgm-profile-row"><span>Trenutni rank</span><b>${escapeHtml(p.gradeLabel || '')}</b></div>
      <div class="fl-orgm-profile-row"><span>Datum ulaska</span><b>${escapeHtml(joinedDisplay)}</b></div>
      <div class="fl-orgm-profile-row"><span>Vreme u organizaciji</span><b>${daysInOrg !== null ? daysInOrg + ' dana' : 'Nepoznato'}</b></div>
    </div>
    <div class="fl-orgm-stats-row">
      <div class="fl-orgm-stat-box"><span class="fl-orgm-stat-num">${p.revivesDone}</span><span class="fl-orgm-stat-label">Oživljavanja</span></div>
      <div class="fl-orgm-stat-box"><span class="fl-orgm-stat-num">${p.healsDone}</span><span class="fl-orgm-stat-label">Lečenja</span></div>
      <div class="fl-orgm-stat-box"><span class="fl-orgm-stat-num">${p.medkitsSold}</span><span class="fl-orgm-stat-label">Prodati medkiti</span></div>
    </div>
    <h3 class="fl-org-subtitle">Dužnost</h3>
    <div id="orgDutyStatsBox"></div>
  `;

  renderOrgDutyStatsBox();
}

function formatDutyDuration(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h}h ${m}min`;
}

function renderOrgDutyStatsBox() {
  const box = document.getElementById('orgDutyStatsBox');
  if (!box) return;

  if (orgDutyStatsData === null) {
    box.innerHTML = `<div class="fl-org-loading"><i class="fa-solid fa-spinner fa-spin"></i> Učitavanje...</div>`;
    orgPost('orgGetDutyStats');
    return;
  }

  const d = orgDutyStatsData;
  const remaining = d.onDuty ? Math.max(0, (d.minDuration || 3600) - (d.sessionElapsed || 0)) : 0;

  box.innerHTML = `
    <div class="fl-orgm-stats-row">
      <div class="fl-orgm-stat-box"><span class="fl-orgm-stat-num">${formatDutyDuration(d.todaySeconds)}</span><span class="fl-orgm-stat-label">Danas na dužnosti</span></div>
      <div class="fl-orgm-stat-box"><span class="fl-orgm-stat-num">${formatDutyDuration(d.totalSeconds)}</span><span class="fl-orgm-stat-label">Ukupno na dužnosti</span></div>
    </div>
    ${d.onDuty
      ? (remaining > 0
          ? `<p class="fl-org-hint"><i class="fa-solid fa-circle-exclamation" style="color:#ff9f4d;margin-right:6px;"></i>Trenutno si na dužnosti - moraš ostati još <b>${Math.ceil(remaining / 60)} min</b> pre nego što možeš da je isključiš.</p>`
          : `<p class="fl-org-hint"><i class="fa-solid fa-circle-check fl-org-green" style="margin-right:6px;"></i>Trenutno si na dužnosti - minimum je odrađen, možeš je isključiti kad želiš.</p>`)
      : `<p class="fl-org-hint">Kad uđeš na dužnost, moraš ostati minimum ${Math.floor((d.minDuration || 3600) / 60)} minuta pre nego što je isključiš.</p>`}
  `;
}

// ---- Rezultati sa servera ----
window.addEventListener('message', (event) => {
  const data = event.data;

  if (data.action === 'orgAnnouncementsResult') {
    orgAnnouncementsList = { list: data.list || [], lastRead: data.lastRead };
    if (currentCategory === 'orgmembers' && activeOrgMemberTab === 'obavestenja') renderOrgMemberTabContent();
  }

  if (data.action === 'orgMyProfileResult') {
    orgMyProfileData = data.profile || {};
    if (currentCategory === 'orgmembers' && activeOrgMemberTab === 'mojprofil') renderOrgMemberTabContent();
  }

  if (data.action === 'orgDutyStatsResult') {
    orgDutyStatsData = data.stats || {};
    if (currentCategory === 'orgmembers' && activeOrgMemberTab === 'mojprofil') renderOrgDutyStatsBox();
  }

  if (data.action === 'orgLeaderboardResult') {
    orgLeaderboardList = data.list || [];
    if (currentCategory === 'orgmembers' && activeOrgMemberTab === 'ranglista') renderOrgMemberTabContent();
  }

  if (data.action === 'orgEventsResult') {
    orgEventsList = data.list || [];
    if (currentCategory === 'orgmembers' && activeOrgMemberTab === 'eventi') renderOrgMemberTabContent();
  }

  if (data.action === 'orgActivitiesResult') {
    orgActivitiesList = data.list || [];
    if (currentCategory === 'orgmembers' && activeOrgMemberTab === 'aktivnosti') renderOrgMemberTabContent();
  }
});

// MDT (Vlada) i MDT (Policija) su premešteni u zasebne fajlove:
// mdt_core.js, mdt_vlada.js, mdt_policija.js (dizajn: fmdt.css)


/* =====================================================================
   FLAMINGO TABLET - iPadOS sloj (samo izgled: skaliranje, widgeti, dock,
   pozadina). Logika aplikacija je u script.js / kuce.js / market.js /
   mdt_*.js i ovde se NE dira.
   ===================================================================== */
(() => {
  const $ = (id) => document.getElementById(id);
  const frame = $('tablet-frame');
  const W = 1120, H = 780;

  /* ---------- skaliranje na manje monitore ---------- */
  function fit() {
    const s = Math.min(1, (window.innerWidth * 0.94) / W, (window.innerHeight * 0.94) / H);
    frame.style.transform = `scale(${s.toFixed(3)})`;
  }
  window.addEventListener('resize', fit); fit();

  /* ---------- pozadina ---------- */
  const WALLS = ['img/ipad1.svg', 'img/ipad2.svg', 'img/ipad3.svg', 'img/wallpaper.jpg'];
  let wall = 0;
  try { wall = Math.max(0, WALLS.indexOf(localStorage.getItem('fl_tab_wall'))); } catch (e) {}
  function applyWall() { $('tablet').style.backgroundImage = `url('${WALLS[wall]}'), url('img/wallpaper.jpg')`; }
  applyWall();
  $('ios-dock-wall').addEventListener('click', () => {
    wall = (wall + 1) % WALLS.length;
    try { localStorage.setItem('fl_tab_wall', WALLS[wall]); } catch (e) {}
    applyWall();
  });

  /* ---------- dock: prečice otvaraju iste aplikacije kao ikonice ---------- */
  document.querySelectorAll('[data-ios-open]').forEach((b) => b.addEventListener('click', () => {
    const t = $(b.dataset.iosOpen);
    if (t) t.click();
  }));

  /* ---------- widgeti ---------- */
  const DAYS = ['NEDELJA', 'PONEDELJAK', 'UTORAK', 'SREDA', 'ČETVRTAK', 'PETAK', 'SUBOTA'];
  const MONTHS = ['januar', 'februar', 'mart', 'april', 'maj', 'jun', 'jul', 'avgust', 'septembar', 'oktobar', 'novembar', 'decembar'];
  const face = $('ios-clock-face');
  face.innerHTML = `<svg viewBox="0 0 100 100">${Array.from({ length: 12 }, (_, i) => {
      const a = i * 30 * Math.PI / 180, x = 50 + Math.sin(a) * 38, y = 50 - Math.cos(a) * 38;
      return `<text x="${x}" y="${y + 3.6}" text-anchor="middle">${i || 12}</text>`;
    }).join('')}<line id="ios-h" x1="50" y1="50" x2="50" y2="28"/><line id="ios-m" x1="50" y1="50" x2="50" y2="16"/><line id="ios-s" x1="50" y1="58" x2="50" y2="14"/><circle cx="50" cy="50" r="2.4"/></svg>`;

  function tick() {
    const d = new Date();
    const h = d.getHours(), m = d.getMinutes(), s = d.getSeconds();
    const rot = (id, deg) => { const el = $(id); if (el) el.setAttribute('transform', `rotate(${deg} 50 50)`); };
    rot('ios-h', (h % 12) * 30 + m * 0.5); rot('ios-m', m * 6 + s * 0.1); rot('ios-s', s * 6);
    $('ios-w-time').textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    $('ios-w-day').textContent = DAYS[d.getDay()];
    $('ios-w-num').textContent = d.getDate();
    $('ios-w-month').textContent = MONTHS[d.getMonth()];
  }
  function calendar() {
    const d = new Date(), y = d.getFullYear(), m = d.getMonth();
    const off = (new Date(y, m, 1).getDay() + 6) % 7, days = new Date(y, m + 1, 0).getDate();
    let html = ['P', 'U', 'S', 'Č', 'P', 'S', 'N'].map((x) => `<i class="h">${x}</i>`).join('');
    for (let i = 0; i < off; i++) html += '<i></i>';
    for (let n = 1; n <= days; n++) html += `<i class="${n === d.getDate() ? 't' : ''}">${n}</i>`;
    $('ios-w-grid').innerHTML = html;
  }
  tick(); calendar();
  setInterval(tick, 1000);
  setInterval(calendar, 60000);

  /* Widget "Hitna pomoć" prati vidljivost quickstats-a (script.js ga pali samo doktorima) */
  const quick = $('home-quickstats'), orgW = $('ios-w-org');
  const syncOrg = () => orgW.classList.toggle('hidden', quick.classList.contains('hidden'));
  new MutationObserver(syncOrg).observe(quick, { attributes: true, attributeFilter: ['class'] });
  syncOrg();
})();
