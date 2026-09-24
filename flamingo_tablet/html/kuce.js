// ============================================================
//  APLIKACIJA: NEKRETNINE (flamingo_kuce)
//  Lista kuća u kojima si vlasnik ili stanar + upravljanje:
//  vrata, stanari (dodavanje po ID-ju), navigacija, prodaja / iseljenje.
//  Sve provere radi flamingo_kuce server - ovde se samo crta.
// ============================================================
(() => {
  const appIcon = document.getElementById('app-kuce');
  const screen = document.getElementById('app-screen-kuce');
  const backBtn = document.getElementById('kuce-back');
  const sideEl = document.getElementById('kc-side');
  const mainEl = document.getElementById('kc-main');

  let kc = { data: null, selected: null, loading: false, busy: false, armed: null, armTimer: null };

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = n => Math.floor(n || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') + '$';
  const left = s => {
    s = Math.max(0, Math.floor(s));
    const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
    if (d > 0) return `${d} ${d === 1 ? 'dan' : 'dana'} ${h} h`;
    if (h > 0) return `${h} h ${m} min`;
    return `${m} min`;
  };
  const initials = name => String(name || '?').split(' ').filter(Boolean).slice(0, 2).map(p => p[0].toUpperCase()).join('');
  const imgUrl = img => !img ? null : (/^(https?:|nui:)/.test(img) ? img : `nui://flamingo_kuce/html/${img}`);

  function toast(msg, type) {
    if (typeof showToast === 'function') showToast(esc(msg), type);
  }

  // ---------- podaci ----------
  async function load(keepSelection) {
    kc.loading = true;
    if (!kc.data) renderLoading();
    const res = await postAsync('kuce:list');
    kc.loading = false;

    if (!res || !res.ok) {
      kc.data = null;
      renderError(res && res.error);
      return;
    }
    kc.data = res;
    const ids = res.houses.map(h => h.id);
    if (!keepSelection || !ids.includes(kc.selected)) kc.selected = ids[0] ?? null;
    render();
  }

  async function action(act, extra) {
    if (kc.busy || kc.selected == null) return;
    kc.busy = true;
    const res = await postAsync('kuce:action', Object.assign({ action: act, id: kc.selected }, extra || {}));
    kc.busy = false;
    disarm();
    if (res && res.ok) {
      if (res.message) toast(res.message, 'success');
    } else {
      toast((res && res.error) || 'Akcija nije uspela.', 'error');
    }
    await load(true);
  }

  // dvostruki klik za opasne akcije (prodaja / iseljenje)
  function arm(key, btn, label) {
    if (kc.armed === key) return true;
    disarm();
    kc.armed = key;
    btn.classList.add('armed');
    btn.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> ${label}`;
    kc.armTimer = setTimeout(() => { disarm(); render(); }, 3500);
    return false;
  }
  function disarm() {
    kc.armed = null;
    if (kc.armTimer) clearTimeout(kc.armTimer);
    kc.armTimer = null;
  }

  // ---------- crtanje ----------
  function renderLoading() {
    sideEl.innerHTML = '';
    mainEl.innerHTML = `<div class="kc-empty"><i class="fa-solid fa-spinner fa-spin"></i>Učitavanje...</div>`;
  }

  function renderError(err) {
    sideEl.innerHTML = '';
    mainEl.innerHTML = `<div class="kc-empty"><i class="fa-solid fa-plug-circle-xmark"></i>${esc(err || 'Sistem kuća trenutno nije dostupan.')}</div>`;
  }

  function capacityCard(g) {
    const pct = Math.min(100, Math.round((g.used / Math.max(1, g.total)) * 100));
    return `
      <div class="kc-cap">
        <div class="kc-cap-top">
          <div>
            <div class="kc-cap-label">Mesta za vozila</div>
            <div class="kc-cap-num">${g.used} <small>/ ${g.total}</small></div>
          </div>
          <div class="kc-cap-ico"><i class="fa-solid fa-car"></i></div>
        </div>
        <div class="kc-cap-bar"><div style="width:${pct}%"></div></div>
        <div class="kc-cap-split">Garaža <b>${g.base}</b> + kuće <b>${g.houses}</b> = <b>${g.total}</b> mesta</div>
      </div>`;
  }

  function render() {
    const d = kc.data;
    if (!d) return;

    const list = d.houses.map(h => {
      const img = imgUrl(h.image);
      return `
        <button class="kc-item ${h.id === kc.selected ? 'active' : ''}" data-kc-select="${h.id}">
          <div class="kc-thumb"><i class="fa-solid fa-house"></i>${img ? `<img src="${esc(img)}" onerror="this.remove()">` : ''}</div>
          <div class="kc-item-info">
            <span class="kc-item-name">Kuća #${h.id}</span>
            <span class="kc-item-sub ${h.paidLeft < 86400 ? 'kc-warn' : ''}">${h.paidLeft < 86400 ? 'Ističe za ' + left(h.paidLeft) : esc(h.street)}</span>
          </div>
          <span class="kc-badge ${h.role}">${h.role === 'owner' ? 'Vlasnik' : 'Stanar'}</span>
        </button>`;
    }).join('');

    sideEl.innerHTML = capacityCard(d.garage) + `<div class="kc-list">${list}</div>`;

    const h = d.houses.find(x => x.id === kc.selected);
    if (!h) {
      mainEl.innerHTML = `
        <div class="kc-empty">
          <i class="fa-solid fa-house-circle-xmark"></i>
          <b>Nemaš kuću.</b>
          Kuće na prodaju su označene na mapi. Priđi vratima i pritisni E da je pogledaš.
          Svaka kuća dodaje svoja garažna mesta na tvojih 10 u garaži.
        </div>`;
      return;
    }
    mainEl.innerHTML = renderDetail(h);
  }

  function renderPay(h) {
    const total = h.maxDays * 86400;
    const pct = Math.min(100, Math.round(h.paidLeft / total * 100));
    const warn = h.paidLeft < 86400;
    const opts = [1, 3, 7].filter(n => n < h.maxDays);
    const btn = (n, label) => `<button class="kc-pay-btn" data-kc-pay="${n}" ${h.payableDays < n || n < 1 ? 'disabled' : ''}>
        <span>${label}</span><b>${money(n * h.daily)}</b></button>`;
    return `
      <div class="kc-section kc-pay ${warn ? 'warn' : ''}">
        <div class="kc-section-head">
          <div>
            <div class="kc-section-title"><i class="fa-solid fa-calendar-check"></i> Održavanje, ${money(h.daily)} dnevno</div>
            <div class="kc-section-sub">${h.paidLeft > 0 ? `Plaćeno još <b>${left(h.paidLeft)}</b>` : '<b>Nije plaćeno</b>'}, najviše ${h.maxDays} dana unapred.</div>
          </div>
          ${warn ? '<span class="kc-badge locked"><i class="fa-solid fa-triangle-exclamation"></i> Ističe uskoro</span>' : ''}
        </div>
        <div class="kc-pay-bar"><div style="width:${pct}%"></div></div>
        <div class="kc-pay-row">
          ${opts.map(n => btn(n, `+${n} ${n === 1 ? 'dan' : 'dana'}`)).join('')}
          ${btn(h.payableDays, h.payableDays > 0 ? `Do ${h.maxDays} dana (+${h.payableDays})` : `Plaćeno ${h.maxDays} dana`)}
        </div>
        <div class="kc-section-sub">Ako vreme istekne, kuća se automatski prodaje državi${h.refund > 0 ? ` i dobijaš ${money(h.refund)}` : ''}. Plaća se sa bankovnog računa.</div>
      </div>`;
  }

  function renderDetail(h) {
    const isOwner = h.role === 'owner';
    const img = imgUrl(h.image);
    const full = h.residents.length >= h.maxResidents;

    const residents = h.residents.map(r => `
      <div class="kc-row">
        <div class="kc-avatar">${esc(initials(r.name))}</div>
        <span class="kc-row-name">${esc(r.name)}</span>
        ${r.owner ? '<span class="kc-badge owner"><i class="fa-solid fa-crown"></i> Vlasnik</span>' : '<span class="kc-badge resident">Stanar</span>'}
        ${isOwner && !r.owner && r.identifier ? `<button class="kc-x" data-kc-remove="${esc(r.identifier)}" title="Ukloni stanara"><i class="fa-solid fa-xmark"></i></button>` : ''}
      </div>`).join('');

    return `
      <div class="kc-hero">
        ${img ? `<img src="${esc(img)}" onerror="this.remove()">` : ''}
        <div class="kc-hero-shade"></div>
        <div class="kc-hero-content">
          <div>
            <h3>Kuća #${h.id}</h3>
            <p>${esc(h.street)}</p>
            <div class="kc-hero-badges">
              <span class="kc-badge ${h.role}">${isOwner ? 'Vlasnik' : 'Stanar'}</span>
              <span class="kc-badge ${h.locked ? 'locked' : 'open'}"><i class="fa-solid ${h.locked ? 'fa-lock' : 'fa-lock-open'}"></i> ${h.locked ? 'Zaključano' : 'Otključano'}</span>
            </div>
          </div>
          <button class="kc-btn" data-kc="gps"><i class="fa-solid fa-location-arrow"></i> Navigacija</button>
        </div>
      </div>

      <div class="kc-grid">
        <div class="kc-stat"><div class="kc-stat-label"><i class="fa-solid fa-house"></i> Tip</div><div class="kc-stat-value">${esc(h.typeLabel)}</div></div>
        <div class="kc-stat"><div class="kc-stat-label"><i class="fa-solid fa-warehouse"></i> Garaža</div><div class="kc-stat-value">${h.garageSlots} ${h.garageSlots === 1 ? 'mesto' : 'mesta'}</div></div>
        <div class="kc-stat"><div class="kc-stat-label"><i class="fa-solid fa-hammer"></i> Krafting</div><div class="kc-stat-value ${h.crafting ? 'kc-yes' : 'kc-no'}">${h.crafting ? 'Ima' : 'Nema'}</div></div>
      </div>

      ${renderPay(h)}

      <div class="kc-section">
        <div class="kc-section-head">
          <div>
            <div class="kc-section-title"><i class="fa-solid fa-door-closed"></i> Vrata</div>
            <div class="kc-section-sub">${h.locked ? 'Zaključano: ulaze samo vlasnik i stanari.' : 'Otključano: svako može da uđe u kuću.'}</div>
          </div>
          <button class="kc-btn ${h.locked ? 'primary' : ''}" data-kc="lock">
            <i class="fa-solid ${h.locked ? 'fa-lock-open' : 'fa-lock'}"></i> ${h.locked ? 'Otključaj' : 'Zaključaj'}
          </button>
        </div>
      </div>

      <div class="kc-section">
        <div class="kc-section-head">
          <div class="kc-section-title"><i class="fa-solid fa-users"></i> Stanari ${h.residents.length} / ${h.maxResidents}</div>
        </div>
        ${residents}
        ${isOwner ? `
          <div class="kc-add">
            <input class="kc-input" id="kc-target" type="number" min="1" placeholder="ID igrača" ${full ? 'disabled' : ''}>
            <button class="kc-btn primary" data-kc="add" ${full ? 'disabled' : ''}><i class="fa-solid fa-user-plus"></i> Dodaj stanara</button>
          </div>
          <div class="kc-section-sub">${full ? 'Kuća je popunjena. Ukloni stanara da bi dodao novog.' : 'Stanar dobija ključeve: ulazak u kuću, ostavu, garažu za svoja vozila i radionicu.'}</div>
        ` : ''}
      </div>

      <div class="kc-section">
        <div class="kc-section-head">
          <div>
            <div class="kc-section-title"><i class="fa-solid ${isOwner ? 'fa-hand-holding-dollar' : 'fa-door-open'}"></i> ${isOwner ? 'Prodaja' : 'Iseljenje'}</div>
            <div class="kc-section-sub">${isOwner
              ? `Država otkupljuje kuću za ${money(h.sellPrice)}. Stanari gube ključeve, ostava se prazni i gubiš ${h.garageSlots} ${h.garageSlots === 1 ? 'mesto' : 'mesta'} za vozila.`
              : 'Vraćaš ključeve vlasniku i gubiš pristup kući i garaži.'}</div>
          </div>
          <button class="kc-btn danger" data-kc="${isOwner ? 'sell' : 'leave'}">
            <i class="fa-solid ${isOwner ? 'fa-hand-holding-dollar' : 'fa-door-open'}"></i> ${isOwner ? 'Prodaj' : 'Iseli se'}
          </button>
        </div>
      </div>`;
  }

  // ---------- događaji ----------
  sideEl.addEventListener('click', e => {
    const btn = e.target.closest('[data-kc-select]');
    if (!btn) return;
    kc.selected = parseInt(btn.dataset.kcSelect, 10);
    disarm();
    render();
  });

  mainEl.addEventListener('click', e => {
    const payBtn = e.target.closest('[data-kc-pay]');
    if (payBtn && !payBtn.disabled) { action('pay', { days: parseInt(payBtn.dataset.kcPay, 10) }); return; }

    const rm = e.target.closest('[data-kc-remove]');
    if (rm) { action('removeResident', { identifier: rm.dataset.kcRemove }); return; }

    const btn = e.target.closest('[data-kc]');
    if (!btn || btn.disabled) return;
    const h = kc.data && kc.data.houses.find(x => x.id === kc.selected);
    if (!h) return;

    switch (btn.dataset.kc) {
      case 'gps':
        post('setWaypoint', { x: h.coords.x, y: h.coords.y });
        toast('Navigacija je postavljena do kuće.', 'info');
        break;
      case 'lock':
        action('lock');
        break;
      case 'add': {
        const input = document.getElementById('kc-target');
        const target = parseInt(input && input.value, 10);
        if (!target) { toast('Upiši ID igrača.', 'error'); return; }
        action('addResident', { target });
        break;
      }
      case 'sell':
        if (arm('sell', btn, 'Klikni ponovo za prodaju')) action('sell');
        break;
      case 'leave':
        if (arm('leave', btn, 'Klikni ponovo za iseljenje')) action('leave');
        break;
    }
  });

  mainEl.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.id === 'kc-target') {
      const b = mainEl.querySelector('[data-kc="add"]');
      if (b) b.click();
    }
  });

  // ---------- otvaranje / zatvaranje ----------
  function openApp() {
    homeScreen.classList.add('hidden');
    screen.classList.remove('hidden');
    load(true);
  }

  function closeApp() {
    disarm();
    screen.classList.add('hidden');
    homeScreen.classList.remove('hidden');
  }

  appIcon.addEventListener('click', openApp);
  backBtn.addEventListener('click', closeApp);

  // pri svakom otvaranju tableta aplikacija počinje zatvorena
  window.addEventListener('message', ({ data }) => {
    if (data && data.action === 'openTablet') {
      disarm();
      screen.classList.add('hidden');
      kc.data = null;
    }
  });
})();
