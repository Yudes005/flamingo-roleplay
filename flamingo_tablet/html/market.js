// ============================================================
//  APLIKACIJA: MARKET (flamingo_market)
//  Oglasi za vozila, nekretnine, predmete i usluge.
//  Sve provere (vlasništvo, novac, prenos) radi flamingo_market server,
//  ovde se samo crta i šalju zahtevi.
// ============================================================
(() => {
  const appIcon = document.getElementById('app-market');
  const screen  = document.getElementById('app-screen-market');
  const backBtn = document.getElementById('market-back');
  const sideEl  = document.getElementById('mk-side');
  const mainEl  = document.getElementById('mk-main');

  const CATS = {
    vozila:     { label: 'Vozila',     icon: 'fa-solid fa-car-side' },
    nekretnine: { label: 'Nekretnine', icon: 'fa-solid fa-house' },
    predmeti:   { label: 'Predmeti',   icon: 'fa-solid fa-box-open' },
    usluge:     { label: 'Usluge',     icon: 'fa-solid fa-handshake' }
  };

  let mk = {
    view: 'browse',        // browse | mine | favorites | history | detail | new
    category: null,
    search: '',
    sort: 'new',
    page: 1,
    data: null,            // poslednji odgovor liste
    detail: null,
    busy: false,
    armed: null,
    armTimer: null,
    create: null           // stanje forme za novi oglas
  };

  const vehCache = {};     // model -> { label, brand, image }

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = n => Math.floor(Number(n) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') + '$';
  const initials = name => String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0].toUpperCase()).join('');
  const itemImg = name => `nui://ox_inventory/web/images/${name}.png`;
  const houseImg = img => !img ? null : (/^(https?:|nui:)/.test(img) ? img : `nui://flamingo_kuce/html/${img}`);
  const when = ts => {
    if (!ts) return '';
    const d = new Date(ts * 1000);
    return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
  };
  const days = ts => Math.max(0, Math.ceil((ts * 1000 - Date.now()) / 86400000));

  function toast(msg, type) {
    if (typeof showToast === 'function') showToast(esc(msg), type);
  }

  // ---------- podaci ----------
  async function loadVehicleInfo(models) {
    const need = models.filter(m => m && !vehCache[m]);
    if (!need.length) return;
    const res = await postAsync('market:vehicleInfo', { models: need });
    if (res && typeof res === 'object') Object.assign(vehCache, res);
  }

  async function loadList(keepPage) {
    if (!keepPage) mk.page = 1;
    mk.busy = true;
    renderSide();

    const res = await postAsync('market:list', {
      view: ['mine', 'favorites', 'history'].includes(mk.view) ? mk.view : 'browse',
      category: mk.category,
      search: mk.search,
      sort: mk.sort,
      page: mk.page
    });
    mk.busy = false;

    if (!res || !res.ok) {
      mk.data = null;
      mainEl.innerHTML = errorBox(res && res.error);
      return;
    }

    mk.data = res;
    await loadVehicleInfo(res.listings.filter(l => l.category === 'vozila').map(l => l.data && l.data.model));
    render();
  }

  async function openDetail(id) {
    const res = await postAsync('market:detail', { id });
    if (!res || !res.ok) return toast((res && res.error) || 'Oglas nije dostupan.', 'error');
    mk.detail = res.listing;
    if (res.listing.category === 'vozila') await loadVehicleInfo([res.listing.data && res.listing.data.model]);
    mk.view = 'detail';
    disarm();
    render();
  }

  // dvostruki klik za skidanje oglasa
  function arm(key, btn, label) {
    if (mk.armed === key) return true;
    disarm();
    mk.armed = key;
    btn.classList.add('armed');
    btn.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> ${label}`;
    mk.armTimer = setTimeout(() => { disarm(); render(); }, 3500);
    return false;
  }
  function disarm() {
    mk.armed = null;
    if (mk.armTimer) clearTimeout(mk.armTimer);
    mk.armTimer = null;
  }

  // ---------- slike i naslovi ----------
  function media(listing, big) {
    const d = listing.data || {};
    const cls = big ? 'contain' : 'contain';

    if (listing.category === 'vozila') {
      const info = vehCache[d.model] || {};
      return info.image
        ? `<img class="${cls}" src="${esc(info.image)}" onerror="this.remove()">`
        : `<span class="ph"><i class="fa-solid fa-car-side"></i></span>`;
    }
    if (listing.category === 'nekretnine') {
      const img = houseImg(d.image);
      return img ? `<img class="cover" src="${esc(img)}" onerror="this.remove()">` : `<span class="ph"><i class="fa-solid fa-house"></i></span>`;
    }
    if (listing.category === 'predmeti') {
      return `<img class="${cls}" src="${esc(itemImg(d.item))}" onerror="this.remove()">`;
    }
    return `<span class="ph"><i class="fa-solid fa-handshake"></i></span>`;
  }

  function cardTitle(listing) {
    if (listing.category === 'vozila') {
      const info = vehCache[listing.data && listing.data.model] || {};
      return info.label || listing.title;
    }
    return listing.title;
  }

  function cardSub(listing) {
    const d = listing.data || {};
    if (listing.category === 'vozila') {
      const info = vehCache[d.model] || {};
      return [info.brand, d.plate].filter(Boolean).join(' · ');
    }
    if (listing.category === 'nekretnine') return `${d.typeLabel || 'Kuća'}, ${d.street || ''}`;
    return listing.subtitle;
  }

  function badge(listing) {
    const d = listing.data || {};
    if (listing.category === 'vozila') return `<span class="mk-badge"><i class="fa-solid fa-id-card"></i>${esc(d.plate || '')}</span>`;
    if (listing.category === 'nekretnine') return `<span class="mk-badge"><i class="fa-solid fa-warehouse"></i>${d.garageSlots || 0} ${d.garageSlots === 1 ? 'mesto' : 'mesta'}</span>`;
    if (listing.category === 'predmeti') return `<span class="mk-badge"><i class="fa-solid fa-layer-group"></i>${d.count || 1} kom.</span>`;
    return `<span class="mk-badge"><i class="fa-solid fa-handshake"></i>Usluga</span>`;
  }

  // ---------- levo ----------
  function renderSide() {
    const d = mk.data;
    const counts = (d && d.counts) || {};
    const acc = (d && d.accounts) || {};

    const nav = (key, label, icon, count, active) => `
      <button class="mk-nav ${active ? 'active' : ''}" data-mk-nav="${key}">
        <i class="${icon}"></i>${label}${count !== undefined ? `<em>${count}</em>` : ''}
      </button>`;

    const browsing = ['browse', 'detail'].includes(mk.view);

    sideEl.innerHTML = `
      <div class="mk-wallet">
        <div class="mk-wallet-l">Na računu</div>
        <div class="mk-wallet-v">${money(acc.bank || 0)}</div>
        <div class="mk-wallet-s">Keš ${money(acc.money || 0)}</div>
      </div>

      <button class="mk-new" data-mk-nav="new"><i class="fa-solid fa-plus"></i> Objavi oglas</button>

      <div class="mk-sec">Kategorije</div>
      ${nav('all', 'Sve', 'fa-solid fa-grip', Object.values(counts).reduce((a, b) => a + b, 0), browsing && !mk.category)}
      ${Object.entries(CATS).map(([id, c]) => nav(id, c.label, c.icon, counts[id] || 0, browsing && mk.category === id)).join('')}

      <div class="mk-sec">Moje</div>
      ${nav('favorites', 'Omiljeno', 'fa-solid fa-heart', undefined, mk.view === 'favorites')}
      ${nav('mine', 'Moji oglasi', 'fa-solid fa-rectangle-list', undefined, mk.view === 'mine')}
      ${nav('history', 'Istorija', 'fa-solid fa-clock-rotate-left', undefined, mk.view === 'history')}
    `;
  }

  // ---------- lista ----------
  function errorBox(msg) {
    return `<div class="mk-body"><div class="mk-empty"><i class="fa-solid fa-plug-circle-xmark"></i>${esc(msg || 'Market trenutno nije dostupan.')}</div></div>`;
  }

  function topBar(title, sub, withTools) {
    return `
      <div class="mk-top">
        <div class="mk-title">${esc(title)}<span>${esc(sub)}</span></div>
        ${withTools ? `
          <label class="mk-search"><i class="fa-solid fa-magnifying-glass"></i>
            <input id="mk-search" placeholder="Pretraga oglasa..." value="${esc(mk.search)}" autocomplete="off">
          </label>
          <select class="mk-sort" id="mk-sort">
            <option value="new" ${mk.sort === 'new' ? 'selected' : ''}>Najnovije</option>
            <option value="cheap" ${mk.sort === 'cheap' ? 'selected' : ''}>Cena rastuće</option>
            <option value="expensive" ${mk.sort === 'expensive' ? 'selected' : ''}>Cena opadajuće</option>
            <option value="popular" ${mk.sort === 'popular' ? 'selected' : ''}>Najgledanije</option>
          </select>` : ''}
      </div>`;
  }

  function card(listing) {
    const showState = mk.view !== 'browse' && listing.status !== 'active';
    const stateLabel = { sold: 'Prodato', expired: 'Isteklo', cancelled: 'Skinuto', pending_return: 'Za povraćaj' }[listing.status] || 'Aktivno';

    return `
      <button class="mk-card" data-mk-open="${listing.id}">
        <div class="mk-media">
          ${media(listing)}
          ${badge(listing)}
          ${listing.status === 'active' ? `<span class="mk-fav ${listing.favorite ? 'on' : ''}" data-mk-fav="${listing.id}"><i class="fa-solid fa-heart"></i></span>` : ''}
          ${showState ? `<span class="mk-state ${listing.status}">${stateLabel}</span>` : ''}
        </div>
        <div class="mk-card-body">
          <span class="mk-card-title">${esc(cardTitle(listing))}</span>
          <span class="mk-card-sub">${esc(cardSub(listing))}</span>
          <div class="mk-card-foot">
            <span class="mk-price">${money(listing.price)}</span>
            <span class="mk-views"><i class="fa-solid fa-eye"></i>${listing.views}</span>
          </div>
        </div>
      </button>`;
  }

  function renderList() {
    const d = mk.data;
    const titles = {
      browse: mk.category ? CATS[mk.category].label : 'Svi oglasi',
      mine: 'Moji oglasi',
      favorites: 'Omiljeno',
      history: 'Istorija kupovina i prodaja'
    };
    const subs = {
      browse: `${d.total} ${d.total === 1 ? 'oglas' : 'oglasa'} na marketu`,
      mine: `Aktivnih oglasa možeš imati najviše ${d.maxListings}`,
      favorites: 'Oglasi koje si sačuvao',
      history: 'Šta si kupio i prodao'
    };

    const pages = Math.max(1, Math.ceil(d.total / d.pageSize));
    const list = d.listings.length
      ? `<div class="mk-grid">${d.listings.map(card).join('')}</div>
         ${pages > 1 ? `
         <div class="mk-pager">
           <button data-mk-page="${mk.page - 1}" ${mk.page <= 1 ? 'disabled' : ''}><i class="fa-solid fa-chevron-left"></i></button>
           <span>Strana ${mk.page} od ${pages}</span>
           <button data-mk-page="${mk.page + 1}" ${mk.page >= pages ? 'disabled' : ''}><i class="fa-solid fa-chevron-right"></i></button>
         </div>` : ''}`
      : `<div class="mk-empty"><i class="fa-solid fa-store-slash"></i><b>Nema oglasa.</b>${mk.view === 'mine' ? 'Objavi svoj prvi oglas dugmetom levo.' : 'Probaj drugu kategoriju ili pretragu.'}</div>`;

    mainEl.innerHTML = topBar(titles[mk.view], subs[mk.view], mk.view !== 'history') + `<div class="mk-body">${list}</div>`;

    const search = document.getElementById('mk-search');
    if (search) {
      search.addEventListener('input', e => {
        mk.search = e.target.value;
        clearTimeout(renderList._t);
        renderList._t = setTimeout(() => loadList(), 350);
      });
    }
    const sort = document.getElementById('mk-sort');
    if (sort) sort.addEventListener('change', e => { mk.sort = e.target.value; loadList(); });
  }

  // ---------- detalj ----------
  function spec(label, icon, value, pct) {
    return `
      <div class="mk-spec">
        <div class="mk-spec-l"><i class="${icon}"></i>${label}</div>
        <div class="mk-spec-v">${value}</div>
        ${pct !== undefined ? `<div class="mk-bar ${pct <= 35 ? 'low' : ''}"><i style="width:${Math.max(0, Math.min(100, pct))}%"></i></div>` : ''}
      </div>`;
  }

  function detailSpecs(l) {
    const d = l.data || {};

    if (l.category === 'vozila') {
      const p = d.props || {};
      const engine = Math.round((p.engineHealth ?? 1000) / 10);
      const body = Math.round((p.bodyHealth ?? 1000) / 10);
      const fuel = Math.round(p.fuelLevel ?? 100);
      const lvl = v => (v === undefined || v === null || v < 0) ? 'Fabrički' : `Nivo ${v + 1}`;
      return `
        <div class="mk-specs">
          ${spec('Motor', 'fa-solid fa-gear', `${engine}%`, engine)}
          ${spec('Karoserija', 'fa-solid fa-car-burst', `${body}%`, body)}
          ${spec('Gorivo', 'fa-solid fa-gas-pump', `${fuel}%`, fuel)}
          ${spec('Tablica', 'fa-solid fa-id-card', esc(d.plate || '-'))}
          ${spec('Tjuning motora', 'fa-solid fa-bolt', lvl(p.modEngine))}
          ${spec('Turbo', 'fa-solid fa-fan', p.modTurbo ? 'Ugrađen' : 'Nema')}
        </div>`;
    }

    if (l.category === 'nekretnine') {
      return `
        <div class="mk-specs">
          ${spec('Tip', 'fa-solid fa-house', esc(d.typeLabel || '-'))}
          ${spec('Garažna mesta', 'fa-solid fa-warehouse', d.garageSlots || 0)}
          ${spec('Krafting', 'fa-solid fa-hammer', d.crafting ? 'Ima' : 'Nema')}
          ${spec('Dnevno održavanje', 'fa-solid fa-calendar-check', money(d.daily || 0))}
          ${spec('Plaćeno do', 'fa-solid fa-clock', esc(d.paidUntil || '-'))}
          ${spec('Državna cena', 'fa-solid fa-landmark', money(d.statePrice || 0))}
        </div>`;
    }

    if (l.category === 'predmeti') {
      return `
        <div class="mk-specs">
          ${spec('Predmet', 'fa-solid fa-box', esc(d.label || d.item || '-'))}
          ${spec('Količina', 'fa-solid fa-layer-group', `${d.count || 1} kom.`)}
          ${spec('Cena po komadu', 'fa-solid fa-tag', money(Math.round(l.price / (d.count || 1))))}
          ${spec('Isporuka', 'fa-solid fa-truck-fast', 'Odmah u inventar')}
        </div>`;
    }

    return `<div class="mk-specs">${spec('Kontakt', 'fa-solid fa-phone', esc(d.phone || 'Nije ostavljen'))}${spec('Vrsta', 'fa-solid fa-handshake', 'Usluga')}</div>`;
  }

  function renderDetail() {
    const l = mk.detail;
    const d = l.data || {};
    const isService = l.category === 'usluge';
    const canBuy = l.status === 'active' && !l.mine && !isService;

    let actions = '';
    if (l.mine && l.status === 'active') {
      actions = `<button class="mk-btn danger" data-mk="cancel"><i class="fa-solid fa-trash"></i> Skini oglas</button>`;
    } else if (canBuy) {
      actions = `<button class="mk-btn primary" data-mk="buy"><i class="fa-solid fa-bag-shopping"></i> Kupi za ${money(l.price)}</button>`;
    } else if (isService && l.status === 'active') {
      actions = `<button class="mk-btn" disabled><i class="fa-solid fa-phone"></i> Javi se prodavcu${d.phone ? ` na ${esc(d.phone)}` : ''}</button>`;
    } else {
      const label = { sold: 'Oglas je prodat', expired: 'Oglas je istekao', cancelled: 'Oglas je skinut' }[l.status] || 'Oglas nije aktivan';
      actions = `<button class="mk-btn" disabled>${label}</button>`;
    }

    mainEl.innerHTML = topBar(cardTitle(l), cardSub(l), false).replace(
      '<div class="mk-title">',
      '<button class="mk-btn ghost" data-mk="back" style="height:36px;flex:none;padding:0 14px;margin-right:4px"><i class="fa-solid fa-chevron-left"></i></button><div class="mk-title">'
    ) + `
      <div class="mk-body">
        <div class="mk-detail">
          <div>
            <div class="mk-detail-media">${media(l, true)}</div>
            ${isService && d.text ? `<div class="mk-note"><b>Opis usluge</b>${esc(d.text)}</div>` : ''}
            <div class="mk-note">
              <b>Oglas</b>
              Objavljeno ${when(l.createdAt)}${l.status === 'active' ? `, ističe za ${days(l.expiresAt)} dana` : ''}.
              ${l.status === 'sold' ? `Prodato ${when(l.soldAt)}${l.buyerName ? ` igraču ${esc(l.buyerName)}` : ''}.` : ''}
            </div>
          </div>

          <div class="mk-panel">
            <div class="mk-panel-head">
              <div>
                <div class="mk-panel-title">${esc(cardTitle(l))}</div>
                <div class="mk-panel-sub">${esc(cardSub(l))}</div>
              </div>
              <div class="mk-panel-price">${money(l.price)}
                ${l.category === 'nekretnine' && d.statePrice ? `<small>državna ${money(d.statePrice)}</small>` : ''}
              </div>
            </div>

            <div class="mk-chips">
              <span class="mk-chip"><i class="${CATS[l.category].icon}"></i>${CATS[l.category].label}</span>
              <span class="mk-chip"><i class="fa-solid fa-eye"></i><b>${l.views}</b> pregleda</span>
              ${l.status === 'active' ? `<span class="mk-chip" data-mk="fav" style="cursor:pointer"><i class="fa-solid fa-heart"></i>${l.favorite ? 'Sačuvano' : 'Sačuvaj'}</span>` : ''}
            </div>

            ${detailSpecs(l)}

            <div class="mk-seller">
              <div class="mk-avatar">${esc(initials(l.seller))}</div>
              <div class="mk-seller-t"><b>${esc(l.seller)}</b><span>${l.mine ? 'Ovo je tvoj oglas' : 'Prodavac'}</span></div>
            </div>

            <div class="mk-actions">${actions}</div>
          </div>
        </div>
      </div>`;
  }

  // ---------- novi oglas ----------
  async function openCreate() {
    const res = await postAsync('market:sellables');
    if (!res || !res.ok) return toast('Ne mogu da učitam tvoje stvari.', 'error');

    await loadVehicleInfo(res.vehicles.map(v => v.props && v.props.model));
    mk.create = {
      cfg: res,
      category: 'vozila',
      pick: null,
      price: '',
      count: 1,
      title: '',
      text: '',
      phone: ''
    };
    mk.view = 'new';
    render();
  }

  function pickList() {
    const c = mk.create;
    const cfg = c.cfg;

    if (c.category === 'vozila') {
      if (!cfg.vehicles.length) return `<div class="mk-hint">Nemaš vozila u garaži. Vozilo mora biti parkirano da bi moglo da se oglasi.</div>`;
      return `<div class="mk-pick">${cfg.vehicles.map(v => {
        const info = vehCache[v.props && v.props.model] || {};
        const active = c.pick && c.pick.plate === v.plate;
        return `<button class="mk-pick-item ${active ? 'active' : ''}" data-mk-pick='${esc(JSON.stringify({ plate: v.plate, model: v.props && v.props.model }))}'>
          <span class="mk-pick-ic">${info.image ? `<img src="${esc(info.image)}" onerror="this.remove()">` : '<i class="fa-solid fa-car-side"></i>'}</span>
          <span class="mk-pick-t"><b>${esc(info.label || 'Vozilo')}</b><span>${esc(v.plate)}</span></span>
        </button>`;
      }).join('')}</div>`;
    }

    if (c.category === 'nekretnine') {
      if (!cfg.houses.length) return `<div class="mk-hint">Nemaš kuću koju možeš da oglasiš.</div>`;
      return `<div class="mk-pick">${cfg.houses.map(h => {
        const active = c.pick && c.pick.houseId === h.id;
        return `<button class="mk-pick-item ${active ? 'active' : ''}" data-mk-pick='${esc(JSON.stringify({ houseId: h.id }))}'>
          <span class="mk-pick-ic"><i class="fa-solid fa-house"></i></span>
          <span class="mk-pick-t"><b>Kuća #${h.id}</b><span>${esc(h.typeLabel || '')}, ${esc(h.street || '')}</span></span>
        </button>`;
      }).join('')}</div>`;
    }

    if (c.category === 'predmeti') {
      if (!cfg.items.length) return `<div class="mk-hint">Nemaš predmete koji mogu na market.</div>`;
      return `<div class="mk-pick">${cfg.items.map(it => {
        const active = c.pick && c.pick.item === it.item;
        return `<button class="mk-pick-item ${active ? 'active' : ''}" data-mk-pick='${esc(JSON.stringify({ item: it.item, max: it.count, label: it.label }))}'>
          <span class="mk-pick-ic"><img src="${esc(itemImg(it.item))}" onerror="this.remove()"></span>
          <span class="mk-pick-t"><b>${esc(it.label)}</b><span>imaš ${it.count} kom.</span></span>
        </button>`;
      }).join('')}</div>`;
    }

    return '';
  }

  function renderCreate() {
    const c = mk.create;
    const cfg = c.cfg;
    const isService = c.category === 'usluge';
    const isItem = c.category === 'predmeti';
    const ready = (isService ? c.text.trim().length > 4 : !!c.pick) && Number(c.price) >= cfg.minPrice;
    const fee = Math.floor((Number(c.price) || 0) * cfg.fee);

    mainEl.innerHTML = topBar('Objavi oglas', `Aktivnih oglasa: ${cfg.active} od ${cfg.maxListings}, provizija ${Math.round(cfg.fee * 100)}%`, false) + `
      <div class="mk-body">
        <div class="mk-new-grid">
          ${Object.entries(CATS).map(([id, cat]) => `
            <button class="mk-type ${c.category === id ? 'active' : ''}" data-mk-type="${id}">
              <i class="${cat.icon}"></i>${cat.label}
            </button>`).join('')}
        </div>

        <div class="mk-detail">
          <div>
            <div class="mk-label" style="margin-bottom:9px">${isService ? 'Opis usluge' : 'Izaberi šta prodaješ'}</div>
            ${isService ? `
              <div class="mk-form">
                <div class="mk-field">
                  <span class="mk-label">Naslov</span>
                  <input class="mk-input" id="mk-title" maxlength="60" placeholder="npr. Prevoz robe" value="${esc(c.title)}">
                </div>
                <div class="mk-field">
                  <span class="mk-label">Opis</span>
                  <textarea class="mk-textarea" id="mk-text" rows="5" maxlength="${cfg.serviceMaxLength}" placeholder="Šta nudiš, kada i pod kojim uslovima...">${esc(c.text)}</textarea>
                </div>
                <div class="mk-field">
                  <span class="mk-label">Telefon (nije obavezno)</span>
                  <input class="mk-input" id="mk-phone" maxlength="20" placeholder="npr. 555-1234" value="${esc(c.phone)}">
                </div>
              </div>` : pickList()}
          </div>

          <div class="mk-panel">
            <div class="mk-panel-head">
              <div>
                <div class="mk-panel-title">Detalji oglasa</div>
                <div class="mk-panel-sub">Oglas traje ${cfg.listingDays} dana</div>
              </div>
            </div>

            <div class="mk-form">
              ${isItem && c.pick ? `
                <div class="mk-field">
                  <span class="mk-label">Količina (imaš ${c.pick.max})</span>
                  <input class="mk-input" id="mk-count" type="number" min="1" max="${c.pick.max}" value="${c.count}">
                </div>` : ''}
              ${c.category === 'vozila' && c.pick ? `
                <div class="mk-field">
                  <span class="mk-label">Naslov (nije obavezno)</span>
                  <input class="mk-input" id="mk-title" maxlength="60" placeholder="${esc((vehCache[c.pick.model] || {}).label || 'Vozilo')}" value="${esc(c.title)}">
                </div>` : ''}
              <div class="mk-field">
                <span class="mk-label">Cena</span>
                <input class="mk-input" id="mk-price" type="number" min="${cfg.minPrice}" placeholder="od ${money(cfg.minPrice)}" value="${esc(c.price)}">
              </div>
            </div>

            <div class="mk-hint">
              Provizija marketa je <b>${money(fee)}</b>, a tebi ostaje <b>${money(Math.max(0, (Number(c.price) || 0) - fee))}</b>.
              ${isItem ? '<br>Predmeti se odmah skidaju sa tebe i vraćaju ti se ako skineš oglas ili istekne.' : ''}
              ${c.category === 'vozila' ? '<br>Vozilo mora ostati parkirano u garaži dok se ne proda.' : ''}
              ${c.category === 'nekretnine' ? '<br>Uz kuću idu ostava i plaćeni dani, a stanari gube ključeve.' : ''}
            </div>

            <div class="mk-actions">
              <button class="mk-btn primary" data-mk="publish" ${ready ? '' : 'disabled'}><i class="fa-solid fa-paper-plane"></i> Objavi oglas</button>
              <button class="mk-btn" data-mk="back"><i class="fa-solid fa-xmark"></i></button>
            </div>
          </div>
        </div>
      </div>`;

    const bind = (id, fn) => { const el = document.getElementById(id); if (el) el.addEventListener('input', fn); };
    bind('mk-price', e => { c.price = e.target.value; renderCreatePrice(); });
    bind('mk-count', e => { c.count = Math.max(1, Math.min(c.pick.max, parseInt(e.target.value, 10) || 1)); });
    bind('mk-title', e => { c.title = e.target.value; });
    bind('mk-text', e => { c.text = e.target.value; renderCreatePrice(); });
    bind('mk-phone', e => { c.phone = e.target.value; });
  }

  // osvežava samo dugme i proviziju, da se ne gubi fokus u poljima
  function renderCreatePrice() {
    const c = mk.create;
    const cfg = c.cfg;
    const ready = (c.category === 'usluge' ? c.text.trim().length > 4 : !!c.pick) && Number(c.price) >= cfg.minPrice;
    const fee = Math.floor((Number(c.price) || 0) * cfg.fee);

    const btn = mainEl.querySelector('[data-mk="publish"]');
    if (btn) btn.disabled = !ready;

    const hint = mainEl.querySelector('.mk-hint b');
    if (hint) {
      hint.textContent = money(fee);
      const rest = hint.parentElement.querySelectorAll('b')[1];
      if (rest) rest.textContent = money(Math.max(0, (Number(c.price) || 0) - fee));
    }
  }

  // ---------- render ----------
  function render() {
    renderSide();
    if (mk.view === 'detail') renderDetail();
    else if (mk.view === 'new') renderCreate();
    else if (mk.data) renderList();
  }

  // ---------- događaji ----------
  sideEl.addEventListener('click', e => {
    const btn = e.target.closest('[data-mk-nav]');
    if (!btn) return;
    const key = btn.dataset.mkNav;
    disarm();

    if (key === 'new') return openCreate();
    if (['favorites', 'mine', 'history'].includes(key)) {
      mk.view = key;
      mk.category = null;
    } else {
      mk.view = 'browse';
      mk.category = key === 'all' ? null : key;
    }
    mk.search = '';
    loadList();
  });

  mainEl.addEventListener('click', async e => {
    const fav = e.target.closest('[data-mk-fav]');
    if (fav) {
      e.stopPropagation();
      const id = parseInt(fav.dataset.mkFav, 10);
      const res = await postAsync('market:favorite', { id });
      if (res && res.ok) {
        const item = mk.data && mk.data.listings.find(l => l.id === id);
        if (item) item.favorite = res.favorite;
        if (mk.view === 'favorites') loadList(true); else render();
      }
      return;
    }

    const open = e.target.closest('[data-mk-open]');
    if (open) return openDetail(parseInt(open.dataset.mkOpen, 10));

    const page = e.target.closest('[data-mk-page]');
    if (page && !page.disabled) {
      mk.page = parseInt(page.dataset.mkPage, 10);
      return loadList(true);
    }

    const type = e.target.closest('[data-mk-type]');
    if (type) {
      mk.create.category = type.dataset.mkType;
      mk.create.pick = null;
      mk.create.count = 1;
      return renderCreate();
    }

    const pick = e.target.closest('[data-mk-pick]');
    if (pick) {
      mk.create.pick = JSON.parse(pick.dataset.mkPick);
      mk.create.count = 1;
      return renderCreate();
    }

    const btn = e.target.closest('[data-mk]');
    if (!btn || btn.disabled) return;

    switch (btn.dataset.mk) {
      case 'back':
        disarm();
        mk.view = ['favorites', 'mine', 'history'].includes(mk.view) ? mk.view : 'browse';
        if (mk.view === 'new') mk.view = 'browse';
        return loadList(true);

      case 'fav': {
        const res = await postAsync('market:favorite', { id: mk.detail.id });
        if (res && res.ok) { mk.detail.favorite = res.favorite; render(); }
        return;
      }

      case 'buy': {
        btn.disabled = true;
        const res = await postAsync('market:buy', { id: mk.detail.id });
        if (res && res.ok) {
          toast(res.message || 'Kupovina uspešna.', 'success');
          mk.view = 'browse';
          loadList();
        } else {
          btn.disabled = false;
          toast((res && res.error) || 'Kupovina nije uspela.', 'error');
        }
        return;
      }

      case 'cancel': {
        if (!arm('cancel', btn, 'Klikni ponovo da skineš')) return;
        const res = await postAsync('market:cancel', { id: mk.detail.id });
        if (res && res.ok) {
          toast(res.message || 'Oglas je skinut.', 'success');
          mk.view = 'mine';
          loadList();
        } else {
          toast((res && res.error) || 'Nije uspelo.', 'error');
          render();
        }
        return;
      }

      case 'publish': {
        const c = mk.create;
        btn.disabled = true;
        const payload = Object.assign(
          { category: c.category, price: parseInt(c.price, 10) || 0, title: c.title, text: c.text, phone: c.phone },
          c.pick || {},
          c.category === 'predmeti' ? { count: c.count } : {}
        );
        const res = await postAsync('market:create', payload);
        if (res && res.ok) {
          toast(res.message || 'Oglas je objavljen.', 'success');
          mk.view = 'mine';
          loadList();
        } else {
          btn.disabled = false;
          toast((res && res.error) || 'Oglas nije objavljen.', 'error');
        }
        return;
      }
    }
  });

  // ---------- otvaranje / zatvaranje ----------
  appIcon.addEventListener('click', () => {
    homeScreen.classList.add('hidden');
    screen.classList.remove('hidden');
    mk.view = 'browse';
    mk.category = null;
    mk.search = '';
    loadList();
  });

  backBtn.addEventListener('click', () => {
    disarm();
    screen.classList.add('hidden');
    homeScreen.classList.remove('hidden');
  });

  window.addEventListener('message', ({ data }) => {
    if (data && data.action === 'openTablet') {
      disarm();
      screen.classList.add('hidden');
      mk.data = null;
    }
  });
})();
