// ============================================================
//  flamingo_biznisi - meni kod markera (detalji biznisa + kupovina)
// ============================================================
const app = document.getElementById('app');
const panel = document.getElementById('panel');

const IS_NUI = typeof GetParentResourceName === 'function';
let state = { data: null, armed: false, armTimer: null, busy: false };

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => Math.floor(n || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') + '$';
const short = (n) => {
    n = Math.floor(n || 0);
    if (n >= 1e6) return (n / 1e6).toFixed(n % 1e6 === 0 ? 0 : 2).replace('.', ',') + 'M$';
    if (n >= 1e4) return Math.round(n / 1e3) + 'K$';
    return money(n);
};

function post(name, data) {
    if (!IS_NUI) return Promise.resolve(demoPost(name, data));
    return fetch(`https://${GetParentResourceName()}/${name}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=UTF-8' },
        body: JSON.stringify(data || {})
    }).then((r) => r.json()).catch(() => null);
}

// ------------------------------------------------------------
function status(d) {
    if (d.mine) return `<span class="pill mine"><i class="fa-solid fa-crown"></i> Tvoj biznis</span>`;
    if (d.owned) return `<span class="pill owned"><i class="fa-solid fa-user"></i> Vlasnik: ${esc(d.ownerName || 'Nepoznat')}</span>`;
    return `<span class="pill sale"><i class="fa-solid fa-tag"></i> Na prodaju</span>`;
}

function render() {
    const d = state.data;
    if (!d) return;

    const pct = Math.min(100, Math.round((d.atmCash / Math.max(1, d.atmMax)) * 100));
    const cards = (d.cards || []).map((c) => {
        const cut = Math.round((c.atmFee || 0) * (100 - (d.stateCut || 0))) / 100;
        return `
        <div class="tier ${esc(c.theme || 'dark')}">
            <div class="tier-n"><span class="tier-chip"></span>${esc(c.label)}</div>
            <div>
                <div class="tier-p">${cut}%</div>
                <div class="tier-e">Na 10.000$ dobijaš ${money(10000 * cut / 100)}</div>
            </div>
        </div>`;
    }).join('');

    let foot = '';
    if (d.mine) {
        foot = `<div class="note"><i class="fa-solid fa-tablet-screen-button"></i><span>Ovo je tvoj biznis. Kasom, zaradom i dopunom bankomata upravljaš na <b>tabletu</b>, aplikacija <b>Moj biznis</b>.</span></div>`;
    } else if (d.owned) {
        foot = `<div class="note"><i class="fa-solid fa-lock"></i><span>Ovaj bankomat već ima vlasnika. Biznisi se preprodaju na <b>aukciji</b>.</span></div>`;
    } else if (d.canBuy) {
        const limit = d.maxCount > 0 && d.myCount >= d.maxCount;
        const from = d.buyFrom === 'money' ? d.cash : (d.buyFrom === 'bank' ? d.bank : Math.max(d.bank, d.cash));
        const enough = from >= d.price;
        foot = `
            <div class="note test"><i class="fa-solid fa-flask"></i><span><b>TEST:</b> kupovina iz menija je privremena. Kasnije se biznisi kupuju na aukciji.</span></div>
            <button class="btn primary ${state.armed ? 'armed' : ''}" id="buy" ${limit || !enough || state.busy ? 'disabled' : ''}>
                <i class="fa-solid ${state.armed ? 'fa-check' : 'fa-cart-shopping'}"></i>
                ${state.armed ? 'Klikni ponovo da potvrdiš' : `Kupi za ${money(d.price)}`}
            </button>
            <div class="card-s" style="text-align:center">
                ${limit ? `Već imaš ${d.myCount} od najviše ${d.maxCount} biznisa.`
                        : `Plaća se ${d.buyFrom === 'money' ? 'gotovinom' : (d.buyFrom === 'bank' ? 'sa računa' : 'sa računa ili gotovinom')}. Na računu: <b>${money(d.bank)}</b>${enough ? '' : ' (nemaš dovoljno)'}`}
            </div>`;
    } else {
        foot = `<div class="note"><i class="fa-solid fa-gavel"></i><span>Ovaj biznis je na prodaju, ali se kupuje isključivo na <b>aukciji</b>.</span></div>`;
    }

    panel.innerHTML = `
        <div class="head">
            <div class="head-ico"><i class="fa-solid fa-money-bill-transfer"></i></div>
            <div class="head-t">
                <div class="eyebrow">Biznis · Bankomat</div>
                <h1>${esc(d.name)}</h1>
                <p><i class="fa-solid fa-location-dot"></i> ${esc(d.street || 'Los Santos')}${d.zone ? ', ' + esc(d.zone) : ''}</p>
            </div>
            <button class="x" id="close" title="Zatvori (ESC)"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="pills">
            ${status(d)}
            <span class="pill gray">ID #${d.id}</span>
            ${d.lowCash ? `<span class="pill warn"><i class="fa-solid fa-triangle-exclamation"></i> Malo gotovine</span>` : ''}
        </div>

        <div class="body">
            <div class="price">
                <div class="price-l"><span>${d.owned ? 'Vrednost biznisa' : 'Cena biznisa'}</span><b>${money(d.price)}</b></div>
                <div class="price-r">Zarada: <b>provizija</b><br>sa svakog podizanja</div>
            </div>

            <div class="card">
                <div class="card-h">
                    <div class="card-t"><i class="fa-solid fa-vault"></i> Gotovina u bankomatu</div>
                    <div class="cash-num">${short(d.atmCash)} <small>/ ${short(d.atmMax)}</small></div>
                </div>
                <div class="bar ${d.lowCash ? 'low' : ''}"><div style="width:${pct}%"></div></div>
                <div class="card-s">Kad se bankomat isprazni, igrači ne mogu da podižu novac dok ga vlasnik ne dopuni <b>transportom novca</b>.</div>
            </div>

            <div class="card">
                <div class="card-t"><i class="fa-solid fa-chart-simple"></i> Promet u poslednjih 7 dana</div>
                <div class="stats">
                    <div class="stat"><span><i class="fa-solid fa-arrow-right-arrow-left"></i> Podizanja</span><b>${d.week.count}</b></div>
                    <div class="stat"><span><i class="fa-solid fa-money-bills"></i> Isplaćeno</span><b>${short(d.week.volume)}</b></div>
                    <div class="stat"><span><i class="fa-solid fa-coins"></i> Provizija</span><b class="pos">${short(d.week.fees)}</b></div>
                </div>
            </div>

            <div class="card">
                <div class="card-h">
                    <div class="card-t"><i class="fa-solid fa-credit-card"></i> Koliko zarađuješ po kartici</div>
                </div>
                <div class="tiers">${cards}</div>
                <div class="card-s">Kad igrač podigne novac na ovom bankomatu, provizija njegove kartice ide pravo u <b>kasu biznisa</b>. Uplate su bez provizije.</div>
            </div>
        </div>

        <div class="foot">${foot}</div>`;
}

// ------------------------------------------------------------
function disarm() {
    state.armed = false;
    if (state.armTimer) clearTimeout(state.armTimer);
    state.armTimer = null;
}

async function buy() {
    if (state.busy) return;
    if (!state.armed) {
        state.armed = true;
        state.armTimer = setTimeout(() => { disarm(); render(); }, 3500);
        return render();
    }
    disarm();
    state.busy = true;
    render();
    const res = await post('buy', { id: state.data.id });
    state.busy = false;
    if (res && res.ok) state.data = res;
    render();
}

function open(data) {
    disarm();
    state.data = data;
    state.busy = false;
    panel.classList.remove('leaving');
    app.classList.remove('hidden');
    render();
}

function close(notify) {
    disarm();
    panel.classList.add('leaving');
    setTimeout(() => { app.classList.add('hidden'); panel.classList.remove('leaving'); }, 170);
    if (notify) post('close');
}

panel.addEventListener('click', (e) => {
    if (e.target.closest('#close')) return close(true);
    const b = e.target.closest('#buy');
    if (b && !b.disabled) buy();
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !app.classList.contains('hidden')) close(true);
});

window.addEventListener('message', ({ data }) => {
    if (!data) return;
    if (data.action === 'open') open(data.data);
    if (data.action === 'close') close(false);
});

// ------------------------------------------------------------
//  Demo u browseru (bez FiveM-a): otvori html/index.html?demo ili ?demo=mine
// ------------------------------------------------------------
const DEMO_CARDS = [
    { id: 'standard', label: 'Standard', atmFee: 15, theme: 'green' },
    { id: 'premium', label: 'Premium', atmFee: 10, theme: 'dark' },
    { id: 'gold', label: 'Gold', atmFee: 5, theme: 'gold' }
];
function demoData(kind) {
    return {
        ok: true, id: 12, type: 'atm', name: 'Bankomat #12', price: 450000,
        owned: kind !== 'sale', mine: kind === 'mine', ownerName: 'Marko Petrović',
        atmCash: kind === 'sale' ? 2500000 : 184000, atmMax: 2500000, lowCash: kind !== 'sale',
        week: { count: 143, volume: 3860000, fees: 412500 }, cards: DEMO_CARDS, stateCut: 0,
        canBuy: kind === 'sale', directBuy: true, myCount: 1, maxCount: 3, cash: 12400, bank: 1250000, buyFrom: 'bank',
        street: 'Vespucci Blvd / San Andreas Ave', zone: 'Pillbox Hill'
    };
}
function demoPost(name) {
    if (name === 'buy') return Object.assign(demoData('mine'), { msg: 'Kupljeno' });
    return {};
}
if (!IS_NUI && location.search.includes('demo')) {
    document.body.style.background = 'linear-gradient(135deg, #3b4a5c, #1d242e)';
    const k = new URLSearchParams(location.search).get('demo');
    open(demoData(k || 'sale'));
}
