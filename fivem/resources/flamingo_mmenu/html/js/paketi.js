/* ============================================================
   KUTIJE (Prodavnica -> Kutije) i MOJI PAKETI
   - grid kutija (kartice sa slikom, "Ostalo", "Imaš", cena)
   - detalj kutije: dropovi uživo, opis, velika slika, kupovina
     sa klizačem, otvaranje 1-5, brzo otvaranje, sadržaj kutije
   - rulet (više traka odjednom kad se otvara više kutija)
   - Moji paketi: aktiviraj / prodaj / otvori
   Nadovezuje se na script.js (openCategory, currentCategory...).
   ============================================================ */
(() => {
  let pkData = null;          // snapshot sa servera
  let pkTab = 'sve';          // tab u "Moji paketi"
  let pkDetail = null;        // id otvorene kutije (detalj ekran)
  let pkBuyAmount = 1;
  let pkOpenCount = 1;
  let pkBusy = false;         // čeka se odgovor servera
  let pkRoll = null;          // rulet u toku / završen, a igrač ga još nije zatvorio
  let pkRollToken = 0;
  let pkPendingData = null;   // snapshot koji stigne dok se rulet vrti
  let pkPendingDrops = [];    // dropovi koji stignu dok se rulet vrti
  let pkFast = false;

  try { pkFast = localStorage.getItem('fl_pk_fast') === '1'; } catch (e) { /* CEF bez storage-a */ }

  const SELL_DEFAULT = 0.55;
  const MAX_DROPS = 20;
  const COIN = '<img src="img/flamingo_coin.png" class="pk-coin" alt="">';

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = n => Math.floor(Number(n) || 0).toLocaleString('sr-RS');
  const kindIcon = k => ({ kutija: 'fa-box-open', vozilo: 'fa-car-side', predmet: 'fa-gun', novac: 'fa-sack-dollar' }[k] || 'fa-gift');
  const kindLabel = k => ({ kutija: 'Kutija', vozilo: 'Vozilo', predmet: 'Predmet', novac: 'Novac' }[k] || 'Paket');

  // srpska množina: 1 kutiju, 2-4 kutije, 5+ kutija (11-14 kutija)
  function kutijaWord(n) {
    const m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return 'kutiju';
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return 'kutije';
    return 'kutija';
  }

  function daysText(d) {
    d = Math.max(1, Math.floor(d));
    return d + ((d % 10 === 1 && d % 100 !== 11) ? ' dan' : ' dana');
  }

  // CEF u FiveM-u ne podržava uvek color-mix(), pa boju retkosti šaljemo i kao "r, g, b"
  function hexRgb(hex) {
    const h = String(hex || '').replace('#', '');
    if (h.length !== 6) return '127, 140, 155';
    return [0, 2, 4].map(i => parseInt(h.substr(i, 2), 16)).join(', ');
  }

  function rarity(id) {
    return (pkData && pkData.rarities && pkData.rarities[id]) || { label: 'Obično', color: '#7f8c9b' };
  }

  function rarStyle(id) {
    const r = rarity(id);
    return `--rar:${r.color};--rar-rgb:${hexRgb(r.color)}`;
  }

  function sellValue(pkg) {
    const percent = (pkData && pkData.sellPercent) || SELL_DEFAULT;
    return Math.floor((pkg.coin_value || 0) * percent);
  }

  function post(name, body) {
    return fetch(`https://${GetParentResourceName()}/${name}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {})
    }).catch(() => {});
  }

  function requestData() { post('paketiRequest'); }

  function sfx(name, opts) {
    if (window.flSound) window.flSound.play(name, opts);
  }

  function bestTier(items) {
    if (!window.flSound) return 0;
    return items.reduce((best, it) => Math.max(best, window.flSound.tierOf(it.rarity)), 0);
  }

  // Slika sa rezervnom ikonicom: ako slika ne postoji ili ne učita se, ostaje ikonica
  function art(obj, cls) {
    const icon = obj.icon || kindIcon(obj.kind);
    const img = obj.image
      ? `<img src="${esc(obj.image)}" alt="" onerror="this.parentNode.classList.remove('has-img');this.remove()">`
      : '';
    return `<div class="${cls} ${obj.image ? 'has-img' : ''}">${img}<i class="fa-solid ${esc(icon)}"></i></div>`;
  }

  // Slika kutije. Dok ne ubaciš svoje PNG-ove, crta se kofer u boji retkosti.
  function crateArt(crate, cls) {
    const img = crate.image
      ? `<img src="${esc(crate.image)}" alt="" onerror="this.parentNode.classList.remove('has-img');this.remove()">`
      : '';
    return `
      <div class="pk-crate-art ${cls} ${crate.image ? 'has-img' : ''}" style="${rarStyle(crate.rarity)}">
        ${img}
        <div class="pk-crate-fallback">
          <span class="pk-crate-glow"></span>
          <i class="fa-solid ${esc(crate.icon || 'fa-box-open')}"></i>
          <span class="pk-crate-box"><span class="pk-crate-lid"></span><b>Flamingo</b></span>
        </div>
      </div>`;
  }

  function timeChip(crate) {
    if (crate.expired) {
      return `<span class="pk-chip"><i class="fa-solid fa-clock pk-chip-off"></i><span>Više se ne prodaje</span></span>`;
    }
    if (crate.days === null || crate.days === undefined) return '';
    return `<span class="pk-chip"><i class="fa-solid fa-clock pk-chip-time"></i><span>Ostalo: <b>${daysText(crate.days)}</b></span></span>`;
  }

  function ownChip(n, long) {
    const text = long ? `Imaš <b>${num(n)}</b> ${kutijaWord(n)}` : `Imaš: <b>${num(n)}</b>`;
    return `<span class="pk-chip"><i class="fa-solid fa-square-check pk-chip-own"></i><span>${text}</span></span>`;
  }

  /* ============================================================
     PRODAVNICA -> KUTIJE (grid)
     ============================================================ */
  function crateCard(crate) {
    return `
      <button class="pk-case ${crate.expired ? 'is-expired' : ''}" data-pk-case="${esc(crate.id)}" style="${rarStyle(crate.rarity)}">
        <div class="pk-case-chips">
          ${timeChip(crate)}
          ${ownChip(crate.owned)}
        </div>
        ${crateArt(crate, 'pk-case-art')}
        <span class="pk-case-name">${esc(crate.name)}</span>
        <span class="pk-case-price">${num(crate.price)} ${COIN}</span>
      </button>`;
  }

  function renderCases(container) {
    if (!container) return;

    if (!pkData) {
      container.innerHTML = `<div class="fl-empty" style="padding-top:24px"><i class="fa-solid fa-spinner fa-spin"></i><span>Učitavanje kutija...</span></div>`;
      requestData();
      return;
    }

    if (pkDetail) return renderCaseDetail(container);

    if (!pkData.crates.length) {
      container.innerHTML = `<div class="fl-empty" style="padding-top:24px"><i class="fa-solid fa-box-open"></i><span>Trenutno nema kutija u prodaji. Nove stižu uskoro.</span></div>`;
      return;
    }

    container.innerHTML = `<div class="pk-cases">${pkData.crates.map(crateCard).join('')}</div>`;
    container.querySelectorAll('[data-pk-case]').forEach(el => {
      el.addEventListener('click', () => {
        pkDetail = el.dataset.pkCase;
        pkBuyAmount = 1;
        pkOpenCount = 1;
        renderCases(container);
        container.scrollTop = 0;
      });
    });
  }

  /* ============================================================
     DROPOVI UŽIVO (šta su igrači upravo dobili)
     ============================================================ */
  function dropCard(d, isNew) {
    return `
      <div class="pk-drop ${isNew ? 'is-new' : ''}" style="${rarStyle(d.rarity)}" title="${esc(d.crate || '')}">
        <span class="pk-drop-dot"></span>
        ${art(d, 'pk-drop-art')}
        <span class="pk-drop-name">${esc(d.label)}</span>
      </div>`;
  }

  function dropsHtml() {
    const drops = (pkData && pkData.drops) || [];
    return `
      <div class="pk-drops">
        <div class="pk-drops-label"><span>Dropovi</span><i></i></div>
        <div class="pk-drops-track" id="pkDropsTrack">
          ${drops.length
            ? drops.map(d => dropCard(d)).join('')
            : '<div class="pk-drops-empty">Ovde se pojavljuje sve što igrači dobiju iz kutija.</div>'}
        </div>
      </div>`;
  }

  function mergeDrops(list) {
    if (!pkData) return;
    const seen = new Set();
    pkData.drops = [...list, ...(pkData.drops || [])]
      .filter(d => { if (seen.has(d.id)) return false; seen.add(d.id); return true; })
      .slice(0, MAX_DROPS);
  }

  function addDropLive(drop) {
    if ((pkData.drops || []).some(d => d.id === drop.id)) return;
    mergeDrops([drop]);
    const track = document.getElementById('pkDropsTrack');
    if (!track) return;
    const empty = track.querySelector('.pk-drops-empty');
    if (empty) empty.remove();
    track.insertAdjacentHTML('afterbegin', dropCard(drop, true));
    while (track.children.length > MAX_DROPS) track.lastElementChild.remove();
  }

  /* ============================================================
     DETALJ KUTIJE
     ============================================================ */
  function itemCard(rw) {
    const rr = rarity(rw.rarity);
    return `
      <div class="pk-item" style="${rarStyle(rw.rarity)}">
        <span class="pk-item-tag"></span>
        <span class="pk-item-info">
          <i class="fa-solid fa-info"></i>
          <span class="pk-tip"><b>${esc(rr.label)}</b><span>Šansa: ${esc(rw.chance)}%</span></span>
        </span>
        ${art(rw, 'pk-item-art')}
        <span class="pk-item-name">${esc(rw.label)}</span>
      </div>`;
  }

  function openBtnText(n) {
    return n > 1 ? `Otvori ${n} ${kutijaWord(n)}` : 'Otvori kutiju';
  }

  function renderCaseDetail(container) {
    const crate = pkData.crates.find(c => c.id === pkDetail);
    if (!crate) { pkDetail = null; return renderCases(container); }

    const maxBuy = Math.max(1, pkData.maxBuy || 50);
    pkBuyAmount = Math.min(Math.max(1, pkBuyAmount), maxBuy);

    if (pkRoll && pkRoll.crateId === crate.id) return renderRollView(container, crate);

    const canOpen = crate.owned >= pkOpenCount && !pkBusy && !pkRoll;
    const rewards = (crate.rewards || []).slice().sort((a, b) => (a.chance || 0) - (b.chance || 0));
    const tChip = timeChip(crate);

    container.innerHTML = `
      <div class="pk-detail" style="${rarStyle(crate.rarity)}">
        <button class="pk-back" data-pk-back><i class="fa-solid fa-chevron-left"></i>Sve kutije</button>

        ${dropsHtml()}

        <section class="pk-stage">
          <div class="pk-desc">
            <h2>${esc(crate.name)}</h2>
            <p>${esc(crate.desc || '')}</p>
          </div>

          <div class="pk-stage-art">
            ${crateArt(crate, 'pk-hero-art')}
            ${ownChip(crate.owned, true)}
          </div>

          <div class="pk-buy">
            <h3>Kupi kutije</h3>
            ${tChip ? `<div>${tChip}</div>` : ''}
            <label class="pk-label" for="pkBuyInput">Količina kutija za kupovinu</label>
            <div class="pk-qty">
              <input id="pkBuyInput" type="number" min="1" max="${maxBuy}" value="${pkBuyAmount}" ${crate.expired ? 'disabled' : ''}>
              <span class="pk-qty-cost" id="pkQtyCost"></span>
            </div>
            <input class="pk-slider" id="pkBuySlider" type="range" min="1" max="${maxBuy}" value="${pkBuyAmount}" ${crate.expired ? 'disabled' : ''}>
            <button class="pk-btn pk-btn--primary pk-btn--wide" id="pkBuyBtn" data-sfx="none"></button>
            <span class="pk-hint pk-hint--warn" id="pkBuyHint"></span>
          </div>
        </section>

        <div class="pk-openrow">
          <span class="pk-openrow-label">Otvori kutija</span>
          <div class="pk-counts">
            ${[1, 2, 3, 4, 5].map(n => `<button class="pk-count ${pkOpenCount === n ? 'active' : ''}" data-pk-count="${n}">${n}</button>`).join('')}
          </div>
          <button class="pk-btn pk-btn--primary pk-btn--open" id="pkOpenBtn" data-sfx="none" ${canOpen ? '' : 'disabled'}>${openBtnText(pkOpenCount)}</button>
          <label class="pk-switch">
            <span>Brzo otvaranje</span>
            <input type="checkbox" id="pkFastToggle" ${pkFast ? 'checked' : ''}>
            <i></i>
          </label>
        </div>
        ${crate.owned < pkOpenCount
          ? `<span class="pk-hint pk-hint--center">${crate.owned > 0 ? `Imaš samo ${crate.owned} ${kutijaWord(crate.owned)}. Izaberi manji broj ili kupi još.` : 'Nemaš nijednu ovakvu kutiju. Kupi je gore desno.'}</span>`
          : ''}

        <h3 class="pk-title-center">Sadržaj kutije</h3>
        <div class="pk-content-grid">${rewards.map(itemCard).join('')}</div>
      </div>`;

    // --- kupovina: ažurira se bez ponovnog crtanja, da klizač ne "pukne" dok ga vučeš
    const input = container.querySelector('#pkBuyInput');
    const slider = container.querySelector('#pkBuySlider');
    const buyBtn = container.querySelector('#pkBuyBtn');
    const costEl = container.querySelector('#pkQtyCost');
    const hintEl = container.querySelector('#pkBuyHint');

    function syncBuy() {
      const cost = crate.price * pkBuyAmount;
      const missing = cost - (pkData.coins || 0);
      costEl.innerHTML = `${num(cost)} ${COIN}`;
      buyBtn.innerHTML = `Kupi za ${num(cost)} ${COIN}`;
      buyBtn.disabled = crate.expired || missing > 0 || pkBusy;
      slider.value = pkBuyAmount;
      slider.style.setProperty('--fill', `${maxBuy > 1 ? ((pkBuyAmount - 1) / (maxBuy - 1)) * 100 : 100}%`);
      if (crate.expired) hintEl.textContent = 'Ova kutija se više ne prodaje, ali one koje imaš i dalje možeš da otvoriš.';
      else if (missing > 0) hintEl.textContent = `Nedostaje ti ${num(missing)} Flamingo Coina.`;
      else hintEl.textContent = '';
    }

    slider.addEventListener('input', e => {
      const next = parseInt(e.target.value, 10) || 1;
      if (next !== pkBuyAmount) sfx('slide');
      pkBuyAmount = next;
      input.value = pkBuyAmount;
      syncBuy();
    });

    input.addEventListener('input', () => {
      const v = parseInt(input.value, 10);
      if (!Number.isNaN(v)) {
        pkBuyAmount = Math.min(Math.max(1, v), maxBuy);
        syncBuy();
      }
    });
    input.addEventListener('blur', () => { input.value = pkBuyAmount; });

    buyBtn.addEventListener('click', () => {
      if (buyBtn.disabled) return;
      pkBusy = true;
      buyBtn.disabled = true;
      buyBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Kupujem...';
      post('paketiBuy', { crateId: crate.id, amount: pkBuyAmount });
    });

    syncBuy();

    // --- navigacija / otvaranje
    container.querySelector('[data-pk-back]').addEventListener('click', () => {
      pkDetail = null;
      renderCases(container);
    });

    container.querySelectorAll('[data-pk-count]').forEach(btn => {
      btn.addEventListener('click', () => {
        pkOpenCount = parseInt(btn.dataset.pkCount, 10);
        const top = container.scrollTop;
        renderCaseDetail(container);
        container.scrollTop = top;
      });
    });

    container.querySelector('#pkFastToggle').addEventListener('change', e => {
      pkFast = e.target.checked;
      try { localStorage.setItem('fl_pk_fast', pkFast ? '1' : '0'); } catch (err) { /* nema storage-a */ }
    });

    const openBtn = container.querySelector('#pkOpenBtn');
    openBtn.addEventListener('click', () => {
      if (openBtn.disabled) return;
      pkBusy = true;
      openBtn.disabled = true;
      openBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Otvaram...';
      post('paketiOpen', { crateId: crate.id, count: pkOpenCount });
    });
  }

  /* ============================================================
     OTVARANJE: rulet direktno u stranici kutije (1-5 traka)
     Dobitak određuje server - traka samo "stane" na njemu.
     ============================================================ */
  const ROLL_WIN = 40;       // indeks dobitka na traci
  const ROLL_LEN = 46;       // ukupno polja na traci
  const ROLL_MS = 5600;      // trajanje prve trake
  const ROLL_LANE_MS = 400;  // svaka sledeća traka staje malo kasnije

  function pickWeighted(rewards) {
    // rede nagrade se na traci pojavljuju malo češće nego što je stvarna šansa,
    // samo zbog prikaza - stvarni dobitak uvek određuje server
    const weights = rewards.map(r => Math.max(Number(r.chance) || 0, 4));
    const total = weights.reduce((a, b) => a + b, 0);
    let roll = Math.random() * total;
    for (let i = 0; i < rewards.length; i++) {
      roll -= weights[i];
      if (roll <= 0) return rewards[i];
    }
    return rewards[rewards.length - 1];
  }

  function rollCard(rw, isWin) {
    const rr = rarity(rw.rarity);
    const value = Math.floor((rw.coinValue || 0) * ((pkData && pkData.sellPercent) || SELL_DEFAULT));
    return `
      <div class="pk-rs-card ${rr.highlight ? 'is-hl' : ''} ${isWin ? 'is-win' : ''}" style="${rarStyle(rw.rarity)}">
        <span class="pk-item-tag"></span>
        ${value > 0 ? `<span class="pk-rs-val">${num(value)} ${COIN}</span>` : ''}
        ${art(rw, 'pk-rs-art')}
        <span class="pk-rs-name">${esc(rw.label)}</span>
      </div>`;
  }

  function isSpinning() { return !!(pkRoll && !pkRoll.done); }
  window.pkIsSpinning = isSpinning;

  function startRoll(result) {
    const crate = pkData && pkData.crates.find(c => c.id === result.crateId);
    const items = result.opened || [];
    if (!crate || !items.length) { rerender(); return; }

    const rewards = crate.rewards && crate.rewards.length ? crate.rewards : items;
    pkRoll = {
      token: ++pkRollToken,
      crateId: crate.id,
      items,
      strips: items.map(won => {
        const strip = [];
        for (let i = 0; i < ROLL_LEN; i++) strip.push(i === ROLL_WIN ? won : pickWeighted(rewards));
        return strip;
      }),
      jitter: items.map(() => (Math.random() - 0.5) * 0.6),
      done: pkFast,   // brzo otvaranje: traka odmah stoji na dobitku
      started: false
    };

    if (pkRoll.done) sfx('win', { tier: bestTier(items) }); // brzo otvaranje

    pkDetail = crate.id;
    const onCases = typeof currentCategory !== 'undefined' && currentCategory === 'prodavnica'
      && typeof activeShopTab !== 'undefined' && activeShopTab === 'kutije';

    if (onCases) {
      const el = document.getElementById('shopTabContent');
      if (el) { renderCases(el); el.scrollTop = 0; }
    } else if (typeof openCategory === 'function') {
      // npr. "Otvori" iz Moji paketi -> prebaci na stranicu te kutije
      activeShopTab = 'kutije';
      openCategory('prodavnica');
    }
  }

  function renderRollView(container, crate) {
    const multi = pkRoll.items.length > 1;
    const rewards = (crate.rewards || []).slice().sort((a, b) => (a.chance || 0) - (b.chance || 0));

    container.innerHTML = `
      <div class="pk-detail" style="${rarStyle(crate.rarity)}">
        ${dropsHtml()}

        <section class="pk-rs ${multi ? 'is-multi' : ''} ${pkRoll.done ? 'is-done' : ''}" id="pkRollStage">
          <span class="pk-rs-line"></span>
          <div class="pk-rs-lanes">
            ${pkRoll.strips.map((strip, lane) => `
              <div class="pk-rs-window">
                <div class="pk-rs-strip" data-lane="${lane}">
                  ${strip.map((rw, i) => rollCard(rw, i === ROLL_WIN)).join('')}
                </div>
              </div>`).join('')}
          </div>
        </section>

        <div class="pk-rs-actions">
          <button class="pk-btn pk-btn--primary pk-btn--glow" id="pkRollDone" data-sfx="activate" ${pkRoll.done ? '' : 'disabled'}>
            Stavi u Moji paketi
          </button>
        </div>

        <h3 class="pk-title-center">Sadržaj kutije</h3>
        <div class="pk-content-grid">${rewards.map(itemCard).join('')}</div>
      </div>`;

    container.querySelector('#pkRollDone').addEventListener('click', () => {
      if (isSpinning()) return;
      pkRoll = null;
      flushPending();
      renderCases(container);
      container.scrollTop = 0;
    });

    // pozicioniranje traka tek kad su u DOM-u (treba nam širina)
    requestAnimationFrame(() => positionStrips(container));
  }

  function positionStrips(container) {
    if (!pkRoll) return;
    const roll = pkRoll;
    const animate = !roll.done && !roll.started;
    const strips = container.querySelectorAll('.pk-rs-strip');
    if (!strips.length) return;

    const lanes = [];

    strips.forEach((strip, lane) => {
      const a = strip.children[0], b = strip.children[1];
      if (!a || !b) return;
      const pitch = b.offsetLeft - a.offsetLeft;              // širina kartice + razmak
      const card = a.offsetWidth;
      const view = strip.parentElement.clientWidth;
      const jitter = animate ? roll.jitter[lane] * card : 0;  // ne staje uvek tačno na sredini
      const target = ROLL_WIN * pitch + card / 2 - view / 2 + jitter;
      const settled = ROLL_WIN * pitch + card / 2 - view / 2;
      strip.dataset.settled = settled;
      lanes.push({ strip, pitch, first: a.offsetLeft, view, last: null, lane });

      if (animate) {
        strip.style.transition = 'none';
        strip.style.transform = 'translateX(0px)';
        void strip.offsetWidth; // reflow, pa tek onda pokreni tranziciju
        strip.style.transition = `transform ${ROLL_MS + lane * ROLL_LANE_MS}ms cubic-bezier(0.08, 0.6, 0.1, 1)`;
        strip.style.transform = `translateX(-${target}px)`;
      } else {
        strip.style.transition = 'none';
        strip.style.transform = `translateX(-${settled}px)`;
      }
    });

    if (animate) {
      roll.started = true;
      const token = roll.token;
      sfx('spinStart');
      startTicking(token, lanes);
      setTimeout(() => finishRoll(token), ROLL_MS + (roll.items.length - 1) * ROLL_LANE_MS + 150);
    } else if (!roll.done) {
      // stranica je ponovo iscrtana usred vrćenja (npr. klik u traci) - samo prikaži kraj
      finishRoll(roll.token);
    }
  }

  // "tik" svaki put kad kartica prođe ispod zlatne linije
  function startTicking(token, lanes) {
    function frame() {
      if (!pkRoll || pkRoll.token !== token || pkRoll.done) return;
      lanes.forEach(L => {
        if (!L.strip.isConnected) return;
        let x = 0;
        try { x = -new DOMMatrixReadOnly(getComputedStyle(L.strip).transform).m41; } catch (e) { return; }
        const idx = Math.floor((x + L.view / 2 - L.first) / L.pitch);
        if (L.last !== null && idx !== L.last) sfx('tick', { pitch: 1 + L.lane * 0.07 });
        L.last = idx;
      });
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  function finishRoll(token) {
    if (!pkRoll || pkRoll.token !== token || pkRoll.done) return;
    pkRoll.done = true;
    sfx('win', { tier: bestTier(pkRoll.items) });
    const stage = document.getElementById('pkRollStage');
    if (stage) {
      stage.classList.add('is-done');
      // traka se lagano namesti tako da dobitak bude tačno na sredini
      stage.querySelectorAll('.pk-rs-strip').forEach(strip => {
        if (!strip.dataset.settled) return;
        strip.style.transition = 'transform 0.45s ease';
        strip.style.transform = `translateX(-${strip.dataset.settled}px)`;
      });
    }
    const btn = document.getElementById('pkRollDone');
    if (btn) btn.disabled = false;
  }

  function flushPending() {
    if (pkPendingData) {
      pkData = pkPendingData;
      pkPendingData = null;
    }
    if (pkPendingDrops.length && pkData) {
      mergeDrops(pkPendingDrops);
      pkPendingDrops = [];
    }
  }

  /* ============================================================
     MOJI PAKETI
     ============================================================ */
  const PK_TABS = [
    { id: 'sve', label: 'Sve', icon: 'fa-layer-group' },
    { id: 'kutija', label: 'Kutije', icon: 'fa-box-open' },
    { id: 'vozilo', label: 'Vozila', icon: 'fa-car-side' },
    { id: 'predmet', label: 'Predmeti', icon: 'fa-gun' },
    { id: 'novac', label: 'Novac', icon: 'fa-sack-dollar' }
  ];

  function packageCard(pkg) {
    const rr = rarity(pkg.rarity);
    const sell = sellValue(pkg);
    const isCase = pkg.kind === 'kutija';

    const sub = (pkg.kind === 'predmet' && pkg.value > 1) ? `${pkg.value} kom.` : kindLabel(pkg.kind);

    return `
      <div class="pk-pack" style="${rarStyle(pkg.rarity)}">
        <span class="pk-item-tag"></span>
        ${pkg.qty > 1 ? `<span class="pk-pack-qty">x${pkg.qty}</span>` : ''}
        ${art(pkg, 'pk-item-art')}
        <span class="pk-pack-name">${esc(pkg.label)}</span>
        <span class="pk-pack-sub">${esc(sub)}<b>${esc(rr.label)}</b></span>
        <div class="pk-pack-actions">
          ${isCase
            ? `<button class="pk-btn pk-btn--primary pk-btn--sm" data-pk-open="${esc(pkg.ref)}" data-sfx="none"><i class="fa-solid fa-box-open"></i> Otvori</button>`
            : `<button class="pk-btn pk-btn--primary pk-btn--sm" data-pk-activate="${pkg.id}" data-sfx="none"><i class="fa-solid fa-check"></i> Aktiviraj</button>`}
          <button class="pk-btn pk-btn--sm pk-btn--sell" data-pk-sell="${pkg.id}" data-sfx="none" ${sell > 0 ? '' : 'disabled'}>
            Prodaj za ${num(sell)} ${COIN}
          </button>
        </div>
      </div>`;
  }

  function renderPaketi() {
    const body = document.getElementById('categoryBody');
    if (!body) return;

    if (!pkData) {
      body.innerHTML = `<div class="fl-empty" style="padding-top:40px"><i class="fa-solid fa-spinner fa-spin"></i><span>Učitavanje paketa...</span></div>`;
      requestData();
      return;
    }

    const all = pkData.packages || [];
    const list = pkTab === 'sve' ? all : all.filter(p => p.kind === pkTab);
    const counts = {};
    all.forEach(p => { counts[p.kind] = (counts[p.kind] || 0) + p.qty; });
    const totalQty = all.reduce((s, p) => s + p.qty, 0);
    const totalValue = all.reduce((sum, p) => sum + sellValue(p) * p.qty, 0);

    body.innerHTML = `
      <div class="fl-settings-main-wrap">
        <div class="fl-settings-main" id="pkPaketiScroll">
          <div class="pk-head">
            <div class="pk-head-box">
              <span class="pk-head-l">Ukupno paketa</span>
              <span class="pk-head-v">${num(totalQty)}</span>
            </div>
            <div class="pk-head-box">
              <span class="pk-head-l">Vrednost pri prodaji</span>
              <span class="pk-head-v">${num(totalValue)} ${COIN}</span>
            </div>
            <div class="pk-head-box">
              <span class="pk-head-l">Tvoji Coini</span>
              <span class="pk-head-v">${num(pkData.coins)} ${COIN}</span>
            </div>
          </div>

          <div class="pk-tabs">
            ${PK_TABS.map(t => `
              <button class="pk-tab ${pkTab === t.id ? 'active' : ''}" data-pk-tab="${t.id}">
                <i class="fa-solid ${t.icon}"></i>${t.label}
                <em>${t.id === 'sve' ? totalQty : (counts[t.id] || 0)}</em>
              </button>`).join('')}
          </div>

          ${list.length
            ? `<div class="pk-packs">${list.map(packageCard).join('')}</div>`
            : `<div class="fl-empty" style="padding-top:40px">
                 <i class="fa-solid fa-boxes-stacked"></i>
                 <span>Ovde nema ništa. Kutije kupuješ u Prodavnica → Kutije, a sve što dobiješ stiže ovde.</span>
               </div>`}
        </div>
      </div>
    `;

    body.querySelectorAll('[data-pk-tab]').forEach(btn => {
      btn.addEventListener('click', () => { pkTab = btn.dataset.pkTab; renderPaketi(); });
    });

    body.querySelectorAll('[data-pk-activate]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (pkBusy) return;
        pkBusy = true;
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        post('paketiActivate', { id: parseInt(btn.dataset.pkActivate, 10) });
      });
    });

    body.querySelectorAll('[data-pk-sell]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.disabled || pkBusy) return;
        pkBusy = true;
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        post('paketiSell', { id: parseInt(btn.dataset.pkSell, 10), qty: 1 });
      });
    });

    body.querySelectorAll('[data-pk-open]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (pkBusy || pkRoll) return;
        pkBusy = true;
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        post('paketiOpen', { crateId: btn.dataset.pkOpen, count: 1 });
      });
    });
  }

  /* ============================================================
     POVEZIVANJE SA POSTOJEĆIM MENIJEM
     ============================================================ */
  function rerender() {
    if (typeof currentCategory === 'undefined') return;

    if (currentCategory === 'paketi') {
      const sc = document.getElementById('pkPaketiScroll');
      const top = sc ? sc.scrollTop : 0;
      renderPaketi();
      const sc2 = document.getElementById('pkPaketiScroll');
      if (sc2) sc2.scrollTop = top;
    }

    if (currentCategory === 'prodavnica' && typeof activeShopTab !== 'undefined' && activeShopTab === 'kutije') {
      const el = document.getElementById('shopTabContent');
      if (el) {
        const top = el.scrollTop;
        renderCases(el);
        el.scrollTop = top;
      }
    }
  }

  function syncTopbarCoins(amount) {
    if (typeof amount !== 'number') return;
    if (typeof currentPlayer !== 'undefined' && currentPlayer) currentPlayer.coins = amount;
    const el = document.getElementById('coinAmount');
    if (el) el.textContent = amount.toLocaleString('sr-RS');
  }

  if (typeof CATEGORY_META !== 'undefined') {
    CATEGORY_META.paketi = {
      title: 'Moji paketi',
      subtitle: 'Kutije, vozila, predmeti i novac koje si kupio ili osvojio',
      icon: 'fa-boxes-stacked',
      render: renderPaketi
    };
  }

  // script.js zove ove funkcije iz renderProdavnica() i iz trake
  window.pkRenderCases = renderCases;
  window.renderCrateGrid = renderCases;
  window.pkResetDetail = () => { pkDetail = null; };
  window.pkRarityInfo = id => (pkData && pkData.rarities && pkData.rarities[id]) || null;

  window.addEventListener('message', (event) => {
    const d = event.data || {};

    if (d.action === 'openMenu') {
      pkDetail = null;
      pkTab = 'sve';
      pkRoll = null;
      flushPending();
      requestData();
      return;
    }

    if (d.action === 'paketiData') {
      pkBusy = false;
      if (d.data) syncTopbarCoins(d.data.coins);
      if (pkRoll) {              // ne otkrivaj dobitak dok je rulet na ekranu
        pkPendingData = d.data;
        return;
      }
      pkData = d.data;
      rerender();
      return;
    }

    if (d.action === 'paketiDrop') {
      if (!d.drop) return;
      if (pkRoll || !pkData) { pkPendingDrops.unshift(d.drop); return; }
      addDropLive(d.drop);
      return;
    }

    if (d.action === 'paketiResult') {
      pkBusy = false;
      const r = d.result || {};
      if (r.ok && r.opened) {
        startRoll(r);
      } else if (!pkRoll) {
        rerender();
      }
    }
  });
})();
