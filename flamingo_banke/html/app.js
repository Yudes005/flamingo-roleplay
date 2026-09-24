/* ============================================================
   flamingo_banke – NUI
   ============================================================ */
const RES = typeof GetParentResourceName === 'function' ? GetParentResourceName() : 'flamingo_banke';
const IN_GAME = !!window.invokeNative;

const I = {
    bank: '<path d="M3 10l9-6 9 6M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 21h18"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
    swap: '<path d="M4 8h15l-4-4M20 16H5l4 4"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    activity: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
    in: '<path d="M17 7L7 17M7 9v8h8"/>',
    out: '<path d="M7 17L17 7M9 7h8v8"/>',
    deposit: '<path d="M12 4v11M7 10l5 5 5-5M4 20h16"/>',
    withdraw: '<path d="M12 20V9M7 14l5-5 5 5M4 4h16"/>',
    send: '<path d="M21 3L10 14M21 3l-7 18-4-7-7-4z"/>',
    trend: '<path d="M3 17l6-6 4 4 8-8M15 7h6v6"/>',
    trendDown: '<path d="M3 7l6 6 4-4 8 8M15 17h6v-6"/>',
    wallet: '<path d="M3 7a2 2 0 012-2h13v4"/><path d="M3 7v10a2 2 0 002 2h15V9H5a2 2 0 01-2-2z"/><path d="M16 14h.01"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
    pen: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
    hash: '<path d="M5 9h14M5 15h14M10 3L8 21M16 3l-2 18"/>',
    check: '<path d="M5 12l5 5L20 7"/>',
    alert: '<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/>',
    fine: '<path d="M6 2h10l4 4v16H6z"/><path d="M9 8h8M9 12h8M9 16h5"/>',
    card: '<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M2.5 10h19M6.5 15h4"/>',
    lock: '<rect x="4.5" y="10.5" width="15" height="10" rx="2"/><path d="M8 10.5V7.5a4 4 0 018 0v3"/>',
    key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M16 7l3 3M14 9l2 2"/>',
    refresh: '<path d="M20 11a8 8 0 10-2.3 5.7M20 5v6h-6"/>',
    back: '<path d="M21 6H9l-6 6 6 6h12zM17.5 9.5l-5 5M12.5 9.5l5 5"/>',
    arrowL: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
    arrowR: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
    shield: '<path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z"/><path d="M9 12l2 2 4-4"/>'
};
const icon = (n) => `<svg class="ic" viewBox="0 0 24 24">${I[n] || ''}</svg>`;

const TYPES = {
    deposit:      { label: 'Uplata',    dir: 'in'  },
    withdraw:     { label: 'Podizanje', dir: 'out' },
    transfer_in:  { label: 'Primljeno', dir: 'in'  },
    transfer_out: { label: 'Poslato',   dir: 'out' },
    income:       { label: 'Prihod',    dir: 'in'  },
    expense:      { label: 'Rashod',    dir: 'out' },
    fee:          { label: 'Provizija', dir: 'out' }
};
const FILTERS = [
    { id: 'all',          label: 'Sve' },
    { id: 'deposit',      label: 'Uplata' },
    { id: 'withdraw',     label: 'Podizanje' },
    { id: 'transfer_in',  label: 'Primljeno' },
    { id: 'transfer_out', label: 'Poslato' },
    { id: 'other',        label: 'Ostalo' }
];
const MODES = {
    deposit:  { title: 'Uplata',    sub: 'Gotovina na račun', icon: 'deposit',  verb: 'Uplati'  },
    withdraw: { title: 'Podizanje', sub: 'Račun u gotovinu',  icon: 'withdraw', verb: 'Podigni' },
    transfer: { title: 'Transfer',  sub: 'Pošalji igraču',    icon: 'send',     verb: 'Pošalji' }
};

const DEFAULT_CARDS = [
    { id: 'standard', label: 'Standard', theme: 'green', price: 0,     maintenance: 0,    atmFee: 5, atmLimit: 50000,   transferFee: 0, maxTransfer: 500000,   cashback: 0 },
    { id: 'premium',  label: 'Premium',  theme: 'dark',  price: 15000, maintenance: 1500, atmFee: 2, atmLimit: 250000,  transferFee: 0, maxTransfer: 2000000,  cashback: 1 },
    { id: 'gold',     label: 'Gold',     theme: 'gold',  price: 75000, maintenance: 5000, atmFee: 0, atmLimit: 1000000, transferFee: 0, maxTransfer: 15000000, cashback: 3 }
];

const state = {
    screen: 'bank',     // 'bank' | 'onboard' | 'pin'
    data: null,
    cfg: {},
    view: 'overview',
    filter: 'all',
    search: '',
    mode: 'deposit',
    amount: 0,
    target: '',
    memo: '',
    busy: false,
    fines: [],
    finesLoaded: false,
    finesBusy: false,
    // otvaranje racuna
    ob: { step: 1, tier: null, pin: '', stage: 1 },
    // PIN tastatura
    pads: {},
    activePad: null,
    pinError: '',
    // Moja kartica
    cardTier: null
};

/* ---------------- helpers ---------------- */
const $ = (s) => document.querySelector(s);
// 240000 -> "240.000$" (isto kao u ostalim Flamingo skriptama)
const num = (n) => Math.floor(Math.abs(n) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const money = (n) => num(n) + '$';
const short = (n) => n >= 1e6 ? (n / 1e6).toFixed(n % 1e6 ? 1 : 0) + 'M' : n >= 1e3 ? Math.round(n / 1e3) + 'k' : String(n);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const dirOf = (t) => (TYPES[t.type] || { dir: 'in' }).dir;
const labelOf = (t) => (TYPES[t.type] || { label: t.type }).label;

const cards = () => (state.cfg.cards && state.cfg.cards.length ? state.cfg.cards : DEFAULT_CARDS);
const tierById = (id) => cards().find((c) => c.id === id) || cards().find((c) => c.id === state.cfg.defaultCard) || cards()[0];
const myCard = () => (state.data && state.data.card) || null;
const myTier = () => tierById(myCard() ? myCard().tier : state.cfg.defaultCard);
const pinLen = () => state.cfg.pinLength || 4;
const maintLabel = () => (state.cfg.maintenance && state.cfg.maintenance.label) || 'nedeljno';
const maintOn = () => !state.cfg.maintenance || state.cfg.maintenance.enabled !== false;

function when(ts) {
    const diff = Math.max(0, (state.data.now || Date.now() / 1000) - ts);
    if (diff < 60) return 'upravo';
    if (diff < 3600) return `pre ${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `pre ${Math.floor(diff / 3600)}h`;
    if (diff < 86400 * 7) return `pre ${Math.floor(diff / 86400)}d`;
    const d = new Date(ts * 1000);
    return `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}.`;
}

function dateOf(ts) {
    const d = new Date(ts * 1000);
    return `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}.`;
}

function post(name, body) {
    return fetch(`https://${RES}/${name}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=UTF-8' },
        body: JSON.stringify(body || {})
    }).then((r) => r.json()).catch(() => null);
}

let toastTimer;
function toast(msg, ok = true) {
    // U igri sve notifikacije idu preko esx_notify (client.lua). Ovo je samo za demo u browseru.
    if (IN_GAME) return;
    const el = $('#toast');
    el.className = 'toast show' + (ok ? '' : ' err');
    el.innerHTML = icon(ok ? 'check' : 'alert') + `<span>${esc(msg)}</span>`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
}

function showScreen(name) {
    state.screen = name;
    $('#onboard').classList.toggle('hidden', name !== 'onboard');
    $('#pinScreen').classList.toggle('hidden', name !== 'pin');
    $('#bank').classList.toggle('hidden', name !== 'bank');
    if (name === 'bank') state.activePad = null;
}

/* ============================================================
   Kartice (vizual + paketi)
   ============================================================ */
function maskNumber(n) {
    const s = String(n || '').replace(/\s/g, '');
    if (s.length < 8) return '•••• •••• •••• ' + (s.slice(-4) || '••••');
    return `${s.slice(0, 4)} •••• •••• ${s.slice(-4)}`;
}

// Fizicka kartica (ono sto igrac "drzi")
function cardVisual(tier, opt = {}) {
    return `
    <div class="bcard t-${esc(tier.theme)} ${opt.small ? 'sm' : ''} ${opt.blocked ? 'blocked' : ''}">
        <div class="bcard-shine"></div>
        <div class="bcard-top">
            <span class="brandmark">FLAMINGO</span>
            <span class="bcard-tier">${esc(tier.label)}</span>
        </div>
        <div class="bcard-mid">
            <div class="chip"><i></i><i></i><i></i></div>
            <svg class="nfc" viewBox="0 0 24 24"><path d="M8 7c2 3 2 7 0 10M12 5c3 4 3 10 0 14M16 3c4 5 4 13 0 18"/></svg>
        </div>
        <div class="bcard-num">${esc(opt.number || '•••• •••• •••• ••••')}</div>
        <div class="bcard-bot">
            <div><span>Vlasnik</span><b>${esc((opt.name || 'Ime Prezime').toUpperCase())}</b></div>
            <div class="circles"><i></i><i></i></div>
        </div>
        ${opt.blocked ? `<div class="bcard-lock">${icon('lock')}<span>Blokirana</span></div>` : ''}
    </div>`;
}

function perkRows(t) {
    const maint = !maintOn() || !t.maintenance ? 'Besplatno' : `${money(t.maintenance)} / ${esc(maintLabel())}`;
    return [
        ['Provizija bankomata', t.atmFee ? `${t.atmFee}%` : 'Bez provizije'],
        ['Cashback', t.cashback ? `${t.cashback}%` : 'Ne'],
        ['Limit bankomata', `Do ${money(t.atmLimit)}`],
        ['Održavanje', maint],
        ['Limit transfera', `Do ${money(t.maxTransfer)}`],
        ['Provizija transfera', t.transferFee ? `${t.transferFee}%` : 'Bez provizije']
    ];
}

// Ponuda paketa (kao na slici: logo levo, naziv desno, lista pogodnosti, kvacica u sredini kad je izabrano)
function tierCard(t, opt = {}) {
    const price = t.price ? money(t.price) : 'Besplatna';
    return `
    <button class="tier t-${esc(t.theme)} ${opt.selected ? 'selected' : ''} ${opt.current ? 'current' : ''}" data-tier="${esc(t.id)}" ${opt.disabled ? 'disabled' : ''}>
        <div class="tier-head">
            <span class="brandmark">FLAMINGO</span>
            <div class="tier-name"><b>${esc(t.label)}</b><span>${price}</span></div>
        </div>
        <div class="tier-perks">
            ${perkRows(t).map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('')}
        </div>
        ${opt.current ? '<div class="tier-badge">Tvoj paket</div>' : ''}
        <div class="tier-check">${icon('check')}</div>
    </button>`;
}

/* ============================================================
   PIN tastatura
   ============================================================ */
function padHTML(name) {
    return `
    <div class="pin-dots" data-dots="${name}">${dotsHTML(name)}</div>
    <div class="keypad" data-pad="${name}">
        ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button class="key" data-key="${n}">${n}</button>`).join('')}
        <button class="key fn" data-key="clr">C</button>
        <button class="key" data-key="0">0</button>
        <button class="key fn" data-key="del" aria-label="Obriši">${icon('back')}</button>
    </div>`;
}

function dotsHTML(name) {
    const v = state.pads[name] || '';
    return Array.from({ length: pinLen() }, (_, i) => `<i class="${i < v.length ? 'on' : ''}"></i>`).join('');
}

function updateDots(name) {
    const el = document.querySelector(`[data-dots="${name}"]`);
    if (el) { el.innerHTML = dotsHTML(name); el.classList.remove('shake'); }
}

function shakeDots(name) {
    const el = document.querySelector(`[data-dots="${name}"]`);
    if (!el) return;
    el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake');
}

function padPress(name, key) {
    if (state.busy) return;
    let v = state.pads[name] || '';
    if (key === 'del') v = v.slice(0, -1);
    else if (key === 'clr') v = '';
    else if (/^\d$/.test(key) && v.length < pinLen()) v += key;
    else return;
    state.pads[name] = v;
    updateDots(name);
    if (v.length === pinLen()) setTimeout(() => onPadFull(name, v), 140);
}

function onPadFull(name, v) {
    if ((state.pads[name] || '') !== v) return;
    if (name === 'atm') return verifyPin(v);
    if (name === 'ob') return obPinDone(v);
}

/* ============================================================
   Otvaranje racuna (3 koraka)
   ============================================================ */
const OB_STEPS = ['Paket kartice', 'PIN kod', 'Potvrda'];

function renderOnboard() {
    const ob = state.ob, d = state.data;
    const tier = ob.tier ? tierById(ob.tier) : null;
    let body = '';

    if (ob.step === 1) {
        state.activePad = null;
        body = `
        <div class="ob-intro">
            <h2>Izaberi svoju karticu</h2>
            <p>Uz račun dobijaš bankovnu karticu u inventar. Paket određuje provizije i limite, a možeš ga promeniti kasnije u banci.</p>
        </div>
        <div class="tiers">${cards().map((t) => tierCard(t, { selected: ob.tier === t.id })).join('')}</div>
        <div class="ob-foot">
            <span class="ob-hint">${tier ? `Izabrano: <b>${esc(tier.label)}</b> · ${tier.price ? money(tier.price) : 'besplatno'}` : 'Klikni na karticu da je izabereš'}</span>
            <button class="btn primary lg" data-ob="next" ${tier ? '' : 'disabled'}>Dalje${icon('arrowR')}</button>
        </div>`;
    } else if (ob.step === 2) {
        state.activePad = 'ob';
        body = `
        <div class="ob-pin">
            <div class="ob-pin-card">
                ${cardVisual(tier, { name: d.name })}
                <ul class="ob-tips">
                    <li>${icon('lock')}PIN ti treba za svaki bankomat.</li>
                    <li>${icon('shield')}Ne govori PIN nikome - ni radniku banke.</li>
                    <li>${icon('key')}Zaboravljen PIN možeš resetovati na šalteru.</li>
                </ul>
            </div>
            <div class="pin-box">
                <div class="pin-head">
                    <div class="pin-ic">${icon('lock')}</div>
                    <h3>${ob.stage === 1 ? `Izaberi PIN od ${pinLen()} cifre` : 'Ponovi PIN'}</h3>
                    <p id="obPinMsg" class="${state.pinError ? 'err' : ''}">${state.pinError || (ob.stage === 1 ? 'Unesi PIN mišem ili tastaturom' : 'Unesi isti PIN još jednom radi potvrde')}</p>
                </div>
                ${padHTML('ob')}
            </div>
        </div>
        <div class="ob-foot">
            <button class="btn lg" data-ob="back">${icon('arrowL')}Nazad</button>
            <span class="ob-hint">Korak ${ob.stage === 1 ? '1' : '2'} od 2</span>
        </div>`;
    } else {
        state.activePad = null;
        const price = tier.price || 0;
        const payFrom = !price ? 'Besplatno' : d.bank >= price ? 'Sa računa' : d.cash >= price ? 'Gotovinom' : null;
        body = `
        <div class="ob-confirm">
            <div class="ob-pin-card">${cardVisual(tier, { name: d.name })}</div>
            <div class="card ob-sum">
                <h3>Pregled pre otvaranja</h3>
                <div class="sum-row"><span>Vlasnik računa</span><span>${esc(d.name)}</span></div>
                <div class="sum-row"><span>Paket kartice</span><span>${esc(tier.label)}</span></div>
                <div class="sum-row"><span>PIN</span><span class="mono">${'•'.repeat(pinLen())} ${icon('check')}</span></div>
                <div class="sum-row"><span>Održavanje</span><span>${!maintOn() || !tier.maintenance ? 'Besplatno' : `${money(tier.maintenance)} / ${esc(maintLabel())}`}</span></div>
                <div class="sum-row"><span>Plaćanje</span><span>${payFrom || '<span style="color:var(--out)">Nemaš dovoljno novca</span>'}</span></div>
                <div class="total-card card"><span class="label">Cena kartice</span><b>${price ? money(price) : 'Besplatno'}</b></div>
            </div>
        </div>
        <div class="ob-foot">
            <button class="btn lg" data-ob="back">${icon('arrowL')}Nazad</button>
            <button class="btn primary lg" data-ob="open" ${payFrom && !state.busy ? '' : 'disabled'}>${icon('card')}Otvori račun i preuzmi karticu</button>
        </div>`;
    }

    $('#onboard').innerHTML = `
    <div class="ob">
        <div class="ob-top">
            <div class="brand">
                <div class="logo">${icon('bank')}</div>
                <div class="brand-t"><strong>Flamingo</strong><span>${esc(d.place || 'Banka')}</span></div>
            </div>
            <div class="steps">
                ${OB_STEPS.map((s, i) => `<div class="step ${ob.step === i + 1 ? 'active' : ''} ${ob.step > i + 1 ? 'done' : ''}"><i>${ob.step > i + 1 ? icon('check') : i + 1}</i><span>${s}</span></div>`).join('<b class="step-line"></b>')}
            </div>
            <button class="btn icon-only" data-ob="close" title="Zatvori (ESC)">${icon('x')}</button>
        </div>
        <div class="ob-body">${body}</div>
    </div>`;
}

function obPinDone(v) {
    const ob = state.ob;
    if (ob.stage === 1) {
        ob.pin = v; ob.stage = 2; state.pads.ob = ''; state.pinError = '';
        return renderOnboard();
    }
    if (v !== ob.pin) {
        ob.pin = ''; ob.stage = 1; state.pads.ob = '';
        state.pinError = 'PIN-ovi se ne poklapaju. Pokušaj ponovo.';
        renderOnboard();
        return shakeDots('ob');
    }
    state.pinError = '';
    ob.step = 3;
    renderOnboard();
}

function obNav(action) {
    const ob = state.ob;
    if (action === 'close') return closeUI();
    if (action === 'next' && ob.tier) { ob.step = 2; ob.stage = 1; ob.pin = ''; state.pads.ob = ''; state.pinError = ''; }
    if (action === 'back') {
        if (ob.step === 2 && ob.stage === 2) { ob.stage = 1; ob.pin = ''; state.pads.ob = ''; state.pinError = ''; }
        else if (ob.step === 3) { ob.step = 2; ob.stage = 1; ob.pin = ''; state.pads.ob = ''; }
        else ob.step = 1;
    }
    if (action === 'open') return openAccount();
    renderOnboard();
}

async function openAccount() {
    if (state.busy) return;
    state.busy = true;
    renderOnboard();
    const payload = { tier: state.ob.tier, pin: state.ob.pin };
    const res = IN_GAME ? await post('openAccount', payload) : demoOpenAccount(payload);
    state.busy = false;

    if (!res || !res.ok) {
        toast((res && res.msg) || 'Otvaranje računa nije uspelo.', false);
        return renderOnboard();
    }
    toast(res.msg || 'Račun je otvoren.');
    state.ob = { step: 1, tier: null, pin: '', stage: 1 };
    openUI(res, state.cfg);
    go('card');
}

/* ============================================================
   Bankomat: PIN
   ============================================================ */
function renderPinScreen() {
    const d = state.data, c = d.card || {};
    const tier = tierById(c.tier);
    state.activePad = 'atm';
    $('#pinScreen').innerHTML = `
    <div class="atm-pin">
        <div class="atm-left">
            <div class="atm-brand"><div class="logo">${icon('bank')}</div><div class="brand-t"><strong>Flamingo</strong><span>Bankomat</span></div></div>
            ${cardVisual(tier, { name: d.name, number: `•••• •••• •••• ${c.last4 || '••••'}` })}
            <div class="atm-note">${icon('shield')}<span>Zaštiti tastaturu rukom dok unosiš PIN.</span></div>
        </div>
        <div class="pin-box">
            <div class="pin-head">
                <div class="pin-ic">${icon('lock')}</div>
                <h3>Unesi PIN</h3>
                <p id="atmPinMsg" class="${state.pinError ? 'err' : ''}">${state.pinError || `${esc(tier.label)} kartica · •••• ${esc(c.last4 || '')}`}</p>
            </div>
            ${padHTML('atm')}
            <div class="tries">${Array.from({ length: state.cfg.pinMaxTries || 3 }, (_, i) => `<i class="${i < (c.triesLeft ?? 3) ? 'on' : ''}"></i>`).join('')}<span>Preostalo pokušaja: ${c.triesLeft ?? 3}</span></div>
            <button class="btn lg wide" id="atmCancel">${icon('x')}Otkaži i vrati karticu</button>
        </div>
    </div>`;
    $('#atmCancel').addEventListener('click', closeUI);
}

async function verifyPin(pin) {
    if (state.busy) return;
    state.busy = true;
    const res = IN_GAME ? await post('verifyPin', { pin }) : demoVerifyPin(pin);
    state.busy = false;

    if (res && res.ok) {
        state.pinError = '';
        state.pads.atm = '';
        return openUI(res, state.cfg);
    }
    if (res && res.blocked) {
        if (!IN_GAME) toast(res.msg, false);
        return closeUI(true);
    }
    state.pads.atm = '';
    if (res && typeof res.triesLeft === 'number' && state.data.card) state.data.card.triesLeft = res.triesLeft;
    state.pinError = (res && res.msg) || 'Pogrešan PIN.';
    renderPinScreen();
    shakeDots('atm');
}

/* ---------------- header ---------------- */
function renderHeader() {
    const d = state.data;
    $('#balBank').textContent = money(d.bank);
    $('#balCash').textContent = money(d.cash);
    $('#acctPlace').textContent = d.kind === 'atm' ? 'Bankomat' : (d.place || 'Banka');
    $('#bank').classList.toggle('is-atm', isAtm());
    $('#brandSub').textContent = isAtm() ? 'Bankomat' : 'Banka';
    const parts = String(d.name || '').trim().split(/\s+/);
    $('#meName').textContent = d.name || '-';
    $('#avatar').textContent = ((parts[0] || '-')[0] + (parts[1] || '-')[0]).toUpperCase();

    const c = myCard();
    $('#meSub').textContent = c ? `${myTier().label} kartica` : 'Vlasnik računa';
    $('#sideCard').innerHTML = c ? `<button class="side-card-btn" data-go="${isAtm() ? '' : 'card'}">${cardVisual(myTier(), { small: true, name: d.name, number: maskNumber(c.number), blocked: c.blocked })}</button>` : '';
    $('#cardDot').classList.toggle('hidden', !cardIssue());

    document.querySelectorAll('.nav-btn[data-view]').forEach((b) => b.classList.toggle('active', b.dataset.view === state.view));
    document.querySelectorAll('.nav-btn[data-atm-mode]').forEach((b) => b.classList.toggle('active', b.dataset.atmMode === state.mode));
}

// Sta nije u redu sa karticom (za upozorenja)
function cardIssue() {
    const c = myCard();
    if (!c) return null;
    if (c.blocked) return { title: 'Kartica je blokirana', text: 'Previše pogrešnih PIN-ova. Postavi novi PIN da je odblokiraš.' };
    if (!c.hasPin) return { title: 'Kartica nema PIN', text: 'Postavi PIN da bi mogao da koristiš bankomate.' };
    if (!c.hasItem && state.cfg.cardItem !== false) return { title: 'Nemaš karticu kod sebe', text: 'Izgubio si karticu? Zatraži novu ovde na šalteru.' };
    return null;
}

/* ---------------- statistika ---------------- */
function periodTx() {
    const from = state.data.now - (state.cfg.statsDays || 30) * 86400;
    return state.data.transactions.filter((t) => t.ts >= from);
}

function txRow(t) {
    const dir = dirOf(t);
    return `
    <div class="tx">
        <div class="tx-ic ${dir}">${icon(dir)}</div>
        <div class="tx-t"><strong>${esc(t.title)}</strong><span>${esc(t.memo || '—')}</span></div>
        <div class="tx-party">${esc(t.party || '—')}</div>
        <div class="pill">${esc(labelOf(t))}</div>
        <div class="amt ${dir}">${dir === 'in' ? '+' : '-'}${money(t.amount)}</div>
        <div class="when">${when(t.ts)}</div>
    </div>`;
}

const txHead = `
    <div class="tx tx-head">
        <div></div><div>Opis</div><div class="h-party">Strana</div><div class="h-type">Tip</div>
        <div class="r">Iznos</div><div class="r">Kada</div>
    </div>`;

function niceMax(v) {
    const p = Math.pow(10, Math.floor(Math.log10(v)));
    const n = v / p;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}

function chartSVG(txs) {
    const days = state.cfg.statsDays || 30;
    const W = 620, H = 200, L = 36, R = 8, T = 10, B = 22;
    const today = new Date(state.data.now * 1000); today.setHours(0, 0, 0, 0);
    const start = today.getTime() / 1000 - (days - 1) * 86400;

    const inA = new Array(days).fill(0), outA = new Array(days).fill(0);
    txs.forEach((t) => {
        const i = Math.floor((t.ts - start) / 86400);
        if (i >= 0 && i < days) (dirOf(t) === 'in' ? inA : outA)[i] += t.amount;
    });

    const max = niceMax(Math.max(1000, ...inA, ...outA));
    const x = (i) => L + (i * (W - L - R)) / (days - 1);
    const y = (v) => H - B - (v / max) * (H - B - T);

    const line = (a) => a.map((v, i) => {
        if (i === 0) return `M${x(0)},${y(v)}`;
        const mx = (x(i - 1) + x(i)) / 2;
        return `C${mx},${y(a[i - 1])} ${mx},${y(v)} ${x(i)},${y(v)}`;
    }).join(' ');
    const area = (a) => `${line(a)} L${x(days - 1)},${y(0)} L${x(0)},${y(0)} Z`;

    let grid = '';
    for (let k = 0; k <= 5; k++) {
        const v = (max / 5) * k;
        grid += `<line class="grid-l" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/>`;
        grid += `<text class="ax" x="${L - 6}" y="${y(v) + 3}" text-anchor="end">${short(v)}</text>`;
    }
    let labels = '';
    for (let i = 0; i < days; i += Math.ceil(days / 10)) {
        const d = new Date((start + i * 86400) * 1000);
        labels += `<text class="ax" x="${x(i)}" y="${H - 6}" text-anchor="middle">${d.getDate()}.${d.getMonth() + 1}.</text>`;
    }

    return `
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Primljen i potrošen novac po danima">
        <defs>
            <linearGradient id="gIn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3ddc97" stop-opacity=".35"/><stop offset="1" stop-color="#3ddc97" stop-opacity="0"/></linearGradient>
            <linearGradient id="gOut" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff6a3d" stop-opacity=".30"/><stop offset="1" stop-color="#ff6a3d" stop-opacity="0"/></linearGradient>
        </defs>
        ${grid}
        <path d="${area(outA)}" fill="url(#gOut)"/>
        <path d="${line(outA)}" fill="none" stroke="#ff6a3d" stroke-width="1.8"/>
        <path d="${area(inA)}" fill="url(#gIn)"/>
        <path d="${line(inA)}" fill="none" stroke="#3ddc97" stroke-width="1.8"/>
        ${labels}
    </svg>`;
}

function donutSVG(bank, cash) {
    const total = bank + cash;
    const r = 52, c = 2 * Math.PI * r;
    const bankLen = total > 0 ? (bank / total) * c : 0;
    const gap = bank > 0 && cash > 0 ? 3 : 0;
    return `
    <svg width="150" height="150" viewBox="0 0 150 150">
        <circle cx="75" cy="75" r="${r}" fill="none" stroke="rgba(255,255,255,.05)" stroke-width="16"/>
        ${cash > 0 ? `<circle cx="75" cy="75" r="${r}" fill="none" stroke="#7a1d45" stroke-width="16"
            stroke-dasharray="${Math.max(0, c - bankLen - gap)} ${c}" stroke-dashoffset="${-(bankLen + gap / 2)}" transform="rotate(-90 75 75)"/>` : ''}
        ${bank > 0 ? `<circle cx="75" cy="75" r="${r}" fill="none" stroke="#ff2f7e" stroke-width="16"
            stroke-dasharray="${Math.max(0, bankLen - gap)} ${c}" stroke-dashoffset="${-gap / 2}" transform="rotate(-90 75 75)"/>` : ''}
    </svg>`;
}

function issueBanner() {
    const issue = cardIssue();
    if (!issue || isAtm()) return '';
    return `
    <div class="banner">
        <div class="banner-ic">${icon('alert')}</div>
        <div class="banner-t"><strong>${issue.title}</strong><span>${issue.text}</span></div>
        <button class="btn sm primary" data-go="card">Reši odmah${icon('arrowR')}</button>
    </div>`;
}

/* ---------------- Pregled ---------------- */
function renderOverview() {
    const d = state.data;
    const txs = periodTx();
    const inSum = txs.filter((t) => dirOf(t) === 'in').reduce((s, t) => s + t.amount, 0);
    const outSum = txs.filter((t) => dirOf(t) === 'out').reduce((s, t) => s + t.amount, 0);
    const outCount = txs.filter((t) => dirOf(t) === 'out').length;
    const net = inSum - outSum;
    const avg = txs.length ? Math.round((inSum + outSum) / txs.length) : 0;
    const days = state.cfg.statsDays || 30;
    const total = d.bank + d.cash;
    const pct = (v) => (total > 0 ? Math.round((v / total) * 100) : 0);
    const recent = d.transactions.slice(0, 5);

    $('#view').innerHTML = `
    ${issueBanner()}
    <div class="stats">
        <div class="card stat">
            <div class="stat-h"><span class="label">Primljeno</span><div class="badge in">${icon('deposit')}</div></div>
            <div class="val">${money(inSum)}</div>
            <div class="sub">u poslednjih ${days} dana</div>
        </div>
        <div class="card stat">
            <div class="stat-h"><span class="label">Potrošeno</span><div class="badge out">${icon('withdraw')}</div></div>
            <div class="val">${money(outSum)}</div>
            <div class="sub">kroz ${outCount} ${outCount === 1 ? 'isplatu' : 'isplata'}</div>
        </div>
        <div class="card stat">
            <div class="stat-h"><span class="label">Bilans</span><div class="badge">${icon(net >= 0 ? 'trend' : 'trendDown')}</div></div>
            <div class="val" style="color:${net < 0 ? 'var(--out)' : 'var(--text)'}">${net < 0 ? '-' : ''}${money(net)}</div>
            <div class="sub">primljeno minus potrošeno</div>
        </div>
        <div class="card stat">
            <div class="stat-h"><span class="label">Prosečna transakcija</span><div class="badge">${icon('wallet')}</div></div>
            <div class="val">${money(avg)}</div>
            <div class="sub">od ukupno ${txs.length} ${txs.length === 1 ? 'transakcije' : 'transakcija'}</div>
        </div>
    </div>

    <div class="row2">
        <div class="card">
            <div class="card-h">
                <div><h3>Kretanje novca</h3><p>Koliko je novca ušlo i izašlo sa računa, dan po dan</p></div>
                <div class="legend"><span><i style="background:var(--in)"></i>Primljeno</span><span><i style="background:var(--out)"></i>Potrošeno</span></div>
            </div>
            <div class="chart">${chartSVG(txs)}</div>
        </div>
        <div class="card">
            <div class="card-h"><div><h3>Raspodela</h3><p>Gde ti je novac</p></div></div>
            <div class="donut">
                ${donutSVG(d.bank, d.cash)}
                <div class="donut-center"><div><b>${short(total)}</b><span>Ukupno</span></div></div>
            </div>
            <div class="dist">
                <div class="dist-row"><i class="sw" style="background:#ff2f7e"></i>Na računu (${pct(d.bank)}%)<b>${money(d.bank)}</b></div>
                <div class="dist-row"><i class="sw" style="background:#7a1d45"></i>Gotovina kod sebe (${pct(d.cash)}%)<b>${money(d.cash)}</b></div>
            </div>
        </div>
    </div>

    <div class="card recent">
        <div class="card-h">
            <div><h3>Poslednje transakcije</h3><p>Najnovija aktivnost na računu</p></div>
            <button class="link" data-go="history">Prikaži sve</button>
        </div>
        ${recent.length ? recent.map(txRow).join('') : '<div class="empty">Još nema transakcija. Uplati gotovinu na račun da počneš.</div>'}
    </div>`;
}

/* ---------------- Istorija ---------------- */
function filteredTx() {
    const q = state.search.trim().toLowerCase();
    return state.data.transactions.filter((t) => {
        if (state.filter === 'other') { if (!['income', 'expense', 'fee'].includes(t.type)) return false; }
        else if (state.filter !== 'all' && t.type !== state.filter) return false;
        if (!q) return true;
        return [t.title, t.memo, t.party].some((v) => String(v || '').toLowerCase().includes(q));
    });
}

function renderHistory() {
    $('#view').innerHTML = `
    <div class="card">
        <div class="hist-top">
            <label class="search">${icon('search')}<input id="search" placeholder="Pretraži opis, napomenu, stranu..." value="${esc(state.search)}"></label>
            <div class="filters">
                ${FILTERS.map((f) => `<button class="chip ${state.filter === f.id ? 'active' : ''}" data-filter="${f.id}">${f.label}</button>`).join('')}
            </div>
        </div>
        <div class="hist-sum" id="histSum"></div>
        ${txHead}
        <div id="histList"></div>
    </div>`;
    $('#search').addEventListener('input', (e) => { state.search = e.target.value; renderHistoryList(); });
    renderHistoryList();
}

function renderHistoryList() {
    const list = filteredTx();
    const inSum = list.filter((t) => dirOf(t) === 'in').reduce((s, t) => s + t.amount, 0);
    const outSum = list.filter((t) => dirOf(t) === 'out').reduce((s, t) => s + t.amount, 0);
    $('#histSum').innerHTML = `
        <div><span class="label">Prikazano</span><b>${list.length} od ${state.data.transactions.length}</b></div>
        <div><span class="label">Ukupno primljeno</span><b style="color:var(--in)">+${money(inSum)}</b></div>
        <div><span class="label">Ukupno poslato</span><b style="color:var(--out)">-${money(outSum)}</b></div>`;
    $('#histList').innerHTML = list.length
        ? list.map(txRow).join('')
        : `<div class="empty">${state.search || state.filter !== 'all' ? 'Nema transakcija za ovu pretragu. Promeni filter ili obriši tekst.' : 'Još nema transakcija.'}</div>`;
}

/* ---------------- Moja kartica ---------------- */
function pinField(id, label) {
    return `
    <div class="field">
        <span class="label">${label}</span>
        <label class="input pin-input">${icon('lock')}<input id="${id}" type="password" inputmode="numeric" maxlength="${pinLen()}" placeholder="${'•'.repeat(pinLen())}" autocomplete="off"></label>
    </div>`;
}

function renderCard() {
    const d = state.data, c = myCard();
    if (!c) {
        $('#view').innerHTML = '<div class="card"><div class="empty">Kartica nije dostupna.</div></div>';
        return;
    }
    const tier = myTier();
    const sel = state.cardTier && state.cardTier !== tier.id ? tierById(state.cardTier) : null;
    const reissueFee = state.cfg.reissueFee || 0;
    const resetFee = state.cfg.pinResetFee || 0;
    const needItem = state.cfg.cardItem !== false;
    const status = c.blocked ? ['bad', 'Blokirana'] : !c.hasPin ? ['warn', 'Bez PIN-a'] : ['ok', 'Aktivna'];

    let tierAction = '<span class="ob-hint">Klikni na paket da vidiš cenu prelaska.</span>';
    if (sel) {
        const up = (sel.price || 0) > (tier.price || 0);
        tierAction = `
            <span class="ob-hint">${up ? `Prelazak na <b>${esc(sel.label)}</b> košta <b>${money(sel.price)}</b> (sa računa).` : `Prelazak na <b>${esc(sel.label)}</b> je besplatan.`}</span>
            <button class="btn primary" data-card-op="tier" ${state.busy ? 'disabled' : ''}>${icon('refresh')}Pređi na ${esc(sel.label)}</button>`;
    }

    $('#view').innerHTML = `
    <div class="card-grid">
        <div class="card my-card">
            <div class="card-h"><div><h3>Moja kartica</h3><p>Tvoja bankovna kartica i njen status</p></div><span class="status ${status[0]}">${status[1]}</span></div>
            ${cardVisual(tier, { name: d.name, number: c.number, blocked: c.blocked })}
            <div class="facts">
                <div><span class="label">Paket</span><b>${esc(tier.label)}</b></div>
                <div><span class="label">PIN</span><b>${c.hasPin ? 'Postavljen' : 'Nije postavljen'}</b></div>
                <div><span class="label">Kartica u inventaru</span><b class="${c.hasItem || !needItem ? '' : 'bad'}">${c.hasItem || !needItem ? 'Da' : 'Ne'}</b></div>
                <div><span class="label">Sledeće održavanje</span><b>${c.feeDue && tier.maintenance && maintOn() ? `${dateOf(c.feeDue)} · ${money(tier.maintenance)}` : 'Nema'}</b></div>
            </div>
        </div>

        <div class="card-actions">
            <div class="card act-card">
                <div class="act-h"><div class="act-ic">${icon('card')}</div><div><h3>Nova kartica</h3><p>Izgubio si karticu ili ti je ukradena? Stara prestaje da važi.</p></div></div>
                ${needItem && !c.hasItem
                    ? `<button class="btn primary wide" data-card-op="reissue" ${state.busy ? 'disabled' : ''}>${icon('card')}Zatraži novu karticu${reissueFee ? ` · ${money(reissueFee)}` : ''}</button>`
                    : `<div class="ok-note">${icon('check')}Kartica je kod tebe u inventaru.</div>`}
            </div>

            ${c.hasPin ? `
            <div class="card act-card">
                <div class="act-h"><div class="act-ic">${icon('key')}</div><div><h3>Promeni PIN</h3><p>Unesi stari PIN, pa novi dva puta.</p></div></div>
                <div class="pin-fields">
                    ${pinField('pinOld', 'Stari PIN')}
                    ${pinField('pinNew', 'Novi PIN')}
                    ${pinField('pinNew2', 'Ponovi novi PIN')}
                </div>
                <button class="btn primary wide" data-card-op="changePin" ${state.busy ? 'disabled' : ''}>${icon('check')}Sačuvaj novi PIN</button>
            </div>` : ''}

            <div class="card act-card ${c.blocked || !c.hasPin ? 'hl' : ''}">
                <div class="act-h"><div class="act-ic">${icon('lock')}</div><div>
                    <h3>${c.hasPin ? 'Zaboravio sam PIN' : 'Postavi PIN'}</h3>
                    <p>${c.hasPin ? `Službenik proverava tvoj identitet i postavlja novi PIN${resetFee ? ` (${money(resetFee)})` : ''}. Ovo i odblokira karticu.` : 'Tvoja kartica još nema PIN. Postavljanje je besplatno.'}</p>
                </div></div>
                <div class="pin-fields two">
                    ${pinField('pinReset', 'Novi PIN')}
                    ${pinField('pinReset2', 'Ponovi novi PIN')}
                </div>
                <button class="btn ${c.blocked || !c.hasPin ? 'primary' : ''} wide" data-card-op="resetPin" ${state.busy ? 'disabled' : ''}>${icon('refresh')}${c.hasPin ? `Resetuj PIN${resetFee ? ` · ${money(resetFee)}` : ''}` : 'Postavi PIN'}</button>
            </div>
        </div>
    </div>

    <div class="card">
        <div class="card-h"><div><h3>Paketi kartica</h3><p>Uporedi pakete i pređi na drugi kad god želiš</p></div></div>
        <div class="tiers">${cards().map((t) => tierCard(t, { current: t.id === tier.id, selected: sel ? t.id === sel.id : t.id === tier.id })).join('')}</div>
        <div class="tier-foot">${tierAction}</div>
    </div>`;

    document.querySelectorAll('.pin-input input').forEach((el) => el.addEventListener('input', () => { el.value = el.value.replace(/\D/g, '').slice(0, pinLen()); }));
}

async function cardOp(op) {
    if (state.busy) return;
    const val = (id) => ($(id) ? $(id).value : '');
    const re = new RegExp(`^\\d{${pinLen()}}$`);
    let payload = { op };

    if (op === 'changePin') {
        if (!re.test(val('#pinOld'))) return toast(`Unesi stari PIN (${pinLen()} cifre).`, false);
        if (!re.test(val('#pinNew'))) return toast(`Novi PIN mora imati ${pinLen()} cifre.`, false);
        if (val('#pinNew') !== val('#pinNew2')) return toast('Novi PIN-ovi se ne poklapaju.', false);
        payload.old = val('#pinOld'); payload.new = val('#pinNew');
    } else if (op === 'resetPin') {
        if (!re.test(val('#pinReset'))) return toast(`Novi PIN mora imati ${pinLen()} cifre.`, false);
        if (val('#pinReset') !== val('#pinReset2')) return toast('PIN-ovi se ne poklapaju.', false);
        payload.new = val('#pinReset');
    } else if (op === 'tier') {
        if (!state.cardTier) return;
        payload.tier = state.cardTier;
    }

    state.busy = true;
    renderCard();
    const res = IN_GAME ? await post('card', payload) : demoCardOp(payload);
    state.busy = false;

    if (!res || !res.ok) {
        toast((res && res.msg) || 'Akcija nije uspela.', false);
        return renderCard();
    }
    Object.assign(state.data, res);
    state.cardTier = null;
    toast(res.msg || 'Sačuvano.');
    renderHeader();
    renderCard();
}

/* ---------------- Kazne (plaćanje isključivo u banci) ---------------- */
function fineRow(f) {
    return `
    <div class="fine-row">
        <div class="tx-ic out">${icon('fine')}</div>
        <div class="fine-t"><strong>#${f.id} · ${esc(f.reason)}</strong><span>${esc(f.officer_name)} · ${esc(f.created)}</span></div>
        <div class="amt out">${money(f.amount)}</div>
        <button class="btn sm primary" data-fine-pay="${f.id}" ${state.finesBusy ? 'disabled' : ''}>Plati</button>
    </div>`;
}

function renderFines() {
    const list = state.fines || [];
    const total = list.reduce((s, f) => s + f.amount, 0);
    $('#view').innerHTML = `
    <div class="card">
        <div class="card-h">
            <div><h3>Neplaćene kazne</h3><p>${list.length ? `${list.length} ${list.length === 1 ? 'kazna' : 'kazni'} · ukupno ${money(total)}` : 'Nemaš neplaćenih kazni.'}</p></div>
            <span class="fine-note">${icon('bank')}Plaćanje sa računa, na šalteru banke</span>
        </div>
        <div class="fine-list">
            ${list.length ? list.map(fineRow).join('') : '<div class="empty">Sve je čisto - nemaš neplaćenih kazni.</div>'}
        </div>
    </div>`;
}

async function loadFines() {
    state.finesLoaded = true;
    const list = IN_GAME ? await post('getFines') : demoFines();
    state.fines = Array.isArray(list) ? list : [];
    if (state.view === 'fines') renderFines();
}

function demoFines() {
    return [
        { id: 501, amount: 1500, reason: 'Brza vožnja', officer_name: 'Officer Perić', created: '21.9.2026 18:40' },
        { id: 498, amount: 4000, reason: 'Vožnja bez dozvole', officer_name: 'Officer Perić', created: '19.9.2026 21:05' }
    ];
}

async function payFine(id) {
    if (state.finesBusy) return;
    state.finesBusy = true;
    renderFines();
    const res = IN_GAME ? await post('payFine', { id }) : demoPayFine(id);
    state.finesBusy = false;

    if (!res || !res.ok) {
        toast((res && res.msg) || 'Kazna nije mogla da se plati.', false);
        renderFines();
        return;
    }

    Object.assign(state.data, res);
    state.fines = state.fines.filter((f) => f.id !== id);
    toast(res.msg || 'Kazna je plaćena.');
    renderHeader();
    renderFines();
}

function demoPayFine(id) {
    const f = state.fines.find((x) => x.id === id);
    if (!f) return { ok: false, msg: 'Kazna nije pronađena.' };
    if (state.data.bank < f.amount) return { ok: false, msg: 'Nemaš dovoljno novca na računu.' };
    state.data.bank -= f.amount;
    return { ok: true, msg: 'Kazna je plaćena.', now: Math.floor(Date.now() / 1000) };
}

/* ---------------- Uplata / podizanje / transfer ---------------- */
const isAtm = () => state.data && state.data.kind === 'atm';
const atmLimit = () => myTier().atmLimit;
const feePct = () => {
    if (isAtm()) return myTier().atmFee || 0;
    return state.mode === 'transfer' ? (myTier().transferFee || 0) : 0;
};

function modeAllowed(m) {
    return isAtm() ? (m === 'withdraw' || m === 'deposit') : true;
}

function maxFor() {
    const d = state.data;
    if (isAtm()) {
        if (state.mode === 'deposit') return Math.min(d.cash, atmLimit());
        let a = Math.floor(d.bank / (1 + feePct() / 100));
        while (a > 0 && a + feeOf(a) > d.bank) a--;
        return Math.max(0, Math.min(a, atmLimit()));
    }
    if (state.mode === 'deposit') return d.cash;
    if (state.mode === 'withdraw') return d.bank;
    const byFee = Math.floor(d.bank / (1 + feePct() / 100));
    return Math.min(byFee, myTier().maxTransfer || byFee);
}
const feeOf = (a) => Math.floor((a * feePct()) / 100);

function problem() {
    const a = state.amount, d = state.data, t = myTier();
    if (state.mode === 'transfer' && !String(state.target).trim()) return a ? 'Unesi ID igrača kome šalješ novac.' : '';
    if (!a) return '';
    if (isAtm()) {
        if (a > atmLimit()) return `${t.label} kartica: najviše ${money(atmLimit())} po transakciji.`;
        if (state.mode === 'deposit') {
            if (a > d.cash) return 'Nemaš toliko gotovine kod sebe.';
            if (a - feeOf(a) < 1) return 'Iznos je premali.';
        } else if (a + feeOf(a) > d.bank) {
            return `Nemaš dovoljno na računu (${money(a + feeOf(a))} sa provizijom).`;
        }
        return '';
    }
    if (state.mode === 'deposit' && a > d.cash) return 'Nemaš toliko gotovine kod sebe.';
    if (state.mode === 'withdraw') {
        if (a > d.bank) return 'Nemaš toliko novca na računu.';
    }
    if (state.mode === 'transfer') {
        if (t.maxTransfer && a > t.maxTransfer) return `${t.label} kartica: najviše ${money(t.maxTransfer)} po transferu.`;
        if (a + feeOf(a) > d.bank) return 'Nemaš dovoljno novca na računu.';
    }
    return '';
}

function renderActions() {
    if (!modeAllowed(state.mode)) state.mode = 'withdraw';
    const quick = isAtm() ? ((state.cfg.atm && state.cfg.atm.quick) || [1000, 5000, 10000, 25000, 50000]) : (state.cfg.quick || [50, 100, 500, 1000, 5000, 10000]);
    const modeIds = isAtm() ? ['withdraw', 'deposit'] : Object.keys(MODES);
    const t = myTier();

    $('#view').innerHTML = `
    <div class="card modes" style="grid-template-columns: repeat(${modeIds.length}, 1fr)">
        ${modeIds.map((id) => { const x = MODES[id]; return `
            <button class="mode ${state.mode === id ? 'active' : ''}" data-mode="${id}">
                <div class="mode-ic">${icon(x.icon)}</div>
                <div class="mode-t"><strong>${x.title}</strong><span>${isAtm() ? `${x.sub}, provizija ${t.atmFee}%` : x.sub}</span></div>
            </button>`; }).join('')}
    </div>

    <div class="act-grid">
        <div class="act-left">
            <div class="card amount-card">
                <div class="amount-top">
                    <div><span class="label">Sa</span><strong>${state.mode === 'deposit' ? 'Gotovina kod sebe' : 'Lični račun'}</strong></div>
                    <div class="avail">${money(state.mode === 'deposit' ? state.data.cash : state.data.bank)}</div>
                </div>
                <div class="amount-input">
                    <span>USD</span>
                    <input id="amt" inputmode="numeric" placeholder="0" value="${state.amount || ''}" aria-label="Iznos">
                    <button class="clear" id="clearAmt">Obriši</button>
                </div>
                <div class="quick">
                    ${quick.map((q) => `<button class="q" data-add="${q}">+${num(q)}</button>`).join('')}
                    <button class="q" data-add="max">Sve</button>
                </div>
            </div>

            ${isAtm() ? '' : `<div class="card field-card">
                ${state.mode === 'transfer' ? `
                <div class="field">
                    <span class="label">ID igrača</span>
                    <label class="input">${icon('hash')}<input id="target" inputmode="numeric" placeholder="npr. 12" value="${esc(state.target)}"></label>
                </div>` : ''}
                <div class="field">
                    <span class="label">Napomena (nije obavezno)</span>
                    <label class="input">${icon('pen')}<input id="memo" maxlength="64" placeholder="${state.mode === 'transfer' ? 'Za šta šalješ novac' : 'Za šta je uplata'}" value="${esc(state.memo)}"></label>
                </div>
            </div>`}
        </div>

        <div class="act-right">
            <div class="card summary"><h3>Pregled</h3><div id="sumRows"></div></div>
            <div class="card total-card"><span class="label" id="totalLabel">Ukupno</span><b id="totalVal">0$</b></div>
        </div>
    </div>

    <button class="go" id="goBtn"></button>
    <div class="warn" id="warn"></div>`;

    const amt = $('#amt');
    amt.addEventListener('input', () => {
        const v = parseInt(amt.value.replace(/\D/g, ''), 10) || 0;
        state.amount = Math.min(v, 2147483647);
        amt.value = state.amount ? state.amount : '';
        updateSummary();
    });
    amt.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
    $('#clearAmt').addEventListener('click', () => { state.amount = 0; amt.value = ''; updateSummary(); });
    const memoEl = $('#memo');
    if (memoEl) memoEl.addEventListener('input', (e) => { state.memo = e.target.value; });
    const tgt = $('#target');
    if (tgt) tgt.addEventListener('input', () => { tgt.value = tgt.value.replace(/\D/g, ''); state.target = tgt.value; updateSummary(); });
    $('#goBtn').addEventListener('click', submit);
    updateSummary();
}

function updateSummary() {
    const a = state.amount, fee = feeOf(a), t = myTier();
    const to = state.mode === 'deposit' ? 'Lični račun'
        : state.mode === 'withdraw' ? 'Gotovina kod sebe'
        : (state.target ? `Igrač ID ${esc(state.target)}` : '—');

    let rows = `
        <div class="sum-row"><span>Vrsta</span><span>${MODES[state.mode].title}</span></div>
        <div class="sum-row"><span>Na</span><span>${to}</span></div>
        <div class="sum-row"><span>Iznos</span><span class="mono">${money(a)}</span></div>`;
    if (state.mode === 'transfer') {
        rows += `<div class="sum-row"><span>Provizija</span><span class="mono">${t.transferFee ? `${money(fee)} (${t.transferFee}%)` : 'Bez provizije'}</span></div>`;
        rows += `<div class="sum-row"><span>Limit (${esc(t.label)})</span><span class="mono">${money(t.maxTransfer)}</span></div>`;
    }

    if (isAtm()) {
        rows = `
        <div class="sum-row"><span>Vrsta</span><span>${MODES[state.mode].title} na bankomatu</span></div>
        <div class="sum-row"><span>${state.mode === 'withdraw' ? 'Dobijaš' : 'Ubacuješ'}</span><span class="mono">${money(a)}</span></div>
        <div class="sum-row"><span>Provizija</span><span class="mono" style="color:${fee ? 'var(--out)' : 'var(--in)'}">${fee ? `${state.mode === 'withdraw' ? '+' : '-'}${money(fee)} (${feePct()}%)` : 'Bez provizije'}</span></div>
        <div class="sum-row"><span>Limit (${esc(t.label)})</span><span class="mono">${money(atmLimit())}</span></div>`;
    }

    $('#sumRows').innerHTML = rows;
    if (isAtm() && state.mode === 'deposit') {
        $('#totalLabel').textContent = 'Stiže na račun';
        $('#totalVal').textContent = money(Math.max(0, a - fee));
    } else {
        $('#totalLabel').textContent = isAtm() ? 'Skida se sa računa' : 'Ukupno';
        $('#totalVal').textContent = money(a + fee);
    }

    const err = problem();
    $('#warn').textContent = err;
    const btn = $('#goBtn');
    btn.disabled = !a || !!err || state.busy;
    btn.innerHTML = icon(MODES[state.mode].icon) + `${MODES[state.mode].verb} ${money(a)}`;
}

async function submit() {
    if (state.busy || !state.amount || problem()) return;
    state.busy = true;
    updateSummary();

    const payload = isAtm() ? { action: state.mode, amount: state.amount } : { action: state.mode, amount: state.amount, memo: state.memo, target: state.target };
    const res = IN_GAME ? await post('action', payload) : demoAction(payload);
    state.busy = false;

    if (!res || !res.ok) {
        toast((res && res.msg) || 'Transakcija nije uspela.', false);
        updateSummary();
        return;
    }

    Object.assign(state.data, res);
    state.amount = 0;
    state.memo = '';
    toast(res.msg || 'Transakcija uspešna.');
    renderHeader();
    renderActions();
}

/* ---------------- routing ---------------- */
function render() {
    renderHeader();
    $('#view').className = 'view' + (state.view === 'actions' ? ' actions-view' : '');
    if (state.view === 'history') renderHistory();
    else if (state.view === 'actions') renderActions();
    else if (state.view === 'fines') renderFines();
    else if (state.view === 'card') renderCard();
    else renderOverview();
    $('#view').scrollTop = 0;
}

function go(view, mode) {
    if (!view) return;
    state.view = view;
    state.cardTier = null;
    if (mode) { state.mode = mode; state.amount = 0; }
    render();
    if (view === 'fines' && !state.finesBusy) loadFines();
}

function resetState(data, cfg) {
    state.data = data;
    state.data.transactions = data.transactions || [];
    state.cfg = cfg || state.cfg || {};
    state.filter = 'all';
    state.search = '';
    state.amount = 0; state.target = ''; state.memo = ''; state.busy = false;
    state.fines = []; state.finesLoaded = false; state.finesBusy = false;
    state.pads = {}; state.pinError = ''; state.cardTier = null;
}

function openUI(data, cfg) {
    resetState(data, cfg);
    $('#app').classList.remove('hidden');

    if (data.noAccount) {
        state.ob = { step: 1, tier: null, pin: '', stage: 1 };
        showScreen('onboard');
        return renderOnboard();
    }
    if (data.needPin) {
        showScreen('pin');
        return renderPinScreen();
    }

    showScreen('bank');
    state.view = data.kind === 'atm' ? 'actions' : (cardIssue() ? 'card' : 'overview');
    state.mode = data.kind === 'atm' ? 'withdraw' : 'deposit';
    $('#bank').classList.toggle('no-fines', !(state.cfg.fines && state.cfg.fines.enabled));
    const navFines = $('#navFines');
    if (navFines) navFines.classList.toggle('nav-bank', !(state.cfg.fines && state.cfg.fines.atm));
    render();
}

function closeUI(silent) {
    $('#app').classList.add('hidden');
    state.activePad = null;
    if (IN_GAME && silent !== true) post('close');
}

/* ---------------- events ---------------- */
document.querySelectorAll('[data-i]').forEach((el) => { el.innerHTML = icon(el.dataset.i); });

document.addEventListener('click', (e) => {
    const key = e.target.closest('[data-key]');
    if (key) return padPress(key.closest('[data-pad]').dataset.pad, key.dataset.key);
    const ob = e.target.closest('[data-ob]');
    if (ob && !ob.disabled) return obNav(ob.dataset.ob);
    const tier = e.target.closest('[data-tier]');
    if (tier && !tier.disabled) {
        if (state.screen === 'onboard') { state.ob.tier = tier.dataset.tier; return renderOnboard(); }
        state.cardTier = tier.dataset.tier === myTier().id ? null : tier.dataset.tier;
        return renderCard();
    }
    const op = e.target.closest('[data-card-op]');
    if (op && !op.disabled) return cardOp(op.dataset.cardOp);
    const nav = e.target.closest('[data-view]');
    if (nav) return go(nav.dataset.view);
    const link = e.target.closest('[data-go]');
    if (link) return go(link.dataset.go);
    const chip = e.target.closest('[data-filter]');
    if (chip) {
        state.filter = chip.dataset.filter;
        document.querySelectorAll('.chip').forEach((c) => c.classList.toggle('active', c === chip));
        return renderHistoryList();
    }
    const atmNav = e.target.closest('[data-atm-mode]');
    if (atmNav) { state.mode = atmNav.dataset.atmMode; state.amount = 0; renderHeader(); return renderActions(); }
    const mode = e.target.closest('[data-mode]');
    if (mode && !mode.disabled) { state.mode = mode.dataset.mode; state.amount = 0; renderHeader(); return renderActions(); }
    const add = e.target.closest('[data-add]');
    if (add) {
        const max = maxFor();
        state.amount = add.dataset.add === 'max' ? Math.max(0, max) : state.amount + Number(add.dataset.add);
        $('#amt').value = state.amount || '';
        return updateSummary();
    }
    const finePay = e.target.closest('[data-fine-pay]');
    if (finePay && !finePay.disabled) return payFine(Number(finePay.dataset.finePay));
});

$('#btnTransfer').addEventListener('click', () => go('actions', modeAllowed('transfer') ? 'transfer' : 'withdraw'));
$('#btnHistory').addEventListener('click', () => go('history'));
$('#btnClose').addEventListener('click', closeUI);

document.addEventListener('keydown', (e) => {
    if ($('#app').classList.contains('hidden')) return;
    if (e.key === 'Escape') return closeUI();
    // PIN sa tastature (samo kad je PIN tastatura na ekranu i nije fokusirano neko polje)
    if (state.activePad && !(e.target instanceof HTMLInputElement)) {
        if (/^\d$/.test(e.key)) padPress(state.activePad, e.key);
        else if (e.key === 'Backspace') padPress(state.activePad, 'del');
        else if (e.key === 'Delete') padPress(state.activePad, 'clr');
    }
});

window.addEventListener('message', (e) => {
    const m = e.data || {};
    if (m.action === 'open') openUI(m.data, m.config);
    if (m.action === 'close') { $('#app').classList.add('hidden'); state.activePad = null; }
});

/* ---------------- demo (samo u browseru, ne u igri) ---------------- */
function demoAction(p) {
    const d = state.data, now = Math.floor(Date.now() / 1000);
    const push = (type, title, memo, party, amount) => d.transactions.unshift({ id: Date.now(), type, title, memo, party, amount, ts: now });
    const f = isAtm() ? feeOf(p.amount) : 0;
    if (isAtm() && p.action === 'deposit') { d.cash -= p.amount; d.bank += p.amount - f; return { ok: true, msg: 'Uplata uspešna.', now }; }
    if (isAtm() && p.action === 'withdraw') { d.bank -= p.amount + f; d.cash += p.amount; return { ok: true, msg: 'Podizanje uspešno.', now }; }
    if (p.action === 'deposit') { d.cash -= p.amount; d.bank += p.amount; push('deposit', 'Uplata na račun', p.memo || 'Gotovina na račun', 'Fleeca Banka', p.amount); }
    if (p.action === 'withdraw') { d.bank -= p.amount; d.cash += p.amount; push('withdraw', 'Podizanje novca', p.memo || 'Račun u gotovinu', 'Fleeca Banka', p.amount); }
    if (p.action === 'transfer') { d.bank -= p.amount; push('transfer_out', 'Poslat novac', p.memo || 'Transfer na račun', `Igrač ${p.target}`, p.amount); }
    return { ok: true, msg: 'Transakcija uspešna.', now };
}

const DEMO_PIN = '1234';

function demoVerifyPin(pin) {
    const c = state.data.card;
    if (pin === DEMO_PIN) return Object.assign(demoData('atm'), { ok: true });
    c.triesLeft = Math.max(0, (c.triesLeft ?? 3) - 1);
    if (!c.triesLeft) return { ok: false, blocked: true, msg: 'Kartica je blokirana.' };
    return { ok: false, msg: `Pogrešan PIN. Preostalo pokušaja: ${c.triesLeft}. (demo PIN: ${DEMO_PIN})`, triesLeft: c.triesLeft };
}

function demoOpenAccount(p) {
    const d = demoData('bank');
    d.card = { number: '4716 2291 0843 5520', tier: p.tier, hasPin: true, blocked: false, triesLeft: 3, hasItem: true, feeDue: tierById(p.tier).maintenance ? d.now + 7 * 86400 : null };
    d.transactions = [];
    return Object.assign(d, { ok: true, msg: 'Račun je otvoren! Dobio si bankovnu karticu.' });
}

function demoCardOp(p) {
    const c = state.data.card;
    if (p.op === 'reissue') { c.hasItem = true; c.number = '4716 8830 1127 9034'; state.data.bank -= state.cfg.reissueFee || 0; return { ok: true, msg: 'Izdata je nova kartica.' }; }
    if (p.op === 'changePin') { if (p.old !== DEMO_PIN) return { ok: false, msg: `Stari PIN nije tačan. (demo: ${DEMO_PIN})` }; return { ok: true, msg: 'PIN je promenjen.' }; }
    if (p.op === 'resetPin') { c.hasPin = true; c.blocked = false; c.triesLeft = 3; return { ok: true, msg: 'Novi PIN je postavljen.' }; }
    if (p.op === 'tier') { const t = tierById(p.tier); if (t.price > tierById(c.tier).price) state.data.bank -= t.price; c.tier = t.id; return { ok: true, msg: `Prešao si na ${t.label} paket.` }; }
    return { ok: false, msg: 'Nepoznata akcija.' };
}

function demoData(kind) {
    const now = Math.floor(Date.now() / 1000), day = 86400;
    const tx = [
        ['income', 'Plata', 'Payday', 'Država', 2500, 0.1],
        ['transfer_in', 'Primljen novac', 'Za auto', 'Marko Petrović', 45000, 0.4],
        ['withdraw', 'Podizanje novca', 'Račun u gotovinu', 'Bankomat', 5000, 2],
        ['deposit', 'Uplata na račun', 'Gotovina na račun', 'Fleeca Banka', 28000, 6],
        ['transfer_out', 'Poslat novac', 'Kirija', 'Stefan Jovanović', 12500, 9],
        ['expense', 'Kazna', 'Brza vožnja', 'LSPD', 1500, 13],
        ['income', 'Posao', 'Rudar isplata', 'Rudnik', 22500, 17],
        ['transfer_out', 'Poslat novac', 'Dug', 'Nikola Ilić', 3200, 22],
        ['deposit', 'Uplata na račun', 'Gotovina na račun', 'Fleeca Banka', 15000, 27]
    ].map(([type, title, memo, party, amount, ago], i) => ({ id: i, type, title, memo, party, amount, ts: now - Math.floor(ago * day) }));
    return {
        name: 'Dušan Dimitrijević', bank: 185750, cash: 12400, transactions: tx, now,
        kind, place: kind === 'atm' ? 'Bankomat' : 'Fleeca Banka', hasAccount: true,
        card: { number: '4716 2291 0843 5520', tier: 'premium', hasPin: true, blocked: false, triesLeft: 3, hasItem: !location.search.includes('lost'), feeDue: now + 5 * day }
    };
}

if (!IN_GAME) window.addEventListener('DOMContentLoaded', () => {
    const q = location.search;
    const cfg = {
        quick: [50, 100, 500, 1000, 5000, 10000], atm: { quick: [1000, 5000, 10000, 25000, 50000, 100000] },
        statsDays: 30, fines: { enabled: true, atm: false }, cards: DEFAULT_CARDS, defaultCard: 'standard',
        pinLength: 4, pinMaxTries: 3, reissueFee: 500, pinResetFee: 250, maintenance: { enabled: true, days: 7, label: 'nedeljno' }, cardItem: true
    };
    if (q.includes('new')) return openUI({ noAccount: true, kind: 'bank', place: 'Fleeca Banka', name: 'Dušan Dimitrijević', cash: 12400, bank: 0 }, cfg);
    if (q.includes('atm')) {
        const d = demoData('atm');
        return openUI({ needPin: true, kind: 'atm', place: 'Bankomat', name: d.name, card: { tier: 'premium', last4: '5520', triesLeft: 3 } }, cfg);
    }
    openUI(demoData('bank'), cfg);
    if (q.includes('card')) go('card');
});
