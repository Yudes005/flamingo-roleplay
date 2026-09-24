// ============================================================
//  flamingo_biznisi - prodaja biznisa igracu
//  "sell"  = prodavac bira igraca u blizini i cenu (radial meni G -> Prodaj biznis)
//  "offer" = kupac dobija ponudu i prihvata / odbija
// ============================================================
const app = document.getElementById('app');
const panel = document.getElementById('panel');

const IS_NUI = typeof GetParentResourceName === 'function';
const state = { mode: null, data: null, target: null, price: '', offerLeft: 0, timer: null };

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => Math.floor(n || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') + '$';
const priceNum = () => parseInt(String(state.price).replace(/\D/g, ''), 10) || 0;

function post(name, data) {
    if (!IS_NUI) return Promise.resolve(name === 'refreshPlayers' ? [{ id: 7, dist: 1.2 }] : {});
    return fetch(`https://${GetParentResourceName()}/${name}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=UTF-8' },
        body: JSON.stringify(data || {})
    }).then((r) => r.json()).catch(() => null);
}

function head(eyebrow, title, icon) {
    return `
        <div class="head">
            <div class="head-ico"><i class="fa-solid ${icon}"></i></div>
            <div class="head-t"><div class="eyebrow">${eyebrow}</div><h1>${esc(title)}</h1></div>
            <button class="x" data-act="close" title="Zatvori (ESC)"><i class="fa-solid fa-xmark"></i></button>
        </div>`;
}

// ---------------- prodavac ----------------
function renderSell() {
    const d = state.data;
    const players = d.players || [];
    if (state.target && !players.some((p) => p.id === state.target)) state.target = null;
    if (!state.target && players.length === 1) state.target = players[0].id;

    const p = priceNum();
    const ok = state.target && p >= d.minPrice && p <= d.maxPrice;

    panel.innerHTML = `
        ${head('Prodaja biznisa', d.name, 'fa-handshake')}
        <div class="body">
            <div class="row">
                <div class="stat"><span>Cena biznisa</span><b>${money(d.price)}</b></div>
                <div class="stat"><span>Država plaća</span><b>${money(d.stateValue)}</b></div>
            </div>

            <div class="label">Kupac (do ${d.distance} m od tebe)<button data-act="refresh"><i class="fa-solid fa-rotate-right"></i> Osveži</button></div>
            ${players.length
                ? `<div class="players">${players.map((pl) => `
                    <button class="pl ${state.target === pl.id ? 'active' : ''}" data-pl="${pl.id}"><i class="fa-solid fa-user"></i> ID ${pl.id} <small>${pl.dist} m</small></button>`).join('')}</div>`
                : `<div class="empty">Nema igrača pored tebe. Kupac mora da stoji pored tebe, pa klikni „Osveži“.</div>`}

            <div class="label">Cena</div>
            <div class="amount"><span>$</span><input id="price" inputmode="numeric" placeholder="0" value="${esc(state.price)}"></div>

            <div class="note"><i class="fa-solid fa-circle-info"></i><span>Kupac dobija ponudu i ima vremena da je prihvati. Novac ide <b>sa njegovog računa na tvoj</b>. Ono što je ostalo u kasi biznisa isplaćuje se tebi.</span></div>

            <div class="btns">
                <button class="btn" data-act="close">Otkaži</button>
                <button class="btn primary" data-act="send" ${ok ? '' : 'disabled'}><i class="fa-solid fa-paper-plane"></i> Pošalji ponudu</button>
            </div>
        </div>`;

    const input = document.getElementById('price');
    input.addEventListener('input', () => {
        const digits = input.value.replace(/\D/g, '').slice(0, 10);
        state.price = digits ? parseInt(digits, 10).toLocaleString('de-DE') : '';
        input.value = state.price;
        const btn = panel.querySelector('[data-act="send"]');
        const v = priceNum();
        btn.disabled = !(state.target && v >= d.minPrice && v <= d.maxPrice);
    });
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { const b = panel.querySelector('[data-act="send"]'); if (!b.disabled) b.click(); } });
}

// ---------------- kupac ----------------
function renderOffer() {
    const d = state.data;
    const enough = d.bank >= d.price;
    const pct = Math.max(0, Math.round(state.offerLeft / Math.max(1, d.timeout) * 100));

    panel.innerHTML = `
        ${head('Ponuda za biznis', d.name, 'fa-briefcase')}
        <div class="body">
            <div class="note"><i class="fa-solid fa-user"></i><span><b>${esc(d.seller)}</b> ti nudi svoj biznis (bankomat). Posle kupovine njime upravljaš na tabletu, aplikacija <b>Moj biznis</b>.</span></div>
            <div class="big-price">
                <span>Cena</span>
                <b>${money(d.price)}</b>
                <small>Država bi platila ${money(d.stateValue)}</small>
            </div>
            <div class="row">
                <div class="stat"><span>Na računu imaš</span><b class="${enough ? '' : 'warn'}">${money(d.bank)}</b></div>
                <div class="stat"><span>Ističe za</span><b id="left">${state.offerLeft} s</b></div>
            </div>
            <div class="timer"><div id="bar" style="width:${pct}%"></div></div>
            <div class="btns">
                <button class="btn" data-act="decline">Odbij</button>
                <button class="btn green" data-act="accept" ${enough ? '' : 'disabled'}><i class="fa-solid fa-check"></i> Prihvati i plati</button>
            </div>
        </div>`;
}

// ---------------- otvaranje / zatvaranje ----------------
function stopTimer() { if (state.timer) clearInterval(state.timer); state.timer = null; }

function show(mode, data) {
    stopTimer();
    state.mode = mode;
    state.data = data;
    app.classList.remove('hidden');
    if (mode === 'sell') {
        state.target = null;
        state.price = '';
        renderSell();
    } else {
        state.offerLeft = data.timeout || 30;
        renderOffer();
        state.timer = setInterval(() => {
            state.offerLeft -= 1;
            const l = document.getElementById('left'), b = document.getElementById('bar');
            if (l) l.textContent = `${Math.max(0, state.offerLeft)} s`;
            if (b) b.style.width = `${Math.max(0, Math.round(state.offerLeft / Math.max(1, data.timeout) * 100))}%`;
            if (state.offerLeft <= 0) respond(false);
        }, 1000);
    }
}

function hide() {
    stopTimer();
    state.mode = null;
    app.classList.add('hidden');
}

function respond(accepted) {
    if (state.mode !== 'offer') return;
    const id = state.data.id;
    hide();
    post('offerResponse', { id, accepted });
}

function close() {
    if (state.mode === 'offer') return respond(false);
    hide();
    post('close');
}

panel.addEventListener('click', async (e) => {
    const pl = e.target.closest('[data-pl]');
    if (pl) { state.target = parseInt(pl.dataset.pl, 10); return renderSell(); }

    const btn = e.target.closest('[data-act]');
    if (!btn || btn.disabled) return;
    switch (btn.dataset.act) {
        case 'close': return close();
        case 'refresh': {
            const list = await post('refreshPlayers');
            if (Array.isArray(list)) state.data.players = list;
            return renderSell();
        }
        case 'send': {
            const price = priceNum();
            hide();
            return post('sellOffer', { target: state.target, price });
        }
        case 'accept': return respond(true);
        case 'decline': return respond(false);
    }
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && state.mode) close();
});

window.addEventListener('message', ({ data }) => {
    if (!data) return;
    if (data.action === 'sell') show('sell', data.data);
    if (data.action === 'offer') show('offer', data.data);
    if (data.action === 'offerClosed' && state.mode === 'offer' && state.data.id === data.id) hide();
    if (data.action === 'close') hide();
});

// Demo u browseru: html/index.html?demo=sell ili ?demo=offer
if (!IS_NUI && location.search.includes('demo')) {
    document.body.style.background = 'linear-gradient(135deg, #3b4a5c, #1d242e)';
    const k = new URLSearchParams(location.search).get('demo');
    if (k === 'offer') show('offer', { id: 1, seller: 'Marko Petrović', name: 'Bankomat #12', price: 380000, stateValue: 225000, bank: 1250000, timeout: 30 });
    else show('sell', { id: 12, name: 'Bankomat #12', price: 450000, stateValue: 225000, balance: 18000, minPrice: 1, maxPrice: 100000000, distance: 3, players: [{ id: 7, dist: 1.2 }, { id: 23, dist: 2.6 }] });
}
