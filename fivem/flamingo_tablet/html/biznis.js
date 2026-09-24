// ============================================================
//  APLIKACIJA: MOJ BIZNIS (flamingo_biznisi)
//  Lista biznisa igrača (bankomati i marketi) + upravljanje:
//  kasa (podigni / uloži / podigni sve), provizija po kartici,
//  gotovina u bankomatu + dopuna (transport), grafik i istorija.
//  Sve provere radi flamingo_biznisi server - ovde se samo crta.
// ============================================================
(() => {
  const appIcon = document.getElementById('app-biznis');
  const badge = document.getElementById('biznis-badge');
  const screen = document.getElementById('app-screen-biznis');
  const backBtn = document.getElementById('biznis-back');
  const refreshBtn = document.getElementById('biznis-refresh');
  const sideEl = document.getElementById('bz-side');
  const mainEl = document.getElementById('bz-main');

  const bz = { data: null, selected: null, busy: false, account: 'bank', renaming: false, armed: null, armTimer: null };

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = n => Math.floor(n || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') + '$';
  const short = n => {
    n = Math.floor(n || 0);
    if (n >= 1e6) return (Math.floor(n / 1e4) / 100).toString().replace('.', ',') + 'M$';
    if (n >= 1e4) return Math.round(n / 1e3) + 'K$';
    return money(n);
  };
  const DAYS = ['Ned', 'Pon', 'Uto', 'Sre', 'Čet', 'Pet', 'Sub'];
  const isMarket = b => b.type === 'market';
  const TYPE = {
    atm: { icon: 'fa-money-bill-transfer', label: 'Bankomat' },
    market: { icon: 'fa-store', label: 'Market' }
  };
  const typeOf = b => TYPE[b.type] || TYPE.atm;
  const lowProducts = b => (b.products || []).filter(p => p.low);
  const itemImg = name => `nui://ox_inventory/web/images/${encodeURIComponent(name)}.png`;
  const ago = ts => {
    const s = Math.max(0, Math.floor((bz.data ? bz.data.now : Date.now() / 1000) - ts));
    if (s < 60) return 'upravo';
    if (s < 3600) return `pre ${Math.floor(s / 60)} min`;
    if (s < 86400) return `pre ${Math.floor(s / 3600)} h`;
    const d = Math.floor(s / 86400);
    return `pre ${d} ${d === 1 ? 'dan' : 'dana'}`;
  };

  function toast(msg, type) {
    if (typeof showToast === 'function') showToast(esc(msg), type);
  }

  // ---------- podaci ----------
  async function load(keepSelection) {
    if (!bz.data) renderLoading();
    const res = await postAsync('biznis:list');

    if (!res || !res.ok) {
      bz.data = null;
      renderError(res && res.error);
      return;
    }
    bz.data = res;
    const ids = res.businesses.map(b => b.id);
    if (!keepSelection || !ids.includes(bz.selected)) bz.selected = ids[0] ?? null;
    updateBadge();
    render();
  }

  async function action(act, extra) {
    if (bz.busy || bz.selected == null) return;
    bz.busy = true;
    const res = await postAsync('biznis:action', Object.assign({ action: act, id: bz.selected }, extra || {}));
    bz.busy = false;
    disarm();
    if (res && res.ok) {
      if (res.message) toast(res.message, 'success');
    } else {
      toast((res && res.error) || 'Akcija nije uspela.', 'error');
    }
    await load(true);
  }

  function updateBadge() {
    const low = bz.data && bz.data.businesses.some(b => (!isMarket(b) && b.lowCash) || lowProducts(b).length > 0);
    badge.classList.toggle('hidden', !low);
  }

  // dvostruki klik za "Podigni sve"
  function arm(key, btn, label) {
    if (bz.armed === key) return true;
    disarm();
    bz.armed = key;
    btn.classList.add('armed');
    btn.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> ${label}`;
    bz.armTimer = setTimeout(() => { disarm(); render(); }, 3500);
    return false;
  }
  function disarm() {
    bz.armed = null;
    if (bz.armTimer) clearTimeout(bz.armTimer);
    bz.armTimer = null;
  }

  // ---------- crtanje ----------
  function renderLoading() {
    sideEl.innerHTML = '';
    mainEl.innerHTML = `<div class="bz-empty"><i class="fa-solid fa-spinner fa-spin"></i>Učitavanje...</div>`;
  }

  function renderError(err) {
    sideEl.innerHTML = '';
    mainEl.innerHTML = `<div class="bz-empty"><i class="fa-solid fa-plug-circle-xmark"></i>${esc(err || 'Sistem biznisa trenutno nije dostupan.')}</div>`;
  }

  function render() {
    const d = bz.data;
    if (!d) return;
    const list = d.businesses;

    const totalKasa = list.reduce((s, b) => s + b.balance, 0);
    const totalWeek = list.reduce((s, b) => s + b.week, 0);

    const items = list.map(b => {
      const pct = Math.round(b.atmCash / Math.max(1, b.atmMax) * 100);
      const low = lowProducts(b).length;
      const warn = isMarket(b) ? (low > 0 ? `<i class="fa-solid fa-triangle-exclamation"></i> Ponestaje: ${low} ${low === 1 ? 'artikal' : 'artikla'}` : '')
                               : (b.lowCash ? `<i class="fa-solid fa-triangle-exclamation"></i> Bankomat ${pct}% pun` : '');
      return `
        <button class="bz-item ${b.id === bz.selected ? 'active' : ''}" data-bz-select="${b.id}">
          <div class="bz-item-ico"><i class="fa-solid ${typeOf(b).icon}"></i></div>
          <div class="bz-item-info">
            <span class="bz-item-name">${esc(b.name)}</span>
            <span class="bz-item-sub ${warn ? 'bz-warn' : ''}">${warn || esc(b.street || typeOf(b).label)}</span>
          </div>
          <div class="bz-item-amt"><b>${short(b.balance)}</b><span>u kasi</span></div>
        </button>`;
    }).join('');

    sideEl.innerHTML = `
      <div class="bz-sum">
        <div class="bz-sum-top">
          <div>
            <div class="bz-sum-label">Ukupno u kasama</div>
            <div class="bz-sum-num">${money(totalKasa)}</div>
          </div>
          <div class="bz-sum-ico"><i class="fa-solid fa-sack-dollar"></i></div>
        </div>
        <div class="bz-sum-row">
          <span><i class="fa-solid fa-arrow-trend-up"></i> 7 dana <b>+${short(totalWeek)}</b></span>
          <span><i class="fa-solid fa-briefcase"></i> <b>${list.length}</b>${d.maxCount > 0 ? ` / ${d.maxCount}` : ''} biznisa</span>
        </div>
      </div>
      <div class="bz-list">${items}</div>`;

    const b = list.find(x => x.id === bz.selected);
    if (!b) {
      mainEl.innerHTML = `
        <div class="bz-empty">
          <i class="fa-solid fa-briefcase"></i>
          <b>Nemaš nijedan biznis.</b>
          Otvori bilo koji bankomat ili market i u meniju izaberi <b>Biznis</b> da vidiš cenu, vlasnika i zaradu.
        </div>`;
      return;
    }
    mainEl.innerHTML = renderDetail(b, d);
  }

  function renderHero(b) {
    const title = bz.renaming
      ? `<div class="bz-rename">
           <input class="bz-input" id="bz-name" maxlength="24" placeholder="Naziv biznisa" value="${esc(b.custom ? b.name : '')}">
           <button class="bz-btn primary" data-bz="saveName"><i class="fa-solid fa-check"></i></button>
           <button class="bz-btn" data-bz="cancelName"><i class="fa-solid fa-xmark"></i></button>
         </div>`
      : `<h3>${esc(b.name)} <button class="bz-icon-btn" data-bz="rename" title="Promeni naziv"><i class="fa-solid fa-pen"></i></button></h3>`;

    return `
      <div class="bz-hero">
        <div class="bz-hero-art"><i class="fa-solid ${typeOf(b).icon}"></i></div>
        <div class="bz-hero-content">
          <div class="bz-hero-l">
            <span class="bz-eyebrow">${typeOf(b).label} · ID #${b.id}</span>
            ${title}
            <p><i class="fa-solid fa-location-dot"></i> ${esc(b.street || 'Los Santos')}${b.zone ? ', ' + esc(b.zone) : ''}</p>
          </div>
          <button class="bz-btn glass" data-bz="gps"><i class="fa-solid fa-location-arrow"></i> Navigacija</button>
        </div>
      </div>`;
  }

  function renderKasa(b, d) {
    return `
      <div class="bz-section bz-kasa">
        <div class="bz-section-head">
          <div class="bz-section-title"><i class="fa-solid fa-cash-register"></i> Kasa biznisa</div>
          <div class="bz-seg">
            <button class="${bz.account === 'bank' ? 'active' : ''}" data-bz-acc="bank"><i class="fa-solid fa-building-columns"></i> Račun</button>
            <button class="${bz.account === 'money' ? 'active' : ''}" data-bz-acc="money"><i class="fa-solid fa-wallet"></i> Gotovina</button>
          </div>
        </div>
        <div class="bz-kasa-num">${money(b.balance)}</div>
        <div class="bz-amount">
          <span>$</span>
          <input class="bz-input" id="bz-amount" inputmode="numeric" placeholder="Iznos">
        </div>
        <div class="bz-kasa-btns">
          <button class="bz-btn primary" data-bz="take"><i class="fa-solid fa-arrow-down"></i> Podigni</button>
          <button class="bz-btn" data-bz="put"><i class="fa-solid fa-arrow-up"></i> Uloži</button>
        </div>
        <button class="bz-btn wide success" data-bz="takeAll" ${b.balance < 1 ? 'disabled' : ''}><i class="fa-solid fa-hand-holding-dollar"></i> ${isMarket(b) ? "Podigni sav novac" : "Podigni svu proviziju"} (${money(b.balance)})</button>
        <div class="bz-section-sub">Novac ide ${bz.account === 'bank' ? '<b>na tvoj račun</b>' : '<b>u gotovinu</b>'}. Kod sebe: ${money(d.cash)} · Račun: ${money(d.bank)}</div>
      </div>`;
  }

  function renderAtm(b, d) {
    const pct = Math.min(100, Math.round(b.atmCash / Math.max(1, b.atmMax) * 100));
    const missing = Math.max(0, b.atmMax - b.atmCash);
    const state = b.atmCash <= 0 ? 'empty' : (b.lowCash ? 'low' : 'ok');
    const label = { empty: 'Prazan', low: 'Malo gotovine', ok: 'Radi normalno' }[state];
    return `
      <div class="bz-section bz-atm ${state}">
        <div class="bz-section-head">
          <div class="bz-section-title"><i class="fa-solid fa-vault"></i> Gotovina u bankomatu</div>
          <span class="bz-badge ${state}">${label}</span>
        </div>
        <div class="bz-atm-ring" style="--p:${pct}">
          <div class="bz-atm-ring-in"><b>${pct}%</b><span>pun</span></div>
        </div>
        <div class="bz-atm-nums">
          <div><span>U bankomatu</span><b>${money(b.atmCash)}</b></div>
          <div><span>Kapacitet</span><b>${money(b.atmMax)}</b></div>
        </div>
        <button class="bz-btn wide ${missing > 0 ? 'primary' : ''}" data-bz="refill" ${missing <= 0 ? 'disabled' : ''}>
          <i class="fa-solid fa-truck-fast"></i> Dopuni bankomat <span class="bz-tag">Transport</span>
        </button>
        <div class="bz-section-sub">${missing > 0 ? `Do punog fali <b>${money(missing)}</b>.` : 'Bankomat je pun.'} ${d.refill ? '' : 'Transport novca stiže uskoro.'} Prazan bankomat ne isplaćuje novac i ne zarađuje.</div>
      </div>`;
  }

  function renderChart(b) {
    const max = Math.max(1, ...b.chart.map(c => c.fee));
    const now = new Date((bz.data.now || Date.now() / 1000) * 1000);
    const bars = b.chart.map(c => {
      const day = new Date(now.getTime() - c.ago * 86400000);
      const h = Math.max(3, Math.round(c.fee / max * 100));
      return `
        <div class="bz-bar ${c.ago === 0 ? 'today' : ''}" title="${money(c.fee)} · ${c.count} podizanja">
          <span class="bz-bar-v">${c.fee > 0 ? short(c.fee) : ''}</span>
          <div class="bz-bar-track"><div style="height:${h}%"></div></div>
          <span class="bz-bar-l">${c.ago === 0 ? 'Danas' : DAYS[day.getDay()]}</span>
        </div>`;
    }).join('');
    return `
      <div class="bz-section">
        <div class="bz-section-head">
          <div class="bz-section-title"><i class="fa-solid fa-chart-column"></i> ${isMarket(b) ? 'Zarada od prodaje' : 'Zarada od provizije'}, 7 dana</div>
          <span class="bz-section-sub"><b>${b.count7}</b> ${isMarket(b) ? 'prodaja' : 'podizanja'}</span>
        </div>
        <div class="bz-chart">${bars}</div>
      </div>`;
  }

  function renderTiers(b, d) {
    const tiles = (d.cards || []).map(c => {
      const t = (b.tiers && b.tiers[c.id]) || { fee: 0, count: 0 };
      const cut = Math.round((c.atmFee || 0) * (100 - (d.stateCut || 0))) / 100;
      return `
        <div class="bz-tier ${esc(c.theme || 'dark')}">
          <div class="bz-tier-top"><span class="bz-chip"></span>${esc(c.label)}</div>
          <div class="bz-tier-p">${cut}%</div>
          <div class="bz-tier-s">7 dana: <b>${short(t.fee)}</b> · ${t.count}×</div>
        </div>`;
    }).join('');
    return `
      <div class="bz-section">
        <div class="bz-section-head">
          <div class="bz-section-title"><i class="fa-solid fa-credit-card"></i> Provizija po kartici</div>
        </div>
        <div class="bz-tiers">${tiles}</div>
        <div class="bz-section-sub">Kad igrač podigne novac na tvom bankomatu, provizija njegove kartice ide u kasu. Uplate su bez provizije i dopunjuju bankomat gotovinom.</div>
      </div>`;
  }

  const LOG = {
    withdraw: l => ({ ic: 'fa-arrow-down', cls: 'fee', t: `Podizanje, ${esc(l.actor || 'igrač')}`, s: `${esc(tierLabel(l.tier))} kartica · isplaćeno ${money(l.amount)}`, v: `+${money(l.fee)}`, vc: 'pos' }),
    deposit: l => ({ ic: 'fa-arrow-up', cls: 'dep', t: `Uplata, ${esc(l.actor || 'igrač')}`, s: 'Bez provizije · gotovina ušla u bankomat', v: money(l.amount), vc: '' }),
    take: l => ({ ic: 'fa-hand-holding-dollar', cls: 'out', t: 'Podignuto iz kase', s: `${esc(l.actor || '')} · ${l.tier === 'bank' ? 'na račun' : 'u gotovini'}`, v: `-${money(l.amount)}`, vc: 'neg' }),
    put: l => ({ ic: 'fa-piggy-bank', cls: 'in', t: 'Uloženo u kasu', s: `${esc(l.actor || '')} · ${l.tier === 'bank' ? 'sa računa' : 'gotovinom'}`, v: `+${money(l.amount)}`, vc: 'pos' }),
    refill: l => ({ ic: 'fa-truck-fast', cls: 'ref', t: 'Dopuna bankomata', s: esc(l.actor || 'Transport'), v: `+${money(l.amount)}`, vc: 'blue' }),
    buy: l => ({ ic: 'fa-key', cls: 'in', t: 'Kupovina biznisa', s: esc(l.actor || ''), v: money(l.amount), vc: '' }),
    owner: l => ({ ic: 'fa-crown', cls: 'in', t: 'Novi vlasnik', s: esc(l.actor || ''), v: '', vc: '' }),
    state: l => ({ ic: 'fa-landmark', cls: 'out', t: 'Vraćeno državi', s: esc(l.actor || ''), v: '', vc: '' }),
    sell_state: l => ({ ic: 'fa-landmark', cls: 'out', t: 'Prodato državi', s: esc(l.actor || ''), v: money(l.amount), vc: '' }),
    sale: l => ({ ic: 'fa-basket-shopping', cls: 'fee', t: `Prodaja, ${esc(l.actor || 'kupac')}`, s: esc(l.note || ''), v: `+${money(l.fee)}`, vc: 'pos' }),
    order: l => ({ ic: 'fa-cart-plus', cls: 'out', t: 'Narudžbina robe', s: esc(l.note || ''), v: `-${money(l.amount)}`, vc: 'neg' }),
    delivery: l => ({ ic: 'fa-truck-ramp-box', cls: 'ref', t: 'Roba dovezena', s: `${esc(l.note || '')}${l.actor ? ' · ' + esc(l.actor) : ''}`, v: '', vc: '' }),
    sold: l => ({ ic: 'fa-handshake', cls: 'in', t: 'Prodato igraču', s: esc(l.actor || ''), v: money(l.amount), vc: '' })
  };
  function tierLabel(id) {
    const c = (bz.data.cards || []).find(x => x.id === id);
    return c ? c.label : (id || 'Standard');
  }

  function renderLogs(b) {
    const rows = (b.logs || []).map(l => {
      const f = (LOG[l.type] || (() => ({ ic: 'fa-circle', cls: '', t: esc(l.type), s: '', v: money(l.amount), vc: '' })))(l);
      return `
        <div class="bz-log">
          <div class="bz-log-ic ${f.cls}"><i class="fa-solid ${f.ic}"></i></div>
          <div class="bz-log-t"><b>${f.t}</b><span>${f.s}</span></div>
          <div class="bz-log-r"><b class="${f.vc}">${f.v}</b><span>${ago(l.ts)}</span></div>
        </div>`;
    }).join('');
    return `
      <div class="bz-section">
        <div class="bz-section-head">
          <div class="bz-section-title"><i class="fa-solid fa-clock-rotate-left"></i> Istorija</div>
          <span class="bz-section-sub">poslednjih ${(b.logs || []).length}</span>
        </div>
        ${rows || '<div class="bz-section-sub">Još nema transakcija.</div>'}
      </div>`;
  }

  function renderSellState(b) {
    return `
      <div class="bz-section bz-sell">
        <div class="bz-section-head">
          <div>
            <div class="bz-section-title"><i class="fa-solid fa-landmark"></i> Prodaj državi</div>
            <div class="bz-section-sub">Država otkupljuje biznis za pola cene: <b>${money(b.sellPrice)}</b> (cena ${money(b.price)}).
              ${b.balance > 0 ? `Iz kase ti se isplaćuje još <b>${money(b.balance)}</b>.` : ''} Novac ide na račun.
              Igraču možeš da prodaš preko radial menija (<span class="bz-kbd">G</span> → Prodaj biznis).</div>
          </div>
          <button class="bz-btn danger" data-bz="sellState"><i class="fa-solid fa-hand-holding-dollar"></i> Prodaj za ${money(b.sellPrice)}</button>
        </div>
      </div>`;
  }

  // ---------- market: magacin i narudžbina robe ----------
  function renderStorage(b, d) {
    const prods = b.products || [];
    const have = prods.reduce((s, p) => s + p.stock, 0);
    const cap = prods.reduce((s, p) => s + p.max, 0) || 1;
    const pending = prods.reduce((s, p) => s + p.pending, 0);
    const low = lowProducts(b).length;
    const empty = prods.filter(p => p.stock <= 0).length;
    const pct = Math.min(100, Math.round(have / cap * 100));
    const state = empty > 0 ? 'empty' : (low > 0 ? 'low' : 'ok');
    const label = { empty: `Nema ${empty} ${empty === 1 ? 'artikla' : 'artikala'}`, low: 'Ponestaje robe', ok: 'Magacin je pun' }[state];
    return `
      <div class="bz-section bz-atm ${state}">
        <div class="bz-section-head">
          <div class="bz-section-title"><i class="fa-solid fa-boxes-stacked"></i> Magacin</div>
          <span class="bz-badge ${state}">${label}</span>
        </div>
        <div class="bz-atm-ring" style="--p:${pct}">
          <div class="bz-atm-ring-in"><b>${pct}%</b><span>pun</span></div>
        </div>
        <div class="bz-atm-nums">
          <div><span>Na stanju</span><b>${have} kom.</b></div>
          <div><span>U dolasku</span><b>${pending} kom.</b></div>
        </div>
        <div class="bz-section-sub">Roba se naručuje ispod, za <b>${Math.round((d.orderRatio || 0.5) * 100)}%</b> prodajne cene, i plaća se iz kase.
          ${d.supply ? 'Roba stiže transportom.' : 'Dok transport ne proradi, roba stiže odmah.'} Artikal koga nema ne može da se kupi.</div>
      </div>`;
  }

  function renderProducts(b, d) {
    const rows = (b.products || []).map(p => {
      const room = Math.max(0, p.max - p.stock - p.pending);
      const pct = Math.min(100, Math.round(p.stock / Math.max(1, p.max) * 100));
      const cls = p.stock <= 0 ? 'empty' : (p.low ? 'low' : '');
      return `
        <div class="bz-prod ${cls}">
          <div class="bz-prod-img"><i class="fa-solid fa-box"></i><img src="${esc(itemImg(p.name))}" onerror="this.remove()"></div>
          <div class="bz-prod-info">
            <b>${esc(p.label)}</b>
            <span>Prodaja ${money(p.price)} · Nabavka <b>${money(p.orderPrice)}</b> / kom.</span>
            <div class="bz-prod-bar"><div style="width:${pct}%"></div></div>
            <span class="bz-prod-stock">${p.stock} / ${p.max} kom.${p.pending > 0 ? ` · <i class="fa-solid fa-truck-fast"></i> u dolasku ${p.pending}` : ''}</span>
          </div>
          <div class="bz-prod-order">
            <input class="bz-input bz-qty" data-bz-qty="${esc(p.name)}" data-unit="${p.orderPrice}" inputmode="numeric" placeholder="Kom." ${room <= 0 ? 'disabled' : ''}>
            <button class="bz-btn primary" data-bz="order" data-item="${esc(p.name)}" ${room <= 0 ? 'disabled' : ''}><i class="fa-solid fa-cart-plus"></i> Naruči</button>
            <button class="bz-btn" data-bz="orderFill" data-item="${esc(p.name)}" ${room <= 0 ? 'disabled' : ''} title="Naruči do punog magacina">
              ${room > 0 ? `Do punog: ${room} kom. · ${money(room * p.orderPrice)}` : 'Magacin pun'}
            </button>
            <span class="bz-prod-cost" data-bz-cost="${esc(p.name)}"></span>
          </div>
        </div>`;
    }).join('');
    return `
      <div class="bz-section">
        <div class="bz-section-head">
          <div class="bz-section-title"><i class="fa-solid fa-truck-ramp-box"></i> Naruči robu</div>
          <span class="bz-section-sub">U kasi: <b>${money(b.balance)}</b></span>
        </div>
        ${rows || '<div class="bz-section-sub">Ovaj market nema artikala u configu.</div>'}
      </div>`;
  }

  function renderDetail(b, d) {
    if (isMarket(b)) {
      return `
      ${renderHero(b)}
      <div class="bz-grid">
        <div class="bz-stat"><div class="bz-stat-label"><i class="fa-solid fa-cash-register"></i> Kasa</div><div class="bz-stat-value">${money(b.balance)}</div></div>
        <div class="bz-stat"><div class="bz-stat-label"><i class="fa-solid fa-sun"></i> Danas</div><div class="bz-stat-value pos">+${money(b.today)}</div></div>
        <div class="bz-stat"><div class="bz-stat-label"><i class="fa-solid fa-calendar-week"></i> 7 dana</div><div class="bz-stat-value pos">+${money(b.week)}</div></div>
        <div class="bz-stat"><div class="bz-stat-label"><i class="fa-solid fa-trophy"></i> Ukupno zarađeno</div><div class="bz-stat-value">${money(b.earned)}</div></div>
      </div>
      <div class="bz-two">
        ${renderKasa(b, d)}
        ${renderStorage(b, d)}
      </div>
      ${renderProducts(b, d)}
      ${renderChart(b)}
      ${renderLogs(b)}
      ${renderSellState(b)}`;
    }
    return `
      ${renderHero(b)}
      <div class="bz-grid">
        <div class="bz-stat"><div class="bz-stat-label"><i class="fa-solid fa-cash-register"></i> Kasa</div><div class="bz-stat-value">${money(b.balance)}</div></div>
        <div class="bz-stat"><div class="bz-stat-label"><i class="fa-solid fa-sun"></i> Danas</div><div class="bz-stat-value pos">+${money(b.today)}</div></div>
        <div class="bz-stat"><div class="bz-stat-label"><i class="fa-solid fa-calendar-week"></i> 7 dana</div><div class="bz-stat-value pos">+${money(b.week)}</div></div>
        <div class="bz-stat"><div class="bz-stat-label"><i class="fa-solid fa-trophy"></i> Ukupno zarađeno</div><div class="bz-stat-value">${money(b.earned)}</div></div>
      </div>
      <div class="bz-two">
        ${renderKasa(b, d)}
        ${renderAtm(b, d)}
      </div>
      ${renderChart(b)}
      ${renderTiers(b, d)}
      ${renderLogs(b)}
      ${renderSellState(b)}`;
  }

  // ---------- događaji ----------
  sideEl.addEventListener('click', e => {
    const btn = e.target.closest('[data-bz-select]');
    if (!btn) return;
    bz.selected = parseInt(btn.dataset.bzSelect, 10);
    bz.renaming = false;
    disarm();
    render();
    mainEl.scrollTop = 0;
  });

  function readAmount() {
    const input = document.getElementById('bz-amount');
    const v = parseInt(String(input && input.value || '').replace(/\D/g, ''), 10);
    return v > 0 ? v : null;
  }

  mainEl.addEventListener('click', e => {
    const acc = e.target.closest('[data-bz-acc]');
    if (acc) {
      const typed = document.getElementById('bz-amount');
      const keep = typed ? typed.value : '';
      bz.account = acc.dataset.bzAcc;
      render();
      const again = document.getElementById('bz-amount');
      if (again) again.value = keep;
      return;
    }

    const btn = e.target.closest('[data-bz]');
    if (!btn || btn.disabled) return;
    const b = bz.data && bz.data.businesses.find(x => x.id === bz.selected);
    if (!b) return;

    switch (btn.dataset.bz) {
      case 'gps':
        post('setWaypoint', { x: b.coords.x, y: b.coords.y });
        toast(`Navigacija je postavljena do ${isMarket(b) ? 'marketa' : 'bankomata'}.`, 'info');
        break;
      case 'take':
      case 'put': {
        const amount = readAmount();
        if (!amount) { toast('Upiši iznos.', 'error'); return; }
        action(btn.dataset.bz, { amount, account: bz.account });
        break;
      }
      case 'takeAll':
        if (arm('takeAll', btn, 'Klikni ponovo da podigneš sve')) action('takeAll', { account: bz.account });
        break;
      case 'refill':
        action('refill');
        break;
      case 'order': {
        const input = mainEl.querySelector(`[data-bz-qty="${CSS.escape(btn.dataset.item)}"]`);
        const amount = parseInt(String(input && input.value || '').replace(/\D/g, ''), 10);
        if (!amount) { toast('Upiši koliko komada naručuješ.', 'error'); return; }
        action('order', { item: btn.dataset.item, amount });
        break;
      }
      case 'orderFill':
        action('orderFill', { item: btn.dataset.item });
        break;
      case 'sellState':
        if (arm('sellState', btn, 'Klikni ponovo za prodaju')) action('sellState');
        break;
      case 'rename':
        bz.renaming = true;
        render();
        setTimeout(() => { const i = document.getElementById('bz-name'); if (i) i.focus(); }, 0);
        break;
      case 'cancelName':
        bz.renaming = false;
        render();
        break;
      case 'saveName': {
        const i = document.getElementById('bz-name');
        bz.renaming = false;
        action('rename', { name: i ? i.value : '' });
        break;
      }
    }
  });

  mainEl.addEventListener('input', e => {
    if (e.target.dataset && e.target.dataset.bzQty) {
      const digits = e.target.value.replace(/\D/g, '').slice(0, 4);
      e.target.value = digits;
      const cost = mainEl.querySelector(`[data-bz-cost="${CSS.escape(e.target.dataset.bzQty)}"]`);
      const n = parseInt(digits, 10) || 0;
      if (cost) cost.textContent = n ? `Košta ${money(n * Number(e.target.dataset.unit))}` : '';
      return;
    }
    if (e.target.id === 'bz-amount') {
      const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
      e.target.value = digits ? parseInt(digits, 10).toLocaleString('de-DE') : '';
    }
  });

  mainEl.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    if (e.target.id === 'bz-name') { const s = mainEl.querySelector('[data-bz="saveName"]'); if (s) s.click(); }
    if (e.target.id === 'bz-amount') { const s = mainEl.querySelector('[data-bz="take"]'); if (s) s.click(); }
  });

  // ---------- otvaranje / zatvaranje ----------
  function openApp() {
    homeScreen.classList.add('hidden');
    screen.classList.remove('hidden');
    load(true);
  }

  function closeApp() {
    disarm();
    bz.renaming = false;
    screen.classList.add('hidden');
    homeScreen.classList.remove('hidden');
  }

  appIcon.addEventListener('click', openApp);
  backBtn.addEventListener('click', closeApp);
  refreshBtn.addEventListener('click', () => load(true));

  // pri svakom otvaranju tableta aplikacija počinje zatvorena
  window.addEventListener('message', ({ data }) => {
    if (data && data.action === 'openTablet') {
      disarm();
      bz.renaming = false;
      screen.classList.add('hidden');
      bz.data = null;
    }
  });
})();
